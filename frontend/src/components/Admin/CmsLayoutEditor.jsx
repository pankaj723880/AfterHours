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
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  X,
  AlertTriangle
} from 'lucide-react';
import { normalizeCmsConfig, DEFAULT_CMS_CONFIG } from '../../services/cmsClient';

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

  // Navigation Modal & CRUD States
  const [showNavModal, setShowNavModal] = useState(false);
  const [editingNavIndex, setEditingNavIndex] = useState(null);
  const [navFormId, setNavFormId] = useState('');
  const [navFormLabel, setNavFormLabel] = useState('');
  const [navFormIcon, setNavFormIcon] = useState('music');
  const [navFormGroup, setNavFormGroup] = useState('main');
  const [navFormRoute, setNavFormRoute] = useState('');
  const [navFormBadge, setNavFormBadge] = useState('');
  const [navFormDescription, setNavFormDescription] = useState('');
  const [navFormEnabled, setNavFormEnabled] = useState(true);
  const [navFormIsCore, setNavFormIsCore] = useState(false);
  const [navToDelete, setNavToDelete] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

  const openAddNavModal = () => {
    setEditingNavIndex(null);
    setNavFormId('');
    setNavFormLabel('');
    setNavFormIcon('music');
    setNavFormGroup('main');
    setNavFormRoute('');
    setNavFormBadge('');
    setNavFormDescription('');
    setNavFormEnabled(true);
    setNavFormIsCore(false);
    setShowNavModal(true);
  };

  const openEditNavModal = (index) => {
    const item = navigation[index];
    if (!item) return;
    setEditingNavIndex(index);
    setNavFormId(item.id || '');
    setNavFormLabel(item.label || '');
    setNavFormIcon(item.icon || 'music');
    setNavFormGroup(item.group || 'main');
    setNavFormRoute(item.route || (item.id === 'home' ? '/' : `/${item.id}`));
    setNavFormBadge(item.badge || '');
    setNavFormDescription(item.description || '');
    setNavFormEnabled(item.enabled !== false);
    setNavFormIsCore(Boolean(item.isCore));
    setShowNavModal(true);
  };

  const handleSaveNavModal = () => {
    if (!navFormLabel.trim()) {
      if (showToast) showToast('Navigation label is required', 'error');
      return;
    }
    const cleanId = (navFormId.trim() || navFormLabel.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
    if (!cleanId) {
      if (showToast) showToast('Destination ID / Slug is required', 'error');
      return;
    }

    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const list = [...(base.navigation || [])];

      const itemPayload = {
        id: cleanId,
        label: navFormLabel.trim(),
        icon: navFormIcon,
        group: navFormGroup,
        route: navFormRoute.trim() || (cleanId === 'home' ? '/' : `/${cleanId}`),
        badge: navFormBadge.trim(),
        description: navFormDescription.trim(),
        enabled: navFormEnabled,
        isCore: editingNavIndex !== null ? Boolean(list[editingNavIndex]?.isCore) : navFormIsCore
      };

      if (editingNavIndex !== null && list[editingNavIndex]) {
        list[editingNavIndex] = {
          ...list[editingNavIndex],
          ...itemPayload,
          order: list[editingNavIndex].order || editingNavIndex + 1
        };
      } else {
        if (list.some(n => n.id === cleanId)) {
          if (showToast) showToast(`Destination ID "${cleanId}" already exists`, 'error');
          return base;
        }
        list.push({
          ...itemPayload,
          order: list.length + 1
        });
      }

      return { ...base, navigation: list };
    });

    setShowNavModal(false);
    if (showToast) showToast(editingNavIndex !== null ? 'Navigation destination updated' : 'Navigation destination added');
  };

  const handleDeleteNav = (index) => {
    const item = navigation[index];
    if (item?.isCore) {
      if (showToast) showToast('Core navigation items cannot be deleted', 'error');
      return;
    }

    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const list = [...(base.navigation || [])];
      list.splice(index, 1);
      const reordered = list.map((it, idx) => ({ ...it, order: idx + 1 }));
      return { ...base, navigation: reordered };
    });

    setNavToDelete(null);
    if (showToast) showToast('Navigation destination removed');
  };

  const handleResetNavToDefaults = () => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      return { ...base, navigation: DEFAULT_CMS_CONFIG.navigation };
    });
    setShowResetConfirm(false);
    if (showToast) showToast('Navigation reset to platform defaults');
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
          <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-neutral-400 backdrop-blur-md">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Menu className="w-4 h-4 text-amber-400" />
                Sidebar Navigation ({navigation.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage all 15 platform destinations, navigation groupings, labels, icons, badges, and ordering.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openAddNavModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Destination</span>
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold border border-neutral-700 transition cursor-pointer"
                title="Reset to platform defaults"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset Defaults</span>
              </button>
              {onSaveDraft && (
                <button
                  type="button"
                  disabled={isSavingDraft}
                  onClick={onSaveDraft}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingDraft ? 'Saving...' : 'Save Draft'}
                </button>
              )}
              {onPublishLive && (
                <button
                  type="button"
                  disabled={isPublishingLive}
                  onClick={onPublishLive}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition shadow shadow-amber-500/10 cursor-pointer disabled:opacity-50"
                >
                  {isPublishingLive ? 'Publishing...' : 'Publish Live'}
                </button>
              )}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 text-xs text-neutral-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              Core navigation items (Home, Search, Favourites, History) are protected from accidental removal.
            </span>
          </div>

          <div className="space-y-2.5">
            {navigation.map((item, idx) => {
              const isEnabled = item.enabled !== false;
              const groupColors = {
                main: 'bg-neutral-800 text-neutral-300 border-neutral-700',
                discovery: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
                stations: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
                collection: 'bg-purple-500/10 text-purple-300 border-purple-500/20'
              };

              return (
                <div
                  key={item.id || idx}
                  className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isEnabled
                      ? 'bg-neutral-900/70 border-neutral-800 hover:border-neutral-700'
                      : 'bg-neutral-950/60 border-neutral-900 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-neutral-800 text-neutral-400 font-mono text-[11px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{item.label}</span>
                        {item.group && (
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${groupColors[item.group] || groupColors.main}`}>
                            {item.group}
                          </span>
                        )}
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
                      <span className="text-[10px] text-neutral-500 font-mono">
                        ID: {item.id} • Route: {item.route || `/${item.id}`} • Icon: {item.icon || 'music'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={item.label || ''}
                        onChange={(e) => handleNavField(idx, 'label', e.target.value)}
                        placeholder="Label"
                        className="w-24 sm:w-32 bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <input
                        type="text"
                        value={item.badge || ''}
                        onChange={(e) => handleNavField(idx, 'badge', e.target.value)}
                        placeholder="Badge"
                        className="w-16 sm:w-20 bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1">
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
                        disabled={item.isCore && isEnabled}
                        onClick={() => handleToggleNav(idx)}
                        className={`p-1.5 rounded-lg border transition ${
                          isEnabled
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                        }`}
                        title={isEnabled ? 'Disable' : 'Enable'}
                      >
                        {isEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditNavModal(idx)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700 transition"
                        title="Edit Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={item.isCore}
                        onClick={() => setNavToDelete({ item, idx })}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 border border-neutral-700 disabled:opacity-20 disabled:hover:bg-neutral-800 disabled:hover:text-neutral-500 transition"
                        title={item.isCore ? 'Core item protected' : 'Delete Destination'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add / Edit Destination Modal */}
          {showNavModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Menu className="w-4 h-4 text-amber-400" />
                    {editingNavIndex !== null ? 'Edit Navigation Destination' : 'Add Navigation Destination'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowNavModal(false)}
                    className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Destination Label *</label>
                      <input
                        type="text"
                        placeholder="e.g. My Favorites"
                        value={navFormLabel}
                        onChange={(e) => {
                          setNavFormLabel(e.target.value);
                          if (editingNavIndex === null && !navFormId) {
                            setNavFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
                          }
                        }}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Tab ID / Slug *</label>
                      <input
                        type="text"
                        placeholder="e.g. favorites"
                        value={navFormId}
                        onChange={(e) => setNavFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Navigation Group</label>
                      <select
                        value={navFormGroup}
                        onChange={(e) => setNavFormGroup(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80 cursor-pointer"
                      >
                        <option value="main">Main (Home, Discover)</option>
                        <option value="discovery">AI & Discovery</option>
                        <option value="stations">Nostalgia Stations</option>
                        <option value="collection">Your Collection</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Icon</label>
                      <select
                        value={navFormIcon}
                        onChange={(e) => setNavFormIcon(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80 cursor-pointer"
                      >
                        <option value="home">🏠 Home</option>
                        <option value="discover">🧭 Discover</option>
                        <option value="sparkles">✨ Sparkles</option>
                        <option value="radio">📻 Radio</option>
                        <option value="flame">🔥 Flame</option>
                        <option value="swipe">📱 Swipe</option>
                        <option value="scissors">✂️ Scissors (Saloon)</option>
                        <option value="truck">🚛 Truck (Highway)</option>
                        <option value="beer">🍺 Beer (Theka)</option>
                        <option value="library">📚 Library (Liked Songs)</option>
                        <option value="history">⏱️ History</option>
                        <option value="list">📋 Playlists</option>
                        <option value="sliders">🎛️ Sliders (Equalizer)</option>
                        <option value="user">👤 User Profile</option>
                        <option value="shield">🛡️ Shield (Admin)</option>
                        <option value="music">🎵 Music Note</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-semibold mb-1">Route / Path</label>
                    <input
                      type="text"
                      placeholder="e.g. /favorites or /"
                      value={navFormRoute}
                      onChange={(e) => setNavFormRoute(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80 font-mono"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {['/', '/discover', '/mood', '/timemachine', '/activity', '/swipe', '/library', '/history', '/playlists', '/stats', '/equalizer', '/profile'].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setNavFormRoute(r)}
                          className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono text-[10px]"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Badge Pill (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. NEW, BETA, LIVE"
                        value={navFormBadge}
                        onChange={(e) => setNavFormBadge(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Tooltip / Description</label>
                      <input
                        type="text"
                        placeholder="Short description"
                        value={navFormDescription}
                        onChange={(e) => setNavFormDescription(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                    <input
                      type="checkbox"
                      checked={navFormEnabled}
                      onChange={(e) => setNavFormEnabled(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <span className="text-white font-medium">Visible in Sidebar Navigation</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setShowNavModal(false)}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNavModal}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
                  >
                    {editingNavIndex !== null ? 'Save Changes' : 'Add Destination'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Destination Confirmation */}
          {navToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Remove Destination</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">Remove this item from platform sidebar navigation.</p>
                  </div>
                </div>

                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-300">
                  Are you sure you want to remove <span className="text-white font-bold">{navToDelete.item.label}</span> ({navToDelete.item.id})?
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setNavToDelete(null)}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNav(navToDelete.idx)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-950 cursor-pointer"
                  >
                    Yes, Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset Navigation to Defaults Confirmation */}
          {showResetConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3 text-amber-400">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Reset Navigation to Defaults</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">Restore platform navigation destinations and default ordering.</p>
                  </div>
                </div>

                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-300">
                  This will restore: Home, Discover & Search, Mood-to-Music AI, Time Machine Radio, Listening Activity, Discover Swipe, Saloon FM, Horn Ok Please, Theka Session, Liked Songs Collection, Listening History, Playlists, and Recap & Stats.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleResetNavToDefaults}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    Yes, Reset Defaults
                  </button>
                </div>
              </div>
            </div>
          )}
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
