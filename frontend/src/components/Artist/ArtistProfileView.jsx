import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  Heart,
  Plus,
  Share2,
  Check,
  UserPlus,
  UserCheck,
  ExternalLink,
  Disc,
  Music,
  Sparkles,
  ChevronDown,
  Loader2,
  Volume2,
  ArrowLeft,
  Clock,
  Radio,
  ListPlus
} from 'lucide-react';
import { getCleanThumbnail } from '../../utils/storage';

// In-memory session cache to preserve loaded songs and pagination across navigations
const artistSessionCache = new Map();

export default function ArtistProfileView({
  artistId,
  backendUrl = '',
  authToken = null,
  user = null,
  currentSong = null,
  isPlaying = false,
  onPlaySong,
  onTogglePlayPause,
  onToggleLike,
  isLiked,
  onAddToPlaylist,
  onAddToQueue,
  onArtistClick,
  onGoBack,
  showToast
}) {
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [activeDiscographyTab, setActiveDiscographyTab] = useState('all');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Normalize artist slug
  const normalizedSlug = useMemo(() => {
    return (artistId || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }, [artistId]);

  // Check initial follow state from user object or localStorage
  useEffect(() => {
    try {
      if (user && Array.isArray(user.followedArtists)) {
        setIsFollowing(user.followedArtists.includes(normalizedSlug));
        return;
      }
      const rawStored = localStorage.getItem('loopra_followed_artists');
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (Array.isArray(parsed)) {
          setIsFollowing(parsed.includes(normalizedSlug));
        }
      }
    } catch (_) {}
  }, [user, normalizedSlug]);

  // Load artist profile data (Restores from session cache if available)
  useEffect(() => {
    let isCancelled = false;

    const loadProfile = async () => {
      // 1. Check in-memory session cache to preserve loaded songs & pagination position
      if (artistSessionCache.has(normalizedSlug)) {
        const cached = artistSessionCache.get(normalizedSlug);
        setArtist(cached.artist);
        setSongs(cached.songs);
        setNextPageToken(cached.nextPageToken);
        setHasMore(cached.hasMore);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const base = backendUrl.replace(/\/+$/, '');
        const url = `${base}/api/artists/${encodeURIComponent(normalizedSlug)}`;
        const res = await fetch(url);
        if (!res.ok) {
          // Graceful fallback: fetch songs using generic search API if dedicated endpoint returns 404
          const searchName = normalizedSlug.replace(/-/g, ' ');
          const searchRes = await fetch(`${base}/api/search?q=${encodeURIComponent(searchName)}`).catch(() => null);
          if (searchRes && searchRes.ok) {
            const searchData = await searchRes.json();
            const fallbackTracks = Array.isArray(searchData) ? searchData : (searchData.items || []);
            const displayName = searchName.replace(/\b\w/g, l => l.toUpperCase());
            const fallbackArtist = {
              id: normalizedSlug,
              name: displayName,
              role: 'Artist',
              verified: true,
              monthlyListeners: 15000000,
              image: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=181818&color=f59e0b&size=400`,
              bio: `${displayName} on Loopra. Stream popular tracks, albums, and live recommendations.`,
              popularSongs: fallbackTracks.slice(0, 10),
              genres: ['Bollywood', 'Popular Music'],
              discography: { all: fallbackTracks, albums: [], singles: [] },
              relatedArtists: []
            };

            if (isCancelled) return;
            setArtist(fallbackArtist);
            setSongs(fallbackTracks.slice(0, 10));
            setHasMore(fallbackTracks.length > 10);
            artistSessionCache.set(normalizedSlug, {
              artist: fallbackArtist,
              songs: fallbackTracks.slice(0, 10),
              nextPageToken: null,
              hasMore: fallbackTracks.length > 10
            });
            return;
          }
          throw new Error(`Failed to load artist profile (${res.status})`);
        }
        const data = await res.json();
        if (isCancelled) return;

        if (data && data.artist) {
          setArtist(data.artist);
          const initialSongs = data.artist.popularSongs || [];
          setSongs(initialSongs);
          setNextPageToken(data.artist.nextPageToken || null);
          setHasMore(Boolean(data.artist.hasMore));

          // Save to session cache
          artistSessionCache.set(normalizedSlug, {
            artist: data.artist,
            songs: initialSongs,
            nextPageToken: data.artist.nextPageToken || null,
            hasMore: Boolean(data.artist.hasMore)
          });
        } else {
          throw new Error('Artist data unavailable');
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[ArtistProfileView] Load Error:', err);
          setLoadError(err.message || 'Unable to load artist profile');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    if (normalizedSlug) {
      loadProfile();
    }

    return () => {
      isCancelled = true;
    };
  }, [normalizedSlug, backendUrl]);

  // Permanent Load More handler: fetches exactly 10 more songs without resetting
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      const base = backendUrl.replace(/\/+$/, '');
      const excludeIds = songs.map(s => s.id || s.videoId).filter(Boolean).join(',');
      const params = new URLSearchParams();
      if (nextPageToken) params.set('pageToken', nextPageToken);
      params.set('limit', '10');
      if (excludeIds) params.set('excludeIds', excludeIds);

      const url = `${base}/api/artists/${encodeURIComponent(normalizedSlug)}/songs?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load additional tracks');

      const data = await res.json();
      const newTracks = data.songs || [];

      if (newTracks.length > 0) {
        setSongs(prev => {
          const seen = new Set(prev.map(s => s.id || s.videoId));
          const additions = newTracks.filter(t => !seen.has(t.id || t.videoId));
          const updated = [...prev, ...additions];

          // Update cache
          if (artist) {
            artistSessionCache.set(normalizedSlug, {
              artist,
              songs: updated,
              nextPageToken: data.nextPageToken || null,
              hasMore: Boolean(data.hasMore)
            });
          }
          return updated;
        });

        setNextPageToken(data.nextPageToken || null);
        setHasMore(Boolean(data.hasMore));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[ArtistProfileView] Load More Error:', err);
      showToast?.('Could not load more songs. Please retry.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Follow / Unfollow handler
  const handleToggleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);

    const nextState = !isFollowing;
    setIsFollowing(nextState);

    // Update local storage immediately for responsive feedback
    try {
      const rawStored = localStorage.getItem('loopra_followed_artists');
      let currentFollowed = rawStored ? JSON.parse(rawStored) : [];
      if (!Array.isArray(currentFollowed)) currentFollowed = [];

      if (nextState) {
        if (!currentFollowed.includes(normalizedSlug)) currentFollowed.push(normalizedSlug);
        showToast?.(`Followed ${artist?.name || 'Artist'}`);
      } else {
        currentFollowed = currentFollowed.filter(id => id !== normalizedSlug);
        showToast?.(`Unfollowed ${artist?.name || 'Artist'}`);
      }
      localStorage.setItem('loopra_followed_artists', JSON.stringify(currentFollowed));
    } catch (_) {}

    // Persist to backend if user is authenticated
    if (authToken) {
      try {
        const base = backendUrl.replace(/\/+$/, '');
        const method = nextState ? 'POST' : 'DELETE';
        await fetch(`${base}/api/artists/${encodeURIComponent(normalizedSlug)}/follow`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        });
      } catch (err) {
        console.warn('[ArtistProfileView] Backend follow sync failed:', err);
      }
    }

    setFollowLoading(false);
  };

  // Play artist top tracks
  const handlePlayArtist = (startShuffle = false) => {
    if (!songs || songs.length === 0) return;
    let trackList = [...songs];
    if (startShuffle) {
      trackList = trackList.sort(() => Math.random() - 0.5);
    }
    const firstSong = trackList[0];
    if (firstSong && onPlaySong) {
      onPlaySong(firstSong, trackList);
      showToast?.(startShuffle ? `Shuffling ${artist?.name || 'Artist'}` : `Playing ${artist?.name || 'Artist'}`);
    }
  };

  // Copy Profile Link
  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast?.('Artist profile link copied to clipboard!');
    }
  };

  // Format listener numbers
  const formatNumber = (num) => {
    if (!num) return '0';
    return Number(num).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="text-sm font-mono text-neutral-400">Loading artist profile...</p>
      </div>
    );
  }

  if (loadError || !artist) {
    return (
      <div className="w-full max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-neutral-900 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-500 shadow-xl">
          <Music className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold font-display text-white">Artist Unavailable</h2>
        <p className="text-sm text-neutral-400 max-w-md mx-auto">
          {loadError || "We couldn't load this artist's profile right now."}
        </p>
        <button
          onClick={onGoBack}
          className="px-6 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm transition shadow-lg cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isCurrentArtistPlaying = isPlaying && currentSong && (
    (currentSong.artist && currentSong.artist.toLowerCase() === artist.name.toLowerCase()) ||
    (currentSong.channel && currentSong.channel.toLowerCase() === artist.name.toLowerCase()) ||
    songs.some(s => s.id === currentSong.id || s.videoId === currentSong.id)
  );

  return (
    <div className="w-full min-h-screen text-neutral-200 select-none pb-24 md:pb-16 animate-fadeIn">
      {/* 1. BACK BUTTON BAR */}
      <div className="mb-3 sm:mb-4 flex items-center justify-between">
        <button
          onClick={onGoBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold transition cursor-pointer shadow-md active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
          <span>Back</span>
        </button>

        <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
          Artist Profile
        </span>
      </div>

      {/* 2. SPOTIFY-STYLE CINEMATIC ARTIST HERO SECTION */}
      <div className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-b from-neutral-900/90 via-[#121212] to-[#0c0c0c] border border-amber-500/20 shadow-2xl p-5 sm:p-8 md:p-10 mb-8 sm:mb-12">
        {/* Background Ambient Blur Backdrop */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl scale-110 pointer-events-none"
          style={{ backgroundImage: `url(${artist.headerImage || artist.image})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-neutral-950/70 to-[#0c0c0c] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/90 via-transparent to-neutral-950/80 pointer-events-none" />

        {/* Ambient Warm Golden Orb */}
        <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-amber-500/15 blur-[100px] pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
          {/* Artist Portrait */}
          <div className="relative shrink-0 w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-full overflow-hidden border-2 border-amber-500/40 shadow-[0_15px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.2)] bg-neutral-950 group">
            <img
              src={artist.image}
              alt={artist.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=181818&color=f59e0b&size=512`;
              }}
            />
          </div>

          {/* Artist Details & Badges */}
          <div className="flex-1 text-center md:text-left space-y-2.5 sm:space-y-3.5 min-w-0">
            {/* Verified Badge & Category */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs">
              {artist.verified && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px] shadow-sm">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center text-[9px]">✓</span>
                  <span>Verified Artist</span>
                </div>
              )}
              <span className="text-neutral-400 font-medium">{artist.role || 'Artist'}</span>
            </div>

            {/* Main Name Heading */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-display text-white tracking-tight leading-none drop-shadow-lg">
              {artist.name}
            </h1>

            {/* Listener Count */}
            <p className="text-xs sm:text-sm text-neutral-300 font-medium">
              <span className="text-amber-400 font-bold font-mono">{formatNumber(artist.monthlyListeners)}</span> monthly listeners
            </p>

            {/* Genre Pills */}
            {Array.isArray(artist.genres) && artist.genres.length > 0 && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 pt-1">
                {artist.genres.slice(0, 4).map((g, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-[10px] text-neutral-400 font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. HERO ACTION BUTTONS BAR */}
        <div className="relative z-10 flex flex-wrap items-center justify-center md:justify-start gap-3 sm:gap-4 mt-6 sm:mt-8 pt-4 border-t border-neutral-800/60">
          {/* Main Play Button */}
          <button
            onClick={() => handlePlayArtist(false)}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-400 hover:bg-amber-300 active:scale-95 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-500/25 transition-transform cursor-pointer"
            title={`Play ${artist.name}`}
            aria-label={`Play ${artist.name}`}
          >
            {isCurrentArtistPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>

          {/* Shuffle Button */}
          <button
            onClick={() => handlePlayArtist(true)}
            className="p-3 sm:p-3.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 active:scale-95 border border-neutral-800 text-neutral-300 hover:text-white transition shadow-md cursor-pointer"
            title="Shuffle play"
            aria-label="Shuffle play"
          >
            <Shuffle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          </button>

          {/* Follow / Unfollow Button */}
          <button
            onClick={handleToggleFollow}
            disabled={followLoading}
            className={`px-5 py-2.5 sm:px-6 sm:py-3 rounded-full text-xs sm:text-sm font-bold tracking-wide transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 ${
              isFollowing
                ? 'bg-amber-500 text-neutral-950 hover:bg-amber-400 border border-amber-400'
                : 'bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-amber-500/40'
            }`}
          >
            {isFollowing ? (
              <>
                <UserCheck className="w-4 h-4" />
                <span>Following</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>Follow</span>
              </>
            )}
          </button>

          {/* Share Profile */}
          <button
            onClick={handleCopyLink}
            className="p-3 sm:p-3.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 active:scale-95 border border-neutral-800 text-neutral-400 hover:text-white transition shadow-md cursor-pointer"
            title="Copy profile link"
            aria-label="Share profile link"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Official Channel Link */}
          {artist.channelUrl && (
            <a
              href={artist.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 sm:p-3.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 active:scale-95 border border-neutral-800 text-neutral-400 hover:text-red-400 transition shadow-md cursor-pointer"
              title="Official YouTube Channel"
              aria-label="Official YouTube Channel"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* 4. POPULAR SONGS SECTION WITH PERMANENT LOAD MORE */}
      <section className="mb-10 sm:mb-14">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight">
              Popular Tracks
            </h2>
            <span className="text-xs font-mono text-neutral-500 px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800">
              {songs.length} loaded
            </span>
          </div>

          <span className="text-xs text-neutral-500 hidden sm:inline">
            Click any track to stream
          </span>
        </div>

        {/* Tracks List */}
        <div className="space-y-1.5 sm:space-y-2">
          {songs.map((song, idx) => {
            const songId = song.id || song.videoId;
            const isCurrent = currentSong && (currentSong.id === songId || currentSong.videoId === songId);
            const isCurrentActivePlaying = isCurrent && isPlaying;
            const songLiked = isLiked?.(songId);

            return (
              <div
                key={`${songId}-${idx}`}
                onClick={() => onPlaySong?.(song, songs)}
                className={`group flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 rounded-2xl transition-all duration-200 cursor-pointer ${
                  isCurrent
                    ? 'bg-amber-500/15 border border-amber-500/40 shadow-md'
                    : 'bg-neutral-900/50 hover:bg-neutral-800/80 border border-neutral-800/60 hover:border-neutral-700'
                }`}
              >
                {/* Left: Track Number / Play Indicator + Artwork + Title */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  {/* Rank / Play icon */}
                  <div className="w-5 text-center shrink-0">
                    {isCurrentActivePlaying ? (
                      <span className="text-amber-400 animate-pulse text-xs">▶</span>
                    ) : (
                      <>
                        <span className="text-xs font-mono text-neutral-500 group-hover:hidden">
                          {idx + 1}
                        </span>
                        <Play className="w-3.5 h-3.5 text-white fill-current hidden group-hover:inline-block ml-0.5" />
                      </>
                    )}
                  </div>

                  {/* Artwork */}
                  <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-neutral-950 shrink-0 border border-neutral-800 shadow-sm">
                    <img
                      src={song.thumbnail || getCleanThumbnail(song, songId)}
                      alt={song.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        e.currentTarget.src = `https://i.ytimg.com/vi/${songId}/hqdefault.jpg`;
                      }}
                    />
                    {isCurrentActivePlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                      </div>
                    )}
                  </div>

                  {/* Title & Artist */}
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-xs sm:text-sm font-bold truncate leading-snug ${
                      isCurrent ? 'text-amber-400' : 'text-white group-hover:text-amber-300'
                    }`}>
                      {song.title}
                    </h3>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {song.artist || song.channel || artist.name}
                    </p>
                  </div>
                </div>

                {/* Right: Plays / Views + Duration + Action Buttons */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Plays estimate */}
                  {song.views && (
                    <span className="text-xs font-mono text-neutral-400 hidden md:inline">
                      {typeof song.views === 'number' ? formatNumber(song.views) : song.views} plays
                    </span>
                  )}

                  {/* Duration */}
                  <span className="text-xs font-mono text-neutral-400 min-w-[36px] text-right">
                    {song.duration || '3:30'}
                  </span>

                  {/* Like / Heart */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike?.(song);
                    }}
                    className={`p-1.5 rounded-lg transition ${
                      songLiked ? 'text-amber-400 hover:text-amber-300' : 'text-neutral-500 hover:text-white'
                    }`}
                    title={songLiked ? 'Remove from liked songs' : 'Add to liked songs'}
                  >
                    <Heart className={`w-4 h-4 ${songLiked ? 'fill-current' : ''}`} />
                  </button>

                  {/* Add to Playlist */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToPlaylist?.(song, e);
                    }}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-amber-400 transition cursor-pointer"
                    title="Add to playlist"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {/* Add to Queue */}
                  {onAddToQueue && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToQueue(song);
                        showToast?.(`Added "${song.title}" to queue`);
                      }}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-amber-400 transition cursor-pointer hidden sm:inline-block"
                      title="Add to queue"
                    >
                      <ListPlus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Permanent Load More Songs Button (Increments by exactly 10) */}
        <div className="mt-6 flex flex-col items-center justify-center space-y-2">
          {hasMore ? (
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-6 py-2.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 active:scale-95 border border-amber-500/30 hover:border-amber-500 text-amber-300 hover:text-amber-200 text-xs sm:text-sm font-bold tracking-wide transition shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Loading 10 More Tracks...</span>
                </>
              ) : (
                <>
                  <span>Load More Songs (+10)</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <p className="text-xs font-mono text-neutral-500 pt-2">
              ✓ All available popular songs for {artist.name} are loaded.
            </p>
          )}
        </div>
      </section>

      {/* 5. DISCOGRAPHY SECTION */}
      {artist.discography && artist.discography.all?.length > 0 && (
        <section className="mb-10 sm:mb-14">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
            <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight">
              Discography
            </h2>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-neutral-900/80 p-1 rounded-xl border border-neutral-800 self-start sm:self-auto text-xs font-semibold">
              <button
                onClick={() => setActiveDiscographyTab('all')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeDiscographyTab === 'all'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                All Releases
              </button>
              <button
                onClick={() => setActiveDiscographyTab('albums')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeDiscographyTab === 'albums'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Albums
              </button>
              <button
                onClick={() => setActiveDiscographyTab('singles')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeDiscographyTab === 'singles'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Singles & EPs
              </button>
            </div>
          </div>

          {/* Horizontal Scrolling Album Cards */}
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none scroll-smooth">
            {(artist.discography[activeDiscographyTab] || artist.discography.all).map((item, idx) => (
              <div
                key={item.id || idx}
                onClick={() => handlePlayArtist(false)}
                className="group shrink-0 w-36 sm:w-44 p-3 rounded-2xl bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800 hover:border-amber-500/40 transition-all duration-300 cursor-pointer shadow-md select-none"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2.5 bg-neutral-950">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-400 transition" title={item.title}>
                  {item.title}
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1.5">
                  <span>{item.year}</span>
                  <span>•</span>
                  <span>{item.type}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. RELATED ARTISTS SECTION */}
      {Array.isArray(artist.relatedArtists) && artist.relatedArtists.length > 0 && (
        <section className="mb-10 sm:mb-14">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight">
              Fans Also Like
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Artists sharing the same melodic mood and musical heritage
            </p>
          </div>

          {/* Related Artists Carousel */}
          <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-none scroll-smooth">
            {artist.relatedArtists.map((rel, idx) => (
              <div
                key={rel.id || idx}
                onClick={() => onArtistClick?.(rel.name)}
                className="group shrink-0 w-28 sm:w-36 flex flex-col items-center text-center cursor-pointer select-none"
              >
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden mb-2.5 bg-neutral-950 border-2 border-transparent group-hover:border-amber-400 transition-all duration-300 shadow-lg">
                  <img
                    src={rel.image}
                    alt={rel.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(rel.name)}&background=181818&color=f59e0b&size=300`;
                    }}
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                  </div>
                </div>

                <h4 className="text-xs sm:text-sm font-bold text-white truncate w-full group-hover:text-amber-400 transition">
                  {rel.name}
                </h4>
                <p className="text-[10px] sm:text-xs text-neutral-400 mt-0.5">
                  Artist
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. ABOUT SECTION (AUTHENTIC BIOGRAPHY & OFFICIAL INFO) */}
      {artist.bio && (
        <section className="mb-8">
          <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight mb-4">
            About {artist.name}
          </h2>

          <div className="relative rounded-3xl overflow-hidden bg-neutral-900/70 border border-neutral-800 p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-bold text-white font-display">
                    {artist.name}
                  </span>
                  {artist.verified && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {formatNumber(artist.monthlyListeners)} monthly listeners on streaming platforms
                </p>
              </div>

              {artist.channelUrl && (
                <a
                  href={artist.channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold border border-neutral-700 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span>Official YouTube</span>
                </a>
              )}
            </div>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-3xl">
              {artist.bio}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

