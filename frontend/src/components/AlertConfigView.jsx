import React, { useState, useEffect } from 'react';
import {
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
  RefreshCw,
  HelpCircle,
  CheckCircle2,
  ExternalLink,
  Bot
} from 'lucide-react';

export default function AlertConfigView({ onNotify, isEmbedded = false }) {
  const [activeTab, setActiveTab] = useState('telegram'); // 'telegram', 'rules', 'history'
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [verifyingBot, setVerifyingBot] = useState(false);
  const [verifiedBotInfo, setVerifiedBotInfo] = useState(null);

  // Configuration Form State
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
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [resCfg, resChans, resHist] = await Promise.all([
        fetch('/api/alerts/config').then(r => r.json()),
        fetch('/api/alerts/channels').then(r => r.json()),
        fetch('/api/alerts/history').then(r => r.json())
      ]);

      if (resCfg) {
        setConfig(resCfg);
        if (resCfg.telegram_bot_token) {
          // Verify bot silently to show username badge if already configured
          checkBotToken(resCfg.telegram_bot_token, false);
        }
      }
      if (Array.isArray(resChans)) setChannels(resChans);
      if (Array.isArray(resHist)) setHistory(resHist);
    } catch (e) {
      console.error(e);
      if (onNotify) onNotify('Error al cargar parámetros de alerta', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkBotToken = async (tokenToCheck, notifyUser = true) => {
    if (!tokenToCheck || !tokenToCheck.trim()) {
      if (notifyUser && onNotify) onNotify('Ingresa un token para verificar', 'warning');
      return;
    }

    setVerifyingBot(true);
    try {
      const res = await fetch('/api/alerts/verify-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: tokenToCheck.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerifiedBotInfo(data);
        if (notifyUser && onNotify) {
          onNotify(`✅ Bot verificado: @${data.bot_username} (${data.bot_name})`, 'success');
        }
      } else {
        setVerifiedBotInfo(null);
        if (notifyUser && onNotify) {
          onNotify(`Token inválido: ${data.detail || data.error}`, 'error');
        }
      }
    } catch (err) {
      console.error(err);
      if (notifyUser && onNotify) onNotify('Error de conexión al verificar bot', 'error');
    } finally {
      setVerifyingBot(false);
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
        if (onNotify) onNotify('Parámetros de alertas guardados exitosamente', 'success');
        if (config.telegram_bot_token) {
          checkBotToken(config.telegram_bot_token, false);
        }
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
      if (onNotify) onNotify('Ingresa nombre y Chat ID del canal', 'warning');
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
        if (onNotify) onNotify(`Canal '${created.name}' registrado exitosamente`, 'success');
      } else {
        const err = await res.json();
        if (onNotify) onNotify(err.detail || 'Error al registrar canal', 'error');
      }
    } catch (e) {
      if (onNotify) onNotify('Error de conexión al registrar canal', 'error');
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
        if (onNotify) onNotify(`Canal ${updated.is_active ? 'activado' : 'pausado'}`, 'info');
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
      if (onNotify) onNotify('Configura y guarda primero el Bot Token de Telegram', 'warning');
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
        if (onNotify) {
          onNotify(`Evaluación completada: ${data.alerts_generated || 0} alertas generadas, ${data.alerts_sent || 0} despachadas.`, 'info');
        }
        const resHist = await fetch('/api/alerts/history').then(r => r.json());
        if (Array.isArray(resHist)) setHistory(resHist);
      }
    } catch (e) {
      if (onNotify) onNotify('Error al evaluar alertas', 'error');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className={`space-y-5 ${isEmbedded ? '' : 'animate-fadeIn'}`}>
      {/* Top Banner / Navigation Tabs */}
      <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#2D3742]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[rgba(243,146,0,0.16)] text-[#F39200] border border-[rgba(243,146,0,0.3)] flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Centro de Configuración de Alertas & Bots de Telegram
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Supervisa el consumo de ancho de banda, parametriza el algoritmo predictivo de ritmo acelerado y administra canales de despacho.
              </p>
            </div>
          </div>

          {/* Quick Evaluation Button */}
          <button
            onClick={handleEvaluateNow}
            disabled={evaluating}
            className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[rgba(243,146,0,0.16)] hover:bg-[#F39200] text-[#F39200] hover:text-slate-950 border border-[rgba(243,146,0,0.35)] text-xs font-bold transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
            <span>{evaluating ? 'Evaluando flota...' : 'Evaluar Flota en Vivo'}</span>
          </button>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex items-center gap-2 pt-3 overflow-x-auto text-xs font-bold">
          {[
            { id: 'telegram', label: '1. Bots & Canales de Telegram', icon: Send, badge: `${channels.length} canales` },
            { id: 'rules', label: '2. Reglas de Consumo & Umbrales', icon: Sliders },
            { id: 'history', label: '3. Bitácora de Alertas Despachadas', icon: History, badge: history.length }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#F39200] text-slate-950 shadow-sm'
                    : 'bg-[#141B22] text-[#94A3B8] hover:text-white hover:bg-[#222C38] border border-[#2D3742]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-[#222C38] text-[#94A3B8]'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: TELEGRAM BOT & CHANNELS */}
      {activeTab === 'telegram' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left 2 Cols: Bot Configuration & Channel List */}
          <div className="lg:col-span-2 space-y-5">
            {/* Telegram Bot Token Card */}
            <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(49,130,206,0.16)] text-[#3182CE] border border-[#3182CE]/30 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Bot de Telegram Oficial</h3>
                    <p className="text-[11px] text-[#94A3B8]">Token provisto por @BotFather para emitir notificaciones</p>
                  </div>
                </div>

                {/* Status Badge */}
                {verifiedBotInfo ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[rgba(56,161,105,0.16)] text-[#38A169] border border-[#38A169]/30 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    @{verifiedBotInfo.bot_username}
                  </span>
                ) : (
                  <span className="text-xs text-[#94A3B8] font-mono px-2 py-1 rounded bg-[#141B22] border border-[#2D3742]">
                    Sin verificar
                  </span>
                )}
              </div>

              {/* Token Input + Action Buttons */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={config.telegram_bot_token || ''}
                      onChange={e => {
                        setConfig(prev => ({ ...prev, telegram_bot_token: e.target.value }));
                        setVerifiedBotInfo(null);
                      }}
                      placeholder="Pega aquí el Token (ej: 7283948192:AAH9fklw_xyz981245...)"
                      className="w-full pl-3.5 pr-10 py-2 bg-[#0F141A] border border-[#2D3742] rounded-lg text-xs text-white placeholder-[#64748B] font-mono focus:outline-none focus:border-[#F39200]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
                      title={showToken ? 'Ocultar token' : 'Ver token'}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Verify Bot Live Button */}
                  <button
                    type="button"
                    onClick={() => checkBotToken(config.telegram_bot_token, true)}
                    disabled={verifyingBot}
                    className="px-3.5 py-2 rounded-lg bg-[#222C38] hover:bg-[#2D3742] text-[#3182CE] border border-[#3182CE]/30 hover:border-[#3182CE] text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                    title="Verificar token contra los servidores de Telegram"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${verifyingBot ? 'animate-spin' : ''}`} />
                    <span>{verifyingBot ? 'Verificando...' : 'Verificar Bot'}</span>
                  </button>

                  {/* Save Token Button */}
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg bg-[#F39200] hover:bg-[#D98200] text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar</span>
                  </button>
                </div>

                {verifiedBotInfo && (
                  <div className="p-2.5 rounded-md bg-[rgba(56,161,105,0.12)] border border-[#38A169]/30 text-xs text-[#38A169] flex items-center justify-between font-mono">
                    <span>✅ Conectado a: <strong>{verifiedBotInfo.bot_name}</strong> (@{verifiedBotInfo.bot_username})</span>
                    <span className="text-[10px] text-[#94A3B8]">ID: {verifiedBotInfo.bot_id}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Channels & Groups List Card */}
            <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Canales y Grupos Destinatarios</h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Destinos donde se enviarán las alertas automáticas de la flota
                  </p>
                </div>
                <span className="text-xs text-[#F39200] font-mono font-bold px-2 py-0.5 rounded bg-[rgba(243,146,0,0.16)] border border-[rgba(243,146,0,0.3)]">
                  {channels.filter(c => c.is_active).length} activos de {channels.length}
                </span>
              </div>

              {/* Channels Cards */}
              {channels.length === 0 ? (
                <div className="p-8 text-center bg-[#141B22] border border-[#2D3742] rounded-lg text-[#94A3B8] text-xs">
                  No hay canales de Telegram registrados. Agrega uno a continuación.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {channels.map(ch => (
                    <div
                      key={ch.id}
                      className="p-3.5 bg-[#141B22] border border-[#2D3742] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#F39200]/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white truncate">{ch.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                            ch.is_active
                              ? 'bg-[rgba(56,161,105,0.16)] text-[#38A169] border border-[#38A169]/30'
                              : 'bg-[#222C38] text-[#64748B]'
                          }`}>
                            {ch.is_active ? 'ACTIVO' : 'PAUSADO'}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#64748B] mt-1">
                          Chat ID: <span className="text-[#CBD5E1]">{ch.chat_id}</span>
                        </div>
                      </div>

                      {/* Channel Controls: Test, Pause/Resume, Delete */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleTestChannel(ch)}
                          disabled={testingId === ch.id}
                          className="px-3 py-1.5 rounded-md bg-[#222C38] hover:bg-[#2D3742] text-[#CBD5E1] hover:text-white border border-[#2D3742] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          title="Enviar mensaje de prueba a este canal ahora"
                        >
                          <Send className={`w-3.5 h-3.5 ${testingId === ch.id ? 'animate-bounce text-[#F39200]' : 'text-[#F39200]'}`} />
                          <span>{testingId === ch.id ? 'Enviando...' : 'Probar Canal'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleChannel(ch.id, ch.is_active)}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                            ch.is_active
                              ? 'bg-[#222C38] text-[#94A3B8] hover:text-white'
                              : 'bg-[rgba(243,146,0,0.16)] text-[#F39200] border border-[rgba(243,146,0,0.3)]'
                          }`}
                        >
                          {ch.is_active ? 'Pausar' : 'Activar'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteChannel(ch.id, ch.name)}
                          className="p-1.5 rounded-md text-[#64748B] hover:text-[#E53E3E] hover:bg-[rgba(229,62,62,0.12)] transition-colors"
                          title="Eliminar canal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Channel Form */}
              <form onSubmit={handleAddChannel} className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-3">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#F39200]" />
                  <span>Agregar Nuevo Canal o Grupo de Telegram</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-[#94A3B8] block mb-1">Nombre Descriptivo:</label>
                    <input
                      type="text"
                      placeholder="Ej: Guardia NOC Minería Milicic"
                      value={newChannel.name}
                      onChange={e => setNewChannel(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-[#0F141A] border border-[#2D3742] rounded-md text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#F39200]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#94A3B8] block mb-1">Chat ID del Grupo/Canal:</label>
                    <input
                      type="text"
                      placeholder="Ej: -100192837482 o @nombrecanal"
                      value={newChannel.chat_id}
                      onChange={e => setNewChannel(prev => ({ ...prev, chat_id: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-[#0F141A] border border-[#2D3742] rounded-md text-xs text-white placeholder-[#64748B] font-mono focus:outline-none focus:border-[#F39200]"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-[#222C38] hover:bg-[#2D3742] text-[#F39200] border border-[#F39200]/30 hover:border-[#F39200] font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Guardar Canal</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Col: Helper Guide */}
          <div className="space-y-4">
            <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl p-5 space-y-3.5 shadow-sm text-xs">
              <div className="flex items-center gap-2 text-white font-bold">
                <HelpCircle className="w-4 h-4 text-[#F39200]" />
                <span>¿Cómo Configurar el Bot en 3 Pasos?</span>
              </div>

              <div className="space-y-3 text-[#CBD5E1] text-[11px] leading-relaxed">
                <div className="p-2.5 rounded bg-[#141B22] border border-[#2D3742]">
                  <strong className="text-[#F39200] block mb-0.5">1. Crear Bot con @BotFather</strong>
                  Abre Telegram, busca al usuario oficial <code>@BotFather</code> y escribe <code>/newbot</code>. Sigue las instrucciones y copia el <strong>HTTP API Token</strong> generado.
                </div>

                <div className="p-2.5 rounded bg-[#141B22] border border-[#2D3742]">
                  <strong className="text-[#F39200] block mb-0.5">2. Añadir Bot al Grupo o Canal</strong>
                  Crea un grupo de guardia o canal en Telegram y agrega tu bot como <strong>Administrador</strong> con permisos para enviar mensajes.
                </div>

                <div className="p-2.5 rounded bg-[#141B22] border border-[#2D3742]">
                  <strong className="text-[#F39200] block mb-0.5">3. Obtener el Chat ID</strong>
                  Añade temporalmente a <code>@RawDataBot</code> o <code>@userinfobot</code> a tu grupo para ver el número de Chat ID (suele empezar con <code>-100...</code>). Luego pégalo en el formulario y pulsa <strong>Probar Canal</strong>.
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[rgba(49,130,206,0.12)] border border-[#3182CE]/30 text-[#3182CE] text-[11px]">
                <strong>💡 Tip Milicic:</strong> Puedes registrar múltiples grupos para distintas áreas (ej: Guardias NOC, Jefatura de Comunicaciones o Logística).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RULES AND THRESHOLDS PARAMETERIZATION */}
      {activeTab === 'rules' && (
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

          {/* Regla 3 y 4: Offline Alert y Anti-Spam Cooldown */}
          <div className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex items-center justify-between">
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

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#CBD5E1] font-semibold">Ventana Anti-Spam (Cooldown):</span>
                <strong className="text-[#F39200] font-mono">{config.cooldown_hours} horas</strong>
              </div>
              <input
                type="range"
                min="2"
                max="48"
                step="2"
                value={config.cooldown_hours}
                onChange={e => setConfig(prev => ({ ...prev, cooldown_hours: parseInt(e.target.value) }))}
                className="w-full accent-[#F39200] cursor-pointer"
              />
              <span className="text-[10px] text-[#64748B] block">
                No repetirá la misma alerta para la misma antena durante este período.
              </span>
            </div>
          </div>

          {/* Action Save Bar */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveConfig}
              disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-[#F39200] hover:bg-[#D98200] text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Todos los Parámetros</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: ALERT HISTORY LOGS */}
      {activeTab === 'history' && (
        <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Bitácora de Alertas Despachadas</h3>
              <p className="text-[11px] text-[#94A3B8]">
                Registro cronológico de eventos analizados y enviados por Telegram
              </p>
            </div>
            <button
              onClick={handleEvaluateNow}
              disabled={evaluating}
              className="px-3 py-1.5 rounded-lg bg-[#222C38] hover:bg-[#2D3742] text-[#F39200] border border-[#F39200]/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
              <span>{evaluating ? 'Evaluando...' : 'Evaluar Flota Ahora'}</span>
            </button>
          </div>

          {history.length === 0 ? (
            <div className="p-8 text-center bg-[#141B22] border border-[#2D3742] rounded-lg text-[#94A3B8] text-xs">
              No se han registrado eventos de alerta en la bitácora reciente.
            </div>
          ) : (
            <div className="divide-y divide-[#2D3742] bg-[#141B22] border border-[#2D3742] rounded-lg overflow-hidden max-h-[420px] overflow-y-auto text-xs">
              {history.map(item => (
                <div key={item.id} className="p-3.5 hover:bg-[#1E262F] transition-colors flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.severity === 'CRITICAL'
                          ? 'bg-[rgba(229,62,62,0.18)] text-[#E53E3E] border border-[#E53E3E]/40'
                          : item.alert_type === 'EARLY_BURN_RATE'
                          ? 'bg-[rgba(243,146,0,0.18)] text-[#F39200] border border-[#F39200]/40'
                          : 'bg-[rgba(221,107,32,0.18)] text-[#DD6B20] border border-[#DD6B20]/40'
                      }`}>
                        {item.alert_type}
                      </span>
                      <span className="font-bold text-white truncate">{item.terminal_nickname || item.terminal_id}</span>
                    </div>
                    <div className="text-[11px] text-[#CBD5E1] mt-1">{item.message}</div>
                    <div className="text-[10px] text-[#64748B] font-mono mt-0.5">
                      Línea: {item.service_line_number || 'N/A'} • Canales alcanzados: {item.delivered_channels_count}
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
  );
}
