from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def _serialize(row) -> Optional[dict]:
    if not row:
        return None

    data = dict(row)

    for key in ("id", "owner_id", "team_id"):
        if data.get(key) is not None:
            data[key] = str(data[key])

    for key in ("created_at", "updated_at"):
        if data.get(key) is not None:
            data[key] = str(data[key])

    return data


def get_business_settings_for_workspace(
    db: Session,
    *,
    owner_id: UUID,
    team_id: Optional[UUID],
) -> Optional[dict]:
    """Read the settings for the already-authorized workspace context."""

    if team_id is None:
        result = db.execute(
            text(
                """
                SELECT
                    bs.id,
                    bs.owner_id,
                    bs.team_id,
                    bs.business_name,
                    bs.business_address,
                    bs.business_phone,
                    bs.business_email,
                    bs.terms_and_conditions,
                    bs.logo_path,
                    bs.created_at,
                    bs.updated_at
                FROM public.business_settings bs
                WHERE bs.owner_id = :owner_id
                  AND bs.team_id IS NULL
                LIMIT 1
                """
            ),
            {"owner_id": owner_id},
        )
    else:
        result = db.execute(
            text(
                """
                SELECT
                    bs.id,
                    bs.owner_id,
                    bs.team_id,
                    bs.business_name,
                    bs.business_address,
                    bs.business_phone,
                    bs.business_email,
                    bs.terms_and_conditions,
                    bs.logo_path,
                    bs.created_at,
                    bs.updated_at
                FROM public.business_settings bs
                WHERE bs.team_id = :team_id
                LIMIT 1
                """
            ),
            {"team_id": team_id},
        )

    return _serialize(result.mappings().first())


def upsert_business_settings(
    db: Session,
    *,
    owner_id: UUID,
    team_id: Optional[UUID],
    business_name: str,
    business_address: str,
    business_phone: str,
    business_email: str,
    terms_and_conditions: str,
) -> dict:
    values = {
        "owner_id": owner_id,
        "team_id": team_id,
        "business_name": business_name,
        "business_address": business_address,
        "business_phone": business_phone,
        "business_email": business_email,
        "terms_and_conditions": terms_and_conditions,
    }

    if team_id is None:
        result = db.execute(
            text(
                """
                INSERT INTO public.business_settings (
                    owner_id,
                    team_id,
                    business_name,
                    business_address,
                    business_phone,
                    business_email,
                    terms_and_conditions
                )
                VALUES (
                    :owner_id,
                    NULL,
                    :business_name,
                    :business_address,
                    :business_phone,
                    :business_email,
                    :terms_and_conditions
                )
                ON CONFLICT (owner_id)
                WHERE team_id IS NULL
                DO UPDATE SET
                    business_name = EXCLUDED.business_name,
                    business_address = EXCLUDED.business_address,
                    business_phone = EXCLUDED.business_phone,
                    business_email = EXCLUDED.business_email,
                    terms_and_conditions = EXCLUDED.terms_and_conditions,
                    updated_at = now()
                RETURNING *
                """
            ),
            values,
        )
    else:
        result = db.execute(
            text(
                """
                INSERT INTO public.business_settings (
                    owner_id,
                    team_id,
                    business_name,
                    business_address,
                    business_phone,
                    business_email,
                    terms_and_conditions
                )
                VALUES (
                    :owner_id,
                    :team_id,
                    :business_name,
                    :business_address,
                    :business_phone,
                    :business_email,
                    :terms_and_conditions
                )
                ON CONFLICT (team_id)
                WHERE team_id IS NOT NULL
                DO UPDATE SET
                    business_name = EXCLUDED.business_name,
                    business_address = EXCLUDED.business_address,
                    business_phone = EXCLUDED.business_phone,
                    business_email = EXCLUDED.business_email,
                    terms_and_conditions = EXCLUDED.terms_and_conditions,
                    updated_at = now()
                RETURNING *
                """
            ),
            values,
        )

    row = result.mappings().first()
    if not row:
        raise RuntimeError("Business settings could not be saved.")

    return _serialize(row)


def update_logo_path(
    db: Session,
    *,
    settings_id: UUID,
    owner_id: UUID,
    team_id: Optional[UUID],
    logo_path: Optional[str],
) -> Optional[dict]:
    """Update only an already-owned settings row."""

    if team_id is None:
        result = db.execute(
            text(
                """
                UPDATE public.business_settings
                SET
                    logo_path = :logo_path,
                    updated_at = now()
                WHERE id = :settings_id
                  AND owner_id = :owner_id
                  AND team_id IS NULL
                RETURNING *
                """
            ),
            {
                "settings_id": settings_id,
                "owner_id": owner_id,
                "logo_path": logo_path,
            },
        )
    else:
        result = db.execute(
            text(
                """
                UPDATE public.business_settings bs
                SET
                    logo_path = :logo_path,
                    updated_at = now()
                FROM public.teams t
                WHERE bs.id = :settings_id
                  AND bs.team_id = :team_id
                  AND bs.owner_id = :owner_id
                  AND t.id = bs.team_id
                  AND t.owner_id = :owner_id
                RETURNING bs.*
                """
            ),
            {
                "settings_id": settings_id,
                "owner_id": owner_id,
                "team_id": team_id,
                "logo_path": logo_path,
            },
        )

    return _serialize(result.mappings().first())