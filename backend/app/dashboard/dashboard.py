from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import (
    get_db,
    get_current_user,
    get_current_team,
    get_pending_team_membership,
)

router = APIRouter()


def _build_scope(current_user, team, params, alias):
    """
    Build the same access scope used throughout the CRM.

    Admin:
        All records.

    Team user:
        Records belonging to the current team.

    Personal user:
        Records owned by the current user and not assigned to a team.
    """

    if current_user["role"] == "admin":
        return ""

    if team:
        params["team_id"] = team["team_id"]
        return f"{alias}.team_id = :team_id"

    params["owner_id"] = current_user["id"]

    return (
        f"{alias}.owner_id = :owner_id "
        f"AND {alias}.team_id IS NULL"
    )


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
    pending_membership=Depends(get_pending_team_membership),
):
    # ============================================================
    # PENDING TEAM MEMBER
    # ============================================================

    if (
        pending_membership
        and current_user["role"] != "admin"
    ):
        return {
            "status": "pending",
            "message": "Your team invitation is pending approval.",
        }

    # ============================================================
    # META LEADS
    #
    # Meta leads are stored in custom_leads.
    # Their source is identified by lead_source_attribution.
    # ============================================================

    meta_params = {}

    meta_scope = _build_scope(
        current_user,
        team,
        meta_params,
        "cl",
    )

    meta_conditions = []

    if meta_scope:
        meta_conditions.append(meta_scope)

    meta_conditions.append(
        """
        EXISTS (
            SELECT 1
            FROM public.lead_source_attribution lsa
            WHERE lsa.lead_id = cl.id
              AND lsa.source = 'meta'
        )
        """
    )

    meta_where = " AND ".join(meta_conditions)

    meta_leads = db.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM public.custom_leads cl
            WHERE {meta_where}
            """
        ),
        meta_params,
    ).scalar() or 0

    # ============================================================
    # MANUAL / NON-META CUSTOM LEADS
    #
    # Exclude leads attributed to Meta so they are not counted
    # in both Meta Leads and Manual Imported.
    # ============================================================

    imported_params = {}

    imported_scope = _build_scope(
        current_user,
        team,
        imported_params,
        "cl",
    )

    imported_conditions = []

    if imported_scope:
        imported_conditions.append(imported_scope)

    imported_conditions.append(
        """
        NOT EXISTS (
            SELECT 1
            FROM public.lead_source_attribution lsa
            WHERE lsa.lead_id = cl.id
              AND lsa.source = 'meta'
        )
        """
    )

    imported_where = " AND ".join(imported_conditions)

    manual_imported_leads = db.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM public.custom_leads cl
            WHERE {imported_where}
            """
        ),
        imported_params,
    ).scalar() or 0

    # ============================================================
    # TOTAL LEADS
    #
    # Total = Meta Leads + non-Meta custom leads.
    # The legacy searched-lead count is no longer included.
    # ============================================================

    meta_leads = int(meta_leads)
    manual_imported_leads = int(manual_imported_leads)

    total_leads = (
        meta_leads + manual_imported_leads
    )

    # ============================================================
    # STATUS COUNTS
    #
    # Count the CRM pipeline from custom_leads.
    # This includes Meta and non-Meta custom leads.
    #
    # NULL status is treated as "new".
    # ============================================================

    status_params = {}

    custom_status_scope = _build_scope(
        current_user,
        team,
        status_params,
        "cl",
    )

    custom_status_where = (
        f"WHERE {custom_status_scope}"
        if custom_status_scope
        else ""
    )

    status_rows = db.execute(
        text(
            f"""
            SELECT
                COALESCE(cl.status, 'new') AS status,
                COUNT(*) AS count
            FROM public.custom_leads cl
            {custom_status_where}
            GROUP BY COALESCE(cl.status, 'new')
            """
        ),
        status_params,
    ).mappings().all()

    status_counts = {
        "new": 0,
        "interested": 0,
        "follow_up": 0,
        "converted": 0,
        "not_interested": 0,
        "junk": 0,
    }

    for row in status_rows:
        status = row["status"]

        if status in status_counts:
            status_counts[status] = int(row["count"])

    # ============================================================
    # RECENT SEARCHES
    #
    # Preserve existing dashboard response behavior.
    # ============================================================

    if current_user["role"] == "admin":

        recent_searches = db.execute(
            text(
                """
                SELECT query
                FROM search_history
                ORDER BY created_at DESC
                LIMIT 5
                """
            )
        ).fetchall()

    elif team:

        recent_searches = db.execute(
            text(
                """
                SELECT query
                FROM search_history
                WHERE team_id = :team_id
                ORDER BY created_at DESC
                LIMIT 5
                """
            ),
            {
                "team_id": team["team_id"],
            },
        ).fetchall()

    else:

        recent_searches = db.execute(
            text(
                """
                SELECT query
                FROM search_history
                WHERE owner_id = :owner_id
                  AND team_id IS NULL
                ORDER BY created_at DESC
                LIMIT 5
                """
            ),
            {
                "owner_id": current_user["id"],
            },
        ).fetchall()

    # ============================================================
    # LEGACY LEADS DATA
    #
    # Retained for compatibility with any existing consumers
    # of the dashboard response.
    #
    # This query does NOT contribute to total_leads or the
    # pipeline status counts above.
    # ============================================================

    leads_params = {}

    leads_scope = _build_scope(
        current_user,
        team,
        leads_params,
        "l",
    )

    leads_where = (
        f"WHERE {leads_scope}"
        if leads_scope
        else ""
    )

    leads = db.execute(
        text(
            f"""
            SELECT
                id,
                business_name,
                phone,
                website,
                address,
                search_query,
                status,
                notes
            FROM leads l
            {leads_where}
            ORDER BY id DESC
            """
        ),
        leads_params,
    ).mappings().all()

    # ============================================================
    # RESPONSE
    # ============================================================

    response = {
        # Overall dashboard metrics
        "total_leads": total_leads,

        # Lead sources
        "meta_leads": meta_leads,
        "manual_imported_leads": manual_imported_leads,

        # Backward compatibility for older frontend consumers.
        # Searched leads are no longer counted.
        "searched_leads": 0,

        # Dashboard pipeline status counts
        "new": status_counts["new"],
        "interested": status_counts["interested"],
        "follow_up": status_counts["follow_up"],
        "converted": status_counts["converted"],

        # Available to the API, even though not shown in the
        # current status-card layout.
        "not_interested": status_counts["not_interested"],
        "junk": status_counts["junk"],

        # Existing dashboard data
        "recent_searches": [
            row[0]
            for row in recent_searches
        ],

        "leads": leads,
    }

    # ============================================================
    # EXISTING TEAM INFORMATION
    # ============================================================

    if team:
        response.update(
            {
                "team_id": team["team_id"],
                "team_name": team["team_name"],
                "team_role": team["team_role"],
                "plan": team["plan"],
                "searches_used": team["searches_used"],
                "search_limit": team["search_limit"],
                "member_limit": team["member_limit"],
            }
        )

    return response