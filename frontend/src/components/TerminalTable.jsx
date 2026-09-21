import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Eye,
  RotateCw,
  Sliders,
  Wifi,
  WifiOff,
  AlertTriangle,
  Globe,
  ArrowUpDown
} from 'lucide-react';

export default function TerminalTable({ terminals, onSelectTerminal, onRequestReboot, onRequestOptIn }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, online, offline, alerts

  const filteredTerminals = useMemo(() => {
    return (terminals || []).filter(t => {
      // Status filter
      if (statusFilter === 'online' && !t.is_online) return false;
      if (statusFilter === 'offline' && t.is_online) return false;
      if (statusFilter === 'alerts' && t.quota_consumed_percent < 80 && !t.is_alert) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesNick = t.nickname?.toLowerCase().includes(q);
        const matchesSerial = t.kit_serial?.toLowerCase().includes(q);
        const matchesLine = t.service_line_number?.toLowerCase().includes(q);
        const matchesAccount = t.account_name?.toLowerCase().includes(q);
        const matchesId = t.device_id?.toLowerCase().includes(q);
        return matchesNick || matchesSerial || matchesLine || matchesAccount || matchesId;
      }
      return true;
    });
  }, [terminals, search, statusFilter]);

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      {/* Header controls: Search & Filters */}
      <div className="p-4 sm:p-5 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search bar */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, serial, SL o cuenta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'online', label: 'Online' },
            { id: 'offline', label: 'Offline' },
            { id: 'alerts', label: 'En Alarma' },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === filter.id
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-white/5">
            <tr>
              <th className="py-3.5 px-4 lg:px-6">Enlace / Dispositivo</th>
              <th className="py-3.5 px-4">Estado</th>
              <th className="py-3.5 px-4">Rendimiento</th>
              <th className="py-3.5 px-4 min-w-[200px]">Consumo Cuota (Ciclo)</th>
              <th className="py-3.5 px-4 text-center">IP Pública</th>
              <th className="py-3.5 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredTerminals.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-12 text-center text-slate-400">
                  No se encontraron terminales con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredTerminals.map(t => {
                const pct = t.quota_consumed_percent || 0;
                const isWarn = pct >= 80 && pct < 100;
                const isCrit = pct >= 100;

                return (
                  <tr
                    key={t.id}
                    className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                    onClick={() => onSelectTerminal(t.device_id)}
                  >
                    {/* 1. Terminal / Account info */}
                    <td className="py-3.5 px-4 lg:px-6">
                      <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {t.nickname || t.device_id}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span className="font-mono">{t.service_line_number || 'Sin SL'}</span>
                        <span>•</span>
                        <span>{t.account_name || 'TSM Patagonia'}</span>
                      </div>
                    </td>

                    {/* 2. Status & Ping */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          t.is_online
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${t.is_online ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {t.is_online ? 'Online' : 'Offline'}
                        </span>
                        {t.is_online && (
                          <span className="font-mono text-slate-400 text-[11px]">
                            {t.ping_ms} ms
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. Throughput */}
                    <td className="py-3.5 px-4">
                      {t.is_online ? (
                        <div className="font-mono text-[11px]">
                          <span className="text-blue-400 font-bold">↓ {t.downlink_mbps}</span>
                          <span className="text-slate-500 mx-1">/</span>
                          <span className="text-slate-300 font-medium">↑ {t.uplink_mbps} Mbps</span>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono">-</span>
                      )}
                    </td>

                    {/* 4. Quota Bar */}
                    <td className="py-3.5 px-4">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-mono text-slate-300">
                          {t.quota_consumed_gb.toFixed(1)} / {t.quota_total_gb.toFixed(0)} GB
                        </span>
                        <span className={`font-bold font-mono ${
                          isCrit ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCrit ? 'bg-rose-500' : isWarn ? 'bg-amber-400' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </td>

                    {/* 5. Public IP */}
                    <td className="py-3.5 px-4 text-center">
                      {t.has_public_ip ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold">
                          <Globe className="w-3 h-3" />
                          Sí
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">-</span>
                      )}
                    </td>

                    {/* 6. Quick Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectTerminal(t.device_id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                          title="Ver telemetría y gráficos"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRequestReboot(t)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-all"
                          title="Reiniciar antena de forma remota"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRequestOptIn(t)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 transition-all"
                          title="Gestionar Data Opt-In (Overage)"
                        >
                          <Sliders className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
