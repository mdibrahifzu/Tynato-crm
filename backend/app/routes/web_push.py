from __future__ import annotations

import datetime as dt
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_current_team, get_db


WEB_PUSH_VAPID_PUBLIC_KEY = os.getenv(
    "WEB_PUSH_VAPID_PUBLIC_KEY",
    "",
).strip()


router = APIRouter(
    prefix="/web-push",
    tags=["Web Push"],
)


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=20, max_length=2048)
    auth: str = Field(min_length=8, max_length=2048)


class PushSubscriptionRequest(BaseModel):
    endpoint: str = Field(min_length=20, max_length=4096)
    keys: PushSubscriptionKeys
    expirationTime: float | None = None


@router.get("/public-key")
def get_public_key(
    current_user=Depends(get_current_user),
):
    if not WEB_PUSH_VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=503,
            detail="Web Push is not configured.",
        )

    return {
        "public_key": WEB_PUSH_VAPID_PUBLIC_KEY,
    }


@router.post("/subscribe")
def subscribe(
    payload: PushSubscriptionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    endpoint = payload.endpoint.strip()

    if not endpoint.startswith("https://"):
        raise HTTPException(
            status_code=400,
            detail="Push endpoint must use HTTPS.",
        )

    expiration_time = None

    if payload.expirationTime is not None:
        try:
            expiration_time = dt.datetime.fromtimestamp(
                payload.expirationTime / 1000.0,
                tz=dt.timezone.utc,
            )
        except (OverflowError, OSError, ValueError):
            raise HTTPException(
                status_code=400,
                detail="Invalid push subscription expiration time.",
            )

    db.execute(
        text(
            """
            INSERT INTO public.web_push_subscriptions (
                user_id,
                team_id,
                endpoint,
                p256dh,
                auth,
                expiration_time,
                user_agent,
                is_active,
                last_seen_at,
                updated_at
            )
            VALUES (
                :user_id,
                :team_id,
                :endpoint,
                :p256dh,
                :auth,
                :expiration_time,
                :user_agent,
                TRUE,
                NOW(),
                NOW()
            )
            ON CONFLICT (endpoint)
            DO UPDATE SET
                user_id = EXCLUDED.user_id,
                team_id = EXCLUDED.team_id,
                p256dh = EXCLUDED.p256dh,
                auth = EXCLUDED.auth,
                expiration_time = EXCLUDED.expiration_time,
                user_agent = EXCLUDED.user_agent,
                is_active = TRUE,
                last_seen_at = NOW(),
                updated_at = NOW()
            """
        ),
        {
            "user_id": current_user["id"],
            "team_id": team["team_id"] if team else None,
            "endpoint": endpoint,
            "p256dh": payload.keys.p256dh,
            "auth": payload.keys.auth,
            "expiration_time": expiration_time,
            "user_agent": None,
        },
    )

    db.commit()
    return {"success": True}


@router.delete("/subscribe")
def unsubscribe(
    payload: PushSubscriptionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db.execute(
        text(
            """
            UPDATE public.web_push_subscriptions
            SET is_active = FALSE,
                updated_at = NOW()
            WHERE endpoint = :endpoint
              AND user_id = :user_id
            """
        ),
        {
            "endpoint": payload.endpoint.strip(),
            "user_id": current_user["id"],
        },
    )

    db.commit()
    return {"success": True}

__all__ = ["router"]
