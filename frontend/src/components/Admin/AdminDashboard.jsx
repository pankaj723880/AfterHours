import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  LayoutDashboard, 
  Activity, 
  Users, 
  Server, 
  Music2, 
  ShieldCheck, 
  ArrowLeft,
  RefreshCw,
  LogOut,
  Radio,
  Globe,
  Layout,
  ListMusic,
  Image as ImageIcon,
  History,
  Save,
  UploadCloud,
  Eye,
  Sliders,
  Sparkles,
  X,
  AlertCircle
} from 'lucide-react';
import AccessDenied from './AccessDenied';
import AdminOverview from './AdminOverview';
import LiveTraffic from './LiveTraffic';
import UserManagement from './UserManagement';
import ServerHealth from './ServerHealth';
import MusicAnalytics from './MusicAnalytics';
import AuditLogs from './AuditLogs';
import CmsGlobalSettings from './CmsGlobalSettings';
import CmsLayoutEditor from './CmsLayoutEditor';
import CmsMusicManager from './CmsMusicManager';
import CmsMediaLibrary from './CmsMediaLibrary';
import CmsPublishingHistory from './CmsPublishingHistory';
import { safeParseJsonResponse } from '../../utils/errorHandler';
import { DEFAULT_CMS_CONFIG, getCachedCmsConfig, normalizeCmsConfig, applyThemeToDom } from '../../services/cmsClient';

