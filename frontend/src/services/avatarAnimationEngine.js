import * as THREE from 'three';

/**
 * AvatarAnimationEngine
 * High-Fidelity Realistic Skeletal Animation System for Loopra Female Humanoid
 *
 * Implements 15 Distinct States & Kinematic Behaviors:
 * 1. IDLE_STANDING       - Upright relaxed posture, natural breathing cycle
 * 2. IDLE_VARIATION      - 5 styles: weight shift left, weight shift right, look around, stretch, playful
 * 3. WALKING             - Natural forward bipedal gait with opposite arm-leg coordination & ankle roll
 * 4. WALKING_TURN        - Coordinated body rotation with pivot footwork
 * 5. SITTING             - 3 styles: classic casual, crossed-leg relaxed, reclined sit
 * 6. STANDING_UP         - Dynamic transition from seated to standing with forward weight transfer
 * 7. DANCING             - Heavy energetic dancing with 4 distinct full-body routines (hip groove, bounce, slide, twist)
 * 8. DANCE_TURN          - 360° fluid dance spin with coordinated arms and footwork
 * 9. DANCE_JUMP          - Mid-dance explosive leap on musical drop with soft landing
 * 10. JUMPING            - Full physics jump: Anticipation -> Launch -> Apex -> Landing Impact -> Recovery
 * 11. LISTENING          - Attentive forward posture, head tilt, listening visualizer response
 * 12. THINKING           - Contemplative weight shift, hand near chin, upward gaze
 * 13. EXECUTING          - Active processing gestures with dynamic hand engagement
 * 14. SPEAKING           - Conversational cadence gestures matching speech rhythm (never static)
 * 15. CELEBRATING        - Energetic celebratory jump, arm raise, and body cheer
 */

export const AVATAR_STATES = {
  IDLE_STANDING: 'idle_standing',
  IDLE_VARIATION: 'idle_variation',
  WALKING: 'walking',
  WALKING_TURN: 'walking_turn',
  SITTING: 'sitting',
  STANDING_UP: 'standing_up',
  DANCING: 'dancing',
  DANCE_TURN: 'dance_turn',
  DANCE_JUMP: 'dance_jump',
  JUMPING: 'jumping',
  LISTENING: 'listening',
  THINKING: 'thinking',
  EXECUTING: 'executing',
  SPEAKING: 'speaking',
  CELEBRATING: 'celebrating'
};

export class AvatarAnimationEngine {
  constructor() {
    this.currentState = AVATAR_STATES.IDLE_STANDING;
    this.previousState = AVATAR_STATES.IDLE_STANDING;
    this.stateTime = 0;
    this.danceRoutine = 0;
    this.danceRoutineTime = 0;
    this.idleVariationStyle = 0;
    this.sittingStyle = 0;
    this.jumpPhase = 0; // 0..1 normalized jump progress
    this.jumpDuration = 1.1; // seconds for full jump cycle
    this.turnAngle = 0;
    this.turnProgress = 0;
    this.recentStates = [];
    this.lastStateChange = 0;
  }

  /**
   * Sets the current state with smooth transition setup
   */
  setState(nextState, styleIndex = null) {
    if (this.currentState === nextState && nextState !== AVATAR_STATES.IDLE_VARIATION) {
      return;
    }
    this.previousState = this.currentState;
    this.currentState = nextState;
    this.stateTime = 0;

    // Track state history to avoid repetitive patterns
    this.recentStates.unshift(nextState);
    if (this.recentStates.length > 6) this.recentStates.pop();

    if (nextState === AVATAR_STATES.IDLE_VARIATION) {
      this.idleVariationStyle = typeof styleIndex === 'number'
        ? styleIndex
        : Math.floor(Math.random() * 5);
    } else if (nextState === AVATAR_STATES.SITTING) {
      this.sittingStyle = typeof styleIndex === 'number'
        ? styleIndex
        : Math.floor(Math.random() * 3);
    } else if (nextState === AVATAR_STATES.DANCING) {
      this.danceRoutine = typeof styleIndex === 'number'
        ? styleIndex
        : Math.floor(Math.random() * 4);
      this.danceRoutineTime = 0;
    } else if (nextState === AVATAR_STATES.JUMPING || nextState === AVATAR_STATES.DANCE_JUMP || nextState === AVATAR_STATES.CELEBRATING) {
      this.jumpPhase = 0;
    } else if (nextState === AVATAR_STATES.DANCE_TURN || nextState === AVATAR_STATES.WALKING_TURN) {
      this.turnProgress = 0;
      this.turnAngle = 0;
    }
  }

