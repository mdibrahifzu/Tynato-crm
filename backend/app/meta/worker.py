import argparse
import logging
import os
import time
 
from sqlalchemy import text
from sqlalchemy.orm import Session
 
from app.database import SessionLocal
from app.meta.lead_backfill import reconcile_all
from app.meta.config import META_WORKER_POLL_SECONDS, validate_runtime_config
from app.meta.service import (
    claim_next_job,
    complete_job,
    enqueue_campaign_sync,
    enqueue_meta_forms_sync,
    enqueue_meta_insights_sync,
    execute_claimed_job,
    fail_job,
)
 
 
logger = logging.getLogger("tynato.meta.worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
 
 
def process_once() -> bool:
    db: Session = SessionLocal()
    try:
        job = claim_next_job(db)
        if not job:
            return False
 
        logger.info(
            "Processing Meta job %s type=%s team=%s attempt=%s",
            job["id"],
            job["job_type"],
            job["team_id"],
            job["attempts"],
        )
        try:
            result = execute_claimed_job(db, job)
            db.commit()
            complete_job(db, job["id"])
            logger.info("Completed Meta job %s result=%s", job["id"], result)
        except Exception as exc:
            db.rollback()
            fail_job(db, job, exc)
            logger.exception("Meta job %s failed: %s", job["id"], exc)
        return True
    finally:
        db.close()
 
 
def main() -> None:
    parser = argparse.ArgumentParser(description="Tynato Meta background worker")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Process at most one ready job and exit",
    )
    args = parser.parse_args()
 
    validate_runtime_config()
 
    if args.once:
        process_once()
        return
 
    logger.info("Tynato Meta worker started")
    while True:
        had_job = process_once()
        if not had_job:
            time.sleep(META_WORKER_POLL_SECONDS)
 
 
def _minutes(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default
 
 
def auto_enqueue_syncs(include_insights: bool, team_id=None) -> None:
    """Queue campaign, form and (optionally) insights syncs for every
    active connection. Duplicate pending jobs are skipped by the helpers."""
    db = SessionLocal()
    try:
        sql = (
            "SELECT id, team_id FROM public.meta_connections "
            "WHERE status = 'active'"
        )
        params = {}
        if team_id is not None:
            sql += " AND team_id = :team_id"
            params["team_id"] = team_id
 
        connections = db.execute(text(sql), params).mappings().all()
 
        for conn in connections:
            enqueue_campaign_sync(db, conn["id"], conn["team_id"])
 
            pages = db.execute(
                text(
                    "SELECT meta_page_id FROM public.meta_pages "
                    "WHERE connection_id = :connection_id "
                    "AND status = 'active'"
                ),
                {"connection_id": conn["id"]},
            ).scalars().all()
 
            for page_id in pages:
                enqueue_meta_forms_sync(
                    db, conn["id"], conn["team_id"], page_id
                )
 
            if include_insights:
                enqueue_meta_insights_sync(
                    db, conn["id"], conn["team_id"]
                )
    except Exception:
        db.rollback()
        logger.exception("Meta auto-sync scheduling failed")
    finally:
        db.close()
 
 
def run_forever() -> None:
    """Loop for running inside the API process (no CLI args)."""
    validate_runtime_config()
 
    sync_every = _minutes("META_AUTO_SYNC_MINUTES", 15) * 60
    insights_every = _minutes("META_AUTO_INSIGHTS_MINUTES", 60) * 60
    backfill_days = int(_minutes("META_BACKFILL_DAYS", 90))
    first_cycle = True
    last_sync = None
    last_insights = None
 
    logger.info("Tynato Meta worker started (in-process)")
 
    while True:
        had_job = False
        try:
            now = time.monotonic()
 
            if sync_every > 0 and (
                last_sync is None or now - last_sync >= sync_every
            ):
                include = insights_every > 0 and (
                    last_insights is None
                    or now - last_insights >= insights_every
                )
                auto_enqueue_syncs(include)
              
                reconcile_all(backfill_days if first_cycle else 7)
                first_cycle = False
                last_sync = now
                if include:
                    last_insights = now
 
            had_job = process_once()
        except Exception:
            logger.exception("Meta worker cycle failed")
 
        if not had_job:
            time.sleep(META_WORKER_POLL_SECONDS)
 
 
if __name__ == "__main__":
    main()
 