from app.models.lead import Lead

def save_lead(
    db,
    business_name,
    phone,
    website,
    address,
    search_query
):

    existing = db.query(Lead).filter(
        Lead.website == website
    ).first()

    if existing:
        return existing

    lead = Lead(
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