import json
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.meta.client import MetaAPIError, MetaClient
from app.meta.config import (
    META_API_VERSION,
    META_APP_ID,
    META_LOGIN_CONFIG_ID,
    META_OAUTH_STATE_TTL_SECONDS,
    META_PROVIDER,
    META_REDIRECT_URI,
    META_SCOPES,
    META_JOB_LOCK_SECONDS,
    META_JOB_MAX_ATTEMPTS,
)
from app.meta.crypto import decrypt_token, encrypt_token, hash_state
from app.meta.provider import get_meta_provider, get_real_meta_provider


CAMPAIGN_SYNC_JOB_TYPE = "sync_campaigns"
META_LEAD_IMPORT_JOB_TYPE = "import_meta_lead"
META_FORMS_SYNC_JOB_TYPE = "sync_meta_forms"
META_INSIGHTS_SYNC_JOB_TYPE = "sync_meta_insights"
META_QUEUE = "meta"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _require_actor(team: Dict[str, Any], current_user: Dict[str, Any]) -> None:
    team_role = (team.get("team_role") or "").lower()
    app_role = (current_user.get("role") or "").lower()
    if team_role not in {"leader"} and app_role != "admin":
        raise PermissionError("Only a team leader or CRM admin can manage Meta")


def create_oauth_state(db: Session, user_id: UUID, team: Dict[str, Any]) -> str:
    raw_state = secrets.token_urlsafe(32)
    expires_at = _now() + timedelta(seconds=META_OAUTH_STATE_TTL_SECONDS)

    db.execute(
        text(
            """
            DELETE FROM meta_oauth_states
            WHERE user_id = :user_id
              AND team_id = :team_id
              AND (used_at IS NOT NULL OR expires_at < NOW())
            """
        ),
        {"user_id": user_id, "team_id": team["team_id"]},
    )
    db.execute(
        text(
            """
            INSERT INTO meta_oauth_states (state_hash, team_id, user_id, expires_at)
            VALUES (:state_hash, :team_id, :user_id, :expires_at)
            """
        ),
        {
            "state_hash": hash_state(raw_state),
            "team_id": team["team_id"],
            "user_id": user_id,
            "expires_at": expires_at,
        },
    )
    db.commit()
    return raw_state


def build_authorization_url(state: str) -> str:
    params = {
        "client_id": META_APP_ID,
        "redirect_uri": META_REDIRECT_URI,
        "response_type": "code",
        "state": state,
    }
    if META_LOGIN_CONFIG_ID:
        params["config_id"] = META_LOGIN_CONFIG_ID
    else:
        params["scope"] = ",".join(META_SCOPES)

    return "https://www.facebook.com/{}/dialog/oauth?{}".format(
        META_API_VERSION,
        urlencode(params),
    )


def lock_oauth_state(
    db: Session,
    state: str,
    user_id: UUID,
    team_id: UUID,
) -> UUID:
    row = db.execute(
        text(
            """
            SELECT id
            FROM meta_oauth_states
            WHERE state_hash = :state_hash
              AND user_id = :user_id
              AND team_id = :team_id
              AND used_at IS NULL
              AND expires_at >= NOW()
            FOR UPDATE
            """
        ),
        {
            "state_hash": hash_state(state),
            "user_id": user_id,
            "team_id": team_id,
        },
    ).mappings().first()
    if not row:
        raise ValueError("OAuth state is invalid, expired, or already used")
    return row["id"]


def mark_oauth_state_used(db: Session, state_id: UUID) -> None:
    db.execute(
        text(
            """
            UPDATE meta_oauth_states
            SET used_at = NOW()
            WHERE id = :id AND used_at IS NULL
            """
        ),
        {"id": state_id},
    )


def _token_expiry(expires_in: Any) -> Optional[datetime]:
    if not expires_in:
        return None
    try:
        seconds = int(expires_in)
    except (TypeError, ValueError):
        return None
    if seconds <= 0:
        return None
    return _now() + timedelta(seconds=seconds)


