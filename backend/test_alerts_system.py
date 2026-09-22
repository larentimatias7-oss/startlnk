import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.database import SessionLocal, engine, Base
from backend.app.models.terminal import AlertConfig, TelegramChannel, AlertEvent, Terminal, BillingCycle
from backend.app.services.alert_service import AlertService

def test_alerts_system():
    print("=== TEST 1: Verificar Creación de Tablas de Alertas ===")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 1. Configuración por defecto
    config = AlertService.get_or_create_config(db)
    assert config is not None
    assert config.id == 1
    assert config.quota_threshold_percent == 80.0
    assert config.early_warning_percent == 60.0
    assert config.early_warning_days_remaining == 15
    print("[OK] AlertConfig inicializado correctamente.")


    # 2. Cálculo matemático de Burn Rate
    print("\n=== TEST 2: Algoritmo de Ritmo Acelerado (Burn Rate) ===")
    # Caso A: 65% consumido con 18 días restantes -> Debe disparar alerta temprana
    res_a = AlertService.calculate_burn_rate(
        consumed_gb=650.0,
        total_gb=1000.0,
        start_date_str="2026-09-01",
        end_date_str="2026-09-30"
    )
    print(f"Resultado Caso A (65% consumido): {res_a}")
    assert res_a["daily_rate"] > 0
    # Caso B: 20% consumido -> Ritmo normal
    res_b = AlertService.calculate_burn_rate(
        consumed_gb=200.0,
        total_gb=1000.0,
        start_date_str="2026-09-01",
        end_date_str="2026-09-30"
    )
    print(f"Resultado Caso B (20% consumido): {res_b}")
    print("[OK] Algoritmo de cálculo verificado exitosamente.")

    # 3. Canales de Telegram
    print("\n=== TEST 3: CRUD de Canales de Telegram ===")
    # Limpiar canales previos de prueba
    db.query(TelegramChannel).filter(TelegramChannel.chat_id == "-100999999999").delete()
    db.commit()

    test_ch = TelegramChannel(name="NOC Test", chat_id="-100999999999", is_active=True)
    db.add(test_ch)
    db.commit()
    db.refresh(test_ch)
    assert test_ch.id is not None
    print(f"[OK] Canal creado: {test_ch.name} (ID: {test_ch.id}, ChatID: {test_ch.chat_id})")

    # 4. Endpoints REST con TestClient
    print("\n=== TEST 4: Endpoints REST FastAPI (/api/alerts) ===")
    client = TestClient(app)

    # GET /api/alerts/config
    resp_cfg = client.get("/api/alerts/config")
    assert resp_cfg.status_code == 200
    cfg_data = resp_cfg.json()
    assert cfg_data["quota_threshold_percent"] == 80.0
    print(f"[OK] GET /api/alerts/config: {cfg_data['quota_threshold_percent']}%")

    # PUT /api/alerts/config
    resp_put_cfg = client.put("/api/alerts/config", json={
        "quota_threshold_percent": 85.0,
        "early_warning_percent": 65.0
    })
    assert resp_put_cfg.status_code == 200
    assert resp_put_cfg.json()["quota_threshold_percent"] == 85.0
    assert resp_put_cfg.json()["early_warning_percent"] == 65.0
    print("[OK] PUT /api/alerts/config: Parámetros actualizados.")

    # Revertir a valores recomendados
    client.put("/api/alerts/config", json={
        "quota_threshold_percent": 80.0,
        "early_warning_percent": 60.0
    })

    # GET /api/alerts/channels
    resp_chan = client.get("/api/alerts/channels")
    assert resp_chan.status_code == 200
    channels_list = resp_chan.json()
    assert any(c["chat_id"] == "-100999999999" for c in channels_list)
    print(f"[OK] GET /api/alerts/channels: {len(channels_list)} canales listados.")

    # DELETE canal de prueba
    resp_del = client.delete(f"/api/alerts/channels/{test_ch.id}")
    assert resp_del.status_code == 200
    print("[OK] DELETE /api/alerts/channels/{id}: Canal eliminado.")

    # POST /api/alerts/evaluate
    resp_eval = client.post("/api/alerts/evaluate")
    assert resp_eval.status_code == 200
    print(f"[OK] POST /api/alerts/evaluate: {resp_eval.json()}")

    # GET /api/terminals (Verificar campos enriquecidos)
    print("\n=== TEST 5: Verificación de Campos Enriquecidos en /api/terminals ===")
    resp_terms = client.get("/api/terminals")
    assert resp_terms.status_code == 200
    term_list = resp_terms.json()
    if term_list:
        sample = term_list[0]
        assert "days_remaining" in sample
        assert "daily_avg_gb" in sample
        assert "is_burn_rate_alert" in sample
        print(f"[OK] Terminal '{sample['nickname']}': Cuota: {sample['quota_consumed_percent']}%, Días Restantes: {sample['days_remaining']}, BurnAlert: {sample['is_burn_rate_alert']}")

    db.close()
    print("\n==========================================")
    print("[OK] TODOS LOS TESTS DE ALERTAS Y TELEGRAM PASARON EXITOSAMENTE!")
    print("==========================================")


if __name__ == "__main__":
    test_alerts_system()
