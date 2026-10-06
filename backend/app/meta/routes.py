from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_team
from app.meta.client import MetaAPIError, MetaClient
from app.meta.config import META_ENABLED, META_APP_ID, validate_runtime_config
from app.meta.schemas import (
    MetaAdAccountOut,
    MetaCampaignOut,
    MetaCampaignSyncRequest,
    MetaCampaignSyncResponse,
    MetaConnectionOut,
    MetaHealthOut,
    MetaJobOut,
    OAuthCompleteRequest,
    OAuthStartResponse,
)
from app.meta.service import (
    _require_actor,
    build_authorization_url,
    connection_for_team,
    create_connection,
    create_oauth_state,
    enqueue_campaign_sync,
    enqueue_meta_forms_sync,
    enqueue_meta_insights_sync,
    get_job_for_team,
    get_user_token,
    lock_oauth_state,
    mark_oauth_state_used,
    upsert_discovered_assets,
)

router = APIRouter(prefix="/meta", tags=["Meta Integration"])


if META_ENABLED:
    validate_runtime_config()


@router.post("/oauth/start", response_model=OAuthStartResponse)
def oauth_start(
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    team: Dict = Depends(require_team),
):
    try:
        _require_actor(team, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    if not META_APP_ID:
        raise HTTPException(status_code=503, detail="Meta OAuth is not configured")

    state = create_oauth_state(db, current_user["id"], team)
    return {"auth_url": build_authorization_url(state)}


@router.post("/oauth/complete")
def oauth_complete(
    payload: OAuthCompleteRequest,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    team: Dict = Depends(require_team),
):
    try:
        _require_actor(team, current_user)
        state_id = lock_oauth_state(
            db,
            payload.state,
            current_user["id"],
            team["team_id"],
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        token_data = MetaClient().exchange_code(payload.code)
        connection = create_connection(db, current_user, team, token_data)
        mark_oauth_state_used(db, state_id)
        db.commit()
    except MetaAPIError:
        db.rollback()
        raise HTTPException(status_code=502, detail="Meta authorization failed")
    except (ValueError, RuntimeError):
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail="Meta authorization could not be completed",
        )
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Meta authorization transaction failed")

    return {
        "success": True,
        "connection_id": connection["id"],
        "status": connection["status"],
    }


@router.get("/connections", response_model=list[MetaConnectionOut])
def list_connections(
    db: Session = Depends(get_db),
    team: Dict = Depends(require_team),
):
    rows = db.execute(
        text(
            """
            SELECT id, team_id, meta_user_id, granted_scopes, status, api_version,
                   token_expires_at, last_validated_at, last_successful_sync_at,
                   connected_at
            FROM meta_connections
            WHERE team_id = :team_id
            ORDER BY created_at DESC
            """
        ),
        {"team_id": team["team_id"]},
    ).mappings().all()
    return [dict(row) for row in rows]


@router.get("/connections/{connection_id}", response_model=MetaConnectionOut)
def get_connection(
    connection_id: UUID,
    db: Session = Depends(get_db),
    team: Dict = Depends(require_team),
):
    row = connection_for_team(db, connection_id, team["team_id"])
    if not row:
        raise HTTPException(status_code=404, detail="Meta connection not found")
    return row


@router.post("/connections/{connection_id}/discover")
def discover_assets(
    connection_id: UUID,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    team: Dict = Depends(require_team),
):
    try:
        _require_actor(team, current_user)
        connection = connection_for_team(db, connection_id, team["team_id"])
        if not connection:
            raise ValueError("Meta connection not found")
        token = get_user_token(db, connection_id, team["team_id"])
        summary = upsert_discovered_assets(
            db,
            connection_id,
            team["team_id"],
            token,
        )
        db.commit()
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc))
    except MetaAPIError as exc:
        db.rollback()
        if exc.status_code == 401:
            detail = "Meta credential has expired or is invalid"
        elif exc.status_code == 403:
            detail = "Meta access does not include the required asset scope"
        else:
            detail = "Meta asset discovery failed"
        raise HTTPException(status_code=exc.status_code if exc.status_code in {401, 403} else 502, detail=detail)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Meta asset discovery failed")

    return {"success": True, "summary": summary}


