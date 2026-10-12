import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, ChevronLeft, ChevronRight, Filter, Eye } from 'lucide-react';

export default function AuditLogs({ token, backendUrl, showToast }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(15);
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (actionFilter) queryParams.set('action', actionFilter);

      const res = await fetch(`${backendUrl}/api/admin/audit-logs?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch audit logs');

      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            Immutable Audit Trail
            <span className="text-xs font-mono font-medium bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full">
              {total} events
            </span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Append-only security records of administrative role updates, deactivations, and mutations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="bg-neutral-950/80 border border-neutral-800 text-neutral-300 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-amber-500/50"
          >
            <option value="">All Actions</option>
            <option value="USER_UPDATE">USER_UPDATE</option>
            <option value="USER_DEACTIVATE">USER_DEACTIVATE</option>
          </select>

          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Acting Admin</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Target Record</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-neutral-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-neutral-500">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-800/25 transition">
                    <td className="py-3 px-4 text-neutral-400 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {log.adminUsername}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-300 font-mono">
                      {log.targetUsername || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-neutral-400 font-mono text-[11px]">
                      {log.ip}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                        title="View change details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <div>
            Showing Page <span className="text-white font-semibold">{page}</span> of{' '}
            <span className="text-white font-semibold">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:pointer-events-none text-neutral-200 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-neutral-300 px-2">{page}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:pointer-events-none text-neutral-200 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                Audit Event Details
              </h4>
              <span className="text-[11px] font-mono text-neutral-500">ID: {selectedLog.id}</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Action:</span>
                <span className="font-mono font-bold text-amber-400">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Actor (Admin):</span>
                <span className="text-white font-medium">{selectedLog.adminUsername}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Target Record:</span>
                <span className="text-white font-medium">{selectedLog.targetUsername}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Timestamp:</span>
                <span className="font-mono text-neutral-300">{new Date(selectedLog.timestamp).toISOString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Client IP:</span>
                <span className="font-mono text-neutral-300">{selectedLog.ip}</span>
              </div>

              <div className="pt-2">
                <span className="text-neutral-400 block mb-1">Payload Diff:</span>
                <pre className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium py-2 rounded-xl text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
