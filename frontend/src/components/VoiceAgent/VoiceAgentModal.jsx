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

    // B. Compound Sentence Check:
    // If the instruction contains multiple distinct clauses (e.g. "Open liked songs and remove this song"),
    // pass directly to Multi-Step Pipeline so each independent action is executed sequentially.
    const clauses = splitVoiceInstructionIntoClauses(text);
    const isCompound = clauses.length > 1;

    if (!isCompound) {
      const directAction = parseCommandToAction(text, persistentContextRef.current);

      if (directAction && directAction.intent !== INTENT_CATEGORIES.GENERAL_QUESTION) {
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

    // D. If local parser could not determine steps, delegate to Backend Gemini API
    if (steps.length === 0) {
      try {
        const cleanUrl = (backendUrl || '').replace(/\/+$/, '');
        const authToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const res = await fetch(`${cleanUrl}/api/voice-agent/parse-intent`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            utterance: text,
            currentTrack: currentSong || persistentContextRef.current.currentSong,
            activeTab: activeTab || persistentContextRef.current.activeTab || 'home'
          })
        });

        if (res.ok) {
          const aiData = await res.json();
          if (aiData.success && Array.isArray(aiData.steps) && aiData.steps.length > 0) {
            steps = aiData.steps;
          }
        }
      } catch (geminiErr) {
        console.warn('[VoiceAgent] Gemini API fallback notice:', geminiErr.message);
      }
    }

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
    } catch (_) {}
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

      // Native audio packet from Gemini speech recognition pipeline
      if (snapshot.event === 'audio_command' && snapshot.audioData) {
        handleProcessAudio({
          audioData: snapshot.audioData,
          mimeType: snapshot.mimeType,
          fallbackTranscript: snapshot.transcript
        });
      }
      // Finalized transcript received from recognition engine
      else if (snapshot.event === 'final_transcript' && snapshot.transcript) {
        setTranscript(snapshot.transcript);
        handleProcessUtterance(snapshot.transcript);
      }
    });

    return () => {
      unsub();
    };
  }, [handleProcessUtterance, handleProcessAudio]);

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
      voiceBuddyService.speak('Haan bilkul! Loopra ready hai, batao kya play karun?');
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

  // Responsive button bottom offset
  const buttonBottomOffset = isBottomPlayerVisible
    ? (isMobile ? 'calc(136px + env(safe-area-inset-bottom, 0px))' : '88px')
    : (isMobile ? 'calc(70px + env(safe-area-inset-bottom, 0px))' : '24px');

  return ReactDOM.createPortal(
    <>
      {/* ============================================================= */}
      {/* 1. LOOPRA UNIFIED AI COMPANION AVATAR (Persistent throughout) */}
      {/* ============================================================= */}
      {hasAccess && (
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
          />
        </div>
      )}
    </>,
    document.body
  );
}
