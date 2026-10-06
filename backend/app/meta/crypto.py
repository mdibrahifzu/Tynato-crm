import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.meta.config import META_ENCRYPTION_KEY


def _fernet() -> Fernet:
    if not META_ENCRYPTION_KEY:
        raise RuntimeError("META_ENCRYPTION_KEY is not configured")
    try:
        return Fernet(META_ENCRYPTION_KEY.encode("ascii"))
    except Exception as exc:
        raise RuntimeError(
            "META_ENCRYPTION_KEY must be a valid Fernet key"
        ) from exc


def encrypt_token(token: str) -> str:
    if not token:
        raise ValueError("Token cannot be empty")
    return _fernet().encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_token(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Stored Meta credential could not be decrypted") from exc


def hash_state(state: str) -> str:
    return hashlib.sha256(state.encode("utf-8")).hexdigest()
