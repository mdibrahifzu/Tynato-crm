from app.models.lead import Lead

def save_lead(
    db,
    owner_id,
    business_name,
    phone,
    website,
    address,
    search_query
):

    existing = db.query(Lead).filter(
        Lead.owner_id == owner_id,
        Lead.website == website
    ).first()

    if existing:
        return existing

    lead = Lead(
        owner_id=owner_id,
        business_name=business_name,
        phone=phone,
        website=website,
        address=address,
        search_query=search_query
    )

    db.add(lead)
    db.commit()
    db.refresh(lead)

    return lead