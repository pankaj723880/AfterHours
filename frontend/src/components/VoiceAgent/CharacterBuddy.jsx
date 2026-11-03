import React, { useState, useEffect, useRef, useCallback } from 'react';
import { voiceBuddyService, CHARACTERS } from '../../services/voiceBuddyService';
import TwoDCharacter from './TwoDCharacter';

/**
 * CharacterBuddy
 * Unified Persistent Loopra AI Female Companion Avatar
 * 
 * Interactions:
 * - Left-Click / Single Tap: Wave gesture + Toggle Voice Mode (listening)
 * - Double-Click / Double Tap: Wink gesture
 * - Right-Click (Desktop) / Long-Press (Mobile): Opens Unified AI Chat Assistant
 * - Faster & Smoother physical website navigation (bipedal running to DOM targets)
 * - Subtle Loopra amber/gold audio waveform when speaking (replaces old SPEAKING label)
 */
export default function CharacterBuddy({
  isSessionActive = false,
  isListening = false,
  isPlaying = false,
  sessionState = 'OFF',
  voiceVolumeScale = 0,
  onToggleVoiceMode = () => {},
  onToggleChat = () => {}
}) {
  const character = CHARACTERS.female;
  const [isSpeaking, setIsSpeaking] = useState(false);

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

  // Real-time animation states: 'idle' | 'listening' | 'speaking' | 'walking' | 'running' | 'tapping' | 'celebrating'
  const [animationState, setAnimationState] = useState('idle');
  const [walkOffset, setWalkOffset] = useState({ x: 0, y: 0 });
  const [walkFacing, setWalkFacing] = useState('left');
  const [moveTransition, setMoveTransition] = useState('transform 0.3s ease-out');
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

  // Play transient gesture (wave, wink, pose, dance, jump, think) and smoothly return to resting state
  const playTransientGesture = useCallback((gestureState, durationMs = 1500) => {
    clearTimeout(transientAnimTimerRef.current);
    setAnimationState(gestureState);
    transientAnimTimerRef.current = setTimeout(() => {
      setAnimationState(isListening ? 'listening' : isSpeaking ? 'speaking' : 'idle');
    }, durationMs);
  }, [isListening, isSpeaking]);

  // Expose gesture trigger to window so chatbox animation test buttons and task engine can trigger it directly
  useEffect(() => {
    window.__loopraPlayGesture = playTransientGesture;
    window.__loopraTriggerAvatarGesture = playTransientGesture;
    return () => {
      delete window.__loopraPlayGesture;
      delete window.__loopraTriggerAvatarGesture;
    };
  }, [playTransientGesture]);

  // Sync isPlaying state to voiceBuddyService
  useEffect(() => {
    try {
      if (typeof voiceBuddyService?.setPlaybackActive === 'function') {
        voiceBuddyService.setPlaybackActive(isPlaying);
      } else if (voiceBuddyService) {
        voiceBuddyService.isPlaybackActive = !!isPlaying;
      }
    } catch (_) {}
  }, [isPlaying]);

  // Subscribe to voiceBuddyService for speech events
  useEffect(() => {
    const unsub = voiceBuddyService.subscribe(({ event }) => {
      if (event === 'speech_start') {
        setIsSpeaking(true);
        setAnimationState('speaking');
      } else if (event === 'speech_end') {
        setIsSpeaking(false);
        setAnimationState(isListening ? 'listening' : 'idle');
      } else if (event === 'speech_text_only') {
        setIsSpeaking(false);
      }
    });

    return () => {
      unsub();
      clearTimeout(transientAnimTimerRef.current);
    };
  }, [isListening]);

  // Sync listening state to animationState when not actively walking or tapping
  useEffect(() => {
    if (animationState !== 'walking' && animationState !== 'running' && animationState !== 'tapping' && animationState !== 'celebrating' && !isSpeaking) {
      if (isListening) {
        setAnimationState('listening');
      } else if (animationState !== 'wave' && animationState !== 'wink' && animationState !== 'dance' && animationState !== 'jump' && animationState !== 'think') {
        setAnimationState('idle');
      }
    }
  }, [isListening, isSpeaking, animationState]);

  // Interactive Pointer Handling:
  // - Single click: Wave animation + toggle voice listening
  // - Double click: Wink animation
  // - Long press (420ms): Open Unified AI Chat Assistant
  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return; // Only primary button
    didLongPressRef.current = false;
    isPointerDownRef.current = true;

    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (isPointerDownRef.current) {
        didLongPressRef.current = true;
        try { navigator.vibrate?.([40]); } catch (_) {}
        playTransientGesture('pose', 1500);
        onToggleChat();
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
      // First click: wait 240ms for possible second click
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
        // SINGLE CLICK -> WAVE & TOGGLE VOICE MODE
        playTransientGesture('wave', 1500);
        onToggleVoiceMode();
      }, 240);
    } else if (clickCountRef.current >= 2) {
      // DOUBLE CLICK -> WINK
      clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;
      playTransientGesture('wink', 1300);
    }
  };

  /**
   * Ground-Based Physical Movement & Tapping Engine
   * Moves the character container directly with smooth acceleration/deceleration.
   * Runs to any target element, taps it, celebrates, and runs back to home dock.
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
      // Fast, responsive, energetic run speed: ~750 px/s
      const travelDuration = Math.round(Math.max(500, Math.min(1400, (distance / 750) * 1000)));
      const isRun = distance > 160;

      // 1. Turn towards destination and begin physical stride with smooth bezier acceleration
      setWalkFacing(deltaX < 0 ? 'left' : 'right');
      setAnimationState(isRun ? 'running' : 'walking');
      setMoveTransition(`transform ${travelDuration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`);
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
        }, 350);

        // 5. Run back to home dock with the exact same animation fidelity
        setTimeout(() => {
          const returnFacing = deltaX < 0 ? 'right' : 'left';
          setWalkFacing(returnFacing);
          setAnimationState(isRun ? 'running' : 'walking');
          setMoveTransition(`transform ${travelDuration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`);
          setWalkOffset({ x: 0, y: 0 });

          // Keep running animation active until arrival + settle buffer
          setTimeout(() => {
            setAnimationState('idle');
            setWalkFacing('left');
            setMoveTransition('transform 0.3s ease-out');
          }, travelDuration + 60);
        }, 750);

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
      {/* STATIONARY DOCK CONTAINER (Standing at persistent assistant pos)*/}
      {/* ============================================================= */}
      <div
        id="loopra-3d-character-container"
        className={`relative select-none pointer-events-auto flex flex-col items-center ${
          isMobileScreen ? 'w-36' : 'w-52'
        }`}
      >
        {/* ======================================================= */}
        {/* LAYER: INDEPENDENT 2D PUPPET CHARACTER WALKER          */}
        {/* ======================================================= */}
        <div
          ref={walkerRef}
          id="loopra-3d-character-walker"
          style={{
            transform: `translate3d(${walkOffset.x}px, ${walkOffset.y}px, 0)`,
            transition: moveTransition
          }}
          className={`relative flex flex-col items-center justify-center cursor-pointer select-none ${
            animationState === 'walking' || animationState === 'running' ? 'z-[9999999]' : ''
          }`}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onContextMenu={(e) => {
            e.preventDefault();
            playTransientGesture('wave', 1200);
            onToggleChat?.();
          }}
          title="Loopra AI • Left-Click: Wave & Voice • Right-Click / Hold: Chat Assistant"
        >
          {/* Subtle Loopra Amber Audio Waveform (shown ONLY when Loopra is actively speaking) */}
          {/* Replaces any old text SPEAKING label with 60% opacity gold equalizer */}
          {isSpeaking && (
            <div
              style={{
                opacity: 0.85,
                borderColor: 'rgba(245, 158, 11, 0.4)'
              }}
              className="absolute -top-3 left-6 px-2.5 py-1.5 rounded-full bg-neutral-950/60 border backdrop-blur-md shadow-lg shadow-amber-500/10 flex items-center gap-1 z-50 pointer-events-none transition-opacity duration-200"
            >
              {[0.4, 0.9, 1.4, 0.7, 1.2, 0.6, 1.0].map((mult, idx) => (
                <span
                  key={idx}
                  style={{
                    height: `${Math.max(4, Math.round((voiceVolumeScale > 0 ? voiceVolumeScale * 14 : 9) * mult))}px`,
                    backgroundColor: '#f59e0b'
                  }}
                  className="w-1 rounded-full animate-pulse transition-all duration-75"
                />
              ))}
            </div>
          )}

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
            style={{ borderColor: `${character.color}80` }}
            className="absolute -bottom-1.5 px-3.5 py-1 rounded-full bg-neutral-950/95 border text-[10.5px] font-black uppercase tracking-wider text-white shadow-2xl flex items-center gap-1.5 backdrop-blur-md"
          >
            <span style={{ color: character.color }}>LOOPRA</span>
            <span className="text-[8.5px] text-emerald-400 font-bold">• AI COMPANION</span>
          </div>
        </div>
      </div>
    </>
  );
}
