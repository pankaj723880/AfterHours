import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Upload, Loader2, Check, X, AlertCircle, Trash2 } from 'lucide-react';
import { getApiUrl } from '../../utils/apiUrl';
import UserAvatar from '../Common/UserAvatar';

const GENRE_OPTIONS = [
  '90s Bollywood',
  'Romantic Retro',
  'Desi Punjabi Dhol',
  'Ghazals & Mehfil',
  'Highway Melodies',
  'Classic Sufi',
  'Old School Hip-Hop',
  'Lofi Chill'
];

export default function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  showToast
}) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [favoriteGenres, setFavoriteGenres] = useState([]);
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'edit'

  // Image upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Clean up object URL when closing or changing selection
  const clearPreview = useCallback(() => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    setSelectedFile(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isOpen || !currentUser) {
      clearPreview();
      return;
    }

    // Load fresh profile details from server
    const token = localStorage.getItem('afterhours_token');
    fetch(getApiUrl(`/api/user/profile/${currentUser.username}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setDisplayName(data.displayName || currentUser.username || '');
          setBio(data.bio || '');
          setAvatarUrl(data.avatarUrl || '');
          setFavoriteGenres(data.favoriteGenres || []);
          setIsPublic(data.isPublic !== false);
        }
      })
      .catch(() => {});
  }, [isOpen, currentUser]);

  if (!isOpen || !currentUser) return null;

  // Handle Local File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');

    // Supported MIME types
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Unsupported format. Please select a JPEG, PNG, or WebP image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File is too large. Maximum file size is 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Revoke previous preview
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);
    setSelectedFile(file);
  };

  // Upload Profile Avatar to Server
  const handleSaveAvatar = async () => {
    if (!selectedFile) return;

    setIsUploadingAvatar(true);
    setUploadError('');

    try {
      // Read as base64 data URL
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
      });
      reader.readAsDataURL(selectedFile);
      const dataUrl = await base64Promise;

      const token = localStorage.getItem('afterhours_token');
      const res = await fetch(getApiUrl('/api/user/profile/avatar'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ image: dataUrl })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload image.');
      }

      setAvatarUrl(data.avatarUrl);
      clearPreview();

      if (showToast) showToast('Profile photo updated successfully!', 'success');
      if (onUserUpdated) onUserUpdated(data.user);

      // Persist in localStorage so it reflects immediately after reload
      try {
        const stored = JSON.parse(localStorage.getItem('afterhours_user') || '{}');
        localStorage.setItem('afterhours_user', JSON.stringify({ ...stored, ...data.user }));
      } catch (_) {}
    } catch (err) {
      console.error('[Avatar Upload Error]:', err);
      setUploadError(err.message || 'Failed to upload photo. Please try again.');
      if (showToast) showToast(err.message || 'Failed to upload photo', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Remove Avatar
  const handleRemoveAvatar = async () => {
    if (!avatarUrl && !selectedFile) return;

    if (selectedFile) {
      clearPreview();
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const token = localStorage.getItem('afterhours_token');
      const res = await fetch(getApiUrl('/api/user/profile/avatar'), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setAvatarUrl('');
        if (showToast) showToast('Profile photo removed');
        if (onUserUpdated) onUserUpdated(data.user);
        try {
          const stored = JSON.parse(localStorage.getItem('afterhours_user') || '{}');
          localStorage.setItem('afterhours_user', JSON.stringify({ ...stored, avatarUrl: '' }));
        } catch (_) {}
      }
    } catch (e) {
      if (showToast) showToast('Failed to remove photo', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const token = localStorage.getItem('afterhours_token');

    try {
      const res = await fetch(getApiUrl('/api/user/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName,
          bio,
          avatarUrl,
          favoriteGenres,
          isPublic
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (showToast) showToast('Profile saved successfully!');
        if (onUserUpdated) onUserUpdated(data.user);
        try {
          const stored = JSON.parse(localStorage.getItem('afterhours_user') || '{}');
          localStorage.setItem('afterhours_user', JSON.stringify({ ...stored, ...data.user }));
        } catch (_) {}
        setActiveTab('overview');
      } else {
        if (showToast) showToast(data.error || 'Failed to save profile');
      }
    } catch (err) {
      if (showToast) showToast('Network error saving profile');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleGenre = (genre) => {
    if (favoriteGenres.includes(genre)) {
      setFavoriteGenres(favoriteGenres.filter(g => g !== genre));
    } else {
      if (favoriteGenres.length < 5) {
        setFavoriteGenres([...favoriteGenres, genre]);
      } else if (showToast) {
        showToast('Maximum 5 favorite genres');
      }
    }
  };

  const activeAvatarSrc = previewUrl || avatarUrl;

  return (
    <div
      className="fixed inset-0 z-[10000] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) { clearPreview(); onClose(); } }}
    >
      <div
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-amber-500 text-neutral-950 flex items-center justify-center font-bold text-base shadow-md uppercase shrink-0 border border-amber-400/30">
              <UserAvatar
                user={currentUser}
                src={activeAvatarSrc}
                className="w-full h-full object-cover"
                fallbackClassName="w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 text-neutral-950 flex items-center justify-center font-bold text-base uppercase"
                fallbackInitial={currentUser.username ? currentUser.username.charAt(0) : 'U'}
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-white truncate">{displayName || currentUser.username}</h3>
              <p className="text-xs text-neutral-400 truncate">@{currentUser.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                clearPreview();
                setActiveTab(activeTab === 'overview' ? 'edit' : 'overview');
              }}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer"
            >
              {activeTab === 'overview' ? 'Edit Profile' : 'View Profile'}
            </button>
            <button
              type="button"
              onClick={() => { clearPreview(); onClose(); }}
              className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Avatar Management Card - Visible in both Overview & Edit */}
          <div className="p-4 rounded-3xl bg-neutral-950/60 border border-neutral-800/80 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-neutral-800 border-2 border-amber-500/40 flex items-center justify-center text-white shadow-lg">
                <UserAvatar
                  user={currentUser}
                  src={activeAvatarSrc}
                  alt="Profile photo"
                  className="w-full h-full object-cover"
                  fallbackClassName="w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 text-neutral-950 flex items-center justify-center font-black text-2xl uppercase"
                  fallbackInitial={currentUser.username ? currentUser.username.charAt(0) : 'U'}
                />
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2 min-w-0 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-white">Profile Photo</h4>
                  <p className="text-[11px] text-neutral-400">
                    PNG, JPEG, or WebP up to 5MB
                  </p>
                </div>

                {!selectedFile ? (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 hover:text-amber-300 border border-neutral-700 text-xs font-semibold transition cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>

                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={isUploadingAvatar}
                        title="Remove custom photo"
                        className="p-1.5 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={clearPreview}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={handleSaveAvatar}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 text-xs font-bold shadow-md shadow-amber-500/20 transition cursor-pointer"
                    >
                      {isUploadingAvatar ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Photo</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {selectedFile && !uploadError && (
                <p className="text-[11px] text-amber-400 font-mono">
                  Preview: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}

              {uploadError && (
                <p className="text-xs text-rose-400 flex items-center justify-center sm:justify-start gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </p>
              )}
            </div>
          </div>

          {activeTab === 'overview' ? (
            <div className="space-y-4">
              {/* Bio */}
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-1">About</label>
                <p className="text-xs sm:text-sm text-neutral-300 bg-neutral-950/40 p-3 rounded-2xl border border-neutral-800/80 leading-relaxed">
                  {bio || 'No bio added yet. Tell listeners about your musical journey!'}
                </p>
              </div>

              {/* Favorite Genres */}
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-2">Favorite Genres</label>
                {favoriteGenres.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {favoriteGenres.map(g => (
                      <span key={g} className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
                        {g}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">No favorite genres selected yet.</p>
                )}
              </div>

              {/* Privacy Status */}
              <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-neutral-400">Profile Visibility</span>
                <span className={`font-semibold ${isPublic ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isPublic ? '🌍 Public Profile' : '🔒 Private Profile'}
                </span>
              </div>
            </div>
          ) : (
            /* Edit Form */
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">Display Name</label>
                <input
                  type="text"
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-2xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">Biography</label>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell listeners what you love listening to..."
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                />
                <span className="text-[10px] text-neutral-500 block text-right">{bio.length}/300</span>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-2">Favorite Genres (Pick up to 5)</label>
                <div className="flex flex-wrap gap-1.5">
                  {GENRE_OPTIONS.map(genre => {
                    const isSelected = favoriteGenres.includes(genre);
                    return (
                      <button
                        type="button"
                        key={genre}
                        onClick={() => toggleGenre(genre)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400'
                            : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-300 hover:bg-neutral-700/80'
                        }`}
                      >
                        {genre} {isSelected ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-white">Public Profile</p>
                  <p className="text-[11px] text-neutral-400">Allow listeners to discover your public playlists</p>
                </div>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="px-4 py-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 text-xs font-bold shadow-lg transition cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
