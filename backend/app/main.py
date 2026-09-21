import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.core.database import engine, Base, SessionLocal
from backend.app.routers import terminals, health
from backend.app.services.scheduler import start_scheduler, shutdown_scheduler
from backend.app.services.sync_service import SyncService
from backend.app.services.echo_client import echo_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("starlink_app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing TSM Starlink Dashboard Database...")
    Base.metadata.create_all(bind=engine)
    
    # Run initial sync on startup
    logger.info("Running startup synchronization...")
    db = SessionLocal()
    try:
        service = SyncService(db)
        await service.run_sync()
    except Exception as e:
        logger.error(f"Startup sync failed: {e}")
    finally:
        db.close()

    # Start background scheduler
    start_scheduler()
    yield

    # Shutdown
    shutdown_scheduler()
    await echo_client.close()
    logger.info("Application shutdown completed.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(terminals.router, prefix=settings.API_V1_PREFIX)

@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "api": f"{settings.API_V1_PREFIX}/terminals"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
