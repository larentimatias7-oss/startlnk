from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from backend.app.core.database import get_db
from backend.app.models.terminal import Terminal, BillingCycle, DailyUsage, SyncLog
from backend.app.schemas.terminal import (
    TerminalSummary,
    TerminalDetail,
    BillingCycleSchema,
    UsageHistoryResponse,
    DailyUsageItem,
    FleetOverviewResponse,
    FleetKpis,
    FleetDailyUsage,
    ActionResponse
)
from backend.app.services.echo_client import echo_client
from backend.app.services.sync_service import SyncService
from backend.app.services.alert_service import AlertService

router = APIRouter(prefix="/terminals", tags=["terminals"])

def _build_summary(
    t: Terminal,
    db: Session,
    active_cycles_map: Optional[dict] = None,
    config: Optional[object] = None
) -> TerminalSummary:
    # Find active cycle for this terminal's service line
    active_cycle = None
    if t.service_line_number:
        if active_cycles_map is not None:
            active_cycle = active_cycles_map.get(t.service_line_number)
        else:
            active_cycle = db.query(BillingCycle).filter(
                BillingCycle.service_line_number == t.service_line_number,
                BillingCycle.is_active == True
            ).first()

    has_active_cycle = active_cycle is not None and getattr(active_cycle, "is_active", True)
    quota_total = active_cycle.total_amount_gb if has_active_cycle else 0.0
    quota_consumed = active_cycle.consumed_amount_gb if has_active_cycle else 0.0
    quota_percent = active_cycle.consumed_percent if has_active_cycle else 0.0

    start_date = active_cycle.start_date if has_active_cycle else None
    end_date = active_cycle.end_date if has_active_cycle else None
    burn_metrics = AlertService.calculate_burn_rate(quota_consumed, quota_total, start_date, end_date)
    
    # Check early burn rate alert (strictly requires active cycle AND will_exhaust_early)
    if config is None:
        config = AlertService.get_or_create_config(db)
    is_burn_alert = (
        has_active_cycle and
        quota_total > 0 and
        quota_percent >= config.early_warning_percent and
        burn_metrics["days_remaining"] >= config.early_warning_days_remaining and
        burn_metrics.get("will_exhaust_early", False)
    )

    return TerminalSummary(
        id=t.id,
        device_id=t.device_id,
        nickname=t.nickname,
        kit_serial=t.kit_serial,
        service_line_number=t.service_line_number,
        account_name=t.account_name,
        is_online=t.is_online,
        downlink_mbps=t.downlink_mbps,
        uplink_mbps=t.uplink_mbps,
        ping_ms=t.ping_ms,
        drop_rate=t.drop_rate,
        signal_quality=t.signal_quality,
        has_public_ip=t.has_public_ip,
        is_alert=t.is_alert or is_burn_alert,
        alerts_enabled=t.alerts_enabled if t.alerts_enabled is not None else True,
        consumed_alarm=t.consumed_alarm,
        active_cycle_id=active_cycle.id if active_cycle else None,
        billing_start_date=start_date,
        billing_end_date=end_date,
        days_remaining=burn_metrics["days_remaining"],
        daily_avg_gb=burn_metrics["daily_rate"],
        is_burn_rate_alert=is_burn_alert,
        quota_total_gb=quota_total,
        quota_consumed_gb=quota_consumed,
        quota_consumed_percent=quota_percent,
        updated_at=t.updated_at
    )


@router.get("", response_model=List[TerminalSummary])
def get_terminals(
    status: Optional[str] = Query(None, description="Filter by status: 'online' or 'offline'"),
    search: Optional[str] = Query(None, description="Search by nickname, serial or line"),
    db: Session = Depends(get_db)
):
    query = db.query(Terminal)
    if status == "online":
        query = query.filter(Terminal.is_online == True)
    elif status == "offline":
        query = query.filter(Terminal.is_online == False)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (Terminal.nickname.ilike(s)) |
            (Terminal.kit_serial.ilike(s)) |
            (Terminal.service_line_number.ilike(s)) |
            (Terminal.account_name.ilike(s))
        )

    terminals = query.all()
    # Pre-fetch active cycles and config to prevent N+1 queries
    active_cycles = {
        c.service_line_number: c
        for c in db.query(BillingCycle).filter(BillingCycle.is_active == True).all()
    }
    cfg = AlertService.get_or_create_config(db)
    return [_build_summary(t, db, active_cycles, cfg) for t in terminals]

