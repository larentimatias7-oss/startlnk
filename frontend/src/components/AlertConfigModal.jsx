import React from 'react';
import { X } from 'lucide-react';
import AlertConfigView from './AlertConfigView';

export default function AlertConfigModal({ isOpen, onClose, onNotify }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1A222B] border border-[#2D3742] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative">
        {/* Modal Top Close Bar */}
        <div className="p-3 bg-[#141A20] border-b border-[#2D3742] flex items-center justify-between">
          <span className="text-xs font-bold text-[#F39200] uppercase tracking-wider pl-2">
            Panel de Configuración Rápida de Alertas
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#222C38] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          <AlertConfigView onNotify={onNotify} isEmbedded={true} />
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
