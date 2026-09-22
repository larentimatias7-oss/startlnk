import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, X, AlertTriangle, RotateCw, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function BypassModeModal({
  isOpen,
  terminal,
  onClose,
  onSuccess
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultMsg, setResultMsg] = useState(null);

  const deviceId = terminal?.device_id;
  const isBypassed = Boolean(terminal?.wifi_bypassed);
  const targetMode = !isBypassed; // toggle target

  useEffect(() => {
    if (isOpen) {
      setConfirmed(false);
      setError(null);
      setResultMsg(null);
      setLoading(false);
    }
  }, [isOpen, terminal]);

  if (!isOpen || !terminal) return null;

  const handleExecute = async () => {
    if (targetMode && !confirmed) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/terminals/${deviceId}/bypass-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Error al modificar modo Bypass');
      }

      setResultMsg(data.message);
      if (onSuccess) onSuccess(data.message);
      setTimeout(() => {
        onClose();
      }, 1500);
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
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#2D3742] flex items-center justify-between bg-[#141A20]">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${
              targetMode
                ? 'bg-[rgba(221,107,32,0.18)] text-[#DD6B20] border-[#DD6B20]/40'
                : 'bg-[rgba(56,161,105,0.18)] text-[#38A169] border-[#38A169]/40'
            }`}>
              {targetMode ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {targetMode ? 'Enable Bypass Mode' : 'Disable Bypass Mode'}
              </h3>
              <p className="text-xs text-[#94A3B8]">
                {terminal.nickname || terminal.kit_serial || terminal.device_id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white transition-colors p-1.5 rounded-md hover:bg-[#2D3742]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[rgba(229,62,62,0.15)] border border-[#E53E3E]/40 text-[#F1F5F9] text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#E53E3E] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resultMsg && (
            <div className="p-3 rounded-lg bg-[rgba(56,161,105,0.15)] border border-[#38A169]/40 text-[#F1F5F9] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#38A169] shrink-0" />
              <span>{resultMsg}</span>
            </div>
          )}

          <div className="bg-[#141B22] border border-[#2D3742] rounded-lg p-4 space-y-2.5 text-xs text-[#CBD5E1]">
            <div className="font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#DD6B20]" />
              <span>Impacto Operativo del Modo Bypass</span>
            </div>
            <p className="text-[#94A3B8] leading-relaxed">
              {targetMode
                ? 'Al activar el modo Bypass, el router Starlink desactivará completamente sus radios Wi-Fi y servidor DHCP. Todo el tráfico de red se delegará al router o firewall de la obra conectado vía Ethernet.'
                : 'Al desactivar el modo Bypass, el router Starlink reactivará sus radios Wi-Fi y su enrutador DHCP interno.'}
            </p>
            {targetMode && (
              <div className="p-2.5 rounded bg-[rgba(221,107,32,0.1)] border border-[#DD6B20]/30 text-[11px] text-[#DD6B20]">
                ⚠️ Para recuperar el control de forma manual en caso de desconexión, se requiere resetear físicamente el router desenchufándolo 6 veces consecutivas.
              </div>
            )}
          </div>

          {targetMode && (
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-[#2D3742] text-[#DD6B20] focus:ring-[#DD6B20] focus:ring-offset-0 bg-[#121820]"
              />
              <span className="text-xs text-[#CBD5E1]">
                Confirmo que el enlace cuenta con router/firewall externo y autorizo desactivar el Wi-Fi del equipo.
              </span>
            </label>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#2D3742] flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-[#94A3B8] hover:text-white hover:bg-[#24303E] rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={loading || (targetMode && !confirmed)}
              className={`px-5 py-2 text-xs font-bold text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-40 ${
                targetMode
                  ? 'bg-[#C05621] hover:bg-[#DD6B20]'
                  : 'bg-[#2F855A] hover:bg-[#38A169]'
              }`}
            >
              {loading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Aplicando...</span>
                </>
              ) : (
                <span>{targetMode ? 'Habilitar Bypass' : 'Desactivar Bypass'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
