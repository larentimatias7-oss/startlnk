import React, { useState } from 'react';
import { AlertTriangle, RotateCw, Sliders, X, CheckCircle } from 'lucide-react';

export default function ActionConfirmModal({
  isOpen,
  actionType, // 'reboot' or 'opt-in'
  target,     // Terminal object
  onClose,
  onSuccess
}) {
  const [loading, setLoading] = useState(false);
  const [optInValue, setOptInValue] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen || !target) return null;

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let url = '';
      if (actionType === 'reboot') {
        url = `/api/terminals/${target.device_id}/reboot`;
      } else if (actionType === 'opt-in') {
        url = `/api/terminals/${target.service_line_number}/opt-in?enabled=${optInValue}`;
      }

      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Error al ejecutar acción');
      }

      setResult(data.message || 'Operación completada exitosamente');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isReboot = actionType === 'reboot';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-950 border border-white/10 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-xl border ${
            isReboot ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {isReboot ? <RotateCw className="w-6 h-6" /> : <Sliders className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              {isReboot ? 'Confirmar Reinicio de Terminal' : 'Configurar Data Opt-In'}
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              {target.nickname || target.device_id}
            </p>
          </div>
        </div>

        {/* Warning Details */}
        <div className="space-y-3 mb-5 text-xs">
          {isReboot ? (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2.5 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                <strong>Atención:</strong> Esta acción enviará una instrucción de reinicio por hardware a la antena Starlink. El enlace satelital se desconectará temporalmente durante <strong>2 a 5 minutos</strong>.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-start gap-2.5 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  El modo <strong>Opt-In</strong> autoriza el consumo prioritario continuo luego de agotar la cuota mensual del plan, generando cargos de excedente según la tarifa contratada.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between">
                <span className="text-slate-300 font-semibold">Estado de Overage Opt-In:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOptInValue(true)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      optInValue ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Habilitado
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptInValue(false)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      !optInValue ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Deshabilitado
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {result && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{result}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              {error}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition-all"
          >
            {result ? 'Cerrar' : 'Cancelar'}
          </button>

          {!result && (
            <button
              onClick={handleExecute}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-lg transition-all ${
                isReboot
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
              } disabled:opacity-50`}
            >
              {loading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Ejecutando...' : isReboot ? 'Confirmar y Reiniciar' : 'Guardar Configuración'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
