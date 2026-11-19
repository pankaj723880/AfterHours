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
  Layers, 
  ListMusic, 
  Image as ImageIcon, 
  History, 
  Save, 
  UploadCloud, 
  Eye, 
  Sliders, 
  Sparkles, 
  Brain, 
  X, 
  AlertCircle, 
  Menu, 
  Mic, 
  Star, 
  Download, 
  Zap, 
  Key, 
  Monitor, 
  Smartphone,
  Bell,
  Search,
  Compass,
  ChevronRight,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import AccessDenied from './AccessDenied';
import AdminOverview from './AdminOverview';
import AdminReviewsManagement from './AdminReviewsManagement';
import LiveTraffic from './LiveTraffic';
import UserManagement from './UserManagement';
import ServerHealth from './ServerHealth';
import MusicAnalytics from './MusicAnalytics';
import AuditLogs from './AuditLogs';
import ActivityModeration from './ActivityModeration';
import OfflineLicenseManagement from './OfflineLicenseManagement';
import PlatformManager from './PlatformManager';
import CmsGlobalSettings from './CmsGlobalSettings';
import CmsBroadcastPromotions from './CmsBroadcastPromotions';
import CmsContentCuration from './CmsContentCuration';
import CmsNavigationRoutes from './CmsNavigationRoutes';
import CmsFeatureGovernance from './CmsFeatureGovernance';
import AiLearningIntelligence from './AiLearningIntelligence';
import VoiceControlManagement from './VoiceControlManagement';
import AiLiveCodePatcher from './AiLiveCodePatcher';
import ApiKeyManagement from './ApiKeyManagement';
import { safeParseJsonResponse } from '../../utils/errorHandler';
import { DEFAULT_CMS_CONFIG, getCachedCmsConfig, normalizeCmsConfig, applyThemeToDom, resolvePlatformConfig } from '../../services/cmsClient';
import { BACKEND_URL } from '../../utils/apiUrl';
import { USE_V2_MOBILE_ADMIN } from '../../constants/featureFlags';