export default function AdminDashboard({ user, token, backendUrl, onExit, onOpenAuth, showToast, onPreviewConfig }) {
  const cleanBackendUrl = (backendUrl || '').trim().replace(/\/+$/, '');
  const [activeSubTab, setActiveSubTab] = useState('cms_settings');
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const socketRef = useRef(null);

  // CMS State initialized with cached or default config so it's never null
  const [cmsDraft, setCmsDraft] = useState(() => normalizeCmsConfig(getCachedCmsConfig()));
  const [cmsPublishedMeta, setCmsPublishedMeta] = useState(null);
  const [isCmsLoading, setIsCmsLoading] = useState(false);
  const [cmsError, setCmsError] = useState(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishingLive, setIsPublishingLive] = useState(false);

  // Media Picker Modal State
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerCallback, setMediaPickerCallback] = useState(null);

  const isAdmin = Boolean(
    (user && user.role === 'admin') ||
    (user?.username && [
      'admin@afterhours.com',
      'pankajsss7238@gmail.com',
      'pss809352@gmail.com',
      'ps207800@gmail.com'
    ].includes(user.username.toLowerCase()))
  );

  // Fetch CMS Configuration
  const fetchCmsConfig = async () => {
    if (!token || !isAdmin) return;
    setIsCmsLoading(true);
    setCmsError(null);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/cms/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'CMS fetch failed');
      if (parsed.ok && parsed.data) {
        setCmsDraft(normalizeCmsConfig(parsed.data.draft));
        setCmsPublishedMeta(parsed.data.publishedMeta || null);
      } else {
        setCmsError(parsed?.error || 'Failed to retrieve CMS configuration');
      }
    } catch (err) {
      console.warn('[Admin CMS]:', err.message);
      setCmsError(err.message || 'Network error fetching CMS configuration');
    } finally {
      setIsCmsLoading(false);
    }
  };

  // Safe draft updater ensuring state is never null and immediate theme preview
  const handleUpdateDraft = (updater) => {
    setCmsDraft(prev => {
      const base = normalizeCmsConfig(prev);
      const nextVal = typeof updater === 'function' ? updater(base) : updater;
      const normalized = normalizeCmsConfig(nextVal);
      // Immediately reflect theme changes on the live preview without overriding public site storage
      if (normalized?.theme) {
        applyThemeToDom(normalized.theme, false);
      }
      if (onPreviewConfig) {
        onPreviewConfig(normalized);
      }
      return normalized;
    });
  };

  // Save Draft to Backend
  const handleSaveDraft = async () => {
    if (!token) return;
    const safePayload = normalizeCmsConfig(cmsDraft);
    setIsSavingDraft(true);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/cms/config/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(safePayload)
      });
      const parsed = await safeParseJsonResponse(res, 'Save draft failed');
      if (parsed.ok) {
        if (parsed.data?.draft) {
          setCmsDraft(normalizeCmsConfig(parsed.data.draft));
        }
        if (showToast) showToast('CMS draft saved successfully!', 'success');
      } else {
        if (showToast) showToast(parsed.error || 'Failed to save draft', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Publish Draft Live
  const handlePublishLive = async (summary = 'CMS update published') => {
    if (!token) return;
    const safePayload = normalizeCmsConfig(cmsDraft);
    setIsPublishingLive(true);
    try {
      // 1. First save current draft to ensure all local changes are synced to DB
      const draftRes = await fetch(`${cleanBackendUrl}/api/admin/cms/config/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(safePayload)
      });
      const draftParsed = await safeParseJsonResponse(draftRes, 'Save draft failed before publish');
      if (!draftParsed.ok) {
        throw new Error(draftParsed.error || 'Failed to sync draft state before publish');
      }

      // 2. Publish to live website
      const res = await fetch(`${cleanBackendUrl}/api/admin/cms/config/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ summary })
      });
      const parsed = await safeParseJsonResponse(res, 'Publish failed');
      if (parsed.ok && parsed.data) {
        // Confirmed persistence from backend
        const publishedConfig = normalizeCmsConfig(parsed.data.config || safePayload);

        // Cache published config and theme in localStorage so it persists on public site & reloads
        try {
          localStorage.setItem('afterhours_cms_public_config', JSON.stringify(publishedConfig));
          localStorage.setItem('afterhours_applied_theme', JSON.stringify(publishedConfig.theme));
        } catch (e) {}

        applyThemeToDom(publishedConfig.theme, true);
        setCmsDraft(publishedConfig);

        if (onPreviewConfig) {
          onPreviewConfig(publishedConfig);
        }

        if (showToast) showToast(`Configuration successfully published to live website (Rev #${parsed.data.version})!`, 'success');
        setCmsPublishedMeta({
          version: parsed.data.version,
          publishedAt: parsed.data.publishedAt,
          lastModifiedBy: user?.username || 'admin'
        });
      } else {
        if (showToast) showToast(parsed.error || 'Failed to publish config', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsPublishingLive(false);
    }
  };

  // Open Media Picker helper
  const openMediaPicker = (callback) => {
    setMediaPickerCallback(() => callback);
    setMediaPickerOpen(true);
  };

  const handleMediaAssetPicked = (url) => {
    if (mediaPickerCallback) {
      mediaPickerCallback(url);
    }
    setMediaPickerOpen(false);
    setMediaPickerCallback(null);
  };

  // Fetch initial telemetry metrics & health
  const fetchHealthDiagnostics = async () => {
    if (!token || !isAdmin) return;
    setIsHealthLoading(true);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/health`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Health fetch failed');
      if (parsed.ok && parsed.data) {
        setHealth(parsed.data);
      }
    } catch (err) {
      console.warn('[Admin Health]:', err.message);
    } finally {
      setIsHealthLoading(false);
    }
  };

  const fetchInitialMetrics = async () => {
    if (!token || !isAdmin) return;
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Metrics fetch failed');
      if (parsed.ok && parsed.data) {
        setMetrics(parsed.data);
      }
    } catch (err) {
      console.warn('[Admin Metrics]:', err.message);
    }
  };

  useEffect(() => {
    if (isAdmin && token) {
      fetchInitialMetrics();
      fetchHealthDiagnostics();
      fetchCmsConfig();

      const sid = (typeof window !== 'undefined' && localStorage.getItem('afterhours_session_id')) || ('sid_' + Date.now());

      const adminSocket = io(cleanBackendUrl, {
        auth: { token, sessionId: sid },
        query: { sessionId: sid },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      adminSocket.on('connect', () => {
        setIsSocketConnected(true);
      });

      adminSocket.on('disconnect', () => {
        setIsSocketConnected(false);
      });

      adminSocket.on('admin_live_metrics', (data) => {
        setMetrics(data);
      });

      adminSocket.on('cms_config_updated', () => {
        fetchCmsConfig();
      });

      socketRef.current = adminSocket;

      return () => {
        adminSocket.disconnect();
      };
    }
  }, [isAdmin, token, cleanBackendUrl]);

  if (!isAdmin) {
    return <AccessDenied user={user} onBack={onExit} onLogin={onOpenAuth} />;
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Admin Session Authentication Required</h2>
        <p className="text-sm text-neutral-400 max-w-md mb-6">
          To manage website CMS content, playlists, server diagnostics, and users, please authenticate your administrator session.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAuth}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            Authenticate Admin Session
          </button>
          <button
            onClick={onExit}
            className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold border border-neutral-800 transition cursor-pointer"
          >
            Back to Music
          </button>
        </div>
      </div>
    );
  }

  // Navigation Items Grouped by Category
  const cmsNavItems = [
    { id: 'cms_settings', label: 'Global Branding', icon: Globe },
    { id: 'cms_layout', label: 'Layout & Navigation', icon: Layout },
    { id: 'cms_music', label: 'Curated Music & Stations', icon: ListMusic },
    { id: 'cms_media', label: 'Media Library', icon: ImageIcon },
    { id: 'cms_publish', label: 'Publishing & History', icon: History, badge: cmsPublishedMeta ? `Rev #${cmsPublishedMeta.version}` : null }
  ];

  const operationsNavItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'traffic', label: 'Live Traffic', icon: Activity, badge: isSocketConnected ? 'LIVE' : null },
    { id: 'users', label: 'Users & Roles', icon: Users },
    { id: 'health', label: 'API & Diagnostics', icon: Server },
    { id: 'music', label: 'Music Analytics', icon: Music2 },
    { id: 'audit', label: 'Audit Logs', icon: ShieldCheck }
  ];

  const isCmsTab = activeSubTab.startsWith('cms_');

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-neutral-950/85 backdrop-blur-xl border-b border-neutral-800/80 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Music</span>
          </button>

          <div className="h-5 w-px bg-neutral-800" />

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
            <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
              Loopra <span className="text-amber-400 font-semibold text-xs ml-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase">Dynamic CMS</span>
            </h1>
          </div>
        </div>

        {/* Quick CMS Action Controls in Header */}
        <div className="flex items-center gap-3">
          {isCmsTab && (
            <div className="flex items-center gap-2 border-r border-neutral-800 pr-3">
              <button
                type="button"
                disabled={isSavingDraft}
                onClick={handleSaveDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
              </button>

              <button
                type="button"
                disabled={isPublishingLive}
                onClick={() => handlePublishLive('Published via dashboard bar')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{isPublishingLive ? 'Publishing...' : 'Publish Live'}</span>
              </button>
            </div>
          )}

          {/* Real-time Socket status indicator */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-full">
            <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-[11px] font-mono text-emerald-400">{isSocketConnected ? 'Real-Time Sync' : 'Operational'}</span>
          </div>

          <div className="flex items-center gap-2 text-xs bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-neutral-200 truncate max-w-[120px] sm:max-w-[200px]">
              {user.username}
            </span>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-60 shrink-0 space-y-5">
          {/* Group 1: CMS Content Management */}
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider px-3 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              <span>Website Content (CMS)</span>
            </div>
            {cmsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSubTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSubTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-neutral-950 font-bold shadow-lg shadow-amber-500/20'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-neutral-950' : 'text-neutral-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                      isActive ? 'bg-neutral-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="h-px bg-neutral-800/80" />

          {/* Group 2: Telemetry & Operations */}
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider px-3 mb-2">
              Telemetry & Operations
            </div>
            {operationsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSubTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSubTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-neutral-950 font-bold shadow-lg shadow-emerald-500/20'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-neutral-950' : 'text-neutral-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                      isActive ? 'bg-neutral-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          {/* CMS Loading / Error Notices */}
          {cmsError && (
            <div className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-rose-300 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{cmsError}</span>
              </div>
              <button
                type="button"
                onClick={fetchCmsConfig}
                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl font-semibold text-rose-200 transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {isCmsLoading && !cmsDraft && (
            <div className="p-12 text-center text-xs text-neutral-400 bg-neutral-900/40 rounded-2xl border border-neutral-800 animate-pulse">
              Loading CMS configuration...
            </div>
          )}

          {/* CMS TABS */}
          {activeSubTab === 'cms_settings' && (
            <CmsGlobalSettings
              draft={cmsDraft}
              onUpdateDraft={handleUpdateDraft}
              onOpenMediaPicker={openMediaPicker}
              showToast={showToast}
              onSaveDraft={handleSaveDraft}
              onPublishLive={() => handlePublishLive('Published from Global Settings')}
              isSavingDraft={isSavingDraft}
              isPublishingLive={isPublishingLive}
            />
          )}

          {activeSubTab === 'cms_layout' && (
            <CmsLayoutEditor
              draft={cmsDraft}
              onUpdateDraft={handleUpdateDraft}
              showToast={showToast}
              onSaveDraft={handleSaveDraft}
              onPublishLive={() => handlePublishLive('Published from Layout Editor')}
              isSavingDraft={isSavingDraft}
              isPublishingLive={isPublishingLive}
            />
          )}

          {activeSubTab === 'cms_music' && (
            <CmsMusicManager
              draft={cmsDraft}
              onUpdateDraft={handleUpdateDraft}
              token={token}
              backendUrl={cleanBackendUrl}
              showToast={showToast}
              onOpenMediaPicker={openMediaPicker}
              onSaveDraft={handleSaveDraft}
              onPublishLive={() => handlePublishLive('Published from Music Manager')}
              isSavingDraft={isSavingDraft}
              isPublishingLive={isPublishingLive}
            />
          )}

          {activeSubTab === 'cms_media' && (
            <CmsMediaLibrary
              token={token}
              backendUrl={cleanBackendUrl}
              showToast={showToast}
            />
          )}

          {activeSubTab === 'cms_publish' && (
            <CmsPublishingHistory
              draft={cmsDraft}
              publishedMeta={cmsPublishedMeta}
              onSaveDraft={handleSaveDraft}
              onPublishLive={handlePublishLive}
              onTogglePreview={() => {
                if (onPreviewConfig && cmsDraft) {
                  onPreviewConfig(cmsDraft);
                } else if (showToast) {
                  showToast('Preview mode enabled with current draft configuration!', 'info');
                }
              }}
              token={token}
              backendUrl={cleanBackendUrl}
              showToast={showToast}
            />
          )}

          {/* TELEMETRY & OPERATIONS TABS */}
          {activeSubTab === 'overview' && (
            <AdminOverview 
              metrics={metrics} 
              health={health} 
              onNavigate={setActiveSubTab} 
            />
          )}

          {activeSubTab === 'traffic' && (
            <LiveTraffic metrics={metrics} />
          )}

          {activeSubTab === 'users' && (
            <UserManagement 
              token={token} 
              backendUrl={cleanBackendUrl} 
              currentUser={user}
              showToast={showToast} 
            />
          )}

          {activeSubTab === 'health' && (
            <ServerHealth 
              health={health} 
              metrics={metrics} 
              onRefresh={fetchHealthDiagnostics}
              isLoading={isHealthLoading}
            />
          )}

          {activeSubTab === 'music' && (
            <MusicAnalytics 
              token={token} 
              backendUrl={cleanBackendUrl}
              showToast={showToast}
            />
          )}

          {activeSubTab === 'audit' && (
            <AuditLogs 
              token={token} 
              backendUrl={cleanBackendUrl}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* MEDIA PICKER MODAL */}
      {mediaPickerOpen && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                Select Media Asset from Library
              </h4>
              <button
                type="button"
                onClick={() => setMediaPickerOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <CmsMediaLibrary
                token={token}
                backendUrl={cleanBackendUrl}
                showToast={showToast}
                isPickerMode={true}
                onSelectAsset={handleMediaAssetPicked}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
