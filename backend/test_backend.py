import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asyncio
from backend.app.core.database import engine, Base, SessionLocal
from backend.app.services.sync_service import SyncService
from backend.app.models.terminal import Terminal, BillingCycle, DailyUsage

async def test():
    print("Testing DB initialization...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        service = SyncService(db)
        print("Testing sync/seed...")
        log = await service.run_sync()
        print(f"Sync Log: status={log.status}, terminals={log.terminals_count}, msg={log.message}")
        
        terminals = db.query(Terminal).all()
        print(f"Total terminals in DB: {len(terminals)}")
        assert len(terminals) > 0, "No terminals found!"
        
        t = terminals[0]
        print(f"Sample terminal: id={t.id}, nickname={t.nickname}, line={t.service_line_number}, online={t.is_online}")
        
        cycles = db.query(BillingCycle).all()
        print(f"Total billing cycles: {len(cycles)}")
        
        usages = db.query(DailyUsage).all()
        print(f"Total daily usage records: {len(usages)}")
        print("All backend checks PASSED!")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test())
