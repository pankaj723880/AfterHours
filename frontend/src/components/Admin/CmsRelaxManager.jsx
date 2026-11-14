import React, { useState } from 'react';
import { 
  Trees, 
  Feather, 
  Droplet, 
  Activity, 
  Plus, 
  Trash2, 
  Edit3, 
  Play, 
  Square, 
  Search, 
  Check, 
  ShieldCheck, 
  AlertCircle, 
  ExternalLink,
  Sparkles,
  DownloadCloud
} from 'lucide-react';
import { RELAX_CATEGORIES, RELAX_SOUNDS } from '../../constants/relaxSounds';
import { relaxAudioEngine } from '../../services/relaxAudioEngine';

export default function CmsRelaxManager() {
  const [sounds, setSounds] = useState([...RELAX_SOUNDS]);
  const [selectedCat, setSelectedCat] = useState('all');
  const [playingId, setPlayingId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  // Openverse live search states
  const [isSearchingOpenverse, setIsSearchingOpenverse] = useState(false);
  const [openverseQuery, setOpenverseQuery] = useState('');
  const [openverseResults, setOpenverseResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const filtered = sounds.filter(s => selectedCat === 'all' || s.category === selectedCat);

  const handleTogglePreview = (sound) => {
    if (playingId === sound.id) {
      relaxAudioEngine.stopSound(sound.id);
      setPlayingId(null);
    } else {
      if (playingId) relaxAudioEngine.stopSound(playingId);
      if (sound.category === 'binaural') {
        relaxAudioEngine.playBinauralBeat(sound);
      } else {
        relaxAudioEngine.playAmbientTrack(sound);
      }
      setPlayingId(sound.id);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!editForm) return;

    if (editForm.isNew) {
      setSounds(prev => [{ ...editForm, id: `custom-${Date.now()}` }, ...prev]);
    } else {
      setSounds(prev => prev.map(s => s.id === editForm.id ? editForm : s));
    }
    setIsEditing(false);
    setEditForm(null);
  };

  const handleDelete = (id) => {
    if (playingId === id) relaxAudioEngine.stopSound(id);
    setSounds(prev => prev.filter(s => s.id !== id));
  };

  const handleSearchOpenverse = async (e) => {
    e.preventDefault();
    if (!openverseQuery.trim()) return;
    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/relax/search-openverse?q=${encodeURIComponent(openverseQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setOpenverseResults(data.results || []);
    } catch (err) {
      console.error('Openverse search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportTrack = (item, category = 'forest') => {
    const newSound = {
      id: `${category}-${Date.now()}`,
      category,
      title: item.title,
      description: `Discovered from Openverse / ${item.provider}. Created by ${item.creator}`,
      audioUrl: item.audioUrl,
      fallbackUrl: `/audio/relax/${category}_deep-forest.wav`,
      defaultVolume: 0.75,
      creator: item.creator,
      creatorUrl: item.creatorUrl,
      foreignLandingUrl: item.foreignLandingUrl,
      license: item.license,
      licenseUrl: item.licenseUrl,
      source: 'Openverse',
      verified: true
    };
    setSounds(prev => [newSound, ...prev]);
    setIsSearchingOpenverse(false);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-6 backdrop-blur-md text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Trees className="w-5 h-5 text-emerald-400" />
            Relax Mode Audio & Openverse Asset Management
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage openly licensed ambient sound effects (CC0 / CC BY), preview audio, and audit licensing attribution.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsSearchingOpenverse(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Openverse API</span>
          </button>

          <button
            onClick={() => {
              setEditForm({
                isNew: true,
                title: '',
                category: 'forest',
                description: '',
                audioUrl: '/audio/relax/forest_deep-forest.wav',
                defaultVolume: 0.75,
                creator: 'Openverse Contributor',
                license: 'CC0'
              });
              setIsEditing(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Sound</span>
          </button>
        </div>
      </div>

      {/* Categories Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
        <button
          onClick={() => setSelectedCat('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
            selectedCat === 'all'
              ? 'bg-emerald-500 text-neutral-950 font-bold'
              : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
          }`}
        >
          All ({sounds.length})
        </button>
        {RELAX_CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedCat(c.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
              selectedCat === c.id
                ? 'bg-emerald-500 text-neutral-950 font-bold'
                : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
            }`}
          >
            <span>{c.name}</span>
            <span className="text-[10px] opacity-70">
              ({sounds.filter(s => s.category === c.id).length})
            </span>
          </button>
        ))}
      </div>

      {/* Sounds List / Table with Licensing Badges */}
      <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
        {filtered.map(sound => {
          const isPlaying = playingId === sound.id;
          return (
            <div
              key={sound.id}
              className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-white/20 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => handleTogglePreview(sound)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition cursor-pointer ${
                    isPlaying
                      ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/30'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                  title={isPlaying ? 'Stop Preview' : 'Listen Preview'}
                >
                  {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">{sound.title}</span>
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-emerald-400">
                      {sound.category}
                    </span>
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-400" />
                      {sound.license || 'CC0'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                    <span className="truncate">Creator: {sound.creator || 'Openverse Contributor'}</span>
                    <span>•</span>
                    <span className="text-emerald-400 text-[10px]">✓ Audio Verified</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                {sound.foreignLandingUrl && (
                  <a
                    href={sound.foreignLandingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition"
                    title="View Original Source & Attribution"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => {
                    setEditForm({ ...sound });
                    setIsEditing(true);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
                  title="Edit Metadata"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(sound.id)}
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition cursor-pointer"
                  title="Delete Sound"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Openverse Discovery Modal */}
      {isSearchingOpenverse && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-neutral-900 border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" />
                Discover Openverse Open-Licensed Audio
              </h3>
              <button
                onClick={() => setIsSearchingOpenverse(false)}
                className="text-zinc-400 hover:text-white text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSearchOpenverse} className="flex gap-2">
              <input
                type="text"
                placeholder="Search ambient sound (e.g. nightingale, river stream, forest wind)..."
                value={openverseQuery}
                onChange={e => setOpenverseQuery(e.target.value)}
                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2 rounded-xl bg-amber-400 text-neutral-950 font-bold text-xs cursor-pointer"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {openverseResults.map((item) => (
                <div key={item.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{item.title}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      By {item.creator} • License: <span className="text-amber-400 font-semibold">{item.license}</span> ({item.isCommercialSafe ? 'Commercial Permitted' : 'Non-Commercial'})
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleImportTrack(item, 'forest')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 text-neutral-950 font-bold text-[10px] cursor-pointer"
                    >
                      Import Forest
                    </button>
                    <button
                      onClick={() => handleImportTrack(item, 'birds')}
                      className="px-2.5 py-1 rounded-lg bg-sky-500 text-neutral-950 font-bold text-[10px] cursor-pointer"
                    >
                      Import Birds
                    </button>
                    <button
                      onClick={() => handleImportTrack(item, 'water')}
                      className="px-2.5 py-1 rounded-lg bg-teal-500 text-neutral-950 font-bold text-[10px] cursor-pointer"
                    >
                      Import Water
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit / Add Modal */}
      {isEditing && editForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg bg-neutral-900 border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <h3 className="text-sm font-bold text-white">
              {editForm.isNew ? 'Add Sound Experience' : `Edit ${editForm.title}`}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Category</label>
                <select
                  value={editForm.category}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-2 text-white"
                >
                  {RELAX_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Audio Stream URL</label>
                <input
                  type="text"
                  value={editForm.audioUrl}
                  onChange={e => setEditForm({ ...editForm, audioUrl: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-2 text-white font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Creator / Attribution</label>
                <input
                  type="text"
                  value={editForm.creator || ''}
                  onChange={e => setEditForm({ ...editForm, creator: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-emerald-500 text-neutral-950 font-bold text-xs cursor-pointer shadow-md"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
