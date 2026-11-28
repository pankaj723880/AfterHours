import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { GoogleLogin, useGoogleLogin } from '@react-oauth/google';
import { Reorder, useDragControls } from 'framer-motion';
import { safeParseJsonResponse, fetchWithRetry, pingServerHealth, subscribeToWakeStatus } from './utils/errorHandler';
import { CURATED_STATION_TRACKS } from './constants/curatedPlaylists';
import HomeSearchBar from './components/Search/HomeSearchBar';

// Lazy-loaded heavy views and modals with automatic retry on stale/transient dynamic import failures
const lazyWithRetry = (importFn, key = 'loopra_chunk_retry') =>
  lazy(() =>
    importFn().catch((error) => {
      console.warn('[DynamicImport] Chunk load error, attempting recovery:', error?.message);
      const lastRetryTime = sessionStorage.getItem(key);
      const now = Date.now();
      // Only reload if we haven't retried this key within the last 15 seconds (prevents reload storms)
      if (!lastRetryTime || now - parseInt(lastRetryTime, 10) > 15000) {
        sessionStorage.setItem(key, String(now));
        // Clear caches if service worker is active and reload
        try {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((regs) => {
              for (const reg of regs) reg.update();
            });
          }
        } catch (_) {}
        window.location.reload();
      }
      throw error;
    })
  );

const AdminDashboard = lazyWithRetry(() => import('./components/Admin/AdminDashboard'), 'retry_admin');
const Turntable3D = lazyWithRetry(() => import('./components/Player/Turntable3D'), 'retry_turntable');
const AudioSpectrumVisualizer = lazyWithRetry(() => import('./components/Player/AudioSpectrumVisualizer'), 'retry_spectrum');
const StudioLoungeAtmosphere = lazyWithRetry(() => import('./components/Player/StudioLoungeAtmosphere'), 'retry_studio');
const OfflineLibraryView = lazyWithRetry(() => import('./components/Offline/OfflineLibraryView'), 'retry_offline_lib');
const OfflineEligibleExploreView = lazyWithRetry(() => import('./components/Offline/OfflineEligibleExploreView'), 'retry_offline_explore');
const ListeningRoomsView = lazyWithRetry(() => import('./components/Social/ListeningRoomsView'), 'retry_rooms_view');
const SimilarSongsModal = lazyWithRetry(() => import('./components/Recommendations/SimilarSongsModal'), 'retry_similar');
const LyricsModal = lazyWithRetry(() => import('./components/Player/LyricsModal'), 'retry_lyrics');
const SleepTimerModal = lazyWithRetry(() => import('./components/Player/SleepTimerModal'), 'retry_sleep');
const PlayerSettingsModal = lazyWithRetry(() => import('./components/Player/PlayerSettingsModal'), 'retry_settings');
const SuggestedForYouSection = lazyWithRetry(() => import('./components/Player/SuggestedForYouSection'), 'retry_suggested');
const MoodToMusicSection = lazyWithRetry(() => import('./components/Mood/MoodToMusicSection'), 'retry_mood');
const PersonalizedRecommendationsSection = lazyWithRetry(() => import('./components/Recommendations/PersonalizedRecommendationsSection'), 'retry_recs');
const LoopraAiCompanion = lazyWithRetry(() => import('./components/AiMusicCompanion/LoopraAiCompanion'), 'retry_ai');
const VoiceAgentModal = lazyWithRetry(() => import('./components/VoiceAgent/VoiceAgentModal'), 'retry_voice');
const LoopraCanvas = lazyWithRetry(() => import('./components/Player/LoopraCanvas'), 'retry_canvas');
const NostalgiaStationView = lazyWithRetry(() => import('./components/Radio/NostalgiaStationView'), 'retry_nostalgia');
const ListeningStatsModal = lazyWithRetry(() => import('./components/Stats/ListeningStatsModal'), 'retry_stats');
const UserProfileModal = lazyWithRetry(() => import('./components/Profile/UserProfileModal'), 'retry_profile');
const DiscoverSwipe = lazyWithRetry(() => import('./components/Discover/DiscoverSwipe'), 'retry_swipe');
const DjClubPage = lazyWithRetry(() => import('./components/DjClub/DjClubPage'), 'retry_dj');
const RelaxModeView = lazyWithRetry(() => import('./components/Relax/RelaxModeView'), 'retry_relax');
import CinematicVideoPlayer from './components/Player/CinematicVideoPlayer';
import { requestVideoPictureInPicture, requestAudioPictureInPicture } from './utils/pictureInPictureManager';
import AppSplashScreen from './components/Common/AppSplashScreen';
import CmsAnnouncementBar from './components/Common/CmsAnnouncementBar';
import CmsHeroBanner from './components/Common/CmsHeroBanner';
import CmsMaintenanceOverlay from './components/Common/CmsMaintenanceOverlay';
import CmsCuratedCollectionsRow from './components/Common/CmsCuratedCollectionsRow';
import AppUpdateModal from './components/Common/AppUpdateModal';
import { triggerApkDownload, checkForAppUpdate, isUpdateSnoozed, fetchPublishedAppVersion, getInstalledAppVersion, getDirectApkDownloadUrl, isRunningInAndroidApp } from './services/appUpdateService';
import { getCachedCmsConfig, fetchPublicCmsConfig, applyThemeToDom, normalizeCmsConfig, resolvePlatformConfig } from './services/cmsClient';
import { offlineEligibilityService } from './services/offlineEligibilityService';
import { offlineStorageService } from './services/offlineStorageService';
import { smartQueueService } from './services/smartQueueService';
import { locationAnalyticsService, LOOPRA_REGIONS } from './services/locationAnalyticsService';
import { getCachedAudioFromDB, isTrackCachedInDB, cacheSongToDB, extractCleanVideoId } from './utils/offlineAudioCache';
import DownloadTrackButton from './components/Offline/DownloadTrackButton';
import RegionalMusicSection from './components/Home/RegionalMusicSection';
import UserAvatar from './components/Common/UserAvatar';
import { getAvatarUrl } from './utils/avatar';
import DiscoverView from './components/Discover/DiscoverView';
import {
  initNavigation,
  pushNavigation,
  popNavigation,
  syncPopState,
  canGoBack,
  buildPath
} from './utils/navigationManager';

// Helper to determine if current route is root Home
const isHomePage = (tab = 'home', extra = {}) => {
  if (tab !== 'home') return false;
  if (
    extra?.showAllTrending ||
    extra?.showAllArtists ||
    extra?.showAllAlbums ||
    extra?.showAllRadio ||
    extra?.selectedPlaylistForView ||
    extra?.offlineSubView === 'explore'
  ) {
    return false;
  }
  return true;
};
import RecommendedRow from './components/Common/RecommendedRow';
import HomeHero from './components/Home/HomeHero';
import FeatureShortcuts from './components/Home/FeatureShortcuts';
import CompactHeroV2 from './components/Home/CompactHeroV2';
import CompactFeatureDeckV2 from './components/Home/CompactFeatureDeckV2';
import { USE_COMPACT_V2_UI, USE_V2_DRAWER, USE_V2_PLAYLISTS_UI, USE_V2_LIBRARY_UI, USE_V2_SWIPE_UI } from './constants/featureFlags';
import { listeningStatsService } from './services/listeningStatsService';
import { recommendationsClient } from './services/recommendationsClient';
import { learningIntelligenceClient } from './services/learningIntelligenceClient';
import { validatePlaybackTrack } from './services/musicValidationClient';
const TimeMachineRadio = lazyWithRetry(() => import('./components/Radio/TimeMachineRadio'), 'retry_timemachine');
const IndianRadioView = lazyWithRetry(() => import('./components/Radio/IndianRadioView'), 'retry_indian_radio');

// Lazy load HLS library only when an HLS radio stream is played
let hlsModulePromise = null;
const loadHls = async () => {
  if (typeof window !== 'undefined' && window.Hls) return window.Hls;
  if (!hlsModulePromise) {
    hlsModulePromise = import('hls.js').then((mod) => {
      const HlsLib = mod.default || mod;
      if (typeof window !== 'undefined') window.Hls = HlsLib;
      return HlsLib;
    });
  }
  return hlsModulePromise;
};
const ActivityFeed = lazyWithRetry(() => import('./components/Activity/ActivityFeed'), 'retry_activity');
import MobileBottomNav from './components/Navigation/MobileBottomNav';
import LoopraFooter from './components/Navigation/LoopraFooter';
const AndroidApkDownloadSection = lazyWithRetry(() => import('./components/Common/AndroidApkDownloadSection'), 'retry_apk_dl');
const ArtistProfileView = lazyWithRetry(() => import('./components/Artist/ArtistProfileView'), 'retry_artist');
import { voiceControlService } from './services/voiceControlService';
import { useVoiceRollout } from './hooks/useVoiceRollout';
import { useUiConfig } from './context/UiConfigContext';
import { useServerKeepAlive } from './hooks/useServerKeepAlive';
import shuffleService from './services/shuffleService';
import { filterSingleSongs, isSingleSong, isCleanMusicTrack, isValidMusicTrack, sanitizeTrack, parseDurationToSeconds } from './services/songFilter';
import { curateSwipeDeck, filterStrictSoloTracks } from './services/swipeCurationService';
const RatingPopupModal = lazyWithRetry(() => import('./components/Rating/RatingPopupModal'), 'retry_rating');
import HomepageReviewsSection from './components/Rating/HomepageReviewsSection';
import { updateRouteMetadata } from './utils/seo';
import { formatTrackDuration } from './utils/duration';
import { TrackDeduplicator, getCanonicalSongKey } from './utils/trackIdentity';
import {
  isThumbnailUrlFormatValid,
  getCleanThumbnail,
  invalidateVideoIdClient
} from './utils/thumbnailValidator';
import {
  getTabAuthToken,
  getTabAuthUser,
  setTabAuthSession,
  clearTabAuthSession
} from './utils/storage';

import { io } from 'socket.io-client';
import { BACKEND_URL, getApiUrl } from './utils/apiUrl';
export { BACKEND_URL, getApiUrl };

offlineEligibilityService.setBackendUrl(BACKEND_URL);

const getInitialAuthToken = () => {
  return getTabAuthToken();
};

const getOrCreateSessionId = () => {
  if (typeof window === 'undefined') return 'sid_ssr';
  let sid = null;
  try {
    sid = sessionStorage.getItem('afterhours_session_id');
    if (!sid) {
      sid = 'sid_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      sessionStorage.setItem('afterhours_session_id', sid);
    }
  } catch (_) {
    sid = 'sid_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
  }
  return sid;
};

export const socket = io(BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : ''), {
  auth: {
    sessionId: getOrCreateSessionId(),
    token: getInitialAuthToken()
  },
  query: { sessionId: getOrCreateSessionId() },
  transports: ['polling', 'websocket'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  timeout: 10000,
  autoConnect: false,
});

// Non-blocking asynchronous connect after main thread initial UI render
if (typeof window !== 'undefined') {
  const scheduleSocketConnect = () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => socket.connect(), { timeout: 2500 });
    } else {
      setTimeout(() => socket.connect(), 600);
    }
  };
  if (document.readyState === 'complete') {
    scheduleSocketConnect();
  } else {
    window.addEventListener('load', scheduleSocketConnect, { once: true });
  }
}

let hasLoggedSocketWarn = false;
let socketReconnectAttempts = 0;
let hasLoggedSocketConnect = false;

socket.on('connect_error', (err) => {
  socketReconnectAttempts++;
  if (!hasLoggedSocketWarn) {
    hasLoggedSocketWarn = true;
    console.info('[Socket.io] Real-time backend waking up or connecting in background:', err?.message || 'Server spin-up');
  }
});

socket.on('connect', () => {
  hasLoggedSocketWarn = false;
  socketReconnectAttempts = 0;
  if (!hasLoggedSocketConnect) {
    hasLoggedSocketConnect = true;
    console.log('[Socket.io] Real-time connection established successfully.');
  }
});

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Reconnect manually if disconnected by server
    socket.connect();
  }
});

socket.on('listening_stats_updated', (data) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('loopra_listening_stats_updated', { detail: data }));
  }
});

const fetchFromBackend = async (query, options = {}) => {
  const timeoutMs = options.timeoutMs || 25000;
  const callerSignal = options.signal;

  if (callerSignal && callerSignal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const { limit, pageToken } = options;
  let path = `/api/youtube/search?q=${encodeURIComponent(query)}`;
  if (limit) path += `&limit=${encodeURIComponent(limit)}`;
  if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;

  // Function to execute a fetch attempt with its own bounded timeout and caller cancellation listener
  const attemptFetch = async (targetUrl, attemptTimeoutMs) => {
    const attemptController = new AbortController();
    const onCallerAbort = () => {
      try { attemptController.abort(); } catch (_) {}
    };

    if (callerSignal) {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }

    const timerId = setTimeout(() => {
      try {
        attemptController.abort(new Error(`Backend request timed out after ${Math.round(attemptTimeoutMs / 1000)}s`));
      } catch (_) {
        attemptController.abort();
      }
    }, attemptTimeoutMs);

    try {
      const res = await fetchWithRetry(targetUrl, {
        signal: attemptController.signal,
        headers: {
          'X-Session-ID': getOrCreateSessionId()
        }
      });
      clearTimeout(timerId);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
      return res;
    } catch (err) {
      clearTimeout(timerId);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
      throw err;
    }
  };

  try {
    let res;
    try {
      res = await attemptFetch(getApiUrl(path), timeoutMs);
    } catch (primaryErr) {
      if (callerSignal && callerSignal.aborted) {
        throw primaryErr;
      }
      // If primary URL failed and wasn't already pointing to Render, failover to direct Render URL with fresh controller
      if (!BACKEND_URL.includes('onrender.com')) {
        res = await attemptFetch(`https://afterhours-zvic.onrender.com${path}`, timeoutMs);
      } else {
        throw primaryErr;
      }
    }

    const parsed = await safeParseJsonResponse(res, 'Backend search failed');
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    return parsed.data || { items: [] };
  } catch (err) {
    if (callerSignal && callerSignal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (err?.name !== 'AbortError') {
      console.warn("Backend fetch notice:", err.message);
    }
    throw err;
  }
};

// Direct audio URL resolution removed to avoid CORS and 206 failures

const Icon = ({ name, className = "w-5 h-5", ...props }) => {
  const icons = {
    play: <path d="M5 3l14 9-14 9V3z" fill="currentColor" />,
    pause: <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor" />,
    skipNext: <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor" />,
    skipPrev: <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" fill="currentColor" />,
    search: <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor" />,
    heart: <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" />,
    heartOutline: <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5 2 12.28 5.4 15.36 10.55 20.03L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" fill="currentColor" />,
    discover: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor" />,
    library: <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM12 5.5v9l6-4.5z" fill="currentColor" />,
    history: <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill="currentColor" />,
    scissors: <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14.07l7.59 7.59 1.41-1.41L9.64 7.64zM6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm13-8l3-3-1.41-1.41L18 10.17 15.41 7.59 14 9l5 5z" fill="currentColor" />,
    truck: <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-7.5l1.96 2.5H17V11h2.5zm-1 7.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="currentColor" />,
    beer: <path d="M4 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V2H4zm12 18H6V4h10v16zM18 6h3c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2h-3v-2h3V8h-3V6z" fill="currentColor" />,
    radio: <path d="M3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2H8.3l7.43-3.71-1.41-1.41L3.24 6.15Z" fill="currentColor" />,
    sparkles: <path d="M12 2L9.19 8.63 2 11.5l7.19 2.87L12 21l2.81-6.63L22 11.5l-7.19-2.87z" fill="currentColor" />,
    music: <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="currentColor" />,
    headphones: <path d="M12 3a9 9 0 0 0-9 9v7a3 3 0 0 0 3 3h1a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5v-2a7 7 0 0 1 14 0v2h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1a3 3 0 0 0 3-3v-7a9 9 0 0 0-9-9z" fill="currentColor" />,
    shuffle: <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" fill="currentColor" />,
    repeat: <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill="currentColor" />,
    volume: <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor" />,
    plus: <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />,
    list: <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" fill="currentColor" />,
    expand: <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor" />,
    collapse: <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" fill="currentColor" />,
    menu: <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor" />,
    arrowLeft: <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor" />,
    close: <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor" />,
    external: <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" fill="currentColor" />,
    chevronUp: <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" fill="currentColor" />,
    chevronDown: <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" fill="currentColor" />,
    download: <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor" />,
    info: <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor" />,
    home: <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />,
    video: <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" fill="currentColor" />,
    trash: <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor" />,
    edit: <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />,
    moreVertical: <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="currentColor" />,
    user: <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />,
    grip: <path d="M9 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-16a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="currentColor" />,
    shield: <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" fill="currentColor" />,
    mic: <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="currentColor" />,
    timer: <path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" fill="currentColor" />,
    volumeMute: <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor" />,
    share: <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" fill="currentColor" />,
    flame: <path d="M13.5 1.5s0 3.5-3 5.5C8.5 8.5 7 11 7 14c0 3.87 3.13 7 7 7s7-3.13 7-7c0-4-3-8.5-7.5-12.5zm0 17.5c-2.21 0-4-1.79-4-4 0-1.8 1.05-3.32 2.5-4.04.38 1.64 1.83 2.87 3.5 2.87 2.02 0 3.66-1.64 3.66-3.66 0-.3-.04-.59-.11-.87 1.49 1.49 2.45 3.5 2.45 5.7 0 2.21-1.79 4-4 4z" fill="currentColor" />,
    swipe: <path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74a4.5 4.5 0 0 0-9 0c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26A2.01 2.01 0 0 0 13.4 13.5H13v-6a1 1 0 0 0-2 0v10.59l-3.29-.69a1.002 1.002 0 0 0-1.04.42l-.58.88 5.13 5.17c.56.56 1.33.87 2.12.87h6.66c1.53 0 2.8-1.15 2.97-2.67l.55-4.99a2.01 2.01 0 0 0-.68-1.85z" fill="currentColor" />,
    settings: <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor" />,
    sliders: <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" fill="currentColor" />,
    messageSquare: <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor" />,
    chat: <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor" />,
    users: <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />
  };
  return (
    <svg className={className} viewBox="0 0 24 24" {...props}>
      {icons[name] || icons.music}
    </svg>
  );
};

const DisclaimerFooter = React.memo(({
  footer,
  branding,
  onNavigate,
  onOpenInsights,
  onOpenRatingModal,
  onScrollToTop,
  isVisible = true
}) => {
  if (!isVisible) return null;
  return (
    <LoopraFooter
      footer={footer}
      branding={branding}
      onNavigate={onNavigate}
      onOpenInsights={onOpenInsights}
      onOpenRatingModal={onOpenRatingModal}
      onScrollToTop={onScrollToTop}
    />
  );
});

const SPECIAL_STATIONS = {
  barber: {
    id: "barber",
    title: "Saloon FM",
    subtitle: "Iconic 90s & 2000s Bollywood Melodies, Golden Era Romance & Nostalgic Radio Hits",
    badge: "💈 Saloon FM • 90s/2000s Nostalgia Radio",
    bgImages: [
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: ["90s bollywood hit songs kumar sanu Alka Yagnik"]
  },
  truck: {
    id: "truck",
    title: "Horn Ok Please",
    subtitle: "High-Bass Highway Tracks, Rustic Punjabi Folk/Dhol Beats & Dhabha Anthems",
    badge: "🚛 Horn Ok Please • Highway Dhaba Vibe",
    bgImages: [
      "https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1508873696983-2df5c92063c7?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: ["altaf raja best songs hindi highway dhaba hits"]
  },
  pauwa: {
    id: "pauwa",
    title: "Theka Session",
    subtitle: "Late-Night Party Anthems, High-Energy Drinking Bangers & Desi Hip-Hop",
    badge: "🍾 Theka Session • Desi Beats & Party Anthems",
    bgImages: [
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: [
      "punjabi daru peg songs party hits yo yo honey singh badshah",
      "altaf raja sad songs dard bhare geet wine heartbreak"
    ]
  },
  romance: {
    id: "romance",
    title: "Pehla Nasha",
    subtitle: "Golden 90s Romance, Monsoon Melodies, Udit Narayan & Alka Yagnik Duets",
    badge: "💖 Pehla Nasha • 90s Golden Romance",
    bgImages: [
      "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: ["90s romantic bollywood songs udit narayan alka yagnik kumar sanu"]
  },
  sad_songs: {
    id: "sad_songs",
    title: "Dard-E-Dil",
    subtitle: "Heartbreak Ghazals, Nostalgic Sentimental Melodies & Midnight Broken Chords",
    badge: "💔 Dard-E-Dil • Late Night Melancholy",
    bgImages: [
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: ["dard bhare nagme sad songs hindi bollywood 90s jagjit singh ghazals"]
  },
  chill: {
    id: "chill",
    title: "Mehfil Lounge",
    subtitle: "Acoustic Unplugged, Lo-Fi Desi Chills, Soft Sitar & Sufi Midnight Vibe",
    badge: "☕ Mehfil Lounge • Acoustic & Lo-Fi Chill",
    bgImages: [
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: ["bollywood acoustic unplugged lofi hindi chill sufi songs"]
  }
};

const formatTime = (secs) => {
  if (isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

/**
 * Production-Grade Track Metadata Sanitizer & Artist Extraction
 * Strips noisy YouTube suffixes, bracket tags, lyric/official clutter, and maps "Artist - Title" properly
 */
export const sanitizeTrackMetadata = (rawTitle = '', rawArtist = '') => {
  if (!rawTitle) return { title: 'Untitled Track', artist: rawArtist || 'Unknown Artist' };

  let title = rawTitle
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

  let artist = (rawArtist || '').trim();

  // 1. Strip common label suffixes from artist / channel title (e.g. "T-Series Official Channel" -> "T-Series")
  if (artist) {
    artist = artist
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*VEVO$/i, '')
      .replace(/\s+Official(?:\s+(?:Channel|Music|Page|Audio))?$/i, '')
      .trim();
  }

  // 2. Parse "Artist - Title" or "Artist | Title" pattern
  const separatorMatch = title.match(/^([^|\-–—:]+?)\s*[-–—|:]\s*(.+)$/);
  if (separatorMatch) {
    const candidateArtist = separatorMatch[1].trim();
    const candidateTitle = separatorMatch[2].trim();

    // Verify candidate artist doesn't look like an episode or promo tag
    if (candidateArtist.length > 1 && candidateArtist.length < 40 && !/^(episode|ep|full|new|top|official)/i.test(candidateArtist)) {
      if (!artist || artist === 'Unknown Artist' || /VEVO|Topic|Official|Records|Music/i.test(artist)) {
        artist = candidateArtist;
      }
      title = candidateTitle;
    }
  }

  // 3. Strip noisy bracket tags and YouTube clickbait/format phrases
  title = title
    // Bracketed noise: [Official Video], (Audio), (Lyrics Video), etc.
    .replace(/\s*[([{\u3010][^)\]}\u3011]*(?:official|audio|video|lyric|lyrics|full song|hd|4k|8k|remix|lofi|slowed|reverb|teaser|trailer|visualizer|short|mashup|jukebox|uhd|music video|prod\.|feat|ft\.)[^)\]}\u3011]*[)\]}\u3011]/gi, '')
    // Trailing hyphens with noise: - Official Video / - Audio
    .replace(/\s*-\s*(?:official\s*(?:video|audio|music|lyric)?|audio|video|lyrics?|full\s*song|remix|lo-?fi|slowed).*$/gi, '')
    // Common promotional phrases
    .replace(/\s*\|\s*(?:official|lyrics?|video|audio|full song|hd).*$/gi, '')
    // Emojis and excess punctuation symbols
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Clean redundant spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Fallback if cleaning stripped too aggressively
  if (!title) {
    title = rawTitle.replace(/[\[\]\(\)]/g, '').trim() || 'Untitled Track';
  }

  if (!artist || artist.toLowerCase() === 'unknown artist') {
    artist = 'Loopra Music';
  }

  return { title, artist };
};

/**
 * Returns clean, high-resolution square artwork for MediaMetadata.
 * Ensures multi-resolution entries (96x96 up to 512x512) and avoids wide/distorted banners.
 */
export const getCleanMediaSessionArtwork = (track) => {
  if (!track) {
    return [{ src: `${window.location.origin}/loopra-logo.png`, sizes: '512x512', type: 'image/png' }];
  }

  // Priority: explicit high-res square cover -> album art -> thumbnail -> image
  const rawCandidate = track.coverArt || track.albumArt || track.image || track.thumbnail || '/loopra-logo.png';
  let cleanUrl = typeof rawCandidate === 'string' && rawCandidate.trim() ? rawCandidate.trim() : '/loopra-logo.png';

  // If YouTube thumbnail, prefer mqdefault or hqdefault/maxresdefault cleanly formatted
  if (cleanUrl.includes('ytimg.com') || cleanUrl.includes('youtube.com')) {
    const ytMatch = cleanUrl.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//) || cleanUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) {
      const vidId = ytMatch[1];
      // Use clean HQ thumbnail
      cleanUrl = `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;
    }
  }

  const absoluteUrl = cleanUrl.startsWith('http') || cleanUrl.startsWith('blob:') || cleanUrl.startsWith('data:')
    ? cleanUrl
    : `${window.location.origin}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;

  const isPng = absoluteUrl.toLowerCase().endsWith('.png');
  const mimeType = isPng ? 'image/png' : 'image/jpeg';

  return [
    { src: absoluteUrl, sizes: '96x96', type: mimeType },
    { src: absoluteUrl, sizes: '128x128', type: mimeType },
    { src: absoluteUrl, sizes: '192x192', type: mimeType },
    { src: absoluteUrl, sizes: '256x256', type: mimeType },
    { src: absoluteUrl, sizes: '384x384', type: mimeType },
    { src: absoluteUrl, sizes: '512x512', type: mimeType }
  ];
};

const handleImageLoad = (e) => {
  const target = e.currentTarget || e.target;
  if (!target) return;
  const w = target.naturalWidth;
  const h = target.naturalHeight;
  // If YouTube 120x90 unavailable placeholder or broken 1x1 image
  if (w <= 1 || h <= 1 || (w === 120 && h === 90)) {
    target.style.display = 'none';
    const cardGroup = target.closest('.group');
    if (cardGroup && !cardGroup.classList.contains('artist-card')) {
      cardGroup.style.display = 'none';
    }
  }
};

const handleImageError = (e, fallbackTitle, explicitId) => {
  const target = e.currentTarget || e.target;
  if (!target) return;

  const safeId = typeof explicitId === 'string' ? explicitId : (explicitId?.videoId || null);
  if (safeId) {
    invalidateVideoIdClient(safeId);
  }

  // Graceful fallback for artist profile pictures without video ID
  if (!explicitId && fallbackTitle) {
    target.onerror = null;
    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackTitle)}&background=1e1e1e&color=f59e0b&size=300`;
    return;
  }

  const attempts = parseInt(target.dataset.errorAttempts || '0', 10);
  const currentSrc = target.src || '';

  if (attempts >= 1 || !isThumbnailUrlFormatValid(currentSrc)) {
    target.onerror = null;
    // Hide the broken image and remove/hide broken song card container so no placeholder is shown
    target.style.display = 'none';
    const cardGroup = target.closest('.group');
    if (cardGroup && !cardGroup.classList.contains('artist-card')) {
      cardGroup.style.display = 'none';
    }
    return;
  }

  target.dataset.errorAttempts = (attempts + 1).toString();

  const ytMatch = currentSrc.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//) || (safeId ? [null, safeId] : null);
  if (ytMatch && ytMatch[1] && typeof ytMatch[1] === 'string' && !currentSrc.includes('mqdefault.jpg')) {
    target.src = `https://i.ytimg.com/vi/${ytMatch[1]}/mqdefault.jpg`;
    return;
  }

  target.onerror = null;
  target.style.display = 'none';
  const cardGroup = target.closest('.group');
  if (cardGroup && !cardGroup.classList.contains('artist-card')) {
    cardGroup.style.display = 'none';
  }
};

const PlayerProgress = React.memo(({ playerRef, isPlaying, onSeek, currentSongId, isRadio = false, currentTimeRef, durationRef }) => {
  const [currentTime, setCurrentTime] = useState(() => {
    try {
      const savedSong = JSON.parse(localStorage.getItem('afterhours_current_song') || 'null');
      if (savedSong) {
        return parseFloat(localStorage.getItem('afterhours_current_time') || '0') || 0;
      }
    } catch (e) {}
    return 0;
  });
  const [duration, setDuration] = useState(() => {
    try {
      const savedSong = JSON.parse(localStorage.getItem('afterhours_current_song') || 'null');
      if (savedSong) {
        return parseFloat(localStorage.getItem('afterhours_duration') || '0') || 0;
      }
    } catch (e) {}
    return 0;
  });
  const [isSeeking, setIsSeeking] = useState(false);
  const lastSavedTimeRef = useRef(0);
  const hasPreloadedNextRef = useRef(false);

  // Reset preload state on track change
  useEffect(() => {
    hasPreloadedNextRef.current = false;
  }, [currentSongId]);

  useEffect(() => {
    let interval;
    if (isPlaying && !isSeeking) {
      const checkAndUpdateTime = () => {
        try {
          let curTime = 0;
          let totalDur = 0;
          const player = playerRef?.current;

          if (player && typeof player.getCurrentTime === 'function') {
            let state = -1;
            try {
              if (typeof player.getPlayerState === 'function') {
                state = player.getPlayerState();
              }
            } catch (_) {}

            // For offline / HTML5 audio player or playing/buffering YouTube states:
            const isOfflinePlayer = Boolean(player.isOffline || player.isRadio);
            if (isOfflinePlayer || state === 1 || state === 3 || (state === -1 && player._isReady) || state === -1) {
              try {
                const cur = player.getCurrentTime();
                if (typeof cur === 'number' && !isNaN(cur)) {
                  curTime = cur;
                  setCurrentTime(cur);
                  if (currentTimeRef) {
                    currentTimeRef.current = cur;
                  }
                  if (Math.abs(cur - lastSavedTimeRef.current) >= 2) {
                    lastSavedTimeRef.current = cur;
                    try {
                      localStorage.setItem('afterhours_current_time', cur.toString());
                    } catch (e) {}
                  }
                }
              } catch (_) {}
            }
          }

          if (player && typeof player.getDuration === 'function') {
            let state = 1;
            try {
              if (typeof player.getPlayerState === 'function') {
                state = player.getPlayerState();
              }
            } catch (_) {}

            const isOfflinePlayer = Boolean(player.isOffline || player.isRadio);
            if (isOfflinePlayer || state === 1 || state === 2 || state === 3 || typeof state !== 'number') {
              const dur = player.getDuration();
              if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
                totalDur = dur;
                if (durationRef) {
                  durationRef.current = dur;
                }
                setDuration(prev => {
                  if (prev !== dur) {
                    try { localStorage.setItem('afterhours_duration', dur.toString()); } catch (e) {}
                    return dur;
                  }
                  return prev;
                });
              }
            }
          }

          // Pre-fetch / preload the next up-next track when current track hits 80% duration
          if (totalDur > 10 && curTime > 0 && (curTime / totalDur >= 0.8) && !hasPreloadedNextRef.current) {
            hasPreloadedNextRef.current = true;
            try {
              window.dispatchEvent(new CustomEvent('loopra:preload-next-track', {
                detail: { currentSongId, curTime, totalDur }
              }));
            } catch (_) {}
          }
        } catch (e) {}
      };

      // Call once immediately upon entering playing state
      checkAndUpdateTime();
      interval = setInterval(checkAndUpdateTime, 250);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, isSeeking, playerRef, currentSongId, currentTimeRef, durationRef]);

  const handleSeekChange = (e) => {
    setCurrentTime(parseFloat(e.target.value));
  };

  const handleSeekCommit = (e) => {
    setIsSeeking(false);
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    try {
      localStorage.setItem('afterhours_current_time', seekTime.toString());
    } catch (e) {}
    if (onSeek) onSeek(seekTime);
  };

  if (isRadio) {
    return (
      <div className="w-full flex items-center justify-center gap-2 text-[10px] font-medium text-amber-400 py-0.5 select-none">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="tracking-widest font-bold uppercase text-amber-300">● LIVE INDIAN RADIO</span>
        <span className="text-neutral-600">•</span>
        <span className="text-neutral-400">Continuous Official Broadcast</span>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center gap-3 text-[10px] font-mono text-neutral-400 select-none">
      <span className="shrink-0 tabular-nums min-w-[32px] text-right">{formatTime(currentTime)}</span>
      <input
        type="range"
        min="0"
        max={duration || 100}
        value={currentTime}
        onChange={handleSeekChange}
        onMouseDown={() => setIsSeeking(true)}
        onTouchStart={() => setIsSeeking(true)}
        onMouseUp={handleSeekCommit}
        onTouchEnd={handleSeekCommit}
        className="flex-1 h-1 bg-neutral-800 rounded-xl appearance-none cursor-pointer accent-amber-500"
      />
      <span className="shrink-0 tabular-nums min-w-[32px] text-left">{formatTime(duration)}</span>
    </div>
  );
});

const QueueItem = React.memo(({ track, isCurrent, isPlaying, onPlay, onRemove, canMoveUp, canMoveDown, onMoveUp, onMoveDown }) => {
  const dragControls = useDragControls();
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const isDraggingRef = useRef(false);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handlePointerDown = (e) => {
    if (e.target.closest('button')) return;

    didDragRef.current = false;
    isDraggingRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      setIsHolding(true);
      didDragRef.current = true;
      isDraggingRef.current = true;
      try {
        if (navigator.vibrate) navigator.vibrate(35);
      } catch (err) {}
      dragControls.start(e);
    }, 180);
  };

  const handlePointerMove = (e) => {
    if (!didDragRef.current && holdTimerRef.current) {
      const dist = Math.hypot(e.clientX - startPosRef.current.x, e.clientY - startPosRef.current.y);
      if (dist > 8) {
        clearHoldTimer();
      }
    }
  };

  const handlePointerUp = () => {
    clearHoldTimer();
    setIsHolding(false);
    isDraggingRef.current = false;
  };

  const handleClick = (e) => {
    if (didDragRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didDragRef.current = false;
      return;
    }
    onPlay(track);
  };

  return (
    <Reorder.Item
      value={track}
      dragListener={false}
      dragControls={dragControls}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDragStart={() => {
        setIsHolding(true);
        didDragRef.current = true;
        isDraggingRef.current = true;
      }}
      onDragEnd={() => {
        setIsHolding(false);
        isDraggingRef.current = false;
        clearHoldTimer();
      }}
      layout="position"
      transition={{
        layout: { type: "spring", stiffness: 450, damping: 32, mass: 0.6 },
        scale: { duration: 0.15, ease: "easeOut" }
      }}
      whileDrag={{
        scale: 1.025,
        zIndex: 60,
        boxShadow: "0 20px 35px -5px rgba(0, 0, 0, 0.8), 0 0 25px rgba(var(--accent-rgb,245,158,11),0.4)",
        backgroundColor: "rgba(24, 24, 27, 0.98)",
        borderColor: "rgba(var(--accent-rgb,245,158,11),0.7)",
        cursor: "grabbing"
      }}
      style={{
        touchAction: isHolding ? 'none' : 'pan-y',
        transform: 'translateZ(0)',
        willChange: 'transform'
      }}
      className={`group flex items-center gap-2.5 sm:gap-3.5 p-2.5 sm:p-3.5 rounded-2xl cursor-pointer select-none relative transition-all duration-200 border backdrop-blur-xl ${
        isHolding
          ? 'bg-amber-500/20 border-amber-500/60 shadow-[0_0_25px_rgba(var(--accent-rgb,245,158,11),0.3)] scale-[1.02] touch-none z-50'
          : isCurrent
          ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-neutral-900/60 border-amber-500/60 shadow-[0_0_25px_rgba(var(--accent-rgb,245,158,11),0.2)]'
          : 'bg-neutral-900/40 hover:bg-neutral-800/60 border-neutral-800/80 hover:border-amber-500/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] hover:-translate-y-0.5'
      }`}
      onClick={handleClick}
    >
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          didDragRef.current = true;
          isDraggingRef.current = true;
          setIsHolding(true);
          try {
            if (navigator.vibrate) navigator.vibrate(30);
          } catch (_) {}
          dragControls.start(e);
        }}
        className="touch-none p-1.5 sm:p-2 -ml-1 text-neutral-500 hover:text-amber-400 group-hover:text-amber-300 transition-colors cursor-grab active:cursor-grabbing shrink-0"
        title="Slide grip to rearrange"
      >
        <Icon name="grip" className="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
      </div>

      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md border border-white/5">
        <img
          src={getCleanThumbnail(track)}
          alt={track.title || ""}
          className="w-full h-full object-cover pointer-events-none"
          onError={(e) => handleImageError(e, track.title, track.id)}
        />
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
            isCurrent ? 'opacity-100 bg-amber-950/40' : ''
          } pointer-events-none`}
        >
          <Icon name={isCurrent && isPlaying ? "pause" : "play"} className="w-5 h-5 text-amber-400 drop-shadow" />
        </div>
      </div>

      <div className="flex-1 min-w-0 pointer-events-none">
        <div className="flex items-center gap-2">
          <h4 className={`font-semibold text-sm truncate ${isCurrent ? 'text-amber-400' : 'text-white group-hover:text-amber-200'} transition-colors`}>
            {track.title}
          </h4>
          {isCurrent && isPlaying && (
            <div className="flex items-end gap-0.5 h-3 shrink-0" title="Now Playing">
              <span className="w-0.5 h-3 bg-amber-400 rounded-full animate-pulse" />
              <span className="w-0.5 h-2 bg-amber-400 rounded-full animate-[pulse_0.7s_infinite_0.2s]" />
              <span className="w-0.5 h-3.5 bg-amber-400 rounded-full animate-[pulse_0.5s_infinite_0.4s]" />
            </div>
          )}
        </div>
        <p className="text-xs text-neutral-400 truncate mt-0.5">{track.channel}</p>
      </div>

      {track.duration && (
        <span className="text-xs text-neutral-500 font-mono shrink-0 pointer-events-none">
          {typeof track.duration === 'object'
            ? (track.duration?.timestamp || (track.duration?.seconds ? `${Math.round(track.duration.seconds)}s` : ''))
            : track.duration}
        </span>
      )}

      {/* Accessible Keyboard & Touch Reorder Controls */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        {onMoveUp && canMoveUp && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            className="p-1 rounded-md text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition cursor-pointer"
            title="Move track up"
            aria-label="Move track up"
          >
            <Icon name="chevronUp" className="w-3.5 h-3.5" />
          </button>
        )}
        {onMoveDown && canMoveDown && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            className="p-1 rounded-md text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition cursor-pointer"
            title="Move track down"
            aria-label="Move track down"
          >
            <Icon name="chevronDown" className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <DownloadTrackButton track={track} variant="icon" />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(track.id);
        }}
        className="text-neutral-500 hover:text-red-400 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 shrink-0 hover:scale-110 active:scale-95"
        title="Remove from Queue"
      >
        <Icon name="close" className="w-4 h-4" />
      </button>
    </Reorder.Item>
  );
});

const TRENDING_SONGS = [
  { id: "RLzC55ai0eo", videoId: "RLzC55ai0eo", title: "Heeriye (Official Video)", artist: "Jasleen Royal ft Arijit Singh", image: "https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg", query: "Heeriye Jasleen Royal Arijit Singh Official Video" },
  { id: "BddP6PYo2gs", videoId: "BddP6PYo2gs", title: "Kesariya (Official Video)", artist: "Arijit Singh, Pritam", image: "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg", query: "Kesariya Arijit Singh Brahmastra Official Video" },
  { id: "cIGd8gm_pYE", videoId: "cIGd8gm_pYE", title: "Lover (Official Music Video)", artist: "Diljit Dosanjh", image: "https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg", query: "Lover Diljit Dosanjh Official Video" },
  { id: "Umqb9KENgmk", videoId: "Umqb9KENgmk", title: "Tum Hi Ho (Official Video)", artist: "Arijit Singh | Mithoon", image: "https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg", query: "Tum Hi Ho Aashiqui 2 Arijit Singh Official Video" },
  { id: "jsgPZVMfJQk", videoId: "jsgPZVMfJQk", title: "Pehle Bhi Main (Official Video)", artist: "Vishal Mishra | Animal", image: "https://i.ytimg.com/vi/jsgPZVMfJQk/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/jsgPZVMfJQk/hqdefault.jpg", query: "Pehle Bhi Main Vishal Mishra Animal Official Video" },
  { id: "O5gwxm3NxFU", videoId: "O5gwxm3NxFU", title: "Channa Mereya (Official Video)", artist: "Arijit Singh | Pritam", image: "https://i.ytimg.com/vi/O5gwxm3NxFU/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/O5gwxm3NxFU/hqdefault.jpg", query: "Channa Mereya Ae Dil Hai Mushkil Arijit Singh Official Video" }
];

const POPULAR_ARTISTS = [
  {
    "name": "Arijit Singh",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/DcEzZrPCQRSSs47rMbdJ3UJkQUCN3X8SKf8aCnvOgd2BmPihAz-0jBGJgEVh9_P8EiSBVNyixDs=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shreya Ghoshal",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/PgINZNe0qVxgMSXKG5vF82bNN4WCC12zgWsz9I7OLs4CLF9Cn0Vxq7Xc1ToupnzXrCv0nKfe3VM=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "A.R. Rahman",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/KJQybwuTx7c9ca68huvMRFOv88Nw2r1g2LroFKP7WVdQmWKpd0y4gYiwPsy_NTJOEhAgZifO-Q=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Kishore Kumar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/VpeI8Z1Zy0cc-ek5mCcp2duFtwVZGlOM4M3q7dX6MXi3fDZ8KUHOMBKe987db2wOs-MxRxdxiQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Lata Mangeshkar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/t1KBLb88VhoCXsnq8QYhpwmD41tcdvnKxq9injUT-kvGUnmfipJScsyo_EjATWHSEexZraZnHzE=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Sonu Nigam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_mDXgKWQEXHW2qJIPoV9uJnLaoPQGXMWsnCQ3hNx2MNEa8=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Udit Narayan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kxFKx4HkNWtuXNJnvgAow_S1uCzZ6hCWS3PUyc_Mo8Eg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Kumar Sanu",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/6HzcXZ7veDgWXD72YDaYNjDuPenUDM8qRzj1vUV_-G1WNxAYqCWckTxJhAqHR4_moQEMzer_=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Alka Yagnik",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/i5DI3JtNpskZZOvYgoW1-q8pY-wOadY2hz-jTQe6EFh25yrpLHOTieEgiN5CrbE7pajBgEhiCw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Neha Kakkar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/F89BItbRffdiUaxtR8d1KLGnz_65jmUDtcUb89-m7DG6b729TRiF86qtU5LM4fbqyp2S7ctZnQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Asha Bhosle",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_mIWst8Y8BTrt9z1sFERFgwQ8QTyZWX6bmguKavScFlog=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Sunidhi Chauhan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/cI3RMhRcDJQg73GEBVYxW6rLZwIq_n5qZyE8IhUM6zJF5WOVpYPyEN2avZMF-2TDtCIFr9qogW4=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Atif Aslam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/o_C-zwiPP8Wgz7T9wi9WzHEUN4lpnpHVoWRTJ0zn8OZECvIqmXUyTTSmTaQW1uKUrEeNFTtU2k0=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Darshan Raval",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/9lSNE7GRMKcDG26OqpuaX6wQVsubvwtQT5PXlGEI1mEOzbcAsNZ_8vDXABKLo4gJlyPBPS1uYA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Jubin Nautiyal",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/H2Ml5UObbCePh2hgUmfLLV3d7NoNO6pqgloMKOMD30sGvOSyBGzeZoNBm_hOwzAzGMHn2Lpn=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Mika Singh",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kxV6a0zmy5XJAZ61ALwhzYKPoExUe2bIAqhdrkIaoiahs=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Badshah",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/-9oGvXUOGtVCmGynMpDFsgufXGL_IRKYxjF3bff8_qnIazQDrIa2MXDT5-xAKAA6rIEC8x2EfiM=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Yo Yo Honey Singh",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/2uUjDK69h-ijAxl6a_XrmKqLdL3ECr78FXXkUWERGJAHpSH0p3DEiNdlOuaR8LT3QCCF9P_ghg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Guru Randhawa",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/djplSJ25P6NAn2Tzvbi-nnUwJdnLtwqReZK5I0Vk3q72oM9nGnkWzTB9TLVfVRa7W1_iju0YQ0E=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Diljit Dosanjh",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/7EYXXMXY594V8y4sZT2aawmdKgDAGTu5jNm9C-HpR3jY9cZJ0NMxS__nZKBdWZ1PUpJPjc2BAA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "K.S. Chithra",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kCGTSKgzGoApggAtgunIKogbnrQQSeQ1i8UlfteLmoAKk=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "S.P. Balasubrahmanyam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_k-cEae30gRWw3b0ZvH1NrJN4qkQ--kZwixsI0uXqV-13E=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Yesudas",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_mOzBohiOrDQWMpnBznY16toIWn4FzbeivP9eS2mIqF298=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Hariharan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/2QMn_GW5tyQI4G2SUK734ZuO09xsRYGSSDa3sCUszaau290JmjvvnS4nseSK3SEY31B0pWbqaQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shankar Mahadevan",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_lxfdg5ZRXrQ-3AJDyHqRGGmdmNijuPbhYIdLPU9F5qSf1Z=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Vishal Dadlani",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/eObpSRvKoWaQZz8KcwYWfKjPVltStK6w68tlEbvLbl3mymlMfleXSNzRcvTG2kmLaeEqqMJuvQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shekhar Ravjiani",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/6ubE1FtZwwNd2C7ahUGo3jQsMKPMM4WCtlfj4qrPoMZnZrycY_BX3NFthm5InTvFTls-OxZqdA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Amit Trivedi",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/vLFf_rhkrGbA6qJYxNdtH4uTT55yEDftwJUyI_LPCaiNxIlUBfWcS8ckva5ZD2JF9_Od4oNBTw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Pritam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/cUtlode_d2bd71bN6AFO-8vZ6Q0KDBWWWgLO9RG9RDRb6Jddw5pSSQN7U9I1Pnb7L0JyWHC82Q=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Mohit Chauhan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_li2lsmbfskQRf4VjFrJ0-qXRPjVmorZu8DsI4fRBBm4Wc=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shaan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/i5LOfQ8gES1w0m7G0nEdta24UgIZkNBZZrsaLYF6U18fgPj2YuZ4qGYyRcAFCAjRoYyF-8AX=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "KK",
    "role": "Artist",
    "image": "https://ui-avatars.com/api/?name=KK&background=181818&color=f59e0b&size=300"
  },
  {
    "name": "Armaan Malik",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/-mURsoNpdl3A5rIywphE98BrLBbUExgzY1AYil_qgBtgAosGD7YgWdQ2VCPhOESWlZrgWxq5=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Amaal Mallik",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ai-f5ZCVJ7c-oc-rew5m0OzgM3Vqntu0s7avu0_0NhkIcHlKWhReRCQsVr9-Q9B5Cwym4MarOQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Bappi Lahiri",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/e86NH0OOOGmTI-0rGxapF7RhpQsfv0mIxDKPSF1e5c6Z2eW2R0NkgSFx5J2nmp16t7PMvur7jQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Mohammed Rafi",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Mukesh",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/tyeB_Soa4UKGDZz6a6guVdixn5_mBlxVCKHY3yeohqDsK1TzRYr3lGJWhn2JeYQzhi0SIXRbhw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Hemant Kumar",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_kvw0Ok7MWPzrt-UoxmEYymNd_RYE7jZgr28yJO7uWmDAo=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Manna Dey",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/gBDgPkzQKdW4q7vMB52dTYSWdImmR8t626oD4nbYH_qTJmlz7Ziaxnedrqj9AfhktVPFRgXq2g=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Geeta Dutt",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Shamshad Begum",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/JnSWLHSvtV7qgdHrKf4EDD5VGdBGESDWrdO0_S2tBb78AO_mhLeJ7sP8lCm_ejcch9ZUmJeu0Q=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Suraiya",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/gROoXIi5JeZSWGOUFvFQBhfPAp0c6c3LZcIiWtnVvSeQUpOQn9nlgf-RmMb1mrhY55mux-gGHw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Kavita Krishnamurthy",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/H1k69zHrKg3ri3xadTwBU5nsH7cKcfJbEgi5fSjFqvnvEGPCfACsmEXG-HJp8DPdWj6yDHxB0MA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Anuradha Paudwal",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/3_aXOzmvqweQgBaXbFLccZlhXq2-AMo_ZaCjCKnulj8kicdbf1fw-_3thbSD_3ujOY4K3lzz1A=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Sadhana Sargam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Yu93qTU1a2VyGZ5uQMR3dO46cNnhPxgP72O5oAppre-YrjPCsfiClNZEQv-Y0TZh1ibSg-rG=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Palak Muchhal",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/iQGSyp9TuKL-zmvDdEw030BOsH3kM0g_vKjbs_EMtBvGTxQ9IBHNxGhAPksqu_E0vOQ0j_JRmA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Neeti Mohan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/UeKSaQL3zQMF0pCromzDHpg0_emSz4KFqSYByKxKhK6p0rKNuhprzwb0MNWF4smuiArf6r2dhQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Jonita Gandhi",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/e-WlED_5ApeSSOnATNXmsrkfpyF2c0pAVfGHCYyCN_6zwtC-4T1oPbO5twWsVchyKNEb2Poa=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shilpa Rao",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_mGOu8_tOsJoSRMchjCbTn_o7oAoQuks7ubc2YUt30czRE=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Aditi Singh Sharma",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/yW8FWHBuNfNaF8hyv5Gea42zsOjsqb6W4pDr5UT6FRyankLJbzwv-dFlaKxAVeM7-bQNwv9iFQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Monali Thakur",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_mc-YUD0xKbqnsI_6iejuURD66IBX8S5YMRxaEoefTg0A=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Kanika Kapoor",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/bYSwtEV7ohq_DcH2RRbSi2Uv4247EPIliIJqVaUNBJ5cp_m6e0MmoZoP6k-2L7WLRZGLw7GS5Q=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Tulsi Kumar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Ea_u7o1gYEKehVYjz_DQYUi-Nrsmo6EIJKYt2HuNbnaUPCQsV-M68OoXEtAfN3bRBAH1fuMuew=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Dhvani Bhanushali",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/OjW3T5ouXzjKO39bqPuC2ErTJXiU8P4qaeltjSiy1iuUe-51ldVh6bM91KUpWgLOs_T_urKniw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Asees Kaur",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/YzQGOWRcNZCx8ZwSLsKE4QCCUpchjm0JJJLWhDzKqMSACIqLW-iZa-ICi1L0ZZDPf_gLr719OA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shirley Setia",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/vgCe_9a83erWYz3K7cuF0cyEYkx4WwAyddgfJeWNYPiQdXO42CAU0rkIRWZVSa1S8-Zu-O-LAA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Hardy Sandhu",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/vZeoJSo7RDQpPnGjTe0Lx1xuDN2zLCcOS5O8FdT9r1YZjkcAJ4FdzSqTe5yfVgHTkShMJH2NsA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Ammy Virk",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/xxdiZ92uX4-r1-rvVc2n9Mv8W2Wnw3U56T1T5ddmPZu7i-ERrzL13W7ys32_hFN6CgA00HPD1QM=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "B Praak",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/v3OLvtC4FbLMVN8q1NTWVMHC_PA1fB6kQ_G78J4zqh7wQfgeodjTTK85kxWmh-4HJuc5N58i9Q=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Jassie Gill",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/EYQAp8m5_TvoBdO8kyC7q2W3JXsquW_jKgvOjlLtczZjhMbVefpqP8BH2sRjlk8863tcxlBDBA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Sidhu Moose Wala",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kiQJ0Hhp0O-tdaY1dy81-gSNujjccUlWstnpFr686ZlMk=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Karan Aujla",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Da4zbrS4XLxzb3xVNT14aKr22aBg1blJCuCBppbYglO_uDmElYopgoDk7XV6UWNxthI96XOYrw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Garry Sandhu",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/on0agiZFCsfLzEAnZp0WeVju_ec_GaxD5LXlaRXYqmyvnpWw8Z9HhhJOzAiMLn1uF6oIvqtuZuw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Satinder Sartaaj",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/JaW60MdwEHgeN3wNHFf2hnRdlaKaoLqSTPpUB5PYAL-Aig5g7AzbdBz9Md6Acj52emLL-wIp=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Ravi",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/h9FNCmnSOlDxRP_15lbqtLSCnG3dFn5hhF77vuvwJsTtYkVJVrtk19eZInAt8kYRTY83cfCb=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Anirudh Ravichander",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Tyx1R_RCijQJcBOOJEDqubRkpH0CYKeb_8KfxY_KCrGVktmwkB9yXYgQmwXySThHppPycR75=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Devi Sri Prasad",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kA66CGEVLVE0h0YpG7iU87PR2QCQcKwFC6pnD_Xk7_pRo=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Thaman S",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/pPHY2meVlq17vPG5ILDC1pwidcrz0BSSOj0ym9iycnbNAlpwlxRoOhyrteoD5-61WcjTooQ6Nw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Harris Jayaraj",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/HdLl7UsS14OA5gnqFwTfHk5ClL4-a3g2eo2_Udr15jcFgOWLotM3w7_BFs3Fgk1Uh68wF74mIg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Yuvan Shankar Raja",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/fC6KgtkXCEgppU133FosX_nKr7VeiGpSKh0tb0OlF7dv3argY8ZE4K2Nn1T_zX839KZo0YKA4w=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "M.M. Keeravani",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Ilaiyaraaja",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/PimA4XNPAQMA7BQJAayg3CqvWGKPSCloQXjwOeS72il1VtOIoyCJNllZ0I0hwY6oa_tpawHu0kM=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Vidyasagar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/cx8eq-hGm3jgjNdOnbLzirSpnPmmrnCZmTcdX3ocMdzq2lm_acHwr7cfb5U8pW3gs4JbGCWjaQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "G.V. Prakash Kumar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/jEh-GLa0VeT7J8D3IhnDH9WqfdPNTp0OthFle0NNtpU6b2nVHUr3vS_trVXlBeYROz-36bAQYw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "D. Imman",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_k9Qm2co3VHDrS9m_726uz0GxDRu1uWvFpo_d9-ZLlfjh4=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Santhosh Narayanan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/YfMj32x0B85XqpZCgWu1KXSSXsy8t4Ajt3GUIJw5oLLU94for_wN4HMDQYNvO3U-Hou1TiML9w=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Ghibran",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/0iTsLseAxYeNA6Os3vPpNGXPMvetwZ1TDc7qU9a3EvnqEEkSFCIdGEqA0orlSpfjNRHkPgsg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Vijay Antony",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/6wPyqCJCgEwys5PBHVU2fmh5apg5v2z1PIDCljvF52bfFG0OEUei3_YONVs_ZAIqDwvLfH27=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Hesham Abdul Wahab",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_mjy1zj7IVDhdBMkrH-Q4YBuXnatZ6iLMXLIrLE9fDxOg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Gopi Sundar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/LYoBFbwEB15sLyGLOg3b_EsKwNdg1QqfqTWRRCH4DM7t5sDQyoLWjQmHfNAd0PoZpkCIaFvfXQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Deepak Dev",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/rjnhctZPw1mthbmIs6U5mgcmdNknZwM_vHYYb_7sD8W9AYBBqpzvUq-pCT1sh8PWUJjYE-4X1A=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Rahul Raj",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/fG4MeTMsIQuhb2oL7AvGegrvHEFdMaT_Uvq7CZziwon3eVyRydPku6mpSV5h-xEjXuR3iw-T5-k=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Ouseppachan",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Raveendran",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/eGbd_n2RaARPn3ufFD_2NHi36zNHCCG0rhlhfrY4na4yZRi577Ma3Z0TWPU0f9gVc7QHRRJqWQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Devarajan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Gjz-v9Q9ALZl3jfcoukdWHpXRJHOl24F7EiB-wZZS0OLw97gSSXWPXCnm2XVEp5hlwgdgNDO=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "V. Dakshinamoorthy",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/G1gfnLUVVmTlk0TixhOprwNTgW590kNHXLCuE_q0oFJKXSBC0viwokykAWOAoQv8a2Uh_XbNEa0=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Salil Chowdhury",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "R.D. Burman",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/1dNWJ9ukvCtjzznwdndtuJvglS5laVTBycFkhsS_r0dZ6Mew54iCfzir95aW8GJljLoGrFZAbg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "S.D. Burman",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/FIKqwHvyQe7HL8f1wYQXQp_4yyiTuJD8KmWybk9kRoeld7I58MmsC6Uefih-dBQM7WddVvlcffI=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "O.P. Nayyar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Nv_DfkXaYoEvKs0k7F4eu6AQI7aSPxzHOT5Urvl07pMxYkOcKgzsoWeFFoCszTyBZCufGtOyZw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Madan Mohan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/_39VTRajSa4_DMQUE0LpsJRcUrOKd7zQWwI2-gJmSfLtQkfW6sVGDBwWlZVQcBFKdGHJNg3zbw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Naushad",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/4fNLrf5Sl5GCY4BxVtYsFmd0Y6o_ssOFxNIprigQ-3GL3TTIHDKkIqmdbYIK9xn8CQG9-0OmNQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Khayyam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/qgRkOfrrhObjHZ4CitMgnEzNMnJCYmSE06qDk6zaefqo_0cH_efIku6KqpGtbxrqmm5jEcu1cw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Laxmikant-Pyarelal",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/qwlc9Yekzk-r4_0p5Im8hRlr0psGdoh2MPqBcblOMsWHF4gmpdpAkU5Jquq_PcU_2U8HgItayg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Kalyanji-Anandji",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Nadeem-Shravan",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_lq5hnVoWTPYuWYyCT7GCTYBO8FBly_2m2ZOsKylblZwg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Jatin-Lalit",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/zRIsM9wdf9RVawY2WXafCNQ1FGdkd_k4z7I7Tol186x046nYNTjVEGlg44nMDhUSSqspoUVvaQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Anu Malik",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Himesh Reshammiya",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/vnz782S2Yld9jy6mAg2kNvwjDCsOZADNgAsyVCHsu3usdW0uNqHNCAOxywwGM3Fvw9Pq7EsGM48=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Sajid-Wajid",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kOLef5VUbX-vMB8m5OIRDntPLmi328cHZIdjaDOblEeQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Meet Bros",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_koHsROua0GHlcexJaNnnWrQKUFRKsgcsOROPUNMfSgIw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Tanishk Bagchi",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Uzlf4JggdL9rdRgYPAfIYMZ5NxusOwPLGhgfOLbtHTDhtduuRfmacLg2AUpIcPStDCcsSwRE=s88-c-k-c0x00ffffff-no-rj-mo"
  }
];

const POPULAR_ALBUMS = [
  { id: "Umqb9KENgmk", videoId: "Umqb9KENgmk", title: "Tum Hi Ho", artist: "Mithoon, Arijit Singh", image: "https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg", query: "Tum Hi Ho Aashiqui 2 Official Video Arijit Singh" },
  { id: "jHNNMj5bNQw", videoId: "jHNNMj5bNQw", title: "Kabira", artist: "Pritam, Tochi Raina, Rekha Bhardwaj", image: "https://i.ytimg.com/vi/jHNNMj5bNQw/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/jHNNMj5bNQw/hqdefault.jpg", query: "Kabira Yeh Jawaani Hai Deewani Official Video" },
  { id: "BddP6PYo2gs", videoId: "BddP6PYo2gs", title: "Kesariya", artist: "Pritam, Arijit Singh", image: "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg", query: "Kesariya Brahmastra Official Video Arijit Singh" },
  { id: "VOLKJJvfAbg", videoId: "VOLKJJvfAbg", title: "Bekhayali", artist: "Sachet Tandon, Parampara", image: "https://i.ytimg.com/vi/VOLKJJvfAbg/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/VOLKJJvfAbg/hqdefault.jpg", query: "Bekhayali Kabir Singh Official Video Sachet Tandon" },
  { id: "ttIKsnxPrMY", videoId: "ttIKsnxPrMY", title: "Nadaan Parindey", artist: "A.R. Rahman, Mohit Chauhan", image: "https://i.ytimg.com/vi/ttIKsnxPrMY/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/ttIKsnxPrMY/hqdefault.jpg", query: "Nadaan Parindey Rockstar Official Video Mohit Chauhan" },
  { id: "iAIBF2ngbWY", videoId: "iAIBF2ngbWY", title: "Pehle Bhi Main", artist: "Pritam, Vishal Mishra", image: "https://i.ytimg.com/vi/iAIBF2ngbWY/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/iAIBF2ngbWY/hqdefault.jpg", query: "Pehle Bhi Main Animal Official Video Vishal Mishra" }
];

const POPULAR_RADIO = [
  { id: "284Ov7ysmfA", videoId: "284Ov7ysmfA", title: "Channa Mereya", artist: "Arijit Singh, Pritam", image: "https://i.ytimg.com/vi/284Ov7ysmfA/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/284Ov7ysmfA/hqdefault.jpg", query: "Channa Mereya Ae Dil Hai Mushkil Official Video Arijit Singh" },
  { id: "ZsAOnmByy38", videoId: "ZsAOnmByy38", title: "Zara Sa", artist: "KK, Pritam", image: "https://i.ytimg.com/vi/ZsAOnmByy38/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/ZsAOnmByy38/hqdefault.jpg", query: "Zara Sa Jannat Official Video KK Pritam" },
  { id: "inEu2qQuGZ8", videoId: "inEu2qQuGZ8", title: "Sunn Raha Hai Na Tu", artist: "Shreya Ghoshal, Ankit Tiwari", image: "https://i.ytimg.com/vi/inEu2qQuGZ8/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/inEu2qQuGZ8/hqdefault.jpg", query: "Sunn Raha Hai Na Tu Aashiqui 2 Shreya Ghoshal Official Video" },
  { id: "bKZTnnFU9HA", videoId: "bKZTnnFU9HA", title: "Kuch Kuch Hota Hai", artist: "Alka Yagnik, Udit Narayan", image: "https://i.ytimg.com/vi/bKZTnnFU9HA/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/bKZTnnFU9HA/hqdefault.jpg", query: "Kuch Kuch Hota Hai Title Track Alka Yagnik Udit Narayan Official" },
  { id: "mH_LFkWxpI0", videoId: "mH_LFkWxpI0", title: "Lover", artist: "Diljit Dosanjh", image: "https://i.ytimg.com/vi/mH_LFkWxpI0/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/mH_LFkWxpI0/hqdefault.jpg", query: "Lover Diljit Dosanjh Official Music Video" },
  { id: "T94PHkuydcw", videoId: "T94PHkuydcw", title: "Kun Faya Kun", artist: "A.R. Rahman, Javed Ali, Mohit Chauhan", image: "https://i.ytimg.com/vi/T94PHkuydcw/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/T94PHkuydcw/hqdefault.jpg", query: "Kun Faya Kun Rockstar Official Video AR Rahman" }
];

const ScrollableRow = React.memo(({ items, renderItem, title, subtitle, showAll: controlledShowAll, setShowAll: setControlledShowAll, fallbackItems = [] }) => {
  const scrollRef = React.useRef(null);
  const [internalShowAll, setInternalShowAll] = React.useState(false);

  const showAll = controlledShowAll !== undefined ? controlledShowAll : internalShowAll;
  const setShowAll = setControlledShowAll !== undefined ? setControlledShowAll : setInternalShowAll;

  const validItems = Array.isArray(items) && items.length > 0 ? items : [];
  const safeFallback = Array.isArray(fallbackItems) && fallbackItems.length > 0 ? fallbackItems : [];
  const rowItems = validItems.length > 0 ? validItems : safeFallback;

  const scroll = (direction) => {
    if (scrollRef.current) {
      if (direction === 'left') {
        scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
      } else {
        scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">
      <div className="flex items-end justify-between mb-2.5 sm:mb-4">
        <div className="min-w-0 pr-2">
          {title && <h2 className="text-base sm:text-lg md:text-2xl font-display font-extrabold text-white tracking-tight truncate">{title}</h2>}
          {subtitle && <p className="text-neutral-400 mt-0.5 md:mt-1 text-xs md:text-sm font-medium line-clamp-1">{subtitle}</p>}
        </div>
        <button 
          onClick={() => setShowAll(!showAll)}
          className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors shrink-0 flex items-center gap-0.5 cursor-pointer"
        >
          <span>{showAll ? 'Show Less' : 'View All'}</span>
          <span className="text-neutral-500 font-bold">&gt;</span>
        </button>
      </div>

      {showAll ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-4 md:gap-6 w-full min-w-0">
          {rowItems.map((item, i) => (
            <React.Fragment key={i}>
              {renderItem(item, i, true)}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="relative group/carousel w-full min-w-0">
          <button onClick={() => scroll('left')} className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -ml-4 w-8 h-8 md:w-10 md:h-10 bg-neutral-800/80 rounded-full items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10 hover:bg-neutral-700 shadow-xl border border-neutral-700">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div ref={scrollRef} className="flex gap-2.5 sm:gap-4 md:gap-6 overflow-x-auto pb-3 sm:pb-4 hide-scrollbar scroll-smooth w-full min-w-0">
            {rowItems.map((item, i) => (
              <div key={i} className="w-[104px] sm:w-36 md:w-48 shrink-0">
                {renderItem(item, i, false)}
              </div>
            ))}
          </div>
          <button onClick={() => scroll('right')} className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 -mr-4 w-8 h-8 md:w-10 md:h-10 bg-neutral-800/80 rounded-full items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10 hover:bg-neutral-700 shadow-xl border border-neutral-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
      )}
    </div>
  );
});
export default function App() {
  const initialNav = useMemo(() => {
    if (typeof window !== 'undefined') {
      return initNavigation(window.location.pathname, window.location.search);
    }
    return { currentRoute: { tab: 'home', path: '/' }, stack: [{ tab: 'home', path: '/' }] };
  }, []);

  const [activeTab, setActiveTab] = useState(() => initialNav.currentRoute.tab);
  const [navigationStack, setNavigationStack] = useState(() => initialNav.stack);
  const navigationStackRef = useRef(initialNav.stack);
  const navigationHistoryRef = navigationStackRef;
  useEffect(() => {
    navigationStackRef.current = navigationStack;
  }, [navigationStack]);
  const navigationHistory = navigationStack;

  const [offlineSubView, setOfflineSubView] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/downloads/explore' || path === '/downloads-explore') {
        return 'explore';
      }
    }
    return 'library';
  });

  const [selectedArtistId, setSelectedArtistId] = useState(() => {
    return initialNav.currentRoute?.params?.id || initialNav.currentRoute?.params?.slug || null;
  });

  const [cmsConfig, setCmsConfig] = useState(() => {
    const cached = getCachedCmsConfig();
    const resolved = resolvePlatformConfig(cached);
    applyThemeToDom(resolved.theme, false);
    return resolved;
  });

  const [isAppInitialized, setIsAppInitialized] = useState(false);
  const [showSplashScreen, setShowSplashScreen] = useState(true);

  // Auth State (Tab-isolated: reads sessionStorage first so Tab 1 never gets clobbered by Tab 2)
  const [user, setUser] = useState(() => getTabAuthUser());
  const [authToken, setAuthToken] = useState(() => getTabAuthToken());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isAuthSlow, setIsAuthSlow] = useState(false);

  const isAdmin = Boolean(user && (user.isAdmin === true || user.role === 'admin'));

  const [reviewsRefreshKey, setReviewsRefreshKey] = useState(0);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingModalMode, setRatingModalMode] = useState('rate'); // 'rate' | 'review'

  const handleOpenRatingModal = useCallback((mode = 'rate') => {
    setRatingModalMode(mode);
    setIsRatingModalOpen(true);
  }, []);

  // Synchronize voice control access on auth & rollout changes
  const { isVisible: isUiVisible } = useUiConfig();
  const { canAccessVoice } = useVoiceRollout(user, cmsConfig);
  const [isVoiceControlAllowed, setIsVoiceControlAllowed] = useState(() => {
    return voiceControlService.getAccessState().allowed;
  });

  // Dynamic role-based & CMS-driven voice access
  // Gated strictly by canAccessVoice (which evaluates master toggle, global rollout & admin access)
  const isVoiceActive = Boolean(canAccessVoice && (isAdmin || isVoiceControlAllowed));

  useEffect(() => {
    setIsVoiceControlAllowed(Boolean(canAccessVoice));
  }, [canAccessVoice]);

  useEffect(() => {
    const unsub = voiceControlService.subscribe((state) => {
      setIsVoiceControlAllowed(Boolean(state.allowed));
    });
    return unsub;
  }, []);

  useEffect(() => {
    voiceControlService.checkAccess({ token: authToken, user, backendUrl: BACKEND_URL });
  }, [authToken, user]);

  // Synchronize authenticated socket session & live presence with backend
  useEffect(() => {
    const sid = getOrCreateSessionId();
    if (authToken && user) {
      socket.auth = { sessionId: sid, token: authToken };
      socket.emit('authenticate', { token: authToken, sessionId: sid });
    } else {
      socket.auth = { sessionId: sid, token: '' };
      socket.emit('user_logout', { sessionId: sid });
    }
  }, [authToken, user]);

  const handleSplashFinished = useCallback(() => {
    setShowSplashScreen(false);
  }, []);

  // Unconditional safety ceiling: guarantee splash screen is removed within 2.8 seconds
  useEffect(() => {
    const splashSafetyTimer = setTimeout(() => {
      setShowSplashScreen(false);
    }, 2800);
    return () => clearTimeout(splashSafetyTimer);
  }, []);

  // Passively record feature visits in AI Learning Intelligence Engine
  useEffect(() => {
    if (authToken && activeTab && activeTab !== 'admin') {
      learningIntelligenceClient.recordEvent(BACKEND_URL, authToken, {
        category: 'website',
        eventType: activeTab === 'radio' ? 'radio_usage' : (activeTab === 'discover' ? 'discover_usage' : 'feature_visit'),
        metadata: { featureName: activeTab }
      });
    }
  }, [activeTab, authToken]);

  useEffect(() => {
    let isMounted = true;

    fetchPublicCmsConfig(BACKEND_URL)
      .then(cfg => {
        if (!isMounted) return;
        if (cfg) {
          const resolved = resolvePlatformConfig(cfg);
          setCmsConfig(resolved);
          if (typeof resolved.featureControls?.offlineDownloadsEnabled === 'boolean') {
            offlineStorageService.setDownloadsEnabled(resolved.featureControls.offlineDownloadsEnabled);
            offlineEligibilityService.setDownloadsEnabled(resolved.featureControls.offlineDownloadsEnabled);
          }
          applyThemeToDom(resolved.theme, true);
        }
      })
      .catch(err => {
        console.warn('[Startup] CMS config notice:', err?.message);
      })
      .finally(() => {
        if (isMounted) {
          setIsAppInitialized(true);
        }
      });

    // Fallback safety timer ensuring initialization completes smoothly
    const initTimer = setTimeout(() => {
      if (isMounted) {
        setIsAppInitialized(true);
      }
    }, 1000);

    const handleConfigUpdate = (data) => {
      if (data?.config) {
        const resolved = resolvePlatformConfig(data.config);
        setCmsConfig(resolved);
        if (typeof resolved.featureControls?.offlineDownloadsEnabled === 'boolean') {
          offlineStorageService.setDownloadsEnabled(resolved.featureControls.offlineDownloadsEnabled);
          offlineEligibilityService.setDownloadsEnabled(resolved.featureControls.offlineDownloadsEnabled);
        }
        try {
          localStorage.setItem('afterhours_cms_public_config', JSON.stringify(normalizeCmsConfig(data.config)));
        } catch (e) {}
        applyThemeToDom(resolved.theme, true);
      } else {
        fetchPublicCmsConfig(BACKEND_URL).then(cfg => {
          if (cfg && isMounted) {
            const resolved = resolvePlatformConfig(cfg);
            setCmsConfig(resolved);
            if (typeof resolved.featureControls?.offlineDownloadsEnabled === 'boolean') {
              offlineStorageService.setDownloadsEnabled(resolved.featureControls.offlineDownloadsEnabled);
              offlineEligibilityService.setDownloadsEnabled(resolved.featureControls.offlineDownloadsEnabled);
            }
            applyThemeToDom(resolved.theme, true);
          }
        });
      }
    };

    socket.on('cms_config_updated', handleConfigUpdate);

    // Fetch and sync published Android version manifest
    fetchPublishedAppVersion(BACKEND_URL)
      .then(pub => {
        if (isMounted && pub) {
          setPublishedVersionInfo(pub);
        }
      })
      .catch(() => {});

    // Automatic In-App Android APK Update Detection (Native Android app only)
    const runUpdateCheck = () => {
      if (!isMounted) return;
      if (!isRunningInAndroidApp()) return;
      checkForAppUpdate(BACKEND_URL)
        .then((updateResult) => {
          if (!isMounted) return;
          if (updateResult && updateResult.shouldPrompt && isRunningInAndroidApp()) {
            setPendingAppUpdate(updateResult);
          } else {
            setPendingAppUpdate(null);
          }
        })
        .catch((err) => {
          console.warn('[App] Update check notice:', err?.message);
        });
    };

    const updateCheckTimer = setTimeout(runUpdateCheck, 1200);

    // Periodic check every 15 minutes while native Android app remains open
    const periodicCheckInterval = setInterval(runUpdateCheck, 15 * 60 * 1000);

    // Listen for foreground resume from Android native container
    const handleAppForegroundResume = () => {
      runUpdateCheck();
    };

    window.addEventListener('loopra-app-resume', handleAppForegroundResume);
    window.addEventListener('focus', handleAppForegroundResume);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) handleAppForegroundResume();
    });

    // Listen for native Android container update signals
    const handleNativeUpdateAvailable = (event) => {
      if (!isMounted || !event?.detail) return;
      if (!isRunningInAndroidApp()) return;
      const detail = event.detail;

      // Authoritative integer versionCode check: only prompt if published versionCode > installed versionCode
      const pCode = detail.versionCode ? parseInt(detail.versionCode, 10) : 0;
      const iCode = detail.installedVersionCode ? parseInt(detail.installedVersionCode, 10) : 0;
      if (pCode > 0 && iCode > 0 && pCode <= iCode) {
        return; // Already up to date
      }

      // Check 3-hour snooze cooldown: skip silently if user tapped "Not Now" on this or newer version
      if (isUpdateSnoozed(pCode)) {
        return;
      }

      setPendingAppUpdate({
        shouldPrompt: true,
        installedVersion: detail.installedVersion || '1',
        installedVersionCode: iCode,
        latestVersion: detail.latestVersion || '2.2',
        latestVersionCode: pCode,
        downloadUrl: detail.downloadUrl,
        manifest: detail,
        isNative: true
      });
    };
    window.addEventListener('loopra-native-update-available', handleNativeUpdateAvailable);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      clearTimeout(updateCheckTimer);
      clearInterval(periodicCheckInterval);
      window.removeEventListener('loopra-app-resume', handleAppForegroundResume);
      window.removeEventListener('focus', handleAppForegroundResume);
      socket.off('cms_config_updated', handleConfigUpdate);
      window.removeEventListener('loopra-native-update-available', handleNativeUpdateAvailable);
    };
  }, []);

  const stationsMap = React.useMemo(() => {
    const base = { ...SPECIAL_STATIONS };
    if (Array.isArray(cmsConfig?.stations)) {
      cmsConfig.stations.forEach(s => {
        if (!s || !s.id) return;
        const existing = base[s.id] || {};
        const artwork = s.artwork || s.artworkUrl || (s.bgImages?.length ? s.bgImages[0] : null);
        base[s.id] = {
          ...existing,
          id: s.id,
          title: s.title || s.name || existing.title || s.id,
          subtitle: s.subtitle || s.description || existing.subtitle || '',
          badge: s.badge || existing.badge || 'LIVE RADIO',
          icon: s.icon || existing.icon || 'radio',
          accentColor: s.accentColor || existing.accentColor || '#f59e0b',
          category: s.category || existing.category || 'Nostalgia',
          language: s.language || existing.language || 'Hindi',
          queries: Array.isArray(s.queries) && s.queries.length > 0 ? s.queries : (existing.queries || [s.name || s.title || s.id]),
          tracks: Array.isArray(s.tracks) ? s.tracks : (existing.tracks || []),
          bgImages: artwork ? [artwork] : (existing.bgImages || [
            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80'
          ]),
          isActive: s.isActive !== false && s.enabled !== false
        };
      });
    }
    return base;
  }, [cmsConfig?.stations]);

  useEffect(() => {
    // Keep browser tab title strictly with Loopra branding across all sections, navigation, and refreshes
    document.title = 'Loopra';
    // Dynamic SEO Metadata, Canonicalization & Schema.org Breadcrumb synchronization
    const currentStn = stationsMap ? (stationsMap[activeTab] || SPECIAL_STATIONS[activeTab]) : SPECIAL_STATIONS[activeTab];
    updateRouteMetadata(activeTab, currentStn);

    const rawFavicon = cmsConfig?.branding?.faviconUrl || '/loopra-logo.png';
    const faviconUrl = rawFavicon.includes('?') ? rawFavicon : `${rawFavicon}?v=3`;
    const iconLinks = document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon']");
    if (iconLinks && iconLinks.length > 0) {
      iconLinks.forEach(link => {
        link.href = faviconUrl;
        if (link.getAttribute('type') === 'image/svg+xml') {
          link.setAttribute('type', 'image/png');
        }
      });
    } else {
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.type = 'image/png';
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = faviconUrl;
    }

    if (cmsConfig?.theme) {
      applyThemeToDom(cmsConfig.theme);
    }
  }, [cmsConfig?.branding, cmsConfig?.theme, activeTab, stationsMap]);

  // Synchronize Theme & Appearance changes across browser tabs and system preference changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'loopra_selected_theme_id' || e.key === 'loopra_appearance_mode' || e.key === 'afterhours_applied_theme') {
        applyThemeToDom(cmsConfig?.theme || {});
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [cmsConfig?.theme]);

  const [contextMenu, setContextMenu] = useState(null); // { x, y, track }

  useEffect(() => {
    const handleClickOutsideMenu = () => {
      setOpenMenuId(null);
      setContextMenu(null);
    };
    window.addEventListener('click', handleClickOutsideMenu);
    window.addEventListener('scroll', handleClickOutsideMenu, true);
    return () => {
      window.removeEventListener('click', handleClickOutsideMenu);
      window.removeEventListener('scroll', handleClickOutsideMenu, true);
    };
  }, []);

  const [openMenuId, setOpenMenuId] = useState(null);

  const handleTrackContextMenu = useCallback((e, track) => {
    if (!track) return;
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 260);
    setContextMenu({ x, y, track });
    setOpenMenuId(null);
  }, []);

  const validateAndSanitizeItems = (raw, fallback) => {
    try {
      if (!raw) return fallback;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed) || parsed.length < 3) return fallback;
      const cleaned = parsed.map(item => {
        const rawId = typeof item?.id === 'string' ? item.id : (item?.id?.videoId || item?.videoId);
        if (!rawId || typeof rawId !== 'string' || rawId.length < 5) return null;
        return {
          ...item,
          id: rawId,
          videoId: rawId,
          title: item.title || 'Unknown Title',
          artist: item.artist || 'Unknown Artist',
          thumbnail: item.thumbnail || item.image || `https://i.ytimg.com/vi/${rawId}/hqdefault.jpg`,
          image: item.image || item.thumbnail || `https://i.ytimg.com/vi/${rawId}/hqdefault.jpg`
        };
      }).filter(Boolean);
      // Strictly enforce centralized single-song and content-filter validation
      const singleSongCleaned = filterSingleSongs(cleaned).filter(t => isCleanMusicTrack(t));
      // Deduplicate using TrackDeduplicator to ensure zero duplicate cards from local storage
      const dedup = new TrackDeduplicator();
      const uniqueCleaned = [];
      for (const t of singleSongCleaned) {
        if (!dedup.isDuplicate(t)) {
          dedup.add(t);
          uniqueCleaned.push(t);
        }
      }
      return uniqueCleaned.length >= 3 ? uniqueCleaned : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [trendingSongs, setTrendingSongs] = useState(() => {
    return validateAndSanitizeItems(localStorage.getItem('afterhours_trending'), TRENDING_SONGS);
  });
  const [popularAlbums, setPopularAlbums] = useState(() => {
    return validateAndSanitizeItems(localStorage.getItem('afterhours_albums'), POPULAR_ALBUMS);
  });
  const [popularRadio, setPopularRadio] = useState(() => {
    return validateAndSanitizeItems(localStorage.getItem('afterhours_radio'), POPULAR_RADIO);
  });
  // Track rendered personalized recommendation track keys to coordinate zero duplicates across homepage
  const [renderedRecTrackKeys, setRenderedRecTrackKeys] = useState(() => new Set());

  const handlePersonalizedTracksRendered = useCallback((tracks) => {
    if (!Array.isArray(tracks)) return;
    const dedup = new TrackDeduplicator(tracks);
    setRenderedRecTrackKeys(new Set(dedup.getAllKeys()));
  }, []);

  // Fisher-Yates array shuffle helper
  const shuffleArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // Filter trending songs dynamically so no song rendered above in recommendations ever repeats below,
  // expand the candidate pool and shuffle on every load/refresh so positions change dynamically
  const uniqueTrendingSongs = React.useMemo(() => {
    const raw = (trendingSongs && trendingSongs.length > 0) ? trendingSongs : TRENDING_SONGS;
    const validated = filterSingleSongs(raw).filter(t => isCleanMusicTrack(t));
    const cleanFallbacks = filterSingleSongs(TRENDING_SONGS).filter(t => isCleanMusicTrack(t));
    const candidateList = validated.length > 0 ? validated : cleanFallbacks;
    const dedup = new TrackDeduplicator();
    const filtered = candidateList.filter(t => {
      if (!isCleanMusicTrack(t)) return false;
      const cleanThumb = getCleanThumbnail(t);
      if (!cleanThumb || !isThumbnailUrlFormatValid(cleanThumb)) return false;
      const key = getCanonicalSongKey(t);
      if (renderedRecTrackKeys.has(key)) return false;
      if (dedup.isDuplicate(t)) return false;
      dedup.add(t);
      return true;
    });
    return shuffleArray(filtered);
  }, [trendingSongs, renderedRecTrackKeys]);

  const uniquePopularAlbums = React.useMemo(() => {
    const raw = (popularAlbums && popularAlbums.length > 0) ? popularAlbums : POPULAR_ALBUMS;
    const validated = filterSingleSongs(raw).filter(t => isCleanMusicTrack(t));
    const cleanFallbacks = filterSingleSongs(POPULAR_ALBUMS).filter(t => isCleanMusicTrack(t));
    const candidateList = validated.length > 0 ? validated : cleanFallbacks;
    const dedup = new TrackDeduplicator();
    const filtered = candidateList.filter(t => {
      if (!isCleanMusicTrack(t)) return false;
      const cleanThumb = getCleanThumbnail(t);
      if (!cleanThumb || !isThumbnailUrlFormatValid(cleanThumb)) return false;
      const key = getCanonicalSongKey(t);
      if (renderedRecTrackKeys.has(key)) return false;
      if (dedup.isDuplicate(t)) return false;
      dedup.add(t);
      return true;
    });
    return shuffleArray(filtered);
  }, [popularAlbums, renderedRecTrackKeys]);

  const uniquePopularRadio = React.useMemo(() => {
    const raw = (popularRadio && popularRadio.length > 0) ? popularRadio : POPULAR_RADIO;
    const validated = filterSingleSongs(raw).filter(t => isCleanMusicTrack(t));
    const cleanFallbacks = filterSingleSongs(POPULAR_RADIO).filter(t => isCleanMusicTrack(t));
    const candidateList = validated.length > 0 ? validated : cleanFallbacks;
    const dedup = new TrackDeduplicator();
    return candidateList.filter(t => {
      if (!isCleanMusicTrack(t)) return false;
      const cleanThumb = getCleanThumbnail(t);
      if (!cleanThumb || !isThumbnailUrlFormatValid(cleanThumb)) return false;
      const key = getCanonicalSongKey(t);
      if (renderedRecTrackKeys.has(key)) return false;
      if (dedup.isDuplicate(t)) return false;
      dedup.add(t);
      return true;
    });
  }, [popularRadio, renderedRecTrackKeys]);

  useEffect(() => {
    const fetchDynamicSection = async (query, setState, storageKey, options = {}) => {
      try {
        const targetLimit = options.targetLimit || 12;
        let collected = [];
        let pageToken = null;
        let attempts = 0;
        const maxAttempts = options.maxAttempts || 6;
        const dedup = new TrackDeduplicator();

        // Extra query variants if initial batch runs low on clean candidates
        const fallbackQueries = options.fallbackQueries || [];
        let queryIndex = 0;
        let currentQuery = query;

        while (collected.length < targetLimit && attempts < maxAttempts) {
          attempts++;
          const res = await fetchFromBackend(currentQuery, {
            limit: 25,
            pageToken: pageToken || undefined
          });

          if (res?.items && Array.isArray(res.items) && res.items.length > 0) {
            const mapped = res.items.map(i => {
              const vid = (typeof i.id === 'string' ? i.id : i.id?.videoId) || (typeof i.videoId === 'string' ? i.videoId : null);
              const img = getCleanThumbnail(i, vid);
              return {
                id: vid,
                videoId: vid,
                title: i.snippet?.title || 'Unknown Title',
                artist: i.snippet?.channelTitle || 'Unknown Artist',
                channel: i.snippet?.channelTitle || 'Unknown Artist',
                image: img,
                thumbnail: img,
                duration: i.duration || i.snippet?.duration,
                query: (i.snippet?.title || '') + " " + (i.snippet?.channelTitle || '')
              };
            }).filter(item => item.id && typeof item.id === 'string' && item.id.length >= 5 && item.title && isThumbnailUrlFormatValid(item.thumbnail));

            // Strictly filter for individual single songs and clean music tracks only
            const singleSongs = filterSingleSongs(mapped).filter(t => isCleanMusicTrack(t));
            for (const s of singleSongs) {
              if (!isCleanMusicTrack(s)) continue;
              if (!dedup.isDuplicate(s)) {
                dedup.add(s);
                collected.push(s);
              }
              if (collected.length >= targetLimit) break;
            }

            pageToken = res.nextPageToken || null;
            if (!pageToken && collected.length < targetLimit && queryIndex < fallbackQueries.length) {
              currentQuery = fallbackQueries[queryIndex++];
              pageToken = null;
            }
          } else if (queryIndex < fallbackQueries.length) {
            currentQuery = fallbackQueries[queryIndex++];
            pageToken = null;
          } else {
            break;
          }
        }

        // Only replace state if we have a rich, valid list of at least 3 tracks
        if (collected.length >= 3) {
          const finalTracks = collected.slice(0, targetLimit);
          setState(finalTracks);
          try { localStorage.setItem(storageKey, JSON.stringify(finalTracks)); } catch (e) {}
        }
      } catch (e) {
        // Fallback: If network timed out or failed, populate from cached localStorage
        try {
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            const validCached = filterSingleSongs(parsed).filter(t => isCleanMusicTrack(t));
            if (Array.isArray(validCached) && validCached.length >= 3) {
              setState(validCached);
              return;
            }
          }
        } catch (_) {}
        if (e?.name !== 'AbortError') {
          console.warn(`[Dynamic Content] Notice fetching ${storageKey}:`, e.message);
        }
      }
    };

    // Stagger section fetches to eliminate concurrent YouTube scraping / 429 rate limit
    // Hardened with negative search keywords avoiding Shorts, ringtones, status, dance, karaoke, and edits
    fetchDynamicSection(
      "latest trending hindi hit songs official music video -shorts -#shorts -ringtone -karaoke -dance -status -edit",
      setTrendingSongs,
      'afterhours_trending',
      {
        fallbackQueries: [
          "top bollywood songs official video -shorts -#shorts -ringtone -karaoke -dance -status -edit",
          "arijit singh shreya ghoshal official video -shorts -#shorts -ringtone -karaoke -dance -status -edit"
        ]
      }
    );

    const albumsTimer = setTimeout(() => {
      fetchDynamicSection(
        "latest hit bollywood single songs official video -shorts -#shorts -ringtone -karaoke -dance -status -edit",
        setPopularAlbums,
        'afterhours_albums',
        {
          fallbackQueries: [
            "popular bollywood movie soundtrack official songs -shorts -#shorts -ringtone -karaoke -dance -status -edit",
            "pritam vishal mishra official songs -shorts -#shorts -ringtone -karaoke -dance -status -edit"
          ]
        }
      );
    }, 1200);

    const radioTimer = setTimeout(() => {
      fetchDynamicSection(
        "bollywood acoustic unplugged official single songs -shorts -#shorts -ringtone -karaoke -dance -status -edit",
        setPopularRadio,
        'afterhours_radio',
        {
          fallbackQueries: [
            "hindi lofi acoustic official single audio -shorts -#shorts -ringtone -karaoke -dance -status -edit",
            "arijit singh live acoustic official video -shorts -#shorts -ringtone -karaoke -dance -status -edit"
          ]
        }
      );
    }, 2400);

    return () => {
      clearTimeout(albumsTimer);
      clearTimeout(radioTimer);
    };
  }, []);

const sanitizeCache = (cache) => {
  try {
    if (!cache) return {};
    const newCache = { ...cache };
    Object.keys(newCache).forEach(k => {
      newCache[k] = newCache[k].map(track => {
        const vid = track.videoId || track.id;
        track.thumbnail = getCleanThumbnail(track, vid);
        if (track.image) track.image = track.thumbnail;
        return track;
      });
    });
    return newCache;
  } catch(e) { return {}; }
};
const sanitizeList = (list) => {
  try {
    if (!Array.isArray(list)) return [];
    return list.map(track => {
      const vid = track.videoId || track.id;
      track.thumbnail = getCleanThumbnail(track, vid);
      if (track.image) track.image = track.thumbnail;
      return track;
    });
  } catch(e) { return []; }
};

const isValidMongoId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);


  const [likedSongs, setLikedSongs] = useState(() => {
    const u = getTabAuthUser();
    return sanitizeList(u ? JSON.parse(localStorage.getItem('liked_songs') || '[]') : []);
  });
  const [history, setHistory] = useState(() => {
    const u = getTabAuthUser();
    return sanitizeList(u ? JSON.parse(localStorage.getItem('history_songs') || '[]') : []);
  });
  const [playlists, setPlaylists] = useState(() => {
    try {
      const u = getTabAuthUser();
      const saved = u ? localStorage.getItem('playlists') : (localStorage.getItem('guest_playlists') || localStorage.getItem('playlists'));
      return sanitizeList(saved ? JSON.parse(saved) : []);
    } catch (e) {
      return [];
    }
  });
  const [selectedPlaylistForView, setSelectedPlaylistForView] = useState(null);
  const selectedPlaylistForViewRef = useRef(null);
  useEffect(() => {
    selectedPlaylistForViewRef.current = selectedPlaylistForView;
  }, [selectedPlaylistForView]);
  const [isSharedPlaylistLoading, setIsSharedPlaylistLoading] = useState(false);
  const [sharedPlaylistError, setSharedPlaylistError] = useState(null);

  // Deep-link shared playlist loader (?playlist=<id>)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sharedPlaylistId = params.get('playlist');
    if (!sharedPlaylistId) return;

    let isSubscribed = true;

    const loadSharedPlaylist = async () => {
      // 1. First check if it already exists in the user's local playlists
      const localMatch = playlists.find(p => String(p.id) === String(sharedPlaylistId) || String(p.name) === String(sharedPlaylistId));
      if (localMatch) {
        setSelectedPlaylistForView(localMatch);
        setActiveTab('playlists');
        return;
      }

      // 2. Fetch from public backend endpoint
      setIsSharedPlaylistLoading(true);
      setSharedPlaylistError(null);
      try {
        const res = await fetch(getApiUrl(`/api/user/shared-playlist/${encodeURIComponent(sharedPlaylistId)}`));
        if (!isSubscribed) return;

        if (res.ok) {
          const data = await res.json();
          if (data && data.playlist) {
            const fetchedPl = {
              id: data.playlist.id,
              name: data.playlist.name,
              songs: sanitizeList(data.playlist.songs || []),
              creator: data.playlist.creator || null,
              isShared: true
            };
            setSelectedPlaylistForView(fetchedPl);
            setActiveTab('playlists');
          } else {
            setSharedPlaylistError('Playlist data is unavailable or empty.');
          }
        } else {
          setSharedPlaylistError('Unable to find this shared playlist. It may have been removed or renamed.');
        }
      } catch (err) {
        if (!isSubscribed) return;
        console.warn('[Shared Playlist Fetch Error]:', err.message);
        setSharedPlaylistError('Failed to load shared playlist due to network connection.');
      } finally {
        if (isSubscribed) {
          setIsSharedPlaylistLoading(false);
        }
      }
    };

    loadSharedPlaylist();

    return () => {
      isSubscribed = false;
    };
  }, []); // Run on mount / page load
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [showLocationConsentBanner, setShowLocationConsentBanner] = useState(false);
  const [showLocationDeniedModal, setShowLocationDeniedModal] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(() => locationAnalyticsService.getSavedRegion());
  const [selectedModalRoomIds, setSelectedModalRoomIds] = useState([]);
  const [selectedModalPlaylistIds, setSelectedModalPlaylistIds] = useState([]);
  const [isSavingPlaylistTargets, setIsSavingPlaylistTargets] = useState(false);
  const [modalRooms, setModalRooms] = useState([]);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const [createModalPlaylistName, setCreateModalPlaylistName] = useState('');
  const [playlistMenuOpenId, setPlaylistMenuOpenId] = useState(null);
  const [renameModalPlaylist, setRenameModalPlaylist] = useState(null);
  const [renameModalName, setRenameModalName] = useState('');
  const [deleteModalPlaylist, setDeleteModalPlaylist] = useState(null);

  const [searchCache, setSearchCache] = useState(() => sanitizeCache(JSON.parse(localStorage.getItem('youtube_search_cache') || '{}')));
  const searchCacheMapRef = useRef(new Map());
  const [stationCache, setStationCache] = useState(() => sanitizeCache(JSON.parse(localStorage.getItem('youtube_station_cache') || '{}')));

  const [currentSong, setCurrentSong] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('afterhours_current_song')) || null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (currentSong) {
        localStorage.setItem('afterhours_current_song', JSON.stringify(currentSong));
      } else {
        localStorage.removeItem('afterhours_current_song');
      }
    } catch (e) {}
  }, [currentSong]);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const userIntentPlayingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const playerRef = useRef(null);
  const isPlayerReadyRef = useRef(false);
  const wasPlayingBeforeAuthRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const trackPlaybackStartTimeRef = useRef(null);
  const currentSongRef = useRef(currentSong);
  const hasLoggedCompletionRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  const [isShuffle, setIsShuffle] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('afterhours_shuffle') || 'false');
    } catch (e) {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('afterhours_shuffle', JSON.stringify(isShuffle));
    } catch (e) {}
  }, [isShuffle]);

  const [isRepeat, setIsRepeat] = useState(() => {
    try {
      const saved = localStorage.getItem('afterhours_repeat');
      if (saved === 'one' || saved === 'all') return saved;
      return JSON.parse(saved || 'false');
    } catch (e) {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('afterhours_repeat', typeof isRepeat === 'string' ? isRepeat : JSON.stringify(isRepeat));
    } catch (e) {}
  }, [isRepeat]);

  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg, duration = 3200) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, duration);
  }, []);

  const isRegionalLocationEnabled = isUiVisible('section.regionalMusic') !== false;

  const handleDetectLocation = useCallback(async () => {
    if (!isRegionalLocationEnabled) return;
    const sessionId = localStorage.getItem('afterhours_session_id') || null;
    const result = await locationAnalyticsService.requestAndSaveLocation({ token: authToken, sessionId });
    if (result.success) {
      if (result.region) setSelectedRegion(result.region);
      showToast(`Regional Music set to ${result.region || 'India (Hindi)'}`);
    } else if (result.reason === 'denied') {
      setShowLocationDeniedModal(true);
    } else if (result.reason === 'timeout') {
      showToast('Location request timed out. You can pick a region manually.');
      setShowLocationDeniedModal(true);
    } else {
      showToast('Location unavailable. You can pick a region manually.');
    }
  }, [authToken, showToast]);

  useEffect(() => {
    if (!isRegionalLocationEnabled) {
      setShowLocationConsentBanner(false);
      setShowLocationDeniedModal(false);
      return;
    }
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    if (locationAnalyticsService.getConsentStatus() !== null) return;
    const t = setTimeout(async () => {
      const perm = await locationAnalyticsService.getPermissionState();
      if (perm === 'granted') {
        handleDetectLocation();
      } else if (perm === 'prompt') {
        setShowLocationConsentBanner(true);
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [handleDetectLocation, isRegionalLocationEnabled]);

  // Continuous Listening (Autoplay Smart Queue when manual queue is exhausted)
  const [isContinuousListening, setIsContinuousListening] = useState(() => {
    try {
      return localStorage.getItem('loopra_continuous_listening') !== 'false';
    } catch (e) {
      return true;
    }
  });
  const isContinuousListeningRef = useRef(isContinuousListening);
  useEffect(() => {
    isContinuousListeningRef.current = isContinuousListening;
  }, [isContinuousListening]);

  const toggleContinuousListening = useCallback(() => {
    setIsContinuousListening(prev => {
      const next = !prev;
      isContinuousListeningRef.current = next;
      try {
        localStorage.setItem('loopra_continuous_listening', next ? 'true' : 'false');
      } catch (err) {
        console.warn('[Loopra] Unable to persist continuous listening setting:', err);
      }
      showToast(next ? 'Continuous Autoplay enabled' : 'Continuous Autoplay disabled');
      return next;
    });
  }, [showToast]);

  // Playback History stack (ordered in exact sequence of played songs for precise Prev navigation)
  const playbackHistoryStackRef = useRef([]);
  // Error skip consecutive failure guard
  const consecutiveErrorSkipCountRef = useRef(0);

  const [volume, setVolume] = useState(() => {
    try {
      const v = localStorage.getItem('afterhours_volume');
      return v !== null ? parseInt(v, 10) : 80;
    } catch (e) {
      return 80;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('afterhours_volume', volume.toString());
    } catch (e) {}
  }, [volume]);

  // Expose global player controls including setVolume for audio ducking
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.loopraPlayer = {
        ...(window.loopraPlayer || {}),
        setVolume: (vol) => {
          setVolume(vol);
          try { playerRef.current?.setVolume?.(vol); } catch (_) {}
        },
        getVolume: () => volume,
        isPlaying: () => isPlaying
      };
    }
    return () => {
      if (typeof window !== 'undefined' && window.loopraPlayer) {
        delete window.loopraPlayer.setVolume;
        delete window.loopraPlayer.getVolume;
        delete window.loopraPlayer.isPlaying;
      }
    };
  }, [volume, isPlaying]);
  const [soundProfile, setSoundProfile] = useState('flat');

  const [partyTracks, setPartyTracks] = useState([]);
  const [heartbreakTracks, setHeartbreakTracks] = useState([]);
  
  const [stationLoading, setStationLoading] = useState(false);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = (window.location.pathname || '').toLowerCase();
      const search = window.location.search || '';
      // Left sidebar closed by default on room view or direct room link
      if (path.startsWith('/rooms') || search.includes('room=') || search.includes('roomCode=')) {
        return false;
      }
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);

  const [videoModalSong, setVideoModalSong] = useState(null);
  const videoModalSongRef = useRef(null);
  const [isPipActive, setIsPipActive] = useState(false);
  const isPipActiveRef = useRef(false);

  // Auto Picture-in-Picture on app minimize / backgrounding (configurable by user)
  const [isAutoPipEnabled, setIsAutoPipEnabled] = useState(() => {
    try {
      return localStorage.getItem('loopra_auto_pip_enabled') !== 'false';
    } catch (_) {
      return true;
    }
  });

  useEffect(() => {
    videoModalSongRef.current = videoModalSong;
    try {
      window.LoopraAndroid?.setVideoMode?.(Boolean(videoModalSong));
    } catch (_) {}
  }, [videoModalSong]);

  // Keep videoModalSong in sync with currentSong whenever playing in Video Mode
  useEffect(() => {
    if (videoModalSongRef.current && currentSong && (currentSong.id || currentSong.videoId)) {
      const activeVidId = currentSong.id || currentSong.videoId;
      const modalVidId = videoModalSongRef.current.id || videoModalSongRef.current.videoId;
      if (activeVidId !== modalVidId) {
        setVideoModalSong({ ...currentSong, id: activeVidId, videoId: activeVidId });
      }
    }
  }, [currentSong]);

  useEffect(() => {
    isPipActiveRef.current = isPipActive;
  }, [isPipActive]);

  // Android Picture-in-Picture event and tiny viewport listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePipChange = (e) => {
      setIsPipActive(Boolean(e.detail));
    };

    const checkViewportPip = () => {
      if (videoModalSongRef.current) {
        if (window.innerHeight < 360 || window.innerWidth < 360) {
          setIsPipActive(true);
        } else {
          setIsPipActive(false);
        }
      }
    };

    window.addEventListener('loopra-pip-change', handlePipChange);
    window.addEventListener('resize', checkViewportPip);

    // Initial check
    checkViewportPip();

    return () => {
      window.removeEventListener('loopra-pip-change', handlePipChange);
      window.removeEventListener('resize', checkViewportPip);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('q');
      if (q) return q.trim();
    }
    return '';
  });
  const [songs, setSongs] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchVisibleCount, setSearchVisibleCount] = useState(10);
  const [searchNextPageToken, setSearchNextPageToken] = useState(null);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);
  const [isLoadingMoreSearch, setIsLoadingMoreSearch] = useState(false);
  const [searchLoadMoreError, setSearchLoadMoreError] = useState('');
  const activeSearchQueryRef = useRef('');
  const searchRequestIdRef = useRef(0);
  const activeSearchAbortControllerRef = useRef(null);
  const inFlightSearchMapRef = useRef(new Map());
  const fetchYouTubeMusicRef = useRef(null);
  const [stationVisibleCounts, setStationVisibleCounts] = useState({ barber: 50, truck: 50, pauwa: 50 });
  const stationVisibleCount = stationVisibleCounts[activeTab] || 50;
  const [isLoadingMoreStation, setIsLoadingMoreStation] = useState(false);
  const stationPageRef = useRef({ barber: 1, truck: 1, pauwa: 1 });

  const handleLoadMoreStationSongs = useCallback(async () => {
    const currentCount = stationVisibleCounts[activeTab] || 50;
    const targetCount = currentCount + 10;

    // Immediately increment visible count so tracks already in songs appear instantly
    setStationVisibleCounts(prev => ({ ...prev, [activeTab]: targetCount }));

    // If approaching or exceeding currently loaded songs, fetch more or generate curated extension
    if (targetCount >= songs.length) {
      setIsLoadingMoreStation(true);
      const station = stationsMap[activeTab] || SPECIAL_STATIONS[activeTab];
      const page = (stationPageRef.current[activeTab] || 1) + 1;
      stationPageRef.current[activeTab] = page;

      try {
        const queryMap = {
          barber: [
            "best 90s bollywood superhit romantic songs alka yagnik udit narayan",
            "kumar sanu alka yagnik romantic evergreen songs 90s",
            "sonu nigam 2000s nostalgic bollywood hits",
            "90s bollywood classic melody songs"
          ],
          truck: [
            "punjabi highway dhabha truck high bass songs",
            "altaf raja superhit songs hindi",
            "diljit dosanjh sidhu moose wala punjabi hits",
            "daler mehndi sukhbir superhit dance songs"
          ],
          pauwa: [
            "desi party drinking songs yo yo honey singh badshah",
            "late night party banger songs desi hip hop",
            "ap dhillon karan aujla party hits",
            "punjabi peg daru party anthems"
          ]
        };

        const queryList = queryMap[activeTab] || station?.queries || ["bollywood hits"];
        const selectedQuery = queryList[(page - 2) % queryList.length];

        const data = await fetchFromBackend(selectedQuery);
        if (data?.items?.length > 0) {
          const newTracks = data.items.map(item => ({
            id: item.id.videoId || item.id,
            youtubeId: item.id.videoId || item.id,
            title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
            channel: item.snippet.channelTitle,
            artist: item.snippet.channelTitle,
            duration: "4:00",
            url: `https://www.youtube.com/watch?v=${item.id.videoId || item.id}`,
            coverArt: getCleanThumbnail(item, item.id.videoId || item.id),
            thumbnail: getCleanThumbnail(item, item.id.videoId || item.id),
          }));

          setSongs(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const filtered = newTracks.filter(t => !existingIds.has(t.id));
            const merged = [...prev, ...filtered];
            setStationCache(c => ({
              ...c,
              [activeTab]: { tracks: merged }
            }));
            return merged;
          });
        } else {
          // Curated station pool fallback
          const curatedKey = activeTab === 'barber' ? 'saloon' : (activeTab === 'truck' ? 'horn' : (activeTab === 'pauwa' ? 'theka' : null));
          const baseList = (curatedKey && CURATED_STATION_TRACKS[curatedKey]) || [];
          if (baseList.length > 0) {
            const startIdx = ((page - 2) * 10) % baseList.length;
            const extraBatch = baseList.slice(startIdx, startIdx + 10).map((t, idx) => ({
              ...t,
              id: `${t.id}_ext_${page}_${idx}`,
              title: `${t.title} (Live Set)`
            }));
            setSongs(prev => {
              const merged = [...prev, ...extraBatch];
              setStationCache(c => ({
                ...c,
                [activeTab]: { tracks: merged }
              }));
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn("Could not fetch extra tracks on load more, using curated fallback:", err.message);
        const curatedKey = activeTab === 'barber' ? 'saloon' : (activeTab === 'truck' ? 'horn' : (activeTab === 'pauwa' ? 'theka' : null));
        const baseList = (curatedKey && CURATED_STATION_TRACKS[curatedKey]) || [];
        if (baseList.length > 0) {
          const startIdx = ((page - 2) * 10) % baseList.length;
          const extraBatch = baseList.slice(startIdx, startIdx + 10).map((t, idx) => ({
            ...t,
            id: `${t.id}_ext_${page}_${idx}`,
            title: `${t.title} (Radio Mix)`
          }));
          setSongs(prev => {
            const merged = [...prev, ...extraBatch];
            setStationCache(c => ({
              ...c,
              [activeTab]: { tracks: merged }
            }));
            return merged;
          });
        }
      } finally {
        setIsLoadingMoreStation(false);
      }
    }
  }, [activeTab, songs, stationVisibleCounts]);
  const [queue, setQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('afterhours_queue')) || [];
    } catch (e) {
      return [];
    }
  });
  const queueRef = useRef(queue);

  useEffect(() => {
    queueRef.current = queue;
    try {
      localStorage.setItem('afterhours_queue', JSON.stringify(queue));
    } catch (e) {}
  }, [queue]);

  const lastEndedTrackIdRef = useRef(null);
  const lastEndedTimestampRef = useRef(0);

  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const showQueuePanelRef = useRef(false);

  useEffect(() => {
    showQueuePanelRef.current = showQueuePanel;
  }, [showQueuePanel]);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === dropIndex) return;

    const newQueue = [...queue];
    const draggedItem = newQueue[draggedItemIndex];
    newQueue.splice(draggedItemIndex, 1);
    newQueue.splice(dropIndex, 0, draggedItem);
    
    setQueue(newQueue);
    setDraggedItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };
  const [mobileQueueTab, setMobileQueueTab] = useState('player');
  const [isMiniPlayerExpanded, setIsMiniPlayerExpanded] = useState(false);
  const [isHomeScrolled, setIsHomeScrolled] = useState(false);
  // Route-aware mini-player visibility:
  // In V2 compact mode: persistent bottom mini-player whenever a track is selected, floating cleanly above bottom navigation.
  // In legacy mode: displays when away from Home tab OR when scrolled past hero on Home tab.
  // Note: On swipe (/swipe) with USE_V2_SWIPE_UI active, the mini-player is auto-hidden because the swipe card itself acts as the active player.
  const isBottomPlayerVisible = Boolean(
    currentSong &&
    (USE_COMPACT_V2_UI || activeTab !== 'home' || isHomeScrolled) &&
    activeTab !== 'dj-club' &&
    activeTab !== 'relax' &&
    !(USE_V2_SWIPE_UI && activeTab === 'swipe')
  );
  const [stopAfterCurrentTrack, setStopAfterCurrentTrack] = useState(false);
  const stopAfterCurrentTrackRef = useRef(false);
  useEffect(() => {
    stopAfterCurrentTrackRef.current = stopAfterCurrentTrack;
  }, [stopAfterCurrentTrack]);
  const [isDataSaverEnabled, setIsDataSaverEnabled] = useState(() => {
    try {
      return localStorage.getItem('loopra_datasaver') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [activeRoom, setActiveRoom] = useState(null);
  const lastHistoryLogRef = useRef({ trackId: null, time: 0 });

  useEffect(() => {
    if (activeRoom || activeTab === 'rooms') {
      setIsSidebarOpen(false);
    }
  }, [activeRoom, activeTab]);
  useEffect(() => {
    activeRoomSessionRef.current = activeRoom;
  }, [activeRoom]);
  const [roomPlaylists, setRoomPlaylists] = useState([]);
  useEffect(() => {
    if (!isPlaylistModalOpen || !authToken) return;
    let cancelled = false;
    fetch(getApiUrl('/api/rooms'), {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const fetched = Array.isArray(data?.rooms) ? data.rooms : (Array.isArray(data) ? data : []);
        const merged = [...fetched];
        if (activeRoom) {
          const aId = activeRoom.roomId || activeRoom.id;
          if (aId && !merged.some(rm => (rm.roomId || rm.id) === aId)) {
            merged.unshift(activeRoom);
          }
        }
        setModalRooms(merged);
      })
      .catch(() => {
        if (!cancelled && activeRoom) setModalRooms([activeRoom]);
      });
    return () => { cancelled = true; };
  }, [isPlaylistModalOpen, authToken, activeRoom]);
  const [isRoomPlaybackSyncEnabled, setIsRoomPlaybackSyncEnabled] = useState(() => {
    try {
      return localStorage.getItem('loopra_listen_together_enabled') === 'true';
    } catch (_) {
      return false;
    }
  });
  const isRoomPlaybackSyncEnabledRef = useRef(false);
  useEffect(() => {
    isRoomPlaybackSyncEnabledRef.current = isRoomPlaybackSyncEnabled;
    try {
      localStorage.setItem('loopra_listen_together_enabled', isRoomPlaybackSyncEnabled ? 'true' : 'false');
    } catch (_) {}
  }, [isRoomPlaybackSyncEnabled]);

  // High-precision server clock offset (NTP algorithm) and drift correction refs
  const serverClockOffsetRef = useRef(0);
  const activeRoomSessionRef = useRef(null);
  const playbackScheduledTimerRef = useRef(null);
  const lastSyncCorrectionTimeRef = useRef(0);
  const isIncomingRoomSyncRef = useRef(false);
  const lastBroadcastSignatureRef = useRef(null);
  const [selectedPlaylistCategory, setSelectedPlaylistCategory] = useState('personal'); // 'personal' | 'room'
  const [selectedRoomPlaylistForSong, setSelectedRoomPlaylistForSong] = useState(null);
  const [similarSongsTrack, setSimilarSongsTrack] = useState(null);
  const currentSuggestionsRef = useRef([]);

  // Smart Queue State (Autoplay pool: 5 similar + 5 discovery)
  const [smartQueue, setSmartQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('afterhours_smart_queue')) || [];
    } catch (e) {
      return [];
    }
  });
  const smartQueueRef = useRef(smartQueue);
  useEffect(() => {
    smartQueueRef.current = smartQueue;
    try {
      localStorage.setItem('afterhours_smart_queue', JSON.stringify(smartQueue));
    } catch (e) {}
  }, [smartQueue]);

  // Per-User Persisted AI Seeded Tracks Pool (100+ tracks by category & genre)
  const [aiSeededTracks, setAiSeededTracks] = useState(() => {
    try {
      const u = getTabAuthUser();
      const uKey = u?._id || u?.id || 'guest';
      const stored = localStorage.getItem(`loopra_ai_seeded_tracks_${uKey}`) || localStorage.getItem('loopra_ai_seeded_tracks_common');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const aiSeededTracksRef = useRef(aiSeededTracks);
  const aiSeededIndexRef = useRef(0);
  const isSeedingAiTracksRef = useRef(false);
  const lastSeededGenreKeyRef = useRef('');

  useEffect(() => {
    aiSeededTracksRef.current = aiSeededTracks;
    try {
      const uKey = user?._id || user?.id || 'guest';
      if (aiSeededTracks && aiSeededTracks.length > 0) {
        localStorage.setItem(`loopra_ai_seeded_tracks_${uKey}`, JSON.stringify(aiSeededTracks));
        localStorage.setItem('loopra_ai_seeded_tracks_common', JSON.stringify(aiSeededTracks));
      }
    } catch (e) {}
  }, [aiSeededTracks, user]);

  const isPrefetchingSmartQueueRef = useRef(false);
  const lastPrefetchedTrackIdRef = useRef(null);

  const prefetchSmartQueue = useCallback(async (baseTrack, force = false) => {
    if (!baseTrack) return;
    const trackId = smartQueueService.getTrackId(baseTrack);
    if (!trackId) return;
    if (!force && lastPrefetchedTrackIdRef.current === trackId && smartQueueRef.current.length >= 3) {
      return;
    }
    if (isPrefetchingSmartQueueRef.current) return;
    isPrefetchingSmartQueueRef.current = true;
    lastPrefetchedTrackIdRef.current = trackId;

    try {
      const data = await smartQueueService.fetchRecommendations(baseTrack, { forceRefresh: force });
      const recs = data.items || [];
      const deduplicated = smartQueueService.deduplicateAgainstContext(recs, {
        currentSong: currentSongRef.current,
        manualQueue: queue,
        history: playbackHistoryStackRef.current
      });

      if (deduplicated.length > 0) {
        setSmartQueue(deduplicated);
        currentSuggestionsRef.current = deduplicated;
      }
    } catch (err) {
      console.warn('[SmartQueue] Background prefetch notice:', err.message);
    } finally {
      isPrefetchingSmartQueueRef.current = false;
    }
  }, [queue]);
  const closeExpandedPlayer = useCallback(() => {
    setShowQueuePanel(false);
  }, []);
  const handleOpenExpandedPlayer = (tab = 'player') => {
    setMobileQueueTab(tab);
    setShowQueuePanel(true);
  };

  // Loopra Platform Upgrade States:
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [isPlayerSettingsOpen, setIsPlayerSettingsOpen] = useState(false);
  const [showAllTrending, setShowAllTrending] = useState(false);
  const [showAllArtists, setShowAllArtists] = useState(false);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [showAllRadio, setShowAllRadio] = useState(false);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(null); // seconds
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [activeAssistantPanel, setActiveAssistantPanel] = useState(null); // null | 'ai' | 'voice'
  const [pendingAppUpdate, setPendingAppUpdate] = useState(null);
  const [publishedVersionInfo, setPublishedVersionInfo] = useState(null);
  const [isAvatarVisible, setIsAvatarVisible] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('loopra_avatar_visible');
      if (saved !== null) return saved === 'true';
    }
    return false; // Default to false so 3D avatar does NOT auto-mount or render on initial visit
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const currentContextTracksRef = useRef([]);
  useEffect(() => {
    if (activeTab === 'playlists' && selectedPlaylistForView?.songs) {
      currentContextTracksRef.current = selectedPlaylistForView.songs;
    } else if (activeTab === 'library') {
      currentContextTracksRef.current = likedSongs;
    } else if (activeTab === 'history') {
      currentContextTracksRef.current = history;
    } else if (['barber', 'truck', 'pauwa', 'romance', 'sad_songs', 'chill'].includes(activeTab)) {
      currentContextTracksRef.current = songs;
    } else {
      currentContextTracksRef.current = songs?.length > 0 ? songs : likedSongs;
    }
  }, [activeTab, selectedPlaylistForView, likedSongs, history, songs]);
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  // Standalone / Android APK environment detection to ensure system status bar clearance
  const [isStandaloneApp, setIsStandaloneApp] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.LoopraAndroid ||
      window.navigator?.standalone ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator?.userAgent && navigator.userAgent.includes('LoopraNativeAndroid'))
    );
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkStandalone = () => {
      const isStandalone = Boolean(
        window.LoopraAndroid ||
        window.navigator?.standalone ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        (navigator?.userAgent && navigator.userAgent.includes('LoopraNativeAndroid'))
      );
      setIsStandaloneApp(isStandalone);
      if (isStandalone) {
        document.documentElement.classList.add('loopra-standalone');
        if (window.LoopraAndroid || (navigator?.userAgent && navigator.userAgent.includes('LoopraNativeAndroid'))) {
          document.documentElement.classList.add('loopra-android-app');
        }
      }
    };
    checkStandalone();
    const media = window.matchMedia?.('(display-mode: standalone)');
    media?.addEventListener?.('change', checkStandalone);
    return () => {
      media?.removeEventListener?.('change', checkStandalone);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCanvasOpenRef = useRef(false);
  const showAuthModalRef = useRef(false);
  const isSidebarOpenRef = useRef(false);
  const isMobileScreenRef = useRef(false);

  useEffect(() => {
    isCanvasOpenRef.current = isCanvasOpen;
  }, [isCanvasOpen]);
  useEffect(() => {
    showAuthModalRef.current = showAuthModal;
  }, [showAuthModal]);
  useEffect(() => {
    isSidebarOpenRef.current = isSidebarOpen;
  }, [isSidebarOpen]);
  useEffect(() => {
    isMobileScreenRef.current = isMobileScreen;
  }, [isMobileScreen]);

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [historyPageLimit, setHistoryPageLimit] = useState(15);
  const activeListeningDurationRef = useRef(0);
  const playSessionIdRef = useRef(null);
  const lastSyncedDurationRef = useRef(0);
  const lastStatsRefreshTimeRef = useRef(Date.now());
  const websiteSessionIdRef = useRef(null);
  const lastUserInteractionRef = useRef(Date.now());
  const [crossfadeDuration, setCrossfadeDuration] = useState(() => {
    try {
      return Number(localStorage.getItem(STORAGE_KEYS.CROSSFADE_DURATION)) || 0;
    } catch (_) {
      return 0;
    }
  });
  const [isGaplessEnabled, setIsGaplessEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.GAPLESS_ENABLED) === 'true';
    } catch (_) {
      return false;
    }
  });

  const handleSetCrossfadeDuration = (duration) => {
    setCrossfadeDuration(duration);
    try {
      localStorage.setItem(STORAGE_KEYS.CROSSFADE_DURATION, duration.toString());
    } catch (_) {}
    showToast(duration > 0 ? `Crossfade set to ${duration}s` : 'Crossfade disabled');
  };

  const handleToggleGapless = () => {
    setIsGaplessEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.GAPLESS_ENABLED, next.toString());
      } catch (_) {}
      showToast(next ? 'Gapless playback enabled' : 'Gapless playback disabled');
      return next;
    });
  };

  const hasLoggedListenForCurrentSongRef = useRef(false);

  // Close account dropdown on outside click or Escape key
  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const handleClickOutside = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setIsAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isServerWakingUp, setIsServerWakingUp] = useState(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);

  // Subscribe to Render server cold-start status badge
  useEffect(() => {
    const unsub = subscribeToWakeStatus((waking) => {
      setIsServerWakingUp(waking);
    });
    return unsub;
  }, []);

  // Listen for global toast events dispatched across services (e.g. voiceAgent/Brave PWA alerts)
  useEffect(() => {
    const handleGlobalToast = (e) => {
      if (e.detail?.message) {
        showToast(e.detail.message, e.detail.duration || 3500);
      }
    };
    window.addEventListener('loopra:show-toast', handleGlobalToast);
    return () => window.removeEventListener('loopra:show-toast', handleGlobalToast);
  }, [showToast]);

  // Keep stable refs to avoid infinite re-render loops in socket & effect callbacks
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const isSyncingUserStateRef = useRef(false);

  // Real-time synchronization of user roles and immediate revocation of admin dashboard
  useEffect(() => {
    // 1. Fetch live user account state from server on mount / reconnect to prevent stale roles
    const syncCurrentUserState = async () => {
      const curToken = authToken || getTabAuthToken();
      if (!curToken || isSyncingUserStateRef.current) return;
      isSyncingUserStateRef.current = true;
      try {
        const res = await fetch(getApiUrl('/api/auth/me'), {
          headers: { Authorization: `Bearer ${curToken}` }
        });
        if (res.status === 401 || res.status === 403) {
          clearTabAuthSession();
          setUser(null);
          setAuthToken('');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            setUser(prev => {
              if (!prev) {
                setTabAuthSession(curToken, data.user);
                return data.user;
              }
              // If core authorization details are unchanged, return prev to preserve object reference
              const isUnchanged = prev._id === data.user._id &&
                prev.role === data.user.role &&
                prev.status === data.user.status &&
                prev.username === data.user.username &&
                prev.avatarUrl === data.user.avatarUrl &&
                prev.displayName === data.user.displayName;
              if (isUnchanged) return prev;

              const merged = { ...prev, ...data.user };
              setTabAuthSession(curToken, merged);
              if (prev.role === 'admin' && merged.role !== 'admin' && activeTabRef.current === 'admin') {
                setActiveTab('home');
                window.history.pushState(null, '', '/');
                showToast('Your administrator privileges have been revoked.', 'warning');
              }
              return merged;
            });
          }
        }
      } catch (err) {
      } finally {
        isSyncingUserStateRef.current = false;
      }
    };

    syncCurrentUserState();

    // 2. Real-time Socket.io listeners for instant promotion/revocation
    const handleRoleChanged = (data) => {
      const currentUser = userRef.current;
      if (!data || !currentUser) return;
      const currentUid = currentUser.id || currentUser._id || currentUser.userId;
      if (currentUid && data.userId && currentUid.toString() === data.userId.toString()) {
        const newRole = data.role;
        const updated = { ...currentUser, role: newRole, status: data.status || currentUser.status };
        setUser(updated);
        setTabAuthSession(authToken || getTabAuthToken(), updated);

        if (newRole !== 'admin') {
          if (activeTabRef.current === 'admin') {
            setActiveTab('home');
            window.history.pushState(null, '', '/');
          }
          showToast('Your administrator privileges have been revoked by an administrator.', 'warning');
        } else if (newRole === 'admin') {
          showToast('You have been granted administrator privileges.', 'success');
        }
      }
    };

    const handleAdminRevoked = (data) => {
      setUser(prev => {
        if (!prev) return prev;
        const updated = { ...prev, role: 'user' };
        setTabAuthSession(authToken || getTabAuthToken(), updated);
        return updated;
      });
      if (activeTabRef.current === 'admin') {
        setActiveTab('home');
        window.history.pushState(null, '', '/');
      }
      showToast(data?.message || 'Your administrator privileges have been revoked.', 'warning');
    };

    const handleUserProfileUpdated = (data) => {
      const currentUser = userRef.current;
      if (!data || !currentUser) return;
      const currentUid = (currentUser.id || currentUser._id || currentUser.userId || '').toString();
      if (currentUid && data.userId && currentUid === data.userId.toString()) {
        setUser(prev => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : prev.avatarUrl,
            displayName: data.displayName || prev.displayName
          };
          setTabAuthSession(authToken || getTabAuthToken(), updated);
          return updated;
        });
      }
    };

    socket.on('user_role_changed', handleRoleChanged);
    socket.on('admin_access_revoked', handleAdminRevoked);
    socket.on('user_profile_updated', handleUserProfileUpdated);
    const handleFeatureFlagUpdate = (data) => {
      if (data?.featureKey === 'voice_control') {
        voiceControlService.handleSocketFlagUpdate(data, userRef.current);
      }
    };
    socket.on('feature_flag_updated', handleFeatureFlagUpdate);
    socket.on('connect', syncCurrentUserState);

    return () => {
      socket.off('user_role_changed', handleRoleChanged);
      socket.off('admin_access_revoked', handleAdminRevoked);
      socket.off('user_profile_updated', handleUserProfileUpdated);
      socket.off('feature_flag_updated', handleFeatureFlagUpdate);
      socket.off('connect', syncCurrentUserState);
    };
  }, [showToast]);

  // Sleep Timer countdown loop
  useEffect(() => {
    if (sleepTimerRemaining === null || sleepTimerRemaining <= 0) return;
    const interval = setInterval(() => {
      setSleepTimerRemaining(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          userIntentPlayingRef.current = false;
          isUserPausedRef.current = true;
          if (silentAudioRef.current) silentAudioRef.current.pause();
          if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
            try { playerRef.current.pauseVideo(); } catch (e) {}
          }
          setIsPlaying(false);
          showToast('Sleep timer reached. Music paused.');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerRemaining, showToast]);

  const handleCyclePlaybackSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    try {
      if (playerRef.current?.setPlaybackRate) {
        playerRef.current.setPlaybackRate(nextSpeed);
      }
    } catch (e) {}
    showToast(`Playback speed: ${nextSpeed}x`);
  };

  const handleToggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      try {
        if (next) {
          playerRef.current?.mute?.();
        } else {
          playerRef.current?.unMute?.();
        }
      } catch (e) {}
      return next;
    });
  };

  const handleShareTrack = (track = currentSong) => {
    if (!track) return;
    const shareUrl = `${window.location.origin}?track=${encodeURIComponent(track.id || track.videoId || '')}`;
    const shareTitle = `${track.title} - Loopra`;
    const shareText = `Listen to "${track.title}" by ${track.channel || track.artist || 'Loopra'} on Loopra!`;
    if (navigator.share) {
      navigator.share({ title: shareTitle, text: shareText, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareUrl);
      showToast('Track link copied to clipboard!');
    }
  };


  const [clockString, setClockString] = useState("");
  // Authoritative live users state (strictly driven by backend presence, no local random generation)
  const [activeUsersCount, setActiveUsersCount] = useState(null);
  const [isLiveCountStale, setIsLiveCountStale] = useState(false);
  const verifiedLiveUsersRef = useRef(null);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);


  const lastValidatedTokenRef = useRef(null);
  const lastAttemptedUsernameRef = useRef(null);

  useEffect(() => {
    if (authToken) {
      if (lastValidatedTokenRef.current === authToken) {
        return;
      }
      lastValidatedTokenRef.current = authToken;

      fetch(getApiUrl('/api/auth/me'), {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
        .then(async (res) => {
          if (res.status === 401 || res.status === 403) {
            clearTabAuthSession();
            setUser(null);
            setAuthToken('');
            return null;
          }
          const parsed = await safeParseJsonResponse(res, 'Token validation failed');
          return parsed.ok ? parsed.data : null;
        })
        .then(data => {
          if (data && data.user) {
            setUser(prev => {
              if (
                prev &&
                (prev._id || prev.userId) === (data.user._id || data.user.userId) &&
                prev.role === data.user.role &&
                prev.status === data.user.status &&
                prev.username === data.user.username &&
                prev.avatarUrl === data.user.avatarUrl &&
                prev.displayName === data.user.displayName &&
                prev.isVip === data.user.isVip
              ) {
                return prev;
              }
              const updated = { ...(prev || {}), ...data.user };
              setTabAuthSession(authToken, updated);
              return updated;
            });
            setTabAuthSession(authToken, data.user);
          }
        })
        .catch(() => {});
    }
  }, [authToken]);

  // Meaningful listening tracker (threshold >= 30s) & Session State Management
  useEffect(() => {
    if (currentSong?.id || currentSong?.videoId) {
      playSessionIdRef.current = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      activeListeningDurationRef.current = 0;
      lastSyncedDurationRef.current = 0;
      hasLoggedListenForCurrentSongRef.current = false;
    }
  }, [currentSong?.id, currentSong?.videoId]);

  // Track Pause & Resume events
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (!currentSong) return;
    if (wasPlayingRef.current && !isPlaying && activeListeningDurationRef.current > 0) {
      // User paused
      if (authToken) {
        recommendationsClient.logListeningEvent(BACKEND_URL, authToken, {
          trackId: currentSong.id || currentSong.videoId,
          title: currentSong.title,
          artist: currentSong.artist || currentSong.channel || 'Unknown Artist',
          thumbnail: getCleanThumbnail(currentSong),
          eventType: 'pause',
          duration: durationRef.current || 0,
          listenedDuration: activeListeningDurationRef.current,
          completionPercent: Math.min(100, Math.round((activeListeningDurationRef.current / (durationRef.current || 200)) * 100)),
          playSessionId: playSessionIdRef.current,
          source: activeTab || 'player'
        });
        listeningStatsService.recordEvent?.({
          backendUrl: BACKEND_URL,
          token: authToken,
          user,
          track: currentSong,
          eventType: 'pause',
          duration: durationRef.current || 0,
          listenedDuration: activeListeningDurationRef.current,
          playbackPosition: currentTimeRef.current || 0,
          playSessionId: playSessionIdRef.current,
          completed: false
        });
      }
    } else if (!wasPlayingRef.current && isPlaying && activeListeningDurationRef.current > 0) {
      // User resumed
      if (authToken) {
        recommendationsClient.logListeningEvent(BACKEND_URL, authToken, {
          trackId: currentSong.id || currentSong.videoId,
          title: currentSong.title,
          artist: currentSong.artist || currentSong.channel || 'Unknown Artist',
          thumbnail: getCleanThumbnail(currentSong),
          eventType: 'resume',
          duration: durationRef.current || 0,
          listenedDuration: activeListeningDurationRef.current,
          completionPercent: Math.min(100, Math.round((activeListeningDurationRef.current / (durationRef.current || 200)) * 100)),
          playSessionId: playSessionIdRef.current,
          source: activeTab || 'player'
        });
        listeningStatsService.recordEvent?.({
          backendUrl: BACKEND_URL,
          token: authToken,
          user,
          track: currentSong,
          eventType: 'resume',
          duration: durationRef.current || 0,
          listenedDuration: activeListeningDurationRef.current,
          playbackPosition: currentTimeRef.current || 0,
          playSessionId: playSessionIdRef.current,
          completed: false
        });
      }
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying, currentSong, authToken, activeTab]);

  // 1-second interval counting actual listening time (strictly when isPlaying === true)
  useEffect(() => {
    if (!isPlaying || !currentSong) return;
    const interval = setInterval(() => {
      activeListeningDurationRef.current += 1;
      // Increment user-isolated aggregate listening time
      listeningStatsService.recordListeningTime?.(1, user);

      // Log play immediately (>= 1s) so even short plays/skips are recorded in history & stats
      if (activeListeningDurationRef.current >= 1 && !hasLoggedListenForCurrentSongRef.current) {
        hasLoggedListenForCurrentSongRef.current = true;
        listeningStatsService.recordPlay?.(currentSong, activeListeningDurationRef.current, user);

        if (authToken) {
          recommendationsClient.logListeningEvent(BACKEND_URL, authToken, {
            trackId: currentSong?.id || currentSong?.videoId,
            title: currentSong?.title || 'Unknown Track',
            artist: currentSong?.artist || currentSong?.channel || 'Unknown Artist',
            thumbnail: getCleanThumbnail(currentSong),
            eventType: 'progress',
            duration: durationRef.current || 0,
            listenedDuration: activeListeningDurationRef.current,
            completionPercent: Math.min(100, Math.round((activeListeningDurationRef.current / (durationRef.current || 200)) * 100)),
            playSessionId: playSessionIdRef.current,
            source: activeTab || 'player'
          });
          listeningStatsService.recordEvent?.({
            backendUrl: BACKEND_URL,
            token: authToken,
            user,
            track: currentSong,
            eventType: 'progress',
            duration: durationRef.current || 0,
            listenedDuration: activeListeningDurationRef.current,
            playbackPosition: currentTimeRef.current || 0,
            playSessionId: playSessionIdRef.current,
            completed: false
          });

          // Social Listening Activity Feed logging (only for genuine 30s+ plays, protected by timeout)
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            fetch(getApiUrl('/api/activity/log'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                type: 'listen',
                track: {
                  id: currentSong?.id || currentSong?.videoId,
                  videoId: currentSong?.id || currentSong?.videoId,
                  title: currentSong?.title || 'Unknown Track',
                  artist: currentSong?.artist || currentSong?.channel || 'Unknown Artist',
                  albumArt: getCleanThumbnail(currentSong)
                }
              }),
              signal: controller.signal
            }).then(() => clearTimeout(timeoutId)).catch(() => clearTimeout(timeoutId));
          } catch (e) {}
        }
      } else if (activeListeningDurationRef.current % 15 === 0 && activeListeningDurationRef.current > 0) {
        // Periodic sync every 15s of active playback
        lastSyncedDurationRef.current = activeListeningDurationRef.current;
        if (authToken) {
          recommendationsClient.logListeningEvent(BACKEND_URL, authToken, {
            trackId: currentSong?.id || currentSong?.videoId,
            title: currentSong?.title || 'Unknown Track',
            artist: currentSong?.artist || currentSong?.channel || 'Unknown Artist',
            thumbnail: getCleanThumbnail(currentSong),
            eventType: 'progress',
            duration: durationRef.current || 0,
            listenedDuration: activeListeningDurationRef.current,
            completionPercent: Math.min(100, Math.round((activeListeningDurationRef.current / (durationRef.current || 200)) * 100)),
            playSessionId: playSessionIdRef.current,
            source: activeTab || 'player'
          });
          listeningStatsService.recordEvent?.({
            backendUrl: BACKEND_URL,
            token: authToken,
            user,
            track: currentSong,
            eventType: 'progress',
            duration: durationRef.current || 0,
            listenedDuration: activeListeningDurationRef.current,
            playbackPosition: currentTimeRef.current || 0,
            playSessionId: playSessionIdRef.current,
            completed: false
          });
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, currentSong, authToken, user, activeTab]);

  // 10-Minute Automatic Analytics Refresh while user is logged in & app active
  useEffect(() => {
    if (!authToken || !user) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        listeningStatsService.fetchStats?.({
          backendUrl: BACKEND_URL,
          token: authToken,
          user,
          forceRefresh: true
        }).then(() => {
          lastStatsRefreshTimeRef.current = Date.now();
        }).catch(() => {});
      }
    }, 10 * 60 * 1000); // 10 minutes

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - (lastStatsRefreshTimeRef.current || 0);
        if (elapsed >= 10 * 60 * 1000) {
          listeningStatsService.fetchStats?.({
            backendUrl: BACKEND_URL,
            token: authToken,
            user,
            forceRefresh: true
          }).then(() => {
            lastStatsRefreshTimeRef.current = Date.now();
          }).catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [authToken, user]);

  // Persistent Website Usage Tracking & Heartbeat (User-Isolated)
  useEffect(() => {
    if (!authToken || !user) return;

    if (!websiteSessionIdRef.current) {
      websiteSessionIdRef.current = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
    lastUserInteractionRef.current = Date.now();

    const markActive = () => {
      lastUserInteractionRef.current = Date.now();
    };

    window.addEventListener('mousemove', markActive, { passive: true });
    window.addEventListener('keydown', markActive, { passive: true });
    window.addEventListener('click', markActive, { passive: true });
    window.addEventListener('scroll', markActive, { passive: true });
    window.addEventListener('touchstart', markActive, { passive: true });

    // Initial presence heartbeat
    listeningStatsService.sendWebsiteHeartbeat?.({
      backendUrl: BACKEND_URL,
      token: authToken,
      sessionId: websiteSessionIdRef.current,
      activeSecondsDelta: 1,
      page: activeTab || 'home',
      deviceType: window.innerWidth < 768 ? 'mobile' : (window.innerWidth < 1024 ? 'tablet' : 'desktop'),
      isIdle: false
    });

    // Periodic heartbeat every 45s
    const heartbeatInterval = setInterval(() => {
      if (!authToken || !websiteSessionIdRef.current) return;
      const isVisible = document.visibilityState === 'visible';
      const isRecentlyActive = (Date.now() - lastUserInteractionRef.current) < 90000;
      const isActivelyListening = isPlaying;
      const isIdle = !isRecentlyActive && !isActivelyListening;
      const activeDelta = (isVisible || isActivelyListening) && !isIdle ? 45 : 0;

      listeningStatsService.sendWebsiteHeartbeat?.({
        backendUrl: BACKEND_URL,
        token: authToken,
        sessionId: websiteSessionIdRef.current,
        activeSecondsDelta: activeDelta,
        page: activeTab || 'home',
        deviceType: window.innerWidth < 768 ? 'mobile' : (window.innerWidth < 1024 ? 'tablet' : 'desktop'),
        isIdle
      });
    }, 45000);

    const handleUnload = () => {
      if (authToken && currentSongRef.current && activeListeningDurationRef.current > 0 && playSessionIdRef.current) {
        const outSong = currentSongRef.current;
        const outListened = activeListeningDurationRef.current;
        const outDur = durationRef.current || 200;
        listeningStatsService.recordEvent?.({
          backendUrl: BACKEND_URL,
          token: authToken,
          user,
          track: outSong,
          eventType: 'pause',
          duration: outDur,
          listenedDuration: outListened,
          playSessionId: playSessionIdRef.current,
          completed: false
        });
      }
      if (authToken && websiteSessionIdRef.current) {
        listeningStatsService.closeWebsiteSession?.({
          backendUrl: BACKEND_URL,
          token: authToken,
          sessionId: websiteSessionIdRef.current
        });
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('mousemove', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('click', markActive);
      window.removeEventListener('scroll', markActive);
      window.removeEventListener('touchstart', markActive);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [authToken, user, isPlaying, activeTab]);

  const openAuthModal = useCallback(() => {
    if (isPlaying) {
      wasPlayingBeforeAuthRef.current = true;
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        try { playerRef.current.pauseVideo(); } catch (e) {}
      }
      setIsPlaying(false);
    } else {
      wasPlayingBeforeAuthRef.current = false;
    }
    setAuthError('');
    setIsAuthSlow(false);
    setIsSidebarOpen(false);
    setShowAuthModal(true);
    // Non-blocking background health check to awaken Render free-tier instance ahead of submission
    pingServerHealth().catch(() => {});
  }, [isPlaying]);

  const closeAuthModal = useCallback((resumed = false) => {
    setShowAuthModal(false);
    setIsAuthSlow(false);
    if (resumed && wasPlayingBeforeAuthRef.current && currentSong) {
      wasPlayingBeforeAuthRef.current = false;
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        try { playerRef.current.playVideo(); } catch (e) {}
      }
      setIsPlaying(true);
    }
  }, [currentSong]);

  // Remote Hydration on Mount — Reconciles server data with local state so data is never overwritten
  const isHydratedRef = useRef(!user);
  const hydratedUserIdRef = useRef(null);
  const lastSyncedDataRef = useRef('');
  const syncRetryTimerRef = useRef(null);
  const syncAttemptsRef = useRef(0);
  const isSyncingRef = useRef(false);

  const currentUserId = user?.userId || user?._id || null;

  useEffect(() => {
    const id = currentUserId;
    if (!id) {
      isHydratedRef.current = true;
      hydratedUserIdRef.current = null;
      return;
    }

    if (!isValidMongoId(id)) {
      console.warn('[Sync] Invalid user ID format:', id);
      return;
    }

    if (hydratedUserIdRef.current === id) {
      return;
    }
    hydratedUserIdRef.current = id;

    let isMounted = true;
    const hydrateUserData = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/user/${id}`), {
          headers: { 'Accept': 'application/json' }
        });
        const parsed = await safeParseJsonResponse(res, 'User hydration failed');
        if (parsed.ok && parsed.data) {
          const data = parsed.data;
          if (!isMounted) return;

          // Remote account is authoritative for liked songs: never inject or merge unauthenticated guest/sample tracks
          const remoteLiked = sanitizeList(data.likedSongs || []);
          setLikedSongs(remoteLiked);
          try { localStorage.setItem('liked_songs', JSON.stringify(remoteLiked)); } catch (e) {}

          setPlaylists(prev => {
            const remote = sanitizeList(data.playlists || []);
            const map = new Map();
            remote.forEach(p => map.set(p.id, p));
            prev.forEach(p => map.set(p.id, p));
            const merged = Array.from(map.values());
            try { localStorage.setItem('playlists', JSON.stringify(merged)); } catch (e) {}
            return merged;
          });

          if (Array.isArray(data.history) && data.history.length > 0) {
            setHistory(prev => {
              if (prev.length === 0) {
                const h = sanitizeList(data.history).slice(0, 50);
                try { localStorage.setItem('history_songs', JSON.stringify(h)); } catch (e) {}
                return h;
              }
              return prev;
            });
          }

          if (Array.isArray(data.queue) && data.queue.length > 0) {
            setQueue(prev => {
              if (prev.length === 0) {
                const q = sanitizeList(data.queue);
                try { localStorage.setItem('afterhours_queue', JSON.stringify(q)); } catch (e) {}
                return q;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn('[Hydration] Could not fetch remote user data (relying on local storage):', err.message);
      } finally {
        if (isMounted) {
          isHydratedRef.current = true;
        }
      }
    };

    hydrateUserData();
    return () => { isMounted = false; };
  }, [currentUserId]);

  // Sync Data — debounced 2.5s after last change, with bounded exponential backoff
  const syncTimerRef = useRef(null);
  useEffect(() => {
    const id = user?.userId || user?._id;
    if (user && !id) {
      setUser(null);
      clearTabAuthSession();
      return;
    }
    if (!user || !id) return;
    if (!isHydratedRef.current) return; // Never sync before remote hydration is complete
    if (!isValidMongoId(id)) return;

    const payload = {
      likedSongs: sanitizeList(likedSongs),
      history: sanitizeList(history).slice(0, 50),
      playlists: sanitizeList(playlists),
      queue: sanitizeList(queue)
    };
    const payloadStr = JSON.stringify(payload);

    // Skip redundant network sync if nothing changed
    if (payloadStr === lastSyncedDataRef.current) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (syncRetryTimerRef.current) clearTimeout(syncRetryTimerRef.current);

    const performSync = async (retryCount = 0) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      try {
        const res = await fetch(getApiUrl(`/api/user/${id}/sync`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr
        });

        if (res.ok) {
          lastSyncedDataRef.current = payloadStr;
          syncAttemptsRef.current = 0;
          return;
        }

        // Retry on transient server errors (502, 503, 504) with bounded exponential backoff (max 3 retries)
        if ([502, 503, 504].includes(res.status) && retryCount < 3) {
          const delay = [2500, 5000, 10000][retryCount] || 5000;
          console.warn(`[Sync] Transient ${res.status} error, retrying in ${delay}ms (attempt ${retryCount + 1}/3)...`);
          syncRetryTimerRef.current = setTimeout(() => {
            isSyncingRef.current = false;
            performSync(retryCount + 1);
          }, delay);
          return;
        }

        if (res.status === 400 || res.status === 404) {
          console.warn('[Sync] Non-retryable response:', res.status);
          return;
        }
      } catch (err) {
        // Network error (e.g. Render waking up or network loss) with bounded exponential backoff
        if (retryCount < 3) {
          const delay = [2500, 5000, 10000][retryCount] || 5000;
          console.warn(`[Sync] Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/3):`, err.message);
          syncRetryTimerRef.current = setTimeout(() => {
            isSyncingRef.current = false;
            performSync(retryCount + 1);
          }, delay);
          return;
        }
        console.warn('[Sync] Retries exhausted. Will retry on next explicit user change:', err.message);
      } finally {
        isSyncingRef.current = false;
      }
    };

    syncTimerRef.current = setTimeout(() => {
      performSync(0);
    }, 2500);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (syncRetryTimerRef.current) clearTimeout(syncRetryTimerRef.current);
    };
  }, [likedSongs, history, playlists, queue, user]);

  // Active session heartbeat: Call GET /api/health every 14 minutes to eliminate Render free-tier cold starts
  useServerKeepAlive();

  const handleGoogleSuccess = async (credentialResponse) => {
    let slowTimer = null;
    try {
      setAuthLoading(true);
      setIsAuthSlow(false);
      setAuthError('');
      slowTimer = setTimeout(() => {
        setIsAuthSlow(true);
      }, 2000);

      // Support credential from ID token or access_token from useGoogleLogin flow
      const authPayload = credentialResponse?.access_token
        ? { accessToken: credentialResponse.access_token }
        : { token: credentialResponse?.credential || credentialResponse?.token };

      const res = await fetchWithRetry(getApiUrl('/api/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authPayload)
      }, { maxRetries: 2 });
      if (slowTimer) clearTimeout(slowTimer);
      setIsAuthSlow(false);
      const parsed = await safeParseJsonResponse(res, 'Google Auth failed');
      if (!parsed.ok) throw new Error(parsed.error);
      const data = parsed.data;
      if (!data || !data.user) {
        throw new Error('Invalid user profile received from Google Authentication.');
      }
      
      const loggedInUser = {
        username: data.user.username,
        userId: data.user.userId || data.user._id,
        displayName: data.user.displayName || data.user.username,
        avatarUrl: data.user.avatarUrl || '',
        role: data.user.role || data.role || 'user',
        status: data.user.status || 'active'
      };
      setUser(loggedInUser);
      if (data.token) {
        setAuthToken(data.token);
      }
      setTabAuthSession(data.token || authToken, loggedInUser);
      closeAuthModal(true);

      const userLiked = data.user.likedSongs || [];
      setLikedSongs(sanitizeList(userLiked));
      localStorage.setItem('liked_songs', JSON.stringify(sanitizeList(userLiked)));

      const userHistory = (data.user.history || []).slice(0, 50);
      setHistory(prev => {
        const uid = loggedInUser.userId;
        let savedUserHist = [];
        try { savedUserHist = JSON.parse(localStorage.getItem(`history_songs_${uid}`) || '[]'); } catch (_) {}
        const seen = new Set();
        const merged = [];
        for (const item of [...(prev || []), ...sanitizeList(userHistory), ...sanitizeList(savedUserHist)]) {
          const tid = item?.id || item?.videoId;
          if (tid && !seen.has(tid)) {
            seen.add(tid);
            merged.push(item);
          }
        }
        const finalHist = merged.slice(0, 50);
        try {
          localStorage.setItem('history_songs', JSON.stringify(finalHist));
          if (uid) localStorage.setItem(`history_songs_${uid}`, JSON.stringify(finalHist));
        } catch (_) {}
        return finalHist;
      });

      const userPlaylists = data.user.playlists || [];
      setPlaylists(sanitizeList(userPlaylists));
      localStorage.setItem('playlists', JSON.stringify(sanitizeList(userPlaylists)));

      const userQueue = data.user.queue || [];
      setQueue(sanitizeList(userQueue));
      localStorage.setItem('afterhours_queue', JSON.stringify(sanitizeList(userQueue)));
      
    } catch (err) {
      if (slowTimer) clearTimeout(slowTimer);
      setIsAuthSlow(false);
      console.error('Google Auth Error:', err);
      setAuthError(err.message || 'Login failed');
    } finally {
      if (slowTimer) clearTimeout(slowTimer);
      setIsAuthSlow(false);
      setAuthLoading(false);
    }
  };

  // Direct client-side Google OAuth hook (avoids GSI embedded iframe issues in Android WebViews)
  const triggerGoogleOAuth = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      handleGoogleSuccess(tokenResponse);
    },
    onError: (error) => {
      console.warn('Google Sign-In Error:', error);
      setAuthError('Google Sign-In was cancelled or origin not authorized. Please try again or use username and password.');
      showToast?.('Google Sign-In was closed or cancelled', 3500);
    }
  });

  // Automatically detect standalone/TWA/mobile environments:
  // In TWA / Standalone / WebView mode, popup OAuth freezes on a white screen.
  // Instead, route through system redirect flow via backend /api/auth/google?platform=android
  const triggerGoogleLogin = useCallback(() => {
    const isStandaloneEnv = typeof window !== 'undefined' && (
      Boolean(window.LoopraAndroid) ||
      Boolean(window.navigator?.standalone) ||
      Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '')
    );

    if (isStandaloneEnv) {
      const backendUrl = BACKEND_URL || 'https://afterhours-zvic.onrender.com';
      const redirectEndpoint = `${backendUrl}/api/auth/google?platform=android`;
      window.location.href = redirectEndpoint;
      return;
    }

    triggerGoogleOAuth();
  }, [triggerGoogleOAuth]);

  const handlePlayTrending = async (queryOrTitle, itemObj, contextList = []) => {
    // 1. Resolve explicit videoId directly from candidate object
    const candidateId = (itemObj?.videoId && typeof itemObj.videoId === 'string' && itemObj.videoId.length >= 5 ? itemObj.videoId : null)
      || (itemObj?.id && typeof itemObj.id === 'string' && itemObj.id.length >= 5 ? itemObj.id : null)
      || (typeof queryOrTitle === 'object' ? (queryOrTitle?.videoId || queryOrTitle?.id) : null);

    const toFormattedSong = (item, fallbackId) => {
      const rawId = item?.videoId || item?.id || fallbackId;
      const cleanId = (rawId && typeof rawId === 'object' && rawId.videoId) ? rawId.videoId : (typeof rawId === 'string' ? rawId.trim() : fallbackId);
      const cleanThumb = getCleanThumbnail(item, cleanId);

      // Clean HTML entities from title
      const cleanTitle = (item?.title || item?.name || "Unknown Title")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");

      // Resolve authentic artist/channel
      let cleanArtist = item?.artist || item?.channelTitle || item?.snippet?.channelTitle || item?.channel;
      if (!cleanArtist || cleanArtist === 'Unknown Artist' || cleanArtist === 'Unknown') {
        cleanArtist = item?.channel || 'Loopra Artist';
      }

      return {
        id: cleanId,
        videoId: cleanId,
        title: cleanTitle,
        artist: cleanArtist,
        channel: item?.channel || cleanArtist,
        thumbnail: cleanThumb,
        image: cleanThumb,
        duration: item?.duration || "Stream"
      };
    };

    // Instant direct playback path (strictly preserves title, artist, and exact video ID)
    if (candidateId) {
      const formattedSong = toFormattedSong(itemObj || queryOrTitle, candidateId);

      if (Array.isArray(contextList) && contextList.length > 0) {
        const formattedQueue = contextList.map(t => {
          const tId = (t?.videoId && typeof t.videoId === 'string' ? t.videoId : null) || (t?.id && typeof t.id === 'string' ? t.id : null);
          return tId ? toFormattedSong(t, tId) : null;
        }).filter(Boolean);
      }

      playSong(formattedSong);
      return;
    }

    const query = typeof queryOrTitle === 'string' ? queryOrTitle : (itemObj?.query || itemObj?.title || '');
    if (!query) return;

    const cachedEntry = searchCache[query];
    const cachedList = Array.isArray(cachedEntry) ? cachedEntry : cachedEntry?.items;
    if (cachedList && cachedList.length > 0) {
      const cached = cachedList[0];
      const cachedId = (cached?.id?.videoId || cached?.videoId || cached?.id);
      if (cachedId) {
        playSong(toFormattedSong(cached, cachedId));
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/youtube/search?limit=1&q=${encodeURIComponent(query)}`));
      const parsed = await safeParseJsonResponse(response, 'Failed to fetch trending song');
      if (parsed.ok && parsed.data && Array.isArray(parsed.data.items) && parsed.data.items.length > 0) {
        const item = parsed.data.items[0];
        const vid = item.id?.videoId || item.id || item.videoId;
        const formattedSong = toFormattedSong(item, vid);
        playSong(formattedSong);
      }
    } catch (error) {
      console.warn("Error playing trending:", error.message);
    } finally {
      setIsLoading(false);
    }
  };


  const handleArtistClick = (artistNameOrId) => {
    const trimmed = (artistNameOrId || '').trim();
    if (!trimmed) return;
    const primaryArtist = trimmed.split(/,|&|feat\.|ft\./i)[0].trim();
    const slug = primaryArtist
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    setSelectedArtistId(slug);
    handleStationSelect('artist', { id: slug, name: primaryArtist });
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    let slowTimer = null;
    setAuthLoading(true);
    setIsAuthSlow(false);
    setAuthError('');
    slowTimer = setTimeout(() => {
      setIsAuthSlow(true);
    }, 2000);
    try {
      const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
      const res = await fetchWithRetry(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      }, { maxRetries: 2 });
      if (slowTimer) clearTimeout(slowTimer);
      setIsAuthSlow(false);
      const parsed = await safeParseJsonResponse(res, isLoginMode ? 'Login failed' : 'Registration failed');
      if (!parsed.ok) throw new Error(parsed.error);
      const data = parsed.data;
      if (!data) throw new Error('Invalid authentication response from server.');
      
      const loggedInUser = {
        username: authForm.username,
        userId: data.userId || (data.user && data.user._id),
        displayName: (data.user && (data.user.displayName || data.user.username)) || authForm.username,
        avatarUrl: (data.user && data.user.avatarUrl) || '',
        role: data.role || (data.user && data.user.role) || 'user',
        status: (data.user && data.user.status) || 'active'
      };
      setUser(loggedInUser);
      if (data.token) {
        setAuthToken(data.token);
      }
      setTabAuthSession(data.token || authToken, loggedInUser);
      closeAuthModal(true);

      if (isLoginMode && data.user) {
        // Existing user login: load their saved account data
        const userLiked = data.user.likedSongs || [];
        setLikedSongs(sanitizeList(userLiked));
        localStorage.setItem('liked_songs', JSON.stringify(sanitizeList(userLiked)));

        const userHistory = (data.user.history || []).slice(0, 50);
        setHistory(prev => {
          const uid = loggedInUser.userId;
          let savedUserHist = [];
          try { savedUserHist = JSON.parse(localStorage.getItem(`history_songs_${uid}`) || '[]'); } catch (_) {}
          const seen = new Set();
          const merged = [];
          for (const item of [...(prev || []), ...sanitizeList(userHistory), ...sanitizeList(savedUserHist)]) {
            const tid = item?.id || item?.videoId;
            if (tid && !seen.has(tid)) {
              seen.add(tid);
              merged.push(item);
            }
          }
          const finalHist = merged.slice(0, 50);
          try {
            localStorage.setItem('history_songs', JSON.stringify(finalHist));
            if (uid) localStorage.setItem(`history_songs_${uid}`, JSON.stringify(finalHist));
          } catch (_) {}
          return finalHist;
        });

        if (Array.isArray(data.user.searchHistory) && data.user.searchHistory.length > 0) {
          localStorage.setItem(`afterhours_recent_searches_${loggedInUser.userId}`, JSON.stringify(data.user.searchHistory.slice(0, 10)));
        }

        const userPlaylists = data.user.playlists || [];
        setPlaylists(sanitizeList(userPlaylists));
        localStorage.setItem('playlists', JSON.stringify(sanitizeList(userPlaylists)));

        const userQueue = data.user.queue || [];
        setQueue(sanitizeList(userQueue));
        localStorage.setItem('afterhours_queue', JSON.stringify(sanitizeList(userQueue)));
      } else {
        // Register mode: Brand new account starts with clean, empty data
        setLikedSongs([]);
        localStorage.removeItem('liked_songs');
        setHistory([]);
        localStorage.removeItem('history_songs');
        setPlaylists([]);
        localStorage.removeItem('playlists');
        setQueue([]);
        localStorage.removeItem('afterhours_queue');
        setCurrentSong(null);
        localStorage.removeItem('afterhours_current_song');
        localStorage.removeItem('afterhours_current_time');
        localStorage.removeItem('afterhours_duration');
        setIsPlaying(false);
        if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
          try { playerRef.current.stopVideo(); } catch (e) {}
        }
      }
    } catch (err) {
      if (slowTimer) clearTimeout(slowTimer);
      setIsAuthSlow(false);
      console.warn('[Auth Request Notice]', { isLoginMode, error: err.message });
      setAuthError(err.message);
    } finally {
      if (slowTimer) clearTimeout(slowTimer);
      setIsAuthSlow(false);
      setAuthLoading(false);
    }
  };

  const logout = () => {
    try {
      socket.emit('user_logout', { sessionId: getOrCreateSessionId() });
      socket.auth = { sessionId: getOrCreateSessionId(), token: '' };
    } catch (e) {}

    if (websiteSessionIdRef.current && authToken) {
      listeningStatsService.closeWebsiteSession?.({
        backendUrl: BACKEND_URL,
        token: authToken,
        sessionId: websiteSessionIdRef.current
      });
      websiteSessionIdRef.current = null;
    }
    listeningStatsService.clearLocalStats?.();
    setUser(null);
    setAuthToken('');
    setIsAccountMenuOpen(false);
    clearTabAuthSession();
    localStorage.removeItem('liked_songs');
    localStorage.removeItem('history_songs');
    localStorage.removeItem('playlists');
    localStorage.removeItem('afterhours_queue');
    localStorage.removeItem('afterhours_current_song');
    localStorage.removeItem('afterhours_current_time');
    localStorage.removeItem('afterhours_duration');
    try {
      sessionStorage.removeItem('loopra_home_curated_cache');
      localStorage.removeItem('loopra_curated_cache');
      localStorage.removeItem('loopra_cached_recs');
    } catch (_) {}
    setLikedSongs([]);
    setHistory([]);
    setPlaylists([]);
    setQueue([]);
    setActiveRoom(null);
    setRoomPlaylists([]);
    setCurrentSong(null);
    setIsPlaying(false);
    if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
      try { playerRef.current.stopVideo(); } catch (e) {}
    }
  };

  const silentAudioRef = useRef(null);
  const isUserPausedRef = useRef(false);
  const autoResumeTimerRef = useRef(null);
  const videoTimeRef = useRef(0);
  const loadedVideoIdRef = useRef(null);
  const isRepeatRef = useRef(isRepeat);
  const handleNextSongRef = useRef(null);

  const offlineAudioRef = useRef(null);
  const activeObjectUrlRef = useRef(null);
  const playSongRef = useRef(null);
  const [offlineCount, setOfflineCount] = useState(0);

  const radioAudioRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    const refreshOfflineCount = () => {
      offlineStorageService.getAllTracks().then(t => setOfflineCount(t.length)).catch(() => {});
    };
    refreshOfflineCount();
    const unsub = offlineStorageService.subscribe(refreshOfflineCount);
    return () => unsub();
  }, []);

  useEffect(() => {
    return () => {
      if (activeObjectUrlRef.current) {
        try { URL.revokeObjectURL(activeObjectUrlRef.current); } catch (e) {}
      }
      if (offlineAudioRef.current) {
        try {
          offlineAudioRef.current.pause();
          offlineAudioRef.current.src = '';
        } catch (e) {}
      }
      if (radioAudioRef.current) {
        try {
          radioAudioRef.current.pause();
          radioAudioRef.current.src = '';
        } catch (e) {}
      }
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
          hlsRef.current = null;
        } catch (e) {}
      }
    };
  }, []);

  // Queue tracks across UI for automatic background batch eligibility verification
  useEffect(() => {
    const ids = [];
    if (currentSong?.id) ids.push(currentSong.id);
    if (Array.isArray(songs)) songs.forEach(s => s?.id && ids.push(s.id));
    if (Array.isArray(trendingSongs)) trendingSongs.forEach(s => s?.id && ids.push(s.id));
    if (Array.isArray(queue)) queue.forEach(s => s?.id && ids.push(s.id));
    if (Array.isArray(likedSongs)) likedSongs.forEach(s => s?.id && ids.push(s.id));
    if (Array.isArray(history)) history.forEach(s => s?.id && ids.push(s.id));
    if (ids.length > 0) {
      offlineEligibilityService.queueEligibilityCheck(ids);
    }
  }, [songs, trendingSongs, queue, likedSongs, history, currentSong]);

  useEffect(() => {
    isRepeatRef.current = isRepeat;
  }, [isRepeat]);


  useEffect(() => { if (user) { localStorage.setItem('liked_songs', JSON.stringify(likedSongs)); } else { localStorage.removeItem('liked_songs'); } }, [likedSongs, user]);
  useEffect(() => { if (user) { localStorage.setItem('history_songs', JSON.stringify(history)); } else { localStorage.removeItem('history_songs'); } }, [history, user]);
  useEffect(() => { 
    try {
      if (user) { 
        localStorage.setItem('playlists', JSON.stringify(playlists)); 
      } else { 
        localStorage.setItem('guest_playlists', JSON.stringify(playlists)); 
      } 
    } catch (e) {}
  }, [playlists, user]);
  // Limit searchCache to last 20 entries in localStorage to prevent storage bloat
  useEffect(() => {
    try {
      const keys = Object.keys(searchCache || {});
      const trimmed = {};
      keys.slice(-20).forEach(k => { trimmed[k] = searchCache[k]; });
      localStorage.setItem('youtube_search_cache', JSON.stringify(trimmed));
    } catch (_) {}
  }, [searchCache]);

  // Limit stationCache to last 20 entries in localStorage
  useEffect(() => {
    try {
      const keys = Object.keys(stationCache || {});
      const trimmed = {};
      keys.slice(-20).forEach(k => { trimmed[k] = stationCache[k]; });
      localStorage.setItem('youtube_station_cache', JSON.stringify(trimmed));
    } catch (_) {}
  }, [stationCache]);

  // Site-wide Listen Together Playback Sync Broadcaster:
  // When Listen Together is ON and active room is present, broadcasts track change, play/pause, and seeks
  // across the entire site (Home, Search, Liked, Playlists, Rooms, Recommendations) with echo prevention
  const broadcastPlaybackToRoom = useCallback((track, playingState, seekPosition, force = false) => {
    if (!isRoomPlaybackSyncEnabledRef.current) return;
    if (isIncomingRoomSyncRef.current) return; // Prevent echo loop from incoming server socket events
    const currentRoom = activeRoomSessionRef.current;
    if (!currentRoom) return;

    const rId = currentRoom.roomId || currentRoom.id;
    if (!rId) return;

    const activeTrack = track || currentSong;
    if (!activeTrack) return;

    const trackId = activeTrack.id || activeTrack.videoId;
    if (!trackId) return;

    const pos = typeof seekPosition === 'number' ? Math.max(0, seekPosition) : (currentTimeRef.current || 0);
    const isPlay = playingState !== undefined ? Boolean(playingState) : Boolean(isPlaying);

    const sig = `${trackId}_${isPlay ? '1' : '0'}_${Math.round(pos * 2)}`;
    if (!force && lastBroadcastSignatureRef.current === sig) {
      return; // Skip identical duplicate broadcasts
    }
    lastBroadcastSignatureRef.current = sig;

    if (socket && socket.connected) {
      const curUser = user || { userId: getOrCreateSessionId() };
      socket.emit('room:playback:sync', {
        roomId: rId,
        currentSong: activeTrack,
        isPlaying: isPlay,
        seekTime: pos,
        playbackRate: 1.0,
        user: curUser
      });
    }
  }, [currentSong, isPlaying, user]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("To install the app, look for the 'Install' or 'Add to Home Screen' option in your browser menu (often 3 dots or share icon). If you don't see it, it might already be installed!");
      return;
    }
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User installed the PWA');
      }
    } catch (e) {}
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);

    // Authoritative hydration of public live users count
    const syncLiveUsersCount = () => {
      fetch(getApiUrl('/api/public/live-users'))
        .then(res => {
          if (!res.ok) throw new Error('Live users fetch failed');
          return res.json();
        })
        .then(data => {
          const count = typeof data?.count === 'number' ? data.count : (typeof data === 'number' ? data : null);
          if (count !== null && !isNaN(count)) {
            verifiedLiveUsersRef.current = count;
            setActiveUsersCount(count);
            setIsLiveCountStale(false);
          }
        })
        .catch(() => {
          // On API failure, maintain last verified count with stale indicator or show '--' (null)
          if (verifiedLiveUsersRef.current !== null) {
            setActiveUsersCount(verifiedLiveUsersRef.current);
            setIsLiveCountStale(true);
          } else {
            setActiveUsersCount(null);
            setIsLiveCountStale(true);
          }
        });
    };

    syncLiveUsersCount();

    const handleActiveUsersUpdate = (payload) => {
      const count = typeof payload === 'object' && payload !== null ? payload.count : payload;
      if (typeof count === 'number' && !isNaN(count)) {
        verifiedLiveUsersRef.current = count;
        setActiveUsersCount(count);
        setIsLiveCountStale(false);
      }
    };

    socket.on('active_users', handleActiveUsersUpdate);

    // NTP Clock Synchronization: compute accurate serverClockOffset & RTT
    const syncServerClock = () => {
      if (!socket || !socket.connected) return;
      const t0 = Date.now();
      socket.emit('room:time:ping', { clientSendTime: t0 }, (res) => {
        if (!res) return;
        const t3 = Date.now();
        const t1 = res.serverReceiveTime || res.serverTransmitTime;
        const t2 = res.serverTransmitTime || res.serverReceiveTime;
        const rtt = Math.max(0, (t3 - t0) - (t2 - t1));
        // offset = ((t1 - t0) + (t2 - t3)) / 2
        const computedOffset = Math.round(((t1 - t0) + (t2 - t3)) / 2);
        serverClockOffsetRef.current = computedOffset;
      });
    };

    // Run NTP sync on connect and every 15 seconds
    syncServerClock();
    const clockSyncInterval = setInterval(syncServerClock, 15000);

    const handleRoomPlaybackPrepareEvent = (data) => {
      if (!isRoomPlaybackSyncEnabledRef.current || !data) return;
      // Enforce open-app-only execution
      if (document.hidden) return;

      const prep = data.prepareState;
      const targetTrack = prep?.track;
      if (!targetTrack) return;

      const rId = data.roomId || activeRoomSessionRef.current?.roomId || activeRoomSessionRef.current?.id;
      const targetId = targetTrack.id || targetTrack.videoId;
      const curId = currentSong?.id || currentSong?.videoId;

      // Load/buffer track in paused state
      if (curId !== targetId) {
        playSong(targetTrack);
        setTimeout(() => {
          playerRef.current?.pauseVideo?.();
          setIsPlaying(false);
          if (typeof prep.basePositionSec === 'number' && prep.basePositionSec > 0) {
            handleSeek(prep.basePositionSec);
          }
        }, 150);
      } else {
        playerRef.current?.pauseVideo?.();
        setIsPlaying(false);
        if (typeof prep.basePositionSec === 'number') {
          handleSeek(prep.basePositionSec);
        }
      }

      // Notify server and room members that this client has preloaded & buffered
      if (socket && rId && prep.requestId) {
        const curUser = user || { userId: getOrCreateSessionId() };
        socket.emit('room:playback:buffered', {
          roomId: rId,
          requestId: prep.requestId,
          userId: curUser._id || curUser.userId || curUser.id || getOrCreateSessionId(),
          user: curUser
        });
      }
    };

    const handleRoomPlaybackSyncEvent = (data) => {
      if (!isRoomPlaybackSyncEnabledRef.current || !data) return;
      // Enforce open-app-only execution
      if (document.hidden) return;

      const targetTrack = data.currentSong || data.track;
      if (targetTrack) {
        // Set incoming sync flag to block echo broadcast back to the server
        isIncomingRoomSyncRef.current = true;
        setTimeout(() => {
          isIncomingRoomSyncRef.current = false;
        }, 1200);

        const curId = currentSong?.id || currentSong?.videoId;
        const targetId = targetTrack?.id || targetTrack?.videoId;
        let adjustedSeek = typeof data.basePositionSec === 'number' 
          ? data.basePositionSec 
          : (typeof data.seekTime === 'number' ? data.seekTime : 0);

        // Compute authoritative server-corrected elapsed time
        const serverNow = Date.now() + (serverClockOffsetRef.current || 0);
        const refTimestamp = data.startAtServerTime || data.startedAt || data.timestamp;

        if (data.isPlaying && refTimestamp) {
          // If startAtServerTime is scheduled in the near future (e.g. +200ms)
          if (data.startAtServerTime && data.startAtServerTime > serverNow) {
            const delayMs = Math.max(0, data.startAtServerTime - serverNow);
            if (playbackScheduledTimerRef.current) clearTimeout(playbackScheduledTimerRef.current);
            playbackScheduledTimerRef.current = setTimeout(() => {
              if (document.hidden) return;
              playerRef.current?.playVideo?.();
              setIsPlaying(true);
            }, delayMs);
            return;
          }

          const elapsedSec = Math.max(0, (serverNow - refTimestamp) / 1000);
          adjustedSeek += elapsedSec;
        }

        // If this is a fresh Listen Together trigger with basePositionSec === 0 and scheduled startAtServerTime,
        // it must start from 0:00 across all users—EVEN IF that exact same song was already playing!
        const isFreshTriggerFromZero = data.basePositionSec === 0 && Boolean(data.startAtServerTime);

        if (curId !== targetId) {
          playSong(targetTrack);
          // Apply current timestamp seek so user starts right at live position, NEVER 0:00 (for mid-session/late joins)
          if (adjustedSeek > 0.05) {
            setTimeout(() => {
              handleSeek(adjustedSeek);
            }, 300);
            setTimeout(() => {
              handleSeek(adjustedSeek + 0.15);
            }, 700);
          }
        } else if (isFreshTriggerFromZero) {
          // Same song re-triggered via Listen Together: immediately rewind to 0:00
          handleSeek(0);
        } else {
          // Tight ~30-40ms Drift Correction: Seek if drift exceeds 35ms (0.035s)
          const curTime = currentTimeRef.current || 0;
          const drift = Math.abs(curTime - adjustedSeek);
          const nowMs = Date.now();
          if (drift > 0.035 && nowMs - (lastSyncCorrectionTimeRef.current || 0) > 800) {
            lastSyncCorrectionTimeRef.current = nowMs;
            handleSeek(adjustedSeek);
          }
        }

        if (data.isPlaying === false) {
          if (playbackScheduledTimerRef.current) clearTimeout(playbackScheduledTimerRef.current);
          playerRef.current?.pauseVideo?.();
          setIsPlaying(false);
        } else if (data.isPlaying === true && !isPlaying) {
          playerRef.current?.playVideo?.();
          setIsPlaying(true);
        }
      }
    };
    socket.on('room:playback:sync', handleRoomPlaybackSyncEvent);
    socket.on('room:playback:start', handleRoomPlaybackSyncEvent);
    socket.on('room:playback:prepare', handleRoomPlaybackPrepareEvent);

    const handleSocketConnect = () => {
      setIsLiveCountStale(false);
      const curToken = getTabAuthToken();
      if (curToken) {
        socket.emit('authenticate', { token: curToken, sessionId: getOrCreateSessionId() });
      }
      syncLiveUsersCount();
    };

    const handleSocketDisconnect = () => {
      setIsLiveCountStale(true);
    };

    socket.on('connect', handleSocketConnect);
    socket.on('disconnect', handleSocketDisconnect);

    return () => {
      clearInterval(clockInterval);
      clearInterval(clockSyncInterval);
      if (playbackScheduledTimerRef.current) clearTimeout(playbackScheduledTimerRef.current);
      socket.off('active_users', handleActiveUsersUpdate);
      socket.off('room:playback:sync', handleRoomPlaybackSyncEvent);
      socket.off('room:playback:start', handleRoomPlaybackSyncEvent);
      socket.off('room:playback:prepare', handleRoomPlaybackPrepareEvent);
      socket.off('connect', handleSocketConnect);
      socket.off('disconnect', handleSocketDisconnect);
    };
  }, []);
  const ytReadyCallbacksRef = useRef([]);

  // On-demand YouTube IFrame API script loader (never blocks initial render)
  const ensureYouTubeIframeApi = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.YT && window.YT.Player) return;

    const runReadyCallbacks = () => {
      while (ytReadyCallbacksRef.current.length > 0) {
        const cb = ytReadyCallbacksRef.current.shift();
        try {
          if (typeof cb === 'function') cb();
        } catch (e) {
          console.warn('[Loopra YT API] Callback execution error:', e);
        }
      }
    };

    if (!window.onYouTubeIframeAPIReady) {
      window.onYouTubeIframeAPIReady = () => {
        runReadyCallbacks();
      };
    } else {
      const existingReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { existingReady(); } catch (_) {}
        runReadyCallbacks();
      };
    }

    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }
  }, []);
  const handleCloseVideo = useCallback(() => {
    setVideoModalSong(null);
    setIsPipActive(false);
  }, []);

  const handleOpenVideo = (song, e) => {
    if (e) e.stopPropagation();
    if (!song) {
      showToast('No track selected');
      return;
    }
    const vidId = song.id || song.videoId;
    if (!vidId || typeof vidId !== 'string' || vidId.length < 5) {
      showToast('Video is currently unavailable for this track');
      return;
    }

    const songWithId = { ...song, id: vidId, videoId: vidId };
    const isMatchingCurrent = currentSong && (currentSong.id === vidId || currentSong.videoId === vidId);

    setVideoModalSong(songWithId);
    setIsPipActive(false);
    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
      window.history.pushState({ loopraGuard: true }, '');
    }

    if (!isMatchingCurrent) {
      if (typeof playSongRef.current === 'function') {
        playSongRef.current(songWithId);
      }
    } else {
      // Direct switch between Music Mode and Video Mode for the currently playing track:
      // Keep the YouTube player instance playing uninterrupted with 0ms lag!
      try {
        if (playerRef.current && typeof playerRef.current.playVideo === 'function' && isPlaying) {
          playerRef.current.playVideo();
        }
      } catch (_) {}
    }
  };

  const playSong = useCallback((song, options = {}) => {
    if (!song) return;
    const targetVideoId = song.id || song.videoId;

    // STEP 1: Immediate Offline Cache Check
    // If the song exists in IndexedDB (LoopraOfflineCacheDB), play the exact audio blob with ZERO internet
    getCachedAudioFromDB(targetVideoId).then(cachedRecord => {
      if (cachedRecord && cachedRecord.audioBlob && cachedRecord.audioBlob.size > 50000) {
        isInitialMountRef.current = false;
        isUserPausedRef.current = false;
        userIntentPlayingRef.current = true;
        setVideoModalSong(null);

        // 1. Immediately pause and stop YouTube IFrame player to prevent audio overlap
        try {
          if (playerRef.current && typeof playerRef.current.pauseVideo === 'function' && !playerRef.current.isOffline) {
            playerRef.current.pauseVideo();
          }
          if (playerRef.current && typeof playerRef.current.stopVideo === 'function' && !playerRef.current.isOffline) {
            playerRef.current.stopVideo();
          }
        } catch (_) {}

        // 2. Clean up any previous object URLs or radio streams
        if (activeObjectUrlRef.current) {
          try { URL.revokeObjectURL(activeObjectUrlRef.current); } catch (_) {}
          activeObjectUrlRef.current = null;
        }
        if (radioAudioRef.current) {
          try {
            radioAudioRef.current.pause();
            radioAudioRef.current.removeAttribute('src');
            radioAudioRef.current.load();
          } catch (_) {}
        }
        if (hlsRef.current) {
          try { hlsRef.current.destroy(); } catch (_) {}
          hlsRef.current = null;
        }

        // 3. Create fresh blob URL and load into HTML5 audio player
        const blobUrl = URL.createObjectURL(cachedRecord.audioBlob);
        activeObjectUrlRef.current = blobUrl;

        if (!offlineAudioRef.current) {
          offlineAudioRef.current = new Audio();
        }
        const audio = offlineAudioRef.current;
        audio.src = blobUrl;
        audio.volume = volume / 100;

        // 4. Bind event listeners
        audio.onplay = () => {
          setIsPlaying(true);
          setIsAutoplayBlocked(false);
          isInitialMountRef.current = false;
          updateMediaSessionImmediate(currentSong, true);
        };
        audio.onpause = () => {
          setIsPlaying(false);
          updateMediaSessionImmediate(currentSong, false);
        };
        audio.onerror = (e) => {
          console.warn('[OfflinePlay] Audio element error:', e);
          setIsPlaying(false);
          setIsAutoplayBlocked(true);
          showToast('Audio playback interrupted by device policy. Tap to resume.');
        };
        audio.onloadedmetadata = () => {
          if (audio.duration) {
            durationRef.current = audio.duration;
          }
        };
        audio.ontimeupdate = () => {
          currentTimeRef.current = audio.currentTime;
          if (crossfadeDuration > 0 && audio.duration > 0) {
            const remaining = audio.duration - audio.currentTime;
            if (remaining <= crossfadeDuration && remaining > 0) {
              const fadeRatio = Math.max(0, remaining / crossfadeDuration);
              audio.volume = (volume / 100) * fadeRatio;
            } else if (remaining > crossfadeDuration && audio.volume !== volume / 100) {
              audio.volume = volume / 100;
            }
          }
        };
        audio.onended = () => {
          const currentRepeat = isRepeatRef.current;
          if (currentRepeat === 'one' || currentRepeat === true) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
          } else {
            handleTrackEndedRef.current?.();
          }
        };

        // 5. Connect playerRef adapter for UI controls, seek bar, and turntable
        playerRef.current = {
          isOffline: true,
          getCurrentTime: () => offlineAudioRef.current ? offlineAudioRef.current.currentTime : 0,
          getDuration: () => offlineAudioRef.current ? (offlineAudioRef.current.duration || 0) : 0,
          seekTo: (sec) => { if (offlineAudioRef.current) offlineAudioRef.current.currentTime = sec; },
          playVideo: () => {
            if (!offlineAudioRef.current) return Promise.resolve();
            return offlineAudioRef.current.play().catch(() => {});
          },
          pauseVideo: () => {
            if (offlineAudioRef.current) {
              try { offlineAudioRef.current.pause(); } catch (_) {}
            }
          },
          stopVideo: () => {
            if (offlineAudioRef.current) {
              try {
                offlineAudioRef.current.pause();
                offlineAudioRef.current.currentTime = 0;
              } catch (_) {}
            }
          },
          setVolume: (vol) => {
            if (offlineAudioRef.current) offlineAudioRef.current.volume = vol / 100;
          },
          destroy: () => {
            if (offlineAudioRef.current) {
              try {
                offlineAudioRef.current.pause();
                offlineAudioRef.current.src = '';
              } catch (_) {}
            }
          }
        };

        setCurrentSong({ ...song, ...cachedRecord, isOffline: true });
        loadedVideoIdRef.current = targetVideoId;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(e => {
            if (e?.name === 'NotAllowedError') {
              console.warn('[OfflinePlay] Autoplay blocked by WebView policy:', e);
              setIsAutoplayBlocked(true);
              setIsPlaying(false);
            } else if (e?.name !== 'AbortError') {
              console.warn('[OfflinePlay] Audio play error:', e);
            }
          });
        }
        setIsPlaying(true);
        return;
      }

      // If not cached, proceed with normal execution
      proceedWithPlayback();
    }).catch(() => {
      proceedWithPlayback();
    });

    const proceedWithPlayback = () => {
      // Inner executor: runs only once track is verified through Layer 4 gate
      const executeVerifiedPlayback = () => {
      isInitialMountRef.current = false;
      setIsAutoplayBlocked(false);
      isUserPausedRef.current = false;
      userIntentPlayingRef.current = true;
      setVideoModalSong(prev => (prev ? song : null));
      updateMediaSessionImmediate(song, true);
      startPwaAudioWakeLock();
      if (silentAudioRef.current) {
        try { silentAudioRef.current.volume = 0.01; } catch (_) {}
        silentAudioRef.current.play().catch(() => {});
      }

      if (currentSong?.id === song.id) {
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
          try {
            const p = playerRef.current.playVideo();
            if (p && typeof p.catch === 'function') {
              p.catch(err => {
                if (err?.name === 'NotAllowedError') {
                  console.warn('[Loopra Player] Re-play blocked by browser policy:', err);
                  setIsAutoplayBlocked(true);
                  setIsPlaying(false);
                }
              });
            }
          } catch (e) {}
        }
        if (!song?.isRadio) {
          setIsPlaying(true);
        }
        return;
      }

      try {
        localStorage.setItem('afterhours_current_time', '0');
      } catch (e) {}

      // Explicitly pause and clean up previous radio or offline audio to avoid audio overlap
      if (radioAudioRef.current) {
        try {
          radioAudioRef.current.pause();
          radioAudioRef.current.removeAttribute('src');
          radioAudioRef.current.load();
        } catch (e) {}
      }
      if (offlineAudioRef.current) {
        try {
          offlineAudioRef.current.pause();
          offlineAudioRef.current.src = '';
        } catch (e) {}
      }
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch (e) {}
        hlsRef.current = null;
      }

      if (playerRef.current && isPlayerReadyRef.current && typeof playerRef.current.stopVideo === 'function') {
        try { playerRef.current.stopVideo(); } catch (e) {}
      }

      // Immediately start playback without waiting for delayed re-renders
      if (playerRef.current && isPlayerReadyRef.current && typeof playerRef.current.loadVideoById === 'function' && !playerRef.current.isOffline && !song?.isRadio && targetVideoId) {
        try {
          // Resolution configuration: Preserve manual quality selection in session or default to 144p ('tiny')
          const sessionQuality = (typeof window !== 'undefined' && window.sessionStorage?.getItem('loopra_user_selected_quality')) || 'tiny';
          playerRef.current.loadVideoById({ videoId: targetVideoId, suggestedQuality: sessionQuality });
          if (typeof playerRef.current.setPlaybackQuality === 'function') {
            try { playerRef.current.setPlaybackQuality(sessionQuality); } catch (_) {}
          }
          const p = playerRef.current.playVideo();
          if (p && typeof p.catch === 'function') {
            p.catch(err => {
              if (err?.name === 'NotAllowedError') {
                console.warn('[Loopra Player] Autoplay blocked:', err);
                setIsAutoplayBlocked(true);
                setIsPlaying(false);
              }
            });
          }
          loadedVideoIdRef.current = targetVideoId;
        } catch (err) {}
      }

      // Flush outgoing track listening duration before switching sessions to preserve every listened second
      if (currentSongRef.current && activeListeningDurationRef.current > 0 && playSessionIdRef.current && authToken) {
        const outgoingSong = currentSongRef.current;
        const outgoingListened = activeListeningDurationRef.current;
        const outgoingTotalDur = durationRef.current || 200;
        const outgoingPct = Math.min(100, Math.round((outgoingListened / outgoingTotalDur) * 100));

        recommendationsClient.logListeningEvent(BACKEND_URL, authToken, {
          trackId: outgoingSong.id || outgoingSong.videoId,
          title: outgoingSong.title,
          artist: outgoingSong.artist || outgoingSong.channel || 'Unknown Artist',
          channel: outgoingSong.channel || '',
          thumbnail: outgoingSong.thumbnail || outgoingSong.image || '',
          eventType: 'track_change',
          duration: outgoingTotalDur,
          listenedDuration: outgoingListened,
          completionPercent: outgoingPct,
          playSessionId: playSessionIdRef.current,
          source: activeTab || 'player'
        });

        listeningStatsService.recordEvent?.({
          backendUrl: BACKEND_URL,
          token: authToken,
          user,
          track: outgoingSong,
          eventType: 'track_change',
          duration: outgoingTotalDur,
          listenedDuration: outgoingListened,
          playSessionId: playSessionIdRef.current,
          completed: false
        });
      }

      playSessionIdRef.current = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      activeListeningDurationRef.current = 0;
      lastSyncedDurationRef.current = 0;
      hasLoggedListenForCurrentSongRef.current = false;

      // Update Playback History stack (record previous song if different)
      if (currentSongRef.current && song) {
        const prevId = currentSongRef.current.id || currentSongRef.current.videoId;
        const newId = song.id || song.videoId;
        if (prevId && prevId !== newId) {
          playbackHistoryStackRef.current = [
            currentSongRef.current,
            ...playbackHistoryStackRef.current.filter(s => (s.id || s.videoId) !== prevId)
          ].slice(0, 50);
        }
      }
      consecutiveErrorSkipCountRef.current = 0;

      setCurrentSong(song);
      trackPlaybackStartTimeRef.current = Date.now();
      hasLoggedCompletionRef.current = false;

      // Trigger background prefetch of Smart Queue recommendations for continuous listening
      if (song && !song.isRadio) {
        prefetchSmartQueue(song).catch(() => {});

        // Single-request 100+ song AI seeding per user profile (by category & genre)
        const currentGenre = song.genre || song.category || 'bollywood';
        const currentCat = activeTab || 'player';
        const genreKey = `${currentCat}_${currentGenre}`.toLowerCase();
        const hasEnoughSeeds = aiSeededTracksRef.current && aiSeededTracksRef.current.length >= 100;
        const isSameGenre = lastSeededGenreKeyRef.current === genreKey;

        if ((!hasEnoughSeeds || !isSameGenre) && !isSeedingAiTracksRef.current) {
          isSeedingAiTracksRef.current = true;
          lastSeededGenreKeyRef.current = genreKey;
          learningIntelligenceClient.seedUserTracks(BACKEND_URL, authToken, {
            category: currentCat,
            genre: currentGenre,
            currentTrack: song,
            forceRefresh: false
          }).then(res => {
            if (res?.success && Array.isArray(res.tracks) && res.tracks.length > 0) {
              setAiSeededTracks(res.tracks);
              aiSeededTracksRef.current = res.tracks;
              aiSeededIndexRef.current = 0;
            }
          }).catch(err => {
            console.warn('[AI Seeding] Notice on single-request seeding:', err?.message);
          }).finally(() => {
            isSeedingAiTracksRef.current = false;
          });
        }
      }

      if (song) {
        const songId = song.id || song.videoId;
        const nowMs = Date.now();
        const isSameTickDup = lastHistoryLogRef.current.trackId === songId && (nowMs - lastHistoryLogRef.current.time) < 1500;
        if (!isSameTickDup) {
          lastHistoryLogRef.current = { trackId: songId, time: nowMs };
          setHistory(prev => [song, ...prev.filter(s => (s.id || s.videoId) !== songId)].slice(0, 50));

          recommendationsClient.logListeningEvent(BACKEND_URL, authToken, {
            trackId: songId,
            title: song.title,
            artist: song.artist || song.channel || 'Unknown Artist',
            channel: song.channel || '',
            thumbnail: song.thumbnail || song.image || '',
            eventType: 'play_start',
            duration: 0,
            listenedDuration: 0,
            completionPercent: 0,
            playSessionId: playSessionIdRef.current,
            source: activeTab || 'player'
          });
          listeningStatsService.recordEvent?.({
            backendUrl: BACKEND_URL,
            token: authToken,
            user,
            track: song,
            eventType: 'play_start',
            duration: 0,
            listenedDuration: 0,
            playbackPosition: 0,
            playSessionId: playSessionIdRef.current,
            completed: false
          });
        }
      }

      if (!song?.isRadio) {
        setIsPlaying(true);
      }

      try {
        fetch(getApiUrl('/api/admin/telemetry/event'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'play_start', trackId: song?.id, title: song?.title })
        }).catch(() => {});
      } catch (e) {}

      if (['home', 'barber', 'truck', 'pauwa'].includes(activeTab)) {
        const station = stationsMap[activeTab] || SPECIAL_STATIONS[activeTab];
        if (station && station.bgImages && station.bgImages.length > 0) {
          setCurrentBgIndex(prev => (prev + 1) % station.bgImages.length);
        }
      }
    };

    // Execute playback instantly for immediate UI and audio response without 2-3 second latency
    executeVerifiedPlayback();

    // Broadcast track play event to Room members if Listen Together is ON
    if (!options?.fromRoomSync) {
      broadcastPlaybackToRoom(song, true, 0, true);
    }

    // Background validation (non-blocking) for unknown external video playback
    if (!song?.isRadio && !song?.streamUrl && !song?.isInternalAudio && !song?.isOffline && !song?.audioBlob && targetVideoId) {
      offlineStorageService.isTrackDownloaded(targetVideoId).then(isCached => {
        if (!isCached) {
          validatePlaybackTrack(song, BACKEND_URL)
            .then(validation => {
              if (!validation.eligible) {
                console.warn('[PlaybackGate] Non-music track detected post-playback:', targetVideoId, validation.reason);
                showToast?.(`Playback note: Video may not be official music (${validation.reason})`, 'warning');
              }
            })
            .catch(() => {});
        }
      }).catch(() => {});
    }
  };
}, [activeTab, currentSong, stationsMap, authToken, showToast, BACKEND_URL, user, broadcastPlaybackToRoom]);

  const handleNextSong = useCallback(async () => {
    // Log skip or completed listen signal for AI recommendations and listening insights
    if (trackPlaybackStartTimeRef.current && currentSongRef.current && !hasLoggedCompletionRef.current) {
      // Use genuine active listened seconds (ignoring paused time / sleep / background freeze)
      const elapsedSec = activeListeningDurationRef.current;
      const totalDur = durationRef.current || 200;
      const pct = Math.min(100, Math.round((elapsedSec / totalDur) * 100));

      if (elapsedSec < 15) {
        if (authToken) {
          recommendationsClient.logListeningEvent(BACKEND_URL, authToken, {
            trackId: currentSongRef.current.id || currentSongRef.current.videoId,
            title: currentSongRef.current.title,
            artist: currentSongRef.current.artist || currentSongRef.current.channel,
            thumbnail: currentSongRef.current.thumbnail,
            eventType: 'skip',
            duration: totalDur,
            listenedDuration: elapsedSec,
            completionPercent: pct,
            playSessionId: playSessionIdRef.current,
            source: activeTab || 'player'
          });
        }
        listeningStatsService.recordEvent?.({
          backendUrl: BACKEND_URL,
          token: authToken,
          user,
          track: currentSongRef.current,
          eventType: 'skip',
          duration: totalDur,
          listenedDuration: elapsedSec,
          playSessionId: playSessionIdRef.current,
          source: activeTab || 'player'
        });
      } else if (elapsedSec >= 30 || pct >= 50) {
        if (authToken) {
          recommendationsClient.logListeningEvent(BACKEND_URL, authToken, {
            trackId: currentSongRef.current.id || currentSongRef.current.videoId,
            title: currentSongRef.current.title,
            artist: currentSongRef.current.artist || currentSongRef.current.channel,
            thumbnail: currentSongRef.current.thumbnail,
            eventType: 'completed',
            duration: totalDur,
            listenedDuration: elapsedSec,
            completionPercent: pct,
            playSessionId: playSessionIdRef.current,
            source: activeTab || 'player'
          });
        }
        listeningStatsService.recordEvent?.({
          backendUrl: BACKEND_URL,
          token: authToken,
          user,
          track: currentSongRef.current,
          eventType: 'completed',
          duration: totalDur,
          listenedDuration: elapsedSec,
          playSessionId: playSessionIdRef.current,
          source: activeTab || 'player'
        });
        hasLoggedCompletionRef.current = true;
      }
    }

    if (isRepeat === 'one') {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(0, true);
      }
      currentTimeRef.current = 0;
      if (!isPlaying) {
        try {
          const p = playerRef.current?.playVideo?.();
          if (p && typeof p.catch === 'function') {
            p.catch(err => {
              if (err?.name === 'NotAllowedError') {
                console.warn('[Loopra Player] Explicit togglePlay blocked by policy:', err);
                setIsAutoplayBlocked(true);
                setIsPlaying(false);
              }
            });
          }
        } catch (e) {}
        setIsPlaying(true);
      }
      return;
    }

    if (isShuffle) {
      const nextShuffleTrack = shuffleService.getNextTrack(currentSong?.id);
      if (nextShuffleTrack) {
        playSong(nextShuffleTrack);
        return;
      }
      const pool = (queueRef.current && queueRef.current.length > 0) ? queueRef.current : (smartQueueRef.current && smartQueueRef.current.length > 0 ? smartQueueRef.current : (trendingSongs || []));
      if (pool.length > 0) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        playSong(pool[randomIndex]);
        return;
      }
    }

    const currentId = currentSongRef.current?.id || currentSongRef.current?.videoId || currentSong?.id || currentSong?.videoId;
    const currentQ = queueRef.current || [];
    const isAutoplay = isContinuousListeningRef.current;

    // 1. Remove played track from queue automatically on track advance / completion
    let remainingQueue = [...currentQ];
    if (currentId) {
      const finishedIndex = remainingQueue.findIndex(s => (s.id || s.videoId) === currentId);
      if (finishedIndex !== -1) {
        remainingQueue.splice(finishedIndex, 1);
        setQueue(remainingQueue);
        queueRef.current = remainingQueue;
      }
    }

    // =========================================================================
    // EXACT NEXT-TRACK FALLBACK PRIORITY ORDER:
    // 1) Manual Queue (songs manually added to queue by the user)
    // 2) Smart Queue (when Autoplay is ON and smart queue items exist)
    // 3) Current Opened Playlist (tracks from the playlist the user opened and played from)
    // 4) User's Persisted AI Seeded Tracks (cycling through 100+ varied tracks, no repeating small loop)
    // =========================================================================

    // 1) MANUAL QUEUE PRIORITY
    if (remainingQueue.length > 0) {
      const nextTrack = remainingQueue[0];
      playSong(nextTrack);
      if (remainingQueue.length <= 2) {
        prefetchSmartQueue(nextTrack).catch(() => {});
      }
      return;
    }

    // 2) SMART QUEUE PRIORITY (When Autoplay is ON)
    if (isAutoplay) {
      const currentSmartQ = smartQueueRef.current || [];
      const smartCandidates = currentSmartQ.length > 0
        ? currentSmartQ
        : (currentSuggestionsRef.current || []);

      const nextSmartTrack = smartCandidates.find(s => {
        const sid = s.id || s.videoId;
        return sid && sid !== currentId;
      });

      if (nextSmartTrack) {
        const nextList = smartCandidates.filter(s => (s.id || s.videoId) !== (nextSmartTrack.id || nextSmartTrack.videoId));
        setSmartQueue(nextList);
        smartQueueRef.current = nextList;
        currentSuggestionsRef.current = nextList;

        playSong(nextSmartTrack);

        if (nextList.length <= 3) {
          prefetchSmartQueue(nextSmartTrack, true).catch(() => {});
        }
        return;
      }

      // If smartQueue is temporarily empty, try quick smartQueue prefetch
      const baseForRecs = currentSongRef.current || currentSong;
      if (baseForRecs) {
        try {
          const recData = await smartQueueService.fetchRecommendations(baseForRecs, { forceRefresh: true });
          const recItems = recData.items || [];
          const deduplicated = smartQueueService.deduplicateAgainstContext(recItems, {
            currentSong: baseForRecs,
            manualQueue: [],
            history: playbackHistoryStackRef.current
          });

          if (deduplicated.length > 0) {
            const firstTrack = deduplicated[0];
            const remainingTracks = deduplicated.slice(1);
            setSmartQueue(remainingTracks);
            smartQueueRef.current = remainingTracks;
            currentSuggestionsRef.current = remainingTracks;
            playSong(firstTrack);
            return;
          }
        } catch (fetchErr) {
          console.warn('[SmartQueue] Autoplay fetch failed:', fetchErr);
        }
      }
    }

    // 3) CURRENT OPENED PLAYLIST PRIORITY
    const openedPlaylist = selectedPlaylistForViewRef.current;
    if (openedPlaylist && Array.isArray(openedPlaylist.songs) && openedPlaylist.songs.length > 0) {
      const playlistSongs = openedPlaylist.songs;
      const curIndex = playlistSongs.findIndex(s => (s.id || s.videoId) === currentId);

      if (curIndex !== -1 && curIndex + 1 < playlistSongs.length) {
        const nextPlaylistTrack = playlistSongs[curIndex + 1];
        if (nextPlaylistTrack) {
          playSong(nextPlaylistTrack);
          return;
        }
      } else if (curIndex !== -1 && curIndex + 1 >= playlistSongs.length && isRepeat === 'all') {
        const loopTrack = playlistSongs[0];
        if (loopTrack) {
          playSong(loopTrack);
          return;
        }
      } else if (curIndex === -1) {
        const firstPlaylistTrack = playlistSongs.find(s => (s.id || s.videoId) !== currentId) || playlistSongs[0];
        if (firstPlaylistTrack) {
          playSong(firstPlaylistTrack);
          return;
        }
      }
    }

    // Repeat 'all' support from playback history if neither queue nor playlist loop handled it
    if (isRepeat === 'all') {
      if (playbackHistoryStackRef.current.length > 0) {
        const oldestTrack = playbackHistoryStackRef.current[playbackHistoryStackRef.current.length - 1];
        if (oldestTrack) {
          playSong(oldestTrack);
          return;
        }
      }
    }

    // 4) USER'S PERSISTED AI SEEDED TRACKS (100+ tracks cycling pool)
    const seededPool = aiSeededTracksRef.current || [];
    if (seededPool.length > 0) {
      const recentHistoryIds = new Set((playbackHistoryStackRef.current || []).map(s => s.id || s.videoId));
      if (currentId) recentHistoryIds.add(currentId);

      let chosenTrack = null;
      const poolLen = seededPool.length;
      let startIdx = aiSeededIndexRef.current || 0;

      // Scan starting from aiSeededIndexRef to guarantee cycling across all 100+ songs
      for (let i = 0; i < poolLen; i++) {
        const checkIdx = (startIdx + i) % poolLen;
        const candidate = seededPool[checkIdx];
        const candId = candidate?.id || candidate?.videoId;
        if (candId && !recentHistoryIds.has(candId)) {
          chosenTrack = candidate;
          aiSeededIndexRef.current = (checkIdx + 1) % poolLen;
          break;
        }
      }

      // If all tracks are in recent history, advance circular index and play next different song
      if (!chosenTrack) {
        for (let i = 0; i < poolLen; i++) {
          const checkIdx = (startIdx + i) % poolLen;
          const candidate = seededPool[checkIdx];
          const candId = candidate?.id || candidate?.videoId;
          if (candId && candId !== currentId) {
            chosenTrack = candidate;
            aiSeededIndexRef.current = (checkIdx + 1) % poolLen;
            break;
          }
        }
      }

      if (chosenTrack) {
        playSong(chosenTrack);
        return;
      }
    }

    // Continuous listening final fallback to trending songs if available
    if (isContinuousListeningRef.current && trendingSongs && trendingSongs.length > 0) {
      const nextFallback = trendingSongs.find(s => (s.id || s.videoId) !== currentId) || trendingSongs[0];
      playSong(nextFallback);
      return;
    }

    // If continuous listening is disabled and all queues/playlists ended, stop playback cleanly
    setIsPlaying(false);
    try { playerRef.current?.pauseVideo?.(); } catch (e) {}
    showToast('Queue ended');
  }, [queue, smartQueue, trendingSongs, isShuffle, isRepeat, currentSong, isPlaying, playSong, prefetchSmartQueue, showToast]);

  useEffect(() => {
    handleNextSongRef.current = handleNextSong;
  }, [handleNextSong]);

  const handleTrackEnded = useCallback(() => {
    const activeSong = currentSongRef.current;
    const activeId = activeSong?.id || activeSong?.videoId || 'unknown';
    const now = Date.now();

    // Prevent duplicate onEnded triggers within 1500ms for the same track
    if (lastEndedTrackIdRef.current === activeId && now - lastEndedTimestampRef.current < 1500) {
      return;
    }
    lastEndedTrackIdRef.current = activeId;
    lastEndedTimestampRef.current = now;

    handleNextSongRef.current?.();
  }, []);
  const handleTrackEndedRef = useRef(handleTrackEnded);
  useEffect(() => {
    handleTrackEndedRef.current = handleTrackEnded;
  }, [handleTrackEnded]);

  // Preload next track metadata / image / stream cache at 80% mark or when queue is low
  useEffect(() => {
    const handlePreloadEvent = () => {
      let nextTrack = null;
      if (isShuffle) {
        nextTrack = shuffleService.getNextTrack(currentSong?.id);
      } else {
        const currentId = currentSong?.id || currentSong?.videoId;
        if (queue && queue.length > 0) {
          const currentIndex = queue.findIndex(s => (s.id || s.videoId) === currentId);
          if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
            nextTrack = queue[currentIndex + 1];
          } else if (smartQueue && smartQueue.length > 0) {
            nextTrack = smartQueue[0];
          }
        } else if (smartQueue && smartQueue.length > 0) {
          nextTrack = smartQueue[0];
        } else if (trendingSongs && trendingSongs.length > 0) {
          nextTrack = trendingSongs[0];
        }
      }

      if (nextTrack) {
        const nextId = nextTrack.id || nextTrack.videoId;
        // Pre-warm thumbnail image cache
        const thumbUrl = getCleanThumbnail(nextTrack);
        if (thumbUrl) {
          const img = new Image();
          img.src = thumbUrl;
        }
        // Pre-warm DNS / connection for YouTube stream
        if (nextId) {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = `https://i.ytimg.com/vi/${nextId}/hqdefault.jpg`;
          document.head.appendChild(link);
        }
      }

      // Proactively prefetch smart queue if queue is running low
      if (currentSong && (!smartQueue || smartQueue.length < 3)) {
        prefetchSmartQueue(currentSong).catch(() => {});
      }
    };

    window.addEventListener('loopra:preload-next-track', handlePreloadEvent);
    return () => window.removeEventListener('loopra:preload-next-track', handlePreloadEvent);
  }, [queue, smartQueue, trendingSongs, isShuffle, currentSong, prefetchSmartQueue]);

  const handlePrevSong = useCallback(() => {
    let currentPos = currentTimeRef.current;
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      try {
        const livePos = playerRef.current.getCurrentTime();
        if (typeof livePos === 'number' && !isNaN(livePos)) {
          currentPos = livePos;
        }
      } catch (e) {}
    }

    // Spotify rule: If played > 3s, restart current track
    if (currentPos > 3) {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(0, true);
      }
      currentTimeRef.current = 0;
      if (!isPlaying) {
        try {
          const p = playerRef.current?.playVideo?.();
          if (p && typeof p.catch === 'function') {
            p.catch(err => {
              if (err?.name === 'NotAllowedError') {
                console.warn('[Loopra Player] Explicit togglePlay blocked by policy:', err);
                setIsAutoplayBlocked(true);
                setIsPlaying(false);
              }
            });
          }
        } catch (e) {}
        setIsPlaying(true);
      }
      return;
    }

    if (isShuffle) {
      const prevShuffleTrack = shuffleService.getPrevTrack(currentSong?.id);
      if (prevShuffleTrack) {
        playSong(prevShuffleTrack);
        return;
      }
    }

    // Spotify rule: If played <= 3s, step backwards into actual played history stack
    if (playbackHistoryStackRef.current.length > 0) {
      const prevSong = playbackHistoryStackRef.current.shift();
      if (prevSong && (prevSong.id || prevSong.videoId) !== (currentSong?.id || currentSong?.videoId)) {
        playSong(prevSong);
        return;
      }
    }

    // Fallback: previous item in manual queue
    if (queue && queue.length > 0) {
      const currentId = currentSong?.id || currentSong?.videoId;
      const currentIndex = queue.findIndex(s => (s.id || s.videoId) === currentId);
      if (currentIndex > 0) {
        playSong(queue[currentIndex - 1]);
        return;
      }
    }

    // If no previous history or queue item, restart from 0
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(0, true);
    }
    currentTimeRef.current = 0;
  }, [queue, currentSong, isPlaying, isShuffle, playSong]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle(prev => {
      const next = !prev;
      if (next) {
        const seedPool = [...(queue || []), ...(trendingSongs || []), ...(TRENDING_SONGS || [])];
        shuffleService.initShufflePool(seedPool).then(() => {
          shuffleService.reshufflePool(currentSong?.id);
        }).catch(() => {});
      }
      return next;
    });
  }, [queue, trendingSongs, currentSong]);

  useEffect(() => {
    shuffleService.initShufflePool([...(trendingSongs || []), ...(TRENDING_SONGS || [])]).catch(() => {});
  }, [trendingSongs]);

  const handleFetchDiscoveryTracks = useCallback(async () => {
    try {
      // Personalized Swipe Curation: 60% user favorites/genres + 30% adjacent solo hits + 10% fresh discoveries
      const curated = await curateSwipeDeck({
        fetchFromBackend,
        likedSongs,
        history,
        trendingSongs,
        targetCount: 20
      });
      if (curated && curated.length > 0) {
        return curated;
      }
      return filterStrictSoloTracks([...(trendingSongs || []), ...(TRENDING_SONGS || [])]);
    } catch (e) {
      return filterStrictSoloTracks([...(trendingSongs || []), ...(TRENDING_SONGS || [])]);
    }
  }, [likedSongs, history, trendingSongs]);

  const handleSeek = useCallback((seekTime) => {
    currentTimeRef.current = seekTime;
    try {
      localStorage.setItem('afterhours_current_time', seekTime.toString());
    } catch (e) {}
    playerRef.current?.seekTo?.(seekTime, true);
    // Broadcast seek position to Room members if Listen Together is ON
    broadcastPlaybackToRoom(currentSong, isPlaying, seekTime);
  }, [broadcastPlaybackToRoom, currentSong, isPlaying]);

  const toggleRepeatMode = () => {
    if (isRepeat === false || isRepeat === 'off') {
      setIsRepeat('all');
    } else if (isRepeat === 'all') {
      setIsRepeat('one');
    } else {
      setIsRepeat(false);
    }
  };

  // Helper: Safely synchronize mediaSession positionState with bounds checking
  const syncMediaSessionPositionState = useCallback((pos, dur, rate = 1.0) => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    if (typeof navigator.mediaSession.setPositionState !== 'function') return;
    const duration = typeof dur === 'number' && !isNaN(dur) ? dur : (durationRef.current || 0);
    const position = typeof pos === 'number' && !isNaN(pos) ? pos : (currentTimeRef.current || 0);
    if (duration > 0 && isFinite(duration) && isFinite(position)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
          playbackRate: typeof rate === 'number' && rate > 0 ? rate : 1.0,
          position: Math.min(Math.max(0, duration), Math.max(0, position))
        });
      } catch (_) {}
    }
  }, []);

  // Helper: Synchronous & robust MediaSession updater to ensure immediate notification bar / lock-screen sync
  const updateMediaSessionImmediate = useCallback((track, playingState) => {
    if (typeof window === 'undefined' || !track) return;
    try {
      const { title: cleanTitle, artist: cleanArtist } = sanitizeTrackMetadata(
        track.title || 'Unknown Track',
        track.artist || track.channel || cmsConfig?.branding?.siteName || "Loopra Artist"
      );

      // 1. Android Native Background Audio Service / System Notification bridge sync
      if (window.LoopraAndroid) {
        try {
          if (typeof window.LoopraAndroid.updateTrackInfo === 'function') {
            window.LoopraAndroid.updateTrackInfo(cleanTitle, cleanArtist, Boolean(playingState));
          } else if (typeof window.LoopraAndroid.setPlaybackState === 'function') {
            window.LoopraAndroid.setPlaybackState(Boolean(playingState));
          }
        } catch (e) {
          console.warn('[LoopraAndroid] Bridge sync error:', e);
        }
      }

      // 2. Standard Web MediaSession API (Notification shade, lock screen, media control center)
      if ('mediaSession' in navigator) {
        const cleanArtworkList = getCleanMediaSessionArtwork(track);

        navigator.mediaSession.metadata = new MediaMetadata({
          title: cleanTitle,
          artist: cleanArtist,
          album: track.album || "Loopra",
          artwork: cleanArtworkList
        });

        navigator.mediaSession.playbackState = playingState ? 'playing' : 'paused';

        syncMediaSessionPositionState(currentTimeRef.current, durationRef.current, playingState ? 1.0 : 0.0);
      }
    } catch (err) {
      console.warn('[MediaSession] Error updating immediate metadata:', err);
    }
  }, [cmsConfig, syncMediaSessionPositionState]);

  // PWA & Standalone Web Audio Keep-Alive for OS Audio Focus Lock (Clean silent audio element preferred to avoid Web Audio buffer underruns & crackling)
  const startPwaAudioWakeLock = useCallback(() => {
    try {
      if (silentAudioRef.current && silentAudioRef.current.paused) {
        silentAudioRef.current.volume = 0.001;
        silentAudioRef.current.play().catch(() => {});
      }
    } catch (_) {}
  }, []);

  const stopPwaAudioWakeLock = useCallback(() => {
    try {
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
      }
    } catch (_) {}
  }, []);

  const toggleLikeRef = useRef(null);

  // Sync global playback flag to window for background visibility event interceptor
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__loopra_is_playing = isPlaying;
    }
  }, [isPlaying]);

  // MediaSession API Integration & Page Visibility lifecycle for background playback (Desktop & Android)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !currentSong) return;

    updateMediaSessionImmediate(currentSong, isPlaying);

    const safeSetAction = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (_) {}
    };

    // Standard playback actions
    safeSetAction('play', () => {
      isUserPausedRef.current = false;
      userIntentPlayingRef.current = true;
      startPwaAudioWakeLock();
      if (silentAudioRef.current) {
        try { silentAudioRef.current.volume = 0.01; } catch (_) {}
        silentAudioRef.current.play().catch(() => {});
      }
      try {
        const p = playerRef.current?.playVideo?.();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {}
      setIsPlaying(true);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      syncMediaSessionPositionState(currentTimeRef.current, durationRef.current, 1.0);
    });

    safeSetAction('pause', () => {
      isUserPausedRef.current = true;
      userIntentPlayingRef.current = false;
      stopPwaAudioWakeLock();
      if (autoResumeTimerRef.current) {
        clearTimeout(autoResumeTimerRef.current);
        autoResumeTimerRef.current = null;
      }
      if (isPlayerReadyRef.current || playerRef.current?.isOffline || playerRef.current?.isRadio) {
        playerRef.current?.pauseVideo?.();
      }
      if (silentAudioRef.current) silentAudioRef.current.pause();
      setIsPlaying(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      syncMediaSessionPositionState(currentTimeRef.current, durationRef.current, 0.0);
    });

    safeSetAction('previoustrack', () => {
      handlePrevSong?.();
    });

    safeSetAction('nexttrack', () => {
      handleNextSong?.();
    });

    safeSetAction('seekto', (details) => {
      if (details.seekTime !== undefined && !isNaN(details.seekTime)) {
        handleSeek(details.seekTime);
        syncMediaSessionPositionState(details.seekTime, durationRef.current, isPlaying ? 1.0 : 0.0);
      }
    });

    safeSetAction('seekbackward', (details) => {
      const skipTime = details?.seekOffset || 10;
      const cur = currentTimeRef.current || 0;
      const target = Math.max(0, cur - skipTime);
      handleSeek(target);
      syncMediaSessionPositionState(target, durationRef.current, isPlaying ? 1.0 : 0.0);
    });

    safeSetAction('seekforward', (details) => {
      const skipTime = details?.seekOffset || 10;
      const cur = currentTimeRef.current || 0;
      const dur = durationRef.current || 999999;
      const target = Math.min(dur, cur + skipTime);
      handleSeek(target);
      syncMediaSessionPositionState(target, durationRef.current, isPlaying ? 1.0 : 0.0);
    });

    safeSetAction('stop', () => {
      isUserPausedRef.current = true;
      userIntentPlayingRef.current = false;
      stopPwaAudioWakeLock();
      playerRef.current?.pauseVideo?.();
      if (silentAudioRef.current) silentAudioRef.current.pause();
      setIsPlaying(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    });

    // Optional like/favorite action for supported lock-screens / browsers
    safeSetAction('like', () => {
      if (currentSong) {
        toggleLikeRef.current?.(currentSong);
      }
    });

    // Ensure notification bar displays playbackState accurately on playback change
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }

    syncMediaSessionPositionState(currentTimeRef.current, durationRef.current, isPlaying ? 1.0 : 0.0);
  }, [currentSong, isPlaying, handlePrevSong, handleNextSong, handleSeek, updateMediaSessionImmediate, syncMediaSessionPositionState, startPwaAudioWakeLock, stopPwaAudioWakeLock]);

  // Periodic MediaSession live progress / seekbar sync: every 1s during active playback
  // Ensures Android 13+ MediaStyle live progress / squiggly seekbar and timestamps stay accurate
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !isPlaying || !currentSong) {
      return;
    }

    const intervalId = setInterval(() => {
      try {
        let cur = currentTimeRef.current || 0;
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const directCur = playerRef.current.getCurrentTime();
          if (typeof directCur === 'number' && !isNaN(directCur) && directCur >= 0) {
            cur = directCur;
            currentTimeRef.current = directCur;
          }
        }
        syncMediaSessionPositionState(cur, durationRef.current, 1.0);
      } catch (_) {}
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isPlaying, currentSong, syncMediaSessionPositionState]);

  // Page Visibility lifecycle: YouTube IFrame Anti-Suspend & Auto Picture-in-Picture on Minimize / Pagehide
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handlePageVisibilityChange = () => {
      if (document.hidden) {
        // Auto Picture-in-Picture trigger when minimizing the app
        if (isAutoPipEnabled && (isPlayingRef.current || userIntentPlayingRef.current)) {
          if (videoModalSongRef.current && !isPipActiveRef.current) {
            // Video Mode: trigger video element PiP
            const container = ytContainerRef.current;
            requestVideoPictureInPicture(container);
          } else if (currentSongRef.current) {
            // Audio Mode: trigger PiP canvas stream with mini-controller
            requestAudioPictureInPicture(currentSongRef.current, isPlayingRef.current);
          }
        }

        // If track is supposed to be playing, reinforce native audio keep-alive and run anti-suspend checks
        if (isPlayingRef.current || userIntentPlayingRef.current) {
          startPwaAudioWakeLock();
          if (silentAudioRef.current && silentAudioRef.current.paused) {
            try { silentAudioRef.current.volume = 0.01; } catch (_) {}
            silentAudioRef.current.play().catch(() => {});
          }

          // Rapid recovery checks (100ms, 300ms, 800ms) to counteract OS/browser YouTube iframe suspension
          [100, 300, 800].forEach((delay) => {
            setTimeout(() => {
              if (isPlayingRef.current || userIntentPlayingRef.current) {
                startPwaAudioWakeLock();
                if (silentAudioRef.current && silentAudioRef.current.paused) {
                  try { silentAudioRef.current.volume = 0.01; } catch (_) {}
                  silentAudioRef.current.play().catch(() => {});
                }
                if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
                  try {
                    const st = playerRef.current.getPlayerState();
                    // If browser forced YouTube into PAUSED (2) or CUED (5), immediately resume
                    if (st === 2 || st === 5) {
                      playerRef.current.playVideo();
                    }
                  } catch (_) {}
                }
              }
            }, delay);
          });
        }
      } else {
        // When tab becomes visible again, refresh positionState on mediaSession
        syncMediaSessionPositionState(currentTimeRef.current, durationRef.current, isPlayingRef.current ? 1.0 : 0.0);
      }
    };

    const handlePageHide = () => {
      if (isAutoPipEnabled && (isPlayingRef.current || userIntentPlayingRef.current)) {
        if (videoModalSongRef.current && !isPipActiveRef.current) {
          requestVideoPictureInPicture(ytContainerRef.current);
        } else if (currentSongRef.current) {
          requestAudioPictureInPicture(currentSongRef.current, isPlayingRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handlePageVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handlePageVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isAutoPipEnabled, syncMediaSessionPositionState]);

  // Periodic mediaSession sync is removed to optimize performance
  // Let the browser infer playback position while playing

  const ytContainerRef = useRef(null);
  const fallbackAttemptedRef = useRef({});
  const autoplayCheckTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      isPlayerReadyRef.current = false;
      try {
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      } catch (e) {}
    };
  }, []);

  const initPlayerInstance = useCallback((videoId, shouldAutoPlay = true, startSeconds = 0, retryCount = 0) => {
    if (!window.YT || !window.YT.Player) {
      ensureYouTubeIframeApi();
      ytReadyCallbacksRef.current.push(() => {
        initPlayerInstance(videoId, shouldAutoPlay, startSeconds, 0);
      });
      return;
    }

    // Reuse existing ready YouTube player instance instead of destroying & re-mounting
    if (
      playerRef.current &&
      isPlayerReadyRef.current &&
      typeof playerRef.current.loadVideoById === 'function'
    ) {
      try {
        const iframe = typeof playerRef.current.getIframe === 'function' ? playerRef.current.getIframe() : null;
        if (iframe && document.contains(iframe)) {
          const start = startSeconds > 0 ? Math.floor(startSeconds) : 0;
          if (shouldAutoPlay) {
            playerRef.current.loadVideoById({ videoId, startSeconds: start });
          } else {
            playerRef.current.cueVideoById({ videoId, startSeconds: start });
          }
          return;
        }
      } catch (e) {}
    }

    // Prevent duplicate player instances: destroy existing instance before creating a new one
    isPlayerReadyRef.current = false;
    try {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    } catch (e) {}

    let mountTarget = document.getElementById('yt-player-instance');
    if (!mountTarget && ytContainerRef.current) {
      ytContainerRef.current.innerHTML = '<div id="yt-player-instance"></div>';
      mountTarget = document.getElementById('yt-player-instance');
    }
    if (!mountTarget) {
      if (retryCount < 10) {
        // Defer initialization until mount target is attached to DOM (capped at 10 retries)
        setTimeout(() => initPlayerInstance(videoId, shouldAutoPlay, startSeconds, retryCount + 1), 50);
      }
      return;
    }

    const rawOrigin = (typeof window !== 'undefined' && window.location.origin)
      ? window.location.origin
      : (typeof window !== 'undefined' ? (window.location.protocol + '//' + window.location.host) : '');
    const cleanOrigin = rawOrigin ? rawOrigin.replace(/\/+$/, '') : '';

    playerRef.current = new window.YT.Player('yt-player-instance', {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: { 
        autoplay: shouldAutoPlay ? 1 : 0, 
        controls: 0, 
        rel: 0,
        iv_load_policy: 3,
        fs: 0,
        disablekb: 1, 
        modestbranding: 1,
        enablejsapi: 1,
        playsinline: 1,
        start: startSeconds > 0 ? Math.floor(startSeconds) : 0,
        ...(cleanOrigin ? { origin: cleanOrigin, widget_referrer: cleanOrigin } : {})
      },
      events: {
        onReady: (e) => {
          isPlayerReadyRef.current = true;
          if (playerRef.current) {
            playerRef.current._isReady = true;
            playerRef.current.isReady = true;
          }
          try {
            const sessionQuality = (typeof window !== 'undefined' && window.sessionStorage?.getItem('loopra_user_selected_quality')) || 'tiny';
            if (typeof e.target.setPlaybackQuality === 'function') {
              try { e.target.setPlaybackQuality(sessionQuality); } catch (_) {}
            }
            if (typeof e.target.setVolume === 'function') {
              e.target.setVolume(volume);
            }
            if (startSeconds > 0 && typeof e.target.seekTo === 'function') {
              e.target.seekTo(startSeconds, true);
            }
            if (shouldAutoPlay) {
              if (typeof e.target.playVideo === 'function') {
                try {
                  const p = e.target.playVideo();
                  if (p && typeof p.catch === 'function') {
                    p.catch((err) => {
                      if (err?.name === 'NotAllowedError') {
                        console.warn('[Loopra Player] Autoplay blocked by browser policy:', err);
                        setIsAutoplayBlocked(true);
                        setIsPlaying(false);
                      }
                    });
                  }
                } catch (err) {
                  console.warn('[Loopra Player] playVideo error:', err);
                }
              }
              setIsPlaying(true);

              // Detect if browser blocked autoplay silently (e.g. state remains cued or unstarted)
              if (autoplayCheckTimerRef.current) clearTimeout(autoplayCheckTimerRef.current);
              autoplayCheckTimerRef.current = setTimeout(() => {
                try {
                  if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
                    const st = playerRef.current.getPlayerState();
                    // State -1 (UNSTARTED) or 5 (CUED) after autoplay command indicates autoplay block
                    if ((st === -1 || st === 5 || st === 2) && !isUserPausedRef.current && !isPlayingRef.current) {
                      console.info('[Loopra Player] Autoplay state check: user interaction required (state=' + st + ')');
                      setIsAutoplayBlocked(true);
                      setIsPlaying(false);
                    }
                  }
                } catch (_) {}
              }, 1200);
            } else {
              if (typeof e.target.pauseVideo === 'function') {
                e.target.pauseVideo();
              }
              setIsPlaying(false);
            }
          } catch (err) {}
        },
        onStateChange: (e) => {
          if (e.data === 1) { // Playing
            setIsPlaying(true);
            setIsAutoplayBlocked(false);
            if (autoplayCheckTimerRef.current) {
              clearTimeout(autoplayCheckTimerRef.current);
              autoplayCheckTimerRef.current = null;
            }
            isUserPausedRef.current = false;
            userIntentPlayingRef.current = true;
            isInitialMountRef.current = false;
            if (autoResumeTimerRef.current) {
              clearTimeout(autoResumeTimerRef.current);
              autoResumeTimerRef.current = null;
            }
            if (!trackPlaybackStartTimeRef.current) {
              trackPlaybackStartTimeRef.current = Date.now();
            }
            if (silentAudioRef.current) {
              try { silentAudioRef.current.volume = 0.01; } catch (_) {}
              silentAudioRef.current.play().catch(() => {});
            }
            try {
              const sessionQuality = (typeof window !== 'undefined' && window.sessionStorage?.getItem('loopra_user_selected_quality')) || 'tiny';
              if (typeof e.target.setPlaybackQuality === 'function') {
                e.target.setPlaybackQuality(sessionQuality);
              }
            } catch (_) {}

            // Immediate OS notification shade & media player sync
            updateMediaSessionImmediate(currentSongRef.current, true);
          } else if (e.data === 2) { // Paused
            // Immediate OS notification shade & media player sync on pause
            updateMediaSessionImmediate(currentSongRef.current, false);

            // Background Auto-Resume Guard: If paused while user intent or React isPlaying is true (i.e. not an explicit user pause), immediately auto-resume
            const isPlayingIntent = isPlayingRef.current || userIntentPlayingRef.current;
            if (isPlayingIntent && !isUserPausedRef.current && !isInitialMountRef.current && currentSongRef.current) {
              try {
                const p = e.target.playVideo();
                if (p && typeof p.catch === 'function') {
                  p.catch(err => {
                    if (err?.name === 'NotAllowedError') {
                      console.warn('[Loopra Player] Background auto-resume blocked by browser policy:', err);
                      setIsAutoplayBlocked(true);
                      setIsPlaying(false);
                    }
                  });
                }
                startPwaAudioWakeLock();
                if (silentAudioRef.current && silentAudioRef.current.paused) {
                  try { silentAudioRef.current.volume = 0.01; } catch (_) {}
                  silentAudioRef.current.play().catch(() => {});
                }
              } catch (_) {}

              if (autoResumeTimerRef.current) clearTimeout(autoResumeTimerRef.current);
              autoResumeTimerRef.current = setTimeout(() => {
                const stillPlayingIntent = isPlayingRef.current || userIntentPlayingRef.current;
                if (stillPlayingIntent && !isUserPausedRef.current && playerRef.current && typeof playerRef.current.playVideo === 'function') {
                  console.info('[Loopra Background Guard] Auto-resuming background playback throttled by browser...');
                  try {
                    const p2 = playerRef.current.playVideo();
                    if (p2 && typeof p2.catch === 'function') {
                      p2.catch(err => {
                        if (err?.name === 'NotAllowedError') {
                          console.warn('[Loopra Player] Deferred auto-resume blocked by browser policy:', err);
                          setIsAutoplayBlocked(true);
                          setIsPlaying(false);
                        }
                      });
                    }
                    startPwaAudioWakeLock();
                    if (silentAudioRef.current) silentAudioRef.current.play().catch(() => {});
                  } catch (_) {}
                }
              }, 50);
            } else {
              setIsPlaying(false);
            }
          } else if (e.data === 0) { // Ended
            if (currentSongRef.current && !hasLoggedCompletionRef.current) {
              const dur = durationRef.current || 200;
              const actualListened = activeListeningDurationRef.current;
              if (actualListened > 0) {
                if (authToken) {
                  recommendationsClient.logListeningEvent(BACKEND_URL, authToken, {
                    trackId: currentSongRef.current.id || currentSongRef.current.videoId,
                    title: currentSongRef.current.title,
                    artist: currentSongRef.current.artist || currentSongRef.current.channel,
                    thumbnail: currentSongRef.current.thumbnail,
                    eventType: 'completed',
                    duration: dur,
                    listenedDuration: actualListened,
                    completionPercent: Math.min(100, Math.round((actualListened / dur) * 100)),
                    playSessionId: playSessionIdRef.current,
                    source: activeTab || 'player'
                  });
                }
                listeningStatsService.recordEvent?.({
                  backendUrl: BACKEND_URL,
                  token: authToken,
                  user,
                  track: currentSongRef.current,
                  eventType: 'completed',
                  duration: dur,
                  listenedDuration: actualListened,
                  playSessionId: playSessionIdRef.current,
                  source: activeTab || 'player'
                });
                hasLoggedCompletionRef.current = true;
              }
            }

            const currentRepeat = isRepeatRef.current;
            if (stopAfterCurrentTrackRef.current) {
              setStopAfterCurrentTrack(false);
              setIsPlaying(false);
              try { playerRef.current?.pauseVideo?.(); } catch (e) {}
              showToast('Playback stopped (Track finished)');
            } else if (currentRepeat === 'one' || currentRepeat === true) {
              playerRef.current?.seekTo?.(0, true);
              try {
                const p = playerRef.current?.playVideo?.();
                if (p && typeof p.catch === 'function') p.catch(() => {});
              } catch (e) {}
            } else {
              handleTrackEndedRef.current?.();
            }
          }
        },
        onPlaybackQualityChange: (e) => {
          if (e && e.data) {
            window.dispatchEvent(new CustomEvent('loopra:playback-quality-change', { detail: { quality: e.data } }));
          }
        },
        onError: (e) => {
          console.warn("YouTube player playback error code:", e.data);
          setIsPlaying(false);

          const isRestricted = (e.data === 150 || e.data === 101);
          const isNotFound = (e.data === 100 || e.data === 2);
          const failedId = videoId || currentSongRef.current?.id || currentSongRef.current?.videoId;

          // Automatic embeddable alternative recovery (Strictly max 1 attempt per failed track ID to eliminate loops)
          if ((isRestricted || isNotFound) && failedId && !fallbackAttemptedRef.current[failedId] && currentSongRef.current) {
            fallbackAttemptedRef.current[failedId] = true;
            const songToRecover = currentSongRef.current;
            showToast(`Finding playable stream for "${songToRecover.title}"...`, 3000);

            const query = `${songToRecover.title} ${songToRecover.artist || ''} official audio`;
            const searchUrl = `${getApiUrl('/api/youtube/search')}?q=${encodeURIComponent(query)}&limit=5`;
            fetch(searchUrl)
              .then(res => res.json())
              .then(data => {
                const results = Array.isArray(data) ? data : (data.results || data.videos || []);
                const alternative = results.find(r => {
                  const rId = r.id || r.videoId;
                  if (!rId || rId === failedId) return false;
                  // Verify candidate has matching title keywords to prevent playing completely unrelated song
                  const altTitle = (r.title || '').toLowerCase();
                  const targetWords = songToRecover.title.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !['official', 'video', 'song', 'audio'].includes(w));
                  const hasMatchingWord = targetWords.length === 0 || targetWords.some(w => altTitle.includes(w));
                  return hasMatchingWord;
                });
                if (alternative && (alternative.id || alternative.videoId)) {
                  const altId = alternative.id || alternative.videoId;
                  console.info(`[Player] Loaded verified alternative embeddable ID ${altId} for "${songToRecover.title}"`);
                  const cleanThumb = getCleanThumbnail(alternative, altId) || `https://i.ytimg.com/vi/${altId}/hqdefault.jpg`;
                  const updatedSong = {
                    ...songToRecover,
                    id: altId,
                    videoId: altId,
                    thumbnail: cleanThumb,
                    image: cleanThumb
                  };
                  setCurrentSong(updatedSong);
                  initPlayerInstance(altId, true, 0);
                  showToast(`Now playing playable version of "${songToRecover.title}"`, 3000);
                  return;
                }
                const msg = isRestricted 
                  ? "Playback restricted by video owner (Error 150). Skipping to next playable track..."
                  : "Playback error encountered. Skipping to next playable track...";
                showToast(msg, 3000);
                if (consecutiveErrorSkipCountRef.current < 3) {
                  consecutiveErrorSkipCountRef.current += 1;
                  setTimeout(() => {
                    handleNextSongRef.current?.();
                  }, 1200);
                }
              })
              .catch(() => {
                const msg = isRestricted 
                  ? "Playback restricted by video owner (Error 150). Skipping to next track..."
                  : "Playback error encountered. Skipping to next track...";
                showToast(msg, 3000);
                if (consecutiveErrorSkipCountRef.current < 3) {
                  consecutiveErrorSkipCountRef.current += 1;
                  setTimeout(() => {
                    handleNextSongRef.current?.();
                  }, 1200);
                }
              });
            return;
          }

          if (isInitialMountRef.current) {
            return;
          }

          // Safety-guarded automatic advance on unrecoverable player errors (max 3 consecutive skips to prevent loops)
          if (consecutiveErrorSkipCountRef.current < 3) {
            consecutiveErrorSkipCountRef.current += 1;
            const msg = isRestricted 
              ? "Playback restricted by video owner. Moving to next track in queue..."
              : "Playback error encountered. Moving to next track in queue...";
            showToast(msg, 3000);
            setTimeout(() => {
              handleNextSongRef.current?.();
            }, 1200);
          } else {
            const msg = "Multiple playback errors encountered. Please tap to retry or choose another track.";
            showToast(msg, 4000);
          }
        }
      }
    });
  }, [volume, showToast]);

  useEffect(() => {
    if (!currentSong) return;

    if (loadedVideoIdRef.current === currentSong.id) return;

    const isFirstMount = isInitialMountRef.current;
    let savedSeekTime = 0;
    if (isFirstMount) {
      try {
        savedSeekTime = parseFloat(localStorage.getItem('afterhours_current_time') || '0') || 0;
      } catch (e) {}
    }

    // Live Indian Radio Stream Playback
    if (currentSong?.isRadio) {
      if (offlineAudioRef.current) {
        try {
          offlineAudioRef.current.pause();
          offlineAudioRef.current.src = '';
        } catch (e) {}
      }
      if (activeObjectUrlRef.current) {
        try { URL.revokeObjectURL(activeObjectUrlRef.current); } catch (e) {}
        activeObjectUrlRef.current = null;
      }
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function' && !playerRef.current.isRadio) {
        try { playerRef.current.pauseVideo(); } catch (e) {}
      }

      // Stop previous radio stream before loading a new station
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch (e) {}
        hlsRef.current = null;
      }
      if (radioAudioRef.current) {
        try {
          radioAudioRef.current.pause();
          radioAudioRef.current.removeAttribute('src');
          radioAudioRef.current.load();
        } catch (e) {}
      } else {
        radioAudioRef.current = new Audio();
      }

      const radioAudio = radioAudioRef.current;
      if (typeof window !== 'undefined') {
        window.__loopraRadioAudio = radioAudio;
      }
      radioAudio.preload = 'auto';
      radioAudio.crossOrigin = 'anonymous';
      radioAudio.volume = isMuted ? 0 : (volume / 100);
      radioAudio.muted = isMuted;

      // Note: Web Audio createMediaElementSource is omitted here to prevent silencing cross-origin live streams.
      radioAudio.onplaying = () => {
        setIsPlaying(true);
        setIsAutoplayBlocked(false);
        isInitialMountRef.current = false;
        updateMediaSessionImmediate(currentSong, true);
      };
      radioAudio.onpause = () => {
        setIsPlaying(false);
        updateMediaSessionImmediate(currentSong, false);
      };
      radioAudio.onwaiting = () => {
        // Stream buffering
      };
      radioAudio.onerror = (e) => {
        console.warn('[IndianRadio] Playback error on station stream:', e);
        setIsPlaying(false);
        showToast('Live radio stream temporarily unavailable. Reconnecting...', 'error');
      };

      const rawStream = currentSong.streamUrl || `/api/radio/stream/${currentSong.id}/playlist.m3u8`;
      const resolvedStreamUrl = rawStream.startsWith('http')
        ? rawStream
        : getApiUrl(rawStream);

      const triggerPlay = () => {
        if (!isFirstMount) {
          const p = radioAudio.play();
          if (p && typeof p.catch === 'function') {
            p.catch(err => {
              if (err.name === 'NotAllowedError') {
                console.warn('[IndianRadio] Autoplay blocked by browser policy:', err);
                setIsAutoplayBlocked(true);
                setIsPlaying(false);
              } else if (err.name !== 'AbortError') {
                console.warn('[IndianRadio] Autoplay error:', err);
              }
            });
          }
        }
      };

      if (currentSong.streamFormat === 'hls') {
        loadHls().then((HlsLib) => {
          if (HlsLib && HlsLib.isSupported()) {
            const hls = new HlsLib({
              enableWorker: false,
              lowLatencyMode: true,
              backBufferLength: 30
            });
            hlsRef.current = hls;
            hls.loadSource(resolvedStreamUrl);
            hls.attachMedia(radioAudio);
            hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
              triggerPlay();
            });
            hls.on(HlsLib.Events.ERROR, (event, data) => {
              if (data.fatal) {
                console.warn('[IndianRadio] HLS Fatal Error:', data.type, data.details);
                switch (data.type) {
                  case HlsLib.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                  case HlsLib.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    hls.destroy();
                    hlsRef.current = null;
                    setIsPlaying(false);
                    break;
                }
              }
            });
          } else {
            radioAudio.src = resolvedStreamUrl;
            triggerPlay();
          }
        }).catch(() => {
          radioAudio.src = resolvedStreamUrl;
          triggerPlay();
        });
      } else {
        radioAudio.src = resolvedStreamUrl;
        triggerPlay();
      }

      playerRef.current = {
        isRadio: true,
        getCurrentTime: () => radioAudioRef.current ? radioAudioRef.current.currentTime : 0,
        getDuration: () => 0,
        seekTo: () => {},
        playVideo: () => {
          if (!radioAudioRef.current) return Promise.resolve();
          const p = radioAudioRef.current.play();
          if (p && typeof p.catch === 'function') {
            p.catch(err => {
              if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                console.warn('[IndianRadio] playVideo error:', err);
              }
            });
          }
          return p;
        },
        pauseVideo: () => {
          if (radioAudioRef.current) {
            try { radioAudioRef.current.pause(); } catch (e) {}
          }
        },
        stopVideo: () => {
          if (radioAudioRef.current) {
            try { radioAudioRef.current.pause(); } catch (e) {}
            try {
              radioAudioRef.current.removeAttribute('src');
              radioAudioRef.current.load();
            } catch (e) {}
          }
          if (hlsRef.current) {
            try { hlsRef.current.destroy(); } catch (e) {}
            hlsRef.current = null;
          }
        },
        setVolume: (vol) => {
          if (radioAudioRef.current) radioAudioRef.current.volume = vol / 100;
        },
        mute: () => {
          if (radioAudioRef.current) radioAudioRef.current.muted = true;
        },
        unMute: () => {
          if (radioAudioRef.current) radioAudioRef.current.muted = false;
        },
        destroy: () => {
          if (radioAudioRef.current) {
            try { radioAudioRef.current.pause(); } catch (e) {}
            try {
              radioAudioRef.current.removeAttribute('src');
              radioAudioRef.current.load();
            } catch (e) {}
          }
          if (hlsRef.current) {
            try { hlsRef.current.destroy(); } catch (e) {}
            hlsRef.current = null;
          }
        }
      };

      loadedVideoIdRef.current = currentSong.id;
      setHistory(prev => [currentSong, ...prev.filter(s => s.id !== currentSong.id)].slice(0, 50));
      return;
    }

    // Update listening history on playback (Manual download only; no auto-caching)
    if (currentSong && (currentSong.id || currentSong.videoId)) {
      setHistory(prev => [currentSong, ...prev.filter(s => (s.id || s.videoId) !== (currentSong.id || currentSong.videoId))].slice(0, 50));
    }

    // Check if track is downloaded/cached in IndexedDB for genuine offline playback
    // or if the browser is currently offline or under weak network conditions
    const isOfflineMode = (typeof navigator !== 'undefined' && !navigator.onLine);
    const isWeakNetwork = (typeof navigator !== 'undefined' && navigator.connection && (navigator.connection.saveData || navigator.connection.effectiveType === 'slow-2g' || navigator.connection.effectiveType === '2g'));

    offlineStorageService.getTrack(currentSong.id || currentSong.videoId).then((storedRecord) => {
      if (storedRecord && storedRecord.audioBlob) {
        // Pause YouTube player if active
        try {
          if (playerRef.current && typeof playerRef.current.pauseVideo === 'function' && !playerRef.current.isOffline) {
            playerRef.current.pauseVideo();
          }
        } catch (e) {}

        if (activeObjectUrlRef.current) {
          try { URL.revokeObjectURL(activeObjectUrlRef.current); } catch (e) {}
          activeObjectUrlRef.current = null;
        }

        const objectUrl = URL.createObjectURL(storedRecord.audioBlob);
        activeObjectUrlRef.current = objectUrl;

        if (!offlineAudioRef.current) {
          offlineAudioRef.current = new Audio();
        }

        const audio = offlineAudioRef.current;
        audio.src = objectUrl;
        audio.volume = volume / 100;
        if (savedSeekTime > 0) {
          audio.currentTime = savedSeekTime;
        }

        audio.onplay = () => {
          setIsPlaying(true);
          setIsAutoplayBlocked(false);
          isInitialMountRef.current = false;
          updateMediaSessionImmediate(currentSong, true);
        };
        audio.onpause = () => {
          setIsPlaying(false);
          updateMediaSessionImmediate(currentSong, false);
        };
        audio.onerror = (e) => {
          console.warn('[OfflinePlay] Audio element playback error:', e);
          setIsPlaying(false);
          setIsAutoplayBlocked(true);
          showToast('Offline audio playback blocked or file corrupted. Tap to retry.');
        };
        audio.ontimeupdate = () => {
          if (crossfadeDuration > 0 && audio.duration > 0) {
            const remaining = audio.duration - audio.currentTime;
            if (remaining <= crossfadeDuration && remaining > 0) {
              const fadeRatio = Math.max(0, remaining / crossfadeDuration);
              audio.volume = (volume / 100) * fadeRatio;
            } else if (remaining > crossfadeDuration && audio.volume !== volume / 100) {
              audio.volume = volume / 100;
            }
          }
        };
        audio.onended = () => {
          if (currentSongRef.current && authToken && !hasLoggedCompletionRef.current) {
            const dur = audio.duration || 200;
            const actualListened = activeListeningDurationRef.current;
            if (actualListened > 0) {
              recommendationsClient.logListeningEvent(BACKEND_URL, authToken, {
                trackId: currentSongRef.current.id || currentSongRef.current.videoId,
                title: currentSongRef.current.title,
                artist: currentSongRef.current.artist || currentSongRef.current.channel,
                thumbnail: currentSongRef.current.thumbnail,
                eventType: 'completed',
                duration: dur,
                listenedDuration: actualListened,
                completionPercent: Math.min(100, Math.round((actualListened / dur) * 100)),
                source: 'offline'
              });
              listeningStatsService.recordEvent?.({
                backendUrl: BACKEND_URL,
                token: authToken,
                user,
                track: currentSongRef.current,
                eventType: 'completed',
                duration: dur,
                listenedDuration: actualListened,
                playSessionId: playSessionIdRef.current,
                source: 'offline'
              });
              hasLoggedCompletionRef.current = true;
            }
          }

          const currentRepeat = isRepeatRef.current;
          if (currentRepeat === 'one' || currentRepeat === true) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
          } else {
            handleTrackEndedRef.current?.();
          }
        };

        // Create player adapter for PlayerProgress, Turntable3D, and controls
        playerRef.current = {
          isOffline: true,
          getCurrentTime: () => offlineAudioRef.current ? offlineAudioRef.current.currentTime : 0,
          getDuration: () => offlineAudioRef.current ? (offlineAudioRef.current.duration || 0) : 0,
          seekTo: (sec) => { if (offlineAudioRef.current) offlineAudioRef.current.currentTime = sec; },
          playVideo: () => {
            if (!offlineAudioRef.current) return Promise.resolve();
            const p = offlineAudioRef.current.play();
            if (p && typeof p.catch === 'function') {
              p.catch(err => {
                if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                  console.warn('Offline audio play error:', err);
                }
              });
            }
            return p;
          },
          pauseVideo: () => {
            if (offlineAudioRef.current) {
              try { offlineAudioRef.current.pause(); } catch (e) {}
            }
          },
          stopVideo: () => {
            if (offlineAudioRef.current) {
              offlineAudioRef.current.pause();
              offlineAudioRef.current.currentTime = 0;
            }
          },
          setVolume: (vol) => { if (offlineAudioRef.current) offlineAudioRef.current.volume = vol / 100; },
          destroy: () => {
            if (offlineAudioRef.current) {
              offlineAudioRef.current.pause();
              offlineAudioRef.current.src = '';
            }
          }
        };

        loadedVideoIdRef.current = currentSong.id;

        if (!isFirstMount) {
          const p = audio.play();
          if (p && typeof p.catch === 'function') {
            p.catch(e => {
              if (e.name === 'NotAllowedError') {
                console.warn('Offline audio autoplay blocked:', e);
                setIsAutoplayBlocked(true);
                setIsPlaying(false);
              } else {
                console.warn('Offline audio play error:', e);
              }
            });
          }
          setIsPlaying(true);
        } else {
          setIsPlaying(false);
        }
        return;
      }

      // Online YouTube Playback
      if (offlineAudioRef.current) {
        try {
          offlineAudioRef.current.pause();
          offlineAudioRef.current.src = '';
        } catch (e) {}
      }
      if (radioAudioRef.current) {
        try {
          radioAudioRef.current.pause();
          radioAudioRef.current.src = '';
        } catch (e) {}
      }
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
          hlsRef.current = null;
        } catch (e) {}
      }
      if (activeObjectUrlRef.current) {
        try { URL.revokeObjectURL(activeObjectUrlRef.current); } catch (e) {}
        activeObjectUrlRef.current = null;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // If track is not downloaded and device has no internet, notify user
        showToast('You are offline. Only songs downloaded in your Downloaded Library can play without internet.', 'warning');
        setIsPlaying(false);
        return;
      }

      if (playerRef.current && isPlayerReadyRef.current && typeof playerRef.current.loadVideoById === 'function' && !playerRef.current.isOffline) {
        try {
          // Resolution configuration: Preserve manual quality selection in session or default to 144p ('tiny')
          const sessionQuality = (typeof window !== 'undefined' && window.sessionStorage?.getItem('loopra_user_selected_quality')) || 'tiny';

          if (isFirstMount) {
            if (typeof playerRef.current.cueVideoById === 'function') {
              playerRef.current.cueVideoById({
                videoId: currentSong.id,
                startSeconds: savedSeekTime,
                suggestedQuality: sessionQuality
              });
            } else {
              playerRef.current.loadVideoById({ videoId: currentSong.id, startSeconds: savedSeekTime, suggestedQuality: sessionQuality });
              playerRef.current.pauseVideo();
            }
            setIsPlaying(false);
          } else {
            // Direct video switch without destroying or recreating the iframe instance
            playerRef.current.loadVideoById({
              videoId: currentSong.id,
              suggestedQuality: sessionQuality
            });
            if (typeof playerRef.current.setPlaybackQuality === 'function') {
              try { playerRef.current.setPlaybackQuality(sessionQuality); } catch (_) {}
            }
            try {
              const p = playerRef.current.playVideo();
              if (p && typeof p.catch === 'function') {
                p.catch(err => {
                  if (err?.name === 'NotAllowedError') {
                    console.warn('[Loopra Player] Autoplay blocked by browser policy:', err);
                    setIsAutoplayBlocked(true);
                    setIsPlaying(false);
                  }
                });
              }
            } catch (_) {}
            setIsPlaying(true);

            // Guard against silent autoplay blockage where state does not change to 1 (playing)
            if (autoplayCheckTimerRef.current) clearTimeout(autoplayCheckTimerRef.current);
            autoplayCheckTimerRef.current = setTimeout(() => {
              try {
                if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
                  const st = playerRef.current.getPlayerState();
                  if ((st === -1 || st === 5 || st === 2) && !isUserPausedRef.current && !isPlayingRef.current) {
                    console.info('[Loopra Player] Autoplay state check: user interaction required (state=' + st + ')');
                    setIsAutoplayBlocked(true);
                    setIsPlaying(false);
                  }
                }
              } catch (_) {}
            }, 1200);
          }
          loadedVideoIdRef.current = currentSong.id;
        } catch (err) {
          initPlayerInstance(currentSong.id, !isFirstMount, savedSeekTime);
          loadedVideoIdRef.current = currentSong.id;
        }
      } else if (window.YT && window.YT.Player) {
        initPlayerInstance(currentSong.id, !isFirstMount, savedSeekTime);
        loadedVideoIdRef.current = currentSong.id;
      } else {
        ensureYouTubeIframeApi();
        ytReadyCallbacksRef.current.push(() => {
          initPlayerInstance(currentSong.id, !isFirstMount, savedSeekTime);
          loadedVideoIdRef.current = currentSong.id;
        });
      }
    });

    setHistory(prev => [currentSong, ...prev.filter(s => s.id !== currentSong.id)].slice(0, 50));
  }, [currentSong, initPlayerInstance, volume, showToast]);

  useEffect(() => {
    playSongRef.current = playSong;
  }, [playSong]);

  // Player progress interval is extracted to PlayerProgress component

  const loadStationSongs = useCallback(async (stationKey, autoPlayIfEmpty = false) => {
    const station = stationsMap[stationKey] || SPECIAL_STATIONS[stationKey];
    if (!station) return;

    if (stationCache[stationKey]?.tracks?.length > 0) {
      const cachedTracks = stationCache[stationKey].tracks || [];
      setSongs(cachedTracks);
      if (autoPlayIfEmpty && !currentSong && cachedTracks.length > 0) {
        const randomTrack = cachedTracks[Math.floor(Math.random() * cachedTracks.length)];
        playSong(randomTrack);
      }
      return;
    }

    if (Array.isArray(station.tracks) && station.tracks.length > 0) {
      const stationTracks = station.tracks.filter(t => !t.isHidden).map(t => ({
        id: t.id || t.videoId,
        youtubeId: t.videoId || t.id,
        title: t.title || 'Untitled Track',
        artist: t.artist || 'Unknown Artist',
        album: t.album || station.title,
        duration: t.duration || '3:30',
        thumbnail: t.thumbnail || station.bgImages?.[0] || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
        url: t.url || `https://www.youtube.com/watch?v=${t.videoId || t.id}`
      }));
      if (stationTracks.length > 0) {
        setSongs(stationTracks);
        setStationCache(prev => ({
          ...prev,
          [stationKey]: { tracks: stationTracks }
        }));
        if (autoPlayIfEmpty && !currentSong) {
          playSong(stationTracks[0]);
        }
        return;
      }
    }

    // Instant display for home & special stations: seed immediately with curated catalog without network roundtrip
    const curatedKey = stationKey === 'barber' ? 'saloon' : (stationKey === 'truck' ? 'horn' : (stationKey === 'pauwa' ? 'theka' : (stationKey === 'home' ? 'saloon' : null)));
    if (curatedKey && CURATED_STATION_TRACKS && CURATED_STATION_TRACKS[curatedKey]) {
      const curatedList = CURATED_STATION_TRACKS[curatedKey];
      setSongs(curatedList);
      setStationCache(prev => ({
        ...prev,
        [stationKey]: { tracks: curatedList }
      }));
      if (autoPlayIfEmpty && !currentSong && curatedList.length > 0) {
        const randomTrack = curatedList[Math.floor(Math.random() * Math.min(curatedList.length, 50))];
        playSong(randomTrack);
      }
      return;
    }

    setStationLoading(true);

    try {
      const query = station.queries?.[0];
      if (query) {
        const data = await fetchFromBackend(query);

        const fetchedTracks = data.items ? data.items.map(item => ({
          id: item.id.videoId || item.id,
          title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
          channel: item.snippet.channelTitle,
          artist: item.snippet.channelTitle,
          thumbnail: getCleanThumbnail(item, item.id.videoId || item.id),
        })) : [];

        setSongs(fetchedTracks);

        setStationCache(prev => ({ 
          ...prev, 
          [stationKey]: { tracks: fetchedTracks } 
        }));

        if (autoPlayIfEmpty && fetchedTracks.length > 0 && !currentSong) {
          const randomIndex = Math.floor(Math.random() * fetchedTracks.length);
          playSong(fetchedTracks[randomIndex]);
        }
      }
    } catch (err) {
      console.error("Error loading station tracks across keys:", err);
    } finally {
      setStationLoading(false);
    }
  }, [currentSong, playSong, stationCache]);

    const mainScrollRef = useRef(null);
  const scrollPositions = useRef({});

  const applyNavRoute = useCallback((target) => {
    if (!target) return;

    if (mainScrollRef.current) {
      scrollPositions.current[activeTab] = mainScrollRef.current.scrollTop;
    }

    setActiveTab(target.tab);
    setCurrentBgIndex(0);
    setIsStatsOpen(false);

    // Restore destination parameters
    if (target.tab === 'discover') {
      const q = target.params?.q || '';
      setSearchQuery(q);
      if (q) {
        if (typeof fetchYouTubeMusicRef.current === 'function') {
          fetchYouTubeMusicRef.current(q);
        }
      } else {
        setSearchResults([]);
      }
    } else if (target.tab === 'artist') {
      setSelectedArtistId(target.params?.id || target.params?.slug || 'arijit-singh');
    } else if (target.tab === 'downloads') {
      setOfflineSubView(target.params?.subView || 'library');
    } else if (target.tab === 'rooms') {
      if (!target.params?.roomId && !target.params?.roomCode && !target.params?.room) {
        setActiveRoom(null);
      }
    } else if (target.tab === 'playlists') {
      if (!target.params?.id) {
        setSelectedPlaylistForView(null);
      }
    } else if (target.tab === 'home') {
      setShowAllTrending(target.params?.showAll === 'trending');
      setShowAllArtists(target.params?.showAll === 'artists');
      setShowAllAlbums(target.params?.showAll === 'albums');
      setShowAllRadio(target.params?.showAll === 'radio');
    }

    if (target.tab !== 'home') {
      setShowAllTrending(false);
      setShowAllArtists(false);
      setShowAllAlbums(false);
      setShowAllRadio(false);
    }

    setTimeout(() => {
      if (mainScrollRef.current && scrollPositions.current[target.tab] !== undefined) {
        mainScrollRef.current.scrollTop = scrollPositions.current[target.tab];
      } else if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = 0;
      }
    }, 40);
  }, [activeTab]);

  const handleDownloadApk = useCallback(async (e) => {
    if (!e || (e.type !== 'click' && !e.isTrusted)) {
      return;
    }
    if (typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    try {
      const isAndroid = Boolean(isStandaloneApp || (typeof window !== 'undefined' && window.LoopraAndroid));
      if (isAndroid) {
        showToast('Checking for Loopra Android updates...', 'info');
        const manifest = publishedVersionInfo || await fetchPublishedAppVersion(BACKEND_URL);
        const installed = getInstalledAppVersion();

        if (manifest) {
          const semverDiff = compareVersions(manifest.versionName, installed.versionName);
          const isHigher = semverDiff > 0 || (semverDiff === 0 && manifest.versionCode > installed.versionCode);
          if (!isHigher && installed.isNative) {
            showToast(`Loopra is already up to date (v${installed.versionName}).`, 'success');
            return;
          }
          const triggered = triggerApkDownload(getDirectApkDownloadUrl(manifest), manifest, { userInitiated: true });
          if (triggered) {
            showToast(`Downloading Loopra update (v${manifest.versionName})...`, 'success');
          } else {
            showToast('Unable to start update download. Please try again.', 'error');
          }
          return;
        }
      }

      // Web Browser Environment: Directly initiate real APK file download via dedicated direct URL
      const targetManifest = publishedVersionInfo || await fetchPublishedAppVersion(BACKEND_URL);
      const apkUrl = getDirectApkDownloadUrl(targetManifest);
      const triggered = triggerApkDownload(apkUrl, targetManifest, { userInitiated: true });
      if (triggered) {
        showToast('Downloading Loopra Android APK...', 'success');
      } else {
        showToast('Unable to initiate APK download. File path not accessible.', 'error');
      }
    } catch (err) {
      console.warn('[handleDownloadApk] Download error:', err);
      showToast('Download failed. Please check your network connection.', 'error');
    }
  }, [showToast, isStandaloneApp, publishedVersionInfo]);

  const handleStationSelect = (stationKey, extraParams = {}) => {
    setShowQueuePanel(false);
    if (mainScrollRef.current) {
      scrollPositions.current[activeTab] = mainScrollRef.current.scrollTop;
    }

    const targetRoute = {
      tab: stationKey,
      params: extraParams,
      path: buildPath(stationKey, extraParams)
    };

    const { entry, stack: newStack } = pushNavigation(navigationStackRef.current, targetRoute);
    navigationStackRef.current = newStack;
    setNavigationStack(newStack);

    applyNavRoute(entry);
    setIsSidebarOpen(false);

    // Sync browser URL
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState(
          { ...entry, loopraNavIdx: newStack.length - 1, loopraInit: true },
          '',
          entry.path
        );
      } catch (e) {}
    }

    // Removed in-app corner mini-video popup when navigating views
  };

  const handleGoBack = () => {
    // 1. Dismiss any open modal, drawer, or dialog first
    if (showAuthModal) {
      closeAuthModal(false);
      return;
    }
    if (isCreatePlaylistModalOpen) {
      setIsCreatePlaylistModalOpen(false);
      setCreateModalPlaylistName('');
      return;
    }
    if (renameModalPlaylist) {
      setRenameModalPlaylist(null);
      setRenameModalName('');
      return;
    }
    if (deleteModalPlaylist) {
      setDeleteModalPlaylist(null);
      return;
    }
    if (activeAssistantPanel) {
      setActiveAssistantPanel(null);
      return;
    }
    if (isPlaylistModalOpen) {
      setIsPlaylistModalOpen(false);
      setSelectedSongForPlaylist(null);
      return;
    }
    if (similarSongsTrack) {
      setSimilarSongsTrack(null);
      return;
    }
    if (isLyricsOpen) {
      setIsLyricsOpen(false);
      return;
    }
    if (isSleepTimerOpen) {
      setIsSleepTimerOpen(false);
      return;
    }
    if (isCanvasOpen) {
      setIsCanvasOpen(false);
      return;
    }
    if (isPlayerSettingsOpen) {
      setIsPlayerSettingsOpen(false);
      return;
    }
    if (isStatsOpen) {
      setIsStatsOpen(false);
      return;
    }
    if (isProfileOpen) {
      setIsProfileOpen(false);
      return;
    }
    if (isRatingModalOpen) {
      setIsRatingModalOpen(false);
      return;
    }
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
      return;
    }
    if (showQueuePanel) {
      setShowQueuePanel(false);
      return;
    }

    // If video modal is open, back closes it
    if (videoModalSong && !isPipActive) {
      handleCloseVideo();
      return;
    }

    // 2. Sub-views inside current page: collapse them before navigating away
    // If on Home with any "See all" expanded, collapse back to Home root
    if (activeTab === "home" && (showAllTrending || showAllArtists || showAllAlbums || showAllRadio)) {
      setShowAllTrending(false);
      setShowAllArtists(false);
      setShowAllAlbums(false);
      setShowAllRadio(false);
      const { target, stack: newStack } = popNavigation(navigationStackRef.current);
      navigationStackRef.current = newStack;
      setNavigationStack(newStack);
      if (typeof window !== 'undefined') {
        window.history.replaceState({ ...target, loopraNavIdx: 0, loopraInit: true }, '', target.path || '/');
      }
      return;
    }

    // If inside playlist view, return to playlists list
    if (selectedPlaylistForView) {
      setSelectedPlaylistForView(null);
      const { target, stack: newStack } = popNavigation(navigationStackRef.current);
      navigationStackRef.current = newStack;
      setNavigationStack(newStack);
      if (typeof window !== 'undefined') {
        window.history.replaceState({ ...target, loopraInit: true }, '', target.path || '/playlists');
      }
      return;
    }

    // If inside downloads explore view, return to downloads library
    if (offlineSubView === 'explore') {
      setOfflineSubView('library');
      const { target, stack: newStack } = popNavigation(navigationStackRef.current);
      navigationStackRef.current = newStack;
      setNavigationStack(newStack);
      if (typeof window !== 'undefined') {
        window.history.replaceState({ ...target, loopraInit: true }, '', target.path || '/downloads');
      }
      return;
    }

    // If already at Home root with nothing else to pop, do nothing
    if (isHomePage(activeTab, { showAllTrending, showAllArtists, showAllAlbums, showAllRadio })) {
      return;
    }

    // 3. Reliable Internal Stack Navigation:
    // Pop the previous destination from the internal navigation stack
    const { target, stack: newStack } = popNavigation(navigationStackRef.current);
    navigationStackRef.current = newStack;
    setNavigationStack(newStack);

    // Apply the popped destination immediately
    applyNavRoute(target);

    // Sync URL without triggering an unreliable browser history loop
    if (typeof window !== 'undefined') {
      try {
        window.history.replaceState(
          { ...target, loopraNavIdx: Math.max(0, newStack.length - 1), loopraInit: true },
          '',
          target.path || '/'
        );
      } catch (e) {}
    }
  };

  const handleSetShowAllTrending = (val) => {
    const next = typeof val === 'function' ? val(showAllTrending) : val;
    if (next && !showAllTrending) {
      handleStationSelect('home', { showAll: 'trending' });
      setShowAllTrending(true);
    } else if (!next && showAllTrending) {
      handleGoBack();
    }
  };

  const handleSetShowAllArtists = (val) => {
    const next = typeof val === 'function' ? val(showAllArtists) : val;
    if (next && !showAllArtists) {
      handleStationSelect('home', { showAll: 'artists' });
      setShowAllArtists(true);
    } else if (!next && showAllArtists) {
      handleGoBack();
    }
  };

  const handleSetShowAllAlbums = (val) => {
    const next = typeof val === 'function' ? val(showAllAlbums) : val;
    if (next && !showAllAlbums) {
      handleStationSelect('home', { showAll: 'albums' });
      setShowAllAlbums(true);
    } else if (!next && showAllAlbums) {
      handleGoBack();
    }
  };

  const handleSetShowAllRadio = (val) => {
    const next = typeof val === 'function' ? val(showAllRadio) : val;
    if (next && !showAllRadio) {
      handleStationSelect('home', { showAll: 'radio' });
      setShowAllRadio(true);
    } else if (!next && showAllRadio) {
      handleGoBack();
    }
  };

  useEffect(() => {
    if (['home', 'barber', 'truck', 'pauwa'].includes(activeTab)) {
      loadStationSongs(activeTab, false);
    }
  }, [activeTab, loadStationSongs]);

  const togglePlayPause = () => {
    if (!currentSong) {
      if (queue.length > 0) playSong(queue[0]);
      return;
    }
    isInitialMountRef.current = false;
    setIsAutoplayBlocked(false);
    if (isPlaying) {
      isUserPausedRef.current = true;
      userIntentPlayingRef.current = false;
      stopPwaAudioWakeLock();
      if (autoResumeTimerRef.current) {
        clearTimeout(autoResumeTimerRef.current);
        autoResumeTimerRef.current = null;
      }
      playerRef.current?.pauseVideo?.();
      if (silentAudioRef.current) silentAudioRef.current.pause();
      setIsPlaying(false);
      updateMediaSessionImmediate(currentSong, false);
      // Broadcast pause state to Room members if Listen Together is ON
      broadcastPlaybackToRoom(currentSong, false, currentTimeRef.current || 0);
    } else {
      isUserPausedRef.current = false;
      userIntentPlayingRef.current = true;
      startPwaAudioWakeLock();
      updateMediaSessionImmediate(currentSong, true);
      // Broadcast play state to Room members if Listen Together is ON
      broadcastPlaybackToRoom(currentSong, true, currentTimeRef.current || 0);
      if (!playerRef.current || !isPlayerReadyRef.current || typeof playerRef.current.playVideo !== 'function') {
        let savedSeek = 0;
        try {
          savedSeek = parseFloat(localStorage.getItem('afterhours_current_time') || '0') || 0;
        } catch (e) {}
        initPlayerInstance(currentSong.id, true, savedSeek);
      } else {
        try {
          const savedSeek = parseFloat(localStorage.getItem('afterhours_current_time') || '0') || 0;
          const curTime = (playerRef.current.getCurrentTime && isPlayerReadyRef.current) ? playerRef.current.getCurrentTime() : 0;
          if (savedSeek > 0 && curTime < 1 && isPlayerReadyRef.current) {
            playerRef.current.seekTo(savedSeek, true);
          }
        } catch (e) {}
        try {
          if (isPlayerReadyRef.current) {
            const p = playerRef.current?.playVideo?.();
            if (p && typeof p.catch === 'function') {
              p.catch(err => {
                if (err?.name === 'NotAllowedError') {
                  console.warn('[Loopra Player] Explicit togglePlay blocked by policy:', err);
                  setIsAutoplayBlocked(true);
                  setIsPlaying(false);
                }
              });
            }
          }
        } catch (e) {}
      }
      if (silentAudioRef.current) {
        try { silentAudioRef.current.volume = 0.01; } catch (_) {}
        silentAudioRef.current.play().catch(() => {});
      }
      if (!currentSong?.isRadio) {
        setIsPlaying(true);
      }
    }
  };

  const handleVolumeChange = (e) => {
    const raw = (e && typeof e === 'object' && e.target) ? e.target.value : e;
    const newVol = parseInt(raw, 10);
    if (isNaN(newVol)) return;
    setVolume(newVol);
    try {
      playerRef.current?.setVolume?.(newVol);
    } catch (err) {}
  };

  const addToQueue = (song, e) => {
    if (e) e.stopPropagation();
    setQueue(prev => {
      if (prev.some(s => s.id === song.id)) {
        showToast('Track already in queue');
        return prev;
      }
      showToast('Added to queue');
      return [...prev, song];
    });
  };

  const removeFromQueue = (trackId) => {
    setQueue(prev => prev.filter(s => s.id !== trackId));
    showToast('Removed from queue');
  };

  const playNext = useCallback((song, e) => {
    if (e) e.stopPropagation();
    if (!song) return;
    setQueue(prev => {
      if (currentSong && ((currentSong.id || currentSong.videoId) === (song.id || song.videoId))) {
        showToast('Track is already playing');
        return prev;
      }
      const filtered = prev.filter(s => (s.id || s.videoId) !== (song.id || song.videoId));
      const curIdx = currentSong ? filtered.findIndex(s => (s.id || s.videoId) === (currentSong.id || currentSong.videoId)) : -1;
      const insertIdx = curIdx >= 0 ? curIdx + 1 : 0;
      const nextQ = [...filtered];
      nextQ.splice(insertIdx, 0, song);
      showToast('Playing next');
      return nextQ;
    });
  }, [currentSong, showToast]);

  const handleSaveQueueAsPlaylist = useCallback(async () => {
    if (!queue || queue.length === 0) {
      showToast('Queue is empty');
      return;
    }
    const name = `Queue Mix (${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})`;
    const newPlaylist = {
      id: `pl_${Date.now()}`,
      name,
      songs: [...queue],
      songsCount: queue.length,
      coverUrl: queue[0]?.thumbnail || '',
      createdAt: new Date().toISOString()
    };
    setPlaylists(prev => [newPlaylist, ...prev]);
    showToast(`Saved ${queue.length} tracks as "${name}"`);
  }, [queue, showToast]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      try {
        if (next) {
          playerRef.current?.mute?.();
        } else {
          playerRef.current?.unMute?.();
        }
      } catch (e) {}
      showToast(next ? 'Muted' : 'Unmuted');
      return next;
    });
  }, [showToast]);

  const seekRelative = useCallback((deltaSec) => {
    try {
      const cur = playerRef.current?.getCurrentTime ? playerRef.current.getCurrentTime() : currentTimeRef.current || 0;
      const dur = playerRef.current?.getDuration ? playerRef.current.getDuration() : 0;
      const target = Math.max(0, Math.min(cur + deltaSec, dur || 999999));
      handleSeek(target);
      showToast(`${deltaSec > 0 ? '+' : ''}${deltaSec}s`);
    } catch (e) {}
  }, [handleSeek, showToast]);

  const adjustVolume = useCallback((deltaPercent) => {
    setVolume(prev => {
      const next = Math.max(0, Math.min(100, Math.round(prev + deltaPercent * 100)));
      try {
        playerRef.current?.setVolume?.(next);
      } catch (e) {}
      showToast(`Volume: ${next}%`);
      return next;
    });
  }, [showToast]);

  const toggleDataSaver = useCallback(() => {
    setIsDataSaverEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('loopra_datasaver', String(next));
      } catch (e) {}
      showToast(next ? 'Data Saver enabled' : 'Data Saver disabled');
      return next;
    });
  }, [showToast]);

  const handleFindSimilar = useCallback((track, e) => {
    if (e) e.stopPropagation();
    if (!track) return;
    setSimilarSongsTrack(track);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        adjustVolume(0.05);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        adjustVolume(-0.05);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleNextSong();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePrevSong();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setIsLyricsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, seekRelative, adjustVolume, toggleMute, handleNextSong, handlePrevSong]);

  // Native Android WebView & Floating Overlay Controller Bridge
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Report playback state to Android native host
    try {
      window.LoopraAndroid?.setPlaybackState?.(Boolean(isPlaying));
    } catch (_) {}

    // Report track info to Android notification player
    try {
      window.LoopraAndroid?.updateTrackInfo?.(
        currentSong?.title || 'Loopra',
        currentSong?.artist || 'Playing music',
        Boolean(isPlaying)
      );
    } catch (_) {}

    // Report video mode state to Android native host
    try {
      window.LoopraAndroid?.setVideoMode?.(Boolean(videoModalSong));
    } catch (_) {}

    // Report back-navigation ability to Android native host
    try {
      const hasBackAction = Boolean(
        showQueuePanel ||
        (videoModalSong && !isPipActive) ||
        isCanvasOpen ||
        showAuthModal ||
        isCreatePlaylistModalOpen ||
        renameModalPlaylist ||
        deleteModalPlaylist ||
        activeAssistantPanel ||
        (isSidebarOpen && isMobileScreen) ||
        isPlaylistModalOpen ||
        Boolean(similarSongsTrack) ||
        isLyricsOpen ||
        isSleepTimerOpen ||
        isPlayerSettingsOpen ||
        isStatsOpen ||
        isProfileOpen ||
        isRatingModalOpen ||
        canGoBack(navigationStack, activeTab, { showAllTrending, showAllArtists, showAllAlbums, showAllRadio, selectedPlaylistForView, offlineSubView })
      );
      window.LoopraAndroid?.setCanGoBack?.(hasBackAction);
    } catch (_) {}
  }, [
    isPlaying,
    currentSong,
    videoModalSong,
    showQueuePanel,
    isPipActive,
    isCanvasOpen,
    showAuthModal,
    renameModalPlaylist,
    deleteModalPlaylist,
    activeAssistantPanel,
    isSidebarOpen,
    isMobileScreen,
    isPlaylistModalOpen,
    similarSongsTrack,
    isLyricsOpen,
    isSleepTimerOpen,
    isPlayerSettingsOpen,
    isStatsOpen,
    isProfileOpen,
    isRatingModalOpen,
    navigationStack,
    activeTab,
    showAllTrending,
    showAllArtists,
    showAllAlbums,
    showAllRadio,
    selectedPlaylistForView,
    offlineSubView
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleNativeControl = (e) => {
      const action = e.detail;
      if (action === 'toggle') {
        togglePlayPause();
      } else if (action === 'next') {
        handleNextSong();
      } else if (action === 'prev') {
        handlePrevSong();
      } else if (action === 'back') {
        handleGoBack();
      }
    };

    window.addEventListener('loopra-native-control', handleNativeControl);
    return () => {
      window.removeEventListener('loopra-native-control', handleNativeControl);
    };
  }, [togglePlayPause, handleNextSong, handlePrevSong, handleGoBack]);

  // Deep-link authentication listener & redirect result handler for Android Custom Tab / TWA OAuth redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const processLoginToken = async (token) => {
      if (!token) return;
      try {
        setAuthLoading(true);
        setAuthToken(token);

        const res = await fetch(getApiUrl('/api/auth/me'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const parsed = await safeParseJsonResponse(res, 'Profile fetch failed');
        if (parsed.ok && parsed.data?.user) {
          const u = parsed.data.user;
          const loggedInUser = {
            username: u.username,
            userId: u.userId || u._id,
            displayName: u.displayName || u.username,
            avatarUrl: u.avatarUrl || '',
            role: u.role || 'user',
            status: u.status || 'active'
          };
          setUser(loggedInUser);
          setTabAuthSession(token, loggedInUser);

          const userLiked = u.likedSongs || [];
          setLikedSongs(sanitizeList(userLiked));
          localStorage.setItem('liked_songs', JSON.stringify(sanitizeList(userLiked)));

          const userHistory = (u.history || []).slice(0, 50);
          setHistory(sanitizeList(userHistory));
          localStorage.setItem('history_songs', JSON.stringify(sanitizeList(userHistory)));

          const userPlaylists = u.playlists || [];
          setPlaylists(sanitizeList(userPlaylists));
          localStorage.setItem('playlists', JSON.stringify(sanitizeList(userPlaylists)));

          const userQueue = u.queue || [];
          setQueue(sanitizeList(userQueue));
          localStorage.setItem('afterhours_queue', JSON.stringify(sanitizeList(userQueue)));

          closeAuthModal(true);
          showToast?.(`Welcome back, ${loggedInUser.displayName || loggedInUser.username}!`);
        }
      } catch (err) {
        console.warn('[OAuth Redirect Result Error]:', err.message);
      } finally {
        setAuthLoading(false);
      }
    };

    // 1. Check if returning from redirect with token in query params (?token=... or ?credential=...)
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get('token') || searchParams.get('credential');
      if (urlToken) {
        // Clean up URL so token is not exposed in address bar history
        const cleanUrl = window.location.pathname + (window.location.hash || '');
        window.history.replaceState({}, document.title, cleanUrl);
        processLoginToken(urlToken);
      }
    } catch (_) {}

    // 2. Listen to native Android bridge custom event
    const handleAuthToken = (e) => {
      const token = e.detail?.token;
      if (token) {
        processLoginToken(token);
      }
    };

    window.addEventListener('loopra-auth-token', handleAuthToken);
    return () => {
      window.removeEventListener('loopra-auth-token', handleAuthToken);
    };
  }, [closeAuthModal, showToast]);



  const isSongLiked = useCallback((song) => {
    if (!song) return false;
    const songId = song.id || song.videoId;
    return likedSongs.some(s => s.id === songId || (s.videoId && s.videoId === songId) || (song.videoId && s.id === song.videoId));
  }, [likedSongs]);

  const toggleLike = useCallback((song) => {
    if (!song) return;
    if (!user) { openAuthModal(); return; }
    const songId = song.id || song.videoId;
    setLikedSongs(prev => {
      const isAlreadyLiked = prev.some(s => s.id === songId || (s.videoId && s.videoId === songId) || (song.videoId && s.id === song.videoId));
      showToast(isAlreadyLiked ? 'Removed from favourites' : 'Added to favourites');
      const normalizedSong = { ...song, id: songId, videoId: songId };

      if (!isAlreadyLiked && authToken) {
        recommendationsClient.logListeningEvent(BACKEND_URL, authToken, {
          trackId: songId,
          title: song?.title || 'Unknown Track',
          artist: song?.artist || song?.channel || 'Unknown Artist',
          thumbnail: getCleanThumbnail(song),
          eventType: 'like',
          source: activeTab || 'favourites'
        });

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          fetch(getApiUrl('/api/activity/log'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              type: 'like',
              track: {
                id: songId,
                videoId: songId,
                title: song?.title || 'Unknown Track',
                artist: song?.artist || song?.channel || 'Unknown Artist',
                albumArt: getCleanThumbnail(song)
              }
            }),
            signal: controller.signal
          }).then(() => clearTimeout(timeoutId)).catch(() => clearTimeout(timeoutId));
        } catch (e) {}
      } else if (isAlreadyLiked && authToken) {
        learningIntelligenceClient.recordEvent(BACKEND_URL, authToken, {
          category: 'music',
          eventType: 'unlike',
          metadata: {
            trackId: songId,
            songTitle: song?.title || 'Unknown Track',
            artistName: song?.artist || song?.channel || 'Unknown Artist',
            source: activeTab || 'favourites'
          }
        });
      }

      return isAlreadyLiked 
        ? prev.filter(s => s.id !== songId && (!s.videoId || s.videoId !== songId) && (!song.videoId || s.id !== song.videoId)) 
        : [normalizedSong, ...prev];
    });
  }, [user, authToken, BACKEND_URL, activeTab, showToast, openAuthModal]);

  useEffect(() => {
    toggleLikeRef.current = toggleLike;
  }, [toggleLike]);

  const handleAddToPlaylistClick = (song, e) => {
    e?.stopPropagation();
    setSelectedSongForPlaylist(song);
    setSelectedModalRoomIds([]);
    setSelectedModalPlaylistIds([]);
    setIsPlaylistModalOpen(true);
  };

  const handleCreatePlaylist = (e) => {
    e?.preventDefault();
    if (!newPlaylistName.trim()) return;
    const songToAdd = selectedSongForPlaylist ? {
      ...selectedSongForPlaylist,
      id: selectedSongForPlaylist.id || selectedSongForPlaylist.videoId,
      videoId: selectedSongForPlaylist.videoId || selectedSongForPlaylist.id
    } : null;
    const newPlaylist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      songs: songToAdd ? [songToAdd] : []
    };
    const updatedPlaylists = [...playlists, newPlaylist];
    setPlaylists(updatedPlaylists);
    try {
      if (user) {
        localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
      } else {
        localStorage.setItem('guest_playlists', JSON.stringify(updatedPlaylists));
      }
    } catch (e) {}

    if (authToken) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        fetch(getApiUrl('/api/activity/log'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            type: 'playlist_create',
            playlist: {
              id: newPlaylist.id,
              name: newPlaylist.name
            }
          }),
          signal: controller.signal
        }).then(() => clearTimeout(timeoutId)).catch(() => clearTimeout(timeoutId));
      } catch (e) {}
    }
    showToast(`Created playlist "${newPlaylistName.trim()}"`);
    setNewPlaylistName('');
    if (selectedSongForPlaylist) {
      setIsPlaylistModalOpen(false);
      setSelectedSongForPlaylist(null);
    }
  };

  const handleAddSongToExistingPlaylist = (playlistId) => {
    if (!selectedSongForPlaylist) return;
    const songToAdd = {
      ...selectedSongForPlaylist,
      id: selectedSongForPlaylist.id || selectedSongForPlaylist.videoId,
      videoId: selectedSongForPlaylist.videoId || selectedSongForPlaylist.id
    };
    let added = false;
    let targetName = 'playlist';
    const updatedPlaylists = playlists.map(pl => {
      if (pl.id === playlistId) {
        targetName = pl.name;
        const exists = pl.songs.some(s => (s.id || s.videoId) === (songToAdd.id || songToAdd.videoId));
        if (!exists) {
          added = true;
          return { ...pl, songs: [...pl.songs, songToAdd] };
        }
      }
      return pl;
    });

    if (added) {
      setPlaylists(updatedPlaylists);
      try {
        if (user) {
          localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
        } else {
          localStorage.setItem('guest_playlists', JSON.stringify(updatedPlaylists));
        }
      } catch (e) {}

      if (authToken) {
        learningIntelligenceClient.recordEvent(BACKEND_URL, authToken, {
          category: 'music',
          eventType: 'playlist_add',
          metadata: {
            trackId: songToAdd.id || songToAdd.videoId,
            songTitle: songToAdd.title,
            artistName: songToAdd.artist || songToAdd.channel,
            playlistName: targetName
          }
        });
      }

      showToast(`Added to "${targetName}"`);
    } else {
      showToast('Track already in playlist');
    }
    setIsPlaylistModalOpen(false);
    setSelectedSongForPlaylist(null);
  };

  const handleAddSongToRoomPlaylist = (targetRoomId, targetPlaylistId, song) => {
    const songToAdd = song || selectedSongForPlaylist;
    if (!songToAdd || !targetRoomId || !targetPlaylistId) return;

    const formattedTrack = {
      ...songToAdd,
      id: songToAdd.id || songToAdd.videoId,
      videoId: songToAdd.videoId || songToAdd.id
    };

    // Optimistic local update of room playlists
    setRoomPlaylists(prev => (prev || []).map(pl => {
      if (pl.id === targetPlaylistId) {
        const exists = (pl.songs || []).some(s => (s.id || s.videoId) === (formattedTrack.id || formattedTrack.videoId));
        if (!exists) {
          return { ...pl, songs: [...(pl.songs || []), formattedTrack] };
        }
      }
      return pl;
    }));

    // Emit over socket for instant real-time broadcast
    if (socket) {
      socket.emit('room:playlist:add_song', {
        roomId: targetRoomId,
        playlistId: targetPlaylistId,
        song: formattedTrack,
        user
      }, (resp) => {
        if (resp?.alreadyExists) {
          showToast('Track already in room playlist');
        } else if (resp?.success) {
          showToast(`Added to Room Playlist: "${resp.playlist?.name || 'Playlist'}"`);
        }
      });
    }

    // Call REST endpoint for durable persistence
    fetch(`/api/rooms/${encodeURIComponent(targetRoomId)}/playlists/${encodeURIComponent(targetPlaylistId)}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song: formattedTrack, user })
    })
      .then(res => res.json())
      .then(data => {
        if (data?.alreadyExists) {
          showToast('Track already in room playlist');
        } else if (data?.success && data?.playlists) {
          setRoomPlaylists(data.playlists);
          showToast(`Added to Room Playlist`);
        }
      })
      .catch(() => {});

    setIsPlaylistModalOpen(false);
    setSelectedSongForPlaylist(null);
  };

  const handleConfirmAddToSelectedTargets = async () => {
    if (!selectedSongForPlaylist || isSavingPlaylistTargets) return;
    const totalSelected = selectedModalRoomIds.length + selectedModalPlaylistIds.length;
    if (totalSelected === 0) return;

    setIsSavingPlaylistTargets(true);
    const songToAdd = {
      ...selectedSongForPlaylist,
      id: selectedSongForPlaylist.id || selectedSongForPlaylist.videoId,
      videoId: selectedSongForPlaylist.videoId || selectedSongForPlaylist.id
    };
    const songId = songToAdd.id || songToAdd.videoId;

    let addedPlaylists = 0;
    let alreadyPresentPlaylists = 0;
    const addedPlaylistNames = [];

    if (selectedModalPlaylistIds.length > 0) {
      const selectedSet = new Set(selectedModalPlaylistIds.map(String));
      const updatedPlaylists = playlists.map(pl => {
        if (!selectedSet.has(String(pl.id))) return pl;
        const exists = pl.songs.some(s => (s.id || s.videoId) === songId);
        if (exists) {
          alreadyPresentPlaylists++;
          return pl;
        }
        addedPlaylists++;
        addedPlaylistNames.push(pl.name);
        return { ...pl, songs: [...pl.songs, songToAdd] };
      });

      if (addedPlaylists > 0) {
        setPlaylists(updatedPlaylists);
        try {
          if (user) {
            localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
          } else {
            localStorage.setItem('guest_playlists', JSON.stringify(updatedPlaylists));
          }
        } catch (e) {}

        if (authToken) {
          addedPlaylistNames.forEach(playlistName => {
            learningIntelligenceClient.recordEvent(BACKEND_URL, authToken, {
              category: 'music',
              eventType: 'playlist_add',
              metadata: {
                trackId: songId,
                songTitle: songToAdd.title,
                artistName: songToAdd.artist || songToAdd.channel,
                playlistName
              }
            });
          });
        }
      }
    }

    let addedRooms = 0;
    let failedRooms = 0;
    if (selectedModalRoomIds.length > 0) {
      const availableRooms = modalRooms.length > 0 ? modalRooms : (activeRoom ? [activeRoom] : []);
      for (const chosenRoomId of selectedModalRoomIds) {
        const chosenRoom = availableRooms.find(rm => String(rm.roomId || rm.id) === String(chosenRoomId));
        try {
          let targetPlId = chosenRoom?.playlists?.[0]?.id;
          if (!targetPlId && activeRoom && String(activeRoom.roomId || activeRoom.id) === String(chosenRoomId)) {
            targetPlId = roomPlaylists?.[0]?.id;
          }
          if (!targetPlId) {
            const createRes = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(chosenRoomId)}/playlists`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({ name: 'Room Queue', description: 'Collaborative room tracks' })
            });
            const createData = await createRes.json().catch(() => ({}));
            targetPlId = createData?.playlist?.id || createData?.id;
          }
          if (targetPlId) {
            const addRes = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(chosenRoomId)}/playlists/${encodeURIComponent(targetPlId)}/songs`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({ song: songToAdd })
            });
            if (addRes.ok) {
              addedRooms++;
            } else {
              failedRooms++;
            }
          } else {
            failedRooms++;
          }
        } catch (_) {
          failedRooms++;
        }
      }
    }

    const totalAdded = addedPlaylists + addedRooms;
    if (totalAdded > 0 && alreadyPresentPlaylists > 0) {
      showToast?.(`Added to ${totalAdded} target(s); ${alreadyPresentPlaylists} already had this track`);
    } else if (totalAdded > 0) {
      showToast?.(`Added to ${totalAdded} selected target${totalAdded === 1 ? '' : 's'}`);
    } else if (alreadyPresentPlaylists > 0 && failedRooms === 0) {
      showToast?.('Track already in selected playlist(s)');
    } else if (failedRooms > 0) {
      showToast?.('Failed to add song to selected room(s)', 'error');
    }

    setIsSavingPlaylistTargets(false);
    setSelectedModalRoomIds([]);
    setSelectedModalPlaylistIds([]);
    setIsPlaylistModalOpen(false);
    setSelectedSongForPlaylist(null);
  };

  const handleRemoveSongFromPlaylist = (playlistId, trackId) => {
    if (!playlistId || !trackId) return;
    const targetSongId = trackId;
    let removed = false;
    let targetName = 'playlist';

    const updatedPlaylists = playlists.map(pl => {
      if (pl.id === playlistId) {
        targetName = pl.name;
        const filteredSongs = pl.songs.filter(s => (s.id || s.videoId) !== targetSongId);
        if (filteredSongs.length !== pl.songs.length) {
          removed = true;
          return { ...pl, songs: filteredSongs };
        }
      }
      return pl;
    });

    if (removed) {
      setPlaylists(updatedPlaylists);
      if (selectedPlaylistForView && selectedPlaylistForView.id === playlistId) {
        setSelectedPlaylistForView(prev => prev ? { ...prev, songs: prev.songs.filter(s => (s.id || s.videoId) !== targetSongId) } : null);
      }
      try {
        if (user) {
          localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
        } else {
          localStorage.setItem('guest_playlists', JSON.stringify(updatedPlaylists));
        }
      } catch (e) {}
      showToast(`Removed from "${targetName}"`);
    }
  };

  const openCreatePlaylistModal = () => {
    setCreateModalPlaylistName('');
    setIsCreatePlaylistModalOpen(true);
    setPlaylistMenuOpenId(null);
  };

  const handleSaveCreatePlaylist = (e) => {
    if (e) e.preventDefault();
    const trimmed = (createModalPlaylistName || '').trim();
    if (!trimmed) return;

    const newPlaylist = {
      id: Date.now().toString(),
      name: trimmed,
      songs: []
    };
    const updatedPlaylists = [...playlists, newPlaylist];
    setPlaylists(updatedPlaylists);
    try {
      if (user) {
        localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
      } else {
        localStorage.setItem('guest_playlists', JSON.stringify(updatedPlaylists));
      }
    } catch (err) {}

    if (authToken) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        fetch(getApiUrl('/api/activity/log'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            type: 'playlist_create',
            playlist: {
              id: newPlaylist.id,
              name: newPlaylist.name
            }
          }),
          signal: controller.signal
        }).then(() => clearTimeout(timeoutId)).catch(() => clearTimeout(timeoutId));
      } catch (_) {}
    }

    showToast(`Created playlist "${trimmed}"`);
    setCreateModalPlaylistName('');
    setIsCreatePlaylistModalOpen(false);
  };

  const openRenamePlaylistModal = (playlist) => {
    if (!playlist) return;
    setRenameModalPlaylist(playlist);
    setRenameModalName(playlist.name || '');
    setPlaylistMenuOpenId(null);
  };

  const handleSaveRenamePlaylist = (e) => {
    if (e) e.preventDefault();
    if (!renameModalPlaylist) return;
    const trimmed = (renameModalName || '').trim();
    if (!trimmed) return;

    const playlistId = renameModalPlaylist.id;
    const updatedPlaylists = playlists.map(p => p.id === playlistId ? { ...p, name: trimmed } : p);
    setPlaylists(updatedPlaylists);
    if (selectedPlaylistForView && selectedPlaylistForView.id === playlistId) {
      setSelectedPlaylistForView(prev => prev ? { ...prev, name: trimmed } : null);
    }
    try {
      if (user) {
        localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
      } else {
        localStorage.setItem('guest_playlists', JSON.stringify(updatedPlaylists));
      }
    } catch (err) {}
    showToast(`Renamed playlist to "${trimmed}"`);
    setRenameModalPlaylist(null);
    setRenameModalName('');
  };

  const openDeletePlaylistModal = (playlist) => {
    if (!playlist) return;
    setDeleteModalPlaylist(playlist);
    setPlaylistMenuOpenId(null);
  };

  const handleConfirmDeletePlaylist = () => {
    if (!deleteModalPlaylist) return;
    const playlistId = deleteModalPlaylist.id;
    const targetName = deleteModalPlaylist.name || 'Playlist';

    const updatedPlaylists = playlists.filter(p => p.id !== playlistId);
    setPlaylists(updatedPlaylists);
    if (selectedPlaylistForView && selectedPlaylistForView.id === playlistId) {
      setSelectedPlaylistForView(null);
    }
    try {
      if (user) {
        localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
      } else {
        localStorage.setItem('guest_playlists', JSON.stringify(updatedPlaylists));
      }
    } catch (err) {}
    showToast(`Deleted playlist "${targetName}"`);
    setDeleteModalPlaylist(null);
  };

  const handleDeletePlaylist = (playlistId) => {
    if (!playlistId) return;
    const targetPl = playlists.find(p => p.id === playlistId);
    if (targetPl) {
      openDeletePlaylistModal(targetPl);
    }
  };

  const handleSaveSharedPlaylistToLibrary = useCallback((sharedPl) => {
    if (!sharedPl) return;
    const targetName = sharedPl.name || 'Shared Playlist';
    const songsToSave = Array.isArray(sharedPl.songs) ? sanitizeList(sharedPl.songs) : [];

    // Check if user already has a playlist with the exact same name or ID
    const alreadySaved = playlists.some(p => p.id === sharedPl.id || p.name.toLowerCase() === targetName.toLowerCase());

    const playlistEntry = {
      id: sharedPl.id || `pl_${Date.now()}`,
      name: alreadySaved ? `${targetName} (Saved)` : targetName,
      songs: songsToSave,
      isShared: false
    };

    const updatedPlaylists = [...playlists, playlistEntry];
    setPlaylists(updatedPlaylists);

    try {
      if (user) {
        localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
      } else {
        localStorage.setItem('guest_playlists', JSON.stringify(updatedPlaylists));
      }
    } catch (_) {}

    // Update active view to reflect saved local copy
    setSelectedPlaylistForView(playlistEntry);

    // Notify backend save-count endpoint non-blockingly
    try {
      if (sharedPl.id) {
        fetch(getApiUrl(`/api/user/shared-playlist/${encodeURIComponent(sharedPl.id)}/save-count`), {
          method: 'POST'
        }).catch(() => {});
      }
    } catch (_) {}

    showToast(`Saved "${playlistEntry.name}" (${songsToSave.length} tracks) to your Library!`);
  }, [playlists, user, showToast]);

  const handleSharePlaylist = useCallback(async (playlist) => {
    if (!playlist) return;
    const plId = playlist.id || `pl_${Date.now()}`;
    const plName = playlist.name || 'Loopra Playlist';
    const songsList = Array.isArray(playlist.songs) ? playlist.songs : [];

    // Ensure playlist is published to shared backend registry so deep link always resolves
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      fetch(getApiUrl('/api/user/playlist/share'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: plId,
          name: plName,
          songs: songsList
        })
      }).catch(err => console.warn('[Share publish warning]:', err));
    } catch (_) {}

    const shareUrl = `${window.location.origin}?playlist=${encodeURIComponent(plId)}`;
    const shareTitle = `${plName} - Loopra Playlist`;
    const shareText = `Check out the "${plName}" playlist on Loopra with ${songsList.length} tracks!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
      } catch (_) {
        // Fallback to clipboard if share was aborted or failed
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          showToast("Playlist link copied to clipboard!");
        }
      }
    } else {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Playlist link copied to clipboard!");
      } else {
        showToast(`Share URL: ${shareUrl}`);
      }
    }
  }, [authToken, showToast]);

  const handleRenamePlaylist = (playlistId) => {
    if (!playlistId) return;
    const targetPl = playlists.find(p => p.id === playlistId);
    if (targetPl) {
      openRenamePlaylistModal(targetPl);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('history_songs');
  };

  const fetchYouTubeMusic = async (q) => {
    const trimmedQuery = q.trim().toLowerCase();
    if (!trimmedQuery) return;

    // Abort any prior in-flight search request immediately to prevent race conditions
    if (activeSearchAbortControllerRef.current) {
      try {
        activeSearchAbortControllerRef.current.abort();
      } catch (_) {}
    }
    const searchController = new AbortController();
    activeSearchAbortControllerRef.current = searchController;

    const currentReqId = ++searchRequestIdRef.current;
    activeSearchQueryRef.current = trimmedQuery;
    setHasSearched(true);
    setSearchError('');
    setSearchLoadMoreError('');
    setIsLoadingMoreSearch(false);

    if (authToken) {
      learningIntelligenceClient.recordEvent(BACKEND_URL, authToken, {
        category: 'discovery',
        eventType: 'search',
        metadata: { searchQuery: trimmedQuery }
      });
    }

    // 1. Instant Cache Hit: Return cached search results in 0ms (In-Memory MapRef -> sessionStorage -> state)
    let mapEntry = searchCacheMapRef.current.get(trimmedQuery);
    if (!mapEntry && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const rawSession = sessionStorage.getItem(`loopra_search_cache_${trimmedQuery}`);
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
            mapEntry = parsed;
            searchCacheMapRef.current.set(trimmedQuery, parsed);
          }
        }
      } catch (_) {}
    }
        const cachedEntry = mapEntry || searchCache[trimmedQuery];
    if (cachedEntry && !Array.isArray(cachedEntry) && Array.isArray(cachedEntry.items) && cachedEntry.items.length > 0) {
      // Re-validate cached items to ensure non-music tracks never leak from storage/cache
      const cleanCachedItems = cachedEntry.items.filter(t => isValidMusicTrack(t));
      if (cleanCachedItems.length === 0) {
        searchCacheMapRef.current.delete(trimmedQuery);
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.removeItem(`loopra_search_cache_${trimmedQuery}`);
          }
        } catch (_) {}
      } else {
        const validatedEntry = { ...cachedEntry, items: cleanCachedItems };
        if (!mapEntry || cleanCachedItems.length !== cachedEntry.items.length) {
          searchCacheMapRef.current.set(trimmedQuery, validatedEntry);
        }
        setSearchResults(cleanCachedItems);
        setSearchVisibleCount(cleanCachedItems.length);
        setSearchNextPageToken(validatedEntry.nextPageToken || null);
        setHasMoreSearchResults(Boolean(validatedEntry.nextPageToken));
        setIsLoading(false);
        return;
      }
    }

    // Give immediate visual loading feedback without blocking new searches
    setIsLoading(true);
    try {
      const data = await fetchFromBackend(trimmedQuery, {
        limit: 25,
        timeoutMs: 8000,
        signal: searchController.signal
      });

      // Stale response guard: Ignore if user has initiated a newer search or query changed
      if (currentReqId !== searchRequestIdRef.current || activeSearchQueryRef.current !== trimmedQuery) return;

      if (data && Array.isArray(data.items) && data.items.length > 0) {
        const fetchedTracks = data.items.map(item => {
          const vid = item.id?.videoId || (typeof item.id === 'string' ? item.id : null) || item.videoId;
          const { title, artist } = sanitizeTrackMetadata(item.snippet?.title || 'Untitled', item.snippet?.channelTitle || 'Unknown Artist');
          const durSec = parseDurationToSeconds(item);
          const formattedDur = durSec ? `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}` : (typeof item.duration === 'string' ? item.duration : '3:45');
          return {
            id: vid,
            videoId: vid,
            title,
            channel: artist,
            artist,
            duration: formattedDur,
            durationSec: durSec || undefined,
            thumbnail: getCleanThumbnail(item, vid),
          };
        }).filter(t => t.id && typeof t.id === 'string' && t.id.length >= 5 && isValidMusicTrack(t));

        // Deduplicate using stable YouTube ID
        const seen = new Set();
        const uniqueTracks = fetchedTracks.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });

        const nextToken = data.nextPageToken || null;
        setSearchResults(uniqueTracks);
        setSearchVisibleCount(uniqueTracks.length);
        setSearchNextPageToken(nextToken);
        setHasMoreSearchResults(Boolean(nextToken));

        if (uniqueTracks.length > 0) {
          const newCacheEntry = {
            items: uniqueTracks,
            nextPageToken: nextToken
          };
          searchCacheMapRef.current.set(trimmedQuery, newCacheEntry);
          try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
              sessionStorage.setItem(`loopra_search_cache_${trimmedQuery}`, JSON.stringify(newCacheEntry));
            }
          } catch (_) {}
          setSearchCache(prev => ({
            ...prev,
            [trimmedQuery]: newCacheEntry
          }));
        }
      } else {
        setSearchResults([]);
        setSearchVisibleCount(0);
        setSearchNextPageToken(null);
        setHasMoreSearchResults(false);
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        // Cleanly aborted by newer query - do not show error or alter state
        return;
      }

      if (currentReqId === searchRequestIdRef.current && activeSearchQueryRef.current === trimmedQuery) {
        console.warn("[Search Notice]:", err.message);
        setSearchError(err.message?.includes('timed out') ? 'Search timed out. Please retry in a moment.' : (err.message || 'Unable to connect to search service. Please try again.'));
        setSearchResults([]);
        setSearchVisibleCount(0);
        setSearchNextPageToken(null);
        setHasMoreSearchResults(false);
      }
    } finally {
      if (currentReqId === searchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleLoadMoreSearchResults = async () => {
    if (isLoadingMoreSearch || isLoading) return;
    const currentToken = searchNextPageToken;
    const currentQuery = activeSearchQueryRef.current || searchQuery.trim().toLowerCase();
    if (!currentQuery) return;
    if (!currentToken) {
      setHasMoreSearchResults(false);
      return;
    }

    setIsLoadingMoreSearch(true);
    setSearchLoadMoreError('');

    try {
      const data = await fetchFromBackend(currentQuery, {
        limit: 15,
        pageToken: currentToken
      });

      // If active search query changed while this request was in flight, ignore
      if (activeSearchQueryRef.current !== currentQuery) return;

      const rawItems = Array.isArray(data?.items) ? data.items : [];
      const fetchedTracks = rawItems.map(item => {
        const vid = item.id?.videoId || (typeof item.id === 'string' ? item.id : null) || item.videoId;
        const { title, artist } = sanitizeTrackMetadata(item.snippet?.title || 'Untitled', item.snippet?.channelTitle || 'Unknown Artist');
        const durSec = parseDurationToSeconds(item);
        const formattedDur = durSec ? `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}` : (typeof item.duration === 'string' ? item.duration : '3:45');
        return {
          id: vid,
          videoId: vid,
          title,
          channel: artist,
          artist,
          duration: formattedDur,
          durationSec: durSec || undefined,
          thumbnail: getCleanThumbnail(item, vid),
        };
      }).filter(t => t.id && typeof t.id === 'string' && t.id.length >= 5 && isValidMusicTrack(t));

      const nextToken = data.nextPageToken || null;

      if (fetchedTracks.length === 0) {
        // Empty batch unexpectedly returned: stop pagination loop safely
        setSearchNextPageToken(null);
        setHasMoreSearchResults(false);
      } else {
        setSearchResults(prev => {
          const existingIds = new Set(prev.map(t => t.id || t.videoId).filter(Boolean));
          const newUnique = fetchedTracks.filter(t => !existingIds.has(t.id));
          const updated = [...prev, ...newUnique];
          setSearchVisibleCount(updated.length);

          // Update cache with accumulated results and latest continuation token
          const updatedCacheEntry = {
            items: updated,
            nextPageToken: nextToken
          };
          searchCacheMapRef.current.set(currentQuery, updatedCacheEntry);
          setSearchCache(cachePrev => ({
            ...cachePrev,
            [currentQuery]: updatedCacheEntry
          }));

          return updated;
        });

        setSearchNextPageToken(nextToken);
        setHasMoreSearchResults(Boolean(nextToken));
      }
    } catch (err) {
      console.warn("[Load More Search Error]:", err.message);
      setSearchLoadMoreError(err.message || 'Failed to load more songs. Tap to retry.');
    } finally {
      setIsLoadingMoreSearch(false);
    }
  };
  fetchYouTubeMusicRef.current = fetchYouTubeMusic;

  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    handleStationSelect('discover', { q: trimmed });
    fetchYouTubeMusic(trimmed);
  };

  const handleSearchFromHome = (queryText) => {
    const trimmed = (queryText || '').trim();
    if (!trimmed) return;
    setSearchQuery(trimmed);
    handleStationSelect('discover', { q: trimmed });
    fetchYouTubeMusic(trimmed);
  };

  const initialSearchExecutedRef = useRef(false);
  const initialRoomCheckedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('q') || '').trim();
    if (!initialSearchExecutedRef.current && q) {
      initialSearchExecutedRef.current = true;
      fetchYouTubeMusic(q);
    }

    // Room URL share link e.g. ?room=room_123 or ?roomCode=XYZ (Direct Active Room View)
    const roomParam = (params.get('room') || params.get('roomCode') || '').trim();
    if (!initialRoomCheckedRef.current && roomParam) {
      initialRoomCheckedRef.current = true;
      // Prompt to log in if unauthenticated, or navigate to rooms
      if (!user) {
        showToast?.('Please sign in to view and join Collaborative Rooms', 'warning');
        openAuthModal?.();
      } else {
        setActiveTab('rooms');
        setIsSidebarOpen(false);
      }
    }
  }, []);

  // Single navStateRef tracking all active views and handlers
  const navStateRef = useRef({
    isVideoOpen: false,
    isExpandedPlayer: false,
    showQueue: false,
    showQueuePanel: false,
    isCanvasOpen: false,
    showAuthModal: false,
    isSidebarOpen: false,
    isMobileScreen: false,
    isPlaylistModalOpen: false,
    similarSongsTrack: null,
    isLyricsOpen: false,
    isSleepTimerOpen: false,
    isPlayerSettingsOpen: false,
    isStatsOpen: false,
    isProfileOpen: false,
    isRatingModalOpen: false,
    selectedPlaylistForView: null,
    offlineSubView: 'library',
    activeTab: 'home',
    handleCloseVideo: null,
    closeExpandedPlayer: null,
    handleGoBack: null
  });

  useEffect(() => {
    navStateRef.current = {
      isVideoOpen: Boolean(videoModalSong && !isPipActive),
      isExpandedPlayer: Boolean(showQueuePanel && mobileQueueTab === 'player'),
      showQueue: Boolean(showQueuePanel && mobileQueueTab === 'queue'),
      showQueuePanel: Boolean(showQueuePanel),
      isCanvasOpen: Boolean(isCanvasOpen),
      showAuthModal: Boolean(showAuthModal),
      isSidebarOpen: Boolean(isSidebarOpen && isMobileScreen),
      isMobileScreen: Boolean(isMobileScreen),
      renameModalPlaylist,
      deleteModalPlaylist,
      activeAssistantPanel,
      isPlaylistModalOpen: Boolean(isPlaylistModalOpen),
      similarSongsTrack,
      isLyricsOpen: Boolean(isLyricsOpen),
      isSleepTimerOpen: Boolean(isSleepTimerOpen),
      isPlayerSettingsOpen: Boolean(isPlayerSettingsOpen),
      isStatsOpen: Boolean(isStatsOpen),
      isProfileOpen: Boolean(isProfileOpen),
      isRatingModalOpen: Boolean(isRatingModalOpen),
      selectedPlaylistForView,
      offlineSubView,
      activeTab,
      showAllTrending: Boolean(showAllTrending),
      showAllArtists: Boolean(showAllArtists),
      showAllAlbums: Boolean(showAllAlbums),
      showAllRadio: Boolean(showAllRadio),
      handleCloseVideo,
      closeExpandedPlayer,
      handleGoBack,
      setShowQueue: (val) => setShowQueuePanel(val)
    };
  });

  // Persistent history buffer for TWA / Android back gesture trapping ("History Padding Trick")
  // Keeps the WebView history stack active so Android never minimizes the app when modals/overlays are open
  const hasSubViewOrOverlayActive = Boolean(
    showQueuePanel ||
    (videoModalSong && !isPipActive) ||
    isCanvasOpen ||
    showAuthModal ||
    renameModalPlaylist ||
    deleteModalPlaylist ||
    activeAssistantPanel ||
    isPlaylistModalOpen ||
    Boolean(similarSongsTrack) ||
    isLyricsOpen ||
    isSleepTimerOpen ||
    isPlayerSettingsOpen ||
    isStatsOpen ||
    isProfileOpen ||
    isRatingModalOpen ||
    (isSidebarOpen && isMobileScreen) ||
    Boolean(selectedPlaylistForView) ||
    offlineSubView === 'explore' ||
    showAllTrending ||
    showAllArtists ||
    showAllAlbums ||
    showAllRadio
  );

  // 1. On app initialization, immediately push a base state to keep WebView history stack active
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.pushState) return;
    try {
      if (!window.history.state || (!window.history.state.loopraGuard && window.history.state.scope !== 'home')) {
        window.history.pushState({ scope: 'home', loopraGuard: true }, '', window.location.href);
      }
    } catch (_) {}
  }, []);

  // 2. Replenish history state whenever any modal or overlay opens programmatically
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.pushState) return;
    if (hasSubViewOrOverlayActive) {
      try {
        if (!window.history.state || window.history.state.scope !== 'modal') {
          window.history.pushState({ scope: 'modal', loopraGuard: true }, '', window.location.href);
        }
      } catch (_) {}
    }
  }, [hasSubViewOrOverlayActive]);

  // Double back press exit tracking on root Home
  const lastBackPressTimeRef = useRef(0);

  // 3. Global popstate event listener (hardware / gesture back button pressed)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const replenishHomeState = () => {
      try {
        window.history.pushState({ scope: 'home', loopraGuard: true }, '', window.location.href);
      } catch (_) {}
    };

    const handleSystemBack = () => {
      const state = navStateRef.current;

      // 1) Video Player is open -> close video (same as clicking video back button)
      if (state.isVideoOpen) {
        state.handleCloseVideo?.();
        replenishHomeState();
        return;
      }

      // 2) Full-Screen Audio Player is open -> close expanded player (same as clicking player back button)
      if (state.isExpandedPlayer) {
        state.closeExpandedPlayer?.();
        replenishHomeState();
        return;
      }

      // 3) Queue or any modal / playlist detail / drawer is open -> close it and replenish history padding
      if (
        state.showQueue ||
        state.showQueuePanel ||
        state.isCanvasOpen ||
        state.showAuthModal ||
        state.renameModalPlaylist ||
        state.deleteModalPlaylist ||
        state.activeAssistantPanel ||
        state.isSidebarOpen ||
        state.isPlaylistModalOpen ||
        state.similarSongsTrack ||
        state.isLyricsOpen ||
        state.isSleepTimerOpen ||
        state.isPlayerSettingsOpen ||
        state.isStatsOpen ||
        state.isProfileOpen ||
        state.isRatingModalOpen ||
        state.selectedPlaylistForView ||
        state.offlineSubView === 'explore' ||
        state.showAllTrending ||
        state.showAllArtists ||
        state.showAllAlbums ||
        state.showAllRadio
      ) {
        if (state.showQueue || state.showQueuePanel) {
          state.setShowQueue?.(false);
          state.closeExpandedPlayer?.();
        } else {
          state.handleGoBack?.();
        }
        replenishHomeState();
        return;
      }

      // 4) Not on Home view -> switch to Home view and replenish history padding
      if (state.activeTab !== 'home') {
        state.handleGoBack?.();
        replenishHomeState();
        return;
      }

      // 5) Already on the main Home view with NO player/modals open:
      // Allow exit on double-back press within 2 seconds
      const now = Date.now();
      if (now - lastBackPressTimeRef.current < 2000) {
        // Double back within 2 seconds: do NOT re-push state, allowing Android/TWA to minimize/exit cleanly
        return;
      }

      lastBackPressTimeRef.current = now;
      showToast?.('Press back again to exit', 2000);
      replenishHomeState();
    };

    window.addEventListener('popstate', handleSystemBack);

    return () => {
      window.removeEventListener('popstate', handleSystemBack);
    };
  }, [showToast]);

  const currentStation = stationsMap[activeTab] || SPECIAL_STATIONS[activeTab];
  const currentBgImage = currentStation?.bgImages?.[currentBgIndex] || currentStation?.bgImages?.[0];

  const isMaintenanceActive = Boolean(cmsConfig?.maintenance?.enabled);
  const isBlockedByMaintenance = isMaintenanceActive && !isAdmin;

  if (isBlockedByMaintenance) {
    return (
      <div className="h-[100dvh] bg-neutral-950 text-neutral-100 font-sans antialiased relative overflow-hidden">
        {showSplashScreen && (
          <AppSplashScreen
            isAppReady={isAppInitialized}
            onFinished={handleSplashFinished}
            branding={cmsConfig?.branding}
          />
        )}
        <CmsMaintenanceOverlay
          maintenance={cmsConfig?.maintenance}
          branding={cmsConfig?.branding}
          isAdmin={isAdmin}
          onOpenAdmin={() => {
            setActiveTab('admin');
            window.history.pushState(null, '', '/admin');
          }}
          onOpenAuth={openAuthModal}
        />

        {showAuthModal && (
          <div 
            className="fixed inset-0 z-[110] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeAuthModal(false); }}
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 w-full max-w-sm relative shadow-2xl">
              <button onClick={() => closeAuthModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white transition">
                <Icon name="close" className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-display font-extrabold tracking-tight text-white mb-2 text-center">
                Administrator Sign In
              </h2>
              <p className="text-xs text-neutral-400 mb-6 text-center">
                Sign in with authorized administrator credentials to manage the platform and bypass maintenance mode.
              </p>
              
              {authError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-2xl text-center">
                  {authError}
                </div>
              )}
              
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-1.5">Admin Username</label>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={authForm.username}
                    onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl bg-neutral-900/50 backdrop-blur-lg border border-neutral-800 text-white text-sm focus:outline-none focus:border-amber-500 transition"
                    placeholder="Enter admin username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-1.5">Admin Password</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl bg-neutral-900/50 backdrop-blur-lg border border-neutral-800 text-white text-sm focus:outline-none focus:border-amber-500 transition"
                    placeholder="Enter admin password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 mt-2 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 hover:shadow-amber-500/20 text-white font-medium tracking-wide text-sm transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {authLoading ? (
                    <>
                      <Icon name="sparkles" className="w-5 h-5 animate-spin" />
                      <span>{isAuthSlow ? "Connecting to server..." : "Logging in..."}</span>
                    </>
                  ) : "Log In as Admin"}
                </button>
              </form>
              
              <div className="mt-6 flex items-center justify-center gap-4">
                 <div className="h-px bg-neutral-800 flex-1"></div>
                 <span className="text-xs text-neutral-500 font-medium">OR</span>
                 <div className="h-px bg-neutral-800 flex-1"></div>
              </div>
              <div className="mt-6 flex flex-col items-center justify-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => triggerGoogleLogin()}
                  disabled={authLoading}
                  className="w-full py-3 px-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-sm border border-neutral-700/80 shadow-md flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
                {authLoading && isAuthSlow && (
                  <p className="text-[11px] text-amber-400/90 font-medium animate-pulse flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Connecting to server...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleScrollToTop = useCallback(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const isActualHomeRoute = activeTab === 'home' && !showAllTrending && !showAllArtists && !showAllAlbums && !showAllRadio;

  const commonFooterProps = {
    footer: cmsConfig?.footer,
    branding: cmsConfig?.branding,
    onNavigate: handleStationSelect,
    onOpenInsights: () => setIsStatsOpen(true),
    onOpenRatingModal: handleOpenRatingModal,
    onScrollToTop: handleScrollToTop,
    isVisible: isActualHomeRoute
  };

  return (
    <div className="h-[100dvh] bg-neutral-950 text-neutral-100 font-sans flex flex-col antialiased selection:bg-amber-500 selection:text-white relative overflow-hidden">
      <Suspense fallback={null}>
      {/* Premium 3D Infinity Startup Splash Screen */}
      {showSplashScreen && (
        <AppSplashScreen
          isAppReady={isAppInitialized}
          onFinished={handleSplashFinished}
          branding={cmsConfig?.branding}
        />
      )}

      {/* Admin Maintenance Bypass Banner */}
      {isMaintenanceActive && isAdmin && (
        <div className="fixed top-0 left-0 right-0 z-[90] bg-amber-500/20 backdrop-blur-md border-b border-amber-500/40 px-4 py-2 flex items-center justify-between text-xs text-amber-200 font-medium shadow-lg">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span><strong>Maintenance Mode Active</strong> — Public access is blocked. You have administrator bypass privileges.</span>
          </div>
          <button
            onClick={() => {
              setActiveTab('admin');
              window.history.pushState(null, '', '/admin');
            }}
            className="text-[11px] uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer"
          >
            Manage in CMS
          </button>
        </div>
      )}

      <StudioLoungeAtmosphere isPlaying={isPlaying} theme={cmsConfig?.theme} />
      
      <link rel="preconnect" href="https://i.ytimg.com" />
      <link rel="preconnect" href="https://www.youtube.com" />

      <audio 
        ref={silentAudioRef} 
        loop 
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==" 
      />
      
      {/* Persistent Single-Engine YouTube Player & Loopra Cinematic Video Experience */}
      <CinematicVideoPlayer
        videoModalSong={videoModalSong}
        currentSong={currentSong}
        isPlaying={isPlaying}
        currentTime={currentTimeRef.current || 0}
        duration={durationRef.current || 0}
        volume={volume}
        isMuted={isMuted}
        isPipActive={isPipActive}
        setIsPipActive={setIsPipActive}
        onClose={handleCloseVideo}
        onTogglePlayPause={togglePlayPause}
        onSeek={handleSeek}
        onSeekRelative={seekRelative}
        onVolumeChange={handleVolumeChange}
        onToggleMute={toggleMute}
        onToggleLike={toggleLike}
        isLiked={isSongLiked(videoModalSong || currentSong)}
        onAddToPlaylist={handleAddToPlaylistClick}
        onAddToQueue={addToQueue}
        onShare={handleShareTrack}
        playbackSpeed={playbackSpeed}
        onPlaybackSpeedChange={(speed) => {
          setPlaybackSpeed(speed);
          try {
            if (playerRef.current?.isReady && typeof playerRef.current.setPlaybackRate === 'function') {
              playerRef.current.setPlaybackRate(speed);
            }
          } catch (e) {}
        }}
        playerRef={playerRef}
        ytContainerRef={ytContainerRef}
        showToast={showToast}
        cmsConfig={cmsConfig}
      />

        {/* Unified Top Navbar for both Mobile and Desktop (hidden on DJ Club & Relax Mode where full-screen dedicated navbar is active) */}
        <header
          style={{
            paddingTop: isStandaloneApp
              ? 'max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px), 28px)'
              : 'max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px))',
            height: isStandaloneApp
              ? 'calc(3.5rem + max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px), 28px))'
              : 'calc(3.5rem + max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px)))'
          }}
          className={`${activeTab === 'dj-club' || activeTab === 'relax' ? 'hidden' : 'sticky top-0 z-50 bg-neutral-900/95 backdrop-blur-xl border-b border-neutral-800/80 px-2.5 sm:px-4 md:px-8 flex items-center justify-between shrink-0 w-full box-border select-none'}`}
        >
          {/* LEFT: Menu / Sidebar Toggle + Loopra Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              id="loopra-mobile-hamburger-btn"
              data-nav-id="hamburger"
              type="button"
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 shadow-sm active:scale-95 transition flex items-center justify-center cursor-pointer shrink-0 focus:outline-none"
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <Icon name={isSidebarOpen ? "close" : "menu"} className="w-4 h-4 text-amber-400 pointer-events-none transition-transform duration-200" />
            </button>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-neutral-900/80 border border-amber-500/30 p-0.5 flex items-center justify-center shadow-md overflow-hidden shrink-0">
                <img src={cmsConfig?.branding?.logoUrl || "/loopra-logo.png"} alt={cmsConfig?.branding?.siteName || "Brand Logo"} className="w-full h-full object-contain" />
              </div>
              {cmsConfig?.branding?.siteName ? (
                <span className="text-sm sm:text-base font-display font-extrabold tracking-tight text-white whitespace-nowrap leading-none select-none">{cmsConfig.branding.siteName}</span>
              ) : null}
            </div>
          </div>

          {/* CENTER (Desktop only): ACTIVE USERS (Subtle, muted presence indicator) */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900/40 border border-neutral-800/50 shadow-sm shrink-0">
            <span className="relative flex h-2 w-2">
              <span className={`animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] absolute inline-flex h-full w-full rounded-full ${
                isLiveCountStale ? 'bg-amber-400 opacity-40' : 'bg-emerald-400 opacity-60'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isLiveCountStale ? 'bg-amber-500' : 'bg-emerald-500'
              }`}></span>
            </span>
            <span className="text-[11px] font-normal text-neutral-400 tracking-wide flex items-center gap-1.5 leading-none">
              <span className="text-neutral-300 font-mono font-medium">
                {activeUsersCount !== null ? activeUsersCount : '--'}
              </span>
              <span className="text-neutral-500 text-[10.5px]">online</span>
              {isLiveCountStale && (
                <span className="text-[9px] text-neutral-600 font-normal" title="Connection stale, showing last verified count">
                  (stale)
                </span>
              )}
            </span>
          </div>

          {/* RIGHT: AUTH/LOGOUT & VOICE AI */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* 3D Avatar / AI Assistant toggle button (Gated strictly by dynamic role & voice permissions) */}
            {isVoiceActive && (
              <button
                id="loopra-header-ai-icon"
                type="button"
                onClick={() => {
                  setIsAvatarVisible(prev => {
                    const next = !prev;
                    try {
                      localStorage.setItem('loopra_avatar_visible', String(next));
                      if (next && localStorage.getItem('loopra_avatar_roaming') === null && localStorage.getItem('loopra_avatar_roam') === null) {
                        localStorage.setItem('loopra_avatar_roaming', 'false');
                        localStorage.setItem('loopra_avatar_roam', 'false');
                      }
                    } catch (_) {}
                    return next;
                  });
                  setIsSidebarOpen(false);
                  // Dispatch storage event asynchronously to avoid setState-during-render
                  // (CharacterBuddy listens for storage events and calls setIsRoamEnabled)
                  queueMicrotask(() => {
                    try { window.dispatchEvent(new Event('storage')); } catch (_) {}
                  });
                }}
                title={isAvatarVisible ? "Toggle AI Companion (Active)" : "Talk to Loopra Avatar"}
                aria-label={isAvatarVisible ? "Hide Loopra AI Companion" : "Talk to Loopra Avatar"}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 shadow-md active:scale-95 cursor-pointer shrink-0 ${
                  isAvatarVisible
                    ? 'ring-2 ring-amber-500 bg-amber-500/20 text-amber-400 shadow-amber-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10'
                }`}
              >
                <Icon name="sparkles" className={`w-4 h-4 ${isAvatarVisible ? 'text-amber-400 animate-pulse' : 'text-zinc-300'}`} />
              </button>
            )}
            
            {user ? (
              <div className="flex items-center gap-2 relative shrink-0" ref={accountMenuRef}>
                {/* Compact Profile Avatar Button */}
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen(prev => !prev)}
                  aria-label="User Account Menu"
                  aria-expanded={isAccountMenuOpen}
                  title={user.displayName || user.username || "Account"}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center relative overflow-hidden transition-all cursor-pointer focus:outline-none shrink-0 ${
                    isAccountMenuOpen
                      ? 'ring-2 ring-amber-400 border-transparent shadow-lg shadow-amber-500/20'
                      : 'border border-amber-500/40 hover:border-amber-400 hover:ring-2 hover:ring-amber-400/40'
                  }`}
                >
                  <UserAvatar
                    user={user}
                    className="w-full h-full object-cover"
                    fallbackClassName="w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 text-neutral-950 font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-inner uppercase select-none"
                  />
                </button>

                {/* Account Dropdown Menu */}
                {isAccountMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-64 bg-neutral-900/95 backdrop-blur-2xl border border-neutral-700/80 rounded-2xl shadow-2xl p-2 z-50 text-neutral-200 animate-in fade-in zoom-in-95 duration-150 origin-top-right space-y-1"
                  >
                    {/* User Info Header */}
                    <div className="px-3 py-2.5 bg-neutral-950/60 rounded-xl border border-neutral-800/80 mb-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          {user.displayName || user.username || 'User'}
                        </span>
                        <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border ${
                          isAdmin 
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                            : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}>
                          {isAdmin ? 'Admin' : 'Member'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5 font-mono">
                        {user.email || user.username}
                      </p>
                    </div>

                    {/* Navigation Links */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsProfileOpen(true);
                        setIsAccountMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition cursor-pointer text-left"
                    >
                      <Icon name="user" className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>My Profile</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsPlayerSettingsOpen(true);
                        setIsAccountMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition cursor-pointer text-left"
                    >
                      <Icon name="settings" className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Settings</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setActiveTab('admin');
                          window.history.pushState({ tab: 'admin' }, '', '/admin');
                          setIsAccountMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:bg-amber-500/10 transition cursor-pointer text-left border border-amber-500/20"
                      >
                        <Icon name="shield" className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Admin Dashboard</span>
                      </button>
                    )}

                    {/* Divider */}
                    <div className="h-px bg-neutral-800 my-1" />

                    {/* Logout Button */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition cursor-pointer text-left"
                    >
                      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPlayerSettingsOpen(true)}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-2xl bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 hover:text-white border border-neutral-700/60 flex items-center gap-1.5 text-xs font-semibold shadow-sm active:scale-95 transition cursor-pointer shrink-0"
                  title="Settings"
                  aria-label="Settings"
                >
                  <Icon name="settings" className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Settings</span>
                </button>

                {/* Mobile login button opening auth modal */}
                <button
                  type="button"
                  onClick={() => {
                    if (isPlaying) togglePlayPause();
                    openAuthModal();
                  }}
                  className="md:hidden w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center border border-amber-400/40 shadow-md active:scale-95 transition cursor-pointer shrink-0"
                  title="Sign In / Account"
                  aria-label="Sign In / Account"
                >
                  <Icon name="user" className="w-4 h-4 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isPlaying) {
                      togglePlayPause();
                    }
                    openAuthModal();
                  }}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-white font-medium tracking-wide text-xs shadow-lg transition shrink-0 cursor-pointer"
                >
                  <Icon name="user" className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Login</span>
                </button>
              </div>
            )}
          </div>
        </header>

      {/* Main Body Layout Container (Sidebar + Content side-by-side below Navbar) */}
      <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden relative">
      {/* V2 Navigation Drawer / Sidebar Feature Flag (USE_V2_DRAWER) */}
      {USE_V2_DRAWER ? (
        <>
          {/* Glassmorphic Backdrop overlay only on mobile (< md) - hidden on desktop */}
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className={`md:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[90] transition-opacity duration-300 ease-out cursor-pointer ${
              isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Close sidebar backdrop"
            aria-hidden={!isSidebarOpen}
          />

          <aside 
            style={{
              paddingTop: isMobileScreen ? 'max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px), 24px)' : undefined,
              paddingBottom: isMobileScreen ? 'max(var(--safe-area-bottom, 0px), env(safe-area-inset-bottom, 0px), 16px)' : undefined,
            }}
            className={`h-full flex flex-col shrink-0 transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform overflow-y-auto overflow-x-hidden md:sticky md:top-0 md:h-full ${
              activeTab === 'dj-club' || activeTab === 'relax'
                ? 'hidden'
                : isSidebarOpen
                  ? 'fixed md:relative top-0 bottom-0 left-0 z-[100] md:z-30 h-[100dvh] md:h-full w-72 md:w-[290px] translate-x-0 p-3.5 sm:p-4 bg-[#0c0d12]/98 md:bg-neutral-900/95 backdrop-blur-2xl md:backdrop-blur-xl border-r border-amber-500/20 md:border-neutral-800/80 shadow-[0_0_60px_rgba(0,0,0,0.95)] md:shadow-none opacity-100'
                  : 'fixed md:relative top-0 bottom-0 left-0 z-[100] md:z-30 h-[100dvh] md:h-full -translate-x-full md:translate-x-0 w-72 md:w-0 md:p-0 md:border-none md:overflow-hidden md:opacity-0 pointer-events-none'
            }`}
          >
            {/* Inner Content Container - full width without horizontal clipping */}
            <div className="w-full shrink-0 flex-1 flex flex-col min-h-0">
              {/* Header Section: Mobile-only brand badge (top navbar button handles toggling) */}
              <div className="flex items-center justify-between px-1.5 py-2 mb-4 border-b border-white/[0.06] pb-3 sticky top-0 z-20 bg-[#0c0d12]/95 md:bg-neutral-900/95 backdrop-blur-md">
                <div className="flex items-center min-w-0">
                  <span className="text-sm font-display font-black tracking-tight text-white truncate">
                    {cmsConfig?.branding?.siteName || 'Loopra'}
                  </span>
                </div>
              </div>

              {/* Navigation Items Grouping */}
              <nav className="space-y-3.5 flex-1">
                {(() => {
                  const defaultNav = [
                    { id: 'home', label: 'Home', icon: 'home', group: 'main' },
                    { id: 'dj-club', label: 'Loopra DJ Club', icon: 'headphones', badge: 'Live', group: 'main' },
                    { id: 'discover', label: 'Discover & Search', icon: 'discover', group: 'main' },
                    { id: 'radio', label: 'Indian Live Radio', icon: 'radio', badge: 'Live', group: 'main' },
                    { id: 'mood', label: 'Mood-to-Music AI', icon: 'sparkles', badge: 'AI', group: 'discovery' },
                    { id: 'timemachine', label: 'Time Machine Radio', icon: 'radio', badge: 'Retro', group: 'discovery' },
                    { id: 'activity', label: 'Listening Activity', icon: 'flame', group: 'discovery' },
                    { id: 'swipe', label: 'Discover Swipe', icon: 'swipe', group: 'discovery' },
                    { id: 'barber', label: stationsMap?.barber?.title || 'Saloon FM', icon: 'scissors', badge: '90s', group: 'stations' },
                    { id: 'truck', label: stationsMap?.truck?.title || 'Horn Ok Please', icon: 'truck', badge: 'Dhaba', group: 'stations' },
                    { id: 'pauwa', label: stationsMap?.pauwa?.title || 'Theka Session', icon: 'beer', badge: 'Desi', group: 'stations' },
                    { id: 'library', label: 'Liked Songs Collection', icon: 'library', group: 'collection' },
                    ...(!isStandaloneApp && !window.LoopraAndroid ? [{ id: 'downloads', label: 'Downloaded Songs', icon: 'download', group: 'collection' }] : []),
                    { id: 'history', label: 'Listening History', icon: 'history', group: 'collection' },
                    { id: 'playlists', label: 'Playlists', icon: 'list', group: 'collection' },
                    { id: 'rooms', label: 'Rooms', icon: 'users', badge: 'Live', group: 'collection' },
                    { id: 'stats', label: 'Recap & Stats', icon: 'sparkles', group: 'collection' }
                  ];

                  const canonicalGroup = (id, rawGroup) => {
                    if (['home', 'dj-club', 'chat', 'ai-chat', 'discover', 'radio'].includes(id)) return 'main';
                    if (['mood', 'timemachine', 'activity', 'swipe'].includes(id)) return 'discovery';
                    if (['barber', 'truck', 'pauwa'].includes(id)) return 'stations';
                    if (['library', 'downloads', 'history', 'playlists', 'rooms', 'stats'].includes(id)) return 'collection';
                    return rawGroup || 'main';
                  };

                  const isAndroidClient = Boolean(isStandaloneApp || (typeof window !== 'undefined' && window.LoopraAndroid));
                  const disabledIds = new Set();
                  if (cmsConfig?.featureControls?.offlineDownloadsEnabled === false || isAndroidClient) {
                    disabledIds.add('downloads');
                  }
                  const configuredItems = Array.isArray(cmsConfig?.navigation) ? cmsConfig.navigation : [];
                  configuredItems.forEach(item => {
                    if (item && item.id && item.enabled === false) {
                      disabledIds.add(item.id);
                    }
                  });

                  const navMap = new Map();

                  if (configuredItems.length > 0) {
                    configuredItems.forEach(item => {
                      if (!item || !item.id || item.id === 'profile' || item.id === 'equalizer' || item.id === 'custom-vip-lounge' || item.id === 'vip-lounge' || item.label === 'Ultra VIP Lounge') return;
                      if (item.enabled === false || disabledIds.has(item.id)) return;
                      if (item.id === 'admin' && !isAdmin) return;
                      const group = canonicalGroup(item.id, item.group);
                      navMap.set(item.id, {
                        ...item,
                        group
                      });
                    });

                    defaultNav.forEach(def => {
                      if (disabledIds.has(def.id)) return;
                      if (configuredItems.some(c => c && c.id === def.id)) return;
                      navMap.set(def.id, { ...def });
                    });
                  } else {
                    defaultNav.forEach(def => {
                      if (!disabledIds.has(def.id)) {
                        navMap.set(def.id, { ...def });
                      }
                    });
                  }

                  const extraStations = (Array.isArray(cmsConfig?.stations) ? cmsConfig.stations : [])
                    .filter(st => st && st.id && !navMap.has(st.id) && !disabledIds.has(st.id) && st.isActive !== false && st.enabled !== false)
                    .map(st => ({
                      id: st.id,
                      label: st.title || st.name || st.id,
                      icon: st.icon || 'radio',
                      badge: st.badge,
                      group: 'stations',
                      route: `/${st.id}`
                    }));

                  extraStations.forEach(st => {
                    navMap.set(st.id, st);
                  });

                  const navUiKeyMap = {
                    home: 'nav.home',
                    'dj-club': 'nav.djClub',
                    discover: 'nav.discover',
                    radio: 'nav.radio',
                    'indian-radio': 'nav.radio',
                    mood: 'nav.mood',
                    timemachine: 'nav.timemachine',
                    activity: 'nav.activity',
                    swipe: 'nav.swipe',
                    library: 'nav.liked',
                    downloads: 'nav.downloads',
                    history: 'nav.history',
                    playlists: 'nav.playlists',
                    rooms: 'nav.rooms',
                    stats: 'nav.stats'
                  };

                  const bottomNavIds = new Set(['home', 'discover', 'library', 'liked', 'playlists', 'rooms', 'radio', 'indian-radio']);
                  const allItems = Array.from(navMap.values()).filter(item => {
                    if (!item || item.enabled === false || disabledIds.has(item.id)) return false;
                    // Check Admin UI Visibility configuration
                    const uiKey = navUiKeyMap[item.id];
                    if (uiKey && !isUiVisible(uiKey)) return false;
                    // Remove Loopra AI Chat from sidebar
                    if (item.id === 'chat' || item.id === 'ai-chat') return false;
                    if (isMobileScreen && bottomNavIds.has(item.id)) return false;
                    return true;
                  });

                  const groups = [
                    { key: 'main', title: null },
                    { key: 'discovery', title: 'AI & DISCOVERY' },
                    { key: 'stations', title: 'NOSTALGIA STATIONS' },
                    { key: 'collection', title: 'YOUR COLLECTION' }
                  ];

                  return groups.map(grp => {
                    const groupItems = allItems.filter(item => {
                      if (item.id === 'profile' || item.id === 'chat' || item.id === 'ai-chat') return false;
                      return (item.group || 'main') === grp.key;
                    });

                    if (groupItems.length === 0) return null;

                    return (
                      <div key={grp.key} className="space-y-1">
                        {grp.title && (
                          !isSidebarCollapsed ? (
                            <div className="pt-2 pb-1 px-2.5 flex items-center justify-between">
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                                {grp.title}
                              </p>
                              <div className="h-px flex-1 ml-2 bg-white/[0.04]" />
                            </div>
                          ) : (
                            <div className="h-2 border-b border-neutral-800/40 mb-1.5" />
                          )
                        )}

                        <div className="space-y-0.5">
                          {groupItems.map(item => {
                            const itemKey = item.id || item.route?.replace(/^\//, '');
                            const isActive = item.id === 'stats'
                              ? isStatsOpen
                              : (item.id === 'chat' || item.id === 'ai-chat')
                              ? activeAssistantPanel === 'ai'
                              : (activeTab === item.id || activeTab === itemKey);

                            let displayLabel = stationsMap?.[item.id]?.title || item.label;
                            if (item.id === 'library' && (displayLabel === 'Liked Songs' || !displayLabel)) {
                              displayLabel = 'Liked Songs Collection';
                            } else if (item.id === 'history' && (displayLabel === 'History' || !displayLabel)) {
                              displayLabel = 'Listening History';
                            }

                            const isDjClub = item.id === 'dj-club';

                            return (
                              <button
                                key={item.id}
                                data-nav-id={item.id}
                                onClick={() => {
                                  if (item.id === 'stats') {
                                    setIsStatsOpen(true);
                                  } else if (item.id === 'chat' || item.id === 'ai-chat') {
                                    setActiveAssistantPanel(prev => prev === 'ai' ? null : 'ai');
                                    setIsStatsOpen(false);
                                  } else if (item.id === 'playlists') {
                                    handleStationSelect('playlists');
                                    setSelectedPlaylistForView(null);
                                    setIsStatsOpen(false);
                                  } else if (item.id === 'admin') {
                                    handleStationSelect('admin');
                                    window.history.pushState({ tab: 'admin' }, '', '/admin');
                                    setIsStatsOpen(false);
                                  } else {
                                    handleStationSelect(item.id);
                                    setIsStatsOpen(false);
                                  }
                                  if (isMobileScreen) setIsSidebarOpen(false);
                                }}
                                title={displayLabel}
                                className={`w-full flex items-center ${
                                  isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
                                } rounded-xl font-medium text-xs transition-all duration-150 cursor-pointer ${
                                  isDjClub
                                    ? isActive
                                      ? 'bg-gradient-to-r from-amber-500/30 to-amber-600/30 text-amber-200 border border-amber-500/50 shadow-md shadow-amber-950/40'
                                      : 'bg-gradient-to-r from-amber-500/10 to-transparent hover:from-amber-500/20 text-amber-300 border border-amber-500/20'
                                    : isActive
                                    ? 'bg-amber-500/15 text-amber-200 border border-amber-500/40 shadow-sm shadow-amber-950/40 font-semibold'
                                    : 'text-neutral-400 hover:bg-white/[0.05] hover:text-white active:bg-white/[0.08]'
                                }`}
                              >
                                <Icon name={item.icon || 'music'} className={`w-4 h-4 shrink-0 ${
                                  isDjClub ? 'text-amber-400 animate-pulse' : isActive ? 'text-amber-400' : 'text-neutral-400'
                                }`} />
                                {!isSidebarCollapsed && (
                                  <span className="whitespace-nowrap truncate text-xs">{displayLabel}</span>
                                )}
                                {!isSidebarCollapsed && item.badge && (
                                  <span className="ml-auto text-[9px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.2 rounded-full border border-amber-500/25 shrink-0">
                                    {item.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}

                {/* Admin Highlight Item */}
                {isAdmin && !cmsConfig?.navigation?.some(n => n.id === 'admin' && n.enabled !== false) && (
                  <button
                    onClick={() => {
                      handleStationSelect('admin');
                      window.history.pushState({ tab: 'admin' }, '', '/admin');
                      if (isMobileScreen) setIsSidebarOpen(false);
                    }}
                    title="Admin Dashboard"
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'} rounded-xl font-semibold text-xs transition-all cursor-pointer ${
                      activeTab === 'admin' 
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-md shadow-amber-500/20' 
                        : 'text-amber-400/90 bg-amber-500/[0.06] border border-amber-500/20 hover:bg-amber-500/15 hover:border-amber-500/40'
                    }`}
                  >
                    <Icon name="shield" className="w-4 h-4 shrink-0 text-amber-400" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Admin Dashboard</span>}
                  </button>
                )}
              </nav>

              {/* Bottom Action Area: User Profile, APK Download & Auth / Logout */}
              <div 
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
                className="pt-3 pb-20 md:pb-6 border-t border-white/[0.06] mt-4 space-y-2"
              >
                {/* 1. Avatar Autonomous Free Roam Toggle Button (Strictly Admin Only and when Voice/Avatar is active) */}
                {isAdmin && isVoiceActive && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const cur = (localStorage.getItem('loopra_avatar_roaming') ?? localStorage.getItem('loopra_avatar_roam')) === 'true';
                        const next = !cur;
                        localStorage.setItem('loopra_avatar_roaming', String(next));
                        localStorage.setItem('loopra_avatar_roam', String(next));
                        window.dispatchEvent(new Event('storage'));
                        showToast?.(`Avatar Free Roam ${next ? 'Enabled' : 'Paused'}`);
                      } catch (_) {}
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-neutral-300 font-medium text-xs transition cursor-pointer"
                    title="Toggle Avatar Autonomous Roaming (Admin Only)"
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="sparkles" className="w-3.5 h-3.5 text-amber-400" />
                      {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && <span>Avatar Free Roam</span>}
                    </div>
                    {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && (
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        ON/OFF
                      </span>
                    )}
                  </button>
                )}

                {/* 2. Download APK Action directly downloading Loopra.apk across Web & Android App */}
                <a
                  href={getDirectApkDownloadUrl(publishedVersionInfo)}
                  download="Loopra.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isStandaloneApp || (typeof window !== 'undefined' && window.LoopraAndroid)) {
                      e.preventDefault();
                      handleDownloadApk(e);
                    } else {
                      showToast('Downloading Loopra Android APK...', 'success');
                    }
                    if (isMobileScreen && isSidebarOpen) {
                      setTimeout(() => setIsSidebarOpen(false), 200);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/20 to-amber-600/15 hover:from-amber-500/25 hover:to-amber-600/25 border border-amber-500/30 text-amber-300 font-semibold text-xs shadow-md transition-all active:scale-95 cursor-pointer text-left no-underline select-none"
                  title="Download Latest Android APK"
                  aria-label="Download Latest Android APK"
                >
                  <Icon name="download" className="w-4 h-4 text-amber-400 shrink-0" />
                  {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && (
                    <span className="flex items-center justify-between flex-1 gap-1">
                      <span>Download APK</span>
                      <span className="text-[10px] font-mono text-amber-400/90 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                        v{publishedVersionInfo?.versionName || '2.1'}
                      </span>
                    </span>
                  )}
                </a>

                {/* 3. Logged-in User Profile Card & 4. Logout / Sign In Button */}
                {user ? (
                  <div className="space-y-2">
                    {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && (
                      <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                          <UserAvatar
                            user={user}
                            className="w-full h-full object-cover"
                            fallbackClassName="w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 text-neutral-950 font-bold text-[10px] flex items-center justify-center shadow-inner uppercase select-none"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">{user.displayName || user.username || 'User'}</p>
                          <p className="text-[9px] text-zinc-500 truncate">{user.email || 'Online'}</p>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => { logout(); setIsSidebarOpen(false); }}
                      className={`w-full flex items-center ${isSidebarCollapsed && !isSidebarOpen && !isMobileScreen ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'} rounded-xl font-medium text-xs transition text-neutral-400 hover:text-red-400 hover:bg-red-500/10 active:scale-95`}
                    >
                      <Icon name="logout" className="w-4 h-4 shrink-0" />
                      {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && <span>Logout</span>}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (isPlaying) {
                        togglePlayPause();
                      }
                      openAuthModal();
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center ${isSidebarCollapsed && !isSidebarOpen && !isMobileScreen ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'} rounded-xl font-semibold text-xs transition bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-300 border border-amber-500/30 hover:from-amber-500/30 hover:to-amber-600/30 active:scale-95`}
                  >
                    <Icon name="user" className="w-4 h-4 shrink-0 text-amber-400" />
                    {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && <span>Login / Sign Up</span>}
                  </button>
                )}
              </div>
            </div>
          </aside>
        </>
      ) : (
        <>
          {/* Backdrop overlay only for mobile drawer - hidden on desktop */}
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className={`md:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[90] transition-opacity duration-300 ease-out cursor-pointer ${
              isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Close sidebar backdrop"
            aria-hidden={!isSidebarOpen}
          />

          <aside 
            style={{
              paddingTop: isMobileScreen ? 'max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px), 24px)' : undefined,
              paddingBottom: isMobileScreen ? 'max(var(--safe-area-bottom, 0px), env(safe-area-inset-bottom, 0px), 16px)' : undefined,
            }}
            className={`h-full flex flex-col shrink-0 transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform overflow-y-auto overflow-x-hidden md:sticky md:top-0 md:h-full ${
              activeTab === 'dj-club' || activeTab === 'relax'
                ? 'hidden'
                : isSidebarOpen
                  ? 'fixed md:relative top-0 bottom-0 left-0 z-[100] md:z-30 h-[100dvh] md:h-full w-72 md:w-[290px] translate-x-0 p-4 bg-neutral-900/95 backdrop-blur-xl border-r border-neutral-800/80 opacity-100'
                  : 'fixed md:relative top-0 bottom-0 left-0 z-[100] md:z-30 h-[100dvh] md:h-full -translate-x-full md:translate-x-0 w-72 md:w-0 md:p-0 md:border-none md:overflow-hidden md:opacity-0 pointer-events-none'
            }`}
          >
            <div className="w-full shrink-0 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-2 py-3 mb-6 sticky top-0 z-20 bg-neutral-900/95 backdrop-blur-md">
                <div className="flex items-center min-w-0">
                  {cmsConfig?.branding?.siteName ? (
                    <span className="text-sm font-display font-extrabold tracking-tight text-white whitespace-nowrap">{cmsConfig.branding.siteName}</span>
                  ) : null}
                </div>
              </div>

          <nav className="space-y-2">
            {(() => {
              const defaultNav = [
                { id: 'home', label: 'Home', icon: 'home', group: 'main' },
                { id: 'dj-club', label: 'Loopra DJ Club', icon: 'headphones', badge: 'Live', group: 'main' },
                { id: 'discover', label: 'Discover & Search', icon: 'discover', group: 'main' },
                { id: 'radio', label: 'Indian Live Radio', icon: 'radio', badge: 'Live', group: 'main' },
                { id: 'mood', label: 'Mood-to-Music AI', icon: 'sparkles', badge: 'AI', group: 'discovery' },
                { id: 'timemachine', label: 'Time Machine Radio', icon: 'radio', badge: 'Retro', group: 'discovery' },
                { id: 'activity', label: 'Listening Activity', icon: 'flame', group: 'discovery' },
                { id: 'swipe', label: 'Discover Swipe', icon: 'swipe', group: 'discovery' },
                { id: 'barber', label: stationsMap?.barber?.title || 'Saloon FM', icon: 'scissors', badge: '90s', group: 'stations' },
                { id: 'truck', label: stationsMap?.truck?.title || 'Horn Ok Please', icon: 'truck', badge: 'Dhaba', group: 'stations' },
                { id: 'pauwa', label: stationsMap?.pauwa?.title || 'Theka Session', icon: 'beer', badge: 'Desi', group: 'stations' },
                { id: 'library', label: 'Liked Songs Collection', icon: 'library', group: 'collection' },
                ...(!isStandaloneApp && !window.LoopraAndroid ? [{ id: 'downloads', label: 'Downloaded Songs', icon: 'download', group: 'collection' }] : []),
                { id: 'history', label: 'Listening History', icon: 'history', group: 'collection' },
                { id: 'playlists', label: 'Playlists', icon: 'list', group: 'collection' },
                { id: 'rooms', label: 'Rooms', icon: 'users', badge: 'Live', group: 'collection' },
                { id: 'stats', label: 'Recap & Stats', icon: 'sparkles', group: 'collection' }
              ];

              const canonicalGroup = (id, rawGroup) => {
                if (['home', 'dj-club', 'chat', 'ai-chat', 'discover', 'radio'].includes(id)) return 'main';
                if (['mood', 'timemachine', 'activity', 'swipe'].includes(id)) return 'discovery';
                if (['barber', 'truck', 'pauwa'].includes(id)) return 'stations';
                if (['library', 'downloads', 'history', 'playlists', 'rooms', 'stats'].includes(id)) return 'collection';
                return rawGroup || 'main';
              };

              // 1. Collect all explicitly disabled item IDs so defaults never override user choices
              const isAndroidClient = Boolean(isStandaloneApp || (typeof window !== 'undefined' && window.LoopraAndroid));
              const disabledIds = new Set();
              if (cmsConfig?.featureControls?.offlineDownloadsEnabled === false || isAndroidClient) {
                disabledIds.add('downloads');
              }
              const configuredItems = Array.isArray(cmsConfig?.navigation) ? cmsConfig.navigation : [];
              configuredItems.forEach(item => {
                if (item && item.id && item.enabled === false) {
                  disabledIds.add(item.id);
                }
              });

              // 2. Build active navigation map
              const navMap = new Map();

              if (configuredItems.length > 0) {
                // Admin configuration is present: add configured enabled items
                configuredItems.forEach(item => {
                  if (!item || !item.id || item.id === 'profile' || item.id === 'equalizer' || item.id === 'custom-vip-lounge' || item.id === 'vip-lounge' || item.label === 'Ultra VIP Lounge') return;
                  if (item.enabled === false || disabledIds.has(item.id)) return;
                  if (item.id === 'admin' && !isAdmin) return;
                  const group = canonicalGroup(item.id, item.group);
                  navMap.set(item.id, {
                    ...item,
                    group
                  });
                });

                // Check defaultNav for any canonical categories missing from old legacy DB configurations
                defaultNav.forEach(def => {
                  if (disabledIds.has(def.id)) return; // Explicitly hidden by admin
                  if (configuredItems.some(c => c && c.id === def.id)) return; // Already tracked in configuration
                  navMap.set(def.id, { ...def });
                });
              } else {
                // Fallback to defaultNav if no configuration exists
                defaultNav.forEach(def => {
                  if (!disabledIds.has(def.id)) {
                    navMap.set(def.id, { ...def });
                  }
                });
              }

              // Discover any custom stations configured in cmsConfig.stations that aren't already in navigation
              const extraStations = (Array.isArray(cmsConfig?.stations) ? cmsConfig.stations : [])
                .filter(st => st && st.id && !navMap.has(st.id) && !disabledIds.has(st.id) && st.isActive !== false && st.enabled !== false)
                .map(st => ({
                  id: st.id,
                  label: st.title || st.name || st.id,
                  icon: st.icon || 'radio',
                  badge: st.badge,
                  group: 'stations',
                  route: `/${st.id}`
                }));

              extraStations.forEach(st => {
                navMap.set(st.id, st);
              });

              const navUiKeyMap = {
                home: 'nav.home',
                'dj-club': 'nav.djClub',
                discover: 'nav.discover',
                radio: 'nav.radio',
                'indian-radio': 'nav.radio',
                mood: 'nav.mood',
                timemachine: 'nav.timemachine',
                activity: 'nav.activity',
                swipe: 'nav.swipe',
                library: 'nav.liked',
                downloads: 'nav.downloads',
                history: 'nav.history',
                playlists: 'nav.playlists',
                rooms: 'nav.rooms',
                stats: 'nav.stats'
              };

              // Destinations present in the mobile lower navbar (MobileBottomNav)
              const bottomNavIds = new Set(['home', 'discover', 'library', 'liked', 'playlists', 'rooms', 'radio', 'indian-radio']);
              const allItems = Array.from(navMap.values()).filter(item => {
                if (!item || item.enabled === false || disabledIds.has(item.id)) return false;
                // Check Admin UI Visibility configuration
                const uiKey = navUiKeyMap[item.id];
                if (uiKey && !isUiVisible(uiKey)) return false;
                // Remove Loopra AI Chat from sidebar
                if (item.id === 'chat' || item.id === 'ai-chat') return false;
                // Restriction applies ONLY to phone/mobile mode: do not show lower navbar destinations in mobile sidebar
                if (isMobileScreen && bottomNavIds.has(item.id)) return false;
                return true;
              });
              const groups = [
                { key: 'main', title: null },
                { key: 'discovery', title: 'AI & DISCOVERY' },
                { key: 'stations', title: 'NOSTALGIA STATIONS' },
                { key: 'collection', title: 'YOUR COLLECTION' }
              ];

              return groups.map(grp => {
                const groupItems = allItems.filter(item => {
                  if (item.id === 'profile' || item.id === 'chat' || item.id === 'ai-chat') return false;
                  return (item.group || 'main') === grp.key;
                });

                if (groupItems.length === 0) return null;

                return (
                  <div key={grp.key} className="space-y-1">
                    {grp.title && (
                      !isSidebarCollapsed ? (
                        <div className="pt-3 pb-1 px-3">
                          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">
                            {grp.title}
                          </p>
                        </div>
                      ) : (
                        <div className="h-4 border-b border-neutral-800/50 mb-2" />
                      )
                    )}

                    {groupItems.map(item => {
                      const itemKey = item.id || item.route?.replace(/^\//, '');
                      const isActive = item.id === 'stats'
                        ? isStatsOpen
                        : (item.id === 'chat' || item.id === 'ai-chat')
                        ? activeAssistantPanel === 'ai'
                        : (activeTab === item.id || activeTab === itemKey);

                      // Display label: if it's a station, use station's updated title if available; format collections
                      let displayLabel = stationsMap?.[item.id]?.title || item.label;
                      if (item.id === 'library' && (displayLabel === 'Liked Songs' || !displayLabel)) {
                        displayLabel = 'Liked Songs Collection';
                      } else if (item.id === 'history' && (displayLabel === 'History' || !displayLabel)) {
                        displayLabel = 'Listening History';
                      }

                      return (
                        <button
                          key={item.id}
                          data-nav-id={item.id}
                          onClick={() => {
                            if (item.id === 'stats') {
                              setIsStatsOpen(true);
                            } else if (item.id === 'chat' || item.id === 'ai-chat') {
                              setActiveAssistantPanel(prev => prev === 'ai' ? null : 'ai');
                              setIsStatsOpen(false);
                            } else if (item.id === 'playlists') {
                              handleStationSelect('playlists');
                              setSelectedPlaylistForView(null);
                              setIsStatsOpen(false);
                            } else if (item.id === 'admin') {
                              handleStationSelect('admin');
                              window.history.pushState({ tab: 'admin' }, '', '/admin');
                              setIsStatsOpen(false);
                            } else {
                              handleStationSelect(item.id);
                              setIsStatsOpen(false);
                            }
                            if (isMobileScreen) setIsSidebarOpen(false);
                          }}
                          title={displayLabel}
                          className={`w-full flex items-center ${
                            isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'
                          } rounded-2xl font-medium text-xs transition cursor-pointer ${
                            isActive
                              ? 'bg-amber-600/25 text-amber-200 border border-amber-500/50 shadow-lg shadow-amber-950/50'
                              : 'text-neutral-400 hover:bg-neutral-800 hover:text-white active:scale-[0.98]/50'
                          }`}
                        >
                          <Icon name={item.icon || 'music'} className="w-5 h-5 shrink-0 text-amber-400" />
                          {!isSidebarCollapsed && (
                            <span className="whitespace-nowrap truncate">{displayLabel}</span>
                          )}
                          {!isSidebarCollapsed && item.badge && (
                            <span className="ml-auto text-[9px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              });
            })()}

            {isAdmin && !cmsConfig?.navigation?.some(n => n.id === 'admin' && n.enabled !== false) && (
              <button
                onClick={() => {
                  handleStationSelect('admin');
                  window.history.pushState({ tab: 'admin' }, '', '/admin');
                }}
                title="Admin Dashboard"
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-semibold text-xs transition cursor-pointer ${
                  activeTab === 'admin' ? 'bg-amber-500 text-neutral-950 font-bold shadow-lg shadow-amber-500/30' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20'
                }`}
              >
                <Icon name="shield" className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span className="whitespace-nowrap">Admin Dashboard</span>}
              </button>
            )}

            {/* Bottom Action Area: User Profile, APK Download & Auth / Logout */}
            <div 
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
              className="pt-4 pb-20 md:pb-6 border-t border-neutral-800 mt-4 space-y-2"
            >
              {/* 1. Avatar Autonomous Free Roam Toggle Button (Strictly Admin Only and when Voice/Avatar is active) */}
              {isAdmin && isVoiceActive && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const cur = (localStorage.getItem('loopra_avatar_roaming') ?? localStorage.getItem('loopra_avatar_roam')) === 'true';
                      const next = !cur;
                      localStorage.setItem('loopra_avatar_roaming', String(next));
                      localStorage.setItem('loopra_avatar_roam', String(next));
                      window.dispatchEvent(new Event('storage'));
                      showToast?.(`Avatar Free Roam ${next ? 'Enabled' : 'Paused'}`);
                    } catch (_) {}
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-neutral-300 font-medium text-xs transition cursor-pointer"
                  title="Toggle Avatar Autonomous Roaming (Admin Only)"
                >
                  <div className="flex items-center gap-2">
                    <Icon name="sparkles" className="w-3.5 h-3.5 text-amber-400" />
                    {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && <span>Avatar Free Roam</span>}
                  </div>
                  {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && (
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      ON/OFF
                    </span>
                  )}
                </button>
              )}

              {/* 2. Download APK Action directly downloading Loopra.apk across Web & Android App */}
              <a
                href={getDirectApkDownloadUrl(publishedVersionInfo)}
                download="Loopra.apk"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isStandaloneApp || (typeof window !== 'undefined' && window.LoopraAndroid)) {
                    e.preventDefault();
                    handleDownloadApk(e);
                  } else {
                    showToast('Downloading Loopra Android APK...', 'success');
                  }
                  if (isMobileScreen && isSidebarOpen) {
                    setTimeout(() => setIsSidebarOpen(false), 200);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/20 to-amber-600/15 hover:from-amber-500/25 hover:to-amber-600/25 border border-amber-500/30 text-amber-300 font-semibold text-xs shadow-md transition-all active:scale-95 cursor-pointer text-left no-underline select-none"
                title="Download Latest Android APK"
                aria-label="Download Latest Android APK"
              >
                <Icon name="download" className="w-4 h-4 text-amber-400 shrink-0" />
                {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && (
                  <span className="flex items-center justify-between flex-1 gap-1">
                    <span>Download APK</span>
                    <span className="text-[10px] font-mono text-amber-400/90 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                      v{publishedVersionInfo?.versionName || '2.1'}
                    </span>
                  </span>
                )}
              </a>

              {/* 3. Logged-in User Profile Card & 4. Logout / Sign In Button */}
              {user ? (
                <div className="space-y-2">
                  {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                        <UserAvatar
                          user={user}
                          className="w-full h-full object-cover"
                          fallbackClassName="w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 text-neutral-950 font-bold text-[10px] flex items-center justify-center shadow-inner uppercase select-none"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{user.displayName || user.username || 'User'}</p>
                        <p className="text-[9px] text-zinc-500 truncate">{user.email || 'Online'}</p>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => { logout(); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center ${isSidebarCollapsed && !isSidebarOpen && !isMobileScreen ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'} rounded-xl font-medium text-xs transition text-neutral-400 hover:text-red-400 hover:bg-red-500/10 active:scale-95`}
                  >
                    <Icon name="logout" className="w-4 h-4 shrink-0" />
                    {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && <span>Logout</span>}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (isPlaying) {
                      togglePlayPause();
                    }
                    openAuthModal();
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center ${isSidebarCollapsed && !isSidebarOpen && !isMobileScreen ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'} rounded-xl font-semibold text-xs transition bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-300 border border-amber-500/30 hover:from-amber-500/30 hover:to-amber-600/30 active:scale-95`}
                >
                  <Icon name="user" className="w-4 h-4 shrink-0 text-amber-400" />
                  {(!isSidebarCollapsed || isSidebarOpen || isMobileScreen) && <span>Login / Sign Up</span>}
                </button>
              )}
            </div>
            
          </nav>
        </div>
      </aside>
    </>
  )}

      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 relative overflow-hidden">


        {/* Site-wide CMS Announcement Bar */}
        {activeTab !== 'dj-club' && activeTab !== 'relax' && <CmsAnnouncementBar announcement={cmsConfig?.announcement} />}

        {(() => {
          const isStationPage = Boolean(
            currentStation &&
            !['home', 'discover', 'swipe', 'for-you', 'library', 'history', 'radio', 'indian-radio', 'mood', 'timemachine', 'activity', 'admin', 'offline', 'offline-explore'].includes(activeTab)
          );
          return (
            <main
              ref={mainScrollRef}
              onScroll={(e) => {
                if (activeTab === 'home') setIsHomeScrolled(e.currentTarget.scrollTop > 320);
              }}
              className={`flex-1 h-full min-h-0 ${
                activeTab === 'dj-club' || activeTab === 'relax' || isStationPage
                  ? 'overflow-hidden p-0'
                  : (USE_V2_SWIPE_UI && activeTab === 'swipe' ? 'overflow-hidden p-0' : 'overflow-y-auto px-2.5 py-3 sm:px-4 sm:py-4 md:p-8')
              } bg-neutral-950 box-border relative w-full transition-all duration-300 ${
                activeTab === 'dj-club' || activeTab === 'relax' || isStationPage
                  ? 'pb-0'
                  : (USE_V2_SWIPE_UI && activeTab === 'swipe' ? 'pb-0' : (isBottomPlayerVisible ? 'pb-44 md:pb-28' : 'pb-24 md:pb-8'))
              }`}
            >
              {currentStation && currentBgImage && activeTab !== 'dj-club' && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden transition-all duration-700">
                  <img 
                    key={currentBgImage}
                    src={currentBgImage} 
                    alt="Station Background" 
                    loading="lazy"
                    className="w-full h-full object-cover filter brightness-[0.75] contrast-100 scale-105 transition-opacity duration-1000 animate-fadeIn"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/85" />
                </div>
              )}

              {canGoBack(navigationStack, activeTab, { showAllTrending, showAllArtists, showAllAlbums, showAllRadio, selectedPlaylistForView, offlineSubView }) && activeTab !== 'artist' && activeTab !== 'dj-club' && !isStationPage && (
                <div className="relative z-20 mb-6 flex justify-start pl-0">
                  <button
                    data-voice-back="true"
                    onClick={handleGoBack}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-900/80 hover:bg-neutral-800 backdrop-blur-xl border border-neutral-700/50 rounded-2xl text-neutral-300 hover:text-white transition shadow-lg group cursor-pointer active:scale-95"
                  >
                    <Icon name="arrowLeft" className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium tracking-wide">Back</span>
                  </button>
                </div>
              )}

        {activeTab === 'artist' && (
          <div key={`page-artist-${selectedArtistId}`} className="page-transition w-full min-w-0 px-2 sm:px-4 md:px-8 pt-0.5 md:pt-2">
            <ArtistProfileView
              artistId={selectedArtistId || 'arijit-singh'}
              backendUrl={BACKEND_URL}
              authToken={authToken}
              user={user}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlaySong={(track, trackQueue) => {
                if (trackQueue && trackQueue.length > 0) {
                  setQueue(trackQueue);
                }
                playSong(track);
              }}
              onTogglePlayPause={togglePlayPause}
              onToggleLike={toggleLike}
              isLiked={isSongLiked}
              onAddToPlaylist={handleAddToPlaylistClick}
        onAddToQueue={addToQueue}
              onAddToQueue={(track) => {
                setQueue(prev => [...prev, track]);
                showToast(`Added "${track.title}" to queue`);
              }}
              onArtistClick={handleArtistClick}
              onGoBack={handleGoBack}
              showToast={showToast}
            />
            <DisclaimerFooter {...commonFooterProps} />
          </div>
        )}

        {activeTab === 'discover' && (
          <div key="page-discover" className="page-transition w-full relative z-10">
            <DiscoverView
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchResults={searchResults}
              fetchYouTubeMusic={fetchYouTubeMusic}
              isLoading={isLoading}
              searchError={searchError}
              hasSearched={hasSearched}
              isLoadingMoreSearch={isLoadingMoreSearch}
              hasMoreSearchResults={hasMoreSearchResults}
              searchLoadMoreError={searchLoadMoreError}
              handleLoadMoreSearchResults={handleLoadMoreSearchResults}
              currentSong={currentSong}
              playSong={playSong}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
              handleOpenVideo={handleOpenVideo}
              queue={queue}
              addToQueue={addToQueue}
              removeFromQueue={removeFromQueue}
              likedSongs={likedSongs}
              toggleLike={toggleLike}
              playNext={playNext}
              handleFindSimilar={handleFindSimilar}
              handleAddToPlaylistClick={handleAddToPlaylistClick}
              showToast={showToast}
              handleImageError={handleImageError}
              trendingSongs={trendingSongs}
              popularAlbums={popularAlbums}
              isServerWakingUp={isServerWakingUp}
              user={user}
              authToken={authToken}
              backendUrl={BACKEND_URL}
              cmsConfig={cmsConfig}
              onNavigate={(tab, extraParams) => {
                handleStationSelect(tab, extraParams);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onArtistClick={handleArtistClick}
            />
          </div>
        )}

        {activeTab === 'swipe' && (
          <div key="page-swipe" className={`page-transition relative z-10 w-full ${USE_V2_SWIPE_UI ? 'h-full flex flex-col justify-center overflow-hidden' : 'max-w-2xl mx-auto space-y-6 py-2 sm:py-4'}`}>
            <DiscoverSwipe
              onPlaySong={playSong}
              onTogglePlay={togglePlayPause}
              currentSong={currentSong}
              isPlaying={isPlaying}
              likedSongs={likedSongs}
              onToggleLike={toggleLike}
              showToast={showToast}
              fetchTracks={handleFetchDiscoveryTracks}
              onNavigate={handleStationSelect}
            />
          </div>
        )}

        {activeTab === 'relax' && (
          <div key="page-relax" className="fixed inset-0 z-50 w-screen h-screen overflow-hidden">
            <RelaxModeView
              onBack={handleGoBack}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onTogglePlay={togglePlayPause}
              onNextSong={handleNextSong}
              onPrevSong={handlePrevSong}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              getCleanThumbnail={getCleanThumbnail}
              onOpenExpandedPlayer={handleOpenExpandedPlayer}
            />
          </div>
        )}

        {activeTab === 'for-you' && (
          <div key="page-for-you" className="page-transition w-full min-w-0 px-2 sm:px-4 md:px-8 pt-1 md:pt-6 space-y-6 md:space-y-10">
            <PersonalizedRecommendationsSection
              backendUrl={BACKEND_URL}
              authToken={authToken}
              user={user}
              onPlayTrack={(track) => {
                playSong(track);
              }}
              onOpenAuth={openAuthModal}
              onToggleLike={toggleLike}
              isLiked={isSongLiked}
              onAddToPlaylist={handleAddToPlaylistClick}
        onAddToQueue={addToQueue}
              showToast={showToast}
              onArtistClick={handleArtistClick}
            />
          </div>
        )}

        {activeTab === 'home' && (
          <div key={`page-home-${showAllTrending ? 'trending' : showAllArtists ? 'artists' : showAllAlbums ? 'albums' : showAllRadio ? 'radio' : 'main'}`} className="page-transition w-full min-w-0 px-2 sm:px-4 md:px-8 pt-0.5 md:pt-2 space-y-4 md:space-y-6">
            {/* Promotional Hero Banner if configured in CMS */}
            <CmsHeroBanner 
              banner={cmsConfig?.banner} 
              onActionClick={(url) => {
                if (url?.startsWith('/station/')) {
                  handleStationSelect(url.replace('/station/', ''));
                } else if (url === '/discover') {
                  handleStationSelect('discover');
                } else if (url?.startsWith('http')) {
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              }}
            />

            {/* Cinematic Hero Banner with Integrated Voice Search & Quick Tags */}
            {USE_COMPACT_V2_UI ? (
              <CompactHeroV2
                clockString={clockString}
                onSearch={handleSearchFromHome}
                onSelectSong={playSong}
                onPlaySong={playSong}
                onArtistClick={handleArtistClick}
                placeholder={cmsConfig?.searchPage?.placeholder || "Search songs, artists, albums..."}
                suggestions={cmsConfig?.searchPage?.quickTags}
                user={user}
                token={authToken}
                backendUrl={BACKEND_URL}
              />
            ) : (
              <HomeHero 
                clockString={clockString}
                onSearch={handleSearchFromHome}
                onSelectSong={playSong}
                onPlaySong={playSong}
                onArtistClick={handleArtistClick}
                placeholder={cmsConfig?.searchPage?.placeholder || "Search songs, artists, albums..."}
                suggestions={cmsConfig?.searchPage?.quickTags}
                user={user}
                token={authToken}
                backendUrl={BACKEND_URL}
                onNavigate={handleStationSelect}
                onOpenInsights={() => setIsStatsOpen(true)}
              />
            )}

            {/* Premium Feature Shortcut Cards */}
            {USE_COMPACT_V2_UI ? (
              <CompactFeatureDeckV2 onNavigate={handleStationSelect} />
            ) : (
              <FeatureShortcuts 
                onNavigate={handleStationSelect}
                onOpenInsights={() => setIsStatsOpen(true)}
              />
            )}

            {/* Featured 3D Turntable Lounge Showcase for Mobile & Desktop (Hidden on mobile if V2 compact mode is active to eliminate mid-screen clutter) */}
            <div className={`${USE_COMPACT_V2_UI ? 'hidden md:block' : 'block'} relative rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 md:p-8 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-950/95 border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(var(--accent-rgb,245,158,11),0.1)] backdrop-blur-2xl overflow-hidden mb-4 sm:mb-6 select-none w-full min-w-0`}>
              <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full bg-amber-500/10 blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-orange-500/10 blur-[80px] pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6 lg:gap-8 w-full min-w-0">
                {/* 3D Turntable Platter */}
                <div className="flex flex-col items-center justify-center shrink-0 w-full lg:w-auto">
                  <Turntable3D 
                    currentSong={currentSong || (trendingSongs?.[0] || TRENDING_SONGS[0])}
                    isPlaying={isPlaying}
                    onTogglePlay={currentSong ? togglePlayPause : () => handlePlayTrending((trendingSongs?.[0] || TRENDING_SONGS[0]).title, (trendingSongs?.[0] || TRENDING_SONGS[0]), trendingSongs)}
                    size="compact"
                  />
                  <AudioSpectrumVisualizer 
                    isPlaying={isPlaying} 
                    barCount={32}
                    height={32}
                    className="w-full max-w-[190px] min-[360px]:max-w-[220px] sm:max-w-xs mt-2 sm:mt-3"
                  />
                </div>

                {/* Lounge Info & Tactile Controls */}
                <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left space-y-2.5 sm:space-y-4 w-full max-w-lg min-w-0">
                  <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] sm:text-xs font-mono font-semibold">
                    <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isPlaying ? 'bg-amber-400 shadow-[0_0_8px_var(--accent-color,#f59e0b)] animate-pulse' : 'bg-neutral-500'}`} />
                    <span>{isPlaying ? 'NOW SPINNING ON VINYL' : 'LOOPRA 3D VINYL LOUNGE'}</span>
                  </div>

                  <div className="w-full min-w-0 px-1 sm:px-0">
                    <h1 className="text-base sm:text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight line-clamp-2 leading-snug">
                      {currentSong ? currentSong.title : ((trendingSongs?.[0] || TRENDING_SONGS[0])?.title || 'High-Fidelity Retro & Modern Lounge')}
                    </h1>
                    <p
                      className="text-xs sm:text-sm text-amber-400/90 font-medium mt-0.5 sm:mt-1 truncate max-w-full select-none"
                    >
                      {currentSong ? (currentSong.artist || currentSong.channel) : ((trendingSongs?.[0] || TRENDING_SONGS[0])?.channel || 'Drop the needle on curated trending hits, nostalgia stations, or search any track.')}
                    </p>
                  </div>

                  {/* Tactile Control Buttons Container */}
                  <div className="flex flex-col items-center lg:items-start gap-2 pt-1 w-full" onClick={(e) => e.stopPropagation()}>
                    {currentSong ? (
                      <>
                        <div className="flex items-center justify-center lg:justify-start gap-2 w-full">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePlayPause();
                            }}
                            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
                            title={isPlaying ? "Pause" : "Play"}
                            aria-label={isPlaying ? "Pause playback" : "Resume playback"}
                          >
                            <Icon name={isPlaying ? "pause" : "play"} className="w-4 h-4 fill-current" />
                            <span>{isPlaying ? 'Pause' : 'Resume'}</span>
                          </button>

                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNextSong();
                            }}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-200 hover:text-white border border-neutral-700/80 transition shadow-md flex items-center justify-center cursor-pointer shrink-0"
                            title="Next Track"
                            aria-label="Next Track"
                          >
                            <Icon name="skipNext" className="w-4 h-4 text-neutral-300" />
                          </button>

                          {isUiVisible('btn.expandPlayer') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenExpandedPlayer('player');
                              }}
                              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 active:scale-95 text-neutral-200 hover:text-white font-medium text-xs sm:text-sm border border-neutral-700/80 transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer shrink-0"
                              title="Open Expanded Now Playing"
                              aria-label="Open Expanded Now Playing"
                            >
                              <Icon name="expand" className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                              <span>Now Playing</span>
                            </button>
                          )}
                        </div>

                        {/* Centered Queue Pill */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenExpandedPlayer('queue');
                          }}
                          className="px-3.5 py-1 rounded-full bg-neutral-900/80 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-neutral-200 font-medium text-[10px] sm:text-xs border border-neutral-800 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 mx-auto lg:mx-0 mt-0.5"
                          title="View Queue"
                          aria-label="View Queue"
                        >
                          <Icon name="list" className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>Queue ({queue.length})</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-center lg:justify-start gap-2 w-full">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayTrending((trendingSongs?.[0] || TRENDING_SONGS[0]).title, (trendingSongs?.[0] || TRENDING_SONGS[0]), trendingSongs);
                            }}
                            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
                            title="Spin Trending Hit"
                            aria-label="Spin Trending Hit"
                          >
                            <Icon name="play" className="w-4 h-4 fill-current" />
                            <span>Spin Hit</span>
                          </button>

                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayTrending((trendingSongs?.[1] || trendingSongs?.[0] || TRENDING_SONGS[0]).title, (trendingSongs?.[1] || trendingSongs?.[0] || TRENDING_SONGS[0]), trendingSongs);
                            }}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-200 hover:text-white border border-neutral-700/80 transition shadow-md flex items-center justify-center cursor-pointer shrink-0"
                            title="Next Track"
                            aria-label="Next Track"
                          >
                            <Icon name="skipNext" className="w-4 h-4 text-neutral-300" />
                          </button>

                          {isUiVisible('btn.expandPlayer') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenExpandedPlayer('player');
                              }}
                              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 active:scale-95 text-neutral-200 hover:text-white font-medium text-xs sm:text-sm border border-neutral-700/80 transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer shrink-0"
                              title="Open Expanded Now Playing"
                              aria-label="Open Expanded Now Playing"
                            >
                              <Icon name="expand" className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                              <span>Now Playing</span>
                            </button>
                          )}
                        </div>

                        {/* Centered Queue Pill */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenExpandedPlayer('queue');
                          }}
                          className="px-3.5 py-1 rounded-full bg-neutral-900/80 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-neutral-200 font-medium text-[10px] sm:text-xs border border-neutral-800 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 mx-auto lg:mx-0 mt-0.5"
                          title="View Queue"
                          aria-label="View Queue"
                        >
                          <Icon name="list" className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>Queue ({queue.length})</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Gemini AI-Powered Personalized Recommendations Lounge */}
            {isUiVisible('section.regionalMusic') !== false && (
              <RegionalMusicSection
                onPlayTrack={(song, list) => handlePlayTrending(song.query || song.title, song, list)}
                onContextMenu={handleTrackContextMenu}
                getCleanThumbnail={getCleanThumbnail}
                handleImageError={handleImageError}
                fallbackTracks={uniqueTrendingSongs}
              />
            )}
            {isUiVisible('section.aiForYou') && (
              <PersonalizedRecommendationsSection
                backendUrl={BACKEND_URL}
                authToken={authToken}
                user={user}
                onPlayTrack={(track) => {
                  playSong(track);
                }}
                onOpenAuth={openAuthModal}
                onToggleLike={toggleLike}
                isLiked={isSongLiked}
                onAddToPlaylist={handleAddToPlaylistClick}
        onAddToQueue={addToQueue}
                showToast={showToast}
                onTracksRendered={handlePersonalizedTracksRendered}
                onArtistClick={handleArtistClick}
              />
            )}

            {/* Dynamic Homepage Sections from CMS Configuration */}
            {(() => {
              const sections = (cmsConfig?.sections && cmsConfig.sections.length > 0)
                ? cmsConfig.sections
                : [
                    { id: 'trending', title: 'Trending songs', subtitle: 'The most played hits right now', enabled: true, order: 1 },
                    { id: 'curated', title: 'Curated Featured Collections', subtitle: 'Handpicked mixes, nostalgia sets, and soundtracks curated by our editors', enabled: true, order: 2 },
                    { id: 'artists', title: 'Popular artists', subtitle: 'Find your favorite singers', enabled: true, order: 3 },
                    { id: 'albums', title: 'Popular albums and singles', subtitle: 'Latest releases', enabled: true, order: 4 },
                    { id: 'radio', title: 'Popular radio', subtitle: 'Live streams 24/7', enabled: true, order: 5 }
                  ];

              const sortedSections = [...sections]
                .filter(s => s && s.enabled !== false)
                .filter(s => {
                  if (s.id === 'trending' && !isUiVisible('section.trendingOnLoopra')) return false;
                  if (s.id === 'albums' && !isUiVisible('section.popularAlbums')) return false;
                  if (s.id === 'artists' && !isUiVisible('section.popularArtists')) return false;
                  if (s.id === 'radio' && !isUiVisible('section.popularRadio')) return false;
                  return true;
                })
                .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

              return sortedSections.map(sec => {
                switch (sec.id) {
                  case 'trending':
                    return (
                      <ScrollableRow
                        key="sec-trending"
                        title={sec.title || "Trending songs"}
                        subtitle={sec.subtitle || "The most played hits right now"}
                        items={uniqueTrendingSongs}
                        fallbackItems={[]}
                        showAll={showAllTrending}
                        setShowAll={handleSetShowAllTrending}
                        renderItem={(song) => (
                          <div 
                            onClick={() => handlePlayTrending(song.query || song.title, song, uniqueTrendingSongs)} 
                            className="group relative flex flex-col p-2.5 sm:p-3 rounded-2xl bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800/80 hover:border-amber-500/40 transition-all duration-300 cursor-pointer shadow-md hover:shadow-[0_10px_25px_rgba(245,158,11,0.12)] active:scale-[0.98]"
                          >
                            <div className="relative mb-2.5 overflow-hidden rounded-xl aspect-square shadow-lg">
                              <img 
                                src={getCleanThumbnail(song)} 
                                alt={song.title} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                onError={(e) => handleImageError(e, song.title, song.id)} 
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
                                  <Icon name="play" className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-950 translate-x-[1px]" />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors leading-tight">
                                  {song.title}
                                </h3>
                                <p className="text-[11px] text-neutral-400 truncate mt-1 font-medium">
                                  {song.artist || song.channel || 'Featured Track'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleTrackContextMenu(e, song)}
                                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition shrink-0 cursor-pointer"
                                title="More Options"
                                aria-label="More Options"
                              >
                                <Icon name="moreVertical" className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      />
                    );

                  case 'curated':
                    return (
                      <CmsCuratedCollectionsRow
                        key="sec-curated"
                        backendUrl={BACKEND_URL}
                        title={sec.title || "Curated Featured Collections"}
                        subtitle={sec.subtitle || "Handpicked mixes, nostalgia sets, and soundtracks curated by our editors"}
                        onPlayTrack={(track, collectionTracks) => {
                          handlePlayTrending(track.title || track.name, track, collectionTracks);
                        }}
                      />
                    );

                  case 'artists':
                    return (
                      <ScrollableRow
                        key="sec-artists"
                        title={sec.title || "Popular artists"}
                        subtitle={sec.subtitle || "The voices that define soundtracks."}
                        items={POPULAR_ARTISTS}
                        showAll={showAllArtists}
                        setShowAll={handleSetShowAllArtists}
                        renderItem={(artist) => (
                          <div onClick={() => handleArtistClick(artist.name)} className="group cursor-pointer flex flex-col items-center">
                            <div className="relative mb-2 md:mb-3 w-full aspect-square rounded-full overflow-hidden shadow-lg border-2 border-transparent group-hover:border-amber-500 transition-all duration-300">
                              <img src={artist.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=1e1e1e&color=f59e0b&size=300`} alt={artist.name} referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition duration-500" onError={(e) => handleImageError(e, artist.name)} />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <Icon name="search" className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white drop-shadow-md transform scale-90 group-hover:scale-100 transition" />
                              </div>
                            </div>
                            <h3 className="text-xs md:text-sm font-bold text-white truncate w-full text-center group-hover:text-amber-400 transition">{artist.name}</h3>
                            <p className="text-[10px] md:text-xs text-neutral-400 truncate mt-0.5 md:mt-1 w-full text-center">Artist</p>
                          </div>
                        )}
                      />
                    );

                  case 'albums':
                    return (
                      <ScrollableRow
                        key="sec-albums"
                        title={sec.title || "Popular albums and singles"}
                        subtitle={sec.subtitle || "Latest releases & iconic soundtracks."}
                        items={uniquePopularAlbums}
                        fallbackItems={POPULAR_ALBUMS}
                        showAll={showAllAlbums}
                        setShowAll={handleSetShowAllAlbums}
                        renderItem={(album) => (
                          <div onClick={() => handlePlayTrending(album.query || album.title, album, uniquePopularAlbums)} className="group cursor-pointer">
                            <div className="relative mb-2 md:mb-3">
                              <img src={getCleanThumbnail(album)} alt={album.title} className="w-full aspect-square rounded-md object-cover shadow-lg group-hover:shadow-amber-500/20 transition-all duration-300" onError={(e) => handleImageError(e, album.title, album.id)} />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                                  <Icon name="play" className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-neutral-950 translate-x-[1px] md:translate-x-[2px]" />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <h3 className="text-xs md:text-sm font-bold text-white truncate group-hover:text-amber-400 transition">{album.title}</h3>
                                <p className="text-[11px] md:text-xs text-neutral-400 truncate mt-0.5 md:mt-1">{album.artist}</p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleTrackContextMenu(e, album)}
                                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition shrink-0 cursor-pointer"
                                title="More Options"
                                aria-label="More Options"
                              >
                                <Icon name="moreVertical" className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      />
                    );

                  case 'radio':
                    return (
                      <ScrollableRow
                        key="sec-radio"
                        title={sec.title || "Popular radio"}
                        subtitle={sec.subtitle || "Live streams and 24/7 continuous audio."}
                        items={uniquePopularRadio}
                        fallbackItems={POPULAR_RADIO}
                        showAll={showAllRadio}
                        setShowAll={handleSetShowAllRadio}
                        renderItem={(radio) => (
                          <div onClick={() => handlePlayTrending(radio.query || radio.title, radio, uniquePopularRadio)} className="group cursor-pointer">
                            <div className="relative mb-2 md:mb-3">
                              <img src={getCleanThumbnail(radio)} alt={radio.title} className="w-full aspect-square rounded-md object-cover shadow-lg group-hover:shadow-amber-500/20 transition-all duration-300" onError={(e) => handleImageError(e, radio.title, radio.id)} />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                                  <Icon name="play" className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-neutral-950 translate-x-[1px] md:translate-x-[2px]" />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <h3 className="text-xs md:text-sm font-bold text-white truncate group-hover:text-amber-400 transition">{radio.title}</h3>
                                <p className="text-[11px] md:text-xs text-neutral-400 truncate mt-0.5 md:mt-1">{radio.artist}</p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleTrackContextMenu(e, radio)}
                                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition shrink-0 cursor-pointer"
                                title="More Options"
                                aria-label="More Options"
                              >
                                <Icon name="moreVertical" className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      />
                    );

                  default:
                    return null;
                }
              });
            })()}

            {/* Ratings & Reviews Community Section */}
            <HomepageReviewsSection 
              refreshTrigger={reviewsRefreshKey} 
              onOpenRatingModal={handleOpenRatingModal} 
            />

            {/* Loopra Footer — Strictly visible on the Home Page ONLY */}
            {isActualHomeRoute && <DisclaimerFooter {...commonFooterProps} />}
          </div>
        )}

        {Boolean(currentStation && !['home', 'discover', 'swipe', 'for-you', 'library', 'history', 'radio', 'indian-radio', 'mood', 'timemachine', 'activity', 'admin', 'offline', 'offline-explore'].includes(activeTab)) && (
          <NostalgiaStationView
            key={`page-station-${activeTab}`}
            station={currentStation}
            songs={songs}
            stationLoading={stationLoading}
            stationVisibleCount={stationVisibleCount}
            currentSong={currentSong}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            playSong={playSong}
            handleOpenVideo={handleOpenVideo}
            queue={queue}
            removeFromQueue={removeFromQueue}
            addToQueue={addToQueue}
            toggleLike={toggleLike}
            likedSongs={likedSongs}
            playNext={playNext}
            handleFindSimilar={handleFindSimilar}
            handleAddToPlaylistClick={handleAddToPlaylistClick}
            showToast={showToast}
            handleLoadMoreStationSongs={handleLoadMoreStationSongs}
            isLoadingMoreStation={isLoadingMoreStation}
            onGoBack={canGoBack(navigationStack, activeTab, { showAllTrending, showAllArtists, showAllAlbums, showAllRadio, selectedPlaylistForView, offlineSubView }) ? handleGoBack : null}
            getCleanThumbnail={getCleanThumbnail}
            handleImageError={handleImageError}
          />
        )}

        {activeTab === 'library' && (
          <div key="page-library" className={`page-transition w-full px-2 sm:px-4 md:px-8 space-y-5 relative z-10 ${USE_V2_LIBRARY_UI ? 'pb-32' : ''}`}>
            {USE_V2_LIBRARY_UI ? (
              /* ========================================================================= */
              /* V2 LIKED SONGS & LIBRARY REDESIGN (Dynamic Header, Artwork, Clearance)   */
              /* ========================================================================= */
              <>
                {/* Dynamic Gradient Heart Playlist Cover Header */}
                <div className="relative rounded-3xl overflow-hidden p-5 sm:p-7 bg-gradient-to-br from-purple-900/40 via-amber-950/30 to-neutral-950 border border-amber-500/20 shadow-2xl backdrop-blur-xl">
                  <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none" />

                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                    <div className="flex items-center gap-4">
                      {/* Gradient Heart Artwork Square */}
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-600 to-amber-500 flex items-center justify-center shadow-[0_10px_30px_rgba(244,63,94,0.35)] shrink-0 group">
                        <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white fill-current filter drop-shadow-md group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </div>

                      <div className="min-w-0">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                          Playlist Collection
                        </span>
                        <h1 className="text-2xl sm:text-4xl font-display font-black text-white tracking-tight mt-1">
                          Liked <span className="text-amber-400">Songs</span>
                        </h1>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400 font-medium">
                          <span>{likedSongs.length} {likedSongs.length === 1 ? 'Track' : 'Tracks'}</span>
                          <span>•</span>
                          <span className="text-amber-300/90 font-mono">Personal Vault</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Row: Big Circular Play/Shuffle Button */}
                    {likedSongs.length > 0 && (
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (likedSongs.length > 0) {
                              playSong(likedSongs[0], likedSongs);
                            }
                          }}
                          className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-black text-sm shadow-[0_0_25px_rgba(245,158,11,0.4)] active:scale-95 transition-all cursor-pointer"
                        >
                          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          <span>Play All</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Track List Section */}
                <div className="space-y-2 mt-2">
                  {likedSongs.length === 0 ? (
                    <div className="p-12 text-center rounded-3xl bg-neutral-900/30 border border-white/5 space-y-3">
                      <div className="w-14 h-14 rounded-full bg-white/5 text-zinc-500 flex items-center justify-center mx-auto">
                        <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </div>
                      <h3 className="font-bold text-white text-sm">No liked tracks yet</h3>
                      <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                        Tap the heart icon on any track while streaming to add it to your permanent personal collection.
                      </p>
                    </div>
                  ) : (
                    likedSongs.map((track, i) => {
                      const isMenuOpen = openMenuId === `${track.id}-${i}`;
                      const isCurrent = (currentSong?.id || currentSong?.videoId) === (track.id || track.videoId);
                      const thumb = getCleanThumbnail(track);

                      return (
                        <div
                          key={track.id + i}
                          onClick={() => playSong(track, likedSongs)}
                          onContextMenu={(e) => handleTrackContextMenu(e, track)}
                          className={`px-3.5 py-2.5 rounded-2xl border grid grid-cols-12 items-center gap-2 cursor-pointer transition-all duration-200 group relative backdrop-blur-md select-none ${
                            isMenuOpen ? 'z-30' : 'z-auto'
                          } ${
                            isCurrent
                              ? 'bg-amber-500/15 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                              : 'bg-neutral-900/50 hover:bg-neutral-900/90 border-white/5 hover:border-amber-500/30 active:scale-[0.99]'
                          }`}
                        >
                          {/* Col 1: # Index / Waveform (1 col on desktop, auto on mobile) */}
                          <div className="col-span-1 sm:col-span-1 flex items-center justify-center">
                            {isCurrent && isPlaying ? (
                              <span className="inline-flex items-center gap-0.5 h-3">
                                <span className="w-0.5 h-3 bg-amber-400 animate-pulse" />
                                <span className="w-0.5 h-2 bg-amber-400 animate-ping" />
                                <span className="w-0.5 h-3 bg-amber-400 animate-pulse" />
                              </span>
                            ) : (
                              <span className={`text-xs font-mono font-medium ${isCurrent ? 'text-amber-400' : 'text-zinc-500 group-hover:text-amber-300'}`}>
                                {i + 1}
                              </span>
                            )}
                          </div>

                          {/* Col 2: Thumbnail + Title + Artist (7 cols on desktop, 9 cols on mobile) */}
                          <div className="col-span-8 sm:col-span-7 flex items-center gap-3 min-w-0 pr-2">
                            <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-neutral-800 shrink-0 border border-white/10 shadow-md">
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt={track.title || ""}
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => handleImageError(e, track.title, track.id)}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-amber-400">
                                  <Icon name="music" className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className={`font-bold text-xs sm:text-sm truncate transition ${isCurrent ? 'text-amber-300' : 'text-white group-hover:text-amber-300'}`}>
                                {track.title}
                              </h4>
                              <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                {track.channel || track.artist || 'Artist'}
                              </p>
                            </div>
                          </div>

                          {/* Col 3: Duration (2 cols on desktop, hidden on tiny mobile) */}
                          <div className="hidden sm:flex col-span-2 items-center justify-center text-xs font-mono text-zinc-400">
                            <span>{formatTrackDuration(track.duration)}</span>
                          </div>

                          {/* Col 4: Hover Actions [Play, ✕ Remove, ⋮ More] (2 cols on desktop, 3 cols on mobile) */}
                          <div className={`col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5 relative ${isMenuOpen ? 'z-40' : ''}`} onClick={(e) => e.stopPropagation()}>
                            {/* Quick Play button on hover */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playSong(track, likedSongs);
                              }}
                              className="p-1.5 rounded-xl bg-white/5 hover:bg-amber-500/20 text-zinc-400 hover:text-amber-400 border border-white/10 hover:border-amber-500/40 transition opacity-80 sm:opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer"
                              title="Play Track"
                              aria-label="Play Track"
                            >
                              <Icon name={isCurrent && isPlaying ? "pause" : "play"} className="w-3.5 h-3.5 fill-current" />
                            </button>

                            {/* Quick Delete / Unlike Button (One-Tap Cross Icon) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLike(track);
                              }}
                              className="p-1.5 rounded-xl bg-white/5 hover:bg-red-500/15 text-zinc-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition flex items-center shrink-0 cursor-pointer active:scale-95"
                              title="Remove from Liked Songs"
                              aria-label="Remove from Liked Songs"
                            >
                              <Icon name="close" className="w-3.5 h-3.5 shrink-0" />
                            </button>
                            
                            <button 
                              type="button"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setOpenMenuId(isMenuOpen ? null : `${track.id}-${i}`); 
                              }} 
                              className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition shrink-0 cursor-pointer"
                              title="More Options"
                              aria-label="More Options"
                            >
                              <Icon name="moreVertical" className="w-4 h-4 shrink-0" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 top-full mt-1.5 w-48 bg-neutral-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50 animate-fadeIn">
                                {currentSong?.id !== track.id && (
                                  <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{isSongLiked(track) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
                                <button onClick={(e) => { e.stopPropagation(); playNext(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition flex items-center gap-2">
                                  <span>⏭️</span>
                                  <span>Play Next</span>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleFindSimilar(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-amber-400 hover:bg-neutral-800 transition flex items-center gap-2">
                                  <span>✨</span>
                                  <span>Similar Songs</span>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveSongFromPlaylist(selectedPlaylistForView.id, track.id || track.videoId);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-neutral-800 transition"
                                >
                                  Remove from Playlist
                                </button>
                                <DownloadTrackButton track={track} variant="menu-item" showToast={showToast} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              /* Original V1 Liked Songs Layout */
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-display font-extrabold tracking-tight text-white">Liked Songs Collection</h2>
                  {likedSongs.length > 0 && (
                    <span className="text-xs text-neutral-400 font-mono">{likedSongs.length} tracks</span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {likedSongs.length === 0 ? (
                    <p className="text-xs text-neutral-500">No liked songs yet.</p>
                  ) : (
                    likedSongs.map((track, i) => {
                      const isMenuOpen = openMenuId === `${track.id}-${i}`;
                      return (
                        <div key={track.id + i} onClick={() => playSong(track)} onContextMenu={(e) => handleTrackContextMenu(e, track)} className={`p-3.5 rounded-2xl border bg-neutral-900/50 border-neutral-800 flex items-center justify-between cursor-pointer hover:bg-neutral-900 active:scale-[0.98] transition relative ${isMenuOpen ? 'z-30' : 'z-auto'}`}>
                          <div className="flex items-center gap-3.5 min-w-0">
                            <img src={getCleanThumbnail(track)} alt={track.title || ""} loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0" onError={(e) => handleImageError(e, track.title, track.id)} />
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-white truncate">{track.title}</h4>
                              <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                            </div>
                          </div>
                          <div className={`flex items-center gap-2 shrink-0 relative ${isMenuOpen ? 'z-40' : ''}`}>
                            {/* Quick Delete / Unlike Button (One-Tap Cross Icon) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLike(track);
                              }}
                              className="p-1.5 rounded-2xl bg-white/5 hover:bg-red-500/15 text-neutral-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition flex items-center shrink-0 cursor-pointer active:scale-95"
                              title="Remove from Liked Songs"
                              aria-label="Remove from Liked Songs"
                            >
                              <Icon name="close" className="w-3.5 h-3.5 shrink-0" />
                            </button>
                            
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setOpenMenuId(isMenuOpen ? null : `${track.id}-${i}`); 
                              }} 
                              className="p-1 text-neutral-500 hover:text-white transition shrink-0"
                            >
                              <Icon name="moreVertical" className="w-5 h-5 shrink-0" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 top-full mt-1.5 w-44 bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-700/80 overflow-hidden z-50 animate-fadeIn">
                                {currentSong?.id !== track.id && (
                                  <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{isSongLiked(track) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
                                <button onClick={(e) => { e.stopPropagation(); playNext(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition flex items-center gap-2">
                                    <span>⏭️</span>
                                    <span>Play Next</span>
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleFindSimilar(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-amber-400 hover:bg-neutral-800 transition flex items-center gap-2">
                                    <span>✨</span>
                                    <span>Similar Songs</span>
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
                                  <DownloadTrackButton track={track} variant="menu-item" showToast={showToast} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div key="page-history" className="page-transition w-full px-2 sm:px-4 md:px-8 space-y-6 relative z-10">
            {!isUiVisible('section.recentlyPlayed') ? (
              <div className="py-16 text-center text-neutral-500 text-xs">
                Listening history section is temporarily hidden by administrator.
              </div>
            ) : (
            <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-display font-extrabold tracking-tight text-white">Listening History</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Your recently played tracks and listening log</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsStatsOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition shadow-sm cursor-pointer active:scale-95"
                  title="View Weekly Recap & Statistics"
                >
                  <Icon name="sparkles" className="w-3.5 h-3.5 text-amber-400" />
                  <span>Weekly Recap & Stats</span>
                </button>
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear your entire listening history?")) {
                        clearHistory();
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs transition cursor-pointer active:scale-95"
                    title="Clear Listening History"
                  >
                    <Icon name="trash" className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {history.length === 0 ? (
                <p className="text-xs text-neutral-500">No history available.</p>
              ) : (
                history.slice(0, historyPageLimit).map((track, i) => {
                  const isMenuOpen = openMenuId === `${track.id}-${i}`;
                  return (
                    <div key={track.id + i} onClick={() => playSong(track)} onContextMenu={(e) => handleTrackContextMenu(e, track)} className={`p-3.5 rounded-2xl border bg-neutral-900/50 border-neutral-800 flex items-center justify-between cursor-pointer hover:bg-neutral-900 active:scale-[0.98] transition relative ${isMenuOpen ? 'z-30' : 'z-auto'}`}>
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img src={getCleanThumbnail(track)} alt={track.title || ""} loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0" onError={(e) => handleImageError(e, track.title, track.id)} />
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-white truncate">{track.title}</h4>
                          <p className="text-[10px] text-neutral-400 truncate">{track.channel || track.artist}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 relative ${isMenuOpen ? 'z-40' : ''}`}>
                        {/* Quick Delete from History (One-Tap Cross Icon) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistory(prev => prev.filter((_, idx) => idx !== i));
                            showToast("Removed from history");
                          }}
                          className="p-1.5 rounded-2xl bg-white/5 hover:bg-red-500/15 text-neutral-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition flex items-center shrink-0 cursor-pointer active:scale-95"
                          title="Remove from History"
                          aria-label="Remove from History"
                        >
                          <Icon name="close" className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : `${track.id}-${i}`); }} className="p-1.5 rounded-2xl hover:bg-white/10 text-neutral-400 transition flex items-center shrink-0 cursor-pointer">
                            <Icon name="moreVertical" className="w-4 h-4 shrink-0" />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-48 bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-700/80 overflow-hidden z-50 animate-fadeIn">
                              <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
                              <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{isSongLiked(track) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
                              <button onClick={(e) => { e.stopPropagation(); playNext(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition flex items-center gap-2">
                                <span>⏭️</span>
                                <span>Play Next</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleFindSimilar(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-amber-400 hover:bg-neutral-800 transition flex items-center gap-2">
                                <span>✨</span>
                                <span>Similar Songs</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHistory(prev => prev.filter((_, idx) => idx !== i));
                                  setOpenMenuId(null);
                                  showToast("Removed from history");
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-neutral-800 transition"
                              >
                                Remove from History
                              </button>
                              <DownloadTrackButton track={track} variant="menu-item" showToast={showToast} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {history.length > historyPageLimit && (
              <div className="text-center pt-2">
                <button
                  onClick={() => setHistoryPageLimit(prev => prev + 15)}
                  className="px-5 py-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-amber-300 border border-neutral-700/80 transition cursor-pointer"
                >
                  Load More History ({history.length - historyPageLimit} remaining)
                </button>
              </div>
            )}
            </>
            )}
          </div>
        )}

        {activeTab === 'playlists' && (
          <div key={`page-playlists-${selectedPlaylistForView?.id || 'list'}`} className={`page-transition w-full px-2 sm:px-4 md:px-8 space-y-6 relative z-10 ${USE_V2_PLAYLISTS_UI ? 'pb-32' : ''}`}>
            {isSharedPlaylistLoading && (
              <div className="flex items-center justify-center py-16 gap-3 text-amber-400">
                <span className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-semibold">Loading shared playlist...</span>
              </div>
            )}

            {sharedPlaylistError && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-3 text-xs">
                <span>{sharedPlaylistError}</span>
                <button
                  onClick={() => setSharedPlaylistError(null)}
                  className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 font-bold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {!selectedPlaylistForView ? (
              USE_V2_PLAYLISTS_UI ? (
                /* ========================================================================= */
                /* V2 PLAYLISTS & MIXTAPES REDESIGN (Aesthetic cards, 4-tile art, filter chips) */
                /* ========================================================================= */
                <>
                  {/* Modern Header: Back + Title + New Playlist Quick Pill */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                        Mixtapes & Jukeboxes
                      </span>
                      <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white mt-1">
                        Your <span className="text-amber-400">Playlists</span>
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={openCreatePlaylistModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" />
                      <span>New Playlist</span>
                    </button>
                  </div>

                  {/* Filter chips strip */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                    {['All Playlists', 'Created by You', 'Saved Mixtapes'].map((chip, idx) => (
                      <span
                        key={chip}
                        className={`text-xs px-3 py-1 rounded-full whitespace-nowrap cursor-pointer transition select-none ${
                          idx === 0
                            ? 'bg-amber-400 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                            : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
                        }`}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  {/* Rich Visual Playlist Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 mt-2">
                    {/* Create Playlist Action Card */}
                    <div 
                      onClick={openCreatePlaylistModal}
                      className="p-4 rounded-2xl border border-dashed border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-neutral-900/40 to-neutral-950/80 hover:border-amber-400 hover:bg-amber-500/15 active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center gap-2.5 transition-all group text-center aspect-square shadow-lg backdrop-blur-md"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-400 group-hover:scale-110 flex items-center justify-center transition shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <Icon name="plus" className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-white text-xs sm:text-sm truncate w-full group-hover:text-amber-300 transition">
                          Create Playlist
                        </h3>
                        <p className="text-[10px] text-amber-400/80 font-mono mt-0.5">New Collection</p>
                      </div>
                    </div>

                    {/* User Playlist Cards with 4-tile artwork / cassette vinyl depth */}
                    {playlists.map(pl => {
                      const songThumbs = (pl.songs || [])
                        .slice(0, 4)
                        .map(s => getCleanThumbnail(s))
                        .filter(Boolean);

                      return (
                        <div 
                          key={pl.id} 
                          onClick={() => {
                            setSelectedPlaylistForView(pl);
                            handleStationSelect('playlists', { id: pl.id });
                          }}
                          className="relative p-3 rounded-2xl border border-white/5 hover:border-amber-500/40 bg-gradient-to-br from-neutral-900/90 via-[#121216] to-[#0c0c0e] active:scale-[0.98] cursor-pointer flex flex-col justify-between transition-all group aspect-square shadow-xl backdrop-blur-md overflow-hidden"
                        >
                          {/* Ambient glow on hover */}
                          <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/5 transition-colors pointer-events-none" />

                          {/* Top row: Track Count Micro-Pill & Quick Actions */}
                          <div className="flex items-center justify-between w-full relative z-10" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-neutral-800/90 text-amber-400 border border-neutral-700/60 font-semibold">
                              {pl.songs.length === 1 ? '1 Track' : pl.songs.length === 0 ? 'Empty' : `${pl.songs.length} Tracks`}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenamePlaylist(pl.id);
                                }}
                                className="p-1 rounded-lg bg-neutral-800/90 hover:bg-amber-500/20 text-neutral-400 hover:text-amber-400 border border-neutral-700/60 transition"
                                title="Rename Playlist"
                                aria-label="Rename Playlist"
                              >
                                <Icon name="edit" className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePlaylist(pl.id);
                                }}
                                className="p-1 rounded-lg bg-neutral-800/90 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-neutral-700/60 transition"
                                title="Delete Playlist"
                                aria-label="Delete Playlist"
                              >
                                <Icon name="trash" className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Center Collage / Cassette Vinyl Placeholder */}
                          <div className="relative z-10 w-full flex items-center justify-center my-auto">
                            {songThumbs.length >= 4 ? (
                              <div className="grid grid-cols-2 gap-1 w-16 h-16 rounded-xl overflow-hidden shadow-lg border border-white/10">
                                {songThumbs.map((t, idx) => (
                                  <img key={idx} src={t} alt="" className="w-full h-full object-cover" />
                                ))}
                              </div>
                            ) : songThumbs.length > 0 ? (
                              <div className="w-16 h-16 rounded-xl overflow-hidden shadow-lg border border-amber-500/20">
                                <img src={songThumbs[0]} alt="" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-neutral-800/80 border border-white/10 group-hover:border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner group-hover:scale-105 transition">
                                <Icon name="list" className="w-7 h-7" />
                              </div>
                            )}
                          </div>

                          {/* Bottom Label */}
                          <div className="relative z-10 text-left pt-1">
                            <h3 className="font-extrabold text-white text-xs sm:text-sm truncate w-full group-hover:text-amber-300 transition">
                              {pl.name}
                            </h3>
                            <p className="text-[10px] text-zinc-400 truncate">Tap to play & view</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Original V1 Playlist Grid Layout */
                <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-2xl font-display font-extrabold tracking-tight text-white">Your Playlists</h2>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
                    <div 
                      onClick={openCreatePlaylistModal}
                      className="p-4 rounded-2xl border border-dashed border-neutral-700 bg-neutral-900/30 hover:bg-neutral-800/50 active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center gap-3 transition group text-center aspect-square"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-neutral-800/50 group-hover:bg-amber-500/20 text-neutral-500 group-hover:text-amber-500 flex items-center justify-center transition">
                        <Icon name="plus" className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm truncate w-full">Create Playlist</h3>
                        <p className="text-[10px] text-neutral-400 mt-0.5">New folder</p>
                      </div>
                    </div>
                    {playlists.map(pl => (
                      <div 
                        key={pl.id} 
                        onClick={() => {
                          setSelectedPlaylistForView(pl);
                          handleStationSelect('playlists', { id: pl.id });
                        }}
                        className="relative p-4 rounded-2xl border bg-neutral-900/50 hover:bg-neutral-800 active:scale-[0.98] border-neutral-800 cursor-pointer flex flex-col items-center justify-center gap-3 transition group text-center aspect-square"
                      >
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenamePlaylist(pl.id);
                            }}
                            className="p-1 rounded-lg bg-neutral-800/90 hover:bg-amber-500/20 text-neutral-400 hover:text-amber-400 border border-neutral-700/60 transition"
                            title="Rename Playlist"
                            aria-label="Rename Playlist"
                          >
                            <Icon name="edit" className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlaylist(pl.id);
                            }}
                            className="p-1 rounded-lg bg-neutral-800/90 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-neutral-700/60 transition"
                            title="Delete Playlist"
                            aria-label="Delete Playlist"
                          >
                            <Icon name="trash" className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="w-16 h-16 rounded-2xl bg-neutral-800 group-hover:bg-amber-500/20 text-neutral-500 group-hover:text-amber-500 flex items-center justify-center transition">
                          <Icon name="list" className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm truncate w-full">{pl.name}</h3>
                          <p className="text-[10px] text-neutral-400 mt-0.5">{pl.songs.length} tracks</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4 pl-0">
                    <button 
                      data-voice-back="true"
                      onClick={handleGoBack}
                      className="p-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white transition flex items-center justify-center cursor-pointer active:scale-95"
                      title="Back to Playlists"
                      aria-label="Back to Playlists"
                    >
                      <Icon name="skipPrev" className="w-4 h-4 rotate-180" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-display font-extrabold tracking-tight text-white">{selectedPlaylistForView.name}</h2>
                        {selectedPlaylistForView.isShared && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                            Shared Playlist
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                        <span>{selectedPlaylistForView.songs.length} tracks</span>
                        {selectedPlaylistForView.creator?.displayName && (
                          <>
                            <span>•</span>
                            <span className="text-neutral-400">Created by <span className="text-amber-400/90 font-medium">@{selectedPlaylistForView.creator.displayName || selectedPlaylistForView.creator.username}</span></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Play All, Save to Library (if shared/external), Rename, Delete, Share */}
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    {/* Play All Tracks in Playlist */}
                    {selectedPlaylistForView.songs && selectedPlaylistForView.songs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const firstTrack = selectedPlaylistForView.songs[0];
                          if (firstTrack) {
                            playSong(firstTrack);
                            // Queue the rest of the playlist
                            const rest = selectedPlaylistForView.songs.slice(1);
                            if (rest.length > 0) {
                              setQueue(rest);
                            }
                            showToast(`Playing "${selectedPlaylistForView.name}"`);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
                        title="Play All"
                        aria-label="Play All"
                      >
                        <Icon name="play" className="w-4 h-4 fill-current shrink-0" />
                        <span>Play All</span>
                      </button>
                    )}
                    <button
                        type="button"
                        onClick={() => handleSharePlaylist(selectedPlaylistForView)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
                      title="Share Playlist"
                      aria-label="Share Playlist"
                    >
                      <Icon name="share" className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Share Playlist</span>
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-2 mt-4">
                  {selectedPlaylistForView.songs.length === 0 ? (
                    <p className="text-xs text-neutral-500 p-4 text-center border border-dashed border-neutral-800 rounded-2xl">Empty playlist.</p>
                  ) : (
                    selectedPlaylistForView.songs.map((track, i) => {
                      const isCurrent = (currentSong?.id || currentSong?.videoId) === (track.id || track.videoId);
                      const isMenuOpen = openMenuId === `${track.id || track.videoId}-${i}`;
                      return (
                        <div
                          key={`${track.id || track.videoId}-${i}`}
                          onClick={() => playSong(track)}
                          className={`group grid grid-cols-12 items-center gap-3 px-3 sm:px-4 py-2.5 rounded-2xl transition cursor-pointer border ${
                            isCurrent
                              ? 'bg-amber-500/10 border-amber-500/40'
                              : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div className="col-span-9 sm:col-span-10 flex items-center gap-3 min-w-0">
                            <span className="text-xs font-mono text-zinc-500 w-5 text-center shrink-0">
                              {isCurrent && isPlaying ? '▶' : i + 1}
                            </span>
                            <img
                              src={getCleanThumbnail(track)}
                              alt={track.title || ''}
                              className="w-10 h-10 rounded-lg object-cover shrink-0 bg-neutral-800"
                              onError={(e) => handleImageError(e, track.title, track.id)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-bold truncate ${isCurrent ? 'text-amber-400' : 'text-white'}`}>
                                {track.title}
                              </p>
                              <p className="text-xs text-zinc-400 truncate">
                                {track.artist || track.channel || 'Unknown Artist'}
                              </p>
                            </div>
                          {/* Col 4: Hover Actions [Play, ✕ Remove, ⋮ More] */}
                          <div className={`col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5 relative ${isMenuOpen ? 'z-40' : ''}`} onClick={(e) => e.stopPropagation()}>
                            {/* Quick Play on hover */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playSong(track);
                              }}
                              className="p-1.5 rounded-xl bg-white/5 hover:bg-amber-500/20 text-zinc-400 hover:text-amber-400 border border-white/10 hover:border-amber-500/40 transition opacity-80 sm:opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer"
                              title="Play Track"
                              aria-label="Play Track"
                            >
                              <Icon name={(currentSong?.id || currentSong?.videoId) === (track.id || track.videoId) && isPlaying ? "pause" : "play"} className="w-3.5 h-3.5 fill-current" />
                            </button>

                            {/* Quick Delete from Playlist (One-Tap Cross Icon) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSongFromPlaylist(selectedPlaylistForView.id, track.id || track.videoId);
                              }}
                              className="p-1.5 rounded-xl bg-white/5 hover:bg-red-500/15 text-neutral-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition flex items-center shrink-0 cursor-pointer active:scale-95"
                              title="Remove from Playlist"
                              aria-label="Remove from Playlist"
                            >
                              <Icon name="close" className="w-3.5 h-3.5 shrink-0" />
                            </button>

                            <button 
                              type="button"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setOpenMenuId(isMenuOpen ? null : `${track.id}-${i}`); 
                              }} 
                              className="p-1.5 text-neutral-400 hover:text-white rounded-xl hover:bg-white/10 transition shrink-0 cursor-pointer"
                              title="More Options"
                              aria-label="More Options"
                            >
                              <Icon name="moreVertical" className="w-4 h-4 shrink-0" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 top-full mt-1.5 w-44 bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-700/80 overflow-hidden z-50 animate-fadeIn">
                                {currentSong?.id !== track.id && (
                                  <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{isSongLiked(track) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
                                <button onClick={(e) => { e.stopPropagation(); playNext(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition flex items-center gap-2">
                                <span>⏭️</span>
                                <span>Play Next</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleFindSimilar(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-amber-400 hover:bg-neutral-800 transition flex items-center gap-2">
                                <span>✨</span>
                                <span>Similar Songs</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
                                <DownloadTrackButton track={track} variant="menu-item" showToast={showToast} />
                              </div>
                            )}
                          </div>
                        </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'rooms' && (
          <div key="page-rooms" className="page-transition w-full px-2 sm:px-4 md:px-8 space-y-6 relative z-10 pb-32">
            <ListeningRoomsView
              socket={socket}
              user={user}
              authToken={authToken}
              onOpenAuth={openAuthModal}
              currentSong={currentSong}
              isPlaying={isPlaying}
              currentTimeRef={currentTimeRef}
              onPlaySong={playSong}
              onSeek={handleSeek}
              showToast={showToast}
              activeRoom={activeRoom}
              setActiveRoom={setActiveRoom}
              roomPlaylists={roomPlaylists}
              setRoomPlaylists={setRoomPlaylists}
              userPlaylists={playlists}
              setPlaylists={setPlaylists}
              isRoomPlaybackSyncEnabled={isRoomPlaybackSyncEnabled}
              setIsRoomPlaybackSyncEnabled={setIsRoomPlaybackSyncEnabled}
              onOpenAddToPlaylist={(track) => handleAddToPlaylistClick(track || currentSong)}
              onBackToHome={() => handleStationSelect('home')}
              onToggleLike={toggleLike}
              isLiked={isSongLiked}
              onAddToQueue={(track) => addToQueue(track)}
            />
          </div>
        )}

        {activeTab === 'downloads' && (
          cmsConfig?.featureControls?.offlineDownloadsEnabled === false ? (
            <div key="downloads-disabled" className="page-transition flex-1 w-full px-4 md:px-8 py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center mb-4 text-neutral-400">
                <Icon name="download" className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Offline Downloads Disabled</h2>
              <p className="text-neutral-400 max-w-md text-sm mb-6">
                Offline downloads and caching have been temporarily disabled by the administrator. Existing cached songs remain saved on your device.
              </p>
              <button
                onClick={() => handleStationSelect('home')}
                className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm transition"
              >
                Return to Home
              </button>
            </div>
          ) : (
          <div key={`page-downloads-${offlineSubView}`} className="page-transition flex-1 w-full px-2 sm:px-4 md:px-8 py-4 sm:py-6 pb-32">
            {offlineSubView === 'explore' ? (
              <OfflineEligibleExploreView
                onBack={handleGoBack}
                onPlayTrack={(track, list) => {
                  playSong(track, list || [track]);
                }}
                currentSong={currentSong}
                isPlaying={isPlaying}
                showToast={showToast}
                backendUrl={BACKEND_URL}
              />
            ) : (
              <OfflineLibraryView
                onPlayTrack={(track, list) => {
                  playSong(track, list || [track]);
                }}
                currentSong={currentSong}
                isPlaying={isPlaying}
                showToast={showToast}
                onExploreAuthorizedTracks={() => {
                  setOfflineSubView('explore');
                  handleStationSelect('downloads', { subView: 'explore' });
                }}
              />
            )}
          </div>
          )
        )}

        {activeTab === 'mood' && (
          <div key="page-mood" className="page-transition flex-1 w-full px-2 sm:px-4 md:px-8 py-4 sm:py-6 pb-32">
            <MoodToMusicSection
              onPlaySong={playSong}
              onAddToQueue={(track) => addToQueue(track)}
              onToggleFavorite={toggleLike}
              favorites={likedSongs}
              currentSong={currentSong}
              isPlaying={isPlaying}
              user={user}
              token={authToken}
              backendUrl={BACKEND_URL}
              onSavePlaylist={(name, playlistTracks) => {
                const newPlaylist = {
                  id: Date.now().toString(),
                  name,
                  songs: playlistTracks
                };
                setPlaylists(prev => [...prev, newPlaylist]);
                showToast(`Saved mood playlist "${name}" (${playlistTracks.length} tracks)`);
              }}
            />
          </div>
        )}

        {(activeTab === 'radio' || activeTab === 'indian-radio') && (
          <div key="page-radio" className="page-transition flex-1 w-full px-2 sm:px-4 md:px-8 py-4 sm:py-6 pb-32">
            <IndianRadioView
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlayStation={playSong}
              onTogglePlay={togglePlayPause}
              apiBase={BACKEND_URL}
            />
          </div>
        )}

        {activeTab === 'timemachine' && (
          <div key="page-timemachine" className="page-transition flex-1 w-full px-2 sm:px-4 md:px-8 py-4 sm:py-6 pb-32">
            <TimeMachineRadio
              cmsConfig={cmsConfig}
              onPlaySong={playSong}
              onAddToQueue={(track) => addToQueue(track)}
              onToggleFavorite={toggleLike}
              favorites={likedSongs}
              currentSong={currentSong}
              isPlaying={isPlaying}
              backendUrl={BACKEND_URL}
            />
          </div>
        )}

        {activeTab === 'activity' && (
          <div key="page-activity" className="page-transition flex-1 w-full px-2 sm:px-4 md:px-8 py-4 sm:py-6 pb-32">
            <ActivityFeed
              user={user}
              token={authToken}
              onPlaySong={playSong}
              onAddToQueue={(track) => addToQueue(track)}
              onToggleFavorite={toggleLike}
              favorites={likedSongs}
              currentSong={currentSong}
              isPlaying={isPlaying}
              backendUrl={BACKEND_URL}
            />
          </div>
        )}

        {activeTab === 'admin' && (
          <div key="page-admin" className="page-transition fixed inset-0 z-[60] bg-neutral-950 overflow-y-auto">
            <AdminDashboard
              user={user}
              token={authToken}
              backendUrl={BACKEND_URL}
              onExit={() => {
                handleGoBack();
                setReviewsRefreshKey(k => k + 1);
                // Revert any uncommitted live draft preview back to published config
                const published = getCachedCmsConfig();
                const resolved = resolvePlatformConfig(published);
                setCmsConfig(resolved);
                applyThemeToDom(resolved.theme, true);
                fetchPublicCmsConfig(BACKEND_URL).then(cfg => {
                  if (cfg) {
                    const res = resolvePlatformConfig(cfg);
                    setCmsConfig(res);
                    applyThemeToDom(res.theme, true);
                  }
                });
              }}
              onOpenAuth={openAuthModal}
              showToast={showToast}
              onReviewsUpdated={() => setReviewsRefreshKey(k => k + 1)}
              onUserUpdated={(updatedUser) => {
                if (!updatedUser) return;
                setUser(prev => {
                  const merged = { ...(prev || {}), ...updatedUser };
                  setTabAuthSession(authToken || getTabAuthToken(), merged);
                  return merged;
                });
              }}
              onPreviewConfig={(previewConfig) => {
                if (previewConfig) {
                  const res = resolvePlatformConfig(previewConfig);
                  setCmsConfig(res);
                  applyThemeToDom(res.theme, false);
                }
              }}
            />
          </div>
        )}

        {(activeTab === 'download' || activeTab === 'download-app' || activeTab === 'apk') && (
          <div key="page-download" className="page-transition w-full px-2 sm:px-4 md:px-8 space-y-6 relative z-10">
            <AndroidApkDownloadSection onBack={handleGoBack} />
          </div>
        )}

        {activeTab === 'dj-club' && (
          <div key="page-dj-club" className="absolute inset-0 z-30 w-full h-full overflow-hidden">
            <DjClubPage
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlaySong={playSong}
              onTogglePlay={togglePlayPause}
              onNextSong={handleNextSong}
              onPrevSong={handlePrevSong}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              isShuffle={isShuffle}
              onToggleShuffle={toggleShuffle}
              isRepeat={isRepeat}
              onToggleRepeat={toggleRepeatMode}
              onNavigate={(tab) => {
                setActiveTab(tab);
                window.history.pushState({ tab }, '', buildPath(tab));
              }}
              user={user}
              cmsConfig={cmsConfig}
              onOpenSearch={() => {
                setActiveTab('discover');
                window.history.pushState({ tab: 'discover' }, '', '/discover');
              }}
              onOpenProfile={() => setIsAccountMenuOpen(true)}
            />
          </div>
        )}
      </main>
    );
  })()}
      {isRegionalLocationEnabled && showLocationConsentBanner && (
        <div className="fixed bottom-36 sm:bottom-28 left-4 sm:left-auto sm:right-20 mb-[env(safe-area-inset-bottom)] z-[9990] max-w-xs p-3.5 rounded-2xl bg-neutral-900/95 border border-amber-500/30 shadow-2xl backdrop-blur-xl space-y-2.5 animate-fadeIn">
          <div className="text-xs text-white font-semibold">
            Share your approximate region?
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Optional: helps Loopra improve regional music discovery. You can skip anytime without affecting playback.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                locationAnalyticsService.setConsentStatus('dismissed');
                setShowLocationConsentBanner(false);
              }}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-neutral-400 hover:text-white cursor-pointer"
            >
              Not Now
            </button>
            <button
              type="button"
              onClick={async () => {
                setShowLocationConsentBanner(false);
                await handleDetectLocation();
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-[11px] font-bold cursor-pointer"
            >
              Use My Location
            </button>
          </div>
        </div>
      )}

      {isRegionalLocationEnabled && showLocationDeniedModal && (
        <div className="fixed inset-0 z-[2147483645] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Regional Music & Location</h3>
              <button
                type="button"
                onClick={() => setShowLocationDeniedModal(false)}
                className="text-xs text-neutral-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Location permission is currently blocked. To re-enable it, click the <strong>Tune / Lock icon</strong> in your browser address bar → <strong>Site settings</strong> → <strong>Reset permissions</strong> (or allow Location), then tap <strong>Detect Location</strong>.
            </p>
            <div className="space-y-2">
              <p className="text-[11px] font-mono uppercase text-neutral-400">Or select your region manually ({selectedRegion}):</p>
              <div className="flex flex-wrap gap-1.5">
                {LOOPRA_REGIONS.map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => {
                      setSelectedRegion(region);
                      locationAnalyticsService.setSavedRegion(region);
                      setShowLocationDeniedModal(false);
                      showToast(`Regional Music set to ${region}`, 'success');
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition cursor-pointer ${
                      selectedRegion === region
                        ? 'bg-amber-500 text-neutral-950 border-amber-400'
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowLocationDeniedModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-neutral-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLocationDeniedModal(false);
                  handleDetectLocation();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold cursor-pointer"
              >
                Detect Location
              </button>
            </div>
          </div>
        </div>
      )}

      <SimilarSongsModal
        isOpen={Boolean(similarSongsTrack)}
        onClose={() => setSimilarSongsTrack(null)}
        track={similarSongsTrack}
        onPlaySong={playSong}
        onAddToQueue={addToQueue}
        showToast={showToast}
      />

      {isBottomPlayerVisible && (
        <footer 
          role="region"
          aria-label="Audio player mini bar"
          onClick={() => handleOpenExpandedPlayer('player')}
          className={`fixed md:relative z-40 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] select-none cursor-pointer ${showQueuePanel ? 'hidden' : 'block'}
            bottom-[calc(3.75rem+max(0.5rem,var(--safe-area-bottom,0px),env(safe-area-inset-bottom,0px)))] left-1/2 -translate-x-1/2
            rounded-2xl border border-amber-500/30 hover:border-amber-500/50 bg-neutral-950/95 backdrop-blur-2xl
            shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(var(--accent-rgb,245,158,11),0.06)]
            py-2 px-3
            ${isMiniPlayerExpanded ? 'w-[calc(100%-1rem)] max-w-xl' : 'w-[calc(100%-1.75rem)] max-w-sm sm:max-w-md'}
            md:bottom-0 md:inset-x-0 md:translate-x-0 md:shrink-0
            md:w-full md:max-w-none md:rounded-none md:border-t md:border-x-0 md:border-b-0 md:border-amber-500/20 md:bg-neutral-950/95 md:py-3 md:pl-6 md:pr-28 md:shadow-[0_-10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(var(--accent-rgb,245,158,11),0.06)]`}
        >
          {/* Quick Horizontal Expand/Collapse Pill for Mobile */}
          <div className="md:hidden absolute -top-3.5 right-3 z-50 shrink-0 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMiniPlayerExpanded(prev => !prev);
              }}
              className="px-2.5 py-0.5 rounded-full bg-neutral-900/95 hover:bg-neutral-800 border border-amber-500/40 text-amber-400 text-[10px] font-bold shadow-lg flex items-center gap-1 transition shrink-0 cursor-pointer select-none active:scale-95"
              title={isMiniPlayerExpanded ? "Collapse mini-player width" : "Expand mini-player horizontally"}
              aria-label={isMiniPlayerExpanded ? "Collapse mini-player width" : "Expand mini-player horizontally"}
            >
              <Icon name={isMiniPlayerExpanded ? "collapse" : "expand"} className="w-3.5 h-3.5 shrink-0" />
              <span>{isMiniPlayerExpanded ? "Compact" : "Expand Player"}</span>
            </button>
          </div>

          {/* Desktop Full 3-Section Footer (>= md) */}
          <div className="hidden md:flex w-full items-center justify-between gap-6 px-4 md:px-8">
            {/* Zone 1 (Left): Artwork, Track Info with overflow marquee, and Like Button */}
            <div 
              className="flex items-center gap-3 w-1/4 min-w-0 select-none cursor-pointer"
              onClick={() => handleOpenExpandedPlayer('player')}
              title="Expand Now Playing"
            >
              <div className="relative group shrink-0">
                <img 
                  src={getCleanThumbnail(currentSong)} 
                  alt={currentSong.title || ""} 
                  className="rounded-xl object-cover shrink-0 shadow-md transition-all duration-300 w-12 h-12 border border-amber-500/30 group-hover:border-amber-400" 
                  onError={(e) => handleImageError(e, currentSong.title, currentSong.id)} 
                />
                {isPlaying && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-neutral-950 flex items-center justify-center text-[9px] font-bold animate-spin-slow shadow-md border border-neutral-950">
                    💿
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <h4 className="font-bold text-xs text-white truncate group-hover:text-amber-300 transition-colors whitespace-nowrap">{currentSong.title}</h4>
                <p className="text-[10px] text-amber-400/90 truncate select-none mt-0.5">{currentSong.channel || currentSong.artist}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }} 
                  className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-pink-500 transition cursor-pointer shrink-0" 
                  title={isSongLiked(currentSong) ? "Unlike" : "Like"}
                  aria-label="Toggle Like"
                >
                  <Icon name={isSongLiked(currentSong) ? "heart" : "heartOutline"} className={`w-4 h-4 ${isSongLiked(currentSong) ? 'text-pink-500 fill-pink-500' : 'text-neutral-400'}`} />
                </button>
                <button onClick={(e) => handleAddToPlaylistClick(currentSong, e)} className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-amber-400 transition cursor-pointer shrink-0" title="Add to Playlist">
                  <Icon name="plus" className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Zone 2 (Center): Playback Controls & Scrubber */}
            <div className="flex flex-col items-center w-2/4 gap-1.5 animate-fadeIn min-w-0" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-5 shrink-0">
                <button onClick={toggleShuffle} className={`transition cursor-pointer p-1 rounded-full hover:bg-white/5 ${isShuffle ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} title={isShuffle ? "Shuffle On" : "Shuffle Off"}>
                  <Icon name="shuffle" className="w-4 h-4 shrink-0" />
                </button>
                <button onClick={handlePrevSong} className="text-neutral-300 hover:text-white transition cursor-pointer p-1 rounded-full hover:bg-white/5" title="Previous Track">
                  <Icon name="skipPrev" className="w-5 h-5 shrink-0" />
                </button>
                <button onClick={togglePlayPause} className="w-11 h-11 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 flex items-center justify-center font-bold shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:shadow-[0_0_28px_rgba(245,158,11,0.7)] transition-all shrink-0 cursor-pointer border border-amber-300/40" title={isPlaying ? "Pause" : "Play"}>
                  <Icon name={isPlaying ? "pause" : "play"} className="w-5 h-5 fill-current" />
                </button>
                <button onClick={handleNextSong} className="text-neutral-300 hover:text-white transition cursor-pointer p-1 rounded-full hover:bg-white/5" title="Next Track">
                  <Icon name="skipNext" className="w-5 h-5 shrink-0" />
                </button>
                <button 
                  onClick={toggleRepeatMode} 
                  className={`relative transition cursor-pointer p-1 rounded-full hover:bg-white/5 ${isRepeat ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} 
                  title={isRepeat === 'one' ? 'Repeat One' : isRepeat === 'all' ? 'Repeat All' : 'Repeat Off'}
                >
                  <Icon name="repeat" className="w-4 h-4 shrink-0" />
                  {isRepeat === 'one' && (
                    <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-amber-500 text-white rounded-full w-3 h-3 flex items-center justify-center">1</span>
                  )}
                </button>
              </div>

              {/* Dedicated Scrubber & Time Display Row */}
              <div className="w-full flex items-center gap-3">
                <PlayerProgress 
                  playerRef={playerRef} 
                  isPlaying={isPlaying} 
                  onSeek={handleSeek} 
                  currentSongId={currentSong?.id} 
                  isRadio={Boolean(currentSong?.isRadio)} 
                  currentTimeRef={currentTimeRef} 
                  durationRef={durationRef} 
                />
              </div>
            </div>

            {/* Zone 3 (Right): Volume Slider with Mute Toggle, Queue Toggle, and Avatar Roam Status */}
            <div className="flex items-center justify-end w-1/4 gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* Avatar Free Roam Quick Status Pill (Strictly Admin Only and when Voice/Avatar is active) */}
              {isAdmin && isVoiceActive && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const cur = (localStorage.getItem('loopra_avatar_roaming') ?? localStorage.getItem('loopra_avatar_roam')) === 'true';
                      const next = !cur;
                      localStorage.setItem('loopra_avatar_roaming', String(next));
                      localStorage.setItem('loopra_avatar_roam', String(next));
                      window.dispatchEvent(new Event('storage'));
                      showToast?.(`Avatar Roam ${next ? 'Active' : 'Parked'}`);
                    } catch (_) {}
                  }}
                  className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-mono text-neutral-400 hover:text-amber-300 transition cursor-pointer shadow-sm shrink-0"
                  title="Toggle Avatar Roam Status (Admin Only)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>ROAM</span>
                </button>
              )}

              {/* Volume Slider & Click-to-Mute Toggle Icon */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="p-1 text-neutral-400 hover:text-white transition cursor-pointer shrink-0"
                  title={isMuted ? "Unmute" : "Mute Audio"}
                  aria-label={isMuted ? "Unmute" : "Mute Audio"}
                >
                  <Icon name={isMuted ? "volumeMute" : volume === 0 ? "volumeMute" : "volume"} className="w-4 h-4 shrink-0" />
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-18 lg:w-22 h-1 bg-neutral-800 rounded-xl appearance-none cursor-pointer accent-amber-500 shrink-0"
                />
              </div>

              {/* Queue Panel Toggle Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQueuePanel(prev => !prev);
                }}
                className={`p-1.5 rounded-xl border transition shrink-0 cursor-pointer flex items-center gap-1 text-xs active:scale-95 ${
                  showQueuePanel
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-amber-400 border-neutral-700/60'
                }`}
                title={showQueuePanel ? "Close Queue" : "Open Queue"}
                aria-label="Queue list toggle"
              >
                <Icon name="list" className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline text-[11px] font-medium">Queue</span>
              </button>
            </div>
          </div>

          {/* Mobile Sleek Single-Row Mini-Player (< md) */}
          <div 
            className="md:hidden flex items-center justify-between gap-2 w-full min-w-0 cursor-pointer"
            onClick={() => handleOpenExpandedPlayer('player')}
          >
            {/* Left: Thumbnail & Song Info */}
            <div 
              className="flex items-center gap-2.5 min-w-0 flex-1 select-none"
              title="Expand Now Playing"
            >
              <div className="relative shrink-0">
                <img 
                  src={getCleanThumbnail(currentSong)} 
                  alt={currentSong.title || ""} 
                  className="rounded-xl object-cover shrink-0 shadow-md w-12 h-12 border border-amber-500/30" 
                  onError={(e) => handleImageError(e, currentSong.title, currentSong.id)} 
                />
                {isPlaying && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-neutral-950 flex items-center justify-center text-[8px] font-bold animate-spin-slow shadow-md border border-neutral-950">
                    💿
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-xs text-white truncate leading-tight">{currentSong.title}</h4>
                <p className="text-[10px] text-amber-400 truncate mt-0.5 select-none">{currentSong.channel || currentSong.artist}</p>
              </div>
            </div>

            {/* Right: Touch Playback Controls */}
            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* Extra controls revealed horizontally when isMiniPlayerExpanded is true */}
              {isMiniPlayerExpanded && (
                <>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenExpandedPlayer('queue');
                    }} 
                    className="text-neutral-400 hover:text-amber-400 transition p-2 shrink-0 cursor-pointer active:scale-90 min-w-[48px] min-h-[48px] flex items-center justify-center touch-manipulation" 
                    title="View Queue"
                    aria-label="View Queue"
                  >
                    <Icon name="list" className="w-5 h-5 shrink-0" />
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevSong();
                    }} 
                    className="text-neutral-300 hover:text-white transition p-2 shrink-0 cursor-pointer active:scale-90 min-w-[48px] min-h-[48px] flex items-center justify-center touch-manipulation" 
                    title="Previous Track"
                    aria-label="Previous Track"
                  >
                    <Icon name="skipPrev" className="w-5 h-5 shrink-0" />
                  </button>
                </>
              )}

              {/* Play / Pause is always accessible */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }} 
                className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full amber-glow-btn text-neutral-950 flex items-center justify-center shadow-md active:scale-95 transition shrink-0 cursor-pointer border border-amber-300/40 touch-manipulation" 
                title={isPlaying ? "Pause" : "Play"}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                <Icon name={isPlaying ? "pause" : "play"} className="w-5 h-5 fill-current translate-x-0.5" />
              </button>

              {/* Next button revealed horizontally when isMiniPlayerExpanded is true */}
              {isMiniPlayerExpanded && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextSong();
                  }} 
                  className="text-neutral-300 hover:text-white transition p-2 shrink-0 cursor-pointer active:scale-90 min-w-[48px] min-h-[48px] flex items-center justify-center touch-manipulation" 
                  title="Next Track"
                  aria-label="Next Track"
                >
                  <Icon name="skipNext" className="w-5 h-5 shrink-0" />
                </button>
              )}

              {/* Designated Fullscreen Player Open Button */}
              {isUiVisible('btn.expandPlayer') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenExpandedPlayer('player');
                  }}
                  className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-amber-400 border border-neutral-700/60 transition shrink-0 cursor-pointer flex items-center justify-center active:scale-90 min-w-[48px] min-h-[48px] touch-manipulation"
                  title="Open Fullscreen Player"
                  aria-label="Open Fullscreen Player"
                >
                  <Icon name="expand" className="w-4 h-4 shrink-0 text-amber-400" />
                </button>
              )}
            </div>
          </div>
        </footer>
      )}

      </div>
      </div>

      {/* Mobile Persistent Bottom Navigation Bar (< md) */}
      <MobileBottomNav 
        activeTab={activeTab}
        isProfileOpen={isProfileOpen}
        onToggleAi={() => setActiveAssistantPanel(prev => prev === 'ai' ? null : 'ai')}
        onNavigate={(tab) => {
          setIsProfileOpen(false);
          handleStationSelect(tab);
        }}
        onOpenPlaylists={() => {
          setIsProfileOpen(false);
          handleStationSelect('playlists');
          setSelectedPlaylistForView(null);
        }}
        onOpenProfile={() => {
          if (user) {
            setIsProfileOpen(true);
          } else {
            if (isPlaying) {
              togglePlayPause();
            }
            openAuthModal();
          }
          setIsSidebarOpen(false);
        }}
        user={user}
        isVisible={!showQueuePanel && activeTab !== 'dj-club' && activeTab !== 'relax'}
      />


      {showQueuePanel && !isPipActive && (
        <div 
          style={{
            paddingTop: isStandaloneApp
              ? 'max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px), 24px)'
              : 'max(var(--safe-area-top, 0px), env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(var(--safe-area-bottom, 0px), env(safe-area-inset-bottom, 0px))'
          }}
          className="fixed inset-0 z-[120] bg-neutral-950 flex flex-col md:flex-row overflow-hidden drawer-enter"
        >
          {/* Mobile Tab Header with Segmented Switcher & Close Button */}
          <div className="md:hidden flex items-center justify-between px-3 py-1.5 border-b border-neutral-800/80 bg-neutral-900/95 backdrop-blur-xl shrink-0 z-50">
            <div className="flex bg-neutral-800/90 p-0.5 rounded-xl gap-1 border border-neutral-700/60 shadow-inner">
              <button 
                onClick={() => setMobileQueueTab('player')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${mobileQueueTab === 'player' ? 'bg-amber-500 text-neutral-950 font-bold shadow' : 'text-neutral-400 hover:text-white'}`}
              >
                Now Playing
              </button>
              <button 
                onClick={() => setMobileQueueTab('queue')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${mobileQueueTab === 'queue' ? 'bg-amber-500 text-neutral-950 font-bold shadow' : 'text-neutral-400 hover:text-white'}`}
              >
                Up Next ({queue.length})
              </button>
            </div>

            <button 
              onClick={() => setShowQueuePanel(false)} 
              className="text-neutral-400 hover:text-white bg-neutral-800/90 hover:bg-neutral-700 p-1.5 rounded-full border border-neutral-700/60 shadow-md cursor-pointer transition shrink-0 flex items-center justify-center"
              title="Collapse Player"
              aria-label="Collapse Player"
            >
              <Icon name="chevronDown" className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop Collapse Button */}
          <button 
            onClick={() => setShowQueuePanel(false)} 
            className="hidden md:flex items-center gap-1.5 absolute top-4 right-4 text-neutral-400 hover:text-white z-50 bg-neutral-900/80 hover:bg-neutral-800 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-neutral-700/60 shadow-lg cursor-pointer transition text-xs font-semibold"
            title="Collapse Player"
            aria-label="Collapse Player"
          >
            <Icon name="chevronDown" className="w-4 h-4" />
            <span>Collapse</span>
          </button>

          {/* Player Column (Full on Mobile when 'player' tab is active; 50% on Desktop) */}
          <div className={`${mobileQueueTab === 'player' ? 'flex' : 'hidden'} md:flex w-full md:w-1/2 p-2 sm:p-4 md:p-6 flex-col items-center bg-gradient-to-br from-neutral-900 to-neutral-950 border-r border-neutral-800/50 overflow-y-auto overflow-x-hidden flex-1 md:flex-initial h-full max-h-full`}>
            {currentSong ? (
              <div className="w-full max-w-sm flex flex-col items-center">
                {/* Initial Viewport: Main music player controls */}
                <div className="w-full flex flex-col items-center justify-between py-1 sm:py-2 min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-2rem)] shrink-0">
                {/* 1. 3D Illuminated Virtual Turntable Section */}
                {isUiVisible('btn.turntable3D') && (
                  <div className="w-full flex items-center justify-center shrink min-h-0 pt-1 pb-1">
                    <Turntable3D 
                      currentSong={currentSong} 
                      isPlaying={isPlaying} 
                      onTogglePlay={togglePlayPause} 
                      size="responsive"
                    />
                  </div>
                )}

                {/* 2. Animated Audio Spectrum Visualizer Section (Directly below vinyl, separated layout) */}
                {isUiVisible('btn.spectrumVisualizer') && (
                  <div className="w-full flex items-center justify-center shrink-0 mb-4 sm:mb-5">
                    <AudioSpectrumVisualizer 
                      isPlaying={isPlaying} 
                      barCount={28}
                      height={24}
                      className="w-full max-w-[200px] sm:max-w-xs" 
                    />
                  </div>
                )}

                {/* 3. Song Information Section (Title & Artist with guaranteed 16-24px vertical spacing) */}
                <div className="w-full text-center space-y-1 shrink-0 px-2 mb-2">
                  <h2 className="text-base sm:text-lg md:text-xl font-display font-bold text-white line-clamp-2 leading-snug">
                    {currentSong.title}
                  </h2>
                  <p
                    className="text-xs sm:text-sm text-amber-500 font-medium truncate max-w-full select-none"
                  >
                    {currentSong.channel || currentSong.artist}
                  </p>
                </div>

                {/* 4. Expanded Player Action Bar: Add to Favorites, Add to Playlist, Video */}
                {(() => {
                  const isFav = isSongLiked(currentSong);
                  const hasVid = Boolean(currentSong && (currentSong.id || currentSong.videoId));
                  return (
                    <div className="flex items-center justify-center gap-2 sm:gap-2.5 shrink-0 mb-3 w-full max-w-sm px-1">
                      {/* 1. Add to Favorites */}
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          toggleLike(currentSong); 
                        }} 
                        className={`flex-1 min-h-[40px] sm:min-h-[44px] px-2.5 sm:px-3 py-2 rounded-2xl border transition-all duration-200 flex items-center justify-center gap-1.5 text-xs font-semibold shadow-md active:scale-95 cursor-pointer select-none ${
                          isFav 
                            ? 'bg-pink-500/15 border-pink-500/50 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.2)] hover:bg-pink-500/25' 
                            : 'bg-neutral-800/80 hover:bg-neutral-700/80 border-neutral-700/70 text-neutral-300 hover:text-white'
                        }`}
                        title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                        aria-label={isFav ? "Remove from Favorites" : "Add to Favorites"}
                        aria-pressed={isFav}
                      >
                        <Icon 
                          name={isFav ? "heart" : "heartOutline"} 
                          className={`w-4 h-4 shrink-0 transition-transform ${isFav ? 'text-pink-500 fill-current scale-110' : 'text-neutral-400'}`} 
                        />
                        <span className="truncate">{isFav ? 'Favorited' : 'Favorite'}</span>
                      </button>

                      {/* 2. Add to Playlist */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToPlaylistClick(currentSong, e);
                        }} 
                        className="flex-1 min-h-[40px] sm:min-h-[44px] px-2.5 sm:px-3 py-2 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/70 text-neutral-300 hover:text-amber-400 hover:border-amber-500/40 transition-all duration-200 flex items-center justify-center gap-1.5 text-xs font-semibold shadow-md active:scale-95 cursor-pointer select-none"
                        title="Add to Playlist"
                        aria-label="Add to Playlist"
                      >
                        <Icon name="plus" className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="truncate">Playlist</span>
                      </button>

                      {/* 3. Video / Music Mode Toggle */}
                      {isUiVisible('btn.cinematicVideo') && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (videoModalSong) {
                              handleCloseVideo();
                            } else {
                              handleOpenVideo(currentSong, e);
                            }
                          }} 
                          className={`flex-1 min-h-[40px] sm:min-h-[44px] px-2.5 sm:px-3 py-2 rounded-2xl border transition-all duration-200 flex items-center justify-center gap-1.5 text-xs font-semibold shadow-md active:scale-95 cursor-pointer select-none ${
                            hasVid
                              ? videoModalSong
                                ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-[0_0_20px_rgba(var(--accent-rgb,245,158,11),0.4)]'
                                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300 hover:text-amber-200 shadow-[0_0_15px_rgba(var(--accent-rgb,245,158,11),0.15)]'
                              : 'bg-neutral-800/40 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
                          }`}
                          title={hasVid ? (videoModalSong ? "Switch to Music Mode" : "Watch Video") : "Video Unavailable"}
                          aria-label={hasVid ? (videoModalSong ? "Switch to Music Mode" : "Watch Video") : "Video Unavailable"}
                        >
                          <Icon name={videoModalSong ? "music" : "video"} className={`w-4 h-4 shrink-0 ${hasVid ? (videoModalSong ? 'text-neutral-950' : 'text-amber-400') : 'text-neutral-500'}`} />
                          <span className="truncate">{videoModalSong ? "Music Mode" : "Video Mode"}</span>
                        </button>
                      )}

                      {/* Offline Download button */}
                      <DownloadTrackButton track={currentSong} variant="icon" showToast={showToast} />
                    </div>
                  );
                })()}

                {/* Secondary Action Row: Canvas, EQ, Lyrics, Sleep Timer, Speed, Mute, Share */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 mb-2 w-full max-w-sm px-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsCanvasOpen(true); }}
                    className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-300 transition flex items-center gap-1 text-xs font-semibold shadow-sm active:scale-95 cursor-pointer"
                    title="Loopra Canvas Visualizer"
                    aria-label="Loopra Canvas Visualizer"
                  >
                    <Icon name="sparkles" className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Canvas</span>
                  </button>

                  {isUiVisible('btn.lyrics') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsLyricsOpen(true); }}
                      className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/70 text-neutral-300 hover:text-amber-400 transition flex items-center gap-1 text-xs font-semibold shadow-sm active:scale-95 cursor-pointer"
                      title="Synchronized Lyrics"
                      aria-label="Synchronized Lyrics"
                    >
                      <Icon name="mic" className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Lyrics</span>
                    </button>
                  )}

                  {isUiVisible('btn.sleepTimer') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsSleepTimerOpen(true); }}
                      className={`relative p-2 sm:px-2.5 sm:py-1.5 rounded-xl border transition flex items-center gap-1 text-xs font-semibold shadow-sm active:scale-95 cursor-pointer ${
                        sleepTimerRemaining ? 'bg-amber-500/20 border-amber-500/60 text-amber-300' : 'bg-neutral-800/80 hover:bg-neutral-700/80 border-neutral-700/70 text-neutral-300 hover:text-amber-400'
                      }`}
                      title={sleepTimerRemaining ? `Timer active: ${Math.ceil(sleepTimerRemaining / 60)}m left` : "Set Sleep Timer"}
                      aria-label="Set Sleep Timer"
                    >
                      <Icon name="timer" className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">
                        {sleepTimerRemaining ? `${Math.ceil(sleepTimerRemaining / 60)}m` : 'Timer'}
                      </span>
                      {sleepTimerRemaining && (
                        <span className="sm:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); handleCyclePlaybackSpeed(); }}
                    className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/70 text-neutral-300 hover:text-amber-400 transition flex items-center gap-1 text-xs font-mono font-semibold shadow-sm active:scale-95 cursor-pointer"
                    title={`Playback speed: ${playbackSpeed}x. Click to change.`}
                    aria-label="Playback speed"
                  >
                    <span>{playbackSpeed}x</span>
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleMute(); }}
                    className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border transition flex items-center gap-1 text-xs font-semibold shadow-sm active:scale-95 cursor-pointer ${
                      isMuted ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-neutral-800/80 hover:bg-neutral-700/80 border-neutral-700/70 text-neutral-300 hover:text-amber-400'
                    }`}
                    title={isMuted ? "Unmute" : "Mute"}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    <Icon name={isMuted ? "volumeMute" : "volume"} className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleShareTrack(currentSong); }}
                    className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/70 text-neutral-300 hover:text-amber-400 transition flex items-center gap-1 text-xs font-semibold shadow-sm active:scale-95 cursor-pointer"
                    title="Share Track"
                    aria-label="Share Track"
                  >
                    <Icon name="share" className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>


                {/* Progress Bar */}
                <div className="w-full px-2 shrink-0 my-1">
                  <PlayerProgress 
                    playerRef={playerRef} 
                    isPlaying={isPlaying} 
                    onSeek={handleSeek} 
                    currentSongId={currentSong?.id} 
                    isRadio={Boolean(currentSong?.isRadio)} 
                    currentTimeRef={currentTimeRef} 
                    durationRef={durationRef} 
                  />
                </div>

                {/* Main Playback Controls with Tactile 3D Buttons */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 w-full shrink-0 my-1">
                  <button 
                    onClick={toggleShuffle} 
                    className={`p-1.5 transition ${isShuffle ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} 
                    title={isShuffle ? "Shuffle On" : "Shuffle Off"}
                  >
                    <Icon name="shuffle" className="w-4 h-4" />
                  </button>
                  
                  <button 
                    onClick={handlePrevSong} 
                    className="p-2 sm:p-3 rounded-full bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/60 text-neutral-200 hover:text-white hover:scale-110 active:scale-95 transition-all shadow-md" 
                    title="Previous Track"
                  >
                    <Icon name="skipPrev" className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  
                  <button 
                    onClick={togglePlayPause} 
                    className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full amber-glow-btn text-neutral-950 flex items-center justify-center font-bold shadow-[0_0_25px_rgba(var(--accent-rgb,245,158,11),0.5)] hover:shadow-[0_0_35px_rgba(var(--accent-rgb,245,158,11),0.7)] hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-300/40"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    <Icon name={isPlaying ? "pause" : "play"} className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
                  </button>
                  
                  <button 
                    onClick={handleNextSong} 
                    className="p-2 sm:p-3 rounded-full bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/60 text-neutral-200 hover:text-white hover:scale-110 active:scale-95 transition-all shadow-md" 
                    title="Next Track"
                  >
                    <Icon name="skipNext" className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  
                  <button 
                    onClick={toggleRepeatMode} 
                    className={`relative p-1.5 transition ${isRepeat ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} 
                    title={isRepeat === 'one' ? 'Repeat One' : isRepeat === 'all' ? 'Repeat All' : 'Repeat Off'}
                  >
                    <Icon name="repeat" className="w-4 h-4" />
                    {isRepeat === 'one' && (
                      <span className="absolute top-0.5 right-0.5 text-[8px] font-bold bg-amber-500 text-white rounded-full w-3 h-3 flex items-center justify-center">1</span>
                    )}
                  </button>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-2.5 w-full max-w-[240px] justify-center px-3 py-1 rounded-xl bg-neutral-900/60 border border-neutral-800/60 shrink-0 my-0.5">
                  <Icon name="volume" className="w-3 h-3 text-neutral-400 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="flex-1 h-1 bg-neutral-800 rounded-xl appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-[9px] font-mono text-neutral-400 w-6 text-right">{volume}%</span>
                </div>

                </div>

                {/* Suggested for You Section: Positioned below main player in normal vertical flow (accessible on scroll) */}
                <SuggestedForYouSection
                  currentSong={currentSong}
                  onPlaySong={playSong}
                  onAddToQueue={addToQueue}
                  queue={queue}
                  onSuggestionsLoaded={(items) => {
                    currentSuggestionsRef.current = items;
                  }}
                />
              </div>
            ) : (
              <div className="text-neutral-500 text-lg flex flex-col items-center gap-3 py-16">
                <Icon name="music" className="w-12 h-12 text-neutral-700" />
                <span>No song playing</span>
              </div>
            )}
          </div>


          {/* Up Next Column (Full on Mobile when 'queue' tab is active; 50% on Desktop) */}
          <div className={`${mobileQueueTab === 'queue' ? 'flex' : 'hidden'} md:flex w-full md:w-1/2 flex-col bg-neutral-900/30 backdrop-blur-3xl overflow-y-auto hide-scrollbar pb-32 flex-1 md:flex-initial`}>
            <div className="p-4 sm:p-6 md:p-12 mt-2 md:mt-0">
              <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 mb-4 sm:mb-6">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <button
                    onClick={() => setMobileQueueTab('player')}
                    className="md:hidden p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700/60 shrink-0"
                    title="Back to Now Playing"
                  >
                    ←
                  </button>
                  <h3 className="text-lg sm:text-2xl font-display font-bold text-white flex items-center gap-2 sm:gap-2.5 truncate">
                    <Icon name="list" className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 shrink-0" />
                    <span>Up Next</span>
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-end">
                  <span className="text-[11px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 sm:px-2.5 py-1 rounded-full hidden sm:inline-flex items-center gap-1.5 font-medium whitespace-nowrap">
                    <Icon name="grip" className="w-3.5 h-3.5" />
                    <span>Tap & hold to slide</span>
                  </span>
                  <span className="text-[11px] sm:text-xs font-medium bg-neutral-800 text-neutral-400 px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap">
                    {queue.length} <span className="hidden xs:inline">tracks</span><span className="xs:hidden">songs</span>
                  </span>
                  {queue.length > 0 && (
                    <button
                      onClick={handleSaveQueueAsPlaylist}
                      className="text-[11px] sm:text-xs text-amber-300 hover:text-amber-200 px-2.5 sm:px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition cursor-pointer flex items-center gap-1 font-medium whitespace-nowrap active:scale-95"
                      title="Save Queue as Playlist"
                      aria-label="Save Queue as Playlist"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Save Playlist</span>
                      <span className="sm:hidden">Save</span>
                    </button>
                  )}
                  {queue.length > 0 && (
                    <button
                      onClick={() => {
                        if (window.confirm("Clear all tracks from your playback queue?")) {
                          setQueue([]);
                          showToast("Playback queue cleared");
                        }
                      }}
                      className="text-[11px] sm:text-xs text-neutral-400 hover:text-red-400 px-2 sm:px-2.5 py-1 rounded-full bg-neutral-800/90 hover:bg-neutral-800 border border-neutral-700/60 transition cursor-pointer whitespace-nowrap active:scale-95"
                      title="Clear Queue"
                      aria-label="Clear Queue"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Now Playing Mini Header in Up Next */}
              {currentSong && (
                <div className="mb-6 p-3 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={getCleanThumbnail(currentSong)}
                      alt={currentSong.title}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md border border-amber-500/30"
                      onError={(e) => handleImageError(e, currentSong.title, currentSong.id)}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Now Playing</span>
                        {isPlaying && (
                          <div className="flex items-end gap-0.5 h-2.5">
                            <span className="w-0.5 h-2.5 bg-amber-400 rounded-full animate-pulse" />
                            <span className="w-0.5 h-1.5 bg-amber-400 rounded-full animate-[pulse_0.7s_infinite_0.2s]" />
                            <span className="w-0.5 h-3 bg-amber-400 rounded-full animate-[pulse_0.5s_infinite_0.4s]" />
                          </div>
                        )}
                      </div>
                      <h4 className="font-semibold text-sm text-white truncate">{currentSong.title}</h4>
                      <p className="text-xs text-neutral-400 truncate">{currentSong.artist || currentSong.channel}</p>
                    </div>
                  </div>
                  <button
                    onClick={togglePlayPause}
                    className="p-2.5 rounded-full bg-amber-500 text-neutral-950 font-bold hover:scale-105 active:scale-95 transition cursor-pointer shadow-md shadow-amber-500/20 shrink-0"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    <Icon name={isPlaying ? "pause" : "play"} className="w-4 h-4 fill-current" />
                  </button>
                </div>
              )}

              {queue.length > 0 && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">Next In Queue</span>
                  <p className="text-[11px] text-neutral-500 hidden sm:flex items-center gap-1.5">
                    <span>Reorderable</span>
                  </p>
                </div>
              )}

              {queue.length > 0 && (
                <p className="text-[11px] text-neutral-500 mb-3 flex items-center gap-1.5 sm:hidden">
                  <Icon name="grip" className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                  <span>Tap & hold or slide grip to rearrange queue</span>
                </p>
              )}
              
              <Reorder.Group axis="y" values={queue} onReorder={setQueue} layoutScroll className="space-y-2.5">
                {queue.map((track, idx) => {
                  const isCurrent = currentSong?.id === track.id;
                  return (
                    <QueueItem
                      key={track.id}
                      track={track}
                      isCurrent={isCurrent}
                      isPlaying={isPlaying}
                      onPlay={playSong}
                      onRemove={removeFromQueue}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < queue.length - 1}
                      onMoveUp={() => {
                        if (idx <= 0) return;
                        setQueue(prev => {
                          const copy = [...prev];
                          const item = copy.splice(idx, 1)[0];
                          copy.splice(idx - 1, 0, item);
                          return copy;
                        });
                      }}
                      onMoveDown={() => {
                        if (idx >= queue.length - 1) return;
                        setQueue(prev => {
                          const copy = [...prev];
                          const item = copy.splice(idx, 1)[0];
                          copy.splice(idx + 1, 0, item);
                          return copy;
                        });
                      }}
                    />
                  );
                })}

                {queue.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-neutral-800 rounded-2xl">
                    <p className="text-neutral-400 text-xs font-medium">No manually queued songs</p>
                    <p className="text-neutral-500 text-[11px] mt-0.5">Use "Add to Queue" or "Play Next" on any song</p>
                  </div>
                )}
              </Reorder.Group>

              {/* Autoplay & Smart Recommendations Section (Continuous Listening) */}
              {isUiVisible('btn.smartQueue') && (
                <div className="mt-8 pt-6 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        Smart Queue & Autoplay
                      </h4>
                      <p className="text-[11px] text-neutral-400">Up next based on current listening vibe</p>
                    </div>
                    <button
                      onClick={toggleContinuousListening}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                        isContinuousListening
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                      }`}
                      title="Toggle Continuous Autoplay"
                    >
                      <span>{isContinuousListening ? 'Autoplay ON' : 'Autoplay OFF'}</span>
                    </button>
                  </div>

                  {isContinuousListening ? (
                    smartQueue.length > 0 ? (
                      <div className="space-y-2">
                        {smartQueue.slice(0, 10).map((track, idx) => (
                          <div
                            key={track.id || track.videoId || idx}
                            onClick={() => playSong(track)}
                            className="group flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-neutral-900/40 hover:bg-neutral-800/60 border border-neutral-800/60 hover:border-amber-500/30 transition cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-sm">
                                <img
                                  src={getCleanThumbnail(track)}
                                  alt={track.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => handleImageError(e, track.title, track.id)}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                  <Icon name="play" className="w-4 h-4 text-amber-400" />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h5 className="font-medium text-xs text-white group-hover:text-amber-300 transition truncate">
                                    {track.title}
                                  </h5>
                                  {track._recommendationType === 'discover' && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0 font-medium">Discover</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-neutral-400 truncate">{track.artist || track.channel}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => playNext(track, e)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition"
                                title="Play Next"
                              >
                                <Icon name="skipNext" className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => addToQueue(track, e)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition"
                                title="Add to Queue"
                              >
                                <Icon name="plus" className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs text-neutral-500">
                        Generating tailored smart recommendations...
                      </div>
                    )
                  ) : (
                    <div className="py-4 text-center text-xs text-neutral-500 bg-neutral-900/30 rounded-xl border border-neutral-800/50">
                      Continuous listening is disabled. Enable Autoplay above to keep the music flowing.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div 
          className="fixed inset-0 z-[130] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeAuthModal(false); }}
        >
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 w-full max-w-sm relative shadow-2xl">
            <button onClick={() => closeAuthModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white transition">
              <Icon name="close" className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-display font-extrabold tracking-tight text-white mb-6 text-center">
              {isLoginMode ? "Welcome Back" : "Create Account"}
            </h2>
            
            {authError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-2xl text-center">
                {authError}
              </div>
            )}
            
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={authForm.username}
                  onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-900/50 backdrop-blur-lg border border-neutral-800 text-white text-sm focus:outline-none focus:border-amber-500 transition"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  autoComplete={isLoginMode ? "current-password" : "new-password"}
                  value={authForm.password}
                  onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-900/50 backdrop-blur-lg border border-neutral-800 text-white text-sm focus:outline-none focus:border-amber-500 transition"
                  placeholder="Enter password"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 mt-2 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 hover:shadow-amber-500/20 text-white font-medium tracking-wide text-sm transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Icon name="sparkles" className="w-5 h-5 animate-spin" />
                    <span>{isAuthSlow ? "Connecting to server..." : (isLoginMode ? "Logging in..." : "Signing up...")}</span>
                  </>
                ) : (isLoginMode ? "Log In" : "Sign Up")}
              </button>
            </form>
            
            <div className="mt-6 flex items-center justify-center gap-4">
               <div className="h-px bg-neutral-800 flex-1"></div>
               <span className="text-xs text-neutral-500 font-medium">OR</span>
               <div className="h-px bg-neutral-800 flex-1"></div>
            </div>
            <div className="mt-6 flex flex-col items-center justify-center gap-2 w-full">
              <button
                type="button"
                onClick={() => triggerGoogleLogin()}
                disabled={authLoading}
                className="w-full py-3 px-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-sm border border-neutral-700/80 shadow-md flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
              {authLoading && isAuthSlow && (
                <p className="text-[11px] text-amber-400/90 font-medium animate-pulse flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  Connecting to server...
                </p>
              )}
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-neutral-400">
                {isLoginMode ? "Don't have an account?" : "Already have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }}
                  className="text-amber-400 hover:text-amber-300 font-bold underline transition"
                >
                  {isLoginMode ? "Sign Up" : "Log In"}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {isPlaylistModalOpen && (
        <div className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md" onClick={() => { setIsPlaylistModalOpen(false); setSelectedSongForPlaylist(null); }}></div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm relative z-10 p-6 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Add to Playlist</h2>
              <button 
                onClick={() => { setIsPlaylistModalOpen(false); setSelectedSongForPlaylist(null); }}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
                title="Close"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>
            {selectedSongForPlaylist && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-neutral-800/50">
                <img src={getCleanThumbnail(selectedSongForPlaylist)} className="w-10 h-10 rounded object-cover" alt={selectedSongForPlaylist.title || ""} onError={(e) => handleImageError(e, selectedSongForPlaylist.title, selectedSongForPlaylist.id)} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{selectedSongForPlaylist.title}</p>
                  <p className="text-xs text-amber-500/80 truncate">{selectedSongForPlaylist.channel}</p>
                </div>
              </div>
            )}
            {selectedSongForPlaylist && (modalRooms.length > 0 || activeRoom) && (
              <div className="mb-4">
                <p className="text-xs font-bold text-amber-400/90 uppercase tracking-wider mb-2">Rooms</p>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {(modalRooms.length > 0 ? modalRooms : (activeRoom ? [activeRoom] : [])).map(rm => {
                    const rId = String(rm.roomId || rm.id);
                    const isActive = activeRoom && String(activeRoom.roomId || activeRoom.id) === rId;
                    const isChecked = selectedModalRoomIds.includes(rId);
                    return (
                      <label
                        key={rId}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-sm cursor-pointer transition ${
                          isChecked
                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedModalRoomIds(prev =>
                                prev.includes(rId) ? prev.filter(id => id !== rId) : [...prev, rId]
                              );
                            }}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
                          />
                          <span className="truncate font-medium">{rm.name || 'Listening Room'}</span>
                        </div>
                        {isActive && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 shrink-0">
                            Active
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mb-4">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Playlists</p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {playlists.length === 0 ? (
                  <p className="text-xs text-neutral-500 px-1 py-2">No playlists yet. Create one below.</p>
                ) : (
                  playlists.map(pl => {
                    const pId = String(pl.id);
                    const songId = selectedSongForPlaylist?.id || selectedSongForPlaylist?.videoId;
                    const hasSong = Boolean(selectedSongForPlaylist && pl.songs.some(s => (s.id || s.videoId) === songId));
                    const isChecked = selectedModalPlaylistIds.includes(pId);
                    return (
                      <label
                        key={pId}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-sm transition ${
                          hasSong
                            ? 'bg-neutral-950/60 border-neutral-800/60 text-neutral-500 cursor-not-allowed'
                            : isChecked
                              ? 'bg-amber-500/15 border-amber-500/50 text-white cursor-pointer'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-200 hover:border-neutral-700 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={hasSong}
                            onChange={() => {
                              if (hasSong) return;
                              setSelectedModalPlaylistIds(prev =>
                                prev.includes(pId) ? prev.filter(id => id !== pId) : [...prev, pId]
                              );
                            }}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                          />
                          <span className="truncate font-medium">{pl.name}</span>
                        </div>
                        <span className="text-xs text-neutral-500 shrink-0">
                          {hasSong ? 'Already added' : `${pl.songs.length} songs`}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleConfirmAddToSelectedTargets}
              disabled={isSavingPlaylistTargets || (selectedModalRoomIds.length + selectedModalPlaylistIds.length === 0)}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-white font-semibold text-sm rounded-2xl transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSavingPlaylistTargets
                ? 'Adding...'
                : `Add to Selected (${selectedModalRoomIds.length + selectedModalPlaylistIds.length})`}
            </button>
            <form onSubmit={handleCreatePlaylist} className="mt-4 pt-4 border-t border-neutral-800">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Create New Playlist</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Playlist Name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-2xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                />
                <button data-voice-confirm="true" type="submit" disabled={!newPlaylistName.trim()} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 hover:shadow-amber-500/20 text-white font-medium tracking-wide text-sm rounded-2xl transition disabled:opacity-50 disabled:cursor-not-allowed">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sleek Dark-Themed Create Playlist Modal */}
      {isCreatePlaylistModalOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md" onClick={() => { setIsCreatePlaylistModalOpen(false); setCreateModalPlaylistName(''); }}></div>
          <div className="bg-neutral-900 border border-amber-500/30 rounded-2xl w-full max-w-sm relative z-10 p-6 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Icon name="plus" className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-white">New Playlist</h2>
              </div>
              <button
                type="button"
                onClick={() => { setIsCreatePlaylistModalOpen(false); setCreateModalPlaylistName(''); }}
                className="p-1 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreatePlaylist}>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Playlist Name</label>
              <input
                type="text"
                autoFocus
                value={createModalPlaylistName}
                onChange={(e) => setCreateModalPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsCreatePlaylistModalOpen(false);
                    setCreateModalPlaylistName('');
                  }
                }}
                placeholder="Enter playlist name..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60 transition mb-5"
              />
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setIsCreatePlaylistModalOpen(false); setCreateModalPlaylistName(''); }}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!createModalPlaylistName.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sleek Dark-Themed Rename Playlist Modal */}
      {renameModalPlaylist && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md" onClick={() => { setRenameModalPlaylist(null); setRenameModalName(''); }}></div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm relative z-10 p-6 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Icon name="edit" className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-white">Rename Playlist</h2>
              </div>
              <button
                type="button"
                onClick={() => { setRenameModalPlaylist(null); setRenameModalName(''); }}
                className="p-1 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRenamePlaylist}>
              <label className="text-xs font-semibold text-neutral-400 block mb-2">Playlist Name</label>
              <input
                type="text"
                autoFocus
                value={renameModalName}
                onChange={(e) => setRenameModalName(e.target.value)}
                placeholder="Enter new name..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60 transition mb-5"
              />
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setRenameModalPlaylist(null); setRenameModalName(''); }}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameModalName.trim() || renameModalName.trim() === renameModalPlaylist.name}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-neutral-950 text-xs font-bold transition shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sleek Dark-Themed Delete Playlist Confirmation Modal */}
      {deleteModalPlaylist && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md" onClick={() => setDeleteModalPlaylist(null)}></div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm relative z-10 p-6 shadow-2xl animate-scaleIn">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center border border-red-500/30 shrink-0">
                <Icon name="trash" className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Delete Playlist?</h2>
                <p className="text-xs text-neutral-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80 my-4">
              Are you sure you want to permanently delete <span className="font-bold text-white">"{deleteModalPlaylist.name}"</span>?
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteModalPlaylist(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePlaylist}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-red-500/20"
              >
                Delete Playlist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgraded Feature Modals */}
      {isCanvasOpen && (
        <LoopraCanvas
          isOpen={isCanvasOpen}
          onClose={() => setIsCanvasOpen(false)}
          currentSong={currentSong}
          isPlaying={isPlaying}
          onTogglePlay={togglePlayPause}
          onNext={handleNextSong}
          onPrev={handlePrevSong}
          onNextTrack={handleNextSong}
          onPrevTrack={handlePrevSong}
          currentTime={currentTimeRef.current}
          duration={durationRef.current}
          onSeek={handleSeek}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          playerRef={playerRef}
        />
      )}

      <LyricsModal 
        isOpen={isLyricsOpen} 
        onClose={() => setIsLyricsOpen(false)} 
        currentSong={currentSong} 
        playerRef={playerRef} 
      />

      <SleepTimerModal 
        isOpen={isSleepTimerOpen} 
        onClose={() => setIsSleepTimerOpen(false)} 
        activeTimerRemaining={sleepTimerRemaining} 
        onSetTimer={(mins) => {
          setSleepTimerRemaining(mins * 60);
          showToast(`Sleep timer set for ${mins} minutes`);
        }} 
        onCancelTimer={() => {
          setSleepTimerRemaining(null);
          showToast('Sleep timer cancelled');
        }} 
      />

      <PlayerSettingsModal
        isOpen={isPlayerSettingsOpen}
        onClose={() => setIsPlayerSettingsOpen(false)}
        currentSong={currentSong}
        sleepTimerRemaining={sleepTimerRemaining}
        isDataSaverEnabled={isDataSaverEnabled}
        onToggleDataSaver={toggleDataSaver}
        isAutoPipEnabled={isAutoPipEnabled}
        onToggleAutoPip={() => {
          setIsAutoPipEnabled(prev => {
            const next = !prev;
            try {
              localStorage.setItem('loopra_auto_pip_enabled', next ? 'true' : 'false');
            } catch (_) {}
            showToast(next ? 'Auto Floating Mini-Player enabled' : 'Auto Floating Mini-Player disabled');
            return next;
          });
        }}
        isContinuousListening={isContinuousListening}
        onToggleContinuousListening={toggleContinuousListening}
        onSetSleepTimer={(mins) => {
          setSleepTimerRemaining(mins * 60);
          showToast(`Sleep timer set for ${mins} minutes`);
        }}
        onCancelSleepTimer={() => {
          setSleepTimerRemaining(null);
          showToast('Sleep timer cancelled');
        }}
        isAdmin={isAdmin}
        cmsConfig={cmsConfig}
        crossfadeDuration={crossfadeDuration}
        onSetCrossfadeDuration={handleSetCrossfadeDuration}
        isGaplessEnabled={isGaplessEnabled}
        onToggleGapless={handleToggleGapless}
        playbackSpeed={playbackSpeed}
        onSetPlaybackSpeed={(speed) => {
          setPlaybackSpeed(speed);
          if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
            playerRef.current.setPlaybackRate(speed);
          }
        }}
      />

      <ListeningStatsModal 
        isOpen={isStatsOpen} 
        onClose={() => setIsStatsOpen(false)} 
        showToast={showToast}
        authToken={authToken}
        user={user}
        backendUrl={BACKEND_URL}
        onPlaySong={playSong}
        currentSong={currentSong}
        isPlaying={isPlaying}
      />

      <UserProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        currentUser={user} 
        onUserUpdated={(updated) => {
          setUser(prev => {
            const merged = { ...(prev || {}), ...updated };
            setTabAuthSession(authToken || getTabAuthToken(), merged);
            return merged;
          });
        }} 
        showToast={showToast}
        onOpenSettings={() => {
          setIsProfileOpen(false);
          setIsPlayerSettingsOpen(true);
        }}
      />

      {/* Loopra AI Floating Music Companion */}
      <LoopraAiCompanion
        backendUrl={BACKEND_URL}
        authToken={authToken}
        user={user}
        currentSong={currentSong}
        isPlaying={isPlaying}
        playbackPosition={currentTimeRef.current}
        duration={durationRef.current}
        onPlayTrack={(track) => {
          playSong(track);
        }}
        onTogglePlayPause={togglePlayPause}
        onNextTrack={handleNextSong}
        onPrevTrack={handlePrevSong}
        onToggleShuffle={toggleShuffle}
        onToggleRepeat={toggleRepeatMode}
        onSetVolume={(vol) => {
          setVolume(vol);
          try { playerRef.current?.setVolume?.(vol); } catch (_) {}
        }}
        onToggleLike={toggleLike}
        isLiked={isSongLiked}
        onAddToPlaylist={handleAddToPlaylistClick}
        onAddToQueue={addToQueue}
        onNavigate={(page, extra) => {
          if (page === 'admin' && !isAdmin) {
            return { success: false, reason: 'NO_ACCESS' };
          }
          const validDestinations = [
            'home', 'discover', 'swipe', 'for-you', 'library', 'history',
            'playlists', 'rooms', 'activity', 'dj-club', 'downloads', 'downloads_explore',
            'radio', 'indian-radio', 'mood', 'timemachine', 'barber', 'truck', 'pauwa',
            'artist', 'admin', 'apk', 'download'
          ];
          if (!validDestinations.includes(page) && !SPECIAL_STATIONS[page] && !stationsMap[page]) {
            return { success: false, reason: 'NOT_FOUND' };
          }
          if (page === 'home') {
            window.history.pushState(null, '', '/');
            handleStationSelect('home');
          } else if (page === 'discover') {
            if (extra?.query) {
              handleSearchFromHome(extra.query);
            } else {
              handleStationSelect('discover');
            }
          } else {
            handleStationSelect(page, extra);
          }
          return { success: true };
        }}
        onOpenInsights={() => setIsStatsOpen(true)}
        onOpenQueue={() => {
          if (typeof handleOpenExpandedPlayer === 'function') {
            handleOpenExpandedPlayer('queue');
          } else {
            setShowQueuePanel(true);
          }
        }}
        onOpenLyrics={() => setIsLyricsOpen(true)}
        onOpenListeningRooms={() => {
          setActiveTab('rooms');
          setIsSidebarOpen(false);
        }}
        onOpenSimilarSongs={(track) => setSimilarSongsTrack(track || currentSong)}
        onOpenPlayerSettings={() => setIsPlayerSettingsOpen(true)}
        onOpenSleepTimer={() => setIsSleepTimerOpen(true)}
        onOpenCanvas={() => setIsCanvasOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenRatingModal={() => setIsRatingModalOpen(true)}
        onSetPlaybackSpeed={(spd) => {
          try {
            if (typeof playerRef.current?.setPlaybackRate === 'function') {
              playerRef.current.setPlaybackRate(spd);
            }
            showToast?.(`Playback speed set to ${spd}x`);
          } catch (_) {}
        }}
        onDjAction={(actionObj) => {
          try {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('loopra_dj_action', { detail: actionObj }));
            }
          } catch (_) {}
        }}
        onGoBack={handleGoBack}
        onOpenArtist={(artistName) => handleArtistClick(artistName)}
        showToast={showToast}
        isBottomPlayerVisible={isBottomPlayerVisible}
        isOpen={activeAssistantPanel === 'ai'}
        onToggleOpen={(open) => setActiveAssistantPanel(open ? 'ai' : null)}
        onClose={() => setActiveAssistantPanel(null)}
        hideFloatingButton={showSplashScreen || !isAppInitialized || showQueuePanel || showAuthModal || (isSidebarOpen && isMobileScreen) || Boolean(videoModalSong && !isPipActive)}
        canAccessVoice={canAccessVoice}
        isAvatarActive={isAvatarVisible}
      />

      {/* Loopra Dedicated Voice Agent & Shared Floating Assistant Action Bar */}
      {isVoiceActive && (
        <VoiceAgentModal
          user={user}
          token={authToken}
          backendUrl={BACKEND_URL}
          currentSong={currentSong}
        isPlaying={isPlaying}
        volume={volume}
        isSongLiked={isSongLiked}
        isBottomPlayerVisible={isBottomPlayerVisible}
        activeTab={activeTab}
        isAiOpen={activeAssistantPanel === 'ai'}
        onToggleAi={() => setActiveAssistantPanel(prev => prev === 'ai' ? null : 'ai')}
        isPanelOpen={activeAssistantPanel === 'voice'}
        onOpenPanel={() => setActiveAssistantPanel('voice')}
        onClosePanel={() => setActiveAssistantPanel(null)}
        isAvatarVisible={isAvatarVisible}
        showSplashScreen={showSplashScreen}
        isAppInitialized={isAppInitialized}
        onToggleAvatar={(vis) => {
          setIsAvatarVisible((prev) => {
            const next = typeof vis === 'boolean' ? vis : !prev;
            try {
              localStorage.setItem('loopra_avatar_visible', next ? 'true' : 'false');
            } catch (_) {}
            return next;
          });
        }}
        onPlayTrack={(track) => playSong(track)}
        onTogglePlayPause={togglePlayPause}
        onNextTrack={handleNextSong}
        onPrevTrack={handlePrevSong}
        onToggleShuffle={toggleShuffle}
        onToggleRepeat={toggleRepeatMode}
        onSetVolume={(vol) => {
          setVolume(vol);
          try { playerRef.current?.setVolume?.(vol); } catch (_) {}
        }}
        onToggleLike={(track) => toggleLike(track || currentSong)}
        onRemoveFromFavorites={(trackOrTitle) => {
          const title = typeof trackOrTitle === 'string' ? trackOrTitle : trackOrTitle?.title;
          if (title) {
            setLikedSongs(prev => prev.filter(s => !s.title?.toLowerCase().includes(title.toLowerCase())));
            showToast?.(`Removed "${title}" from favorites`);
          } else if (currentSong) {
            toggleLike(currentSong);
          }
        }}
        onAddToPlaylist={(track) => handleAddToPlaylistClick(track || currentSong)}
        onCreatePlaylist={(name) => {
          const trimmed = (name || '').trim() || 'New Playlist';
          const newPl = {
            id: `pl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: trimmed,
            createdAt: new Date().toISOString(),
            songs: []
          };
          setPlaylists(prev => [newPl, ...prev]);
          showToast?.(`Created playlist "${trimmed}"`);
          return newPl;
        }}
        onOpenPlaylistByName={(name) => {
          const pl = playlists.find(p => p.name?.toLowerCase().includes(name.toLowerCase()));
          if (pl) {
            setSelectedPlaylistForView(pl);
            handleStationSelect('playlists');
          } else {
            handleStationSelect('playlists');
          }
        }}
        onPlayPlaylist={(name) => {
          const pl = playlists.find(p => p.name?.toLowerCase().includes(name.toLowerCase()));
          if (pl && pl.songs?.length > 0) {
            setQueue(pl.songs);
            playSong(pl.songs[0]);
            showToast?.(`Playing playlist "${pl.name}"`);
          } else {
            showToast?.('Playlist is empty or not found', 'warning');
          }
        }}
        onPlayRadioStation={(stationName) => {
          handleStationSelect('radio', { station: stationName, autoplay: true });
        }}
        onPlayFromHistory={(queryOrIndex) => {
          if (history && history.length > 0) {
            let track = history[0];
            if (typeof queryOrIndex === 'string') {
              const matched = history.find(s => s.title?.toLowerCase().includes(queryOrIndex.toLowerCase()));
              if (matched) track = matched;
            }
            playSong(track);
            showToast?.(`Playing "${track.title}" from history`);
          } else {
            showToast?.('No songs found in listening history', 'warning');
          }
        }}
        onRemoveHistoryItem={(queryOrId) => {
          if (queryOrId) {
            const queryLower = String(queryOrId).toLowerCase().trim();
            setHistory(prev => prev.filter(s => {
              const match = s.id === queryOrId ||
                s.title?.toLowerCase().includes(queryLower) ||
                s.artist?.toLowerCase().includes(queryLower);
              return !match;
            }));
            showToast?.('Removed from listening history');
          }
        }}
        onClearHistory={clearHistory}
        onAddToQueue={(track) => {
          const songToAdd = track || currentSong;
          if (songToAdd) {
            setQueue(prev => [...prev, songToAdd]);
            showToast?.(`Added "${songToAdd.title}" to queue`);
          }
        }}
        onNavigate={(page, extra) => {
          if (page === 'admin' && !isAdmin) {
            return { success: false, reason: 'NO_ACCESS' };
          }
          const validDestinations = [
            'home', 'discover', 'swipe', 'for-you', 'library', 'history',
            'playlists', 'rooms', 'activity', 'dj-club', 'downloads', 'downloads_explore',
            'radio', 'indian-radio', 'mood', 'timemachine', 'barber', 'truck', 'pauwa',
            'artist', 'admin', 'apk', 'download'
          ];
          if (!validDestinations.includes(page) && !SPECIAL_STATIONS[page] && !stationsMap[page]) {
            return { success: false, reason: 'NOT_FOUND' };
          }
          if (page === 'home') {
            window.history.pushState(null, '', '/');
            handleStationSelect('home');
          } else if (page === 'discover') {
            if (extra?.query) {
              handleSearchFromHome(extra.query);
            } else {
              handleStationSelect('discover');
            }
          } else {
            handleStationSelect(page, extra);
          }
          return { success: true };
        }}
        onOpenInsights={() => setIsStatsOpen(true)}
        onOpenQueue={() => {
          if (typeof handleOpenExpandedPlayer === 'function') {
            handleOpenExpandedPlayer('queue');
          } else {
            setShowQueuePanel(true);
          }
        }}
        onOpenLyrics={() => setIsLyricsOpen(true)}
        onOpenListeningRooms={() => {
          setActiveTab('rooms');
          setIsSidebarOpen(false);
        }}
        onOpenSimilarSongs={(track) => setSimilarSongsTrack(track || currentSong)}
        onOpenPlayerSettings={() => setIsPlayerSettingsOpen(true)}
        onOpenSleepTimer={() => setIsSleepTimerOpen(true)}
        onOpenCanvas={() => setIsCanvasOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenRatingModal={() => setIsRatingModalOpen(true)}
        onSetPlaybackSpeed={(spd) => {
          try {
            if (typeof playerRef.current?.setPlaybackRate === 'function') {
              playerRef.current.setPlaybackRate(spd);
            }
            showToast?.(`Playback speed set to ${spd}x`);
          } catch (_) {}
        }}
        onDjAction={(actionObj) => {
          try {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('loopra_dj_action', { detail: actionObj }));
            }
          } catch (_) {}
        }}
        onGoBack={handleGoBack}
        onOpenArtist={(artistName) => handleArtistClick(artistName)}
        userPlaylists={playlists}
        selectedPlaylistForView={selectedPlaylistForView}
        getCurrentVisibleTracks={() => currentContextTracksRef.current}
        playFromCurrentContext={async ({ mode, songQuery }) => {
          const tracks = currentContextTracksRef.current || [];
          if (!tracks || tracks.length === 0) {
            return { success: false, message: 'Collection is empty or still loading.' };
          }
          let trackToPlay = null;
          if (songQuery) {
            const q = songQuery.toLowerCase().trim();
            const matched = tracks.find(t => 
              (t.title && t.title.toLowerCase().includes(q)) ||
              (t.artist && t.artist.toLowerCase().includes(q))
            );
            if (matched) {
              trackToPlay = matched;
            } else {
              return { success: false, message: `"${songQuery}" is collection mein nahi mila.` };
            }
          } else if (mode === 'first') {
            trackToPlay = tracks[0];
          } else {
            // random / shuffle / default
            const idx = Math.floor(Math.random() * tracks.length);
            trackToPlay = tracks[idx];
          }

          if (trackToPlay) {
            playSong(trackToPlay);
            showToast?.(`Playing "${trackToPlay.title}"`);
            return { success: true, track: trackToPlay, description: `Playing "${trackToPlay.title}" from collection` };
          }
          return { success: false, message: 'No track found to play.' };
        }}
        showToast={showToast}
      />
      )}

      {/* Automatic 5-Minute Active Usage & Direct Rate/Review Modal */}
      <RatingPopupModal
        user={user}
        authToken={authToken}
        isPlaying={isPlaying}
        showToast={showToast}
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        initialMode={ratingModalMode}
        onReviewSubmitted={() => setReviewsRefreshKey(k => k + 1)}
      />

      {toastMessage && (
        <div className={`fixed ${isBottomPlayerVisible ? 'bottom-36 md:bottom-28' : 'bottom-20 md:bottom-8'} left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-2xl bg-neutral-900/95 text-white text-xs border border-amber-500/40 shadow-2xl backdrop-blur-xl flex items-center gap-2 animate-fadeIn pointer-events-none`}>
          <Icon name="sparkles" className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Autoplay Policy Block Prompt Banner: Prompts user with interactive play button when browser blocks autoplay */}
      {isAutoplayBlocked && currentSong && (
        <div className={`fixed ${isBottomPlayerVisible ? 'bottom-36 md:bottom-28' : 'bottom-20 md:bottom-8'} left-1/2 -translate-x-1/2 z-[10001] px-4 py-2.5 rounded-2xl bg-neutral-900/95 text-white text-xs border border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.25)] backdrop-blur-2xl flex items-center gap-3 animate-fadeIn`}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-medium">Autoplay blocked by browser. Tap to start playback:</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsAutoplayBlocked(false);
              togglePlayPause();
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <span>▶</span>
            <span>Tap to Play</span>
          </button>
        </div>
      )}

      {/* Render Free-Tier Cold-Start Wake-Up Badge Removed */}

      {/* Global Right-Click Track Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-[10000] w-52 bg-neutral-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-neutral-700/80 overflow-hidden py-1.5 animate-fadeIn select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3.5 py-1.5 border-b border-white/5 mb-1">
            <p className="text-[11px] font-bold text-white truncate">{contextMenu.track.title}</p>
            <p className="text-[9px] text-neutral-400 truncate">{contextMenu.track.artist || contextMenu.track.channel}</p>
          </div>

          <button
            onClick={() => {
              playSong(contextMenu.track);
              setContextMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition flex items-center gap-2.5 cursor-pointer"
          >
            <span className="text-amber-400">▶</span>
            <span>Play Now</span>
          </button>

          <button
            onClick={() => {
              playNext(contextMenu.track);
              setContextMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition flex items-center gap-2.5 cursor-pointer"
          >
            <span>⏭️</span>
            <span>Play Next</span>
          </button>

          <button
            onClick={() => {
              if (queue.some(s => (s.id || s.videoId) === (contextMenu.track.id || contextMenu.track.videoId))) {
                removeFromQueue(contextMenu.track.id || contextMenu.track.videoId);
              } else {
                addToQueue(contextMenu.track);
              }
              setContextMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition flex items-center gap-2.5 cursor-pointer"
          >
            <span>➕</span>
            <span>{queue.some(s => (s.id || s.videoId) === (contextMenu.track.id || contextMenu.track.videoId)) ? 'Remove from Queue' : 'Add to Queue'}</span>
          </button>

          <button
            onClick={() => {
              toggleLike(contextMenu.track);
              setContextMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-pink-400 hover:bg-neutral-800/80 transition flex items-center gap-2.5 cursor-pointer"
          >
            <span className="text-pink-400">♥</span>
            <span>{likedSongs.some(s => (s.id || s.videoId) === (contextMenu.track.id || contextMenu.track.videoId)) ? 'Remove Favorite' : 'Add to Favorite'}</span>
          </button>

          <button
            onClick={() => {
              handleAddToPlaylistClick(contextMenu.track);
              setContextMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition flex items-center gap-2.5 cursor-pointer"
          >
            <span>📁</span>
            <span>Add to Playlist</span>
          </button>

          <div className="pt-1 border-t border-white/5 mt-1">
            <DownloadTrackButton
              track={contextMenu.track}
              variant="menu-item"
              showToast={showToast}
              onDownloaded={() => setContextMenu(null)}
            />
          </div>
        </div>
      )}

      {/* Automatic In-App Android APK Update Notification Modal */}
      {pendingAppUpdate && (
        <AppUpdateModal
          updateInfo={pendingAppUpdate}
          onClose={() => setPendingAppUpdate(null)}
          showToast={showToast}
        />
      )}
      </Suspense>
    </div>
  );
}
























