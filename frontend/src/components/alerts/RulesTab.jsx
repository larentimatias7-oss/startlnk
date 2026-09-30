import React from 'react';
import { Timer, Clock, ShieldCheck, Zap, Check } from 'lucide-react';

const SYNC_PRESETS = [5, 10, 15, 30, 60];
const COOLDOWN_PRESETS = [6, 12, 24, 48];

export default function RulesTab({
  config,
  setConfig,
  loading,
  onSaveConfig
}) {
  return (
    <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl p-5 space-y-5 shadow-sm">
      {/* Master Toggle */}
      <div className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-white">Sistema Global de Alertas de Consumo</div>
          <div className="text-xs text-[#94A3B8]">
            Activa o suspende el despacho de alertas hacia todos los canales de Telegram configurados.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfig(prev => ({ ...prev, is_enabled: !prev.is_enabled }))}
          className={`w-12 h-6 rounded-full transition-colors relative ${
            config.is_enabled ? 'bg-[#F39200]' : 'bg-[#2D3742]'
          }`}
        >
          <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
            config.is_enabled ? 'translate-x-6' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Section: Monitoring Frequencies & Anti-Spam Cadence */}
      <div className="p-4 bg-[#141B22] border border-[#F39200]/30 rounded-lg space-y-4">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-[#F39200]" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Frecuencias de Monitoreo y Cadencia de Notificaciones
          </h4>
        </div>
        <p className="text-xs text-[#94A3B8]">
          Parametriza con qué periodicidad el sistema evalúa los enlaces y cada cuánto tiempo vuelve a avisar en Telegram si la condición continúa.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
          {/* 1. Evaluation Frequency */}
          <div className="space-y-3 bg-[#0F141A] p-3.5 rounded-lg border border-[#2D3742]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#CBD5E1] font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#3182CE]" />
                <span>Intervalo de Evaluación de Flota:</span>
              </span>
              <strong className="text-[#3182CE] font-mono text-sm">
                Cada {config.sync_interval_minutes} minutos
              </strong>
            </div>

            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={config.sync_interval_minutes}
              onChange={e => setConfig(prev => ({ ...prev, sync_interval_minutes: parseInt(e.target.value) }))}
              className="w-full accent-[#3182CE] cursor-pointer"
            />

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-[#64748B]">Presets:</span>
              {SYNC_PRESETS.map(min => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, sync_interval_minutes: min }))}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                    config.sync_interval_minutes === min
                      ? 'bg-[#3182CE] text-white'
                      : 'bg-[#222C38] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {min}m {min === 15 ? '(Recom.)' : ''}
                </button>
              ))}
            </div>

            <span className="text-[10px] text-[#64748B] block leading-relaxed">
              Frecuencia con la que el planificador de fondo consulta a TSM ECHO y evalúa las 13 antenas. Los cambios se reprograman en caliente inmediatamente.
            </span>
          </div>

          {/* 2. Cooldown Anti-Spam */}
          <div className="space-y-3 bg-[#0F141A] p-3.5 rounded-lg border border-[#2D3742]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#CBD5E1] font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#F39200]" />
                <span>Re-notificación Anti-Spam (Cooldown):</span>
              </span>
              <strong className="text-[#F39200] font-mono text-sm">
                Cada {config.cooldown_hours} horas
              </strong>
            </div>

            <input
              type="range"
              min="1"
              max="48"
              step="1"
              value={config.cooldown_hours}
              onChange={e => setConfig(prev => ({ ...prev, cooldown_hours: parseInt(e.target.value) }))}
              className="w-full accent-[#F39200] cursor-pointer"
            />

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-[#64748B]">Presets:</span>
              {COOLDOWN_PRESETS.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, cooldown_hours: h }))}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                    config.cooldown_hours === h
                      ? 'bg-[#F39200] text-slate-950'
                      : 'bg-[#222C38] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {h}h {h === 24 ? '(Recom.)' : ''}
                </button>
              ))}
            </div>

            <span className="text-[10px] text-[#64748B] block leading-relaxed">
              Tiempo mínimo antes de volver a alertar sobre una antena que continúe en sobreconsumo o ritmo acelerado, evitando spam en los canales de guardia.
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Regla 1: Umbrales de Cuota del Mes (%) */}
        <div className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-3.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DD6B20]" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Regla 1: Umbrales de Cuota Mensual (%)
            </h4>
          </div>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Genera notificaciones de advertencia y estado crítico cuando el volumen de datos acumulado cruza los porcentajes definidos.
          </p>

          <div className="space-y-4 pt-1">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#CBD5E1]">Alerta de Advertencia (Warning):</span>
                <strong className="text-[#DD6B20] font-mono text-sm">{config.quota_threshold_percent}%</strong>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={config.quota_threshold_percent}
                onChange={e => setConfig(prev => ({ ...prev, quota_threshold_percent: parseFloat(e.target.value) }))}
                className="w-full accent-[#DD6B20] cursor-pointer"
              />
              <span className="text-[10px] text-[#64748B] block mt-0.5">Recomendado: 80%</span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#CBD5E1]">Alerta Crítica (Agotamiento / Overage):</span>
                <strong className="text-[#E53E3E] font-mono text-sm">{config.quota_critical_percent}%</strong>
              </div>
              <input
                type="range"
                min="95"
                max="120"
                step="5"
                value={config.quota_critical_percent}
                onChange={e => setConfig(prev => ({ ...prev, quota_critical_percent: parseFloat(e.target.value) }))}
                className="w-full accent-[#E53E3E] cursor-pointer"
              />
              <span className="text-[10px] text-[#64748B] block mt-0.5">Recomendado: 100%</span>
            </div>
          </div>
        </div>

        {/* Regla 2: Ritmo Acelerado Preventivo (Burn-Rate) */}
        <div className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-3.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#F39200]" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Regla 2: Ritmo Acelerado Preventivo (Burn-Rate)
            </h4>
          </div>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Anticipa el agotamiento prematuro de la cuota calculando la tasa diaria frente a los días restantes de ciclo.
          </p>

          <div className="p-2.5 bg-[#0F141A] border border-[#2D3742] rounded text-xs text-[#CBD5E1] font-mono leading-relaxed">
            Condición activa: <strong className="text-[#F39200]">Consumo ≥ {config.early_warning_percent}%</strong> restando <strong className="text-[#F39200]">≥ {config.early_warning_days_remaining} días</strong>.
          </div>

          <div className="space-y-4 pt-1">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#CBD5E1]">% Consumo Temprano:</span>
                <strong className="text-[#F39200] font-mono text-sm">{config.early_warning_percent}%</strong>
              </div>
              <input
                type="range"
                min="40"
                max="80"
                step="5"
                value={config.early_warning_percent}
                onChange={e => setConfig(prev => ({ ...prev, early_warning_percent: parseFloat(e.target.value) }))}
                className="w-full accent-[#F39200] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#CBD5E1]">Días Mínimos Restantes:</span>
                <strong className="text-[#F39200] font-mono text-sm">{config.early_warning_days_remaining} días</strong>
              </div>
              <input
                type="range"
                min="5"
                max="25"
                step="1"
                value={config.early_warning_days_remaining}
                onChange={e => setConfig(prev => ({ ...prev, early_warning_days_remaining: parseInt(e.target.value) }))}
                className="w-full accent-[#F39200] cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Regla 3: Offline Alert */}
      <div className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-white block">Alerta por Enlace Desconectado (Offline)</span>
          <span className="text-[11px] text-[#94A3B8]">
            Enviar mensaje inmediato si una antena en obra pierde el enlace satelital.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setConfig(prev => ({ ...prev, alert_on_offline: !prev.alert_on_offline }))}
          className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
            config.alert_on_offline ? 'bg-[#38A169]' : 'bg-[#2D3742]'
          }`}
        >
          <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
            config.alert_on_offline ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Action Save Bar */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onSaveConfig}
          disabled={loading}
          className="px-6 py-2.5 rounded-lg bg-[#F39200] hover:bg-[#D98200] text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md"
        >
          <Check className="w-4 h-4" />
          <span>Guardar Todos los Parámetros</span>
        </button>
      </div>
    </div>
  );
}
