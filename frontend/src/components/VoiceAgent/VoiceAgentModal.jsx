import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Heart,
  Compass,
  Radio,
  BarChart2,
  ListMusic,
  ArrowLeft,
  X,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Power,
  RotateCcw
} from 'lucide-react';
import { voiceControlService } from '../../services/voiceControlService';
import {
  parseVoiceCommandLocally,
  parseMultiStepInstruction,
  executeTaskPipeline
} from '../../services/voiceTaskEngine';

const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', label: 'English (IN)', flag: '🇮🇳' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳' }
];

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
  // Permission state
  const [hasAccess, setHasAccess] = useState(() => {
    const initial = voiceControlService.getAccessState();
    if (user) {
      return voiceControlService.evaluateLocalAccess(initial, user);
    }
    return Boolean(initial.allowed);
  });

  // Voice session state (Independent of panel visibility)
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'listening' | 'executing' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('Say "Hey Loopra" to begin');
  const [activeActionLabel, setActiveActionLabel] = useState('');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [manualText, setManualText] = useState('');
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [voiceVolumeScale, setVoiceVolumeScale] = useState(0);

  // AudioContext & Analyser refs for real microphone activity
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Recognition refs
  const recognitionRef = useRef(null);
  const isSessionActiveRef = useRef(false);
  isSessionActiveRef.current = isSessionActive;
  const isExecutingRef = useRef(false);
  const restartTimerRef = useRef(null);
  const lastExecutedRef = useRef({ text: '', timestamp: 0 });

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

  // 1. Permission subscription via voiceControlService
  useEffect(() => {
    const unsub = voiceControlService.subscribe((state) => {
      const allowed = user ? voiceControlService.evaluateLocalAccess(state, user) : Boolean(state.allowed);
      setHasAccess(allowed);
      if (!allowed && isSessionActiveRef.current) {
        handleStopSession();
      }
    });
    return unsub;
  }, [user]);

  // 2. Audio Visualizer Setup (Real Microphone Input via Web Audio API)
  const startAudioVisualizer = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        });
      }

      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1.0, Math.max(0.0, (avg - 10) / 100));
        setVoiceVolumeScale(normalized);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      animFrameRef.current = requestAnimationFrame(updateVolume);
    } catch (err) {
      console.warn('[VoiceAgent] AudioContext visualizer init note:', err.message);
    }
  };

  const stopAudioVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
    }
    setVoiceVolumeScale(0);
  };

  // 3. Speech Recognition Engine
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('listening');
      setStatusMessage('Listening... (Say commands or "Done Loopra")');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += text;
        } else {
          interim += text;
        }
      }

      if (interim) {
        setInterimText(interim);
      }

      if (finalTranscript) {
        const cleaned = finalTranscript.trim();
        setTranscript(cleaned);
        setInterimText('');
        handleProcessUtterance(cleaned);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      if (event.error === 'aborted') return;
      console.warn('[VoiceAgent] SpeechRecognition error:', event.error);
      setStatus('error');
      setStatusMessage(`Speech error: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isSessionActiveRef.current && !isExecutingRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (isSessionActiveRef.current) {
            try {
              recognitionRef.current?.start();
            } catch (_) {}
          }
        }, 300);
      }
    };

    return recognition;
  }, [selectedLang]);

  // Catalog search helper
  const searchCatalog = async (query = '') => {
    if (!query) return [];
    try {
      const cleanUrl = (backendUrl || '').replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/youtube/search?q=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        return items.map(item => ({
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
  };

  // 4. Multi-Step Execution Handler
  const handleProcessUtterance = async (rawUtterance = '') => {
    if (!rawUtterance || typeof rawUtterance !== 'string') return;
    const text = rawUtterance.trim();
    if (!text) return;

    // Deduplication check: prevent identical utterances within 3.0s
    const now = Date.now();
    if (
      lastExecutedRef.current.text === text &&
      now - lastExecutedRef.current.timestamp < 3000
    ) {
      return;
    }
    lastExecutedRef.current = { text, timestamp: now };

    // Pause recognition during execution
    isExecutingRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch (_) {}

    // Check for deactivation commands
    const singleParse = parseVoiceCommandLocally(text, persistentContextRef.current);
    if (singleParse && singleParse.action === 'stop_continuous') {
      handleStopSession();
      showToast?.('Voice session stopped');
      isExecutingRef.current = false;
      return;
    }

    // Parse into dependency-aware ordered steps
    const steps = parseMultiStepInstruction(text, persistentContextRef.current);

    if (steps.length === 0) {
      setStatus('idle');
      setStatusMessage('Command not recognized. Say "Hey Loopra" to try again.');
      isExecutingRef.current = false;
      if (isSessionActiveRef.current) {
        try { recognitionRef.current?.start(); } catch (_) {}
      }
      return;
    }

    setStatus('executing');
    setActiveActionLabel(`Executing ${steps.length} action${steps.length > 1 ? 's' : ''}...`);

    // Execute through real application pipeline
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
      onNavigate,
      onOpenInsights,
      onOpenQueue,
      onOpenLyrics,
      onGoBack,
      onOpenArtist,
      searchCatalog
    });

    // Update persistent context
    if (pipelineResult.taskContext) {
      persistentContextRef.current = pipelineResult.taskContext;
    }

    if (pipelineResult.success) {
      setStatus('success');
      setStatusMessage(pipelineResult.message);
      showToast?.(pipelineResult.message);
    } else {
      setStatus('error');
      setStatusMessage(pipelineResult.message);
      showToast?.(pipelineResult.message, 'error');
    }

    // Resume listening after execution
    setTimeout(() => {
      isExecutingRef.current = false;
      setActiveActionLabel('');
      if (isSessionActiveRef.current) {
        setStatus('listening');
        setStatusMessage('Listening... (Say commands or "Done Loopra")');
        try {
          recognitionRef.current?.start();
        } catch (_) {}
      } else {
        setStatus('idle');
      }
    }, 2200);
  };

  // 5. Start / Stop Continuous Voice Session (Controls Voice Mode independently)
  const startContinuousSession = async () => {
    setIsSessionActive(true);
    isSessionActiveRef.current = true;
    setStatus('listening');
    setStatusMessage('Voice active! Say "Hey Loopra" or any music command');
    showToast?.('Voice Agent: ON (Listening)');

    await startAudioVisualizer();

    if (!recognitionRef.current) {
      recognitionRef.current = initSpeechRecognition();
    }

    try {
      recognitionRef.current?.start();
    } catch (_) {}
  };

  const handleStopSession = () => {
    setIsSessionActive(false);
    isSessionActiveRef.current = false;
    clearTimeout(restartTimerRef.current);
    setStatus('idle');
    setStatusMessage('Voice Agent is paused. Click icon to resume.');
    setActiveActionLabel('');
    showToast?.('Voice Agent: OFF');

    stopAudioVisualizer();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }
  };

  const handleToggleVoiceMode = () => {
    if (isSessionActive) {
      handleStopSession();
    } else {
      startContinuousSession();
    }
  };

  // 6. Interaction: Click vs Long Press Handling
  const longPressTimerRef = useRef(null);
  const pointerStartPosRef = useRef({ x: 0, y: 0 });
  const didLongPressRef = useRef(false);
  const isPointerDownRef = useRef(false);

  const LONG_PRESS_THRESHOLD_MS = 450;
  const POINTER_MOVE_TOLERANCE_PX = 8;

  const handleVoicePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return; // Only left click or primary touch
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    didLongPressRef.current = false;
    isPointerDownRef.current = true;

    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (isPointerDownRef.current) {
        didLongPressRef.current = true;
        try { navigator.vibrate?.([40]); } catch (_) {}
        // Open full panel without changing voice mode
        onOpenPanel?.();
      }
    }, LONG_PRESS_THRESHOLD_MS);
  };

  const handleVoicePointerMove = (e) => {
    if (!isPointerDownRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartPosRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartPosRef.current.y);
    if (dx > POINTER_MOVE_TOLERANCE_PX || dy > POINTER_MOVE_TOLERANCE_PX) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleVoicePointerUp = (e) => {
    clearTimeout(longPressTimerRef.current);
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (didLongPressRef.current) {
      // Long press already opened the panel; do NOT toggle voice mode
      e.preventDefault();
      e.stopPropagation();
      didLongPressRef.current = false;
      return;
    }

    // Normal click: toggle voice ON / OFF
    e.preventDefault();
    handleToggleVoiceMode();
  };

  const handleVoicePointerCancel = () => {
    clearTimeout(longPressTimerRef.current);
    isPointerDownRef.current = false;
    didLongPressRef.current = false;
  };

  const handleVoiceKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.shiftKey || e.altKey) {
        // Shift+Enter / Alt+V opens panel
        e.preventDefault();
        onOpenPanel?.();
      } else {
        // Space / Enter toggles voice
        e.preventDefault();
        handleToggleVoiceMode();
      }
    }
  };

  // Text fallback submission
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    const text = manualText.trim();
    setManualText('');
    setTranscript(text);
    handleProcessUtterance(text);
  };

  if (!hasAccess) return null;
  if (typeof document === 'undefined') return null;

  // Responsive button bottom offset
  const buttonBottomOffset = isBottomPlayerVisible
    ? (isMobile ? 'calc(136px + env(safe-area-inset-bottom, 0px))' : '88px')
    : (isMobile ? 'calc(70px + env(safe-area-inset-bottom, 0px))' : '24px');

  const panelBottomOffset = isBottomPlayerVisible
    ? (isMobile ? 'calc(136px + 124px + 10px + env(safe-area-inset-bottom, 0px))' : 'calc(88px + 124px + 12px)')
    : (isMobile ? 'calc(70px + 124px + 10px + env(safe-area-inset-bottom, 0px))' : 'calc(24px + 124px + 12px)');

  const dynamicScale = 1.0 + voiceVolumeScale * 0.22;
  const dynamicGlowOpacity = Math.min(1.0, 0.45 + voiceVolumeScale * 0.55);

  return ReactDOM.createPortal(
    <>
      {/* ============================================================= */}
      {/* SHARED FLOATING ACTION CONTAINER (Both Assistant Icons)       */}
      {/* Vertically arranged column with aligned centers               */}
      {/* ============================================================= */}
      <div
        className="loopra-floating-assistants-bar flex flex-col items-center justify-end gap-3 w-14 h-auto pointer-events-auto"
        style={{
          '--ai-button-bottom': buttonBottomOffset,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
          width: '56px',
          height: 'auto'
        }}
      >
        {/* 1. Voice Control Agent Floating Icon */}
        <button
          type="button"
          onPointerDown={handleVoicePointerDown}
          onPointerMove={handleVoicePointerMove}
          onPointerUp={handleVoicePointerUp}
          onPointerCancel={handleVoicePointerCancel}
          onContextMenu={(e) => {
            e.preventDefault();
            onOpenPanel?.();
          }}
          onKeyDown={handleVoiceKeyDown}
          className={`voice-agent-floating-button group relative flex items-center justify-center w-14 h-14 rounded-full active:scale-95 cursor-pointer pointer-events-auto transition-transform duration-150 select-none ${
            isSessionActive ? 'scale-105' : 'hover:scale-105'
          }`}
          aria-label={`Loopra Voice Agent (${isSessionActive ? 'Active' : 'Inactive'}). Click to toggle, long-press to open panel.`}
          title={`Voice Agent: ${isSessionActive ? 'ON' : 'OFF'} (Click: Toggle | Long-press: Panel)`}
        >
          {/* Dynamic Voice Activity Glowing Halo */}
          <span
            style={{
              transform: `scale(${dynamicScale})`,
              opacity: isSessionActive ? dynamicGlowOpacity : 0.35
            }}
            className={`absolute -inset-2 rounded-full blur-md transition-all duration-75 pointer-events-none ${
              status === 'listening'
                ? 'bg-gradient-to-tr from-amber-500 via-orange-400 to-amber-300'
                : status === 'executing'
                ? 'bg-gradient-to-tr from-cyan-500 via-blue-400 to-cyan-300 animate-spin-slow'
                : status === 'success'
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400'
                : status === 'error'
                ? 'bg-gradient-to-tr from-rose-500 to-red-400'
                : isSessionActive
                ? 'bg-emerald-500/30'
                : 'bg-amber-500/20'
            }`}
          />

          {/* Central Swirling Glass Sphere */}
          <div className={`relative w-full h-full rounded-full bg-neutral-950/95 border-2 shadow-2xl overflow-hidden flex items-center justify-center transition-colors ${
            isSessionActive ? 'border-emerald-400/80 shadow-emerald-500/20' : 'border-amber-400/60 shadow-amber-500/20'
          }`}>
            <div
              style={{
                transform: `scale(${1 + voiceVolumeScale * 0.25}) rotate(${isListening ? '45deg' : '0deg'})`
              }}
              className={`absolute inset-0 bg-gradient-to-br from-amber-500/40 via-orange-500/30 to-amber-600/40 opacity-80 transition-transform duration-100 ${
                isSessionActive ? 'animate-pulse' : ''
              }`}
            />

            {/* Central Icon */}
            <div className="relative z-10 flex items-center justify-center">
              {status === 'executing' ? (
                <Sparkles className="w-6 h-6 animate-spin text-cyan-300 drop-shadow-md" />
              ) : status === 'success' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-300 drop-shadow-md" />
              ) : status === 'error' ? (
                <AlertTriangle className="w-6 h-6 text-rose-300 drop-shadow-md" />
              ) : isSessionActive ? (
                <Mic className="w-6 h-6 text-emerald-300 animate-pulse drop-shadow-md" />
              ) : (
                <Mic className="w-5 h-5 text-amber-400/90 group-hover:text-amber-300 transition-colors" />
              )}
            </div>

            {/* Active Green Status Indicator Dot */}
            {isSessionActive && (
              <span className="absolute bottom-1 w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-ping" />
            )}
          </div>

          {/* Desktop Hover Label */}
          <span className="absolute right-16 top-1/2 -translate-y-1/2 hidden md:group-hover:inline-block px-3 py-1.5 bg-neutral-900/95 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl shadow-xl whitespace-nowrap pointer-events-none backdrop-blur-md">
            {isSessionActive ? 'Voice Mode: ON (Click to Off • Long-press for Panel)' : 'Voice Mode: OFF (Click to Start • Long-press for Panel)'}
          </span>
        </button>

        {/* 2. Loopra AI Floating Assistant Icon */}
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

      {/* ============================================================= */}
      {/* VOICE CONTROL AGENT PANEL (HUD)                                */}
      {/* Displayed ONLY when isPanelOpen is true (Single panel exclusivity)*/}
      {/* ============================================================= */}
      {isPanelOpen && (
        <div
          style={{
            '--ai-panel-bottom': panelBottomOffset
          }}
          className="voice-agent-hud-panel bg-neutral-950/95 border border-amber-500/40 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(245,158,11,0.2)] backdrop-blur-2xl animate-fadeIn text-neutral-100 flex flex-col gap-3"
        >
          {/* Top Bar: Title, Continuous Mode Status & Controls */}
          <div className="flex items-center justify-between pb-2.5 border-b border-neutral-800/80">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isSessionActive ? 'bg-emerald-400' : 'bg-neutral-500'} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSessionActive ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
              </span>
              <div>
                <h4 className="text-xs font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  <span>Hey Loopra</span>
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                    isSessionActive
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}>
                    {isSessionActive ? 'Live Continuous' : 'Session Inactive'}
                  </span>
                </h4>
                <p className="text-[10px] text-neutral-400">Natural Language Music Agent</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Language Selector */}
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="bg-neutral-900 text-neutral-300 text-[10px] font-semibold rounded-lg px-2 py-1 border border-neutral-800 outline-none cursor-pointer"
                title="Recognition Language"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.label}
                  </option>
                ))}
              </select>

              {/* Power / Toggle Session Button */}
              <button
                type="button"
                onClick={handleToggleVoiceMode}
                className={`p-1.5 rounded-lg border transition cursor-pointer text-xs ${
                  isSessionActive
                    ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30'
                }`}
                title={isSessionActive ? 'Turn Voice Mode Off' : 'Turn Voice Mode On'}
              >
                <Power className="w-3.5 h-3.5" />
              </button>

              {/* Close Panel Button */}
              <button
                type="button"
                onClick={onClosePanel}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                title="Close panel (keeps voice mode active in background)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Active Voice Activity Feedback */}
          <div className="py-2 flex flex-col items-center justify-center gap-2 text-center">
            {/* Live Audio Activity Waveform Bars */}
            <div className="flex items-center gap-1 h-6 px-3">
              {[0.4, 0.8, 1.2, 0.6, 1.0, 0.7, 0.5].map((multiplier, idx) => {
                const barHeight = Math.max(4, Math.round((voiceVolumeScale * multiplier + 0.15) * 24));
                return (
                  <span
                    key={idx}
                    style={{ height: `${barHeight}px` }}
                    className={`w-1 rounded-full transition-all duration-75 ${
                      status === 'listening'
                        ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                        : status === 'executing'
                        ? 'bg-cyan-400 shadow-sm shadow-cyan-400/50'
                        : status === 'success'
                        ? 'bg-emerald-400'
                        : 'bg-neutral-700'
                    }`}
                  />
                );
              })}
            </div>

            {/* Recognized Speech or Status Notice */}
            <div className="w-full px-3 py-2 rounded-2xl bg-neutral-900/90 border border-neutral-800/80 text-center min-h-[44px] flex items-center justify-center">
              {transcript || interimText ? (
                <p className="text-xs font-bold text-amber-200 leading-snug break-words">
                  "{transcript || interimText}"
                </p>
              ) : (
                <p className="text-[11px] text-neutral-400 italic">
                  {statusMessage}
                </p>
              )}
            </div>

            {/* Action Execution Pill */}
            {activeActionLabel && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" />
                {activeActionLabel}
              </span>
            )}
          </div>

          {/* Quick Voice Prompt Shortcuts */}
          <div className="flex flex-wrap gap-1">
            {[
              'Open listening history',
              'Open liked songs',
              'Weekly recap',
              'Play Kesariya and like it',
              'Pause',
              'Next song',
              'Volume 40',
              'Done Loopra'
            ].map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => handleProcessUtterance(cmd)}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-900 hover:bg-amber-500/20 text-neutral-300 hover:text-amber-300 border border-neutral-800 hover:border-amber-500/40 transition cursor-pointer active:scale-95"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Text Fallback Input */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-neutral-800/80 flex items-center gap-1.5">
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder='Type a command (e.g. "play Kesariya and like it")...'
              className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-amber-500/50 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 outline-none transition"
            />
            <button
              type="submit"
              disabled={!manualText.trim()}
              className="px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs disabled:opacity-40 transition cursor-pointer"
            >
              Run
            </button>
          </form>
        </div>
      )}
    </>,
    document.body
  );
}
