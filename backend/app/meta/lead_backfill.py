from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, Optional

from sqlalchemy import text

from app.database import SessionLocal
from app.meta.client import MetaAPIError, MetaClient
from app.meta.service import get_page_token

logger = logging.getLogger("tynato.meta.backfill")

_last_manual_sync: Dict[str, float] = {}


def _s(value: Any) -> Optional[str]:
    value = str(value or "").strip()
    return value or None


def _queue_lead(
    db,
    connection_id,
    team_id,
    page_id: str,
    form_id: str,
    item: Dict[str, Any],
) -> bool:
    """Queue one Meta lead exactly like the webhook does. Idempotent."""
    leadgen_id = _s(item.get("id"))
    if not leadgen_id:
        return False

    external_event_id = "leadgen:{}:{}".format(page_id, leadgen_id)
    ad_id = _s(item.get("ad_id"))
    adset_id = _s(item.get("adset_id"))
    campaign_id = _s(item.get("campaign_id"))
    form_id = _s(item.get("form_id")) or form_id

    inserted = db.execute(
        text(
            """
            INSERT INTO public.meta_webhook_events (
                connection_id, team_id, meta_page_id, event_type,
                external_event_id, leadgen_id, form_id, ad_id,
                adset_id, campaign_id, payload, status,
                received_at, next_attempt_at
            )
            VALUES (
                :connection_id, :team_id, :page_id, 'leadgen',
                :external_event_id, :leadgen_id, :form_id, :ad_id,
                :adset_id, :campaign_id, CAST(:payload AS jsonb),
                'received', NOW(), NOW()
            )
            ON CONFLICT (external_event_id) DO NOTHING
            RETURNING id
            """
        ),
        {
            "connection_id": connection_id,
            "team_id": team_id,
            "page_id": page_id,
            "external_event_id": external_event_id,
            "leadgen_id": leadgen_id,
            "form_id": form_id,
            "ad_id": ad_id,
            "adset_id": adset_id,
            "campaign_id": campaign_id,
            "payload": json.dumps(item),
        },
    ).scalar()

    if not inserted:
        return False

    db.execute(
        text(
            """
            INSERT INTO public.meta_jobs (
                queue, job_type, team_id, connection_id, payload, status
            )
            VALUES (
                'meta', 'import_meta_lead', :team_id, :connection_id,
                CAST(:payload AS jsonb), 'pending'
            )
            """
        ),
        {
            "team_id": team_id,
            "connection_id": connection_id,
            "payload": json.dumps(
                {
                    "event_key": external_event_id,
                    "page_id": page_id,
                    "leadgen_id": leadgen_id,
                    "form_id": form_id,
                    "ad_id": ad_id,
                    "adset_id": adset_id,
                    "campaign_id": campaign_id,
                }
            ),
        },
    )
    return True


def reconcile_connection(
    db,
    connection_id,
    team_id,
    since_days: Optional[int],
) -> int:
    """Pull leads from every lead form and queue the ones not imported yet."""
    client = MetaClient()
    queued = 0

    pages = db.execute(
        text(
            "SELECT meta_page_id FROM public.meta_pages "
            "WHERE connection_id = :connection_id AND status = 'active'"
        ),
        {"connection_id": connection_id},
    ).scalars().all()

    for page_id in pages:
        try:
            token = get_page_token(db, connection_id, team_id, page_id)
            forms = client.leadgen_forms(token, page_id)
        except (MetaAPIError, ValueError, RuntimeError) as exc:
            logger.warning(
                "Lead reconcile: forms unavailable for page %s (%s)",
                page_id,
                exc,
            )
            continue

        for form in forms:
            form_id = _s(form.get("id"))
            if not form_id:
                continue

            params: Dict[str, Any] = {
                "fields": "id,created_time,ad_id,adset_id,campaign_id,form_id"
            }
            if since_days:
                params["filtering"] = json.dumps(
                    [
                        {
                            "field": "time_created",
                            "operator": "GREATER_THAN",
                            "value": int(time.time())
                            - int(since_days) * 86400,
                        }
                    ]
                )

            try:
                leads = client._paged_request(
                    "/{}/leads".format(form_id), token, params
                )
            except MetaAPIError as exc:
                logger.warning(
                    "Lead reconcile: cannot read leads of form %s "
                    "(HTTP %s). Check the leads_retrieval permission "
                    "and Leads Access on the Page.",
                    form_id,
                    exc.status_code,
                )
                continue

            for item in leads:
                if _queue_lead(
                    db, connection_id, team_id, page_id, form_id, item
                ):
                    queued += 1

            db.commit()

    return queued


def reconcile_all(
    since_days: Optional[int],
    team_id=None,
) -> int:
    db = SessionLocal()
    total = 0
    try:
        sql = (
            "SELECT id, team_id FROM public.meta_connections "
            "WHERE status = 'active'"
        )
        params: Dict[str, Any] = {}
        if team_id is not None:
            sql += " AND team_id = :team_id"
            params["team_id"] = team_id

        for conn in db.execute(text(sql), params).mappings().all():
            try:
                total += reconcile_connection(
                    db, conn["id"], conn["team_id"], since_days
                )
            except Exception:
                db.rollback()
                logger.exception(
                    "Lead reconcile failed for connection %s", conn["id"]
                )
    finally:
        db.close()

    if total:
        logger.info("Meta lead reconcile queued %s new lead(s)", total)
    return total


def sync_team_now(team_id) -> None:
    """Called when someone opens the Meta page. Throttled to once per 2 min."""
    now = time.monotonic()
    last = _last_manual_sync.get(str(team_id))
    if last is not None and now - last < 120:
        return
    _last_manual_sync[str(team_id)] = now

    from app.meta.worker import auto_enqueue_syncs

    auto_enqueue_syncs(True, team_id)
    reconcile_all(7, team_id)