@router.get("/overview", response_model=FleetOverviewResponse)
def get_fleet_overview(db: Session = Depends(get_db)):
    terminals = db.query(Terminal).all()
    total = len(terminals)
    online = sum(1 for t in terminals if t.is_online)
    offline = total - online
    avail_pct = round((online / total * 100.0), 1) if total > 0 else 0.0

    # Bulk pre-fetch active cycles and config
    active_cycles = {
        c.service_line_number: c
        for c in db.query(BillingCycle).filter(BillingCycle.is_active == True).all()
    }
    cfg = AlertService.get_or_create_config(db)
    summaries = [_build_summary(t, db, active_cycles, cfg) for t in terminals]

    total_consumed_month = sum(s.quota_consumed_gb for s in summaries)
    total_quota_month = sum(s.quota_total_gb for s in summaries)
    fleet_quota_pct = round((total_consumed_month / total_quota_month * 100.0), 1) if total_quota_month > 0 else 0.0

    warning_count = sum(1 for s in summaries if cfg.quota_threshold_percent <= s.quota_consumed_percent < cfg.quota_critical_percent)
    critical_count = sum(1 for s in summaries if s.quota_consumed_percent >= cfg.quota_critical_percent)

    # Last sync
    last_log = db.query(SyncLog).order_by(SyncLog.timestamp.desc()).first()

    kpis = FleetKpis(
        total_terminals=total,
        online_count=online,
        offline_count=offline,
        availability_percent=avail_pct,
        total_consumed_month_gb=round(total_consumed_month, 2),
        total_quota_month_gb=round(total_quota_month, 2),
        fleet_quota_consumed_percent=fleet_quota_pct,
        terminals_in_warning=warning_count,
        terminals_in_critical=critical_count,
        last_sync_time=last_log.timestamp if last_log else None,
        sync_status=last_log.status if last_log else "UNKNOWN"
    )

    # Fleet daily trend aggregated across all terminals (strictly within the last 30 calendar days)
    cutoff_date = (datetime.now(timezone.utc).date() - timedelta(days=30)).strftime("%Y-%m-%d")
    daily_sums = db.query(
        DailyUsage.date,
        func.sum(DailyUsage.total_gb).label("total_gb"),
        func.sum(DailyUsage.priority_gb).label("priority_gb"),
        func.sum(DailyUsage.opt_in_priority_gb).label("opt_in_priority_gb"),
        func.sum(DailyUsage.standard_gb).label("standard_gb")
    ).filter(DailyUsage.date >= cutoff_date).group_by(DailyUsage.date).order_by(DailyUsage.date.asc()).all()

    fleet_trend = [
        FleetDailyUsage(
            date=row.date,
            total_gb=round(float(row.total_gb or 0.0), 2),
            priority_gb=round(float(row.priority_gb or 0.0), 2),
            opt_in_priority_gb=round(float(row.opt_in_priority_gb or 0.0), 2),
            standard_gb=round(float(row.standard_gb or 0.0), 2)
        )
        for row in daily_sums
    ]

    return FleetOverviewResponse(
        kpis=kpis,
        fleet_daily_trend=fleet_trend,
        terminals=summaries
    )

@router.get("/{device_id}", response_model=TerminalDetail)
def get_terminal_detail(device_id: str, db: Session = Depends(get_db)):
    t = db.query(Terminal).filter(
        (Terminal.id == device_id) |
        (Terminal.device_id == device_id) |
        (Terminal.raw_device_id == device_id.removeprefix("ut"))
    ).first()

    if not t:
        raise HTTPException(status_code=404, detail="Terminal not found")

    summary = _build_summary(t, db)

    b_cycle_schema = None
    if t.service_line_number:
        cycle = db.query(BillingCycle).filter(
            BillingCycle.service_line_number == t.service_line_number,
            BillingCycle.is_active == True
        ).first()
        if not cycle:
            cycle = db.query(BillingCycle).filter(
                BillingCycle.service_line_number == t.service_line_number
            ).order_by(BillingCycle.id.desc()).first()
        if cycle:
            b_cycle_schema = BillingCycleSchema(
                id=cycle.id,
                service_line_number=cycle.service_line_number,
                start_date=cycle.start_date,
                end_date=cycle.end_date,
                total_amount_gb=cycle.total_amount_gb,
                consumed_amount_gb=cycle.consumed_amount_gb,
                consumed_percent=cycle.consumed_percent,
                consumed_alarm=cycle.consumed_alarm,
                consumed_status=cycle.consumed_status,
                is_active=cycle.is_active
            )

    return TerminalDetail(
        **summary.model_dump(),
        raw_device_id=t.raw_device_id,
        dish_model=t.dish_model,
        dish_serial=t.dish_serial,
        router_id=t.router_id,
        wifi_bypassed=t.wifi_bypassed,
        obstruction_percent=t.obstruction_percent,
        uptime_seconds=t.uptime_seconds,
        latitude=t.latitude,
        longitude=t.longitude,
        h3_cell_id=t.h3_cell_id,
        billing_cycle=b_cycle_schema
    )

