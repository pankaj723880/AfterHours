import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  AlertCircle, 
  FileText, 
  ShieldCheck, 
  Music, 
  Check, 
  X 
} from 'lucide-react';
import { safeParseJsonResponse } from '../../utils/errorHandler';

export default function OfflineLicenseManagement({ token, backendUrl, showToast }) {
  const [licenses, setLicenses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEligibility, setFilterEligibility] = useState('all'); // 'all' | 'eligible' | 'ineligible'

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState(null);
  const [licenseToDelete, setLicenseToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    trackId: '',
    title: '',
    artist: '',
    channel: '',
    thumbnail: '',
    duration: '',
    offlineEligible: true,
    sourceProvider: 'direct_license',
    permissionScope: 'offline_download_permitted',
    licenseType: 'Direct-License',
    licenseReference: '',
    notes: ''
  });

  const fetchLicenses = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/offline/admin/licenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to fetch offline licenses');
      if (parsed.ok && parsed.data?.licenses) {
        setLicenses(parsed.data.licenses);
      } else {
        setError(parsed.error || 'Failed to load licenses');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching licenses');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, [token, backendUrl]);

  const handleOpenAddModal = () => {
    setEditingLicense(null);
    setFormData({
      trackId: '',
      title: '',
      artist: '',
      channel: '',
      thumbnail: '',
      duration: '',
      offlineEligible: true,
      sourceProvider: 'direct_license',
      permissionScope: 'offline_download_permitted',
      licenseType: 'Direct-License',
      licenseReference: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (license) => {
    setEditingLicense(license);
    setFormData({
      trackId: license.trackId || '',
      title: license.title || '',
      artist: license.artist || '',
      channel: license.channel || '',
      thumbnail: license.thumbnail || '',
      duration: license.duration || '',
      offlineEligible: Boolean(license.offlineEligible),
      sourceProvider: license.sourceProvider || 'direct_license',
      permissionScope: license.permissionScope || 'offline_download_permitted',
      licenseType: license.licenseType || 'Direct-License',
      licenseReference: license.licenseReference || '',
      notes: license.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.trackId.trim() || !formData.title.trim()) {
      if (showToast) showToast('Track ID and Title are required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = Boolean(editingLicense);
      const endpoint = isEdit
        ? `${backendUrl}/api/offline/admin/licenses/${encodeURIComponent(editingLicense.trackId)}`
        : `${backendUrl}/api/offline/admin/licenses`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const parsed = await safeParseJsonResponse(res, 'License operation failed');
      if (parsed.ok) {
        if (showToast) {
          showToast(
            isEdit ? 'License updated successfully!' : 'Track license registered successfully!',
            'success'
          );
        }
        setIsModalOpen(false);
        fetchLicenses();
      } else {
        if (showToast) showToast(parsed.error || 'Failed to save license', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!licenseToDelete || !token) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `${backendUrl}/api/offline/admin/licenses/${encodeURIComponent(licenseToDelete.trackId)}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const parsed = await safeParseJsonResponse(res, 'Revoke license failed');
      if (parsed.ok) {
        if (showToast) showToast(`License for "${licenseToDelete.title}" revoked.`, 'success');
        setLicenseToDelete(null);
        fetchLicenses();
      } else {
        if (showToast) showToast(parsed.error || 'Failed to revoke license', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLicenses = useMemo(() => {
    return licenses.filter(lic => {
      if (filterEligibility === 'eligible' && !lic.offlineEligible) return false;
      if (filterEligibility === 'ineligible' && lic.offlineEligible) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (lic.title || '').toLowerCase().includes(q) ||
        (lic.artist || '').toLowerCase().includes(q) ||
        (lic.trackId || '').toLowerCase().includes(q) ||
        (lic.sourceProvider || '').toLowerCase().includes(q) ||
        (lic.licenseType || '').toLowerCase().includes(q)
      );
    });
  }, [licenses, filterEligibility, searchQuery]);

  const stats = useMemo(() => {
    const total = licenses.length;
    const eligible = licenses.filter(l => l.offlineEligible).length;
    const direct = licenses.filter(l => (l.licenseType || '').toLowerCase().includes('direct')).length;
    const openSource = licenses.filter(l => (l.licenseType || '').toLowerCase().includes('cc') || (l.licenseType || '').toLowerCase().includes('public')).length;
    return { total, eligible, direct, openSource };
  }, [licenses]);

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-amber-500 font-mono text-xs uppercase tracking-wider mb-1">
              <Download className="w-3.5 h-3.5" />
              <span>Offline Licensing & Rights Catalog</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Offline Track Licenses</h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl leading-relaxed">
              Manage authorized track rights, license scopes, and offline download permissions. Tracks flagged eligible immediately populate the public Offline Explore library.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={fetchLicenses}
              disabled={isLoading}
              title="Refresh licenses"
              className="p-2.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/80 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Licensed Track</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-neutral-800/80">
          <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800">
            <div className="text-[11px] text-neutral-400 font-medium">Total Registered</div>
            <div className="text-lg font-bold text-white mt-0.5">{stats.total}</div>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800">
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Offline Eligible</span>
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">{stats.eligible}</div>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800">
            <div className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Direct Licenses</span>
            </div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">{stats.direct}</div>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800">
            <div className="text-[11px] text-sky-400 font-medium flex items-center gap-1">
              <FileText className="w-3 h-3" />
              <span>CC / Public Domain</span>
            </div>
            <div className="text-lg font-bold text-sky-400 mt-0.5">{stats.openSource}</div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by title, artist, track ID, provider..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-neutral-800 self-start sm:self-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilterEligibility('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filterEligibility === 'all'
                ? 'bg-amber-500 text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            All ({licenses.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterEligibility('eligible')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filterEligibility === 'eligible'
                ? 'bg-emerald-500 text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Eligible ({stats.eligible})
          </button>
          <button
            type="button"
            onClick={() => setFilterEligibility('ineligible')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filterEligibility === 'ineligible'
                ? 'bg-rose-500 text-white font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Revoked ({stats.total - stats.eligible})
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchLicenses}
            className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-rose-200 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Licenses Table / List */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden backdrop-blur-xl">
        {isLoading && licenses.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-400 animate-pulse">
            Loading licensed tracks catalog...
          </div>
        ) : filteredLicenses.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-500">
            {searchQuery || filterEligibility !== 'all'
              ? 'No licensed tracks match your search or filter.'
              : 'No offline licenses recorded yet. Click "Add Licensed Track" to grant rights.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-neutral-900/80 text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="py-3 px-4">Track</th>
                  <th className="py-3 px-4">Track ID</th>
                  <th className="py-3 px-4">License Type</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Verified By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-sans">
                {filteredLicenses.map((lic) => (
                  <tr key={lic.trackId} className="hover:bg-neutral-850/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {lic.thumbnail ? (
                          <img
                            src={lic.thumbnail}
                            alt=""
                            className="w-9 h-9 rounded-lg object-cover bg-neutral-950 border border-neutral-800 shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 text-neutral-500">
                            <Music className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate max-w-[200px]">{lic.title}</div>
                          <div className="text-[11px] text-neutral-400 truncate max-w-[200px]">{lic.artist || 'Unknown Artist'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-amber-400/90 truncate max-w-[120px]">
                      {lic.trackId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] font-medium">
                        {lic.licenseType || 'Direct-License'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-400 text-[11px]">
                      {lic.permissionScope || 'offline_download_permitted'}
                    </td>
                    <td className="py-3 px-4">
                      {lic.offlineEligible ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                          <Check className="w-3.5 h-3.5" />
                          <span>Eligible</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-semibold">
                          <X className="w-3.5 h-3.5" />
                          <span>Revoked</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-400 text-[11px]">
                      {lic.verifiedBy || 'admin'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(lic)}
                          title="Edit License"
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setLicenseToDelete(lic)}
                          title="Revoke / Delete License"
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit License Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl p-6 text-xs text-neutral-300 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white">
                {editingLicense ? 'Edit Track License' : 'Register New Track License'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Track ID / Video ID *</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingLicense)}
                    placeholder="e.g. Yqj1_V90KJo"
                    value={formData.trackId}
                    onChange={(e) => setFormData(prev => ({ ...prev, trackId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Track Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kesariya"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Artist Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Arijit Singh"
                    value={formData.artist}
                    onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Channel / Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Sony Music India"
                    value={formData.channel}
                    onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">License Type</label>
                  <select
                    value={formData.licenseType}
                    onChange={(e) => setFormData(prev => ({ ...prev, licenseType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Direct-License">Direct-License</option>
                    <option value="CC-BY">CC-BY</option>
                    <option value="Public-Domain">Public-Domain</option>
                    <option value="Promotional">Promotional</option>
                    <option value="Artist-Agreement">Artist-Agreement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Source Provider</label>
                  <select
                    value={formData.sourceProvider}
                    onChange={(e) => setFormData(prev => ({ ...prev, sourceProvider: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="direct_license">Direct License</option>
                    <option value="artist_direct">Artist Direct</option>
                    <option value="creative_commons">Creative Commons</option>
                    <option value="public_domain">Public Domain</option>
                    <option value="label_agreement">Label Agreement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Thumbnail URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.thumbnail}
                  onChange={(e) => setFormData(prev => ({ ...prev, thumbnail: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="offlineEligible"
                  checked={formData.offlineEligible}
                  onChange={(e) => setFormData(prev => ({ ...prev, offlineEligible: e.target.checked }))}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-neutral-950 border-neutral-800"
                />
                <label htmlFor="offlineEligible" className="text-xs text-white font-medium select-none cursor-pointer">
                  Authorize this track for offline encrypted download
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingLicense ? 'Save Changes' : 'Register License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke / Delete Confirmation Modal */}
      {licenseToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl p-6 text-xs text-neutral-300 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Revoke Track License</h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Are you sure you want to permanently revoke the license for <span className="text-white font-bold">{licenseToDelete.title}</span> ({licenseToDelete.trackId})? Users will no longer be permitted to download or cache this song for offline playback.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setLicenseToDelete(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDelete}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold disabled:opacity-50"
              >
                {isSubmitting ? 'Revoking...' : 'Yes, Revoke License'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

