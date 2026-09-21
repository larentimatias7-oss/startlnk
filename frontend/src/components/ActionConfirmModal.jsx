import React, { useState } from 'react';
import { AlertTriangle, RotateCw, Sliders, X, CheckCircle2 } from 'lucide-react';

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
      <div className="bg-[#1A222B] border border-[#2D3742] rounded-lg w-full max-w-md p-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 p-1 rounded-md text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#222C38] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3 mb-3.5">
          <div className={`p-2.5 rounded-md border ${
            isReboot
              ? 'bg-[rgba(229,62,62,0.16)] text-[#E53E3E] border-[#E53E3E]/30'
              : 'bg-[rgba(243,146,0,0.16)] text-[#F39200] border-[rgba(243,146,0,0.3)]'
          }`}>
            {isReboot ? <RotateCw className="w-5 h-5" /> : <Sliders className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#F1F5F9]">
              {isReboot ? 'Confirmar Reinicio de Antena' : 'Configurar Política Data Opt-In'}
            </h3>
            <p className="text-xs text-[#94A3B8] font-mono">
              {target.nickname || target.device_id}
            </p>
          </div>
        </div>

        {/* Warning Details */}
        <div className="space-y-3 mb-4 text-xs">
          {isReboot ? (
            <div className="p-3 rounded-md bg-[rgba(229,62,62,0.12)] border border-[#E53E3E]/30 text-[#F1F5F9] flex items-start gap-2.5 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-[#E53E3E] shrink-0 mt-0.5" />
              <span>
                <strong>Precaución operativa:</strong> Se enviará un comando de reinicio directo al terminal Starlink. El enlace satelital se desconectará temporalmente durante <strong>2 a 4 minutos</strong>.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-[rgba(243,146,0,0.12)] border border-[rgba(243,146,0,0.3)] text-[#F1F5F9] flex items-start gap-2.5 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-[#F39200] shrink-0 mt-0.5" />
                <span>
                  El modo <strong>Opt-In</strong> permite que la línea continúe consumiendo tráfico prioritario una vez alcanzado el 100% de la cuota mensual, facturándose como sobreconsumo.
                </span>
              </div>

              <div className="p-2.5 rounded-md bg-[#141B22] border border-[#2D3742] flex items-center justify-between">
                <span className="text-[#CBD5E1] font-semibold text-xs">Estado de Overage:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOptInValue(true)}
                    className={`px-3 py-1 rounded-md font-bold text-xs transition-colors ${
                      optInValue ? 'bg-[#38A169] text-white' : 'bg-[#1A222B] text-[#94A3B8] border border-[#2D3742]'
                    }`}
                  >
                    Habilitado
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptInValue(false)}
                    className={`px-3 py-1 rounded-md font-bold text-xs transition-colors ${
                      !optInValue ? 'bg-[#E53E3E] text-white' : 'bg-[#1A222B] text-[#94A3B8] border border-[#2D3742]'
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
            <div className="p-2.5 rounded-md bg-[rgba(56,161,105,0.16)] border border-[#38A169]/40 text-[#38A169] flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{result}</span>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-md bg-[rgba(229,62,62,0.16)] border border-[#E53E3E]/40 text-[#E53E3E] font-semibold">
              {error}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2D3742]">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 rounded-md bg-[#141B22] hover:bg-[#222C38] text-[#CBD5E1] font-semibold text-xs border border-[#2D3742] transition-colors"
          >
            {result ? 'Cerrar' : 'Cancelar'}
          </button>

          {!result && (
            <button
              onClick={handleExecute}
              disabled={loading}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors shadow-sm ${
                isReboot
                  ? 'bg-[#E53E3E] hover:bg-[#C53030] text-white'
                  : 'bg-[#F39200] hover:bg-[#D98200] text-slate-950'
              } disabled:opacity-50`}
            >
              {loading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Ejecutando...' : isReboot ? 'Confirmar Reinicio' : 'Guardar Política'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
