import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  Sparkles,
  AlertTriangle,
  Mic
} from 'lucide-react';
import { voiceControlService } from '../../services/voiceControlService';
import {
  voiceSessionService,
  SESSION_STATES
} from '../../services/voiceSessionService';
import { parseVoiceCommandLocally } from '../../services/voiceAgentRegistry';
import {
  parseMultiStepInstruction,
  executeTaskPipeline,
  splitVoiceInstructionIntoClauses
} from '../../services/voiceTaskEngine';
import { voiceBuddyService } from '../../services/voiceBuddyService';
import { parseCommandToAction, INTENT_CATEGORIES } from '../../services/commandActionEngine';
import { chatBuddyClient } from '../../services/chatBuddyClient';
import CharacterBuddy from './CharacterBuddy';

export default function VoiceAgentModal({
  user,
  token,
  backendUrl,
  currentSong,
  isPlaying,
  volume = 70,
  isSongLiked = false,
  isBottomPlayerVisible = false,
  activeTab = 'home',
  isAiOpen = false,
  onToggleAi,
  isPanelOpen = false,
  onOpenPanel,
  onClosePanel,
  isAvatarVisible = false,
  showSplashScreen = false,
  isAppInitialized = true,
  onToggleAvatar,
  onPlayTrack,
  onTogglePlayPause,
  onNextTrack,
  onPrevTrack,
  onToggleShuffle,
  onToggleRepeat,
  onSetVolume,
  onToggleLike,
  onRemoveFromFavorites,
  onAddToPlaylist,
  onCreatePlaylist,
  onOpenPlaylistByName,
  onPlayPlaylist,
  onPlayRadioStation,
  onPlayFromHistory,
  onRemoveHistoryItem,
  onClearHistory,
  onAddToQueue,
  onNavigate,
  onOpenInsights,
  onOpenQueue,
  onOpenLyrics,
  onOpenListeningRooms,
  onOpenSimilarSongs,
  onOpenPlayerSettings,
  onOpenSleepTimer,
  onOpenCanvas,
  onOpenProfile,
  onOpenRatingModal,
  onSetPlaybackSpeed,
  onDjAction,
  onGoBack,
  onOpenArtist,
  showToast
}) {
  // 1. Permission check via voiceControlService
  const [hasAccess, setHasAccess] = useState(() => {
    const initial = voiceControlService.getAccessState();
    if (user) {
      return voiceControlService.evaluateLocalAccess(initial, user);
    }
    return Boolean(initial.allowed);
  });

  // 2. Authoritative voice session state
  const [sessionState, setSessionState] = useState(SESSION_STATES.OFF);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Voice Agent: OFF (Click Loopra to start)');
  const [activeActionLabel, setActiveActionLabel] = useState('');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [voiceVolumeScale, setVoiceVolumeScale] = useState(0);

  // Persistent task context across consecutive voice inputs
  const persistentContextRef = useRef({
    currentSong: currentSong || null,
    lastPlayedTrack: currentSong || null,
    lastArtist: currentSong?.artist || currentSong?.channel || null,
    lastSearchResults: [],
    volume: volume,
    isPlaying: isPlaying,
    activeTab: activeTab,
    completedSteps: []
  });

  const pendingConfirmationStepRef = useRef(null);
  const lastProcessedCommandRef = useRef({ text: '', time: 0 });
  const handleProcessUtteranceRef = useRef(null);

  // Sync props into persistent context
  useEffect(() => {
    if (currentSong) {
      persistentContextRef.current.currentSong = currentSong;
      persistentContextRef.current.lastPlayedTrack = currentSong;
      if (currentSong.artist || currentSong.channel) {
        persistentContextRef.current.lastArtist = currentSong.artist || currentSong.channel;
      }
    }
    persistentContextRef.current.isPlaying = isPlaying;
    persistentContextRef.current.volume = volume;
    persistentContextRef.current.activeTab = activeTab;
  }, [currentSong, isPlaying, volume, activeTab]);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Permission subscription
  useEffect(() => {
    const unsub = voiceControlService.subscribe((state) => {
      const allowed = user ? voiceControlService.evaluateLocalAccess(state, user) : Boolean(state.allowed);
      setHasAccess(allowed);
      if (!allowed && voiceSessionService.isSessionActive) {
        voiceSessionService.stopSession('permission_revoked');
      }
    });
    return unsub;
  }, [user]);

  // Catalog search helper
  const searchCatalog = useCallback(async (query = '') => {
    if (!query) return [];
    try {
      const cleanUrl = (backendUrl || '').replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/youtube/search?q=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        return items.map((item) => ({
          id: item.id?.videoId || item.id,
          title: item.snippet?.title || query,
          artist: item.snippet?.channelTitle || 'Loopra Audio',
          thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || ''
        }));
      }
    } catch (e) {
      console.warn('[VoiceAgent] Catalog search network error:', e.message);
    }
    return [];
  }, [backendUrl]);

  // 3. Centralized Command-to-Action Execution Pipeline (Shared by Voice & Text input)
  const handleProcessUtterance = useCallback(async (rawUtterance = '') => {
    if (!rawUtterance || typeof rawUtterance !== 'string') return;
    const text = rawUtterance.trim();
    if (!text) return;

    // Strict deduplication: ignore exact same command processed within 2500ms
    const now = Date.now();
    if (
      lastProcessedCommandRef.current.text === text.toLowerCase() &&
      (now - lastProcessedCommandRef.current.time) < 2500
    ) {
      console.log('[VoiceAgent] Suppressed duplicate utterance within 2500ms:', text);
      return;
    }
    lastProcessedCommandRef.current = { text: text.toLowerCase(), time: now };

    // A. Check for pending destructive action confirmation
    if (pendingConfirmationStepRef.current) {
      if (/^(haan|yes|confirm|theek hai|kardo|kar do|sure|proceed|ha)\b/i.test(text)) {
        const stepToRun = pendingConfirmationStepRef.current;
        pendingConfirmationStepRef.current = null;
        showToast?.('Executing confirmed action...');
        try {
          const confirmedResult = await executeTaskPipeline([stepToRun], { ...persistentContextRef.current, confirmed: true }, {
            onPlayTrack,
            onTogglePlayPause,
            onNextTrack,
            onPrevTrack,
            onToggleShuffle,
            onToggleRepeat,
            onSetVolume,
            onToggleLike,
            onRemoveFromFavorites,
            onAddToPlaylist,
            onCreatePlaylist,
            onOpenPlaylistByName,
            onPlayPlaylist,
            onPlayRadioStation,
            onPlayFromHistory,
            onRemoveHistoryItem,
            onClearHistory,
            onAddToQueue,
            onNavigate,
            onOpenInsights,
            onOpenQueue,
            onOpenLyrics,
            onOpenListeningRooms,
            onOpenSimilarSongs,
            onOpenPlayerSettings,
            onOpenSleepTimer,
            onOpenCanvas,
            onOpenProfile,
            onOpenRatingModal,
            onSetPlaybackSpeed,
            onDjAction,
            onGoBack,
            onOpenArtist,
            searchCatalog
          });
          voiceBuddyService.speak(confirmedResult.message);
          showToast?.(confirmedResult.message);
          voiceSessionService.notifyExecutionFinish(confirmedResult.message);
        } catch (confErr) {
          showToast?.(`Error: ${confErr.message}`, 'error');
          voiceBuddyService.speak('Action execute nahi ho paya.');
        }
        return;
      } else if (/^(no|nahi|mat karo|cancel|rehne do|stop)\b/i.test(text)) {
        pendingConfirmationStepRef.current = null;
        voiceBuddyService.speak('Thik hai, action cancel kar diya.');
        showToast?.('Action cancelled.');
        voiceSessionService.notifyExecutionFinish('Cancelled.');
        return;
      }
    }

    // A2. Avatar Visibility Commands
    if (/^(show avatar|avatar dikhao|companion dikhao|open buddy|avatar chalao)\b/i.test(text)) {
      onToggleAvatar?.(true);
      const reply = 'Namaste dost! Loopra aapke saath hai, bataiye kya sunenge?';
      voiceBuddyService.speak(reply);
      showToast?.('Avatar Revealed');
      voiceSessionService.notifyExecutionFinish(reply);
      return;
    }
    if (/^(hide avatar|avatar chhupao|close buddy|avatar band karo|avatar hatao)\b/i.test(text)) {
      onToggleAvatar?.(false);
      const reply = 'Thik hai, main chhup jaati hoon!';
      voiceBuddyService.speak(reply);
      showToast?.('Avatar Hidden');
      voiceSessionService.notifyExecutionFinish(reply);
      return;
    }

    // A3. Check for deactivation commands (e.g. "stop listening", "done loopra")
    const singleParse = parseVoiceCommandLocally(text, persistentContextRef.current);
    if (singleParse && singleParse.action === 'stop_continuous') {
      voiceSessionService.stopSession('manual');
      voiceBuddyService.speak('Byeee');
      showToast?.('Voice session stopped');
      return;
    }

    // B. Compound Sentence Check:
    // If the instruction contains multiple distinct clauses (e.g. "Open liked songs and remove this song"),
    // pass directly to Multi-Step Pipeline so each independent action is executed sequentially.
    const clauses = splitVoiceInstructionIntoClauses(text);
    const isCompound = clauses.length > 1;

    if (!isCompound) {
      const directAction = parseCommandToAction(text, persistentContextRef.current);

      // A4. Casual Chat & Conversational Inquiries: Route DIRECTLY to Gemini ChatBuddy (/api/chat)
      // Never attempt task pipeline or emit internal execution labels for natural chat!
      if (directAction && directAction.intent === INTENT_CATEGORIES.GENERAL_QUESTION) {
        try {
          const chatRes = await chatBuddyClient.sendMessage(text, backendUrl, persistentContextRef.current);
          if (chatRes && chatRes.reply) {
            voiceBuddyService.speak(chatRes.reply);
            showToast?.(chatRes.reply);
            voiceSessionService.notifyExecutionFinish(chatRes.reply);
            return;
          }
        } catch (err) {
          console.warn('[VoiceAgent] ChatBuddy direct inquiry notice:', err.message);
        }
      }

      // A5. Genuine Clarification Check (e.g. "Play that song" when no song is in context)
      if (directAction && directAction.intent === INTENT_CATEGORIES.CLARIFY) {
        const clarifyPrompt = directAction.speechResponse || 'Which song would you like to play?';
        voiceBuddyService.speak(clarifyPrompt);
        showToast?.(clarifyPrompt, 'info');
        voiceSessionService.notifyExecutionFinish(clarifyPrompt);
        return;
      }

      if (directAction && directAction.intent !== INTENT_CATEGORIES.GENERAL_QUESTION && directAction.intent !== INTENT_CATEGORIES.CLARIFY) {
        if (typeof window !== 'undefined' && typeof window.__loopraRecordCommandDisplay === 'function') {
          window.__loopraRecordCommandDisplay(text, directAction.action || directAction.intent);
        }

        // 0. OPEN_INSIGHTS: Strictly opens Recap & Stats modal (NEVER routes to activity)
        if (directAction.intent === INTENT_CATEGORIES.OPEN_INSIGHTS || directAction.action === 'open_insights') {
          if (onOpenInsights) {
            onOpenInsights();
          }
          const reply = 'Opening your Recap and Stats';
          voiceBuddyService.speak(reply);
          showToast?.('Opening Recap & Stats');
          return;
        }

        // Advanced Modals
        if (directAction.action === 'open_listening_rooms' || directAction.intent === INTENT_CATEGORIES.OPEN_LISTENING_ROOMS) {
          if (onOpenListeningRooms) onOpenListeningRooms();
          const reply = 'Opening Social Listening Rooms';
          voiceBuddyService.speak(reply);
          showToast?.('Opening Listening Rooms');
          return;
        }

        if (directAction.action === 'open_similar_songs' || directAction.intent === INTENT_CATEGORIES.OPEN_SIMILAR_SONGS) {
          if (onOpenSimilarSongs) onOpenSimilarSongs(currentSong);
          const reply = 'Finding similar songs for you';
          voiceBuddyService.speak(reply);
          showToast?.('Opening Similar Songs');
          return;
        }

        if (directAction.action === 'open_player_settings' || directAction.intent === INTENT_CATEGORIES.OPEN_PLAYER_SETTINGS) {
          if (onOpenPlayerSettings) onOpenPlayerSettings();
          const reply = 'Opening player settings and equalizer';
          voiceBuddyService.speak(reply);
          showToast?.('Opening Player Settings');
          return;
        }

        if (directAction.action === 'open_sleep_timer' || directAction.intent === INTENT_CATEGORIES.OPEN_SLEEP_TIMER) {
          if (onOpenSleepTimer) onOpenSleepTimer();
          const reply = 'Opening Sleep Timer';
          voiceBuddyService.speak(reply);
          showToast?.('Opening Sleep Timer');
          return;
        }

        if (directAction.action === 'open_canvas' || directAction.intent === INTENT_CATEGORIES.OPEN_CANVAS) {
          if (onOpenCanvas) onOpenCanvas();
          const reply = 'Opening Loopra Canvas visualizer';
          voiceBuddyService.speak(reply);
          showToast?.('Opening Loopra Canvas');
          return;
        }

        if (directAction.action === 'open_profile' || directAction.intent === INTENT_CATEGORIES.OPEN_PROFILE) {
          if (onOpenProfile) onOpenProfile();
          const reply = 'Opening your profile';
          voiceBuddyService.speak(reply);
          showToast?.('Opening Profile');
          return;
        }

        if (directAction.action === 'open_rating_modal' || directAction.intent === INTENT_CATEGORIES.OPEN_RATING_MODAL) {
          if (onOpenRatingModal) onOpenRatingModal();
          const reply = 'Opening rating and reviews';
          voiceBuddyService.speak(reply);
          showToast?.('Opening Rate & Review');
          return;
        }

        // Live DJ Controls
        if (directAction.intent === INTENT_CATEGORIES.DJ_ACTION) {
          if (onDjAction) onDjAction(directAction);
          const reply = directAction.description || 'DJ action executed';
          voiceBuddyService.speak(reply);
          showToast?.(reply);
          return;
        }

        // Playback Speed
        if (directAction.intent === INTENT_CATEGORIES.CHANGE_SPEED && directAction.action === 'set_playback_speed') {
          if (onSetPlaybackSpeed) onSetPlaybackSpeed(directAction.value);
          const reply = `Playback speed set to ${directAction.value}x`;
          voiceBuddyService.speak(reply);
          showToast?.(reply);
          return;
        }

        // 1. OPEN_PAGE: Strictly navigates to the registered page/station (e.g. Saloon FM, Horn Ok Please, Theka, DJ Club)
        if (directAction.intent === INTENT_CATEGORIES.OPEN_PAGE || directAction.intent === INTENT_CATEGORIES.OPEN_DJ_CLUB) {
          const targetId = directAction.target;
          const targetName = directAction.item?.name || targetId;

          // Animate 3D physical character walking/running to the element and WAIT until arrival & tap
          if (typeof window !== 'undefined' && typeof window.__loopraWalkAndTap === 'function') {
            await window.__loopraWalkAndTap(targetId, targetName);
          }
          if (onNavigate) {
            onNavigate(targetId, directAction.extra);
          }

          const reply = voiceBuddyService.generateFriendReply('navigate_page', { target: targetId });
          voiceBuddyService.speak(reply);
          showToast?.(`Opening ${targetName}`);
          voiceSessionService.notifyExecutionFinish(reply);
          return;
        }

        // 2. OPEN_SECTION: In-page section (e.g. Trending Songs)
        if (directAction.intent === INTENT_CATEGORIES.OPEN_SECTION) {
          if (directAction.target === 'trending_section') {
            if (onNavigate) onNavigate('home', { showAll: 'trending' });
            const reply = voiceBuddyService.generateFriendReply('navigate_section', { target: 'trending_section' });
            voiceBuddyService.speak(reply);
            showToast?.('Opening Trending Songs');
            return;
          }
        }

        // 3. SEARCH_SONG: Strictly searches WITHOUT playing music
        if (directAction.intent === INTENT_CATEGORIES.SEARCH_SONG) {
          const q = directAction.query || 'songs';
          if (onNavigate) {
            onNavigate('discover', { query: q });
          }
          const reply = voiceBuddyService.generateFriendReply('search', { query: q });
          voiceBuddyService.speak(reply);
          showToast?.(`Searching for "${q}"`);
          return;
        }

        // 4. PLAY_SEARCH_RESULT: Plays first song from search
        if (directAction.intent === INTENT_CATEGORIES.PLAY_SEARCH_RESULT) {
          if (persistentContextRef.current.lastSearchResults?.length > 0 && onPlayTrack) {
            onPlayTrack(persistentContextRef.current.lastSearchResults[0]);
          }
          const reply = voiceBuddyService.generateFriendReply('play_index');
          voiceBuddyService.speak(reply);
          showToast?.('Playing first song');
          return;
        }

        // 5. PAUSE_PLAYBACK
        if (directAction.intent === INTENT_CATEGORIES.PAUSE_PLAYBACK) {
          if (isPlaying && onTogglePlayPause) onTogglePlayPause();
          const reply = voiceBuddyService.generateFriendReply('pause');
          voiceBuddyService.speak(reply);
          showToast?.('Music paused');
          return;
        }

        // 6. RESUME_PLAYBACK
        if (directAction.intent === INTENT_CATEGORIES.RESUME_PLAYBACK) {
          if (!isPlaying && onTogglePlayPause) onTogglePlayPause();
          const reply = voiceBuddyService.generateFriendReply('resume');
          voiceBuddyService.speak(reply);
          showToast?.('Music resumed');
          return;
        }

        // 7. NEXT_TRACK
        if (directAction.intent === INTENT_CATEGORIES.NEXT_TRACK) {
          if (onNextTrack) onNextTrack();
          const reply = voiceBuddyService.generateFriendReply('next');
          voiceBuddyService.speak(reply);
          showToast?.('Next track');
          return;
        }

        // 8. PREVIOUS_TRACK
        if (directAction.intent === INTENT_CATEGORIES.PREVIOUS_TRACK) {
          if (onPrevTrack) onPrevTrack();
          const reply = voiceBuddyService.generateFriendReply('previous');
          voiceBuddyService.speak(reply);
          showToast?.('Previous track');
          return;
        }

        // 9. CHANGE_VOLUME
        if (directAction.intent === INTENT_CATEGORIES.CHANGE_VOLUME) {
          let newVol = volume;
          if (directAction.action === 'set_volume') newVol = directAction.value;
          if (directAction.action === 'volume_down') newVol = Math.max(0, volume - 15);
          if (directAction.action === 'volume_up') newVol = Math.min(100, volume + 15);
          if (onSetVolume) onSetVolume(newVol);
          const reply = voiceBuddyService.generateFriendReply(directAction.action, { value: newVol });
          voiceBuddyService.speak(reply);
          showToast?.(`Volume set to ${newVol}%`);
          return;
        }

        // 10. ADD_TO_FAVOURITES
        if (directAction.intent === INTENT_CATEGORIES.ADD_TO_FAVOURITES) {
          const targetSong = directAction.target || currentSong || persistentContextRef.current.currentSong || persistentContextRef.current.lastPlayedTrack;
          if (targetSong && onToggleLike) {
            onToggleLike(targetSong);
            const reply = voiceBuddyService.generateFriendReply('like', { target: targetSong.title });
            voiceBuddyService.speak(reply);
            showToast?.(`Added "${targetSong.title || 'song'}" to Liked Songs`);
          } else {
            showToast?.('No song currently playing to add to favorites', 'warning');
          }
          return;
        }

        // 11. REMOVE_FROM_FAVOURITES / UNLIKE
        if (directAction.intent === INTENT_CATEGORIES.REMOVE_FROM_FAVOURITES) {
          const targetSong = directAction.target || currentSong || persistentContextRef.current.currentSong || persistentContextRef.current.lastPlayedTrack;
          if (targetSong && onToggleLike) {
            onToggleLike(targetSong);
            const reply = voiceBuddyService.generateFriendReply('unlike', { target: targetSong.title });
            voiceBuddyService.speak(reply);
            showToast?.(`Removed "${targetSong.title || 'song'}" from favorites`);
          } else {
            showToast?.('No song selected or currently playing to remove', 'warning');
          }
          return;
        }

        // 12. AVATAR_ACTION (Wave, Wink, Dance, Jump, Pose)
        if (directAction.intent === INTENT_CATEGORIES.AVATAR_ACTION) {
          const gesture = directAction.gesture || 'wave';
          if (typeof window !== 'undefined' && typeof window.__loopraTriggerAvatarGesture === 'function') {
            window.__loopraTriggerAvatarGesture(gesture, 2500);
          } else if (typeof window !== 'undefined' && typeof window.__loopraPlayGesture === 'function') {
            window.__loopraPlayGesture(gesture, 2500);
          }
          const reply = voiceBuddyService.generateFriendReply(gesture);
          voiceBuddyService.speak(reply);
          showToast?.(`Loopra ${gesture}`);
          return;
        }

        // 13. PLAY_SONG (Explicit Playback Verb Only)
        if (directAction.intent === INTENT_CATEGORIES.PLAY_SONG) {
          const query = directAction.query;
          let track = null;
          if (typeof searchCatalog === 'function') {
            const results = await searchCatalog(query);
            if (Array.isArray(results) && results.length > 0) {
              track = results[0];
              persistentContextRef.current.lastSearchResults = results;
            }
          }
          if (!track) {
            track = { id: `v_${Date.now()}`, title: query, artist: query };
          }
          if (onPlayTrack) {
            await onPlayTrack(track);
            persistentContextRef.current.currentSong = track;
            persistentContextRef.current.lastPlayedTrack = track;
            persistentContextRef.current.isPlaying = true;
          }
          const reply = voiceBuddyService.generateFriendReply('play_search', { target: track.title });
          voiceBuddyService.speak(reply);
          showToast?.(`Playing "${track.title}"`);
          return;
        }
      }
    }

    // C. Multi-Step Task Pipeline Fallback (for complex compound chains or ambiguous queries)
    let steps = parseMultiStepInstruction(text, persistentContextRef.current);

    // D. If local parser could not determine steps, delegate to Shared Two-Layer ChatBuddy Intent Engine (/api/chat)
    if (steps.length === 0) {
      try {
        const chatRes = await chatBuddyClient.sendMessage(text, backendUrl, persistentContextRef.current);
        if (chatRes) {
          // If casual conversation: speak naturally, NEVER trigger unwanted music playback
          if (chatRes.type === 'chat') {
            voiceBuddyService.speak(chatRes.reply);
            showToast?.(chatRes.reply);
            voiceSessionService.notifyExecutionFinish(chatRes.reply);
            return;
          }

          // If structured command: execute identical actions as typed chat
          if (chatRes.type === 'command') {
            const action = chatRes.action;
            const params = chatRes.params || {};

            if (action === 'play_song') {
              const q = params.query || text;
              const searchResults = await searchCatalog(q);
              if (searchResults.length > 0 && onPlayTrack) {
                onPlayTrack(searchResults[0]);
                showToast?.(`Now playing: ${searchResults[0].title}`);
              }
            } else if (action === 'open_page') {
              const targetPage = params.page || 'home';
              if (targetPage === 'stats' && onOpenInsights) onOpenInsights();
              else if (onNavigate) onNavigate(targetPage);
            } else if (action === 'pause') {
              if (onTogglePlayPause && isPlaying) onTogglePlayPause();
            } else if (action === 'resume') {
              if (onTogglePlayPause && !isPlaying) onTogglePlayPause();
            } else if (action === 'next') {
              if (onNextTrack) onNextTrack();
            } else if (action === 'previous') {
              if (onPrevTrack) onPrevTrack();
            } else if (action === 'volume') {
              if (params.level !== undefined && onSetVolume) onSetVolume(params.level);
            } else if (action === 'avatar_jump' || action === 'avatar_dance' || action === 'avatar_wave') {
              const gesture = action.replace('avatar_', '');
              if (typeof window !== 'undefined' && typeof window.__loopraPlayGesture === 'function') {
                window.__loopraPlayGesture(gesture, 2500);
              }
            }

            voiceBuddyService.speak(chatRes.reply);
            showToast?.(chatRes.reply);
            voiceSessionService.notifyExecutionFinish(chatRes.reply);
            return;
          }
        }
      } catch (err) {
        console.warn('[VoiceAgent] Shared ChatBuddy API notice:', err.message);
      }
    }

    if (steps.length === 0) {
      voiceSessionService.notifyExecutionFinish('Command not recognized.');
      const retryReply = voiceBuddyService.generateFriendReply(text, 'Samajh nahi aaya, ek baar fir se boliye!');
      voiceBuddyService.speak(retryReply);
      return;
    }

    // Single Clarification Step: directly speak prompt without executing pipeline
    if (steps.length === 1 && (steps[0].action === 'clarify' || steps[0].type === 'clarify')) {
      const clarifyPrompt = steps[0].speechResponse || 'Which song would you like to play?';
      voiceBuddyService.speak(clarifyPrompt);
      showToast?.(clarifyPrompt, 'info');
      voiceSessionService.notifyExecutionFinish(clarifyPrompt);
      return;
    }

    const navStep = steps.find(s => s.type === 'navigation' || s.action === 'navigate_page');
    let hasWalked = false;

    if (navStep && typeof window !== 'undefined' && typeof window.__loopraWalkAndTap === 'function') {
      const targetId = navStep.target || 'home';
      hasWalked = true;
      await window.__loopraWalkAndTap(targetId, targetId);
      if (onNavigate) onNavigate(targetId);
    }

    const execLabel = `Executing ${steps.length} action${steps.length > 1 ? 's' : ''}...`;
    voiceSessionService.notifyExecutionStart(execLabel);
    setActiveActionLabel(execLabel);
    if (typeof window !== 'undefined') {
      window.__loopraSetAvatarExecuting?.(true);
    }

    try {
      const pipelineResult = await executeTaskPipeline(steps, persistentContextRef.current, {
        onPlayTrack,
        onTogglePlayPause,
        onNextTrack,
        onPrevTrack,
        onToggleShuffle,
        onToggleRepeat,
        onSetVolume,
        onToggleLike,
        onRemoveFromFavorites,
        onAddToPlaylist,
        onCreatePlaylist,
        onOpenPlaylistByName,
        onPlayPlaylist,
        onPlayRadioStation,
        onPlayFromHistory,
        onRemoveHistoryItem,
        onClearHistory,
        onAddToQueue,
        onNavigate,
        onOpenInsights,
        onOpenQueue,
        onOpenLyrics,
        onOpenListeningRooms,
        onOpenSimilarSongs,
        onOpenPlayerSettings,
        onOpenSleepTimer,
        onOpenCanvas,
        onOpenProfile,
        onOpenRatingModal,
        onSetPlaybackSpeed,
        onDjAction,
        onGoBack,
        onOpenArtist,
        searchCatalog
      });

      if (pipelineResult.confirmationRequired) {
        pendingConfirmationStepRef.current = pipelineResult.pendingStep;
        voiceBuddyService.speak(pipelineResult.confirmationPrompt);
        showToast?.(pipelineResult.confirmationPrompt, 'warning');
        voiceSessionService.notifyExecutionFinish(pipelineResult.confirmationPrompt);
        return;
      }

      if (pipelineResult.clarificationRequired) {
        const clarifyMsg = pipelineResult.message || 'Which song would you like to play?';
        voiceBuddyService.speak(clarifyMsg);
        showToast?.(clarifyMsg, 'info');
        voiceSessionService.notifyExecutionFinish(clarifyMsg);
        return;
      }

      if (pipelineResult.taskContext) {
        persistentContextRef.current = pipelineResult.taskContext;
      }

      // Sanitize user-facing speech: Never speak generic "executed" labels; name the actual action
      let cleanMessage = pipelineResult.message;
      if (/executed\s*(clarif|action|none|unknown)/i.test(cleanMessage || '')) {
        const lastCompleted = pipelineResult.completedSteps?.[0]?.result?.description;
        cleanMessage = lastCompleted || (currentSong?.title ? `"${currentSong.title}" play kar diya hai. Enjoy!` : 'Music play kar diya hai.');
      }

      const friendVoiceReply = voiceBuddyService.generateFriendReply(text, cleanMessage);
      voiceBuddyService.speak(friendVoiceReply);
      chatBuddyClient.addHistory('user', text);
      chatBuddyClient.addHistory('model', friendVoiceReply);

      if (pipelineResult.success) {
        showToast?.(pipelineResult.message);
        voiceSessionService.notifyExecutionFinish(pipelineResult.message);
      } else {
        showToast?.(pipelineResult.message, 'error');
        voiceSessionService.notifyExecutionFinish(pipelineResult.message);
      }
    } catch (err) {
      console.error('[VoiceAgent] Execution error:', err);
      const errorReply = voiceBuddyService.generateFriendReply(text, 'Action perform nahi ho paya, fir se koshish karein.');
      voiceBuddyService.speak(errorReply);
      voiceSessionService.notifyExecutionFinish('Execution failed.');
    } finally {
      if (typeof window !== 'undefined') {
        window.__loopraSetAvatarExecuting?.(false);
        window.__loopraSetAvatarThinking?.(false);
      }
      setTimeout(() => {
        setActiveActionLabel('');
      }, 2000);
    }
  }, [
    onPlayTrack,
    onTogglePlayPause,
    onNextTrack,
    onPrevTrack,
    onToggleShuffle,
    onToggleRepeat,
    onSetVolume,
    onToggleLike,
    onAddToPlaylist,
    onNavigate,
    onOpenInsights,
    onOpenQueue,
    onOpenLyrics,
    onGoBack,
    onOpenArtist,
    searchCatalog,
    showToast,
    isPlaying,
    volume,
    currentSong
  ]);

  // 3B. Direct Multimodal Audio Processor (Gemini Native Audio API)
  const handleProcessAudio = useCallback(async ({ audioData, mimeType, fallbackTranscript = '' }) => {
    if (!audioData) {
      if (fallbackTranscript) return handleProcessUtterance(fallbackTranscript);
      return;
    }

    voiceSessionService.notifyExecutionStart('Interpreting with Gemini Audio...');
    setActiveActionLabel('Interpreting with Gemini Audio...');

    try {
      const cleanUrl = (backendUrl || '').replace(/\/+$/, '');
      const authToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '') || '';
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`${cleanUrl}/api/voice-agent/recognize-audio`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          audioData,
          mimeType: mimeType || 'audio/webm',
          currentTrack: currentSong || persistentContextRef.current.currentSong,
          activeTab: activeTab || persistentContextRef.current.activeTab || 'home',
          history: []
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.transcript) {
            setTranscript(data.transcript);
          }

          if (data.clarification_required && data.clarification_question) {
            voiceSessionService.notifyExecutionFinish();
            voiceBuddyService.speak(data.clarification_question);
            showToast?.(data.clarification_question, 'info');
            return;
          }

          if (Array.isArray(data.steps) && data.steps.length > 0) {
            // Direct Recap & Stats
            if (data.steps.length === 1 && data.steps[0].action === 'open_insights') {
              if (onOpenInsights) onOpenInsights();
              const reply = data.speechResponse || 'Opening your Recap & Stats';
              voiceBuddyService.speak(reply);
              showToast?.('Opening Recap & Stats');
              voiceSessionService.notifyExecutionFinish('Opened Recap & Stats');
              return;
            }

            // Start spoken confirmation concurrently
            if (data.speechResponse) {
              voiceBuddyService.speak(data.speechResponse);
            }

            await executeTaskPipeline(data.steps, persistentContextRef.current, {
              onPlayTrack,
              onTogglePlayPause,
              onNextTrack,
              onPrevTrack,
              onToggleShuffle,
              onToggleRepeat,
              onSetVolume,
              onToggleLike,
              onAddToPlaylist,
              onNavigate,
              onOpenInsights,
              onOpenQueue,
              onOpenLyrics,
              onOpenListeningRooms,
              onOpenSimilarSongs,
              onOpenPlayerSettings,
              onOpenSleepTimer,
              onOpenCanvas,
              onOpenProfile,
              onOpenRatingModal,
              onSetPlaybackSpeed,
              onDjAction,
              onGoBack,
              onOpenArtist,
              showToast,
              searchCatalog
            });

            voiceSessionService.notifyExecutionFinish(data.speechResponse || 'Done!');
            return;
          }
        }
      }
    } catch (audioErr) {
      console.warn('[VoiceAgent] Gemini Audio recognize notice:', audioErr.message);
    }

    // Fallback to text utterance processor if audio endpoint was unavailable
    if (fallbackTranscript) {
      return handleProcessUtterance(fallbackTranscript);
    }
    voiceSessionService.notifyExecutionFinish();
  }, [
    backendUrl,
    token,
    currentSong,
    activeTab,
    onOpenInsights,
    onPlayTrack,
    onTogglePlayPause,
    onNextTrack,
    onPrevTrack,
    onToggleShuffle,
    onToggleRepeat,
    onSetVolume,
    onToggleLike,
    onAddToPlaylist,
    onNavigate,
    onOpenQueue,
    onOpenLyrics,
    onGoBack,
    onOpenArtist,
    showToast,
    searchCatalog,
    handleProcessUtterance
  ]);

  // Expose command processor for debug and test automation
  useEffect(() => {
    window.__loopraExecuteVoiceCommand = handleProcessUtterance;
    window.__loopraExecuteAudioCommand = handleProcessAudio;
    return () => {
      delete window.__loopraExecuteVoiceCommand;
      delete window.__loopraExecuteAudioCommand;
    };
  }, [handleProcessUtterance, handleProcessAudio]);

  // 4. Synchronize music playback status with Voice Buddy to auto-suppress TTS during songs
  useEffect(() => {
    try {
      if (typeof voiceBuddyService?.setPlaybackActive === 'function') {
        voiceBuddyService.setPlaybackActive(isPlaying);
      } else if (voiceBuddyService) {
        voiceBuddyService.isPlaybackActive = !!isPlaying;
      }
    } catch (_) { }
    if (typeof window !== 'undefined') {
      window.__loopraIsMusicPlaying = !!isPlaying;
    }
  }, [isPlaying]);

  // Keep latest utterance handler in ref
  useEffect(() => {
    handleProcessUtteranceRef.current = handleProcessUtterance;
  }, [handleProcessUtterance]);

  // 5. Subscribe to the Voice Session Controller (stable single subscription)
  useEffect(() => {
    const unsub = voiceSessionService.subscribe((snapshot) => {
      setSessionState(snapshot.state);
      setIsSessionActive(snapshot.isSessionActive);
      setIsListening(snapshot.isListening);
      if (snapshot.statusMessage) setStatusMessage(snapshot.statusMessage);
      if (snapshot.volumeScale !== undefined) setVoiceVolumeScale(snapshot.volumeScale);
      if (snapshot.interimText !== undefined) setInterimText(snapshot.interimText);

      // Finalized transcript received from recognition engine
      if (snapshot.event === 'final_transcript' && snapshot.transcript) {
        if (snapshot.initiator === 'ai_companion') {
          // Handled directly by AI Companion drawer; ignore here to prevent duplicate execution
          return;
        }
        setTranscript(snapshot.transcript);
        handleProcessUtteranceRef.current?.(snapshot.transcript);
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // Clean deactivation on unmount
  useEffect(() => {
    return () => {
      if (voiceSessionService.isSessionActive) {
        voiceSessionService.stopSession('unmount');
      }
    };
  }, []);

  // 5. Manual Start / Stop (Controls Voice Mode)
  const handleToggleVoiceMode = async () => {
    if (voiceSessionService.isSessionActive) {
      voiceSessionService.stopSession('manual');
      voiceBuddyService.speak('Byeee');
      showToast?.('Voice Agent: OFF');
    } else {
      showToast?.('Voice Agent: Listening...');
      // Zero-delay instant mic session activation with bilingual Hindi/Hinglish/English support
      await voiceSessionService.startSession({ lang: 'hi-IN' });
    }
  };

  if (typeof document === 'undefined') return null;

  // Expose centralized command execution pipeline globally for unified assistant use
  useEffect(() => {
    window.__loopraProcessCommand = handleProcessUtterance;
    return () => {
      delete window.__loopraProcessCommand;
    };
  }, [handleProcessUtterance]);

  // =========================================================================
  // LOOPRA AVATAR DELAYED APPEARANCE & PERSISTENT MOUNT MANAGEMENT
  // 1. Never mount or render avatar during splash screen or when Voice Control is OFF.
  // 2. Start 2-second delay only after splash screen completely finishes, app is initialized, and Voice Control is ON.
  // 3. Smooth fade-out and unmount when Voice Control is switched OFF by admin.
  // =========================================================================
  const [hasMountedAvatar, setHasMountedAvatar] = useState(false);
  const [initialDelayDone, setInitialDelayDone] = useState(false);
  const initialDelayTimerRef = useRef(null);
  const unmountTimerRef = useRef(null);
  const prevIsAvatarVisibleRef = useRef(isAvatarVisible);

  // Mount avatar only after splash screen has completely closed, app initialized, AND hasAccess is granted!
  useEffect(() => {
    if (!showSplashScreen && isAppInitialized && !hasMountedAvatar && hasAccess) {
      setHasMountedAvatar(true);
    }
  }, [showSplashScreen, isAppInitialized, hasAccess, hasMountedAvatar]);

  // Handle the 2-second delay AFTER homepage loading completes AND hasAccess is granted
  useEffect(() => {
    // Never start the timer while splash screen is active or before app initialization or without access
    if (showSplashScreen || !isAppInitialized || initialDelayDone) {
      return;
    }
    if (!hasAccess) {
      return;
    }

    // Start 2-second delay AFTER homepage loading is complete and voice control allowed
    initialDelayTimerRef.current = setTimeout(() => {
      setInitialDelayDone(true);
    }, 2000);

    return () => {
      if (initialDelayTimerRef.current) {
        clearTimeout(initialDelayTimerRef.current);
        initialDelayTimerRef.current = null;
      }
    };
  }, [showSplashScreen, isAppInitialized, hasAccess, initialDelayDone]);

  // Immediate smooth fade-out and unmount when access is revoked by admin
  useEffect(() => {
    if (!hasAccess) {
      setInitialDelayDone(false);
      // Allow 400ms for smooth fade-out animation before fully removing from DOM
      unmountTimerRef.current = setTimeout(() => {
        setHasMountedAvatar(false);
      }, 400);
      return () => {
        if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
      };
    }
  }, [hasAccess]);

  // Respect manual user toggles:
  // If user explicitly turns on avatar before 2s delay completes, reveal immediately.
  // If user explicitly turns off avatar, cancel delay timer.
  useEffect(() => {
    if (!prevIsAvatarVisibleRef.current && isAvatarVisible && !initialDelayDone && !showSplashScreen && isAppInitialized && hasAccess) {
      if (initialDelayTimerRef.current) {
        clearTimeout(initialDelayTimerRef.current);
        initialDelayTimerRef.current = null;
      }
      setInitialDelayDone(true);
    }
    if (!isAvatarVisible && initialDelayTimerRef.current) {
      clearTimeout(initialDelayTimerRef.current);
      initialDelayTimerRef.current = null;
    }
    prevIsAvatarVisibleRef.current = isAvatarVisible;
  }, [isAvatarVisible, initialDelayDone, showSplashScreen, isAppInitialized, hasAccess]);

  // Cleanup timers on component unmount
  useEffect(() => {
    return () => {
      if (initialDelayTimerRef.current) {
        clearTimeout(initialDelayTimerRef.current);
        initialDelayTimerRef.current = null;
      }
      if (unmountTimerRef.current) {
        clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
    };
  }, []);

  // Determine whether avatar should be visually active
  const isTargetVisible = Boolean(
    hasMountedAvatar &&
    !showSplashScreen &&
    isAppInitialized &&
    initialDelayDone &&
    isAvatarVisible &&
    hasAccess
  );

  // Responsive button bottom offset
  const buttonBottomOffset = isBottomPlayerVisible
    ? (isMobile ? 'calc(136px + env(safe-area-inset-bottom, 0px))' : '88px')
    : (isMobile ? 'calc(70px + env(safe-area-inset-bottom, 0px))' : '24px');

  return ReactDOM.createPortal(
    <>
      {/* ============================================================= */}
      {/* 1. LOOPRA MOVABLE AI COMPANION AVATAR (Persistent)            */}
      {/* ============================================================= */}
      {hasMountedAvatar && hasAccess && (
        <div
          className="loopra-character-dock-container pointer-events-auto"
          style={{
            '--ai-button-bottom': buttonBottomOffset
          }}
        >
          <CharacterBuddy
            isSessionActive={isSessionActive}
            isListening={isListening}
            isPlaying={isPlaying}
            sessionState={sessionState}
            voiceVolumeScale={voiceVolumeScale}
            onToggleVoiceMode={handleToggleVoiceMode}
            onToggleChat={onToggleAi}
            onCloseAvatar={() => onToggleAvatar?.(false)}
            isBottomPlayerVisible={isBottomPlayerVisible}
            isVisible={isTargetVisible}
          />
        </div>
      )}
    </>,
    document.body
  );
}
