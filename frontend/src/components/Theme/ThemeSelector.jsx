import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  Laptop 
} from 'lucide-react';
import { NAMED_THEMES, DEFAULT_THEME_ID, DEFAULT_APPEARANCE_MODE } from '../../constants/themePresets';
import { applyThemeToDom } from '../../services/cmsClient';

export default function ThemeSelector({
  currentThemeId,
  currentAppearanceMode,
  onThemeSelect,
  isAdmin = false
}) {
  const [activeId] = useState(() => {
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

  // Keep state in sync if prop changes
  useEffect(() => {
    if (currentAppearanceMode) {
      setAppearanceMode(currentAppearanceMode);
    }
  }, [currentAppearanceMode]);

  // Watch for system color scheme changes if mode is 'system'
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (appearanceMode === 'system') {
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

    if (onThemeSelect) {
      const currentTheme = NAMED_THEMES.find(t => t.id === activeId) || NAMED_THEMES[0];
      onThemeSelect({ ...currentTheme, appearanceMode: mode });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
          Appearance Mode
        </h4>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          Switch between Light, Dark, or follow your System settings.
        </p>
      </div>

      {/* Theme Mode Selector Tabs (Light, Dark, System) */}
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
  );
}
