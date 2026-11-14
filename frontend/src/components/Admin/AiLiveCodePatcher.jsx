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
  Code2,
  Key,
  ChevronDown,
  GitBranch,
  GitPullRequest,
  GitCommit,
  Check,
  Play
} from 'lucide-react';
import { formatAdminTimestamp } from '../../utils/adminDateUtils';

/**
 * Sanitizes and parses raw backend or AI errors into clear user-friendly notifications and banners.
 * Detects 429 quota exhaustion, syntax / file parsing errors, and preserves raw technical stack for collapsible inspection.
 */
export function parsePatcherError(rawError) {
  if (!rawError) return null;

  let rawStr = '';
  if (typeof rawError === 'string') {
    rawStr = rawError;
  } else if (rawError instanceof Error) {
    rawStr = rawError.message || String(rawError);
  } else {
    try {
      rawStr = JSON.stringify(rawError);
    } catch {
      rawStr = String(rawError);
    }
  }

  const lower = rawStr.toLowerCase();

  // 0. Hosted / Read-Only Environment Notice
  if (lower.includes('production mode, apply via cms') || lower.includes('read-only') || lower.includes('hosted read-only')) {
    return {
      title: 'Hosted Environment Notice',
      message: 'Changes generated successfully. In production mode, apply via CMS or push to Git.',
      isQuota: false,
      isReadOnly: true,
      raw: rawStr
    };
  }

  // 1. Quota Exhaustion / 429 / Rate Limit
  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return {
      title: '⚠️ AI Generation Daily Limit Reached',
      message: 'Gemini 2.5 Free Tier quota exhausted for today. Please retry later, add your own Gemini API Key in API Keys Pool, or target files manually.',
      isQuota: true,
      raw: rawStr
    };
  }

  // 2. Syntax, Resolution or Target File Errors
  if (
    lower.includes('could not be parsed') ||
    lower.includes('syntaxerror') ||
    lower.includes('target file not found') ||
    lower.includes('enoent') ||
    lower.includes('auto file detection failed') ||
    lower.includes('failed to parse')
  ) {
    return {
      title: 'Target File Notice',
      message: 'Target file could not be parsed. Please select path manually.',
      isQuota: false,
      raw: rawStr
    };
  }

  // 3. Timeout / Latency Errors (graceful handling rather than throwing)
  if (lower.includes('gemini_timeout') || lower.includes('timed out') || lower.includes('timeout')) {
    return {
      title: 'AI Generation Progress Notice',
      message: 'AI code generation is taking a little longer than usual. Multi-key pool failover is actively engaged in the background.',
      isQuota: false,
      isTimeout: true,
      raw: rawStr
    };
  }

  // 3. Fallback / Generic Sanitization
  // Strip out ugly JSON RPC headers or stack traces from the main 1-liner
  let sanitizedOneLiner = rawStr;
  const rpcMatch = rawStr.match(/\[(?:GoogleGenerativeAI|GoogleRPC|Error)?[^\]]*\]\s*(.*)/i);
  if (rpcMatch && rpcMatch[1]) {
    sanitizedOneLiner = rpcMatch[1].trim();
  }
  if (sanitizedOneLiner.length > 140) {
    sanitizedOneLiner = sanitizedOneLiner.slice(0, 140).trim() + '...';
  }

  return {
    title: 'Patch Operation Notice',
    message: sanitizedOneLiner || 'An error occurred during the live patch operation.',
    isQuota: false,
    raw: rawStr
  };
}

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

