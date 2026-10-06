from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def get_dashboard_stats(db: Session) -> dict[str, Any]:
    organizations = db.execute(
        text(
            """
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (
                    WHERE status = 'active'
                )::int AS active,
                COUNT(*) FILTER (
                    WHERE status = 'suspended'
                )::int AS suspended
            FROM public.teams
            """
        )
    ).mappings().one()

    users = db.execute(
        text(
            """
            SELECT COUNT(*)::int AS total
            FROM public.profiles
            """
        )
    ).mappings().one()

    super_admins = db.execute(
        text(
            """
            SELECT COUNT(*)::int AS total
            FROM public.profiles
            WHERE platform_role = 'super_admin'
            """
        )
    ).mappings().one()

    return {
        "organizations": dict(organizations),
        "users": int(users["total"] or 0),
        "super_admins": int(super_admins["total"] or 0),
    }


def list_organizations(
    db: Session,
    search: str | None = None,
):
    sql = """
        SELECT
            t.id,
            t.name,
            t.owner_id,
            t.plan,
            t.status,
            t.member_limit,
            t.search_limit,
            t.searches_used,
            t.created_at,
            p.full_name AS owner_name,
            p.email AS owner_email
        FROM public.teams t
        LEFT JOIN public.profiles p
            ON p.id = t.owner_id
    """

    params: dict[str, Any] = {}

    if search and search.strip():
        sql += """
            WHERE
                t.name ILIKE :search
                OR p.email ILIKE :search
                OR p.full_name ILIKE :search
        """
        params["search"] = f"%{search.strip()}%"

    sql += """
        ORDER BY t.created_at DESC
    """

    return db.execute(
        text(sql),
        params,
    ).mappings().all()


def get_organization(
    db: Session,
    team_id,
):
    return db.execute(
        text(
            """
            SELECT
                t.id,
                t.name,
                t.owner_id,
                t.plan,
                t.status,
                t.member_limit,
                t.search_limit,
                t.searches_used,
                t.created_at,
                p.full_name AS owner_name,
                p.email AS owner_email
            FROM public.teams t
            LEFT JOIN public.profiles p
                ON p.id = t.owner_id
            WHERE t.id = :team_id
            LIMIT 1
            """
        ),
        {"team_id": team_id},
    ).mappings().first()


def update_organization_status(
    db: Session,
    team_id,
    status: str,
):
    return db.execute(
        text(
            """
            UPDATE public.teams
            SET status = :status
            WHERE id = :team_id
            RETURNING
                id,
                name,
                owner_id,
                plan,
                status,
                member_limit,
                search_limit,
                searches_used,
                created_at
            """
        ),
        {
            "team_id": team_id,
            "status": status,
        },
    ).mappings().first()


def list_global_modules(db: Session):
    return db.execute(
        text(
            """
            SELECT
                module_key,
                module_name,
                is_enabled,
                created_at,
                updated_at
            FROM public.crm_module_settings
            ORDER BY module_name
            """
        )
    ).mappings().all()


def get_global_module(
    db: Session,
    module_key: str,
):
    return db.execute(
        text(
            """
            SELECT
                module_key,
                module_name,
                is_enabled,
                created_at,
                updated_at
            FROM public.crm_module_settings
            WHERE module_key = :module_key
            LIMIT 1
            """
        ),
        {"module_key": module_key},
    ).mappings().first()


def update_global_module(
    db: Session,
    module_key: str,
    is_enabled: bool,
):
    return db.execute(
        text(
            """
            UPDATE public.crm_module_settings
            SET
                is_enabled = :is_enabled,
                updated_at = NOW()
            WHERE module_key = :module_key
            RETURNING
                module_key,
                module_name,
                is_enabled,
                updated_at
            """
        ),
        {
            "module_key": module_key,
            "is_enabled": is_enabled,
        },
    ).mappings().first()


def list_team_modules(
    db: Session,
    team_id,
):
    return db.execute(
        text(
            """
            SELECT
                m.module_key,
                m.module_name,
                m.is_enabled AS global_enabled,
                COALESCE(
                    tm.is_enabled,
                    TRUE
                ) AS team_enabled,
                (
                    m.is_enabled
                    AND COALESCE(
                        tm.is_enabled,
                        TRUE
                    )
                ) AS effective_enabled
            FROM public.crm_module_settings m
            LEFT JOIN public.crm_team_module_settings tm
                ON tm.module_key = m.module_key
               AND tm.team_id = :team_id
            ORDER BY m.module_name
            """
        ),
        {"team_id": team_id},
    ).mappings().all()


def update_team_module(
    db: Session,
    team_id,
    module_key: str,
    is_enabled: bool,
):
    return db.execute(
        text(
            """
            INSERT INTO public.crm_team_module_settings (
                team_id,
                module_key,
                is_enabled
            )
            VALUES (
                :team_id,
                :module_key,
                :is_enabled
            )
            ON CONFLICT (
                team_id,
                module_key
            )
            DO UPDATE SET
                is_enabled = EXCLUDED.is_enabled,
                updated_at = NOW()
            RETURNING
                id,
                team_id,
                module_key,
                is_enabled,
                updated_at
            """
        ),
        {
            "team_id": team_id,
            "module_key": module_key,
            "is_enabled": is_enabled,
        },
    ).mappings().first()


def list_users(
    db: Session,
    search: str | None = None,
):
    sql = """
        SELECT
            id,
            email,
            full_name,
            role,
            platform_role,
            is_active,
            subscription_tier,
            created_at
        FROM public.profiles
    """

    params: dict[str, Any] = {}

    if search and search.strip():
        sql += """
            WHERE
                email ILIKE :search
                OR full_name ILIKE :search
        """
        params["search"] = f"%{search.strip()}%"

    sql += """
        ORDER BY created_at DESC
        LIMIT 200
    """

    return db.execute(
        text(sql),
        params,
    ).mappings().all()


def create_audit_log(
    db: Session,
    *,
    actor_user_id,
    action: str,
    target_type: str,
    target_id=None,
    before_data: dict[str, Any] | None = None,
    after_data: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
):
    db.execute(
        text(
            """
            INSERT INTO public.platform_audit_logs (
                actor_user_id,
                action,
                target_type,
                target_id,
                before_data,
                after_data,
                metadata
            )
            VALUES (
                :actor_user_id,
                :action,
                :target_type,
                :target_id,
                CAST(:before_data AS jsonb),
                CAST(:after_data AS jsonb),
                CAST(:metadata AS jsonb)
            )
            """
        ),
        {
            "actor_user_id": actor_user_id,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "before_data": (
                json.dumps(before_data)
                if before_data is not None
                else None
            ),
            "after_data": (
                json.dumps(after_data)
                if after_data is not None
                else None
            ),
            "metadata": (
                json.dumps(metadata)
                if metadata is not None
                else None
            ),
        },
    )


def list_audit_logs(
    db: Session,
    limit: int = 100,
    offset: int = 0,
):
    return db.execute(
        text(
            """
            SELECT
                l.id,
                l.actor_user_id,
                p.email AS actor_email,
                l.action,
                l.target_type,
                l.target_id,
                l.before_data,
                l.after_data,
                l.metadata,
                l.created_at
            FROM public.platform_audit_logs l
            LEFT JOIN public.profiles p
                ON p.id = l.actor_user_id
            ORDER BY l.created_at DESC
            LIMIT :limit
            OFFSET :offset
            """
        ),
        {
            "limit": limit,
            "offset": offset,
        },
    ).mappings().all()