@router.get("/ad-accounts", response_model=list[MetaAdAccountOut])
def list_ad_accounts(
    db: Session = Depends(get_db),
    team: Dict = Depends(require_team),
):
    rows = db.execute(
        text(
            """
            SELECT id, meta_ad_account_id, name, account_status, currency,
                   timezone_name, is_selected, status, last_seen_at
            FROM meta_ad_accounts
            WHERE team_id = :team_id
              AND status <> 'disconnected'
            ORDER BY name ASC
            """
        ),
        {"team_id": team["team_id"]},
    ).mappings().all()
    return [dict(row) for row in rows]


@router.get("/campaigns", response_model=list[MetaCampaignOut])
def list_campaigns(
    connection_id: Optional[UUID] = None,
    ad_account_row_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    team: Dict = Depends(require_team),
):
    params: Dict = {"team_id": team["team_id"]}
    connection_predicate = ""
    account_predicate = ""

    if connection_id is not None:
        connection_predicate = "AND c.connection_id = :connection_id"
        params["connection_id"] = connection_id
    if ad_account_row_id is not None:
        account_predicate = "AND c.ad_account_row_id = :ad_account_row_id"
        params["ad_account_row_id"] = ad_account_row_id

    rows = db.execute(
        text(
            """
            SELECT
                c.id,
                c.ad_account_row_id,
                aa.name AS ad_account_name,
                c.meta_campaign_id,
                c.name,
                c.status,
                c.objective,
                c.start_time,
                c.stop_time,
                c.daily_budget,
                c.lifetime_budget,
                c.last_seen_at,
                c.updated_at
            FROM meta_campaigns c
            INNER JOIN meta_ad_accounts aa
                ON aa.id = c.ad_account_row_id
               AND aa.team_id = c.team_id
            WHERE c.team_id = :team_id
              {connection_predicate}
              {account_predicate}
            ORDER BY c.updated_at DESC, c.name ASC
            """.format(
                connection_predicate=connection_predicate,
                account_predicate=account_predicate,
            )
        ),
        params,
    ).mappings().all()
    return [dict(row) for row in rows]