export default function AiLiveCodePatcher({ backendUrl = '', token = '', showToast, onNavigateTab }) {
  const [selectedTarget, setSelectedTarget] = useState('auto');
  const [customPath, setCustomPath] = useState('');
  const [instructionPrompt, setInstructionPrompt] = useState('');
  
  // Status states
  const [isPatching, setIsPatching] = useState(false);
  const [patchStatusMessage, setPatchStatusMessage] = useState('');
  const [patchStep, setPatchStep] = useState(0); // 1: Analyzing, 2: Retrieving files, 3: Generating patch, 4: Staging & validating
  const [githubStatus, setGithubStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [parsedError, setParsedError] = useState(null);
  const [autoApply, setAutoApply] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(null); // patchId
  const [isMergingPr, setIsMergingPr] = useState(null); // prNumber
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  // Persistent Command History states (MongoDB backed)
  const [commandHistory, setCommandHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historySortOrder, setHistorySortOrder] = useState('desc');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState('commands'); // 'commands' | 'snapshots'

  // Review & Confirmation Modal states
  const [stagedPatch, setStagedPatch] = useState(null); // { patchId, detectedFile, targetFile, originalCode, stagedCode, linesBefore, linesAfter, diff }
  const [isConfirmingCommit, setIsConfirmingCommit] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState('diff'); // 'diff' | 'staged' | 'original'

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

  const handleSetError = (rawErr) => {
    if (!rawErr) {
      setErrorMessage('');
      setParsedError(null);
      return;
    }
    const parsed = parsePatcherError(rawErr);
    setParsedError(parsed);
    setErrorMessage(parsed.message);
    notify(parsed.message, 'error');
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

  const fetchGithubStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/git/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGithubStatus(data);
      }
    } catch (_) {}
  }, [cleanBackendUrl, token]);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setIsLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (historyStatusFilter !== 'all') params.set('status', historyStatusFilter);
      if (historySearch.trim()) params.set('search', historySearch.trim());
      params.set('limit', '50');

      const res = await fetch(`${cleanBackendUrl}/api/admin/patch-history?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCommandHistory(data.history || []);
      }
    } catch (err) {
      console.warn('Failed to load command history:', err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [cleanBackendUrl, token, historyStatusFilter, historySearch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetchLogs(); fetchHistory();
    fetchGithubStatus();
  }, [fetchLogs, fetchGithubStatus]);

  // Stage patch without modifying disk, then trigger Review & Confirmation Modal (or auto-apply if enabled)
  const handleStagePatch = async (e) => {
    e.preventDefault();
    const targetFile = getEffectivePath();

    if (!targetFile) {
      notify('Please select or specify a target file path', 'error');
      setErrorMessage('Please select or specify a target file path.');
      return;
    }
    if (!instructionPrompt.trim()) {
      notify('Please enter a natural language instruction prompt', 'error');
      setErrorMessage('Please enter a natural language instruction prompt.');
      return;
    }

    setErrorMessage('');
    setIsPatching(true);
    setPatchStatusMessage('🧠 AI analyzing repository and generating modified code...');

    let timer = null;
    let progressTimer = null;

    try {
      timer = setTimeout(() => {
        setPatchStatusMessage('✍️ Generating syntax-safe code & staging modifications...');
      }, 3500);

      // Active progress toast if request takes >8s rather than throwing unhandled GEMINI_TIMEOUT
      progressTimer = setTimeout(() => {
        notify('⏳ Generation in progress (>8s)... Evaluating Multi-Key Pool & assembling code diff...', 'info');
        setPatchStatusMessage('⏳ Multi-Key failover actively streaming response... Almost ready!');
      }, 8000);

      // If auto-apply is enabled, directly hit /api/admin/live-patch for 1-step atomic patch
      if (autoApply) {
        const res = await fetch(`${cleanBackendUrl}/api/admin/live-patch`, {
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
        clearTimeout(progressTimer);
        const contentType = res.headers.get('content-type') || '';
        let data = {};
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          throw new Error(text.slice(0, 100) || `Server returned ${res.status}`);
        }

        if (res.ok && data.success) {
          if (data.isReadOnly || data.notice) {
            notify(data.notice || 'Changes generated successfully. In production mode, apply via CMS or push to Git.', 'info');
          } else {
            notify('Patch Applied Successfully via Vite HMR', 'success');
          }
          setPatchStatusMessage(`⚡ ${data.message || `Live patched ${data.targetFile || targetFile}!`}`);
          setInstructionPrompt('');
          handleSetError(null);
          fetchLogs();
          setTimeout(() => setPatchStatusMessage(''), 4500);
        } else {
          const err = data.error || 'Failed to live patch target file';
          handleSetError(err);
          setPatchStatusMessage('');
        }
        return;
      }

      // Default staged mode with interactive review & diff confirmation
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
      clearTimeout(progressTimer);

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
          diff: data.diff || [],
          linesBefore: data.linesBefore,
          linesAfter: data.linesAfter,
          instructionPrompt: instructionPrompt.trim()
        });
        setDiffViewMode(data.diff && data.diff.length > 0 ? 'diff' : 'staged');
        setPatchStatusMessage('🔍 Ready for review! Opening confirmation modal...');
        handleSetError(null);
        setTimeout(() => setPatchStatusMessage(''), 2000);
      } else {
        const err = data.error || 'Failed to stage patch';
        handleSetError(err);
        setPatchStatusMessage('');
      }
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (progressTimer) clearTimeout(progressTimer);
      handleSetError(err);
      setPatchStatusMessage('');
    } finally {
      if (timer) clearTimeout(timer);
      if (progressTimer) clearTimeout(progressTimer);
      setIsPatching(false);
    }
  };

  // Commit the reviewed patch to disk, create .bak backup, and trigger Vite HMR
  const handleCommitPatch = async () => {
    if (!stagedPatch || !stagedPatch.patchId) return;

    setIsConfirmingCommit(true);
    handleSetError(null);
    let commitProgressTimer = null;
    try {
      commitProgressTimer = setTimeout(() => {
        notify('⏳ Finalizing patch snapshot (>8s)...', 'info');
      }, 8000);

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

      clearTimeout(commitProgressTimer);
      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.slice(0, 100) || `Server returned ${res.status}`);
      }

      if (res.ok && data.success) {
        if (data.prUrl) {
          notify(`🎉 Pull Request #${data.prNumber} opened on GitHub!`, 'success');
          setPatchStatusMessage(`🌿 Created branch ${data.branch} and opened PR #${data.prNumber}`);
        } else {
          notify(`Patch Applied Successfully!`, 'success');
          setPatchStatusMessage(`⚡ Committed ${data.targetFile || stagedPatch.targetFile}!`);
        }
        setStagedPatch(null);
        setInstructionPrompt('');
        handleSetError(null);
        fetchLogs(); fetchHistory();
        setTimeout(() => setPatchStatusMessage(''), 4500);
      } else {
        const err = data.error || 'Failed to commit patch';
        handleSetError(err);
      }
    } catch (err) {
      if (commitProgressTimer) clearTimeout(commitProgressTimer);
      handleSetError(err);
    } finally {
      if (commitProgressTimer) clearTimeout(commitProgressTimer);
      setIsConfirmingCommit(false);
    }
  };

  // Discard staged patch without writing to disk
  const handleDiscardPatch = () => {
    setStagedPatch(null);
    notify('Staged patch discarded. No changes written to disk.', 'info');
  };

  const handleMergePr = async (prNumber, patchId) => {
    if (!window.confirm(`Are you sure you want to merge Pull Request #${prNumber} into the main branch? This will deploy changes to production via Vercel.`)) {
      return;
    }

    setIsMergingPr(prNumber);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/ai-merge-pr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prNumber, patchId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(data.message || `PR #${prNumber} merged! Deployment in progress.`, 'success');
        fetchLogs();
      } else {
        notify(data.error || 'Failed to merge PR', 'error');
      }
    } catch (err) {
      notify('Network error during merge: ' + err.message, 'error');
    } finally {
      setIsMergingPr(null);
    }
  };

  const handleRollback = async (patchId, targetFile, branchName, prNumber) => {
    if (!window.confirm(`Are you sure you want to rollback ${targetFile}? The patch branch will be closed and pre-patch version restored.`)) {
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
        body: JSON.stringify({ patchId, branchName, prNumber })
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
            ⚡ AI Live Code Patcher & GitHub Repository Pipeline
          </h4>
          <p className="text-xs text-neutral-400 mt-1">
            Prompt modifications across frontend and backend; changes are staged on dedicated Git branches, syntax verified, and deployed via GitHub PRs & Vercel.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {githubStatus?.githubConfigured ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold" title={`Connected to ${githubStatus.repo || 'GitHub'}`}>
              <GitBranch className="w-3.5 h-3.5" />
              <span>GitHub Connected ({githubStatus.defaultBranch || 'main'})</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-semibold" title="Local filesystem mode active">
              <FolderCode className="w-3.5 h-3.5" />
              <span>Local Dev Mode</span>
            </span>
          )}

          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800/80 border border-neutral-700/60 text-neutral-300 text-[11px] font-semibold">
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

      {/* Error Banner Alert with Glassmorphism & Sanitized Feedback */}
      {(errorMessage || parsedError) && (
        <div className={`p-4 rounded-xl backdrop-blur-md border transition-all animate-fadeIn ${
          parsedError?.isQuota 
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                parsedError?.isQuota ? 'text-amber-400' : 'text-rose-400'
              }`} />
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-bold text-xs ${
                    parsedError?.isQuota ? 'text-amber-200' : 'text-rose-200'
                  }`}>
                    {parsedError?.title || 'Patch Operation Notice'}
                  </span>
                  {parsedError?.isQuota && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
                      Quota Limit
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-neutral-200/95 break-words">
                  {parsedError?.message || errorMessage}
                </p>

                {/* Quota failover action: Switch or add keys */}
                {parsedError?.isQuota && (
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof onNavigateTab === 'function') {
                          onNavigateTab('api_keys');
                        } else {
                          window.dispatchEvent(new CustomEvent('admin-switch-tab', { detail: { tab: 'api_keys' } }));
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-medium transition cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      Switch Key in API Keys Pool
                    </button>
                    <span className="text-[11px] text-neutral-400">
                      or switch target from Auto-Detect to manual file.
                    </span>
                  </div>
                )}

                {/* Collapsible details for raw technical / RPC trace */}
                {parsedError?.raw && (
                  <details className="mt-2 text-[11px] group">
                    <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200 select-none flex items-center gap-1 transition">
                      <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                      <span>View technical diagnostics</span>
                    </summary>
                    <pre className="mt-2 p-2.5 rounded-lg bg-black/60 border border-neutral-800 font-mono text-[10px] text-neutral-400 whitespace-pre-wrap break-all max-h-36 overflow-y-auto">
                      {parsedError.raw}
                    </pre>
                  </details>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSetError(null)}
              className="p-1 rounded-lg hover:bg-neutral-800/60 text-neutral-400 hover:text-white transition cursor-pointer shrink-0"
              title="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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

        {/* Submit & Options Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-neutral-300">
              <input
                type="checkbox"
                checked={autoApply}
                onChange={(e) => setAutoApply(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
              />
              <span className="font-semibold text-amber-300">Auto-Apply directly</span>
              <span className="text-[10px] text-neutral-500">(write to disk & HMR without review modal)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isPatching || !instructionPrompt.trim() || !getEffectivePath()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-bold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-amber-500/10"
          >
            {isPatching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{autoApply ? 'Patching & Applying via HMR...' : 'Staging & Analyzing Code...'}</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>{autoApply ? '⚡ Instant Live Patch' : 'Review & Live Patch'}</span>
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

      {/* Persistent Command History & Git Snapshots */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h5 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-amber-400" />
              Live Code Patcher History
            </h5>
            <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setHistoryTab('commands')}
                className={`px-2.5 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  historyTab === 'commands'
                    ? 'bg-amber-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                All Commands ({commandHistory.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('snapshots')}
                className={`px-2.5 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  historyTab === 'snapshots'
                    ? 'bg-amber-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Git Commits ({logs.length})
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          {historyTab === 'commands' && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3 h-3 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search commands, files..."
                  className="bg-neutral-900/90 border border-neutral-800 rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400/80 w-44"
                />
              </div>

              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-[11px] text-neutral-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="Failed">Failed</option>
                <option value="Awaiting Approval">Awaiting Approval</option>
                <option value="Generating Patch">Generating Patch</option>
                <option value="Submitted">Submitted</option>
              </select>

              <button
                type="button"
                onClick={fetchHistory}
                disabled={isLoadingHistory}
                className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer"
                title="Refresh command history"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Persistent MongoDB Commands History */}
        {historyTab === 'commands' && (
          <div className="space-y-2">
            {commandHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-950/40 border border-neutral-800/80 rounded-xl space-y-1.5">
                <Clock className="w-6 h-6 mx-auto text-neutral-600 opacity-60" />
                <div>No recorded patch commands found.</div>
                <div className="text-[11px] text-neutral-600">
                  Every submitted command (successful or failed) is stored permanently in MongoDB.
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {commandHistory.map((cmd) => {
                  const isCompleted = cmd.status === 'Completed';
                  const isFailed = cmd.status === 'Failed';
                  const isAwaiting = cmd.status === 'Awaiting Approval';

                  const badgeClass = isCompleted 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : isFailed 
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : isAwaiting
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';

                  return (
                    <div
                      key={cmd._id || cmd.executionId}
                      className="p-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 hover:border-neutral-700 transition flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-amber-400 truncate max-w-[200px]">
                            {cmd.targetFile || 'auto'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-bold uppercase border ${badgeClass}`}>
                            {cmd.status}
                          </span>
                          {cmd.selectedKeyMasked && (
                            <span className="px-2 py-0.2 rounded-full text-[9px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
                              Key: {cmd.selectedKeyMasked}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatAdminTimestamp(cmd.submittedAt || cmd.createdAt)}
                          {cmd.executionDurationMs > 0 && ` (${cmd.executionDurationMs}ms)`}
                        </span>
                      </div>

                      <p className="text-xs text-neutral-200 font-sans line-clamp-2 italic">
                        "{cmd.instructionPrompt}"
                      </p>

                      {/* Error Banner if failed */}
                      {isFailed && cmd.errorDetails?.message && (
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 font-mono">
                          <span className="font-bold">Error:</span> {cmd.errorDetails.message}
                        </div>
                      )}

                      {/* Action buttons strip */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-800/60 text-[11px]">
                        <div className="text-[10px] text-neutral-500 font-mono truncate">
                          ID: {cmd.executionId} • By: {cmd.adminUsername || 'admin'}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {cmd.prUrl && (
                            <a
                              href={cmd.prUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>PR #{cmd.prNumber}</span>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTarget(cmd.targetFile === 'auto' ? 'auto' : 'custom');
                              if (cmd.targetFile !== 'auto') setCustomPath(cmd.targetFile);
                              setInstructionPrompt(cmd.instructionPrompt);
                              notify('Command restored into prompt box!', 'info');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
                            title="Retry or re-apply this command"
                          >
                            <RotateCcw className="w-2.5 h-2.5 text-amber-400" />
                            <span>Reuse Prompt</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Git Commits & Snapshots with 1-Click Rollback */}
        {historyTab === 'snapshots' && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-950/40 border border-neutral-800/80 rounded-xl space-y-1.5">
                <Clock className="w-6 h-6 mx-auto text-neutral-600 opacity-60" />
                <div>No Git patch snapshots found.</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
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
                          {log.backupFile && <span>Backup: {log.backupFile}</span>}
                          {log.linesBefore && log.linesAfter && (
                            <span>Lines: {log.linesBefore} → {log.linesAfter}</span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {log.prUrl && (
                          <a
                            href={log.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 transition cursor-pointer"
                            title="View Pull Request on GitHub"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>PR #{log.prNumber}</span>
                          </a>
                        )}

                        {log.prNumber && log.status === 'PR_OPENED' && (
                          <button
                            type="button"
                            onClick={() => handleMergePr(log.prNumber, log.id)}
                            disabled={isMergingPr === log.prNumber}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
                            title="Approve and Merge PR into main"
                          >
                            {isMergingPr === log.prNumber ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Merge PR</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRollback(log.id, log.targetFile, log.branch, log.prNumber)}
                          disabled={isCurrentRollingBack || isRolledBack}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                            isRolledBack
                              ? 'bg-neutral-900 text-neutral-500 border-neutral-800 cursor-not-allowed'
                              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border-rose-500/30'
                          }`}
                          title={isRolledBack ? 'Already rolled back' : 'Restore pre-patch snapshot or close branch'}
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
        )}
      </div>

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
                    {/* GitHub PR link if available */}
                    {log.prUrl && (
                      <a
                        href={log.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 transition cursor-pointer"
                        title="View Pull Request on GitHub"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>PR #{log.prNumber}</span>
                      </a>
                    )}

                    {/* Merge PR button if PR is open */}
                    {log.prNumber && log.status === 'PR_OPENED' && (
                      <button
                        type="button"
                        onClick={() => handleMergePr(log.prNumber, log.id)}
                        disabled={isMergingPr === log.prNumber}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
                        title="Approve and Merge PR into main"
                      >
                        {isMergingPr === log.prNumber ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Merge PR</span>
                      </button>
                    )}

                    {/* Rollback button */}
                    <button
                      type="button"
                      onClick={() => handleRollback(log.id, log.targetFile, log.branch, log.prNumber)}
                      disabled={isCurrentRollingBack || isRolledBack}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        isRolledBack
                          ? 'bg-neutral-900 text-neutral-500 border-neutral-800 cursor-not-allowed'
                          : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border-rose-500/30'
                      }`}
                      title={isRolledBack ? 'Already rolled back' : 'Restore pre-patch snapshot or close branch'}
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
                {stagedPatch.diff && stagedPatch.diff.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiffViewMode('diff')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      diffViewMode === 'diff'
                        ? 'bg-amber-500 text-neutral-950 shadow-sm'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Line Diff ({stagedPatch.diff.length})</span>
                  </button>
                )}
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

            {/* Code / Diff Viewer Container */}
            <div className="flex-1 overflow-auto bg-neutral-950 p-4 font-mono text-xs text-neutral-200 select-text">
              {diffViewMode === 'diff' && stagedPatch.diff && stagedPatch.diff.length > 0 ? (
                <div className="space-y-0.5 font-mono text-xs">
                  {stagedPatch.diff.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 px-2 py-0.5 rounded font-mono ${
                        item.type === 'insert'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-rose-500/15 text-rose-300 line-through opacity-75'
                      }`}
                    >
                      <span className="text-neutral-500 select-none w-10 text-right shrink-0">
                        {item.lineNum}
                      </span>
                      <span className="select-none font-bold shrink-0">
                        {item.type === 'insert' ? '+' : '-'}
                      </span>
                      <span className="whitespace-pre overflow-x-auto">{item.content}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="overflow-x-auto whitespace-pre font-mono leading-relaxed">
                  <code>
                    {diffViewMode === 'staged' ? stagedPatch.stagedCode : stagedPatch.originalCode}
                  </code>
                </pre>
              )}
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
                      <span>{githubStatus?.githubConfigured ? 'Committing Branch & Opening PR...' : 'Writing & Triggering HMR...'}</span>
                    </>
                  ) : (
                    <>
                      <GitPullRequest className="w-4 h-4" />
                      <span>{githubStatus?.githubConfigured ? 'Commit Branch & Create GitHub PR' : 'Confirm & Apply Patch'}</span>
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

