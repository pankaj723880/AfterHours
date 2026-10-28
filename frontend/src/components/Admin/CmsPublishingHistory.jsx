import React, { useState, useEffect } from 'react';
import { 
  History, 
  RotateCcw, 
  UploadCloud, 
  Save, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Sparkles,
  Eye,
  AlertCircle
} from 'lucide-react';
import { safeParseJsonResponse } from '../../utils/errorHandler';

export default function CmsPublishingHistory({ 
  draft, 
  publishedMeta, 
  onSaveDraft, 
  onPublishLive, 
  onTogglePreview,
  token, 
  backendUrl, 
  showToast 
}) {
  const [versions, setVersions] = useState([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [publishSummary, setPublishSummary] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRestoringId, setIsRestoringId] = useState(null);

  const fetchVersions = async () => {
    setIsLoadingVersions(true);
    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/versions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Fetch versions failed');
      if (parsed.ok && parsed.data?.versions) {
        setVersions(parsed.data.versions);
      }
    } catch (err) {
      if (showToast) showToast('Failed to load version history', 'error');
    } finally {
      setIsLoadingVersions(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [backendUrl, token]);

  const handleConfirmPublish = async (e) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      await onPublishLive(publishSummary.trim() || 'Updated website configuration');
      setShowPublishModal(false);
      setPublishSummary('');
      fetchVersions();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRestore = async (version) => {
    if (!window.confirm(`Are you sure you want to restore to Revision #${version.versionNumber}? This will immediately update the live website.`)) {
      return;
    }

    setIsRestoringId(version.id);
    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/versions/${version.id}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Restore failed');
      if (parsed.ok) {
        if (showToast) showToast(`Restored to Revision #${version.versionNumber}!`, 'success');
        fetchVersions();
        window.location.reload(); // Refresh to load restored draft
      } else {
        if (showToast) showToast(parsed.error || 'Restore failed', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsRestoringId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Publishing Status Banner */}
      <div className="bg-gradient-to-r from-neutral-900/90 via-neutral-900/60 to-neutral-900/90 border border-neutral-800 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
              Live Production Revision #{publishedMeta?.version || 1}
            </span>
          </div>
          <h3 className="text-base font-extrabold text-white">Publishing Workflow & Change History</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Save changes in draft safely. When ready, publish live to update all connected listeners immediately without a code deploy.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-neutral-500 mt-3 font-mono">
            <span>Last published: {publishedMeta?.publishedAt ? new Date(publishedMeta.publishedAt).toLocaleString() : 'System default'}</span>
            <span>•</span>
            <span>By: {publishedMeta?.lastModifiedBy || 'system'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {onTogglePreview && (
            <button
              type="button"
              onClick={onTogglePreview}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Draft</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSaveDraft}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPublishModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Publish Live</span>
          </button>
        </div>
      </div>

      {/* Revision History Log */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white">Revision Snapshots & Rollback</h4>
          </div>
          <span className="text-xs text-neutral-500 font-mono">{versions.length} Revisions Recorded</span>
        </div>

        {isLoadingVersions ? (
          <div className="text-center py-8 text-xs text-neutral-400">Loading version history...</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-xs text-neutral-500">
            No previous version snapshots saved yet. Publish your first CMS update to start tracking change history!
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/60">
            {versions.map((ver, idx) => {
              const isCurrent = (publishedMeta?.version || 1) === ver.versionNumber;
              return (
                <div key={ver.id} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        Rev #{ver.versionNumber}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          CURRENT LIVE
                        </span>
                      )}
                      <span className="text-xs font-semibold text-white">{ver.changeSummary || 'Configuration update'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-mono">
                      <span>Published by {ver.publishedBy}</span>
                      <span>•</span>
                      <span>{new Date(ver.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {!isCurrent && (
                    <button
                      type="button"
                      disabled={isRestoringId === ver.id}
                      onClick={() => handleRestore(ver)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-700 transition cursor-pointer self-end sm:self-auto disabled:opacity-40"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{isRestoringId === ver.id ? 'Restoring...' : 'Restore'}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PUBLISH MODAL */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-400">
              <UploadCloud className="w-5 h-5" />
              <h4 className="text-base font-bold text-white">Publish CMS Changes to Live Website</h4>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              This action will publish all changes in the current draft to the live website. Connected listeners will receive the new configuration via real-time WebSocket push.
            </p>

            <form onSubmit={handleConfirmPublish} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Change Note / Summary (Saved in Audit Log)
                </label>
                <input
                  type="text"
                  value={publishSummary}
                  onChange={(e) => setPublishSummary(e.target.value)}
                  placeholder="e.g. Updated homepage banners and Saloon FM queries"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {isPublishing ? 'Publishing...' : 'Confirm & Publish Live'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
