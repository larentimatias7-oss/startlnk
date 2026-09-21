import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from backend.app.main import app

def test_routes():
    with TestClient(app) as client:
        # 1. Health
        r = client.get("/api/health")
        print("Health status:", r.status_code, r.json())
        assert r.status_code == 200

        # 2. Overview
        r = client.get("/api/terminals/overview")
        print("Overview status:", r.status_code)
        data = r.json()
        assert r.status_code == 200
        assert "kpis" in data
        assert "fleet_daily_trend" in data
        assert "terminals" in data
        print("Fleet KPIs:", data["kpis"])
        print(f"Total terminals in overview: {len(data['terminals'])}")
        print(f"Days in fleet trend: {len(data['fleet_daily_trend'])}")

        # 3. Terminal detail
        first_id = data["terminals"][0]["device_id"]
        r = client.get(f"/api/terminals/{first_id}")
        print("Terminal detail status:", r.status_code)
        assert r.status_code == 200
        detail = r.json()
        print(f"Detail for {first_id}: nickname={detail.get('nickname')}, cycle={detail.get('billing_cycle') is not None}")

        # 4. Usage history
        r = client.get(f"/api/terminals/{first_id}/usage-history")
        print("Usage history status:", r.status_code)
        assert r.status_code == 200
        hist = r.json()
        print(f"Usage history items: {len(hist.get('daily_usages', []))}, total_consumed={hist.get('total_consumed_gb')}")

        # 5. Actions: reboot
        r = client.post(f"/api/terminals/{first_id}/reboot")
        print("Reboot status:", r.status_code, r.json())
        assert r.status_code == 200

        # 6. Actions: opt-in
        sl = data["terminals"][0]["service_line_number"]
        r = client.post(f"/api/terminals/{sl}/opt-in?enabled=true")
        print("Opt-in status:", r.status_code, r.json())
        assert r.status_code == 200

        print("\nAll FastAPI endpoints tested successfully!")

if __name__ == "__main__":
    test_routes()