def create_connection(
    db: Session,
    current_user: Dict[str, Any],
    team: Dict[str, Any],
    token_data: Dict[str, Any],
) -> Dict[str, Any]:
    """Create or reconnect the single Meta connection owned by this team.

    The database has UNIQUE(team_id), so reconnecting must update the existing
    row instead of blindly inserting another connection. The caller owns the
    transaction and commits only after OAuth state consumption succeeds.
    """
    token = str(token_data.get("access_token") or "")
    if not token:
        raise ValueError("Meta access token was not returned")

    # OAuth identity validation must always use real Meta, even when the data
    # provider is configured as mock for local sync testing.
    real_provider = get_real_meta_provider()
    me = real_provider.me(token)
    meta_user_id = str(me.get("id") or "")
    if not meta_user_id:
        raise ValueError("Meta user ID was not returned")
    granted_scopes = real_provider.permissions(token)
    expires_at = _token_expiry(token_data.get("expires_in"))

    existing = db.execute(
        text(
            """
            SELECT id
            FROM meta_connections
            WHERE team_id = :team_id
            FOR UPDATE
            """
        ),
        {"team_id": team["team_id"]},
    ).mappings().first()

    if existing:
        connection = db.execute(
            text(
                """
                UPDATE meta_connections
                SET connected_by_user_id = :user_id,
                    meta_user_id = :meta_user_id,
                    granted_scopes = :scopes,
                    status = 'active',
                    api_version = :api_version,
                    token_expires_at = :token_expires_at,
                    last_validated_at = NOW(),
                    last_successful_sync_at = NULL,
                    last_error = NULL,
                    updated_at = NOW()
                WHERE id = :connection_id
                  AND team_id = :team_id
                RETURNING id, team_id, meta_user_id, granted_scopes, status,
                          api_version, token_expires_at, connected_at
                """
            ),
            {
                "connection_id": existing["id"],
                "team_id": team["team_id"],
                "user_id": current_user["id"],
                "meta_user_id": meta_user_id,
                "scopes": granted_scopes,
                "api_version": META_API_VERSION,
                "token_expires_at": expires_at,
            },
        ).mappings().first()
        db.execute(
            text(
                "DELETE FROM meta_credentials WHERE connection_id = :connection_id"
            ),
            {"connection_id": existing["id"]},
        )
    else:
        connection = db.execute(
            text(
                """
                INSERT INTO meta_connections (
                    team_id, connected_by_user_id, meta_user_id,
                    granted_scopes, status, api_version, token_expires_at
                )
                VALUES (
                    :team_id, :user_id, :meta_user_id,
                    :scopes, 'active', :api_version, :token_expires_at
                )
                RETURNING id, team_id, meta_user_id, granted_scopes, status,
                          api_version, token_expires_at, connected_at
                """
            ),
            {
                "team_id": team["team_id"],
                "user_id": current_user["id"],
                "meta_user_id": meta_user_id,
                "scopes": granted_scopes,
                "api_version": META_API_VERSION,
                "token_expires_at": expires_at,
            },
        ).mappings().first()

    if not connection:
        raise RuntimeError("Failed to create Meta connection")

    db.execute(
        text(
            """
            INSERT INTO meta_credentials (
                connection_id, credential_kind, asset_external_id,
                encrypted_token, key_version, token_expires_at
            )
            VALUES (
                :connection_id, 'user_access_token', NULL,
                :encrypted_token, 1, :expires_at
            )
            """
        ),
        {
            "connection_id": connection["id"],
            "encrypted_token": encrypt_token(token),
            "expires_at": expires_at,
        },
    )
    return dict(connection)


def connection_for_team(
    db: Session,
    connection_id: UUID,
    team_id: UUID,
) -> Optional[Dict[str, Any]]:
    row = db.execute(
        text(
            """
            SELECT id, team_id, meta_user_id, granted_scopes, status, api_version,
                   token_expires_at, last_validated_at, last_successful_sync_at,
                   connected_at
            FROM meta_connections
            WHERE id = :connection_id
              AND team_id = :team_id
            """
        ),
        {"connection_id": connection_id, "team_id": team_id},
    ).mappings().first()
    return dict(row) if row else None



def get_page_token(
    db: Session,
    connection_id: UUID,
    team_id: UUID,
    page_id: str,
) -> str:
    row = db.execute(
        text(
            """
            SELECT c.encrypted_token
            FROM public.meta_credentials c
            INNER JOIN public.meta_connections mc
                ON mc.id = c.connection_id
            WHERE c.connection_id = :connection_id
              AND mc.team_id = :team_id
              AND c.credential_kind = 'page_access_token'
              AND c.asset_external_id = :page_id
            LIMIT 1
            """
        ),
        {
            "connection_id": connection_id,
            "team_id": team_id,
            "page_id": page_id,
        },
    ).mappings().first()

    if not row:
        raise ValueError("Meta Page credential not found.")

    return decrypt_token(row["encrypted_token"])


def get_user_token(db: Session, connection_id: UUID, team_id: UUID) -> str:
    row = db.execute(
        text(
            """
            SELECT c.encrypted_token
            FROM meta_credentials c
            INNER JOIN meta_connections mc
                ON mc.id = c.connection_id
            WHERE c.connection_id = :connection_id
              AND mc.team_id = :team_id
              AND c.credential_kind = 'user_access_token'
              AND c.asset_external_id IS NULL
            LIMIT 1
            """
        ),
        {"connection_id": connection_id, "team_id": team_id},
    ).mappings().first()
    if not row:
        raise ValueError("Meta credential not found")
    return decrypt_token(row["encrypted_token"])


