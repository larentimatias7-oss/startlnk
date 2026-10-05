import logging
import json
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from backend.app.models.terminal import Terminal, BillingCycle, DailyUsage, SyncLog
from backend.app.services.echo_client import echo_client

logger = logging.getLogger(__name__)

class SyncService:
    def __init__(self, db: Session):
        self.db = db

    def _sanitize_daily_usages(self):
        """Sanitizes legacy DailyUsage dates removing ISO time suffixes and deduplicating rows."""
        try:
            rows_with_t = self.db.query(DailyUsage).filter(DailyUsage.date.like("%T%")).all()
            if rows_with_t:
                for row in rows_with_t:
                    clean_date = row.date.split("T")[0]
                    duplicate = self.db.query(DailyUsage).filter(
                        DailyUsage.billing_cycle_id == row.billing_cycle_id,
                        DailyUsage.date == clean_date,
                        DailyUsage.id != row.id
                    ).first()
                    if duplicate:
                        self.db.delete(row)
                    else:
                        row.date = clean_date
                self.db.commit()
        except Exception as e:
            logger.warning(f"Failed to sanitize daily usages: {e}")

    def _purge_demo_data(self):
        """Purge any mock/demo data from development testing"""
        try:
            demo_terms = self.db.query(Terminal).filter(Terminal.id.like("ut01000000-%")).all()
            if demo_terms:
                logger.info(f"Purging {len(demo_terms)} demo mock terminals from database...")
                self.db.query(DailyUsage).filter(DailyUsage.billing_cycle_id.in_([4801, 4802, 4803, 4804, 4805, 4806, 4807, 4808])).delete(synchronize_session=False)
                self.db.query(BillingCycle).filter(BillingCycle.id.in_([4801, 4802, 4803, 4804, 4805, 4806, 4807, 4808])).delete(synchronize_session=False)
                self.db.query(Terminal).filter(Terminal.id.like("ut01000000-%")).delete(synchronize_session=False)
                self.db.commit()
                logger.info("Demo mock data purged successfully.")
        except Exception as e:
            logger.warning(f"Error purging demo data: {e}")

    async def run_sync(self) -> SyncLog:
        """Synchronize terminals, telemetry, billing cycles, and daily usage from ECHO"""
        logger.info("Starting TSM ECHO synchronization worker...")
        self._sanitize_daily_usages()
        self._purge_demo_data()
        
        # Check if we can fetch live data from ECHO
        raw_devices = []
        if echo_client.has_credentials:
            raw_devices = await echo_client.get_device_lists()

        if not raw_devices:
            existing_count = self.db.query(Terminal).count()
            log = SyncLog(
                status="WARNING",
                terminals_count=existing_count,
                message="No live ECHO data returned. Please verify ECHO_EMAIL and ECHO_PASSWORD credentials."
            )
            self.db.add(log)
            self.db.commit()
            return log


        # Process live devices from ECHO
        synced_count = 0
        try:
            live_ids = [str(d.get("deviceId") or d.get("id") or "") for d in raw_devices if (d.get("deviceId") or d.get("id"))]
            if live_ids:
                # Remove old demo seed data if present
                self.db.query(Terminal).filter(~Terminal.id.in_(live_ids)).delete(synchronize_session=False)

            for d in raw_devices:
                device_id = str(d.get("deviceId") or d.get("id") or "")
                if not device_id:
                    continue

                clean_id = device_id.removeprefix("ut")
                sl_num = d.get("serviceLineNumber") or ""

                # Upsert Terminal
                terminal = self.db.query(Terminal).filter(Terminal.id == device_id).first()
                if not terminal:
                    terminal = Terminal(id=device_id)
                    self.db.add(terminal)

                terminal.device_id = device_id
                terminal.raw_device_id = clean_id
                terminal.nickname = d.get("nickname") or d.get("kitSerial") or device_id
                terminal.kit_serial = d.get("kitSerial")
                terminal.service_line_number = sl_num
                terminal.account_name = d.get("accountName")
                is_online = bool(d.get("isOnline"))
                now_utc = datetime.utcnow()
                if is_online != terminal.is_online:
                    terminal.is_online = is_online
                    if not is_online:
                        terminal.offline_since = now_utc
                        terminal.offline_alert_sent = False
                    else:
                        terminal.last_online_at = now_utc
                elif is_online:
                    terminal.last_online_at = now_utc
                elif not is_online and not terminal.offline_since:
                    terminal.offline_since = now_utc
                    terminal.offline_alert_sent = False

                terminal.is_online = is_online
                list_dl = float(d.get("downlink") or 0.0)
                if list_dl > 0 or terminal.downlink_mbps is None:
                    terminal.downlink_mbps = list_dl
                terminal.ping_ms = float(d.get("ping") or 0.0)
                terminal.is_alert = bool(d.get("isAlert"))
                terminal.consumed_alarm = str(d.get("DBconsumedAlarm") or "NORMAL")
                terminal.updated_at = now_utc

                # Telemetry detail
                try:
                    telemetry = await echo_client.get_user_terminal_telemetry(clean_id)
                    if telemetry:
                        terminal.dish_model = telemetry.get("uti_dishModel") or terminal.dish_model
                        terminal.dish_serial = telemetry.get("uti_dishSerialNumber")
                        terminal.has_public_ip = bool(telemetry.get("sli_publicIp"))
                        terminal.signal_quality = float(telemetry.get("ut_SignalQuality") or 100.0)
                        terminal.obstruction_percent = float(telemetry.get("ut_ObstructionPercentTime") or 0.0)
                        terminal.uptime_seconds = int(telemetry.get("ut_Uptime") or 0)
                        terminal.h3_cell_id = str(telemetry.get("ut_H3CellId") or "")
                        terminal.router_id = telemetry.get("ri_routerId")
                        terminal.wifi_bypassed = bool(telemetry.get("r_WifiIsBypassed"))
                        
                        # Real-time Throughput (MB/s) - ECHO provides direct MB/s
                        dl_val = float(telemetry.get("ut_DownlinkThroughput") or 0.0)
                        ul_val = float(telemetry.get("ut_UplinkThroughput") or 0.0)
                        # Fallback to list downlink if telemetry throughput is 0
                        if dl_val <= 0 and float(d.get("downlink") or 0.0) > 0:
                            dl_val = float(d.get("downlink") or 0.0)
                        
                        # In case upstream ever returns raw bits/s (> 100,000)
                        terminal.downlink_mbps = round(dl_val / 1_000_000.0, 2) if dl_val > 100_000 else round(dl_val, 2)
                        terminal.uplink_mbps = round(ul_val / 1_000_000.0, 2) if ul_val > 100_000 else round(ul_val, 2)
                except Exception as ex:
                    logger.warning(f"Error fetching telemetry for {clean_id}: {ex}")

                # Billing Cycles and Usage
                if sl_num:
                    try:
                        cycles = await echo_client.get_billing_cycles(sl_num)
                        if cycles and isinstance(cycles, list):
                            active_cycle_raw = cycles[-1] # Last cycle is the active one
                            c_id = int(active_cycle_raw.get("id"))

                            b_cycle = self.db.query(BillingCycle).filter(BillingCycle.id == c_id).first()
                            if not b_cycle:
                                b_cycle = BillingCycle(id=c_id, service_line_number=sl_num)
                                self.db.add(b_cycle)

                            b_cycle.start_date = (
                                active_cycle_raw.get("cycleStartDate")
                                or active_cycle_raw.get("DBstartDateUtc")
                                or active_cycle_raw.get("startDate")
                            )
                            b_cycle.end_date = (
                                active_cycle_raw.get("cycleEndDate")
                                or active_cycle_raw.get("DBexpirationDateUtc")
                                or active_cycle_raw.get("endDate")
                            )

                            # Determine if cycle is currently active (expires in future)
                            now_utc = datetime.now(timezone.utc)
                            is_active = True
                            if b_cycle.end_date:
                                try:
                                    clean_end = b_cycle.end_date.replace("Z", "+00:00")
                                    e_dt = datetime.fromisoformat(clean_end)
                                    is_active = (e_dt >= now_utc)
                                except Exception:
                                    is_active = True
                            b_cycle.is_active = is_active

                            # Fetch all datablocks for active cycle to aggregate true quota and top-ups
                            datablocks = []
                            try:
                                datablocks = await echo_client.get_data_blocks(c_id)
                            except Exception as d_err:
                                logger.warning(f"Could not fetch datablocks for cycle {c_id}: {d_err}")

                            sum_block_quota = sum(float(b.get("DBtotalAmountGB") or 0.0) for b in datablocks) if datablocks else 0.0
                            sum_block_cons = sum(float(b.get("DBconsumedAmountGB") or 0.0) for b in datablocks) if datablocks else 0.0

                            raw_tot = float(active_cycle_raw.get("DBtotalAmountGB") or active_cycle_raw.get("totalAmountGB") or 0.0)
                            raw_cons = float(active_cycle_raw.get("DBconsumedAmountGB") or active_cycle_raw.get("consumedAmountGB") or 0.0)
                            prio_gb = float(active_cycle_raw.get("totalPriorityGB") or 0.0)

                            tot_gb = max(sum_block_quota, raw_tot)
                            cons_gb = max(sum_block_cons, prio_gb, raw_cons)
                            calc_pct = round((cons_gb / tot_gb) * 100.0, 1) if tot_gb > 0 else 0.0

                            b_cycle.total_amount_gb = tot_gb
                            b_cycle.consumed_amount_gb = cons_gb
                            b_cycle.consumed_percent = calc_pct
                            b_cycle.consumed_alarm = str(active_cycle_raw.get("DBconsumedAlarm") or ("100" if calc_pct >= 100 else "80" if calc_pct >= 80 else "NORMAL"))
                            b_cycle.consumed_status = str(active_cycle_raw.get("DBconsumedStatus") or ("OVERAGE" if calc_pct >= 100 else "ACTIVE"))

                            # Fetch daily data usage for this active cycle
                            daily_data = await echo_client.get_daily_data_usage(c_id)
                            if daily_data and isinstance(daily_data, list):
                                # Pre-fetch existing usage records for this cycle to eliminate N+1 queries
                                existing_usages = {
                                    u.date: u for u in self.db.query(DailyUsage).filter(DailyUsage.billing_cycle_id == c_id).all()
                                }
                                for day_entry in daily_data:
                                    raw_date = str(day_entry.get("date") or "")
                                    if not raw_date:
                                        continue
                                    day_date = raw_date.split("T")[0]

                                    p_gb = float(day_entry.get("priorityGB") or 0.0)
                                    opt_gb = float(day_entry.get("optInPriorityGB") or 0.0)
                                    std_gb = float(day_entry.get("standardGB") or 0.0)
                                    non_gb = float(day_entry.get("nonBillableGB") or day_entry.get("nonBillGB") or 0.0)
                                    tot_day = round(p_gb + opt_gb + std_gb + non_gb, 2)

                                    usage_row = existing_usages.get(day_date)

                                    if not usage_row:
                                        usage_row = DailyUsage(
                                            billing_cycle_id=c_id,
                                            service_line_number=sl_num,
                                            date=day_date
                                        )
                                        self.db.add(usage_row)
                                        existing_usages[day_date] = usage_row

                                    usage_row.priority_gb = p_gb
                                    usage_row.opt_in_priority_gb = opt_gb
                                    usage_row.standard_gb = std_gb
                                    usage_row.non_bill_gb = non_gb
                                    usage_row.total_gb = tot_day
                    except Exception as ex:
                        logger.warning(f"Error fetching billing cycle for {sl_num}: {ex}")

                synced_count += 1
                if synced_count % 3 == 0:
                    self.db.commit()

            self.db.commit()
            log = SyncLog(
                status="SUCCESS",
                terminals_count=synced_count,
                message=f"Synced {synced_count} terminals successfully from TSM ECHO"
            )
            self.db.add(log)
            self.db.commit()

            try:
                from backend.app.services.alert_service import alert_service
                await alert_service.evaluate_and_dispatch(self.db)
            except Exception as a_err:
                logger.warning(f"Alert evaluation after live sync failed: {a_err}")

            return log


        except Exception as e:
            self.db.rollback()
            logger.error(f"Sync error: {e}")
            log = SyncLog(status="ERROR", terminals_count=0, message=str(e))
            self.db.add(log)
            self.db.commit()
            return log

    def _seed_demo_fleet(self):
        """Seed realistic Starlink fleet data for demonstration and offline testing"""
        locations = [
            ("Pozo Loma Negra #14", "SL-384910-48201-92", "YPF Neuquén", -38.9516, -68.0591),
            ("Estación Cerro Dragón", "SL-492810-19203-11", "Pan American Energy", -45.7483, -68.4239),
            ("Campamento Vaca Muerta Central", "SL-883920-55410-04", "Tecpetrol Añelo", -38.3512, -68.7842),
            ("Barcaza Fluvial Río Paraná", "SL-102948-39201-77", "Naviera del Sur", -32.9468, -60.6393),
            ("Planta Compresora Chihuido", "SL-774920-11029-33", "Pampa Energía", -37.8921, -69.2145),
            ("Puesto Avanzado Cordillera", "SL-554910-22940-58", "Minera Alumbrera", -27.3291, -66.6021),
            ("Base Operativa Comodoro", "SL-993810-77402-99", "TSM Patagonia Central", -45.8641, -67.4965),
            ("Mina San José Santa Cruz", "SL-663810-33019-12", "Hochschild Mining", -46.7214, -70.3842)
        ]

        today = datetime.utcnow()
        cycle_start = (today - timedelta(days=20)).strftime("%Y-%m-%dT00:00:00.000Z")
        cycle_end = (today + timedelta(days=10)).strftime("%Y-%m-%dT23:59:59.000Z")

        for idx, (nickname, sl, account, lat, lng) in enumerate(locations, start=1):
            dev_id = f"ut01000000-00000000-000000{idx:02d}"
            is_online = idx != 4 # Terminal 4 is offline for demonstration
            total_quota = random.choice([500.0, 1000.0, 2000.0])
            consumed = round(random.uniform(0.4, 1.05) * total_quota, 2)
            percent = round((consumed / total_quota) * 100.0, 1)
            alarm = "100" if percent >= 100 else ("80" if percent >= 80 else "NORMAL")

            terminal = Terminal(
                id=dev_id,
                device_id=dev_id,
                raw_device_id=dev_id.removeprefix("ut"),
                nickname=nickname,
                kit_serial=f"KIT00492{idx:03d}",
                service_line_number=sl,
                account_name=account,
                is_online=is_online,
                downlink_mbps=round(random.uniform(110.0, 240.0), 1) if is_online else 0.0,
                uplink_mbps=round(random.uniform(15.0, 35.0), 1) if is_online else 0.0,
                ping_ms=round(random.uniform(28.0, 52.0), 1) if is_online else 0.0,
                drop_rate=round(random.uniform(0.0001, 0.008), 4) if is_online else 1.0,
                obstruction_percent=round(random.uniform(0.0, 1.2), 2) if is_online else 0.0,
                signal_quality=random.randint(92, 100) if is_online else 0,
                uptime_seconds=random.randint(100000, 2500000) if is_online else 0,
                dish_model=random.choice(["Flat High Performance", "Standard Actuated", "High Performance"]),
                dish_serial=f"DISH-0098{idx:03d}",
                has_public_ip=idx % 2 == 1,
                router_id=f"RTR-00{idx:02d}",
                wifi_bypassed=False,
                latitude=lat,
                longitude=lng,
                h3_cell_id="599573887498223615",
                is_alert=alarm != "NORMAL" or not is_online,
                consumed_alarm=alarm
            )
            self.db.add(terminal)

            # Billing cycle
            c_id = 4800 + idx
            b_cycle = BillingCycle(
                id=c_id,
                service_line_number=sl,
                start_date=cycle_start,
                end_date=cycle_end,
                total_amount_gb=total_quota,
                consumed_amount_gb=consumed,
                consumed_percent=percent,
                consumed_alarm=alarm,
                consumed_status="OVERAGE" if percent >= 100 else "ACTIVE",
                is_active=True
            )
            self.db.add(b_cycle)

            # Daily usages (past 20 days)
            for d_idx in range(20):
                d_date = (today - timedelta(days=20 - d_idx)).strftime("%Y-%m-%d")
                base_priority = round(random.uniform(10.0, 45.0), 2)
                opt_in = round(random.uniform(5.0, 20.0), 2) if percent > 100 and d_idx > 15 else 0.0
                standard = round(random.uniform(0.1, 1.5), 2)
                non_bill = round(random.uniform(0.2, 0.8), 2)
                tot = round(base_priority + opt_in + standard + non_bill, 2)

                usage = DailyUsage(
                    billing_cycle_id=c_id,
                    service_line_number=sl,
                    date=d_date,
                    priority_gb=base_priority,
                    opt_in_priority_gb=opt_in,
                    standard_gb=standard,
                    non_bill_gb=non_bill,
                    total_gb=tot
                )
                self.db.add(usage)

        self.db.commit()
        logger.info("Demo fleet seeded successfully with 8 realistic Starlink terminals and consumption history.")
