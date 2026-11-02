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
  executeTaskPipeline
} from '../../services/voiceTaskEngine';
import { voiceBuddyService } from '../../services/voiceBuddyService';
import { parseCommandToAction, INTENT_CATEGORIES } from '../../services/commandActionEngine';
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

    // A. Check for deactivation commands (e.g. "stop listening", "done loopra")
    const singleParse = parseVoiceCommandLocally(text, persistentContextRef.current);
    if (singleParse && singleParse.action === 'stop_continuous') {
      voiceSessionService.stopSession('manual');
      const byeReply = voiceBuddyService.generateFriendReply('pause', 'Voice session stopped');
      voiceBuddyService.speak(byeReply);
      showToast?.('Voice session stopped');
      return;
    }

    // B. Fast Command-to-Action Engine (Checks Registry, Intent, and Safety Gates)
    const directAction = parseCommandToAction(text, persistentContextRef.current);

    if (directAction) {
      // 1. OPEN_PAGE: Strictly navigates to the registered page/station (e.g. Saloon FM, Horn Ok Please, Theka)
      if (directAction.intent === INTENT_CATEGORIES.OPEN_PAGE) {
        const targetId = directAction.target;
        const targetName = directAction.item?.name || targetId;

        // Animate 3D physical character walking/running to the element
        if (typeof window !== 'undefined' && typeof window.__loopraWalkAndTap === 'function') {
          window.__loopraWalkAndTap(targetId, targetName, () => {
            if (onNavigate) onNavigate(targetId);
          });
        } else if (onNavigate) {
          onNavigate(targetId);
        }

        const reply = voiceBuddyService.generateFriendReply('navigate_page', { target: targetId });
        voiceBuddyService.speak(reply);
        showToast?.(`Opening ${targetName}`);
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
        if (onToggleLike && currentSong) onToggleLike(currentSong);
        const reply = voiceBuddyService.generateFriendReply('like');
        voiceBuddyService.speak(reply);
        showToast?.('Added to Liked Songs');
        return;
      }
    }

    // C. Multi-Step Task Pipeline Fallback (for complex compound chains)
    const steps = parseMultiStepInstruction(text, persistentContextRef.current);

    if (steps.length === 0) {
      voiceSessionService.notifyExecutionFinish('Command not recognized.');
      const retryReply = voiceBuddyService.generateFriendReply(text, 'Samajh nahi aaya, ek baar fir se boliye!');
      voiceBuddyService.speak(retryReply);
      return;
    }

    const navStep = steps.find(s => s.type === 'navigation' || s.action === 'navigate_page');
    let hasWalked = false;

    if (navStep && typeof window !== 'undefined' && typeof window.__loopraWalkAndTap === 'function') {
      const targetId = navStep.target || 'home';
      hasWalked = true;
      window.__loopraWalkAndTap(targetId, targetId, () => {
        if (onNavigate) onNavigate(targetId);
      });
    }

    const execLabel = `Executing ${steps.length} action${steps.length > 1 ? 's' : ''}...`;
    voiceSessionService.notifyExecutionStart(execLabel);
    setActiveActionLabel(execLabel);

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
        onAddToPlaylist,
        onNavigate: hasWalked ? undefined : onNavigate,
        onOpenInsights,
        onOpenQueue,
        onOpenLyrics,
        onGoBack,
        onOpenArtist,
        searchCatalog
      });

      if (pipelineResult.taskContext) {
        persistentContextRef.current = pipelineResult.taskContext;
      }

      const friendVoiceReply = voiceBuddyService.generateFriendReply(text, pipelineResult.message);
      voiceBuddyService.speak(friendVoiceReply);

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

  // Expose command processor for debug and test automation
  useEffect(() => {
    window.__loopraExecuteVoiceCommand = handleProcessUtterance;
    return () => {
      delete window.__loopraExecuteVoiceCommand;
    };
  }, [handleProcessUtterance]);

  // 4. Synchronize music playback status with Voice Buddy to auto-suppress TTS during songs
  useEffect(() => {
    voiceBuddyService.setPlaybackActive(isPlaying);
    if (typeof window !== 'undefined') {
      window.__loopraIsMusicPlaying = !!isPlaying;
    }
  }, [isPlaying]);

  // 5. Subscribe to the Voice Session Controller
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
        setTranscript(snapshot.transcript);
        handleProcessUtterance(snapshot.transcript);
      }
    });

    return () => {
      unsub();
    };
  }, [handleProcessUtterance]);

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
      const stopReply = voiceBuddyService.generateFriendReply('pause', 'Voice session paused');
      voiceBuddyService.speak(stopReply);
      showToast?.('Voice Agent: OFF');
    } else {
      showToast?.('Voice Agent: ON (Listening)');
      await voiceSessionService.startSession({ lang: 'en-IN' });
      const activeChar = voiceBuddyService.getActiveCharacter();
      const isMale = activeChar.gender === 'male';
      const startGreeting = isMale
        ? 'Bilkul! Loopra ready hai, bataiye kya sunna hai?'
        : 'Haan bilkul! Loopra ready hai, batao kya play karun?';
      voiceBuddyService.speak(startGreeting);
    }
  };

  if (typeof document === 'undefined') return null;

  // Responsive button bottom offset
  const buttonBottomOffset = isBottomPlayerVisible
    ? (isMobile ? 'calc(136px + env(safe-area-inset-bottom, 0px))' : '88px')
    : (isMobile ? 'calc(70px + env(safe-area-inset-bottom, 0px))' : '24px');

  return ReactDOM.createPortal(
    <>
      {/* ============================================================= */}
      {/* 1. LOOPRA 3D HUMANOID COMPANION (Below Navbar on Content Area) */}
      {/* ============================================================= */}
      {hasAccess && (
        <div className="loopra-character-dock-container pointer-events-auto">
          <CharacterBuddy
            isSessionActive={isSessionActive}
            isListening={isListening}
            isPlaying={isPlaying}
            sessionState={sessionState}
            voiceVolumeScale={voiceVolumeScale}
            userTranscript={transcript}
            interimTranscript={interimText}
            statusMessage={statusMessage}
            onToggleVoiceMode={handleToggleVoiceMode}
            onSubmitTextCommand={handleProcessUtterance}
          />
        </div>
      )}

      {/* ============================================================= */}
      {/* 2. FLOATING AI ASSISTANT SHORTCUT (Bottom Right)              */}
      {/* ============================================================= */}
      <div
        className="loopra-floating-assistants-bar flex flex-col items-center justify-end w-auto h-auto pointer-events-auto z-[99999]"
        style={{
          '--ai-button-bottom': buttonBottomOffset,
          height: 'auto'
        }}
      >
        <button
          type="button"
          onClick={onToggleAi}
          className={`ai-assistant-floating-button group relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl active:scale-95 cursor-pointer pointer-events-auto transition-colors duration-150 ${
            isAiOpen
              ? 'bg-amber-500 text-black shadow-amber-500/40'
              : 'bg-neutral-900/95 text-amber-400 hover:text-white border border-amber-500/40 hover:border-amber-400 shadow-amber-500/20 backdrop-blur-2xl'
          }`}
          aria-label="Toggle Loopra AI Music Companion"
          title="Loopra AI Assistant"
        >
          {isAiOpen ? (
            <svg className="w-6 h-6 pointer-events-none transition-transform duration-200 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <div className="relative flex items-center justify-center pointer-events-none">
              <span className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-amber-500/40 via-orange-500/30 to-amber-500/40 blur-sm animate-pulse" />
              <div className="relative flex items-end gap-1 h-5 px-1">
                <span className={`w-1 bg-amber-400 rounded-full transition-all duration-300 ${isPlaying ? 'h-5 animate-pulse' : 'h-3'}`} />
                <span className={`w-1 bg-amber-300 rounded-full transition-all duration-300 ${isPlaying ? 'h-3 animate-ping' : 'h-4'}`} />
                <span className={`w-1 bg-amber-400 rounded-full transition-all duration-300 ${isPlaying ? 'h-4 animate-pulse' : 'h-2'}`} />
              </div>
            </div>
          )}

          {!isAiOpen && (
            <span className="absolute right-16 top-1/2 -translate-y-1/2 hidden md:group-hover:inline-block px-3 py-1.5 bg-neutral-900/95 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none backdrop-blur-md">
              Loopra AI • Music Companion
            </span>
          )}
        </button>
      </div>
    </>,
    document.body
  );
}
