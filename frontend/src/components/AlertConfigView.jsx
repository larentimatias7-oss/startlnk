import React, { useState, useEffect } from 'react';
import {
  Bell,
  Send,
  Sliders,
  History,
  RefreshCw
} from 'lucide-react';
import TelegramTab from './alerts/TelegramTab';
import RulesTab from './alerts/RulesTab';
import HistoryTab from './alerts/HistoryTab';

export default function AlertConfigView({ onNotify, isEmbedded = false }) {
  const [activeTab, setActiveTab] = useState('telegram'); // 'telegram', 'rules', 'history'
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testingRealId, setTestingRealId] = useState(null);
  const [evaluating, setEvaluating] = useState(false);

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
    cooldown_hours: 24,
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
        <TelegramTab
          bots={bots}
          channels={channels}
          newBot={newBot}
          setNewBot={setNewBot}
          addingBot={addingBot}
          showNewBotToken={showNewBotToken}
          setShowNewBotToken={setShowNewBotToken}
          newChannel={newChannel}
          setNewChannel={setNewChannel}
          testingId={testingId}
          testingRealId={testingRealId}
          onAddBot={handleAddBot}
          onToggleBot={handleToggleBot}
          onSetDefaultBot={handleSetDefaultBot}
          onDeleteBot={handleDeleteBot}
          onAddChannel={handleAddChannel}
          onToggleChannel={handleToggleChannel}
          onChannelBotChange={handleChannelBotChange}
          onTestChannel={handleTestChannel}
          onTestChannelRealAlerts={handleTestChannelRealAlerts}
          onDeleteChannel={handleDeleteChannel}
        />
      )}

      {/* TAB 2: RULES, THRESHOLDS & MONITORING FREQUENCIES */}
      {activeTab === 'rules' && (
        <RulesTab
          config={config}
          setConfig={setConfig}
          loading={loading}
          onSaveConfig={handleSaveConfig}
        />
      )}

      {/* TAB 3: ALERT HISTORY LOGS */}
      {activeTab === 'history' && (
        <HistoryTab
          history={history}
          evaluating={evaluating}
          onEvaluateNow={handleEvaluateNow}
        />
      )}
    </div>
  );
}
