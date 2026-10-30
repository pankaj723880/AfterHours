import React, { useState, useEffect, useCallback } from 'react';
import {
  Star,
  Search,
  Filter,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { safeParseJsonResponse } from '../../utils/errorHandler';

export default function AdminReviewsManagement({ token, backendUrl, showToast }) {
  const [activeArea, setActiveArea] = useState('real'); // 'real' | 'configured'

  // --- Real Reviews State ---
  const [realReviews, setRealReviews] = useState([]);
  const [realSummary, setRealSummary] = useState(null);
  const [realPage, setRealPage] = useState(1);
  const [realTotalPages, setRealTotalPages] = useState(1);
  const [realTotal, setRealTotal] = useState(0);
  const [realRatingFilter, setRealRatingFilter] = useState('');
  const [realStatusFilter, setRealStatusFilter] = useState('');
  const [realSearchQuery, setRealSearchQuery] = useState('');
  const [isRealLoading, setIsRealLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // --- Configured Editorial Reviews State ---
  const [configuredReviews, setConfiguredReviews] = useState([]);
  const [configuredSettings, setConfiguredSettings] = useState({
    enabled: false,
    displayRating: 4.9,
    displayCount: 1250,
    editorialLabel: 'Curated Editorial Highlights'
  });
  const [isConfiguredLoading, setIsConfiguredLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [editorialModalOpen, setEditorialModalOpen] = useState(false);
  const [editorialForm, setEditorialForm] = useState({
    id: null,
    displayName: '',
    rating: 5,
    reviewText: '',
    status: 'published'
  });

  // Fetch real user reviews
  const fetchRealReviews = useCallback(async (page = 1) => {
    if (!token) return;
    setIsRealLoading(true);
    try {
      let url = `${backendUrl}/api/admin/reviews/real?page=${page}&limit=12`;
      if (realRatingFilter) url += `&rating=${encodeURIComponent(realRatingFilter)}`;
      if (realStatusFilter) url += `&status=${encodeURIComponent(realStatusFilter)}`;
      if (realSearchQuery) url += `&search=${encodeURIComponent(realSearchQuery)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to fetch real reviews');
      if (parsed.ok && parsed.data) {
        setRealReviews(parsed.data.reviews || []);
        setRealPage(parsed.data.page || 1);
        setRealTotalPages(parsed.data.totalPages || 1);
        setRealTotal(parsed.data.total || 0);
        setRealSummary(parsed.data.summary || null);
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsRealLoading(false);
    }
  }, [backendUrl, token, realRatingFilter, realStatusFilter, realSearchQuery, showToast]);

  // Fetch configured editorial content
  const fetchConfiguredData = useCallback(async () => {
    if (!token) return;
    setIsConfiguredLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/admin/reviews/configured`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to fetch configured reviews');
      if (parsed.ok && parsed.data) {
        setConfiguredSettings(parsed.data.settings || {
          enabled: false,
          displayRating: 4.9,
          displayCount: 1250,
          editorialLabel: 'Curated Editorial Highlights'
        });
        setConfiguredReviews(parsed.data.reviews || []);
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsConfiguredLoading(false);
    }
  }, [backendUrl, token, showToast]);

  useEffect(() => {
    if (activeArea === 'real') {
      fetchRealReviews(1);
    } else {
      fetchConfiguredData();
    }
  }, [activeArea, fetchRealReviews, fetchConfiguredData]);

  // Toggle real review visibility (publish / hide)
  const handleToggleRealStatus = async (review) => {
    const nextStatus = review.status === 'published' ? 'hidden' : 'published';
    try {
      const res = await fetch(`${backendUrl}/api/admin/reviews/real/${review._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to update review status');
      if (parsed.ok) {
        if (showToast) showToast(`Review status updated to ${nextStatus}`);
        setRealReviews(prev =>
          prev.map(r => r._id === review._id ? { ...r, status: nextStatus } : r)
        );
      } else {
        if (showToast) showToast(parsed.error, 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Delete real review with confirmation
  const handleDeleteRealReview = async (id) => {
    try {
      const res = await fetch(`${backendUrl}/api/admin/reviews/real/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to delete review');
      if (parsed.ok) {
        if (showToast) showToast('Review deleted successfully');
        setDeleteConfirmId(null);
        fetchRealReviews(realPage);
      } else {
        if (showToast) showToast(parsed.error, 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Save configured display settings
  const handleSaveConfiguredSettings = async (e) => {
    if (e) e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch(`${backendUrl}/api/admin/reviews/configured-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(configuredSettings)
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to save settings');
      if (parsed.ok) {
        if (showToast) showToast('Editorial reviews settings saved');
      } else {
        if (showToast) showToast(parsed.error, 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Save editorial review (Add or Edit)
  const handleSaveEditorialReview = async (e) => {
    if (e) e.preventDefault();
    try {
      const isEdit = Boolean(editorialForm.id);
      const url = isEdit
        ? `${backendUrl}/api/admin/reviews/configured/${editorialForm.id}`
        : `${backendUrl}/api/admin/reviews/configured`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editorialForm)
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to save editorial review');
      if (parsed.ok) {
        if (showToast) showToast(isEdit ? 'Editorial review updated' : 'Editorial review created');
        setEditorialModalOpen(false);
        setEditorialForm({ id: null, displayName: '', rating: 5, reviewText: '', status: 'published' });
        fetchConfiguredData();
      } else {
        if (showToast) showToast(parsed.error, 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Delete configured review
  const handleDeleteConfiguredReview = async (id) => {
    try {
      const res = await fetch(`${backendUrl}/api/admin/reviews/configured/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to delete review');
      if (parsed.ok) {
        if (showToast) showToast('Editorial review deleted');
        fetchConfiguredData();
      } else {
        if (showToast) showToast(parsed.error, 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/60 border border-neutral-800 p-3 sm:p-4 rounded-3xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveArea('real')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeArea === 'real'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'bg-neutral-800/60 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Real Ratings & Reviews</span>
            {realTotal > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeArea === 'real' ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-800 text-neutral-300'
              }`}>
                {realTotal}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveArea('configured')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeArea === 'configured'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'bg-neutral-800/60 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Configured & Editorial Content</span>
          </button>
        </div>

        <div className="text-[11px] text-neutral-400">
          {activeArea === 'real' ? (
            <span className="text-emerald-400 font-medium">● Authentic User Telemetry</span>
          ) : (
            <span className="text-amber-400 font-medium">● Editorial & Curated Layer</span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AREA A: REAL RATINGS & REVIEWS */}
      {/* ========================================================================= */}
      {activeArea === 'real' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
              <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">Genuine Average</span>
              <div className="text-3xl font-extrabold text-white flex items-baseline gap-1.5">
                <span>{realSummary?.averageRating?.toFixed(1) || '0.0'}</span>
                <span className="text-xs text-amber-400">★</span>
              </div>
              <span className="text-[11px] text-neutral-400 mt-1 block">From authentic listener ratings</span>
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
              <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">Total Ratings</span>
              <div className="text-3xl font-extrabold text-white">
                {realSummary?.totalRatings || 0}
              </div>
              <span className="text-[11px] text-neutral-400 mt-1 block">Distinct verified users</span>
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
              <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">Written Reviews</span>
              <div className="text-3xl font-extrabold text-white">
                {realSummary?.totalReviewsWithText || 0}
              </div>
              <span className="text-[11px] text-neutral-400 mt-1 block">With user commentary</span>
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
              <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">Public vs Hidden</span>
              <div className="text-2xl font-extrabold text-white flex items-center gap-2">
                <span className="text-emerald-400">{realSummary?.totalPublished || 0}</span>
                <span className="text-neutral-600">/</span>
                <span className="text-amber-400">{realSummary?.totalHidden || 0}</span>
              </div>
              <span className="text-[11px] text-neutral-400 mt-1 block">Moderation state</span>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-neutral-900/40 border border-neutral-800 p-3 rounded-2xl">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search user or review..."
                value={realSearchQuery}
                onChange={(e) => setRealSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchRealReviews(1); }}
                className="w-full pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Star Filter */}
              <select
                value={realRatingFilter}
                onChange={(e) => setRealRatingFilter(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">All Stars</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>

              {/* Status Filter */}
              <select
                value={realStatusFilter}
                onChange={(e) => setRealStatusFilter(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>

              <button
                type="button"
                onClick={() => fetchRealReviews(1)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Real Reviews Table / Cards */}
          {realReviews.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900/30 border border-neutral-800 rounded-3xl space-y-2">
              <p className="text-sm font-semibold text-neutral-300">No genuine user reviews match criteria</p>
              <p className="text-xs text-neutral-400">Reviews submitted by listeners will automatically appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {realReviews.map((rev) => (
                <div
                  key={rev._id}
                  className="bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 flex flex-col justify-between gap-3 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {rev.displayName ? rev.displayName.charAt(0) : 'U'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate flex items-center gap-1">
                            {rev.displayName || rev.username}
                            <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                          </h4>
                          <span className="text-[10px] text-neutral-400 font-mono block">
                            @{rev.username} • {new Date(rev.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                        rev.status === 'published'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        {rev.status}
                      </span>
                    </div>

                    {/* Star Rating */}
                    <div className="flex items-center gap-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            rev.rating >= s ? 'fill-amber-400 text-amber-400' : 'text-neutral-700'
                          }`}
                        />
                      ))}
                      <span className="text-xs text-neutral-300 font-bold ml-1">{rev.rating}/5</span>
                    </div>

                    {/* Review Commentary */}
                    <p className="text-xs text-neutral-300 leading-relaxed italic break-words">
                      {rev.reviewText ? `"${rev.reviewText}"` : <span className="text-neutral-400 not-italic">(Star rating only, no written review)</span>}
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleToggleRealStatus(rev)}
                      className="inline-flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white transition cursor-pointer"
                    >
                      {rev.status === 'published' ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                          <span>Hide on Homepage</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Publish to Wall</span>
                        </>
                      )}
                    </button>

                    {deleteConfirmId === rev._id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-red-400">Confirm?</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRealReview(rev._id)}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(rev._id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition cursor-pointer"
                        title="Delete review"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {realTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
              <span className="text-xs text-neutral-400 font-mono">
                Showing page {realPage} of {realTotalPages} ({realTotal} total reviews)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchRealReviews(realPage - 1)}
                  disabled={realPage <= 1 || isRealLoading}
                  className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => fetchRealReviews(realPage + 1)}
                  disabled={realPage >= realTotalPages || isRealLoading}
                  className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* AREA B: CONFIGURED & EDITORIAL CONTENT */}
      {/* ========================================================================= */}
      {activeArea === 'configured' && (
        <div className="space-y-6">
          {/* Critical Separation Notice Banner */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-neutral-300">
              <span className="font-bold text-amber-400 block">Strict Data Isolation Guarantee</span>
              <p>
                Configured editorial content is stored independently and <strong className="text-white">never contaminates genuine user ratings or telemetry</strong>.
                If enabled, public pages display this content under a distinct "Editorial Highlights" badge without altering genuine calculation averages.
              </p>
            </div>
          </div>

          {/* Configured Display Settings Form */}
          <form onSubmit={handleSaveConfiguredSettings} className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Editorial Display Summary Settings</h3>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={configuredSettings.enabled}
                  onChange={(e) => setConfiguredSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="rounded bg-neutral-950 border-neutral-700 text-amber-500 focus:ring-amber-500"
                />
                <span className={configuredSettings.enabled ? 'text-emerald-400 font-bold' : 'text-neutral-400'}>
                  {configuredSettings.enabled ? 'Enabled on Homepage' : 'Disabled'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400 font-medium">Display Rating (1.0 to 5.0)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  value={configuredSettings.displayRating}
                  onChange={(e) => setConfiguredSettings(prev => ({ ...prev, displayRating: parseFloat(e.target.value) || 4.9 }))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400 font-medium">Display Count (e.g. 1250)</label>
                <input
                  type="number"
                  min="0"
                  value={configuredSettings.displayCount}
                  onChange={(e) => setConfiguredSettings(prev => ({ ...prev, displayCount: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400 font-medium">Editorial Badge Label</label>
                <input
                  type="text"
                  value={configuredSettings.editorialLabel}
                  onChange={(e) => setConfiguredSettings(prev => ({ ...prev, editorialLabel: e.target.value }))}
                  placeholder="Curated Editorial Highlights"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs transition cursor-pointer shadow-md shadow-amber-500/20"
              >
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>

          {/* Configured Reviews List & Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Configured Editorial Reviews ({configuredReviews.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditorialForm({ id: null, displayName: '', rating: 5, reviewText: '', status: 'published' });
                  setEditorialModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-neutral-700"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Add Editorial Review</span>
              </button>
            </div>

            {configuredReviews.length === 0 ? (
              <div className="p-8 text-center bg-neutral-900/30 border border-neutral-800 rounded-2xl text-neutral-400 text-xs">
                No configured reviews created yet. Tap "Add Editorial Review" to author curated commentary.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {configuredReviews.map((rev) => (
                  <div
                    key={rev._id}
                    className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-white truncate">{rev.displayName}</h4>
                          <span className="text-[10px] text-amber-400 font-semibold block">Editorial Voice</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          rev.status === 'published' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                        }`}>
                          {rev.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              rev.rating >= s ? 'fill-amber-400 text-amber-400' : 'text-neutral-700'
                            }`}
                          />
                        ))}
                        <span className="text-xs text-neutral-300 font-bold ml-1">{rev.rating}/5</span>
                      </div>

                      <p className="text-xs text-neutral-300 leading-relaxed italic break-words">
                        "{rev.reviewText}"
                      </p>
                    </div>

                    <div className="pt-2 border-t border-neutral-800 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditorialForm({
                            id: rev._id,
                            displayName: rev.displayName,
                            rating: rev.rating,
                            reviewText: rev.reviewText,
                            status: rev.status
                          });
                          setEditorialModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                        title="Edit editorial review"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteConfiguredReview(rev._id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition cursor-pointer"
                        title="Delete editorial review"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add / Edit Editorial Modal */}
          {editorialModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-md space-y-4 text-white">
                <h3 className="text-base font-extrabold">
                  {editorialForm.id ? 'Edit Editorial Review' : 'Create Editorial Review'}
                </h3>

                <form onSubmit={handleSaveEditorialReview} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400">Reviewer Display Name</label>
                    <input
                      type="text"
                      required
                      value={editorialForm.displayName}
                      onChange={(e) => setEditorialForm(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="e.g. Vintage Bollywood Journal"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400">Rating (1 to 5 Stars)</label>
                    <select
                      value={editorialForm.rating}
                      onChange={(e) => setEditorialForm(prev => ({ ...prev, rating: parseInt(e.target.value, 10) }))}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="5">5 Stars - Exceptional</option>
                      <option value="4">4 Stars - Great</option>
                      <option value="3">3 Stars - Good</option>
                      <option value="2">2 Stars - Fair</option>
                      <option value="1">1 Star - Poor</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400">Review Text</label>
                    <textarea
                      rows={3}
                      required
                      value={editorialForm.reviewText}
                      onChange={(e) => setEditorialForm(prev => ({ ...prev, reviewText: e.target.value }))}
                      placeholder="Enter curated editorial review commentary..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400">Publication Status</label>
                    <select
                      value={editorialForm.status}
                      onChange={(e) => setEditorialForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="published">Published</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditorialModalOpen(false)}
                      className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded-xl text-xs font-bold hover:bg-neutral-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-xs font-extrabold cursor-pointer"
                    >
                      Save Editorial Review
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

