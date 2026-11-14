import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  Check, 
  Sun, 
  Moon, 
  Laptop, 
  Sparkles 
} from 'lucide-react';
import { NAMED_THEMES, DEFAULT_THEME_ID, DEFAULT_APPEARANCE_MODE } from '../../constants/themePresets';
import { applyThemeToDom, getSystemPreference } from '../../services/cmsClient';

export default function ThemeSelector({
  currentThemeId,
  currentAppearanceMode,
  onThemeSelect,
  isAdmin = false
}) {
  const [activeId, setActiveId] = useState(() => {
    if (currentThemeId) return currentThemeId;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('loopra_selected_theme_id') || DEFAULT_THEME_ID;
    }
    return DEFAULT_THEME_ID;
  });

  const [appearanceMode, setAppearanceMode] = useState(() => {
    if (currentAppearanceMode) return currentAppearanceMode;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('loopra_appearance_mode') || DEFAULT_APPEARANCE_MODE;
    }
    return DEFAULT_APPEARANCE_MODE;
  });

  // Watch for system color scheme changes if mode is 'system'
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (appearanceMode === 'system') {
        const matched = NAMED_THEMES.find(t => t.id === activeId) || NAMED_THEMES[0];
        applyThemeToDom({
          namedThemeId: activeId,
          appearanceMode: 'system'
        }, true);
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [appearanceMode, activeId]);

  const handleModeChange = (mode) => {
    setAppearanceMode(mode);
    applyThemeToDom({
      namedThemeId: activeId,
      appearanceMode: mode
    }, true);
  };

  const handleApply = (theme) => {
    setActiveId(theme.id);
    applyThemeToDom({
      namedThemeId: theme.id,
      appearanceMode
    }, true);

    if (onThemeSelect) {
      onThemeSelect(theme);
    }

    // Persist to user profile if user is logged in
    try {
      const token = localStorage.getItem('token');
      if (token) {
        fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ preferredTheme: theme.id })
        }).catch(() => {});
      }
    } catch (_) {}
  };

  const resolvedActiveMode = appearanceMode === 'system' ? getSystemPreference() : appearanceMode;

  return (
    <div className="space-y-5">
      {/* 1. Header & Appearance Mode Selector (Light, Dark, System) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-amber-400" />
            Global Aesthetic Themes & Appearance
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            12 total theme-mode variations. Switch instantly between genuine Light & Dark surfaces.
          </p>
        </div>

        {/* Prominent Appearance Mode Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-black/40 border border-white/10 rounded-2xl shrink-0 self-start sm:self-auto">
          {[
            { id: 'light', label: 'Light', icon: Sun },
            { id: 'dark', label: 'Dark', icon: Moon },
            { id: 'system', label: 'System', icon: Laptop }
          ].map((mode) => {
            const Icon = mode.icon;
            const isSelected = appearanceMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleModeChange(mode.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-neutral-950 font-bold shadow-md shadow-amber-400/20'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Grid of 6 Named Themes with Dual Light & Dark Previews */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {NAMED_THEMES.map((t) => {
          const isSelected = activeId === t.id;
          const lightTokens = t.light;
          const darkTokens = t.dark;
          const activeTokens = resolvedActiveMode === 'light' ? lightTokens : darkTokens;

          return (
            <div
              key={t.id}
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                isSelected
                ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
                : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white truncate">{t.name}</span>
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-400 text-neutral-950 flex items-center gap-1 uppercase tracking-wider">
                      <Check className="w-3 h-3 stroke-[3]" /> Selected
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                  {t.description}
                </p>

                {/* Original Source Palette Bar */}
                <div className="mb-3">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block mb-1">
                    Palette Swatch
                  </span>
                  <div className="flex items-center h-3.5 rounded-lg overflow-hidden border border-white/15 shadow-inner">
                    {t.sourcePalette.map((color, idx) => (
                      <div
                        key={idx}
                        className="h-full flex-1"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                {/* Dual Mode UI Previews: Light Mode & Dark Mode Side-by-Side */}
                <div className="space-y-1.5 mb-3">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block">
                    UI Preview (Light vs Dark)
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Light Mode Preview Card */}
                    <div
                      className={`p-2 rounded-xl border flex flex-col justify-between text-left transition ${
                        resolvedActiveMode === 'light' && isSelected ? 'ring-2 ring-amber-400' : ''
                      }`}
                      style={{
                        backgroundColor: lightTokens.bgPrimary,
                        borderColor: lightTokens.borderColor
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold" style={{ color: lightTokens.primaryAccent }}>Light</span>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lightTokens.buttonBg }} />
                      </div>
                      <div className="p-1 rounded mb-1" style={{ backgroundColor: lightTokens.bgCard }}>
                        <div className="h-1.5 w-10 rounded mb-0.5" style={{ backgroundColor: lightTokens.primaryText }} />
                        <div className="h-1 w-7 rounded" style={{ backgroundColor: lightTokens.mutedText }} />
                      </div>
                      <div className="h-2 rounded flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: lightTokens.buttonBg, color: lightTokens.buttonText }}>
                        Btn
                      </div>
                    </div>

                    {/* Dark Mode Preview Card */}
                    <div
                      className={`p-2 rounded-xl border flex flex-col justify-between text-left transition ${
                        resolvedActiveMode === 'dark' && isSelected ? 'ring-2 ring-amber-400' : ''
                      }`}
                      style={{
                        backgroundColor: darkTokens.bgPrimary,
                        borderColor: darkTokens.borderColor
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold" style={{ color: darkTokens.primaryAccent }}>Dark</span>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: darkTokens.buttonBg }} />
                      </div>
                      <div className="p-1 rounded mb-1" style={{ backgroundColor: darkTokens.bgCard }}>
                        <div className="h-1.5 w-10 rounded mb-0.5" style={{ backgroundColor: darkTokens.primaryText }} />
                        <div className="h-1 w-7 rounded" style={{ backgroundColor: darkTokens.mutedText }} />
                      </div>
                      <div className="h-2 rounded flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: darkTokens.buttonBg, color: darkTokens.buttonText }}>
                        Btn
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Apply Theme Action */}
              <button
                type="button"
                onClick={() => handleApply(t)}
                className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                  isSelected
                  ? 'bg-amber-400 text-neutral-950 shadow-md shadow-amber-400/20'
                  : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                }`}
              >
                {isSelected ? `Active in ${resolvedActiveMode.toUpperCase()}` : 'Apply Theme'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
