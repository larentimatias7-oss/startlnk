import React from 'react';
import { Satellite, RefreshCw, Activity } from 'lucide-react';
import MilicicLogo from './MilicicLogo';

export default function Header({ kpis, isSyncing, onSync, onRefresh, lastUpdated }) {
  const isEchoConfigured = kpis?.sync_status !== 'UNKNOWN';
  
  return (
    <header className="border-b border-[#2D3742] bg-[#141A20]/95 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-2.5 min-h-[56px] flex items-center">
      <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand: Milicic + TSM ECHO Starlink Fleet */}
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {/* Logo Corporativo Milicic con contraste automático */}
          <div className="flex items-center pr-3 border-r border-[#2D3742]">
            <MilicicLogo height={30} white={true} />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-tr from-[#F39200] to-[#D98200] shadow-md shadow-[#F39200]/20 text-white">
              <Satellite className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base lg:text-lg font-black tracking-tight text-white">
                  TSM ECHO <span className="text-[#F39200] font-light">| Starlink Fleet</span>
                </h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#F39200]/15 text-[#F39200] border border-[#F39200]/30">
                  v1.0 Live
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                Telemetría y Monitoreo de Consumo de Enlaces Satelitales
              </p>
            </div>
          </div>
        </div>

        {/* Sync & Status Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* ECHO Connection Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A222B] border border-[#2D3742] text-xs text-[#CBD5E1]">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>API ECHO:</span>
            <span className="font-semibold text-emerald-400">Online</span>
          </div>

          {/* Last sync time */}
          {kpis?.last_sync_time && (
            <span className="hidden lg:block text-xs text-[#94A3B8] font-mono">
              Sync: {new Date(kpis.last_sync_time).toLocaleTimeString()}
            </span>
          )}

          {/* Sync Now Button */}
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#F39200] hover:bg-[#D98200] active:scale-95 disabled:opacity-50 text-slate-950 font-bold text-xs transition-all shadow-md shadow-[#F39200]/20"
            title="Consultar API de TSM ECHO y actualizar base de datos local"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar ECHO'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