def upsert_discovered_assets(
    db: Session,
    connection_id: UUID,
    team_id: UUID,
    token: str,
) -> Dict[str, int]:
    provider = get_meta_provider()
    businesses = provider.businesses(token)
    pages = provider.pages(token)
    ad_accounts = provider.ad_accounts(token)

    for item in businesses:
        external_id = str(item.get("id") or "")
        if not external_id:
            continue
        db.execute(
            text(
                """
                INSERT INTO meta_businesses (
                    connection_id, team_id, meta_business_id, name, last_seen_at
                )
                VALUES (:connection_id, :team_id, :external_id, :name, NOW())
                ON CONFLICT (connection_id, meta_business_id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    last_seen_at = NOW(),
                    status = 'active',
                    updated_at = NOW()
                """
            ),
            {
                "connection_id": connection_id,
                "team_id": team_id,
                "external_id": external_id,
                "name": str(item.get("name") or external_id),
            },
        )

    for item in pages:
        external_id = str(item.get("id") or "")
        if not external_id:
            continue
        db.execute(
            text(
                """
                INSERT INTO meta_pages (
                    connection_id, team_id, meta_page_id, page_name,
                    page_category, last_seen_at
                )
                VALUES (
                    :connection_id, :team_id, :external_id, :name,
                    :category, NOW()
                )
                ON CONFLICT (connection_id, meta_page_id)
                DO UPDATE SET
                    page_name = EXCLUDED.page_name,
                    page_category = EXCLUDED.page_category,
                    last_seen_at = NOW(),
                    status = 'active',
                    updated_at = NOW()
                """
            ),
            {
                "connection_id": connection_id,
                "team_id": team_id,
                "external_id": external_id,
                "name": str(item.get("name") or external_id),
                "category": item.get("category"),
            },
        )

        page_token = item.get("access_token")
        if page_token:
            db.execute(
                text(
                    """
                    DELETE FROM meta_credentials
                    WHERE connection_id = :connection_id
                      AND credential_kind = 'page_access_token'
                      AND asset_external_id = :external_id
                    """
                ),
                {"connection_id": connection_id, "external_id": external_id},
            )
            db.execute(
                text(
                    """
                    INSERT INTO meta_credentials (
                        connection_id, credential_kind, asset_external_id,
                        encrypted_token, key_version
                    )
                    VALUES (
                        :connection_id, 'page_access_token', :external_id,
                        :encrypted_token, 1
                    )
                    """
                ),
                {
                    "connection_id": connection_id,
                    "external_id": external_id,
                    "encrypted_token": encrypt_token(str(page_token)),
                },
            )

    for item in ad_accounts:
        raw_id = str(item.get("id") or "")
        external_id = raw_id[4:] if raw_id.startswith("act_") else raw_id
        if not external_id:
            continue
        db.execute(
            text(
                """
                INSERT INTO meta_ad_accounts (
                    connection_id, team_id, meta_ad_account_id, name,
                    account_status, currency, timezone_name, last_seen_at
                )
                VALUES (
                    :connection_id, :team_id, :external_id, :name,
                    :account_status, :currency, :timezone_name, NOW()
                )
                ON CONFLICT (connection_id, meta_ad_account_id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    account_status = EXCLUDED.account_status,
                    currency = EXCLUDED.currency,
                    timezone_name = EXCLUDED.timezone_name,
                    last_seen_at = NOW(),
                    status = 'active',
                    updated_at = NOW()
                """
            ),
            {
                "connection_id": connection_id,
                "team_id": team_id,
                "external_id": external_id,
                "name": str(item.get("name") or external_id),
                "account_status": item.get("account_status"),
                "currency": item.get("currency"),
                "timezone_name": item.get("timezone_name"),
            },
        )

    db.execute(
        text(
            """
            UPDATE meta_connections
            SET last_validated_at = NOW(),
                last_successful_sync_at = NOW(),
                last_error = NULL,
                status = 'active',
                updated_at = NOW()
            WHERE id = :connection_id AND team_id = :team_id
            """
        ),
        {"connection_id": connection_id, "team_id": team_id},
    )

    return {
        "businesses": len(businesses),
        "pages": len(pages),
        "ad_accounts": len(ad_accounts),
    }


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _parse_decimal(value: Any) -> Optional[Decimal]:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _ad_accounts_for_connection(
    db: Session,
    connection_id: UUID,
    team_id: UUID,
    ad_account_row_id: Optional[UUID] = None,
) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {
        "connection_id": connection_id,
        "team_id": team_id,
    }
    predicate = ""
    if ad_account_row_id is not None:
        predicate = "AND id = :ad_account_row_id"
        params["ad_account_row_id"] = ad_account_row_id

    rows = db.execute(
        text(
            """
            SELECT id, meta_ad_account_id, name
            FROM meta_ad_accounts
            WHERE connection_id = :connection_id
              AND team_id = :team_id
              AND status <> 'disconnected'
              {predicate}
            ORDER BY created_at ASC
            """.format(predicate=predicate)
        ),
        params,
    ).mappings().all()

    if ad_account_row_id is not None and not rows:
        raise ValueError("Meta ad account not found for this connection")
    return [dict(row) for row in rows]


