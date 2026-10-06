import argparse
import logging
import time

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.meta.config import META_WORKER_POLL_SECONDS, validate_runtime_config
from app.meta.service import claim_next_job, complete_job, execute_claimed_job, fail_job


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


if __name__ == "__main__":
    main()
