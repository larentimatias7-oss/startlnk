import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  HardDrive,
  RotateCw,
  Sliders,
  Activity,
  BarChart3,
  Shield,
  Clock,
  MapPin,
  Globe,
  CheckCircle2,
  Bell,
  BellOff,
  Wifi,
  WifiOff
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import ConnectivityHealthWidget from './ConnectivityHealthWidget.jsx';

export default function TerminalDetailModal({
  deviceId,
  onClose,
  onRequestReboot,
  onRequestOptIn,
  onRequestWifiSettings,
  onRequestBypassMode,
  onToggleAlerts
}) {
  const [activeTab, setActiveTab] = useState('telemetry'); // telemetry, billing, actions
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/terminals/${deviceId}`).then(r => {
        if (!r.ok) throw new Error('Terminal no encontrado');
        return r.json();
      }),
      fetch(`/api/terminals/${deviceId}/usage-history`).then(r => {
        if (!r.ok) throw new Error('Error al cargar historial de uso');
        return r.json();
      })
    ])
      .then(([detailData, historyData]) => {
        setDetail(detailData);
        setHistory(historyData);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [deviceId]);

  if (!deviceId) return null;

  const formatUptime = (seconds) => {
    if (!seconds) return '0h';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1A222B] border border-[#2D3742] rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[#2D3742] flex items-center justify-between bg-[#141A20]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-[rgba(243,146,0,0.16)] text-[#F39200] border border-[rgba(243,146,0,0.3)]">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#F1F5F9]">
                  {detail?.nickname || deviceId}
                </h2>
                {detail && (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    detail.is_online
                      ? 'bg-[rgba(56,161,105,0.16)] text-[#38A169] border border-[#38A169]/30'
                      : 'bg-[rgba(229,62,62,0.16)] text-[#E53E3E] border border-[#E53E3E]/30'
                  }`}>
                    {detail.is_online ? 'ONLINE' : 'OFFLINE'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#94A3B8] font-mono">
                {deviceId} {detail?.service_line_number && `• Línea: ${detail.service_line_number}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#222C38] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 bg-[#141B22] border-b border-[#2D3742] flex gap-6 text-xs font-semibold">
          {[
            { id: 'telemetry', label: 'Telemetría RF & Hardware', icon: Activity },
            { id: 'billing', label: 'Consumo & Ciclo Activo', icon: BarChart3 },
            { id: 'actions', label: 'Control Remoto', icon: Shield },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
                  isActive ? 'border-[#F39200] text-[#F39200] font-bold' : 'border-transparent text-[#94A3B8] hover:text-[#CBD5E1]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body with Divulgación Progresiva */}
        <div className="p-5 overflow-y-auto space-y-4 max-h-[calc(85vh-115px)] scrollbar-thin scrollbar-thumb-[#2D3742]">
          {loading ? (
            <div className="py-16 text-center text-[#94A3B8] text-xs flex flex-col items-center gap-2">
              <RotateCw className="w-6 h-6 animate-spin text-[#F39200]" />
              <span>Cargando telemetría e histórico de Starlink...</span>
            </div>
          ) : error ? (
            <div className="p-3.5 rounded-md bg-[rgba(229,62,62,0.16)] border border-[#E53E3E]/40 text-[#F1F5F9] text-xs">
              {error}
            </div>
          ) : detail ? (
            <>
              {/* TAB 1: TELEMETRÍA RF Y HARDWARE */}
              {activeTab === 'telemetry' && (
                <div className="space-y-4">
                  {/* Connectivity & Health (ECHO Live Telemetry Widget) */}
                  <ConnectivityHealthWidget
                    terminal={detail}
                    onOpenReboot={onRequestReboot}
                    onOpenWifiSettings={onRequestWifiSettings}
                    onOpenBypassMode={onRequestBypassMode}
                  />

                  {/* Secondary RF Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-md bg-[#141B22] border border-[#2D3742]">
                      <span className="text-[11px] font-semibold text-[#94A3B8] block mb-1">Latencia Ping</span>
                      <span className="text-lg font-mono font-black text-[#F1F5F9]">{detail.ping_ms} ms</span>
                    </div>
                    <div className="p-3 rounded-md bg-[#141B22] border border-[#2D3742]">
                      <span className="text-[11px] font-semibold text-[#94A3B8] block mb-1">Calidad Señal</span>
                      <span className="text-lg font-mono font-black text-[#38A169]">{detail.signal_quality}%</span>
                    </div>
                    <div className="p-3 rounded-md bg-[#141B22] border border-[#2D3742]">
                      <span className="text-[11px] font-semibold text-[#94A3B8] block mb-1">Obstrucción RF</span>
                      <span className="text-lg font-mono font-black text-[#CBD5E1]">{detail.obstruction_percent}%</span>
                    </div>
                    <div className="p-3 rounded-md bg-[#141B22] border border-[#2D3742]">
                      <span className="text-[11px] font-semibold text-[#94A3B8] block mb-1">Modo Wi-Fi</span>
                      <span className={`text-xs font-mono font-bold ${detail.wifi_bypassed ? 'text-[#DD6B20]' : 'text-[#38A169]'}`}>
                        {detail.wifi_bypassed ? 'Bypass (Puente)' : 'Wi-Fi Activo'}
                      </span>
                    </div>
                  </div>

                  {/* Hardware and Network Inventory */}
                  <div className="bg-[#141B22] border border-[#2D3742] rounded-md p-4">
                    <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider mb-3">
                      Especificaciones de Hardware y Red
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      {[
                        { label: 'Modelo de Antena:', val: detail.dish_model || 'Flat High Performance' },
                        { label: 'Serial Antena / Dish:', val: detail.dish_serial || detail.kit_serial || 'N/A', mono: true },
                        { label: 'Serial del Kit:', val: detail.kit_serial || 'N/A', mono: true },
                        { label: 'Router ID:', val: detail.router_id || 'Integrado', mono: true },
                        { label: 'IP Pública:', val: detail.has_public_ip ? 'Habilitada' : 'CGNAT Privada', color: detail.has_public_ip ? 'text-[#3182CE]' : 'text-[#94A3B8]' },
                        { label: 'Uptime:', val: formatUptime(detail.uptime_seconds), mono: true },
                      ].map((item, i) => (
                        <div key={i}>
                          <span className="text-[#94A3B8] block text-[11px]">{item.label}</span>
                          <span className={`text-[#F1F5F9] font-medium ${item.mono ? 'font-mono' : ''} ${item.color || ''}`}>{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Geolocation info if available */}
                  {(detail.latitude || detail.h3_cell_id) && (
                    <div className="bg-[#141B22] border border-[#2D3742] rounded-md p-3.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#F39200]" />
                        <span className="text-[#CBD5E1]">
                          Coordenadas: <span className="font-mono text-[#F1F5F9]">{detail.latitude?.toFixed(4)}, {detail.longitude?.toFixed(4)}</span>
                        </span>
                      </div>
                      {detail.h3_cell_id && (
                        <span className="text-[#94A3B8] font-mono text-[11px]">
                          Celda H3: {detail.h3_cell_id}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CICLO DE FACTURACIÓN Y CONSUMO DIARIO */}
              {activeTab === 'billing' && (
                <div className="space-y-4">
                  {detail.billing_cycle && (
                    <div className="p-4 rounded-md bg-[#141B22] border border-[#2D3742] space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-[#F39200]" />
                          <span className="font-bold text-[#F1F5F9] uppercase tracking-wider">
                            Ciclo Activo #{detail.billing_cycle.id}
                          </span>
                        </div>
                        {detail.billing_cycle.start_date && (
                          <span className="text-[#94A3B8] font-mono text-[11px]">
                            {detail.billing_cycle.start_date.split('T')[0]} al {detail.billing_cycle.end_date?.split('T')[0]}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-[#CBD5E1]">
                          Consumo acumulado: <strong className="text-[#F1F5F9] font-mono">{detail.billing_cycle.consumed_amount_gb} GB</strong> de <strong className="text-[#F1F5F9] font-mono">{detail.billing_cycle.total_amount_gb} GB</strong>
                        </span>
                        <span className={`font-mono font-bold text-sm ${
                          detail.billing_cycle.consumed_percent >= 100
                            ? 'text-[#E53E3E]'
                            : detail.billing_cycle.consumed_percent >= 80
                            ? 'text-[#DD6B20]'
                            : 'text-[#38A169]'
                        }`}>
                          {detail.billing_cycle.consumed_percent}%
                        </span>
                      </div>

                      <div className="w-full h-2 bg-[#0F141A] rounded-full overflow-hidden border border-[#242D36]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            detail.billing_cycle.consumed_percent >= 100
                              ? 'bg-[#E53E3E]'
                              : detail.billing_cycle.consumed_percent >= 80
                              ? 'bg-[#DD6B20]'
                              : 'bg-[#F39200]'
                          }`}
                          style={{ width: `${Math.min(detail.billing_cycle.consumed_percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Recharts Daily Bar Chart */}
                  {history && history.daily_usages && history.daily_usages.length > 0 && (
                    <div className="bg-[#141B22] border border-[#2D3742] rounded-md p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">
                          Consumo Diario Desglosado por Tipo de Tráfico
                        </h4>
                        <span className="text-xs font-mono text-[#94A3B8]">
                          Total Ciclo: <strong className="text-[#F39200]">{history.total_consumed_gb} GB</strong>
                        </span>
                      </div>

                      <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={history.daily_usages.map(u => ({
                              ...u,
                              displayDate: u.date.split('-').slice(1).join('/')
                            }))}
                            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#242D36" vertical={false} />
                            <XAxis dataKey="displayDate" stroke="#64748B" fontSize={10} tickLine={false} />
                            <YAxis stroke="#64748B" fontSize={10} tickLine={false} width={55} unit=" GB" />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#141B22', borderColor: '#2D3742', borderRadius: '6px', fontSize: '11px', color: '#F1F5F9' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#94A3B8' }} />
                            <Bar dataKey="priority_gb" name="Prioridad" stackId="a" fill="#38A169" />
                            <Bar dataKey="opt_in_priority_gb" name="Opt-In Excedente" stackId="a" fill="#F39200" />
                            <Bar dataKey="standard_gb" name="Estándar" stackId="a" fill="#3182CE" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CONTROL REMOTO */}
              {activeTab === 'actions' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-md bg-[#141B22] border border-[#2D3742]">
                    <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider mb-1">
                      Instrucciones Operativas hacia Starlink Backoffice
                    </h3>
                    <p className="text-xs text-[#94A3B8] mb-4">
                      Todas las acciones críticas requieren diálogo de doble confirmación interactivo antes de ejecutarse.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Reboot Card */}
                      <div className="p-3.5 rounded-md bg-[#1A222B] border border-[#2D3742] flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1 text-xs font-bold text-[#F1F5F9]">
                            <RotateCw className="w-4 h-4 text-[#E53E3E]" />
                            <span>Reinicio de Antena</span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8] mb-3">Reboot del hardware. Corte temporal de servicio de 2 a 5 min.</p>
                        </div>
                        <button
                          onClick={() => onRequestReboot(detail)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[rgba(229,62,62,0.16)] hover:bg-[#E53E3E] text-[#E53E3E] hover:text-white border border-[#E53E3E]/30 text-xs font-bold transition-colors"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Reiniciar Antena</span>
                        </button>
                      </div>

                      {/* WiFi Config Card */}
                      {onRequestWifiSettings && (
                        <div className="p-3.5 rounded-md bg-[#1A222B] border border-[#2D3742] flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1 text-xs font-bold text-[#F1F5F9]">
                              <Wifi className="w-4 h-4 text-[#F39200]" />
                              <span>Configuración Wi-Fi</span>
                            </div>
                            <p className="text-[11px] text-[#94A3B8] mb-3">Modifica SSID y contraseña WPA2 del router Starlink.</p>
                          </div>
                          <button
                            onClick={() => onRequestWifiSettings(detail)}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[rgba(243,146,0,0.16)] hover:bg-[#F39200] text-[#F39200] hover:text-slate-950 border border-[rgba(243,146,0,0.3)] text-xs font-bold transition-colors"
                          >
                            <Wifi className="w-3.5 h-3.5" />
                            <span>Editar Wi-Fi</span>
                          </button>
                        </div>
                      )}

                      {/* Bypass Mode Card */}
                      {onRequestBypassMode && (
                        <div className="p-3.5 rounded-md bg-[#1A222B] border border-[#2D3742] flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1 text-xs font-bold text-[#F1F5F9]">
                              <WifiOff className="w-4 h-4 text-[#DD6B20]" />
                              <span>Modo Bypass (Puente)</span>
                            </div>
                            <p className="text-[11px] text-[#94A3B8] mb-3">Desactiva el Wi-Fi para enrutar con firewall de terceros.</p>
                          </div>
                          <button
                            onClick={() => onRequestBypassMode(detail)}
                            className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                              detail.wifi_bypassed
                                ? 'bg-[rgba(56,161,105,0.16)] hover:bg-[#38A169] text-[#38A169] hover:text-white border-[#38A169]/30'
                                : 'bg-[rgba(221,107,32,0.16)] hover:bg-[#DD6B20] text-[#DD6B20] hover:text-white border-[#DD6B20]/30'
                            }`}
                          >
                            <WifiOff className="w-3.5 h-3.5" />
                            <span>{detail.wifi_bypassed ? 'Desactivar Bypass' : 'Activar Bypass'}</span>
                          </button>
                        </div>
                      )}

                      {/* Opt-In Action Card */}
                      <div className="p-3.5 rounded-md bg-[#1A222B] border border-[#2D3742] flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1 text-xs font-bold text-[#F1F5F9]">
                            <Sliders className="w-4 h-4 text-[#3182CE]" />
                            <span>Data Opt-In (Overage)</span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8] mb-3">Compra automática de datos prioritarios al agotar la cuota.</p>
                        </div>
                        <button
                          onClick={() => onRequestOptIn(detail)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[rgba(49,130,206,0.16)] hover:bg-[#3182CE] text-[#3182CE] hover:text-white border border-[#3182CE]/30 text-xs font-bold transition-colors"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Configurar Opt-In</span>
                        </button>
                      </div>

                      {/* Alert Notification Toggle Card */}
                      <div className="p-3.5 rounded-md bg-[#1A222B] border border-[#2D3742] flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1 text-xs font-bold text-[#F1F5F9]">
                            {detail.alerts_enabled !== false ? <Bell className="w-4 h-4 text-[#38A169]" /> : <BellOff className="w-4 h-4 text-[#E53E3E]" />}
                            <span>Supervisión de Alertas</span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8] mb-3">
                            {detail.alerts_enabled !== false ? 'Alertas Telegram activas para este enlace.' : 'Alertas Telegram silenciadas.'}
                          </p>
                        </div>
                        {onToggleAlerts && (
                          <button
                            onClick={async () => {
                              await onToggleAlerts(detail);
                              setDetail(prev => prev ? ({ ...prev, alerts_enabled: !prev.alerts_enabled }) : prev);
                            }}
                            className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                              detail.alerts_enabled !== false
                                ? 'bg-[rgba(229,62,62,0.14)] hover:bg-[#E53E3E] text-[#E53E3E] hover:text-white border-[#E53E3E]/30'
                                : 'bg-[rgba(56,161,105,0.16)] hover:bg-[#38A169] text-[#38A169] hover:text-white border-[#38A169]/30'
                            }`}
                          >
                            {detail.alerts_enabled !== false ? <><BellOff className="w-3.5 h-3.5" /><span>Silenciar</span></> : <><Bell className="w-3.5 h-3.5" /><span>Activar</span></>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
