import React from 'react';
import { Layers, ArrowUp, ArrowDown, Eye, EyeOff, Hash, Sparkles } from 'lucide-react';

export default function CmsSectionManager({ draft, onUpdateDraft, showToast }) {
  const sections = draft?.homeSections || [];

  const handleToggleSection = (sectionId, currentVal) => {
    onUpdateDraft(prev => {
      const homeSections = [...(prev.homeSections || [])];
      const idx = homeSections.findIndex(s => s.id === sectionId);
      if (idx >= 0) {
        homeSections[idx] = { ...homeSections[idx], enabled: !currentVal };
      }
      return { ...prev, homeSections };
    });
    showToast?.(`Section ${sectionId} ${!currentVal ? 'enabled' : 'hidden'} in draft`, 'info');
  };

  const handleMoveOrder = (index, direction) => {
    onUpdateDraft(prev => {
      const homeSections = [...(prev.homeSections || [])];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= homeSections.length) return prev;

      const temp = homeSections[index];
      homeSections[index] = homeSections[targetIndex];
      homeSections[targetIndex] = temp;

      // Re-assign order indices
      homeSections.forEach((s, idx) => {
        s.order = idx + 1;
      });

      return { ...prev, homeSections };
    });
  };

  const handleFieldChange = (sectionId, field, val) => {
    onUpdateDraft(prev => {
      const homeSections = [...(prev.homeSections || [])];
      const idx = homeSections.findIndex(s => s.id === sectionId);
      if (idx >= 0) {
        homeSections[idx] = { ...homeSections[idx], [field]: val };
      }
      return { ...prev, homeSections };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            Home Page Section Manager
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Reorder, toggle visibility, and customize titles and display limits for each section on the Home page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-amber-400/90 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            {sections.filter(s => s.enabled !== false).length} Active Sections
          </span>
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-3">
        {sections.map((sec, index) => {
          const isFirst = index === 0;
          const isLast = index === sections.length - 1;

          return (
            <div
              key={sec.id}
              className={`p-4 rounded-2xl border transition-all ${sec.enabled !== false
                ? 'bg-neutral-900/60 border-neutral-800/80 shadow-sm'
                : 'bg-neutral-950/40 border-neutral-900 opacity-60'
                }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: Reorder Controls + ID */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveOrder(index, 'up')}
                      className="p-1 rounded bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                      title="Move section up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveOrder(index, 'down')}
                      className="p-1 rounded bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                      title="Move section down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-mono font-bold text-amber-400 shrink-0">
                    #{sec.order || index + 1}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400/90">
                        {sec.id}
                      </span>
                      {sec.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 font-medium">
                          {sec.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-white block mt-0.5">
                      {sec.title}
                    </span>
                  </div>
                </div>

                {/* Right: Inline Editors & Visibility */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-neutral-400">Limit:</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={sec.displayLimit || 12}
                      onChange={(e) => handleFieldChange(sec.id, 'displayLimit', parseInt(e.target.value) || 12)}
                      className="w-16 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-center text-white focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleSection(sec.id, sec.enabled)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${sec.enabled !== false
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                      }`}
                  >
                    {sec.enabled !== false ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Editable Text Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-neutral-800/60">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400 font-medium">Section Heading</label>
                  <input
                    type="text"
                    value={sec.title || ''}
                    onChange={(e) => handleFieldChange(sec.id, 'title', e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400 font-medium">Subtitle Description</label>
                  <input
                    type="text"
                    value={sec.subtitle || ''}
                    onChange={(e) => handleFieldChange(sec.id, 'subtitle', e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
        <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
        <span>Section order and display limits are saved to draft. Hit <strong>Publish Changes</strong> to update the live home layout.</span>
      </div>
    </div>
  );
}

