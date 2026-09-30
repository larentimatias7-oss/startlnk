from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.core.database import Base

class Terminal(Base):
    __tablename__ = "terminals"

    id = Column(String, primary_key=True, index=True)
    device_id = Column(String, index=True)
    raw_device_id = Column(String, nullable=True)
    nickname = Column(String, nullable=True)
    kit_serial = Column(String, nullable=True)
    service_line_number = Column(String, index=True, nullable=True)
    account_name = Column(String, nullable=True)
    
    # Live Status & Metrics
    is_online = Column(Boolean, default=False)
    downlink_mbps = Column(Float, default=0.0)
    uplink_mbps = Column(Float, default=0.0)
    ping_ms = Column(Float, default=0.0)
    drop_rate = Column(Float, default=0.0)
    obstruction_percent = Column(Float, default=0.0)
    signal_quality = Column(Float, default=100.0)
    uptime_seconds = Column(Integer, default=0)
    
    # Hardware & Network
    dish_model = Column(String, nullable=True)
    dish_serial = Column(String, nullable=True)
    has_public_ip = Column(Boolean, default=False)
    router_id = Column(String, nullable=True)
    wifi_bypassed = Column(Boolean, default=False)
    
    # Geo
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    h3_cell_id = Column(String, nullable=True)
    
    # Quota & Alerts
    is_alert = Column(Boolean, default=False)
    consumed_alarm = Column(String, default="NORMAL")
    active_alerts_json = Column(String, nullable=True)
    alerts_enabled = Column(Boolean, default=True)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BillingCycle(Base):
    __tablename__ = "billing_cycles"

    id = Column(Integer, primary_key=True, index=True) # ECHO billingCycle ID
    service_line_number = Column(String, index=True, nullable=False)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    total_amount_gb = Column(Float, default=0.0)
    consumed_amount_gb = Column(Float, default=0.0)
    consumed_percent = Column(Float, default=0.0)
    consumed_alarm = Column(String, default="NORMAL")
    consumed_status = Column(String, default="ACTIVE")
    currency = Column(String, default="USD")
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    daily_usages = relationship("DailyUsage", back_populates="billing_cycle", cascade="all, delete-orphan")

class DailyUsage(Base):
    __tablename__ = "daily_usages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    billing_cycle_id = Column(Integer, ForeignKey("billing_cycles.id", ondelete="CASCADE"), index=True)
    service_line_number = Column(String, index=True, nullable=False)
    date = Column(String, index=True, nullable=False) # YYYY-MM-DD
    priority_gb = Column(Float, default=0.0)
    opt_in_priority_gb = Column(Float, default=0.0)
    standard_gb = Column(Float, default=0.0)
    non_bill_gb = Column(Float, default=0.0)
    total_gb = Column(Float, default=0.0)

    billing_cycle = relationship("BillingCycle", back_populates="daily_usages")

    __table_args__ = (
        Index("ix_cycle_date", "billing_cycle_id", "date", unique=True),
    )

class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="SUCCESS") # SUCCESS, ERROR, WARNING
    terminals_count = Column(Integer, default=0)
    message = Column(String, nullable=True)

class AlertConfig(Base):
    __tablename__ = "alert_configs"

    id = Column(Integer, primary_key=True, default=1)
    telegram_bot_token = Column(String, nullable=True)
    quota_threshold_percent = Column(Float, default=80.0) # Alerta cuota alcanzada
    quota_critical_percent = Column(Float, default=100.0) # Alerta cuota agotada
    early_warning_percent = Column(Float, default=60.0) # % temprano
    early_warning_days_remaining = Column(Integer, default=15) # con >= N días restantes
    alert_on_offline = Column(Boolean, default=False)
    cooldown_hours = Column(Integer, default=24) # Horas de cooldown anti-spam (24hs)
    sync_interval_minutes = Column(Integer, default=15) # Frecuencia de sincronización / evaluación
    is_enabled = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TelegramBot(Base):
    __tablename__ = "telegram_bots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    token = Column(String, nullable=False, unique=True)
    bot_username = Column(String, nullable=True)
    bot_id = Column(String, nullable=True)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class TelegramChannel(Base):
    __tablename__ = "telegram_channels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    chat_id = Column(String, nullable=False, unique=True)
    bot_id = Column(Integer, ForeignKey("telegram_bots.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    bot = relationship("TelegramBot", backref="channels")

class AlertEvent(Base):
    __tablename__ = "alert_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    terminal_id = Column(String, index=True, nullable=False)
    terminal_nickname = Column(String, nullable=True)
    service_line_number = Column(String, index=True, nullable=True)
    alert_type = Column(String, nullable=False) # QUOTA_THRESHOLD, EARLY_BURN_RATE, TERMINAL_OFFLINE
    severity = Column(String, default="WARNING") # INFO, WARNING, CRITICAL
    message = Column(String, nullable=False)
    details_json = Column(String, nullable=True)
    delivered_channels_count = Column(Integer, default=0)
    status = Column(String, default="SENT") # SENT, FAILED, SKIPPED

