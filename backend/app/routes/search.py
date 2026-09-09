from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.schemas.search import SearchRequest
from app.services.google_places import search_places
from app.dependencies import (
    get_db,
    get_current_user,
    get_current_team,
    get_pending_team_membership,
)
from app.repositories.lead_repository import save_lead
from app.config import FREE_SEARCH_LIMIT


router = APIRouter()


@router.post("/search")
def search(
    data: SearchRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
    pending_membership=Depends(get_pending_team_membership),
):
    # =====================================================
    # TEAM SEARCH
    # =====================================================

    if team:
        updated_team = db.execute(
            text(
                """
                UPDATE teams
                SET searches_used = searches_used + 1
                WHERE id = :team_id
                  AND searches_used < search_limit
                RETURNING
                    searches_used,
                    search_limit
                """
            ),
            {
                "team_id": team["team_id"],
            },
        ).mappings().first()

        if not updated_team:
            raise HTTPException(
                status_code=402,
                detail={
                    "message": "Team search limit reached.",
                    "upgrade_required": True,
                    "limit": team["search_limit"],
                },
            )

        db.commit()

        try:
            leads = search_places(data.query)
        except Exception:
            db.execute(
                text(
                    """
                    UPDATE teams
                    SET searches_used =
                        GREATEST(searches_used - 1, 0)
                    WHERE id = :team_id
                    """
                ),
                {
                    "team_id": team["team_id"],
                },
            )

            db.commit()
            raise

        saved_count = 0

        for lead in leads:
            save_lead(
                db=db,
                owner_id=current_user["id"],
                team_id=team["team_id"],
                created_by=current_user["id"],
                business_name=lead.get("business_name"),
                phone=lead.get("phone"),
                website=lead.get("website"),
                address=lead.get("address"),
                search_query=data.query,
            )

            saved_count += 1

        db.execute(
            text(
                """
                INSERT INTO search_history (
                    query,
                    user_email,
                    owner_id,
                    team_id
                )
                VALUES (
                    :query,
                    :user_email,
                    :owner_id,
                    :team_id
                )
                """
            ),
            {
                "query": data.query,
                "user_email": current_user["email"],
                "owner_id": current_user["id"],
                "team_id": team["team_id"],
            },
        )

        db.commit()

        return {
            "query": data.query,
            "saved_leads": saved_count,
            "results": leads,
            "team_searches_used": updated_team["searches_used"],
            "team_search_limit": updated_team["search_limit"],
        }

    # =====================================================
    # BLOCK: pending/invited users get no personal search
    # =====================================================
    if pending_membership:
        raise HTTPException(
            status_code=403,
            detail="Your team invitation is pending. Personal search is not available until you're an active team member.",
        )

    # =====================================================
    # PERSONAL SEARCH
    # =====================================================

    if current_user["role"] != "admin":
        search_count = db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM search_history
                WHERE owner_id = :owner_id
                  AND team_id IS NULL
                """
            ),
            {
                "owner_id": current_user["id"],
            },
        ).scalar() or 0

        if search_count >= FREE_SEARCH_LIMIT:
            raise HTTPException(
                status_code=402,
                detail={
                    "message": "Free search limit reached.",
                    "upgrade_required": True,
                    "limit": FREE_SEARCH_LIMIT,
                },
            )

    leads = search_places(data.query)

    saved_count = 0

    for lead in leads:
        save_lead(
            db=db,
            owner_id=current_user["id"],
            business_name=lead.get("business_name"),
            phone=lead.get("phone"),
            website=lead.get("website"),
            address=lead.get("address"),
            search_query=data.query,
        )

        saved_count += 1

    db.execute(
        text(
            """
            INSERT INTO search_history (
                query,
                user_email,
                owner_id
            )
            VALUES (
                :query,
                :user_email,
                :owner_id
            )
            """
        ),
        {
            "query": data.query,
            "user_email": current_user["email"],
            "owner_id": current_user["id"],
        },
    )

    db.commit()

    return {
        "query": data.query,
        "saved_leads": saved_count,
        "results": leads,
    }