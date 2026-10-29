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
  Layers,
  ShieldCheck,
  Disc,
  Calendar,
  ChevronUp,
  ChevronDown,
  X,
  AlertTriangle
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

  // Edit Collection Form state
  const [editingCollection, setEditingCollection] = useState(null);
  const [editColName, setEditColName] = useState('');
  const [editColCategory, setEditColCategory] = useState('featured');
  const [editColDesc, setEditColDesc] = useState('');
  const [editColCover, setEditColCover] = useState('');
  const [editColHome, setEditColHome] = useState(true);

  // Add Track Form state
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const [trackVideoId, setTrackVideoId] = useState('');
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [trackAlbum, setTrackAlbum] = useState('');
  const [trackDuration, setTrackDuration] = useState('');
  const [trackThumbnail, setTrackThumbnail] = useState('');

  // Licensed Tracks State (Tab 3)
  const [licenses, setLicenses] = useState([]);
  const [isLoadingLicenses, setIsLoadingLicenses] = useState(false);
  const [licenseSearch, setLicenseSearch] = useState('');
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState(null);
  const [licTrackId, setLicTrackId] = useState('');
  const [licTitle, setLicTitle] = useState('');
  const [licArtist, setLicArtist] = useState('');
  const [licChannel, setLicChannel] = useState('');
  const [licThumbnail, setLicThumbnail] = useState('');
  const [licDuration, setLicDuration] = useState('');
  const [licEligible, setLicEligible] = useState(true);
  const [licProvider, setLicProvider] = useState('direct_license');
  const [licPermission, setLicPermission] = useState('offline_download_permitted');
  const [licType, setLicType] = useState('Direct-License');
  const [licReference, setLicReference] = useState('');
  const [licNotes, setLicNotes] = useState('');

  // Time Machine Eras State (Tab 4)
  const safeDraft = normalizeCmsConfig(draft);
  const stations = safeDraft.stations || [];
  const timeMachineEras = safeDraft.timeMachineEras || [];
  const [showEraModal, setShowEraModal] = useState(false);
  const [editingEraIndex, setEditingEraIndex] = useState(null);
  const [eraId, setEraId] = useState('');
  const [eraTitle, setEraTitle] = useState('');
  const [eraDecade, setEraDecade] = useState('1990s');
  const [eraSubtitle, setEraSubtitle] = useState('');
  const [eraDesc, setEraDesc] = useState('');
  const [eraBadge, setEraBadge] = useState('');
  const [eraArtwork, setEraArtwork] = useState('');
  const [eraEnabled, setEraEnabled] = useState(true);
  const [eraQueries, setEraQueries] = useState('');
  const [eraGenres, setEraGenres] = useState('');

  // Nostalgia Station Management State
  const [stationSearch, setStationSearch] = useState('');
  const [showStationModal, setShowStationModal] = useState(false);
  const [editingStationIndex, setEditingStationIndex] = useState(null);
  const [stFormId, setStFormId] = useState('');
  const [stFormTitle, setStFormTitle] = useState('');
  const [stFormSubtitle, setStFormSubtitle] = useState('');
  const [stFormBadge, setStFormBadge] = useState('');
  const [stFormArtwork, setStFormArtwork] = useState('');
  const [stFormIcon, setStFormIcon] = useState('radio');
  const [stFormAccentColor, setStFormAccentColor] = useState('#f59e0b');
  const [stFormCategory, setStFormCategory] = useState('Nostalgia');
  const [stFormLanguage, setStFormLanguage] = useState('Hindi');
  const [stFormQueries, setStFormQueries] = useState('');
  const [stFormIsActive, setStFormIsActive] = useState(true);
  const [stationToDelete, setStationToDelete] = useState(null);

  // Station Track Management State
  const [showTracksModal, setShowTracksModal] = useState(false);
  const [trackStationIndex, setTrackStationIndex] = useState(null);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackArtist, setNewTrackArtist] = useState('');
  const [newTrackVideoId, setNewTrackVideoId] = useState('');
  const [newTrackDuration, setNewTrackDuration] = useState('3:30');
  const [newTrackThumbnail, setNewTrackThumbnail] = useState('');
  const [stationTrackSearch, setStationTrackSearch] = useState('');

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

  // Open Edit Collection Modal
  const openEditCollectionModal = (col) => {
    setEditingCollection(col);
    setEditColName(col.name || '');
    setEditColCategory(col.category || 'featured');
    setEditColDesc(col.description || '');
    setEditColCover(col.coverArt || '');
    setEditColHome(Boolean(col.isFeaturedOnHome));
  };

  // Submit Update Collection
  const handleUpdateCollection = async (e) => {
    e.preventDefault();
    if (!editingCollection) return;
    if (!editColName.trim()) {
      if (showToast) showToast('Collection name is required', 'error');
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/curated/${editingCollection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editColName.trim(),
          category: editColCategory,
          description: editColDesc.trim(),
          coverArt: editColCover.trim(),
          isFeaturedOnHome: editColHome
        })
      });
      const parsed = await safeParseJsonResponse(res, 'Update collection failed');
      if (parsed.ok) {
        if (showToast) showToast('Collection updated successfully', 'success');
        setEditingCollection(null);
        fetchCollections();
        if (selectedCollection?.id === editingCollection.id) {
          setSelectedCollection(prev => ({
            ...prev,
            name: editColName.trim(),
            category: editColCategory,
            description: editColDesc.trim(),
            coverArt: editColCover.trim(),
            isFeaturedOnHome: editColHome
          }));
        }
      } else {
        if (showToast) showToast(parsed.error || 'Failed to update collection', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Licensed Tracks Handlers
  const fetchLicenses = async () => {
    setIsLoadingLicenses(true);
    try {
      const res = await fetch(`${backendUrl}/api/offline/admin/licenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Fetch licenses failed');
      if (parsed.ok && parsed.data?.licenses) {
        setLicenses(parsed.data.licenses);
      }
    } catch (err) {
      if (showToast) showToast('Failed to load track licenses', 'error');
    } finally {
      setIsLoadingLicenses(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'licenses') {
      fetchLicenses();
    }
  }, [activeTab]);

  const openLicenseModal = (lic = null) => {
    if (lic) {
      setEditingLicense(lic);
      setLicTrackId(lic.trackId || '');
      setLicTitle(lic.title || '');
      setLicArtist(lic.artist || '');
      setLicChannel(lic.channel || '');
      setLicThumbnail(lic.thumbnail || '');
      setLicDuration(lic.duration || '');
      setLicEligible(lic.offlineEligible !== false);
      setLicProvider(lic.sourceProvider || 'direct_license');
      setLicPermission(lic.permissionScope || 'offline_download_permitted');
      setLicType(lic.licenseType || 'Direct-License');
      setLicReference(lic.licenseReference || '');
      setLicNotes(lic.notes || '');
    } else {
      setEditingLicense(null);
      setLicTrackId('');
      setLicTitle('');
      setLicArtist('');
      setLicChannel('');
      setLicThumbnail('');
      setLicDuration('');
      setLicEligible(true);
      setLicProvider('direct_license');
      setLicPermission('offline_download_permitted');
      setLicType('Direct-License');
      setLicReference('');
      setLicNotes('');
    }
    setShowLicenseModal(true);
  };

  const handleSaveLicense = async (e) => {
    e.preventDefault();
    if (!licTrackId.trim() || !licTitle.trim()) {
      if (showToast) showToast('Track ID and Title are required', 'error');
      return;
    }
    const cleanId = licTrackId.trim();
    const payload = {
      trackId: cleanId,
      title: licTitle.trim(),
      artist: licArtist.trim() || 'Unknown Artist',
      channel: licChannel.trim(),
      thumbnail: licThumbnail.trim() || `https://i.ytimg.com/vi/${cleanId}/mqdefault.jpg`,
      duration: licDuration.trim(),
      offlineEligible: licEligible,
      sourceProvider: licProvider,
      permissionScope: licPermission,
      licenseType: licType,
      licenseReference: licReference.trim(),
      notes: licNotes.trim()
    };

    try {
      const url = editingLicense 
        ? `${backendUrl}/api/offline/admin/licenses/${encodeURIComponent(cleanId)}`
        : `${backendUrl}/api/offline/admin/licenses`;
      const method = editingLicense ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const parsed = await safeParseJsonResponse(res, 'Save license failed');
      if (parsed.ok) {
        if (showToast) showToast(editingLicense ? 'License updated!' : 'License added!', 'success');
        setShowLicenseModal(false);
        fetchLicenses();
      } else {
        if (showToast) showToast(parsed.error || 'Failed to save license', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleDeleteLicense = async (trackId, title) => {
    if (!window.confirm(`Revoke / delete license for "${title || trackId}"?`)) return;
    try {
      const res = await fetch(`${backendUrl}/api/offline/admin/licenses/${encodeURIComponent(trackId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Delete license failed');
      if (parsed.ok) {
        if (showToast) showToast('License revoked successfully', 'success');
        fetchLicenses();
      } else {
        if (showToast) showToast(parsed.error || 'Failed to revoke license', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Time Machine Era Handlers
  const openEraModal = (index = null) => {
    if (index !== null && timeMachineEras[index]) {
      const era = timeMachineEras[index];
      setEditingEraIndex(index);
      setEraId(era.id || '');
      setEraTitle(era.title || '');
      setEraDecade(era.decade || '1990s');
      setEraSubtitle(era.subtitle || '');
      setEraDesc(era.description || '');
      setEraBadge(era.badge || '');
      setEraArtwork(era.artwork || '');
      setEraEnabled(era.enabled !== false);
      setEraQueries((era.queries || []).join('\n'));
      setEraGenres((era.genres || []).join(', '));
    } else {
      setEditingEraIndex(null);
      setEraId(`era_${Date.now().toString(36)}`);
      setEraTitle('');
      setEraDecade('1990s');
      setEraSubtitle('');
      setEraDesc('');
      setEraBadge('');
      setEraArtwork('');
      setEraEnabled(true);
      setEraQueries('');
      setEraGenres('');
    }
    setShowEraModal(true);
  };

  const handleSaveEra = (e) => {
    e.preventDefault();
    if (!eraTitle.trim()) {
      if (showToast) showToast('Era title is required', 'error');
      return;
    }
    const cleanQueries = eraQueries
      .split('\n')
      .map(q => q.trim())
      .filter(Boolean);
    const cleanGenres = eraGenres
      .split(',')
      .map(g => g.trim())
      .filter(Boolean);

    const eraObj = {
      id: eraId || eraDecade.toLowerCase(),
      title: eraTitle.trim(),
      decade: eraDecade,
      subtitle: eraSubtitle.trim(),
      description: eraDesc.trim(),
      badge: eraBadge.trim() || `📻 ${eraDecade}`,
      artwork: eraArtwork.trim(),
      enabled: eraEnabled,
      order: editingEraIndex !== null ? (timeMachineEras[editingEraIndex]?.order || editingEraIndex + 1) : timeMachineEras.length + 1,
      queries: cleanQueries.length > 0 ? cleanQueries : [`${eraDecade} bollywood songs hits`],
      genres: cleanGenres.length > 0 ? cleanGenres : ['Retro Bollywood']
    };

    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const currentEras = [...(base.timeMachineEras || [])];
      if (editingEraIndex !== null) {
        currentEras[editingEraIndex] = eraObj;
      } else {
        currentEras.push(eraObj);
      }
      return { ...base, timeMachineEras: currentEras };
    });

    setShowEraModal(false);
    if (showToast) showToast(editingEraIndex !== null ? 'Time Machine era updated in draft' : 'Time Machine era added to draft', 'success');
  };

  const handleDeleteEra = (index) => {
    if (!window.confirm(`Delete era "${timeMachineEras[index]?.title || 'Era'}"?`)) return;
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const currentEras = (base.timeMachineEras || []).filter((_, i) => i !== index);
      return { ...base, timeMachineEras: currentEras };
    });
    if (showToast) showToast('Era deleted from draft', 'success');
  };

  const handleToggleEra = (index) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const currentEras = [...(base.timeMachineEras || [])];
      if (currentEras[index]) {
        currentEras[index] = { ...currentEras[index], enabled: !currentEras[index].enabled };
      }
      return { ...base, timeMachineEras: currentEras };
    });
  };

  const handleMoveEra = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= timeMachineEras.length) return;
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const currentEras = [...(base.timeMachineEras || [])];
      const temp = currentEras[index];
      currentEras[index] = currentEras[target];
      currentEras[target] = temp;
      return { ...base, timeMachineEras: currentEras };
    });
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

  const slugify = (text) => {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const extractYouTubeId = (urlOrId) => {
    if (!urlOrId) return '';
    const trimmed = urlOrId.trim();
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : trimmed;
  };

  const openAddStationModal = () => {
    setEditingStationIndex(null);
    setStFormId('');
    setStFormTitle('');
    setStFormSubtitle('');
    setStFormBadge('');
    setStFormArtwork('');
    setStFormIcon('radio');
    setStFormAccentColor('#f59e0b');
    setStFormCategory('Nostalgia');
    setStFormLanguage('Hindi');
    setStFormQueries('');
    setStFormIsActive(true);
    setShowStationModal(true);
  };

  const openEditStationModal = (index) => {
    const st = stations[index];
    if (!st) return;
    setEditingStationIndex(index);
    setStFormId(st.id || '');
    setStFormTitle(st.title || st.name || '');
    setStFormSubtitle(st.subtitle || st.description || '');
    setStFormBadge(st.badge || '');
    setStFormArtwork(st.artwork || st.artworkUrl || (st.bgImages?.[0] || ''));
    setStFormIcon(st.icon || 'radio');
    setStFormAccentColor(st.accentColor || '#f59e0b');
    setStFormCategory(st.category || 'Nostalgia');
    setStFormLanguage(st.language || 'Hindi');
    setStFormQueries(Array.isArray(st.queries) ? st.queries.join(', ') : (st.queries || ''));
    setStFormIsActive(st.isActive !== false && st.enabled !== false);
    setShowStationModal(true);
  };

  const handleSaveStationModal = () => {
    if (!stFormTitle.trim()) {
      if (showToast) showToast('Station title is required', 'error');
      return;
    }
    const slug = (stFormId || slugify(stFormTitle)).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!slug) {
      if (showToast) showToast('Valid station slug/ID is required', 'error');
      return;
    }

    const queryList = stFormQueries
      .split(',')
      .map(q => q.trim())
      .filter(Boolean);

    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const list = [...(base.stations || [])];

      if (editingStationIndex !== null && list[editingStationIndex]) {
        list[editingStationIndex] = {
          ...list[editingStationIndex],
          id: slug,
          title: stFormTitle.trim(),
          subtitle: stFormSubtitle.trim(),
          badge: stFormBadge.trim() || `📻 ${stFormTitle.trim()}`,
          artwork: stFormArtwork.trim(),
          icon: stFormIcon,
          accentColor: stFormAccentColor,
          category: stFormCategory,
          language: stFormLanguage,
          queries: queryList.length > 0 ? queryList : [stFormTitle.trim()],
          isActive: stFormIsActive,
          enabled: stFormIsActive,
          bgImages: stFormArtwork.trim() ? [stFormArtwork.trim()] : list[editingStationIndex].bgImages || []
        };
      } else {
        if (list.some(s => s.id === slug)) {
          if (showToast) showToast(`Station ID "${slug}" already exists`, 'error');
          return base;
        }
        list.push({
          id: slug,
          title: stFormTitle.trim(),
          subtitle: stFormSubtitle.trim(),
          badge: stFormBadge.trim() || `📻 ${stFormTitle.trim()}`,
          artwork: stFormArtwork.trim() || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80',
          icon: stFormIcon,
          accentColor: stFormAccentColor,
          category: stFormCategory,
          language: stFormLanguage,
          queries: queryList.length > 0 ? queryList : [stFormTitle.trim()],
          isActive: stFormIsActive,
          enabled: stFormIsActive,
          tracks: [],
          bgImages: [stFormArtwork.trim() || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80']
        });
      }

      return { ...base, stations: list };
    });

    setShowStationModal(false);
    if (showToast) showToast(editingStationIndex !== null ? 'Station updated' : 'Station added');
  };

  const handleToggleStationActive = (index) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const list = [...(base.stations || [])];
      if (list[index]) {
        const nextActive = !(list[index].isActive !== false && list[index].enabled !== false);
        list[index] = { ...list[index], isActive: nextActive, enabled: nextActive };
      }
      return { ...base, stations: list };
    });
  };

  const handleMoveStation = (index, direction) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const list = [...(base.stations || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= list.length) return base;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return { ...base, stations: list };
    });
  };

  const handleDeleteStation = (index) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const list = [...(base.stations || [])];
      if (list.length <= 1) {
        if (showToast) showToast('Cannot delete the last remaining station', 'error');
        return base;
      }
      list.splice(index, 1);
      return { ...base, stations: list };
    });
    setStationToDelete(null);
    if (showToast) showToast('Station deleted');
  };

  const openManageTracksModal = (index) => {
    setTrackStationIndex(index);
    setNewTrackTitle('');
    setNewTrackArtist('');
    setNewTrackVideoId('');
    setNewTrackDuration('3:30');
    setNewTrackThumbnail('');
    setStationTrackSearch('');
    setShowTracksModal(true);
  };

  const handleAddTrackToStation = () => {
    if (!newTrackTitle.trim()) {
      if (showToast) showToast('Track title is required', 'error');
      return;
    }
    const vid = extractYouTubeId(newTrackVideoId);
    if (!vid) {
      if (showToast) showToast('YouTube video ID or URL is required', 'error');
      return;
    }

    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const list = [...(base.stations || [])];
      if (trackStationIndex !== null && list[trackStationIndex]) {
        const currentTracks = Array.isArray(list[trackStationIndex].tracks) ? [...list[trackStationIndex].tracks] : [];
        const thumb = newTrackThumbnail.trim() || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
        currentTracks.push({
          id: vid,
          videoId: vid,
          title: newTrackTitle.trim(),
          artist: newTrackArtist.trim() || 'Unknown Artist',
          album: list[trackStationIndex].title || 'Nostalgia Station',
          duration: newTrackDuration.trim() || '3:30',
          thumbnail: thumb,
          url: `https://www.youtube.com/watch?v=${vid}`,
          isHidden: false
        });
        list[trackStationIndex] = { ...list[trackStationIndex], tracks: currentTracks };
      }
      return { ...base, stations: list };
    });

    setNewTrackTitle('');
    setNewTrackArtist('');
    setNewTrackVideoId('');
    setNewTrackThumbnail('');
    if (showToast) showToast('Track added to station');
  };

  const handleDeleteTrackFromStation = (trackIdx) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const list = [...(base.stations || [])];
      if (trackStationIndex !== null && list[trackStationIndex]) {
        const currentTracks = Array.isArray(list[trackStationIndex].tracks) ? [...list[trackStationIndex].tracks] : [];
        currentTracks.splice(trackIdx, 1);
        list[trackStationIndex] = { ...list[trackStationIndex], tracks: currentTracks };
      }
      return { ...base, stations: list };
    });
    if (showToast) showToast('Track removed from station');
  };

  const handleMoveTrackInStation = (trackIdx, direction) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const list = [...(base.stations || [])];
      if (trackStationIndex !== null && list[trackStationIndex]) {
        const currentTracks = Array.isArray(list[trackStationIndex].tracks) ? [...list[trackStationIndex].tracks] : [];
        const targetIdx = trackIdx + direction;
        if (targetIdx < 0 || targetIdx >= currentTracks.length) return base;
        const temp = currentTracks[trackIdx];
        currentTracks[trackIdx] = currentTracks[targetIdx];
        currentTracks[targetIdx] = temp;
        list[trackStationIndex] = { ...list[trackStationIndex], tracks: currentTracks };
      }
      return { ...base, stations: list };
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

        <button
          onClick={() => setActiveTab('licenses')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'licenses'
              ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Licensed & Offline Catalogue ({licenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('timeMachineEras')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'timeMachineEras'
              ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
          }`}
        >
          <Disc className="w-3.5 h-3.5" />
          <span>Time Machine Eras ({timeMachineEras.length})</span>
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

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEditCollectionModal(col); }}
                        className="text-neutral-500 hover:text-amber-400 p-1 transition cursor-pointer"
                        title="Edit Collection Metadata"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteCollection(col.id, col.name); }}
                        className="text-neutral-500 hover:text-rose-400 p-1 transition cursor-pointer"
                        title="Delete Collection"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-neutral-400 backdrop-blur-md">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-400" />
                Nostalgia Stations ({stations.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage live nostalgia radio stations, artwork, query search tags, and curated track catalogues.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openAddStationModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Station</span>
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

          {/* Search Filter */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search stations by title, slug ID, category, or language..."
              value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)}
              className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-amber-500/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 outline-none transition"
            />
          </div>

          {/* Stations List */}
          <div className="grid grid-cols-1 gap-4">
            {stations
              .map((st, idx) => ({ st, originalIndex: idx }))
              .filter(({ st }) => {
                if (!stationSearch.trim()) return true;
                const q = stationSearch.toLowerCase();
                return (
                  st.title?.toLowerCase().includes(q) ||
                  st.id?.toLowerCase().includes(q) ||
                  st.category?.toLowerCase().includes(q) ||
                  st.language?.toLowerCase().includes(q)
                );
              })
              .map(({ st, originalIndex }) => {
                const isActive = st.isActive !== false && st.enabled !== false;
                const trackCount = Array.isArray(st.tracks) ? st.tracks.length : 0;
                const artworkSrc = st.artwork || st.artworkUrl || st.bgImages?.[0];

                return (
                  <div
                    key={st.id || originalIndex}
                    className={`bg-neutral-900/60 border rounded-2xl p-5 space-y-4 backdrop-blur-md transition ${
                      isActive ? 'border-neutral-800 hover:border-neutral-700' : 'border-neutral-900 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
                      <div className="flex items-center gap-3">
                        {artworkSrc ? (
                          <div className="w-10 h-10 rounded-xl overflow-hidden border border-neutral-700 shrink-0 bg-neutral-950">
                            <img src={artworkSrc} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                            <Radio className="w-5 h-5 text-amber-400" />
                          </div>
                        )}
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{st.title}</h4>
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono">
                              /{st.id}
                            </span>
                            {st.category && (
                              <span className="text-[10px] text-neutral-300 bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-700">
                                {st.category}
                              </span>
                            )}
                            {st.language && (
                              <span className="text-[10px] text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded-full border border-neutral-800">
                                {st.language}
                              </span>
                            )}
                          </div>
                          {st.subtitle && (
                            <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">{st.subtitle}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800">
                          <span className="text-xs text-neutral-300">{isActive ? 'Active' : 'Disabled'}</span>
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => handleToggleStationActive(originalIndex)}
                            className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800/80">
                        <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Badge</span>
                        <span className="text-white font-medium truncate block">{st.badge || '—'}</span>
                      </div>
                      <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800/80">
                        <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Curated Tracks</span>
                        <span className="text-amber-400 font-bold block">{trackCount} tracks</span>
                      </div>
                      <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800/80">
                        <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Accent Color</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: st.accentColor || '#f59e0b' }}
                          />
                          <span className="text-neutral-300 font-mono text-[11px]">{st.accentColor || '#f59e0b'}</span>
                        </div>
                      </div>
                      <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800/80">
                        <span className="text-neutral-500 block text-[10px] uppercase font-semibold">YouTube Queries</span>
                        <span className="text-neutral-300 truncate block">
                          {(st.queries || []).join(', ') || 'Default station query'}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800/60">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={originalIndex === 0}
                          onClick={() => handleMoveStation(originalIndex, -1)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-300 transition"
                          title="Move Station Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={originalIndex === stations.length - 1}
                          onClick={() => handleMoveStation(originalIndex, 1)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-300 transition"
                          title="Move Station Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openManageTracksModal(originalIndex)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer"
                        >
                          <ListMusic className="w-3.5 h-3.5 text-amber-400" />
                          <span>Manage Tracks ({trackCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditStationModal(originalIndex)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStationToDelete({ st, originalIndex })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-300 text-xs font-semibold border border-neutral-700 hover:border-red-500/40 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Add / Edit Station Modal */}
          {showStationModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-amber-400" />
                    {editingStationIndex !== null ? 'Edit Nostalgia Station' : 'Add New Nostalgia Station'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowStationModal(false)}
                    className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Banner Preview */}
                <div className="relative rounded-2xl overflow-hidden border border-neutral-800 h-28 bg-neutral-950 flex flex-col justify-end p-3">
                  {stFormArtwork ? (
                    <img src={stFormArtwork} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                  ) : null}
                  <div className="relative z-10 space-y-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-950/80 border border-amber-500/40 text-amber-300">
                      {stFormBadge || '📻 STATION BADGE'}
                    </span>
                    <h4 className="text-lg font-bold text-white truncate">{stFormTitle || 'Station Title'}</h4>
                    <p className="text-[11px] text-neutral-300 truncate">{stFormSubtitle || 'Station bio or tagline'}</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Station Title *</label>
                      <input
                        type="text"
                        placeholder="e.g. Retro Punjabi Hits"
                        value={stFormTitle}
                        onChange={(e) => {
                          setStFormTitle(e.target.value);
                          if (editingStationIndex === null && !stFormId) {
                            setStFormId(slugify(e.target.value));
                          }
                        }}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Station Slug / ID *</label>
                      <input
                        type="text"
                        placeholder="e.g. retro-punjabi"
                        value={stFormId}
                        onChange={(e) => setStFormId(slugify(e.target.value))}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-semibold mb-1">Subtitle / Bio</label>
                    <input
                      type="text"
                      placeholder="e.g. Golden era Punjabi tracks, highway dhabha energy & rustic melodies"
                      value={stFormSubtitle}
                      onChange={(e) => setStFormSubtitle(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Badge Text</label>
                      <input
                        type="text"
                        placeholder="e.g. 🚜 Horn Ok Please • Highway Vibe"
                        value={stFormBadge}
                        onChange={(e) => setStFormBadge(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Station Icon</label>
                      <select
                        value={stFormIcon}
                        onChange={(e) => setStFormIcon(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80 cursor-pointer"
                      >
                        <option value="radio">📻 Radio</option>
                        <option value="scissors">✂️ Scissors (Saloon)</option>
                        <option value="truck">🚛 Truck (Highway)</option>
                        <option value="beer">🍺 Beer (Theka)</option>
                        <option value="sparkles">✨ Sparkles</option>
                        <option value="music">🎵 Music Note</option>
                        <option value="disc">💿 Disc</option>
                        <option value="flame">🔥 Flame</option>
                        <option value="heart">❤️ Heart</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Category / Era</label>
                      <input
                        type="text"
                        placeholder="e.g. 90s Nostalgia, Dhaba Hits, Indie"
                        value={stFormCategory}
                        onChange={(e) => setStFormCategory(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Language / Region</label>
                      <input
                        type="text"
                        placeholder="e.g. Hindi, Punjabi, Multilingual"
                        value={stFormLanguage}
                        onChange={(e) => setStFormLanguage(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Accent Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={stFormAccentColor}
                          onChange={(e) => setStFormAccentColor(e.target.value)}
                          className="w-8 h-8 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={stFormAccentColor}
                          onChange={(e) => setStFormAccentColor(e.target.value)}
                          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-amber-500/80"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-semibold mb-1">Artwork Image URL</label>
                      <input
                        type="text"
                        placeholder="https://images.unsplash.com/..."
                        value={stFormArtwork}
                        onChange={(e) => setStFormArtwork(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-semibold mb-1">
                      YouTube Search Queries (comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 90s bollywood hit songs, kumar sanu superhit, alka yagnik romantic"
                      value={stFormQueries}
                      onChange={(e) => setStFormQueries(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">
                      These queries will automatically load YouTube catalogue tracks when this station is tuned into.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                    <input
                      type="checkbox"
                      checked={stFormIsActive}
                      onChange={(e) => setStFormIsActive(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <div>
                      <span className="text-white font-semibold block">Enable this station immediately</span>
                      <span className="text-neutral-500 block text-[11px]">
                        Visible in public navigation and station selectors.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setShowStationModal(false)}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveStationModal}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
                  >
                    {editingStationIndex !== null ? 'Save Changes' : 'Create Station'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Station Confirmation Dialog */}
          {stationToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Delete Nostalgia Station</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">This action will remove the station from your platform draft.</p>
                  </div>
                </div>

                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-300">
                  Are you sure you want to delete <span className="text-white font-bold">{stationToDelete.st.title}</span> (/{stationToDelete.st.id})?
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStationToDelete(null)}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteStation(stationToDelete.originalIndex)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-950 cursor-pointer"
                  >
                    Yes, Delete Station
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Station Tracks Management Modal */}
          {showTracksModal && trackStationIndex !== null && stations[trackStationIndex] && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <ListMusic className="w-4 h-4 text-amber-400" />
                      Manage Curated Tracks — {stations[trackStationIndex].title}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Explicit curated tracks play directly on this station before general query results.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTracksModal(false)}
                    className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Add New Track to Station */}
                <div className="bg-neutral-950/70 p-4 rounded-2xl border border-neutral-800/80 space-y-3">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Track to Station
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Track Title *</label>
                      <input
                        type="text"
                        placeholder="e.g. Chura Ke Dil Mera"
                        value={newTrackTitle}
                        onChange={(e) => setNewTrackTitle(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Artist / Channel</label>
                      <input
                        type="text"
                        placeholder="e.g. Kumar Sanu & Alka Yagnik"
                        value={newTrackArtist}
                        onChange={(e) => setNewTrackArtist(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <label className="block text-neutral-400 font-semibold mb-1">YouTube Video ID or URL *</label>
                      <input
                        type="text"
                        placeholder="e.g. dQw4w9WgXcQ or https://youtu.be/..."
                        value={newTrackVideoId}
                        onChange={(e) => setNewTrackVideoId(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Duration</label>
                      <input
                        type="text"
                        placeholder="e.g. 4:20"
                        value={newTrackDuration}
                        onChange={(e) => setNewTrackDuration(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/80"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddTrackToStation}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow shadow-amber-500/20 cursor-pointer"
                    >
                      Add Track
                    </button>
                  </div>
                </div>

                {/* Track Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search curated tracks..."
                    value={stationTrackSearch}
                    onChange={(e) => setStationTrackSearch(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none"
                  />
                </div>

                {/* Existing Tracks List */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(!stations[trackStationIndex].tracks || stations[trackStationIndex].tracks.length === 0) ? (
                    <div className="text-center py-8 text-neutral-500 text-xs">
                      No custom tracks added yet. When empty, the station streams results from its YouTube queries.
                    </div>
                  ) : (
                    stations[trackStationIndex].tracks
                      .map((t, idx) => ({ t, idx }))
                      .filter(({ t }) => {
                        if (!stationTrackSearch.trim()) return true;
                        const q = stationTrackSearch.toLowerCase();
                        return t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q);
                      })
                      .map(({ t, idx }) => (
                        <div
                          key={t.id || t.videoId || idx}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 hover:border-neutral-700 text-xs transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[11px] font-mono text-neutral-500 w-5 text-right">{idx + 1}</span>
                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800 shrink-0">
                              <img
                                src={t.thumbnail || `https://i.ytimg.com/vi/${t.videoId || t.id}/hqdefault.jpg`}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-semibold text-white truncate">{t.title}</h5>
                              <p className="text-[11px] text-neutral-400 truncate">{t.artist} • {t.duration || '3:30'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveTrackInStation(idx, -1)}
                              className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-20"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === stations[trackStationIndex].tracks.length - 1}
                              onClick={() => handleMoveTrackInStation(idx, 1)}
                              className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-20"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTrackFromStation(idx)}
                              className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                              title="Remove Track"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setShowTracksModal(false)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow shadow-amber-500/20 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. LICENSED & OFFLINE CATALOGUE */}
      {activeTab === 'licenses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Licensed Offline Audio Catalogue
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage verified offline track licenses, permissions, and download allowances for offline audio playback.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchLicenses}
                disabled={isLoadingLicenses}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold border border-neutral-700 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLicenses ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => openLicenseModal(null)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Licensed Track</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, artist, or track ID..."
              value={licenseSearch}
              onChange={(e) => setLicenseSearch(e.target.value)}
              className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-amber-500/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 outline-none transition"
            />
          </div>

          {/* Licenses List */}
          {isLoadingLicenses ? (
            <div className="p-12 text-center text-xs text-neutral-400 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
              Loading licensed catalog...
            </div>
          ) : (() => {
            const filtered = licenses.filter(lic => {
              if (!licenseSearch.trim()) return true;
              const q = licenseSearch.toLowerCase();
              return (
                (lic.title || '').toLowerCase().includes(q) ||
                (lic.artist || '').toLowerCase().includes(q) ||
                (lic.trackId || '').toLowerCase().includes(q)
              );
            });

            if (filtered.length === 0) {
              return (
                <div className="p-12 text-center text-xs text-neutral-500 bg-neutral-900/40 border border-dashed border-neutral-800 rounded-2xl">
                  {licenses.length === 0 ? 'No licensed tracks found in database.' : 'No tracks match your search filter.'}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map(lic => (
                  <div
                    key={lic.trackId || lic._id}
                    className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 backdrop-blur-md space-y-3 transition"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={lic.thumbnail || `https://i.ytimg.com/vi/${lic.trackId}/mqdefault.jpg`}
                        alt={lic.title}
                        className="w-14 h-14 rounded-xl object-cover shrink-0 border border-neutral-800"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            lic.offlineEligible
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {lic.offlineEligible ? 'Offline Eligible' : 'Streaming Only'}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {lic.duration || 'N/A'}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white truncate mt-1.5">{lic.title}</h4>
                        <p className="text-[11px] text-neutral-400 truncate">{lic.artist || 'Unknown Artist'}</p>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5 truncate">ID: {lic.trackId}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/80">
                      <div>
                        <span className="text-neutral-500 block text-[10px] uppercase">License Scope</span>
                        <span className="text-amber-300 font-mono text-[10px] truncate block">{lic.permissionScope || 'standard'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[10px] uppercase">Type</span>
                        <span className="text-neutral-300 font-mono text-[10px] truncate block">{lic.licenseType || 'Direct'}</span>
                      </div>
                      {lic.licenseReference && (
                        <div className="col-span-2">
                          <span className="text-neutral-500 block text-[10px] uppercase">Reference</span>
                          <span className="text-neutral-400 text-[10px] truncate block">{lic.licenseReference}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60 text-xs">
                      <span className="text-[10px] text-neutral-500">
                        Verified by: <span className="text-neutral-300 font-medium">{lic.verifiedBy || 'admin'}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openLicenseModal(lic)}
                          className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 transition cursor-pointer"
                          title="Edit License"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLicense(lic.trackId, lic.title)}
                          className="p-1 rounded-lg bg-neutral-800 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 transition cursor-pointer"
                          title="Revoke / Delete License"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* 4. TIME MACHINE RADIO ERAS */}
      {activeTab === 'timeMachineEras' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Disc className="w-4 h-4 text-amber-400" />
                Time Machine Radio Eras ({timeMachineEras.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Curate historical decades (1970s–2010s), atmospheric subtitles, genre tags, search queries, and vinyl artwork.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openEraModal(null)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Era</span>
            </button>
          </div>

          {timeMachineEras.length === 0 ? (
            <div className="p-12 text-center text-xs text-neutral-500 bg-neutral-900/40 border border-dashed border-neutral-800 rounded-2xl">
              No Time Machine eras defined yet. Click "Add Custom Era" to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {timeMachineEras.map((era, idx) => (
                <div
                  key={era.id || era.decade || idx}
                  className={`p-4 rounded-2xl border backdrop-blur-md transition space-y-3 ${
                    era.enabled !== false
                      ? 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                      : 'bg-neutral-950/40 border-neutral-850 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={era.artwork || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop'}
                      alt={era.title}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-neutral-800"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          {era.badge || `📻 ${era.decade}`}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {(era.queries || []).length} queries
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white truncate mt-1">{era.title}</h4>
                      <p className="text-[11px] text-amber-300/80 font-medium truncate mt-0.5">{era.subtitle || era.decade}</p>
                      <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">{era.description || 'No description'}</p>
                    </div>
                  </div>

                  {/* Genre tags */}
                  {Array.isArray(era.genres) && era.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {era.genres.map((g, gIdx) => (
                        <span key={gIdx} className="text-[9px] px-2 py-0.5 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-300 font-mono">
                          {g}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60 text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleEra(idx)}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition ${
                        era.enabled !== false
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                      }`}
                    >
                      {era.enabled !== false ? '● Active in Station' : '○ Disabled'}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveEra(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-neutral-300 transition cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveEra(idx, 1)}
                        disabled={idx === timeMachineEras.length - 1}
                        className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-neutral-300 transition cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEraModal(idx)}
                        className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 transition cursor-pointer ml-1"
                        title="Edit Era"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEra(idx)}
                        className="p-1 rounded-lg bg-neutral-800 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 transition cursor-pointer"
                        title="Delete Era"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {/* EDIT COLLECTION MODAL */}
      {editingCollection && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-amber-400" />
              Edit Curated Collection
            </h4>
            <form onSubmit={handleUpdateCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Collection Name *</label>
                <input
                  type="text"
                  required
                  value={editColName}
                  onChange={(e) => setEditColName(e.target.value)}
                  placeholder="e.g. 2000s Bollywood Romance"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Category</label>
                <select
                  value={editColCategory}
                  onChange={(e) => setEditColCategory(e.target.value)}
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
                  value={editColDesc}
                  onChange={(e) => setEditColDesc(e.target.value)}
                  placeholder="Short summary of this curated collection"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Cover Art URL</label>
                <input
                  type="text"
                  value={editColCover}
                  onChange={(e) => setEditColCover(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editFeatHome"
                  checked={editColHome}
                  onChange={(e) => setEditColHome(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <label htmlFor="editFeatHome" className="text-xs text-neutral-300 cursor-pointer">
                  Feature this collection on the Home page feed
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCollection(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT LICENSE MODAL */}
      {showLicenseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {editingLicense ? 'Edit Track License Record' : 'Register New Track License'}
            </h4>
            <form onSubmit={handleSaveLicense} className="space-y-3.5 max-h-[80vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  YouTube Track / Video ID *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingLicense)}
                  value={licTrackId}
                  onChange={(e) => {
                    let val = e.target.value.trim();
                    const match = val.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || val.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                    if (match && match[1]) val = match[1];
                    setLicTrackId(val);
                    if (val.length === 11 && !licThumbnail) {
                      setLicThumbnail(`https://i.ytimg.com/vi/${val}/mqdefault.jpg`);
                    }
                  }}
                  placeholder="e.g. Yvl6m9x5ZR0"
                  className="w-full bg-neutral-950 border border-neutral-800 disabled:opacity-50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Song Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={licTitle}
                    onChange={(e) => setLicTitle(e.target.value)}
                    placeholder="Chura Ke Dil Mera"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Artist / Performer
                  </label>
                  <input
                    type="text"
                    value={licArtist}
                    onChange={(e) => setLicArtist(e.target.value)}
                    placeholder="Kumar Sanu, Alka Yagnik"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Channel / Publisher
                  </label>
                  <input
                    type="text"
                    value={licChannel}
                    onChange={(e) => setLicChannel(e.target.value)}
                    placeholder="Venus Music"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Duration (e.g. 4:32)
                  </label>
                  <input
                    type="text"
                    value={licDuration}
                    onChange={(e) => setLicDuration(e.target.value)}
                    placeholder="4:30"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Thumbnail URL
                </label>
                <input
                  type="text"
                  value={licThumbnail}
                  onChange={(e) => setLicThumbnail(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Permission Scope
                  </label>
                  <select
                    value={licPermission}
                    onChange={(e) => setLicPermission(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="offline_download_permitted">offline_download_permitted</option>
                    <option value="streaming_only">streaming_only</option>
                    <option value="promotional_use">promotional_use</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Source Provider
                  </label>
                  <select
                    value={licProvider}
                    onChange={(e) => setLicProvider(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="direct_license">direct_license</option>
                    <option value="admin_upload">admin_upload</option>
                    <option value="creative_commons">creative_commons</option>
                    <option value="public_domain">public_domain</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    License Type
                  </label>
                  <input
                    type="text"
                    value={licType}
                    onChange={(e) => setLicType(e.target.value)}
                    placeholder="Direct-License"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    License Reference #
                  </label>
                  <input
                    type="text"
                    value={licReference}
                    onChange={(e) => setLicReference(e.target.value)}
                    placeholder="LIC-2026-001"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Licensing Notes & Terms
                </label>
                <textarea
                  rows={2}
                  value={licNotes}
                  onChange={(e) => setLicNotes(e.target.value)}
                  placeholder="Direct authorization from rightsholder for cached offline streaming"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="licEligibleCheck"
                  checked={licEligible}
                  onChange={(e) => setLicEligible(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
                <label htmlFor="licEligibleCheck" className="text-xs text-neutral-200 cursor-pointer font-medium">
                  Mark as Verified Offline Eligible (permits audio caching & binary download)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowLicenseModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold transition shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  {editingLicense ? 'Save License' : 'Register License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT ERA MODAL */}
      {showEraModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Disc className="w-4 h-4 text-amber-400" />
              {editingEraIndex !== null ? 'Edit Time Machine Era' : 'Add Time Machine Era'}
            </h4>
            <form onSubmit={handleSaveEra} className="space-y-3.5 max-h-[80vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Decade *
                  </label>
                  <select
                    value={eraDecade}
                    onChange={(e) => setEraDecade(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="1960s">1960s</option>
                    <option value="1970s">1970s</option>
                    <option value="1980s">1980s</option>
                    <option value="1990s">1990s</option>
                    <option value="2000s">2000s</option>
                    <option value="2010s">2010s</option>
                    <option value="2020s">2020s</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Era Badge
                  </label>
                  <input
                    type="text"
                    value={eraBadge}
                    onChange={(e) => setEraBadge(e.target.value)}
                    placeholder="📻 1990s Pure Romance"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={eraTitle}
                  onChange={(e) => setEraTitle(e.target.value)}
                  placeholder="e.g. 90s Romantic Bollywood"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={eraSubtitle}
                  onChange={(e) => setEraSubtitle(e.target.value)}
                  placeholder="Kumar Sanu, Alka Yagnik, Udit Narayan & 90s Indipop"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={eraDesc}
                  onChange={(e) => setEraDesc(e.target.value)}
                  placeholder="Atmospheric narrative displayed on Time Machine Radio deck"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Artwork URL
                </label>
                <input
                  type="text"
                  value={eraArtwork}
                  onChange={(e) => setEraArtwork(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Search Queries (One query per line)
                </label>
                <textarea
                  rows={3}
                  value={eraQueries}
                  onChange={(e) => setEraQueries(e.target.value)}
                  placeholder={`1990s romantic bollywood hits kumar sanu\n90s iconic hindi songs udit narayan`}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none font-mono resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Genre Tags (Comma-separated)
                </label>
                <input
                  type="text"
                  value={eraGenres}
                  onChange={(e) => setEraGenres(e.target.value)}
                  placeholder="90s Romance, Monsoon Melodies, Indipop, Dholak Beats"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="eraEnabledCheck"
                  checked={eraEnabled}
                  onChange={(e) => setEraEnabled(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="eraEnabledCheck" className="text-xs text-neutral-200 cursor-pointer font-medium">
                  Enable this era on Time Machine Radio
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowEraModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  {editingEraIndex !== null ? 'Save Changes' : 'Create Era'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
