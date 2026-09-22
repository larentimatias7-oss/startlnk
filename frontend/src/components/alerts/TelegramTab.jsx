import React from 'react';
import {
  Bot,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
  Zap,
  HelpCircle
} from 'lucide-react';

export default function TelegramTab({
  bots,
  channels,
  newBot,
  setNewBot,
  addingBot,
  showNewBotToken,
  setShowNewBotToken,
  newChannel,
  setNewChannel,
  testingId,
  testingRealId,
  onAddBot,
  onToggleBot,
  onSetDefaultBot,
  onDeleteBot,
  onAddChannel,
  onToggleChannel,
  onChannelBotChange,
  onTestChannel,
  onTestChannelRealAlerts,
  onDeleteChannel
}) {
  return (
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
                        onClick={() => onSetDefaultBot(bot.id)}
                        className="px-2.5 py-1 rounded bg-[#222C38] hover:bg-[#2D3742] text-[#94A3B8] hover:text-white border border-[#2D3742] text-[11px] font-semibold transition-colors"
                        title="Hacer bot predeterminado para canales sin bot explícito"
                      >
                        Hacer Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleBot(bot.id, bot.is_active)}
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
                      onClick={() => onDeleteBot(bot.id, bot.name)}
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
          <form onSubmit={onAddBot} className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-3">
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
                          onChange={e => onChannelBotChange(ch.id, e.target.value)}
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

                  {/* Channel Controls */}
                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onTestChannel(ch)}
                      disabled={testingId === ch.id || testingRealId === ch.id}
                      className="px-3 py-1.5 rounded-md bg-[#222C38] hover:bg-[#2D3742] text-[#CBD5E1] hover:text-white border border-[#2D3742] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Enviar mensaje de prueba de conectividad a este canal"
                    >
                      <Send className={`w-3.5 h-3.5 ${testingId === ch.id ? 'animate-bounce text-[#F39200]' : 'text-[#F39200]'}`} />
                      <span>{testingId === ch.id ? 'Enviando...' : 'Probar Canal'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onTestChannelRealAlerts(ch)}
                      disabled={testingRealId === ch.id || testingId === ch.id}
                      className="px-3 py-1.5 rounded-md bg-[rgba(243,146,0,0.12)] hover:bg-[rgba(243,146,0,0.22)] text-[#F39200] hover:text-white border border-[#F39200]/40 hover:border-[#F39200] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                      title="Evalúa la flota en vivo y envía las alertas reales vigentes a este canal"
                    >
                      <Zap className={`w-3.5 h-3.5 ${testingRealId === ch.id ? 'animate-spin text-[#F39200]' : 'text-[#F39200]'}`} />
                      <span>{testingRealId === ch.id ? 'Despachando...' : 'Alertas Reales'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleChannel(ch.id, ch.is_active)}
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
                      onClick={() => onDeleteChannel(ch.id, ch.name)}
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
          <form onSubmit={onAddChannel} className="p-4 bg-[#141B22] border border-[#2D3742] rounded-lg space-y-3">
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
  );
}
