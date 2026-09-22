import React, { useState, useEffect } from 'react';
import { Wifi, Eye, EyeOff, X, RotateCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function WifiSettingsModal({
  isOpen,
  terminal,
  onClose,
  onSuccess
}) {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const deviceId = terminal?.device_id;

  // Load current WiFi settings on open
  useEffect(() => {
    if (!isOpen || !deviceId) return;
    let isMounted = true;

    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        const res = await fetch(`/api/terminals/${deviceId}/wifi-settings`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'No se pudo cargar la configuración Wi-Fi');
        }
        const data = await res.json();
        if (isMounted) {
          setSsid(data.ssid || '');
          setPassword(data.password || '');
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, [isOpen, deviceId]);

  if (!isOpen || !terminal) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!ssid.trim()) {
      setError('El SSID no puede estar vacío');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/terminals/${deviceId}/wifi-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid: ssid.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Error al guardar la configuración Wi-Fi');
      }

      setSuccessMsg(data.message || 'Configuración Wi-Fi guardada exitosamente.');
      if (onSuccess) onSuccess(data.message);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#2D3742] flex items-center justify-between bg-[#141A20]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[rgba(243,146,0,0.18)] text-[#F39200] border border-[rgba(243,146,0,0.3)]">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Edit WiFi settings
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

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#94A3B8] block">
            WIFI SETTINGS
          </span>

          {loading ? (
            <div className="py-10 text-center text-[#94A3B8] text-xs flex flex-col items-center gap-2">
              <RotateCw className="w-6 h-6 animate-spin text-[#F39200]" />
              <span>Consultando router Starlink...</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 rounded-lg bg-[rgba(229,62,62,0.15)] border border-[#E53E3E]/40 text-[#F1F5F9] text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#E53E3E] shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-lg bg-[rgba(56,161,105,0.15)] border border-[#38A169]/40 text-[#F1F5F9] text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#38A169] shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* SSID Input */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                    SSID
                  </label>
                  <input
                    type="text"
                    value={ssid}
                    onChange={(e) => setSsid(e.target.value)}
                    required
                    placeholder="Nombre de la red Wi-Fi"
                    className="w-full px-3 py-2 bg-[#121820] border border-[#2D3742] rounded-lg text-sm font-mono text-[#F1F5F9] focus:outline-none focus:border-[#F39200] transition-colors"
                  />
                </div>

                {/* Password Input with Visibility Toggle */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Contraseña (mín. 8 caracteres)"
                      className="w-full px-3 py-2 pr-10 bg-[#121820] border border-[#2D3742] rounded-lg text-sm font-mono text-[#F1F5F9] focus:outline-none focus:border-[#F39200] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white transition-colors p-1"
                      title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Informative Warning */}
              <div className="p-3 rounded-lg bg-[#141B22] border border-[#2D3742] text-[11px] text-[#94A3B8] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#F39200] shrink-0 mt-0.5" />
                <span>
                  Al guardar, el router Starlink aplicará los cambios y los dispositivos conectados por Wi-Fi deberán reconectarse con la nueva contraseña.
                </span>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#2D3742] flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-[#94A3B8] hover:text-white hover:bg-[#24303E] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="px-5 py-2 text-xs font-bold text-white bg-[#202938] hover:bg-[#2D3B4E] border border-[#3E4F66] rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-[#F39200]" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save settings</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
