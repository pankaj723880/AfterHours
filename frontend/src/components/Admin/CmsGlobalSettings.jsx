import React, { useState, useRef, useEffect } from 'react';
import { 
  Globe, 
  Palette, 
  Bell, 
  Image as ImageIcon, 
  AlertTriangle, 
  Search, 
  FileText, 
  Check, 
  Save, 
  Sparkles,
  Layers,
  Sliders,
  ExternalLink,
  Plus,
  Trash2,
  Edit3,
  ChevronUp,
  ChevronDown,
  UploadCloud,
  Eye,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { normalizeCmsConfig, hexToRgb } from '../../services/cmsClient';
import { USE_V2_CMS_PAGES } from '../../constants/featureFlags';
import ThemeSelector from '../Theme/ThemeSelector';
import CmsRelaxManager from './CmsRelaxManager';

function ThemeLivePreview({ theme, branding }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  const accentColor = theme.accentColor || '#f59e0b';
  const rgb = hexToRgb(accentColor);
  const showMesh = theme.meshGradient !== false;
  const showParticles = theme.particles !== false;
  const isGlass = theme.glassmorphism !== false;

  useEffect(() => {
    if (!showParticles) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 300);
    let height = (canvas.height = 180);

    const particles = Array.from({ length: 18 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.8 + 0.6,
      speedY: Math.random() * 0.4 + 0.15,
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.6 + 0.3,
      pulse: Math.random() * Math.PI
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.y -= p.speedY;
        p.x += p.speedX;
        p.pulse += 0.04;
        if (p.y < -5) {
          p.y = height + 5;
          p.x = Math.random() * width;
        }
        const alpha = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [showParticles, rgb.r, rgb.g, rgb.b]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 p-5 mt-4 select-none">
      {/* 3D Mesh Halos */}
      {showMesh && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div 
            className="absolute -top-16 -left-10 w-64 h-64 rounded-full blur-3xl transition-all duration-500"
            style={{ background: `radial-gradient(circle, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25) 0%, transparent 70%)` }}
          />
          <div 
            className="absolute -bottom-16 -right-10 w-64 h-64 rounded-full blur-3xl transition-all duration-500"
            style={{ background: `radial-gradient(circle, rgba(${Math.min(rgb.r + 30, 255)}, ${Math.max(rgb.g - 20, 0)}, ${rgb.b}, 0.2) 0%, transparent 70%)` }}
          />
        </div>
      )}

      {/* Particle Stars Canvas */}
      {showParticles && (
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full pointer-events-none" 
        />
      )}

      {/* Foreground Content */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span 
              className="w-2.5 h-2.5 rounded-full shadow-md animate-pulse" 
              style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }} 
            />
            <span className="text-xs font-extrabold text-white tracking-wide uppercase">
              {branding?.siteName ? `${branding.siteName} Live Preview` : 'Live Preview'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span 
              className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
              style={{
                borderColor: `${accentColor}50`,
                backgroundColor: `${accentColor}18`,
                color: accentColor
              }}
            >
              Active Mode: {theme.themeMode || 'dark'}
            </span>
          </div>
        </div>

        {/* Mock Components Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: Sample Playing Track & Accent Button */}
          <div 
            className={`p-3.5 rounded-xl border transition-all duration-300 ${
              isGlass 
                ? 'bg-neutral-900/60 backdrop-blur-xl border-white/10 shadow-lg' 
                : 'bg-neutral-900 border-neutral-800 shadow-none'
            }`}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs shadow-md shrink-0 transition-transform hover:scale-105"
                style={{
                  backgroundColor: accentColor,
                  color: '#09090b',
                  boxShadow: `0 4px 14px ${accentColor}50`
                }}
              >
                ▶
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">90s Nostalgia Radio</p>
                <p className="text-[10px] truncate font-medium" style={{ color: accentColor }}>Playing Stream • Saloon FM</p>
              </div>
            </div>

            {/* Simulated Scrubber */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[9px] font-mono text-neutral-400">1:45</span>
              <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300" 
                  style={{ width: '45%', backgroundColor: accentColor }} 
                />
              </div>
              <span className="text-[9px] font-mono text-neutral-400">4:20</span>
            </div>
          </div>

          {/* Card 2: Interactive Controls & Feature Toggles Status */}
          <div 
            className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all duration-300 ${
              isGlass 
                ? 'bg-neutral-900/60 backdrop-blur-xl border-white/10 shadow-lg' 
                : 'bg-neutral-900 border-neutral-800 shadow-none'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-neutral-300">Glassmorphism:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isGlass ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-800 text-neutral-400'}`}>
                {isGlass ? 'Enabled (24px Blur)' : 'Disabled'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-[11px] font-medium text-neutral-300">3D Dynamic Mesh:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${showMesh ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-800 text-neutral-400'}`}>
                {showMesh ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-[11px] font-medium text-neutral-300">Particle Stars:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${showParticles ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-800 text-neutral-400'}`}>
                {showParticles ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CmsGlobalSettings({ 
  draft, 
  onUpdateDraft, 
  onOpenMediaPicker, 
  showToast,
  onSaveDraft,
  onPublishLive,
  isSavingDraft,
  isPublishingLive
}) {
  const [activeTab, setActiveTab] = useState('branding');

  const safeDraft = normalizeCmsConfig(draft);
  const branding = safeDraft.branding;
  const theme = safeDraft.theme;
  const announcement = safeDraft.announcement;
  const banner = safeDraft.banner;
  const maintenance = safeDraft.maintenance;
  const searchPage = safeDraft.searchPage;
  const footer = safeDraft.footer;
  const infoPages = footer.infoPages || [];

  // Accordion state for Footer Policies in V2
  const [expandedPolicyIndex, setExpandedPolicyIndex] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoSlug, setInfoSlug] = useState('');
  const [infoContent, setInfoContent] = useState('');

  const openInfoModal = (idx = null) => {
    if (idx !== null && infoPages[idx]) {
      setEditingIndex(idx);
      setInfoTitle(infoPages[idx].title || '');
      setInfoSlug(infoPages[idx].slug || '');
      setInfoContent(infoPages[idx].content || '');
    } else {
      setEditingIndex(null);
      setInfoTitle('');
      setInfoSlug('');
      setInfoContent('');
    }
    setIsInfoModalOpen(true);
  };

  const handleSaveInfoPage = (e) => {
    e.preventDefault();
    if (!infoTitle.trim()) {
      showToast?.('Page title is required', 'error');
      return;
    }

    const cleanSlug = (infoSlug || infoTitle)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const newPage = {
      title: infoTitle.trim(),
      slug: cleanSlug,
      content: infoContent.trim()
    };

    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const currentPages = [...(base.footer?.infoPages || [])];
      if (editingIndex !== null) {
        currentPages[editingIndex] = newPage;
      } else {
        currentPages.push(newPage);
      }
      return {
        ...base,
        footer: {
          ...(base.footer || {}),
          infoPages: currentPages
        }
      };
    });

    setIsInfoModalOpen(false);
    showToast?.(editingIndex !== null ? 'Information page updated' : 'Information page created', 'success');
  };

  const handleDeleteInfoPage = (idx) => {
    if (!window.confirm(`Delete page "${infoPages[idx]?.title || 'Untitled'}"?`)) return;
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const currentPages = (base.footer?.infoPages || []).filter((_, i) => i !== idx);
      return {
        ...base,
        footer: {
          ...(base.footer || {}),
          infoPages: currentPages
        }
      };
    });
    showToast?.('Page deleted from footer draft', 'success');
  };

  const handleMoveInfoPage = (idx, direction) => {
    const target = idx + direction;
    if (target < 0 || target >= infoPages.length) return;
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const currentPages = [...(base.footer?.infoPages || [])];
      const temp = currentPages[idx];
      currentPages[idx] = currentPages[target];
      currentPages[target] = temp;
      return {
        ...base,
        footer: {
          ...(base.footer || {}),
          infoPages: currentPages
        }
      };
    });
  };

  const handleFieldChange = (section, field, value) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      return {
        ...base,
        [section]: {
          ...(base[section] || {}),
          [field]: value
        }
      };
    });
  };

  const tabs = [
    { id: 'branding', label: 'Branding & Identity', icon: Globe },
    { id: 'theme', label: 'Theme & Appearance', icon: Palette },
    { id: 'relax', label: 'Relax Mode Sounds', icon: Sparkles },
    { id: 'announcement', label: 'Announcements', icon: Bell },
    { id: 'banner', label: 'Promo Banner', icon: ImageIcon },
    { id: 'maintenance', label: 'Maintenance Mode', icon: AlertTriangle },
    { id: 'search', label: 'Search Page', icon: Search },
    { id: 'footer', label: 'Footer & Policies', icon: FileText }
  ];

  const PRESET_COLORS = [
    { name: 'Amber Glow', color: '#f59e0b' },
    { name: 'Emerald Forest', color: '#10b981' },
    { name: 'Cyan Wave', color: '#06b6d4' },
    { name: 'Electric Violet', color: '#8b5cf6' },
    { name: 'Crimson Rose', color: '#f43f5e' },
    { name: 'Sunset Orange', color: '#f97316' }
  ];

  return (
    <div className="space-y-6">
      {/* CMS Sub-Navigation Header (V2: Horizontal scrollable pill strip with amber neon active badge) */}
      {USE_V2_CMS_PAGES ? (
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 px-1 border-b border-white/10">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-500/10 font-medium'
                    : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-zinc-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-neutral-800 text-amber-400 border border-amber-500/30 shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-neutral-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 1. BRANDING & IDENTITY */}
      {activeTab === 'branding' && (
        <div className={USE_V2_CMS_PAGES
          ? "bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 backdrop-blur-md"
          : "bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 md:p-6 space-y-6 backdrop-blur-md"
        }>
          <div className="border-b border-white/10 pb-3 sm:pb-4">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" />
              Website Branding & Identity
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">
              Configure global website name, brand logo, tagline, and meta description displayed across Loopra.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5">
            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Website Name</label>
              <input
                type="text"
                value={branding.siteName || ''}
                onChange={(e) => handleFieldChange('branding', 'siteName', e.target.value)}
                placeholder="Leave blank or enter name"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">Displayed in header, browser tab title, and copyright.</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Brand Tagline</label>
              <input
                type="text"
                value={branding.tagline || ''}
                onChange={(e) => handleFieldChange('branding', 'tagline', e.target.value)}
                placeholder="Stream. Discover. Relive. Repeat."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">Subtitle shown next to logo badge.</span>
            </div>

            {/* Brand Logo URL with inline thumbnail preview and compound picker */}
            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Brand Logo URL</label>
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/30 transition-all">
                <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo preview" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </div>
                <input
                  type="text"
                  value={branding.logoUrl || ''}
                  onChange={(e) => handleFieldChange('branding', 'logoUrl', e.target.value)}
                  placeholder="https://... or select asset"
                  className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
                />
                {onOpenMediaPicker && (
                  <button
                    type="button"
                    onClick={() => onOpenMediaPicker((url) => handleFieldChange('branding', 'logoUrl', url))}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium rounded-lg transition cursor-pointer shrink-0"
                  >
                    Select
                  </button>
                )}
              </div>
            </div>

            {/* Favicon URL with inline thumbnail preview and compound picker */}
            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Favicon URL</label>
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/30 transition-all">
                <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  {branding.faviconUrl ? (
                    <img src={branding.faviconUrl} alt="Favicon preview" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </div>
                <input
                  type="text"
                  value={branding.faviconUrl || ''}
                  onChange={(e) => handleFieldChange('branding', 'faviconUrl', e.target.value)}
                  placeholder="https://... or select asset"
                  className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
                />
                {onOpenMediaPicker && (
                  <button
                    type="button"
                    onClick={() => onOpenMediaPicker((url) => handleFieldChange('branding', 'faviconUrl', url))}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium rounded-lg transition cursor-pointer shrink-0"
                  >
                    Select
                  </button>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Meta Description & Bio</label>
              <textarea
                rows={3}
                value={branding.description || ''}
                onChange={(e) => handleFieldChange('branding', 'description', e.target.value)}
                placeholder="Endless retro Hindi, Bollywood nostalgia, and high-energy desi soundtracks..."
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. THEME & APPEARANCE */}
      {activeTab === 'theme' && (
        <div className={USE_V2_CMS_PAGES
          ? "bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 backdrop-blur-md"
          : "bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 md:p-6 space-y-6 backdrop-blur-md"
        }>
          <div className="border-b border-white/10 pb-3 sm:pb-4">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-400" />
              Theme & Aesthetic Settings
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">
              Customize the website visual identity, accent hues, 3D background effects, and glassmorphism levels.
            </p>
          </div>

          <div className="space-y-4 sm:space-y-5">
            {/* 6 Named Aesthetic Themes System */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
              <ThemeSelector
                currentThemeId={theme.namedThemeId}
                onThemeSelect={(t) => {
                  if (!t) return;
                  const activeTokens = t.dark || t.light || t.colors || {};
                  const primaryAccent = activeTokens.primaryAccent || t.colors?.primaryAccent || t.sourcePalette?.[0] || '#f59e0b';
                  handleFieldChange('theme', 'namedThemeId', t.id);
                  handleFieldChange('theme', 'accentColor', primaryAccent);
                  handleFieldChange('theme', 'colors', activeTokens);
                }}
                isAdmin={true}
              />
            </div>

            {/* V2 Theme Preset Cards */}
            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-2">Preset Theme Styles</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { name: 'Amber Neon', color: '#f59e0b', mode: 'dark', desc: 'Warm retro glow' },
                  { name: 'Cyber Lofi', color: '#8b5cf6', mode: 'neon', desc: 'Violet drift chill' },
                  { name: 'Emerald Deep', color: '#10b981', mode: 'midnight', desc: 'Midnight organic' },
                  { name: 'Cyan Wave', color: '#06b6d4', mode: 'dark', desc: 'Crisp synth vibes' }
                ].map(preset => {
                  const isCur = (theme.accentColor || '#f59e0b').toLowerCase() === preset.color.toLowerCase();
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        handleFieldChange('theme', 'accentColor', preset.color);
                        handleFieldChange('theme', 'themeMode', preset.mode);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        isCur
                          ? 'bg-amber-500/15 border-amber-500/50 shadow-md shadow-amber-500/10'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: preset.color }} />
                        {isCur && <span className="text-[9px] font-bold text-amber-400 uppercase">Active</span>}
                      </div>
                      <span className="text-xs font-bold text-white truncate">{preset.name}</span>
                      <span className="text-[10px] text-zinc-400 truncate">{preset.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-2">Accent Highlight Color Swatches</label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_COLORS.map(c => {
                  const isSelected = (theme.accentColor || '#f59e0b').toLowerCase() === c.color.toLowerCase();
                  return (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => handleFieldChange('theme', 'accentColor', c.color)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/20 text-white shadow-sm'
                          : 'border-white/10 bg-black/40 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: c.color }} />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
                <div className="flex items-center gap-2 ml-1 bg-black/40 border border-white/10 px-2 py-1 rounded-xl">
                  <input
                    type="color"
                    value={theme.accentColor || '#f59e0b'}
                    onChange={(e) => handleFieldChange('theme', 'accentColor', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-xs font-mono text-zinc-300">{theme.accentColor || '#f59e0b'}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-2">Base Theme Mode</label>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'dark', label: 'Dark Charcoal' },
                  { id: 'midnight', label: 'Midnight Blue' },
                  { id: 'neon', label: 'Neon Cyber' }
                ].map(mode => {
                  const isSelected = (theme.themeMode || 'dark') === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleFieldChange('theme', 'themeMode', mode.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 shadow-sm'
                          : 'border-white/10 bg-black/40 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 pt-1">
              <div className="p-3 sm:p-4 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Glassmorphism Blur</h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Frosted glass backdrop</p>
                </div>
                <input
                  type="checkbox"
                  checked={theme.glassmorphism !== false}
                  onChange={(e) => handleFieldChange('theme', 'glassmorphism', e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer accent-amber-500"
                />
              </div>

              <div className="p-3 sm:p-4 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">3D Dynamic Mesh</h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Animated mesh gradients</p>
                </div>
                <input
                  type="checkbox"
                  checked={theme.meshGradient !== false}
                  onChange={(e) => handleFieldChange('theme', 'meshGradient', e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer accent-amber-500"
                />
              </div>

              <div className="p-3 sm:p-4 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Particle Stars</h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Ambient floating dust</p>
                </div>
                <input
                  type="checkbox"
                  checked={theme.particles !== false}
                  onChange={(e) => handleFieldChange('theme', 'particles', e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer accent-amber-500"
                />
              </div>
            </div>

            {/* Live Interactive Theme Preview */}
            <ThemeLivePreview theme={theme} branding={branding} />
          </div>
        </div>
      )}

      {/* 2b. RELAX MODE SOUNDS MANAGEMENT */}
      {activeTab === 'relax' && (
        <CmsRelaxManager />
      )}

      {/* 3. SITE-WIDE ANNOUNCEMENT */}
      {activeTab === 'announcement' && (
        <div className={USE_V2_CMS_PAGES
          ? "bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 backdrop-blur-md"
          : "bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 md:p-6 space-y-5 backdrop-blur-md"
        }>
          <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                Site-Wide Announcement Bar
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">
                Display a dynamic notification bar across the top of the website for all listeners.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-black/40 px-3.5 py-1.5 rounded-xl border border-white/10">
              <span className="text-xs font-semibold text-zinc-300">Enabled</span>
              <input
                type="checkbox"
                checked={Boolean(announcement.enabled)}
                onChange={(e) => handleFieldChange('announcement', 'enabled', e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* V2 Live Announcement Banner Preview Card */}
          {USE_V2_CMS_PAGES && (
            <div className="rounded-xl border border-white/10 bg-black/60 p-3 relative overflow-hidden">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  Live Banner Preview
                </span>
                <span className={`px-2 py-0.5 rounded-full ${announcement.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}`}>
                  {announcement.enabled ? 'Active on Site' : 'Currently Hidden'}
                </span>
              </div>
              <div className={`p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs ${
                announcement.type === 'promo' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                announcement.type === 'warning' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                announcement.type === 'alert' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse shrink-0" />
                  <span className="truncate font-medium">{announcement.message || 'No announcement text set yet.'}</span>
                </div>
                {announcement.linkText && (
                  <span className="px-2 py-0.5 rounded-md bg-white/10 font-bold shrink-0 text-[11px] underline">
                    {announcement.linkText}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Announcement Message</label>
              <input
                type="text"
                value={announcement.message || ''}
                onChange={(e) => handleFieldChange('announcement', 'message', e.target.value)}
                placeholder="Welcome to Loopra! Enjoy uninterrupted retro Bollywood and curated hits."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Notification Style</label>
              <select
                value={announcement.type || 'info'}
                onChange={(e) => handleFieldChange('announcement', 'type', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none cursor-pointer"
              >
                <option value="info">Info (Emerald / Cyan glow)</option>
                <option value="promo">Promo (Amber / Golden glow)</option>
                <option value="warning">Warning (Orange banner)</option>
                <option value="alert">Alert (Crimson notice)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Action Button Text (Optional)</label>
              <input
                type="text"
                value={announcement.linkText || ''}
                onChange={(e) => handleFieldChange('announcement', 'linkText', e.target.value)}
                placeholder="Learn More"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Action Link URL</label>
              <input
                type="text"
                value={announcement.linkUrl || ''}
                onChange={(e) => handleFieldChange('announcement', 'linkUrl', e.target.value)}
                placeholder="https://... or /station/barber"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. PROMOTIONAL HERO BANNER */}
      {activeTab === 'banner' && (
        <div className={USE_V2_CMS_PAGES
          ? "bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 backdrop-blur-md"
          : "bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 md:p-6 space-y-5 backdrop-blur-md"
        }>
          <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                Homepage Promotional Hero Banner
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">
                Spotlight new releases, curated stations, or festival specials at the top of the Home feed.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-black/40 px-3.5 py-1.5 rounded-xl border border-white/10">
              <span className="text-xs font-semibold text-zinc-300">Show Banner</span>
              <input
                type="checkbox"
                checked={Boolean(banner.enabled)}
                onChange={(e) => handleFieldChange('banner', 'enabled', e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* V2 Live Promo Banner Preview Card */}
          {USE_V2_CMS_PAGES && (
            <div className="rounded-xl border border-white/10 bg-black/60 p-3 relative overflow-hidden">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  Hero Banner Preview
                </span>
                <span className={`px-2 py-0.5 rounded-full ${banner.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}`}>
                  {banner.enabled ? 'Live on Home' : 'Hidden'}
                </span>
              </div>
              <div 
                className="relative rounded-xl p-4 overflow-hidden border border-white/15 bg-neutral-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg"
                style={{
                  backgroundImage: banner.imageUrl ? `linear-gradient(to right, rgba(0,0,0,0.85), rgba(0,0,0,0.6)), url(${banner.imageUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm sm:text-base font-extrabold text-white truncate">{banner.title || 'Spotlight Header Title'}</h4>
                  <p className="text-xs text-zinc-300 mt-0.5 line-clamp-2">{banner.subtitle || 'Promo subtitle and description will render right here on the home feed.'}</p>
                </div>
                {banner.actionText && (
                  <span className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 shrink-0">
                    {banner.actionText}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Banner Heading</label>
              <input
                type="text"
                value={banner.title || ''}
                onChange={(e) => handleFieldChange('banner', 'title', e.target.value)}
                placeholder="Nostalgic Radio Stations Now Live"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Button Action Text</label>
              <input
                type="text"
                value={banner.actionText || ''}
                onChange={(e) => handleFieldChange('banner', 'actionText', e.target.value)}
                placeholder="Tune In Now"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Subtitle / Description</label>
              <input
                type="text"
                value={banner.subtitle || ''}
                onChange={(e) => handleFieldChange('banner', 'subtitle', e.target.value)}
                placeholder="Listen to 90s Saloon FM, Highway Truck Melodies, and Theka Session nonstop."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>

            {/* Background Image URL with compound picker & preview */}
            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Background Image URL</label>
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/30 transition-all">
                <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  {banner.imageUrl ? (
                    <img src={banner.imageUrl} alt="Banner thumb" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </div>
                <input
                  type="text"
                  value={banner.imageUrl || ''}
                  onChange={(e) => handleFieldChange('banner', 'imageUrl', e.target.value)}
                  placeholder="https://... or select asset"
                  className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
                />
                {onOpenMediaPicker && (
                  <button
                    type="button"
                    onClick={() => onOpenMediaPicker((url) => handleFieldChange('banner', 'imageUrl', url))}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium rounded-lg transition cursor-pointer shrink-0"
                  >
                    Select
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Target Destination Link</label>
              <input
                type="text"
                value={banner.actionUrl || ''}
                onChange={(e) => handleFieldChange('banner', 'actionUrl', e.target.value)}
                placeholder="/station/barber or playlist slug"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. MAINTENANCE MODE */}
      {activeTab === 'maintenance' && (
        <div className={USE_V2_CMS_PAGES
          ? "bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 backdrop-blur-md"
          : "bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 md:p-6 space-y-5 backdrop-blur-md"
        }>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3 sm:pb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Emergency Maintenance Mode
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">
                Temporarily lock public access with an elegant maintenance screen while allowing admins to manage content.
              </p>
            </div>

            {/* V2 Aesthetic Card Master Switch */}
            <button
              type="button"
              onClick={() => {
                const next = !maintenance.enabled;
                if (next && !window.confirm('Enable Maintenance Mode? All regular listeners will see the maintenance gate once published.')) return;
                handleFieldChange('maintenance', 'enabled', next);
              }}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs font-bold transition cursor-pointer self-start sm:self-auto ${
                maintenance.enabled
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-md shadow-rose-500/20'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/10'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${maintenance.enabled ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`} />
              <span>{maintenance.enabled ? 'MAINTENANCE ACTIVE' : 'LIVE / OPERATIONAL'}</span>
            </button>
          </div>

          <div className="space-y-3.5 sm:space-y-4">
            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Maintenance Screen Title</label>
              <input
                type="text"
                value={maintenance.title || ''}
                onChange={(e) => handleFieldChange('maintenance', 'title', e.target.value)}
                placeholder="Scheduled Maintenance (or custom title)"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30 transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Public Announcement Message</label>
              <textarea
                rows={3}
                value={maintenance.message || ''}
                onChange={(e) => handleFieldChange('maintenance', 'message', e.target.value)}
                placeholder="We are currently tuning our audio nodes. Audio service will resume shortly."
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-zinc-100 focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30 transition-all outline-none resize-none"
              />
            </div>

            <div className="pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-white/10">
              <span className="text-[11px] text-zinc-400">
                {maintenance.enabled
                  ? '⚠️ Maintenance mode will be ACTIVE once published (non-admins blocked).'
                  : '✅ Maintenance mode will be INACTIVE once published (normal public access).'
                }
              </span>
              <button
                type="button"
                onClick={onPublishLive}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                  maintenance.enabled
                    ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20'
                    : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-lg shadow-amber-500/20'
                }`}
              >
                <span>Publish Maintenance Status Live</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SEARCH PAGE */}
      {activeTab === 'search' && (
        <div className={USE_V2_CMS_PAGES
          ? "bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 backdrop-blur-md"
          : "bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 md:p-6 space-y-5 backdrop-blur-md"
        }>
          <div className="border-b border-white/10 pb-3 sm:pb-4">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-400" />
              Search & Discovery Interface Content
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">
              Customize headings, input placeholder, and helper suggestions shown on the search page.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Search Heading</label>
              <input
                type="text"
                value={searchPage.heading || ''}
                onChange={(e) => handleFieldChange('searchPage', 'heading', e.target.value)}
                placeholder="Explore Global Music Catalog"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Search Input Placeholder</label>
              <input
                type="text"
                value={searchPage.placeholder || ''}
                onChange={(e) => handleFieldChange('searchPage', 'placeholder', e.target.value)}
                placeholder="Search songs, artists, nostalgic gems, or paste YouTube link..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Subheading Description</label>
              <input
                type="text"
                value={searchPage.subheading || ''}
                onChange={(e) => handleFieldChange('searchPage', 'subheading', e.target.value)}
                placeholder="Instant playback from millions of YouTube tracks, albums, and live sessions"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Helper Tips Text</label>
              <input
                type="text"
                value={searchPage.helperText || ''}
                onChange={(e) => handleFieldChange('searchPage', 'helperText', e.target.value)}
                placeholder="Tip: Try searching for '90s Kumar Sanu' or 'Desi Punjabi Dhol'"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 7. FOOTER & POLICIES */}
      {activeTab === 'footer' && (
        <div className={USE_V2_CMS_PAGES
          ? "bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 backdrop-blur-md"
          : "bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 md:p-6 space-y-5 backdrop-blur-md"
        }>
          <div className="border-b border-white/10 pb-3 sm:pb-4">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              Footer & Public Policies
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">
              Configure copyright notice, DMCA takedown contact email, and platform disclaimer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Copyright Notice</label>
              <input
                type="text"
                value={footer.copyright || ''}
                onChange={(e) => handleFieldChange('footer', 'copyright', e.target.value)}
                placeholder="© 2026 Loopra / AfterHours. All rights reserved."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Contact & Takedown Email</label>
              <input
                type="email"
                value={footer.contactEmail || ''}
                onChange={(e) => handleFieldChange('footer', 'contactEmail', e.target.value)}
                placeholder="pankajsss7238@gmail.com"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">Legal Disclaimer Text</label>
              <textarea
                rows={3}
                value={footer.disclaimerText || ''}
                onChange={(e) => handleFieldChange('footer', 'disclaimerText', e.target.value)}
                placeholder="Audio plays through YouTube embedded player API. Loopra does not host copyrighted files directly."
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-zinc-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none resize-none"
              />
            </div>
          </div>

          {/* Dynamic Information & Policy Pages (CRUD with V2 Collapsible Accordions) */}
          <div className="pt-4 sm:pt-6 border-t border-white/10 space-y-3.5 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Custom Information Pages ({infoPages.length})
                </h4>
                <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
                  Manage static content pages like Privacy Policy, Terms of Service, DMCA Guidelines, and About Us.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openInfoModal(null)}
                className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Info Page</span>
              </button>
            </div>

            {infoPages.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-white/10 text-center text-xs text-zinc-500 bg-black/20">
                No custom information pages defined yet. Click "Add Info Page" to create Terms, Privacy, or FAQ pages.
              </div>
            ) : (
              <div className="space-y-2">
                {infoPages.map((page, idx) => {
                  const isExpanded = expandedPolicyIndex === idx;
                  return (
                    <div
                      key={page.slug || idx}
                      className="rounded-xl bg-black/40 border border-white/10 overflow-hidden transition-all hover:border-white/20"
                    >
                      <div 
                        onClick={() => setExpandedPolicyIndex(prev => prev === idx ? null : idx)}
                        className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 cursor-pointer select-none"
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <ChevronRight className={`w-3.5 h-3.5 text-amber-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          <span className="text-xs font-bold text-white truncate">{page.title}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-amber-300 border border-white/10 shrink-0">
                            /{page.slug}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleMoveInfoPage(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-zinc-300 transition cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveInfoPage(idx, 1)}
                            disabled={idx === infoPages.length - 1}
                            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-zinc-300 transition cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openInfoModal(idx)}
                            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-amber-400 transition cursor-pointer ml-0.5"
                            title="Edit Page"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInfoPage(idx)}
                            className="p-1 rounded-lg bg-white/5 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                            title="Delete Page"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Accordion Content Preview */}
                      {isExpanded && (
                        <div className="px-3.5 pb-3.5 pt-1 text-xs text-zinc-300 border-t border-white/10 bg-black/30">
                          <p className="whitespace-pre-wrap font-sans text-xs text-zinc-300 leading-relaxed max-h-48 overflow-y-auto pr-1">
                            {page.content || 'No content written yet.'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info Page Edit / Create Modal */}
          {isInfoModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-neutral-900 border border-white/15 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    {editingIndex !== null ? 'Edit Information Page' : 'Create Information Page'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsInfoModalOpen(false)}
                    className="text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSaveInfoPage} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      Page Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Terms of Service or Privacy Policy"
                      value={infoTitle}
                      onChange={(e) => {
                        setInfoTitle(e.target.value);
                        if (editingIndex === null && !infoSlug) {
                          setInfoSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
                        }
                      }}
                      className="w-full bg-black/40 border border-white/10 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      URL Slug *
                    </label>
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus-within:border-amber-500">
                      <span className="text-zinc-500 font-mono mr-1">/</span>
                      <input
                        type="text"
                        required
                        placeholder="terms-of-service"
                        value={infoSlug}
                        onChange={(e) => setInfoSlug(e.target.value)}
                        className="w-full bg-transparent text-white outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      Page Content (Markdown / Text)
                    </label>
                    <textarea
                      rows={7}
                      placeholder="Enter policy details, disclaimers, or user guidance..."
                      value={infoContent}
                      onChange={(e) => setInfoContent(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 focus:border-amber-500 rounded-xl p-3 text-xs text-white outline-none resize-none font-sans"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsInfoModalOpen(false)}
                      className="flex-1 bg-white/10 hover:bg-white/15 text-zinc-300 font-semibold py-2 rounded-xl text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-2 rounded-xl text-xs transition shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      {editingIndex !== null ? 'Save Changes' : 'Create Page'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* V2 Sticky Frosted Save & Publish Action Bar docked above mini-player */}
      {(onSaveDraft || onPublishLive) && (
        USE_V2_CMS_PAGES ? (
          <div className="sticky bottom-20 z-20 backdrop-blur-md bg-black/80 border-t border-white/10 p-3 rounded-2xl flex items-center justify-between gap-2.5 shadow-2xl">
            <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="truncate">Draft: <strong className="text-white capitalize">{activeTab}</strong></span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onSaveDraft && (
                <button
                  type="button"
                  disabled={isSavingDraft}
                  onClick={onSaveDraft}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-semibold border border-white/15 transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
                </button>
              )}
              {onPublishLive && (
                <button
                  type="button"
                  disabled={isPublishingLive}
                  onClick={onPublishLive}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isPublishingLive ? 'Publishing...' : 'Publish Live'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-8 pt-5 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <div className="text-xs text-neutral-400">
              Editing <span className="font-semibold text-white capitalize">{activeTab}</span> in Draft
            </div>
            <div className="flex items-center gap-2">
              {onSaveDraft && (
                <button
                  type="button"
                  disabled={isSavingDraft}
                  onClick={onSaveDraft}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition cursor-pointer disabled:opacity-50"
                >
                  <span>{isSavingDraft ? 'Saving Draft...' : 'Save Draft'}</span>
                </button>
              )}
              {onPublishLive && (
                <button
                  type="button"
                  disabled={isPublishingLive}
                  onClick={onPublishLive}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  <span>{isPublishingLive ? 'Publishing...' : 'Publish Live'}</span>
                </button>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
