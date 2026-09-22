from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AlertConfigSchema(BaseModel):
    id: int = 1
    telegram_bot_token: Optional[str] = None
    quota_threshold_percent: float = 80.0
    quota_critical_percent: float = 100.0
    early_warning_percent: float = 60.0
    early_warning_days_remaining: int = 15
    alert_on_offline: bool = False
    cooldown_hours: int = 12
    sync_interval_minutes: int = 15
    is_enabled: bool = True
    updated_at: Optional[datetime] = None

class AlertConfigUpdate(BaseModel):
    telegram_bot_token: Optional[str] = None
    quota_threshold_percent: Optional[float] = None
    quota_critical_percent: Optional[float] = None
    early_warning_percent: Optional[float] = None
    early_warning_days_remaining: Optional[int] = None
    alert_on_offline: Optional[bool] = None
    cooldown_hours: Optional[int] = None
    sync_interval_minutes: Optional[int] = None
    is_enabled: Optional[bool] = None

class TelegramBotCreate(BaseModel):
    name: str
    token: str
    is_default: bool = False
    is_active: bool = True

class TelegramBotUpdate(BaseModel):
    name: Optional[str] = None
    token: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None

class TelegramBotSchema(BaseModel):
    id: int
    name: str
    token_masked: str
    bot_username: Optional[str] = None
    bot_id: Optional[str] = None
    is_default: bool
    is_active: bool
    channels_count: int = 0
    created_at: Optional[datetime] = None

class TelegramChannelCreate(BaseModel):
    name: str
    chat_id: str
    bot_id: Optional[int] = None
    is_active: bool = True

class TelegramChannelUpdate(BaseModel):
    name: Optional[str] = None
    chat_id: Optional[str] = None
    bot_id: Optional[int] = None
    is_active: Optional[bool] = None

class TelegramChannelSchema(BaseModel):
    id: int
    name: str
    chat_id: str
    bot_id: Optional[int] = None
    bot_name: Optional[str] = None
    bot_username: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

class TestTelegramRequest(BaseModel):
    chat_id: Optional[str] = None
    bot_id: Optional[int] = None
    custom_bot_token: Optional[str] = None
    message: Optional[str] = None

class VerifyBotRequest(BaseModel):
    bot_token: Optional[str] = None

class AlertEventSchema(BaseModel):
    id: int
    timestamp: datetime
    terminal_id: str
    terminal_nickname: Optional[str] = None
    service_line_number: Optional[str] = None
    alert_type: str
    severity: str
    message: str
    delivered_channels_count: int
    status: str
