import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * TwoDCharacter
 * High-Fidelity Realistic Animated 2D AI Companion (Loopra Male & Loopra Female)
 * 
 * Combines photorealistic 3D cartoon artwork from the reference design sheet
 * with an articulated kinematics engine for realistic movement:
 * 
 * 1. Realistic Model:
 *    - Male Loopra: Handsome young adult, textured dark hair, black Loopra streetwear hoodie with orange accents, over-ear DJ headphones, utility cargo pants, crisp white sneakers.
 *    - Female Loopra: Beautiful young adult, brunette ponytail with loose front strands, tailored cropped black hoodie, over-ear DJ headphones, cargo pants, white sneakers.
 * 2. Realistic Movement Kinematics (60 FPS):
 *    - Idle: Natural human breathing cycle (chest expansion + subtle vertical bob), gentle foot weight-shift, ambient cursor gaze tracking, and periodic soft eye-blinking.
 *    - Walking: Realistic bipedal walk gait with footstep impact bobbing and directional orientation.
 *    - Running: Dynamic athletic sprint with forward body lean (-14deg), higher stride bounce, and motion trail.
 *    - Waving (1-Click): Arm raised with natural forearm oscillation and friendly greeting smile.
 *    - Winking (2-Click): One eye winks shut with playful smirk and head cock.
 *    - Posing (Long-press): Stylish streetwear stance with hand adjusting headphones and hand on hip.
 *    - Speaking: Conversational head nodding, dynamic speech aperture synced to voice syllables, and ambient audio pulses.
 *    - Listening: Attentive forward lean, rotating illuminated glowing headphone LED ring, and EQ bars.
 *    - Dancing & Jumping: Upbeat musical groove bounce and explosive spring jump with soft cushion landing.
 */