@router.post(
    "/connections/{connection_id}/campaigns/sync",
    response_model=MetaCampaignSyncResponse,
)
def queue_campaign_sync(
    connection_id: UUID,
    payload: MetaCampaignSyncRequest,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    team: Dict = Depends(require_team),
):
    try:
        _require_actor(team, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    connection = connection_for_team(db, connection_id, team["team_id"])
    if not connection:
        raise HTTPException(status_code=404, detail="Meta connection not found")

    try:
        if payload.ad_account_row_id is not None:
            account_exists = db.execute(
                text(
                    """
                    SELECT 1
                    FROM meta_ad_accounts
                    WHERE id = :id
                      AND team_id = :team_id
                      AND connection_id = :connection_id
                      AND status <> 'disconnected'
                    """
                ),
                {
                    "id": payload.ad_account_row_id,
                    "team_id": team["team_id"],
                    "connection_id": connection_id,
                },
            ).scalar()
            if not account_exists:
                raise HTTPException(status_code=404, detail="Meta ad account not found")

        job_id = enqueue_campaign_sync(
            db,
            connection_id,
            team["team_id"],
            payload.ad_account_row_id,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to queue campaign sync")

    job = get_job_for_team(db, job_id, team["team_id"])
    return {
        "success": True,
        "job_id": job_id,
        "status": job["status"] if job else "pending",
    }



@router.get("/pages")
def list_pages(
    db: Session = Depends(get_db),
    team: Dict = Depends(require_team),
):
    rows = db.execute(
        text(
            """
            SELECT
                id,
                connection_id,
                team_id,
                meta_page_id,
                page_name,
                page_category,
                status,
                last_seen_at,
                updated_at
            FROM public.meta_pages
            WHERE team_id = :team_id
              AND status <> 'disconnected'
            ORDER BY page_name ASC
            """
        ),
        {"team_id": team["team_id"]},
    ).mappings().all()
    return [dict(row) for row in rows]


@router.get("/pages/{page_id}/forms")
def list_page_forms(
    page_id: str,
    db: Session = Depends(get_db),
    team: Dict = Depends(require_team),
):
    rows = db.execute(
        text(
            """
            SELECT
                id,
                connection_id,
                page_row_id,
                meta_page_id,
                meta_form_id,
                name,
                status,
                is_selected,
                questions,
                last_seen_at,
                created_at,
                updated_at
            FROM public.meta_lead_forms
            WHERE team_id = :team_id
              AND meta_page_id = :page_id
            ORDER BY name ASC, updated_at DESC
            """
        ),
        {
            "team_id": team["team_id"],
            "page_id": page_id,
        },
    ).mappings().all()
    return [dict(row) for row in rows]


@router.post("/connections/{connection_id}/pages/{page_id}/forms/sync")
def queue_form_sync(
    connection_id: UUID,
    page_id: str,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    team: Dict = Depends(require_team),
):
    try:
        _require_actor(team, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    connection = connection_for_team(
        db, connection_id, team["team_id"]
    )

    if not connection or connection.get("status") != "active":
        raise HTTPException(
            status_code=404,
            detail="Active Meta connection not found",
        )

    page = db.execute(
        text(
            """
            SELECT 1
            FROM public.meta_pages
            WHERE connection_id = :connection_id
              AND team_id = :team_id
              AND meta_page_id = :page_id
              AND status = 'active'
            LIMIT 1
            """
        ),
        {
            "connection_id": connection_id,
            "team_id": team["team_id"],
            "page_id": page_id,
        },
    ).first()

    if not page:
        raise HTTPException(
            status_code=404,
            detail="Meta Page not found",
        )

    job_id = enqueue_meta_forms_sync(
        db,
        connection_id,
        team["team_id"],
        page_id,
    )

    job = get_job_for_team(
        db, job_id, team["team_id"]
    )

    return {
        "success": True,
        "job_id": job_id,
        "status": job["status"] if job else "pending",
    }


@router.post("/connections/{connection_id}/insights/sync")
def queue_insights_sync(
    connection_id: UUID,
    ad_account_row_id: Optional[UUID] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    team: Dict = Depends(require_team),
):
    try:
        _require_actor(team, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    connection = connection_for_team(
        db, connection_id, team["team_id"]
    )

    if not connection or connection.get("status") != "active":
        raise HTTPException(
            status_code=404,
            detail="Active Meta connection not found",
        )

    if ad_account_row_id is not None:
        account_exists = db.execute(
            text(
                """
                SELECT 1
                FROM public.meta_ad_accounts
                WHERE id = :id
                  AND team_id = :team_id
                  AND connection_id = :connection_id
                  AND status <> 'disconnected'
                LIMIT 1
                """
            ),
            {
                "id": ad_account_row_id,
                "team_id": team["team_id"],
                "connection_id": connection_id,
            },
        ).scalar()

        if not account_exists:
            raise HTTPException(
                status_code=404,
                detail="Meta ad account not found",
            )

    job_id = enqueue_meta_insights_sync(
        db,
        connection_id,
        team["team_id"],
        ad_account_row_id,
        since,
        until,
    )

    job = get_job_for_team(
        db, job_id, team["team_id"]
    )

    return {
        "success": True,
        "job_id": job_id,
        "status": job["status"] if job else "pending",
    }


@router.get("/insights")
def list_insights(
    ad_account_row_id: Optional[UUID] = None,
    level: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
    db: Session = Depends(get_db),
    team: Dict = Depends(require_team),
):
    if level and level not in {
        "account",
        "campaign",
        "adset",
        "ad",
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid insights level",
        )

    params: Dict[str, Any] = {
        "team_id": team["team_id"]
    }
    filters = ["team_id = :team_id"]

    if ad_account_row_id:
        filters.append(
            "ad_account_row_id = :ad_account_row_id"
        )
        params["ad_account_row_id"] = ad_account_row_id

    if level:
        filters.append("level = :level")
        params["level"] = level

    if since:
        filters.append("date_start >= :since")
        params["since"] = since

    if until:
        filters.append("date_stop <= :until")
        params["until"] = until

    rows = db.execute(
        text(
            """
            SELECT
                date_start,
                date_stop,
                level,
                meta_object_id,
                campaign_id,
                campaign_name,
                adset_id,
                adset_name,
                ad_id,
                ad_name,
                spend,
                impressions,
                reach,
                frequency,
                clicks,
                ctr,
                cpc,
                cpm,
                lead_count,
                actions,
                cost_per_action_type
            FROM public.meta_insights_daily
            WHERE {filters}
            ORDER BY date_start ASC, level ASC
            """.format(
                filters=" AND ".join(filters)
            )
        ),
        params,
    ).mappings().all()

    return [dict(row) for row in rows]


@router.get("/leads")
def list_meta_leads(
    page_id: Optional[str] = None,
    form_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    db: Session = Depends(get_db),
    team: Dict = Depends(require_team),
):
    params: Dict[str, Any] = {
        "team_id": team["team_id"]
    }

    filters = [
        "a.team_id = :team_id",
        "a.source = 'meta'",
    ]

    if page_id:
        filters.append("a.meta_page_id = :page_id")
        params["page_id"] = page_id

    if form_id:
        filters.append("a.meta_form_id = :form_id")
        params["form_id"] = form_id

    if campaign_id:
        filters.append(
            "a.meta_campaign_id = :campaign_id"
        )
        params["campaign_id"] = campaign_id

    rows = db.execute(
        text(
            """
            SELECT
                l.id,
                l.full_name,
                l.phone_number,
                l.email,
                l.project_location,
                l.status,
                l.owner_id,
                l.created_time,
                a.leadgen_id,
                a.meta_page_id,
                a.meta_form_id,
                a.meta_campaign_id,
                a.meta_adset_id,
                a.meta_ad_id,
                a.campaign_name_snapshot,
                a.form_name_snapshot,
                a.meta_created_at,
                a.created_at AS imported_at
            FROM public.lead_source_attribution a
            INNER JOIN public.custom_leads l
                ON l.id = a.lead_id
               AND l.team_id = a.team_id
            WHERE {filters}
            ORDER BY a.created_at DESC
            """.format(
                filters=" AND ".join(filters)
            )
        ),
        params,
    ).mappings().all()

    return [dict(row) for row in rows]


@router.get("/jobs/{job_id}", response_model=MetaJobOut)
def get_meta_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    team: Dict = Depends(require_team),
):
    row = get_job_for_team(db, job_id, team["team_id"])
    if not row:
        raise HTTPException(status_code=404, detail="Meta job not found")
    return row


@router.delete("/connections/{connection_id}")
def disconnect_connection(
    connection_id: UUID,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user),
    team: Dict = Depends(require_team),
):
    try:
        _require_actor(team, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    try:
        result = db.execute(
            text(
                """
                UPDATE meta_connections
                SET status = 'disconnected', updated_at = NOW(), last_error = NULL
                WHERE id = :connection_id AND team_id = :team_id
                RETURNING id
                """
            ),
            {"connection_id": connection_id, "team_id": team["team_id"]},
        ).first()
        if not result:
            raise HTTPException(status_code=404, detail="Meta connection not found")

        db.execute(
            text("DELETE FROM meta_credentials WHERE connection_id = :connection_id"),
            {"connection_id": connection_id},
        )
        db.execute(
            text(
                """
                UPDATE meta_pages
                SET status = 'disconnected', updated_at = NOW()
                WHERE connection_id = :connection_id
                """
            ),
            {"connection_id": connection_id},
        )
        db.execute(
            text(
                """
                UPDATE meta_ad_accounts
                SET status = 'disconnected', updated_at = NOW()
                WHERE connection_id = :connection_id
                """
            ),
            {"connection_id": connection_id},
        )
        db.execute(
            text(
                """
                UPDATE meta_jobs
                SET status = 'dead',
                    locked_until = NULL,
                    last_error = 'Meta connection disconnected',
                    completed_at = NULL
                WHERE connection_id = :connection_id
                  AND status IN ('pending', 'processing', 'retry')
                """
            ),
            {"connection_id": connection_id},
        )
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to disconnect Meta")

    return {"success": True}


@router.get("/health", response_model=MetaHealthOut)
def health(
    db: Session = Depends(get_db),
    team: Dict = Depends(require_team),
):
    row = db.execute(
        text(
            """
            SELECT
                COUNT(*) AS connections,
                COUNT(*) FILTER (WHERE status = 'active') AS active_connections
            FROM meta_connections
            WHERE team_id = :team_id
            """
        ),
        {"team_id": team["team_id"]},
    ).mappings().one()
    return {
        "enabled": META_ENABLED,
        "connections": int(row["connections"]),
        "active_connections": int(row["active_connections"]),
    }
