import React, { useState, useEffect } from 'react';
import { 
  Music, 
  ListMusic, 
  Radio, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  ExternalLink, 
  Check, 
  RefreshCw, 
  Search,
  Sparkles,
  Layers
} from 'lucide-react';
import { safeParseJsonResponse } from '../../utils/errorHandler';
import { normalizeCmsConfig } from '../../services/cmsClient';

export default function CmsMusicManager({ 
  draft, 
  onUpdateDraft, 
  token, 
  backendUrl, 
  showToast, 
  onOpenMediaPicker,
  onSaveDraft,
  onPublishLive,
  isSavingDraft,
  isPublishingLive
}) {
  const [activeTab, setActiveTab] = useState('collections');
  const [collections, setCollections] = useState([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  // New Collection Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColCategory, setNewColCategory] = useState('featured');
  const [newColDesc, setNewColDesc] = useState('');
  const [newColCover, setNewColCover] = useState('');
  const [newColHome, setNewColHome] = useState(true);

  // Add Track Form state
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const [trackVideoId, setTrackVideoId] = useState('');
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [trackAlbum, setTrackAlbum] = useState('');
  const [trackDuration, setTrackDuration] = useState('');
  const [trackThumbnail, setTrackThumbnail] = useState('');

  // Station Metadata state (from draft)
  const safeDraft = normalizeCmsConfig(draft);
  const stations = safeDraft.stations || [];

  // Fetch Collections
  const fetchCollections = async () => {
    setIsLoadingCollections(true);
    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/curated`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Fetch collections failed');
      if (parsed.ok && parsed.data?.collections) {
        setCollections(parsed.data.collections);
      }
    } catch (err) {
      if (showToast) showToast('Failed to load curated collections', 'error');
    } finally {
      setIsLoadingCollections(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, [backendUrl, token]);

  // Load single collection details & tracks
  const loadCollectionDetails = async (colId) => {
    setIsLoadingTracks(true);
    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/curated/${colId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Fetch collection details failed');
      if (parsed.ok && parsed.data) {
        setSelectedCollection(parsed.data);
      }
    } catch (err) {
      if (showToast) showToast('Failed to load collection tracks', 'error');
    } finally {
      setIsLoadingTracks(false);
    }
  };

  // Create Collection
  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newColName.trim()) {
      if (showToast) showToast('Collection name is required', 'error');
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/curated`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newColName.trim(),
          category: newColCategory,
          description: newColDesc.trim(),
          coverArt: newColCover.trim(),
          isFeaturedOnHome: newColHome,
          isPublished: true
        })
      });
      const parsed = await safeParseJsonResponse(res, 'Create collection failed');
      if (parsed.ok) {
        if (showToast) showToast('Curated collection created!', 'success');
        setShowCreateModal(false);
        setNewColName('');
        setNewColDesc('');
        setNewColCover('');
        fetchCollections();
      } else {
        if (showToast) showToast(parsed.error || 'Failed to create collection', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Delete Collection
  const handleDeleteCollection = async (colId, name) => {
    if (!window.confirm(`Are you sure you want to delete collection "${name}"?`)) return;
    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/curated/${colId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Delete collection failed');
      if (parsed.ok) {
        if (showToast) showToast('Collection deleted', 'success');
        if (selectedCollection?.id === colId) setSelectedCollection(null);
        fetchCollections();
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Toggle collection home status
  const handleToggleHome = async (col) => {
    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/curated/${col.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isFeaturedOnHome: !col.isFeaturedOnHome })
      });
      const parsed = await safeParseJsonResponse(res, 'Update failed');
      if (parsed.ok) {
        fetchCollections();
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Add Track
  const handleAddTrack = async (e) => {
    e.preventDefault();
    if (!selectedCollection) return;
    if (!trackVideoId.trim() || !trackTitle.trim()) {
      if (showToast) showToast('YouTube Video ID and Track Title are required', 'error');
      return;
    }

    const cleanVid = trackVideoId.trim();
    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/curated/${selectedCollection.id}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          videoId: cleanVid,
          title: trackTitle.trim(),
          artist: trackArtist.trim() || 'Unknown Artist',
          album: trackAlbum.trim(),
          duration: trackDuration.trim(),
          thumbnail: trackThumbnail.trim() || `https://i.ytimg.com/vi/${cleanVid}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${cleanVid}`
        })
      });
      const parsed = await safeParseJsonResponse(res, 'Add track failed');
      if (parsed.ok) {
        if (showToast) showToast('Track added to collection!', 'success');
        setShowAddTrackModal(false);
        setTrackVideoId('');
        setTrackTitle('');
        setTrackArtist('');
        setTrackAlbum('');
        setTrackDuration('');
        setTrackThumbnail('');
        loadCollectionDetails(selectedCollection.id);
        fetchCollections();
      } else {
        if (showToast) showToast(parsed.error || 'Failed to add track', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Remove Track
  const handleRemoveTrack = async (trackId) => {
    if (!selectedCollection) return;
    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/curated/${selectedCollection.id}/tracks/${trackId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Remove track failed');
      if (parsed.ok) {
        if (showToast) showToast('Track removed', 'success');
        loadCollectionDetails(selectedCollection.id);
        fetchCollections();
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Toggle Track Visibility
  const handleToggleTrackHide = async (trackIndex) => {
    if (!selectedCollection) return;
    const updatedTracks = [...selectedCollection.tracks];
    updatedTracks[trackIndex] = {
      ...updatedTracks[trackIndex],
      isHidden: !updatedTracks[trackIndex].isHidden
    };

    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/curated/${selectedCollection.id}/tracks`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tracks: updatedTracks })
      });
      const parsed = await safeParseJsonResponse(res, 'Update tracks failed');
      if (parsed.ok) {
        setSelectedCollection(prev => ({ ...prev, tracks: updatedTracks }));
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Move Track
  const handleMoveTrack = async (index, direction) => {
    if (!selectedCollection) return;
    const list = [...selectedCollection.tracks];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const temp = list[index];
    list[index] = list[target];
    list[target] = temp;

    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/curated/${selectedCollection.id}/tracks`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tracks: list })
      });
      const parsed = await safeParseJsonResponse(res, 'Update tracks failed');
      if (parsed.ok) {
        setSelectedCollection(prev => ({ ...prev, tracks: list }));
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Station Metadata Updates in Draft
  const handleStationField = (index, field, value) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const updated = [...(base.stations || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...base, stations: updated };
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setActiveTab('collections')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'collections'
              ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
          }`}
        >
          <ListMusic className="w-3.5 h-3.5" />
          <span>Curated Collections & Playlists ({collections.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('stations')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'stations'
              ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Nostalgia Stations ({stations.length})</span>
        </button>
      </div>

      {/* 1. CURATED COLLECTIONS */}
      {activeTab === 'collections' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">Editorial Collections & Playlists</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Curate custom track sets, featured playlists, and home page collections without touching code.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Collection</span>
            </button>
          </div>

          {/* Collections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map(col => {
              const isSelected = selectedCollection?.id === col.id;
              return (
                <div
                  key={col.id}
                  onClick={() => loadCollectionDetails(col.id)}
                  className={`p-4 rounded-2xl border transition cursor-pointer backdrop-blur-md relative ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
                      : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/90'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={col.coverArt || `https://ui-avatars.com/api/?name=${encodeURIComponent(col.name)}&background=1e1e1e&color=f59e0b&size=200`}
                      alt={col.name}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-neutral-800 shadow"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          {col.category}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {col.tracksCount} tracks
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white truncate mt-1.5">{col.name}</h4>
                      <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">{col.description || 'No description'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-800/60 text-xs">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleHome(col); }}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition ${
                        col.isFeaturedOnHome
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                      }`}
                    >
                      {col.isFeaturedOnHome ? '★ Featured on Home' : 'Not on Home'}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteCollection(col.id, col.name); }}
                      className="text-neutral-500 hover:text-rose-400 p-1 transition"
                      title="Delete Collection"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Collection Tracks View */}
          {selectedCollection && (
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 md:p-6 space-y-4 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Tracks in "{selectedCollection.name}"</h3>
                    <span className="text-[10px] text-neutral-400 font-mono">({selectedCollection.tracks?.length || 0} tracks)</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Manage song order, YouTube IDs, or temporarily hide specific tracks.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddTrackModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Song</span>
                </button>
              </div>

              {isLoadingTracks ? (
                <div className="text-center py-6 text-xs text-neutral-400">Loading tracks...</div>
              ) : selectedCollection.tracks?.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  No tracks in this collection yet. Click "Add Song" to add YouTube tracks.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedCollection.tracks.map((track, idx) => (
                    <div
                      key={track.id || track.videoId || idx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                        track.isHidden
                          ? 'bg-neutral-950/40 border-neutral-900 opacity-50'
                          : 'bg-neutral-950 border-neutral-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-neutral-500 font-mono text-[11px] w-5 text-center">{idx + 1}</span>
                        <img
                          src={track.thumbnail || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`}
                          alt={track.title}
                          className="w-10 h-10 rounded-lg object-cover shrink-0 border border-neutral-800"
                        />
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{track.title}</h5>
                          <p className="text-[10px] text-neutral-400 truncate">
                            {track.artist} {track.duration ? `• ${track.duration}` : ''} • ID: {track.videoId}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveTrack(idx, -1)}
                          className="p-1 rounded bg-neutral-800 text-neutral-300 disabled:opacity-20"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === selectedCollection.tracks.length - 1}
                          onClick={() => handleMoveTrack(idx, 1)}
                          className="p-1 rounded bg-neutral-800 text-neutral-300 disabled:opacity-20"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleTrackHide(idx)}
                          className={`p-1.5 rounded-lg border transition ${
                            track.isHidden
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                          }`}
                          title={track.isHidden ? 'Hidden (Click to show)' : 'Visible (Click to hide)'}
                        >
                          {track.isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTrack(track.id || track.videoId)}
                          className="p-1.5 text-neutral-500 hover:text-rose-400 transition"
                          title="Remove from collection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. NOSTALGIA STATIONS */}
      {activeTab === 'stations' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
            <div>
              <span className="text-white font-semibold">Special Nostalgia Stations:</span> Saloon FM, Horn Ok Please, and Theka Session branding, artwork, and YouTube queries.
            </div>
            <div className="flex items-center gap-2">
              {onSaveDraft && (
                <button
                  type="button"
                  disabled={isSavingDraft}
                  onClick={onSaveDraft}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingDraft ? 'Saving...' : 'Save Station Changes'}
                </button>
              )}
              {onPublishLive && (
                <button
                  type="button"
                  disabled={isPublishingLive}
                  onClick={onPublishLive}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isPublishingLive ? 'Publishing...' : 'Publish Live'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {stations.map((st, idx) => (
              <div key={st.id || idx} className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white">{st.title}</span>
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono">
                      Station: {st.id}
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-neutral-950 px-3 py-1 rounded-xl border border-neutral-800">
                    <span className="text-xs text-neutral-300">Active</span>
                    <input
                      type="checkbox"
                      checked={st.enabled !== false}
                      onChange={(e) => handleStationField(idx, 'enabled', e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">Station Title</label>
                    <input
                      type="text"
                      value={st.title || ''}
                      onChange={(e) => handleStationField(idx, 'title', e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">Station Badge</label>
                    <input
                      type="text"
                      value={st.badge || ''}
                      onChange={(e) => handleStationField(idx, 'badge', e.target.value)}
                      placeholder="💈 Saloon FM • 90s Nostalgia"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">Subtitle / Bio</label>
                    <input
                      type="text"
                      value={st.subtitle || ''}
                      onChange={(e) => handleStationField(idx, 'subtitle', e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">Station Artwork URL</label>
                    <input
                      type="text"
                      value={st.artwork || ''}
                      onChange={(e) => handleStationField(idx, 'artwork', e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">Search Keywords Query</label>
                    <input
                      type="text"
                      value={(st.queries || []).join(', ')}
                      onChange={(e) => handleStationField(idx, 'queries', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))}
                      placeholder="90s bollywood hit songs, kumar sanu"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE COLLECTION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-white">Create New Curated Collection</h4>
            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Collection Name</label>
                <input
                  type="text"
                  required
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="e.g. 2000s Bollywood Romance"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Category</label>
                <select
                  value={newColCategory}
                  onChange={(e) => setNewColCategory(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="featured">Featured Collection</option>
                  <option value="trending">Trending Hits</option>
                  <option value="station">Station Music</option>
                  <option value="albums">Albums & Singles</option>
                  <option value="radio">Radio & Lo-Fi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                  placeholder="Short summary of this curated collection"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Cover Art URL</label>
                <input
                  type="text"
                  value={newColCover}
                  onChange={(e) => setNewColCover(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="featHome"
                  checked={newColHome}
                  onChange={(e) => setNewColHome(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <label htmlFor="featHome" className="text-xs text-neutral-300 cursor-pointer">
                  Feature this collection on the Home page feed
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow"
                >
                  Create Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TRACK MODAL */}
      {showAddTrackModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-white">Add Song to Collection</h4>
            <form onSubmit={handleAddTrack} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">YouTube Video ID (11 chars)</label>
                <input
                  type="text"
                  required
                  value={trackVideoId}
                  onChange={(e) => {
                    let val = e.target.value.trim();
                    const match = val.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || val.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                    if (match && match[1]) val = match[1];
                    setTrackVideoId(val);
                    if (val.length === 11) {
                      setTrackThumbnail(`https://i.ytimg.com/vi/${val}/hqdefault.jpg`);
                    }
                  }}
                  placeholder="e.g. Yvl6m9x5ZR0 or YouTube URL"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              {trackVideoId && (
                <div className="flex items-center gap-3 p-2 bg-neutral-950 rounded-xl border border-neutral-800">
                  <img
                    src={`https://i.ytimg.com/vi/${trackVideoId}/mqdefault.jpg`}
                    alt="Preview"
                    className="w-12 h-12 rounded object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="text-[11px] text-neutral-400 font-mono">Live thumbnail preview</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Song Title</label>
                <input
                  type="text"
                  required
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                  placeholder="e.g. Chura Ke Dil Mera"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Artist / Channel</label>
                <input
                  type="text"
                  value={trackArtist}
                  onChange={(e) => setTrackArtist(e.target.value)}
                  placeholder="Kumar Sanu, Alka Yagnik"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Album (Optional)</label>
                  <input
                    type="text"
                    value={trackAlbum}
                    onChange={(e) => setTrackAlbum(e.target.value)}
                    placeholder="Film / Album"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Duration (Optional)</label>
                  <input
                    type="text"
                    value={trackDuration}
                    onChange={(e) => setTrackDuration(e.target.value)}
                    placeholder="4:30"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddTrackModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow"
                >
                  Add Track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
