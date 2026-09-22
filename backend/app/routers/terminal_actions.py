import json
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.terminal import Terminal
from backend.app.schemas.terminal import ActionResponse
from backend.app.schemas.router_config import (
    LiveTelemetryResponse,
    WifiSettingsResponse,
    WifiSettingsUpdateRequest,
    BypassModeRequest
)
from backend.app.services.echo_client import echo_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/terminals", tags=["terminal-actions"])

def _find_terminal(device_id: str, db: Session) -> Terminal:
    t = db.query(Terminal).filter(
        (Terminal.id == device_id) |
        (Terminal.device_id == device_id) |
        (Terminal.raw_device_id == device_id.removeprefix("ut"))
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Terminal Starlink no encontrado")
    return t

@router.get("/{device_id}/live-telemetry", response_model=LiveTelemetryResponse)
async def get_live_telemetry(device_id: str, db: Session = Depends(get_db)):
    """Fetch real-time telemetry directly from Starlink antenna & router"""
    t = _find_terminal(device_id, db)
    clean_id = t.raw_device_id or t.device_id.removeprefix("ut")

    if echo_client.has_credentials:
        try:
            telemetry = await echo_client.get_user_terminal_telemetry(clean_id)
            if telemetry:
                dl_val = float(telemetry.get("ut_DownlinkThroughput") or 0.0)
                ul_val = float(telemetry.get("ut_UplinkThroughput") or 0.0)
                
                # Conversion if in raw bps (> 100,000)
                downlink = round(dl_val / 1_000_000.0, 2) if dl_val > 100_000 else round(dl_val, 2)
                uplink = round(ul_val / 1_000_000.0, 2) if ul_val > 100_000 else round(ul_val, 2)
                ping = float(telemetry.get("ut_PingLatencyMsAvg") or telemetry.get("r_InternetPingLatencyMs") or t.ping_ms or 0.0)
                signal = float(telemetry.get("ut_SignalQuality") or 100.0)
                obstruction = float(telemetry.get("ut_ObstructionPercentTime") or 0.0)
                uptime = int(telemetry.get("ut_Uptime") or 0)
                wifi_bypassed = bool(telemetry.get("r_WifiIsBypassed"))
                router_id = telemetry.get("ri_routerId") or t.router_id
                config_id = telemetry.get("ri_configId")

                # Update DB record with live metrics
                t.downlink_mbps = downlink
                t.uplink_mbps = uplink
                t.ping_ms = round(ping, 1)
                t.signal_quality = round(signal, 1)
                t.obstruction_percent = round(obstruction, 2)
                t.uptime_seconds = uptime
                t.wifi_bypassed = wifi_bypassed
                if router_id:
                    t.router_id = router_id
                db.commit()

                return LiveTelemetryResponse(
                    device_id=t.device_id,
                    is_online=t.is_online,
                    downlink_mbps=downlink,
                    uplink_mbps=uplink,
                    ping_ms=round(ping, 1),
                    signal_quality=round(signal, 1),
                    obstruction_percent=round(obstruction, 2),
                    uptime_seconds=uptime,
                    wifi_bypassed=wifi_bypassed,
                    router_id=router_id,
                    config_id=config_id,
                    has_public_ip=t.has_public_ip
                )
        except Exception as e:
            logger.error(f"Error fetching live telemetry for {device_id}: {e}")

    # Fallback to local DB record
    return LiveTelemetryResponse(
        device_id=t.device_id,
        is_online=t.is_online,
        downlink_mbps=t.downlink_mbps,
        uplink_mbps=t.uplink_mbps,
        ping_ms=t.ping_ms,
        signal_quality=t.signal_quality,
        obstruction_percent=t.obstruction_percent,
        uptime_seconds=t.uptime_seconds,
        wifi_bypassed=t.wifi_bypassed,
        router_id=t.router_id,
        has_public_ip=t.has_public_ip
    )

@router.get("/{device_id}/wifi-settings", response_model=WifiSettingsResponse)
async def get_wifi_settings(device_id: str, db: Session = Depends(get_db)):
    """Fetch current Wi-Fi configuration (SSID, Password, Bypass state) from Starlink router"""
    t = _find_terminal(device_id, db)
    clean_id = t.raw_device_id or t.device_id.removeprefix("ut")

    if not echo_client.has_credentials:
        return WifiSettingsResponse(
            device_id=t.device_id,
            nickname=t.nickname,
            ssid=f"STARLINK-{clean_id[-4:].upper()}",
            password="••••••••••••",
            bypass_mode=t.wifi_bypassed,
            can_edit=False
        )

    try:
        telemetry = await echo_client.get_user_terminal_telemetry(clean_id)
        if not telemetry:
            raise HTTPException(status_code=502, detail="No se pudo obtener la telemetría del router Starlink")

        router_id = telemetry.get("ri_routerId") or t.router_id
        config_id = telemetry.get("ri_configId")
        wifi_bypassed = bool(telemetry.get("r_WifiIsBypassed"))

        if not config_id:
            return WifiSettingsResponse(
                device_id=t.device_id,
                router_id=router_id,
                nickname=t.nickname,
                ssid="",
                password="",
                bypass_mode=wifi_bypassed,
                can_edit=False
            )

        res = await echo_client.get_router_config(
            config_id=config_id,
            device_id=clean_id,
            service_line_number=t.service_line_number
        )

        content = (res.get("data") or {}).get("content") or {}
        raw_json_str = content.get("routerConfigJson") or "{}"
        cfg_obj = json.loads(raw_json_str) if isinstance(raw_json_str, str) else raw_json_str

        # Extract SSID and password from networks
        ssid = ""
        password = ""
        networks = cfg_obj.get("networks") or []
        if networks and isinstance(networks, list):
            bss_list = networks[0].get("basicServiceSets") or []
            if bss_list:
                first_bss = bss_list[0]
                ssid = first_bss.get("ssid") or ""
                auth = first_bss.get("authWpa2") or {}
                password = auth.get("password") or ""

        return WifiSettingsResponse(
            device_id=t.device_id,
            router_id=router_id,
            config_id=config_id,
            nickname=content.get("nickname") or t.nickname,
            ssid=ssid,
            password=password,
            bypass_mode=bool(cfg_obj.get("bypassMode", wifi_bypassed)),
            can_edit=bool(router_id and config_id),
            raw_config=cfg_obj
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching Wi-Fi settings for {device_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al consultar configuración Wi-Fi: {str(e)}")

@router.post("/{device_id}/wifi-settings", response_model=ActionResponse)
async def update_wifi_settings(
    device_id: str,
    payload: WifiSettingsUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update Wi-Fi SSID and Password on Starlink Router"""
    t = _find_terminal(device_id, db)
    clean_id = t.raw_device_id or t.device_id.removeprefix("ut")

    if not echo_client.has_credentials:
        return ActionResponse(
            success=True,
            message=f"[Modo Demo] Configuración Wi-Fi guardada. SSID: '{payload.ssid}'",
            action="update_wifi",
            target=t.device_id
        )

    try:
        telemetry = await echo_client.get_user_terminal_telemetry(clean_id)
        if not telemetry:
            raise HTTPException(status_code=502, detail="No se pudo contactar al terminal Starlink")

        router_id = telemetry.get("ri_routerId") or t.router_id
        config_id = telemetry.get("ri_configId")

        if not router_id:
            raise HTTPException(status_code=400, detail="Este terminal no tiene un router Starlink gestionable asociado")

        # Fetch current router config
        cfg_obj: Dict[str, Any] = {}
        if config_id:
            res = await echo_client.get_router_config(
                config_id=config_id,
                device_id=clean_id,
                service_line_number=t.service_line_number
            )
            content = (res.get("data") or {}).get("content") or {}
            raw_json_str = content.get("routerConfigJson") or "{}"
            cfg_obj = json.loads(raw_json_str) if isinstance(raw_json_str, str) else raw_json_str

        # Ensure base structure
        cfg_obj["applyNetworks"] = True
        if "networks" not in cfg_obj or not isinstance(cfg_obj["networks"], list) or not cfg_obj["networks"]:
            cfg_obj["networks"] = [{"basicServiceSets": []}]

        bands = ["RF_2GHZ", "RF_5GHZ"]
        bss_list = [
            {"band": b, "ssid": payload.ssid, "authWpa2": {"password": payload.password}}
            for b in bands
        ]
        cfg_obj["networks"][0]["basicServiceSets"] = bss_list

        nickname = f"ECHO - {t.nickname or router_id}"[:99]
        
        # Save via create-and-assign or update
        res_save = await echo_client.create_and_assign_router_config(
            router_id=router_id,
            router_config_json=cfg_obj,
            nickname=nickname,
            allow_reassign=True
        )

        return ActionResponse(
            success=True,
            message=f"Configuración Wi-Fi actualizada exitosamente para '{t.nickname or t.device_id}'. SSID: '{payload.ssid}'",
            action="update_wifi",
            target=t.device_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating Wi-Fi settings for {device_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Fallo al actualizar Wi-Fi en Starlink: {str(e)}")

@router.post("/{device_id}/bypass-mode", response_model=ActionResponse)
async def set_bypass_mode(
    device_id: str,
    payload: BypassModeRequest,
    db: Session = Depends(get_db)
):
    """Enable or disable Bypass (Bridge) mode on Starlink Router"""
    t = _find_terminal(device_id, db)
    clean_id = t.raw_device_id or t.device_id.removeprefix("ut")

    if not echo_client.has_credentials:
        t.wifi_bypassed = payload.enabled
        db.commit()
        return ActionResponse(
            success=True,
            message=f"[Modo Demo] Modo Bypass {'habilitado' if payload.enabled else 'deshabilitado'} para '{t.nickname or t.device_id}'",
            action="bypass_mode",
            target=t.device_id
        )

    try:
        telemetry = await echo_client.get_user_terminal_telemetry(clean_id)
        if not telemetry:
            raise HTTPException(status_code=502, detail="No se pudo contactar al terminal Starlink")

        router_id = telemetry.get("ri_routerId") or t.router_id
        config_id = telemetry.get("ri_configId")

        if not router_id:
            raise HTTPException(status_code=400, detail="Este terminal no tiene un router Starlink asociado")

        cfg_obj: Dict[str, Any] = {}
        if config_id:
            res = await echo_client.get_router_config(
                config_id=config_id,
                device_id=clean_id,
                service_line_number=t.service_line_number
            )
            content = (res.get("data") or {}).get("content") or {}
            raw_json_str = content.get("routerConfigJson") or "{}"
            cfg_obj = json.loads(raw_json_str) if isinstance(raw_json_str, str) else raw_json_str

        cfg_obj["applyBypassMode"] = True
        cfg_obj["bypassMode"] = bool(payload.enabled)
        cfg_obj["setupComplete"] = True
        cfg_obj["applySetupComplete"] = True

        nickname = f"ECHO - {t.nickname or router_id}"[:99]

        res_save = await echo_client.create_and_assign_router_config(
            router_id=router_id,
            router_config_json=cfg_obj,
            nickname=nickname,
            allow_reassign=True
        )

        # Update local DB state
        t.wifi_bypassed = payload.enabled
        db.commit()

        status_text = "habilitado" if payload.enabled else "deshabilitado"
        return ActionResponse(
            success=True,
            message=f"Modo Bypass {status_text} exitosamente en Starlink para '{t.nickname or t.device_id}'",
            action="bypass_mode",
            target=t.device_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing bypass mode for {device_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Fallo al modificar modo bypass: {str(e)}")
