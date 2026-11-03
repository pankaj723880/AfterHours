import React, { useState, useEffect, useRef, useCallback } from 'react';
import { voiceBuddyService, CHARACTERS } from '../../services/voiceBuddyService';
import { voiceSessionService, SESSION_STATES } from '../../services/voiceSessionService';
import ThreeDCharacter from './ThreeDCharacter';
import { Mic, Volume2, Globe, History, ChevronUp, ChevronDown, CheckCircle2, Sparkles, RotateCcw, X } from 'lucide-react';

/**
 * CharacterBuddy
 * Movable Animated Loopra AI 3D Female Companion Avatar
 * 
 * Features:
 * - Full-Body 3D Female Human: rendered completely from head to feet without clipping
 * - User-Controlled Resizing:
 *   - Quick-control buttons: [-] Zoom Out, [+] Zoom In, [100%] scale badge, [Reset] Default
 *   - Desktop mouse wheel / trackpad resizing
 *   - Mobile touch pinch-to-resize
 *   - Proportional 3D scaling (0.65x to 1.55x) with sessionStorage persistence
 * - Movable: freely draggable by mouse on desktop and touch on phones
 * - Screen boundary safe clamping (prevents blocking navigation and bottom player)
 * - Session position persistence in sessionStorage
 * - One-click Reset Position option to return to the navbar
 * - Inactive Sitting Animation: sits on the dock when idle for 8 seconds
 * - Walking Animation while dragging or moving
 * - Thinking/Working Animation during multi-step task planning
 * - Celebrating/Success Animation on task completion
 * - Smooth entrance and exit transitions
 * - Small Dismiss (X) button to hide avatar back into the navbar icon
 * - Strict Separation: drags (>6px) do NOT trigger click actions
 */
