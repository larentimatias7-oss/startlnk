from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

# For SQLite, check_same_thread needs to be False
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def apply_migrations():
    """Applies non-destructive schema additions for existing SQLite database files."""
    # Ensure all tables are created first
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        # 1. Terminals alerts_enabled
        try:
            conn.execute(text("ALTER TABLE terminals ADD COLUMN alerts_enabled BOOLEAN DEFAULT 1"))
            conn.commit()
        except Exception:
            pass

        # 2. AlertConfig sync_interval_minutes
        try:
            conn.execute(text("ALTER TABLE alert_configs ADD COLUMN sync_interval_minutes INTEGER DEFAULT 15"))
            conn.commit()
        except Exception:
            pass

        # 3. TelegramChannel bot_id
        try:
            conn.execute(text("ALTER TABLE telegram_channels ADD COLUMN bot_id INTEGER REFERENCES telegram_bots(id)"))
            conn.commit()
        except Exception:
            pass

    # 4. Ensure persistent Telegram bot and channels are seeded
    try:
        from backend.app.services.telegram_persistence import seed_telegram_defaults
        db = SessionLocal()
        seed_telegram_defaults(db)
        db.close()
    except Exception:
        pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
