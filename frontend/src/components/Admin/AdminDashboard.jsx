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
  AlertCircle,
  Menu
} from 'lucide-react';
import AccessDenied from './AccessDenied';
import AdminOverview from './AdminOverview';
import LiveTraffic from './LiveTraffic';
import UserManagement from './UserManagement';
import ServerHealth from './ServerHealth';
import MusicAnalytics from './MusicAnalytics';
import AuditLogs from './AuditLogs';
import ActivityModeration from './ActivityModeration';
import CmsGlobalSettings from './CmsGlobalSettings';
import CmsLayoutEditor from './CmsLayoutEditor';
import CmsMusicManager from './CmsMusicManager';
import CmsMediaLibrary from './CmsMediaLibrary';
import CmsPublishingHistory from './CmsPublishingHistory';
import { safeParseJsonResponse } from '../../utils/errorHandler';
import { DEFAULT_CMS_CONFIG, getCachedCmsConfig, normalizeCmsConfig, applyThemeToDom } from '../../services/cmsClient';
import { BACKEND_URL } from '../../utils/apiUrl';

export default function AdminDashboard({ user, token, backendUrl, onExit, onOpenAuth, showToast, onPreviewConfig }) {
  const cleanBackendUrl = (backendUrl && backendUrl.trim().startsWith('http'))
    ? backendUrl.trim().replace(/\/+$/, '')
    : BACKEND_URL;
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

  // Mobile drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Lock background scroll when mobile sidebar drawer is open
  useEffect(() => {
    if (isMobileSidebarOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobileSidebarOpen]);

  // Close mobile sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSidebarOpen]);

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
    { id: 'activity', label: 'Activity Moderation', icon: Activity },
    { id: 'health', label: 'API & Diagnostics', icon: Server },
    { id: 'music', label: 'Music Analytics', icon: Music2 },
    { id: 'audit', label: 'Audit Logs', icon: ShieldCheck }
  ];

  const isCmsTab = activeSubTab.startsWith('cms_');
  const isAuthError = Boolean(
    cmsError && (
      cmsError.toLowerCase().includes('unauthorized') ||
      cmsError.toLowerCase().includes('token') ||
      cmsError.toLowerCase().includes('forbidden') ||
      cmsError.toLowerCase().includes('expired')
    )
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800/80 px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Hamburger button on mobile */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(prev => !prev)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition cursor-pointer shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              onClick={onExit}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-800 transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Music</span>
            </button>

            <div className="hidden sm:block h-5 w-px bg-neutral-800 shrink-0" />

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 shrink-0" />
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight truncate">
                {cmsDraft?.branding?.siteName ? `${cmsDraft.branding.siteName} ` : ''}<span className="hidden sm:inline-block text-amber-400 font-semibold text-xs ml-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase">Dynamic CMS</span>
              </h1>
            </div>
          </div>

          {/* Quick CMS Action Controls in Header */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isCmsTab && (
              <div className="flex items-center gap-1.5 sm:gap-2 sm:border-r sm:border-neutral-800 sm:pr-3">
                <button
                  type="button"
                  disabled={isSavingDraft}
                  onClick={handleSaveDraft}
                  title="Save Draft"
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Save className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
                  <span className="sm:hidden">{isSavingDraft ? '...' : 'Draft'}</span>
                </button>

                <button
                  type="button"
                  disabled={isPublishingLive}
                  onClick={() => handlePublishLive('Published via dashboard bar')}
                  title="Publish Live"
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{isPublishingLive ? 'Publishing...' : 'Publish Live'}</span>
                  <span className="sm:hidden">{isPublishingLive ? '...' : 'Publish'}</span>
                </button>
              </div>
            )}

            {/* Real-time Socket status indicator (desktop only) */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-full shrink-0">
              <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-[11px] font-mono text-emerald-400">{isSocketConnected ? 'Real-Time Sync' : 'Operational'}</span>
            </div>

            {/* User badge (desktop only) */}
            <div className="hidden md:flex items-center gap-2 text-xs bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-neutral-200 truncate max-w-[120px] sm:max-w-[200px]">
                {user.username}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile secondary status row (md:hidden) */}
        <div className="md:hidden mt-2 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <span className="text-neutral-500 shrink-0">Section:</span>
            <span className="text-amber-400 font-semibold truncate">
              {[...cmsNavItems, ...operationsNavItems].find(i => i.id === activeSubTab)?.label || activeSubTab}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-[10px] font-mono text-emerald-400">{isSocketConnected ? 'Live' : 'Ready'}</span>
            </div>
            <span className="text-neutral-700">|</span>
            <span className="text-neutral-300 font-mono text-[10px] truncate max-w-[100px]">{user?.username}</span>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col md:flex-row gap-4 sm:gap-6 min-w-0">
        {/* Mobile Drawer Backdrop */}
        {isMobileSidebarOpen && (
          <div
            role="presentation"
            aria-hidden="true"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity md:hidden"
          />
        )}

        {/* Navigation Sidebar (Slide-in Drawer on Mobile, Column on Desktop) */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-[60] w-[min(85vw,300px)] bg-neutral-950/98 border-r border-neutral-800 p-4 overflow-y-auto transform transition-transform duration-300 ease-in-out
            ${isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            md:translate-x-0 md:static md:inset-auto md:z-auto md:w-60 md:max-w-none md:bg-transparent md:border-0 md:p-0 md:overflow-visible md:transition-none md:shrink-0
            space-y-5
          `}
        >
          {/* Mobile Drawer Header with Close Button */}
          <div className="flex md:hidden items-center justify-between pb-3 mb-2 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-200">Admin Navigation</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close navigation drawer"
              className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

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
                  onClick={() => {
                    setActiveSubTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
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
                  onClick={() => {
                    setActiveSubTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
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
        <main className="flex-1 min-w-0 pb-12 md:pb-8">
          {/* CMS Loading / Error Notices */}
          {cmsError && (
            <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-300 text-xs">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
                <span className="break-words min-w-0 leading-relaxed">{cmsError}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {isAuthError && onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl transition cursor-pointer shadow-sm text-xs"
                  >
                    Re-authenticate
                  </button>
                )}
                <button
                  type="button"
                  onClick={fetchCmsConfig}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl font-semibold text-rose-200 transition cursor-pointer text-xs"
                >
                  Retry
                </button>
              </div>
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
              token={token}
              backendUrl={cleanBackendUrl}
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
              token={token}
              backendUrl={cleanBackendUrl}
              showToast={showToast}
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

          {activeSubTab === 'activity' && (
            <ActivityModeration 
              token={token} 
              backendUrl={cleanBackendUrl}
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
