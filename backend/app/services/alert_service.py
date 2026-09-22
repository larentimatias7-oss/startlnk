import logging
from datetime import datetime, date, timedelta
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
                cooldown_hours=12,
                is_enabled=True
            )
            db.add(config)
            db.commit()
            db.refresh(config)
        return config

    @staticmethod
    def parse_cycle_dates(start_date_str: Optional[str], end_date_str: Optional[str]) -> Tuple[Optional[int], Optional[int]]:
        """
        Parses cycle start and end dates.
        Returns: (days_elapsed, days_remaining)
        """
        if not start_date_str or not end_date_str:
            # Fallback: assume typical 30 day cycle
            return 15, 15

        try:
            # Format can be YYYY-MM-DD or ISO
            s_date = datetime.strptime(start_date_str[:10], "%Y-%m-%d").date()
            e_date = datetime.strptime(end_date_str[:10], "%Y-%m-%d").date()
            today = datetime.utcnow().date()

            days_elapsed = max(1, (today - s_date).days)
            days_remaining = max(0, (e_date - today).days)
            return days_elapsed, days_remaining
        except Exception:
            return 15, 15

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
        recent_alert = (
            db.query(AlertEvent)
            .filter(
                AlertEvent.terminal_id == terminal_id,
                AlertEvent.alert_type == alert_type,
                AlertEvent.timestamp >= cutoff,
                AlertEvent.status == "SENT"
            )
            .first()
        )
        return recent_alert is not None

    async def evaluate_and_dispatch(self, db: Session) -> Dict[str, Any]:
        """
        Evaluates all terminals against alert criteria and dispatches
        notifications to active Telegram channels.
        """
        config = self.get_or_create_config(db)
        if not config.is_enabled:
            return {"status": "SKIPPED", "message": "Alertas deshabilitadas globalmente"}

        bot_token = config.telegram_bot_token
        channels = db.query(TelegramChannel).filter(TelegramChannel.is_active == True).all()

        # Fetch active channels
        channels = db.query(TelegramChannel).filter(TelegramChannel.is_active == True).all()
        if not channels:
            logger.info("Alert evaluation: No active telegram channels configured.")
            return {"status": "SKIPPED", "message": "No hay canales de Telegram activos"}

        # Check for active bots or fallback config token
        from backend.app.models.terminal import TelegramBot
        active_bots = db.query(TelegramBot).filter(TelegramBot.is_active == True).all()
        fallback_token = config.telegram_bot_token

        if not active_bots and not fallback_token:
            logger.info("Alert evaluation: No active telegram bots or token configured.")
            return {"status": "SKIPPED", "message": "No hay Bots de Telegram activos o token configurado"}

        terminals = db.query(Terminal).all()
        alerts_generated = 0
        alerts_sent = 0

        for t in terminals:
            # Skip evaluation if alerts are silenced for this specific terminal
            if hasattr(t, "alerts_enabled") and t.alerts_enabled is False:
                continue

            # Find active billing cycle
            cycle = (
                db.query(BillingCycle)
                .filter(BillingCycle.service_line_number == t.service_line_number, BillingCycle.is_active == True)
                .order_by(desc(BillingCycle.id))
                .first()
            )

            consumed_gb = cycle.consumed_amount_gb if cycle else 0.0
            total_gb = cycle.total_amount_gb if cycle and cycle.total_amount_gb > 0 else 1000.0
            percent = (consumed_gb / total_gb * 100.0) if total_gb > 0 else 0.0

            burn_metrics = self.calculate_burn_rate(
                consumed_gb, total_gb,
                cycle.start_date if cycle else None,
                cycle.end_date if cycle else None
            )
            days_remaining = burn_metrics["days_remaining"]
            daily_rate = burn_metrics["daily_rate"]
            projected_days = burn_metrics["projected_exhaustion_days"]

            nickname = t.nickname or t.device_id
            sl = t.service_line_number or "N/A"
            account = t.account_name or "Milicic S.A."

            # 1. Evaluate Fixed Quota Threshold (Critical >= 100% or Warning >= threshold)
            if percent >= config.quota_critical_percent:
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
            elif percent >= config.quota_threshold_percent:
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
            # Triggers if: Consumed % >= early_warning_percent AND days_remaining >= early_warning_days_remaining
            if percent >= config.early_warning_percent and days_remaining >= config.early_warning_days_remaining:
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
                        f"Ritmo acelerado: {percent:.1f}% consumido con {days_remaining} días restantes",
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
        sent_count: int
    ):
        event = AlertEvent(
            terminal_id=terminal_id,
            terminal_nickname=nickname,
            service_line_number=sl,
            alert_type=alert_type,
            severity=severity,
            message=message,
            delivered_channels_count=sent_count,
            status="SENT" if sent_count > 0 else "FAILED"
        )
        db.add(event)

alert_service = AlertService()