export default function CharacterBuddy({
  isSessionActive = false,
  isListening = false,
  isPlaying = false,
  sessionState = 'OFF',
  voiceVolumeScale = 0,
  onToggleVoiceMode = () => {},
  onToggleChat = () => {},
  onCloseAvatar = () => {}
}) {
  const character = CHARACTERS.female;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [internalVolume, setInternalVolume] = useState(0);

  // Responsive dimensions detection
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

  // Base full-body dimensions (unscaled 1.0x):
  // Responsive 0.605 aspect ratio accommodating complete wingspan, hands, legs, and feet
  const BASE_WIDTH = isMobileScreen ? 180 : 215;
  const BASE_HEIGHT = isMobileScreen ? 300 : 355;
  const MIN_SCALE = 0.65;
  const MAX_SCALE = 1.60;

  // User-Controlled Resizing State with session persistence
  const [avatarScale, setAvatarScale] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('loopra_avatar_scale');
        if (saved) {
          const val = parseFloat(saved);
          if (!isNaN(val) && val >= MIN_SCALE && val <= MAX_SCALE) {
            return val;
          }
        }
      } catch (_) {}
    }
    return 1.0;
  });

  const updateAvatarScale = useCallback((nextScale) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(nextScale * 100) / 100));
    setAvatarScale(clamped);
    try {
      sessionStorage.setItem('loopra_avatar_scale', String(clamped));
    } catch (_) {}
  }, []);

  const characterWidth = Math.round(BASE_WIDTH * avatarScale);
  const characterHeight = Math.round(BASE_HEIGHT * avatarScale);

  // Realtime Live Transcript & Command Display State
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isInterim, setIsInterim] = useState(false);
  const [lastActionTag, setLastActionTag] = useState(null);
  const [commandHistory, setCommandHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBubbleVisible, setIsBubbleVisible] = useState(false);
  const [micState, setMicState] = useState(() => voiceSessionService.getSnapshot?.().micState || 'Idle');
  const [currentLang, setCurrentLang] = useState(() => voiceSessionService.lang || 'hi-IN');
  const bubbleDismissTimerRef = useRef(null);

  // Position & Dragging State
  const getDefaultPosition = useCallback(() => {
    if (typeof window === 'undefined') return { x: 20, y: 70 };
    const defaultX = Math.max(12, window.innerWidth - (isMobileScreen ? 145 : 185) - 20);
    const defaultY = isMobileScreen ? 60 : 70;
    return { x: defaultX, y: defaultY };
  }, [isMobileScreen]);

  const [avatarPos, setAvatarPos] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('loopra_avatar_position');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number' && parsed.x > 0) {
            return parsed;
          }
        }
      } catch (_) {}
      const defaultX = Math.max(12, window.innerWidth - (window.innerWidth < 768 ? 145 : 185) - 20);
      const defaultY = window.innerWidth < 768 ? 60 : 70;
      return { x: defaultX, y: defaultY };
    }
    return { x: 20, y: 70 };
  });

  // Clamp position when dimensions change to prevent viewport overflow
  useEffect(() => {
    setAvatarPos((prev) => {
      if (typeof window === 'undefined') return prev;
      const minX = 8;
      const maxX = Math.max(minX, window.innerWidth - characterWidth - 8);
      const minY = 50;
      const maxY = Math.max(minY, window.innerHeight - characterHeight - 75);
      const clampedX = Math.max(minX, Math.min(maxX, prev.x));
      const clampedY = Math.max(minY, Math.min(maxY, prev.y));
      if (clampedX !== prev.x || clampedY !== prev.y) {
        return { x: clampedX, y: clampedY };
      }
      return prev;
    });
  }, [characterWidth, characterHeight]);

  // Initialize position once window is ready if pos is 0,0
  useEffect(() => {
    if (avatarPos.x === 0 && avatarPos.y === 0 && typeof window !== 'undefined') {
      const def = getDefaultPosition();
      setAvatarPos(def);
    }
    // Strict singleton cleanup: ensure no duplicate container exists in DOM
    if (typeof document !== 'undefined') {
      const existing = document.querySelectorAll('#loopra-3d-character-container');
      if (existing.length > 1) {
        for (let i = 0; i < existing.length - 1; i++) {
          existing[i].remove();
        }
      }
    }
  }, [getDefaultPosition, avatarPos.x, avatarPos.y]);

  // Centralized Animation & Task Priority States
  const [autonomousSubState, setAutonomousSubState] = useState('idle');
  const [isThinking, setIsThinking] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [transientGesture, setTransientGesture] = useState(null);

  const [walkOffset, setWalkOffset] = useState({ x: 0, y: 0 });
  const [walkFacing, setWalkFacing] = useState('front');
  const [moveTransition, setMoveTransition] = useState('transform 0.3s ease-out');
  const [tapRipple, setTapRipple] = useState(null);

  // Resize Mode State (Touch-and-Hold ~500ms)
  const [isResizeMode, setIsResizeMode] = useState(false);
  const resizeHoldTimerRef = useRef(null);
  const didEnterResizeModeRef = useRef(false);
  const avatarCenterRef = useRef({ x: 0, y: 0 });
  const initialDistFromCenterRef = useRef(0);
  const initialScaleRef = useRef(1.0);

  // 360-Degree Interactive Drag-to-Rotate & Smooth Auto-Return
  const [rotationYaw, setRotationYaw] = useState(0);
  const [rotationPitch, setRotationPitch] = useState(0);
  const rotationRef = useRef({ yaw: 0, pitch: 0 });
  const isRotatingRef = useRef(false);
  const autoReturnTimerRef = useRef(null);
  const autoReturnFrameRef = useRef(null);

  const smoothReturnToFront = useCallback(() => {
    cancelAnimationFrame(autoReturnFrameRef.current);
    const step = () => {
      const curYaw = rotationRef.current.yaw;
      const curPitch = rotationRef.current.pitch;
      if (Math.abs(curYaw) < 0.005 && Math.abs(curPitch) < 0.005) {
        rotationRef.current.yaw = 0;
        rotationRef.current.pitch = 0;
        setRotationYaw(0);
        setRotationPitch(0);
        return;
      }
      const nextYaw = curYaw + (0 - curYaw) * 0.08;
      const nextPitch = curPitch + (0 - curPitch) * 0.08;
      rotationRef.current.yaw = nextYaw;
      rotationRef.current.pitch = nextPitch;
      setRotationYaw(nextYaw);
      setRotationPitch(nextPitch);
      autoReturnFrameRef.current = requestAnimationFrame(step);
    };
    autoReturnFrameRef.current = requestAnimationFrame(step);
  }, []);

  // Dragging tracking refs
  const dragRef = useRef({
    isDragging: false,
    hasMoved: false,
    startPointerX: 0,
    startPointerY: 0,
    startPosX: 0,
    startPosY: 0
  });

  // Mobile pinch-to-resize ref
  const pinchRef = useRef({
    isPinching: false,
    startDist: 0,
    startScale: 1.0
  });

  // =========================================================================
  // CENTRALIZED ANIMATION CONTROLLER (Priority 1 -> 2 -> 3 -> 4)
  // Priority 1: LISTENING / EXECUTING / THINKING / TRANSIENT GESTURES
  // Priority 2: SPEAKING (Voice output lip-sync & speech cadence)
  // Priority 3: DANCING (Continuous music-synchronized dance when playing)
  // Priority 4: IDLE / SITTING / WALKING / STANDING (Autonomous behavior)
  // =========================================================================
  const activeAnimationState = (() => {
    // 1. User interactions, commands, and active execution
    if (isListening) return 'listening';
    if (isExecuting) return 'executing';
    if (isThinking) return 'thinking';
    if (transientGesture) return transientGesture;
    if (dragRef.current.isDragging) return 'walking';

    // 2. Assistant spoken response with synchronized viseme lip-sync
    if (isSpeaking) return 'speaking';

    // 3. Active music playback: continuously dances with natural variations
    if (isPlaying) return 'dancing';

    // 4. Autonomous natural behavior when no active command and no music
    return autonomousSubState;
  })();

  const setAnimationState = useCallback((state) => {
    smoothReturnToFront();
    if (state === 'idle' || state === 'standing' || state === 'sitting' || state === 'walking') {
      setAutonomousSubState(state);
      setTransientGesture(null);
    } else {
      setTransientGesture(state);
    }
  }, [smoothReturnToFront]);

  // Autonomous Inactivity Engine (Triggers after 5s of inactivity when no command & no music)
  const autonomousTimerRef = useRef(null);
  const lastAutonomousChoiceRef = useRef('idle');

  const runAutonomousBehavior = useCallback(() => {
    if (isListening || isSpeaking || isPlaying || isThinking || isExecuting || dragRef.current.isDragging || isRotatingRef.current) {
      return;
    }
    smoothReturnToFront();

    // Autonomous Natural Gestures (wave/hello, dance, jump, thinking, standing, idle)
    const behaviorPool = ['wave', 'dance', 'jump', 'standing', 'idle', 'thinking'];
    let nextChoice = behaviorPool[Math.floor(Math.random() * behaviorPool.length)];
    if (nextChoice === lastAutonomousChoiceRef.current) {
      nextChoice = nextChoice === 'wave' ? 'dance' : nextChoice === 'dance' ? 'jump' : nextChoice === 'jump' ? 'standing' : 'idle';
    }
    lastAutonomousChoiceRef.current = nextChoice;
    setAutonomousSubState(nextChoice);

    // Each gesture strictly lasts 5-10 seconds as specified
    const stateDuration = 5000 + Math.random() * 4500;

    autonomousTimerRef.current = setTimeout(() => {
      if (!isListening && !isSpeaking && !isPlaying && !isThinking && !isExecuting && !dragRef.current.isDragging && !isRotatingRef.current) {
        setAutonomousSubState('idle');
        autonomousTimerRef.current = setTimeout(runAutonomousBehavior, 3000 + Math.random() * 2000);
      }
    }, stateDuration);
  }, [isListening, isSpeaking, isPlaying, isThinking, isExecuting, smoothReturnToFront]);

  const resetAutonomousTimer = useCallback(() => {
    clearTimeout(autonomousTimerRef.current);
    if (isListening || isSpeaking || isPlaying || isThinking || isExecuting || dragRef.current.isDragging) {
      return;
    }
    autonomousTimerRef.current = setTimeout(runAutonomousBehavior, 5000);
  }, [isListening, isSpeaking, isPlaying, isThinking, isExecuting, runAutonomousBehavior]);

  const resetIdleTimer = resetAutonomousTimer;

  useEffect(() => {
    resetAutonomousTimer();
    return () => clearTimeout(autonomousTimerRef.current);
  }, [resetAutonomousTimer, isPlaying, isListening, isSpeaking, isThinking, isExecuting]);

  // Record command into display and 5-item rolling history
  const recordCommandDisplay = useCallback((text, actionTag = null) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    clearTimeout(bubbleDismissTimerRef.current);
    setIsInterim(false);
    setLiveTranscript(cleanText);
    const validAction = actionTag && actionTag !== 'none' && actionTag !== 'GENERAL_QUESTION' ? actionTag : null;
    setLastActionTag(validAction);
    setIsBubbleVisible(true);

    setCommandHistory((prev) => {
      if (prev.length > 0 && prev[0].text.toLowerCase() === cleanText.toLowerCase()) {
        const updated = [...prev];
        updated[0] = {
          ...updated[0],
          action: validAction || updated[0].action
        };
        return updated;
      }
      const entry = {
        id: Date.now(),
        text: cleanText,
        action: validAction,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      return [entry, ...prev.slice(0, 4)];
    });

    // Auto-dismiss input text bubble strictly after 2 seconds
    bubbleDismissTimerRef.current = setTimeout(() => {
      setIsBubbleVisible(false);
      setLiveTranscript('');
      setLastActionTag(null);
    }, 2000);
  }, []);

  // Expose command recorder and thinking/executing/celebrating triggers globally
  useEffect(() => {
    window.__loopraRecordCommandDisplay = recordCommandDisplay;
    window.__loopraSetAvatarThinking = (isThinkingVal) => {
      setIsThinking(Boolean(isThinkingVal));
    };
    window.__loopraSetAvatarExecuting = (isExecVal) => {
      setIsExecuting(Boolean(isExecVal));
    };
    window.__loopraSetAvatarCelebrating = () => {
      setTransientGesture('celebrating');
      setTimeout(() => setTransientGesture(null), 2500);
    };
    return () => {
      delete window.__loopraRecordCommandDisplay;
      delete window.__loopraSetAvatarThinking;
      delete window.__loopraSetAvatarExecuting;
      delete window.__loopraSetAvatarCelebrating;
    };
  }, [recordCommandDisplay]);

  // Subscribe to voiceSessionService for live Web Speech events
  useEffect(() => {
    const unsub = voiceSessionService.subscribe((snapshot) => {
      if (snapshot.micState) setMicState(snapshot.micState);
      if (snapshot.lang) setCurrentLang(snapshot.lang);

      if (snapshot.event === 'interim_transcript') {
        const text = snapshot.interimText || '';
        if (text) {
          clearTimeout(bubbleDismissTimerRef.current);
          setIsInterim(true);
          setLiveTranscript(text);
          setIsBubbleVisible(true);
          resetAutonomousTimer();
        }
      } else if (snapshot.event === 'final_transcript') {
        const text = snapshot.transcript || '';
        if (text) {
          recordCommandDisplay(text, null);
          resetAutonomousTimer();
        }
      } else if (snapshot.event === 'language_change') {
        setCurrentLang(voiceSessionService.lang);
      }
    });

    return unsub;
  }, [recordCommandDisplay, resetAutonomousTimer]);

  // Mouse / cursor tracking offset for interactive gaze
  const [cursorOffset, setCursorOffset] = useState({ x: 0, y: 0 });
  const walkerRef = useRef(null);

  // Interaction timer refs for clicks, double-click, drag and long-press
  const longPressTimerRef = useRef(null);
  const clickTimerRef = useRef(null);
  const clickCountRef = useRef(0);
  const transientAnimTimerRef = useRef(null);
  const isPointerDownRef = useRef(false);
  const didLongPressRef = useRef(false);

  // Cursor tracking listener: Character eyes & head follow cursor when idle
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!walkerRef.current || dragRef.current.isDragging || isResizeMode) return;
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
  }, [isResizeMode]);

  // Play transient gesture (wave, wink, pose, dance, jump, think) and smoothly return to resting state
  const playTransientGesture = useCallback((gestureState, durationMs = 1500) => {
    clearTimeout(transientAnimTimerRef.current);
    smoothReturnToFront();
    resetAutonomousTimer();
    setTransientGesture(gestureState);
    transientAnimTimerRef.current = setTimeout(() => {
      setTransientGesture(null);
    }, durationMs);
  }, [resetAutonomousTimer, smoothReturnToFront]);

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

  // Subscribe to voiceBuddyService for speech events (Priority 2 driver)
  useEffect(() => {
    const unsub = voiceBuddyService.subscribe(({ event, volume }) => {
      if (event === 'speech_start') {
        setIsSpeaking(true);
        resetAutonomousTimer();
      } else if (event === 'speech_end') {
        setIsSpeaking(false);
        setInternalVolume(0);
        resetAutonomousTimer();
      } else if (event === 'speech_text_only') {
        setIsSpeaking(false);
        setInternalVolume(0);
      } else if (event === 'speech_volume' && volume !== undefined) {
        setInternalVolume(volume);
      }
    });

    return () => {
      unsub();
      clearTimeout(transientAnimTimerRef.current);
    };
  }, [resetAutonomousTimer]);

  // =========================================================================
  // TOUCH-AND-HOLD RESIZING (~500ms) & MOVABLE AVATAR DRAGGING
  // Direct gesture-based resizing: Hold 500ms -> Drag outward/inward or Pinch
  // =========================================================================
  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return; // Only primary button
    try { voiceBuddyService.unlockAudio(); } catch (_) {}

    // Multi-touch Pinch to Resize detection for mobile
    if (e.touches && e.touches.length === 2) {
      clearTimeout(resizeHoldTimerRef.current);
      pinchRef.current = {
        isPinching: true,
        startDist: Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        ),
        startScale: avatarScale
      };
      return;
    }

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    isPointerDownRef.current = true;
    didLongPressRef.current = false;
    didEnterResizeModeRef.current = false;
    initialScaleRef.current = avatarScale;

    if (walkerRef.current) {
      const rect = walkerRef.current.getBoundingClientRect();
      avatarCenterRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      initialDistFromCenterRef.current = Math.hypot(
        clientX - avatarCenterRef.current.x,
        clientY - avatarCenterRef.current.y
      );
    }

    dragRef.current = {
      isDragging: false,
      hasMoved: false,
      startPointerX: clientX,
      startPointerY: clientY,
      startPosX: avatarPos.x,
      startPosY: avatarPos.y,
      startYaw: rotationRef.current.yaw,
      startPitch: rotationRef.current.pitch
    };
    isRotatingRef.current = false;
    clearTimeout(autoReturnTimerRef.current);
    cancelAnimationFrame(autoReturnFrameRef.current);

    resetAutonomousTimer();

    // Press and hold avatar for approximately 500ms to enter resize mode
    clearTimeout(resizeHoldTimerRef.current);
    resizeHoldTimerRef.current = setTimeout(() => {
      if (isPointerDownRef.current && !dragRef.current.hasMoved && !pinchRef.current.isPinching) {
        setIsResizeMode(true);
        didEnterResizeModeRef.current = true;
        try { navigator.vibrate?.([40]); } catch (_) {}
      }
    }, 500);

    // Keep longPressTimerRef compatibility for mobile chat assistant fallback
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (isPointerDownRef.current && !dragRef.current.hasMoved && !pinchRef.current.isPinching && !isResizeMode) {
        didLongPressRef.current = true;
        try { navigator.vibrate?.([40]); } catch (_) {}
        playTransientGesture('pose', 1500);
        onToggleChat();
      }
    }, 450);
  };

  const handlePointerMove = useCallback((e) => {
    // Touch Pinch-to-Resize on mobile
    if (e.touches && e.touches.length === 2 && pinchRef.current.isPinching) {
      if (e.cancelable && e.preventDefault) e.preventDefault();
      const curDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (pinchRef.current.startDist > 10) {
        const factor = curDist / pinchRef.current.startDist;
        updateAvatarScale(pinchRef.current.startScale * factor);
      }
      return;
    }

    if (!isPointerDownRef.current) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (isResizeMode) {
      // In Resize Mode: Drag outward to enlarge, inward to shrink
      if (e.cancelable && e.preventDefault) e.preventDefault();
      const curDist = Math.hypot(
        clientX - avatarCenterRef.current.x,
        clientY - avatarCenterRef.current.y
      );
      const startDist = Math.max(30, initialDistFromCenterRef.current);
      const ratio = curDist / startDist;
      updateAvatarScale(initialScaleRef.current * ratio);
      return;
    }

    const deltaX = clientX - dragRef.current.startPointerX;
    const deltaY = clientY - dragRef.current.startPointerY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > 4) {
      dragRef.current.hasMoved = true;
      clearTimeout(resizeHoldTimerRef.current);
      clearTimeout(longPressTimerRef.current);

      if (e.cancelable && e.preventDefault) {
        e.preventDefault(); // Prevent touch scrolling during rotation/drag
      }

      // 360-Degree Interactive Drag-to-Rotate & Subtle Viewing Pitch Tilt
      isRotatingRef.current = true;
      const sensitivityYaw = 0.015;
      const sensitivityPitch = 0.009;
      const nextYaw = dragRef.current.startYaw + deltaX * sensitivityYaw;
      const nextPitch = Math.max(-0.25, Math.min(0.25, dragRef.current.startPitch - deltaY * sensitivityPitch));
      rotationRef.current = { yaw: nextYaw, pitch: nextPitch };
      setRotationYaw(nextYaw);
      setRotationPitch(nextPitch);
    }
  }, [characterWidth, characterHeight, isResizeMode, updateAvatarScale]);

  const handlePointerUp = useCallback((e) => {
    clearTimeout(resizeHoldTimerRef.current);
    clearTimeout(longPressTimerRef.current);

    if (pinchRef.current.isPinching) {
      pinchRef.current.isPinching = false;
    }

    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (isResizeMode || didEnterResizeModeRef.current) {
      setIsResizeMode(false);
      didEnterResizeModeRef.current = false;
      if (e.preventDefault) e.preventDefault();
      return; // Do NOT trigger click, tap, speech or navigation
    }

    if (isRotatingRef.current) {
      isRotatingRef.current = false;
      dragRef.current.hasMoved = false;
      if (e.preventDefault) e.preventDefault();
      // Temporarily preserve user-rotated orientation (~3.5s), then smoothly return to front-facing
      clearTimeout(autoReturnTimerRef.current);
      autoReturnTimerRef.current = setTimeout(() => {
        smoothReturnToFront();
      }, 3500);
      return;
    }

    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      setAutonomousSubState('idle');
      resetAutonomousTimer();

      const topSnap = { x: Math.max(8, window.innerWidth - characterWidth - 20), y: isMobileScreen ? 60 : 70 };
      const botRightSnap = { x: Math.max(8, window.innerWidth - characterWidth - 20), y: Math.max(50, window.innerHeight - characterHeight - 85) };
      const botLeftSnap = { x: 20, y: Math.max(50, window.innerHeight - characterHeight - 85) };

      let snappedPos = avatarPos;
      const snapThreshold = 95;
      if (Math.hypot(avatarPos.x - topSnap.x, avatarPos.y - topSnap.y) < snapThreshold) {
        snappedPos = topSnap;
      } else if (Math.hypot(avatarPos.x - botRightSnap.x, avatarPos.y - botRightSnap.y) < snapThreshold) {
        snappedPos = botRightSnap;
      } else if (Math.hypot(avatarPos.x - botLeftSnap.x, avatarPos.y - botLeftSnap.y) < snapThreshold) {
        snappedPos = botLeftSnap;
      }

      setAvatarPos(snappedPos);

      try {
        sessionStorage.setItem('loopra_avatar_position', JSON.stringify(snappedPos));
      } catch (_) {}

      if (e.preventDefault) e.preventDefault();
      return;
    }

    if (didLongPressRef.current) {
      if (e.preventDefault) e.preventDefault();
      didLongPressRef.current = false;
      return;
    }

    // Short click handling (not dragged, not resized)
    if (e.preventDefault) e.preventDefault();
    clickCountRef.current += 1;

    if (clickCountRef.current === 1) {
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
  }, [avatarPos, characterWidth, characterHeight, isMobileScreen, isResizeMode, onToggleVoiceMode, playTransientGesture, resetAutonomousTimer, smoothReturnToFront]);

  // Window global pointer listeners for robust drag tracking
  useEffect(() => {
    const onMove = (e) => handlePointerMove(e);
    const onUp = (e) => handlePointerUp(e);

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // Reset Position and scale back to default navbar dock
  const handleResetPosition = (e) => {
    e.stopPropagation();
    try {
      sessionStorage.removeItem('loopra_avatar_position');
      sessionStorage.removeItem('loopra_avatar_scale');
    } catch (_) {}
    updateAvatarScale(1.0);
    const def = getDefaultPosition();
    setAvatarPos(def);
    playTransientGesture('wave', 1200);
  };

  /**
   * Ground-Based Physical Movement & Tapping Engine (Promise-based)
   */
  const walkToTargetAndTap = useCallback((targetNavId, label = '', onFinished) => {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        onFinished?.();
        resolve();
        return;
      }

      const cleanTarget = (targetNavId || '').toLowerCase().trim();
      let targetEl = document.querySelector(`[data-nav-id="${cleanTarget}"]`);
      if (!targetEl) targetEl = document.querySelector(`[data-nav-id="${cleanTarget === 'saloon' ? 'barber' : cleanTarget}"]`);
      if (!targetEl) targetEl = document.querySelector(`a[href*="${cleanTarget}"]`);
      if (!targetEl) {
        const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        targetEl = candidates.find(el => {
          const text = (el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || '').toLowerCase();
          return text.includes(cleanTarget) || (label && text.includes(label.toLowerCase()));
        });
      }

      if (!targetEl) {
        onFinished?.();
        resolve();
        return;
      }

      const targetRect = targetEl.getBoundingClientRect();
      const characterEl = document.getElementById('loopra-3d-character-walker') || document.getElementById('loopra-3d-character-container');
      const startRect = characterEl
        ? characterEl.getBoundingClientRect()
        : { left: avatarPos.x, top: avatarPos.y, width: characterWidth, height: characterHeight };

      const deltaX = (targetRect.left + targetRect.width / 2) - (startRect.left + startRect.width / 2);
      const deltaY = (targetRect.top + targetRect.height / 2) - (startRect.top + startRect.height * 0.7);

      const distance = Math.hypot(deltaX, deltaY);
      const travelDuration = Math.round(Math.max(500, Math.min(1400, (distance / 750) * 1000)));
      const isRun = distance > 160;

      setWalkFacing(deltaX < 0 ? 'left' : 'right');
      setAnimationState(isRun ? 'running' : 'walking');
      setMoveTransition(`transform ${travelDuration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`);
      setWalkOffset({ x: deltaX, y: deltaY });

      // Physical travel completes -> Avatar reaches target button -> Taps with energy ripple
      setTimeout(() => {
        setAnimationState('tapping');
        setTapRipple({
          x: targetRect.left + targetRect.width / 2,
          y: targetRect.top + targetRect.height / 2
        });

        // Trigger action exactly when the avatar arrives and taps
        try {
          onFinished?.();
        } catch (_) {}
        resolve();

        setTimeout(() => {
          setTapRipple(null);
          setAnimationState('celebrating');
        }, 350);

        setTimeout(() => {
          const returnFacing = deltaX < 0 ? 'right' : 'left';
          setWalkFacing(returnFacing);
          setAnimationState(isRun ? 'running' : 'walking');
          setMoveTransition(`transform ${travelDuration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`);
          setWalkOffset({ x: 0, y: 0 });

          setTimeout(() => {
            setAnimationState('idle');
            setWalkFacing('front');
            setMoveTransition('transform 0.3s ease-out');
          }, travelDuration + 60);
        }, 750);
      }, travelDuration);
    });
  }, [avatarPos, characterWidth, characterHeight]);

  useEffect(() => {
    window.__loopraWalkAndTap = walkToTargetAndTap;
    return () => {
      delete window.__loopraWalkAndTap;
    };
  }, [walkToTargetAndTap]);

  return (
    <>
      {/* Energy Tap Ripple Effect */}
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
      {/* MOVABLE DOCK CONTAINER (Screen Clamped, Draggable)             */}
      {/* ============================================================= */}
      <div
        id="loopra-3d-character-container"
        style={{
          left: `${avatarPos.x}px`,
          top: `${avatarPos.y}px`,
          width: `${characterWidth}px`,
          height: `${characterHeight}px`,
          touchAction: 'none'
        }}
        className="fixed select-none pointer-events-auto flex flex-col items-center z-[2147483640] transition-[opacity,transform] duration-300 animate-in fade-in zoom-in-95"
      >
        {/* Subtle Avatar Header Controls (Reset Size & Position, Hide) */}
        <div className="absolute -top-7 right-0 flex items-center gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity z-50">
          <button
            type="button"
            onClick={handleResetPosition}
            title="Reset Avatar Size & Position"
            className="p-1 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-white/10 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onCloseAvatar}
            title="Hide Avatar"
            className="p-1 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-white/10 transition cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* ======================================================= */}
        {/* REALTIME COMMAND & LIVE TRANSCRIPT TEXT-ONLY DISPLAY    */}
        {/* Positioned cleanly on the LEFT side of the character.   */}
        {/* Auto-dismisses strictly after 2 seconds.               */}
        {/* ======================================================= */}
        {isBubbleVisible && (liveTranscript || isListening || isSpeaking) && (
          <div
            className="absolute right-full mr-2.5 md:mr-3 bottom-24 md:bottom-28 z-[999999] w-48 md:w-60 pointer-events-none select-none text-right flex flex-col items-end gap-1 animate-in fade-in duration-150"
          >
            {isInterim ? (
              <p className="text-[11px] md:text-xs font-medium text-amber-300 italic drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] leading-tight break-words">
                "{liveTranscript}"
              </p>
            ) : liveTranscript ? (
              <div className="flex flex-col items-end gap-0.5">
                <p className="text-xs md:text-sm font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] leading-tight break-words">
                  "{liveTranscript}"
                </p>
                {lastActionTag && (
                  <p className="text-[9.5px] md:text-[11px] font-mono font-bold text-emerald-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                      {lastActionTag}
                  </p>
                )}
              </div>
            ) : isListening ? (
              <p className="text-[11px] md:text-xs font-medium text-amber-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] animate-pulse">
                Listening...
              </p>
            ) : isSpeaking ? (
              <p className="text-[11px] md:text-xs font-medium text-emerald-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                Speaking...
              </p>
            ) : null}
          </div>
        )}

        {/* ======================================================= */}
        {/* RESIZE MODE ACTIVE BADGE                                */}
        {/* ======================================================= */}
        {isResizeMode && (
          <div className="absolute -top-8 px-2.5 py-0.5 rounded-full bg-neutral-950/95 border border-amber-400 text-amber-400 text-[10px] font-mono font-bold shadow-xl shadow-amber-500/20 flex items-center gap-1.5 animate-pulse z-50 pointer-events-none">
            <span>⟷ RESIZE: {Math.round(avatarScale * 100)}%</span>
            <span className="text-[8.5px] text-neutral-400 font-normal">Drag in/out</span>
          </div>
        )}

        {/* ======================================================= */}
        {/* LAYER: INDEPENDENT 2D/3D CHARACTER WALKER               */}
        {/* ======================================================= */}
        <div
          ref={walkerRef}
          id="loopra-3d-character-walker"
          style={{
            transform: `translate3d(${walkOffset.x}px, ${walkOffset.y}px, 0)`,
            transition: moveTransition
          }}
          className={`relative flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none ${
            isResizeMode ? 'ring-2 ring-amber-400/80 ring-offset-2 ring-offset-neutral-950 rounded-2xl' : ''
          } ${
            activeAnimationState === 'walking' || activeAnimationState === 'running' ? 'z-[9999999]' : ''
          }`}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const step = e.deltaY < 0 ? 0.05 : -0.05;
            updateAvatarScale(avatarScale + step);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            playTransientGesture('wave', 1200);
            onToggleChat?.();
          }}
          title="Loopra AI — Drag to Rotate 360° — Hold 500ms to Resize — Single Click: Voice — Right-Click: Chat"
        >
          {/* Subtle Loopra Amber Audio Waveform (shown above head) */}
          {isSpeaking && (
            <div
              style={{
                opacity: 0.85,
                borderColor: 'rgba(245, 158, 11, 0.4)'
              }}
              className="absolute -top-3.5 left-4 px-2.5 py-1 rounded-full bg-neutral-950/60 border backdrop-blur-md shadow-lg shadow-amber-500/10 flex items-center gap-1 z-50 pointer-events-none transition-opacity duration-200"
            >
              {[0.4, 0.9, 1.4, 0.7, 1.2, 0.6, 1.0].map((mult, idx) => (
                <span
                  key={idx}
                  style={{
                    height: `${Math.max(4, Math.round(((voiceVolumeScale || internalVolume) > 0 ? (voiceVolumeScale || internalVolume) * 14 : 9) * mult))}px`,
                    backgroundColor: '#f59e0b'
                  }}
                  className="w-1 rounded-full animate-pulse transition-all duration-75"
                />
              ))}
            </div>
          )}

          {/* 3D Humanoid Full-Body Container */}
          <div
            style={{ width: `${characterWidth}px`, height: `${characterHeight}px` }}
            className="relative flex items-center justify-center pointer-events-none"
          >
            <ThreeDCharacter
              gender={character.gender}
              animationState={activeAnimationState}
              isSpeaking={isSpeaking}
              isListening={isListening}
              isPlaying={isPlaying}
              voiceVolumeScale={voiceVolumeScale || internalVolume || (typeof window !== 'undefined' ? window.__loopraVoiceAudioLevel || 0 : 0)}
              facing={walkFacing}
              cursorOffset={cursorOffset}
              rotationYaw={rotationYaw}
              rotationPitch={rotationPitch}
              width={characterWidth}
              height={characterHeight}
            />
          </div>
        </div>
      </div>
    </>
  );
}
