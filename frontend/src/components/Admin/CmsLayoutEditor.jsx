import React, { useState } from 'react';
import { 
  Layout, 
  Menu, 
  Sliders, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff, 
  Shield, 
  Volume2, 
  Play, 
  Activity,
  Sparkles
} from 'lucide-react';
import { normalizeCmsConfig } from '../../services/cmsClient';

export default function CmsLayoutEditor({ 
  draft, 
  onUpdateDraft, 
  showToast,
  onSaveDraft,
  onPublishLive,
  isSavingDraft,
  isPublishingLive
}) {
  const [activeTab, setActiveTab] = useState('sections');

  const safeDraft = normalizeCmsConfig(draft);
  const sections = safeDraft.sections || [];
  const navigation = safeDraft.navigation || [];
  const playerDefaults = safeDraft.playerDefaults || {};

  // Sections management
  const handleToggleSection = (index) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const updated = [...(base.sections || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], enabled: !updated[index].enabled };
      }
      return { ...base, sections: updated };
    });
  };

  const handleMoveSection = (index, direction) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const list = [...(base.sections || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= list.length) return base;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      const reordered = list.map((item, idx) => ({ ...item, order: idx + 1 }));
      return { ...base, sections: reordered };
    });
  };

  const handleSectionField = (index, field, value) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const updated = [...(base.sections || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...base, sections: updated };
    });
  };

  // Navigation management
  const handleToggleNav = (index) => {
    const item = navigation[index];
    if (item?.isCore && item.enabled) {
      if (showToast) showToast('Core navigation items cannot be disabled', 'error');
      return;
    }
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const updated = [...(base.navigation || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], enabled: !updated[index].enabled };
      }
      return { ...base, navigation: updated };
    });
  };

  const handleMoveNav = (index, direction) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const list = [...(base.navigation || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= list.length) return base;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      const reordered = list.map((item, idx) => ({ ...item, order: idx + 1 }));
      return { ...base, navigation: reordered };
    });
  };

  const handleNavField = (index, field, value) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const updated = [...(base.navigation || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...base, navigation: updated };
    });
  };

  // Player defaults
  const handlePlayerDefault = (field, value) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      return {
        ...base,
        playerDefaults: {
          ...((base && base.playerDefaults) || {}),
          [field]: value
        }
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setActiveTab('sections')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'sections'
              ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
          }`}
        >
          <Layout className="w-3.5 h-3.5" />
          <span>Homepage Sections ({sections.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('navigation')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'navigation'
              ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
          }`}
        >
          <Menu className="w-3.5 h-3.5" />
          <span>Sidebar & Navigation ({navigation.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('player')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'player'
              ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Player & Audio Defaults</span>
        </button>
      </div>

      {/* 1. HOMEPAGE SECTIONS */}
      {activeTab === 'sections' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
            <span>Reorder rows, edit headings, or toggle visibility on the live Home feed.</span>
            <span className="font-mono text-amber-400">{sections.filter(s => s.enabled).length} Active Rows</span>
          </div>

          <div className="space-y-3">
            {sections.map((section, idx) => (
              <div
                key={section.id || idx}
                className={`p-4 rounded-2xl border transition backdrop-blur-md ${
                  section.enabled
                    ? 'bg-neutral-900/70 border-neutral-800 hover:border-neutral-700'
                    : 'bg-neutral-950/60 border-neutral-900 opacity-60'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-neutral-800 text-neutral-300 font-mono text-xs flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{section.id}</span>
                        <span className="text-[10px] text-neutral-500 font-mono bg-neutral-950 px-2 py-0.5 rounded-full border border-neutral-800">
                          ID: {section.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ordering & Visibility Controls */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveSection(idx, -1)}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-300 transition"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sections.length - 1}
                      onClick={() => handleMoveSection(idx, 1)}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-300 transition"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSection(idx)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        section.enabled
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                      }`}
                    >
                      {section.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>{section.enabled ? 'Visible' : 'Hidden'}</span>
                    </button>
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-3 border-t border-neutral-800/60">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">Row Title</label>
                    <input
                      type="text"
                      value={section.title || ''}
                      onChange={(e) => handleSectionField(idx, 'title', e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/80 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={section.subtitle || ''}
                      onChange={(e) => handleSectionField(idx, 'subtitle', e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/80 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">Display Limit (Cards)</label>
                    <select
                      value={section.displayLimit || 12}
                      onChange={(e) => handleSectionField(idx, 'displayLimit', parseInt(e.target.value, 10))}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/80 transition cursor-pointer"
                    >
                      <option value="6">6 items</option>
                      <option value="12">12 items</option>
                      <option value="18">18 items</option>
                      <option value="24">24 items</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. SIDEBAR NAVIGATION */}
      {activeTab === 'navigation' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Core navigation items (Home, Search, Favourites, History) are protected from accidental removal.
            </span>
          </div>

          <div className="space-y-2.5">
            {navigation.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-4 ${
                  item.enabled
                    ? 'bg-neutral-900/70 border-neutral-800'
                    : 'bg-neutral-950/60 border-neutral-900 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded bg-neutral-800 text-neutral-400 font-mono text-[11px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{item.label}</span>
                      {item.isCore && (
                        <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          Core
                        </span>
                      )}
                      {item.badge && (
                        <span className="text-[9px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">Tab ID: {item.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.label || ''}
                      onChange={(e) => handleNavField(idx, 'label', e.target.value)}
                      placeholder="Label"
                      className="w-28 sm:w-36 bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <input
                      type="text"
                      value={item.badge || ''}
                      onChange={(e) => handleNavField(idx, 'badge', e.target.value)}
                      placeholder="Badge"
                      className="w-16 sm:w-20 bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveNav(idx, -1)}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-300 transition"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === navigation.length - 1}
                      onClick={() => handleMoveNav(idx, 1)}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-300 transition"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={item.isCore && item.enabled}
                      onClick={() => handleToggleNav(idx)}
                      className={`p-1.5 rounded-lg border transition ${
                        item.enabled
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                      }`}
                      title={item.enabled ? 'Disable' : 'Enable'}
                    >
                      {item.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. PLAYER DEFAULTS */}
      {activeTab === 'player' && (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 md:p-6 space-y-6 backdrop-blur-md">
          <div className="border-b border-neutral-800/80 pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Supported Player Preferences
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Configure initial volume levels, continuous autoplay behavior, and visual spectrum settings.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs font-semibold text-neutral-300 mb-2">
                <span>Default Player Volume ({playerDefaults.defaultVolume || 80}%)</span>
                <span className="font-mono text-amber-400">{playerDefaults.defaultVolume || 80}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={playerDefaults.defaultVolume || 80}
                onChange={(e) => handlePlayerDefault('defaultVolume', parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">AutoPlay Next Song</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">Automatically advance to next track in queue</p>
                </div>
                <input
                  type="checkbox"
                  checked={playerDefaults.autoPlayNext !== false}
                  onChange={(e) => handlePlayerDefault('autoPlayNext', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">3D Audio Visualizer</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">Enable responsive audio spectrum visualizer</p>
                </div>
                <input
                  type="checkbox"
                  checked={playerDefaults.visualizerEnabled !== false}
                  onChange={(e) => handlePlayerDefault('visualizerEnabled', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-page Action Footer (Non-floating to prevent covering inputs) */}
      {(onSaveDraft || onPublishLive) && (
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
      )}
    </div>
  );
}
