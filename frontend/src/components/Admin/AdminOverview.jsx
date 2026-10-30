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

export default function AdminOverview({ metrics, health, onNavigate, token, backendUrl, showToast }) {
  const cleanBackendUrl = (backendUrl || '').trim().replace(/\/+$/, '');

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
      const res = await fetch(`${cleanBackendUrl}/api/admin/live-users-config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLiveUsersConfig(data);
        setSelectedMode(data.mode || 'real');
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
    if (!token) return;
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
      const res = await fetch(`${cleanBackendUrl}/api/admin/live-users-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mode: selectedMode,
          minUsers: isNaN(min) ? 500 : min,
          maxUsers: isNaN(max) ? 1000 : max
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLiveUsersConfig(data.config);
        setSaveSuccess(true);
        if (showToast) {
          showToast(data.message || 'Live Users configuration updated!', 'success');
        }
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to update Live Users configuration.');
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
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Visitors */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider" title="Unique active visitor sessions deduplicated across browser tabs and connections">
              Live Visitors
            </span>
            <div className={`w-2.5 h-2.5 rounded-full ${activeVisitors > 0 ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50' : 'bg-neutral-600'}`} />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
            <span>{activeVisitors}</span>
            <span className="text-xs font-semibold text-neutral-400">actual</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1 flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-semibold">{activeAuthUsers}</span> auth • <span className="text-neutral-300 font-semibold">{activeAnonUsers}</span> anon
            </div>
            <div className="text-[10px] text-amber-400/90 font-medium mt-0.5 truncate">
              Public: <span className="font-bold">{liveUsersConfig?.currentDisplayCount ?? activeVisitors}</span> ({liveUsersConfig?.mode === 'manual' ? 'Manual Range' : 'Real'})
            </div>
          </div>
        </div>

        {/* Requests Per Minute */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider" title="Rolling 60-second request rate">
              RPM (Traffic)
            </span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {rpm}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            <span className="text-emerald-400 font-semibold">{rpmUser}</span> user RPM (60s rolling)
            <div className="text-[10px] text-neutral-500 mt-0.5">
              Proc: {processRequests} • Lifetime: {lifetimeRequests}
            </div>
          </div>
        </div>

        {/* Latency */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider" title="Monotonic request duration (excluding background polling)">
              Avg Latency
            </span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {avgLatency}<span className="text-sm font-normal text-neutral-400 ml-1">ms</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            <span className="text-emerald-400 font-semibold">p95: {p95Latency}ms</span> • p50: {p50Latency}ms
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {latencySamples} recent sample{latencySamples !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider" title="Server errors (5xx) vs client errors (4xx)">
              Error Rate
            </span>
            <ShieldCheck className={`w-4 h-4 ${serverErrors > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
          </div>
          <div className={`text-2xl md:text-3xl font-extrabold tracking-tight ${serverErrors > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {serverErrorPct}% <span className="text-xs font-normal text-neutral-400">5xx</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            <span className="text-red-400 font-medium">{serverErrors} 5xx</span> • <span className="text-amber-400 font-medium">{clientErrors} 4xx</span>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {eligibleTotal} eligible request{eligibleTotal !== 1 ? 's' : ''} ({totalErrorPct}% all)
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
              {liveUsersConfig?.currentDisplayCount ?? activeVisitors}
            </span>
            <span className="text-[10px] text-neutral-400">users</span>
          </div>
        </div>

        {/* Two Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode A: Real Live Users */}
          <div
            onClick={() => setSelectedMode('real')}
            className={`rounded-xl p-4 border transition cursor-pointer relative ${
              selectedMode === 'real'
                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="live_users_mode"
                  checked={selectedMode === 'real'}
                  onChange={() => setSelectedMode('real')}
                  className="accent-emerald-500 cursor-pointer"
                />
                <span className="text-sm font-bold text-white">Mode A: Real Live Users</span>
              </div>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                Genuine Presence
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Display the actual number of currently active users tracked in real time. Deduplicated across browser tabs with expired sessions automatically removed.
            </p>
            <div className="mt-3 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-xs">
              <span className="text-neutral-500">Current Genuine Count:</span>
              <span className="font-mono font-bold text-emerald-400">{activeVisitors} active</span>
            </div>
          </div>

          {/* Mode B: Manual Display Range */}
          <div
            onClick={() => setSelectedMode('manual')}
            className={`rounded-xl p-4 border transition cursor-pointer relative ${
              selectedMode === 'manual'
                ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="live_users_mode"
                  checked={selectedMode === 'manual'}
                  onChange={() => setSelectedMode('manual')}
                  className="accent-amber-500 cursor-pointer"
                />
                <span className="text-sm font-bold text-white">Mode B: Manual Display Range</span>
              </div>
              <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                Configured Range
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Generates a realistic display count within a set minimum and maximum range. Refreshed smoothly every 30–60s without sudden spikes.
            </p>

            {/* Inputs */}
            <div className="mt-3 pt-2 border-t border-neutral-800/60 grid grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                  Minimum Users
                </label>
                <input
                  type="number"
                  min="0"
                  value={minInput}
                  onChange={(e) => setMinInput(e.target.value)}
                  disabled={selectedMode !== 'manual'}
                  placeholder="e.g. 500"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                  Maximum Users
                </label>
                <input
                  type="number"
                  min="0"
                  value={maxInput}
                  onChange={(e) => setMaxInput(e.target.value)}
                  disabled={selectedMode !== 'manual'}
                  placeholder="e.g. 1000"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none disabled:opacity-50"
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

      {/* Subsystem Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* MongoDB Status */}
        <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/30 transition">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                MongoDB Atlas
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                isDbConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
                {isDbConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="text-sm text-neutral-300 font-medium">
              Ping Latency: <span className="text-emerald-400 font-bold">{pingLatency}</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Connection readyState: <span className="text-emerald-400 font-medium">{readyStateText}</span>
            </p>
          </div>
          <button 
            onClick={() => onNavigate('health')}
            className="mt-4 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
          >
            Diagnostics & details <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Server Runtime */}
        <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/30 transition">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Server Runtime
              </span>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                Node {health?.server?.nodeVersion || 'v20.18.0'}
              </span>
            </div>
            <div className="text-sm text-neutral-300 font-medium">
              Uptime: <span className="text-emerald-400 font-bold">{formatUptime(uptimeSeconds)}</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Memory: {health?.server?.memoryUsage?.heapUsedMB ?? 0} MB used / {health?.server?.memoryUsage?.heapTotalMB ?? 0} MB heap
            </p>
          </div>
          <button 
            onClick={() => onNavigate('health')}
            className="mt-4 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
          >
            Server performance <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* YouTube API Status */}
        <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/30 transition">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <Music2 className="w-4 h-4 text-emerald-400" />
                Music Search Engine
              </span>
              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold shadow-sm shadow-emerald-500/20">
                Operational
              </span>
            </div>
            <div className="text-sm text-neutral-300 font-medium">
              API Hits: <span className="text-white font-bold">{metrics?.youtubeStats?.apiHits ?? 0}</span> | Fallback: <span className="text-white font-bold">{metrics?.youtubeStats?.fallbackHits ?? 0}</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Curated Hits: {metrics?.youtubeStats?.curatedFallbackHits ?? 0} | Quota errors: {metrics?.youtubeStats?.quotaErrors ?? 0}
            </p>
          </div>
          <button 
            onClick={() => onNavigate('music')}
            className="mt-4 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
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
