import React, { useState } from 'react';
import { 
  Sliders, 
  ShieldCheck, 
  Download, 
  History, 
  Sparkles, 
  RotateCcw, 
  UploadCloud, 
  Save, 
  Check, 
  AlertTriangle,
  Lock,
  Headphones,
  Radio,
  FileCheck,
  Eye
} from 'lucide-react';
import { normalizeCmsConfig } from '../../services/cmsClient';
import CmsFeatureManager from './CmsFeatureManager';
import CmsPublishingHistory from './CmsPublishingHistory';
import OfflineLicenseManagement from './OfflineLicenseManagement';

export default function CmsFeatureGovernance({
  draft,
  onUpdateDraft,
  showToast,
  onSaveDraft,
  onPublishLive,
  isSavingDraft = false,
  isPublishingLive = false,
  token,
  backendUrl,
  publishedMeta,
  onTogglePreview
}) {
  const [activeTab, setActiveTab] = useState('features');

  const tabs = [
    { id: 'features', label: 'Feature Flags Matrix', icon: Sliders },
    { id: 'history', label: 'Version Timeline & Rollback', icon: History, badge: publishedMeta ? `Rev #${publishedMeta.version}` : null },
    { id: 'licenses', label: 'Offline DRM & Track Rights', icon: Download }
  ];

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="rounded-2xl bg-neutral-900/70 border border-neutral-800 p-4 sm:p-6 backdrop-blur-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Feature Matrix & Governance Workspace</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Feature Rollouts & Version Snapshots
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl">
              Control platform feature availability, audit immutable snapshot revisions with one-click rollback, and manage DRM licenses.
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
                onClick={() => onPublishLive('Published feature matrix & governance settings')}
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
      <div>
        {activeTab === 'features' && (
          <CmsFeatureManager
            draft={draft}
            onUpdateDraft={onUpdateDraft}
            showToast={showToast}
            onSaveDraft={onSaveDraft}
            onPublishLive={onPublishLive}
            isSavingDraft={isSavingDraft}
            isPublishingLive={isPublishingLive}
            token={token}
            backendUrl={backendUrl}
          />
        )}

        {activeTab === 'history' && (
          <CmsPublishingHistory
            draft={draft}
            publishedMeta={publishedMeta}
            onSaveDraft={onSaveDraft}
            onPublishLive={onPublishLive}
            onTogglePreview={onTogglePreview}
            token={token}
            backendUrl={backendUrl}
            showToast={showToast}
          />
        )}

        {activeTab === 'licenses' && (
          <OfflineLicenseManagement
            token={token}
            backendUrl={backendUrl}
            showToast={showToast}
          />
        )}
      </div>
    </div>
  );
}