def sync_campaigns(
    db: Session,
    connection_id: UUID,
    team_id: UUID,
    token: str,
    ad_account_row_id: Optional[UUID] = None,
) -> Dict[str, int]:
    provider = get_meta_provider()
    accounts = _ad_accounts_for_connection(
        db,
        connection_id,
        team_id,
        ad_account_row_id,
    )

    campaign_count = 0
    for account in accounts:
        campaigns = provider.campaigns(token, account["meta_ad_account_id"])
        for item in campaigns:
            external_id = str(item.get("id") or "")
            name = str(item.get("name") or external_id)
            if not external_id:
                continue

            db.execute(
                text(
                    """
                    INSERT INTO meta_campaigns (
                        connection_id,
                        ad_account_row_id,
                        team_id,
                        meta_campaign_id,
                        name,
                        status,
                        objective,
                        start_time,
                        stop_time,
                        daily_budget,
                        lifetime_budget,
                        raw_data,
                        last_seen_at
                    )
                    VALUES (
                        :connection_id,
                        :ad_account_row_id,
                        :team_id,
                        :meta_campaign_id,
                        :name,
                        :status,
                        :objective,
                        :start_time,
                        :stop_time,
                        :daily_budget,
                        :lifetime_budget,
                        CAST(:raw_data AS JSONB),
                        NOW()
                    )
                    ON CONFLICT (ad_account_row_id, meta_campaign_id)
                    DO UPDATE SET
                        connection_id = EXCLUDED.connection_id,
                        team_id = EXCLUDED.team_id,
                        name = EXCLUDED.name,
                        status = EXCLUDED.status,
                        objective = EXCLUDED.objective,
                        start_time = EXCLUDED.start_time,
                        stop_time = EXCLUDED.stop_time,
                        daily_budget = EXCLUDED.daily_budget,
                        lifetime_budget = EXCLUDED.lifetime_budget,
                        raw_data = EXCLUDED.raw_data,
                        last_seen_at = NOW(),
                        updated_at = NOW()
                    """
                ),
                {
                    "connection_id": connection_id,
                    "ad_account_row_id": account["id"],
                    "team_id": team_id,
                    "meta_campaign_id": external_id,
                    "name": name,
                    "status": item.get("effective_status") or item.get("status"),
                    "objective": item.get("objective"),
                    "start_time": _parse_datetime(item.get("start_time")),
                    "stop_time": _parse_datetime(item.get("stop_time")),
                    "daily_budget": _parse_decimal(item.get("daily_budget")),
                    "lifetime_budget": _parse_decimal(item.get("lifetime_budget")),
                    "raw_data": json.dumps(item),
                },
            )
            campaign_count += 1

    db.execute(
        text(
            """
            UPDATE meta_connections
            SET last_validated_at = NOW(),
                last_successful_sync_at = NOW(),
                last_error = NULL,
                status = 'active',
                updated_at = NOW()
            WHERE id = :connection_id AND team_id = :team_id
            """
        ),
        {"connection_id": connection_id, "team_id": team_id},
    )

    return {
        "ad_accounts": len(accounts),
        "campaigns": campaign_count,
    }


