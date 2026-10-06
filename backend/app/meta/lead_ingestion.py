from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.meta.client import MetaClient
from app.meta.service import get_page_token
from app.routes.custom_leads import create_custom_lead_record
from app.routes.notifications import create_in_app_notification


def _text(value: Any) -> Optional[str]:
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _datetime(value: Any):
    value = _text(value)
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
    except ValueError:
        return None
    return parsed


def normalize_meta_lead(payload: Dict[str, Any]) -> Dict[str, Any]:
    fields: Dict[str, str] = {}

    for item in payload.get("field_data") or []:
        if not isinstance(item, dict):
            continue

        name = _text(item.get("name"))
        values = item.get("values") or []

        if name and values:
            fields[name.lower()] = str(values[0]).strip()

    full_name = (
        fields.get("full_name")
        or fields.get("name")
        or " ".join(
            x for x in (
                fields.get("first_name"),
                fields.get("last_name"),
            )
            if x
        ).strip()
        or None
    )

    return {
        "leadgen_id": _text(payload.get("id")),
        "full_name": full_name,
        "phone_number": (
            fields.get("phone_number")
            or fields.get("phone")
        ),
        "email": fields.get("email"),
        "project_location": (
            fields.get("project_location")
            or fields.get("preferred_location")
            or fields.get("location")
            or fields.get("city")
        ),
        "created_time": _datetime(
            payload.get("created_time")
        ),
        "ad_id": _text(payload.get("ad_id")),
        "adset_id": _text(payload.get("adset_id")),
        "campaign_id": _text(payload.get("campaign_id")),
        "form_id": _text(payload.get("form_id")),
    }


def _context(
    db: Session,
    *,
    team_id,
    page_id: str,
    form_id: Optional[str],
    campaign_id: Optional[str],
):
    form_name = None
    campaign_name = None

    if form_id:
        form_name = db.execute(
            text(
                """
                SELECT name
                FROM public.meta_lead_forms
                WHERE team_id = :team_id
                  AND meta_form_id = :form_id
                  AND meta_page_id = :page_id
                LIMIT 1
                """
            ),
            {
                "team_id": team_id,
                "form_id": form_id,
                "page_id": page_id,
            },
        ).scalar()

    if campaign_id:
        campaign_name = db.execute(
            text(
                """
                SELECT name
                FROM public.meta_campaigns
                WHERE team_id = :team_id
                  AND meta_campaign_id = :campaign_id
                ORDER BY updated_at DESC
                LIMIT 1
                """
            ),
            {
                "team_id": team_id,
                "campaign_id": campaign_id,
            },
        ).scalar()

    return {
        "form_name": form_name,
        "campaign_name": campaign_name,
    }


