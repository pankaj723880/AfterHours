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
  Check
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

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

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
            onClick={fetchKeys}
            disabled={isLoading}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
            title="Refresh Key Pool"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
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