def enqueue_campaign_sync(
    db: Session,
    connection_id: UUID,
    team_id: UUID,
    ad_account_row_id: Optional[UUID] = None,
) -> UUID:
    payload = {
        "ad_account_row_id": (
            str(ad_account_row_id) if ad_account_row_id is not None else None
        )
    }

    account_id_text = (
        str(ad_account_row_id) if ad_account_row_id is not None else None
    )
    account_match = (
        "AND payload->>'ad_account_row_id' = :ad_account_row_id"
        if account_id_text is not None
        else "AND payload->>'ad_account_row_id' IS NULL"
    )

    existing = db.execute(
        text(
            """
            SELECT id
            FROM meta_jobs
            WHERE connection_id = :connection_id
              AND team_id = :team_id
              AND queue = :queue
              AND job_type = :job_type
              AND status IN ('pending', 'processing', 'retry')
              {account_match}
            ORDER BY created_at DESC
            LIMIT 1
            """.format(account_match=account_match)
        ),
        {
            "connection_id": connection_id,
            "team_id": team_id,
            "queue": META_QUEUE,
            "job_type": CAMPAIGN_SYNC_JOB_TYPE,
            "ad_account_row_id": account_id_text,
        },
    ).scalar()
    if existing:
        return existing

    row = db.execute(
        text(
            """
            INSERT INTO meta_jobs (
                queue, job_type, team_id, connection_id, payload, status
            )
            VALUES (
                :queue, :job_type, :team_id, :connection_id,
                CAST(:payload AS JSONB), 'pending'
            )
            RETURNING id
            """
        ),
        {
            "queue": META_QUEUE,
            "job_type": CAMPAIGN_SYNC_JOB_TYPE,
            "team_id": team_id,
            "connection_id": connection_id,
            "payload": json.dumps(payload),
        },
    ).scalar_one()
    db.commit()
    return row



