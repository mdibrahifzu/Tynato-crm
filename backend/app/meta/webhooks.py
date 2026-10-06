from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import text

from app.database import engine
from app.meta.config import (
    META_APP_SECRET,
    META_WEBHOOK_VERIFY_TOKEN,
)

router = APIRouter(
    prefix="/webhooks/meta",
    tags=["Meta Webhooks"],
)


def _verify_signature(
    raw_body: bytes,
    signature: str | None,
) -> bool:
    if not signature or not signature.startswith("sha256="):
        return False

    if not META_APP_SECRET:
        return False

    expected = hmac.new(
        META_APP_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    received = signature.split("=", 1)[1].strip()

    return hmac.compare_digest(received, expected)


@router.get("")
def verify_meta_webhook(
    hub_mode: str | None = Query(
        default=None,
        alias="hub.mode",
    ),
    hub_verify_token: str | None = Query(
        default=None,
        alias="hub.verify_token",
    ),
    hub_challenge: str | None = Query(
        default=None,
        alias="hub.challenge",
    ),
):
    if (
        hub_mode != "subscribe"
        or not hub_verify_token
        or not META_WEBHOOK_VERIFY_TOKEN
        or not hmac.compare_digest(
            hub_verify_token,
            META_WEBHOOK_VERIFY_TOKEN,
        )
        or not hub_challenge
    ):
        raise HTTPException(
            status_code=403,
            detail="Webhook verification failed",
        )

    return PlainTextResponse(hub_challenge)


@router.post("")
async def receive_meta_webhook(
    request: Request,
):
    raw_body = await request.body()

    if not _verify_signature(
        raw_body,
        request.headers.get("X-Hub-Signature-256"),
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid Meta signature",
        )

    try:
        payload: dict[str, Any] = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON",
        ) from exc

    queued = 0

    with engine.begin() as conn:
        for entry in payload.get("entry") or []:
            page_id = str(
                entry.get("id") or ""
            ).strip()

            if not page_id:
                continue

            for change in entry.get("changes") or []:
                if change.get("field") != "leadgen":
                    continue

                value = change.get("value") or {}

                leadgen_id = str(
                    value.get("leadgen_id")
                    or value.get("lead_id")
                    or ""
                ).strip()

                if not leadgen_id:
                    continue

                external_event_id = (
                    "leadgen:{}:{}".format(
                        page_id,
                        leadgen_id,
                    )
                )

                # Fail closed if the same active Page can resolve
                # to multiple CRM connections/teams.
                pages = conn.execute(
                    text(
                        """
                        SELECT connection_id, team_id
                        FROM public.meta_pages
                        WHERE meta_page_id = :page_id
                          AND status = 'active'
                        ORDER BY updated_at DESC
                        LIMIT 2
                        """
                    ),
                    {"page_id": page_id},
                ).mappings().all()

                if len(pages) != 1:
                    continue

                page = pages[0]

                inserted_event = conn.execute(
                    text(
                        """
                        INSERT INTO public.meta_webhook_events (
                            connection_id,
                            team_id,
                            meta_page_id,
                            event_type,
                            external_event_id,
                            leadgen_id,
                            form_id,
                            ad_id,
                            adset_id,
                            campaign_id,
                            payload,
                            status,
                            received_at,
                            next_attempt_at
                        )
                        VALUES (
                            :connection_id,
                            :team_id,
                            :page_id,
                            'leadgen',
                            :external_event_id,
                            :leadgen_id,
                            :form_id,
                            :ad_id,
                            :adset_id,
                            :campaign_id,
                            CAST(:payload AS jsonb),
                            'received',
                            NOW(),
                            NOW()
                        )
                        ON CONFLICT (external_event_id)
                        DO NOTHING
                        RETURNING id
                        """
                    ),
                    {
                        "connection_id": page["connection_id"],
                        "team_id": page["team_id"],
                        "page_id": page_id,
                        "external_event_id": external_event_id,
                        "leadgen_id": leadgen_id,
                        "form_id": str(
                            value.get("form_id") or ""
                        ) or None,
                        "ad_id": str(
                            value.get("ad_id") or ""
                        ) or None,
                        "adset_id": str(
                            value.get("adset_id")
                            or value.get("adgroup_id")
                            or ""
                        ) or None,
                        "campaign_id": str(
                            value.get("campaign_id") or ""
                        ) or None,
                        "payload": json.dumps(value),
                    },
                ).scalar()

                if not inserted_event:
                    continue

                conn.execute(
                    text(
                        """
                        INSERT INTO public.meta_jobs (
                            queue,
                            job_type,
                            team_id,
                            connection_id,
                            payload,
                            status
                        )
                        VALUES (
                            'meta',
                            'import_meta_lead',
                            :team_id,
                            :connection_id,
                            CAST(:payload AS jsonb),
                            'pending'
                        )
                        """
                    ),
                    {
                        "team_id": page["team_id"],
                        "connection_id": page["connection_id"],
                        "payload": json.dumps(
                            {
                                "event_key": external_event_id,
                                "page_id": page_id,
                                "leadgen_id": leadgen_id,
                                "form_id": str(
                                    value.get("form_id") or ""
                                ) or None,
                                "ad_id": str(
                                    value.get("ad_id") or ""
                                ) or None,
                                "adset_id": str(
                                    value.get("adset_id")
                                    or value.get("adgroup_id")
                                    or ""
                                ) or None,
                                "campaign_id": str(
                                    value.get("campaign_id") or ""
                                ) or None,
                            }
                        ),
                    },
                )

                queued += 1

    return {"received": True, "queued": queued}


__all__ = ["router"]
