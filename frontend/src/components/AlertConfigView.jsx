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
  Bot,
  Layers,
  Radio,
  Timer
} from 'lucide-react';

export default function AlertConfigView({ onNotify, isEmbedded = false }) {
  const [activeTab, setActiveTab] = useState('telegram'); // 'telegram', 'rules', 'history'
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testingRealId, setTestingRealId] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Bots State
  const [bots, setBots] = useState([]);
  const [newBot, setNewBot] = useState({ name: '', token: '', is_default: false });
  const [addingBot, setAddingBot] = useState(false);
  const [showNewBotToken, setShowNewBotToken] = useState(false);

  // Configuration Form State
  const [config, setConfig] = useState({
    telegram_bot_token: '',
    quota_threshold_percent: 80,
    quota_critical_percent: 100,
    early_warning_percent: 60,
    early_warning_days_remaining: 15,
    alert_on_offline: false,
    cooldown_hours: 12,
    sync_interval_minutes: 15,
    is_enabled: true
  });

  const [channels, setChannels] = useState([]);
  const [newChannel, setNewChannel] = useState({ name: '', chat_id: '', bot_id: '' });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [resCfg, resBots, resChans, resHist] = await Promise.all([
        fetch('/api/alerts/config').then(r => r.json()),
        fetch('/api/alerts/bots').then(r => r.json()),
        fetch('/api/alerts/channels').then(r => r.json()),
        fetch('/api/alerts/history').then(r => r.json())
      ]);

      if (resCfg) setConfig(resCfg);
      if (Array.isArray(resBots)) setBots(resBots);
      if (Array.isArray(resChans)) setChannels(resChans);
      if (Array.isArray(resHist)) setHistory(resHist);
    } catch (e) {
      console.error(e);
      if (onNotify) onNotify('Error al cargar datos del sistema de alertas', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Bot Handlers ---

  const handleAddBot = async (e) => {
    e.preventDefault();
    if (!newBot.name.trim() || !newBot.token.trim()) {
      if (onNotify) onNotify('Ingresa un nombre y el token provisto por @BotFather', 'warning');
      return;
    }

    setAddingBot(true);
    try {
      const res = await fetch('/api/alerts/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBot.name.trim(),
          token: newBot.token.trim(),
          is_default: newBot.is_default
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (onNotify) onNotify(`✅ Bot '@${data.bot_username}' conectado exitosamente`, 'success');
        setNewBot({ name: '', token: '', is_default: false });
        // Reload bots
        const updatedBots = await fetch('/api/alerts/bots').then(r => r.json());
        if (Array.isArray(updatedBots)) setBots(updatedBots);
      } else {
        if (onNotify) onNotify(`Error: ${data.detail || data.error}`, 'error');
      }
    } catch (err) {
      if (onNotify) onNotify('Error de conexión al registrar bot', 'error');
    } finally {
      setAddingBot(false);
    }
  };

  const handleToggleBot = async (botId, currentActive) => {
    try {
      const res = await fetch(`/api/alerts/bots/${botId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive })
      });
      if (res.ok) {
        const updated = await res.json();
        setBots(prev => prev.map(b => b.id === botId ? updated : b));
        if (onNotify) onNotify(`Bot '${updated.name}' ${updated.is_active ? 'activado' : 'pausado'}`, 'info');
      }
    } catch (e) {
      if (onNotify) onNotify('Error al actualizar bot', 'error');
    }
  };

  const handleSetDefaultBot = async (botId) => {
    try {
      const res = await fetch(`/api/alerts/bots/${botId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true })
      });
      if (res.ok) {
        const updatedBots = await fetch('/api/alerts/bots').then(r => r.json());
        if (Array.isArray(updatedBots)) setBots(updatedBots);
        if (onNotify) onNotify('Bot predeterminado actualizado', 'success');
      }
    } catch (e) {
      if (onNotify) onNotify('Error al configurar bot predeterminado', 'error');
    }
  };

  const handleDeleteBot = async (botId, name) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el bot "${name}"? Los canales vinculados usarán el bot predeterminado.`)) return;
    try {
      const res = await fetch(`/api/alerts/bots/${botId}`, { method: 'DELETE' });
      if (res.ok) {
        setBots(prev => prev.filter(b => b.id !== botId));
        // Reload channels to refresh unlinked bots
        const updatedChans = await fetch('/api/alerts/channels').then(r => r.json());
        if (Array.isArray(updatedChans)) setChannels(updatedChans);
        if (onNotify) onNotify(`Bot '${name}' eliminado`, 'info');
      }
    } catch (e) {
      if (onNotify) onNotify('Error al eliminar bot', 'error');
    }
  };

  // --- Channel Handlers ---

  const handleAddChannel = async (e) => {
    e.preventDefault();
    if (!newChannel.name.trim() || !newChannel.chat_id.trim()) {
      if (onNotify) onNotify('Ingresa nombre y Chat ID del canal', 'warning');
      return;
    }

    try {
      const payload = {
        name: newChannel.name.trim(),
        chat_id: newChannel.chat_id.trim(),
        bot_id: newChannel.bot_id ? parseInt(newChannel.bot_id) : null
      };

      const res = await fetch('/api/alerts/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const created = await res.json();
        setChannels(prev => [...prev, created]);
        setNewChannel({ name: '', chat_id: '', bot_id: '' });
        if (onNotify) onNotify(`Canal '${created.name}' registrado exitosamente`, 'success');
      } else {
        const err = await res.json();
        if (onNotify) onNotify(err.detail || 'Error al registrar canal', 'error');
      }
    } catch (e) {
      if (onNotify) onNotify('Error de conexión al registrar canal', 'error');
    }
  };

  const handleChannelBotChange = async (channelId, newBotId) => {
    try {
      const res = await fetch(`/api/alerts/channels/${channelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: newBotId ? parseInt(newBotId) : null })
      });
      if (res.ok) {
        const updated = await res.json();
        setChannels(prev => prev.map(c => c.id === channelId ? updated : c));
        if (onNotify) onNotify(`Bot emisor actualizado para '${updated.name}'`, 'info');
      }
    } catch (e) {
      if (onNotify) onNotify('Error al actualizar bot del canal', 'error');
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
    setTestingId(channel.id);
    try {
      const res = await fetch('/api/alerts/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channel.chat_id,
          bot_id: channel.bot_id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const sender = channel.bot_username ? `@${channel.bot_username}` : 'Bot activo';
        if (onNotify) onNotify(`✅ Mensaje entregado a '${channel.name}' vía ${sender}`, 'success');
      } else {
        if (onNotify) onNotify(`Error en Telegram: ${data.detail || data.error}`, 'error');
      }
    } catch (e) {
      if (onNotify) onNotify('Error al enviar prueba a Telegram', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleTestChannelRealAlerts = async (channel) => {
    setTestingRealId(channel.id);
    try {
      const res = await fetch(`/api/alerts/channels/${channel.id}/test-real-alerts`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const count = data.alerts_count ?? 0;
        const sent = data.alerts_sent ?? 0;
        const sender = data.bot_username ? `@${data.bot_username}` : 'Bot';
        if (count === 0) {
          if (onNotify) onNotify(`✅ Reporte de flota saludable enviado a '${channel.name}' (0 alertas vigentes)`, 'success');
        } else {
          if (onNotify) onNotify(`⚡ Se enviaron ${sent} de ${count} alertas reales vigentes a '${channel.name}' vía ${sender}`, 'success');
        }
        // Refresh alert history if available
        const resHist = await fetch('/api/alerts/history').then(r => r.json());
        if (Array.isArray(resHist)) setHistory(resHist);
      } else {
        if (onNotify) onNotify(`Error al probar alertas reales: ${data.detail || data.error || 'Fallo de envío'}`, 'error');
      }
    } catch (e) {
      if (onNotify) onNotify('Error al conectar con la API para prueba con alertas reales', 'error');
    } finally {
      setTestingRealId(null);
    }
  };

  // --- Configuration Handlers ---

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        const saved = await res.json();
        setConfig(saved);
        if (onNotify) onNotify('Parámetros de monitoreo y alertas guardados exitosamente', 'success');
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

  const SYNC_PRESETS = [5, 10, 15, 30, 60];
  const COOLDOWN_PRESETS = [2, 4, 6, 12, 24];

  return (
    <div className={`space-y-6 ${isEmbedded ? 'p-1' : 'p-6 max-w-7xl mx-auto animate-fadeIn'}`}>
      {/* Top Banner / Header */}
      {!isEmbedded && (
        <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[rgba(243,146,0,0.12)] border border-[#F39200]/30 text-[#F39200] flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Centro de Configuración de Alertas & Bots de Telegram
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Supervisa el consumo de ancho de banda, gestiona múltiples bots, parametriza frecuencias de monitoreo y canales de guardia.
              </p>
            </div>
          </div>

          <button
            onClick={handleEvaluateNow}
            disabled={evaluating}
            className="px-4 py-2.5 rounded-lg bg-[#222C38] hover:bg-[#2D3742] text-[#F39200] border border-[#F39200]/30 hover:border-[#F39200] text-xs font-bold transition-all flex items-center gap-2 shrink-0 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${evaluating ? 'animate-spin' : ''}`} />
            <span>{evaluating ? 'Evaluando...' : 'Evaluar Flota en Vivo'}</span>
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-[#2D3742] flex items-center justify-between">
        <div className="flex space-x-2">
          {[
            { id: 'telegram', label: '1. Bots & Canales de Telegram', icon: Send, count: channels.length },
            { id: 'rules', label: '2. Reglas, Umbrales & Tiempos', icon: Sliders },
            { id: 'history', label: '3. Bitácora de Alertas Despachadas', icon: History, count: history.length }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#F39200] text-[#F39200] bg-[rgba(243,146,0,0.06)]'
                    : 'border-transparent text-[#94A3B8] hover:text-white hover:border-[#64748B]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-[#F39200] text-slate-950' : 'bg-[#222C38] text-[#94A3B8]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: TELEGRAM MULTI-BOTS & CHANNELS */}
      {activeTab === 'telegram' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left 2 Cols: Multi-Bot Management & Channel List */}
          <div className="lg:col-span-2 space-y-5">
            
            {/* Multi-Bot Management Card */}
            <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(49,130,206,0.16)] text-[#3182CE] border border-[#3182CE]/30 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Bots de Telegram Conectados</h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      Puedes registrar múltiples bots oficiales para derivar notificaciones según área o criticidad
                    </p>
                  </div>
                </div>

                <span className="text-xs text-[#3182CE] font-mono font-bold px-2 py-0.5 rounded bg-[rgba(49,130,206,0.12)] border border-[rgba(49,130,206,0.3)]">
                  {bots.filter(b => b.is_active).length} activos de {bots.length}
                </span>
              </div>

              {/* Bot List Cards */}
              {bots.length === 0 ? (
                <div className="p-6 text-center bg-[#141B22] border border-[#2D3742] rounded-lg text-[#94A3B8] text-xs">
                  No hay bots de Telegram registrados. Conecta tu primer bot a continuación.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {bots.map(bot => (
                    <div
                      key={bot.id}
                      className="p-3.5 bg-[#141B22] border border-[#2D3742] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#3182CE]/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white truncate">{bot.name}</span>
                          <span className="text-xs text-[#3182CE] font-mono font-semibold">
                            @{bot.bot_username || 'bot'}
                          </span>
                          {bot.is_default && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-[rgba(243,146,0,0.16)] text-[#F39200] border border-[rgba(243,146,0,0.3)]">
                              PREDETERMINADO
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                            bot.is_active
                              ? 'bg-[rgba(56,161,105,0.16)] text-[#38A169] border border-[#38A169]/30'
                              : 'bg-[#222C38] text-[#64748B]'
                          }`}>
                            {bot.is_active ? 'ACTIVO' : 'PAUSADO'}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#64748B] mt-1 flex items-center gap-3">
                          <span>Token: <span className="text-[#CBD5E1]">{bot.token_masked}</span></span>
                          <span>• Canales asociados: <strong className="text-[#F39200]">{bot.channels_count}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {!bot.is_default && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultBot(bot.id)}
                            className="px-2.5 py-1 rounded bg-[#222C38] hover:bg-[#2D3742] text-[#94A3B8] hover:text-white border border-[#2D3742] text-[11px] font-semibold transition-colors"
                            title="Hacer bot predeterminado para canales sin bot explícito"
                          >
                            Hacer Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleBot(bot.id, bot.is_active)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                            bot.is_active
                              ? 'bg-[#222C38] text-[#94A3B8] hover:text-white'
                              : 'bg-[rgba(56,161,105,0.16)] text-[#38A169] border border-[#38A169]/30'
                          }`}
                        >
                          {bot.is_active ? 'Pausar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBot(bot.id, bot.name)}
                          className="p-1.5 rounded text-[#64748B] hover:text-[#E53E3E] hover:bg-[rgba(229,62,62,0.12)] transition-colors"
                          title="Eliminar bot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Form: Add New Bot */}
              <form onSubmit={handleAddBot} className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-3">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#3182CE]" />
                  <span>Conectar Nuevo Bot de Telegram</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-[#94A3B8] block mb-1">Nombre Descriptivo del Bot:</label>
                    <input
                      type="text"
                      placeholder="Ej: Alertas Zabbix NOC, Bot Gerencia"
                      value={newBot.name}
                      onChange={e => setNewBot(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-[#0F141A] border border-[#2D3742] rounded-md text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#3182CE]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#94A3B8] block mb-1">HTTP API Token (@BotFather):</label>
                    <div className="relative">
                      <input
                        type={showNewBotToken ? 'text' : 'password'}
                        placeholder="Ej: 8899338410:AAHP..."
                        value={newBot.token}
                        onChange={e => setNewBot(prev => ({ ...prev, token: e.target.value }))}
                        className="w-full pl-3 pr-8 py-1.5 bg-[#0F141A] border border-[#2D3742] rounded-md text-xs text-white placeholder-[#64748B] font-mono focus:outline-none focus:border-[#3182CE]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewBotToken(!showNewBotToken)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
                      >
                        {showNewBotToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#CBD5E1]">
                    <input
                      type="checkbox"
                      checked={newBot.is_default}
                      onChange={e => setNewBot(prev => ({ ...prev, is_default: e.target.checked }))}
                      className="rounded bg-[#0F141A] border-[#2D3742] text-[#3182CE] focus:ring-0"
                    />
                    <span>Establecer como bot predeterminado</span>
                  </label>

                  <button
                    type="submit"
                    disabled={addingBot}
                    className="px-4 py-1.5 rounded-lg bg-[#222C38] hover:bg-[#2D3742] text-[#3182CE] border border-[#3182CE]/30 hover:border-[#3182CE] font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${addingBot ? 'animate-spin' : ''}`} />
                    <span>{addingBot ? 'Validando con Telegram...' : '+ Validar y Conectar Bot'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Channels & Groups List Card */}
            <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Canales y Grupos Destinatarios</h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Destinos donde se enviarán las alertas automáticas de la flota asociadas a su bot correspondiente
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
                      className="p-3.5 bg-[#141B22] border border-[#2D3742] rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#F39200]/30 transition-colors"
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
                        <div className="text-[11px] font-mono text-[#64748B] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Chat ID: <span className="text-[#CBD5E1]">{ch.chat_id}</span></span>
                          <span className="flex items-center gap-1.5">
                            • Bot Emisor:
                            <select
                              value={ch.bot_id || ''}
                              onChange={e => handleChannelBotChange(ch.id, e.target.value)}
                              className="bg-[#0F141A] border border-[#2D3742] rounded text-[11px] text-[#3182CE] font-sans px-1.5 py-0.5 focus:outline-none focus:border-[#3182CE]"
                            >
                              <option value="">(Predeterminado)</option>
                              {bots.map(b => (
                                <option key={b.id} value={b.id}>
                                  {b.name} (@{b.bot_username})
                                </option>
                              ))}
                            </select>
                          </span>
                        </div>
                      </div>

                      {/* Channel Controls: Test, Test Real Alerts, Pause/Resume, Delete */}
                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleTestChannel(ch)}
                          disabled={testingId === ch.id || testingRealId === ch.id}
                          className="px-3 py-1.5 rounded-md bg-[#222C38] hover:bg-[#2D3742] text-[#CBD5E1] hover:text-white border border-[#2D3742] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          title="Enviar mensaje de prueba de conectividad a este canal"
                        >
                          <Send className={`w-3.5 h-3.5 ${testingId === ch.id ? 'animate-bounce text-[#F39200]' : 'text-[#F39200]'}`} />
                          <span>{testingId === ch.id ? 'Enviando...' : 'Probar Canal'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTestChannelRealAlerts(ch)}
                          disabled={testingRealId === ch.id || testingId === ch.id}
                          className="px-3 py-1.5 rounded-md bg-[rgba(243,146,0,0.12)] hover:bg-[rgba(243,146,0,0.22)] text-[#F39200] hover:text-white border border-[#F39200]/40 hover:border-[#F39200] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                          title="Evalúa la flota en vivo y envía las alertas reales vigentes a este canal"
                        >
                          <Zap className={`w-3.5 h-3.5 ${testingRealId === ch.id ? 'animate-spin text-[#F39200]' : 'text-[#F39200]'}`} />
                          <span>{testingRealId === ch.id ? 'Despachando...' : 'Alertas Reales'}</span>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                      placeholder="Ej: -100192837482"
                      value={newChannel.chat_id}
                      onChange={e => setNewChannel(prev => ({ ...prev, chat_id: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-[#0F141A] border border-[#2D3742] rounded-md text-xs text-white placeholder-[#64748B] font-mono focus:outline-none focus:border-[#F39200]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#94A3B8] block mb-1">Bot Emisor Asociado:</label>
                    <select
                      value={newChannel.bot_id}
                      onChange={e => setNewChannel(prev => ({ ...prev, bot_id: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-[#0F141A] border border-[#2D3742] rounded-md text-xs text-white focus:outline-none focus:border-[#F39200]"
                    >
                      <option value="">Bot Predeterminado</option>
                      {bots.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} (@{b.bot_username})
                        </option>
                      ))}
                    </select>
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

              <div className="p-3 rounded-lg bg-[rgba(49,130,206,0.12)] border border-[#3182CE]/30 text-[#3182CE] text-[11px] space-y-1">
                <strong>💡 Arquitectura Multi-Bot Milicic:</strong>
                <p>
                  Puedes tener un bot para Infraestructura Crítica (@inframilicic_bot) y otro para Telemetría Zabbix. Al crear o editar un canal, eliges qué bot emitirá las alertas hacia ese grupo específico.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RULES, THRESHOLDS & MONITORING FREQUENCIES */}
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
                  max="24"
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
                      {h}h {h === 12 ? '(Recom.)' : ''}
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
