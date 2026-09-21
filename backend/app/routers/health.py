from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from backend.app.core.database import get_db
from backend.app.core.config import settings
from backend.app.models.terminal import SyncLog
from backend.app.services.echo_client import echo_client
from backend.app.services.scheduler import scheduler

router = APIRouter(tags=["health"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False

    last_log = db.query(SyncLog).order_by(SyncLog.timestamp.desc()).first()

    return {
        "status": "online" if db_ok else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "database_connected": db_ok,
        "echo_credentials_configured": echo_client.has_credentials,
        "scheduler_running": scheduler.running if scheduler else False,
        "last_sync": {
            "timestamp": last_log.timestamp.isoformat() if last_log else None,
            "status": last_log.status if last_log else "NO_SYNC",
            "terminals": last_log.terminals_count if last_log else 0,
            "message": last_log.message if last_log else None
        }
    }

@router.get("/sync-logs")
def get_sync_logs(db: Session = Depends(get_db)):
    logs = db.query(SyncLog).order_by(SyncLog.timestamp.desc()).limit(20).all()
    return logs
