import React, { useState, useEffect, useRef, useCallback } from 'react';
import { voiceBuddyService, CHARACTERS } from '../../services/voiceBuddyService';
import { voiceSessionService, SESSION_STATES } from '../../services/voiceSessionService';
import ThreeDCharacter from './ThreeDCharacter';
import { Mic, Volume2, Globe, History, ChevronUp, ChevronDown, CheckCircle2, Sparkles, RotateCcw, X } from 'lucide-react';
import usePageWaypoints from '../../hooks/usePageWaypoints';

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
  onCloseAvatar = () => {},
  isBottomPlayerVisible = false,
  isVisible = true
}) {
  const character = CHARACTERS.female;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [internalVolume, setInternalVolume] = useState(0);

  // Smooth Fade & Subtle Scale/Position Transition State
  const [isDOMVisible, setIsDOMVisible] = useState(isVisible);
  const [isFadedIn, setIsFadedIn] = useState(isVisible);
  const transitionTimerRef = useRef(null);
  const rafTimerRef = useRef(null);
  const isInitialMountRef = useRef(true);

  // Dragging tracking refs (placed before any state/computation reads it)
  const dragRef = useRef({
    isDragging: false,
    hasMoved: false,
    startPointerX: 0,
    startPointerY: 0,
    startPosX: 0,
    startPosY: 0
  });

  const avatarContainerRef = useRef(null);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (!isVisible) {
        setIsDOMVisible(false);
        setIsFadedIn(false);
        return;
      }
    }

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (rafTimerRef.current) {
      cancelAnimationFrame(rafTimerRef.current);
      rafTimerRef.current = null;
    }

    if (isVisible) {
      // Reveal: set visible in DOM first, then animate in on next frames
      setIsDOMVisible(true);
      rafTimerRef.current = requestAnimationFrame(() => {
        rafTimerRef.current = requestAnimationFrame(() => {
          setIsFadedIn(true);
        });
      });
    } else {
      // Dismiss / Close: fade out smoothly first, then hide DOM after transition ends
      setIsFadedIn(false);
      transitionTimerRef.current = setTimeout(() => {
        setIsDOMVisible(false);
        transitionTimerRef.current = null;
      }, 350); // Matches the 350ms exit transition
    }

    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      if (rafTimerRef.current) {
        cancelAnimationFrame(rafTimerRef.current);
        rafTimerRef.current = null;
      }
    };
  }, [isVisible]);

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

  // Base full-body dimensions (w-60 h-[340px] proportional canvas):
  // Gives ample vertical and horizontal breathing room so head-to-toe and ground particle circle render completely without clipping
  const BASE_WIDTH = isMobileScreen ? 220 : 240; // ~w-60 (240px)
  const BASE_HEIGHT = isMobileScreen ? 320 : 340; // h-[340px]
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

  const waypoints = usePageWaypoints(isBottomPlayerVisible);

  // Autonomous Roaming Mode (Stored in localStorage, default true)
  const [isRoamEnabled, setIsRoamEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('loopra_avatar_roaming') ?? localStorage.getItem('loopra_avatar_roam');
        return stored !== null ? stored === 'true' : true;
      } catch (_) {}
    }
    return true;
  });

  const isRoamActive = isRoamEnabled && !isListening && !isSpeaking && !dragRef.current?.isDragging;

  const ORIGIN_POS = typeof window !== 'undefined'
    ? { x: window.innerWidth - 140, y: window.innerHeight - 240 }
    : { x: 200, y: 500 };

  // 2D Kinematics Physics State (8-Directional Vector Movement & Friction)
  const [continuousPos, setContinuousPos] = useState(() => {
    return typeof window !== 'undefined' ? { ...ORIGIN_POS } : { x: 200, y: 500 };
  });

  const positionRef = useRef({ ...continuousPos });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const targetPosRef = useRef({ ...continuousPos });
  const landingModeRef = useRef('walk'); // 'walk' | 'sit' | 'lie_down' | 'hang' | 'mischief'
  const isSleepingRef = useRef(false);
  const isHangingRef = useRef(false);
  const isMischiefRef = useRef(false);
  const patrolFrameRef = useRef(null);
  const movementModeRef = useRef('walk'); // 'walk' | 'run' | 'jump'
  const currentHeadingRef = useRef(0); // Motion heading yaw angle (in radians)
  const lastMischiefTimeRef = useRef(0);

  // User Drag Interrupt & Roaming Pause
  const isUserDragging = useRef(false);
  const pauseRoamingUntil = useRef(0);

  // 60-Second Dynamic Activity Timer & 45-60s Nap Cycle State
  const [isFatigued, setIsFatigued] = useState(false);
  const activeRoamSecondsRef = useRef(0);
  const sleepDurationSecondsRef = useRef(0);
  const fatigueCheckIntervalRef = useRef(null);
  const nextTargetTimeoutRef = useRef(null);

  // Fatigue Sleep Trigger with Gemini API & Casual Hindi Relatable Fallbacks
  const triggerFatigueSleep = useCallback(async () => {
    if (isSleepingRef.current) return;
    isSleepingRef.current = true;
    setIsFatigued(true);
    movementModeRef.current = 'walk';

    // 1. Choose nearest resting spot: navbar header horizontal edge (lie_down) or nearest card (sit)
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const minX = 16;
    const maxX = Math.max(minX + 40, winW - characterWidth - 110);

    const restBelowNavbar = Math.random() < 0.55;
    if (restBelowNavbar) {
      // Rest lying down below navbar at y = 70px
      const targetX = Math.max(minX, Math.min(maxX, Math.floor(minX + Math.random() * (maxX - minX))));
      targetPosRef.current = { x: targetX, y: 70 };
      landingModeRef.current = 'lie_down';
    } else if (waypoints?.sitSpots?.length > 0) {
      const spot = waypoints.sitSpots[Math.floor(Math.random() * waypoints.sitSpots.length)];
      targetPosRef.current = {
        x: Math.max(minX, Math.min(maxX, spot.x - characterWidth * 0.5)),
        y: Math.max(64, spot.y - characterHeight + 10)
      };
      landingModeRef.current = 'sit';
    } else {
      targetPosRef.current = { x: Math.max(minX, Math.min(maxX, 40)), y: 70 };
      landingModeRef.current = 'lie_down';
    }

    // 2. Play exhaustion breathing pause & speak sleepy dialogue via Indian female TTS
    const fallbackLines = [
      "Ek minute poora bhaga diya yaar... ab main 1 minute so rahi hu, please disturb mat karna!",
      "Bas mera ho gaya, 60 second me saari energy khatam, shubh ratri!",
      "Taangein jawab de gayi meri, main chali thoda aaram karne, disturb mat karna.",
      "Haye main thak gayi! Itna run karwaya, ab 1 minute main so rahi hoon.",
      "Battery zero ho gayi meri, please 1 minute sone do yaar!"
    ];

    let sleepDialogue = fallbackLines[Math.floor(Math.random() * fallbackLines.length)];

    try {
      const prompt = "Generate 1 short, funny, relatable Hindi line (max 8-10 words) of a tired Indian girl who ran around the music app for 1 minute and is now sleeping for 1 minute. Casual witty tone.";
      const res = await chatBuddyClient.sendMessage(prompt, '', { isFatiguePrompt: true });
      if (res?.reply && typeof res.reply === 'string' && res.reply.trim().length > 0) {
        const clean = res.reply.replace(/["“”*]/g, '').trim();
        if (clean.length > 5) {
          sleepDialogue = clean;
        }
      }
    } catch (_) {}

    // Show transcript and speak dialogue through female Hindi voice
    setLiveTranscript(sleepDialogue);
    setIsBubbleVisible(true);
    setLastActionTag('💤 SLEEPING (60s NAP)');

    try {
      voiceBuddyService.speakText(sleepDialogue, {
        priority: true,
        pitch: 1.05,
        rate: 1.35
      });
    } catch (_) {}

    setTimeout(() => {
      setIsBubbleVisible(false);
    }, 7000);
  }, [characterWidth, characterHeight, waypoints]);

  // Click/Tap to Wake Up from Fatigue
  const handleWakeUpAvatar = useCallback(() => {
    if (!isSleepingRef.current) return;
    isSleepingRef.current = false;
    setIsFatigued(false);
    activeRoamSecondsRef.current = 0;
    sleepDurationSecondsRef.current = 0;
    landingModeRef.current = 'walk';
    movementModeRef.current = 'walk';
    setAutonomousSubState('idle');
    setLiveTranscript('Chalo uth gayi! Ab bolo kahan chalna hai?');
    setIsBubbleVisible(true);
    setLastActionTag('⚡ AWAKENED');
    try {
      voiceBuddyService.speakText('Chalo uth gayi! Ab bolo kahan chalna hai?', {
        priority: true,
        pitch: 1.05,
        rate: 1.35
      });
    } catch (_) {}
    setTimeout(() => setIsBubbleVisible(false), 4000);
  }, []);

  // 60-Second Dynamic Activity Timer & 45-60s Nap Cycle
  useEffect(() => {
    if (!isRoamActive) {
      if (fatigueCheckIntervalRef.current) {
        clearInterval(fatigueCheckIntervalRef.current);
        fatigueCheckIntervalRef.current = null;
      }
      return;
    }

    fatigueCheckIntervalRef.current = setInterval(() => {
      if (!isRoamActive) return;

      if (isSleepingRef.current) {
        // Sleep duration tracker: 45 to 60 seconds
        sleepDurationSecondsRef.current += 1;
        if (sleepDurationSecondsRef.current >= 50) {
          // Auto wake up after nap timer expires
          handleWakeUpAvatar();
        }
      } else {
        // Active roaming duration tracker: 60 seconds total activity
        activeRoamSecondsRef.current += 1;
        if (activeRoamSecondsRef.current >= 60) {
          activeRoamSecondsRef.current = 0;
          triggerFatigueSleep();
        }
      }
    }, 1000);

    return () => {
      if (fatigueCheckIntervalRef.current) {
        clearInterval(fatigueCheckIntervalRef.current);
        fatigueCheckIntervalRef.current = null;
      }
    };
  }, [isRoamActive, triggerFatigueSleep, handleWakeUpAvatar]);

  // Waypoint selector: 8 compass directions across DOM cards, navbar ledge, and open space
  const pickNewTarget = useCallback(() => {
    if (typeof window === 'undefined' || isSleepingRef.current || isUserDragging.current || Date.now() < pauseRoamingUntil.current) return;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // Strict safe bounds: minX = 16, maxX = winW - 110, minY = 64 (below navbar), maxY = winH - 170 (above bottom player)
    const minX = 16;
    const maxX = Math.max(minX + 40, winW - 110);
    const minY = 64;
    const maxY = Math.max(minY + 40, winH - (isBottomPlayerVisible ? 170 : 130));

    // Dynamic movement mode distribution:
    // 40% Walk (slow steady), 35% Run (1.8x speed boost), 25% Jump / Hop (sine vertical arc)
    const modeRoll = Math.random();
    if (modeRoll < 0.40) {
      movementModeRef.current = 'walk';
    } else if (modeRoll < 0.75) {
      movementModeRef.current = 'run';
    } else {
      movementModeRef.current = 'jump';
    }

    const now = Date.now();
    const canDoMischief = (now - lastMischiefTimeRef.current) > 28000;

    // Detect section heading baselines across the document (h2, h3, h4) for ledge hanging
    let headingLedges = [];
    try {
      const headings = Array.from(document.querySelectorAll('h2, h3, h4'));
      headingLedges = headings.map((h) => {
        const r = h.getBoundingClientRect();
        return {
          element: h,
          text: h.innerText || '',
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
          isVisible: r.width > 30 && r.height > 10 && r.top >= 60 && r.bottom <= winH - 140
        };
      }).filter((h) => h.isVisible);
    } catch (_) {}

    // Comprehensive Action Pool: ['WALK', 'RUN', 'JUMP_AND_HANG_HEADING', 'SIT_ON_CARD', 'MISCHIEF_EMOTE']
    const roll = Math.random();

    // 1. JUMP_AND_HANG_HEADING: Detect major section headings and jump to hang on ledge
    if (headingLedges.length > 0 && roll < 0.28) {
      const chosenHeading = headingLedges[Math.floor(Math.random() * headingLedges.length)];
      // Position: targetY = headingRect.bottom - 10px, targetX = headingRect.left + headingRect.width / 2
      const targetX = Math.max(minX, Math.min(maxX, chosenHeading.left + chosenHeading.width / 2 - characterWidth * 0.5));
      const targetY = Math.max(minY, Math.min(maxY, chosenHeading.bottom - 10));
      targetPosRef.current = { x: targetX, y: targetY };
      landingModeRef.current = 'hang';
      movementModeRef.current = 'jump';
      return;
    }

    // 2. MISCHIEF_EMOTE: Playful troll actions (every 25–40s)
    if (canDoMischief && roll < 0.52) {
      lastMischiefTimeRef.current = now;
      const emoteTypes = ['PEEK_AND_BOO', 'TAUNT_DANCE', 'KNOCK_GLASS', 'STICK_OUT_TONGUE'];
      const chosenEmote = emoteTypes[Math.floor(Math.random() * emoteTypes.length)];
      landingModeRef.current = 'mischief';
      landingModeRef.mischiefType = chosenEmote;

      if (chosenEmote === 'KNOCK_GLASS') {
        // Walk right up to front-center screen edge
        targetPosRef.current = {
          x: Math.max(minX, Math.min(maxX, winW * 0.5 - characterWidth * 0.5)),
          y: Math.max(minY, Math.min(maxY, winH * 0.55))
        };
      } else if (chosenEmote === 'PEEK_AND_BOO') {
        // Walk to side screen border or card edge
        const pickLeft = Math.random() < 0.5;
        targetPosRef.current = {
          x: pickLeft ? minX + 5 : maxX - 15,
          y: Math.max(minY, Math.min(maxY, Math.floor(minY + Math.random() * (maxY - minY))))
        };
      } else {
        // Center or current spot for TAUNT_DANCE or STICK_OUT_TONGUE
        const cur = positionRef.current;
        targetPosRef.current = {
          x: Math.max(minX, Math.min(maxX, cur.x + (Math.random() * 80 - 40))),
          y: Math.max(minY, Math.min(maxY, cur.y + (Math.random() * 60 - 30)))
        };
      }
      return;
    }

    // 3. SIT_ON_CARD: Top Horizontal Edge of Song Cards / Vinyls (Sit Spot)
    if (waypoints?.sitSpots?.length > 0 && roll < 0.72) {
      const spot = waypoints.sitSpots[Math.floor(Math.random() * waypoints.sitSpots.length)];
      const clampedX = Math.max(minX, Math.min(maxX, spot.x - characterWidth * 0.5));
      const clampedY = Math.max(minY, Math.min(maxY, spot.y - characterHeight + 8));
      targetPosRef.current = { x: clampedX, y: clampedY };
      landingModeRef.current = 'sit';
      return;
    }

    // 4. Lie Down below Navbar Area
    if (roll < 0.84) {
      const targetX = Math.floor(minX + Math.random() * (maxX - minX));
      targetPosRef.current = { x: targetX, y: 70 };
      landingModeRef.current = 'lie_down';
      return;
    }

    // 5. Open Floor 8-Directional Traverse (N, NE, E, SE, S, SW, W, NW)
    const cur = positionRef.current;
    const angles = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (deg * Math.PI) / 180);
    const chosenAngle = angles[Math.floor(Math.random() * angles.length)];
    const stepDistance = movementModeRef.current === 'run' ? (180 + Math.random() * 260) : (100 + Math.random() * 200);

    const destX = Math.max(minX, Math.min(maxX, cur.x + Math.cos(chosenAngle) * stepDistance));
    const destY = Math.max(minY, Math.min(maxY, cur.y + Math.sin(chosenAngle) * stepDistance));

    targetPosRef.current = { x: destX, y: destY };
    landingModeRef.current = 'walk';
  }, [characterWidth, characterHeight, isBottomPlayerVisible, waypoints]);

  useEffect(() => {
    if (!isRoamActive || isSleepingRef.current) {
      return;
    }

    pickNewTarget();
    const interval = setInterval(pickNewTarget, 6500);

    return () => clearInterval(interval);
  }, [isRoamActive, pickNewTarget]);

  // 60 FPS Kinematics Physics Loop (Continuous Smooth Step-by-Step Walking, Running & Jumping)
  useEffect(() => {
    if (!isRoamActive) {
      if (patrolFrameRef.current) {
        cancelAnimationFrame(patrolFrameRef.current);
        patrolFrameRef.current = null;
      }
      return;
    }

    let isRunning = true;
    let lastTime = performance.now();
    const BASE_WALK_SPEED = 1.2; // Natural step-by-step walking speed

    const loop = (time) => {
      if (!isRunning) return;
      const dt = Math.min(0.064, (time - lastTime) / 1000);
      lastTime = time;

      // Reset roaming pause if timestamp has expired without active drag
      if (!isUserDragging.current && Date.now() > pauseRoamingUntil.current && pauseRoamingUntil.current !== 0) {
        pauseRoamingUntil.current = 0;
      }

      // Roaming Loop Guard: Pause roaming while user is dragging or during pause cooldown
      if (isUserDragging.current || Date.now() < pauseRoamingUntil.current) {
        setAutonomousSubState('idle');
        patrolFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      // If sleeping, keep in sleeping state and idle
      if (isSleepingRef.current) {
        setAutonomousSubState('sleeping');
        patrolFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const pos = positionRef.current;
      const target = targetPosRef.current;

      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const distance = Math.hypot(dx, dy);

      // Safe bounds clamping
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
      const minX = 16;
      const maxX = Math.max(minX + 40, winW - 110);
      const minY = 64;
      const maxY = Math.max(minY + 40, winH - (isBottomPlayerVisible ? 170 : 130));

      if (distance > 6) {
        // 1. Calculate Motion Direction Angle (Yaw Heading):
        // 2D screen motion vector angle: dx corresponds to screen X, dy corresponds to screen Y.
        // In 3D Three.js space:
        // dx > 0 (moving right) -> targetHeading > 0
        // dx < 0 (moving left)  -> targetHeading < 0
        // dy > 0 (moving down/forward on screen) -> towards user / forward angle
        // dy < 0 (moving up/backward on screen)  -> away / back angle
        const targetHeading = Math.atan2(dx, -dy * 0.4);

        // Smooth angle interpolation handling shortest circular distance around 2*PI
        let angleDiff = (targetHeading - currentHeadingRef.current) % (Math.PI * 2);
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const TURN_SPEED = Math.min(1.0, 0.16 * (dt * 60)); // Angular lerp speed
        currentHeadingRef.current += angleDiff * TURN_SPEED;
        setRotationYaw(currentHeadingRef.current);

        // 2. Turn-in-Place Threshold:
        // If turning angle difference is large (> 45 deg / 0.78 rad), slow down translation to turn body first
        const isTurningInPlace = Math.abs(angleDiff) > 0.70;

        const mode = movementModeRef.current;
        // Speed multiplier: 1.0x walk, 1.8x run, 1.25x jump. If turning in place, reduce translation speed by 75%
        const speedMultiplier = (mode === 'run' ? 1.8 : (mode === 'jump' ? 1.25 : 1.0)) * (isTurningInPlace ? 0.25 : 1.0);
        const currentSpeed = BASE_WALK_SPEED * speedMultiplier;

        const angle = Math.atan2(dy, dx);
        const step = currentSpeed * Math.min(2.0, dt * 60);

        pos.x += Math.cos(angle) * step;
        pos.y += Math.sin(angle) * step;

        // Apply sine-wave vertical jump offset if currently in jump/hop mode and not turning in place
        let renderY = pos.y;
        if (mode === 'jump' && !isTurningInPlace) {
          const hopOffset = -Math.abs(Math.sin(time * 0.007)) * 14;
          renderY += hopOffset;
        }

        // Clamp inside safe screen bounds
        pos.x = Math.max(minX, Math.min(maxX, pos.x));
        pos.y = Math.max(minY, Math.min(maxY, pos.y));
        renderY = Math.max(minY - 15, Math.min(maxY, renderY));

        // Direct DOM translation without transition snapping
        if (avatarContainerRef.current) {
          avatarContainerRef.current.style.transform = `translate3d(${pos.x}px, ${renderY}px, 0)`;
        }

        // Face movement direction smoothly
        setWalkFacing(dx < 0 ? 'left' : 'right');
        setRotationPitch(Math.sin(angle) * 0.06);

        // Update animation state based on current dynamic movement mode
        if (isTurningInPlace) {
          setAutonomousSubState('walking');
        } else if (mode === 'run') {
          setAutonomousSubState('run');
        } else if (mode === 'jump') {
          setAutonomousSubState('jump');
        } else {
          setAutonomousSubState('walking');
        }
      } else {
        // Target reached: smoothly turn back to front (facing user)
        const frontAngle = 0;
        let frontDiff = (frontAngle - currentHeadingRef.current) % (Math.PI * 2);
        if (frontDiff > Math.PI) frontDiff -= Math.PI * 2;
        if (frontDiff < -Math.PI) frontDiff += Math.PI * 2;
        currentHeadingRef.current += frontDiff * 0.10;
        setRotationYaw(currentHeadingRef.current);
        setRotationPitch(0);

        // Target reached: snap to target and crossfade to resting / idle pose
        pos.x = target.x;
        pos.y = target.y;

        if (avatarContainerRef.current) {
          avatarContainerRef.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        }

        if (landingModeRef.current === 'hang') {
          isHangingRef.current = true;
          setAutonomousSubState('hang');
          setLastActionTag('🧗 HANGING ON LEDGE');

          // Comic Hindi line while hanging
          const hangLines = [
            "Main toh latak gayi, ab dhoondh ke dikhao agla song!",
            "Dekh kya rahe ho, gaana change karo varna main idhar hi latki rahungi!",
            "Arey pakdo koi mujhe! Kitna uncha latka diya!",
            "Haath dukh gaye mere, par main nahi utrungi!"
          ];
          const hangLine = hangLines[Math.floor(Math.random() * hangLines.length)];
          setLiveTranscript(hangLine);
          setIsBubbleVisible(true);

          // Hang for 5 to 8 seconds before dropping down smoothly to the floor with a soft landing roll
          if (!nextTargetTimeoutRef.current && !isSleepingRef.current) {
            const hangDuration = Math.floor(5000 + Math.random() * 3000); // 5 - 8 seconds
            nextTargetTimeoutRef.current = setTimeout(() => {
              nextTargetTimeoutRef.current = null;
              isHangingRef.current = false;
              setIsBubbleVisible(false);
              // Soft landing drop down
              setAutonomousSubState('jump');
              const floorY = Math.min(maxY, pos.y + 120);
              targetPosRef.current = { x: pos.x, y: floorY };
              landingModeRef.current = 'walk';
              setTimeout(() => {
                pickNewTarget();
              }, 1200);
            }, hangDuration);
          }
        } else if (landingModeRef.current === 'mischief') {
          isMischiefRef.current = true;
          const emoteType = landingModeRef.mischiefType || 'TAUNT_DANCE';

          let bubbleLine = "Arey gaana sunne aaye ho ya mujhe dekhne?";
          if (emoteType === 'KNOCK_GLASS') {
            setAutonomousSubState('knock_glass');
            setLastActionTag('🚪 KNOCK SCREEN');
            bubbleLine = "Tuk tuk! Sunai de raha hai? Koi hai wahan?";
          } else if (emoteType === 'PEEK_AND_BOO') {
            setAutonomousSubState('walk');
            setLastActionTag('👀 PEEK-A-BOO');
            bubbleLine = "Boo! Darr gaye na? Main idhar hi chhipi thi!";
          } else if (emoteType === 'STICK_OUT_TONGUE') {
            setAutonomousSubState('stick_out_tongue');
            setLastActionTag('😜 TEASING');
            bubbleLine = "Arey gaana sunne aaye ho ya mujhe dekhne?";
          } else {
            setAutonomousSubState('taunt_dance');
            setLastActionTag('💃 MISCHIEF DANCE');
            bubbleLine = "Bore ho gayi hu, thoda nach lo mere saath!";
          }

          setLiveTranscript(bubbleLine);
          setIsBubbleVisible(true);

          if (!nextTargetTimeoutRef.current && !isSleepingRef.current) {
            nextTargetTimeoutRef.current = setTimeout(() => {
              nextTargetTimeoutRef.current = null;
              isMischiefRef.current = false;
              setIsBubbleVisible(false);
              pickNewTarget();
            }, 5500);
          }
        } else if (landingModeRef.current === 'lie_down') {
          setAutonomousSubState(isSleepingRef.current ? 'sleeping' : 'lie_down');
        } else if (landingModeRef.current === 'sit') {
          setAutonomousSubState('sitting');
        } else if (isPlaying) {
          setAutonomousSubState('dancing');
        } else {
          setAutonomousSubState('idle');
        }

        // Trigger next waypoint after 2s pause if none scheduled and not hanging/mischief
        if (!nextTargetTimeoutRef.current && !isSleepingRef.current && landingModeRef.current !== 'hang' && landingModeRef.current !== 'mischief') {
          nextTargetTimeoutRef.current = setTimeout(() => {
            nextTargetTimeoutRef.current = null;
            pickNewTarget();
          }, 2000);
        }
      }

      setContinuousPos({ x: pos.x, y: pos.y });
      patrolFrameRef.current = requestAnimationFrame(loop);
    };

    patrolFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (patrolFrameRef.current) {
        cancelAnimationFrame(patrolFrameRef.current);
        patrolFrameRef.current = null;
      }
      if (nextTargetTimeoutRef.current) {
        clearTimeout(nextTargetTimeoutRef.current);
        nextTargetTimeoutRef.current = null;
      }
    };
  }, [isRoamActive, isPlaying, isBottomPlayerVisible, pickNewTarget]);

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

  // Position & Dragging State (Default origin strictly in Lower Right Corner, right above mobile navbar)
  const getDefaultPosition = useCallback(() => {
    if (typeof window === 'undefined') return { x: 20, y: 70 };
    const rightMargin = isMobileScreen ? 14 : 24;
    const bottomMargin = isMobileScreen
      ? (isBottomPlayerVisible ? 134 : 64)
      : (isBottomPlayerVisible ? 100 : 24);
    const defaultX = Math.max(8, window.innerWidth - characterWidth - rightMargin);
    const defaultY = Math.max(50, window.innerHeight - characterHeight - bottomMargin);
    return { x: defaultX, y: defaultY };
  }, [isMobileScreen, characterWidth, characterHeight, isBottomPlayerVisible]);

  // Active custom position is only true if user actively dragged the avatar in the current session
  const [isCustomPos, setIsCustomPos] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const wasDragged = sessionStorage.getItem('loopra_avatar_user_dragged');
        const savedPos = sessionStorage.getItem('loopra_avatar_drag_pos');
        if (wasDragged === 'true' && savedPos) {
          const parsed = JSON.parse(savedPos);
          if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return true;
          }
        }
      } catch (_) {}
    }
    return false;
  });

  const [avatarPos, setAvatarPos] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const wasDragged = sessionStorage.getItem('loopra_avatar_user_dragged');
        const saved = sessionStorage.getItem('loopra_avatar_drag_pos');
        if (wasDragged === 'true' && saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return parsed;
          }
        }
      } catch (_) {}
      const isMobile = window.innerWidth < 768;
      const charW = isMobile ? 140 : 200;
      const charH = isMobile ? 230 : 330;
      const rightMargin = isMobile ? 14 : 24;
      const bottomMargin = isMobile
        ? (isBottomPlayerVisible ? 134 : 64)
        : (isBottomPlayerVisible ? 100 : 24);
      const defaultX = Math.max(8, window.innerWidth - charW - rightMargin);
      const defaultY = Math.max(50, window.innerHeight - charH - bottomMargin);
      return { x: defaultX, y: defaultY };
    }
    return { x: 20, y: 70 };
  });

  // Discard any legacy/stale position from older sessions that left avatar stuck in the center
  useEffect(() => {
    try {
      sessionStorage.removeItem('loopra_avatar_position');
      sessionStorage.removeItem('loopra_avatar_custom_pos');
      if (sessionStorage.getItem('loopra_avatar_user_dragged') !== 'true') {
        sessionStorage.removeItem('loopra_avatar_drag_pos');
      }
    } catch (_) {}
  }, []);

  // Clamp position when dimensions change to prevent viewport overflow
  useEffect(() => {
    if (!isCustomPos) {
      const def = getDefaultPosition();
      setAvatarPos(def);
      return;
    }
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
  }, [isCustomPos, getDefaultPosition, characterWidth, characterHeight]);

  // Sync avatar dock position globally for chatbox anchoring
  useEffect(() => {
    const rightMargin = isMobileScreen ? 14 : 24;
    const bottomMargin = isMobileScreen 
      ? (isBottomPlayerVisible ? 134 : 64) 
      : (isBottomPlayerVisible ? 100 : 24);
    const curX = isCustomPos 
      ? avatarPos.x 
      : (typeof window !== 'undefined' ? window.innerWidth - characterWidth - rightMargin : 0);
    const curY = isCustomPos 
      ? avatarPos.y 
      : (typeof window !== 'undefined' ? window.innerHeight - characterHeight - bottomMargin : 0);
    
    window.__loopraAvatarPosition = { x: curX, y: curY, width: characterWidth, height: characterHeight };
    window.dispatchEvent(new CustomEvent('loopra:avatar-position', {
      detail: window.__loopraAvatarPosition
    }));
  }, [isCustomPos, avatarPos, characterWidth, characterHeight, isMobileScreen, isBottomPlayerVisible]);

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
    if (state === 'idle' || state === 'standing' || state === 'sitting' || state === 'walking' || state === 'idle_walking') {
      setAutonomousSubState(state);
      setTransientGesture(null);
    } else {
      setTransientGesture(state);
    }
  }, [smoothReturnToFront]);

  // =========================================================================
  // AUTONOMOUS FULL-SCREEN IDLE WALKING & NATURAL IDLE ENGINE
  // 1. Full visible screen coverage with randomized destination quadrants.
  // 2. Smooth acceleration, deceleration, curved Bézier trajectory, and directional facing.
  // 3. Strict Interaction Priority: Immediate stop on voice/text/drag/resize/task.
  // 4. Tab visibility pause & mobile safe area boundaries.
  // =========================================================================
  const walkAnimFrameRef = useRef(null);
  const idleWalkTimerRef = useRef(null);
  const idlePauseTimerRef = useRef(null);
  const isIdleWalkingRef = useRef(false);
  const lastVisitedCellsRef = useRef([]);

  // Calculate strict usable viewport boundaries respecting headers, bottom navigation, and mobile safe areas
  const getUsableScreenBounds = useCallback(() => {
    const isMobile = isMobileScreen || (typeof window !== 'undefined' && window.innerWidth < 768);
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

    const minX = isMobile ? 12 : 88;
    const maxX = Math.max(minX + 40, winW - characterWidth - (isMobile ? 16 : 32));
    const minY = isMobile ? 64 : 70;
    const bottomNavHeight = isMobile
      ? (isBottomPlayerVisible ? 140 : 72)
      : (isBottomPlayerVisible ? 98 : 24);
    const maxY = Math.max(minY + 40, winH - characterHeight - bottomNavHeight);

    return { minX, maxX, minY, maxY, isMobile };
  }, [isMobileScreen, characterWidth, characterHeight, isBottomPlayerVisible]);

  // Immediately cancel any active autonomous walking/running/dancing and smoothly reset to base position
  const stopAutonomousWalking = useCallback((resetSubState = true) => {
    isIdleWalkingRef.current = false;
    if (walkAnimFrameRef.current) {
      cancelAnimationFrame(walkAnimFrameRef.current);
      walkAnimFrameRef.current = null;
    }
    if (idleWalkTimerRef.current) {
      clearTimeout(idleWalkTimerRef.current);
      idleWalkTimerRef.current = null;
    }
    if (idlePauseTimerRef.current) {
      clearTimeout(idlePauseTimerRef.current);
      idlePauseTimerRef.current = null;
    }
    if (resetSubState) {
      setAutonomousSubState((prev) => (prev === 'idle' ? prev : 'idle'));
      setWalkFacing('front');
      smoothReturnToFront();
      // Seamless Interruption: Smoothly cross-fade and return walkOffset back to origin
      setMoveTransition('transform 0.45s cubic-bezier(0.25, 0.1, 0.25, 1)');
      setWalkOffset({ x: 0, y: 0 });
    }
  }, [smoothReturnToFront]);

  // Select next destination across DOM anchors (sitting/perch spots & walk lanes)
  const selectNextIdleDestination = useCallback((curX, curY) => {
    // 1. If DOM waypoints found and available, prioritize them
    if (waypoints?.sitSpots?.length > 0 && Math.random() < 0.45) {
      const sit = waypoints.sitSpots[Math.floor(Math.random() * waypoints.sitSpots.length)];
      return { x: sit.x, y: sit.y, type: 'sit' };
    }

    if (waypoints?.walkLanes?.length > 0 && Math.random() < 0.55) {
      const lane = waypoints.walkLanes[Math.floor(Math.random() * waypoints.walkLanes.length)];
      return { x: lane.x, y: lane.y, type: 'walk' };
    }

    const bounds = getUsableScreenBounds();
    const { minX, maxX, minY, maxY, isMobile } = bounds;

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    // Full-Page Coverage: 3 columns x 3 rows (9 screen sectors covering corners, edges & center)
    const curCol = Math.min(2, Math.max(0, Math.floor(((curX - minX) / spanX) * 3)));
    const curRow = Math.min(2, Math.max(0, Math.floor(((curY - minY) / spanY) * 3)));
    const curSector = curRow * 3 + curCol;

    const recent = lastVisitedCellsRef.current || [];
    const candidateSectors = [];
    for (let s = 0; s < 9; s++) {
      if (s !== curSector && !recent.includes(s)) {
        candidateSectors.push(s);
      }
    }
    const available = candidateSectors.length > 0
      ? candidateSectors
      : [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((s) => s !== curSector);

    const targetSector = available[Math.floor(Math.random() * available.length)] ?? ((curSector + 4) % 9);
    lastVisitedCellsRef.current = [targetSector, curSector].slice(0, 3);

    const targetCol = targetSector % 3;
    const targetRow = Math.floor(targetSector / 3);

    const sectorMinX = minX + (targetCol / 3) * spanX;
    const sectorMaxX = minX + ((targetCol + 1) / 3) * spanX;
    const sectorMinY = minY + (targetRow / 3) * spanY;
    const sectorMaxY = minY + ((targetRow + 1) / 3) * spanY;

    let destX = sectorMinX + Math.random() * (sectorMaxX - sectorMinX);
    let destY = sectorMinY + Math.random() * (sectorMaxY - sectorMinY);

    destX = Math.max(minX, Math.min(maxX, Math.round(destX)));
    destY = Math.max(minY, Math.min(maxY, Math.round(destY)));

    const minDistance = isMobile ? 80 : 140;
    const dist = Math.hypot(destX - curX, destY - curY);
    if (dist < minDistance) {
      if (Math.abs(curX - minX) < Math.abs(maxX - curX)) {
        destX = Math.min(maxX, curX + minDistance + Math.random() * 50);
      } else {
        destX = Math.max(minX, curX - minDistance - Math.random() * 50);
      }
    }

    return { x: Math.round(destX), y: Math.round(destY), type: 'walk' };
  }, [getUsableScreenBounds, waypoints]);

  // Autonomous Wandering, Running & Heavy Dancing Engine
  const startAutonomousExploration = useCallback(() => {
    if (!isVisible || !isRoamEnabled || isListening || isSpeaking || dragRef.current.isDragging) {
      return;
    }

    isIdleWalkingRef.current = true;

    const performStep = () => {
      if (!isIdleWalkingRef.current || !isRoamEnabled) return;

      const walkerEl = walkerRef.current;
      const walkerRect = walkerEl?.getBoundingClientRect();

      // Ensure dimensions are initialized; fallback to container or safe screen default if 0
      const curX = (walkerRect && walkerRect.width > 0 && walkerRect.left > 0)
        ? walkerRect.left
        : (avatarPos.x + walkOffset.x || (typeof window !== 'undefined' ? window.innerWidth - characterWidth - 24 : 0));
      const curY = (walkerRect && walkerRect.height > 0 && walkerRect.top > 0)
        ? walkerRect.top
        : (avatarPos.y + walkOffset.y || (typeof window !== 'undefined' ? window.innerHeight - characterHeight - 24 : 0));

      const dest = selectNextIdleDestination(curX, curY);
      const deltaX = dest.x - curX;
      const deltaY = dest.y - curY;
      const dist = Math.hypot(deltaX, deltaY);

      // If music is playing, dance immediately on spot or traverse with groove
      if (isPlaying) {
        setAutonomousSubState('dancing');
        const danceDuration = 4500 + Math.random() * 3000;
        idlePauseTimerRef.current = setTimeout(() => {
          if (!isIdleWalkingRef.current) return;
          performStep();
        }, danceDuration);
        return;
      }

      // Dynamic movement: run for longer distances (>180px) or walk for tighter explorations
      const shouldRun = dist > 180 || Math.random() < 0.35;
      const speed = shouldRun ? 360 : 160;
      const duration = Math.round(Math.max(650, Math.min(2800, (dist / speed) * 1000)));

      setWalkFacing(deltaX < 0 ? 'left' : 'right');
      setAutonomousSubState(shouldRun ? 'running' : 'walking');

      const startOffsetX = walkOffset.x;
      const startOffsetY = walkOffset.y;
      const targetOffsetX = dest.x - avatarPos.x;
      const targetOffsetY = dest.y - avatarPos.y;
      const startTime = performance.now();

      // Force continuous RequestAnimationFrame loop for locomotion updates
      if (walkAnimFrameRef.current) {
        cancelAnimationFrame(walkAnimFrameRef.current);
      }
      setMoveTransition('none');

      const animateLocomotion = (now) => {
        if (!isIdleWalkingRef.current) return;

        const elapsed = now - startTime;
        const progress = Math.min(1, Math.max(0, elapsed / duration));
        // Cubic-bezier smooth easing approximation (ease-in-out)
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const nextX = Math.round(startOffsetX + (targetOffsetX - startOffsetX) * eased);
        const nextY = Math.round(startOffsetY + (targetOffsetY - startOffsetY) * eased);

        setWalkOffset({ x: nextX, y: nextY });

        if (progress < 1) {
          walkAnimFrameRef.current = requestAnimationFrame(animateLocomotion);
        } else {
          walkAnimFrameRef.current = null;
          setWalkFacing('front');

          // Sit / Perch on cards or groove / heavy dance
          if (dest.type === 'sit') {
            setAutonomousSubState('sitting');
            const sitDuration = 5000 + Math.random() * 4000;
            idlePauseTimerRef.current = setTimeout(() => {
              if (!isIdleWalkingRef.current) return;
              performStep();
            }, sitDuration);
          } else if (isPlaying) {
            setAutonomousSubState('dancing');
            const danceDuration = 4500 + Math.random() * 2500;
            idlePauseTimerRef.current = setTimeout(() => {
              if (!isIdleWalkingRef.current) return;
              performStep();
            }, danceDuration);
          } else {
            const shouldHeavyDance = Math.random() < 0.45;
            setAutonomousSubState(shouldHeavyDance ? 'heavy_dancing' : 'idle');
            const pauseDuration = shouldHeavyDance ? 4000 : (2000 + Math.random() * 1500);
            idlePauseTimerRef.current = setTimeout(() => {
              if (!isIdleWalkingRef.current) return;
              performStep();
            }, pauseDuration);
          }
        }
      };

      walkAnimFrameRef.current = requestAnimationFrame(animateLocomotion);
    };

    performStep();
  }, [isVisible, isRoamEnabled, isListening, isSpeaking, isPlaying, isThinking, isExecuting, avatarPos, walkOffset, characterWidth, characterHeight, selectNextIdleDestination]);

  // 2-Second (2000ms) Inactivity Trigger & Interruption Handler
  const inactivityTimerRef = useRef(null);

  const resetAutonomousTimer = useCallback(() => {
    // Seamless Interruption: instantly halt autonomous wandering/dancing on any interaction
    if (isIdleWalkingRef.current) {
      stopAutonomousWalking(true);
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (!isVisible || !isRoamEnabled || isListening || isSpeaking || isThinking || isExecuting || dragRef.current.isDragging) {
      return;
    }
    inactivityTimerRef.current = setTimeout(() => {
      startAutonomousExploration();
    }, 2000); // 2-second (2000ms) inactivity trigger
  }, [isVisible, isRoamEnabled, isListening, isSpeaking, isThinking, isExecuting, stopAutonomousWalking, startAutonomousExploration]);

  const resetIdleTimer = resetAutonomousTimer;

  // Window-wide inactivity tracking: resets 5-second timer on user interaction
  useEffect(() => {
    let lastEventTime = 0;
    const handleUserInteraction = () => {
      const now = performance.now();
      if (now - lastEventTime < 150) return;
      lastEventTime = now;
      resetAutonomousTimer();
    };

    const events = ['pointerdown', 'mousemove', 'keydown', 'touchstart', 'wheel'];
    events.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    resetAutonomousTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [resetAutonomousTimer]);

  // State changes immediately stop autonomous exploration if non-idle
  // When speech ends (isSpeaking becomes false), wait 2 seconds before resuming autonomous roaming
  const speechResumeTimerRef = useRef(null);
  useEffect(() => {
    if (speechResumeTimerRef.current) {
      clearTimeout(speechResumeTimerRef.current);
      speechResumeTimerRef.current = null;
    }

    if (isListening || isSpeaking || isPlaying || isThinking || isExecuting) {
      stopAutonomousWalking(true);
    } else {
      // Transition back to idle, wait 2 seconds, and then coordinate autonomous roaming resume
      speechResumeTimerRef.current = setTimeout(() => {
        resetAutonomousTimer();
      }, 2000);
    }

    return () => {
      if (speechResumeTimerRef.current) {
        clearTimeout(speechResumeTimerRef.current);
        speechResumeTimerRef.current = null;
      }
    };
  }, [isListening, isSpeaking, isPlaying, isThinking, isExecuting, stopAutonomousWalking, resetAutonomousTimer]);

  // Tab visibility listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      stopAutonomousWalking(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopAutonomousWalking(true);
    };
  }, [stopAutonomousWalking]);

  // Clean up all animation frames and timers on unmount
  useEffect(() => {
    return () => {
      stopAutonomousWalking(true);
    };
  }, [stopAutonomousWalking]);

  // Non-passive wheel event listener for avatar scaling without browser console violations
  useEffect(() => {
    const walker = walkerRef.current;
    if (!walker) return;
    const handleNativeWheel = (e) => {
      try {
        if (e.cancelable) {
          e.preventDefault();
        }
      } catch (_) {}
      e.stopPropagation();
      const step = e.deltaY < 0 ? 0.05 : -0.05;
      updateAvatarScale(avatarScale + step);
    };
    walker.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      walker.removeEventListener('wheel', handleNativeWheel);
    };
  }, [updateAvatarScale, avatarScale]);

  // Record command into display and 5-item rolling history
  const recordCommandDisplay = useCallback((text, actionTag = null) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    stopAutonomousWalking(true);
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
  }, [stopAutonomousWalking]);

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

  // Interaction timer refs for clicks, double-click, drag and long-press
  const longPressTimerRef = useRef(null);
  const clickTimerRef = useRef(null);
  const clickCountRef = useRef(0);
  const transientAnimTimerRef = useRef(null);
  const isPointerDownRef = useRef(false);
  const didLongPressRef = useRef(false);

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

  // Subscribe to voiceSessionService for live Web Speech events
  useEffect(() => {
    const unsub = voiceSessionService.subscribe((snapshot) => {
      if (snapshot.micState) setMicState(snapshot.micState);
      if (snapshot.lang) setCurrentLang(snapshot.lang);

      // Isolate avatar gestures strictly to active processing state (prevents false visual states on mic error)
      if (snapshot.state === SESSION_STATES.PROCESSING || snapshot.event === 'final_transcript') {
        playTransientGesture('think', 1500);
      } else if (snapshot.state === SESSION_STATES.ERROR || snapshot.state === SESSION_STATES.OFF) {
        setTransientGesture(null);
      }

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
  }, [recordCommandDisplay, resetAutonomousTimer, playTransientGesture]);

  // Mouse / cursor tracking offset for interactive gaze
  const [cursorOffset, setCursorOffset] = useState({ x: 0, y: 0 });
  const walkerRef = useRef(null);

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
    const unsub = voiceBuddyService.subscribe(({ event, volume, text }) => {
      if (event === 'speech_start' || event === 'speech_pending') {
        setIsSpeaking(true);
        resetAutonomousTimer();
        if (text) {
          clearTimeout(bubbleDismissTimerRef.current);
          setIsInterim(false);
          setLiveTranscript(text);
          setIsBubbleVisible(true);
        }
      } else if (event === 'speech_end') {
        setIsSpeaking(false);
        setInternalVolume(0);
        resetAutonomousTimer();
        bubbleDismissTimerRef.current = setTimeout(() => {
          setIsBubbleVisible(false);
          setLiveTranscript('');
        }, 2000);
      } else if (event === 'speech_text_only') {
        setIsSpeaking(false);
        setInternalVolume(0);
        if (text) {
          clearTimeout(bubbleDismissTimerRef.current);
          setIsInterim(false);
          setLiveTranscript(text);
          setIsBubbleVisible(true);
          bubbleDismissTimerRef.current = setTimeout(() => {
            setIsBubbleVisible(false);
            setLiveTranscript('');
          }, 2500);
        }
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
    stopAutonomousWalking(true);

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

    const rightMargin = isMobileScreen ? 68 : 84;
    const bottomMargin = isMobileScreen 
      ? (isBottomPlayerVisible ? 134 : 64) 
      : (isBottomPlayerVisible ? 96 : 20);
    const curLeft = isCustomPos 
      ? avatarPos.x 
      : (walkerRef.current?.getBoundingClientRect?.().left ?? (window.innerWidth - characterWidth - rightMargin));
    const curTop = isCustomPos 
      ? avatarPos.y 
      : (walkerRef.current?.getBoundingClientRect?.().top ?? (window.innerHeight - characterHeight - bottomMargin));

    dragRef.current = {
      isDragging: false,
      hasMoved: false,
      startPointerX: clientX,
      startPointerY: clientY,
      startPosX: isRoamActive ? positionRef.current.x : curLeft,
      startPosY: isRoamActive ? positionRef.current.y : curTop,
      startYaw: rotationRef.current.yaw,
      startPitch: rotationRef.current.pitch
    };
    isUserDragging.current = true;
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

      if (e.cancelable && e.preventDefault) {
        e.preventDefault(); // Prevent touch scrolling during drag
      }

      // In Roam mode: Direct drag interaction follows pointer coordinates and pauses movement
      if (isRoamActive) {
        isUserDragging.current = true;
        setAutonomousSubState('idle');

        const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
        const minX = 16;
        const maxX = Math.max(minX + 40, winW - 110);
        const minY = 64;
        const maxY = Math.max(minY + 40, winH - (isBottomPlayerVisible ? 170 : 130));

        const newX = Math.max(minX, Math.min(maxX, dragRef.current.startPosX + deltaX));
        const newY = Math.max(minY, Math.min(maxY, dragRef.current.startPosY + deltaY));

        positionRef.current = { x: newX, y: newY };
        targetPosRef.current = { x: newX, y: newY };
        setContinuousPos({ x: newX, y: newY });

        if (avatarContainerRef.current) {
          avatarContainerRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
        }
        return;
      }

      // Docked / manual positioning mode: drag avatar across screen
      dragRef.current.isDragging = true;
      setIsCustomPos(true);

      const rawX = dragRef.current.startPosX + deltaX;
      const rawY = dragRef.current.startPosY + deltaY;

      const minX = 8;
      const maxX = Math.max(minX, window.innerWidth - characterWidth - 8);
      const minY = 50;
      const bottomMargin = isMobileScreen 
        ? (isBottomPlayerVisible ? 134 : 64) 
        : (isBottomPlayerVisible ? 96 : 20);
      const maxY = Math.max(minY, window.innerHeight - characterHeight - bottomMargin);

      const clampedX = Math.max(minX, Math.min(maxX, rawX));
      const clampedY = Math.max(minY, Math.min(maxY, rawY));

      setAvatarPos({ x: clampedX, y: clampedY });
      setAutonomousSubState('walking');
      resetAutonomousTimer();
    }
  }, [characterWidth, characterHeight, isResizeMode, updateAvatarScale, isMobileScreen, isBottomPlayerVisible, resetAutonomousTimer, isRoamActive]);

  const handlePointerUp = useCallback((e) => {
    clearTimeout(resizeHoldTimerRef.current);

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

    if (isRoamActive && dragRef.current.hasMoved) {
      isUserDragging.current = false;
      // Freeze roaming for exactly 60 seconds at the dropped location
      pauseRoamingUntil.current = Date.now() + 60000;
      setAutonomousSubState('idle');
      if (e.preventDefault) e.preventDefault();
      return;
    }
    isUserDragging.current = false;

    if (isRotatingRef.current) {
      isRotatingRef.current = false;
      // Start smooth auto-return to front after inspection
      autoReturnTimerRef.current = setTimeout(() => {
        smoothReturnToFront();
      }, 3000);
      if (e.preventDefault) e.preventDefault();
      return;
    }

    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      setAutonomousSubState('idle');
      resetAutonomousTimer();

      const minX = 8;
      const maxX = Math.max(minX, window.innerWidth - characterWidth - 8);
      const minY = 50;
      const bottomMargin = isMobileScreen 
        ? (isBottomPlayerVisible ? 134 : 64) 
        : (isBottomPlayerVisible ? 100 : 24);
      const maxY = Math.max(minY, window.innerHeight - characterHeight - bottomMargin);

      const finalPos = {
        x: Math.max(minX, Math.min(maxX, avatarPos.x)),
        y: Math.max(minY, Math.min(maxY, avatarPos.y))
      };

      setAvatarPos(finalPos);

      try {
        sessionStorage.setItem('loopra_avatar_drag_pos', JSON.stringify(finalPos));
        sessionStorage.setItem('loopra_avatar_user_dragged', 'true');
      } catch (_) {}

      if (e.preventDefault) e.preventDefault();
      return;
    }

    if (didLongPressRef.current) {
      if (e.preventDefault) e.preventDefault();
      didLongPressRef.current = false;
      playTransientGesture('pose', 1800);
      return;
    }

    // Short click handling (not dragged, not resized)
    if (e.preventDefault) e.preventDefault();

    // If avatar was in fatigue sleeping mode, click/tap wakes her up!
    if (isSleepingRef.current) {
      handleWakeUpAvatar();
      return;
    }

    // If avatar was hanging on a heading ledge or doing an emote, drop with a startled laugh and run to another corner!
    if (isHangingRef.current || isMischiefRef.current) {
      isHangingRef.current = false;
      isMischiefRef.current = false;
      if (nextTargetTimeoutRef.current) {
        clearTimeout(nextTargetTimeoutRef.current);
        nextTargetTimeoutRef.current = null;
      }
      setLiveTranscript('Hahaha pakad liya! Main bhaagi!');
      setIsBubbleVisible(true);
      setLastActionTag('🏃 ESCAPING');

      // Drop down and run away to a far corner
      setAutonomousSubState('run');
      movementModeRef.current = 'run';
      landingModeRef.current = 'walk';

      const winW = typeof window !== 'undefined' ? window.innerWidth : 1000;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
      const minX = 16;
      const maxX = Math.max(minX + 40, winW - 110);
      const minY = 64;
      const maxY = Math.max(minY + 40, winH - 170);

      // Pick opposite side
      const runToLeft = positionRef.current.x > winW * 0.5;
      const escapeX = runToLeft ? minX + 20 : maxX - 30;
      const escapeY = Math.min(maxY, positionRef.current.y + 140);

      targetPosRef.current = { x: escapeX, y: escapeY };
      setTimeout(() => setIsBubbleVisible(false), 3000);
      return;
    }

    clickCountRef.current += 1;

    const isMobile = isMobileScreen || (typeof window !== 'undefined' && window.innerWidth <= 768);
    if (isMobile) {
      // Synchronous execution on mobile viewports preserves transient user activation for SpeechRecognition
      clickCountRef.current = 0;
      clearTimeout(clickTimerRef.current);
      onToggleVoiceMode();
      return;
    }

    if (clickCountRef.current === 1) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
        onToggleVoiceMode();
      }, 200);
    } else if (clickCountRef.current >= 2) {
      // DOUBLE CLICK -> WINK
      clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;
      playTransientGesture('wink', 1300);
    }
  }, [avatarPos, characterWidth, characterHeight, isMobileScreen, isResizeMode, onToggleVoiceMode, playTransientGesture, resetAutonomousTimer, smoothReturnToFront, handleWakeUpAvatar]);

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
    e?.stopPropagation?.();
    stopAutonomousWalking(true);
    setIsCustomPos(false);
    try {
      sessionStorage.removeItem('loopra_avatar_position');
      sessionStorage.removeItem('loopra_avatar_custom_pos');
      sessionStorage.removeItem('loopra_avatar_drag_pos');
      sessionStorage.removeItem('loopra_avatar_user_dragged');
      sessionStorage.removeItem('loopra_avatar_scale');
    } catch (_) {}
    updateAvatarScale(1.0);
    const def = getDefaultPosition();
    setAvatarPos(def);
    smoothReturnToFront();
    playTransientGesture('wave', 1200);
  };

  /**
   * Ground-Based Physical Movement & Tapping Engine (Promise-based)
   * Real-user UI Navigation:
   * - Mobile Case B: Target in lower navbar -> directly moves & taps lower navbar item without opening sidebar.
   * - Mobile Case A: Target in sidebar -> moves to hamburger -> taps & opens sidebar -> moves to sidebar item -> taps -> closes & returns.
   * - Desktop: Moves directly to target element.
   */
  const isNavigatingRef = useRef(false);

  /**
   * DOM Target Coordinate Locator & Interactive Screen Resolver
   * Resolves selectors or fuzzy text queries to exact viewport screen coordinates
   */
  const resolveTargetPosition = useCallback((targetQuery) => {
    if (typeof document === 'undefined' || !targetQuery) return null;

    // 1. Check direct querySelector (e.g. '[data-action="play"]', '.search-bar')
    let el = null;
    try {
      el = document.querySelector(targetQuery);
    } catch (_) {}

    // 2. Fallback: fuzzy text search across clickable buttons, cards, and links
    if (!el) {
      const q = String(targetQuery).toLowerCase().trim();
      const candidates = Array.from(document.querySelectorAll('button, a, h4, input, [role="button"], [data-nav-id]'));
      el = candidates.find((c) => {
        const text = (c.innerText || c.getAttribute('aria-label') || c.getAttribute('title') || c.getAttribute('data-nav-id') || '').toLowerCase();
        return text.includes(q);
      });
    }

    if (el) {
      // Scroll into view if needed
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (_) {}
      const rect = el.getBoundingClientRect();
      return {
        element: el,
        x: Math.max(20, Math.min(window.innerWidth - 100, rect.left + rect.width / 2 - 40)),
        y: Math.max(60, Math.min(window.innerHeight - 180, rect.top + rect.height / 2 - 20))
      };
    }
    return null;
  }, []);

  const walkToTargetAndTap = useCallback((targetNavId, label = '', onFinished = null) => {
    return new Promise((resolve) => {
      const finalize = () => {
        try {
          if (typeof onFinished === 'function') onFinished();
        } catch (_) {}
        resolve();
      };

      if (typeof document === 'undefined') {
        finalize();
        return;
      }

      if (isNavigatingRef.current) {
        finalize();
        return;
      }
      isNavigatingRef.current = true;
      stopAutonomousWalking(true);

      (async () => {
        try {
          const isMobile = isMobileScreen || (typeof window !== 'undefined' && window.innerWidth < 768);
          const cleanTarget = (targetNavId || '').toLowerCase().trim();

          // Canonical lower navbar destination mappings
          const bottomNavTargets = new Set(['home', 'discover', 'library', 'liked', 'playlists', 'radio', 'indian-radio']);
          const isBottomTarget = bottomNavTargets.has(cleanTarget) || ['liked songs', 'live radio'].includes(cleanTarget);

          // Alias mapping helper
          const resolveAlias = (id) => {
            if (id === 'saloon' || id === 'salon') return 'barber';
            if (id === 'theka') return 'pauwa';
            if (id === 'horn' || id === 'dhaba') return 'truck';
            if (id === 'favorites' || id === 'favourite' || id === 'liked songs') return 'library';
            return id;
          };

          const resolvedTarget = resolveAlias(cleanTarget);

          // Helper for smooth movement to any DOM element and tapping it
          const executeMoveAndTap = (element) => {
            return new Promise((resolveMove) => {
              if (!element) {
                resolveMove();
                return;
              }

              const targetRect = element.getBoundingClientRect();
              const walkerEl = walkerRef.current;
              const currentWalkerRect = walkerEl
                ? walkerEl.getBoundingClientRect()
                : { left: avatarPos.x, top: avatarPos.y, width: characterWidth, height: characterHeight };

              const targetCenterX = targetRect.left + targetRect.width / 2;
              const targetCenterY = targetRect.top + targetRect.height / 2;

              const curCenterX = currentWalkerRect.left + currentWalkerRect.width / 2;
              const curCenterY = currentWalkerRect.top + currentWalkerRect.height * 0.7;

              const stepDeltaX = targetCenterX - curCenterX;
              const stepDeltaY = targetCenterY - curCenterY;

              setWalkOffset((prevOffset) => {
                const nextX = prevOffset.x + stepDeltaX;
                const nextY = prevOffset.y + stepDeltaY;

                // Clamping to stay strictly inside viewport
                const containerEl = document.getElementById('loopra-3d-character-container');
                const contRect = containerEl ? containerEl.getBoundingClientRect() : { left: avatarPos.x, top: avatarPos.y };
                const baseLeft = contRect.left - prevOffset.x;
                const baseTop = contRect.top - prevOffset.y;

                const minX = 8 - baseLeft;
                const maxX = (window.innerWidth - characterWidth - 8) - baseLeft;
                const minY = 10 - baseTop;
                const maxY = (window.innerHeight - characterHeight - 10) - baseTop;

                const clampedX = Math.max(minX, Math.min(maxX, nextX));
                const clampedY = Math.max(minY, Math.min(maxY, nextY));

                const dist = Math.hypot(clampedX - prevOffset.x, clampedY - prevOffset.y);
                const duration = Math.round(Math.max(400, Math.min(1100, (dist / 650) * 1000)));
                const isRun = dist > 140;

                setWalkFacing(stepDeltaX < 0 ? 'left' : 'right');
                setAnimationState(isRun ? 'running' : 'walking');
                setMoveTransition(`transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`);

                setTimeout(() => {
                  setAnimationState('tapping');
                  setTapRipple({ x: targetCenterX, y: targetCenterY });

                  setTimeout(() => {
                    setTapRipple(null);
                    resolveMove();
                  }, 320);
                }, duration);

                return { x: clampedX, y: clampedY };
              });
            });
          };

          // Helper to return avatar back to resting base position
          const executeReturnHome = () => {
            return new Promise((resolveReturn) => {
              setWalkOffset((currentOffset) => {
                const dist = Math.hypot(currentOffset.x, currentOffset.y);
                if (dist < 4) {
                  setAnimationState('idle');
                  setWalkFacing('front');
                  resolveReturn();
                  return { x: 0, y: 0 };
                }

                const duration = Math.round(Math.max(450, Math.min(1000, (dist / 650) * 1000)));
                setWalkFacing(currentOffset.x > 0 ? 'left' : 'right');
                setAnimationState('walking');
                setMoveTransition(`transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`);

                setTimeout(() => {
                  setAnimationState('idle');
                  setWalkFacing('front');
                  setMoveTransition('transform 0.3s ease-out');
                  resolveReturn();
                }, duration + 50);

                return { x: 0, y: 0 };
              });
            });
          };

          // =====================================================================
          // CASE B: MOBILE & TARGET IN LOWER NAVBAR (Home, Discover, Liked, Playlists, Radio)
          // "If target exists in lower navbar, DO NOT open sidebar. Move directly."
          // =====================================================================
          if (isMobile && isBottomTarget) {
            let bottomEl = null;
            if (resolvedTarget === 'library' || resolvedTarget === 'liked') {
              bottomEl = document.querySelector('nav[aria-label="Mobile Navigation"] [data-nav-id="liked"]') ||
                         document.querySelector('[data-nav-id="liked"]');
            } else if (resolvedTarget === 'radio' || resolvedTarget === 'indian-radio') {
              bottomEl = document.querySelector('nav[aria-label="Mobile Navigation"] [data-nav-id="radio"]') ||
                         document.querySelector('[data-nav-id="radio"]');
            } else {
              bottomEl = document.querySelector(`nav[aria-label="Mobile Navigation"] [data-nav-id="${resolvedTarget}"]`) ||
                         document.querySelector(`nav [data-nav-id="${resolvedTarget}"]`);
            }

            if (bottomEl) {
              await executeMoveAndTap(bottomEl);
              try {
                bottomEl.click();
              } catch (_) {}
              finalize();
              await executeReturnHome();
              return;
            }
          }

          // =====================================================================
          // CASE A: MOBILE & TARGET IN SIDEBAR
          // "1. Move to hamburger button, 2. Tap hamburger, 3. Sidebar opens,
          //  4. Locate destination, 5. Tap item, 6. Page opens, 7. Return to position."
          // =====================================================================
          if (isMobile && !isBottomTarget) {
            const hamburgerBtn = document.getElementById('loopra-mobile-hamburger-btn') ||
                                 document.querySelector('[data-nav-id="hamburger"]') ||
                                 document.querySelector('header button[aria-label="Toggle Menu"]');

            const asideEl = document.querySelector('aside');
            const isAlreadyOpen = asideEl ? asideEl.classList.contains('translate-x-0') : false;

            if (hamburgerBtn && !isAlreadyOpen) {
              // 1. Avatar moves to upper hamburger button
              await executeMoveAndTap(hamburgerBtn);
              // 2. Visibly taps hamburger button -> 3. Sidebar opens
              try {
                hamburgerBtn.click();
              } catch (_) {}
              // Wait for sidebar slide-in transition (350ms)
              await new Promise((r) => setTimeout(r, 350));
            }

            // 4. Locate requested destination inside the sidebar
            let sidebarItem = document.querySelector(`aside [data-nav-id="${resolvedTarget}"]`);
            if (!sidebarItem) {
              const asideButtons = Array.from(document.querySelectorAll('aside button'));
              sidebarItem = asideButtons.find((btn) => {
                const text = (btn.innerText || btn.getAttribute('title') || '').toLowerCase();
                return text.includes(resolvedTarget) || (label && text.includes(label.toLowerCase()));
              });
            }

            if (sidebarItem) {
              // 5. Avatar clicks/taps the correct sidebar item
              await executeMoveAndTap(sidebarItem);
              // 6. The requested page opens (and sidebar automatically closes)
              try {
                sidebarItem.click();
              } catch (_) {}
              finalize();
            } else {
              finalize();
            }

            // 7. Avatar returns to its appropriate position
            await executeReturnHome();
            return;
          }

          // =====================================================================
          // CASE C: DESKTOP MODE (Preserves desktop navigation)
          // "Preserve existing desktop navigation behavior"
          // =====================================================================
          let targetEl = null;
          const resolvedCoord = resolveTargetPosition(resolvedTarget);
          if (resolvedCoord?.element) {
            targetEl = resolvedCoord.element;
          } else {
            targetEl = document.querySelector(`[data-nav-id="${resolvedTarget}"]`) ||
                       document.querySelector(`a[href*="${resolvedTarget}"]`);

            if (!targetEl) {
              const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
              targetEl = candidates.find((el) => {
                const text = (el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || '').toLowerCase();
                return text.includes(resolvedTarget) || (label && text.includes(label.toLowerCase()));
              });
            }
          }

          if (targetEl) {
            await executeMoveAndTap(targetEl);
            try {
              targetEl.click();
            } catch (_) {}
            finalize();
            await executeReturnHome();
          } else {
            finalize();
          }
        } catch (_) {
          finalize();
        } finally {
          isNavigatingRef.current = false;
        }
      })();
    });
  }, [avatarPos, characterWidth, characterHeight, isMobileScreen]);

  useEffect(() => {
    window.__loopraWalkAndTap = walkToTargetAndTap;
    window.__loopraResolveTargetPosition = resolveTargetPosition;
    return () => {
      delete window.__loopraWalkAndTap;
      delete window.__loopraResolveTargetPosition;
    };
  }, [walkToTargetAndTap, resolveTargetPosition]);

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
        ref={(el) => {
          dragRef.current.container = el;
          avatarContainerRef.current = el;
        }}
        id="loopra-3d-character-container"
        style={{
          ...(isRoamActive
            ? {
                left: 0,
                top: 0,
                transform: `translate3d(${Number.isFinite(continuousPos.x) ? continuousPos.x : ORIGIN_POS.x}px, ${Number.isFinite(continuousPos.y) ? continuousPos.y : ORIGIN_POS.y}px, 0)`
              }
            : (isCustomPos
                ? {
                    left: `${avatarPos.x}px`,
                    top: `${avatarPos.y}px`,
                    transform: isFadedIn ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(14px)'
                  }
                : {
                    right: isMobileScreen ? '14px' : '24px',
                    bottom: isMobileScreen 
                      ? (isBottomPlayerVisible 
                          ? 'calc(134px + env(safe-area-inset-bottom, 0px))' 
                          : 'calc(64px + env(safe-area-inset-bottom, 0px))') 
                      : (isBottomPlayerVisible ? '100px' : '24px'),
                    transform: isFadedIn ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(14px)'
                  })),
          width: `${characterWidth}px`,
          height: `${characterHeight}px`,
          minWidth: '140px',
          minHeight: '200px',
          touchAction: 'none',
          opacity: 1, // Guaranteed visible when mounted
          visibility: 'visible',
          pointerEvents: 'auto',
          transition: isFadedIn
            ? (isRoamActive ? 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), width 0.22s, height 0.22s' : 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1), width 0.22s cubic-bezier(0.2, 0.8, 0.4, 1), height 0.22s cubic-bezier(0.2, 0.8, 0.4, 1)')
            : 'opacity 350ms cubic-bezier(0.4, 0, 0.2, 1), transform 350ms cubic-bezier(0.4, 0, 0.2, 1), width 0.22s cubic-bezier(0.2, 0.8, 0.4, 1), height 0.22s cubic-bezier(0.2, 0.8, 0.4, 1)'
        }}
        className="fixed bottom-24 right-6 z-[60] w-60 h-[340px] pointer-events-auto flex items-center justify-center select-none will-change-[transform]"
      >
        {/* Subtle Avatar Header Controls (Free Roam Toggle, Reset Size & Position, Hide) */}
        <div className="absolute -top-7 right-0 flex items-center gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity z-50">
          <button
            type="button"
            onClick={() => {
              setIsRoamEnabled(prev => {
                const next = !prev;
                try {
                  localStorage.setItem('loopra_avatar_roaming', String(next));
                  localStorage.setItem('loopra_avatar_roam', String(next));
                } catch (_) {}
                if (!next) {
                  stopAutonomousWalking(true);
                  // Smoothly dock avatar back to ORIGIN_POS when roaming is toggled OFF
                  positionRef.current = { ...ORIGIN_POS };
                  targetPosRef.current = { ...ORIGIN_POS };
                  setContinuousPos({ ...ORIGIN_POS });
                  if (avatarContainerRef.current) {
                    avatarContainerRef.current.style.transform = `translate3d(${ORIGIN_POS.x}px, ${ORIGIN_POS.y}px, 0)`;
                  }
                }
                return next;
              });
            }}
            title={isRoamEnabled ? "Autonomous Free Roam (Active) — Click to Pause Roaming" : "Autonomous Free Roam (Paused) — Click to Enable"}
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold border transition cursor-pointer flex items-center gap-1 ${
              isRoamEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-neutral-900/80 text-neutral-400 border-white/10'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>{isRoamEnabled ? 'ROAM' : 'PARKED'}</span>
          </button>
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
        {/* Mobile: position on top/inward to prevent clipping      */}
        {/* ======================================================= */}
        {isBubbleVisible && (liveTranscript || isListening || isSpeaking) && (
          <div
            className={`absolute z-[999999] pointer-events-none select-none flex flex-col gap-1 animate-in fade-in duration-150 ${
              isMobileScreen
                ? 'bottom-full mb-3 right-0 items-end max-w-[85vw] w-max'
                : 'right-full mr-2.5 md:mr-3 bottom-24 md:bottom-28 w-48 md:w-60 items-end text-right'
            }`}
          >
            {isInterim ? (
              <p className="text-[11px] md:text-xs font-medium text-amber-300 italic drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] leading-tight break-words bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm">
                "{liveTranscript}"
              </p>
            ) : liveTranscript ? (
              <div className="flex flex-col items-end gap-0.5 bg-black/70 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/10 shadow-lg">
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
              <p className="text-[11px] md:text-xs font-medium text-amber-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] animate-pulse bg-black/60 px-2 py-0.5 rounded-md">
                Listening...
              </p>
            ) : isSpeaking ? (
              <p className="text-[11px] md:text-xs font-medium text-emerald-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] bg-black/60 px-2 py-0.5 rounded-md">
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
            activeAnimationState === 'walking' || activeAnimationState === 'idle_walking' || activeAnimationState === 'running' ? 'z-[9999999]' : ''
          }`}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          onContextMenu={(e) => {
            e.preventDefault();
            playTransientGesture('wave', 1200);
          }}
          title="Loopra AI — Drag to Reposition — Hold 500ms or Pinch/Wheel to Resize — Single Click: Voice"
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
            style={{
              width: `${characterWidth}px`,
              height: `${characterHeight}px`,
              transition: 'width 0.22s cubic-bezier(0.2, 0.8, 0.4, 1), height 0.22s cubic-bezier(0.2, 0.8, 0.4, 1)'
            }}
            className="w-60 h-[340px] pointer-events-auto flex items-center justify-center relative select-none"
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
              showGroundCircle={true}
            />
          </div>
        </div>
      </div>
    </>
  );
}
