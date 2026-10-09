from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone

from pywebpush import WebPushException, webpush
from sqlalchemy import text

from app.database import engine


MAX_ATTEMPTS = int(
    os.getenv("WEB_PUSH_MAX_ATTEMPTS", "8")
)
LOCK_SECONDS = int(
    os.getenv("WEB_PUSH_LOCK_SECONDS", "120")
)
BATCH_SIZE = int(
    os.getenv("WEB_PUSH_BATCH_SIZE", "25")
)

VAPID_PRIVATE_KEY = os.getenv(
    "WEB_PUSH_VAPID_PRIVATE_KEY",
    "",
).strip()
VAPID_SUBJECT = os.getenv(
    "WEB_PUSH_VAPID_SUBJECT",
    "mailto:admin@tynato.com",
).strip()


def _send(row):
    if not VAPID_PRIVATE_KEY:
        raise RuntimeError(
            "WEB_PUSH_VAPID_PRIVATE_KEY is not configured."
        )

    subscription_info = {
        "endpoint": row["endpoint"],
        "keys": {
            "p256dh": row["p256dh"],
            "auth": row["auth"],
        },
    }

    return webpush(
        subscription_info=subscription_info,
        data=json.dumps(row["payload"] or {}),
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims={"sub": VAPID_SUBJECT},
        ttl=120,
        timeout=10,
    )


def claim_batch(limit: int = BATCH_SIZE):
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    o.id,
                    o.subscription_id,
                    o.title,
                    o.body,
                    o.payload,
                    o.attempts,
                    s.endpoint,
                    s.p256dh,
                    s.auth
                FROM public.web_push_outbox o
                INNER JOIN public.web_push_subscriptions s
                    ON s.id = o.subscription_id
                   AND s.is_active = TRUE
                WHERE (
                    (
                        o.status IN ('pending','retry')
                        AND o.next_attempt_at <= NOW()
                    )
                    OR (
                        o.status = 'processing'
                        AND o.locked_until < NOW()
                    )
                )
                ORDER BY o.created_at ASC
                FOR UPDATE OF o
                SKIP LOCKED
                LIMIT :limit
                """
            ),
            {"limit": limit},
        ).mappings().all()

        if not rows:
            return []

        conn.execute(
            text(
                """
                UPDATE public.web_push_outbox
                SET status = 'processing',
                    attempts = attempts + 1,
                    locked_until = NOW() + (
                        :lock_seconds * INTERVAL '1 second'
                    ),
                    last_error = NULL
                WHERE id = ANY(:ids)
                """
            ),
            {
                "ids": [row["id"] for row in rows],
                "lock_seconds": LOCK_SECONDS,
            },
        )

    return rows


def _retry_or_dead(
    conn,
    row,
    error: str,
):
    next_attempt = int(row["attempts"] or 0) + 1

    if next_attempt >= MAX_ATTEMPTS:
        status = "dead"
        next_attempt_at = datetime.now(timezone.utc)
    else:
        status = "retry"
        delay = min(
            900,
            10 * (2 ** max(next_attempt - 1, 0)),
        )
        next_attempt_at = (
            datetime.now(timezone.utc)
            + timedelta(seconds=delay)
        )

    conn.execute(
        text(
            """
            UPDATE public.web_push_outbox
            SET status = :status,
                next_attempt_at = :next_attempt_at,
                locked_until = NULL,
                last_error = :last_error
            WHERE id = :id
            """
        ),
        {
            "id": row["id"],
            "status": status,
            "next_attempt_at": next_attempt_at,
            "last_error": error[:2000],
        },
    )


def process_batch(limit: int = BATCH_SIZE) -> int:
    rows = claim_batch(limit)
    processed = 0

    for row in rows:
        try:
            _send(row)

            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        UPDATE public.web_push_outbox
                        SET status = 'sent',
                            locked_until = NULL,
                            sent_at = NOW(),
                            last_error = NULL
                        WHERE id = :id
                        """
                    ),
                    {"id": row["id"]},
                )

            processed += 1

        except WebPushException as exc:
            response = getattr(exc, "response", None)
            status_code = getattr(
                response,
                "status_code",
                None,
            )

            with engine.begin() as conn:
                if status_code in {404, 410}:
                    conn.execute(
                        text(
                            """
                            UPDATE public.web_push_subscriptions
                            SET is_active = FALSE,
                                updated_at = NOW()
                            WHERE id = :subscription_id
                            """
                        ),
                        {
                            "subscription_id":
                                row["subscription_id"]
                        },
                    )

                    conn.execute(
                        text(
                            """
                            UPDATE public.web_push_outbox
                            SET status = 'dead',
                                locked_until = NULL,
                                last_error = :error
                            WHERE id = :id
                            """
                        ),
                        {
                            "id": row["id"],
                            "error": str(exc)[:2000],
                        },
                    )
                else:
                    _retry_or_dead(
                        conn,
                        row,
                        str(exc),
                    )

        except Exception as exc:
            with engine.begin() as conn:
                _retry_or_dead(
                    conn,
                    row,
                    str(exc),
                )

    return processed


def run_forever():
    poll_seconds = int(
        os.getenv("WEB_PUSH_POLL_SECONDS", "2")
    )

    while True:
        try:
            processed = process_batch()
            print(
                f"[Web Push Worker] polling... processed={processed}",
                flush=True,
            )
        except Exception as exc:
            # Keep the worker alive, but expose the actual failure.
            print(
                f"[Web Push Worker] cycle failed: {exc!r}",
                flush=True,
            )

        time.sleep(poll_seconds)


if __name__ == "__main__":
    run_forever()
