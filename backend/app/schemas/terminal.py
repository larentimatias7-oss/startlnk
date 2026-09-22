from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DailyUsageItem(BaseModel):
    date: str
    priority_gb: float
    opt_in_priority_gb: float
    standard_gb: float
    non_bill_gb: float
    total_gb: float

class BillingCycleSchema(BaseModel):
    id: int
    service_line_number: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    total_amount_gb: float
    consumed_amount_gb: float
    consumed_percent: float
    consumed_alarm: str
    consumed_status: str
    is_active: bool

class TerminalSummary(BaseModel):
    id: str
    device_id: str
    nickname: Optional[str] = None
    kit_serial: Optional[str] = None
    service_line_number: Optional[str] = None
    account_name: Optional[str] = None
    is_online: bool
    downlink_mbps: float
    uplink_mbps: float
    ping_ms: float
    drop_rate: float
    signal_quality: float
    has_public_ip: bool
    is_alert: bool
    consumed_alarm: str
    
    # Active billing cycle summary
    active_cycle_id: Optional[int] = None
    billing_start_date: Optional[str] = None
    billing_end_date: Optional[str] = None
    days_remaining: Optional[int] = None
    daily_avg_gb: Optional[float] = None
    is_burn_rate_alert: bool = False
    quota_total_gb: float = 0.0
    quota_consumed_gb: float = 0.0
    quota_consumed_percent: float = 0.0
    
    updated_at: Optional[datetime] = None


class TerminalDetail(TerminalSummary):
    raw_device_id: Optional[str] = None
    dish_model: Optional[str] = None
    dish_serial: Optional[str] = None
    router_id: Optional[str] = None
    wifi_bypassed: bool = False
    obstruction_percent: float = 0.0
    uptime_seconds: int = 0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    h3_cell_id: Optional[str] = None
    billing_cycle: Optional[BillingCycleSchema] = None

class UsageHistoryResponse(BaseModel):
    device_id: str
    service_line_number: str
    cycle_id: Optional[int] = None
    total_priority_gb: float = 0.0
    total_opt_in_gb: float = 0.0
    total_standard_gb: float = 0.0
    total_consumed_gb: float = 0.0
    daily_usages: List[DailyUsageItem]

class FleetKpis(BaseModel):
    total_terminals: int
    online_count: int
    offline_count: int
    availability_percent: float
    total_consumed_month_gb: float
    total_quota_month_gb: float
    fleet_quota_consumed_percent: float
    terminals_in_warning: int   # > 80%
    terminals_in_critical: int  # >= 100%
    last_sync_time: Optional[datetime] = None
    sync_status: str

class FleetDailyUsage(BaseModel):
    date: str
    total_gb: float
    priority_gb: float
    opt_in_priority_gb: float
    standard_gb: float

class FleetOverviewResponse(BaseModel):
    kpis: FleetKpis
    fleet_daily_trend: List[FleetDailyUsage]
    terminals: List[TerminalSummary]

class ActionResponse(BaseModel):
    success: bool
    message: str
    action: str
    target: str
    timestamp: datetime = datetime.utcnow()
