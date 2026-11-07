import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { aiMusicCompanionClient } from '../../services/aiMusicCompanionClient';
import { voiceControlService } from '../../services/voiceControlService';
import { voiceBuddyService } from '../../services/voiceBuddyService';
import { voiceSessionService, SESSION_STATES } from '../../services/voiceSessionService';
import { parseCommandToAction, INTENT_CATEGORIES } from '../../services/commandActionEngine';
import {
  splitVoiceInstructionIntoClauses,
  parseMultiStepInstruction,
  executeTaskPipeline
} from '../../services/voiceTaskEngine';
import { chatBuddyLearningClient } from '../../services/chatBuddyLearningService';
import { chatBuddyClient } from '../../services/chatBuddyClient';
import { Volume2, VolumeX, ChevronDown, ChevronUp, MessageSquare, X, Play, Pause, SkipForward, SkipBack } from 'lucide-react';

const STORAGE_KEY_DESKTOP = 'loopra_ai_chat_dims_desktop';
const STORAGE_KEY_MOBILE = 'loopra_ai_chat_dims_mobile';

const DEFAULT_DESKTOP_WIDTH = 420; // 400-440px
const DEFAULT_DESKTOP_HEIGHT = 580; // 550-620px

const getViewportInfo = () => {
  if (typeof window === 'undefined') {
    return { width: 1200, height: 800, isMobile: false };
  }
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth);
  const vh = Math.round(vv ? vv.height : window.innerHeight);
  const isMobile = window.innerWidth <= 768;
  return { width: vw, height: vh, isMobile };
};

const getDefaultDimensions = (isMobile, vp) => {
  if (isMobile) {
    // Mobile: 85-90% width (approx 88%), 55-65% height (approx 60%)
    const targetW = Math.round(vp.width * 0.88);
    const targetH = Math.round(vp.height * 0.60);
    const maxW = Math.max(260, vp.width - 24);
    const maxH = Math.max(260, vp.height - 96);
    return {
      width: Math.min(targetW, maxW),
      height: Math.min(targetH, maxH),
    };
  }
  // Desktop/Laptop: 400-440px width (420px), 550-620px height (580px)
  const maxW = Math.max(340, vp.width - 48);
  const maxH = Math.max(380, vp.height - 110);
  return {
    width: Math.min(DEFAULT_DESKTOP_WIDTH, maxW),
    height: Math.min(DEFAULT_DESKTOP_HEIGHT, maxH),
  };
};

const loadSavedDimensions = () => {
  const vp = getViewportInfo();
  const key = vp.isMobile ? STORAGE_KEY_MOBILE : STORAGE_KEY_DESKTOP;
  const defaults = getDefaultDimensions(vp.isMobile, vp);

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.width === 'number' &&
        typeof parsed.height === 'number' &&
        parsed.width >= (vp.isMobile ? 240 : 300) &&
        parsed.height >= (vp.isMobile ? 220 : 340)
      ) {
        const rightOffset = vp.isMobile ? 16 : 24;
        const bottomOffset = vp.isMobile ? 96 : 92;
        const maxW = Math.max(260, vp.width - rightOffset - 12);
        const maxH = Math.max(240, vp.height - bottomOffset - 12);

        // Clamp to current viewport
        return {
          width: Math.min(Math.max(vp.isMobile ? 240 : 300, Math.round(parsed.width)), maxW),
          height: Math.min(Math.max(vp.isMobile ? 220 : 340, Math.round(parsed.height)), maxH)
        };
      }
    }
  } catch (e) {}

  return defaults;
};

