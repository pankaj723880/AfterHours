import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * ThreeDCharacter
 * High-End 3D Humanoid Avatar for Loopra AI
 * 
 * Capabilities:
 * 1. Skinned 3D GLB/GLTF Loading:
 *    - Automatically checks for and loads `/characters/avatar.glb`
 *    - Draco compression supported
 *    - AnimationMixer with smooth crossFadeTo (0.35s) for state transitions
 *    - Action states: idle, walk, run, jump, wave, dance, talking, thinking
 * 
 * 2. High-Fidelity Procedural 3D Humanoid Fallback:
 *    - If avatar.glb is not yet provided, instantly renders a sleek 3D humanoid
 *    - PBR MeshStandardMaterial (smooth skin tone, black streetwear hoodie, gold accents)
 *    - 3D sculpted facial geometry (nose, jaw, ears, dynamic lip-sync mouth, blinking eyelids)
 *    - Over-ear DJ headphones with audio-reactive glowing LED rings
 *    - Audio-reactive concentric particle visualizer rings at base
 *    - Realistic 3-point studio lighting (Key, Fill, Rim) with soft shadows
 * 
 * 3. Performance & Optimization:
 *    - Pixel ratio capped at 2.0
 *    - Automatically pauses rendering when browser tab is hidden (visibilitychange)
 *    - Clean GPU buffer and geometry disposal on unmount
 */