def process_meta_lead_job(
    db: Session,
    job: Dict[str, Any],
) -> Dict[str, int]:
    payload = job.get("payload") or {}

    event_key = _text(payload.get("event_key"))
    page_id = _text(payload.get("page_id"))
    leadgen_id = _text(payload.get("leadgen_id"))

    if not event_key or not page_id or not leadgen_id:
        raise ValueError(
            "Meta lead job is missing required identifiers."
        )

    team_id = job["team_id"]
    connection_id = job["connection_id"]

    event = db.execute(
        text(
            """
            SELECT id, status
            FROM public.meta_webhook_events
            WHERE external_event_id = :event_key
              AND team_id = :team_id
              AND connection_id = :connection_id
            FOR UPDATE
            """
        ),
        {
            "event_key": event_key,
            "team_id": team_id,
            "connection_id": connection_id,
        },
    ).mappings().first()

    if not event:
        raise ValueError(
            "Meta webhook event not found."
        )

    existing = db.execute(
        text(
            """
            SELECT lead_id
            FROM public.lead_source_attribution
            WHERE team_id = :team_id
              AND source = 'meta'
              AND leadgen_id = :leadgen_id
            LIMIT 1
            """
        ),
        {
            "team_id": team_id,
            "leadgen_id": leadgen_id,
        },
    ).scalar()

    if existing:
        db.execute(
            text(
                """
                UPDATE public.meta_webhook_events
                SET status = 'processed',
                    processed_at = NOW(),
                    last_error = NULL
                WHERE id = :event_id
                """
            ),
            {"event_id": event["id"]},
        )
        return {"created": 0, "duplicate": 1}

    connection = db.execute(
        text(
            """
            SELECT connected_by_user_id
            FROM public.meta_connections
            WHERE id = :connection_id
              AND team_id = :team_id
              AND status = 'active'
            LIMIT 1
            """
        ),
        {
            "connection_id": connection_id,
            "team_id": team_id,
        },
    ).mappings().first()

    if not connection or not connection["connected_by_user_id"]:
        raise ValueError(
            "No active CRM owner is available for Meta lead assignment."
        )

    token = get_page_token(
        db,
        connection_id,
        team_id,
        page_id,
    )

    meta_lead = MetaClient().lead(
        token,
        leadgen_id,
    )

    normalized = normalize_meta_lead(
        meta_lead
    )

    context = _context(
        db,
        team_id=team_id,
        page_id=page_id,
        form_id=normalized["form_id"]
        or _text(payload.get("form_id")),
        campaign_id=normalized["campaign_id"]
        or _text(payload.get("campaign_id")),
    )

    lead = create_custom_lead_record(
        db,
        team_id=team_id,
        owner_id=connection["connected_by_user_id"],
        form_name=context["form_name"],
        full_name=normalized["full_name"],
        phone_number=normalized["phone_number"],
        email=normalized["email"],
        project_location=normalized["project_location"],
        created_time=normalized["created_time"],
    )

    campaign_id = (
        normalized["campaign_id"]
        or _text(payload.get("campaign_id"))
    )
    adset_id = (
        normalized["adset_id"]
        or _text(payload.get("adset_id"))
    )
    ad_id = (
        normalized["ad_id"]
        or _text(payload.get("ad_id"))
    )
    form_id = (
        normalized["form_id"]
        or _text(payload.get("form_id"))
    )

    db.execute(
        text(
            """
            INSERT INTO public.lead_source_attribution (
                lead_id,
                team_id,
                connection_id,
                source,
                leadgen_id,
                meta_page_id,
                meta_form_id,
                meta_campaign_id,
                meta_adset_id,
                meta_ad_id,
                campaign_name_snapshot,
                form_name_snapshot,
                meta_created_at,
                created_at
            )
            VALUES (
                :lead_id,
                :team_id,
                :connection_id,
                'meta',
                :leadgen_id,
                :page_id,
                :form_id,
                :campaign_id,
                :adset_id,
                :ad_id,
                :campaign_name,
                :form_name,
                :meta_created_at,
                NOW()
            )
            ON CONFLICT DO NOTHING
            """
        ),
        {
            "lead_id": lead["id"],
            "team_id": team_id,
            "connection_id": connection_id,
            "leadgen_id": leadgen_id,
            "page_id": page_id,
            "form_id": form_id,
            "campaign_id": campaign_id,
            "adset_id": adset_id,
            "ad_id": ad_id,
            "campaign_name": context["campaign_name"],
            "form_name": context["form_name"],
            "meta_created_at": normalized["created_time"],
        },
    )

    dedupe_key = (
        "meta-lead:{}:{}".format(
            team_id,
            leadgen_id,
        )
    )

    metadata = {
        "source": "meta",
        "meta_lead_id": leadgen_id,
        "page_id": page_id,
        "form_id": form_id,
        "campaign_id": campaign_id,
        "adset_id": adset_id,
        "ad_id": ad_id,
    }

    create_in_app_notification(
        db,
        team_id=team_id,
        user_id=connection["connected_by_user_id"],
        notification_type="meta_lead",
        title="New Meta Lead",
        message=(
            normalized["full_name"]
            or normalized["phone_number"]
            or "New lead received from Meta"
        ),
        entity_type="custom_lead",
        entity_id=lead["id"],
        metadata=metadata,
        dedupe_key=dedupe_key,
    )

    db.execute(
        text(
            """
            INSERT INTO public.web_push_outbox (
                event_key,
                user_id,
                subscription_id,
                provider,
                title,
                body,
                payload
            )
            SELECT
                :event_key,
                d.user_id,
                d.id,
                'webpush',
                :title,
                :body,
                CAST(:payload AS jsonb)
            FROM public.web_push_subscriptions d
            WHERE d.user_id = :user_id
              AND d.team_id = :team_id
              AND d.is_active = TRUE
            ON CONFLICT (event_key, subscription_id)
            DO NOTHING
            """
        ),
        {
            "event_key": dedupe_key,
            "user_id": connection["connected_by_user_id"],
            "team_id": team_id,
            "title": "New Meta Lead",
            "body": (
                normalized["full_name"]
                or normalized["phone_number"]
                or "New lead received from Meta"
            ),
            "payload": json.dumps(
                {
                    "type": "meta_lead",
                    "lead_id": str(lead["id"]),
                    "target_url": "/",
                }
            ),
        },
    )

    db.execute(
        text(
            """
            UPDATE public.meta_webhook_events
            SET status = 'processed',
                processed_at = NOW(),
                last_error = NULL
            WHERE id = :event_id
            """
        ),
        {"event_id": event["id"]},
    )

    return {"created": 1, "duplicate": 0}


__all__ = [
    "normalize_meta_lead",
    "process_meta_lead_job",
]
