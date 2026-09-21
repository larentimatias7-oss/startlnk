import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header.jsx';
import KpiCards from './components/KpiCards.jsx';
import FleetChart from './components/FleetChart.jsx';
import TerminalTable from './components/TerminalTable.jsx';
import TerminalDetailModal from './components/TerminalDetailModal.jsx';
import ActionConfirmModal from './components/ActionConfirmModal.jsx';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);

  // Modals state
  const [selectedTerminalId, setSelectedTerminalId] = useState(null);
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: 'reboot',
    target: null,
  });

  const fetchOverview = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/terminals/overview');
      if (!res.ok) throw new Error('Error al conectar con la API local');
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
    } catch (err) {
      console.error('Manual sync failed:', err);
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
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      {/* App Header */}
      <Header
        kpis={data?.kpis}
        isSyncing={isSyncing}
        onSync={handleManualSync}
        onRefresh={fetchOverview}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Connection Notice / Warning */}
        {data?.kpis?.sync_status === 'WARNING' && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Modo Demostración / Caché Activo:</strong> Se están visualizando telemetría y consumos simulados o en caché. Para habilitar sincronización en vivo con la plataforma TSM ECHO, configura <code className="px-1.5 py-0.5 rounded bg-amber-500/20 font-mono text-[11px]">ECHO_EMAIL</code> y <code className="px-1.5 py-0.5 rounded bg-amber-500/20 font-mono text-[11px]">ECHO_PASSWORD</code> en el archivo <code className="px-1.5 py-0.5 rounded bg-amber-500/20 font-mono text-[11px]">backend/.env</code>.
              </span>
            </div>
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="shrink-0 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchOverview}
              className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-semibold"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
            <span className="font-medium">Iniciando Dashboard de Enlaces Starlink...</span>
          </div>
        ) : (
          <>
            {/* 1. KPI Cards */}
            <KpiCards kpis={data?.kpis} terminals={data?.terminals} />

            {/* 2. Fleet 30D Consumption Chart */}
            <FleetChart data={data?.fleet_daily_trend} />

            {/* 3. Filterable Fleet Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Inventario de Enlaces y Monitoreo de Cuotas
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  {data?.terminals?.length || 0} terminales registradas
                </span>
              </div>
              <TerminalTable
                terminals={data?.terminals}
                onSelectTerminal={id => setSelectedTerminalId(id)}
                onRequestReboot={handleOpenReboot}
                onRequestOptIn={handleOpenOptIn}
              />
            </div>
          </>
        )}
      </main>

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
        onSuccess={fetchOverview}
      />
    </div>
  );
}
