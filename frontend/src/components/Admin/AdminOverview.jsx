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
          <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {activeVisitors}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1 flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-semibold">{activeAuthUsers}</span> auth • <span className="text-neutral-300 font-semibold">{activeAnonUsers}</span> anon
            </div>
            <div className="text-[10px] text-neutral-500">
              {activeConn} active socket connection{activeConn !== 1 ? 's' : ''}
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
