import React from 'react';
import { Satellite, RefreshCw, Activity, Bell } from 'lucide-react';
import MilicicLogo from './MilicicLogo';

export default function Header({
  kpis,
  isSyncing,
  onSync,
  onRefresh,
  onOpenAlerts,
  activeView,
  onSelectView
}) {
  return (
    <header className="border-b border-[#2D3742] bg-[#141A20] sticky top-0 z-30 px-4 lg:px-8 h-14 min-h-[56px] flex items-center shadow-md">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
        {/* Brand Section: Milicic Logo + TSM ECHO Starlink Fleet */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center pr-3.5 border-r border-[#2D3742]">
            <MilicicLogo height={28} white={true} />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-md bg-[#F39200] text-slate-950 font-black shadow-sm">
              <Satellite className="w-4 h-4 text-slate-950" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38A169] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#38A169]"></span>
              </span>
            </div>

            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="text-sm lg:text-base font-bold text-[#F1F5F9] tracking-tight">
                  TSM ECHO <span className="text-[#F39200] font-normal">| Starlink Fleet</span>
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-[rgba(243,146,0,0.16)] text-[#F39200] border border-[rgba(243,146,0,0.4)]">
                  v1.0 Live
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8] hidden sm:block">
                Telemetría y Monitoreo de Consumo de Enlaces Satelitales
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Sync Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* ECHO Live Status Badge */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#1A222B] border border-[#2D3742] text-xs text-[#CBD5E1]">
            <Activity className="w-3.5 h-3.5 text-[#38A169]" />
            <span className="text-[#94A3B8] hidden lg:inline">API ECHO:</span>
            <span className="font-semibold text-[#38A169]">Online</span>
          </div>

          {/* Last Sync Timestamp */}
          {kpis?.last_sync_time && (
            <span className="hidden xl:block text-xs text-[#94A3B8] font-mono px-2.5 py-1 bg-[#141B22] rounded-md border border-[#242D36]">
              Sync: {new Date(kpis.last_sync_time).toLocaleTimeString()}
            </span>
          )}

          {/* Alerts & Telegram Button (Prominently styled) */}
          <button
            onClick={() => {
              if (onSelectView) onSelectView('alerts');
              else if (onOpenAlerts) onOpenAlerts();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all border ${
              activeView === 'alerts'
                ? 'bg-[#F39200] text-slate-950 border-[#F39200] shadow-sm'
                : 'bg-[#1A222B] hover:bg-[#222C38] text-[#CBD5E1] hover:text-[#F1F5F9] border-[#2D3742] hover:border-[#F39200]/50'
            }`}
            title="Configurar bots de Telegram y parámetros de alertas"
          >
            <Bell className={`w-3.5 h-3.5 ${activeView === 'alerts' ? 'text-slate-950' : 'text-[#F39200]'}`} />
            <span>Alertas & Telegram</span>
          </button>

          {/* Sync Button */}
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[#F39200] hover:bg-[#D98200] active:bg-[#B56D00] disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors shadow-sm"
            title="Sincronizar telemetría y consumos con TSM ECHO"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
