import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Zap, 
  RotateCcw, 
  FileCode2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  Loader2, 
  Clock, 
  RefreshCw,
  FolderCode,
  ArrowRight,
  ShieldCheck,
  Globe,
  ExternalLink,
  Smartphone,
  Monitor,
  Bot,
  X,
  Code2
} from 'lucide-react';
import { formatAdminTimestamp } from '../../utils/adminDateUtils';

const COMMON_TARGETS = [
  { label: '🤖 Auto-Detect (AI scans & selects the right file)', path: 'auto' },
  { label: 'Avatar / 3D Canvas', path: 'src/components/VoiceAgent/CharacterBuddy.jsx' },
  { label: '3D Humanoid Engine', path: 'src/components/VoiceAgent/ThreeDCharacter.jsx' },
  { label: 'Floating Avatar Bubble', path: 'src/components/VoiceAgent/FloatingAvatarTriggerV2.jsx' },
  { label: 'Player Controls / Bottom Dock', path: 'src/components/AudioPlayer.jsx' },
  { label: 'Radio Stations View', path: 'src/components/IndianRadioView.jsx' },
  { label: 'Admin Dashboard Main', path: 'src/components/Admin/AdminDashboard.jsx' },
  { label: 'API & Server Health Diagnostics', path: 'src/components/Admin/ServerHealth.jsx' },
  { label: 'Voice Assistant Hook', path: 'src/hooks/useVoiceAgent.js' },
  { label: 'Custom File Path...', path: 'custom' }
];

const PREVIEW_ROUTES = [
  { label: 'Home Page', path: '/' },
  { label: 'Discover / Search', path: '/?station=discover' },
  { label: 'Live Radio Stations', path: '/?station=radio' },
  { label: 'Time Machine Retro', path: '/?station=timemachine' },
  { label: '3D Turntable / DJ Club', path: '/?station=dj-club' }
];