@router.get("/{device_id}/usage-history", response_model=UsageHistoryResponse)
def get_usage_history(device_id: str, db: Session = Depends(get_db)):
    t = db.query(Terminal).filter(
        (Terminal.id == device_id) |
        (Terminal.device_id == device_id) |
        (Terminal.raw_device_id == device_id.removeprefix("ut"))
    ).first()

    if not t:
        raise HTTPException(status_code=404, detail="Terminal not found")

    sl = t.service_line_number or ""
    active_cycle = db.query(BillingCycle).filter(
        BillingCycle.service_line_number == sl,
        BillingCycle.is_active == True
    ).first()
    if not active_cycle:
        active_cycle = db.query(BillingCycle).filter(
            BillingCycle.service_line_number == sl
        ).order_by(BillingCycle.id.desc()).first()

    c_id = active_cycle.id if active_cycle else None

    query = db.query(DailyUsage).filter(DailyUsage.service_line_number == sl)
    if c_id:
        query = query.filter(DailyUsage.billing_cycle_id == c_id)

    usages = query.order_by(DailyUsage.date.asc()).all()

    daily_items = [
        DailyUsageItem(
            date=u.date,
            priority_gb=u.priority_gb,
            opt_in_priority_gb=u.opt_in_priority_gb,
            standard_gb=u.standard_gb,
            non_bill_gb=u.non_bill_gb,
            total_gb=u.total_gb
        )
        for u in usages
    ]

    total_p = sum(d.priority_gb for d in daily_items)
    total_opt = sum(d.opt_in_priority_gb for d in daily_items)
    total_std = sum(d.standard_gb for d in daily_items)
    total_consumed = sum(d.total_gb for d in daily_items)

    return UsageHistoryResponse(
        device_id=t.device_id,
        service_line_number=sl,
        cycle_id=c_id,
        total_priority_gb=round(total_p, 2),
        total_opt_in_gb=round(total_opt, 2),
        total_standard_gb=round(total_std, 2),
        total_consumed_gb=round(total_consumed, 2),
        daily_usages=daily_items
    )

@router.post("/{device_id}/reboot", response_model=ActionResponse)
async def reboot_terminal(device_id: str, db: Session = Depends(get_db)):
    t = db.query(Terminal).filter(
        (Terminal.id == device_id) |
        (Terminal.device_id == device_id)
    ).first()

    if not t:
        raise HTTPException(status_code=404, detail="Terminal not found")

    target_id = t.device_id
    if echo_client.has_credentials:
        res = await echo_client.reboot_terminal(target_id)
        msg = res.get("message") or f"Reboot instruction dispatched to Starlink terminal {t.nickname or target_id}"
    else:
        msg = f"[Demo Mode] Reboot instruction simulated for Starlink terminal {t.nickname or target_id}"

    return ActionResponse(
        success=True,
        message=msg,
        action="reboot",
        target=target_id
    )

@router.post("/{service_line_number}/opt-in", response_model=ActionResponse)
async def set_opt_in(
    service_line_number: str,
    enabled: bool = Query(True, description="True for opt-in, False for opt-out"),
    db: Session = Depends(get_db)
):
    cycle = db.query(BillingCycle).filter(BillingCycle.service_line_number == service_line_number).first()
    if not cycle:
        raise HTTPException(status_code=404, detail=f"Service line {service_line_number} not found")

    if echo_client.has_credentials:
        res = await echo_client.set_data_opt_in(service_line_number, enabled=enabled)
        msg = res.get("message") or f"Data Opt-In set to {enabled} for {service_line_number}"
    else:
        msg = f"[Demo Mode] Data Opt-In toggled to {enabled} for {service_line_number}"

    return ActionResponse(
        success=True,
        message=msg,
        action="opt-in" if enabled else "opt-out",
        target=service_line_number
    )

@router.post("/{device_id}/toggle-alerts", response_model=ActionResponse)
def toggle_terminal_alerts(
    device_id: str,
    enabled: Optional[bool] = Query(None, description="Explicit status or toggle if None"),
    db: Session = Depends(get_db)
):
    t = db.query(Terminal).filter(
        (Terminal.id == device_id) |
        (Terminal.device_id == device_id) |
        (Terminal.raw_device_id == device_id.removeprefix("ut"))
    ).first()

    if not t:
        raise HTTPException(status_code=404, detail="Terminal no encontrado")

    current_val = t.alerts_enabled if t.alerts_enabled is not None else True
    new_val = not current_val if enabled is None else enabled

    t.alerts_enabled = new_val
    db.commit()
    db.refresh(t)

    status_str = "activadas" if new_val else "silenciadas"
    return ActionResponse(
        success=True,
        message=f"Alertas de Telegram {status_str} para '{t.nickname or t.device_id}'",
        action="toggle_alerts",
        target=t.device_id
    )

@router.post("/sync", response_model=ActionResponse)
async def trigger_manual_sync(db: Session = Depends(get_db)):
    service = SyncService(db)
    log = await service.run_sync()
    return ActionResponse(
        success=log.status == "SUCCESS",
        message=log.message or "Sync finished",
        action="manual_sync",
        target=f"{log.terminals_count} terminals"
    )
