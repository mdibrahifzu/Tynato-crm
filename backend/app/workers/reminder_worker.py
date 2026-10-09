from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load backend/.env before importing anything that reads env vars.
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env", override=False)

from sqlalchemy import text

from app.database import engine
from app.routes.notifications import create_in_app_notification

try:
    from pywebpush import webpush, WebPushException
except ImportError:  # in-app reminders still work without push
    webpush = None
    WebPushException = Exception

log = logging.getLogger("reminder_worker")

POLL_SECONDS = 20
VAPID_PRIVATE_KEY = os.getenv("WEB_PUSH_VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.getenv(
    "WEB_PUSH_VAPID_SUBJECT", "mailto:admin@tynato.com"
).strip()

OFFSET_LABELS = {
    5: "5 minutes",
    15: "15 minutes",
    30: "30 minutes",
    60: "1 hour",
    1440: "24 hours",
}


def recover_stuck(conn):
    # Rows left in 'processing' by a crashed run go back to the queue.
    conn.execute(
        text(
            """
            UPDATE public.lead_follow_ups
            SET status = 'scheduled', updated_at = NOW()
            WHERE status = 'processing'
              AND updated_at < NOW() - INTERVAL '5 minutes'
            """
        )
    )


def claim_due(conn):
    rows = conn.execute(
        text(
            """
            UPDATE public.lead_follow_ups
            SET status = 'processing', updated_at = NOW()
            WHERE id IN (
                SELECT id
                FROM public.lead_follow_ups
                WHERE status = 'scheduled'
                    AND remind_at <= NOW()
                  AND follow_up_at > NOW()
                ORDER BY remind_at
                LIMIT 20
                FOR UPDATE SKIP LOCKED
            )
            RETURNING
                id,
                custom_lead_id,
                team_id,
                assigned_to,
                follow_up_at,
                remind_at,
                reminder_offset_minutes
            """
        )
    ).mappings().all()

    return [dict(row) for row in rows]


def send_push(user_id, payload):
    if webpush is None or not VAPID_PRIVATE_KEY:
        log.warning("Web push skipped: pywebpush or VAPID private key missing")
        return

    with engine.begin() as conn:
        subs = conn.execute(
            text(
                """
                SELECT id, endpoint, p256dh, auth
                FROM public.web_push_subscriptions
                WHERE user_id = :user_id
                  AND is_active = TRUE
                """
            ),
            {"user_id": str(user_id)},
        ).mappings().all()

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {
                        "p256dh": sub["p256dh"],
                        "auth": sub["auth"],
                    },
                },
                data=json.dumps(payload),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
        except WebPushException as exc:
            status = getattr(
                getattr(exc, "response", None), "status_code", None
            )
            if status in (404, 410):
                with engine.begin() as conn:
                    conn.execute(
                        text(
                            """
                            UPDATE public.web_push_subscriptions
                            SET is_active = FALSE, updated_at = NOW()
                            WHERE id = :id
                            """
                        ),
                        {"id": sub["id"]},
                    )
            else:
                log.error("Push failed (status=%s): %s", status, exc)
        except Exception:
            log.exception("Push failed")


def process(row):
    left = int(
        (row["follow_up_at"] - datetime.now(timezone.utc)).total_seconds() // 60
    )
    left = max(left, 1)
    when = f"{left} minutes" if left < 90 else f"{round(left / 60)} hours"

    with engine.begin() as conn:
        lead = conn.execute(
            text("SELECT full_name FROM public.custom_leads WHERE id = :id"),
            {"id": str(row["custom_lead_id"])},
        ).mappings().first()

        name = (lead["full_name"] if lead else None) or "A lead"
        title = "Follow-up reminder"
        message = f"Follow-up with {name} is due in {when}."

        create_in_app_notification(
            conn,
            team_id=row["team_id"],
            user_id=row["assigned_to"],
            notification_type="LEAD_FOLLOW_UP",
            title=title,
            message=message,
            entity_type="custom_lead",
            entity_id=str(row["custom_lead_id"]),
            metadata={"follow_up_at": row["follow_up_at"].isoformat()},
            dedupe_key=f"follow_up_reminder:{row['id']}:{row['remind_at'].isoformat()}",
        )

        conn.execute(
            text(
                """
                UPDATE public.lead_follow_ups
                SET status = 'reminded',
                    reminder_sent_at = NOW(),
                    updated_at = NOW()
                WHERE id = :id AND status = 'processing'
                """
            ),
            {"id": row["id"]},
        )

    # Push is sent after the DB commit, so a push failure never undoes the reminder.
    send_push(
        row["assigned_to"],
        {
            "title": title,
            "body": message,
            "tag": f"follow-up-{row['id']}",
            "lead_id": str(row["custom_lead_id"]),
            "target_url": "/custom-lead",
        },
    )


def process_due():
    pushes = []

    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                UPDATE public.lead_follow_ups
                SET due_notified_at = NOW(),
                    status = 'reminded',
                    reminder_sent_at = COALESCE(reminder_sent_at, NOW()),
                    updated_at = NOW()
                WHERE id IN (
                    SELECT id
                    FROM public.lead_follow_ups
                    WHERE status IN ('scheduled', 'reminded')
                      AND due_notified_at IS NULL
                      AND follow_up_at <= NOW()
                    ORDER BY follow_up_at
                    LIMIT 20
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id, custom_lead_id, team_id, assigned_to, follow_up_at
                """
            )
        ).mappings().all()

        for row in rows:
            lead = conn.execute(
                text("SELECT full_name FROM public.custom_leads WHERE id = :id"),
                {"id": str(row["custom_lead_id"])},
            ).mappings().first()

            name = (lead["full_name"] if lead else None) or "A lead"
            title = "Follow-up due now"
            message = f"Follow-up with {name} is due now."

            create_in_app_notification(
                conn,
                team_id=row["team_id"],
                user_id=row["assigned_to"],
                notification_type="LEAD_FOLLOW_UP",
                title=title,
                message=message,
                entity_type="custom_lead",
                entity_id=str(row["custom_lead_id"]),
                metadata={"follow_up_at": row["follow_up_at"].isoformat()},
                dedupe_key=f"follow_up_due:{row['id']}:{row['follow_up_at'].isoformat()}",
            )

            pushes.append((row, title, message))

    for row, title, message in pushes:
        send_push(
            row["assigned_to"],
            {
                "title": title,
                "body": message,
                "tag": f"follow-up-due-{row['id']}",
                "lead_id": str(row["custom_lead_id"]),
                "target_url": "/custom-lead",
            },
        )
        log.info("Due alert sent for follow-up %s", row["id"])

def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    log.info("Reminder worker started")

    while True:
        try:
            with engine.begin() as conn:
                recover_stuck(conn)
                rows = claim_due(conn)

            for row in rows:
                try:
                    process(row)
                    log.info("Reminder sent for follow-up %s", row["id"])
                except Exception:
                    log.exception("Reminder failed for %s", row["id"])
                    with engine.begin() as conn:
                        conn.execute(
                            text(
                                """
                                UPDATE public.lead_follow_ups
                                SET status = 'scheduled', updated_at = NOW()
                                WHERE id = :id AND status = 'processing'
                                """
                            ),
                            {"id": row["id"]},
                        )
                    process_due()
        except Exception:
            log.exception("Worker cycle failed")

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()