export default function AiLiveCodePatcher({ backendUrl = '', token = '', showToast }) {
  const [selectedTarget, setSelectedTarget] = useState('auto');
  const [customPath, setCustomPath] = useState('');
  const [instructionPrompt, setInstructionPrompt] = useState('');
  
  // Status states
  const [isPatching, setIsPatching] = useState(false);
  const [patchStatusMessage, setPatchStatusMessage] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(null); // patchId
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Review & Confirmation Modal states
  const [stagedPatch, setStagedPatch] = useState(null); // { patchId, detectedFile, targetFile, originalCode, stagedCode, linesBefore, linesAfter }
  const [isConfirmingCommit, setIsConfirmingCommit] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState('staged'); // 'staged' | 'original'

  // Live Sandbox Preview states
  const [previewRoute, setPreviewRoute] = useState(PREVIEW_ROUTES[0].path);
  const [iframeKey, setIframeKey] = useState(0);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [previewDeviceMode, setPreviewDeviceMode] = useState('responsive'); // 'responsive' | 'mobile'
  const iframeRef = useRef(null);

  const cleanBackendUrl = backendUrl ? backendUrl.replace(/\/+$/, '') : '';

  const notify = (msg, type = 'info') => {
    if (showToast) {
      showToast(msg, type);
    } else {
      console.log(`[AiPatcher] [${type}] ${msg}`);
    }
  };

  const getEffectivePath = () => {
    if (selectedTarget === 'custom') {
      return customPath.trim();
    }
    return selectedTarget;
  };

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/ai-patch-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setLogs(data.logs || []);
        }
      } else if (!res.ok) {
        // Handle non-200 responses safely without JSON parsing crash
        const text = await res.text().catch(() => '');
        try {
          const errJson = JSON.parse(text);
          if (errJson.error) console.info('[AiPatcher] Notice:', errJson.error);
        } catch (_) {
          // Response was HTML (e.g. 404/502 gateway or restart pending)
        }
      }
    } catch (err) {
      console.warn('Failed to load patch logs:', err.message);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [cleanBackendUrl, token]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Stage patch without modifying disk, then trigger Review & Confirmation Modal
  const handleStagePatch = async (e) => {
    e.preventDefault();
    const targetFile = getEffectivePath();

    if (!targetFile) {
      notify('Please select or specify a target file path', 'error');
      return;
    }
    if (!instructionPrompt.trim()) {
      notify('Please enter a natural language instruction prompt', 'error');
      return;
    }

    setIsPatching(true);
    setPatchStatusMessage('🧠 AI analyzing repository and generating modified code...');

    try {
      // Step timer updates to show rich feedback
      const timer = setTimeout(() => {
        setPatchStatusMessage('✍️ Generating syntax-safe code & staging modifications...');
      }, 3500);

      const res = await fetch(`${cleanBackendUrl}/api/admin/ai-stage-patch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetFile,
          instructionPrompt: instructionPrompt.trim()
        })
      });

      clearTimeout(timer);

      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.slice(0, 100) || `Server returned ${res.status}`);
      }

      if (res.ok && data.success) {
        setStagedPatch({
          patchId: data.patchId,
          targetFile: data.targetFile,
          detectedFile: data.detectedFile,
          originalCode: data.originalCode,
          stagedCode: data.stagedCode,
          linesBefore: data.linesBefore,
          linesAfter: data.linesAfter,
          instructionPrompt: instructionPrompt.trim()
        });
        setDiffViewMode('staged');
        setPatchStatusMessage('🔍 Ready for review! Opening confirmation modal...');
        setTimeout(() => setPatchStatusMessage(''), 2000);
      } else {
        notify(data.error || 'Failed to stage patch', 'error');
        setPatchStatusMessage('');
      }
    } catch (err) {
      notify('Network error staging patch: ' + err.message, 'error');
      setPatchStatusMessage('');
    } finally {
      setIsPatching(false);
    }
  };

  // Commit the reviewed patch to disk, create .bak backup, and trigger Vite HMR
  const handleCommitPatch = async () => {
    if (!stagedPatch || !stagedPatch.patchId) return;

    setIsConfirmingCommit(true);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/ai-commit-patch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patchId: stagedPatch.patchId
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.slice(0, 100) || `Server returned ${res.status}`);
      }

      if (res.ok && data.success) {
        const detectedInfo = data.detectedFile ? ` [Auto-detected: ${data.detectedFile}]` : '';
        notify(`Patch Applied!${detectedInfo} Live preview updated via Vite HMR.`, "success");
        setPatchStatusMessage(`⚡ Committed ${data.targetFile || stagedPatch.targetFile} & updated live via Vite HMR!`);
        setStagedPatch(null);
        setInstructionPrompt('');
        fetchLogs();
        setTimeout(() => setPatchStatusMessage(''), 4500);
      } else {
        notify(data.error || 'Failed to commit patch', 'error');
      }
    } catch (err) {
      notify('Network error committing patch: ' + err.message, 'error');
    } finally {
      setIsConfirmingCommit(false);
    }
  };

  // Discard staged patch without writing to disk
  const handleDiscardPatch = () => {
    setStagedPatch(null);
    notify('Staged patch discarded. No changes written to disk.', 'info');
  };

  const handleRollback = async (patchId, targetFile) => {
    if (!window.confirm(`Are you sure you want to rollback ${targetFile}? The pre-patch backup code will be restored immediately.`)) {
      return;
    }

    setIsRollingBack(patchId);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/ai-rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ patchId })
      });

      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.slice(0, 100) || `Server returned ${res.status}`);
      }

      if (res.ok && data.success) {
        notify(data.message || 'File rolled back successfully! Vite HMR updated.', 'success');
        fetchLogs();
      } else {
        notify(data.error || 'Failed to rollback', 'error');
      }
    } catch (err) {
      notify('Network error during rollback: ' + err.message, 'error');
    } finally {
      setIsRollingBack(null);
    }
  };

  return (
    <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 space-y-6 hover:border-amber-500/30 transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            ⚡ AI In-App Live Code Patcher & Rollback
          </h4>
          <p className="text-xs text-neutral-400 mt-1">
            Prompt modifications in natural language; changes compile and hot-reload instantly via Vite HMR with 1-click snapshot rollback.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Auto-Snapshot Guard Active
          </span>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
            title="Refresh patch history"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleStagePatch} className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Target File Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <FolderCode className="w-3.5 h-3.5 text-amber-400" />
              Target Component / File
            </label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {COMMON_TARGETS.map((t) => (
                <option key={t.path} value={t.path}>
                  {t.label} ({t.path})
                </option>
              ))}
            </select>

            {selectedTarget === 'custom' && (
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="e.g. src/components/Discover/DiscoverView.jsx"
                className="w-full mt-2 bg-neutral-900 border border-neutral-700/80 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                required
              />
            )}
            <p className="text-[10px] text-neutral-500">
              Files are strictly confined within <code className="text-amber-400/80">frontend/src/</code>.
            </p>
          </div>

          {/* Active Target Preview */}
          <div className="space-y-1.5 flex flex-col justify-between">
            <div>
              <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
                Selected Path Preview
              </label>
              <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 font-mono text-xs text-amber-300 truncate">
                {selectedTarget === 'auto' ? '🤖 Auto-Detect (AI will scan repository and pick target file)' : (getEffectivePath() || 'No target selected')}
              </div>
            </div>

            {patchStatusMessage && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span className="truncate">{patchStatusMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Natural Language Instruction Prompt */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Natural Language Modification Prompt
          </label>
          <textarea
            rows={3}
            value={instructionPrompt}
            onChange={(e) => setInstructionPrompt(e.target.value)}
            placeholder="e.g. In the avatar rendering loop, stop continuous rotation and clamp resting angle straight forward towards user."
            className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 font-sans"
            required
          />
        </div>

        {/* Submit Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <span className="text-[11px] text-neutral-400">
            A safe preview will be staged for review before changes are written to disk. A <code className="text-neutral-300">.bak</code> snapshot is preserved.
          </span>

          <button
            type="submit"
            disabled={isPatching || !instructionPrompt.trim() || !getEffectivePath()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-bold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-amber-500/10"
          >
            {isPatching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Staging & Analyzing Code...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Review & Live Patch</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* =========================================================================
          Embedded Live App Sandbox Preview (Vite HMR Reactivity)
         ========================================================================= */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Preview Control Header */}
        <div className="p-3 bg-neutral-900/90 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              Live App Sandbox Preview
            </span>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-semibold">
              Vite HMR Active
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Route Switcher Dropdown */}
            <select
              value={previewRoute}
              onChange={(e) => setPreviewRoute(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-neutral-200 font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {PREVIEW_ROUTES.map((route) => (
                <option key={route.path} value={route.path}>
                  {route.label} ({route.path})
                </option>
              ))}
            </select>

            {/* Device Dimension Toggle */}
            <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setPreviewDeviceMode('responsive')}
                className={`p-1 rounded-md text-xs transition cursor-pointer ${
                  previewDeviceMode === 'responsive'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Full Responsive View"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDeviceMode('mobile')}
                className={`p-1 rounded-md text-xs transition cursor-pointer ${
                  previewDeviceMode === 'mobile'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Mobile Viewport (390px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hard Reload Button */}
            <button
              type="button"
              onClick={() => {
                setIsIframeLoading(true);
                setIframeKey((prev) => prev + 1);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-700 transition cursor-pointer"
              title="Force reload iframe sandbox"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isIframeLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">Hard Reload</span>
            </button>

            {/* Open in new tab link */}
            <a
              href={previewRoute}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-amber-400 transition"
              title="Open route in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Embedded Iframe Container */}
        <div className={`w-full bg-neutral-950 flex justify-center items-center overflow-hidden transition-all duration-300 ${
          previewDeviceMode === 'mobile' ? 'py-4' : ''
        }`}>
          <div className={`relative transition-all duration-300 ${
            previewDeviceMode === 'mobile'
              ? 'w-[390px] h-[680px] rounded-2xl border-2 border-neutral-700 shadow-2xl overflow-hidden'
              : 'w-full h-[580px]'
          }`}>
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={previewRoute}
              onLoad={() => setIsIframeLoading(false)}
              className="w-full h-full border-0 bg-neutral-950"
              title="Live App Sandbox Preview"
            />
          </div>
        </div>
      </div>

      {/* Patch History & Rollback Drawer/List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-neutral-400" />
            Recent Patches & 1-Click Rollback ({logs.length})
          </h5>
          <span className="text-[10px] text-neutral-500">
            Chronological snapshot audit trail
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-950/40 border border-neutral-800/80 rounded-xl space-y-1.5">
            <Clock className="w-6 h-6 mx-auto text-neutral-600 opacity-60" />
            <div>No previous live patches found.</div>
            <div className="text-[11px] text-neutral-600">
              When you prompt and apply code changes above, versioned snapshots will appear here with instant rollback capability.
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {logs.map((log) => {
              const isCurrentRollingBack = isRollingBack === log.id;
              const isRolledBack = log.status === 'ROLLED_BACK';

              return (
                <div
                  key={log.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isRolledBack
                      ? 'bg-neutral-950/30 border-neutral-800/50 opacity-60'
                      : 'bg-neutral-950/60 border-neutral-800/80 hover:border-neutral-700'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-amber-400 truncate">
                        {log.targetFile}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-bold uppercase ${
                        isRolledBack
                          ? 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {isRolledBack ? 'Rolled Back' : 'Applied'}
                      </span>
                      <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        {formatAdminTimestamp(log.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300 font-sans line-clamp-2 italic">
                      "{log.instructionPrompt}"
                    </p>

                    <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-3">
                      <span>Backup: {log.backupFile}</span>
                      {log.linesBefore && log.linesAfter && (
                        <span>Lines: {log.linesBefore} → {log.linesAfter}</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRollback(log.id, log.targetFile)}
                      disabled={isCurrentRollingBack || isRolledBack}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        isRolledBack
                          ? 'bg-neutral-900 text-neutral-500 border-neutral-800 cursor-not-allowed'
                          : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border-rose-500/30'
                      }`}
                      title={isRolledBack ? 'Already rolled back' : 'Restore pre-patch snapshot'}
                    >
                      {isCurrentRollingBack ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Restoring...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Rollback</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          Review & Confirmation Modal (Safe Staged Verification Before Disk Write)
         ========================================================================= */}
      {stagedPatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div 
            className="w-full max-w-4xl bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="p-4 bg-neutral-950/90 border-b border-neutral-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 truncate">
                    <span>Confirm AI Modifications</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-semibold">
                      Staged Preview
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 truncate">
                    Review generated modifications before writing to disk. A backup snapshot will be recorded.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDiscardPatch}
                disabled={isConfirmingCommit}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
                title="Discard staged patch"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Details Strip */}
            <div className="px-4 py-2.5 bg-neutral-950/40 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-neutral-400 text-[11px] font-bold uppercase tracking-wider">Target:</span>
                <span className="px-2.5 py-1 rounded-lg bg-neutral-800/90 border border-neutral-700 font-mono text-amber-300 text-[11px]">
                  {stagedPatch.detectedFile || stagedPatch.targetFile}
                </span>
                {stagedPatch.detectedFile && stagedPatch.detectedFile !== stagedPatch.targetFile && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Auto-detected
                  </span>
                )}
                {stagedPatch.linesBefore !== undefined && stagedPatch.linesAfter !== undefined && (
                  <span className="text-neutral-400 font-mono text-[11px]">
                    Lines: <span className="text-neutral-300">{stagedPatch.linesBefore}</span> → <span className="text-emerald-400 font-bold">{stagedPatch.linesAfter}</span>
                  </span>
                )}
              </div>

              {/* View Switcher Toggle */}
              <div className="flex items-center bg-neutral-800/90 border border-neutral-700/80 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setDiffViewMode('staged')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    diffViewMode === 'staged'
                      ? 'bg-amber-500 text-neutral-950 shadow-sm'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Modified Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDiffViewMode('original')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    diffViewMode === 'original'
                      ? 'bg-neutral-700 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Original Code</span>
                </button>
              </div>
            </div>

            {/* Instruction Context */}
            {stagedPatch.instructionPrompt && (
              <div className="px-4 py-2 bg-neutral-900/50 border-b border-neutral-800/80 text-xs text-neutral-300 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-neutral-400 font-semibold mr-1">Instruction:</span>
                  <span className="italic text-neutral-200">{stagedPatch.instructionPrompt}</span>
                </div>
              </div>
            )}

            {/* Code Viewer Container */}
            <div className="flex-1 overflow-auto bg-neutral-950 p-4 font-mono text-xs text-neutral-200 select-text">
              <pre className="overflow-x-auto whitespace-pre font-mono leading-relaxed">
                <code>
                  {diffViewMode === 'staged' ? stagedPatch.stagedCode : stagedPatch.originalCode}
                </code>
              </pre>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-neutral-950/90 border-t border-neutral-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-neutral-400">
                Confirming will write the changes to <code className="text-amber-400">{stagedPatch.targetFile}</code> and trigger Vite HMR immediately.
              </span>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDiscardPatch}
                  disabled={isConfirmingCommit}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-semibold text-xs transition cursor-pointer"
                >
                  Discard / Cancel
                </button>

                <button
                  type="button"
                  onClick={handleCommitPatch}
                  disabled={isConfirmingCommit}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-bold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-amber-500/10"
                >
                  {isConfirmingCommit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Writing & Triggering HMR...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Confirm & Apply Patch</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

