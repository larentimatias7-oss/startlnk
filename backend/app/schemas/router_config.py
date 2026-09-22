from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class LiveTelemetryResponse(BaseModel):
    device_id: str
    is_online: bool = True
    downlink_mbps: float = 0.0
    uplink_mbps: float = 0.0
    ping_ms: float = 0.0
    signal_quality: float = 100.0
    obstruction_percent: float = 0.0
    uptime_seconds: int = 0
    wifi_bypassed: bool = False
    router_id: Optional[str] = None
    config_id: Optional[str] = None
    has_public_ip: bool = False

class WifiSettingsResponse(BaseModel):
    device_id: str
    router_id: Optional[str] = None
    config_id: Optional[str] = None
    nickname: Optional[str] = None
    ssid: str = ""
    password: str = ""
    bypass_mode: bool = False
    can_edit: bool = False
    raw_config: Optional[Dict[str, Any]] = None

class WifiSettingsUpdateRequest(BaseModel):
    ssid: str = Field(..., min_length=1, max_length=64, description="SSID de la red Wi-Fi de Starlink")
    password: str = Field(..., min_length=8, max_length=64, description="Clave WPA2/WPA3 de la red Wi-Fi")

class BypassModeRequest(BaseModel):
    enabled: bool = Field(..., description="True para activar Bypass mode, False para desactivar")