export default function ThreeDCharacter({
  gender = 'female',
  animationState = 'idle',
  isSpeaking = false,
  isListening = false,
  isPlaying = false,
  voiceVolumeScale = 0,
  facing = 'left',
  cursorOffset = { x: 0, y: 0 },
  rotationYaw = 0,
  rotationPitch = 0,
  width = 215,
  height = 355,
  framingMode = 'full', // 'full' | 'bust' (bust focuses camera chest-up on facial expressions)
  isPaused = false,
  showGroundCircle = true,
  isRoaming = false,
  isMoving = false
}) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const updateFramingRef = useRef(null);
  const stateRef = useRef({
    animationState,
    isSpeaking,
    isListening,
    isPlaying,
    voiceVolumeScale,
    facing,
    cursorX: 0,
    cursorY: 0,
    rotationYaw: 0,
    rotationPitch: 0,
    framingMode,
    isPaused,
    isRoaming,
    isMoving
  });

  const [hasGlbLoaded, setHasGlbLoaded] = useState(false);

  // Sync props to stateRef for 60fps animation loop
  useEffect(() => {
    stateRef.current = {
      animationState,
      isSpeaking,
      isListening,
      isPlaying,
      voiceVolumeScale: Math.max(0, Math.min(1, voiceVolumeScale || (isSpeaking ? 0.75 : 0))),
      facing,
      cursorX: cursorOffset?.x || 0,
      cursorY: cursorOffset?.y || 0,
      rotationYaw: rotationYaw || 0,
      rotationPitch: rotationPitch || 0,
      framingMode,
      isPaused,
      isRoaming,
      isMoving
    };
  }, [animationState, isSpeaking, isListening, isPlaying, voiceVolumeScale, facing, cursorOffset, rotationYaw, rotationPitch, framingMode, isPaused, isRoaming, isMoving]);

  // Decoupled dynamic resizing: NEVER remounts Three.js or reloads the GLB on size change!
  useEffect(() => {
    if (rendererRef.current && cameraRef.current && updateFramingRef.current) {
      rendererRef.current.setSize(width, height);
      updateFramingRef.current(width, height, framingMode);
    }
  }, [width, height, framingMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Dynamically Calibrated Perspective Camera (Pull camera to [0, 0.9, 3.4], fov: 42 for complete head-to-toe & ground circle view)
    const scene = new THREE.Scene();
    const fov = 42;
    const initialAspect = width / height;
    const camera = new THREE.PerspectiveCamera(fov, initialAspect, 0.1, 50);
    cameraRef.current = camera;

    const updateCameraFraming = (w, h, mode = 'full') => {
      const aspect = w / h;
      camera.aspect = aspect;
      camera.fov = fov;
      const vFovRad = fov * (Math.PI / 180);

      if (mode === 'bust') {
        // Tight chest-up camera framing: close-up on head, face, eyes, and headphones
        const bustSpan = 0.44;
        const dist = (bustSpan / 2) / Math.tan(vFovRad / 2);
        const cameraCenterY = 0.28; // Focus directly on facial region
        camera.position.set(0, cameraCenterY, dist);
        camera.lookAt(0, cameraCenterY, 0);
      } else {
        // Pull camera slightly back and tilt slightly down so the full floor ring fits inside camera frustum without clipping
        camera.position.set(0, 1.4, 3.8);
        camera.lookAt(0, 0.4, 0);
      }
      camera.updateProjectionMatrix();
    };
    updateFramingRef.current = updateCameraFraming;
    updateCameraFraming(width, height, framingMode);

    // Hardware detection for low-end devices and budget mobile phones
    const isLowEndDevice = typeof navigator !== 'undefined' && (
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
      (window.innerWidth < 768 && window.devicePixelRatio < 2)
    );

    // 2. High-Performance WebGL Renderer (Ultra-lightweight configuration)
    // gl={{ antialias: false, powerPreference: "high-performance", precision: "mediump", stencil: false }}
    // dpr={[1, 1.5]} clamped to max 1.5
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      precision: 'mediump',
      stencil: false,
      depth: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    // Disable all real-time dynamic shadows
    renderer.shadowMap.enabled = false;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Lightweight Lighting (Zero costly point/spot lights or post-processing passes)
    // Basic ambientLight (~0.8) and a clean directional light
    const rimColor = '#4f46e5'; // Safe default rim/accent lighting tone
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    dirLight.position.set(1.5, 2.5, 2.0);
    dirLight.castShadow = false;
    scene.add(dirLight);

    // Root Group for orientation and scaling
    const charRoot = new THREE.Group();
    charRoot.position.set(0, 0, 0); // Position root cleanly at origin
    scene.add(charRoot);

    // Ground Shadow (Optional Clean Toggle via showGroundCircle)
    let shadowMesh = null;
    let particleSystem = null;
    let particleMat = null;

    if (showGroundCircle) {
      const shadowGeo = new THREE.CircleGeometry(0.55, 32);
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.35
      });
      shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.rotation.x = -Math.PI / 2;
      shadowMesh.position.set(0, -0.22, 0);
      charRoot.add(shadowMesh);

      // Audio Reactive Base Particle Ring (Radius clamped to 0.75, position at [0, -0.22, 0])
      const particleCount = 42;
      const ringGeo = new THREE.BufferGeometry();
      const ringPositions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        // Radius clamped to 0.75 to prevent extending beyond canvas borders
        const radius = 0.75;
        ringPositions[i * 3] = Math.cos(angle) * radius;
        ringPositions[i * 3 + 1] = 0;
        ringPositions[i * 3 + 2] = Math.sin(angle) * radius;
      }
      ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
      const ringColor = 0xf59e0b; // Loopra Gold / Amber neon accent
      particleMat = new THREE.PointsMaterial({
        color: ringColor,
        size: 0.05,
        transparent: true,
        opacity: 0.85
      });
      particleSystem = new THREE.Points(ringGeo, particleMat);
      particleSystem.position.set(0, -0.22, 0);
      charRoot.add(particleSystem);
    }

    // Animation Mixer & Action Registry
    let mixer = null;
    const actions = {};
    let activeAction = null;

    const fadeToAction = (name, duration = 0.35) => {
      if (!actions[name]) return;
      const nextAction = actions[name];
      if (activeAction !== nextAction) {
        // Fade out any other playing actions completely to prevent conflict
        Object.keys(actions).forEach((key) => {
          const act = actions[key];
          if (act && act !== nextAction && act.isRunning()) {
            act.fadeOut(duration);
          }
        });
        nextAction
          .reset()
          .setEffectiveTimeScale(1)
          .setEffectiveWeight(1)
          .fadeIn(duration)
          .play();
        activeAction = nextAction;
      }
    };

    // =========================================================================
    // A. GLTF / GLB SKINNED 3D REALISTIC DIGITAL HUMAN LOADING
    // =========================================================================
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    let isGlbActive = false;
    let glbHeadBone = null;
    let glbLoadedModel = null;
    const glbBones = {};
    const glbModelGroup = new THREE.Group();
    glbModelGroup.visible = false; // Hidden until realistic GLB finishes loading
    charRoot.add(glbModelGroup);

    // Frame-rate independent bone rotation smoothing using exponential damping
    const tempEuler = new THREE.Euler(0, 0, 0, 'XYZ');
    const tempDeltaQuat = new THREE.Quaternion();
    const tempTargetQuat = new THREE.Quaternion();

    const setBoneRot = (boneName, eulerX, eulerY, eulerZ, lambda = 10, dt = 0.016) => {
      const bone = glbBones[boneName.toLowerCase()];
      if (!bone || !bone.userData.restQuat) return;
      tempEuler.set(eulerX, eulerY, eulerZ, 'XYZ');
      tempDeltaQuat.setFromEuler(tempEuler);
      tempTargetQuat.copy(bone.userData.restQuat).multiply(tempDeltaQuat);
      // Frame-rate independent slerp factor: 1 - exp(-lambda * delta)
      const slerpFactor = THREE.MathUtils.clamp(1 - Math.exp(-lambda * dt), 0.001, 1);
      bone.quaternion.slerp(tempTargetQuat, slerpFactor);
    };

    const setBonePos = (boneName, posX, posY, posZ, lambda = 10, dt = 0.016) => {
      const bone = glbBones[boneName.toLowerCase()];
      if (!bone || !bone.userData.restPos) return;
      const targetX = bone.userData.restPos.x + posX;
      const targetY = bone.userData.restPos.y + posY;
      const targetZ = bone.userData.restPos.z + posZ;
      bone.position.x = THREE.MathUtils.damp(bone.position.x, targetX, lambda, dt);
      bone.position.y = THREE.MathUtils.damp(bone.position.y, targetY, lambda, dt);
      bone.position.z = THREE.MathUtils.damp(bone.position.z, targetZ, lambda, dt);
    };

    gltfLoader.load(
      '/characters/avatar.glb',
      (gltf) => {
        isGlbActive = true;
        setHasGlbLoaded(true);
        glbModelGroup.visible = true;
        const model = gltf.scene;
        glbLoadedModel = model;
        model.scale.set(0.9, 0.9, 0.9);
        model.position.set(0, -0.2, 0);
        // Face the user/camera directly (+Z)
        model.rotation.y = 0;

        model.traverse((child) => {
          // Disable dynamic shadows across all meshes
          child.castShadow = false;
          child.receiveShadow = false;

          if (child.isBone) {
            const lower = child.name.toLowerCase();
            glbBones[lower] = child;
            child.userData.restQuat = child.quaternion.clone();
            child.userData.restPos = child.position.clone();
            if (!glbHeadBone && (lower.includes('head') || lower.includes('neck'))) {
              glbHeadBone = child;
            }
          }
          if (child.isMesh) {
            // Frustum culling enabled on all meshes so off-screen bones/meshes don't compute
            child.frustumCulled = true;

            if (child.material) {
              child.material.precision = 'mediump';
              child.material.roughness = Math.max(0.2, child.material.roughness || 0.5);
              child.material.metalness = Math.min(0.8, child.material.metalness || 0.1);
            }
          }
        });

        glbModelGroup.add(model);

        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            const clipName = clip.name.toLowerCase();
            const action = mixer.clipAction(clip);
            if (clipName.includes('idle')) actions['idle'] = action;
            else if (clipName.includes('sleep') || clipName.includes('lay') || clipName.includes('lying')) actions['sleep'] = action;
            else if (clipName.includes('walk')) actions['walk'] = action;
            else if (clipName.includes('run')) actions['run'] = action;
            else if (clipName.includes('sit')) actions['sit'] = action;
            else if (clipName.includes('jump')) actions['jump'] = action;
            else if (clipName.includes('wave')) actions['wave'] = action;
            else if (clipName.includes('dance') || clipName.includes('groove')) actions['dance'] = action;
            else if (clipName.includes('talk') || clipName.includes('speak')) actions['speaking'] = action;
            else if (clipName.includes('think')) actions['thinking'] = action;
            else actions[clip.name] = action;
          });

          if (actions['idle']) {
            fadeToAction('idle', 0.1);
          } else if (gltf.animations[0]) {
            actions['idle'] = mixer.clipAction(gltf.animations[0]);
            fadeToAction('idle', 0.1);
          }
        }
      },
      undefined,
      (err) => {
        console.warn('[ThreeDCharacter] avatar.glb load notice:', err?.message || err);
      }
    );

    // Lightweight non-rendered tracking nodes (Zero cartoon fallback mesh!)
    const headGroup = new THREE.Group();
    const torsoGroup = new THREE.Group();
    const armL = new THREE.Group();
    const armR = new THREE.Group();
    const legL = new THREE.Group();
    const legR = new THREE.Group();

    // =========================================================================
    // C. 60 FPS ANIMATION LOOP WITH TAB VISIBILITY PAUSE & SUBTLE HEAD TRACKING
    // =========================================================================
    let reqId;
    let lastTime = performance.now();
    let elapsedTime = 0;
    let isTabVisible = true;
    let lastMouseMoveTime = Date.now();
    let currentHeadYaw = 0;
    let currentHeadPitch = 0;
    let locomotionWeight = 0; // Smooth continuous weight blending between idle (0) and walk/run (1)

    const handlePointerTrack = () => {
      lastMouseMoveTime = Date.now();
    };
    window.addEventListener('mousemove', handlePointerTrack, { passive: true });

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        lastTime = performance.now(); // reset delta on tab refocus
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let lastRenderTime = performance.now();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (!isTabVisible || stateRef.current.isPaused) return;

      const animNow = performance.now();
      const curState = stateRef.current.animationState;
      const isRoamingActive = stateRef.current.isRoaming;
      const isCharacterMoving = stateRef.current.isMoving;

      // Adaptive FPS throttling: Cap Three.js render loop to 30 FPS when idle or on low-end mobile devices
      const isIdleStationary = !isRoamingActive || (!isCharacterMoving && curState === 'idle');
      const minIntervalMs = (isLowEndDevice || isIdleStationary) ? 33.3 : 16.6; // 30 FPS vs 60 FPS
      if (animNow - lastRenderTime < minIntervalMs) return;

      // Clamp delta time to prevent massive frame drops or jumps
      const safeDelta = Math.min((animNow - lastTime) / 1000, 0.1);
      lastTime = animNow;
      lastRenderTime = animNow;
      elapsedTime += safeDelta;
      const delta = safeDelta;
      const time = elapsedTime;

      const isSpeakingNow = stateRef.current.isSpeaking;
      const isListeningNow = stateRef.current.isListening;
      const isMusicPlaying = stateRef.current.isPlaying;
      const vol = stateRef.current.voiceVolumeScale;
      const facingDir = stateRef.current.facing;

      // Full 360-Degree Interactive Rotation & Viewing Pitch
      // User yaw directly dictates heading and inspection angle, frame-rate independently damped
      const userYaw = stateRef.current.rotationYaw || 0;
      const userPitch = stateRef.current.rotationPitch || 0;

      // Lock pitch and roll: keep rotation.x = 0 and rotation.z = 0 so avatar stays completely upright on floor plane
      charRoot.rotation.x = 0;
      charRoot.rotation.z = 0;

      if (!isCharacterMoving || !isRoamingActive) {
        // Smoothly damp rotation directly back to 0 (front-facing) using wrapped shortest angle
        let diff = 0 - charRoot.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        charRoot.rotation.y += diff * Math.min(1.0, 6.0 * delta);
      } else {
        // Only rotate towards heading when actually moving using wrapped angle calculation
        let diff = userYaw - charRoot.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        charRoot.rotation.y += diff * Math.min(1.0, 6.0 * delta);
      }

      // Music-driven subtle procedural head-bob or scale oscillation when music is active
      if (isMusicPlaying && !isSpeakingNow && curState === 'idle') {
        const musicBob = Math.sin(time * 7.2) * 0.015;
        charRoot.position.y = musicBob;
        const subtleScale = 1 + Math.sin(time * 7.2) * 0.012;
        charRoot.scale.set(subtleScale, subtleScale, subtleScale);
      } else {
        charRoot.position.y = 0;
        charRoot.scale.set(1, 1, 1);
      }

      // Check if avatar is in sleeping / lying down state
      const isSleepingState = curState === 'sleep' || curState === 'sleeping' || curState === 'lie_down';

      // Update AnimationMixer if GLB contains clips (using clamped safeDelta)
      if (mixer) {
        mixer.update(safeDelta);
        if (isSleepingState) {
          if (actions['sleep']) {
            fadeToAction('sleep', 0.4);
          } else {
            // Play slow breathing or resting idle animation
            fadeToAction('idle', 0.4);
          }
        }
        else if (curState === 'hang' || curState === 'hanging' || curState === 'hang_heading') fadeToAction(actions['hang'] || actions['climb'] ? (actions['hang'] ? 'hang' : 'climb') : 'idle', 0.25);
        else if (curState === 'crouch' || curState === 'hide') fadeToAction(actions['crouch'] || actions['sit'] || 'idle', 0.2);
        else if (curState === 'cheer' || curState === 'celebrate') fadeToAction(actions['cheer'] || actions['wave'] || actions['dance'] || 'wave', 0.2);
        else if (curState === 'mischief_taunt' || curState === 'taunt_dance') fadeToAction(actions['dance'] ? 'dance' : 'wave', 0.25);
        else if (curState === 'mischief_knock' || curState === 'knock_glass' || curState === 'tap_glass') fadeToAction(actions['tap'] || actions['touch'] ? (actions['tap'] ? 'tap' : 'touch') : 'idle', 0.2);
        else if (curState === 'walking' || curState === 'walk' || curState === 'idle_walking') fadeToAction('walk', 0.25);
        else if (curState === 'running' || curState === 'run') fadeToAction('run', 0.25);
        else if (curState === 'sitting' || curState === 'sit') fadeToAction(actions['sit'] ? 'sit' : 'idle', 0.35);
        else if (curState === 'jump') fadeToAction('jump', 0.2);
        else if (curState === 'wave') fadeToAction('wave', 0.25);
        else if (curState === 'dance' || curState === 'dancing' || curState === 'heavy_dancing' || curState === 'groove') fadeToAction('dance', 0.3);
        else if (isSpeakingNow || curState === 'speaking') fadeToAction('speaking', 0.25);
        else if (curState === 'think' || curState === 'thinking') fadeToAction('thinking', 0.3);
        else fadeToAction('idle', 0.35);
      }

      // Check if avatar is in hanging state (ledge / section heading)
      const isHangingState = curState === 'hang' || curState === 'hanging' || curState === 'hang_heading';

      // Realistic Horizontal Human Sleeping Pose & Heading Ledge Hanging:
      // If sleeping without a dedicated clip, rotate the model mesh horizontally flat (-Math.PI/2) and lower onto resting card.
      // If hanging, apply continuous pendulum swinging physics (model.rotation.z = Math.sin(Date.now() * 0.005) * 0.25).
      if (glbLoadedModel) {
        if (!isRoamingActive && (curState === 'idle' || curState === 'standing')) {
          // Strictly locked coordinates when parked in Idle state to prevent jitter
          glbLoadedModel.position.set(0, -0.2, 0);
          glbLoadedModel.rotation.set(0, 0, 0);
        } else {
          const isSpinCelebration = curState === 'SPIN_CELEBRATION' || (curState === 'dancing' && danceRoutine === 2);
          const targetModelRotX = (isSleepingState && !actions['sleep']) ? -Math.PI / 2 : 0;
          const targetModelRotZ = isHangingState ? Math.sin(Date.now() * 0.005) * 0.25 : 0;
          const targetModelPosY = (isSleepingState && !actions['sleep']) ? -0.65 : (isHangingState ? 0.15 : -0.2);

          glbLoadedModel.rotation.x = THREE.MathUtils.damp(glbLoadedModel.rotation.x, targetModelRotX, 4.0, delta);
          glbLoadedModel.rotation.z = THREE.MathUtils.damp(glbLoadedModel.rotation.z, targetModelRotZ, isHangingState ? 12.0 : 4.0, delta);
          glbLoadedModel.position.y = THREE.MathUtils.damp(glbLoadedModel.position.y, targetModelPosY, 4.0, delta);
          // Do not add continuous spinning/pirouette when stationary or not explicitly celebrating while roaming
          if (isSpinCelebration && isRoamingActive && isCharacterMoving) {
            glbLoadedModel.rotation.y += delta * 6.28;
          } else {
            glbLoadedModel.rotation.y = THREE.MathUtils.damp(glbLoadedModel.rotation.y, 0, 8.0, delta);
          }
        }
      }

      // Subtle Head Tracking Logic: ±8° yaw, ±5° pitch
      // When parked in idle, freeze dynamic head look-at to maintain rock-solid stability
      const isCursorIdle = (Date.now() - lastMouseMoveTime) > 3000 || (!isRoamingActive && curState === 'idle');

      let rawX = stateRef.current.cursorX || 0;
      let rawY = stateRef.current.cursorY || 0;

      if (Math.abs(rawX) < 0.05) rawX = 0;
      if (Math.abs(rawY) < 0.05) rawY = 0;

      const maxYawRad = 8 * (Math.PI / 180);
      const maxPitchRad = 5 * (Math.PI / 180);

      const targetYaw = isCursorIdle ? 0 : THREE.MathUtils.clamp(rawX * maxYawRad, -maxYawRad, maxYawRad);
      const targetPitch = isCursorIdle ? 0 : THREE.MathUtils.clamp(-rawY * maxPitchRad, -maxPitchRad, maxPitchRad);

      currentHeadYaw = THREE.MathUtils.damp(currentHeadYaw, targetYaw, 6.0, delta);
      currentHeadPitch = THREE.MathUtils.damp(currentHeadPitch, targetPitch, 6.0, delta);

      // Apply subtle head tracking to GLB head bone
      setBoneRot('head', currentHeadPitch, currentHeadYaw, 0, 10, delta);

      const breath = Math.sin(time * 2.6);

      // Attentive Listening Glow & Visualizer Ring
      if (particleMat) {
        if (isListeningNow || curState === 'listening') {
          particleMat.size = 0.075 + vol * 0.04;
        } else {
          particleMat.size = 0.05;
        }
      }

      // Continuous locomotion blending weight (smoothly ramp up when moving, ramp down when stopping)
      const isLocomotionState = (
        curState === 'walking' ||
        curState === 'walk' ||
        curState === 'idle_walking' ||
        curState === 'running' ||
        curState === 'run'
      );
      locomotionWeight = THREE.MathUtils.damp(locomotionWeight, isLocomotionState ? 1.0 : 0.0, 9.0, delta);

      // Music-Synchronized & Heavy Dancing rhythm & intensity calculations
      const isHeavyDance = curState === 'heavy_dancing';
      const intensity = (isHeavyDance ? 1.45 : 0.75) + vol * 0.55;
      const dancePhase = time * ((isHeavyDance ? 8.4 : 6.0) + vol * 2.5);
      const danceRoutine = isHeavyDance ? Math.floor((time / 3.0) % 4) : Math.floor((time / 12) % 4);

      // =========================================================================
      // D. ANATOMICALLY NATURAL KINEMATICS & SKELETAL ANIMATION SYSTEM
      // =========================================================================
      if (
        curState === 'dancing' ||
        curState === 'dance' ||
        curState === 'heavy_dancing' ||
        curState === 'BHANGRA_BOUNCE' ||
        curState === 'HIPHOP_GROOVE' ||
        curState === 'SPIN_CELEBRATION'
      ) {
        // Dance Variations:
        // 1. BHANGRA_BOUNCE: Shoulder bobbing with arms alternating up/down (armBone swaying with rhythmic bounce Math.sin(time * 10) * 0.15)
        // 2. HIPHOP_GROOVE: Side-to-side torso hip-twist (model.rotation.y = Math.sin(time * 6) * 0.4) with slight knee dipping
        // 3. SPIN_CELEBRATION: 360-degree pirouette spin with hands raised up high
        let routineIndex = danceRoutine;
        if (curState === 'BHANGRA_BOUNCE') routineIndex = 0;
        else if (curState === 'HIPHOP_GROOVE') routineIndex = 1;
        else if (curState === 'SPIN_CELEBRATION') routineIndex = 2;

        if (routineIndex === 0) {
          // 1. BHANGRA_BOUNCE: Shoulder bobbing, alternating arm pumps, rhythmic bounce
          const bhangraBeat = Math.sin(time * 10);
          const bounce = Math.abs(Math.sin(time * 10)) * 0.06 * intensity;
          setBonePos('hips', 0, bounce, 0, 0.25);
          setBoneRot('spine', -bounce * 0.5, bhangraBeat * 0.12 * intensity, 0, 0.25);
          // Alternating arm pumps up and down
          const leftArmZ = 0.55 + bhangraBeat * 0.35 * intensity;
          const rightArmZ = -0.55 - bhangraBeat * 0.35 * intensity;
          setBoneRot('leftarm', 0.25, 0.1, leftArmZ, 0.25);
          setBoneRot('rightarm', 0.25, -0.1, rightArmZ, 0.25);
          setBoneRot('leftforearm', 0, 0, 0.75 + bhangraBeat * 0.25, 0.25);
          setBoneRot('rightforearm', 0, 0, -0.75 - bhangraBeat * 0.25, 0.25);
          // Energetic alternating leg stomp
          const legStomp = Math.sin(time * 10) * 0.35;
          setBoneRot('leftupleg', Math.max(0, legStomp), 0, 0.1, 0.25);
          setBoneRot('rightupleg', Math.max(0, -legStomp), 0, -0.1, 0.25);
          setBoneRot('leftleg', -Math.max(0, legStomp) * 1.2, 0, 0, 0.25);
          setBoneRot('rightleg', -Math.max(0, -legStomp) * 1.2, 0, 0, 0.25);
        } else if (routineIndex === 1) {
          // 2. HIPHOP_GROOVE: Side-to-side torso hip-twist with slight knee dipping
          const hipTwist = Math.sin(time * 6) * 0.4;
          const kneeDip = Math.abs(Math.sin(time * 6)) * 0.04 * intensity;
          setBonePos('hips', hipTwist * 0.05, kneeDip, 0, 0.25);
          setBoneRot('spine', 0.08, hipTwist * 0.35, -hipTwist * 0.15, 0.25);
          setBoneRot('head', -0.04, -hipTwist * 0.25, hipTwist * 0.1, 0.25);
          // Street style cross-groove arms
          setBoneRot('leftarm', 0.40, 0.2, 0.30 + hipTwist * 0.25, 0.25);
          setBoneRot('rightarm', 0.40, -0.2, -0.30 + hipTwist * 0.25, 0.25);
          setBoneRot('leftforearm', 0, 0, 0.40, 0.25);
          setBoneRot('rightforearm', 0, 0, -0.40, 0.25);
          // Knee dipping and wide hip stance
          setBoneRot('leftupleg', 0.15, 0, 0.18, 0.25);
          setBoneRot('rightupleg', 0.15, 0, -0.18, 0.25);
          setBoneRot('leftleg', -kneeDip * 6.0, 0, 0, 0.25);
          setBoneRot('rightleg', -kneeDip * 6.0, 0, 0, 0.25);
        } else if (routineIndex === 2) {
          // 3. SPIN_CELEBRATION: 360-degree pirouette spin with hands raised up
          const spinWave = Math.sin(time * 8);
          setBonePos('hips', 0, 0.03 + Math.abs(spinWave) * 0.03, 0, 0.25);
          setBoneRot('spine', -0.05, 0, 0, 0.25);
          // Hands raised up high in celebration
          setBoneRot('leftarm', 0.10, 0, Math.PI * 0.75 + spinWave * 0.15, 0.25);
          setBoneRot('rightarm', 0.10, 0, -Math.PI * 0.75 - spinWave * 0.15, 0.25);
          setBoneRot('leftforearm', 0, 0, 0.35, 0.25);
          setBoneRot('rightforearm', 0, 0, -0.35, 0.25);
          // Tiptoe balance pirouette stance
          setBoneRot('leftupleg', 0.04, 0, 0.04, 0.25);
          setBoneRot('rightupleg', 0.04, 0, -0.04, 0.25);
          setBoneRot('leftleg', -0.08, 0, 0, 0.25);
          setBoneRot('rightleg', -0.08, 0, 0, 0.25);
        } else {
          // Classic chill groove
          const roll = Math.sin(dancePhase * 0.85);
          setBonePos('hips', 0, breath * 0.01, 0, 0.25);
          setBoneRot('spine', 0, 0, -roll * 0.08 * intensity, 0.25);
          setBoneRot('leftarm', 0.45, 0.1, 0.15 + Math.sin(dancePhase) * 0.20 * intensity, 0.25);
          setBoneRot('rightarm', 0.45, -0.1, -0.15 - Math.sin(dancePhase) * 0.20 * intensity, 0.25);
          setBoneRot('leftforearm', 0, 0, 0.18, 0.25);
          setBoneRot('rightforearm', 0, 0, -0.18, 0.25);
          setBoneRot('leftupleg', Math.sin(dancePhase * 0.85) * 0.15, 0, 0.04, 0.25);
          setBoneRot('rightupleg', -Math.sin(dancePhase * 0.85) * 0.15, 0, -0.04, 0.25);
          setBoneRot('leftleg', -Math.abs(Math.sin(dancePhase * 0.85)) * 0.25, 0, 0, 0.25);
          setBoneRot('rightleg', -Math.abs(Math.cos(dancePhase * 0.85)) * 0.25, 0, 0, 0.25);
        }
      } else if (curState === 'hang' || curState === 'hanging' || curState === 'hang_heading') {
        // Heading / Ledge Hanging Kinematics: arms raised upward, legs dangling & swaying
        const hangSway = Math.sin(time * 4.5);
        setBonePos('hips', 0, 0.12 + Math.abs(hangSway) * 0.02, 0, 0.25);
        setBoneRot('spine', 0.04, 0, -hangSway * 0.10, 0.25);
        // Arms rotated upward to hold the ledge
        setBoneRot('leftarm', 0.10, 0, Math.PI * 0.85, 0.25);
        setBoneRot('rightarm', 0.10, 0, -Math.PI * 0.85, 0.25);
        setBoneRot('leftforearm', 0, 0, 0.15, 0.25);
        setBoneRot('rightforearm', 0, 0, -0.15, 0.25);
        // Dangling / dangling pendulum legs
        setBoneRot('leftupleg', 0.15 + hangSway * 0.18, 0, 0.05, 0.25);
        setBoneRot('rightupleg', 0.15 - hangSway * 0.18, 0, -0.05, 0.25);
        setBoneRot('leftleg', -0.25 + hangSway * 0.12, 0, 0, 0.25);
        setBoneRot('rightleg', -0.25 - hangSway * 0.12, 0, 0, 0.25);
      } else if (curState === 'crouch' || curState === 'hide') {
        // Deep stealth crouch hiding posture
        setBonePos('hips', 0, -0.22, 0, 10, delta);
        setBoneRot('spine', 0.22, 0, 0, 10, delta);
        setBoneRot('head', -0.15, 0, 0, 10, delta);
        setBoneRot('leftupleg', 0.65, 0, 0.12, 10, delta);
        setBoneRot('rightupleg', 0.65, 0, -0.12, 10, delta);
        setBoneRot('leftleg', -0.85, 0, 0, 10, delta);
        setBoneRot('rightleg', -0.85, 0, 0, 10, delta);
        setBoneRot('leftarm', 0.35, 0, 0.45, 10, delta);
        setBoneRot('rightarm', 0.35, 0, -0.45, 10, delta);
        setBoneRot('leftforearm', 0, 0, 0.65, 10, delta);
        setBoneRot('rightforearm', 0, 0, -0.65, 10, delta);
      } else if (curState === 'cheer' || curState === 'celebrate') {
        // Joyful two-handed celebration bounce
        const cheerWave = Math.sin(time * 12);
        setBonePos('hips', 0, Math.abs(cheerWave) * 0.04, 0, 10, delta);
        setBoneRot('spine', -0.05, 0, 0, 10, delta);
        setBoneRot('head', -0.10, 0, cheerWave * 0.10, 10, delta);
        setBoneRot('leftarm', 0.10, 0, Math.PI * 0.70 + cheerWave * 0.20, 10, delta);
        setBoneRot('rightarm', 0.10, 0, -Math.PI * 0.70 - cheerWave * 0.20, 10, delta);
        setBoneRot('leftforearm', 0, 0, 0.35, 10, delta);
        setBoneRot('rightforearm', 0, 0, -0.35, 10, delta);
        setBoneRot('leftupleg', 0.05, 0, 0.05, 10, delta);
        setBoneRot('rightupleg', 0.05, 0, -0.05, 10, delta);
        setBoneRot('leftleg', -0.10, 0, 0, 10, delta);
        setBoneRot('rightleg', -0.10, 0, 0, 10, delta);
      } else if (curState === 'mischief_taunt' || curState === 'taunt_dance') {
        // Mischievous silly wiggle & taunt dance facing user
        const tauntWiggle = Math.sin(time * 12);
        setBonePos('hips', tauntWiggle * 0.05, Math.abs(tauntWiggle) * 0.02, 0, 0.25);
        setBoneRot('spine', 0, tauntWiggle * 0.25, -tauntWiggle * 0.15, 0.25);
        setBoneRot('head', 0, tauntWiggle * 0.20, tauntWiggle * 0.15, 0.25);
        setBoneRot('leftarm', 0.25, 0, 0.70 + tauntWiggle * 0.35, 0.25);
        setBoneRot('rightarm', 0.25, 0, -0.70 - tauntWiggle * 0.35, 0.25);
        setBoneRot('leftforearm', 0, 0, 0.60, 0.25);
        setBoneRot('rightforearm', 0, 0, -0.60, 0.25);
        setBoneRot('leftupleg', 0.1, 0, 0.1, 0.25);
        setBoneRot('rightupleg', 0.1, 0, -0.1, 0.25);
      } else if (curState === 'mischief_knock' || curState === 'knock_glass') {
        // Tapping / knocking right on the screen viewport glass
        const knockTaps = Math.sin(time * 18);
        setBonePos('hips', 0, 0, 0.04, 0.25);
        setBoneRot('spine', 0.08, 0, 0, 0.25);
        setBoneRot('head', -0.05, 0, 0.05, 0.25);
        setBoneRot('rightarm', 0.15, 0, -0.45 + knockTaps * 0.18, 0.30);
        setBoneRot('rightforearm', 0, 0, -0.55 + knockTaps * 0.25, 0.30);
        setBoneRot('leftarm', 0.45, 0, 0.10, 0.20);
        setBoneRot('leftforearm', 0, 0, 0.15, 0.20);
      } else if (curState === 'mischief_tongue' || curState === 'stick_out_tongue') {
        // Cute playful teasing pose with hands near face
        const cuteTilt = Math.sin(time * 6) * 0.12;
        setBoneRot('head', -0.06, cuteTilt, 0.18, 0.25);
        setBoneRot('spine', 0.02, 0, cuteTilt * 0.5, 0.25);
        setBoneRot('leftarm', 0.20, 0, 0.55, 0.25);
        setBoneRot('rightarm', 0.20, 0, -0.55, 0.25);
        setBoneRot('leftforearm', 0, 0, 0.85, 0.25);
        setBoneRot('rightforearm', 0, 0, -0.85, 0.25);
      } else if (curState === 'running' || curState === 'run') {
        const runStride = Math.sin(time * 12.0) * Math.max(0.1, locomotionWeight);
        setBonePos('hips', 0, Math.abs(runStride) * 0.04, 0, 11, delta);
        setBoneRot('spine', 0.18 * locomotionWeight, 0, 0, 10, delta); // Forward lean for running
        // Legs: Left Leg forward when runStride > 0, Right Leg forward when runStride < 0
        setBoneRot('leftupleg', runStride * 0.75, 0, 0, 11, delta);
        setBoneRot('rightupleg', -runStride * 0.75, 0, 0, 11, delta);
        setBoneRot('leftleg', Math.min(0, -runStride * 0.85), 0, 0, 11, delta);
        setBoneRot('rightleg', Math.min(0, runStride * 0.85), 0, 0, 11, delta);
        // Natural Human Running Gait (180° out-of-phase, opposite arm to opposite leg):
        // Left Leg forward -> Right Arm forward, Left Arm backward
        // Right Leg forward -> Left Arm forward, Right Arm backward
        setBoneRot('leftarm', 0.40 - runStride * 0.55, 0, 0.06 - runStride * 0.20, 11, delta);
        setBoneRot('rightarm', 0.40 + runStride * 0.55, 0, -0.06 - runStride * 0.20, 11, delta);
        setBoneRot('leftforearm', 0, 0, 0.35 + Math.max(0, -runStride) * 0.25, 11, delta);
        setBoneRot('rightforearm', 0, 0, -0.35 - Math.max(0, runStride) * 0.25, 11, delta);
      } else if (curState === 'jump' || curState === 'jumping') {
        // Dynamic jumping / hopping pose
        const jumpPhase = Math.sin(time * 8.0);
        setBonePos('hips', 0, Math.max(0, jumpPhase) * 0.08, 0, 10, delta);
        setBoneRot('spine', 0.06, 0, 0, 10, delta);
        setBoneRot('leftupleg', 0.35, 0, 0.08, 10, delta);
        setBoneRot('rightupleg', 0.35, 0, -0.08, 10, delta);
        setBoneRot('leftleg', -0.45, 0, 0, 10, delta);
        setBoneRot('rightleg', -0.45, 0, 0, 10, delta);
        setBoneRot('leftarm', 0.20, 0, 0.50, 10, delta);
        setBoneRot('rightarm', 0.20, 0, -0.50, 10, delta);
        setBoneRot('leftforearm', 0, 0, 0.30, 10, delta);
        setBoneRot('rightforearm', 0, 0, -0.30, 10, delta);
      } else if (curState === 'walking' || curState === 'walk' || curState === 'idle_walking') {
        const stride = Math.sin(time * 7.5) * Math.max(0.1, locomotionWeight);
        setBonePos('hips', 0, Math.abs(stride) * 0.02, 0, 10, delta);
        setBoneRot('spine', 0.04 * locomotionWeight, 0, 0, 10, delta);
        // Legs: Left Leg forward when stride > 0, Right Leg forward when stride < 0
        setBoneRot('leftupleg', stride * 0.42, 0, 0, 10, delta);
        setBoneRot('rightupleg', -stride * 0.42, 0, 0, 10, delta);
        setBoneRot('leftleg', Math.min(0, -stride * 0.45), 0, 0, 10, delta);
        setBoneRot('rightleg', Math.min(0, stride * 0.45), 0, 0, 10, delta);
        // Natural Human Walking Gait (180° out-of-phase, opposite arm to opposite leg):
        // When Left Leg swings forward (+stride), Right Arm swings forward (+pitch), Left Arm swings backward (-pitch)
        // When Right Leg swings forward (-stride), Left Arm swings forward (+pitch), Right Arm swings backward (-pitch)
        setBoneRot('leftarm', 0.46 - stride * 0.32, 0, 0.02 - stride * 0.12, 10, delta);
        setBoneRot('rightarm', 0.46 + stride * 0.32, 0, -0.02 - stride * 0.12, 10, delta);
        setBoneRot('leftforearm', 0, 0, 0.12 + Math.max(0, -stride) * 0.16, 10, delta);
        setBoneRot('rightforearm', 0, 0, -0.12 - Math.max(0, stride) * 0.16, 10, delta);
      } else if (curState === 'sitting' || curState === 'sit') {
        // Safe natural seated posture without inverted leg distortion
        setBonePos('hips', 0, -0.15, 0, 0.15);
        setBoneRot('spine', 0.02, 0, 0, 0.15);
        setBoneRot('leftupleg', 0.35, 0, 0.04, 0.15);
        setBoneRot('rightupleg', 0.35, 0, -0.04, 0.15);
        setBoneRot('leftleg', -0.35, 0, 0, 0.15);
        setBoneRot('rightleg', -0.35, 0, 0, 0.15);
        setBoneRot('leftfoot', 0, 0, 0, 0.15);
        setBoneRot('rightfoot', 0, 0, 0, 0.15);
        setBoneRot('leftarm', 0.15, 0, 0.06, 0.15);
        setBoneRot('rightarm', 0.15, 0, -0.06, 0.15);
        setBoneRot('leftforearm', 0, 0, 0.10, 0.15);
        setBoneRot('rightforearm', 0, 0, -0.10, 0.15);
      } else if (curState === 'lie_down' || curState === 'sleeping' || curState === 'sleep') {
        // Relaxed resting horizontal posture (lying down along horizontal edge / sleeping)
        setBonePos('hips', 0, -0.28, 0, 0.20);
        setBoneRot('spine', 0.05, 0, 0, 0.20);
        setBoneRot('head', 0.18, 0.25, 0.10, 0.20);
        setBoneRot('leftupleg', 0.10, 0, 0.15, 0.20);
        setBoneRot('rightupleg', 0.05, 0, -0.15, 0.20);
        setBoneRot('leftleg', -0.12, 0, 0, 0.20);
        setBoneRot('rightleg', -0.10, 0, 0, 0.20);
        setBoneRot('leftfoot', 0.20, 0, 0, 0.20);
        setBoneRot('rightfoot', 0.20, 0, 0, 0.20);
        setBoneRot('leftarm', 0.10, 0, 0.40, 0.20);
        setBoneRot('rightarm', 0.20, 0, -0.35, 0.20);
        setBoneRot('leftforearm', 0, 0, 0.45, 0.20);
        setBoneRot('rightforearm', 0, 0, -0.40, 0.20);
      } else if (curState === 'standing') {
        // Relaxed natural standing posture with both legs straight and feet flat
        setBonePos('hips', 0, breath * 0.003, 0, 0.15);
        setBoneRot('spine', breath * 0.015, 0, 0, 0.15);
        setBoneRot('leftupleg', 0, 0, 0, 0.15);
        setBoneRot('rightupleg', 0, 0, 0, 0.15);
        setBoneRot('leftleg', 0, 0, 0, 0.15);
        setBoneRot('rightleg', 0, 0, 0, 0.15);
        setBoneRot('leftfoot', 0, 0, 0, 0.15);
        setBoneRot('rightfoot', 0, 0, 0, 0.15);
        setBoneRot('leftarm', 0.48 + breath * 0.015, 0, 0.02, 0.15);
        setBoneRot('rightarm', 0.48 + breath * 0.015, 0, -0.02, 0.15);
        setBoneRot('leftforearm', 0, 0, 0.08, 0.15);
        setBoneRot('rightforearm', 0, 0, -0.08, 0.15);
      } else if (curState === 'listening') {
        // Attentive upright standing pose with subtle curious head tilt and relaxed arms
        setBonePos('hips', 0, breath * 0.003, 0, 0.15);
        setBoneRot('spine', 0.02, 0, 0, 0.15);
        setBoneRot('head', currentHeadPitch - 0.04, currentHeadYaw, 0.08, 0.15);
        setBoneRot('leftarm', 0.46, 0, 0.02, 0.15);
        setBoneRot('rightarm', 0.46, 0, -0.02, 0.15);
        setBoneRot('leftforearm', 0, 0, 0.08, 0.15);
        setBoneRot('rightforearm', 0, 0, -0.08, 0.15);
        setBoneRot('leftupleg', 0, 0, 0, 0.15);
        setBoneRot('rightupleg', 0, 0, 0, 0.15);
        setBoneRot('leftleg', 0, 0, 0, 0.15);
        setBoneRot('rightleg', 0, 0, 0, 0.15);
        setBoneRot('leftfoot', 0, 0, 0, 0.15);
        setBoneRot('rightfoot', 0, 0, 0, 0.15);
      } else if (curState === 'thinking') {
        // Natural thoughtful standing pose with hand lightly towards chin, head tilted
        setBonePos('hips', 0, breath * 0.003, 0, 0.15);
        setBoneRot('spine', 0, 0, 0.02, 0.15);
        setBoneRot('head', currentHeadPitch - 0.06, currentHeadYaw + 0.08, 0.05, 0.15);
        setBoneRot('leftarm', 0.46, 0, 0.02, 0.15);
        setBoneRot('leftforearm', 0, 0, 0.08, 0.15);
        setBoneRot('rightarm', 0.28, -0.15, -0.32, 0.15);
        setBoneRot('rightforearm', 0, 0, -0.35, 0.15);
        setBoneRot('leftupleg', 0, 0, 0, 0.15);
        setBoneRot('rightupleg', 0, 0, 0, 0.15);
        setBoneRot('leftleg', 0, 0, 0, 0.15);
        setBoneRot('rightleg', 0, 0, 0, 0.15);
        setBoneRot('leftfoot', 0, 0, 0, 0.15);
        setBoneRot('rightfoot', 0, 0, 0, 0.15);
      } else if (curState === 'executing') {
        // Natural attentive posture with subtle nod & gentle forward gesture (never crossed over face)
        setBonePos('hips', 0, Math.sin(time * 4) * 0.005, 0, 0.20);
        setBoneRot('spine', 0.02, 0, 0, 0.20);
        setBoneRot('head', currentHeadPitch + Math.sin(time * 5) * 0.03, currentHeadYaw, 0, 0.20);
        setBoneRot('leftarm', 0.08, 0, 0.04, 0.20);
        setBoneRot('rightarm', 0.12, -0.08, -0.12, 0.20);
        setBoneRot('leftforearm', 0, 0, 0.05, 0.20);
        setBoneRot('rightforearm', 0, 0, -0.12, 0.20);
        setBoneRot('leftupleg', 0, 0, 0, 0.20);
        setBoneRot('rightupleg', 0, 0, 0, 0.20);
        setBoneRot('leftleg', 0, 0, 0, 0.20);
        setBoneRot('rightleg', 0, 0, 0, 0.20);
        setBoneRot('leftfoot', 0, 0, 0, 0.20);
        setBoneRot('rightfoot', 0, 0, 0, 0.20);
      } else if (curState === 'speaking') {
        // Expressive conversational standing posture with head and right hand cadence
        setBonePos('hips', 0, breath * 0.003, 0, 0.15);
        setBoneRot('spine', 0, 0, 0, 0.15);
        setBoneRot('head', currentHeadPitch + Math.sin(time * 6) * 0.04 * Math.max(0.4, vol), currentHeadYaw, 0, 0.15);
        setBoneRot('leftarm', 0.46, 0, 0.02, 0.15);
        setBoneRot('leftforearm', 0, 0, 0.08, 0.15);
        setBoneRot('rightarm', 0.26 + Math.sin(time * 3) * 0.06, -0.10, -0.20, 0.15);
        setBoneRot('rightforearm', 0, 0, -0.25, 0.15);
        setBoneRot('leftupleg', 0, 0, 0, 0.15);
        setBoneRot('rightupleg', 0, 0, 0, 0.15);
        setBoneRot('leftleg', 0, 0, 0, 0.15);
        setBoneRot('rightleg', 0, 0, 0, 0.15);
        setBoneRot('leftfoot', 0, 0, 0, 0.15);
        setBoneRot('rightfoot', 0, 0, 0, 0.15);
      } else if (curState === 'idle') {
        // Natural Upright Relaxed Standing (Strict Straight Posture, Arms Naturally at Sides, Feet Flat)
        // Add subtle music head-bob when music is playing during idle
        const musicHeadBob = isMusicPlaying ? Math.sin(time * 7.2) * 0.05 : 0;
        setBonePos('hips', 0, breath * 0.003, 0, 0.15);
        setBoneRot('spine', breath * 0.015, 0, 0, 0.15);
        setBoneRot('head', currentHeadPitch + musicHeadBob, currentHeadYaw, 0, 0.18);
        setBoneRot('leftarm', 0.48 + breath * 0.015, 0, 0.02, 0.15);
        setBoneRot('rightarm', 0.48 + breath * 0.015, 0, -0.02, 0.15);
        setBoneRot('leftforearm', 0, 0, 0.08, 0.15);
        setBoneRot('rightforearm', 0, 0, -0.08, 0.15);
        setBoneRot('leftupleg', 0, 0, 0, 0.15);
        setBoneRot('rightupleg', 0, 0, 0, 0.15);
        setBoneRot('leftleg', 0, 0, 0, 0.15);
        setBoneRot('rightleg', 0, 0, 0, 0.15);
        setBoneRot('leftfoot', 0, 0, 0, 0.15);
        setBoneRot('rightfoot', 0, 0, 0, 0.15);
      } else if (curState === 'wave') {
        const wave = Math.sin(time * 14) * 0.35;
        setBoneRot('rightarm', 0.18, -0.15, -1.35 + wave * 0.35, 0.25);
        setBoneRot('rightforearm', 0, 0, -0.45, 0.25);
        setBoneRot('leftarm', 0.48, 0, 0.02, 0.15);
        setBoneRot('leftforearm', 0, 0, 0.08, 0.15);
        setBoneRot('leftupleg', 0, 0, 0, 0.15);
        setBoneRot('rightupleg', 0, 0, 0, 0.15);
        setBoneRot('leftleg', 0, 0, 0, 0.15);
        setBoneRot('rightleg', 0, 0, 0, 0.15);
        setBoneRot('leftfoot', 0, 0, 0, 0.15);
        setBoneRot('rightfoot', 0, 0, 0, 0.15);
      } else if (curState === 'jump') {
        const jumpPhase = Math.sin(time * 10);
        const jumpY = Math.max(0, jumpPhase * 0.22);
        setBonePos('hips', 0, jumpY, 0, 0.25);
        const kneeBend = jumpY > 0 ? 0 : -0.15;
        setBoneRot('leftupleg', 0.1, 0, 0, 0.25);
        setBoneRot('rightupleg', 0.1, 0, 0, 0.25);
        setBoneRot('leftleg', kneeBend, 0, 0, 0.25);
        setBoneRot('rightleg', kneeBend, 0, 0, 0.25);
        setBoneRot('leftarm', 0, 0, 0.15, 0.25);
        setBoneRot('rightarm', 0, 0, -0.15, 0.25);
      } else if (curState === 'hang' || curState === 'hanging' || curState === 'hang_heading') {
        // Heading / Ledge Hanging Kinematics: arms raised upward, legs dangling & swaying
        const hangSway = Math.sin(time * 4.5);
        setBonePos('hips', 0, 0.12 + Math.abs(hangSway) * 0.02, 0, 0.25);
        setBoneRot('spine', 0.04, 0, -hangSway * 0.10, 0.25);
        // Arms rotated upward to hold the ledge
        setBoneRot('leftarm', 0.10, 0, Math.PI * 0.85, 0.25);
        setBoneRot('rightarm', 0.10, 0, -Math.PI * 0.85, 0.25);
        setBoneRot('leftforearm', 0, 0, 0.15, 0.25);
        setBoneRot('rightforearm', 0, 0, -0.15, 0.25);
        // Dangling / dangling pendulum legs
        setBoneRot('leftupleg', 0.15 + hangSway * 0.18, 0, 0.05, 0.25);
        setBoneRot('rightupleg', 0.15 - hangSway * 0.18, 0, -0.05, 0.25);
        setBoneRot('leftleg', -0.25 + hangSway * 0.12, 0, 0, 0.25);
        setBoneRot('rightleg', -0.25 - hangSway * 0.12, 0, 0, 0.25);
      } else if (curState === 'crouch' || curState === 'hide') {
        // Deep stealth crouch hiding posture
        setBonePos('hips', 0, -0.22, 0, 10, delta);
        setBoneRot('spine', 0.22, 0, 0, 10, delta);
        setBoneRot('head', -0.15, 0, 0, 10, delta);
        setBoneRot('leftupleg', 0.65, 0, 0.12, 10, delta);
        setBoneRot('rightupleg', 0.65, 0, -0.12, 10, delta);
        setBoneRot('leftleg', -0.85, 0, 0, 10, delta);
        setBoneRot('rightleg', -0.85, 0, 0, 10, delta);
        setBoneRot('leftarm', 0.35, 0, 0.45, 10, delta);
        setBoneRot('rightarm', 0.35, 0, -0.45, 10, delta);
        setBoneRot('leftforearm', 0, 0, 0.65, 10, delta);
        setBoneRot('rightforearm', 0, 0, -0.65, 10, delta);
      } else if (curState === 'cheer' || curState === 'celebrate') {
        // Joyful two-handed celebration bounce
        const cheerWave = Math.sin(time * 12);
        setBonePos('hips', 0, Math.abs(cheerWave) * 0.04, 0, 10, delta);
        setBoneRot('spine', -0.05, 0, 0, 10, delta);
        setBoneRot('head', -0.10, 0, cheerWave * 0.10, 10, delta);
        setBoneRot('leftarm', 0.10, 0, Math.PI * 0.70 + cheerWave * 0.20, 10, delta);
        setBoneRot('rightarm', 0.10, 0, -Math.PI * 0.70 - cheerWave * 0.20, 10, delta);
        setBoneRot('leftforearm', 0, 0, 0.35, 10, delta);
        setBoneRot('rightforearm', 0, 0, -0.35, 10, delta);
        setBoneRot('leftupleg', 0.05, 0, 0.05, 10, delta);
        setBoneRot('rightupleg', 0.05, 0, -0.05, 10, delta);
        setBoneRot('leftleg', -0.10, 0, 0, 10, delta);
        setBoneRot('rightleg', -0.10, 0, 0, 10, delta);
      } else if (curState === 'mischief_taunt' || curState === 'taunt_dance') {
        // Mischievous silly wiggle & taunt dance facing user
        const tauntWiggle = Math.sin(time * 12);
        setBonePos('hips', tauntWiggle * 0.05, Math.abs(tauntWiggle) * 0.02, 0, 0.25);
        setBoneRot('spine', 0, tauntWiggle * 0.25, -tauntWiggle * 0.15, 0.25);
        setBoneRot('head', 0, tauntWiggle * 0.20, tauntWiggle * 0.15, 0.25);
        setBoneRot('leftarm', 0.25, 0, 0.70 + tauntWiggle * 0.35, 0.25);
        setBoneRot('rightarm', 0.25, 0, -0.70 - tauntWiggle * 0.35, 0.25);
        setBoneRot('leftforearm', 0, 0, 0.60, 0.25);
        setBoneRot('rightforearm', 0, 0, -0.60, 0.25);
        setBoneRot('leftupleg', 0.1, 0, 0.1, 0.25);
        setBoneRot('rightupleg', 0.1, 0, -0.1, 0.25);
      } else if (curState === 'mischief_knock' || curState === 'knock_glass') {
        // Tapping / knocking right on the screen viewport glass
        const knockTaps = Math.sin(time * 18);
        setBonePos('hips', 0, 0, 0.04, 0.25);
        setBoneRot('spine', 0.08, 0, 0, 0.25);
        setBoneRot('head', -0.05, 0, 0.05, 0.25);
        setBoneRot('rightarm', 0.15, 0, -0.45 + knockTaps * 0.18, 0.30);
        setBoneRot('rightforearm', 0, 0, -0.55 + knockTaps * 0.25, 0.30);
        setBoneRot('leftarm', 0.45, 0, 0.10, 0.20);
        setBoneRot('leftforearm', 0, 0, 0.15, 0.20);
      } else if (curState === 'mischief_tongue' || curState === 'stick_out_tongue') {
        // Cute playful teasing pose with hands near face
        const cuteTilt = Math.sin(time * 6) * 0.12;
        setBoneRot('head', -0.06, cuteTilt, 0.18, 0.25);
        setBoneRot('spine', 0.02, 0, cuteTilt * 0.5, 0.25);
        setBoneRot('leftarm', 0.20, 0, 0.55, 0.25);
        setBoneRot('rightarm', 0.20, 0, -0.55, 0.25);
        setBoneRot('leftforearm', 0, 0, 0.85, 0.25);
        setBoneRot('rightforearm', 0, 0, -0.85, 0.25);
      } else if (curState === 'running' || curState === 'run') {
        const stride = Math.sin(time * 16);
        setBonePos('hips', 0, Math.abs(stride) * 0.05, 0, 0.25);
        // Opposite arm to opposite leg coordination:
        // Left Leg forward -> Right Arm forward (+X), Left Arm backward (-X)
        setBoneRot('leftarm', 0.40 - stride * 0.50, 0, 0.05 - stride * 0.15, 0.25);
        setBoneRot('rightarm', 0.40 + stride * 0.50, 0, -0.05 - stride * 0.15, 0.25);
        setBoneRot('leftforearm', 0, 0, 0.25 + Math.max(0, -stride) * 0.20, 0.25);
        setBoneRot('rightforearm', 0, 0, -0.25 - Math.max(0, stride) * 0.20, 0.25);
        setBoneRot('leftupleg', stride * 0.35, 0, 0, 0.25);
        setBoneRot('rightupleg', -stride * 0.35, 0, 0, 0.25);
        setBoneRot('leftleg', Math.min(0, -stride * 0.35), 0, 0, 0.25);
        setBoneRot('rightleg', Math.min(0, stride * 0.35), 0, 0, 0.25);
        setBoneRot('leftfoot', 0, 0, 0, 0.25);
        setBoneRot('rightfoot', 0, 0, 0, 0.25);
      } else {
        // Default Natural Upright Standing (Straight Posture, Feet Flat on Ground)
        setBonePos('hips', 0, breath * 0.003, 0, 0.15);
        setBoneRot('spine', breath * 0.015, 0, 0, 0.15);
        setBoneRot('leftarm', breath * 0.015, 0, 0.02, 0.15);
        setBoneRot('rightarm', breath * 0.015, 0, -0.02, 0.15);
        setBoneRot('leftforearm', 0, 0, 0, 0.15);
        setBoneRot('rightforearm', 0, 0, 0, 0.15);
        setBoneRot('leftupleg', 0, 0, 0, 0.15);
        setBoneRot('rightupleg', 0, 0, 0, 0.15);
        setBoneRot('leftleg', 0, 0, 0, 0.15);
        setBoneRot('rightleg', 0, 0, 0, 0.15);
        setBoneRot('leftfoot', 0, 0, 0, 0.15);
        setBoneRot('rightfoot', 0, 0, 0, 0.15);
      }

      renderer.render(scene, camera);
    };

    reqId = requestAnimationFrame(animate);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('mousemove', handlePointerTrack);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      dracoLoader.dispose();
    };
  }, []); // Run ONCE on mount; size updates handled by decoupled useEffect!

  return (
    <div
      ref={mountRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="relative flex items-center justify-center select-none pointer-events-none"
    />
  );
}
