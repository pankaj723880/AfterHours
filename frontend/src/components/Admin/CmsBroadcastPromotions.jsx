import React, { useState } from 'react';
import { 
  Bell, 
  ImageIcon, 
  AlertTriangle, 
  Eye, 
  Save, 
  UploadCloud, 
  Sparkles, 
  Check, 
  Layers, 
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { normalizeCmsConfig } from '../../services/cmsClient';

export default function CmsBroadcastPromotions({
  draft,
  onUpdateDraft,
  showToast,
  onSaveDraft,
  onPublishLive,
  isSavingDraft = false,
  isPublishingLive = false,
  onOpenMediaPicker,
  onPreviewConfig,
  activeScope = 'global'
}) {
  const [activeTab, setActiveTab] = useState('announcement');
  const safeDraft = normalizeCmsConfig(draft);

  const isScopeGlobal = activeScope === 'global';
  const platformOverrides = (!isScopeGlobal && safeDraft.platforms?.[activeScope]) || {};

  // Resolve values based on scope with clear inheritance detection
  const getEffectiveField = (section, field, fallback = '') => {
    if (isScopeGlobal) {
      return {
        value: safeDraft[section]?.[field] ?? fallback,
        isOverridden: false
      };
    }
    const hasOverride = platformOverrides[section] && Object.prototype.hasOwnProperty.call(platformOverrides[section], field);
    return {
      value: hasOverride ? platformOverrides[section][field] : (safeDraft[section]?.[field] ?? fallback),
      isOverridden: hasOverride
    };
  };

  const handleFieldChange = (section, field, value) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      if (isScopeGlobal) {
        return {
          ...base,
          [section]: {
            ...(base[section] || {}),
            [field]: value
          }
        };
      }

      // Platform specific override
      const prevPlatforms = { ...(base.platforms || {}) };
      const currentPlatformObj = { ...(prevPlatforms[activeScope] || {}) };
      const currentSectionObj = { ...(currentPlatformObj[section] || {}) };

      currentSectionObj[field] = value;
      currentPlatformObj[section] = currentSectionObj;
      prevPlatforms[activeScope] = currentPlatformObj;

      return {
        ...base,
        platforms: prevPlatforms
      };
    });
  };

  const handleClearOverride = (section, field) => {
    if (isScopeGlobal) return;
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const prevPlatforms = { ...(base.platforms || {}) };
      const currentPlatformObj = { ...(prevPlatforms[activeScope] || {}) };
      if (!currentPlatformObj[section]) return base;

      const currentSectionObj = { ...currentPlatformObj[section] };
      delete currentSectionObj[field];

      if (Object.keys(currentSectionObj).length === 0) {
        delete currentPlatformObj[section];
      } else {
        currentPlatformObj[section] = currentSectionObj;
      }

      if (Object.keys(currentPlatformObj).length === 0) {
        delete prevPlatforms[activeScope];
      } else {
        prevPlatforms[activeScope] = currentPlatformObj;
      }

      return {
        ...base,
        platforms: prevPlatforms
      };
    });
    showToast?.(`Reset to Global shared default`, 'info');
  };

  // Build effective objects for previewing
  const announcement = {
    enabled: getEffectiveField('announcement', 'enabled', false).value,
    message: getEffectiveField('announcement', 'message', '').value,
    type: getEffectiveField('announcement', 'type', 'info').value,
    linkText: getEffectiveField('announcement', 'linkText', '').value,
    linkUrl: getEffectiveField('announcement', 'linkUrl', '').value
  };

  const banner = {
    enabled: getEffectiveField('banner', 'enabled', false).value,
    title: getEffectiveField('banner', 'title', '').value,
    subtitle: getEffectiveField('banner', 'subtitle', '').value,
    imageUrl: getEffectiveField('banner', 'imageUrl', '').value,
    actionText: getEffectiveField('banner', 'actionText', '').value,
    actionUrl: getEffectiveField('banner', 'actionUrl', '').value
  };

  const maintenance = {
    enabled: getEffectiveField('maintenance', 'enabled', false).value,
    title: getEffectiveField('maintenance', 'title', '').value,
    message: getEffectiveField('maintenance', 'message', '').value
  };

  const scopeLabel = isScopeGlobal 
    ? 'Global Base' 
    : (activeScope === 'desktop' ? 'Desktop' : activeScope === 'mobile_web' ? 'Mobile Web' : 'Android App');

  const tabs = [
    { id: 'announcement', label: 'Site-Wide Announcement Bar', icon: Bell, badge: announcement.enabled ? 'ACTIVE' : null },
    { id: 'banner', label: 'Promotional Hero Banner', icon: ImageIcon, badge: banner.enabled ? 'ACTIVE' : null },
    { id: 'maintenance', label: 'Maintenance Mode Killswitch', icon: AlertTriangle, badge: maintenance.enabled ? 'LOCKED' : null }
  ];

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="rounded-2xl bg-neutral-900/70 border border-neutral-800 p-4 sm:p-6 backdrop-blur-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Broadcast & Promotions Workspace</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Announcements & Spotlight Banners
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl">
              Broadcast critical listener alerts, manage promotional hero banners, and configure emergency maintenance mode.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onSaveDraft && (
              <button
                type="button"
                disabled={isSavingDraft}
                onClick={onSaveDraft}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
              </button>
            )}

            {onPublishLive && (
              <button
                type="button"
                disabled={isPublishingLive}
                onClick={() => onPublishLive('Published broadcast & promotional settings')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{isPublishingLive ? 'Publishing...' : 'Publish Live'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-6 border-t border-neutral-800/80 mt-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-bold'
                    : 'bg-neutral-950/60 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-neutral-950 text-amber-400' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-4 sm:p-6 backdrop-blur-md space-y-6">
        {/* 1. ANNOUNCEMENT BAR */}
        {activeTab === 'announcement' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-800 gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>Site-Wide Notification Bar</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Displays across the top of the entire platform for all visitors and mobile app listeners.
                </p>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer bg-neutral-950/80 border border-neutral-800 px-3.5 py-2 rounded-xl">
                <span className="text-xs font-semibold text-neutral-300">Live Status:</span>
                <input
                  type="checkbox"
                  checked={Boolean(announcement.enabled)}
                  onChange={(e) => handleFieldChange('announcement', 'enabled', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <span className={`text-xs font-bold ${announcement.enabled ? 'text-emerald-400' : 'text-neutral-500'}`}>
                  {announcement.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            {/* Live Visual Preview */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  Live Announcement Preview
                </span>
                <span className={`px-2 py-0.5 rounded-full ${announcement.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-800 text-neutral-500'}`}>
                  {announcement.enabled ? 'Will Render on Site' : 'Currently Hidden'}
                </span>
              </div>

              <div className={`p-3 rounded-lg flex items-center justify-between gap-3 text-xs border ${
                announcement.type === 'promo' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                announcement.type === 'warning' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                announcement.type === 'alert' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse shrink-0" />
                  <span className="truncate font-medium">{announcement.message || 'No announcement message specified yet.'}</span>
                </div>
                {announcement.linkText && (
                  <span className="px-2 py-0.5 rounded-md bg-white/10 font-bold shrink-0 text-[11px] underline">
                    {announcement.linkText}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <label>Announcement Message</label>
                  {!isScopeGlobal && getEffectiveField('announcement', 'message').isOverridden && (
                    <button
                      type="button"
                      onClick={() => handleClearOverride('announcement', 'message')}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={announcement.message || ''}
                  onChange={(e) => handleFieldChange('announcement', 'message', e.target.value)}
                  placeholder="Welcome to Loopra! Enjoy uninterrupted retro Bollywood and curated hits."
                  className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                    !isScopeGlobal && getEffectiveField('announcement', 'message').isOverridden
                      ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-neutral-700 focus:border-amber-500/60'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <label>Style Category</label>
                  {!isScopeGlobal && getEffectiveField('announcement', 'type').isOverridden && (
                    <button
                      type="button"
                      onClick={() => handleClearOverride('announcement', 'type')}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
                <select
                  value={announcement.type || 'info'}
                  onChange={(e) => handleFieldChange('announcement', 'type', e.target.value)}
                  className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                    !isScopeGlobal && getEffectiveField('announcement', 'type').isOverridden
                      ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-neutral-700 focus:border-amber-500/60'
                  }`}
                >
                  <option value="info">Info (Emerald Subtle)</option>
                  <option value="promo">Promo (Amber Warm Spotlight)</option>
                  <option value="warning">Warning (Orange Notice)</option>
                  <option value="alert">Alert (Rose Critical)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <label>Action Button Label (Optional)</label>
                  {!isScopeGlobal && getEffectiveField('announcement', 'linkText').isOverridden && (
                    <button
                      type="button"
                      onClick={() => handleClearOverride('announcement', 'linkText')}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={announcement.linkText || ''}
                  onChange={(e) => handleFieldChange('announcement', 'linkText', e.target.value)}
                  placeholder="e.g. Learn More or Listen Now"
                  className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                    !isScopeGlobal && getEffectiveField('announcement', 'linkText').isOverridden
                      ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-neutral-700 focus:border-amber-500/60'
                  }`}
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <label>Destination Link URL</label>
                  {!isScopeGlobal && getEffectiveField('announcement', 'linkUrl').isOverridden && (
                    <button
                      type="button"
                      onClick={() => handleClearOverride('announcement', 'linkUrl')}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={announcement.linkUrl || ''}
                  onChange={(e) => handleFieldChange('announcement', 'linkUrl', e.target.value)}
                  placeholder="/station/barber or https://..."
                  className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                    !isScopeGlobal && getEffectiveField('announcement', 'linkUrl').isOverridden
                      ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-neutral-700 focus:border-amber-500/60'
                  }`}
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. PROMOTIONAL HERO BANNER */}
        {activeTab === 'banner' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-800 gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <span>Promotional Hero Banner</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Renders as an immersive featured card directly at the top of the homepage feed.
                </p>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer bg-neutral-950/80 border border-neutral-800 px-3.5 py-2 rounded-xl">
                <span className="text-xs font-semibold text-neutral-300">Live Status:</span>
                <input
                  type="checkbox"
                  checked={Boolean(banner.enabled)}
                  onChange={(e) => handleFieldChange('banner', 'enabled', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <span className={`text-xs font-bold ${banner.enabled ? 'text-emerald-400' : 'text-neutral-500'}`}>
                  {banner.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            {/* Visual Preview */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  Live Hero Banner Preview
                </span>
                <span className={`px-2 py-0.5 rounded-full ${banner.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-800 text-neutral-500'}`}>
                  {banner.enabled ? 'Live on Home' : 'Hidden'}
                </span>
              </div>

              <div 
                className="relative rounded-xl p-5 overflow-hidden border border-neutral-700 bg-neutral-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl"
                style={{
                  backgroundImage: banner.imageUrl ? `linear-gradient(to right, rgba(0,0,0,0.85), rgba(0,0,0,0.6)), url(${banner.imageUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                    FEATURED SPOTLIGHT
                  </div>
                  <h4 className="text-base sm:text-lg font-black text-white truncate">{banner.title || 'Spotlight Header Title'}</h4>
                  <p className="text-xs text-neutral-300 max-w-xl line-clamp-2">{banner.subtitle || 'Promo subtitle and description will render right here on the home feed.'}</p>
                </div>
                {banner.actionText && (
                  <span className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 shrink-0">
                    {banner.actionText}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <label>Banner Heading</label>
                  {!isScopeGlobal && getEffectiveField('banner', 'title').isOverridden && (
                    <button
                      type="button"
                      onClick={() => handleClearOverride('banner', 'title')}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={banner.title || ''}
                  onChange={(e) => handleFieldChange('banner', 'title', e.target.value)}
                  placeholder="Nostalgic Radio Stations Now Live"
                  className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                    !isScopeGlobal && getEffectiveField('banner', 'title').isOverridden
                      ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-neutral-700 focus:border-amber-500/60'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <label>Action Button Text</label>
                  {!isScopeGlobal && getEffectiveField('banner', 'actionText').isOverridden && (
                    <button
                      type="button"
                      onClick={() => handleClearOverride('banner', 'actionText')}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={banner.actionText || ''}
                  onChange={(e) => handleFieldChange('banner', 'actionText', e.target.value)}
                  placeholder="Tune In Now"
                  className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                    !isScopeGlobal && getEffectiveField('banner', 'actionText').isOverridden
                      ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-neutral-700 focus:border-amber-500/60'
                  }`}
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <label>Subtitle & Details</label>
                  {!isScopeGlobal && getEffectiveField('banner', 'subtitle').isOverridden && (
                    <button
                      type="button"
                      onClick={() => handleClearOverride('banner', 'subtitle')}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={banner.subtitle || ''}
                  onChange={(e) => handleFieldChange('banner', 'subtitle', e.target.value)}
                  placeholder="Listen to 90s Saloon FM, Highway Truck Melodies, and Theka Session nonstop."
                  className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                    !isScopeGlobal && getEffectiveField('banner', 'subtitle').isOverridden
                      ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-neutral-700 focus:border-amber-500/60'
                  }`}
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <label>Background Image URL</label>
                  {!isScopeGlobal && getEffectiveField('banner', 'imageUrl').isOverridden && (
                    <button
                      type="button"
                      onClick={() => handleClearOverride('banner', 'imageUrl')}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={banner.imageUrl || ''}
                    onChange={(e) => handleFieldChange('banner', 'imageUrl', e.target.value)}
                    placeholder="https://images.unsplash.com/... or choose from Media Library"
                    className={`flex-1 bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                      !isScopeGlobal && getEffectiveField('banner', 'imageUrl').isOverridden
                        ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                        : 'border-neutral-700 focus:border-amber-500/60'
                    }`}
                  />
                  {onOpenMediaPicker && (
                    <button
                      type="button"
                      onClick={() => onOpenMediaPicker((url) => handleFieldChange('banner', 'imageUrl', url))}
                      className="px-3.5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer shrink-0"
                    >
                      Browse Media
                    </button>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <label>Action Destination URL</label>
                  {!isScopeGlobal && getEffectiveField('banner', 'actionUrl').isOverridden && (
                    <button
                      type="button"
                      onClick={() => handleClearOverride('banner', 'actionUrl')}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={banner.actionUrl || ''}
                  onChange={(e) => handleFieldChange('banner', 'actionUrl', e.target.value)}
                  placeholder="/station/barber or /discover"
                  className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                    !isScopeGlobal && getEffectiveField('banner', 'actionUrl').isOverridden
                      ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-neutral-700 focus:border-amber-500/60'
                  }`}
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. MAINTENANCE MODE */}
        {activeTab === 'maintenance' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-800 gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Platform Maintenance Mode</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  When enabled, all regular users are immediately presented with a maintenance screen. Administrators retain bypass access.
                </p>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer bg-neutral-950/80 border border-rose-500/30 px-3.5 py-2 rounded-xl">
                <span className="text-xs font-semibold text-rose-300">Killswitch:</span>
                <input
                  type="checkbox"
                  checked={Boolean(maintenance.enabled)}
                  onChange={(e) => handleFieldChange('maintenance', 'enabled', e.target.checked)}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
                <span className={`text-xs font-bold ${maintenance.enabled ? 'text-rose-400' : 'text-neutral-500'}`}>
                  {maintenance.enabled ? 'ACTIVE (SITE LOCKED)' : 'Disabled'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <label>Maintenance Modal Title</label>
                  {!isScopeGlobal && getEffectiveField('maintenance', 'title').isOverridden && (
                    <button
                      type="button"
                      onClick={() => handleClearOverride('maintenance', 'title')}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={maintenance.title || ''}
                  onChange={(e) => handleFieldChange('maintenance', 'title', e.target.value)}
                  placeholder="Loopra Under Scheduled Maintenance"
                  className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                    !isScopeGlobal && getEffectiveField('maintenance', 'title').isOverridden
                      ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-neutral-700 focus:border-rose-500/60'
                  }`}
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <label>Public Maintenance Message</label>
                  {!isScopeGlobal && getEffectiveField('maintenance', 'message').isOverridden && (
                    <button
                      type="button"
                      onClick={() => handleClearOverride('maintenance', 'message')}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={maintenance.message || ''}
                  onChange={(e) => handleFieldChange('maintenance', 'message', e.target.value)}
                  placeholder="We are currently upgrading our streaming nodes. Streaming will resume shortly."
                  className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                    !isScopeGlobal && getEffectiveField('maintenance', 'message').isOverridden
                      ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-neutral-700 focus:border-rose-500/60'
                  }`}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
