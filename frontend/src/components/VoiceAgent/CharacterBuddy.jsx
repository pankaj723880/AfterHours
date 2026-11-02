import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  X,
  Zap,
  Send,
  Loader2,
  Volume2,
  VolumeX
} from 'lucide-react';
import { voiceBuddyService, CHARACTERS } from '../../services/voiceBuddyService';
import TwoDCharacter from './TwoDCharacter';

export default function CharacterBuddy({
  isSessionActive = false,
  isListening = false,
  isPlaying = false,
  sessionState = 'OFF',
  voiceVolumeScale = 0,
  userTranscript = '',
  interimTranscript = '',
  statusMessage = '',
  onToggleVoiceMode = () => {},
  onSubmitTextCommand = () => {}
}) {
  const [characterKey, setCharacterKey] = useState(() => voiceBuddyService.activeCharacterKey);
  const [character, setCharacter] = useState(() => voiceBuddyService.getActiveCharacter());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceOutputEnabled, setIsVoiceOutputEnabled] = useState(() => voiceBuddyService.isVoiceOutputEnabled);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Responsive dimensions: ~240px tall on desktop, ~170px tall on mobile
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const characterWidth = isMobileScreen ? 145 : 200;
  const characterHeight = isMobileScreen ? 185 : 265;

  // Intended text command input state (inside character control menu)
  const [commandText, setCommandText] = useState('');
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  // Real-time animation states: 'idle' | 'listening' | 'speaking' | 'walking' | 'running' | 'tapping' | 'celebrating'
  const [animationState, setAnimationState] = useState('idle');
  const [walkOffset, setWalkOffset] = useState({ x: 0, y: 0 });
  const [walkFacing, setWalkFacing] = useState('left');
  const [tapRipple, setTapRipple] = useState(null);

  // Mouse / cursor tracking offset for interactive gaze
  const [cursorOffset, setCursorOffset] = useState({ x: 0, y: 0 });
  const walkerRef = useRef(null);

  // Interaction timer refs for clicks, double-click and long-press
  const longPressTimerRef = useRef(null);
  const clickTimerRef = useRef(null);
  const clickCountRef = useRef(0);
  const transientAnimTimerRef = useRef(null);
  const isPointerDownRef = useRef(false);
  const didLongPressRef = useRef(false);
  const menuRef = useRef(null);

  // Cursor tracking listener: Character eyes & head follow cursor when idle
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!walkerRef.current) return;
      const rect = walkerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height * 0.25;
      setCursorOffset({
        x: e.clientX - centerX,
        y: e.clientY - centerY
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Play transient gesture (wave, wink, pose, dance, jump) and smoothly return to resting state
  const playTransientGesture = useCallback((gestureState, durationMs = 1500) => {
    clearTimeout(transientAnimTimerRef.current);
    setAnimationState(gestureState);
    transientAnimTimerRef.current = setTimeout(() => {
      setAnimationState(isListening ? 'listening' : isSpeaking ? 'speaking' : 'idle');
    }, durationMs);
  }, [isListening, isSpeaking]);

  // Temporary User Command Display State (Auto-disappears after 2 seconds)
  const [visibleUserCommand, setVisibleUserCommand] = useState('');
  const [isUserCommandVisible, setIsUserCommandVisible] = useState(false);
  const [isUserCommandFading, setIsUserCommandFading] = useState(false);
  const userCommandTimerRef = useRef(null);
  const userCommandFadeTimerRef = useRef(null);

  // Temporary AI Response Display State (Auto-disappears 2 seconds after finishing)
  const [visibleAiReply, setVisibleAiReply] = useState('');
  const [isAiReplyVisible, setIsAiReplyVisible] = useState(false);
  const [isAiReplyFading, setIsAiReplyFading] = useState(false);
  const aiReplyTimerRef = useRef(null);
  const aiReplyFadeTimerRef = useRef(null);

  // Sync isPlaying state to voiceBuddyService
  useEffect(() => {
    voiceBuddyService.setPlaybackActive(isPlaying);
  }, [isPlaying]);

  // Subscribe to voiceBuddyService
  useEffect(() => {
    const unsub = voiceBuddyService.subscribe(({ event, character: activeChar, text, enabled }) => {
      if (event === 'character_change') {
        setCharacterKey(voiceBuddyService.activeCharacterKey);
        setCharacter(activeChar);
      } else if (event === 'voice_output_change') {
        setIsVoiceOutputEnabled(enabled !== undefined ? enabled : voiceBuddyService.isVoiceOutputEnabled);
      } else if (event === 'speech_start') {
        setIsSpeaking(true);
        setAnimationState('speaking');

        // Show AI reply immediately; keep visible while speaking
        clearTimeout(aiReplyTimerRef.current);
        clearTimeout(aiReplyFadeTimerRef.current);
        setVisibleAiReply(text || '');
        setIsAiReplyFading(false);
        setIsAiReplyVisible(true);
      } else if (event === 'speech_end') {
        setIsSpeaking(false);
        setAnimationState(isListening ? 'listening' : 'idle');

        // Spoken audio finished -> start 2-second timer to fade out and hide
        clearTimeout(aiReplyTimerRef.current);
        clearTimeout(aiReplyFadeTimerRef.current);
        aiReplyTimerRef.current = setTimeout(() => {
          setIsAiReplyFading(true);
          aiReplyFadeTimerRef.current = setTimeout(() => {
            setIsAiReplyVisible(false);
            setIsAiReplyFading(false);
          }, 300);
        }, 2000);
      } else if (event === 'speech_text_only') {
        // Voice output suppressed (music playing or voice output disabled) -> display text only
        clearTimeout(aiReplyTimerRef.current);
        clearTimeout(aiReplyFadeTimerRef.current);
        setVisibleAiReply(text || '');
        setIsAiReplyFading(false);
        setIsAiReplyVisible(true);

        // Auto-disappear 2 seconds after displaying
        aiReplyTimerRef.current = setTimeout(() => {
          setIsAiReplyFading(true);
          aiReplyFadeTimerRef.current = setTimeout(() => {
            setIsAiReplyVisible(false);
            setIsAiReplyFading(false);
          }, 300);
        }, 2000);
      }
    });

    return () => {
      unsub();
      clearTimeout(aiReplyTimerRef.current);
      clearTimeout(aiReplyFadeTimerRef.current);
      clearTimeout(userCommandTimerRef.current);
      clearTimeout(userCommandFadeTimerRef.current);
    };
  }, [isListening]);

  // Auto-disappear handler for recognized user command transcript
  useEffect(() => {
    const text = (userTranscript || interimTranscript || '').trim();
    if (!text) return;

    clearTimeout(userCommandTimerRef.current);
    clearTimeout(userCommandFadeTimerRef.current);

    setVisibleUserCommand(text);
    setIsUserCommandFading(false);
    setIsUserCommandVisible(true);

    // If final transcript, start 2-second dismiss timer
    if (userTranscript) {
      userCommandTimerRef.current = setTimeout(() => {
        setIsUserCommandFading(true);
        userCommandFadeTimerRef.current = setTimeout(() => {
          setIsUserCommandVisible(false);
          setIsUserCommandFading(false);
        }, 300);
      }, 2000);
    }
  }, [userTranscript, interimTranscript]);

  // Sync listening state to animationState when not actively walking or tapping
  useEffect(() => {
    if (animationState !== 'walking' && animationState !== 'running' && animationState !== 'tapping' && !isSpeaking) {
      if (isListening) {
        setAnimationState('listening');
      } else {
        setAnimationState('idle');
      }
    }
  }, [isListening, isSpeaking, animationState]);

  // Close voice selection menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [isMenuOpen]);

  // Interactive Pointer Handling:
  // - Single click: Wave animation
  // - Double click: Wink animation
  // - Long press (400ms): Playful pose + open menu
  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    didLongPressRef.current = false;
    isPointerDownRef.current = true;

    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (isPointerDownRef.current) {
        didLongPressRef.current = true;
        try { navigator.vibrate?.([40]); } catch (_) {}
        playTransientGesture('pose', 2200);
        setIsMenuOpen(true);
      }
    }, 420);
  };

  const handlePointerUp = (e) => {
    clearTimeout(longPressTimerRef.current);
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (didLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didLongPressRef.current = false;
      return;
    }

    e.preventDefault();
    clickCountRef.current += 1;

    if (clickCountRef.current === 1) {
      // First click: wait 250ms for possible second click
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
        // SINGLE CLICK -> WAVE!
        playTransientGesture('wave', 1500);
        onToggleVoiceMode();
      }, 250);
    } else if (clickCountRef.current >= 2) {
      // DOUBLE CLICK -> WINK!
      clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;
      playTransientGesture('wink', 1300);
    }
  };

  const handleSelectCharacter = (key) => {
    voiceBuddyService.setCharacter(key);
    setIsMenuOpen(false);
    const isMale = key === 'male';
    const introMsg = isMale
      ? 'Bilkul! Loopra ready hai, bataiye kya sunna chahenge aap?'
      : 'Haan bilkul! Loopra ready hai, batao kya play karun?';
    voiceBuddyService.speak(introMsg);
  };

  const handleToggleVoiceOutput = (e) => {
    e?.stopPropagation?.();
    const newState = voiceBuddyService.toggleVoiceOutput();
    setIsVoiceOutputEnabled(newState);
  };

  /**
   * Ground-Based Physical Movement & Tapping Engine
   * Moves ONLY the 3D character walker container.
   * Calculates movement from the character's top dock station below the navbar
   * to any target element across the entire website.
   */
  const walkToTargetAndTap = useCallback((targetNavId, label = '', onFinished) => {
    if (typeof document === 'undefined') {
      onFinished?.();
      return;
    }

    const cleanTarget = (targetNavId || '').toLowerCase().trim();
    
    // Find target DOM element
    let targetEl = document.querySelector(`[data-nav-id="${cleanTarget}"]`);
    if (!targetEl) {
      targetEl = document.querySelector(`[data-nav-id="${cleanTarget === 'saloon' ? 'barber' : cleanTarget}"]`);
    }
    if (!targetEl) {
      targetEl = document.querySelector(`a[href*="${cleanTarget}"]`);
    }
    if (!targetEl) {
      const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
      targetEl = candidates.find(el => {
        const text = (el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || '').toLowerCase();
        return text.includes(cleanTarget) || (label && text.includes(label.toLowerCase()));
      });
    }

    if (!targetEl) {
      onFinished?.();
      return;
    }

    // Handle viewport scrolling if element is currently off-screen
    const viewportRect = targetEl.getBoundingClientRect();
    const isOffScreen = viewportRect.top < 60 || viewportRect.bottom > window.innerHeight - 80;

    const startTravel = () => {
      const targetRect = targetEl.getBoundingClientRect();
      const characterEl = document.getElementById('loopra-3d-character-walker') || document.getElementById('loopra-3d-character-container');
      const startRect = characterEl
        ? characterEl.getBoundingClientRect()
        : { left: window.innerWidth - 120, top: 100, width: 200, height: 265 };

      // Calculate center-to-center offset vector
      const deltaX = (targetRect.left + targetRect.width / 2) - (startRect.left + startRect.width / 2);
      const deltaY = (targetRect.top + targetRect.height / 2) - (startRect.top + startRect.height * 0.7);

      const distance = Math.hypot(deltaX, deltaY);
      const isRun = distance > 320;
      const travelDuration = isRun ? 800 : 600;

      // 1. Turn towards destination and begin physical stride
      setWalkFacing(deltaX < 0 ? 'left' : 'right');
      setAnimationState(isRun ? 'running' : 'walking');
      setWalkOffset({ x: deltaX, y: deltaY });

      // 2. Arrive at target precisely
      setTimeout(() => {
        // 3. Physical Tapping gesture
        setAnimationState('tapping');
        setTapRipple({
          x: targetRect.left + targetRect.width / 2,
          y: targetRect.top + targetRect.height / 2
        });

        // 4. Trigger target action
        onFinished?.();

        setTimeout(() => {
          setTapRipple(null);
          setAnimationState('celebrating');
        }, 400);

        // 5. Walk/Run back to home dock below navbar
        setTimeout(() => {
          setWalkFacing(deltaX < 0 ? 'right' : 'left');
          setAnimationState(isRun ? 'running' : 'walking');
          setWalkOffset({ x: 0, y: 0 });

          setTimeout(() => {
            setAnimationState('idle');
            setWalkFacing('left');
          }, travelDuration);
        }, 850);

      }, travelDuration);
    };

    if (isOffScreen) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(startTravel, 350);
    } else {
      startTravel();
    }
  }, []);

  // Expose walk handler to window
  useEffect(() => {
    window.__loopraWalkAndTap = walkToTargetAndTap;
    return () => {
      delete window.__loopraWalkAndTap;
    };
  }, [walkToTargetAndTap]);

  // Quick suggestion chips for rapid one-tap interaction
  const quickSuggestions = [
    'Saloon FM kholo',
    'Play 5 songs of Arijit Singh',
    'Trending songs',
    'Horn Ok Please',
    'Radio chalao',
    'Pause'
  ];

  // Execute a text command (from input or quick suggestion chip)
  const handleExecuteCommand = async (rawText) => {
    const text = (rawText || '').trim();
    if (!text || isProcessingCommand) return;
    setCommandText('');
    setIsProcessingCommand(true);
    setIsMenuOpen(false); // Close dropdown so user can watch character walk and perform action

    // Show recognized user command temporarily (fades out after 2 seconds)
    clearTimeout(userCommandTimerRef.current);
    clearTimeout(userCommandFadeTimerRef.current);
    setVisibleUserCommand(text);
    setIsUserCommandFading(false);
    setIsUserCommandVisible(true);

    userCommandTimerRef.current = setTimeout(() => {
      setIsUserCommandFading(true);
      userCommandFadeTimerRef.current = setTimeout(() => {
        setIsUserCommandVisible(false);
        setIsUserCommandFading(false);
      }, 300);
    }, 2000);

    try {
      if (onSubmitTextCommand) {
        await onSubmitTextCommand(text);
      }
    } finally {
      setIsProcessingCommand(false);
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    handleExecuteCommand(commandText);
  };

  return (
    <>
      {/* Golden Energy Tap Ripple Effect */}
      {tapRipple && (
        <div
          style={{
            left: `${tapRipple.x}px`,
            top: `${tapRipple.y}px`,
            position: 'fixed',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 99999999
          }}
          className="w-28 h-28 rounded-full border-4 border-amber-400 bg-amber-400/30 animate-ping shadow-[0_0_35px_#f59e0b]"
        />
      )}

      {/* ============================================================= */}
      {/* STATIONARY DOCK CONTAINER (Standing below navbar on content)    */}
      {/* ============================================================= */}
      <div
        id="loopra-3d-character-container"
        className={`relative select-none pointer-events-auto flex flex-col items-center ${
          isMobileScreen ? 'w-36' : 'w-52'
        }`}
      >
        {/* ======================================================= */}
        {/* LAYER 1: TEMPORARY CONVERSATION TEXT BOXES (STATIONARY)  */}
        {/* 60% Opacity • Subtle Backdrop Blur • Auto-disappears in 2s*/}
        {/* ======================================================= */}

        {/* 1A. TEMPORARY USER INPUT COMMAND BOX (Sky Blue Glass) */}
        {isUserCommandVisible && visibleUserCommand && (
          <div
            className={`absolute right-[calc(100%+16px)] bottom-2 w-72 sm:w-80 max-w-[calc(100vw-120px)] p-3 rounded-2xl bg-sky-950/60 border border-sky-400/40 shadow-[0_10px_30px_rgba(14,165,233,0.2)] backdrop-blur-md pointer-events-none z-50 transition-opacity duration-300 ${
              isUserCommandFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase font-bold text-sky-400 tracking-wider">
              <span className="w-4 h-4 rounded-full bg-sky-500/20 flex items-center justify-center text-[9px] text-sky-300">👤</span>
              <span>You said</span>
            </div>
            <p className="text-xs font-bold text-sky-100 leading-snug break-words">
              "{visibleUserCommand}"
            </p>
          </div>
        )}

        {/* 1B. TEMPORARY LOOPRA AI RESPONSE BOX (Warm Dark Gold Glass) */}
        {isAiReplyVisible && visibleAiReply && (
          <div
            style={{ borderColor: `${character.color}60` }}
            className={`absolute right-[calc(100%+16px)] bottom-2 w-72 sm:w-80 max-w-[calc(100vw-120px)] p-3.5 rounded-2xl bg-neutral-950/60 border shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-md z-50 transition-opacity duration-300 ${
              isAiReplyFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-800/80">
              <div className="flex items-center gap-2">
                {character.avatarImg ? (
                  <div className="w-5 h-5 rounded-full overflow-hidden border border-amber-400/60 bg-amber-950/40 shrink-0">
                    <img src={character.avatarImg} alt={character.name} className="w-full h-full object-cover object-top" />
                  </div>
                ) : (
                  <span className="text-base">{character.avatarEmoji}</span>
                )}
                <span className="text-xs font-black text-white tracking-wide">Loopra</span>
                <span
                  style={{ backgroundColor: `${character.color}25`, color: character.color }}
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1"
                >
                  <span className={`w-1.5 h-1.5 rounded-full bg-current ${isSpeaking ? 'animate-ping' : ''}`} />
                  {isSpeaking ? 'Speaking' : 'Replied'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                <Zap className="w-3 h-3 text-emerald-400 animate-pulse fill-emerald-400" />
                <span>Fast</span>
              </div>
            </div>

            <p className="text-xs font-bold text-neutral-100 leading-snug break-words">
              {visibleAiReply}
            </p>

            {/* Audio Wave Equalizer (visible only when actively speaking) */}
            {isSpeaking && (
              <div className="flex items-center gap-0.5 mt-2 h-2.5">
                {[0.4, 0.9, 1.3, 0.7, 1.1, 0.5, 1.0, 0.6].map((mult, idx) => (
                  <span
                    key={idx}
                    style={{
                      backgroundColor: character.color,
                      height: `${Math.max(4, Math.round(mult * 10))}px`
                    }}
                    className="w-1 rounded-full transition-all duration-100"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 1C. IDLE LISTENING BUBBLE */}
        {isSessionActive && !isUserCommandVisible && !isAiReplyVisible && animationState !== 'walking' && animationState !== 'running' && (
          <div className="absolute right-[calc(100%+16px)] bottom-12 px-3 py-1.5 rounded-2xl bg-neutral-950/60 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-xl backdrop-blur-md pointer-events-none whitespace-nowrap animate-pulse flex items-center gap-1.5 z-40">
            <Mic className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            <span>I'm listening...</span>
          </div>
        )}

        {/* ======================================================= */}
        {/* LAYER 2: STATIONARY VOICE CONTROLS & COMMAND INTERFACE   */}
        {/* ======================================================= */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="absolute right-[calc(100%+16px)] bottom-0 w-80 max-w-[calc(100vw-120px)] p-4 rounded-3xl bg-neutral-950/98 border border-amber-500/40 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_25px_rgba(245,158,11,0.2)] backdrop-blur-xl z-50 animate-fadeIn"
          >
            {/* Visual Arrow pointing right to character */}
            <div className="absolute -right-2 bottom-12 w-0 h-0 border-y-8 border-y-transparent border-l-8 border-l-neutral-950 pointer-events-none hidden sm:block" />

            <div className="pb-2 mb-2.5 border-b border-neutral-800/80 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-extrabold text-white tracking-wide">Loopra Character & Voice</h4>
                <p className="text-[10px] text-neutral-400">Casual • Fast Indian Hindi Accent</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Voice Output Toggle Row inside Menu */}
            <div className="flex items-center justify-between p-2 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 mb-2.5">
              <div className="flex items-center gap-2">
                {isVoiceOutputEnabled ? (
                  <Volume2 className="w-4 h-4 text-amber-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-neutral-400" />
                )}
                <div>
                  <p className="text-xs font-bold text-white">Voice Output (TTS)</p>
                  <p className="text-[10px] text-neutral-400">
                    {isVoiceOutputEnabled ? 'AI speaks responses' : 'Text only (Silent)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleVoiceOutput}
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition cursor-pointer border ${
                  isVoiceOutputEnabled
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                {isVoiceOutputEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Six Core Avatar Capabilities */}
            <div className="p-2.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 mb-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <span>✨</span>
                  <span>AI Companion Features</span>
                </span>
                <span className="text-[9px] text-neutral-400 font-semibold">Live 2D Rig</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {[
                  { label: 'Interactive', icon: '✨', hint: '1-click wave' },
                  { label: 'Animated', icon: '🎭', hint: 'Skeletal rig' },
                  { label: 'Clickable', icon: '👆', hint: '2-click wink' },
                  { label: 'Website-Wide', icon: '🌐', hint: 'All routes' },
                  { label: 'Male / Female', icon: '👥', hint: 'Dual avatars' },
                  { label: 'Multiple Actions', icon: '⚡', hint: 'Dance, walk' },
                ].map((feat, i) => (
                  <div key={i} className="p-1 rounded-xl bg-neutral-950/90 border border-neutral-800/80 flex flex-col items-center">
                    <span className="text-xs mb-0.5">{feat.icon}</span>
                    <span className="text-[9px] font-bold text-white tracking-tight leading-none">{feat.label}</span>
                    <span className="text-[7.5px] text-neutral-400 mt-0.5">{feat.hint}</span>
                  </div>
                ))}
              </div>

              {/* Real-time Gesture Triggers */}
              <div className="mt-2 pt-1.5 border-t border-neutral-800/60 flex items-center justify-between gap-1">
                <span className="text-[8.5px] font-bold text-neutral-400 uppercase tracking-wider">Test:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { label: 'Wave', state: 'wave', dur: 1500 },
                    { label: 'Wink', state: 'wink', dur: 1300 },
                    { label: 'Dance', state: 'dance', dur: 2500 },
                    { label: 'Jump', state: 'jump', dur: 1200 },
                    { label: 'Think', state: 'think', dur: 1800 }
                  ].map((act, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => playTransientGesture(act.state, act.dur)}
                      className="px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-amber-500/20 text-[9px] font-bold text-neutral-300 hover:text-amber-300 border border-neutral-700/80 hover:border-amber-500/40 transition cursor-pointer"
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Voice Selection Options */}
            <div className="space-y-1.5">
              {/* Option 1: Loopra Male Voice */}
              <button
                type="button"
                onClick={() => handleSelectCharacter('male')}
                className={`w-full flex items-center justify-between p-2 rounded-2xl transition cursor-pointer text-left border ${
                  characterKey === 'male'
                    ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10'
                    : 'bg-neutral-900/60 hover:bg-neutral-900 border-neutral-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400/60 bg-amber-950/40 shrink-0 flex items-center justify-center">
                    <img
                      src="/characters/male_bust.png"
                      alt="Loopra Male"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <span>Loopra (Male Voice)</span>
                    </h5>
                    <p className="text-[10px] text-neutral-400">Natural Indian Male • Casual Bro</p>
                  </div>
                </div>

                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${characterKey === 'male' ? 'border-amber-400 bg-amber-400' : 'border-neutral-600'}`}>
                  {characterKey === 'male' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                </div>
              </button>

              {/* Option 2: Loopra Female Voice */}
              <button
                type="button"
                onClick={() => handleSelectCharacter('female')}
                className={`w-full flex items-center justify-between p-2 rounded-2xl transition cursor-pointer text-left border ${
                  characterKey === 'female'
                    ? 'bg-emerald-500/15 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                    : 'bg-neutral-900/60 hover:bg-neutral-900 border-neutral-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-400/60 bg-emerald-950/40 shrink-0 flex items-center justify-center">
                    <img
                      src="/characters/female_bust.png"
                      alt="Loopra Female"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <span>Loopra (Female Voice)</span>
                    </h5>
                    <p className="text-[10px] text-neutral-400">Natural Indian Female • Sweet Bestie</p>
                  </div>
                </div>

                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${characterKey === 'female' ? 'border-emerald-400 bg-emerald-400' : 'border-neutral-600'}`}>
                  {characterKey === 'female' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                </div>
              </button>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="mt-2.5 pt-2 border-t border-neutral-800/80">
              <div className="text-[10px] font-bold text-neutral-400 mb-1.5 flex items-center gap-1">
                <span>⚡</span>
                <span>Quick Commands</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {quickSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleExecuteCommand(suggestion)}
                    className="px-2 py-0.5 rounded-full bg-neutral-900 hover:bg-amber-500/20 text-[10px] text-neutral-300 hover:text-amber-300 border border-neutral-800 hover:border-amber-500/40 transition cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Intended Command Input Interface */}
            <form onSubmit={handleTextSubmit} className="mt-2.5 flex items-center gap-1.5">
              <input
                type="text"
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                placeholder="Type command (e.g. 'Saloon FM kholo')..."
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-amber-400 text-xs text-white placeholder-neutral-500 outline-none transition min-w-0"
              />
              <button
                type="submit"
                disabled={!commandText.trim() || isProcessingCommand}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 text-black text-xs font-black flex items-center gap-1 transition cursor-pointer shadow-lg shrink-0"
              >
                {isProcessingCommand ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Run</span>
                    <Send className="w-3 h-3 ml-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-2 text-center">
              <p className="text-[9px] text-neutral-500">
                Hold character anytime to change voice • Speak or type commands
              </p>
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* LAYER 3: INDEPENDENT 2D PUPPET CHARACTER WALKER        */}
        {/* ONLY THIS CONTAINER TRANSLATES! TEXT BOXES STAY STILL! */}
        {/* ======================================================= */}
        <div
          ref={walkerRef}
          id="loopra-3d-character-walker"
          style={{
            transform: `translate3d(${walkOffset.x}px, ${walkOffset.y}px, 0)`,
            transition: animationState === 'running' 
              ? 'transform 0.8s cubic-bezier(0.2, 0.9, 0.4, 1)' 
              : animationState === 'walking' 
              ? 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)' 
              : 'transform 0.3s ease-out'
          }}
          className={`relative flex flex-col items-center justify-center cursor-pointer select-none ${
            animationState === 'walking' || animationState === 'running' ? 'z-[9999999]' : ''
          }`}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onContextMenu={(e) => {
            e.preventDefault();
            playTransientGesture('pose', 2000);
            setIsMenuOpen(true);
          }}
          title={`${character.name} • 1-Click: Wave • 2-Click: Wink • Hold: Pose & Menu`}
        >
          {/* Prominent Articulated 2D Skeletal Puppet (~240px desktop, ~170px mobile) */}
          <div
            style={{ width: `${characterWidth}px`, height: `${characterHeight}px` }}
            className="relative flex items-center justify-center"
          >
            <TwoDCharacter
              gender={character.gender}
              animationState={animationState}
              isSpeaking={isSpeaking}
              isListening={isListening}
              voiceVolumeScale={voiceVolumeScale}
              facing={walkFacing}
              cursorOffset={cursorOffset}
              width={characterWidth}
              height={characterHeight}
            />
          </div>

          {/* Name & Role Badge (travels with character) */}
          <div
            style={{ borderColor: `${character.color}60` }}
            className="absolute -bottom-1.5 px-3 py-1 rounded-full bg-neutral-950/95 border text-[10px] font-black uppercase tracking-wider text-white shadow-2xl flex items-center gap-1.5 backdrop-blur-md"
          >
            <span style={{ color: character.color }}>Loopra</span>
            <span className="text-[8px] text-neutral-400 font-semibold">• {characterKey === 'male' ? 'Male' : 'Female'}</span>
          </div>
        </div>
      </div>
    </>
  );
}
