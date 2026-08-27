import os
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import SessionLocal

SUPABASE_URL = os.getenv("SUPABASE_URL")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

security = HTTPBearer()
_jwk_client = jwt.PyJWKClient(JWKS_URL)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token, signing_key.key, algorithms=["ES256"],
            audience="authenticated", leeway=60
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    profile = db.execute(
        text("SELECT id, email, role, is_active, subscription_tier FROM profiles WHERE id = :id"),
        {"id": user_id}
    ).mappings().first()

    if not profile:
        raise HTTPException(status_code=401, detail="No matching profile")
    if not profile["is_active"]:
        raise HTTPException(status_code=403, detail="Account inactive")
    return profile

def require_admin(current_user=Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user