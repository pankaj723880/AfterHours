import React from 'react';
import { 
  Users, 
  Activity, 
  Zap, 
  Database, 
  Clock, 
  AlertTriangle, 
  Music2, 
  ShieldCheck, 
  ArrowUpRight 
} from 'lucide-react';

export default function AdminOverview({ metrics, health, onNavigate }) {
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

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Visitors */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-amber-500/30 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Live Visitors</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {metrics?.activeVisitors ?? 0}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1.5">
            <span className="text-amber-400 font-medium">{metrics?.activeAuthenticatedUsers ?? 0}</span> authenticated
          </div>
        </div>

        {/* Requests Per Minute */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-amber-500/30 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">RPM (Traffic)</span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {metrics?.requestsPerMinute ?? 0}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Total {metrics?.requestsTotal ?? 0} requests served
          </div>
        </div>

        {/* Latency */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-amber-500/30 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Latency</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {metrics?.avgLatencyMs ?? 0}<span className="text-sm font-normal text-neutral-400 ml-1">ms</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Across recent 200 requests
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group hover:border-amber-500/30 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Error Rate</span>
            <AlertTriangle className={`w-4 h-4 ${parseFloat(errorPct) > 5 ? 'text-red-400' : 'text-neutral-400'}`} />
          </div>
          <div className={`text-2xl md:text-3xl font-extrabold tracking-tight ${parseFloat(errorPct) > 5 ? 'text-red-400' : 'text-emerald-400'}`}>
            {errorPct}%
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {errorCount} errors recorded
          </div>
        </div>
      </div>

      {/* Subsystem Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* MongoDB Status */}
        <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-500" />
                MongoDB Atlas
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                health?.database?.status === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
                {health?.database?.status === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="text-sm text-neutral-300 font-medium">
              Ping Latency: <span className="text-white font-bold">{health?.database?.pingLatencyMs ?? -1} ms</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Connection readyState: {health?.database?.readyState === 1 ? '1 (Ready)' : '0 (Not connected)'}
            </p>
          </div>
          <button 
            onClick={() => onNavigate('health')}
            className="mt-4 text-xs font-medium text-amber-500 hover:text-amber-400 flex items-center gap-1 transition"
          >
            Diagnostics & details <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Server Runtime */}
        <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Server Runtime
              </span>
              <span className="text-[11px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                Node {health?.server?.nodeVersion || 'v20+'}
              </span>
            </div>
            <div className="text-sm text-neutral-300 font-medium">
              Uptime: <span className="text-white font-bold">{formatUptime(metrics?.uptimeSeconds || 0)}</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Memory: {health?.server?.memoryUsage?.heapUsedMB ?? 0} MB used / {health?.server?.memoryUsage?.heapTotalMB ?? 0} MB heap
            </p>
          </div>
          <button 
            onClick={() => onNavigate('health')}
            className="mt-4 text-xs font-medium text-amber-500 hover:text-amber-400 flex items-center gap-1 transition"
          >
            Server performance <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* YouTube API Status */}
        <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                <Music2 className="w-4 h-4 text-amber-500" />
                Music Search Engine
              </span>
              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                Operational
              </span>
            </div>
            <div className="text-sm text-neutral-300 font-medium">
              API Hits: <span className="text-white font-bold">{metrics?.youtubeStats?.apiHits ?? 0}</span> | Scraper: <span className="text-white font-bold">{metrics?.youtubeStats?.scraperHits ?? 0}</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Fallback Hits: {metrics?.youtubeStats?.fallbackHits ?? 0} | Quota errors: {metrics?.youtubeStats?.quotaErrors ?? 0}
            </p>
          </div>
          <button 
            onClick={() => onNavigate('music')}
            className="mt-4 text-xs font-medium text-amber-500 hover:text-amber-400 flex items-center gap-1 transition"
          >
            Music analytics & searches <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('traffic')}
          className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 hover:border-amber-500/40 text-left transition group"
        >
          <Activity className="w-5 h-5 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-bold text-white">Live Traffic</div>
          <div className="text-[11px] text-neutral-400">Stream requests & endpoints</div>
        </button>

        <button
          onClick={() => onNavigate('users')}
          className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 hover:border-amber-500/40 text-left transition group"
        >
          <Users className="w-5 h-5 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-bold text-white">User Management</div>
          <div className="text-[11px] text-neutral-400">Manage roles, status & CRUD</div>
        </button>

        <button
          onClick={() => onNavigate('music')}
          className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 hover:border-amber-500/40 text-left transition group"
        >
          <Music2 className="w-5 h-5 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-bold text-white">Music Analytics</div>
          <div className="text-[11px] text-neutral-400">Popular queries & playback</div>
        </button>

        <button
          onClick={() => onNavigate('audit')}
          className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 hover:border-amber-500/40 text-left transition group"
        >
          <ShieldCheck className="w-5 h-5 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-bold text-white">Audit Logs</div>
          <div className="text-[11px] text-neutral-400">Security & admin trail</div>
        </button>
      </div>
    </div>
  );
}
