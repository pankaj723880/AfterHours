import React from 'react';
import { 
  Server, 
  Database, 
  Cpu, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Radio, 
  RefreshCw 
} from 'lucide-react';

export default function ServerHealth({ health, metrics, onRefresh, isLoading }) {
  const formatUptime = (sec = 0) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const dbStatus = health?.database?.status === 'connected';

  return (
    <div className="space-y-6">
      {/* Header and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-500" />
            API & Server Subsystems Diagnostics
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real hardware, database latency, and streaming connection health
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Re-check Diagnostics
        </button>
      </div>

      {/* Grid of Diagnostics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Database Health Card */}
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Database className="w-4 h-4 text-amber-500" />
              MongoDB Database
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              dbStatus
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {dbStatus ? 'Healthy' : 'Degraded'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
              <div className="text-neutral-500 text-[10px] uppercase font-bold">Roundtrip Ping</div>
              <div className="text-base font-mono font-bold text-white mt-1">
                {health?.database?.pingLatencyMs ?? -1} ms
              </div>
            </div>

            <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
              <div className="text-neutral-500 text-[10px] uppercase font-bold">Mongoose State</div>
              <div className="text-base font-mono font-bold text-white mt-1">
                {health?.database?.readyState === 1 ? '1 (Connected)' : '0 (Offline)'}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80 font-mono">
            Status: {health?.database?.status || 'unknown'}
          </div>
        </div>

        {/* Server Memory & Node Runtime */}
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Cpu className="w-4 h-4 text-amber-500" />
              Node.js Process & Memory
            </div>
            <span className="text-[11px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
              {health?.server?.platform} • {health?.server?.nodeVersion}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 bg-neutral-800/40 rounded-xl border border-neutral-800">
              <div className="text-neutral-500 text-[10px] uppercase font-bold">Heap Used</div>
              <div className="text-sm font-mono font-bold text-white mt-1">
                {health?.server?.memoryUsage?.heapUsedMB ?? 0} MB
              </div>
            </div>

            <div className="p-2.5 bg-neutral-800/40 rounded-xl border border-neutral-800">
              <div className="text-neutral-500 text-[10px] uppercase font-bold">Heap Total</div>
              <div className="text-sm font-mono font-bold text-white mt-1">
                {health?.server?.memoryUsage?.heapTotalMB ?? 0} MB
              </div>
            </div>

            <div className="p-2.5 bg-neutral-800/40 rounded-xl border border-neutral-800">
              <div className="text-neutral-500 text-[10px] uppercase font-bold">Process RSS</div>
              <div className="text-sm font-mono font-bold text-white mt-1">
                {health?.server?.memoryUsage?.rssMB ?? 0} MB
              </div>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 flex items-center justify-between bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80">
            <span>Server Uptime:</span>
            <span className="text-white font-mono font-bold">
              {formatUptime(health?.server?.uptimeSeconds || metrics?.uptimeSeconds || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* YouTube Search Engine Health */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-500" />
          Music Search & Scraper Redundancy Status
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
            <div className="text-neutral-500 text-[10px] uppercase font-bold">API Hits</div>
            <div className="text-base font-mono font-bold text-white mt-1">
              {metrics?.youtubeStats?.apiHits ?? 0}
            </div>
          </div>

          <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
            <div className="text-neutral-500 text-[10px] uppercase font-bold">Scraper Hits</div>
            <div className="text-base font-mono font-bold text-white mt-1">
              {metrics?.youtubeStats?.scraperHits ?? 0}
            </div>
          </div>

          <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
            <div className="text-neutral-500 text-[10px] uppercase font-bold">Fallback Hits</div>
            <div className="text-base font-mono font-bold text-white mt-1">
              {metrics?.youtubeStats?.fallbackHits ?? 0}
            </div>
          </div>

          <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
            <div className="text-neutral-500 text-[10px] uppercase font-bold">Quota / Key Errors</div>
            <div className="text-base font-mono font-bold text-amber-400 mt-1">
              {(metrics?.youtubeStats?.quotaErrors ?? 0) + (metrics?.youtubeStats?.invalidKeyErrors ?? 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Errors Log */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5">
        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Recent Sanitized Server Errors (Ring Buffer)
        </h4>

        {(!metrics?.recentErrors || metrics.recentErrors.length === 0) ? (
          <div className="text-xs text-emerald-400 py-6 text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            No recent errors in server log buffer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 font-medium">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Method & Path</th>
                  <th className="pb-2">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50 font-mono">
                {metrics.recentErrors.map((err, idx) => (
                  <tr key={idx} className="hover:bg-neutral-800/30 transition">
                    <td className="py-2.5 text-neutral-400">{new Date(err.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2.5 text-red-400 font-bold">{err.status}</td>
                    <td className="py-2.5 text-neutral-300">{err.method} {err.path}</td>
                    <td className="py-2.5 text-neutral-400 truncate max-w-xs">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
