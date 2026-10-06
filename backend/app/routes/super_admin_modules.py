import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_super_admin


router = APIRouter(
    prefix="/super-admin",
    tags=["Super Admin - Modules"],
)


class ModuleOverrideRequest(BaseModel):
    access_override: bool | None = None


@router.get("/organizations/{team_id}/modules")
def get_organization_modules(
    team_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    team = db.execute(
        text(
            """
            SELECT
                id,
                name,
                status
            FROM public.teams
            WHERE id = :team_id
            """
        ),
        {
            "team_id": team_id,
        },
    ).mappings().first()

    if not team:
        raise HTTPException(
            status_code=404,
            detail="Organization not found.",
        )

    rows = db.execute(
        text(
            """
            SELECT
                m.module_key,
                m.module_name,
                m.is_enabled AS global_enabled,

                ctm.access_override AS organization_override,

                CASE
                    WHEN :team_status <> 'active' THEN
                        FALSE

                    ELSE
                        COALESCE(
                            ctm.access_override,
                            (
                                m.is_enabled
                                AND COALESCE(ctm.is_enabled, TRUE)
                            )
                        )
                END AS effective_enabled

            FROM public.crm_module_settings m

            LEFT JOIN public.crm_team_module_settings ctm
                ON ctm.team_id = :team_id
               AND ctm.module_key = m.module_key

            ORDER BY m.module_name
            """
        ),
        {
            "team_id": team_id,
            "team_status": team["status"],
        },
    ).mappings().all()

    return {
        "team_id": str(team["id"]),
        "team_name": team["name"],
        "team_status": team["status"],
        "modules": [dict(row) for row in rows],
    }


@router.patch(
    "/organizations/{team_id}/modules/{module_key}"
)
def update_organization_module_override(
    team_id: UUID,
    module_key: str,
    payload: ModuleOverrideRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    current = db.execute(
        text(
            """
            SELECT
                t.id AS team_id,
                t.name AS team_name,
                t.status AS team_status,

                m.module_key,
                m.module_name,
                m.is_enabled AS global_enabled,

                ctm.is_enabled AS legacy_org_enabled,
                ctm.access_override AS old_override

            FROM public.teams t

            CROSS JOIN public.crm_module_settings m

            LEFT JOIN public.crm_team_module_settings ctm
                ON ctm.team_id = t.id
               AND ctm.module_key = m.module_key

            WHERE t.id = :team_id
              AND m.module_key = :module_key

            LIMIT 1
            """
        ),
        {
            "team_id": team_id,
            "module_key": module_key,
        },
    ).mappings().first()

    if not current:
        raise HTTPException(
            status_code=404,
            detail="Organization or module not found.",
        )

    before_override = current["old_override"]

    if payload.access_override is None:
        db.execute(
            text(
                """
                DELETE FROM public.crm_team_module_settings
                WHERE team_id = :team_id
                  AND module_key = :module_key
                """
            ),
            {
                "team_id": team_id,
                "module_key": module_key,
            },
        )

    else:
        db.execute(
            text(
                """
                INSERT INTO public.crm_team_module_settings
                (
                    team_id,
                    module_key,
                    is_enabled,
                    access_override,
                    created_at,
                    updated_at
                )
                VALUES
                (
                    :team_id,
                    :module_key,
                    TRUE,
                    :access_override,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (team_id, module_key)
                DO UPDATE SET
                    access_override = EXCLUDED.access_override,
                    updated_at = NOW()
                """
            ),
            {
                "team_id": team_id,
                "module_key": module_key,
                "access_override": payload.access_override,
            },
        )

    if current["team_status"] != "active":
        effective_after = False

    elif payload.access_override is not None:
        effective_after = payload.access_override

    else:
        effective_after = bool(
            current["global_enabled"]
            and (
                current["legacy_org_enabled"]
                if current["legacy_org_enabled"] is not None
                else True
            )
        )

    before_data = {
        "global_enabled": current["global_enabled"],
        "access_override": before_override,
        "legacy_org_enabled": current["legacy_org_enabled"],
    }

    after_data = {
        "global_enabled": current["global_enabled"],
        "access_override": payload.access_override,
        "legacy_org_enabled": current["legacy_org_enabled"],
        "effective_enabled": effective_after,
    }

    db.execute(
        text(
            """
            INSERT INTO public.platform_audit_logs
            (
                actor_user_id,
                action,
                target_type,
                target_id,
                before_data,
                after_data,
                metadata,
                created_at
            )
            VALUES
            (
                :actor_user_id,
                :action,
                :target_type,
                :target_id,
                CAST(:before_data AS JSONB),
                CAST(:after_data AS JSONB),
                CAST(:metadata AS JSONB),
                NOW()
            )
            """
        ),
        {
            "actor_user_id": current_user["id"],
            "action": "organization_module_override_updated",
            "target_type": "organization_module",
            "target_id": team_id,
            "before_data": json.dumps(before_data),
            "after_data": json.dumps(after_data),
            "metadata": json.dumps(
                {
                    "module_key": module_key,
                    "module_name": current["module_name"],
                }
            ),
        },
    )

    db.commit()

    return {
        "success": True,
        "team_id": str(team_id),
        "module_key": module_key,
        "module_name": current["module_name"],
        "global_enabled": current["global_enabled"],
        "access_override": payload.access_override,
        "effective_enabled": effective_after,
    }