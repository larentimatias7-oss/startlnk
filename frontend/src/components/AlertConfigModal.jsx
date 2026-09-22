import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Send,
  Sliders,
  History,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  Clock,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export default function AlertConfigModal({ isOpen, onClose, onNotify }) {
  const [activeTab, setActiveTab] = useState('channels'); // channels, rules, history
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Form states
  const [config, setConfig] = useState({
    telegram_bot_token: '',
    quota_threshold_percent: 80,
    quota_critical_percent: 100,
    early_warning_percent: 60,
    early_warning_days_remaining: 15,
    alert_on_offline: false,
    cooldown_hours: 12,
    is_enabled: true
  });

  const [channels, setChannels] = useState([]);
  const [newChannel, setNewChannel] = useState({ name: '', chat_id: '' });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [resCfg, resChans, resHist] = await Promise.all([
        fetch('/api/alerts/config').then(r => r.json()),
        fetch('/api/alerts/channels').then(r => r.json()),
        fetch('/api/alerts/history').then(r => r.json())
      ]);

      if (resCfg) setConfig(resCfg);
      if (Array.isArray(resChans)) setChannels(resChans);
      if (Array.isArray(resHist)) setHistory(resHist);
    } catch (e) {
      if (onNotify) onNotify('Error al cargar configuración de alertas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        if (onNotify) onNotify('Configuración de alertas guardada exitosamente', 'success');
      } else {
        const err = await res.json();
        if (onNotify) onNotify(err.detail || 'Error al guardar configuración', 'error');
      }
    } catch (e) {
      if (onNotify) onNotify('Error al conectar con la API', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChannel = async (e) => {
    e.preventDefault();
    if (!newChannel.name.trim() || !newChannel.chat_id.trim()) {
      if (onNotify) onNotify('Completa el nombre y Chat ID del canal', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/alerts/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newChannel, is_active: true })
      });
      if (res.ok) {
        const created = await res.json();
        setChannels(prev => [...prev, created]);
        setNewChannel({ name: '', chat_id: '' });
        if (onNotify) onNotify(`Canal '${created.name}' registrado`, 'success');
      } else {
        const err = await res.json();
        if (onNotify) onNotify(err.detail || 'Error al crear canal', 'error');
      }
    } catch (e) {
      if (onNotify) onNotify('Error al registrar canal', 'error');
    }
  };

  const handleToggleChannel = async (id, currentStatus) => {
    try {
      const res = await fetch(`/api/alerts/channels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setChannels(prev => prev.map(c => c.id === id ? updated : c));
      }
    } catch (e) {
      if (onNotify) onNotify('Error al actualizar canal', 'error');
    }
  };

  const handleDeleteChannel = async (id, name) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el canal "${name}"?`)) return;
    try {
      const res = await fetch(`/api/alerts/channels/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setChannels(prev => prev.filter(c => c.id !== id));
        if (onNotify) onNotify(`Canal '${name}' eliminado`, 'info');
      }
    } catch (e) {
      if (onNotify) onNotify('Error al eliminar canal', 'error');
    }
  };

  const handleTestChannel = async (channel) => {
    if (!config.telegram_bot_token || !config.telegram_bot_token.trim()) {
      if (onNotify) onNotify('Ingresa y guarda primero el Telegram Bot Token', 'warning');
      return;
    }

    setTestingId(channel.id);
    try {
      const res = await fetch('/api/alerts/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channel.chat_id,
          custom_bot_token: config.telegram_bot_token
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onNotify) onNotify(`✅ Mensaje de prueba entregado a '${channel.name}'`, 'success');
      } else {
        if (onNotify) onNotify(`Error en Telegram: ${data.detail || data.error}`, 'error');
      }
    } catch (e) {
      if (onNotify) onNotify('Error al enviar prueba a Telegram', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleEvaluateNow = async () => {
    setEvaluating(true);
    try {
      const res = await fetch('/api/alerts/evaluate', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (onNotify) onNotify(`Evaluación completada: ${data.alerts_generated || 0} alertas detectadas, ${data.alerts_sent || 0} despachadas.`, 'info');
        // Refresh history
        const resHist = await fetch('/api/alerts/history').then(r => r.json());
        if (Array.isArray(resHist)) setHistory(resHist);
      }
    } catch (e) {
      if (onNotify) onNotify('Error al evaluar alertas', 'error');
    } finally {
      setEvaluating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#2D3742] flex items-center justify-between bg-[#141A20]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(243,146,0,0.15)] text-[#F39200] border border-[#F39200]/30 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Configuración de Alertas & Telegram
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Supervisión de consumos, algoritmo burn-rate y canales de notificación
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#222C38] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-[#2D3742] bg-[#141B22] px-4">
          {[
            { id: 'channels', label: 'Canales de Telegram', icon: Send, count: channels.length },
            { id: 'rules', label: 'Reglas y Umbrales', icon: Sliders },
            { id: 'history', label: 'Historial de Alertas', icon: History, count: history.length }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#F39200] text-[#F39200]'
                    : 'border-transparent text-[#94A3B8] hover:text-[#CBD5E1]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-[#F39200]/20 text-[#F39200]' : 'bg-[#222C38] text-[#94A3B8]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: CANALES DE TELEGRAM */}
          {activeTab === 'channels' && (
            <div className="space-y-5">
              {/* Bot Token Section */}
              <div className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-2">
                <label className="text-xs font-bold text-[#CBD5E1] flex items-center justify-between">
                  <span>Telegram Bot Token</span>
                  <span className="text-[10px] text-[#64748B] font-mono">Ej: 123456:ABC-DEF1234ghIkl-zyx</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={config.telegram_bot_token || ''}
                      onChange={e => setConfig(prev => ({ ...prev, telegram_bot_token: e.target.value }))}
                      placeholder="Pega el token provisto por @BotFather..."
                      className="w-full pl-3 pr-10 py-1.5 bg-[#0F141A] border border-[#2D3742] rounded-md text-xs text-white placeholder-[#64748B] font-mono focus:outline-none focus:border-[#F39200]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#CBD5E1]"
                    >
                      {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    onClick={handleSaveConfig}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-md bg-[#F39200] hover:bg-[#D98200] text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Guardar
                  </button>
                </div>
              </div>

              {/* Channels List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">
                    Canales y Grupos Destinatarios
                  </h3>
                  <span className="text-[11px] text-[#94A3B8]">
                    {channels.filter(c => c.is_active).length} activos de {channels.length}
                  </span>
                </div>

                {channels.length === 0 ? (
                  <div className="p-6 text-center bg-[#141B22] border border-[#2D3742] rounded-lg text-[#94A3B8] text-xs">
                    No hay canales registrados. Agrega uno abajo para recibir alertas.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {channels.map(ch => (
                      <div
                        key={ch.id}
                        className="p-3 bg-[#141B22] border border-[#2D3742] rounded-lg flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{ch.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                              ch.is_active
                                ? 'bg-[rgba(56,161,105,0.16)] text-[#38A169] border border-[#38A169]/30'
                                : 'bg-[#222C38] text-[#64748B]'
                            }`}>
                              {ch.is_active ? 'ACTIVO' : 'PAUSADO'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-[#64748B] mt-0.5 truncate">
                            Chat ID: <span className="text-[#94A3B8]">{ch.chat_id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestChannel(ch)}
                            disabled={testingId === ch.id}
                            className="px-2.5 py-1 rounded bg-[#222C38] hover:bg-[#2D3742] text-[#CBD5E1] hover:text-white border border-[#2D3742] text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="Enviar mensaje de prueba a este canal"
                          >
                            <Send className="w-3 h-3 text-[#F39200]" />
                            {testingId === ch.id ? 'Probando...' : 'Probar'}
                          </button>

                          <button
                            onClick={() => handleToggleChannel(ch.id, ch.is_active)}
                            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                              ch.is_active
                                ? 'bg-[#222C38] text-[#94A3B8] hover:text-white'
                                : 'bg-[#F39200]/20 text-[#F39200]'
                            }`}
                          >
                            {ch.is_active ? 'Pausar' : 'Activar'}
                          </button>

                          <button
                            onClick={() => handleDeleteChannel(ch.id, ch.name)}
                            className="p-1 rounded text-[#64748B] hover:text-[#E53E3E] transition-colors"
                            title="Eliminar canal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Channel Form */}
                <form onSubmit={handleAddChannel} className="p-3.5 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-3">
                  <div className="text-xs font-bold text-[#CBD5E1]">Agregar Nuevo Canal / Grupo de Telegram</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nombre (ej: Guardia NOC Milicic)"
                      value={newChannel.name}
                      onChange={e => setNewChannel(prev => ({ ...prev, name: e.target.value }))}
                      className="px-3 py-1.5 bg-[#0F141A] border border-[#2D3742] rounded-md text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#F39200]"
                    />
                    <input
                      type="text"
                      placeholder="Chat ID (ej: -100192837482 o @canal)"
                      value={newChannel.chat_id}
                      onChange={e => setNewChannel(prev => ({ ...prev, chat_id: e.target.value }))}
                      className="px-3 py-1.5 bg-[#0F141A] border border-[#2D3742] rounded-md text-xs text-white placeholder-[#64748B] font-mono focus:outline-none focus:border-[#F39200]"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-md bg-[#222C38] hover:bg-[#2D3742] text-[#F39200] border border-[#F39200]/30 hover:border-[#F39200] font-bold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar Canal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: REGLAS Y UMBRALES */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              {/* Global Switch */}
              <div className="p-3 bg-[#141B22] border border-[#2D3742] rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Sistema de Alertas Habilitado</div>
                  <div className="text-[11px] text-[#94A3B8]">Activa o pausa el despacho de notificaciones a Telegram</div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, is_enabled: !prev.is_enabled }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    config.is_enabled ? 'bg-[#F39200]' : 'bg-[#2D3742]'
                  }`}
                >
                  <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                    config.is_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Regla 1: Umbral de Cuota Fija */}
              <div className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#DD6B20]" />
                  <h4 className="text-xs font-bold text-white">Regla 1: Umbrales de Cuota del Mes (%)</h4>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  Genera una notificación cuando el volumen de datos de una terminal alcanza el porcentaje especificado de su plan mensual.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] text-[#CBD5E1] block mb-1">
                      Alerta de Advertencia (Warning): <strong className="text-[#DD6B20]">{config.quota_threshold_percent}%</strong>
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="95"
                      step="5"
                      value={config.quota_threshold_percent}
                      onChange={e => setConfig(prev => ({ ...prev, quota_threshold_percent: parseFloat(e.target.value) }))}
                      className="w-full accent-[#DD6B20] cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[#CBD5E1] block mb-1">
                      Alerta Crítica (Agotamiento): <strong className="text-[#E53E3E]">{config.quota_critical_percent}%</strong>
                    </label>
                    <input
                      type="range"
                      min="95"
                      max="120"
                      step="5"
                      value={config.quota_critical_percent}
                      onChange={e => setConfig(prev => ({ ...prev, quota_critical_percent: parseFloat(e.target.value) }))}
                      className="w-full accent-[#E53E3E] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Regla 2: Alerta Preventiva de Ritmo Acelerado (Burn-Rate) */}
              <div className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[#F39200]" />
                  <h4 className="text-xs font-bold text-white">Regla 2: Alerta Preventiva de Ritmo Acelerado (Burn-Rate)</h4>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  Detecta tempranamente enlaces que agotarán su cuota antes del fin de ciclo. Se activa cuando un enlace alcanza un porcentaje alto quedando suficientes días por delante.
                </p>

                <div className="p-2.5 bg-[#0F141A] border border-[#2D3742] rounded text-[11px] text-[#CBD5E1] font-mono">
                  Condición: <strong className="text-[#F39200]">Consumo &gt;= {config.early_warning_percent}%</strong> cuando aún restan <strong className="text-[#F39200]">&gt;= {config.early_warning_days_remaining} días</strong> de ciclo.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] text-[#CBD5E1] block mb-1">
                      % Consumido Temprano: <strong className="text-[#F39200]">{config.early_warning_percent}%</strong>
                    </label>
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
                    <label className="text-[11px] text-[#CBD5E1] block mb-1">
                      Días Restantes Mínimos: <strong className="text-[#F39200]">{config.early_warning_days_remaining} días</strong>
                    </label>
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

              {/* Opciones Adicionales y Cooldown */}
              <div className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#38A169]" />
                  <h4 className="text-xs font-bold text-white">Parámetros de Anti-Spam & Conectividad</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#CBD5E1] block mb-1">
                      Cooldown Anti-Spam (Horas): <strong>{config.cooldown_hours}h</strong>
                    </label>
                    <p className="text-[10px] text-[#64748B] mb-1">No repetir la misma alerta a la misma antena en esta ventana de tiempo.</p>
                    <input
                      type="number"
                      min="1"
                      max="72"
                      value={config.cooldown_hours}
                      onChange={e => setConfig(prev => ({ ...prev, cooldown_hours: parseInt(e.target.value) || 12 }))}
                      className="w-full px-3 py-1 bg-[#0F141A] border border-[#2D3742] rounded text-xs text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <span className="text-xs font-bold text-white block">Alertar Antena Offline</span>
                      <span className="text-[10px] text-[#64748B]">Enviar mensaje si un enlace pierde conexión</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, alert_on_offline: !prev.alert_on_offline }))}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        config.alert_on_offline ? 'bg-[#38A169]' : 'bg-[#2D3742]'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${
                        config.alert_on_offline ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveConfig}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-[#F39200] hover:bg-[#D98200] text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  Guardar Todos los Parámetros
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: HISTORIAL DE ALERTAS */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">
                  Bitácora de Alertas Despachadas
                </h4>
                <button
                  onClick={handleEvaluateNow}
                  disabled={evaluating}
                  className="px-2.5 py-1 rounded bg-[#222C38] hover:bg-[#2D3742] text-[#F39200] border border-[#F39200]/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${evaluating ? 'animate-spin' : ''}`} />
                  {evaluating ? 'Evaluando...' : 'Evaluar Flota Ahora'}
                </button>
              </div>

              {history.length === 0 ? (
                <div className="p-8 text-center bg-[#141B22] border border-[#2D3742] rounded-lg text-[#94A3B8] text-xs">
                  No se han registrado alertas despachadas recientemente.
                </div>
              ) : (
                <div className="divide-y divide-[#2D3742] bg-[#141B22] border border-[#2D3742] rounded-lg overflow-hidden max-h-[350px] overflow-y-auto text-xs">
                  {history.map(item => (
                    <div key={item.id} className="p-3 hover:bg-[#1E262F] transition-colors flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            item.severity === 'CRITICAL'
                              ? 'bg-[rgba(229,62,62,0.18)] text-[#E53E3E]'
                              : item.alert_type === 'EARLY_BURN_RATE'
                              ? 'bg-[rgba(243,146,0,0.18)] text-[#F39200]'
                              : 'bg-[rgba(221,107,32,0.18)] text-[#DD6B20]'
                          }`}>
                            {item.alert_type}
                          </span>
                          <span className="font-bold text-white truncate">{item.terminal_nickname || item.terminal_id}</span>
                        </div>
                        <div className="text-[11px] text-[#CBD5E1] mt-1">{item.message}</div>
                        <div className="text-[10px] text-[#64748B] font-mono mt-0.5">
                          Línea: {item.service_line_number || 'N/A'} • Entregado a {item.delivered_channels_count} canal(es)
                        </div>
                      </div>
                      <div className="text-[10px] text-[#94A3B8] font-mono whitespace-nowrap">
                        {item.timestamp ? item.timestamp.replace('T', ' ').substring(0, 19) : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#141A20] border-t border-[#2D3742] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#222C38] hover:bg-[#2D3742] text-[#CBD5E1] hover:text-white text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
