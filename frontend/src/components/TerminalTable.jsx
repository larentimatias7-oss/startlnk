import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  RotateCw,
  Sliders,
  Globe,
  Copy,
  Check
} from 'lucide-react';

export default function TerminalTable({
  terminals,
  onSelectTerminal,
  onRequestReboot,
  onRequestOptIn,
  onCopyNotice
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, online, offline, alerts
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (text, key, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (onCopyNotice) onCopyNotice(`Copiado al portapapeles: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

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
    <div className="bg-[#1A222B] border border-[#2D3742] rounded-lg overflow-hidden shadow-sm">
      {/* Header controls: Search & Filters */}
      <div className="p-3.5 sm:p-4 border-b border-[#2D3742] flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search bar */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nickname, serial, SL o cuenta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#141B22] border border-[#2D3742] rounded-md text-xs text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#F39200] transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'online', label: 'Online' },
            { id: 'offline', label: 'Offline' },
            { id: 'alerts', label: 'En Alarma' },
          ].map(filter => {
            const isActive = statusFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#F39200] text-slate-950 font-bold shadow-sm'
                    : 'bg-[#141B22] text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#222C38] border border-[#2D3742]'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#141A20] text-[#94A3B8] uppercase tracking-wider font-semibold border-b border-[#2D3742]">
            <tr className="h-10">
              <th className="py-2.5 px-4 lg:px-6">Enlace / Dispositivo</th>
              <th className="py-2.5 px-4">Estado</th>
              <th className="py-2.5 px-4">Throughput / Latencia</th>
              <th className="py-2.5 px-4 min-w-[190px]">Consumo Cuota (Mes)</th>
              <th className="py-2.5 px-4 text-center">IP Pública</th>
              <th className="py-2.5 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E262F]">
            {filteredTerminals.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-10 text-center text-[#94A3B8]">
                  No se encontraron terminales con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredTerminals.map(t => {
                const pct = t.quota_consumed_percent || 0;
                const isWarn = pct >= 80 && pct < 100;
                const isCrit = pct >= 100;
                const copyId = `sl-${t.id}`;

                return (
                  <tr
                    key={t.id}
                    className="h-12 hover:bg-[#222C38] transition-colors group cursor-pointer"
                    onClick={() => onSelectTerminal(t.device_id)}
                  >
                    {/* 1. Terminal / Account info */}
                    <td className="py-2 px-4 lg:px-6">
                      <div className="font-bold text-[#F1F5F9] group-hover:text-[#F39200] transition-colors max-w-[220px] truncate">
                        {t.nickname || t.device_id}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#94A3B8]">
                        <span className="font-mono text-[#CBD5E1]">{t.service_line_number || 'Sin SL'}</span>
                        {t.service_line_number && (
                          <button
                            onClick={(e) => handleCopy(t.service_line_number, copyId, e)}
                            className="p-0.5 hover:text-[#F39200] text-[#64748B] transition-colors"
                            title="Copiar número de línea"
                          >
                            {copiedKey === copyId ? (
                              <Check className="w-3 h-3 text-[#38A169]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                        <span>•</span>
                        <span className="truncate max-w-[140px]">{t.account_name || 'Milicic S.A.'}</span>
                      </div>
                    </td>

                    {/* 2. Status Badge */}
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          t.is_online
                            ? 'bg-[rgba(56,161,105,0.16)] text-[#38A169] border border-[#38A169]/30'
                            : 'bg-[rgba(229,62,62,0.16)] text-[#E53E3E] border border-[#E53E3E]/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${t.is_online ? 'bg-[#38A169]' : 'bg-[#E53E3E]'}`} />
                          {t.is_online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </td>

                    {/* 3. Throughput & Ping */}
                    <td className="py-2 px-4">
                      {t.is_online ? (
                        <div className="font-mono text-[11px]">
                          <span className="text-[#3182CE] font-bold">↓ {t.downlink_mbps}</span>
                          <span className="text-[#64748B] mx-1">/</span>
                          <span className="text-[#CBD5E1]">↑ {t.uplink_mbps} Mbps</span>
                          <span className="block text-[10px] text-[#94A3B8]">Ping: {t.ping_ms} ms</span>
                        </div>
                      ) : (
                        <span className="text-[#64748B] font-mono">-</span>
                      )}
                    </td>

                    {/* 4. Quota Progress */}
                    <td className="py-2 px-4">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-mono text-[#CBD5E1]">
                          {t.quota_consumed_gb.toFixed(1)} / {t.quota_total_gb.toFixed(0)} GB
                        </span>
                        <span className={`font-bold font-mono ${
                          isCrit ? 'text-[#E53E3E]' : isWarn ? 'text-[#DD6B20]' : 'text-[#38A169]'
                        }`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#141B22] rounded-full overflow-hidden border border-[#242D36]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCrit ? 'bg-[#E53E3E]' : isWarn ? 'bg-[#DD6B20]' : 'bg-[#F39200]'
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </td>

                    {/* 5. Public IP */}
                    <td className="py-2 px-4 text-center">
                      {t.has_public_ip ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[rgba(49,130,206,0.16)] text-[#3182CE] border border-[#3182CE]/30 text-[10px] font-bold">
                          <Globe className="w-3 h-3" />
                          Sí
                        </span>
                      ) : (
                        <span className="text-[#64748B] text-[11px] font-mono">No</span>
                      )}
                    </td>

                    {/* 6. Quick Actions */}
                    <td className="py-2 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onSelectTerminal(t.device_id)}
                          className="p-1.5 rounded-md bg-[#141B22] hover:bg-[#2D3742] text-[#CBD5E1] hover:text-[#F1F5F9] border border-[#2D3742] transition-colors"
                          title="Ver telemetría y gráficos"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRequestReboot(t)}
                          className="p-1.5 rounded-md bg-[#141B22] hover:bg-[rgba(229,62,62,0.16)] text-[#CBD5E1] hover:text-[#E53E3E] border border-[#2D3742] hover:border-[#E53E3E]/40 transition-colors"
                          title="Reiniciar antena de forma remota"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRequestOptIn(t)}
                          className="p-1.5 rounded-md bg-[#141B22] hover:bg-[rgba(243,146,0,0.16)] text-[#CBD5E1] hover:text-[#F39200] border border-[#2D3742] hover:border-[#F39200]/40 transition-colors"
                          title="Gestionar Data Opt-In (Overage)"
                        >
                          <Sliders className="w-3.5 h-3.5" />
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
