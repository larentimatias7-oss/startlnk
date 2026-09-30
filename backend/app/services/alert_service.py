import logging
from datetime import datetime, date, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.models.terminal import Terminal, BillingCycle, AlertConfig, TelegramChannel, AlertEvent
from backend.app.services.telegram_service import telegram_service

logger = logging.getLogger(__name__)

class AlertService:
    @staticmethod
    def get_or_create_config(db: Session) -> AlertConfig:
        config = db.query(AlertConfig).filter(AlertConfig.id == 1).first()
        if not config:
            config = AlertConfig(
                id=1,
                telegram_bot_token=None,
                quota_threshold_percent=80.0,
                quota_critical_percent=100.0,
                early_warning_percent=60.0,
                early_warning_days_remaining=15,
                alert_on_offline=False,
                cooldown_hours=24,
                sync_interval_minutes=15,
                is_enabled=True
            )
            db.add(config)
            db.commit()
            db.refresh(config)
        return config

    @staticmethod
    def parse_cycle_dates(start_date_str: Optional[str], end_date_str: Optional[str]) -> Tuple[int, int]:
        """Parses cycle start/end dates. Returns: (days_elapsed, days_remaining)"""
        now = datetime.now(timezone.utc)
        today = now.date()

        def _fallback():
            import calendar
            _, last_day = calendar.monthrange(today.year, today.month)
            return max(1, today.day), max(0, last_day - today.day)

        if not start_date_str or not end_date_str:
            return _fallback()

        try:
            if "T" in end_date_str:
                e_dt = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
                days_remaining = max(0, int((e_dt - now).total_seconds() // 86400))
            else:
                days_remaining = max(0, (datetime.strptime(end_date_str[:10], "%Y-%m-%d").date() - today).days)

            if "T" in start_date_str:
                s_dt = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))
                days_elapsed = max(1, int((now - s_dt).total_seconds() // 86400) + 1)
            else:
                days_elapsed = max(1, (today - datetime.strptime(start_date_str[:10], "%Y-%m-%d").date()).days + 1)

            return days_elapsed, days_remaining
        except Exception:
            return _fallback()

    @staticmethod
    def calculate_burn_rate(
        consumed_gb: float,
        total_gb: float,
        start_date_str: Optional[str],
        end_date_str: Optional[str]
    ) -> Dict[str, Any]:
        """Calculates burn rate metrics and projected quota exhaustion."""
        days_elapsed, days_remaining = AlertService.parse_cycle_dates(start_date_str, end_date_str)
        daily_rate = consumed_gb / days_elapsed if days_elapsed > 0 else consumed_gb
        remaining_gb = max(0.0, total_gb - consumed_gb)
        projected_days = (remaining_gb / daily_rate) if daily_rate > 0 else 999.0

        return {
            "days_elapsed": days_elapsed,
            "days_remaining": days_remaining,
            "daily_rate": round(daily_rate, 2),
            "remaining_gb": round(remaining_gb, 2),
            "projected_exhaustion_days": round(projected_days, 1),
            "will_exhaust_early": projected_days < days_remaining
        }

    @staticmethod
    def is_in_cooldown(
        db: Session,
        terminal_id: str,
        alert_type: str,
        cooldown_hours: int
    ) -> bool:
        """Returns True if an alert of this type was already sent for this terminal within cooldown."""
        cutoff = datetime.utcnow() - timedelta(hours=cooldown_hours)
        query = (
            db.query(AlertEvent)
            .filter(
                AlertEvent.terminal_id == terminal_id,
                AlertEvent.timestamp >= cutoff,
                AlertEvent.status == "SENT"
            )
        )
        if alert_type == "QUOTA_THRESHOLD":
            query = query.filter(AlertEvent.alert_type.in_(["QUOTA_THRESHOLD", "QUOTA_CRITICAL"]))
        else:
            query = query.filter(AlertEvent.alert_type == alert_type)

        recent_alert = query.first()
        return recent_alert is not None

    async def evaluate_and_dispatch(self, db: Session) -> Dict[str, Any]:
        """Evaluates all terminals and dispatches notifications to active Telegram channels."""
        config = self.get_or_create_config(db)
        if not config.is_enabled:
            return {"status": "SKIPPED", "message": "Alertas deshabilitadas globalmente"}

        channels = db.query(TelegramChannel).filter(TelegramChannel.is_active == True).all()
        if not channels:
            logger.info("Alert evaluation: No active telegram channels configured.")
            return {"status": "SKIPPED", "message": "No hay canales de Telegram activos"}

        from backend.app.models.terminal import TelegramBot
        active_bots = db.query(TelegramBot).filter(TelegramBot.is_active == True).all()
        fallback_token = config.telegram_bot_token

        if not active_bots and not fallback_token:
            logger.info("Alert evaluation: No active telegram bots or token configured.")
            return {"status": "SKIPPED", "message": "No hay Bots de Telegram activos o token configurado"}

        terminals = db.query(Terminal).all()
        alerts_generated = 0
        alerts_sent = 0

        # Pre-fetch active billing cycles to eliminate N+1 queries
        active_cycles = {
            c.service_line_number: c
            for c in db.query(BillingCycle).filter(BillingCycle.is_active == True).order_by(BillingCycle.id.asc()).all()
        }

        for t in terminals:
            # Skip evaluation if alerts are silenced for this specific terminal
            if hasattr(t, "alerts_enabled") and t.alerts_enabled is False:
                continue

            cycle = active_cycles.get(t.service_line_number)
            has_active_cycle = cycle is not None and cycle.is_active and (cycle.total_amount_gb or 0) > 0

            consumed_gb = cycle.consumed_amount_gb if has_active_cycle else 0.0
            total_gb = cycle.total_amount_gb if has_active_cycle else 0.0
            percent = (consumed_gb / total_gb * 100.0) if total_gb > 0 else 0.0

            burn_metrics = self.calculate_burn_rate(
                consumed_gb, total_gb,
                cycle.start_date if has_active_cycle else None,
                cycle.end_date if has_active_cycle else None
            )
            days_remaining = burn_metrics["days_remaining"]
            daily_rate = burn_metrics["daily_rate"]
            projected_days = burn_metrics["projected_exhaustion_days"]

            nickname = t.nickname or t.device_id
            sl = t.service_line_number or "N/A"
            account = t.account_name or "Milicic S.A."

            # 1. Evaluate Fixed Quota Threshold (Critical >= 100% or Warning >= threshold)
            if has_active_cycle and percent >= config.quota_critical_percent:
                alert_type = "QUOTA_CRITICAL"
                if not self.is_in_cooldown(db, t.id, alert_type, config.cooldown_hours):
                    alerts_generated += 1
                    msg = telegram_service.format_quota_alert(
                        nickname=nickname, service_line_number=sl, account_name=account,
                        consumed_gb=consumed_gb, total_gb=total_gb, percent=percent,
                        days_remaining=days_remaining, downlink=t.downlink_mbps,
                        uplink=t.uplink_mbps, ping=t.ping_ms, severity="CRITICAL"
                    )
                    sent_count = await self._broadcast(db, channels, msg, fallback_token)
                    self._record_event(
                        db, t.id, nickname, sl, alert_type, "CRITICAL",
                        f"Cuota agotada: {consumed_gb:.1f} / {total_gb:.0f} GB ({percent:.1f}%)",
                        sent_count
                    )
                    alerts_sent += 1
            elif has_active_cycle and percent >= config.quota_threshold_percent:
                alert_type = "QUOTA_THRESHOLD"
                if not self.is_in_cooldown(db, t.id, alert_type, config.cooldown_hours):
                    alerts_generated += 1
                    msg = telegram_service.format_quota_alert(
                        nickname=nickname, service_line_number=sl, account_name=account,
                        consumed_gb=consumed_gb, total_gb=total_gb, percent=percent,
                        days_remaining=days_remaining, downlink=t.downlink_mbps,
                        uplink=t.uplink_mbps, ping=t.ping_ms, severity="WARNING"
                    )
                    sent_count = await self._broadcast(db, channels, msg, fallback_token)
                    self._record_event(
                        db, t.id, nickname, sl, alert_type, "WARNING",
                        f"Umbral superado: {consumed_gb:.1f} / {total_gb:.0f} GB ({percent:.1f}%)",
                        sent_count
                    )
                    alerts_sent += 1

            # 2. Evaluate Early Burn-Rate Alert
            # Triggers if: has_active_cycle AND Consumed % >= early_warning_percent AND days_remaining >= early_warning_days_remaining AND will_exhaust_early
            if (has_active_cycle and
                percent < config.quota_threshold_percent and
                percent >= config.early_warning_percent and 
                days_remaining >= config.early_warning_days_remaining and
                burn_metrics.get("will_exhaust_early", False)):
                alert_type = "EARLY_BURN_RATE"
                if not self.is_in_cooldown(db, t.id, alert_type, config.cooldown_hours):
                    alerts_generated += 1
                    msg = telegram_service.format_burn_rate_alert(
                        nickname=nickname, service_line_number=sl, account_name=account,
                        consumed_gb=consumed_gb, total_gb=total_gb, percent=percent,
                        days_remaining=days_remaining, daily_burn_rate=daily_rate,
                        projected_exhaustion_days=projected_days
                    )
                    sent_count = await self._broadcast(db, channels, msg, fallback_token)
                    self._record_event(
                        db, t.id, nickname, sl, alert_type, "WARNING",
                        f"Ritmo acelerado: {percent:.1f}% consumido (agota en {projected_days:.1f}d con {days_remaining}d restantes)",
                        sent_count
                    )
                    alerts_sent += 1

            # 3. Evaluate Offline Alert (if enabled)
            if config.alert_on_offline and not t.is_online:
                alert_type = "TERMINAL_OFFLINE"
                if not self.is_in_cooldown(db, t.id, alert_type, config.cooldown_hours):
                    alerts_generated += 1
                    msg = telegram_service.format_offline_alert(nickname, sl, account, t.ping_ms)
                    sent_count = await self._broadcast(db, channels, msg, fallback_token)
                    self._record_event(
                        db, t.id, nickname, sl, alert_type, "WARNING",
                        f"Enlace desconectado: {nickname} pasó a Offline",
                        sent_count
                    )
                    alerts_sent += 1

        db.commit()
        return {
            "status": "COMPLETED",
            "alerts_generated": alerts_generated,
            "alerts_sent": alerts_sent,
            "channels_active": len(channels)
        }

    async def _broadcast(self, db: Session, channels: List[TelegramChannel], text_html: str, default_token: Optional[str] = None) -> int:
        """Broadcasts a message to each active channel using its assigned bot (or default bot)."""
        from backend.app.models.terminal import TelegramBot
        bots_by_id = {b.id: b for b in db.query(TelegramBot).filter(TelegramBot.is_active == True).all()}
        default_bot = next((b for b in bots_by_id.values() if b.is_default), None)
        if not default_bot and bots_by_id:
            default_bot = next(iter(bots_by_id.values()))

        success_count = 0
        for ch in channels:
            assigned_bot = bots_by_id.get(ch.bot_id) if ch.bot_id else default_bot
            token = assigned_bot.token if assigned_bot else default_token
            if not token:
                logger.warning(f"No bot token available for channel {ch.name} ({ch.chat_id})")
                continue
            res = await telegram_service.send_message(token, ch.chat_id, text_html)
            if res.get("success"):
                success_count += 1
            else:
                logger.warning(f"Fallo envío a canal {ch.name} ({ch.chat_id}): {res.get('error')}")
        return success_count

    def _record_event(
        self,
        db: Session,
        terminal_id: str,
        nickname: str,
        sl: str,
        alert_type: str,
        severity: str,
        message: str,
        sent_count: int,
        status: Optional[str] = None
    ):
        event_status = status or ("SENT" if sent_count > 0 else "FAILED")
        event = AlertEvent(
            timestamp=datetime.utcnow(),
            terminal_id=terminal_id,
            terminal_nickname=nickname,
            service_line_number=sl,
            alert_type=alert_type,
            severity=severity,
            message=message,
            delivered_channels_count=sent_count,
            status=event_status
        )
        db.add(event)
    async def test_channel_with_real_alerts(self, db: Session, channel_id: int) -> Dict[str, Any]:
        """
        Tests a specific Telegram channel by evaluating live fleet data and dispatching
        all currently active real alerts, bypassing cooldown.
        """
        from backend.app.models.terminal import TelegramBot, TelegramChannel, Terminal, BillingCycle

        channel = db.query(TelegramChannel).filter(TelegramChannel.id == channel_id).first()
        if not channel:
            return {"success": False, "error": f"Canal con ID {channel_id} no encontrado"}

        config = self.get_or_create_config(db)

        # Determine which bot to use for this channel
        bot = db.query(TelegramBot).filter(TelegramBot.id == channel.bot_id).first() if channel.bot_id else None
        if not bot or not bot.is_active:
            bot = db.query(TelegramBot).filter(TelegramBot.is_default == True, TelegramBot.is_active == True).first()
        if not bot:
            bot = db.query(TelegramBot).filter(TelegramBot.is_active == True).first()

        token = bot.token if bot else config.telegram_bot_token
        if not token:
            return {"success": False, "error": "No hay un Bot de Telegram configurado o activo para este canal"}

        terminals = db.query(Terminal).all()
        active_alerts = []

        # Pre-fetch active billing cycles to eliminate N+1 queries
        active_cycles = {
            c.service_line_number: c
            for c in db.query(BillingCycle).filter(BillingCycle.is_active == True).order_by(BillingCycle.id.asc()).all()
        }

        for t in terminals:
            if hasattr(t, "alerts_enabled") and t.alerts_enabled is False:
                continue

            cycle = active_cycles.get(t.service_line_number)
            has_active_cycle = cycle is not None and cycle.is_active and (cycle.total_amount_gb or 0) > 0

            consumed_gb = cycle.consumed_amount_gb if has_active_cycle else 0.0
            total_gb = cycle.total_amount_gb if has_active_cycle else 0.0
            percent = (consumed_gb / total_gb * 100.0) if total_gb > 0 else 0.0

            burn_metrics = self.calculate_burn_rate(
                consumed_gb, total_gb,
                cycle.start_date if has_active_cycle else None,
                cycle.end_date if has_active_cycle else None
            )
            days_remaining = burn_metrics["days_remaining"]
            daily_rate = burn_metrics["daily_rate"]
            projected_days = burn_metrics["projected_exhaustion_days"]

            nickname = t.nickname or t.device_id
            sl = t.service_line_number or "N/A"
            account = t.account_name or "Milicic S.A."

            # 1. Quota alerts
            if has_active_cycle and percent >= config.quota_critical_percent:
                msg = telegram_service.format_quota_alert(
                    nickname=nickname, service_line_number=sl, account_name=account,
                    consumed_gb=consumed_gb, total_gb=total_gb, percent=percent,
                    days_remaining=days_remaining, downlink=t.downlink_mbps,
                    uplink=t.uplink_mbps, ping=t.ping_ms, severity="CRITICAL"
                )
                active_alerts.append(("QUOTA_CRITICAL", "CRITICAL", msg, f"Cuota agotada: {consumed_gb:.1f}/{total_gb:.0f} GB ({percent:.1f}%)", t))
            elif has_active_cycle and percent >= config.quota_threshold_percent:
                msg = telegram_service.format_quota_alert(
                    nickname=nickname, service_line_number=sl, account_name=account,
                    consumed_gb=consumed_gb, total_gb=total_gb, percent=percent,
                    days_remaining=days_remaining, downlink=t.downlink_mbps,
                    uplink=t.uplink_mbps, ping=t.ping_ms, severity="WARNING"
                )
                active_alerts.append(("QUOTA_THRESHOLD", "WARNING", msg, f"Umbral superado: {consumed_gb:.1f}/{total_gb:.0f} GB ({percent:.1f}%)", t))

            # 2. Burn-Rate alerts (requires active cycle AND will_exhaust_early)
            if (has_active_cycle and
                percent >= config.early_warning_percent and 
                days_remaining >= config.early_warning_days_remaining and
                burn_metrics.get("will_exhaust_early", False)):
                msg = telegram_service.format_burn_rate_alert(
                    nickname=nickname, service_line_number=sl, account_name=account,
                    consumed_gb=consumed_gb, total_gb=total_gb, percent=percent,
                    days_remaining=days_remaining, daily_burn_rate=daily_rate,
                    projected_exhaustion_days=projected_days
                )
                active_alerts.append(("EARLY_BURN_RATE", "WARNING", msg, f"Ritmo acelerado: {percent:.1f}% (agota en {projected_days:.1f}d con {days_remaining}d restantes)", t))

            # 3. Offline alerts
            if config.alert_on_offline and not t.is_online:
                msg = telegram_service.format_offline_alert(nickname, sl, account, t.ping_ms)
                active_alerts.append(("TERMINAL_OFFLINE", "WARNING", msg, f"Enlace desconectado: {nickname}", t))

        # Send alerts to this specific channel
        sent_count = 0
        bot_uname = bot.bot_username if bot else "bot"

        if active_alerts:
            # Send introductory banner
            banner = (
                f"🧪 <b>MILICIC FLEET MONITOR - PRUEBA CON DATOS REALES</b>\n"
                f"Canal destino: <b>{channel.name}</b>\n"
                f"Emisor: <b>@{bot_uname}</b>\n\n"
                f"📋 Se detectaron <b>{len(active_alerts)} alertas vigentes</b> en la flota al momento del test.\n"
                f"Despachando notificaciones reales a continuación:"
            )
            await telegram_service.send_message(token, channel.chat_id, banner)

            for alert_type, severity, msg, summary, t in active_alerts:
                res = await telegram_service.send_message(token, channel.chat_id, msg)
                if res.get("success"):
                    sent_count += 1
                    self._record_event(
                        db, t.id, t.nickname or t.device_id, t.service_line_number or "N/A",
                        alert_type, severity, f"[Test Real '{channel.name}'] {summary}", 1,
                        status="TEST_SENT"
                    )
            db.commit()
            return {
                "success": True,
                "alerts_count": len(active_alerts),
                "sent_count": sent_count,
                "channel_name": channel.name,
                "bot_username": bot_uname,
                "message": f"Se despacharon {sent_count} de {len(active_alerts)} alertas vigentes al canal '{channel.name}' vía @{bot_uname}"
            }
        else:
            # Send healthy fleet status
            healthy_msg = (
                f"✅ <b>MILICIC FLEET MONITOR - PRUEBA CON DATOS REALES</b>\n"
                f"Canal destino: <b>{channel.name}</b>\n"
                f"Emisor: <b>@{bot_uname}</b>\n\n"
                f"🎉 <b>Flota Saludable:</b> Todas las terminales operan dentro de los umbrales normales.\n"
                f"• Total enlaces supervisados: <b>{len(terminals)}</b>\n"
                f"• Alertas vigentes: <b>0</b>"
            )
            await telegram_service.send_message(token, channel.chat_id, healthy_msg)
            return {
                "success": True,
                "alerts_count": 0,
                "sent_count": 1,
                "channel_name": channel.name,
                "bot_username": bot_uname,
                "message": f"Flota saludable (0 alertas vigentes). Reporte de estado enviado al canal '{channel.name}' vía @{bot_uname}"
            }

alert_service = AlertService()
