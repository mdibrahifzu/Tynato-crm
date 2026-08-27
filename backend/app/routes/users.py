from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
 
from app.dependencies import require_admin, get_db
 
router = APIRouter()
 
 
@router.get("/users")
def get_users(
    current_user=Depends(require_admin)
):
    return [
        {
            "email": "test@example.com"
        }
    ]
 
 
@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    role = payload.get("role")
 
    if role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="role must be 'user' or 'admin'")
 
    result = db.execute(
        text("UPDATE profiles SET role = :role WHERE id = :id RETURNING id, email, role"),
        {"role": role, "id": user_id}
    )
    db.commit()
 
    updated = result.mappings().first()
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
 
    return updated