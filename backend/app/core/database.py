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
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE terminals ADD COLUMN alerts_enabled BOOLEAN DEFAULT 1"))
            conn.commit()
        except Exception:
            pass # Column already exists or table not created yet

apply_migrations()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