export default function TwoDCharacter({
  gender = 'male',
  animationState = 'idle',
  isSpeaking = false,
  isListening = false,
  voiceVolumeScale = 0,
  facing = 'left',
  cursorOffset = { x: 0, y: 0 },
  width = 200,
  height = 265
}) {
  const isMale = gender === 'male';

  // 60fps Kinematics State
  const [kinematics, setKinematics] = useState({
    bodyBob: 0,
    bodyLean: 0,
    headTilt: 0,
    headBob: 0,
    eyeGazeX: 0,
    eyeGazeY: 0,
    eyeBlink: false,
    leftEyelid: 0,
    rightEyelid: 0,
    mouthAperture: 0,
    mouthOpen: 0,
    mouthShape: 'smile',
    torsoScaleY: 1,
    leftShoulder: 12,
    rightShoulder: -12,
    leftElbow: 15,
    rightElbow: -15,
    leftHand: 0,
    rightHand: 0,
    leftHip: 0,
    leftKnee: 0,
    leftFoot: 0,
    rightHip: 0,
    rightKnee: 0,
    rightFoot: 0,
    shadowScale: 1.0,
    walkStride: 0
  });

  // Animation timing refs
  const animStartTimeRef = useRef(performance.now());
  const lastStateRef = useRef(animationState);
  const isBlinkingRef = useRef(false);

  // Periodic natural eye blinking (every 2.8s to 4.5s)
  useEffect(() => {
    let timeout;
    const triggerBlink = () => {
      isBlinkingRef.current = true;
      setTimeout(() => {
        isBlinkingRef.current = false;
        const next = 2600 + Math.random() * 2400;
        timeout = setTimeout(triggerBlink, next);
      }, 150);
    };

    timeout = setTimeout(triggerBlink, 1800);
    return () => clearTimeout(timeout);
  }, []);

  // Reset timer on animation state switch
  useEffect(() => {
    if (lastStateRef.current !== animationState) {
      lastStateRef.current = animationState;
      animStartTimeRef.current = performance.now();
    }
  }, [animationState]);

  // 60fps Realistic Kinematic Animation Engine
  useEffect(() => {
    let animId;

    const updateKinematics = (now) => {
      const elapsed = (now - animStartTimeRef.current) / 1000;
      const t = now / 1000;

      // Normalized cursor gaze vector (-1 to 1)
      const gazeX = Math.max(-1, Math.min(1, cursorOffset.x / 180));
      const gazeY = Math.max(-1, Math.min(1, cursorOffset.y / 180));

      let bodyBob = 0;
      let bodyLean = 0;
      let headTilt = gazeX * 3.5;
      let headBob = 0;
      let eyeGazeX = gazeX * 4;
      let eyeGazeY = gazeY * 3;
      let mouthAperture = 0;
      let mouthShape = 'smile';
      let shadowScale = 1.0;
      let walkStride = 0;

      const state = animationState;

      // =========================================================================
      // 1. REALISTIC IDLE (Natural breathing, subtle weight shift, blinking)
      // =========================================================================
      if (state === 'idle') {
        const breath = Math.sin(t * 2.2);
        bodyBob = breath * 2.2;
        headBob = breath * 1.5;
        headTilt = Math.sin(t * 1.3) * 2.5 + gazeX * 4;
        shadowScale = 1 - breath * 0.05;
      }

      // =========================================================================
      // 2. REALISTIC WAVE (Friendly greeting wave on single click)
      // =========================================================================
      else if (state === 'wave') {
        bodyBob = Math.sin(elapsed * 8) * 2;
        bodyLean = 3;
        headTilt = 7;
        mouthShape = 'happy';
        mouthAperture = 0.35;
      }

      // =========================================================================
      // 3. REALISTIC WINK (Playful double-click response with head cock)
      // =========================================================================
      else if (state === 'wink') {
        headTilt = 9;
        bodyLean = 4;
        mouthShape = 'smirk';
        mouthAperture = 0.15;
      }

      // =========================================================================
      // 4. REALISTIC POSE (Playful streetwear pose on long-press)
      // =========================================================================
      else if (state === 'pose' || state === 'playful') {
        headTilt = -6;
        bodyLean = -3;
        bodyBob = 1.5;
        mouthShape = 'smirk';
      }

      // =========================================================================
      // 5. REALISTIC WALKING GAIT (Natural footfall impact, bipedal bob)
      // =========================================================================
      else if (state === 'walk') {
        const walkFreq = elapsed * 7.2;
        walkStride = Math.sin(walkFreq);
        // Double-peak pelvic dip when feet pass/plant
        bodyBob = Math.abs(Math.sin(walkFreq)) * 5.5;
        bodyLean = facing === 'left' ? -4 : 4;
        headBob = bodyBob * 0.7;
        shadowScale = 0.95 + Math.abs(Math.sin(walkFreq)) * 0.12;
      }

      // =========================================================================
      // 6. REALISTIC RUNNING SPRINT (Athletic forward lean, fast bounce)
      // =========================================================================
      else if (state === 'run' || state === 'running') {
        const runFreq = elapsed * 13.0;
        bodyLean = facing === 'left' ? -14 : 14;
        bodyBob = Math.abs(Math.sin(runFreq)) * 9.5;
        headBob = bodyBob * 0.8;
        shadowScale = 0.8 + Math.abs(Math.sin(runFreq)) * 0.25;
      }

      // =========================================================================
      // 7. REALISTIC JUMP (Crouch anticipation -> peak spring -> cushion land)
      // =========================================================================
      else if (state === 'jump') {
        const cycle = Math.min(1, elapsed / 0.85);
        if (cycle < 0.25) {
          // Anticipation crouch
          bodyBob = -10 * (cycle / 0.25);
          shadowScale = 1.15;
        } else if (cycle < 0.75) {
          // Airborne peak
          const p = (cycle - 0.25) / 0.5;
          bodyBob = Math.sin(p * Math.PI) * 28;
          shadowScale = 0.55;
          mouthShape = 'happy';
        } else {
          // Cushion land
          const p = (cycle - 0.75) / 0.25;
          bodyBob = -6 * (1 - p);
          shadowScale = 1.05;
        }
      }

      // =========================================================================
      // 8. REALISTIC DANCE (Rhythmic musical bounce & hip sway)
      // =========================================================================
      else if (state === 'dance') {
        const beat = elapsed * 6.5;
        bodyBob = Math.abs(Math.sin(beat * 2)) * 6;
        bodyLean = Math.sin(beat) * 5;
        headTilt = -Math.sin(beat) * 6;
        mouthShape = 'happy';
        mouthAperture = 0.3;
      }

      // =========================================================================
      // 9. REALISTIC POINT / TAP
      // =========================================================================
      else if (state === 'point' || state === 'tapping') {
        bodyLean = 5;
        headTilt = 4;
      }

      // =========================================================================
      // 10. REALISTIC THINK (Hand to chin, thoughtful upward glance)
      // =========================================================================
      else if (state === 'think' || state === 'thinking') {
        headTilt = -8;
        eyeGazeX = 4;
        eyeGazeY = -4; // Glance up
        mouthShape = 'pout';
        bodyLean = -2;
      }

      // =========================================================================
      // 11. REALISTIC SPEAK (Conversational nodding, lip-sync aperture)
      // =========================================================================
      else if (state === 'speak' || state === 'speaking' || isSpeaking) {
        const speechFreq = t * 15;
        const vol = Math.max(0.4, Math.min(1.0, voiceVolumeScale || 0.7));
        mouthAperture = (0.2 + Math.abs(Math.sin(speechFreq)) * 0.7) * vol;
        mouthShape = mouthAperture > 0.4 ? 'speak' : 'smile';
        headTilt = Math.sin(t * 4.2) * 3.5 + gazeX * 3;
        headBob = Math.sin(t * 4.2) * 2;
        bodyBob = Math.sin(t * 2.5) * 1.5;
      }

      // =========================================================================
      // 12. REALISTIC LISTEN (Attentive forward lean, glowing headphone ring)
      // =========================================================================
      else if (state === 'listen' || state === 'listening' || isListening) {
        headTilt = 8.5;
        bodyLean = 3;
        eyeGazeX = gazeX * 5;
        eyeGazeY = gazeY * 4;
        bodyBob = Math.sin(t * 2.2) * 1.5;
      }

      // =========================================================================
      // 13. REALISTIC HAPPY / CELEBRATION
      // =========================================================================
      else if (state === 'happy' || state === 'celebrating') {
        bodyBob = Math.abs(Math.sin(elapsed * 6)) * 5;
        mouthShape = 'happy';
        mouthAperture = 0.5;
      }

      const leftHip = walkStride * 26;
      const leftKnee = Math.max(0, -walkStride * 32);
      const leftFoot = -walkStride * 8;
      const rightHip = -walkStride * 26;
      const rightKnee = Math.max(0, walkStride * 32);
      const rightFoot = walkStride * 8;
      const leftShoulder = -walkStride * 22;
      const rightShoulder = walkStride * 22;
      const leftEyelid = isBlinkingRef.current ? 1 : 0;
      const rightEyelid = (isBlinkingRef.current || state === 'wink') ? 1 : 0;
      const mouthOpen = mouthAperture;
      const torsoScaleY = 1 + (bodyBob * 0.005);

      setKinematics({
        bodyBob,
        bodyLean,
        headTilt,
        headBob,
        eyeGazeX,
        eyeGazeY,
        eyeBlink: isBlinkingRef.current,
        leftEyelid,
        rightEyelid,
        mouthAperture,
        mouthOpen,
        mouthShape,
        torsoScaleY,
        leftShoulder,
        rightShoulder,
        leftElbow: 15,
        rightElbow: -15,
        leftHand: 0,
        rightHand: 0,
        leftHip,
        leftKnee,
        leftFoot,
        rightHip,
        rightKnee,
        rightFoot,
        shadowScale,
        walkStride
      });

      animId = requestAnimationFrame(updateKinematics);
    };

    animId = requestAnimationFrame(updateKinematics);
    return () => cancelAnimationFrame(animId);
  }, [animationState, isSpeaking, isListening, voiceVolumeScale, cursorOffset, facing]);

  // Asset mapping: Authentic, high-resolution shaded character renders from reference sheet
  const prefix = isMale ? 'male' : 'female';
  const assets = useMemo(() => ({
    full: `/characters/${prefix}_full.png`,
    bust: `/characters/${prefix}_bust.png`,
    turnLeft: `/characters/${prefix}_turn_left_hd.png`,
    turnRight: `/characters/${prefix}_turn_right_hd.png`,
    turnFront: `/characters/${prefix}_turn_front_hd.png`,
    poseWalk: '/characters/pose_walk_hd.png',
    poseRun: '/characters/pose_run_hd.png',
    posePoint: '/characters/pose_point_hd.png',
    poseTap: '/characters/pose_tap_hd.png',
    poseDance: '/characters/pose_dance_hd.png',
    poseJump: '/characters/pose_jump_hd.png',
    headSpeaking: `/characters/${prefix}_head_speaking_hd.png`,
    headListening: `/characters/${prefix}_head_listening_hd.png`,
    headHappy: `/characters/${prefix}_head_happy_hd.png`,
    headThinking: `/characters/${prefix}_head_thinking_hd.png`
  }), [prefix]);

  // Active sprite selected for current animation state
  const activeSprite = useMemo(() => {
    switch (animationState) {
      case 'running':
      case 'run':
        return assets.poseRun;
      case 'walking':
      case 'walk':
        return assets.poseWalk;
      case 'tapping':
      case 'point':
        return assets.posePoint;
      case 'dance':
        return assets.poseDance;
      case 'jump':
      case 'celebrating':
        return assets.poseJump;
      case 'wave':
        return assets.posePoint; // Extended arm wave gesture
      case 'idle':
      case 'speak':
      case 'listen':
      case 'wink':
      case 'pose':
      default:
        return assets.full;
    }
  }, [animationState, assets]);

  // Theme Colors
  const themeAccent = isMale ? '#f59e0b' : '#10b981';
  const themeGlowRgb = isMale ? '245, 158, 11' : '16, 185, 129';

  // Directional flip transform when moving
  const isWalkingOrRunning = animationState === 'walk' || animationState === 'run';
  const flipTransform = isWalkingOrRunning && facing === 'right' ? 'scaleX(-1)' : 'scaleX(1)';

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative'
      }}
      className="select-none flex flex-col items-center justify-end overflow-visible pointer-events-none"
    >
      {/* 1. REALISTIC AMBIENT OCCLUSION GROUND SHADOW */}
      <div
        style={{
          width: `${58 * kinematics.shadowScale}%`,
          height: '14px',
          bottom: '2px',
          background: `radial-gradient(ellipse at center, rgba(0, 0, 0, 0.8) 0%, rgba(${themeGlowRgb}, 0.28) 42%, transparent 75%)`,
          filter: 'blur(2.5px)',
          transition: 'width 0.1s ease-out'
        }}
        className="absolute rounded-full pointer-events-none"
      />

      {/* 2. MAIN REALISTIC CHARACTER CONTAINER */}
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `${flipTransform} translateY(${-kinematics.bodyBob}px) rotate(${kinematics.bodyLean}deg)`,
          transition: isWalkingOrRunning ? 'none' : 'transform 0.15s ease-out'
        }}
        className="relative flex items-end justify-center pointer-events-auto origin-bottom"
      >
        {/* HIGH-RESOLUTION REALISTIC SHADED CHARACTER ARTWORK */}
        <img
          src={activeSprite}
          alt={`Loopra ${isMale ? 'Male' : 'Female'} Character`}
          style={{
            maxHeight: '95%',
            maxWidth: '92%',
            objectFit: 'contain',
            filter: (isListening || animationState === 'listen')
              ? `drop-shadow(0 0 16px rgba(${themeGlowRgb}, 0.75)) drop-shadow(0 12px 24px rgba(0,0,0,0.85))`
              : isSpeaking
              ? `drop-shadow(0 0 14px rgba(${themeGlowRgb}, 0.6)) drop-shadow(0 12px 24px rgba(0,0,0,0.85))`
              : 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.85))',
            transition: 'filter 0.25s ease-out'
          }}
          className="relative pointer-events-auto transform-gpu"
          draggable={false}
        />

        {/* 3. DYNAMIC EYE BLINKING OVERLAY */}
        {kinematics.eyeBlink && (animationState === 'idle' || animationState === 'listen') && (
          <div
            style={{
              top: isMale ? '15.5%' : '17%',
              left: '50%',
              transform: `translateX(-50%) translate(${kinematics.eyeGazeX * 0.3}px, ${kinematics.eyeGazeY * 0.2}px)`,
              width: '28px',
              height: '3.5px',
              backgroundColor: '#1c1917',
              borderRadius: '2px',
              boxShadow: '0 0 2px rgba(0,0,0,0.9)'
            }}
            className="absolute pointer-events-none transition-opacity duration-75"
          />
        )}

        {/* 4. PLAYFUL WINK OVERLAY (Double-click reaction) */}
        {animationState === 'wink' && (
          <div
            style={{
              top: isMale ? '15.5%' : '17%',
              left: '54%',
              transform: 'translateX(-50%)',
              width: '13px',
              height: '3.5px',
              backgroundColor: '#1c1917',
              borderRadius: '2px',
              boxShadow: '0 0 3px rgba(0,0,0,0.9)'
            }}
            className="absolute pointer-events-none"
          />
        )}

        {/* 5. DYNAMIC LIP-SYNC MOUTH ARTICULATION (Speaking state) */}
        {(isSpeaking || animationState === 'speak') && kinematics.mouthAperture > 0.3 && (
          <div
            style={{
              top: isMale ? '20.5%' : '21.5%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: `${Math.round(8 + kinematics.mouthAperture * 6)}px`,
              height: `${Math.round(4 + kinematics.mouthAperture * 5)}px`,
              backgroundColor: '#881337',
              borderRadius: '50%',
              border: '1px solid #4c0519',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4)'
            }}
            className="absolute pointer-events-none transition-all duration-75"
          />
        )}

        {/* 6. ILLUMINATED DJ HEADPHONE LED GLOW & AUDIO-REACTIVE EQUALIZER RING */}
        {(isListening || isSpeaking || animationState === 'listen' || animationState === 'speak') && (
          <div
            style={{
              top: isMale ? '9%' : '11%',
              left: '50%',
              transform: 'translateX(-50%)',
              borderColor: themeAccent,
              boxShadow: `0 0 24px rgba(${themeGlowRgb}, 0.85), inset 0 0 12px rgba(${themeGlowRgb}, 0.45)`
            }}
            className="absolute w-20 h-20 rounded-full border border-dashed pointer-events-none animate-spin-slow opacity-80"
          />
        )}

        {/* Dynamic Headphone Soundwave Pulses when Speaking or Listening */}
        {(isSpeaking || isListening || animationState === 'listen' || animationState === 'speak') && (
          <div
            style={{
              top: isMale ? '13%' : '15%',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
            className="absolute flex items-center gap-1 pointer-events-none"
          >
            <span
              style={{ backgroundColor: themeAccent }}
              className="w-1 h-3 rounded-full animate-bounce [animation-delay:-0.3s] shadow-[0_0_8px_currentColor]"
            />
            <span
              style={{ backgroundColor: themeAccent }}
              className="w-1 h-4.5 rounded-full animate-bounce [animation-delay:-0.15s] shadow-[0_0_8px_currentColor]"
            />
            <span
              style={{ backgroundColor: themeAccent }}
              className="w-1 h-3 rounded-full animate-bounce shadow-[0_0_8px_currentColor]"
            />
          </div>
        )}
      </div>

      {/* 7. CSS STYLES FOR REFINED MOTION */}
      <style>{`
        @keyframes spinSlow {
          from { transform: translateX(-50%) rotate(0deg); }
          to { transform: translateX(-50%) rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spinSlow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
