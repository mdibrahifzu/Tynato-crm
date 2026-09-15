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
    # SEARCHED LEADS
    # ============================================================

    searched_params = {}

    searched_scope = _build_scope(
        current_user,
        team,
        searched_params,
        "l",
    )

    searched_conditions = []

    if searched_scope:
        searched_conditions.append(searched_scope)

    # Normal manually-created leads use search_query = 'manual'.
    # Everything else in the leads table is treated as a searched lead.
    searched_conditions.append(
        "l.search_query IS DISTINCT FROM 'manual'"
    )

    searched_where = " AND ".join(searched_conditions)

    searched_leads = db.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM leads l
            WHERE {searched_where}
            """
        ),
        searched_params,
    ).scalar() or 0

    # ============================================================
    # MANUALLY IMPORTED CUSTOM LEADS
    # ============================================================

    imported_params = {}

    imported_scope = _build_scope(
        current_user,
        team,
        imported_params,
        "cl",
    )

    imported_where = (
        f"WHERE {imported_scope}"
        if imported_scope
        else ""
    )

    manual_imported_leads = db.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM custom_leads cl
            {imported_where}
            """
        ),
        imported_params,
    ).scalar() or 0

    # ============================================================
    # TOTAL LEADS
    # ============================================================

    total_leads = (
        searched_leads
        + manual_imported_leads
    )

    # ============================================================
    # STATUS COUNTS
    #
    # Combine:
    #   searched leads from leads
    #   +
    #   manually imported custom leads
    #
    # NULL status is treated as "new".
    #
    # Junk and not_interested are returned by the API but are
    # intentionally not displayed in the dashboard banner.
    # ============================================================

    status_params = {}

    searched_status_scope = _build_scope(
        current_user,
        team,
        status_params,
        "l",
    )

    custom_status_params = {}

    custom_status_scope = _build_scope(
        current_user,
        team,
        custom_status_params,
        "cl",
    )

    searched_status_conditions = []

    if searched_status_scope:
        searched_status_conditions.append(
            searched_status_scope
        )

    searched_status_conditions.append(
        "l.search_query IS DISTINCT FROM 'manual'"
    )

    searched_status_where = " AND ".join(
        searched_status_conditions
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
                COALESCE(status, 'new') AS status,
                COUNT(*) AS count
            FROM (
                SELECT l.status
                FROM leads l
                WHERE {searched_status_where}

                UNION ALL

                SELECT cl.status
                FROM custom_leads cl
                {custom_status_where}
            ) combined_leads
            GROUP BY COALESCE(status, 'new')
            """
        ),
        {
            **status_params,
            **custom_status_params,
        },
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
    # EXISTING LEADS DATA
    #
    # Keep this so other dashboard functionality does not break.
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
        # Overall
        "total_leads": total_leads,

        # Sources
        "searched_leads": searched_leads,
        "manual_imported_leads": manual_imported_leads,

        # Dashboard banner statuses
        "new": status_counts["new"],
        "interested": status_counts["interested"],
        "follow_up": status_counts["follow_up"],
        "converted": status_counts["converted"],

        # Available to API, but not displayed in banner
        "not_interested": status_counts["not_interested"],
        "junk": status_counts["junk"],

        # Existing dashboard data
        "recent_searches": [
            row[0]
            for row in recent_searches
        ],

        "leads": leads,
    }

    # Existing team information
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