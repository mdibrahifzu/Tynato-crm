import os
import re
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env", override=False)

TRUE_VALUES = {"1", "true", "yes", "on"}


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError("{} is not configured".format(name))
    return value


META_ENABLED = os.getenv("META_ENABLED", "false").strip().lower() in TRUE_VALUES
META_PROVIDER = os.getenv("META_PROVIDER", "real").strip().lower()
META_ALLOW_MOCK = os.getenv("META_ALLOW_MOCK", "false").strip().lower() in TRUE_VALUES

META_API_VERSION = os.getenv("META_API_VERSION", "v26.0").strip()
META_GRAPH_BASE_URL = "https://graph.facebook.com/{}".format(META_API_VERSION)

META_APP_ID = os.getenv("META_APP_ID", "").strip()
META_APP_SECRET = os.getenv("META_APP_SECRET", "").strip()
META_LOGIN_CONFIG_ID = os.getenv("META_LOGIN_CONFIG_ID", "").strip()
META_REDIRECT_URI = os.getenv("META_REDIRECT_URI", "").strip()
META_WEBHOOK_VERIFY_TOKEN = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "").strip()
META_ENCRYPTION_KEY = os.getenv("META_ENCRYPTION_KEY", "").strip()

META_SCOPES = [
    item.strip()
    for item in os.getenv(
        "META_SCOPES",
        "business_management,ads_read,pages_show_list,"
        "pages_read_engagement,pages_manage_metadata",
    ).split(",")
    if item.strip()
]

META_OAUTH_STATE_TTL_SECONDS = int(
    os.getenv("META_OAUTH_STATE_TTL_SECONDS", "600")
)
META_HTTP_TIMEOUT_SECONDS = float(
    os.getenv("META_HTTP_TIMEOUT_SECONDS", "15")
)
META_JOB_MAX_ATTEMPTS = int(os.getenv("META_JOB_MAX_ATTEMPTS", "5"))
META_JOB_LOCK_SECONDS = int(os.getenv("META_JOB_LOCK_SECONDS", "300"))
META_WORKER_POLL_SECONDS = float(os.getenv("META_WORKER_POLL_SECONDS", "2"))


def validate_runtime_config() -> None:
    if META_PROVIDER not in {"real", "mock"}:
        raise RuntimeError("META_PROVIDER must be either 'real' or 'mock'")

    if META_PROVIDER == "mock":
        if not META_ALLOW_MOCK:
            raise RuntimeError(
                "META_PROVIDER=mock requires META_ALLOW_MOCK=true."
            )
        _required("META_ENCRYPTION_KEY")
    else:
        _required("META_APP_ID")
        _required("META_APP_SECRET")
        _required("META_LOGIN_CONFIG_ID")
        _required("META_REDIRECT_URI")
        _required("META_ENCRYPTION_KEY")

    if not re.fullmatch(r"v\d+\.\d+", META_API_VERSION):
        raise RuntimeError("META_API_VERSION must look like v26.0")

    if not META_SCOPES:
        raise RuntimeError("META_SCOPES must contain at least one scope")

    if META_OAUTH_STATE_TTL_SECONDS < 60:
        raise RuntimeError(
            "META_OAUTH_STATE_TTL_SECONDS must be at least 60 seconds"
        )

    if META_HTTP_TIMEOUT_SECONDS <= 0:
        raise RuntimeError("META_HTTP_TIMEOUT_SECONDS must be greater than zero")

    if META_JOB_MAX_ATTEMPTS < 1:
        raise RuntimeError("META_JOB_MAX_ATTEMPTS must be at least 1")

    if META_JOB_LOCK_SECONDS < 30:
        raise RuntimeError("META_JOB_LOCK_SECONDS must be at least 30 seconds")

    if META_WORKER_POLL_SECONDS <= 0:
        raise RuntimeError("META_WORKER_POLL_SECONDS must be greater than zero")
