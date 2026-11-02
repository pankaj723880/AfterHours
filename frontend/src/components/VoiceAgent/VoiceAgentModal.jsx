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
  voiceSessionService,
  SESSION_STATES
} from '../../services/voiceSessionService';
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
  // 1. Permission check via voiceControlService
  const [hasAccess, setHasAccess] = useState(() => {
    const initial = voiceControlService.getAccessState();
    if (user) {
      return voiceControlService.evaluateLocalAccess(initial, user);
    }
    return Boolean(initial.allowed);
  });

  // 2. Authoritative voice session state synchronized from voiceSessionService
  const [sessionState, setSessionState] = useState(SESSION_STATES.OFF);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Voice Agent: OFF (Click mic to speak)');
  const [activeActionLabel, setActiveActionLabel] = useState('');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [manualText, setManualText] = useState('');
  const [selectedLang, setSelectedLang] = useState('en-IN');
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

  // 3. Multi-Step Execution Handler
  // CRITICAL: Does NOT stop the microphone! Speech recognition stays active for subsequent commands.
  const handleProcessUtterance = useCallback(async (rawUtterance = '') => {
    if (!rawUtterance || typeof rawUtterance !== 'string') return;
    const text = rawUtterance.trim();
    if (!text) return;

    // Check for deactivation commands (e.g. "stop listening", "done loopra", "bye loopra")
    const singleParse = parseVoiceCommandLocally(text, persistentContextRef.current);
    if (singleParse && singleParse.action === 'stop_continuous') {
      voiceSessionService.stopSession('manual');
      showToast?.('Voice session stopped');
      return;
    }

    // Parse into dependency-aware ordered steps
    const steps = parseMultiStepInstruction(text, persistentContextRef.current);

    if (steps.length === 0) {
      voiceSessionService.notifyExecutionFinish('Command not recognized. Speak your music command.');
      return;
    }

    // Inform session controller that execution has started (transitions state to EXECUTING)
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
        onNavigate,
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

      if (pipelineResult.success) {
        showToast?.(pipelineResult.message);
        voiceSessionService.notifyExecutionFinish(pipelineResult.message);
      } else {
        showToast?.(pipelineResult.message, 'error');
        voiceSessionService.notifyExecutionFinish(pipelineResult.message);
      }
    } catch (err) {
      console.error('[VoiceAgent] Execution error:', err);
      voiceSessionService.notifyExecutionFinish('Execution failed. Please try again.');
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
    showToast
  ]);

  // 4. Subscribe to the Voice Session Controller
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
      showToast?.('Voice Agent: OFF');
    } else {
      showToast?.('Voice Agent: ON (Listening)');
      await voiceSessionService.startSession({ lang: selectedLang });
    }
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setSelectedLang(newLang);
    voiceSessionService.setLanguage(newLang);
  };

  // 6. Interaction: Click vs Long Press Handling
  const longPressTimerRef = useRef(null);
  const pointerStartPosRef = useRef({ x: 0, y: 0 });
  const didLongPressRef = useRef(false);
  const isPointerDownRef = useRef(false);

  const LONG_PRESS_THRESHOLD_MS = 450;
  const POINTER_MOVE_TOLERANCE_PX = 8;

  const handleVoicePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    didLongPressRef.current = false;
    isPointerDownRef.current = true;

    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (isPointerDownRef.current) {
        didLongPressRef.current = true;
        try { navigator.vibrate?.([40]); } catch (_) {}
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
        e.preventDefault();
        onOpenPanel?.();
      } else {
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

  if (typeof document === 'undefined') return null;

  // Responsive button bottom offset
  const buttonBottomOffset = isBottomPlayerVisible
    ? (isMobile ? 'calc(136px + env(safe-area-inset-bottom, 0px))' : '88px')
    : (isMobile ? 'calc(70px + env(safe-area-inset-bottom, 0px))' : '24px');

  const panelBottomOffset = isBottomPlayerVisible
    ? (isMobile ? `calc(136px + ${hasAccess ? '124px' : '56px'} + 10px + env(safe-area-inset-bottom, 0px))` : `calc(88px + ${hasAccess ? '124px' : '56px'} + 12px)`)
    : (isMobile ? `calc(70px + ${hasAccess ? '124px' : '56px'} + 10px + env(safe-area-inset-bottom, 0px))` : `calc(24px + ${hasAccess ? '124px' : '56px'} + 12px)`);

  const dynamicScale = isSessionActive ? Math.min(1.4, 1.0 + voiceVolumeScale * 0.45) : 1.0;
  const dynamicGlowOpacity = isSessionActive ? Math.min(0.95, 0.45 + voiceVolumeScale * 0.5) : 0.35;

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
        {hasAccess && (
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
                sessionState === SESSION_STATES.LISTENING
                  ? 'bg-gradient-to-tr from-amber-500 via-orange-400 to-amber-300'
                  : sessionState === SESSION_STATES.EXECUTING || sessionState === SESSION_STATES.PROCESSING
                  ? 'bg-gradient-to-tr from-cyan-500 via-blue-400 to-cyan-300 animate-spin-slow'
                  : sessionState === SESSION_STATES.ERROR
                  ? 'bg-gradient-to-tr from-rose-500 to-red-400'
                  : isSessionActive
                  ? 'bg-emerald-500/30'
                  : 'bg-amber-500/20'
              }`}
            />

            {/* Central Glass Sphere */}
            <div
              className={`relative w-full h-full rounded-full bg-neutral-950/95 border-2 shadow-2xl overflow-hidden flex items-center justify-center transition-colors ${
                isSessionActive ? 'border-emerald-400/80 shadow-emerald-500/20' : 'border-amber-400/60 shadow-amber-500/20'
              }`}
            >
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
                {sessionState === SESSION_STATES.EXECUTING || sessionState === SESSION_STATES.PROCESSING ? (
                  <Sparkles className="w-6 h-6 animate-spin text-cyan-300 drop-shadow-md" />
                ) : sessionState === SESSION_STATES.ERROR ? (
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
              {isSessionActive ? 'Voice Mode: ON (Click to Off • Auto-off in 60s)' : 'Voice Mode: OFF (Click mic to Start)'}
            </span>
          </button>
        )}

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
      {isPanelOpen && hasAccess && (
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
                  <span>Voice Control</span>
                  <span
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                      isSessionActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    {isSessionActive ? 'Listening' : 'OFF'}
                  </span>
                </h4>
                <p className="text-[10px] text-neutral-400">
                  {isSessionActive ? 'Continuous listening active • Tap mic to stop' : 'Tap microphone button to start voice control'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Language Selector */}
              <select
                value={selectedLang}
                onChange={handleLanguageChange}
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
                      sessionState === SESSION_STATES.LISTENING
                        ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                        : sessionState === SESSION_STATES.EXECUTING || sessionState === SESSION_STATES.PROCESSING
                        ? 'bg-cyan-400 shadow-sm shadow-cyan-400/50'
                        : sessionState === SESSION_STATES.ERROR
                        ? 'bg-rose-400 shadow-sm shadow-rose-400/50'
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
