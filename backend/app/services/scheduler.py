import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.services.sync_service import SyncService

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def scheduled_sync_job():
    logger.info("Executing scheduled TSM ECHO sync job...")
    db = SessionLocal()
    try:
        service = SyncService(db)
        await service.run_sync()
    except Exception as e:
        logger.error(f"Error during scheduled sync: {e}")
    finally:
        db.close()

def start_scheduler():
    if not settings.ENABLE_SCHEDULER:
        logger.info("Background scheduler is disabled by config.")
        return

    # Check if DB has custom sync_interval_minutes
    interval = settings.SYNC_INTERVAL_MINUTES
    try:
        from backend.app.models.terminal import AlertConfig
        db = SessionLocal()
        cfg = db.query(AlertConfig).first()
        if cfg and cfg.sync_interval_minutes and cfg.sync_interval_minutes > 0:
            interval = cfg.sync_interval_minutes
        db.close()
    except Exception:
        pass

    interval = max(1, interval)
    scheduler.add_job(
        scheduled_sync_job,
        "interval",
        minutes=interval,
        id="echo_sync_job",
        replace_existing=True
    )
    scheduler.start()
    logger.info(f"APScheduler started: ECHO sync running every {interval} minutes.")

def reschedule_sync_job(minutes: int):
    """Reschedules the sync job interval dynamically at runtime."""
    if not scheduler.running:
        logger.warning("Cannot reschedule: APScheduler is not running.")
        return False

    interval = max(1, minutes)
    try:
        scheduler.reschedule_job(
            "echo_sync_job",
            trigger="interval",
            minutes=interval
        )
        logger.info(f"APScheduler rescheduled: ECHO sync running every {interval} minutes.")
        return True
    except Exception as e:
        logger.error(f"Failed to reschedule ECHO sync job: {e}")
        return False

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler shutdown completed.")
