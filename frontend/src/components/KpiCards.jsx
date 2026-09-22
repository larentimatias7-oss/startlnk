import React from 'react';
import { Radio, HardDrive, Gauge, AlertOctagon, WifiOff } from 'lucide-react';

export default function KpiCards({ kpis, terminals, onOpenAlerts }) {
  if (!kpis) return null;

  // Cálculos de latencia promedio y downlink agregado de terminales online
  const onlineTerminals = terminals?.filter(t => t.is_online) || [];
  const avgPing = onlineTerminals.length > 0
    ? (onlineTerminals.reduce((acc, t) => acc + (t.ping_ms || 0), 0) / onlineTerminals.length).toFixed(1)
    : 0;
  const totalDownlink = onlineTerminals.reduce((acc, t) => acc + (t.downlink_mbps || 0), 0).toFixed(0);

  const quotaPercent = kpis.fleet_quota_consumed_percent || 0;
  const isHighQuota = quotaPercent >= 80 && quotaPercent < 100;
  const isCriticalQuota = quotaPercent >= 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Flota de Terminales */}
      <div className="bg-[#1A222B] border border-[#2D3742] rounded-lg p-4 hover:border-[#F39200]/40 transition-colors shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            Flota de Terminales
          </span>
          <div className="p-1.5 rounded-md bg-[rgba(243,146,0,0.16)] text-[#F39200] border border-[rgba(243,146,0,0.3)]">
            <Radio className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl lg:text-3xl font-black text-[#F1F5F9] font-mono tracking-tight">
            {kpis.total_terminals}
          </span>
          <span className="text-xs text-[#94A3B8]">enlaces registrados</span>
        </div>

        <div className="flex items-center justify-between pt-2.5 border-t border-[#242D36] text-xs">
          <div className="flex items-center gap-1.5 text-[#38A169] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#38A169]"></span>
            <span>{kpis.online_count} Online</span>
          </div>
          {kpis.offline_count > 0 ? (
            <div className="flex items-center gap-1 text-[#E53E3E] font-semibold">
              <WifiOff className="w-3.5 h-3.5" />
              <span>{kpis.offline_count} Offline</span>
            </div>
          ) : (
            <span className="text-[#38A169] text-[11px] font-semibold">100% Operativo</span>
          )}
          <span className="text-[#94A3B8] font-mono text-[11px]">
            {kpis.availability_percent}% Disp.
          </span>
        </div>
      </div>

      {/* 2. Consumo Flota Mensual */}
      <div className="bg-[#1A222B] border border-[#2D3742] rounded-lg p-4 hover:border-[#F39200]/40 transition-colors shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            Consumo Mensual Flota
          </span>
          <div className="p-1.5 rounded-md bg-[rgba(49,130,206,0.16)] text-[#3182CE] border border-[rgba(49,130,206,0.3)]">
            <HardDrive className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl lg:text-3xl font-black text-[#F1F5F9] font-mono tracking-tight">
            {kpis.total_consumed_month_gb.toLocaleString()}
          </span>
          <span className="text-xs text-[#94A3B8] font-mono">/ {kpis.total_quota_month_gb.toLocaleString()} GB</span>
        </div>

        <div className="pt-2.5 border-t border-[#242D36]">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-[#94A3B8]">Cuota Utilizada</span>
            <span className={`font-mono font-bold ${
              isCriticalQuota ? 'text-[#E53E3E]' : isHighQuota ? 'text-[#DD6B20]' : 'text-[#F39200]'
            }`}>
              {quotaPercent}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#141B22] rounded-full overflow-hidden border border-[#242D36]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCriticalQuota ? 'bg-[#E53E3E]' : isHighQuota ? 'bg-[#DD6B20]' : 'bg-[#F39200]'
              }`}
              style={{ width: `${Math.min(quotaPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Rendimiento RF Promedio */}
      <div className="bg-[#1A222B] border border-[#2D3742] rounded-lg p-4 hover:border-[#F39200]/40 transition-colors shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            Rendimiento RF Promedio
          </span>
          <div className="p-1.5 rounded-md bg-[rgba(56,161,105,0.16)] text-[#38A169] border border-[rgba(56,161,105,0.3)]">
            <Gauge className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl lg:text-3xl font-black text-[#F1F5F9] font-mono tracking-tight">
            {avgPing}
          </span>
          <span className="text-xs text-[#94A3B8]">ms latencia</span>
        </div>

        <div className="flex items-center justify-between pt-2.5 border-t border-[#242D36] text-xs">
          <span className="text-[#94A3B8]">Throughput Downlink:</span>
          <span className="font-bold text-[#3182CE] font-mono">
            {totalDownlink} Mbps
          </span>
        </div>
      </div>

      {/* 4. Alertas de Cuota & Umbrales (Con Acceso Directo) */}
      <div className={`bg-[#1A222B] border rounded-lg p-4 transition-colors shadow-sm flex flex-col justify-between ${
        kpis.terminals_in_critical > 0
          ? 'border-[#E53E3E]/60 bg-[rgba(229,62,62,0.06)]'
          : kpis.terminals_in_warning > 0
          ? 'border-[#DD6B20]/60'
          : 'border-[#2D3742]'
      }`}>
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Alertas de Cuota
            </span>
            <div className={`p-1.5 rounded-md border ${
              kpis.terminals_in_critical > 0
                ? 'bg-[rgba(229,62,62,0.16)] text-[#E53E3E] border-[#E53E3E]/40'
                : 'bg-[rgba(221,107,32,0.16)] text-[#DD6B20] border-[#DD6B20]/40'
            }`}>
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-2xl lg:text-3xl font-black font-mono tracking-tight ${
              kpis.terminals_in_critical > 0 ? 'text-[#E53E3E]' : kpis.terminals_in_warning > 0 ? 'text-[#DD6B20]' : 'text-[#38A169]'
            }`}>
              {kpis.terminals_in_critical + kpis.terminals_in_warning}
            </span>
            <span className="text-xs text-[#94A3B8]">enlaces en umbral</span>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[#242D36] text-xs">
            <span className="text-[#E53E3E] font-semibold font-mono">
              {kpis.terminals_in_critical} al 100%
            </span>
            <span className="text-[#2D3742]">|</span>
            <span className="text-[#DD6B20] font-semibold font-mono">
              {kpis.terminals_in_warning} al 80%
            </span>
          </div>
        </div>

        {/* CTA to configure alerts & telegram */}
        {onOpenAlerts && (
          <button
            type="button"
            onClick={onOpenAlerts}
            className="mt-3 w-full py-1.5 px-2.5 rounded-md bg-[#141B22] hover:bg-[rgba(243,146,0,0.16)] text-[#CBD5E1] hover:text-[#F39200] border border-[#2D3742] hover:border-[#F39200]/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <span>Configurar Alertas & Telegram →</span>
          </button>
        )}
      </div>
    </div>
  );
}