def _enqueue_unique_meta_job(
    db: Session,
    *,
    connection_id: UUID,
    team_id: UUID,
    job_type: str,
    payload: Dict[str, Any],
    identity_sql: str,
    identity_params: Dict[str, Any],
) -> UUID:
    existing = db.execute(
        text(
            """
            SELECT id
            FROM public.meta_jobs
            WHERE connection_id = :connection_id
              AND team_id = :team_id
              AND queue = :queue
              AND job_type = :job_type
              AND status IN ('pending', 'processing', 'retry')
              AND {identity_sql}
            ORDER BY created_at DESC
            LIMIT 1
            """.format(identity_sql=identity_sql)
        ),
        {
            "connection_id": connection_id,
            "team_id": team_id,
            "queue": META_QUEUE,
            "job_type": job_type,
            **identity_params,
        },
    ).scalar()

    if existing:
        return existing

    row = db.execute(
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
                :queue,
                :job_type,
                :team_id,
                :connection_id,
                CAST(:payload AS jsonb),
                'pending'
            )
            RETURNING id
            """
        ),
        {
            "queue": META_QUEUE,
            "job_type": job_type,
            "team_id": team_id,
            "connection_id": connection_id,
            "payload": json.dumps(payload),
        },
    ).scalar_one()

    db.commit()
    return row


def enqueue_meta_lead_import(
    db: Session,
    connection_id: UUID,
    team_id: UUID,
    payload: Dict[str, Any],
) -> UUID:
    return _enqueue_unique_meta_job(
        db,
        connection_id=connection_id,
        team_id=team_id,
        job_type=META_LEAD_IMPORT_JOB_TYPE,
        payload=payload,
        identity_sql="payload->>'event_key' = :event_key",
        identity_params={"event_key": str(payload["event_key"])},
    )


def enqueue_meta_forms_sync(
    db: Session,
    connection_id: UUID,
    team_id: UUID,
    page_id: str,
) -> UUID:
    return _enqueue_unique_meta_job(
        db,
        connection_id=connection_id,
        team_id=team_id,
        job_type=META_FORMS_SYNC_JOB_TYPE,
        payload={"page_id": page_id},
        identity_sql="payload->>'page_id' = :page_id",
        identity_params={"page_id": page_id},
    )


def enqueue_meta_insights_sync(
    db: Session,
    connection_id: UUID,
    team_id: UUID,
    ad_account_row_id: Optional[UUID] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> UUID:
    payload = {
        "ad_account_row_id": (
            str(ad_account_row_id) if ad_account_row_id else None
        ),
        "since": since,
        "until": until,
    }

    if ad_account_row_id:
        identity_sql = "payload->>'ad_account_row_id' = :ad_account_row_id"
        identity_params = {
            "ad_account_row_id": str(ad_account_row_id)
        }
    else:
        identity_sql = "payload->>'ad_account_row_id' IS NULL"
        identity_params = {}

    return _enqueue_unique_meta_job(
        db,
        connection_id=connection_id,
        team_id=team_id,
        job_type=META_INSIGHTS_SYNC_JOB_TYPE,
        payload=payload,
        identity_sql=identity_sql,
        identity_params=identity_params,
    )


def get_job_for_team(
    db: Session,
    job_id: UUID,
    team_id: UUID,
) -> Optional[Dict[str, Any]]:
    row = db.execute(
        text(
            """
            SELECT id, queue, job_type, team_id, connection_id,
                   status, attempts, run_after, locked_until, last_error,
                   created_at, completed_at, payload
            FROM meta_jobs
            WHERE id = :job_id AND team_id = :team_id
            """
        ),
        {"job_id": job_id, "team_id": team_id},
    ).mappings().first()
    return dict(row) if row else None


def claim_next_job(db: Session, queue: str = META_QUEUE) -> Optional[Dict[str, Any]]:
    row = db.execute(
        text(
            """
            SELECT id, queue, job_type, team_id, connection_id,
                   payload, attempts
            FROM meta_jobs
            WHERE queue = :queue
              AND (
                    (status IN ('pending', 'retry') AND run_after <= NOW())
                    OR (status = 'processing' AND locked_until < NOW())
                  )
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
            """
        ),
        {"queue": queue},
    ).mappings().first()
    if not row:
        return None

    attempt = int(row["attempts"] or 0) + 1
    db.execute(
        text(
            """
            UPDATE meta_jobs
            SET status = 'processing',
                attempts = :attempts,
                locked_until = NOW() + (:lock_seconds * INTERVAL '1 second'),
                last_error = NULL
            WHERE id = :id
            """
        ),
        {
            "id": row["id"],
            "attempts": attempt,
            "lock_seconds": META_JOB_LOCK_SECONDS,
        },
    )
    db.commit()
    return {
        **dict(row),
        "attempts": attempt,
    }


def complete_job(db: Session, job_id: UUID) -> None:
    db.execute(
        text(
            """
            UPDATE meta_jobs
            SET status = 'completed',
                locked_until = NULL,
                last_error = NULL,
                completed_at = NOW()
            WHERE id = :id
            """
        ),
        {"id": job_id},
    )
    db.commit()


def fail_job(db: Session, job: Dict[str, Any], error: Exception) -> None:
    attempts = int(job.get("attempts") or 0)
    retryable = True
    if isinstance(error, MetaAPIError) and error.status_code in {400, 401, 403, 404}:
        retryable = False

    if isinstance(error, (ValueError, KeyError)):
        retryable = False

    if not retryable or attempts >= META_JOB_MAX_ATTEMPTS:
        status = "dead"
        run_after = _now()
    else:
        status = "retry"
        delay_seconds = min(300, 5 * (2 ** max(0, attempts - 1)))
        run_after = _now() + timedelta(seconds=delay_seconds)

    db.execute(
        text(
            """
            UPDATE meta_jobs
            SET status = :status,
                run_after = :run_after,
                locked_until = NULL,
                last_error = :last_error,
                completed_at = NULL
            WHERE id = :id
            """
        ),
        {
            "id": job["id"],
            "status": status,
            "run_after": run_after,
            "last_error": str(error)[:2000],
        },
    )
    if isinstance(error, MetaAPIError):
        connection_status = {
            401: "expired",
            403: "insufficient_scope",
        }.get(error.status_code, "degraded")
        db.execute(
            text(
                """
                UPDATE meta_connections
                SET status = :status,
                    last_error = :last_error,
                    updated_at = NOW()
                WHERE id = :connection_id
                  AND team_id = :team_id
                """
            ),
            {
                "status": connection_status,
                "last_error": str(error)[:2000],
                "connection_id": job["connection_id"],
                "team_id": job["team_id"],
            },
        )
    db.commit()



def sync_forms(
    db: Session,
    connection_id: UUID,
    team_id: UUID,
    token: str,
    page_id: str,
) -> Dict[str, int]:
    page = db.execute(
        text(
            """
            SELECT id
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
            "team_id": team_id,
            "page_id": page_id,
        },
    ).mappings().first()

    if not page:
        raise ValueError("Meta Page not found.")

    forms = MetaClient().leadgen_forms(
        token,
        page_id,
    )

    saved = 0

    for item in forms:
        form_id = str(item.get("id") or "").strip()
        if not form_id:
            continue

        db.execute(
            text(
                """
                INSERT INTO public.meta_lead_forms (
                    team_id,
                    connection_id,
                    page_row_id,
                    meta_page_id,
                    meta_form_id,
                    name,
                    status,
                    questions,
                    raw_data,
                    last_seen_at,
                    updated_at
                )
                VALUES (
                    :team_id,
                    :connection_id,
                    :page_row_id,
                    :page_id,
                    :form_id,
                    :name,
                    :status,
                    CAST(:questions AS jsonb),
                    CAST(:raw_data AS jsonb),
                    NOW(),
                    NOW()
                )
                ON CONFLICT (team_id, meta_form_id)
                DO UPDATE SET
                    connection_id = EXCLUDED.connection_id,
                    page_row_id = EXCLUDED.page_row_id,
                    meta_page_id = EXCLUDED.meta_page_id,
                    name = EXCLUDED.name,
                    status = EXCLUDED.status,
                    questions = EXCLUDED.questions,
                    raw_data = EXCLUDED.raw_data,
                    last_seen_at = NOW(),
                    updated_at = NOW()
                """
            ),
            {
                "team_id": team_id,
                "connection_id": connection_id,
                "page_row_id": page["id"],
                "page_id": page_id,
                "form_id": form_id,
                "name": str(item.get("name") or form_id),
                "status": item.get("status"),
                "questions": json.dumps(item.get("questions") or []),
                "raw_data": json.dumps(item),
            },
        )
        saved += 1

    return {"forms": saved}


