import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function HistoryTab({ history, evaluating, onEvaluateNow }) {
  return (
    <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Bitácora de Alertas Despachadas</h3>
          <p className="text-[11px] text-[#94A3B8]">
            Registro cronológico de eventos analizados y enviados por Telegram
          </p>
        </div>
        <button
          onClick={onEvaluateNow}
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
  );
}
