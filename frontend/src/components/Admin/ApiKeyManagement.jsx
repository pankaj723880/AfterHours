import React, { useState, useEffect, useCallback } from 'react';
import { 
  Key, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Sparkles, 
  Radio, 
  Layers, 
  RotateCcw,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  Activity,
  BarChart3,
  Sliders
} from 'lucide-react';

export default function ApiKeyManagement({ backendUrl = '', token = '', showToast }) {
  const [keys, setKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState(null);
  const [copyingKeyId, setCopyingKeyId] = useState(null);
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  const [envFallbacks, setEnvFallbacks] = useState({ youtube: 0, gemini: 0 });

  // Quota & Usage Tracker State
  const [quotaData, setQuotaData] = useState({ totals: null, keys: [] });
  const [isQuotaLoading, setIsQuotaLoading] = useState(false);
  const [resettingQuotaMask, setResettingQuotaMask] = useState(null);
  const [editingLimitMask, setEditingLimitMask] = useState(null);
  const [limitInputValue, setLimitInputValue] = useState('');
  
  // Form State
  const [service, setService] = useState('youtube');
  const [rawKeys, setRawKeys] = useState('');
  const [label, setLabel] = useState('');
  const [filterService, setFilterService] = useState('all');

  const cleanBackendUrl = backendUrl ? backendUrl.replace(/\/+$/, '') : '';

  const notify = (msg, type = 'info') => {
    if (showToast) {
      showToast(msg, type);
    } else {
      console.log(`[ApiKeyManager] [${type}] ${msg}`);
    }
  };

  const fetchQuotaData = useCallback(async () => {
    if (!token) return;
    setIsQuotaLoading(true);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/keys/quota`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQuotaData({ totals: data.totals, keys: data.keys || [], nextResetAt: data.nextResetAt });
      }
    } catch (_) {
      // Non-blocking quota fetch error
    } finally {
      setIsQuotaLoading(false);
    }
  }, [cleanBackendUrl, token]);

  const fetchKeys = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/keys`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKeys(data.keys || []);
        if (data.envFallbacks) {
          setEnvFallbacks(data.envFallbacks);
        }
      } else {
        notify(data.error || 'Failed to fetch API keys', 'error');
      }
    } catch (err) {
      notify('Network error loading API keys: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [cleanBackendUrl, token]);

  const handleResetQuota = async (maskedKey = null) => {
    setResettingQuotaMask(maskedKey || 'ALL');
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/keys/quota/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ maskedKey })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(data.message, 'success');
        fetchQuotaData();
        fetchKeys();
      } else {
        notify(data.error || 'Failed to reset quota', 'error');
      }
    } catch (err) {
      notify('Network error resetting quota: ' + err.message, 'error');
    } finally {
      setResettingQuotaMask(null);
    }
  };

  const handleUpdateQuotaLimit = async (maskedKey) => {
    const val = parseInt(limitInputValue, 10);
    if (!val || val <= 0) {
      notify('Please enter a valid positive quota number', 'error');
      return;
    }

    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/keys/quota/limit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ maskedKey, totalQuota: val })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(data.message, 'success');
        setEditingLimitMask(null);
        setLimitInputValue('');
        fetchQuotaData();
      } else {
        notify(data.error || 'Failed to update quota limit', 'error');
      }
    } catch (err) {
      notify('Network error updating quota limit: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchQuotaData();
  }, [fetchKeys, fetchQuotaData]);

  const handleAddKeys = async (e) => {
    e.preventDefault();
    if (!rawKeys.trim()) {
      notify('Please enter at least one API key', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          service,
          rawKeys: rawKeys.trim(),
          label: label.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        notify(data.message || 'API keys successfully added to pool!', 'success');
        setRawKeys('');
        setLabel('');
        fetchKeys();
      } else {
        notify(data.error || 'Failed to add API keys', 'error');
      }
    } catch (err) {
      notify('Failed to add API keys: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/keys/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(data.message, 'success');
        setKeys(prev => prev.map(k => k._id === id ? { ...k, isExhausted: !currentStatus, failureCount: currentStatus ? 0 : k.failureCount } : k));
      } else {
        notify(data.error || 'Failed to toggle status', 'error');
      }
    } catch (err) {
      notify('Network error: ' + err.message, 'error');
    }
  };

  const handleToggleEnable = async (id, currentEnabled) => {
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/keys/${id}/enable`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(data.message, 'success');
        setKeys(prev => prev.map(k => k._id === id ? { ...k, isEnabled: !currentEnabled, status: !currentEnabled ? 'Active' : 'Disabled' } : k));
      } else {
        notify(data.error || 'Failed to toggle enabled state', 'error');
      }
    } catch (err) {
      notify('Network error: ' + err.message, 'error');
    }
  };

  const handleTestKey = async (id) => {
    setTestingKeyId(id);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/keys/${id}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(`Key Verified Healthy! Latency: ${data.testResult?.latencyMs || 0}ms`, 'success');
        fetchKeys();
      } else {
        notify(`Key Test Failed: ${data.testResult?.message || data.error || 'Check quota or validity'}`, 'error');
        fetchKeys();
      }
    } catch (err) {
      notify('Network error during key test: ' + err.message, 'error');
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleCopyKey = async (id, maskedDisplay) => {
    setCopyingKeyId(id);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/keys/${id}/reveal`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success && data.apiKey) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(data.apiKey);
        } else {
          // Fallback textarea copy for older Android WebViews
          const el = document.createElement('textarea');
          el.value = data.apiKey;
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
        }
        setCopiedKeyId(id);
        notify(`API Key copied to clipboard! (${data.maskedKey || maskedDisplay})`, 'success');
        setTimeout(() => setCopiedKeyId(null), 2500);
      } else {
        notify(data.error || 'Failed to reveal key for copying', 'error');
      }
    } catch (err) {
      notify('Network error copying key: ' + err.message, 'error');
    } finally {
      setCopyingKeyId(null);
    }
  };

  const handleDeleteKey = async (id) => {
    if (!window.confirm('Are you sure you want to remove this API key from the database pool?')) {
      return;
    }

    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/keys/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify('API key removed from pool', 'success');
        setKeys(prev => prev.filter(k => k._id !== id));
      } else {
        notify(data.error || 'Failed to delete key', 'error');
      }
    } catch (err) {
      notify('Network error: ' + err.message, 'error');
    }
  };

  const handleResetAllQuotas = async () => {
    if (!window.confirm('Reset all exhausted keys back to Active? They will immediately be re-eligible for rotation.')) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/keys/reset-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(data.message || 'All exhausted keys reset to active!', 'success');
        fetchKeys();
      } else {
        notify(data.error || 'Failed to reset quotas', 'error');
      }
    } catch (err) {
      notify('Network error: ' + err.message, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const filteredKeys = keys.filter(k => {
    if (filterService === 'all') return true;
    return k.service === filterService;
  });

  const youtubeCount = keys.filter(k => k.service === 'youtube').length;
  const geminiCount = keys.filter(k => k.service === 'gemini').length;
  const exhaustedCount = keys.filter(k => k.isExhausted).length;

  return (
    <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 space-y-6 hover:border-amber-500/30 transition">
      {/* Card Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            🔑 Multi-Key Pool Manager (YouTube & Gemini)
          </h4>
          <p className="text-xs text-neutral-400 mt-1">
            Store and rotate unlimited API keys in MongoDB dynamically without server redeployment.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleResetAllQuotas}
            disabled={isResetting || exhaustedCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Reset all 403/429 exhausted keys back to active"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>🔄 Reset All Quotas</span>
            {exhaustedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-[10px] text-amber-200 ml-1">
                {exhaustedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              fetchKeys();
              fetchQuotaData();
            }}
            disabled={isLoading || isQuotaLoading}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
            title="Refresh Key Pool and Quotas"
          >
            <RefreshCw className={`w-4 h-4 ${(isLoading || isQuotaLoading) ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Pool Summary Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
          <div className="text-neutral-500 text-[10px] uppercase font-bold flex items-center gap-1">
            <Radio className="w-3 h-3 text-red-400" /> YouTube Keys
          </div>
          <div className="text-base font-mono font-bold text-white mt-1">
            {youtubeCount}
          </div>
        </div>

        <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
          <div className="text-neutral-500 text-[10px] uppercase font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" /> Gemini Keys
          </div>
          <div className="text-base font-mono font-bold text-white mt-1">
            {geminiCount}
          </div>
        </div>

        <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
          <div className="text-neutral-500 text-[10px] uppercase font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active Keys
          </div>
          <div className="text-base font-mono font-bold text-emerald-400 mt-1">
            {keys.length - exhaustedCount}
          </div>
        </div>

        <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
          <div className="text-neutral-500 text-[10px] uppercase font-bold flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" /> Exhausted Keys
          </div>
          <div className="text-base font-mono font-bold text-rose-400 mt-1">
            {exhaustedCount}
          </div>
        </div>
      </div>

      {/* Real-Time YouTube Quota & Usage Tracker */}
      <div className="bg-neutral-950/70 border border-neutral-800/90 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800/70">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h5 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              YouTube Data API Quota & Usage Tracker
            </h5>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Live Real-Time
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleResetQuota(null)}
              disabled={resettingQuotaMask === 'ALL'}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-semibold border border-neutral-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Reset today's usage counter for all keys"
            >
              <RotateCcw className={`w-3 h-3 ${resettingQuotaMask === 'ALL' ? 'animate-spin' : ''}`} />
              <span>Reset All Units</span>
            </button>

            <button
              type="button"
              onClick={fetchQuotaData}
              disabled={isQuotaLoading}
              className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition cursor-pointer"
              title="Refresh Quota Stats"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isQuotaLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Aggregated Totals Bar */}
        {quotaData.totals && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800/80">
              <div className="text-neutral-500 text-[10px] uppercase font-bold">Total Daily Quota</div>
              <div className="text-sm sm:text-base font-mono font-bold text-white mt-1">
                {quotaData.totals.totalQuota.toLocaleString()} <span className="text-[10px] font-normal text-neutral-400">units</span>
              </div>
            </div>

            <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800/80">
              <div className="text-neutral-500 text-[10px] uppercase font-bold">Total Units Used</div>
              <div className="text-sm sm:text-base font-mono font-bold text-amber-400 mt-1">
                {quotaData.totals.totalUsed.toLocaleString()} <span className="text-[10px] font-normal text-neutral-400">({quotaData.totals.overallUsagePercent}%)</span>
              </div>
            </div>

            <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800/80">
              <div className="text-neutral-500 text-[10px] uppercase font-bold">Remaining Pool</div>
              <div className="text-sm sm:text-base font-mono font-bold text-emerald-400 mt-1">
                {quotaData.totals.totalRemaining.toLocaleString()} <span className="text-[10px] font-normal text-neutral-400">units</span>
              </div>
            </div>

            <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800/80">
              <div className="text-neutral-500 text-[10px] uppercase font-bold flex items-center justify-between">
                <span>Next Daily Reset</span>
                <Clock className="w-3 h-3 text-neutral-400" />
              </div>
              <div className="text-xs font-mono font-bold text-neutral-300 mt-1 truncate" title={quotaData.nextResetAt}>
                {quotaData.nextResetAt ? new Date(quotaData.nextResetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : 'Midnight UTC'}
              </div>
            </div>
          </div>
        )}

        {/* Per-Key Quota Breakdown Cards / Table */}
        <div className="space-y-2">
          {quotaData.keys.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-900/30 rounded-xl border border-neutral-800/60">
              No YouTube API keys active or tracked yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-800/80 bg-neutral-900/40">
              <table className="w-full text-left text-xs min-w-[700px] sm:min-w-full">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 font-medium bg-neutral-900/60">
                    <th className="py-2.5 px-3">Key / Mask</th>
                    <th className="py-2.5 px-3">Label & Source</th>
                    <th className="py-2.5 px-3">Daily Quota</th>
                    <th className="py-2.5 px-3">Used / Remaining</th>
                    <th className="py-2.5 px-3">Usage Bar</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Last Activity</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {quotaData.keys.map((qk) => {
                    const isExhausted = qk.status === 'exhausted' || qk.remainingUnits <= 0;
                    const isError = qk.status === 'error';
                    const isEditing = editingLimitMask === qk.maskedKey;

                    return (
                      <tr key={qk.maskedKey} className="hover:bg-neutral-800/20 transition">
                        <td className="py-2.5 px-3 font-mono text-neutral-200">
                          {qk.maskedKey}
                        </td>

                        <td className="py-2.5 px-3 font-sans text-neutral-400 text-[11px]">
                          <div className="font-semibold text-neutral-300">{qk.label || 'Default Key'}</div>
                          <div className="text-[10px] text-neutral-500 uppercase">{qk.source}</div>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-neutral-300">
                          {isEditing ? (
                            <div className="flex items-center gap-1 font-sans">
                              <input
                                type="number"
                                min="100"
                                max="1000000"
                                value={limitInputValue}
                                onChange={(e) => setLimitInputValue(e.target.value)}
                                placeholder={String(qk.totalQuota)}
                                className="w-20 px-1.5 py-0.5 rounded bg-neutral-950 border border-amber-500 text-xs text-white"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateQuotaLimit(qk.maskedKey)}
                                className="px-1.5 py-0.5 rounded bg-amber-500 text-neutral-950 font-bold text-[10px]"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingLimitMask(null)}
                                className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px]"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span>{qk.totalQuota.toLocaleString()}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLimitMask(qk.maskedKey);
                                  setLimitInputValue(String(qk.totalQuota));
                                }}
                                className="text-neutral-500 hover:text-amber-400 transition"
                                title="Edit daily quota limit"
                              >
                                <Sliders className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-mono">
                          <div className="text-amber-400">{qk.usedUnits.toLocaleString()} used</div>
                          <div className="text-emerald-400 text-[11px]">{qk.remainingUnits.toLocaleString()} left</div>
                        </td>

                        <td className="py-2.5 px-3 w-36">
                          <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isExhausted
                                  ? 'bg-rose-500'
                                  : qk.usagePercent > 80
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, qk.usagePercent)}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5 font-sans">
                            {qk.usagePercent}% used
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-sans">
                          {isExhausted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              Exhausted
                            </span>
                          ) : isError ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20" title={qk.lastError?.message || 'Error'}>
                              <AlertCircle className="w-3 h-3 text-amber-400" />
                              Error
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Active
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-sans text-neutral-400 text-[11px]">
                          <div>{qk.lastUsedAt ? new Date(qk.lastUsedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Not yet'}</div>
                          {qk.lastError && (
                            <div className="text-[10px] text-rose-400 truncate max-w-[120px]" title={qk.lastError.message}>
                              {qk.lastError.reason || 'Error'}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => handleResetQuota(qk.maskedKey)}
                            disabled={resettingQuotaMask === qk.maskedKey}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                            title="Reset this key's usage back to 0"
                          >
                            <RotateCcw className={`w-3 h-3 ${resettingQuotaMask === qk.maskedKey ? 'animate-spin text-amber-400' : ''}`} />
                            <span>Reset</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Input Form: Add Keys */}
      <form onSubmit={handleAddKeys} className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-amber-400" /> Add Keys to MongoDB Pool
          </span>

          {/* Service Selector */}
          <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setService('youtube')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                service === 'youtube'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Radio className="w-3 h-3 text-red-400" />
              YouTube Data API
            </button>
            <button
              type="button"
              onClick={() => setService('gemini')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                service === 'gemini'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Google Gemini API
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[11px] font-medium text-neutral-400">
              API Keys (Paste single or multiple keys separated by commas or new lines)
            </label>
            <textarea
              rows={2}
              value={rawKeys}
              onChange={(e) => setRawKeys(e.target.value)}
              placeholder="AIzaSyA123..., AIzaSyB456... or paste multiline"
              className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <div className="space-y-1 flex flex-col justify-between">
            <div>
              <label className="text-[11px] font-medium text-neutral-400">
                Optional Label / Account Note
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Personal Project 2, Backup Pool"
                className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !rawKeys.trim()}
              className="w-full mt-2 sm:mt-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-amber-500/10"
            >
              <Plus className="w-4 h-4" />
              {isSubmitting ? 'Adding Keys...' : 'Add Keys to Pool'}
            </button>
          </div>
        </div>
      </form>

      {/* Live Keys Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h5 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            Configured Keys ({filteredKeys.length})
          </h5>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-neutral-500 mr-1">Filter:</span>
            {['all', 'youtube', 'gemini'].map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterService(f)}
                className={`px-2.5 py-1 rounded-lg capitalize transition cursor-pointer ${
                  filterService === f
                    ? 'bg-neutral-800 text-white font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filteredKeys.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-950/40 border border-neutral-800/80 rounded-xl space-y-2">
            <Key className="w-6 h-6 mx-auto text-neutral-600 opacity-60" />
            <div>No dynamic API keys found in the MongoDB pool.</div>
            <div className="text-[11px] text-neutral-600">
              The system will fallback to environment variables (`.env`) until keys are added above.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-800/80 bg-neutral-950/40 -mx-1 sm:mx-0">
            <table className="w-full text-left text-xs min-w-[620px] sm:min-w-full">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 font-medium bg-neutral-900/50">
                  <th className="py-2.5 px-3">Service</th>
                  <th className="py-2.5 px-3">Masked Key</th>
                  <th className="py-2.5 px-3">Label</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Failures</th>
                  <th className="py-2.5 px-3">Last Used</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono">
                {filteredKeys.map((k) => (
                  <tr key={k._id} className="hover:bg-neutral-800/20 transition">
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-bold uppercase ${
                        k.service === 'youtube'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {k.service === 'youtube' ? <Radio className="w-2.5 h-2.5" /> : <Sparkles className="w-2.5 h-2.5" />}
                        {k.service}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-neutral-200">
                      {k.maskedKey || (k.key ? `${k.key.slice(0, 6)}...${k.key.slice(-4)}` : '••••••••')}
                    </td>

                    <td className="py-2.5 px-3 font-sans text-neutral-400 text-[11px] truncate max-w-[120px]">
                      {k.label || '—'}
                    </td>

                    <td className="py-2.5 px-3 font-sans">
                      {k.isExhausted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          Exhausted (403/429)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Active
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-neutral-300 font-mono">
                      {k.failureCount || 0}
                    </td>

                    <td className="py-2.5 px-3 text-neutral-400 font-sans text-[11px]">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>

                    <td className="py-2.5 px-3 text-right space-x-1.5 font-sans whitespace-nowrap">
                      {/* Copy Key securely */}
                      <button
                        type="button"
                        onClick={() => handleCopyKey(k._id, k.maskedKey)}
                        disabled={copyingKeyId === k._id}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                        title="Copy decrypted API key to clipboard"
                      >
                        {copiedKeyId === k._id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : copyingKeyId === k._id ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                            <span>Copying...</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {/* Test key validity */}
                      <button
                        type="button"
                        onClick={() => handleTestKey(k._id)}
                        disabled={testingKeyId === k._id}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                        title="Test key handshake and verify live quota"
                      >
                        <RefreshCw className={`w-3 h-3 ${testingKeyId === k._id ? 'animate-spin' : ''}`} />
                        <span>Test</span>
                      </button>

                      {/* Enable / Disable key */}
                      <button
                        type="button"
                        onClick={() => handleToggleEnable(k._id, k.isEnabled !== false)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          k.isEnabled === false
                            ? 'bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700'
                            : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20'
                        }`}
                        title={k.isEnabled === false ? "Enable Key in runtime rotation" : "Disable Key from runtime rotation"}
                      >
                        {k.isEnabled === false ? 'Disabled' : 'Enabled'}
                      </button>

                      {/* Active / Exhaust toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(k._id, k.isExhausted)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          k.isExhausted
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white'
                        }`}
                        title={k.isExhausted ? "Mark Active" : "Mark Exhausted"}
                      >
                        {k.isExhausted ? 'Re-activate' : 'Exhaust'}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteKey(k._id)}
                        className="p-1 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer inline-flex items-center"
                        title="Delete key from pool"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
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

