import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  RefreshCw,
  ExternalLink,
  Plus
} from 'lucide-react';
import { safeParseJsonResponse } from '../../utils/errorHandler';

export default function CmsMediaLibrary({ token, backendUrl, showToast, onSelectAsset, isPickerMode = false }) {
  const [assets, setAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('artwork');
  const fileInputRef = useRef(null);

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      let url = `${backendUrl}/api/admin/cms/media?category=${categoryFilter}`;
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Fetch media failed');
      if (parsed.ok && parsed.data?.assets) {
        setAssets(parsed.data.assets);
      }
    } catch (err) {
      if (showToast) showToast('Failed to load media assets', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [backendUrl, token, categoryFilter, searchQuery]);

  // File Upload Handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      if (showToast) showToast('File exceeds 5MB size limit', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setIsUploading(true);
      try {
        const res = await fetch(`${backendUrl}/api/admin/cms/media/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: file.name,
            mimeType: file.type || 'image/jpeg',
            size: file.size,
            dataUrl,
            category: uploadCategory
          })
        });
        const parsed = await safeParseJsonResponse(res, 'Upload failed');
        if (parsed.ok) {
          if (showToast) showToast('Media uploaded successfully!', 'success');
          fetchAssets();
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          if (showToast) showToast(parsed.error || 'Upload failed', 'error');
        }
      } catch (err) {
        if (showToast) showToast(err.message, 'error');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Delete Asset
  const handleDeleteAsset = async (assetId, name) => {
    if (!window.confirm(`Delete media asset "${name}"?`)) return;
    try {
      const res = await fetch(`${backendUrl}/api/admin/cms/media/${assetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Delete asset failed');
      if (parsed.ok) {
        if (showToast) showToast('Media asset removed', 'success');
        fetchAssets();
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Copy URL
  const handleCopyUrl = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    if (showToast) showToast('Image URL copied to clipboard!', 'success');
  };

  const resolveAssetUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const base = (backendUrl || '').replace(/\/$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const categories = [
    { id: 'all', label: 'All Media' },
    { id: 'artwork', label: 'Artwork' },
    { id: 'logo', label: 'Logos' },
    { id: 'banner', label: 'Banners' },
    { id: 'background', label: 'Backgrounds' },
    { id: 'icon', label: 'Icons' }
  ];

  return (
    <div className="space-y-6">
      {/* Upload Box */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 md:p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" />
              Upload Website Media & Artwork
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              PNG, JPG, WEBP, or SVG under 5MB. Stored persistently in the database for instant use.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="artwork">Artwork</option>
              <option value="logo">Brand Logo</option>
              <option value="banner">Promo Banner</option>
              <option value="background">Background Image</option>
              <option value="icon">Favicon / Icon</option>
            </select>

            <label className={`flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-sm cursor-pointer ${
              isUploading ? 'opacity-50 pointer-events-none' : ''
            }`}>
              <Plus className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Uploading...' : 'Choose File'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                categoryFilter === c.id
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search filenames..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/80 transition"
          />
        </div>
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-xs text-neutral-400">Loading media assets...</div>
      ) : assets.length === 0 ? (
        <div className="bg-neutral-900/30 border border-neutral-800/80 rounded-2xl p-12 text-center text-xs text-neutral-500">
          No media assets found in this category. Upload logos, station art, or banners above!
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assets.map(asset => (
            <div
              key={asset.id}
              className="group bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 rounded-2xl overflow-hidden flex flex-col transition backdrop-blur-md"
            >
              <div className="relative aspect-video bg-neutral-950 flex items-center justify-center overflow-hidden">
                <img
                  src={resolveAssetUrl(asset.url)}
                  alt={asset.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(asset.name)}&background=1e1e1e&color=f59e0b&size=200`;
                  }}
                />
                <span className="absolute top-2 left-2 text-[9px] uppercase font-bold text-neutral-300 bg-neutral-950/80 backdrop-blur-md border border-neutral-800 px-1.5 py-0.5 rounded">
                  {asset.category}
                </span>

                {/* Hover overlay with action buttons */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                  {isPickerMode && onSelectAsset ? (
                    <button
                      type="button"
                      onClick={() => onSelectAsset(resolveAssetUrl(asset.url))}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold shadow"
                    >
                      Select
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(resolveAssetUrl(asset.url), asset.id)}
                        className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white transition"
                        title="Copy URL"
                      >
                        {copiedId === asset.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAsset(asset.id, asset.name)}
                        className="p-2 rounded-xl bg-neutral-800 hover:bg-rose-900/50 text-neutral-300 hover:text-rose-400 transition"
                        title="Delete Asset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 min-w-0">
                <h5 className="text-xs font-bold text-white truncate" title={asset.name}>
                  {asset.name}
                </h5>
                <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                  {(asset.size / 1024).toFixed(1)} KB • {new Date(asset.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
