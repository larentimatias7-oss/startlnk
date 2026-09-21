import React from 'react';
import { Wifi, WifiOff, HardDrive, AlertOctagon, TrendingUp, Gauge, Radio } from 'lucide-react';

export default function KpiCards({ kpis, terminals }) {
  if (!kpis) return null;

  // Compute average ping & total throughput from online terminals
  const onlineTerminals = terminals?.filter(t => t.is_online) || [];
  const avgPing = onlineTerminals.length > 0
    ? (onlineTerminals.reduce((acc, t) => acc + (t.ping_ms || 0), 0) / onlineTerminals.length).toFixed(1)
    : 0;
  const totalDownlink = onlineTerminals.reduce((acc, t) => acc + (t.downlink_mbps || 0), 0).toFixed(0);

  const quotaPercent = kpis.fleet_quota_consumed_percent || 0;
  const isHighQuota = quotaPercent >= 80;
  const isCriticalQuota = quotaPercent >= 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Terminales y Conectividad */}
      <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Flota de Terminales
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black text-white tracking-tight">
            {kpis.total_terminals}
          </span>
          <span className="text-xs text-slate-400 font-medium">enlaces activos</span>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-white/5 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>{kpis.online_count} Online</span>
          </div>
          {kpis.offline_count > 0 && (
            <div className="flex items-center gap-1 text-rose-400 font-semibold">
              <WifiOff className="w-3.5 h-3.5" />
              <span>{kpis.offline_count} Offline</span>
            </div>
          )}
          <span className="ml-auto text-slate-400 font-mono">
            {kpis.availability_percent}% Disp.
          </span>
        </div>
      </div>

      {/* 2. Consumo Total de Flota */}
      <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Consumo Flota (Mes)
          </span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black text-white tracking-tight">
            {kpis.total_consumed_month_gb.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 font-medium">/ {kpis.total_quota_month_gb.toLocaleString()} GB</span>
        </div>

        <div className="pt-2 border-t border-white/5">
          <div className="flex justify-between text-xs mb-1.5 font-medium">
            <span className="text-slate-400">Cuota Utilizada</span>
            <span className={isCriticalQuota ? 'text-rose-400 font-bold' : isHighQuota ? 'text-amber-400' : 'text-cyan-400'}>
              {quotaPercent}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCriticalQuota ? 'bg-rose-500' : isHighQuota ? 'bg-amber-400' : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
              }`}
              style={{ width: `${Math.min(quotaPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Rendimiento y Salud RF */}
      <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-blue-500/30 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Rendimiento RF Promedio
          </span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Gauge className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black text-white tracking-tight">
            {avgPing}
          </span>
          <span className="text-xs text-slate-400 font-medium">ms latencia</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
          <span>Downlink Agregado:</span>
          <span className="font-bold text-blue-400 font-mono">
            {totalDownlink} Mbps
          </span>
        </div>
      </div>

      {/* 4. Alertas de Cuota & Excedente */}
      <div className={`glass-panel rounded-2xl p-5 relative overflow-hidden group transition-all ${
        kpis.terminals_in_critical > 0 ? 'border-rose-500/40 glow-rose' : kpis.terminals_in_warning > 0 ? 'border-amber-500/30' : ''
      }`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Alertas de Cuota
          </span>
          <div className={`p-2 rounded-xl border ${
            kpis.terminals_in_critical > 0
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-3xl font-black tracking-tight ${
            kpis.terminals_in_critical > 0 ? 'text-rose-400' : kpis.terminals_in_warning > 0 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {kpis.terminals_in_critical + kpis.terminals_in_warning}
          </span>
          <span className="text-xs text-slate-400 font-medium">enlaces en umbral</span>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-white/5 text-xs">
          <span className="text-rose-400 font-semibold">
            {kpis.terminals_in_critical} al 100%
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400 font-semibold">
            {kpis.terminals_in_warning} al 80%
          </span>
        </div>
      </div>
    </div>
  );
}
