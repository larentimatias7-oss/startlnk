import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RotateCw,
  Sliders,
  X,
  CheckCircle2,
  ShieldAlert,
  Server,
  Radio,
  Lock
} from 'lucide-react';

export default function ActionConfirmModal({
  isOpen,
  actionType, // 'reboot' or 'opt-in'
  target,     // Terminal object
  onClose,
  onSuccess
}) {
  const [loading, setLoading] = useState(false);
  const [optInValue, setOptInValue] = useState(true);
  const [confirmedPrecaution, setConfirmedPrecaution] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Reset internal states whenever target or action changes
  useEffect(() => {
    if (isOpen) {
      setConfirmedPrecaution(false);
      setResult(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, target, actionType]);

  if (!isOpen || !target) return null;

  const isReboot = actionType === 'reboot';

  const handleExecute = async () => {
    if (isReboot && !confirmedPrecaution) {
      return;
    }

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
        throw new Error(data.detail || data.message || 'Error al ejecutar la acción en el servidor');
      }

      setResult(data.message || (isReboot ? 'Comando de reinicio enviado exitosamente a la antena' : 'Política actualizada'));
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        {/* Modal Top Header */}
        <div className={`p-4 sm:p-5 border-b border-[#2D3742] flex items-center justify-between ${
          isReboot ? 'bg-[#141A20]' : 'bg-[#141A20]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${
              isReboot
                ? 'bg-[rgba(229,62,62,0.18)] text-[#E53E3E] border-[#E53E3E]/40'
                : 'bg-[rgba(243,146,0,0.18)] text-[#F39200] border-[rgba(243,146,0,0.4)]'
            }`}>
              {isReboot ? <ShieldAlert className="w-5 h-5" /> : <Sliders className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                {isReboot ? 'Confirmar Reinicio Remoto de Antena' : 'Configurar Data Opt-In (Overage)'}
              </h3>
              <p className="text-xs text-[#94A3B8]">
                {isReboot ? 'Control de infraestructura de red satelital' : 'Política de sobreconsumo de cuota'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#222C38] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs">
          {/* Target Terminal Technical Card */}
          <div className="p-3 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-2">
            <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#F39200]" />
              <span>Detalles del Terminal a Operar</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#64748B] block text-[10px]">Nombre / Obra:</span>
                <span className="font-bold text-white truncate block">
                  {target.nickname || target.device_id}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px]">Línea de Servicio (SL):</span>
                <span className="font-mono text-[#CBD5E1] block">
                  {target.service_line_number || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px]">Serial Kit / Antena:</span>
                <span className="font-mono text-[#94A3B8] block truncate">
                  {target.kit_serial || target.dish_serial || target.device_id}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px]">Estado Actual:</span>
                <span className={`font-bold inline-flex items-center gap-1 ${
                  target.is_online ? 'text-[#38A169]' : 'text-[#E53E3E]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${target.is_online ? 'bg-[#38A169]' : 'bg-[#E53E3E]'}`} />
                  {target.is_online ? 'Online (En servicio)' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* REBOOT FLOW: Specific High Precaution & Danger Notice */}
          {isReboot ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-[rgba(229,62,62,0.12)] border border-[#E53E3E]/40 text-[#F1F5F9] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#E53E3E] text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>PRECAUCIÓN OPERATIVA OBLIGATORIA</span>
                </div>
                <p className="text-[11px] text-[#CBD5E1] leading-relaxed">
                  Esta orden enviará una señal de reinicio directo al hardware físico instalado en el sitio.
                </p>
                <ul className="text-[11px] text-[#CBD5E1] list-disc list-inside space-y-1 bg-[#0F141A]/50 p-2.5 rounded border border-[#E53E3E]/20">
                  <li>
                    La obra / campamento sufrirá un <strong>corte total de conectividad de 2 a 5 minutos</strong>.
                  </li>
                  <li>
                    La antena reiniciará sus procesadores de RF y reorientará su arreglo de fase con la constelación.
                  </li>
                  <li>
                    Cualquier descarga, comunicación o VPN activa en la obra se interrumpirá temporalmente.
                  </li>
                </ul>
              </div>

              {/* Safety Confirmation Checkbox */}
              {!result && (
                <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#141B22] border border-[#2D3742] hover:border-[#F39200]/40 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmedPrecaution}
                    onChange={e => setConfirmedPrecaution(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-[#2D3742] bg-[#0F141A] text-[#F39200] accent-[#F39200] cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block">
                      Entiendo el impacto de corte temporal en la obra
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      Confirmo que he coordinado el corte y deseo reiniciar la antena ahora.
                    </span>
                  </div>
                </label>
              )}
            </div>
          ) : (
            /* OPT-IN FLOW */
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-[rgba(243,146,0,0.12)] border border-[rgba(243,146,0,0.3)] text-[#CBD5E1] flex items-start gap-2.5 leading-relaxed text-xs">
                <AlertTriangle className="w-4 h-4 text-[#F39200] shrink-0 mt-0.5" />
                <span>
                  Al habilitar <strong>Data Opt-In</strong>, una vez consumido el 100% de la cuota mensual de datos prioritarios, la línea continuará operando a máxima velocidad facturándose como sobreconsumo según el acuerdo corporativo.
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#141B22] border border-[#2D3742] flex items-center justify-between">
                <span className="text-white font-bold text-xs">Política de Sobreconsumo:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOptInValue(true)}
                    className={`px-3 py-1.5 rounded-md font-bold text-xs transition-colors ${
                      optInValue ? 'bg-[#38A169] text-white' : 'bg-[#1A222B] text-[#94A3B8] border border-[#2D3742]'
                    }`}
                  >
                    Habilitado (Opt-In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptInValue(false)}
                    className={`px-3 py-1.5 rounded-md font-bold text-xs transition-colors ${
                      !optInValue ? 'bg-[#E53E3E] text-white' : 'bg-[#1A222B] text-[#94A3B8] border border-[#2D3742]'
                    }`}
                  >
                    Bloquear al 100%
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {result && (
            <div className="p-3 rounded-lg bg-[rgba(56,161,105,0.16)] border border-[#38A169]/40 text-[#38A169] flex items-center gap-2.5 font-bold animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{result}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-[rgba(229,62,62,0.16)] border border-[#E53E3E]/40 text-[#E53E3E] font-bold animate-fadeIn">
              {error}
            </div>
          )}
        </div>

        {/* Modal Action Buttons: Cancel vs Confirm */}
        <div className="p-3.5 sm:p-4 bg-[#141A20] border-t border-[#2D3742] flex items-center justify-between gap-3">
          {/* Safe Cancel Button (Always Visible) */}
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#222C38] hover:bg-[#2D3742] text-[#CBD5E1] hover:text-white font-semibold text-xs border border-[#2D3742] transition-colors"
          >
            {result ? 'Cerrar Ventana' : 'Cancelar Operación'}
          </button>

          {/* Execution Button (Protected by Checkbox in Reboot Mode) */}
          {!result && (
            <button
              onClick={handleExecute}
              disabled={loading || (isReboot && !confirmedPrecaution)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                isReboot
                  ? confirmedPrecaution
                    ? 'bg-[#E53E3E] hover:bg-[#C53030] text-white cursor-pointer shadow-red-900/40'
                    : 'bg-[#222C38] text-[#64748B] border border-[#2D3742] cursor-not-allowed opacity-60'
                  : 'bg-[#F39200] hover:bg-[#D98200] text-slate-950 font-bold'
              }`}
            >
              {loading ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : isReboot && !confirmedPrecaution ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <RotateCw className="w-3.5 h-3.5" />
              )}
              <span>
                {loading
                  ? 'Enviando comando...'
                  : isReboot
                  ? 'Sí, Reiniciar Antena Ahora'
                  : 'Guardar Política'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
