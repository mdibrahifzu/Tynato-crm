from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db

router = APIRouter(prefix="/profile", tags=["Profile"])


class ProfileNameUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        clean_value = value.strip()
        if not clean_value:
            raise ValueError("Full name cannot be empty.")
        return clean_value


@router.get("/me")
def get_my_profile(current_user=Depends(get_current_user)):
    return {
        "id": str(current_user["id"]),
        "email": current_user["email"],
        "full_name": current_user["full_name"],
    }


@router.put("/me")
def update_my_profile_name(
    payload: ProfileNameUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        row = db.execute(
            text(
                """
                UPDATE public.profiles
                SET full_name = :full_name
                WHERE id = :user_id
                RETURNING id, email, full_name
                """
            ),
            {
                "full_name": payload.full_name,
                "user_id": str(current_user["id"]),
            },
        ).mappings().first()

        if not row:
            db.rollback()
            raise HTTPException(status_code=404, detail="CRM profile not found.")

        db.commit()
        return {
            "id": str(row["id"]),
            "email": row["email"],
            "full_name": row["full_name"],
        }
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise
