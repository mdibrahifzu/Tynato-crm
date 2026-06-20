# app/routes/users.py

from fastapi import APIRouter

router = APIRouter()

@router.get("/users")
def get_users():

    return [
        {
            "email": "test@example.com"
        }
    ]