  /**
   * Update internal state machine timers and routine rotations
   */
  update(delta, time, isPlaying, isSpeaking, isListening, isExecuting, isThinking, vol = 0) {
    this.stateTime += delta;
    this.danceRoutineTime += delta;

    // Intelligent Dance Rotation: Every 8.5s during continuous music, transition smoothly
    if (this.currentState === AVATAR_STATES.DANCING || isPlaying) {
      if (this.danceRoutineTime > 8.5) {
        this.danceRoutineTime = 0;
        // 20% chance of a dance jump or dance spin on energetic musical peak
        const roll = Math.random();
        if (roll < 0.22 && vol > 0.4) {
          this.setState(AVATAR_STATES.DANCE_JUMP);
        } else if (roll < 0.40) {
          this.setState(AVATAR_STATES.DANCE_TURN);
        } else {
          this.danceRoutine = (this.danceRoutine + 1 + Math.floor(Math.random() * 2)) % 4;
        }
      }
    }

    // Auto-progress transient action states
    if (this.currentState === AVATAR_STATES.DANCE_JUMP || this.currentState === AVATAR_STATES.JUMPING || this.currentState === AVATAR_STATES.CELEBRATING) {
      this.jumpPhase += delta / this.jumpDuration;
      if (this.jumpPhase >= 1.0) {
        this.jumpPhase = 1.0;
        if (isPlaying) {
          this.setState(AVATAR_STATES.DANCING);
        } else {
          this.setState(AVATAR_STATES.IDLE_STANDING);
        }
      }
    } else if (this.currentState === AVATAR_STATES.DANCE_TURN) {
      this.turnProgress += delta / 2.2; // 2.2s for complete dance spin
      this.turnAngle = this.turnProgress * Math.PI * 2;
      if (this.turnProgress >= 1.0) {
        this.turnProgress = 1.0;
        this.turnAngle = 0;
        this.setState(isPlaying ? AVATAR_STATES.DANCING : AVATAR_STATES.IDLE_STANDING);
      }
    } else if (this.currentState === AVATAR_STATES.WALKING_TURN) {
      this.turnProgress += delta / 1.8;
      this.turnAngle = Math.sin(this.turnProgress * Math.PI) * 0.45;
      if (this.turnProgress >= 1.0) {
        this.setState(AVATAR_STATES.WALKING);
      }
    } else if (this.currentState === AVATAR_STATES.STANDING_UP) {
      if (this.stateTime > 1.4) {
        this.setState(isPlaying ? AVATAR_STATES.DANCING : AVATAR_STATES.IDLE_STANDING);
      }
    }
  }