def _extract_lead_count(actions: Any) -> int:
    if not isinstance(actions, list):
        return 0

    total = 0
    for action in actions:
        if not isinstance(action, dict):
            continue

        action_type = str(
            action.get("action_type") or ""
        ).lower()

        if action_type not in {
            "lead",
            "onsite_conversion.lead",
            "offsite_conversion.fb_pixel_lead",
        }:
            continue

        try:
            total += int(float(action.get("value") or 0))
        except (TypeError, ValueError):
            continue

    return total


def sync_insights(
    db: Session,
    connection_id: UUID,
    team_id: UUID,
    token: str,
    ad_account_row_id: Optional[UUID] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> Dict[str, int]:
    accounts = _ad_accounts_for_connection(
        db,
        connection_id,
        team_id,
        ad_account_row_id,
    )

    if until is None:
        until = _now().date().isoformat()

    if since is None:
        since = (
            _now().date() - timedelta(days=30)
        ).isoformat()

    total_rows = 0

    for account in accounts:
        account_id = str(account["meta_ad_account_id"])
        object_id = (
            account_id
            if account_id.startswith("act_")
            else f"act_{account_id}"
        )

        base_params = {
            "time_range": json.dumps(
                {"since": since, "until": until}
            ),
            "time_increment": 1,
            "fields": (
                "date_start,date_stop,"
                "campaign_id,campaign_name,"
                "adset_id,adset_name,"
                "ad_id,ad_name,"
                "spend,impressions,reach,frequency,"
                "clicks,ctr,cpc,cpm,actions,"
                "cost_per_action_type"
            ),
        }

        for level in ("account", "campaign", "adset", "ad"):
            params = dict(base_params)
            params["level"] = level

            rows = MetaClient().insights(
                token,
                object_id,
                params,
            )

            for item in rows:
                if level == "account":
                    meta_object_id = object_id
                elif level == "campaign":
                    meta_object_id = str(
                        item.get("campaign_id") or ""
                    )
                elif level == "adset":
                    meta_object_id = str(
                        item.get("adset_id") or ""
                    )
                else:
                    meta_object_id = str(
                        item.get("ad_id") or ""
                    )

                if not meta_object_id:
                    continue

                def int_value(value):
                    try:
                        return int(float(value or 0))
                    except (TypeError, ValueError):
                        return 0

                db.execute(
                    text(
                        """
                        INSERT INTO public.meta_insights_daily (
                            team_id, connection_id, ad_account_row_id,
                            level, meta_object_id,
                            campaign_id, campaign_name,
                            adset_id, adset_name,
                            ad_id, ad_name,
                            date_start, date_stop,
                            spend, impressions, reach, frequency,
                            clicks, ctr, cpc, cpm, lead_count,
                            actions, cost_per_action_type, raw_data
                        )
                        VALUES (
                            :team_id, :connection_id, :account_row_id,
                            :level, :meta_object_id,
                            :campaign_id, :campaign_name,
                            :adset_id, :adset_name,
                            :ad_id, :ad_name,
                            :date_start, :date_stop,
                            COALESCE(:spend, 0),
                            COALESCE(:impressions, 0),
                            COALESCE(:reach, 0),
                            :frequency,
                            COALESCE(:clicks, 0),
                            :ctr, :cpc, :cpm,
                            :lead_count,
                            CAST(:actions AS jsonb),
                            CAST(:cost_per_action_type AS jsonb),
                            CAST(:raw_data AS jsonb)
                        )
                        ON CONFLICT (
                            team_id, connection_id, level,
                            meta_object_id, date_start, date_stop
                        )
                        DO UPDATE SET
                            campaign_id = EXCLUDED.campaign_id,
                            campaign_name = EXCLUDED.campaign_name,
                            adset_id = EXCLUDED.adset_id,
                            adset_name = EXCLUDED.adset_name,
                            ad_id = EXCLUDED.ad_id,
                            ad_name = EXCLUDED.ad_name,
                            spend = EXCLUDED.spend,
                            impressions = EXCLUDED.impressions,
                            reach = EXCLUDED.reach,
                            frequency = EXCLUDED.frequency,
                            clicks = EXCLUDED.clicks,
                            ctr = EXCLUDED.ctr,
                            cpc = EXCLUDED.cpc,
                            cpm = EXCLUDED.cpm,
                            lead_count = EXCLUDED.lead_count,
                            actions = EXCLUDED.actions,
                            cost_per_action_type =
                                EXCLUDED.cost_per_action_type,
                            raw_data = EXCLUDED.raw_data,
                            updated_at = NOW()
                        """
                    ),
                    {
                        "team_id": team_id,
                        "connection_id": connection_id,
                        "account_row_id": account["id"],
                        "level": level,
                        "meta_object_id": meta_object_id,
                        "campaign_id": item.get("campaign_id"),
                        "campaign_name": item.get("campaign_name"),
                        "adset_id": item.get("adset_id"),
                        "adset_name": item.get("adset_name"),
                        "ad_id": item.get("ad_id"),
                        "ad_name": item.get("ad_name"),
                        "date_start": item.get("date_start"),
                        "date_stop": item.get("date_stop"),
                        "spend": _parse_decimal(item.get("spend")),
                        "impressions": int_value(item.get("impressions")),
                        "reach": int_value(item.get("reach")),
                        "frequency": _parse_decimal(item.get("frequency")),
                        "clicks": int_value(item.get("clicks")),
                        "ctr": _parse_decimal(item.get("ctr")),
                        "cpc": _parse_decimal(item.get("cpc")),
                        "cpm": _parse_decimal(item.get("cpm")),
                        "lead_count": _extract_lead_count(
                            item.get("actions")
                        ),
                        "actions": json.dumps(item.get("actions") or []),
                        "cost_per_action_type": json.dumps(
                            item.get("cost_per_action_type") or []
                        ),
                        "raw_data": json.dumps(item),
                    },
                )
                total_rows += 1

    return {"insights": total_rows}


def execute_claimed_job(
    db: Session,
    job: Dict[str, Any],
) -> Dict[str, int]:
    job_type = job["job_type"]
    payload = job.get("payload") or {}

    if job_type == CAMPAIGN_SYNC_JOB_TYPE:
        raw_account_id = payload.get("ad_account_row_id")
        ad_account_row_id = (
            UUID(raw_account_id)
            if raw_account_id
            else None
        )

        token = get_user_token(
            db,
            job["connection_id"],
            job["team_id"],
        )

        return sync_campaigns(
            db,
            job["connection_id"],
            job["team_id"],
            token,
            ad_account_row_id,
        )

    if job_type == META_FORMS_SYNC_JOB_TYPE:
        page_id = str(
            payload.get("page_id") or ""
        ).strip()

        if not page_id:
            raise ValueError(
                "Meta form sync requires page_id."
            )

        token = get_page_token(
            db,
            job["connection_id"],
            job["team_id"],
            page_id,
        )

        return sync_forms(
            db,
            job["connection_id"],
            job["team_id"],
            token,
            page_id,
        )

    if job_type == META_INSIGHTS_SYNC_JOB_TYPE:
        raw_account_id = payload.get(
            "ad_account_row_id"
        )
        ad_account_row_id = (
            UUID(raw_account_id)
            if raw_account_id
            else None
        )

        token = get_user_token(
            db,
            job["connection_id"],
            job["team_id"],
        )

        return sync_insights(
            db,
            job["connection_id"],
            job["team_id"],
            token,
            ad_account_row_id,
            payload.get("since"),
            payload.get("until"),
        )

    if job_type == META_LEAD_IMPORT_JOB_TYPE:
        from app.meta.lead_ingestion import process_meta_lead_job

        return process_meta_lead_job(db, job)

    raise ValueError(
        "Unsupported Meta job type: {}".format(job_type)
    )


__all__ = [
    "CAMPAIGN_SYNC_JOB_TYPE",
    "META_LEAD_IMPORT_JOB_TYPE",
    "META_FORMS_SYNC_JOB_TYPE",
    "META_INSIGHTS_SYNC_JOB_TYPE",
    "META_QUEUE",
    "META_PROVIDER",
    "_require_actor",
    "build_authorization_url",
    "claim_next_job",
    "complete_job",
    "connection_for_team",
    "create_connection",
    "create_oauth_state",
    "enqueue_campaign_sync",
    "enqueue_meta_lead_import",
    "enqueue_meta_forms_sync",
    "enqueue_meta_insights_sync",
    "execute_claimed_job",
    "fail_job",
    "get_job_for_team",
    "get_page_token",
    "get_user_token",
    "lock_oauth_state",
    "mark_oauth_state_used",
    "sync_campaigns",
    "sync_forms",
    "sync_insights",
    "upsert_discovered_assets",
]
