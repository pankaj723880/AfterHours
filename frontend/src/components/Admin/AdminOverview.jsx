import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Activity, 
  Zap, 
  Database, 
  Clock, 
  AlertTriangle, 
  Music2, 
  ShieldCheck, 
  ArrowUpRight,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { BACKEND_URL } from '../../utils/apiUrl';
import { USE_V2_MOBILE_ADMIN } from '../../constants/featureFlags';

export default function AdminOverview({ metrics, health, onNavigate, token, backendUrl, showToast }) {
  const cleanBackendUrl = (backendUrl && backendUrl.trim().startsWith('http'))
    ? backendUrl.trim().replace(/\/+$/, '')
    : BACKEND_URL;

  // Live Users Display Mode State
  const [liveUsersConfig, setLiveUsersConfig] = useState(null);
  const [selectedMode, setSelectedMode] = useState('real');
  const [minInput, setMinInput] = useState('500');
  const [maxInput, setMaxInput] = useState('1000');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch Live Users Configuration
  const fetchLiveUsersConfig = async () => {
    if (!token) return;
    try {
      const url = `${cleanBackendUrl}/api/admin/live-users-config`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        const isHtml = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html');
        console.warn(`[AdminOverview] Config fetch returned non-JSON (${res.status} ${res.statusText}):`, isHtml ? 'HTML document' : text);
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        console.warn('[AdminOverview] Config fetch notice:', errJson?.error || res.statusText);
        return;
      }

      const data = await res.json();
      if (data && data.mode) {
        setLiveUsersConfig(data);
        setSelectedMode(data.mode);
        setMinInput(data.minUsers ?? 500);
        setMaxInput(data.maxUsers ?? 1000);
      }
    } catch (e) {
      console.warn('[AdminOverview] Live users config fetch notice:', e.message);
    }
  };

  useEffect(() => {
    fetchLiveUsersConfig();
  }, [token, cleanBackendUrl]);

  // Handle Save Live Users Config
  const handleSaveLiveUsersConfig = async () => {
    if (!token || isSaving) return;
    setErrorMessage(null);
    setSaveSuccess(false);

    const min = parseInt(minInput, 10);
    const max = parseInt(maxInput, 10);

    if (selectedMode === 'manual') {
      if (isNaN(min) || isNaN(max)) {
        setErrorMessage('Please enter valid integers for Minimum and Maximum users.');
        return;
      }
      if (min < 0 || max < 0) {
        setErrorMessage('Minimum and Maximum users must be non-negative integers (>= 0).');
        return;
      }
      if (max < min) {
        setErrorMessage(`Maximum users (${max}) must be greater than or equal to Minimum users (${min}).`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const url = `${cleanBackendUrl}/api/admin/live-users-config`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mode: selectedMode,
          minUsers: isNaN(min) ? 500 : min,
          maxUsers: isNaN(max) ? 1000 : max
        })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        const isHtml = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html');
        throw new Error(
          isHtml
            ? `API route returned HTML (${res.status} ${res.statusText}). Endpoint: ${url}`
            : `API returned invalid response type (${contentType || 'none'}). Status: ${res.status}`
        );
      }

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setLiveUsersConfig(data.config);
        setSelectedMode(data.config?.mode || selectedMode);
        setSaveSuccess(true);
        if (showToast) {
          showToast(data.message || 'Live Users configuration updated!', 'success');
        }
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMessage(data?.error || `Failed to update Live Users configuration (${res.status} ${res.statusText})`);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error updating Live Users configuration.');
    } finally {
      setIsSaving(false);
    }
  };
  const formatUptime = (sec = 0) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const statusTotal = (metrics?.requestsByStatus?.['2xx'] || 0) +
    (metrics?.requestsByStatus?.['3xx'] || 0) +
    (metrics?.requestsByStatus?.['4xx'] || 0) +
    (metrics?.requestsByStatus?.['5xx'] || 0);

  const errorCount = (metrics?.requestsByStatus?.['4xx'] || 0) + (metrics?.requestsByStatus?.['5xx'] || 0);
  const errorPct = statusTotal > 0 ? ((errorCount / statusTotal) * 100).toFixed(1) : '0.0';

  const isDbConnected = health?.database ? (health.database.status === 'connected') : true;
  const pingLatency = (typeof health?.database?.pingLatencyMs === 'number' && health.database.pingLatencyMs >= 0)
    ? `${health.database.pingLatencyMs} ms`
    : 'N/A';
  const readyStateText = (health?.database?.readyState === 1)
    ? '1 (Ready)'
    : (health?.database?.readyState === 2 ? '2 (Connecting)' : '0 (Disconnected)');

  const activeVisitors = metrics?.activeVisitors ?? 0;
  const activeAuthUsers = metrics?.visitorBreakdown?.authenticated ?? 0;
  const activeAnonUsers = metrics?.visitorBreakdown?.anonymous ?? 0;
  const activeConn = metrics?.visitorBreakdown?.activeConnections ?? 0;

  const rpm = metrics?.requestsPerMinute ?? 0;
  const rpmUser = metrics?.requestsPerMinuteUser ?? 0;
  const processRequests = metrics?.requestsTotal ?? 0;
  const lifetimeRequests = metrics?.requestsLifetimeTotal ?? processRequests;

  const avgLatency = metrics?.avgLatencyMs ?? 0;
  const p95Latency = metrics?.p95LatencyMs ?? 0;
  const p50Latency = metrics?.p50LatencyMs ?? 0;
  const latencySamples = metrics?.latencySampleSize ?? 0;

  const serverErrors = metrics?.serverErrorsCount ?? (metrics?.requestsByStatus?.['5xx'] || 0);
  const clientErrors = metrics?.clientErrorsCount ?? (metrics?.requestsByStatus?.['4xx'] || 0);
  const eligibleTotal = metrics?.eligibleRequestsTotal ?? statusTotal;
  const serverErrorPct = metrics?.serverErrorRatePercent ?? (eligibleTotal > 0 ? ((serverErrors / eligibleTotal) * 100).toFixed(1) : '0.0');
  const totalErrorPct = metrics?.errorRatePercent ?? errorPct;

  const uptimeSeconds = metrics?.uptimeSeconds || health?.server?.uptimeSeconds || 0;

  return (
    <div className="space-y-6">
      {/* Top Metric Cards (V2: High-Density 2x2 on mobile, 4-col on desktop) */}
      <div className={USE_V2_MOBILE_ADMIN ? "grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4" : "grid grid-cols-2 md:grid-cols-4 gap-4"}>
        {/* Active Visitors */}
        <div className={USE_V2_MOBILE_ADMIN
          ? "bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition"
          : "bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition"
        }>
          <div className="flex items-center justify-between text-neutral-400 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider truncate" title="Unique active visitor sessions deduplicated across browser tabs and connections">
              Live Visitors
            </span>
            <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${activeVisitors > 0 ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50' : 'bg-neutral-600'}`} />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-1.5">
            <span>{activeVisitors}</span>
            <span className="text-[10px] sm:text-xs font-medium px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">actual</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-neutral-400 mt-1 flex flex-col gap-0.5">
            <div className="flex items-center gap-1 truncate">
              <span className="text-emerald-400 font-semibold">{activeAuthUsers}</span> auth • <span className="text-neutral-300 font-semibold">{activeAnonUsers}</span> anon
            </div>
            <div className="text-[9px] sm:text-[10px] text-amber-400/90 font-medium truncate">
              Public: <span className="font-bold">{liveUsersConfig?.mode === 'real' ? activeVisitors : (liveUsersConfig?.currentDisplayCount ?? activeVisitors)}</span> ({liveUsersConfig?.mode === 'manual' ? 'Range' : 'Real'})
            </div>
          </div>
        </div>

        {/* Requests Per Minute */}
        <div className={USE_V2_MOBILE_ADMIN
          ? "bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition"
          : "bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition"
        }>
          <div className="flex items-center justify-between text-neutral-400 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider truncate" title="Rolling 60-second request rate">
              RPM (Traffic)
            </span>
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-1.5">
            <span>{rpm}</span>
            <span className="text-[10px] sm:text-xs font-medium px-1.5 py-0.2 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">user RPM</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-neutral-400 mt-1 truncate">
            <span className="text-emerald-400 font-semibold">{rpmUser}</span> user (60s rolling)
            <div className="text-[9px] sm:text-[10px] text-neutral-500 truncate">
              Proc: {processRequests}
            </div>
          </div>
        </div>

        {/* Latency */}
        <div className={USE_V2_MOBILE_ADMIN
          ? "bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition"
          : "bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition"
        }>
          <div className="flex items-center justify-between text-neutral-400 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider truncate" title="Monotonic request duration (excluding background polling)">
              Avg Latency
            </span>
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-1.5">
            <span>{avgLatency}</span><span className="text-xs sm:text-sm font-normal text-neutral-400">ms</span>
            <span className="text-[10px] sm:text-xs font-medium px-1.5 py-0.2 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">p95</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-neutral-400 mt-1 truncate">
            <span className="text-emerald-400 font-semibold">{p95Latency}ms</span> p95 • {p50Latency}ms p50
            <div className="text-[9px] sm:text-[10px] text-neutral-500 truncate">
              {latencySamples} sample{latencySamples !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Error Rate */}
        <div className={USE_V2_MOBILE_ADMIN
          ? "bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition"
          : "bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition"
        }>
          <div className="flex items-center justify-between text-neutral-400 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider truncate" title="Server errors (5xx) vs client errors (4xx)">
              Error Rate
            </span>
            <ShieldCheck className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${serverErrors > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
          </div>
          <div className={`text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight flex items-baseline gap-1.5 ${serverErrors > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            <span>{serverErrorPct}%</span>
            <span className="text-[10px] sm:text-xs font-medium px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">5xx</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-neutral-400 mt-1 truncate">
            <span className="text-red-400 font-medium">{serverErrors} 5xx</span> • <span className="text-amber-400 font-medium">{clientErrors} 4xx</span>
            <div className="text-[9px] sm:text-[10px] text-neutral-500 truncate">
              {eligibleTotal} total ({totalErrorPct}% all)
            </div>
          </div>
        </div>
      </div>

      {/* Live Users Counter Display Mode Control */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">Live Users Counter Display Control</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                liveUsersConfig?.mode === 'manual'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}>
                {liveUsersConfig?.mode === 'manual' ? 'Mode B: Manual Range Active' : 'Mode A: Real Live Users Active'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Configure what public visitors see on the header live counter across the site.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-neutral-950/80 px-3 py-1.5 rounded-xl border border-neutral-800 text-xs text-neutral-300">
            <span className="text-neutral-500 font-medium">Public Stream:</span>
            <span className="text-amber-400 font-bold font-mono text-sm">
              {liveUsersConfig?.mode === 'real'
                ? activeVisitors
                : (liveUsersConfig?.currentDisplayCount ?? activeVisitors)}
            </span>
            <span className="text-[10px] text-neutral-400">users</span>
          </div>
        </div>

        {/* Two Mode Cards (V2: sleek compact radio-card toggles) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Mode A: Real Live Users */}
          <div
            onClick={() => setSelectedMode('real')}
            className={`rounded-xl p-3 sm:p-4 border transition cursor-pointer relative ${
              selectedMode === 'real'
                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="live_users_mode"
                  checked={selectedMode === 'real'}
                  onChange={() => setSelectedMode('real')}
                  className="accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs sm:text-sm font-bold text-white">Mode A: Real Live Users</span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                Genuine Presence
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">
              Display the actual number of currently active users tracked in real time. Deduplicated across browser tabs.
            </p>
            <div className="mt-2.5 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] sm:text-xs">
              <span className="text-neutral-500">Current Genuine Count:</span>
              <span className="font-mono font-bold text-emerald-400">{activeVisitors} active</span>
            </div>
          </div>

          {/* Mode B: Manual Display Range */}
          <div
            onClick={() => setSelectedMode('manual')}
            className={`rounded-xl p-3 sm:p-4 border transition cursor-pointer relative ${
              selectedMode === 'manual'
                ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="live_users_mode"
                  checked={selectedMode === 'manual'}
                  onChange={() => setSelectedMode('manual')}
                  className="accent-amber-500 cursor-pointer"
                />
                <span className="text-xs sm:text-sm font-bold text-white">Mode B: Manual Range</span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-semibold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                Configured Range
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">
              Generates a realistic display count within a set minimum and maximum range, smoothly refreshed.
            </p>

            {/* Inline inputs for sleek compact mobile display */}
            <div className="mt-2.5 pt-2 border-t border-neutral-800/60 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
                <label className="text-[9px] sm:text-[10px] uppercase font-bold text-neutral-400 whitespace-nowrap">
                  Min:
                </label>
                <input
                  type="number"
                  min="0"
                  value={minInput}
                  onChange={(e) => setMinInput(e.target.value)}
                  disabled={selectedMode !== 'manual'}
                  placeholder="500"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-amber-500 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
                <label className="text-[9px] sm:text-[10px] uppercase font-bold text-neutral-400 whitespace-nowrap">
                  Max:
                </label>
                <input
                  type="number"
                  min="0"
                  value={maxInput}
                  onChange={(e) => setMaxInput(e.target.value)}
                  disabled={selectedMode !== 'manual'}
                  placeholder="1000"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-amber-500 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Validation Error & Status */}
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Settings saved successfully! Live display updated in real time across all connected clients.</span>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-neutral-500">
            Internal analytics, unique session logs, and database tracking remain 100% genuine regardless of display mode.
          </p>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchLiveUsersConfig}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-lg border border-neutral-700 transition cursor-pointer"
            >
              Reset / Reload
            </button>
            <button
              onClick={handleSaveLiveUsersConfig}
              disabled={isSaving}
              className="px-5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs rounded-lg shadow-md shadow-amber-500/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Apply & Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Subsystem Health Cards (V2: High-density 2-col or 3-col on desktop) */}
      <div className={USE_V2_MOBILE_ADMIN ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" : "grid grid-cols-1 md:grid-cols-3 gap-4"}>
        {/* MongoDB Status */}
        <div className={USE_V2_MOBILE_ADMIN
          ? "bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-emerald-500/30 transition backdrop-blur-md"
          : "bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/30 transition"
        }>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                MongoDB Atlas
              </span>
              <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                isDbConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
                {isDbConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-neutral-300 font-medium">
              Ping Latency: <span className="text-emerald-400 font-bold">{pingLatency}</span>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
              ReadyState: <span className="text-emerald-400 font-medium">{readyStateText}</span>
            </p>
          </div>
          <button 
            onClick={() => onNavigate('health')}
            className="mt-3 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
          >
            Diagnostics & details <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Server Runtime */}
        <div className={USE_V2_MOBILE_ADMIN
          ? "bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-emerald-500/30 transition backdrop-blur-md"
          : "bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/30 transition"
        }>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Server Runtime
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                Node {health?.server?.nodeVersion || 'v20.18.0'}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-neutral-300 font-medium">
              Uptime: <span className="text-emerald-400 font-bold">{formatUptime(uptimeSeconds)}</span>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
              Memory: {health?.server?.memoryUsage?.heapUsedMB ?? 0} MB used / {health?.server?.memoryUsage?.heapTotalMB ?? 0} MB heap
            </p>
          </div>
          <button 
            onClick={() => onNavigate('health')}
            className="mt-3 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
          >
            Server performance <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* YouTube API Status */}
        <div className={USE_V2_MOBILE_ADMIN
          ? "bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-emerald-500/30 transition backdrop-blur-md sm:col-span-2 lg:col-span-1"
          : "bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/30 transition"
        }>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5 text-emerald-400" />
                Music Search Engine
              </span>
              <span className="text-[10px] sm:text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold shadow-sm shadow-emerald-500/20">
                Operational
              </span>
            </div>
            <div className="text-xs sm:text-sm text-neutral-300 font-medium">
              API Hits: <span className="text-white font-bold">{metrics?.youtubeStats?.apiHits ?? 0}</span> | Fallback: <span className="text-white font-bold">{metrics?.youtubeStats?.fallbackHits ?? 0}</span>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
              Curated Hits: {metrics?.youtubeStats?.curatedFallbackHits ?? 0} | Quota errors: {metrics?.youtubeStats?.quotaErrors ?? 0}
            </p>
          </div>
          <button 
            onClick={() => onNavigate('music')}
            className="mt-3 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
          >
            Music analytics & searches <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('traffic')}
          className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 hover:border-emerald-500/40 text-left transition group cursor-pointer"
        >
          <Activity className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition">Live Traffic</div>
          <div className="text-[11px] text-neutral-400">Stream requests & endpoints</div>
        </button>

        <button
          onClick={() => onNavigate('users')}
          className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 hover:border-emerald-500/40 text-left transition group cursor-pointer"
        >
          <Users className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition">User Management</div>
          <div className="text-[11px] text-neutral-400">Manage roles, status & CRUD</div>
        </button>

        <button
          onClick={() => onNavigate('music')}
          className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 hover:border-emerald-500/40 text-left transition group cursor-pointer"
        >
          <Music2 className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition">Music Analytics</div>
          <div className="text-[11px] text-neutral-400">Popular queries & playback</div>
        </button>

        <button
          onClick={() => onNavigate('audit')}
          className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 hover:border-emerald-500/40 text-left transition group cursor-pointer"
        >
          <ShieldCheck className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition">Audit Logs</div>
          <div className="text-[11px] text-neutral-400">Security & admin trail</div>
        </button>
      </div>
    </div>
  );
}