  /**
   * Calculates skeletal bone targets for the current state and blend weights.
   * Returns an object mapping bone names to target position/rotation vectors.
   */
  evaluateKinematics(time, vol = 0, facing = 'front', headPitch = 0, headYaw = 0) {
    const bones = {};
    const setRot = (name, x, y, z) => {
      bones[name] = bones[name] || {};
      bones[name].rot = [x, y, z];
    };
    const setPos = (name, x, y, z) => {
      bones[name] = bones[name] || {};
      bones[name].pos = [x, y, z];
    };

    const breath = Math.sin(time * 2.4);
    const musicIntensity = 0.8 + vol * 0.65;
    const danceTempo = 6.2 + vol * 2.8;

    // Base Default: Anatomically Straight, Relaxed Upright Posture
    setPos('hips', 0, 0, 0);
    setRot('spine', 0, 0, 0);
    setRot('spine1', 0, 0, 0);
    setRot('spine2', 0, 0, 0);
    setRot('neck', 0, 0, 0);
    setRot('head', headPitch, headYaw, 0);
    setRot('leftshoulder', 0, 0, 0);
    setRot('rightshoulder', 0, 0, 0);
    setRot('leftarm', 0.46, 0, 0.04);
    setRot('rightarm', 0.46, 0, -0.04);
    setRot('leftforearm', 0, 0, 0.15);
    setRot('rightforearm', 0, 0, -0.15);
    setRot('leftupleg', 0, 0, 0);
    setRot('rightupleg', 0, 0, 0);
    setRot('leftleg', 0, 0, 0);
    setRot('rightleg', 0, 0, 0);
    setRot('leftfoot', 0, 0, 0);
    setRot('rightfoot', 0, 0, 0);

    const state = this.currentState;

    // =========================================================================
    // 1. DANCING & HEAVY MUSIC CHOREOGRAPHIES
    // =========================================================================
    if (state === AVATAR_STATES.DANCING || state === 'dance' || state === 'dancing') {
      const routine = this.danceRoutine % 4;
      const phase = time * danceTempo;

      if (routine === 0) {
        // Routine 0: Energetic Freestyle Hip-Groove & Alternating Leg Step-Touch
        const sway = Math.sin(phase);
        const bounce = Math.abs(Math.cos(phase)) * 0.045 * musicIntensity;
        setPos('hips', sway * 0.055 * musicIntensity, bounce, 0);
        setRot('hips', 0, sway * 0.14 * musicIntensity, -sway * 0.09 * musicIntensity);
        setRot('spine', 0, -sway * 0.12 * musicIntensity, sway * 0.05 * musicIntensity);
        setRot('spine2', 0, -sway * 0.08 * musicIntensity, 0);

        // Active full-body leg steps with knee drives
        const leftStep = Math.max(0, Math.sin(phase) * 0.35);
        const rightStep = Math.max(0, -Math.sin(phase) * 0.35);
        setRot('leftupleg', leftStep * 0.45, 0, 0.06 + leftStep * 0.12);
        setRot('leftleg', -leftStep * 0.55, 0, 0);
        setRot('leftfoot', leftStep * 0.22, 0, 0);
        setRot('rightupleg', rightStep * 0.45, 0, -0.06 - rightStep * 0.12);
        setRot('rightleg', -rightStep * 0.55, 0, 0);
        setRot('rightfoot', rightStep * 0.22, 0, 0);

        // Freestyle rhythmic arm pumps & shoulder rolls
        setRot('leftshoulder', Math.sin(phase) * 0.08, 0, 0);
        setRot('rightshoulder', -Math.sin(phase) * 0.08, 0, 0);
        setRot('leftarm', 0.42 + Math.cos(phase) * 0.32 * musicIntensity, 0.10, 0.22 + sway * 0.25 * musicIntensity);
        setRot('rightarm', 0.42 - Math.cos(phase) * 0.32 * musicIntensity, -0.10, -0.22 - sway * 0.25 * musicIntensity);
        setRot('leftforearm', 0, 0, 0.38 + Math.abs(Math.sin(phase)) * 0.30);
        setRot('rightforearm', 0, 0, -0.38 - Math.abs(Math.sin(phase)) * 0.30);
        setRot('head', headPitch - bounce * 1.5, headYaw + sway * 0.12, sway * 0.08);

      } else if (routine === 1) {
        // Routine 1: Upbeat Dance Bounce & Dual Overhead Wave
        const beat = Math.sin(phase * 1.4);
        const bob = Math.abs(Math.sin(phase * 1.4)) * 0.055 * musicIntensity;
        setPos('hips', 0, bob, 0);
        setRot('hips', -bob * 0.5, 0, 0);
        setRot('spine', -bob * 0.4, 0, 0);

        // Knee bounce compression on downbeats
        const kneeFlex = -bob * 3.8;
        setRot('leftupleg', 0.08, 0, 0.08);
        setRot('rightupleg', 0.08, 0, -0.08);
        setRot('leftleg', kneeFlex, 0, 0);
        setRot('rightleg', kneeFlex, 0, 0);

        // Energetic high arm waves & overhead sync
        setRot('leftarm', 0.25 + beat * 0.22 * musicIntensity, 0.12, 0.65 + beat * 0.22 * musicIntensity);
        setRot('rightarm', 0.25 - beat * 0.22 * musicIntensity, -0.12, -0.65 - beat * 0.22 * musicIntensity);
        setRot('leftforearm', 0, 0, 0.65 + beat * 0.20);
        setRot('rightforearm', 0, 0, -0.65 - beat * 0.20);
        setRot('head', headPitch - bob * 2.2, headYaw, beat * 0.06);

      } else if (routine === 2) {
        // Routine 2: Side-to-Side Slide Groove & Cross-Body Sweeps
        const wave = Math.sin(phase * 0.85);
        setPos('hips', wave * 0.07 * musicIntensity, Math.abs(Math.cos(phase * 0.85)) * 0.025, 0);
        setRot('hips', 0, wave * 0.20 * musicIntensity, 0);
        setRot('spine', 0, wave * 0.15 * musicIntensity, 0);

        // Lateral leg abduction and step slide
        if (wave > 0) {
          setRot('leftupleg', 0.12, 0, 0.22 * musicIntensity);
          setRot('leftleg', -0.15, 0, 0);
          setRot('rightupleg', 0, 0, 0.02);
          setRot('rightleg', -0.32, 0, 0);
        } else {
          setRot('rightupleg', 0.12, 0, -0.22 * musicIntensity);
          setRot('rightleg', -0.15, 0, 0);
          setRot('leftupleg', 0, 0, -0.02);
          setRot('leftleg', -0.32, 0, 0);
        }

        // Cross-body fluid arm sweeps
        setRot('leftarm', 0.38, 0.1, 0.40 + Math.cos(phase * 0.85) * 0.35 * musicIntensity);
        setRot('rightarm', 0.38, -0.1, -0.40 - Math.sin(phase * 0.85) * 0.35 * musicIntensity);
        setRot('leftforearm', 0, 0, 0.42);
        setRot('rightforearm', 0, 0, -0.42);
        setRot('head', headPitch, headYaw + wave * 0.15, wave * 0.08);

      } else {
        // Routine 3: Rhythmic Waist Twist & Shoulder Rolls
        const roll = Math.sin(phase * 1.1);
        setPos('hips', 0, breath * 0.012, 0);
        setRot('hips', 0, roll * 0.24 * musicIntensity, -roll * 0.06);
        setRot('spine', 0, -roll * 0.18 * musicIntensity, 0);

        // Shoulders roll back in sync
        setRot('leftshoulder', Math.cos(phase * 1.1) * 0.16 * musicIntensity, 0, 0);
        setRot('rightshoulder', -Math.cos(phase * 1.1) * 0.16 * musicIntensity, 0, 0);

        // Alternating soft knee flex
        setRot('leftupleg', Math.sin(phase * 1.1) * 0.15, 0, 0.04);
        setRot('rightupleg', -Math.sin(phase * 1.1) * 0.15, 0, -0.04);
        setRot('leftleg', -Math.abs(Math.sin(phase * 1.1)) * 0.25, 0, 0);
        setRot('rightleg', -Math.abs(Math.cos(phase * 1.1)) * 0.25, 0, 0);

        setRot('leftarm', 0.45, 0.12, 0.25 + roll * 0.22 * musicIntensity);
        setRot('rightarm', 0.45, -0.12, -0.25 - roll * 0.22 * musicIntensity);
        setRot('leftforearm', 0, 0, 0.28);
        setRot('rightforearm', 0, 0, -0.28);
        setRot('head', headPitch, headYaw, roll * 0.12);
      }

    // =========================================================================
    // 2. DANCE TURN (360° In-Place Fluid Spin)
    // =========================================================================
    } else if (state === AVATAR_STATES.DANCE_TURN) {
      const p = this.turnProgress;
      const spinAngle = this.turnAngle;
      setPos('hips', 0, Math.sin(p * Math.PI) * 0.035, 0);
      setRot('hips', 0, spinAngle, 0);
      setRot('spine', 0, 0, 0.02);

      // Coordinated stepping pivot feet
      const footSwing = Math.sin(p * Math.PI * 4);
      setRot('leftupleg', Math.max(0, footSwing * 0.35), 0, 0.05);
      setRot('leftleg', -Math.max(0, footSwing * 0.40), 0, 0);
      setRot('rightupleg', Math.max(0, -footSwing * 0.35), 0, -0.05);
      setRot('rightleg', -Math.max(0, -footSwing * 0.40), 0, 0);

      // Flowing outstretched turn arms
      setRot('leftarm', 0.32, 0, 0.55);
      setRot('rightarm', 0.32, 0, -0.55);
      setRot('leftforearm', 0, 0, 0.28);
      setRot('rightforearm', 0, 0, -0.28);

    // =========================================================================
    // 3. JUMPING / DANCE JUMP / CELEBRATING (5-Phase Physics Engine)
    // =========================================================================
    } else if (state === AVATAR_STATES.JUMPING || state === AVATAR_STATES.DANCE_JUMP || state === AVATAR_STATES.CELEBRATING || state === 'jump') {
      const p = Math.max(0, Math.min(1, this.jumpPhase));

      if (p < 0.20) {
        // Phase 1: Anticipation (Deep Crouch & Arm Pull-Back)
        const t = p / 0.20;
        const crouchY = -0.16 * t;
        setPos('hips', 0, crouchY, 0);
        setRot('spine', 0.14 * t, 0, 0);
        setRot('leftupleg', 0.32 * t, 0, 0.04);
        setRot('rightupleg', 0.32 * t, 0, -0.04);
        setRot('leftleg', -0.65 * t, 0, 0);
        setRot('rightleg', -0.65 * t, 0, 0);
        setRot('leftfoot', -0.12 * t, 0, 0);
        setRot('rightfoot', -0.12 * t, 0, 0);
        setRot('leftarm', 0.65 * t, 0, 0.15);
        setRot('rightarm', 0.65 * t, 0, -0.15);

      } else if (p < 0.55) {
        // Phase 2: Explosive Launch & Airborne Apex
        const t = (p - 0.20) / 0.35;
        const jumpY = Math.sin(t * Math.PI) * 0.28;
        setPos('hips', 0, jumpY, 0);
        setRot('spine', -0.08 * (1 - t), 0, 0);

        // Legs extend at launch, tuck slightly near apex
        const tuck = Math.sin(t * Math.PI) * 0.32;
        setRot('leftupleg', tuck, 0, 0.08);
        setRot('rightupleg', tuck, 0, -0.08);
        setRot('leftleg', -tuck * 1.2, 0, 0);
        setRot('rightleg', -tuck * 1.2, 0, 0);
        setRot('leftfoot', 0.25 * t, 0, 0);
        setRot('rightfoot', 0.25 * t, 0, 0);

        // Celebratory arms thrust high into the air
        setRot('leftarm', -0.25, 0, 0.85);
        setRot('rightarm', -0.25, 0, -0.85);
        setRot('leftforearm', 0, 0, 0.45);
        setRot('rightforearm', 0, 0, -0.45);

      } else if (p < 0.80) {
        // Phase 3: Landing Shock Absorption (Knees Flex to Dampen Impact)
        const t = (p - 0.55) / 0.25;
        const impactY = -0.14 * (1 - t * 0.5);
        setPos('hips', 0, impactY, 0);
        setRot('spine', 0.12 * (1 - t), 0, 0);
        setRot('leftupleg', 0.25 * (1 - t), 0, 0.04);
        setRot('rightupleg', 0.25 * (1 - t), 0, -0.04);
        setRot('leftleg', -0.60 * (1 - t), 0, 0);
        setRot('rightleg', -0.60 * (1 - t), 0, 0);
        setRot('leftfoot', 0, 0, 0);
        setRot('rightfoot', 0, 0, 0);
        setRot('leftarm', 0.35, 0, 0.35);
        setRot('rightarm', 0.35, 0, -0.35);

      } else {
        // Phase 4: Smooth Recovery to Balanced Stance
        const t = (p - 0.80) / 0.20;
        setPos('hips', 0, -0.07 * (1 - t), 0);
        setRot('leftleg', -0.25 * (1 - t), 0, 0);
        setRot('rightleg', -0.25 * (1 - t), 0, 0);
      }

    // =========================================================================
    // 4. REALISTIC WALKING & TURNING
    // =========================================================================
    } else if (state === AVATAR_STATES.WALKING || state === AVATAR_STATES.WALKING_TURN || state === 'walk' || state === 'walking') {
      const strideRate = 7.2;
      const stride = Math.sin(time * strideRate);
      const bob = Math.abs(stride) * 0.024;
      setPos('hips', 0, bob, 0);
      setRot('hips', 0.04, stride * 0.08, -stride * 0.04);
      setRot('spine', 0.04, -stride * 0.06, 0);

      // Proper bipedal opposite coordination & natural knee flex
      setRot('leftupleg', stride * 0.44, 0, 0.02);
      setRot('rightupleg', -stride * 0.44, 0, -0.02);
      setRot('leftleg', Math.min(0, -stride * 0.48), 0, 0);
      setRot('rightleg', Math.min(0, stride * 0.48), 0, 0);
      setRot('leftfoot', stride * 0.18, 0, 0);
      setRot('rightfoot', -stride * 0.18, 0, 0);

      // Arm swing opposite to leg swing
      setRot('leftarm', 0.46 - stride * 0.34, 0, 0.06);
      setRot('rightarm', 0.46 + stride * 0.34, 0, -0.06);
      setRot('leftforearm', 0, 0, 0.20);
      setRot('rightforearm', 0, 0, -0.20);
      setRot('head', headPitch, headYaw, -stride * 0.04);

    // =========================================================================
    // 5. CASUAL SITTING (3 Distinct Postures) & STANDING UP
    // =========================================================================
    } else if (state === AVATAR_STATES.SITTING || state === 'sit' || state === 'sitting') {
      const style = this.sittingStyle % 3;

      if (style === 0) {
        // Style 0: Relaxed Classic Sitting (Feet Grounded, Hands on Thighs)
        setPos('hips', 0, -0.32, 0);
        setRot('spine', 0.04, 0, 0);
        setRot('leftupleg', 1.28, 0.04, 0.06);
        setRot('rightupleg', 1.28, -0.04, -0.06);
        setRot('leftleg', -1.28, 0, 0);
        setRot('rightleg', -1.28, 0, 0);
        setRot('leftfoot', 0.12, 0, 0);
        setRot('rightfoot', 0.12, 0, 0);
        setRot('leftarm', 0.48, 0, 0.10);
        setRot('rightarm', 0.48, 0, -0.10);
        setRot('leftforearm', 0, 0, 0.20);
        setRot('rightforearm', 0, 0, -0.20);

      } else if (style === 1) {
        // Style 1: Crossed-Leg Casual Sitting (Right Leg Relaxed Cross, Hands in Lap)
        setPos('hips', 0, -0.30, 0);
        setRot('spine', 0.03, 0.04, 0.02);
        setRot('leftupleg', 1.22, 0.02, 0.04);
        setRot('rightupleg', 1.32, -0.08, -0.12);
        setRot('leftleg', -1.22, 0, 0);
        setRot('rightleg', -1.32, 0, 0);
        setRot('leftarm', 0.45, 0.06, 0.12);
        setRot('rightarm', 0.42, -0.10, -0.15);
        setRot('leftforearm', 0, 0, 0.28);
        setRot('rightforearm', 0, 0, -0.28);

      } else {
        // Style 2: Reclined Casual Sit (Torso Slightly Back, Relaxed Shoulders)
        setPos('hips', 0, -0.32, 0);
        setRot('spine', -0.06, 0, 0);
        setRot('leftupleg', 1.20, 0.04, 0.08);
        setRot('rightupleg', 1.20, -0.04, -0.08);
        setRot('leftleg', -1.20, 0, 0);
        setRot('rightleg', -1.20, 0, 0);
        setRot('leftarm', 0.48, 0, 0.15);
        setRot('rightarm', 0.48, 0, -0.15);
        setRot('leftforearm', 0, 0, 0.18);
        setRot('rightforearm', 0, 0, -0.18);
      }

    } else if (state === AVATAR_STATES.STANDING_UP || state === 'standing_up') {
      // Forward weight transfer & knee extension pushing upward into stand
      const t = Math.min(1, this.stateTime / 1.4);
      setPos('hips', 0, -0.32 * (1 - t), 0);
      setRot('spine', 0.12 * Math.sin(t * Math.PI), 0, 0);
      setRot('leftupleg', 1.28 * (1 - t), 0, 0);
      setRot('rightupleg', 1.28 * (1 - t), 0, 0);
      setRot('leftleg', -1.28 * (1 - t), 0, 0);
      setRot('rightleg', -1.28 * (1 - t), 0, 0);

    // =========================================================================
    // 6. IDLE VARIATIONS (5 Distinct Behaviors)
    // =========================================================================
    } else if (state === AVATAR_STATES.IDLE_VARIATION) {
      const style = this.idleVariationStyle % 5;

      if (style === 0) {
        // Variation 0: Weight Shift to Left Leg
        setPos('hips', -0.025, breath * 0.005, 0);
        setRot('hips', 0, 0, -0.05);
        setRot('spine', 0, 0, 0.04);
        setRot('leftupleg', 0, 0, 0.03);
        setRot('leftleg', 0, 0, 0);
        setRot('rightupleg', 0, 0, -0.04);
        setRot('rightleg', -0.08, 0, 0); // slight relaxed right knee
        setRot('leftarm', 0.46, 0, 0.06);
        setRot('rightarm', 0.44, 0, -0.08);

      } else if (style === 1) {
        // Variation 1: Weight Shift to Right Leg
        setPos('hips', 0.025, breath * 0.005, 0);
        setRot('hips', 0, 0, 0.05);
        setRot('spine', 0, 0, -0.04);
        setRot('rightupleg', 0, 0, -0.03);
        setRot('rightleg', 0, 0, 0);
        setRot('leftupleg', 0, 0, 0.04);
        setRot('leftleg', -0.08, 0, 0); // slight relaxed left knee
        setRot('leftarm', 0.44, 0, 0.08);
        setRot('rightarm', 0.46, 0, -0.06);

      } else if (style === 2) {
        // Variation 2: Observant Look Around (Pans gaze left, pauses, pans right)
        const lookCycle = Math.sin(time * 1.2);
        setPos('hips', 0, breath * 0.005, 0);
        setRot('spine', 0, lookCycle * 0.08, 0);
        setRot('neck', 0, lookCycle * 0.15, 0);
        setRot('head', headPitch, headYaw + lookCycle * 0.28, 0);
        setRot('leftarm', 0.46, 0, 0.04);
        setRot('rightarm', 0.46, 0, -0.04);

      } else if (style === 3) {
        // Variation 3: Gentle Shoulder Roll & Posture Stretch
        const stretchWave = Math.sin(time * 1.5);
        setPos('hips', 0, breath * 0.008, 0);
        setRot('spine', -0.05 * Math.max(0, stretchWave), 0, 0);
        setRot('leftshoulder', Math.sin(time * 1.5) * 0.12, 0, 0);
        setRot('rightshoulder', Math.sin(time * 1.5) * 0.12, 0, 0);
        setRot('leftarm', 0.44 - stretchWave * 0.08, 0, 0.10);
        setRot('rightarm', 0.44 - stretchWave * 0.08, 0, -0.10);
        setRot('head', headPitch - stretchWave * 0.06, headYaw, 0);

      } else {
        // Variation 4: Playful Head Tilt & Subtle Friendly Greeting
        const wave = Math.sin(time * 8) * 0.15;
        setPos('hips', 0, breath * 0.005, 0);
        setRot('spine', 0, 0, 0.02);
        setRot('head', headPitch, headYaw, 0.08);
        setRot('rightarm', 0.25, -0.15, -0.45 + wave);
        setRot('rightforearm', 0, 0, -0.35);
      }

    // =========================================================================
    // 7. INTERACTION STATES (Speaking, Listening, Thinking, Executing)
    // =========================================================================
    } else if (state === AVATAR_STATES.SPEAKING || state === 'speaking') {
      // Dynamic conversational cadence (Never static hand to face!)
      const cadence = Math.sin(time * 4.5);
      const cadence2 = Math.cos(time * 3.2);
      setPos('hips', 0, breath * 0.006, 0);
      setRot('spine', cadence * 0.02, 0, 0);
      setRot('head', headPitch + cadence * 0.06, headYaw, cadence * 0.03);

      // Natural conversational gesturing alternating between hands
      setRot('leftarm', 0.44 + cadence * 0.12, 0.08, 0.12 + Math.abs(cadence2) * 0.15);
      setRot('leftforearm', 0, 0, 0.25 + Math.abs(cadence) * 0.20);
      setRot('rightarm', 0.38 - cadence2 * 0.14, -0.12, -0.18 - Math.abs(cadence) * 0.15);
      setRot('rightforearm', 0, 0, -0.32 - Math.abs(cadence2) * 0.22);

    } else if (state === AVATAR_STATES.LISTENING || state === 'listening') {
      // Attentive forward lean & focused head tilt
      setPos('hips', 0, breath * 0.005, 0.02);
      setRot('spine', 0.05, 0, 0);
      setRot('head', headPitch - 0.05, headYaw, 0.12);
      setRot('leftarm', 0.46, 0, 0.04);
      setRot('rightarm', 0.46, 0, -0.04);

    } else if (state === AVATAR_STATES.THINKING || state === 'thinking' || state === 'think') {
      // Thoughtful weight shift & subtle hand to chin
      setPos('hips', 0.015, breath * 0.005, 0);
      setRot('spine', 0, 0, -0.03);
      setRot('head', headPitch - 0.08, headYaw + 0.10, 0.06);
      setRot('leftarm', 0.46, 0, 0.04);
      setRot('rightarm', 0.24, -0.28, -0.55);
      setRot('rightforearm', 0, 0, -0.70);

    } else if (state === AVATAR_STATES.EXECUTING || state === 'executing') {
      // Active processing forward gesture pulse
      const pulse = Math.sin(time * 8);
      setPos('hips', 0, Math.sin(time * 4) * 0.008, 0);
      setRot('spine', 0.04, 0, 0);
      setRot('leftarm', 0.38 + pulse * 0.06, 0.12, 0.32);
      setRot('rightarm', 0.38 - pulse * 0.06, -0.12, -0.32);
      setRot('leftforearm', 0, 0, 0.42);
      setRot('rightforearm', 0, 0, -0.42);

    } else if (state === 'wave') {
      const wave = Math.sin(time * 14) * 0.32;
      setRot('rightarm', 0.18, -0.15, -1.35 + wave);
      setRot('rightforearm', 0, 0, -0.45);

    } else {
      // Default: IDLE_STANDING / Standing
      setPos('hips', 0, breath * 0.005, 0);
      setRot('spine', breath * 0.015, 0, 0);
    }

    return bones;
  }

