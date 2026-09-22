import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  RotateCw,
  Sliders,
  Globe,
  Copy,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Zap,
  Clock,
  TrendingUp,
  AlertTriangle,
  Bell,
  BellOff,
  Wifi,
  WifiOff
} from 'lucide-react';

export default function TerminalTable({
  terminals,
  onSelectTerminal,
  onRequestReboot,
  onRequestOptIn,
  onRequestWifiSettings,
  onRequestBypassMode,
  onCopyNotice,
  onOpenAlerts,
  onToggleAlerts
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, online, offline, alerts, burn_rate
  const [sortField, setSortField] = useState('quota_consumed_gb'); // default: consumo mayor a menor
  const [sortOrder, setSortOrder] = useState('desc');
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (text, key, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (onCopyNotice) onCopyNotice(`Copiado al portapapeles: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Métricas numéricas arrancan en 'desc' (mayor a menor), texto en 'asc'
      setSortOrder(field === 'nickname' ? 'asc' : 'desc');
    }
  };

  // 1. Filtrado
  const filteredTerminals = useMemo(() => {
    return (terminals || []).filter(t => {
      // Status filter
      if (statusFilter === 'online' && !t.is_online) return false;
      if (statusFilter === 'offline' && t.is_online) return false;
      if (statusFilter === 'alerts' && t.quota_consumed_percent < 80 && !t.is_alert && !t.is_burn_rate_alert) return false;
      if (statusFilter === 'burn_rate' && !t.is_burn_rate_alert) return false;

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

  // 2. Ordenamiento interactivo
  const sortedTerminals = useMemo(() => {
    const result = [...filteredTerminals];
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'nickname') {
        valA = (a.nickname || a.device_id || '').toLowerCase();
        valB = (b.nickname || b.device_id || '').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortField === 'is_online') { valA = a.is_online ? 1 : 0; valB = b.is_online ? 1 : 0; }
      else if (sortField === 'throughput') { valA = a.downlink_mbps || 0; valB = b.downlink_mbps || 0; }
      else if (sortField === 'quota_consumed_gb') { valA = a.quota_consumed_gb || 0; valB = b.quota_consumed_gb || 0; }
      else if (sortField === 'quota_consumed_percent') { valA = a.quota_consumed_percent || 0; valB = b.quota_consumed_percent || 0; }
      else if (sortField === 'ping_ms') { valA = a.is_online ? (a.ping_ms || 999) : 9999; valB = b.is_online ? (b.ping_ms || 999) : 9999; }
      else if (sortField === 'days_remaining') { valA = a.days_remaining ?? 999; valB = b.days_remaining ?? 999; }


      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [filteredTerminals, sortField, sortOrder]);

  const renderSortIndicator = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-[#64748B] group-hover:text-[#CBD5E1] transition-colors inline ml-1 opacity-60" />;
    }
    return sortOrder === 'desc' ? (
      <ArrowDown className="w-3.5 h-3.5 text-[#F39200] inline ml-1" />
    ) : (
      <ArrowUp className="w-3.5 h-3.5 text-[#F39200] inline ml-1" />
    );
  };

  return (
    <div className="bg-[#1A222B] border border-[#2D3742] rounded-lg overflow-hidden shadow-sm">
      {/* Header controls: Search, Filters & Quick Sort */}
      <div className="p-3.5 sm:p-4 border-b border-[#2D3742] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search bar */}
        <div className="relative w-full lg:w-80">
          <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nickname, serial, SL o cuenta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#141B22] border border-[#2D3742] rounded-md text-xs text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#F39200] transition-colors"
          />
        </div>

        {/* Filter Pills & Quick Sort */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Sort Dropdown for Mobile / Touch */}
          <div className="flex items-center gap-1.5 bg-[#141B22] border border-[#2D3742] rounded-md px-2 py-1 text-xs">
            <span className="text-[#64748B] text-[11px] font-medium hidden sm:inline">Ordenar:</span>
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={e => {
                const [f, o] = e.target.value.split('-');
                setSortField(f);
                setSortOrder(o);
              }}
              className="bg-transparent text-xs text-[#CBD5E1] font-semibold focus:outline-none cursor-pointer"
            >
              <option value="quota_consumed_gb-desc">Mayor Consumo (GB ↓)</option>
              <option value="quota_consumed_gb-asc">Menor Consumo (GB ↑)</option>
              <option value="quota_consumed_percent-desc">Mayor % Cuota (↓)</option>
              <option value="throughput-desc">Mayor Velocidad (↓)</option>
              <option value="ping_ms-asc">Menor Latencia (Ping ↑)</option>
              <option value="nickname-asc">Nombre (A → Z)</option>
            </select>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {[{ id: 'all', label: 'Todos' }, { id: 'online', label: 'Online' }, { id: 'offline', label: 'Offline' }, { id: 'alerts', label: 'Alertas Cuota' }, { id: 'burn_rate', label: '⚡ Ritmo Acelerado' }].map(filter => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === filter.id
                    ? 'bg-[#F39200] text-slate-950 font-bold shadow-sm'
                    : 'bg-[#141B22] text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#222C38] border border-[#2D3742]'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Quick Alert Config Button */}
          {onOpenAlerts && (
            <button
              onClick={onOpenAlerts}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141B22] hover:bg-[rgba(243,146,0,0.16)] text-[#CBD5E1] hover:text-[#F39200] border border-[#2D3742] hover:border-[#F39200]/40 text-xs font-semibold transition-colors shrink-0"
              title="Configurar bots de Telegram y parámetros de alerta"
            >
              <Bell className="w-3.5 h-3.5 text-[#F39200]" />
              <span className="hidden sm:inline">Configurar Alertas</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Table with Column Sort */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#141A20] text-[#94A3B8] uppercase tracking-wider font-semibold border-b border-[#2D3742] select-none">
            <tr className="h-10">
              {/* Enlace / Dispositivo */}
              <th
                onClick={() => handleSort('nickname')}
                className="py-2.5 px-4 lg:px-6 cursor-pointer hover:text-[#F39200] transition-colors group"
                title="Clic para ordenar alfabéticamente"
              >
                Enlace / Dispositivo
                {renderSortIndicator('nickname')}
              </th>

              {/* Estado */}
              <th
                onClick={() => handleSort('is_online')}
                className="py-2.5 px-4 cursor-pointer hover:text-[#F39200] transition-colors group"
                title="Clic para ordenar por estado de conexión"
              >
                Estado
                {renderSortIndicator('is_online')}
              </th>

              {/* Throughput / Latencia */}
              <th
                onClick={() => handleSort('throughput')}
                className="py-2.5 px-4 cursor-pointer hover:text-[#F39200] transition-colors group"
                title="Clic para ordenar por velocidad de bajada"
              >
                Throughput / Latencia
                {renderSortIndicator('throughput')}
              </th>

              {/* Consumo Cuota (Mes) */}
              <th
                onClick={() => handleSort('quota_consumed_gb')}
                className="py-2.5 px-4 min-w-[240px] cursor-pointer hover:text-[#F39200] transition-colors group"
                title="Clic para ordenar de mayor a menor consumo"
              >
                Consumo Cuota (Mes)
                {renderSortIndicator('quota_consumed_gb')}
              </th>

              {/* IP Pública */}
              <th className="py-2.5 px-4 text-center">IP Pública</th>

              {/* Acciones */}
              <th className="py-2.5 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E262F]">
            {sortedTerminals.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-12 text-center text-[#94A3B8]">
                  <AlertTriangle className="w-8 h-8 text-[#64748B] mx-auto mb-2 opacity-50" />
                  No se encontraron terminales con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              sortedTerminals.map(t => {
                const pct = t.quota_consumed_percent || 0;
                const isWarn = pct >= 80 && pct < 100;
                const isCrit = pct >= 100;
                const isBurn = t.is_burn_rate_alert;
                const copyId = `sl-${t.id}`;

                return (
                  <tr
                    key={t.id}
                    className="h-14 hover:bg-[#222C38] transition-colors group cursor-pointer"
                    onClick={() => onSelectTerminal(t.device_id)}
                  >
                    {/* 1. Terminal / Account info */}
                    <td className="py-2.5 px-4 lg:px-6">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#F1F5F9] group-hover:text-[#F39200] transition-colors max-w-[240px] truncate">
                          {t.nickname || t.device_id}
                        </span>
                        {isBurn && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[rgba(243,146,0,0.18)] text-[#F39200] border border-[#F39200]/40 animate-pulse"
                            title="Alerta de Ritmo Acelerado: Al ritmo actual la cuota se agotará antes del cierre de ciclo"
                          >
                            <Zap className="w-2.5 h-2.5" />
                            Burn-Rate
                          </span>
                        )}
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
                        <span className="truncate max-w-[150px]">{t.account_name || 'Milicic S.A.'}</span>
                      </div>
                    </td>

                    {/* 2. Status Badge */}
                    <td className="py-2.5 px-4">
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
                    <td className="py-2.5 px-4">
                      {t.is_online ? (
                        <div className="font-mono text-[11px]">
                          <span className="text-[#00A389] font-bold">↓ {Number(t.downlink_mbps || 0).toFixed(2)}</span>
                          <span className="text-[#64748B] mx-1">/</span>
                          <span className="text-[#CBD5E1]">↑ {Number(t.uplink_mbps || 0).toFixed(2)} MB/s</span>
                          <span className="block text-[10px] text-[#94A3B8]">Ping: {t.ping_ms} ms</span>
                        </div>
                      ) : (
                        <span className="text-[#64748B] font-mono">-</span>
                      )}
                    </td>

                    {/* 4. Quota Progress with Daily Rate & Days Remaining */}
                    <td className="py-2.5 px-4">
                      <div className="flex justify-between items-baseline text-[11px] mb-1">
                        <span className="font-mono text-[#CBD5E1] font-medium">
                          {t.quota_consumed_gb.toFixed(1)} / {t.quota_total_gb.toFixed(0)} GB
                        </span>
                        <span className={`font-bold font-mono px-1.5 py-0.2 rounded text-[11px] ${
                          isCrit
                            ? 'bg-[rgba(229,62,62,0.18)] text-[#E53E3E] border border-[#E53E3E]/30'
                            : isWarn
                            ? 'bg-[rgba(221,107,32,0.18)] text-[#DD6B20] border border-[#DD6B20]/30'
                            : 'bg-[rgba(56,161,105,0.12)] text-[#38A169]'
                        }`}>
                          {pct}%
                        </span>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full h-1.5 bg-[#141B22] rounded-full overflow-hidden border border-[#242D36]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCrit ? 'bg-[#E53E3E]' : isWarn ? 'bg-[#DD6B20]' : isBurn ? 'bg-[#F39200]' : 'bg-[#38A169]'
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>

                      {/* Cycle Remaining Days & Daily Average */}
                      <div className="flex items-center justify-between text-[10px] text-[#64748B] mt-1 font-mono">
                        <span>
                          ⏳ Restan: <strong className="text-[#CBD5E1]">{t.days_remaining != null ? t.days_remaining : 0}d</strong>
                        </span>
                        <span>
                          Ritmo: <strong className="text-[#CBD5E1]">~{t.daily_avg_gb != null ? t.daily_avg_gb.toFixed(1) : 0} GB/d</strong>
                        </span>
                      </div>
                    </td>

                    {/* 5. Public IP */}
                    <td className="py-2.5 px-4 text-center">
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
                    <td className="py-2.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onSelectTerminal(t.device_id)}
                          className="p-1.5 rounded-md bg-[#141B22] hover:bg-[#2D3742] text-[#CBD5E1] hover:text-[#F1F5F9] border border-[#2D3742] transition-colors"
                          title="Ver telemetría y gráficos"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {onRequestWifiSettings && (
                          <button
                            onClick={() => onRequestWifiSettings(t)}
                            className="p-1.5 rounded-md bg-[#141B22] hover:bg-[rgba(243,146,0,0.16)] text-[#CBD5E1] hover:text-[#F39200] border border-[#2D3742] hover:border-[#F39200]/40 transition-colors"
                            title="Editar Wi-Fi (SSID / Password)"
                          >
                            <Wifi className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onRequestBypassMode && (
                          <button
                            onClick={() => onRequestBypassMode(t)}
                            className="p-1.5 rounded-md bg-[#141B22] hover:bg-[rgba(221,107,32,0.16)] text-[#CBD5E1] hover:text-[#DD6B20] border border-[#2D3742] hover:border-[#DD6B20]/40 transition-colors"
                            title={t.wifi_bypassed ? 'Modo Bypass activo (Clic para desactivar)' : 'Habilitar modo Bypass'}
                          >
                            <WifiOff className="w-3.5 h-3.5" />
                          </button>
                        )}

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

                        {onToggleAlerts && (
                          <button
                            onClick={() => onToggleAlerts(t)}
                            className={`p-1.5 rounded-md border transition-colors ${
                              t.alerts_enabled !== false
                                ? 'bg-[#141B22] hover:bg-[rgba(56,161,105,0.16)] text-[#38A169] border-[#2D3742] hover:border-[#38A169]/40'
                                : 'bg-[rgba(229,62,62,0.14)] hover:bg-[rgba(229,62,62,0.25)] text-[#E53E3E] border-[#E53E3E]/40'
                            }`}
                            title={t.alerts_enabled !== false ? 'Alertas activas (Clic para silenciar)' : 'Alertas silenciadas (Clic para activar)'}
                          >
                            {t.alerts_enabled !== false ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                          </button>
                        )}
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
