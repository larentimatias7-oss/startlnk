import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header.jsx';
import KpiCards from './components/KpiCards.jsx';
import FleetChart from './components/FleetChart.jsx';
import TerminalTable from './components/TerminalTable.jsx';
import TerminalDetailModal from './components/TerminalDetailModal.jsx';
import ActionConfirmModal from './components/ActionConfirmModal.jsx';
import AlertConfigModal from './components/AlertConfigModal.jsx';
import Toast from './components/Toast.jsx';
import MilicicLogo from './components/MilicicLogo.jsx';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);

  // Toast state
  const [toast, setToast] = useState({ message: null, type: 'info' });

  // Modals state
  const [selectedTerminalId, setSelectedTerminalId] = useState(null);
  const [isAlertConfigOpen, setIsAlertConfigOpen] = useState(false);
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: 'reboot',
    target: null,
  });


  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const fetchOverview = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/terminals/overview');
      if (!res.ok) throw new Error('Error de conexión con la API local de Starlink');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    // Background polling every 30s
    const interval = setInterval(fetchOverview, 30000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/terminals/sync', { method: 'POST' });
      const result = await res.json();
      await fetchOverview();
      showToast(result.message || 'Sincronización con TSM ECHO completada', 'success');
    } catch (err) {
      console.error('Manual sync failed:', err);
      showToast('Fallo al sincronizar con TSM ECHO', 'danger');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenReboot = (terminal) => {
    setActionModal({
      isOpen: true,
      type: 'reboot',
      target: terminal,
    });
  };

  const handleOpenOptIn = (terminal) => {
    setActionModal({
      isOpen: true,
      type: 'opt-in',
      target: terminal,
    });
  };

  return (
    <div className="min-h-screen bg-[#0F141A] text-[#F1F5F9] flex flex-col font-sans selection:bg-[#F39200]/30 selection:text-[#F1F5F9]">
      {/* Toast Notification Container */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: null, type: 'info' })}
      />

      {/* App Header */}
      <Header
        kpis={data?.kpis}
        isSyncing={isSyncing}
        onSync={handleManualSync}
        onRefresh={fetchOverview}
        onOpenAlerts={() => setIsAlertConfigOpen(true)}
      />


      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-5 space-y-5">
        {/* Demo Mode / Warning Banner */}
        {data?.kpis?.sync_status === 'WARNING' && (
          <div className="p-3.5 rounded-lg bg-[#1A222B] border border-[#DD6B20]/40 text-[#CBD5E1] text-xs flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#DD6B20] shrink-0" />
              <span>
                <strong className="text-[#F1F5F9]">Modo Demostración / Caché Activo:</strong> Se están visualizando consumos en caché. Para sincronización en vivo con TSM ECHO, configura las credenciales en <code className="px-1.5 py-0.5 rounded bg-[#141B22] border border-[#2D3742] font-mono text-[11px] text-[#F39200]">.env</code>.
              </span>
            </div>
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="shrink-0 px-3 py-1 rounded-md bg-[rgba(243,146,0,0.16)] hover:bg-[#F39200] text-[#F39200] hover:text-slate-950 text-xs font-bold transition-colors border border-[rgba(243,146,0,0.3)]"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Global Error Notice */}
        {error && (
          <div className="p-3.5 rounded-lg bg-[rgba(229,62,62,0.12)] border border-[#E53E3E]/40 text-[#F1F5F9] text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchOverview}
              className="px-3 py-1 rounded-md bg-[#E53E3E] text-white font-bold text-xs hover:bg-[#C53030] transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-[#94A3B8] text-xs flex flex-col items-center gap-2.5">
            <RefreshCw className="w-7 h-7 animate-spin text-[#F39200]" />
            <span className="font-semibold text-[#F1F5F9]">Cargando flota de terminales Starlink...</span>
          </div>
        ) : (
          <>
            {/* 1. Tarjetas KPI */}
            <KpiCards kpis={data?.kpis} terminals={data?.terminals} />

            {/* 2. Gráfico de Tendencia 30 Días */}
            <FleetChart data={data?.fleet_daily_trend} />

            {/* 3. Grilla de Inventario */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">
                  Inventario de Enlaces Satelitales y Cuotas
                </h2>
                <span className="text-xs text-[#94A3B8] font-mono">
                  {data?.terminals?.length || 0} terminales registradas
                </span>
              </div>
              <TerminalTable
                terminals={data?.terminals}
                onSelectTerminal={id => setSelectedTerminalId(id)}
                onRequestReboot={handleOpenReboot}
                onRequestOptIn={handleOpenOptIn}
                onCopyNotice={(msg) => showToast(msg, 'info')}
              />
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2D3742] bg-[#141A20] px-4 lg:px-8 py-3 text-xs text-[#94A3B8] mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <MilicicLogo height={20} white={true} />
            <span className="text-[#64748B]">|</span>
            <span>Sistema Corporativo de Telemetría Starlink • Milicic S.A.</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>TSM Patagonia Engine</span>
            <span className="text-[#64748B]">•</span>
            <span className="text-[#38A169]">ECHO Connected</span>
          </div>
        </div>
      </footer>

      {/* Terminal Detail Modal */}
      {selectedTerminalId && (
        <TerminalDetailModal
          deviceId={selectedTerminalId}
          onClose={() => setSelectedTerminalId(null)}
          onRequestReboot={handleOpenReboot}
          onRequestOptIn={handleOpenOptIn}
        />
      )}

      {/* Action Confirmation Modal */}
      <ActionConfirmModal
        isOpen={actionModal.isOpen}
        actionType={actionModal.type}
        target={actionModal.target}
        onClose={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
        onSuccess={() => {
          fetchOverview();
          showToast('Instrucción enviada exitosamente al Backoffice', 'success');
        }}
      />

      {/* Alert & Telegram Configuration Modal */}
      <AlertConfigModal
        isOpen={isAlertConfigOpen}
        onClose={() => setIsAlertConfigOpen(false)}
        onNotify={(msg, type) => showToast(msg, type)}
      />
    </div>
  );
}