  /**
   * Applies evaluated bone transforms to the Three.js skeleton with smooth slerp/lerp
   */
  applyToBones(glbBones, time, vol = 0, facing = 'front', headPitch = 0, headYaw = 0, slerpSpeed = 0.22) {
    if (!glbBones) return;
    const evaluated = this.evaluateKinematics(time, vol, facing, headPitch, headYaw);

    for (const [name, data] of Object.entries(evaluated)) {
      const bone = glbBones[name.toLowerCase()];
      if (!bone) continue;

      // Position lerp
      if (data.pos && bone.userData.restPos) {
        const targetX = bone.userData.restPos.x + data.pos[0];
        const targetY = bone.userData.restPos.y + data.pos[1];
        const targetZ = bone.userData.restPos.z + data.pos[2];
        bone.position.x = THREE.MathUtils.lerp(bone.position.x, targetX, slerpSpeed);
        bone.position.y = THREE.MathUtils.lerp(bone.position.y, targetY, slerpSpeed);
        bone.position.z = THREE.MathUtils.lerp(bone.position.z, targetZ, slerpSpeed);
      }

      // Rotation slerp
      if (data.rot && bone.userData.restQuat) {
        const deltaQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(data.rot[0], data.rot[1], data.rot[2], 'XYZ')
        );
        const targetQuat = bone.userData.restQuat.clone().multiply(deltaQuat);
        bone.quaternion.slerp(targetQuat, slerpSpeed);
      }
    }
  }
}

export const avatarAnimationEngine = new AvatarAnimationEngine();
export default avatarAnimationEngine;
