from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user


router = APIRouter(
    prefix="/modules",
    tags=["Modules"],
)


@router.get("/access")
def get_my_module_access(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = db.execute(
        text(
            """
            SELECT
                m.module_key,
                m.module_name,
                m.is_enabled AS global_enabled,

                t.id AS team_id,

                ctm.access_override AS organization_override,

                CASE
                    WHEN t.id IS NULL THEN
                        m.is_enabled

                    WHEN t.status <> 'active' THEN
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

            LEFT JOIN LATERAL (
                SELECT
                    t.id,
                    t.status
                FROM public.team_members tm
                INNER JOIN public.teams t
                    ON t.id = tm.team_id
                WHERE tm.member_id = :user_id
                  AND tm.status = 'active'
                ORDER BY
                    (t.status = 'active') DESC
                LIMIT 1
            ) t
                ON TRUE

            LEFT JOIN public.crm_team_module_settings ctm
                ON ctm.team_id = t.id
               AND ctm.module_key = m.module_key

            ORDER BY m.module_name
            """
        ),
        {
            "user_id": current_user["id"],
        },
    ).mappings().all()

    return [dict(row) for row in rows]