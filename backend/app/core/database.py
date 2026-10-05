from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

# Ensure SQLite directory exists if path is provided
if settings.DATABASE_URL.startswith("sqlite"):
    db_raw = settings.DATABASE_URL.replace("sqlite:////", "/").replace("sqlite:///", "")
    if db_raw and not db_raw.startswith(":memory:"):
        try:
            Path(db_raw).parent.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

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
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        pass

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

        # 4. Purge mock/demo data if present from earlier tests
        try:
            conn.execute(text("DELETE FROM daily_usages WHERE billing_cycle_id BETWEEN 4801 AND 4808"))
            conn.execute(text("DELETE FROM billing_cycles WHERE id BETWEEN 4801 AND 4808"))
            conn.execute(text("DELETE FROM terminals WHERE id LIKE 'ut01000000-%'"))
            conn.commit()
        except Exception:
            pass

        # 5. Set default cooldown_hours to 24 if previously set to 1 or 12
        try:
            conn.execute(text("UPDATE alert_configs SET cooldown_hours = 24 WHERE cooldown_hours IN (1, 12) OR cooldown_hours IS NULL"))
            conn.commit()
        except Exception:
            pass

        # 6. Terminal offline tracking columns
        for col_def in [
            "last_online_at TIMESTAMP",
            "offline_since TIMESTAMP",
            "offline_alert_sent BOOLEAN DEFAULT 0",
            "last_offline_alert_at TIMESTAMP"
        ]:
            try:
                conn.execute(text(f"ALTER TABLE terminals ADD COLUMN {col_def}"))
                conn.commit()
            except Exception:
                pass

        # 7. AlertConfig offline grace and recovery columns
        for col_def in [
            "offline_grace_minutes INTEGER DEFAULT 15",
            "alert_on_recovery BOOLEAN DEFAULT 1"
        ]:
            try:
                conn.execute(text(f"ALTER TABLE alert_configs ADD COLUMN {col_def}"))
                conn.commit()
            except Exception:
                pass

        # 8. Initialize offline_since and offline_alert_sent for existing offline terminals
        try:
            # If a terminal is already offline, set offline_since to updated_at or now,
            # and mark offline_alert_sent = 1 if it already received an alert recently to prevent boot-up spam
            conn.execute(text("""
                UPDATE terminals 
                SET offline_since = COALESCE(updated_at, CURRENT_TIMESTAMP),
                    offline_alert_sent = 1
                WHERE is_online = 0 AND offline_since IS NULL
            """))
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