export default function AdminDashboard({ 
  user, 
  token, 
  backendUrl, 
  onExit, 
  onOpenAuth, 
  showToast, 
  onPreviewConfig, 
  onUserUpdated, 
  onReviewsUpdated 
}) {
  const cleanBackendUrl = (backendUrl && backendUrl.trim().startsWith('http'))
    ? backendUrl.trim().replace(/\/+$/, '')
    : BACKEND_URL;

  // Active Workspace Navigation (Defaults to 'cms_settings' or 'overview')
  const [activeSubTab, setActiveSubTab] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const sectionParam = params.get('section');
        if (sectionParam) {
          if (sectionParam === 'cms_platforms') return 'cms_settings';
          return sectionParam;
        }
      } catch (_) {}
    }
    return 'cms_settings';
  });

  // Secondary Navbar Active Platform / Scope Selector: 'global' | 'desktop' | 'mobile_web' | 'android_app'
  const [activeScope, setActiveScope] = useState('global');

  // Sidebar collapse toggle state (Desktop)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Search filter query for admin menu items
  const [navSearchQuery, setNavSearchQuery] = useState('');

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

  const isAdmin = Boolean(user && user.role === 'admin');

  // Detect Standalone / Android APK mode to safely clear device status bar
  const [isStandaloneApp, setIsStandaloneApp] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.LoopraAndroid ||
      window.navigator?.standalone ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator?.userAgent && navigator.userAgent.includes('LoopraNativeAndroid'))
    );
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkStandalone = () => {
      setIsStandaloneApp(Boolean(
        window.LoopraAndroid ||
        window.navigator?.standalone ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        (navigator?.userAgent && navigator.userAgent.includes('LoopraNativeAndroid'))
      ));
    };
    checkStandalone();
    const media = window.matchMedia?.('(display-mode: standalone)');
    media?.addEventListener?.('change', checkStandalone);
    return () => media?.removeEventListener?.('change', checkStandalone);
  }, []);

  // Sync WebSocket connection for real-time traffic & metrics
  useEffect(() => {
    if (!token) return;
    try {
      const socket = io(cleanBackendUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setIsSocketConnected(true);
      });

      socket.on('disconnect', () => {
        setIsSocketConnected(false);
      });

      socket.on('admin:metrics', (data) => {
        if (data) setMetrics(data);
      });

      return () => {
        socket.disconnect();
      };
    } catch (err) {
      console.warn('[Admin Socket] Init error:', err.message);
    }
  }, [cleanBackendUrl, token]);

  // Fetch initial CMS config
  const fetchCmsConfig = async () => {
    if (!token) return;
    setIsCmsLoading(true);
    setCmsError(null);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/cms/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to fetch CMS config');
      if (parsed.ok && parsed.data) {
        if (parsed.data.draft) {
          setCmsDraft(normalizeCmsConfig(parsed.data.draft));
        }
        if (parsed.data.publishedMeta) {
          setCmsPublishedMeta(parsed.data.publishedMeta);
        }
      } else {
        setCmsError(parsed.error || 'Failed to load CMS data');
      }
    } catch (err) {
      setCmsError(err.message || 'Error connecting to CMS server');
    } finally {
      setIsCmsLoading(false);
    }
  };

  useEffect(() => {
    fetchCmsConfig();
  }, [cleanBackendUrl, token]);

  // Update draft in state and notify live preview
  const handleUpdateDraft = (updater) => {
    setCmsDraft(prev => {
      const base = prev || normalizeCmsConfig(DEFAULT_CMS_CONFIG);
      const next = typeof updater === 'function' ? updater(base) : updater;
      const normalized = normalizeCmsConfig(next);
      if (normalized.theme) {
        applyThemeToDom(normalized.theme, false);
      }
      if (onPreviewConfig) {
        setTimeout(() => {
          onPreviewConfig(normalized);
        }, 0);
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
      // 1. Sync current draft first
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
        const publishedConfig = normalizeCmsConfig(parsed.data.config || safePayload);
        try {
          localStorage.setItem('afterhours_cms_public_config', JSON.stringify(publishedConfig));
          localStorage.setItem('afterhours_applied_theme', JSON.stringify(publishedConfig.theme));
        } catch (e) {}

        applyThemeToDom(publishedConfig.theme, true);
        setCmsDraft(publishedConfig);

        if (onPreviewConfig) {
          onPreviewConfig(publishedConfig);
        }

        if (showToast) showToast(`Configuration successfully published live (Rev #${parsed.data.version})!`, 'success');
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

  // Switch Scope from Secondary Navbar
  const handleScopeChange = (scopeId) => {
    setActiveScope(scopeId);
    if (onPreviewConfig && cmsDraft) {
      if (scopeId === 'global') {
        onPreviewConfig(cmsDraft);
        showToast?.('Switched scope to Global base configuration', 'info');
      } else {
        const resolved = resolvePlatformConfig(cmsDraft, scopeId);
        onPreviewConfig(resolved);
        showToast?.(`Switched scope to ${scopeId === 'desktop' ? 'Desktop' : scopeId === 'mobile_web' ? 'Mobile Web' : 'Android App'} (overrides active)`, 'info');
      }
    }
  };

  // Helper to count platform overrides
  const getOverrideCount = (scopeId) => {
    if (scopeId === 'global' || !cmsDraft?.platforms?.[scopeId]) return 0;
    const p = cmsDraft.platforms[scopeId];
    let count = 0;
    for (const key of Object.keys(p)) {
      if (typeof p[key] === 'object' && p[key] !== null) {
        count += Object.keys(p[key]).length;
      } else if (p[key] !== undefined) {
        count += 1;
      }
    }
    return count;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
          <ShieldAlert className="w-8 h-8" />
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

  // 5 CORE CMS WORKSPACES (Platform Targets is consolidated into the secondary navbar)
  const cmsWorkspaces = [
    { 
      id: 'cms_settings', 
      label: '1. Global Branding', 
      desc: 'Logo, Themes & Identity',
      icon: Globe 
    },
    { 
      id: 'cms_broadcast', 
      label: '2. Broadcast & Promos', 
      desc: 'Announcements & Banners',
      icon: Bell,
      badge: cmsDraft?.announcement?.enabled ? 'Active' : null 
    },
    { 
      id: 'cms_content', 
      label: '3. Content & Curation', 
      desc: 'Sections, Stations & Media',
      icon: ListMusic 
    },
    { 
      id: 'cms_navigation', 
      label: '4. Navigation & Routes', 
      desc: 'Sidebars, Drawers & Routes',
      icon: Layout 
    },
    { 
      id: 'cms_governance', 
      label: '5. Feature Matrix', 
      desc: 'Feature Flags & Version Rollback',
      icon: Sliders,
      badge: cmsPublishedMeta ? `v${cmsPublishedMeta.version}` : null
    }
  ];

  // OPERATIONS & ADMINISTRATION
  const operationsNavItems = [
    { id: 'overview', label: 'Overview & Telemetry', icon: LayoutDashboard },
    { id: 'live_patcher', label: 'Live Code Patcher', icon: Zap, badge: 'HMR' },
    { id: 'api_keys', label: 'API Keys Pool', icon: Key, badge: 'Active' },
    { id: 'voice_control', label: 'Loopra AI / Voice', icon: Mic },
    { id: 'reviews', label: 'Ratings & Reviews', icon: Star },
    { id: 'ai_learning', label: 'AI Learning Engine', icon: Brain },
    { id: 'traffic', label: 'Live Traffic', icon: Activity, badge: isSocketConnected ? 'LIVE' : null },
    { id: 'users', label: 'Users & Roles', icon: Users },
    { id: 'download_apk', label: 'Download APK', icon: Smartphone, badge: 'v2.1' },
    { id: 'activity', label: 'Activity Moderation', icon: Activity },
    { id: 'health', label: 'API & Diagnostics', icon: Server },
    { id: 'music', label: 'Music Analytics', icon: Music2 },
    { id: 'audit', label: 'Audit Logs', icon: ShieldCheck }
  ];

  const isCmsWorkspace = activeSubTab.startsWith('cms_');
  const allNavItems = [...cmsWorkspaces, ...operationsNavItems];
  const currentNav = allNavItems.find(i => i.id === activeSubTab) || cmsWorkspaces[0];

  const filteredCms = cmsWorkspaces.filter(w => 
    w.label.toLowerCase().includes(navSearchQuery.toLowerCase()) || 
    (w.desc && w.desc.toLowerCase().includes(navSearchQuery.toLowerCase()))
  );
  const filteredOps = operationsNavItems.filter(o => 
    o.label.toLowerCase().includes(navSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500/30">
      {/* Top Navbar */}
      <header
        style={{
          paddingTop: isStandaloneApp
            ? 'max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px), 28px)'
            : 'max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px), 0.625rem)',
        }}
        className="sticky top-0 z-40 bg-neutral-950/95 backdrop-blur-xl border-b border-neutral-800/80 px-3 sm:px-6 pb-2.5 box-border select-none"
      >
        <div className="flex items-center justify-between gap-3 min-w-0">
          {/* Left: Mobile Toggle, Breadcrumb & Back button */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(prev => !prev)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition cursor-pointer shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              aria-label="Collapse sidebar"
              className="hidden lg:flex p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer shrink-0"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            <button
              onClick={onExit}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-800 transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Music</span>
            </button>

            <div className="hidden sm:block h-5 w-px bg-neutral-800 shrink-0" />

            {/* Breadcrumb Display */}
            <div className="hidden md:flex items-center gap-2 text-xs text-neutral-400 min-w-0">
              <span className="text-neutral-500 font-medium">Loopra Admin</span>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
              <span className="font-bold text-white truncate">{currentNav.label}</span>
            </div>
          </div>

          {/* Center / Right: Quick Actions & User */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick CMS Action Controls */}
            {isCmsWorkspace && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  disabled={isSavingDraft}
                  onClick={handleSaveDraft}
                  title={`Save Draft (${activeScope === 'global' ? 'Global' : activeScope === 'desktop' ? 'Desktop' : activeScope === 'mobile_web' ? 'Mobile Web' : 'Android App'})`}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Save className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                  <span className="hidden sm:inline">{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
                  <span className="sm:hidden">{isSavingDraft ? '...' : 'Draft'}</span>
                </button>

                <button
                  type="button"
                  disabled={isPublishingLive}
                  onClick={() => handlePublishLive(`Published via topbar (${activeScope.toUpperCase()})`)}
                  title="Publish Live"
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{isPublishingLive ? 'Publishing...' : 'Publish Live'}</span>
                  <span className="sm:hidden">{isPublishingLive ? '...' : 'Publish'}</span>
                </button>
              </div>
            )}

            {/* Real-time Socket status indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-full shrink-0">
              <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-[11px] font-mono text-emerald-400">{isSocketConnected ? 'Real-Time' : 'Operational'}</span>
            </div>

            {/* User badge */}
            <div className="flex items-center gap-2 text-xs bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-neutral-200 truncate max-w-[100px] sm:max-w-[150px]">
                {user.username}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* SECONDARY NAVBAR: Platform & Scope Selector (Visible Across All CMS Workspaces) */}
      {isCmsWorkspace && (
        <div className="sticky top-[53px] z-30 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80 px-3 sm:px-6 py-2 select-none shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* 4 Scope Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { 
                  id: 'global', 
                  label: 'Global', 
                  desc: 'All Platforms Base',
                  icon: Globe 
                },
                { 
                  id: 'desktop', 
                  label: 'Desktop', 
                  desc: 'Website Overrides',
                  icon: Monitor 
                },
                { 
                  id: 'mobile_web', 
                  label: 'Mobile Web', 
                  desc: 'Browser Overrides',
                  icon: Smartphone 
                },
                { 
                  id: 'android_app', 
                  label: 'Android App', 
                  desc: 'TWA Overrides',
                  icon: Smartphone 
                }
              ].map((scopeItem) => {
                const Icon = scopeItem.icon;
                const isSelected = activeScope === scopeItem.id;
                const overrideCount = getOverrideCount(scopeItem.id);

                return (
                  <button
                    key={scopeItem.id}
                    type="button"
                    onClick={() => handleScopeChange(scopeItem.id)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400'
                        : 'bg-neutral-900/90 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/90'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-neutral-950' : 'text-neutral-400'}`} />
                    <span>{scopeItem.label}</span>
                    {scopeItem.id !== 'global' && overrideCount > 0 && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-neutral-950 text-amber-400' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {overrideCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Scope Status Banner */}
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className={`w-1.5 h-1.5 rounded-full ${activeScope === 'global' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                <span>
                  {activeScope === 'global' ? (
                    <span>Scope: <strong className="text-amber-300">Global Base</strong> (applies to all unless overridden)</span>
                  ) : (
                    <span>Scope: <strong className="text-cyan-300">{activeScope === 'desktop' ? 'Desktop' : activeScope === 'mobile_web' ? 'Mobile Web' : 'Android App'}</strong> (overrides active)</span>
                  )}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Workspace Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-4 md:p-6 flex flex-col lg:flex-row gap-4 sm:gap-6 min-w-0 overflow-x-hidden">
        {/* Mobile Drawer Backdrop */}
        {isMobileSidebarOpen && (
          <div
            role="presentation"
            aria-hidden="true"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity lg:hidden"
          />
        )}

        {/* Unified Sidebar Navigation */}
        <aside
          style={{
            paddingTop: isStandaloneApp
              ? 'max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px), 24px)'
              : 'max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px), 1rem)',
            paddingBottom: 'max(var(--safe-area-bottom, 0px), env(safe-area-inset-bottom, 0px), 1rem)'
          }}
          className={`
            fixed inset-y-0 left-0 z-[60] bg-neutral-950/98 border-r border-neutral-800/80 p-4 overflow-y-auto transform transition-all duration-300 ease-in-out
            ${isMobileSidebarOpen ? 'translate-x-0 w-[min(85vw,320px)] shadow-2xl' : '-translate-x-full'}
            lg:translate-x-0 lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:border-0 lg:p-0 lg:overflow-visible lg:shrink-0
            ${isSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
            space-y-5
          `}
        >
          {/* Mobile Drawer Header */}
          <div className="flex lg:hidden items-center justify-between pb-3 mb-2 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-200">Admin Control</span>
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

          {/* Search Filter for Admin Tabs */}
          {!isSidebarCollapsed && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={navSearchQuery}
                onChange={(e) => setNavSearchQuery(e.target.value)}
                placeholder="Filter workspaces..."
                className="w-full bg-neutral-900/80 border border-neutral-800/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-amber-500/40"
              />
              {navSearchQuery && (
                <button
                  type="button"
                  onClick={() => setNavSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Group 1: 6 Core CMS Workspaces */}
          <div className="space-y-1">
            {!isSidebarCollapsed && (
              <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider px-3 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                <span>6 Core CMS Workspaces</span>
              </div>
            )}
            {filteredCms.map((item) => {
              const Icon = item.icon;
              const isActive = activeSubTab === item.id;
              return (
                <button
                  key={item.id}
                  title={isSidebarCollapsed ? item.label : undefined}
                  onClick={() => {
                    setActiveSubTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-neutral-950 font-bold shadow-lg shadow-amber-500/20'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-neutral-950' : 'text-neutral-400'}`} />
                    {!isSidebarCollapsed && (
                      <div className="text-left truncate min-w-0">
                        <div className="truncate">{item.label}</div>
                        {item.desc && (
                          <div className={`text-[10px] font-normal truncate ${isActive ? 'text-neutral-800' : 'text-neutral-500'}`}>
                            {item.desc}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {!isSidebarCollapsed && item.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 ${
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

          {/* Group 2: Operations & Administration */}
          <div className="space-y-1">
            {!isSidebarCollapsed && (
              <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider px-3 mb-2">
                Operations & Administration
              </div>
            )}
            {filteredOps.map((item) => {
              const Icon = item.icon;
              const isActive = activeSubTab === item.id;
              return (
                <button
                  key={item.id}
                  title={isSidebarCollapsed ? item.label : undefined}
                  onClick={() => {
                    setActiveSubTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-neutral-950 font-bold shadow-lg shadow-emerald-500/20'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-neutral-950' : 'text-neutral-400'}`} />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isSidebarCollapsed && item.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 ${
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

        {/* Main Content Workspace Body */}
        <main className="flex-1 min-w-0 pb-16">
          {/* CMS Loading / Error Notices */}
          {cmsError && (
            <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-300 text-xs">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
                <span className="break-words min-w-0 leading-relaxed">{cmsError}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={fetchCmsConfig}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl font-semibold text-rose-200 transition cursor-pointer text-xs"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          {isCmsLoading && !cmsDraft && (
            <div className="p-12 text-center text-xs text-neutral-400 bg-neutral-900/40 rounded-2xl border border-neutral-800 animate-pulse">
              Loading CMS configuration...
            </div>
          )}

          {/* 5 CORE CMS WORKSPACES */}
          {/* 1. Global Branding & Appearance */}
          {activeSubTab === 'cms_settings' && (
            <CmsGlobalSettings
              draft={cmsDraft}
              onUpdateDraft={handleUpdateDraft}
              onOpenMediaPicker={openMediaPicker}
              showToast={showToast}
              onSaveDraft={handleSaveDraft}
              onPublishLive={() => handlePublishLive(`Published from Global Settings (${activeScope})`)}
              isSavingDraft={isSavingDraft}
              isPublishingLive={isPublishingLive}
              activeScope={activeScope}
            />
          )}

          {/* 2. Broadcast & Promotions */}
          {activeSubTab === 'cms_broadcast' && (
            <CmsBroadcastPromotions
              draft={cmsDraft}
              onUpdateDraft={handleUpdateDraft}
              showToast={showToast}
              onSaveDraft={handleSaveDraft}
              onPublishLive={handlePublishLive}
              isSavingDraft={isSavingDraft}
              isPublishingLive={isPublishingLive}
              onOpenMediaPicker={openMediaPicker}
              onPreviewConfig={onPreviewConfig}
              activeScope={activeScope}
            />
          )}

          {/* 3. Content & Curation */}
          {activeSubTab === 'cms_content' && (
            <CmsContentCuration
              draft={cmsDraft}
              onUpdateDraft={handleUpdateDraft}
              showToast={showToast}
              onSaveDraft={handleSaveDraft}
              onPublishLive={handlePublishLive}
              isSavingDraft={isSavingDraft}
              isPublishingLive={isPublishingLive}
              token={token}
              backendUrl={cleanBackendUrl}
              onOpenMediaPicker={openMediaPicker}
              activeScope={activeScope}
            />
          )}

          {/* 4. Navigation & Routes */}
          {activeSubTab === 'cms_navigation' && (
            <CmsNavigationRoutes
              draft={cmsDraft}
              onUpdateDraft={handleUpdateDraft}
              showToast={showToast}
              onSaveDraft={handleSaveDraft}
              onPublishLive={handlePublishLive}
              isSavingDraft={isSavingDraft}
              isPublishingLive={isPublishingLive}
              token={token}
              backendUrl={cleanBackendUrl}
              activeScope={activeScope}
            />
          )}

          {/* 5. Feature Matrix & Governance */}
          {activeSubTab === 'cms_governance' && (
            <CmsFeatureGovernance
              draft={cmsDraft}
              onUpdateDraft={handleUpdateDraft}
              showToast={showToast}
              onSaveDraft={handleSaveDraft}
              onPublishLive={handlePublishLive}
              isSavingDraft={isSavingDraft}
              isPublishingLive={isPublishingLive}
              token={token}
              backendUrl={cleanBackendUrl}
              publishedMeta={cmsPublishedMeta}
              activeScope={activeScope}
              onTogglePreview={() => {
                if (onPreviewConfig && cmsDraft) {
                  if (activeScope === 'global') {
                    onPreviewConfig(cmsDraft);
                  } else {
                    const resolved = resolvePlatformConfig(cmsDraft, activeScope);
                    onPreviewConfig(resolved);
                  }
                } else if (showToast) {
                  showToast('Preview mode enabled with current configuration!', 'info');
                }
              }}
            />
          )}

          {/* OPERATIONS & ADMINISTRATION TABS */}
          {activeSubTab === 'overview' && (
            <AdminOverview 
              metrics={metrics} 
              health={health} 
              onNavigate={setActiveSubTab} 
              token={token}
              backendUrl={cleanBackendUrl}
              onOpenAuth={onOpenAuth}
            />
          )}

          {activeSubTab === 'live_patcher' && (
            <AiLiveCodePatcher
              token={token}
              backendUrl={cleanBackendUrl}
              showToast={showToast}
            />
          )}

          {activeSubTab === 'api_keys' && (
            <ApiKeyManagement
              token={token}
              backendUrl={cleanBackendUrl}
              showToast={showToast}
            />
          )}

          {activeSubTab === 'voice_control' && (
            <VoiceControlManagement
              token={token}
              backendUrl={cleanBackendUrl}
              showToast={showToast}
            />
          )}

          {activeSubTab === 'reviews' && (
            <AdminReviewsManagement
              token={token}
              backendUrl={cleanBackendUrl}
              showToast={showToast}
              onReviewsUpdated={onReviewsUpdated}
            />
          )}

          {activeSubTab === 'ai_learning' && (
            <AiLearningIntelligence
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
              onUserUpdated={onUserUpdated} 
              onOpenAuth={onOpenAuth} 
            />
          )}

          {activeSubTab === 'download_apk' && (
            <div className="p-6 max-w-2xl mx-auto space-y-6">
              <div className="p-6 rounded-3xl bg-neutral-900 border border-amber-500/30 text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                  <Smartphone className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Download Official Signed APK</h3>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Directly download the latest published Android APK (v2.1). Built with native background audio playback, PiP video support, and offline capabilities.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a
                    href="/downloads/loopra.apk"
                    download="Loopra.apk"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-neutral-950" />
                    <span>Download Signed APK (Direct)</span>
                  </a>
                </div>
                <p className="text-[11px] text-neutral-500 font-mono">
                  Permanent URL: https://loopra1.vercel.app/downloads/loopra.apk
                </p>
              </div>
            </div>
          )}

          {activeSubTab === 'offline_licenses' && (
            <OfflineLicenseManagement
              token={token}
              backendUrl={cleanBackendUrl}
              showToast={showToast}
            />
          )}

          {activeSubTab === 'activity' && (
            <ActivityModeration 
              token={token} 
              backendUrl={cleanBackendUrl} 
            />
          )}

          {activeSubTab === 'health' && (
            <ServerHealth 
              health={health} 
              isLoading={isHealthLoading} 
              onRefresh={() => {
                if (showToast) showToast('Diagnostics refreshed', 'info');
              }} 
            />
          )}

          {activeSubTab === 'music' && (
            <MusicAnalytics 
              token={token} 
              backendUrl={cleanBackendUrl} 
            />
          )}

          {activeSubTab === 'audit' && (
            <AuditLogs 
              token={token} 
              backendUrl={cleanBackendUrl} 
            />
          )}
        </main>
      </div>
    </div>
  );
}