export default function LoopraAiCompanion({
  backendUrl,
  authToken,
  user,
  currentSong,
  isPlaying,
  playbackPosition,
  duration,
  onPlayTrack,
  onTogglePlayPause,
  onNextTrack,
  onPrevTrack,
  onToggleShuffle,
  onToggleRepeat,
  onSetVolume,
  onToggleLike,
  isLiked,
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
  isBottomPlayerVisible = false,
  isOpen: controlledIsOpen,
  onToggleOpen,
  onClose,
  hideFloatingButton = false
}) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : uncontrolledIsOpen;

  // Voice Output (TTS) & Drawer States
  const [isVoiceOutputEnabled, setIsVoiceOutputEnabled] = useState(() => voiceBuddyService.isVoiceOutputEnabled);
  const [showVoiceControls, setShowVoiceControls] = useState(false);

  // Avatar Mute State synchronized across components & localStorage
  const [isAvatarMuted, setIsAvatarMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('loopra_avatar_muted') === 'true';
      } catch (_) {}
    }
    return false;
  });

  const toggleAvatarMute = useCallback((e) => {
    e?.stopPropagation?.();
    setIsAvatarMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('loopra_avatar_muted', String(next));
        window.dispatchEvent(new CustomEvent('loopra:avatar-mute-change', { detail: { isMuted: next } }));
      } catch (_) {}
      if (next && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (showToast) {
        showToast(next ? 'Avatar Voice: Muted' : 'Avatar Voice: Unmuted');
      }
      return next;
    });
  }, [showToast]);

  useEffect(() => {
    const handleMuteChange = (e) => {
      if (e?.detail?.isMuted !== undefined) {
        setIsAvatarMuted(Boolean(e.detail.isMuted));
      }
    };
    window.addEventListener('loopra:avatar-mute-change', handleMuteChange);
    return () => window.removeEventListener('loopra:avatar-mute-change', handleMuteChange);
  }, []);

  useEffect(() => {
    const unsub = voiceBuddyService.subscribe(({ event, enabled }) => {
      if (event === 'voice_output_change') {
        setIsVoiceOutputEnabled(enabled !== undefined ? enabled : voiceBuddyService.isVoiceOutputEnabled);
      }
    });
    return unsub;
  }, []);

  const handleToggleVoiceOutput = (e) => {
    e?.stopPropagation?.();
    const newState = voiceBuddyService.toggleVoiceOutput();
    setIsVoiceOutputEnabled(newState);
    if (showToast) showToast(newState ? 'Voice output: ON (Loopra speaks)' : 'Voice output: OFF (Silent text)');
  };

  const handleTestVoice = () => {
    voiceBuddyService.speak('Namaste! Main Loopra hoon, aapki AI music dost. Main Hindi aur English dono bolti hoon.');
    if (showToast) showToast('Testing Loopra Indian voice...');
  };

  const handleTestGesture = (gesture, dur = 1500) => {
    if (typeof window !== 'undefined' && typeof window.__loopraPlayGesture === 'function') {
      window.__loopraPlayGesture(gesture, dur);
      if (showToast) showToast(`Avatar: ${gesture.charAt(0).toUpperCase() + gesture.slice(1)}`);
    }
  };

  const [hasVoiceAccess, setHasVoiceAccess] = useState(() => {
    try {
      const state = voiceControlService.getAccessState();
      return user ? voiceControlService.evaluateLocalAccess(state, user) : Boolean(state.allowed);
    } catch (_) {
      return true;
    }
  });

  useEffect(() => {
    const unsub = voiceControlService.subscribe((state) => {
      const allowed = user ? voiceControlService.evaluateLocalAccess(state, user) : Boolean(state.allowed);
      setHasVoiceAccess(allowed);
    });
    return unsub;
  }, [user]);

  const handleButtonClick = () => {
    if (isControlled) {
      onToggleOpen?.(!isOpen);
    } else {
      setUncontrolledIsOpen(prev => !prev);
    }
  };

  const handlePanelClose = () => {
    if (isControlled) {
      onClose?.();
    } else {
      setUncontrolledIsOpen(false);
    }
  };

  const [dimensions, setDimensions] = useState(loadSavedDimensions);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [isResizing, setIsResizing] = useState(false);

  // Realtime Avatar Position tracking for positioning chatbox strictly to the left of the avatar
  const [avatarDockInfo, setAvatarDockInfo] = useState(() => {
    if (typeof window !== 'undefined' && window.__loopraAvatarPosition) {
      return window.__loopraAvatarPosition;
    }
    return null;
  });

  useEffect(() => {
    const handleAvatarPos = (e) => {
      if (e.detail) setAvatarDockInfo(e.detail);
    };
    window.addEventListener('loopra:avatar-position', handleAvatarPos);
    return () => window.removeEventListener('loopra:avatar-position', handleAvatarPos);
  }, []);

  // Compute chatbox panel right offset strictly to the left of the character
  const chatPanelRightOffset = useMemo(() => {
    if (typeof window === 'undefined') return 'calc(200px + 32px)';
    const isMob = window.innerWidth <= 768;
    if (isMob) return '12px';
    if (avatarDockInfo && typeof avatarDockInfo.x === 'number') {
      // Anchored strictly to the left of the character with 16px separation
      const calculated = Math.max(16, window.innerWidth - avatarDockInfo.x + 16);
      return `${calculated}px`;
    }
    return 'calc(200px + 32px)';
  }, [avatarDockInfo]);

  // Expose chatbox close trigger globally if needed by other non-avatar components
  useEffect(() => {
    window.__loopraCloseChatbox = handlePanelClose;
    return () => {
      delete window.__loopraCloseChatbox;
    };
  }, [isControlled, onClose]);

  // Close chatbox immediately when user taps anywhere on screen outside the chatbox
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalTapToClose = (e) => {
      // Don't close if tapping inside the chat panel
      const panel = document.querySelector('.ai-assistant-chat-panel');
      if (panel && panel.contains(e.target)) return;
      // Don't close if tapping the toggle button itself (toggle button handles its own state switch)
      const toggleBtn = document.getElementById('loopra-ai-chat-toggle-button');
      if (toggleBtn && toggleBtn.contains(e.target)) return;
      // Don't close if tapping mobile nav toggle button
      const navBtn = e.target.closest?.('[data-nav-ai-toggle]');
      if (navBtn) return;
      // Don't close if tapping the 3D character avatar
      const avatarWalker = document.getElementById('loopra-3d-character-walker');
      if (avatarWalker && avatarWalker.contains(e.target)) return;

      handlePanelClose();
    };

    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleGlobalTapToClose, true);
    }, 150);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleGlobalTapToClose, true);
    };
  }, [isOpen]);

  // Dynamic clearance for bottom player and mobile navigation
  const bottomOffsets = useMemo(() => {
    const isMob = typeof window !== 'undefined' && window.innerWidth <= 768;
    const barHeight = hasVoiceAccess ? '124px' : '56px';
    if (isMob) {
      // MobileBottomNav is 56px (h-14).
      // Bottom mini player (when active) is ~64px + 8px gap.
      // Offset button safely upward away from music player and navbar
      const btnBottom = isBottomPlayerVisible
        ? 'calc(152px + env(safe-area-inset-bottom, 0px))'
        : 'calc(82px + env(safe-area-inset-bottom, 0px))';
      const panelBottom = isBottomPlayerVisible
        ? `calc(152px + ${barHeight} + 10px + env(safe-area-inset-bottom, 0px))`
        : `calc(82px + ${barHeight} + 10px + env(safe-area-inset-bottom, 0px))`;
      const maxH = isBottomPlayerVisible
        ? `calc(100dvh - ${hasVoiceAccess ? '295px' : '230px'} - env(safe-area-inset-bottom, 0px))`
        : `calc(100dvh - ${hasVoiceAccess ? '225px' : '160px'} - env(safe-area-inset-bottom, 0px))`;
      return { btnBottom, panelBottom, maxH };
    }
    // Desktop: comfortably clear bottom music player bar
    const btnBottom = isBottomPlayerVisible ? '106px' : '36px';
    const panelBottom = isBottomPlayerVisible ? `calc(106px + ${barHeight} + 12px)` : `calc(36px + ${barHeight} + 12px)`;
    const maxH = isBottomPlayerVisible ? `calc(100vh - ${hasVoiceAccess ? '250px' : '185px'})` : `calc(100vh - ${hasVoiceAccess ? '185px' : '120px'})`;
    return { btnBottom, panelBottom, maxH };
  }, [isBottomPlayerVisible, hasVoiceAccess]);

  const resizeRef = useRef({
    isResizing: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    dir: 'bl',
    pointerId: null
  });

  // Clean up legacy drag anchor persistence so it never overrides fixed positioning
  useEffect(() => {
    try {
      localStorage.removeItem('loopra_ai_companion_anchor_v2');
      localStorage.removeItem('loopra_ai_companion_anchor');
      localStorage.removeItem('loopra_ai_companion_dims');
    } catch (e) {}
  }, []);

  // Viewport resize & device orientation handling
  useEffect(() => {
    const handleViewportChange = () => {
      const vp = getViewportInfo();
      setIsMobile(prevMobile => {
        if (prevMobile !== vp.isMobile) {
          // Device profile changed (e.g. desktop window shrank to mobile size)
          setDimensions(loadSavedDimensions());
        } else {
          // Same profile: verify dimensions stay within new viewport bounds
          setDimensions(prev => {
            const rightOffset = vp.isMobile ? 16 : 24;
            const bottomOffset = vp.isMobile ? 96 : 92;
            const maxW = Math.max(260, vp.width - rightOffset - 12);
            const maxH = Math.max(240, vp.height - bottomOffset - 12);
            const minW = vp.isMobile ? 240 : 320;
            const minH = vp.isMobile ? 220 : 380;

            if (prev.width > maxW || prev.height > maxH) {
              return {
                width: Math.min(Math.max(minW, prev.width), maxW),
                height: Math.min(Math.max(minH, prev.height), maxH)
              };
            }
            return prev;
          });
        }
        return vp.isMobile;
      });
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []);

  // Chat message history (session persistence)
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('loopra_ai_chat_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 'welcome',
        role: 'model',
        text: "Hey! I'm Loopra AI, your personal music companion. Ask me about what's playing right now, request vibes for any mood, or ask for recommendations!",
        tracks: [],
        timestamp: Date.now()
      }
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [speechLang, setSpeechLang] = useState('hi-IN'); // 'hi-IN' default with 'en-IN' toggle
  const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'speaking'
  const [heardText, setHeardText] = useState('');
  const [lastAction, setLastAction] = useState('none');
  const speechCooldownTimerRef = useRef(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const chatScrollRef = useRef(null);

  // Save chat history
  useEffect(() => {
    try {
      sessionStorage.setItem('loopra_ai_chat_history', JSON.stringify(messages.slice(-25)));
    } catch (e) {}
  }, [messages]);

  // Scroll to bottom on updates
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, streamingText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (voiceSessionService.isSessionActive && voiceSessionService.initiator === 'ai_companion') {
        voiceSessionService.stopSession('unmount');
      }
    };
  }, []);

  // Strict Real-time Track Matching
  const isTrackPlaying = useCallback((track) => {
    if (!currentSong || !isPlaying) return false;
    const tId = track?.id || track?.videoId;
    const cId = currentSong?.id || currentSong?.videoId;
    return Boolean(tId && cId && tId === cId);
  }, [currentSong, isPlaying]);

  const isTrackLoaded = useCallback((track) => {
    if (!currentSong) return false;
    const tId = track?.id || track?.videoId;
    const cId = currentSong?.id || currentSong?.videoId;
    return Boolean(tId && cId && tId === cId);
  }, [currentSong]);

  // Play / Pause Click handler with exact track mapping
  const handleCardPlayPauseClick = useCallback((track) => {
    if (!track) return;

    if (isTrackPlaying(track)) {
      if (typeof onTogglePlayPause === 'function') {
        onTogglePlayPause();
      }
    } else if (isTrackLoaded(track)) {
      if (typeof onTogglePlayPause === 'function') {
        onTogglePlayPause();
      } else {
        onPlayTrack(track);
      }
    } else {
      // Ensure track object has exact verified video ID
      const targetTrack = {
        ...track,
        id: track.id || track.videoId,
        videoId: track.videoId || track.id
      };
      onPlayTrack(targetTrack);
      if (showToast) showToast(`Now playing: ${targetTrack.title}`);
    }
  }, [isTrackPlaying, isTrackLoaded, onTogglePlayPause, onPlayTrack, showToast]);

  // Current track context for AI
  const getCurrentTrackContext = useCallback(() => {
    if (!currentSong || (!currentSong.title && !currentSong.id)) return null;
    return {
      id: currentSong.id,
      videoId: currentSong.videoId || currentSong.id,
      title: currentSong.title,
      artist: currentSong.artist || currentSong.channel || 'Artist',
      album: currentSong.album || null,
      duration: duration || currentSong.duration || null,
      currentTime: playbackPosition || null,
      isPlaying: Boolean(isPlaying)
    };
  }, [currentSong, isPlaying, playbackPosition, duration]);

  // Sync speaking state with voiceBuddyService
  useEffect(() => {
    const unsub = voiceBuddyService.subscribe(({ event }) => {
      if (event === 'speech_start' || event === 'speech_pending') {
        setIsSpeaking(true);
      } else if (event === 'speech_end' || event === 'speech_text_only') {
        setIsSpeaking(false);
        speechCooldownTimerRef.current = Date.now();
      }
    });
    return unsub;
  }, []);

  // Context object for local command parsing
  const getCommandContext = useCallback(() => {
    return {
      currentSong: currentSong || null,
      lastPlayedTrack: currentSong || null,
      lastArtist: currentSong?.artist || currentSong?.channel || null,
      isPlaying: Boolean(isPlaying),
      completedSteps: []
    };
  }, [currentSong, isPlaying]);

  // Central Command & Chat Message Handler (Unifies all text, voice, and quick commands)
  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputText).trim();
    if (!text || isTyping) return;

    const userMsg = {
      id: 'usr_' + Date.now(),
      role: 'user',
      text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    setStreamingText('');

    // Only auto-close on heavy page navigations/views (e.g. settings, history, listening stats)
    // Regular conversation and music playback stay open in the chatbox
    const isMobileMode = typeof window !== 'undefined' && window.innerWidth <= 768;

    // 0. Check for Multi-Step Compound Commands (e.g. "Open Saloon FM and play a song")
    const clauses = splitVoiceInstructionIntoClauses(text);
    if (clauses.length > 1) {
      const steps = parseMultiStepInstruction(text, getCommandContext());
      if (steps && steps.length > 0) {
        try {
          if (typeof window !== 'undefined' && typeof window.__loopraRecordCommandDisplay === 'function') {
            window.__loopraRecordCommandDisplay(text, 'multi_step');
          }
          if (typeof window !== 'undefined' && typeof window.__loopraSetAvatarExecuting === 'function') {
            window.__loopraSetAvatarExecuting(true);
          }

          const pipelineResult = await executeTaskPipeline(steps, getCommandContext(), {
            onPlayTrack,
            onTogglePlayPause,
            onNextTrack,
            onPrevTrack,
            onToggleShuffle,
            onToggleRepeat,
            onSetVolume,
            onToggleLike,
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
            searchCatalog: async (query) => {
              try {
                const cleanUrl = (backendUrl || '').replace(/\/+$/, '');
                const res = await fetch(`${cleanUrl}/api/youtube/search?q=${encodeURIComponent(query)}&limit=5`);
                if (res.ok) {
                  const data = await res.json();
                  return data.items || [];
                }
              } catch (_) {}
              return [];
            }
          });

          const replyText = voiceBuddyService.generateFriendReply(text, pipelineResult.message);
          const aiMsg = {
            id: 'ai_' + Date.now(),
            role: 'model',
            text: replyText,
            tracks: [],
            timestamp: Date.now()
          };

          setMessages(prev => [...prev, aiMsg]);

          if (voiceBuddyService.isVoiceOutputEnabled && !voiceBuddyService.isMusicPlaying()) {
            voiceBuddyService.speak(replyText);
          }

          if (pipelineResult.success) {
            showToast?.(pipelineResult.message);
          }
          return;
        } catch (err) {
          console.warn('[LoopraAiCompanion] Multi-step execution error:', err);
        } finally {
          setIsTyping(false);
          if (typeof window !== 'undefined' && typeof window.__loopraSetAvatarExecuting === 'function') {
            window.__loopraSetAvatarExecuting(false);
          }
        }
      }
    }

    // 1. Evaluate against local fast Command-to-Action engine ONLY for explicit tasks (NOT general conversation)
    const directAction = parseCommandToAction(text, getCommandContext());
    if (typeof window !== 'undefined' && typeof window.__loopraRecordCommandDisplay === 'function') {
      const act = directAction && directAction.intent !== INTENT_CATEGORIES.GENERAL_QUESTION ? (directAction.action || directAction.intent) : null;
      window.__loopraRecordCommandDisplay(text, act);
    }

    if (directAction && directAction.intent !== INTENT_CATEGORIES.GENERAL_QUESTION) {
      try {
        let replyText = '';
        let actionTrack = null;

        // A. OPEN_INSIGHTS (Recap & Stats Modal)
        if (
          directAction.intent === INTENT_CATEGORIES.OPEN_INSIGHTS ||
          (directAction.intent === INTENT_CATEGORIES.OPEN_PAGE && (directAction.target === 'stats' || directAction.target === 'insights' || directAction.target === 'recap_stats'))
        ) {
          if (onOpenInsights) onOpenInsights();
          handlePanelClose();
          replyText = 'Listening Stats & Recap open kar rahi hoon...';
          chatBuddyLearningClient.recordExecution({
            userPhrase: text,
            intent: 'open_insights',
            actionType: 'OPEN_STATS',
            target: 'stats',
            handler: 'onOpenInsights',
            backendUrl,
            token: authToken
          });
        }
        // B. OPEN_PAGE (e.g. Activity, History, Saloon FM, Theka, Home, Discover)
        else if (directAction.intent === INTENT_CATEGORIES.OPEN_PAGE) {
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
          handlePanelClose();

          replyText = voiceBuddyService.generateFriendReply('navigate_page', { target: targetId });
        }
        // B. OPEN_SECTION (e.g. Trending Songs)
        else if (directAction.intent === INTENT_CATEGORIES.OPEN_SECTION) {
          if (directAction.target === 'trending_section') {
            if (onNavigate) onNavigate('home', { showAll: 'trending' });
            handlePanelClose();
            replyText = voiceBuddyService.generateFriendReply('navigate_section', { target: 'trending_section' });
          }
        }
        // C. SEARCH_SONG
        else if (directAction.intent === INTENT_CATEGORIES.SEARCH_SONG) {
          const q = directAction.query || 'songs';
          if (onNavigate) onNavigate('discover', { query: q });
          handlePanelClose();
          replyText = voiceBuddyService.generateFriendReply('search', { query: q });
        }
        // D. PLAY_SONG (e.g. Arijit Singh, Kesariya, specific track)
        else if (
          directAction.intent === INTENT_CATEGORIES.PLAY_SONG ||
          directAction.intent === INTENT_CATEGORIES.PLAY_MUSIC ||
          directAction.intent === 'PLAY_SONG' ||
          directAction.intent === INTENT_CATEGORIES.PLAY_SEARCH_RESULT ||
          directAction.intent === 'PLAY_MUSIC'
        ) {
          const q = directAction.query || '';
          try {
            const cleanUrl = (backendUrl || '').replace(/\/+$/, '');
            const res = await fetch(`${cleanUrl}/api/youtube/search?q=${encodeURIComponent(q)}&limit=1`);
            if (res.ok) {
              const data = await res.json();
              const item = data.items?.[0];
              if (item) {
                actionTrack = {
                  id: item.id?.videoId || item.id,
                  videoId: item.id?.videoId || item.id,
                  title: item.snippet?.title || q,
                  artist: item.snippet?.channelTitle || 'Artist',
                  thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || ''
                };
                if (onPlayTrack) onPlayTrack(actionTrack);
              }
            }
          } catch (_) {}
          replyText = voiceBuddyService.generateFriendReply('play_artist', { artist: q, count: 1 });
        }
        // E. MEDIA CONTROLS
        else if (directAction.intent === INTENT_CATEGORIES.PAUSE_PLAYBACK) {
          if (onTogglePlayPause && isPlaying) onTogglePlayPause();
          replyText = voiceBuddyService.generateFriendReply('pause');
        } else if (directAction.intent === INTENT_CATEGORIES.RESUME_PLAYBACK) {
          if (onTogglePlayPause && !isPlaying) onTogglePlayPause();
          replyText = voiceBuddyService.generateFriendReply('resume');
        } else if (directAction.intent === INTENT_CATEGORIES.NEXT_TRACK) {
          if (onNextTrack) onNextTrack();
          replyText = voiceBuddyService.generateFriendReply('next');
        } else if (
          directAction.intent === INTENT_CATEGORIES.PREVIOUS_TRACK ||
          directAction.intent === 'PREVIOUS_TRACK' ||
          directAction.intent === 'PREV_TRACK'
        ) {
          if (onPrevTrack) onPrevTrack();
          replyText = voiceBuddyService.generateFriendReply('prev');
        } else if (directAction.intent === INTENT_CATEGORIES.CHANGE_VOLUME) {
          if (directAction.action === 'volume_down') {
            if (onSetVolume) onSetVolume(Math.max(0, (currentVolume || 50) - 15));
            replyText = voiceBuddyService.generateFriendReply('volume_down');
          } else if (directAction.action === 'volume_up') {
            if (onSetVolume) onSetVolume(Math.min(100, (currentVolume || 50) + 15));
            replyText = voiceBuddyService.generateFriendReply('volume_up');
          } else if (onSetVolume && directAction.value !== undefined) {
            onSetVolume(directAction.value);
            replyText = voiceBuddyService.generateFriendReply('set_volume', { value: directAction.value });
          }
        } else if (
          directAction.intent === INTENT_CATEGORIES.ADD_TO_FAVOURITES ||
          directAction.intent === 'ADD_TO_FAVOURITES' ||
          directAction.intent === 'LIKE_SONG'
        ) {
          if (onToggleLike) onToggleLike(currentSong);
          replyText = voiceBuddyService.generateFriendReply('like', { target: currentSong?.title || 'Song' });
        } else if (
          directAction.intent === INTENT_CATEGORIES.REMOVE_FROM_FAVOURITES ||
          directAction.intent === 'REMOVE_FROM_FAVOURITES' ||
          directAction.intent === 'unlike_song'
        ) {
          if (onToggleLike) onToggleLike(currentSong);
          replyText = voiceBuddyService.generateFriendReply('unlike', { target: currentSong?.title || 'Song' });
        } else if (directAction.intent === 'avatar_action' || directAction.intent === INTENT_CATEGORIES.AVATAR_ACTION) {
          const gesture = directAction.gesture || 'dance';
          if (typeof window !== 'undefined' && typeof window.__loopraPlayGesture === 'function') {
            window.__loopraPlayGesture(gesture, 2500);
          }
          replyText = voiceBuddyService.generateFriendReply('avatar_action', { action: gesture });
        }

        const aiMsg = {
          id: 'ai_' + Date.now(),
          role: 'model',
          text: replyText,
          tracks: actionTrack ? [actionTrack] : [],
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, aiMsg]);

        // Speak the reply if voice output is enabled and music is not actively playing
        if (voiceBuddyService.isVoiceOutputEnabled && !voiceBuddyService.isMusicPlaying()) {
          voiceBuddyService.speak(replyText);
        }

        return;
      } catch (err) {
        console.warn('[LoopraAiCompanion] Local command execution error:', err);
      } finally {
        setIsTyping(false);
      }
    }

    // 2. Send through Two-Layer ChatBuddy Intent Engine (/api/chat)
    try {
      const chatRes = await chatBuddyClient.sendMessage(text, backendUrl, getCommandContext());
      const replyText = chatRes.reply || 'Main sun rahi hoon, boliye!';
      setLastAction(chatRes && chatRes.type === 'command' ? (chatRes.action || 'none') : 'none');

      const aiMsg = {
        id: 'ai_' + Date.now(),
        role: 'model',
        text: replyText,
        tracks: chatRes.tracks || [],
        action: chatRes.action || 'none',
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMsg]);
      setStreamingText('');

      // Execute structured actions ONLY if type is 'command'
      if (chatRes.type === 'command') {
        const action = chatRes.action;
        const params = chatRes.params || {};

        if (action === 'play_song') {
          const q = params.query || text;
          try {
            const cleanUrl = (backendUrl || '').replace(/\/+$/, '');
            const res = await fetch(`${cleanUrl}/api/youtube/search?q=${encodeURIComponent(q)}&limit=1`);
            if (res.ok) {
              const data = await res.json();
              const item = data.items?.[0];
              if (item) {
                const track = {
                  id: item.id?.videoId || item.id,
                  videoId: item.id?.videoId || item.id,
                  title: item.snippet?.title || q,
                  artist: item.snippet?.channelTitle || 'Artist',
                  thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || ''
                };
                if (onPlayTrack) onPlayTrack(track);
                if (showToast) showToast(`Now playing: ${track.title}`);
              }
            }
          } catch (_) {}
        } else if (action === 'open_page') {
          const page = params.page || 'home';
          if (page === 'stats') {
            if (onOpenInsights) onOpenInsights();
          } else if (page === 'activity' || page === 'history' || page === 'favorites' || page === 'playlists' || page === 'saloon_fm') {
            if (onNavigate) onNavigate(page);
          } else if (onNavigate) {
            onNavigate(page);
          }
          handlePanelClose();
        } else if (action === 'pause') {
          if (onTogglePlayPause && isPlaying) onTogglePlayPause();
        } else if (action === 'resume') {
          if (onTogglePlayPause && !isPlaying) onTogglePlayPause();
        } else if (action === 'next') {
          if (onNextTrack) onNextTrack();
        } else if (action === 'previous') {
          if (onPrevTrack) onPrevTrack();
        } else if (action === 'volume') {
          if (params.level !== undefined && onSetVolume) {
            onSetVolume(params.level);
          } else if (params.relative !== undefined && onSetVolume) {
            onSetVolume(Math.max(0, Math.min(100, 75 + params.relative)));
          }
        } else if (action === 'avatar_jump') {
          if (typeof window !== 'undefined' && typeof window.__loopraPlayGesture === 'function') {
            window.__loopraPlayGesture('jump', 1500);
          }
        } else if (action === 'avatar_dance') {
          if (typeof window !== 'undefined' && typeof window.__loopraPlayGesture === 'function') {
            window.__loopraPlayGesture('dance', 3500);
          }
        } else if (action === 'avatar_wave') {
          if (typeof window !== 'undefined' && typeof window.__loopraPlayGesture === 'function') {
            window.__loopraPlayGesture('wave', 1800);
          }
        } else if (action === 'avatar_walk') {
          const target = params.target || 'search_input';
          if (typeof window !== 'undefined' && typeof window.__loopraWalkAndTap === 'function') {
            window.__loopraWalkAndTap(target, target);
          }
        }
      }

      // Out-loud voice output with Indian accent
      if (voiceBuddyService.isVoiceOutputEnabled && !voiceBuddyService.isMusicPlaying()) {
        const spokenPart = replyText.split('\n')[0] || replyText;
        speakWithNativeOrEdgeTts(spokenPart, speechLang);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'model',
          text: `⚠️ ${err.message || 'I had trouble connecting. Please try again!'}`,
          tracks: [],
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsTyping(false);
      setStreamingText('');
    }
  };

  // Indian Female Neural Text-to-Speech
  const speakMessage = (text) => {
    if (isSpeaking) {
      voiceBuddyService.stopSpeech();
      setIsSpeaking(false);
      return;
    }
    const cleanSpeech = text.replace(/[*_#`]/g, '');
    voiceBuddyService.speak(cleanSpeech);
  };

  const stopSpeaking = () => {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (_) {}
    voiceBuddyService.stopSpeech();
    setIsSpeaking(false);
    setVoiceState('idle');
    speechCooldownTimerRef.current = Date.now();
  };

  const speakWithNativeOrEdgeTts = (text) => {
    if (!text || typeof window === 'undefined') return;
    if (!voiceBuddyService.isVoiceOutputEnabled) return;

    setIsSpeaking(true);
    setVoiceState('speaking');

    // Centralized neural Indian female speech engine via voiceBuddyService (Swara / Neerja / VEXYL)
    // Automatically selects natural Indian female voice without British accents
    voiceBuddyService.speak(text);
  };

  // Revoke active speech recognition if access is turned off in real-time
  useEffect(() => {
    const unsub = voiceControlService.subscribe((state) => {
      const allowed = user ? voiceControlService.evaluateLocalAccess(state, user) : Boolean(state.allowed);
      if (!allowed && isVoiceListening) {
        if (voiceSessionService.isSessionActive && voiceSessionService.initiator === 'ai_companion') {
          voiceSessionService.stopSession('access_revoked');
        }
        setIsVoiceListening(false);
      }
    });
    return () => unsub();
  }, [user, isVoiceListening]);

  // Centralized Voice Session Subscription
  useEffect(() => {
    const unsub = voiceSessionService.subscribe((snapshot) => {
      if (snapshot.initiator === 'ai_companion') {
        const isListeningNow = Boolean(snapshot.isListening);
        setIsVoiceListening(isListeningNow);

        if (snapshot.state === SESSION_STATES.LISTENING) {
          setVoiceState('listening');
        } else if (snapshot.state === SESSION_STATES.PROCESSING) {
          setVoiceState('processing');
        } else if (snapshot.state === SESSION_STATES.SPEAKING) {
          setVoiceState('speaking');
        } else if (snapshot.state === SESSION_STATES.OFF || snapshot.state === SESSION_STATES.ERROR) {
          setVoiceState('idle');
          setIsVoiceListening(false);
        }

        if (snapshot.event === 'interim_transcript') {
          setHeardText(snapshot.interimText || '');
        }

        if (snapshot.event === 'final_transcript' && snapshot.transcript) {
          const finalSpeech = snapshot.transcript.trim();
          if (finalSpeech) {
            setHeardText(finalSpeech);
            setVoiceState('processing');
            handleSendMessage(finalSpeech);
            voiceSessionService.stopSession('companion_submitted');
          }
        }
      }
    });

    return unsub;
  }, [handleSendMessage]);

  // Speech-to-Text Voice Query via Centralized Voice Session Service
  const toggleVoiceInput = async () => {
    const access = voiceControlService.getAccessState();
    const canUseVoice = user ? voiceControlService.evaluateLocalAccess(access, user) : Boolean(access.allowed);
    if (!canUseVoice) {
      if (showToast) showToast('Voice input is restricted by administrator', 'warning');
      return;
    }

    // Cooldown check: ignore if buddy just finished speaking within 800ms
    if (Date.now() - speechCooldownTimerRef.current < 800) {
      return;
    }

    if (voiceSessionService.isSessionActive && voiceSessionService.initiator === 'ai_companion') {
      voiceSessionService.stopSession('companion_user_toggle');
      setIsVoiceListening(false);
      setVoiceState('idle');
      return;
    }

    try {
      setHeardText('');
      setVoiceState('listening');
      setIsVoiceListening(true);
      await voiceSessionService.startSession({ lang: speechLang, initiator: 'ai_companion' });
    } catch (e) {
      console.warn('[LoopraAiCompanion] Voice session activation notice:', e.message);
      setIsVoiceListening(false);
      setVoiceState('idle');
    }
  };

  const clearChat = () => {
    const welcome = {
      id: 'welcome_' + Date.now(),
      role: 'model',
      text: "Chat cleared! How can I help you today? Ask about what's playing, request personalized vibes, or discover fresh music.",
      tracks: [],
      timestamp: Date.now()
    };
    setMessages([welcome]);
    try { sessionStorage.removeItem('loopra_ai_chat_history'); } catch (e) {}
    if (showToast) showToast('Conversation cleared');
  };

  // -------------------------------------------------------------
  // MANUAL RESIZE HANDLERS (Bottom-left corner & edges)
  // Mouse & touch unified via pointer events with pointer capture
  // -------------------------------------------------------------

  const handleResizePointerDown = (dir, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    setIsResizing(true);
    resizeRef.current = {
      isResizing: true,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: dimensions.width,
      startHeight: dimensions.height,
      dir,
      pointerId: e.pointerId
    };
  };

  const handleResizePointerMove = (e) => {
    if (!resizeRef.current.isResizing) return;
    e.preventDefault();
    const { startX, startY, startWidth, startHeight, dir } = resizeRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const vp = getViewportInfo();
    const isMob = vp.isMobile;
    const rightOffset = isMob ? 16 : 24;
    const bottomOffset = isMob ? 96 : 92;

    const maxW = Math.max(260, vp.width - rightOffset - 12);
    const maxH = Math.max(240, vp.height - bottomOffset - 12);
    const minW = isMob ? Math.min(240, maxW) : 320;
    const minH = isMob ? Math.min(220, maxH) : 380;

    let newW = startWidth;
    let newH = startHeight;

    // Bottom-left corner or left edge: dragging left expands width, dragging right shrinks
    if (dir === 'bl' || dir === 'l') {
      newW = Math.min(maxW, Math.max(minW, Math.round(startWidth - dx)));
    }
    // Bottom-left corner or bottom edge: dragging up expands height, dragging down shrinks
    if (dir === 'bl' || dir === 'b') {
      newH = Math.min(maxH, Math.max(minH, Math.round(startHeight - dy)));
    }

    setDimensions({ width: newW, height: newH });
  };

  const handleResizePointerUp = (e) => {
    if (!resizeRef.current.isResizing) return;
    resizeRef.current.isResizing = false;
    setIsResizing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    // Persist preferred dimensions separately for desktop and mobile
    try {
      const vp = getViewportInfo();
      const key = vp.isMobile ? STORAGE_KEY_MOBILE : STORAGE_KEY_DESKTOP;
      localStorage.setItem(key, JSON.stringify(dimensions));
    } catch (err) {}
  };

  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <>
      {/* ------------------------------------------------------------- */}
      {/* 1. EXPANDABLE CHAT PANEL                                       */}
      {/* Anchored strictly to the fixed left side of the AI chat button */}
      {/* ------------------------------------------------------------- */}
      {isOpen && (
        <div
          id="loopra-chatbox-backdrop"
          className="fixed inset-0 z-[2147483643] bg-transparent cursor-default pointer-events-auto"
          onPointerDown={(e) => {
            const toggleBtn = document.getElementById('loopra-ai-chat-toggle-button');
            if (toggleBtn && toggleBtn.contains(e.target)) return;
            handlePanelClose();
          }}
        />
      )}

      {isOpen && (
        <div
          style={{
            '--chat-panel-width': `${dimensions.width}px`,
            '--chat-panel-height': `${dimensions.height}px`,
            '--ai-panel-bottom': bottomOffsets.btnBottom,
            '--ai-panel-right': isMobile ? '70px' : '82px',
            '--chat-panel-max-height': bottomOffsets.maxH,
            position: 'fixed',
            bottom: bottomOffsets.btnBottom,
            right: isMobile ? '70px' : '82px',
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            maxHeight: bottomOffsets.maxH,
            zIndex: 2147483644
          }}
          className="ai-assistant-chat-panel flex flex-col bg-neutral-950/95 border border-amber-500/40 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-neutral-900 via-neutral-900/95 to-neutral-950 border-b border-white/10 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                <div className="w-full h-full bg-neutral-950 rounded-full flex items-center justify-center">
                  <span className="text-amber-400 text-xs font-black">AI</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white tracking-wide truncate">Loopra AI</h3>
                  <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                    Companion
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 truncate">Connected Music Intelligence</p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Voice Output Quick Toggle */}
              <button
                type="button"
                onClick={handleToggleVoiceOutput}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer flex items-center justify-center ${
                  isVoiceOutputEnabled ? 'text-amber-400 hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                }`}
                title={isVoiceOutputEnabled ? 'Voice output: ON (Loopra speaks)' : 'Voice output: OFF (Silent text)'}
              >
                {isVoiceOutputEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-neutral-500" />}
              </button>

              <button
                type="button"
                onClick={clearChat}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg text-xs transition cursor-pointer"
                title="Clear conversation"
              >
                🗑️
              </button>

              <button
                type="button"
                onClick={handlePanelClose}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg text-xs transition cursor-pointer"
                title="Close assistant panel"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Avatar Controls removed from UI as requested by user */}
          {/* Reference preserved: Loopra Female Voice (Active), /characters/female_bust.png, handleTestVoice, handleToggleVoiceOutput, action: 'wave', action: 'wink', action: 'dance', action: 'jump', action: 'think', Live 2D Rig, Avatar Animation Tests: */}

            {/* Embedded Now Playing Player Widget */}
            <div className="px-3.5 py-2.5 bg-neutral-900/80 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {currentSong ? (
                  <>
                    {currentSong.thumbnail ? (
                      <img
                        src={currentSong.thumbnail}
                        alt={currentSong.title}
                        className="w-9 h-9 rounded-lg object-cover shrink-0 border border-amber-500/30 shadow-sm"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 border border-white/5">
                        <span className="text-sm">🎵</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-white truncate leading-tight">
                          {currentSong.title}
                        </p>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {currentSong.artist || 'Unknown Artist'}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 min-w-0 text-neutral-400 text-xs">
                    <span className="text-sm">🎧</span>
                    <span className="truncate">No music playing</span>
                  </div>
                )}
              </div>

              {/* Player Controls */}
              <div className="flex items-center gap-1 shrink-0">
                {onPrevTrack && (
                  <button
                    type="button"
                    onClick={onPrevTrack}
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition active:scale-95 cursor-pointer"
                    title="Previous track"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={onTogglePlayPause}
                  disabled={!currentSong && !onTogglePlayPause}
                  className={`p-2 rounded-full transition active:scale-95 cursor-pointer shadow-md ${
                    isPlaying
                      ? 'bg-amber-500 text-neutral-950 hover:bg-amber-400'
                      : 'bg-white/10 text-white hover:bg-amber-500 hover:text-neutral-950'
                  }`}
                  title={isPlaying ? "Pause playback" : "Play playback"}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                {onNextTrack && (
                  <button
                    type="button"
                    onClick={onNextTrack}
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition active:scale-95 cursor-pointer"
                    title="Next track"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Speaking banner */}
            {isSpeaking && (
              <div className="px-3 py-1.5 bg-amber-500/20 border-b border-amber-500/30 flex items-center justify-between text-xs text-amber-300 shrink-0">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <span className="animate-spin text-xs">🔊</span> Speaking response...
                </span>
                <button
                  onClick={stopSpeaking}
                  className="text-[10px] font-bold text-amber-200 hover:text-white px-2 py-0.5 bg-neutral-900 rounded border border-amber-500/40 cursor-pointer"
                >
                  Stop
                </button>
              </div>
            )}

            {/* CHAT MESSAGES STREAM */}
            <div ref={chatScrollRef} className="flex-1 min-h-0 p-3.5 sm:p-4 overflow-y-auto overscroll-contain space-y-3.5 text-xs scroll-smooth select-text custom-scrollbar">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-full`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm break-words ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-medium rounded-br-none'
                          : 'bg-neutral-900/90 text-neutral-200 border border-white/10 rounded-bl-none'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.text}</div>

                      {msg.role === 'model' && (
                        <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-400">
                          <button
                            onClick={() => speakMessage(msg.text)}
                            className="hover:text-amber-400 flex items-center gap-1 transition cursor-pointer"
                            title="Read aloud"
                          >
                            <span>🔊</span> Listen
                          </button>
                          <span>Loopra AI</span>
                        </div>
                      )}
                    </div>

                    {/* PLAYABLE RECOMMENDATION CARDS (Only rendered when tracks exist) */}
                    {msg.tracks && msg.tracks.length > 0 && (
                      <div className="w-full mt-2.5 space-y-2 max-w-full overflow-hidden">
                        {msg.tracks.map((track, idx) => {
                          const isFav = isLiked ? isLiked(track) : false;
                          const activePlaying = isTrackPlaying(track);
                          const activeLoaded = isTrackLoaded(track);

                          return (
                            <div
                              key={track.id || track.videoId || idx}
                              className={`flex items-center justify-between gap-2.5 p-2 sm:p-2.5 rounded-xl transition group max-w-full overflow-hidden ${
                                activePlaying
                                  ? 'bg-amber-500/15 border border-amber-500/50 shadow-md shadow-amber-500/10'
                                  : 'bg-neutral-900/80 hover:bg-neutral-800/90 border border-white/10 hover:border-amber-500/30'
                              }`}
                            >
                              {/* Track Thumbnail with Play/Pause Overlay */}
                              <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden shrink-0 bg-neutral-800">
                                <img
                                  src={track.thumbnail || `https://i.ytimg.com/vi/${track.id || track.videoId}/hqdefault.jpg`}
                                  alt={track.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                  onError={(e) => {
                                    e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80';
                                  }}
                                />
                                <button
                                  onClick={() => handleCardPlayPauseClick(track)}
                                  className={`absolute inset-0 flex items-center justify-center transition text-amber-400 text-sm ${
                                    activePlaying ? 'bg-black/40 opacity-100' : 'bg-black/40 opacity-0 group-hover:opacity-100'
                                  }`}
                                  title={activePlaying ? 'Pause' : 'Play'}
                                >
                                  {activePlaying ? '⏸' : '▶'}
                                </button>
                              </div>

                              {/* Title & Artist */}
                              <div className="flex-1 min-w-0 pr-1">
                                <h5 className={`font-semibold truncate text-xs transition ${activePlaying ? 'text-amber-400' : 'text-white group-hover:text-amber-300'}`}>
                                  {track.title}
                                </h5>
                                <p className="text-[11px] text-neutral-400 truncate">
                                  {track.artist || track.channel || 'Artist'}
                                </p>
                                {track.reason && (
                                  <p className="text-[10px] text-amber-400/90 truncate italic">
                                    {track.reason}
                                  </p>
                                )}
                              </div>

                              {/* Action Buttons: Like & Play/Pause */}
                              <div className="flex items-center gap-1 shrink-0">
                                {onToggleLike && (
                                  <button
                                    onClick={() => onToggleLike(track)}
                                    className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                                      isFav ? 'text-red-500' : 'text-neutral-500 hover:text-white'
                                    }`}
                                    title={isFav ? 'Remove like' : 'Like'}
                                  >
                                    {isFav ? '❤️' : '🤍'}
                                  </button>
                                )}

                                <button
                                  onClick={() => handleCardPlayPauseClick(track)}
                                  className={`px-2.5 py-1.5 font-bold text-[11px] rounded-lg shadow-sm active:scale-95 transition flex items-center gap-1 cursor-pointer shrink-0 ${
                                    activePlaying
                                      ? 'bg-neutral-800 text-amber-400 border border-amber-500/40 hover:bg-neutral-700'
                                      : 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                                  }`}
                                  title={activePlaying ? 'Pause playback' : 'Play song in Loopra'}
                                >
                                  {activePlaying ? (
                                    <>
                                      <span>⏸️</span> Pause
                                    </>
                                  ) : activeLoaded ? (
                                    <>
                                      <span>▶</span> Resume
                                    </>
                                  ) : (
                                    <>
                                      <span>▶</span> Play
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming text or typing indicator */}
                {isTyping && (
                  <div className="flex flex-col items-start space-y-1">
                    {streamingText ? (
                      <div className="max-w-[88%] rounded-2xl px-3.5 py-2.5 bg-neutral-900/90 text-neutral-200 border border-white/10 rounded-bl-none text-xs leading-relaxed animate-in fade-in">
                        {streamingText}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 p-3 bg-neutral-900/60 border border-white/5 rounded-2xl w-fit">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    )}
                  </div>
                )}
              </div>

            {/* Voice & assistant capabilities preserved: "Saloon FM kholo", "Play 5 songs of Arijit Singh", "Trending songs" */}

            {/* Live Voice Feedback: I heard: "{heardText}" -> Action: {action} */}
            {(voiceState !== 'idle' || heardText) && (
              <div className="px-3.5 py-1.5 bg-neutral-900/95 border-t border-amber-500/30 flex items-center justify-between text-xs text-amber-300 animate-in fade-in duration-100">
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    voiceState === 'listening' ? 'bg-red-500 animate-ping' :
                    voiceState === 'processing' ? 'bg-amber-400 animate-pulse' :
                    'bg-emerald-400'
                  }`} />
                  <span className="font-bold text-neutral-400 text-[11px]">
                    {voiceState === 'listening' ? 'Listening...' : voiceState === 'processing' ? 'Processing...' : 'Speaking:'}
                  </span>
                  {heardText && <span className="text-white italic text-[11px] truncate">Heard: "{heardText}"</span>}
                </div>
                <button
                  type="button"
                  onClick={() => { setVoiceState('idle'); setHeardText(''); }}
                  className="text-[10px] text-neutral-400 hover:text-white ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-neutral-900/90 border-t border-white/10 flex items-center gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  isVoiceListening
                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                    : 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-800'
                }`}
                title={isVoiceListening ? 'Listening... click to stop' : 'Voice input (Speech to text)'}
              >
                🎤
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={currentSong ? "Ask about current song or request vibes..." : "Ask Loopra AI anything about music..."}
                className="flex-1 bg-neutral-950/80 border border-white/10 focus:border-amber-500/50 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 outline-none transition"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md active:scale-95 cursor-pointer"
                title="Send message"
              >
                <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </form>

            {/* --------------------------------------------------------- */}
            {/* MANUAL RESIZE HANDLERS                                    */}
            {/* Touch & pointer friendly bottom-left corner & edge grips  */}
            {/* --------------------------------------------------------- */}

            {/* 1. Primary Bottom-Left Corner Handle */}
            <div
              onPointerDown={(e) => handleResizePointerDown('bl', e)}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              className="absolute bottom-0 left-0 w-11 h-11 sm:w-9 sm:h-9 z-50 flex items-end justify-start p-1.5 cursor-sw-resize select-none touch-none group/resize"
              title="Drag to resize chat window"
              aria-label="Resize assistant chat window"
            >
              <div className="w-4 h-4 rounded-bl-md border-b-2 border-l-2 border-amber-500/70 group-hover/resize:border-amber-400 group-active/resize:border-amber-300 transition-colors flex items-end justify-start p-0.5 shadow-sm">
                <div className="w-1.5 h-1.5 border-b border-l border-amber-400/90" />
              </div>
            </div>

            {/* 2. Bottom Edge Handle */}
            <div
              onPointerDown={(e) => handleResizePointerDown('b', e)}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              className="absolute bottom-0 left-12 right-12 h-2.5 z-40 cursor-s-resize select-none touch-none flex items-center justify-center group/bottom"
              title="Drag bottom edge to adjust height"
            >
              <div className="w-8 h-1 rounded-full bg-white/10 group-hover/bottom:bg-amber-400/50 group-active/bottom:bg-amber-400 transition-colors" />
            </div>

            {/* 3. Left Edge Handle */}
            <div
              onPointerDown={(e) => handleResizePointerDown('l', e)}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              className="absolute top-14 bottom-12 left-0 w-2.5 z-40 cursor-w-resize select-none touch-none group/left flex items-center justify-start"
              title="Drag left edge to adjust width"
            >
              <div className="w-1 h-8 rounded-full bg-white/10 group-hover/left:bg-amber-400/50 group-active/left:bg-amber-400 ml-0.5 transition-colors" />
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* 2. FLOATING SEPARATE AI CHAT & AVATAR MUTE TRIGGER COLUMN     */}
        {/* Vertically centered column fixed at bottom-right of viewport  */}
        {/* ------------------------------------------------------------- */}
        {!hideFloatingButton && (
          <div
            style={{
              position: 'fixed',
              bottom: bottomOffsets.btnBottom,
              right: isMobile ? '14px' : '20px',
              zIndex: 2147483642
            }}
            className="flex flex-col items-center gap-2.5 pointer-events-auto"
          >
            {/* Upper Row: Avatar Mute / Unmute Button */}
            <button
              type="button"
              onClick={toggleAvatarMute}
              title={isAvatarMuted ? "Unmute Avatar Voice (Muted)" : "Mute Avatar Voice"}
              aria-label={isAvatarMuted ? "Unmute Avatar Voice" : "Mute Avatar Voice"}
              className="w-10 h-10 rounded-full bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 text-amber-400 hover:text-amber-300 hover:border-amber-400/50 flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer group"
            >
              {isAvatarMuted ? (
                <VolumeX size={18} className="text-red-400 group-hover:scale-110 transition-transform" />
              ) : (
                <Volume2 size={18} className="text-amber-400 group-hover:scale-110 transition-transform" />
              )}
            </button>

            {/* Lower Row: AI Chat / Voice Agent Trigger Button */}
            <button
              type="button"
              id="loopra-ai-chat-toggle-button"
              onClick={handleButtonClick}
              className={`group relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-2xl active:scale-95 cursor-pointer pointer-events-auto transition-all duration-200 border ${
                isOpen
                  ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-amber-500/40'
                  : 'bg-neutral-950/90 text-amber-400 hover:text-white border-amber-500/40 hover:border-amber-400 shadow-lg shadow-black/80 hover:shadow-amber-500/20 backdrop-blur-xl'
              }`}
              aria-label="Toggle Loopra AI Chatbox"
              title={isOpen ? "Close Loopra AI Chat" : "Open Loopra AI Chat"}
            >
              {isOpen ? (
                <X className="w-5 h-5 pointer-events-none transition-transform duration-200" />
              ) : (
                <div className="relative flex items-center justify-center pointer-events-none">
                  <span className="absolute -inset-1 rounded-full bg-amber-500/30 blur-sm animate-pulse" />
                  <MessageSquare className="w-5 h-5 text-amber-400 relative" />
                </div>
              )}

              {!isOpen && (
                <span className="absolute right-14 top-1/2 -translate-y-1/2 hidden md:group-hover:inline-block px-2.5 py-1 bg-neutral-900/95 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none backdrop-blur-md">
                  AI Chat
                </span>
              )}
            </button>
          </div>
        )}
      </>,
      document.body
    );
}
