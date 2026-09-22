import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, RotateCw, Wifi, WifiOff, Globe, Radio, Activity } from 'lucide-react';

export default function ConnectivityHealthWidget({
  terminal,
  onOpenReboot,
  onOpenWifiSettings,
  onOpenBypassMode,
}) {
  const [liveData, setLiveData] = useState({
    downlink_mbps: terminal?.downlink_mbps || 0.0,
    uplink_mbps: terminal?.uplink_mbps || 0.0,
    ping_ms: terminal?.ping_ms || 0.0,
    signal_quality: terminal?.signal_quality || 100.0,
    wifi_bypassed: terminal?.wifi_bypassed || false,
    is_online: terminal?.is_online || false,
  });
  const [isLivePolling, setIsLivePolling] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const deviceId = terminal?.device_id;

  // Real-time polling every 12 seconds
  useEffect(() => {
    if (!deviceId) return;
    let isMounted = true;

    const fetchLive = async () => {
      try {
        setIsLivePolling(true);
        const res = await fetch(`/api/terminals/${deviceId}/live-telemetry`);
        if (res.ok && isMounted) {
          const json = await res.json();
          setLiveData({
            downlink_mbps: json.downlink_mbps,
            uplink_mbps: json.uplink_mbps,
            ping_ms: json.ping_ms,
            signal_quality: json.signal_quality,
            wifi_bypassed: json.wifi_bypassed,
            is_online: json.is_online,
          });
        }
      } catch (err) {
        console.error('Error polling live telemetry:', err);
      } finally {
        if (isMounted) setIsLivePolling(false);
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [deviceId]);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const dl = Number(liveData.downlink_mbps || 0);
  const ul = Number(liveData.uplink_mbps || 0);
  // Scale matching ECHO (0 to 400 MB/s)
  const dlProgress = Math.min((dl / 400) * 100, 100);
  const ulProgress = Math.min((ul / 400) * 100, 100);

  return (
    <div className="bg-[#141B22] border border-[#2D3742] rounded-xl p-4 sm:p-5 relative shadow-lg">
      {/* Widget Header with ECHO Title and 3-Dots Menu */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">
            Connectivity & Health
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#38A169]/10 text-[#38A169] border border-[#38A169]/30">
            <span className={`w-1.5 h-1.5 rounded-full ${liveData.is_online ? 'bg-[#38A169] animate-pulse' : 'bg-[#E53E3E]'}`} />
            {isLivePolling ? 'Actualizando...' : liveData.is_online ? 'En Vivo' : 'Offline'}
          </span>
        </div>

        {/* 3-dots Context Menu Button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-[#1F2937] transition-colors border border-transparent hover:border-[#374151]"
            title="Opciones de conectividad"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown Menu (Screenshot 3) */}
          {menuOpen && (
            <div className="absolute right-0 top-10 w-56 bg-[#1A222B] border border-[#2D3742] rounded-lg shadow-2xl z-50 py-1.5 animate-fadeIn">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (onOpenReboot) onOpenReboot(terminal);
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-[#E2E8F0] hover:bg-[#24303E] flex items-center gap-2.5 transition-colors"
              >
                <RotateCw className="w-4 h-4 text-[#94A3B8]" />
                <span>Reboot</span>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (onOpenWifiSettings) onOpenWifiSettings(terminal);
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-[#E2E8F0] hover:bg-[#24303E] flex items-center gap-2.5 transition-colors"
              >
                <Wifi className="w-4 h-4 text-[#F39200]" />
                <span>Edit WiFi settings</span>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (onOpenBypassMode) onOpenBypassMode(terminal);
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-[#E2E8F0] hover:bg-[#24303E] flex items-center gap-2.5 transition-colors"
              >
                <WifiOff className="w-4 h-4 text-[#DD6B20]" />
                <span>{liveData.wifi_bypassed ? 'Disable bypass mode' : 'Enable bypass mode'}</span>
              </button>

              <div className="border-t border-[#2D3742] my-1" />

              <div className="px-3.5 py-2 text-xs text-[#94A3B8] flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-[#3182CE]" />
                <span>Public IP: {terminal?.has_public_ip ? 'Habilitada' : 'CGNAT'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Downlink Rate Row */}
      <div className="space-y-1.5 mb-4">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-semibold text-[#CBD5E1]">Downlink Rate</span>
          <span className="font-mono text-base font-bold text-[#00A389] tracking-tight">
            {dl.toFixed(2)} <span className="text-xs font-sans text-[#94A3B8]">MB/s</span>
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00A389] to-[#38A169] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(dlProgress, dl > 0 ? 2 : 0)}%` }}
          />
        </div>
      </div>

      {/* Uplink Rate Row */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-semibold text-[#CBD5E1]">Uplink Rate</span>
          <span className="font-mono text-base font-bold text-[#00A389] tracking-tight">
            {ul.toFixed(2)} <span className="text-xs font-sans text-[#94A3B8]">MB/s</span>
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00A389] to-[#38A169] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(ulProgress, ul > 0 ? 2 : 0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
