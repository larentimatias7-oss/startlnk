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

    interval = max(1, settings.SYNC_INTERVAL_MINUTES)
    scheduler.add_job(
        scheduled_sync_job,
        "interval",
        minutes=interval,
        id="echo_sync_job",
        replace_existing=True
    )
    scheduler.start()
    logger.info(f"APScheduler started: ECHO sync running every {interval} minutes.")

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler shutdown completed.")
