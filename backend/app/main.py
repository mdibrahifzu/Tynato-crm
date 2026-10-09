
import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env before any module that reads os.getenv() at import time.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=False)

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.routes.invoice import router as invoice_router
from app.database import engine
from app.routes.search import router as search_router
from app.routes.leads import router as leads_router
from app.routes.leads_upload import router as leads_upload_router
from app.routes.dashboard import router as dashboard_router
from app.routes.export import router as export_router
from app.routes.search_history import router as search_history_router
from app.routes.users import router as users_router
from app.routes.lead_status import router as lead_status_router
from app.routes.team import router as team_router
from app.routes.business_settings import router as business_settings_router
from app.dependencies import require_admin
from app.routes.super_admin import router as super_admin_router
from app.routes.audio import router as audio_router
from app.routes.modules import router as modules_router
from app.routes.notifications import router as notifications_router
from app.routes.super_admin_modules import (
    router as super_admin_modules_router,
)
from app.routes.custom_leads import (
    router as custom_leads_router,
)
from app.routes.web_push import router as web_push_router
from app.routes.follow_ups import router as follow_ups_router
from app.sales_scheduling.routes import router as sales_scheduling_router


import threading

from app.workers.reminder_worker import main as reminder_loop

app = FastAPI()


@app.on_event("startup")
def start_background_workers():
    on = {"1", "true", "yes", "on"}

    if os.getenv("RUN_REMINDER_WORKER", "true").strip().lower() in on:
        threading.Thread(
            target=reminder_loop,
            daemon=True,
            name="reminder-worker",
        ).start()

    if (
        os.getenv("META_ENABLED", "false").strip().lower() in on
        and os.getenv("RUN_META_WORKER", "true").strip().lower() in on
    ):
        from app.meta.worker import run_forever as meta_loop

        threading.Thread(
            target=meta_loop,
            daemon=True,
            name="meta-worker",
        ).start()

        
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://crm.tynato.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)
app.include_router(leads_router)
app.include_router(modules_router)
app.include_router(super_admin_modules_router)
app.include_router(leads_upload_router)
app.include_router(dashboard_router)
app.include_router(export_router)
app.include_router(search_history_router)
app.include_router(users_router)
app.include_router(lead_status_router)
app.include_router(team_router)
app.include_router(notifications_router)
app.include_router(super_admin_router)
app.include_router(audio_router)
app.include_router(invoice_router)
app.include_router(business_settings_router)
app.include_router(custom_leads_router)
app.include_router(web_push_router)
app.include_router(follow_ups_router)
app.include_router(sales_scheduling_router)


@app.get("/")
def root():
    return {"message": "Tynato CRM API Running"}


@app.get("/db-test")
def db_test(current_user=Depends(require_admin)):
    with engine.connect() as conn:
        result = conn.execute(text("SELECT NOW()"))
        return {
            "status": "connected",
            "time": str(result.scalar()),
        }


if os.getenv(
    "META_ENABLED",
    "false",
).strip().lower() in {"1", "true", "yes", "on"}:
    from app.meta.routes import router as meta_router
    from app.meta.webhooks import (
        router as meta_webhook_router,
    )

    app.include_router(meta_router)
    app.include_router(meta_webhook_router)
