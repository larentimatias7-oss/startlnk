import httpx
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

import html

def _esc(val: Any) -> str:
    if val is None:
        return ""
    return html.escape(str(val), quote=False)

class TelegramService:
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def send_message(
        self,
        bot_token: str,
        chat_id: str,
        text_html: str
    ) -> Dict[str, Any]:
        """Send an HTML-formatted message to a Telegram chat/channel via Bot API."""
        if not bot_token or not chat_id:
            return {"success": False, "error": "Bot token o Chat ID vacío"}

        url = f"https://api.telegram.org/bot{bot_token.strip()}/sendMessage"
        payload = {
            "chat_id": chat_id.strip(),
            "text": text_html,
            "parse_mode": "HTML",
            "disable_web_page_preview": True
        }

        try:
            client = await self.get_client()
            resp = await client.post(url, json=payload)
            data = resp.json()

            if resp.status_code == 200 and data.get("ok"):
                return {
                    "success": True,
                    "message_id": data.get("result", {}).get("message_id")
                }
            else:
                err_desc = data.get("description", f"HTTP {resp.status_code}")
                logger.warning(f"Error Telegram Bot API ({chat_id}): {err_desc}")
                return {"success": False, "error": err_desc}
        except Exception as e:
            logger.error(f"Excepción al enviar mensaje a Telegram ({chat_id}): {str(e)}")
            return {"success": False, "error": str(e)}

    async def verify_bot_token(self, bot_token: str) -> Dict[str, Any]:
        """Verify if a Telegram Bot token is valid using Telegram's getMe API."""
        if not bot_token or not bot_token.strip():
            return {"success": False, "error": "Bot token vacío"}

        url = f"https://api.telegram.org/bot{bot_token.strip()}/getMe"
        try:
            client = await self.get_client()
            resp = await client.get(url)
            data = resp.json()

            if resp.status_code == 200 and data.get("ok"):
                result = data.get("result", {})
                return {
                    "success": True,
                    "bot_id": result.get("id"),
                    "bot_name": result.get("first_name"),
                    "bot_username": result.get("username"),
                    "can_join_groups": result.get("can_join_groups", True)
                }
            else:
                err_desc = data.get("description", f"HTTP {resp.status_code}")
                return {"success": False, "error": err_desc}
        except Exception as e:
            logger.error(f"Excepción al verificar bot token con Telegram: {str(e)}")
            return {"success": False, "error": str(e)}

    def format_quota_alert(
        self,
        nickname: str,
        service_line_number: str,
        account_name: str,
        consumed_gb: float,
        total_gb: float,
        percent: float,
        days_remaining: Optional[int],
        downlink: float,
        uplink: float,
        ping: float,
        severity: str = "WARNING"
    ) -> str:
        """Format an alert when consumption crosses fixed thresholds (e.g. 80% or 100%)."""
        is_critical = percent >= 100
        icon = "🛑" if is_critical else "⚠️"
        level_title = "CUOTA EXCEDIDA (100% ALCANZADO)" if is_critical else f"UMBRAL DE CUOTA ALCANZADO ({percent:.1f}%)"

        days_text = f"{days_remaining} días" if days_remaining is not None else "No disponible"
        
        return (
            f"{icon} <b>ALERTA STARLINK: {level_title}</b> {icon}\n\n"
            f"📍 <b>Enlace:</b> {_esc(nickname)}\n"
            f"📄 <b>Línea de Servicio:</b> <code>{_esc(service_line_number)}</code>\n"
            f"🏢 <b>Cuenta / Proyecto:</b> {_esc(account_name)}\n\n"
            f"📊 <b>Consumo de Cuota:</b> {consumed_gb:.1f} GB / {total_gb:.0f} GB (<b>{percent:.1f}%</b>)\n"
            f"⏳ <b>Días Restantes de Ciclo:</b> {days_text}\n"
            f"📶 <b>Throughput Actual:</b> ↓ {downlink:.1f} / ↑ {uplink:.1f} Mbps | Ping: {ping:.0f} ms\n\n"
            f"🔗 <a href=\"http://starlink.milicic.local\">Abrir Starlink Fleet Monitor</a>"
        )

    def format_burn_rate_alert(
        self,
        nickname: str,
        service_line_number: str,
        account_name: str,
        consumed_gb: float,
        total_gb: float,
        percent: float,
        days_remaining: int,
        daily_burn_rate: float,
        projected_exhaustion_days: Optional[float]
    ) -> str:
        """Format an early warning alert when consumption rate will exhaust quota early."""
        exhaust_text = (
            f"en ~{projected_exhaustion_days:.0f} días (antes del corte)"
            if projected_exhaustion_days is not None
            else "Antes de fin de ciclo"
        )

        return (
            f"⚡ <b>ALERTA PREVENTIVA: RITMO ACELERADO (BURN-RATE)</b> ⚡\n\n"
            f"📍 <b>Enlace:</b> {_esc(nickname)}\n"
            f"📄 <b>Línea de Servicio:</b> <code>{_esc(service_line_number)}</code>\n"
            f"🏢 <b>Cuenta / Proyecto:</b> {_esc(account_name)}\n\n"
            f"📈 <b>Consumo Temprano:</b> {consumed_gb:.1f} GB / {total_gb:.0f} GB (<b>{percent:.1f}%</b>)\n"
            f"⏳ <b>Días Restantes en Ciclo:</b> {days_remaining} días\n"
            f"🔥 <b>Ritmo Diario Estimado:</b> ~{daily_burn_rate:.1f} GB/día\n"
            f"⏱️ <b>Agotamiento Estimado:</b> {exhaust_text}\n\n"
            f"💡 <i>Recomendación: Supervisar tráfico o programar activación de Data Opt-In.</i>\n\n"
            f"🔗 <a href=\"http://starlink.milicic.local\">Abrir Starlink Fleet Monitor</a>"
        )

    def format_offline_alert(
        self,
        nickname: str,
        service_line_number: str,
        account_name: str,
        ping: float
    ) -> str:
        """Format an alert when a terminal falls offline."""
        return (
            f"🔴 <b>ALERTA DE DESCONEXIÓN: ENLACE OFFLINE</b> 🔴\n\n"
            f"📍 <b>Enlace:</b> {_esc(nickname)}\n"
            f"📄 <b>Línea de Servicio:</b> <code>{_esc(service_line_number)}</code>\n"
            f"🏢 <b>Cuenta / Proyecto:</b> {_esc(account_name)}\n\n"
            f"⚠️ <b>Estado:</b> Antena fuera de línea o sin enlace satelital activo.\n\n"
            f"🔗 <a href=\"http://starlink.milicic.local\">Abrir Starlink Fleet Monitor</a>"
        )

    def format_test_message(self, channel_name: str) -> str:
        """Format a verification test message for a Telegram channel."""
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        return (
            f"🛰️ <b>MILICIC FLEET MONITOR - MENSAJE DE PRUEBA</b> 🛰️\n\n"
            f"✅ <b>Canal verificado:</b> {_esc(channel_name)}\n"
            f"📡 <b>Estado de conexión:</b> Conexión exitosa con Telegram Bot API.\n"
            f"🕒 <b>Fecha/Hora:</b> {now_str}\n\n"
            f"Este canal está listo para recibir alertas operativas y preventivas de consumo de la flota Starlink."
        )

telegram_service = TelegramService()
