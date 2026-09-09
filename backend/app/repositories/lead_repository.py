from sqlalchemy import text


def save_lead(
    db,
    owner_id,
    business_name,
    phone,
    website,
    address,
    search_query,
    team_id=None,
    created_by=None,
):
    # --------------------------------------------------
    # Prevent duplicate websites within the same
    # ownership scope.
    # --------------------------------------------------

    if team_id:
        existing = db.execute(
            text(
                """
                SELECT
                    id,
                    business_name,
                    phone,
                    website,
                    address,
                    search_query,
                    created_at,
                    status,
                    notes,
                    last_updated,
                    follow_up_date,
                    owner_id,
                    user_id,
                    team_id
                FROM leads
                WHERE team_id = :team_id
                  AND website = :website
                LIMIT 1
                """
            ),
            {
                "team_id": team_id,
                "website": website,
            },
        ).mappings().first()

    else:
        existing = db.execute(
            text(
                """
                SELECT
                    id,
                    business_name,
                    phone,
                    website,
                    address,
                    search_query,
                    created_at,
                    status,
                    notes,
                    last_updated,
                    follow_up_date,
                    owner_id,
                    user_id,
                    team_id
                FROM leads
                WHERE owner_id = :owner_id
                  AND website = :website
                  AND team_id IS NULL
                LIMIT 1
                """
            ),
            {
                "owner_id": owner_id,
                "website": website,
            },
        ).mappings().first()

    if existing:
        return existing

    result = db.execute(
        text(
            """
            INSERT INTO leads (
                owner_id,
                user_id,
                team_id,
                business_name,
                phone,
                website,
                address,
                search_query
            )
            VALUES (
                :owner_id,
                :user_id,
                :team_id,
                :business_name,
                :phone,
                :website,
                :address,
                :search_query
            )
            RETURNING
                id,
                business_name,
                phone,
                website,
                address,
                search_query,
                created_at,
                status,
                notes,
                last_updated,
                follow_up_date,
                owner_id,
                user_id,
                team_id
            """
        ),
        {
            "owner_id": owner_id,
            "user_id": created_by or owner_id,
            "team_id": team_id,
            "business_name": business_name,
            "phone": phone,
            "website": website,
            "address": address,
            "search_query": search_query,
        },
    )

    lead = result.mappings().first()

    return lead