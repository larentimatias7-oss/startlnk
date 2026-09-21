import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Gauge,
  HardDrive,
  RotateCw,
  Sliders,
  Calendar,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Cpu,
  Wifi,
  Globe
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

export default function TerminalDetailModal({
  deviceId,
  onClose,
  onRequestReboot,
  onRequestOptIn
}) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-950 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">
                  {detail?.nickname || deviceId}
                </h2>
                {detail && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    detail.is_online
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {detail.is_online ? 'ONLINE' : 'OFFLINE'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Device: {deviceId} {detail?.service_line_number && `| Línea: ${detail.service_line_number}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
              <RotateCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Cargando telemetría e histórico de Starlink...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {error}
            </div>
          ) : detail ? (
            <>
              {/* Telemetry Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Latencia Ping</span>
                  <span className="text-xl font-mono font-black text-white">
                    {detail.ping_ms} <span className="text-xs text-slate-400 font-sans">ms</span>
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Downlink / Uplink</span>
                  <span className="text-lg font-mono font-bold text-blue-400">
                    {detail.downlink_mbps} <span className="text-xs text-slate-400 font-sans">/</span> {detail.uplink_mbps} <span className="text-xs text-slate-400 font-sans">Mbps</span>
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Calidad de Señal</span>
                  <span className="text-xl font-mono font-black text-emerald-400">
                    {detail.signal_quality}%
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Obstrucción</span>
                  <span className="text-xl font-mono font-black text-slate-200">
                    {detail.obstruction_percent}%
                  </span>
                </div>
              </div>

              {/* Hardware & Plan Details */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5 font-semibold">Modelo de Antena</span>
                  <span className="text-white font-medium">{detail.dish_model || 'Standard'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 font-semibold">Serial del Kit / Dish</span>
                  <span className="text-white font-mono">{detail.kit_serial || detail.dish_serial || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 font-semibold">Cuenta / Cliente</span>
                  <span className="text-white font-medium">{detail.account_name || 'TSM Patagonia'}</span>
                </div>
              </div>

              {/* Billing Cycle Status */}
              {detail.billing_cycle && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Ciclo de Facturación Activo #{detail.billing_cycle.id}
                      </span>
                    </div>
                    {detail.billing_cycle.start_date && (
                      <span className="text-xs text-slate-400 font-mono">
                        {detail.billing_cycle.start_date.split('T')[0]} al {detail.billing_cycle.end_date?.split('T')[0]}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-300">
                      Consumo acumulado: <strong className="text-white font-mono">{detail.billing_cycle.consumed_amount_gb} GB</strong> de <strong className="text-white font-mono">{detail.billing_cycle.total_amount_gb} GB</strong>
                    </span>
                    <span className={`font-bold font-mono text-sm ${
                      detail.billing_cycle.consumed_percent >= 100
                        ? 'text-rose-400'
                        : detail.billing_cycle.consumed_percent >= 80
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      {detail.billing_cycle.consumed_percent}%
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        detail.billing_cycle.consumed_percent >= 100
                          ? 'bg-rose-500'
                          : detail.billing_cycle.consumed_percent >= 80
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(detail.billing_cycle.consumed_percent, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Stacked Bar Chart of Daily Consumption */}
              {history && history.daily_usages && history.daily_usages.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Desglose Diario de Consumo (Priority vs Opt-In vs Standard)
                    </h3>
                    <span className="text-xs font-mono text-slate-400">
                      Total Ciclo: <strong className="text-emerald-400">{history.total_consumed_gb} GB</strong>
                    </span>
                  </div>

                  <div className="h-64 w-full bg-slate-900/40 border border-white/5 rounded-xl p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={history.daily_usages.map(u => ({
                          ...u,
                          displayDate: u.date.split('-').slice(1).join('/')
                        }))}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="displayDate" stroke="#64748b" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit="GB" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="priority_gb" name="Prioridad" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="opt_in_priority_gb" name="Opt-In Excedente" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="standard_gb" name="Estándar" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Action Controls Bar */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white">Acciones Operativas Remotas</h4>
                  <p className="text-[11px] text-slate-400">
                    Instrucciones seguras con confirmación hacia el Backoffice de Starlink
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => onRequestOptIn(detail)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-all border border-white/5"
                  >
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Configurar Opt-In</span>
                  </button>

                  <button
                    onClick={() => onRequestReboot(detail)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-xs font-semibold transition-all border border-rose-500/20 hover:border-rose-500"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Reiniciar Antena</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
