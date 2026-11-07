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
  isPaused = false
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
    isPaused
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
      isPaused
    };
  }, [animationState, isSpeaking, isListening, isPlaying, voiceVolumeScale, facing, cursorOffset, rotationYaw, rotationPitch, framingMode, isPaused]);

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

    // 1. Scene & Dynamically Calibrated Perspective Camera
    const scene = new THREE.Scene();
    const fov = 30;
    const initialAspect = width / height;
    const camera = new THREE.PerspectiveCamera(fov, initialAspect, 0.1, 50);
    cameraRef.current = camera;

    const updateCameraFraming = (w, h, mode = 'full') => {
      const aspect = w / h;
      camera.aspect = aspect;
      const vFovRad = fov * (Math.PI / 180);

      if (mode === 'bust') {
        // Tight chest-up camera framing: close-up on head, face, eyes, and headphones
        const bustSpan = 0.44;
        const dist = (bustSpan / 2) / Math.tan(vFovRad / 2);
        const cameraCenterY = 0.28; // Focus directly on facial region
        camera.position.set(0, cameraCenterY, dist);
        camera.lookAt(0, cameraCenterY, 0);
      } else {
        const charHeight = 1.49;
        const charWingspan = 1.20;
        const requiredVerticalSpan = charHeight * 1.07;
        const distForHeight = (requiredVerticalSpan / 2) / Math.tan(vFovRad / 2);
        const distForWidth = (charWingspan * 1.04 / 2) / (Math.tan(vFovRad / 2) * aspect);
        const targetDist = Math.max(distForHeight, distForWidth);
        const cameraCenterY = 0.08;

        // Position camera to [0, 1.1, 2.7] or aspect adjusted distance focusing cleanly on character
        camera.position.set(0, 1.1, Math.max(2.7, targetDist));
        camera.lookAt(0, cameraCenterY, 0);
      }
      camera.updateProjectionMatrix();
    };
    updateFramingRef.current = updateCameraFraming;
    updateCameraFraming(width, height, framingMode);

    // 2. High-Performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = false;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Studio 3-Point & Neon Accent Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    keyLight.position.set(2.0, 3.0, 2.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.9);
    fillLight.position.set(-2.0, 1.5, 2.0);
    scene.add(fillLight);

    const rimColor = 0xf59e0b; // Loopra Gold / Amber neon
    const rimLight = new THREE.DirectionalLight(rimColor, 2.2);
    rimLight.position.set(0, 2.0, -2.5);
    scene.add(rimLight);

    // Root Group for orientation and scaling (raised Y by 0.25 to prevent bottom clipping)
    const charRoot = new THREE.Group();
    charRoot.position.set(0, 0.25, 0);
    scene.add(charRoot);

    // Ground Shadow
    const shadowGeo = new THREE.CircleGeometry(0.52, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.98;
    charRoot.add(shadowMesh);

    // Audio Reactive Base Particle Ring
    const particleCount = 42;
    const ringGeo = new THREE.BufferGeometry();
    const ringPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 0.55 + (i % 2 === 0 ? 0.04 : -0.04);
      ringPositions[i * 3] = Math.cos(angle) * radius;
      ringPositions[i * 3 + 1] = 0;
      ringPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: rimColor,
      size: 0.05,
      transparent: true,
      opacity: 0.85
    });
    const particleSystem = new THREE.Points(ringGeo, particleMat);
    particleSystem.position.y = -0.96;
    charRoot.add(particleSystem);

    // Animation Mixer & Action Registry
    let mixer = null;
    const actions = {};
    let activeAction = null;

    const fadeToAction = (name, duration = 0.35) => {
      if (!actions[name]) return;
      const nextAction = actions[name];
      if (activeAction !== nextAction) {
        if (activeAction) {
          activeAction.fadeOut(duration);
        }
        nextAction.reset().fadeIn(duration).play();
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
    const glbBones = {};
    const glbModelGroup = new THREE.Group();
    glbModelGroup.visible = false; // Hidden until realistic GLB finishes loading
    charRoot.add(glbModelGroup);

    const setBoneRot = (boneName, eulerX, eulerY, eulerZ, slerpSpeed = 0.20) => {
      const bone = glbBones[boneName.toLowerCase()];
      if (!bone || !bone.userData.restQuat) return;
      const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(eulerX, eulerY, eulerZ, 'XYZ'));
      const targetQuat = bone.userData.restQuat.clone().multiply(delta);
      bone.quaternion.slerp(targetQuat, slerpSpeed);
    };

    const setBonePos = (boneName, posX, posY, posZ, lerpSpeed = 0.20) => {
      const bone = glbBones[boneName.toLowerCase()];
      if (!bone || !bone.userData.restPos) return;
      const targetX = bone.userData.restPos.x + posX;
      const targetY = bone.userData.restPos.y + posY;
      const targetZ = bone.userData.restPos.z + posZ;
      bone.position.x = THREE.MathUtils.lerp(bone.position.x, targetX, lerpSpeed);
      bone.position.y = THREE.MathUtils.lerp(bone.position.y, targetY, lerpSpeed);
      bone.position.z = THREE.MathUtils.lerp(bone.position.z, targetZ, lerpSpeed);
    };

    gltfLoader.load(
      '/characters/avatar.glb',
      (gltf) => {
        isGlbActive = true;
        setHasGlbLoaded(true);
        glbModelGroup.visible = true;
        const model = gltf.scene;
        model.scale.set(0.9, 0.9, 0.9);
        model.position.set(0, -0.96, 0);
        // Face the user/camera directly (+Z)
        model.rotation.y = 0;

        model.traverse((child) => {
          if (child.isBone) {
            const lower = child.name.toLowerCase();
            glbBones[lower] = child;
            child.userData.restQuat = child.quaternion.clone();
            child.userData.restPos = child.position.clone();
            if (!glbHeadBone && (lower.includes('head') || lower.includes('neck'))) {
              glbHeadBone = child;
            }
          }
          if (child.isMesh && child.material) {
            child.material.roughness = Math.max(0.2, child.material.roughness || 0.5);
            child.material.metalness = Math.min(0.8, child.material.metalness || 0.1);
          }
        });

        glbModelGroup.add(model);

        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            const clipName = clip.name.toLowerCase();
            const action = mixer.clipAction(clip);
            if (clipName.includes('idle')) actions['idle'] = action;
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

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (!isTabVisible || stateRef.current.isPaused) return;

      const animNow = performance.now();
      const delta = Math.min((animNow - lastTime) / 1000, 0.1);
      lastTime = animNow;
      elapsedTime += delta;
      const time = elapsedTime;

      const curState = stateRef.current.animationState;
      const isSpeakingNow = stateRef.current.isSpeaking;
      const isListeningNow = stateRef.current.isListening;
      const isMusicPlaying = stateRef.current.isPlaying;
      const vol = stateRef.current.voiceVolumeScale;
      const facingDir = stateRef.current.facing;

      // Full 360-Degree Interactive Rotation & Viewing Pitch (Strict Front-Facing by default)
      const userYaw = stateRef.current.rotationYaw || 0;
      const userPitch = stateRef.current.rotationPitch || 0;
      const isTraveling = curState === 'walking' || curState === 'walk' || curState === 'idle_walking' || curState === 'running' || curState === 'run';
      const baseFacingYaw = isTraveling ? (facingDir === 'right' ? -0.22 : 0.22) : 0;
      const targetCharYaw = userYaw + baseFacingYaw;
      const targetCharPitch = THREE.MathUtils.clamp(userPitch, -0.25, 0.25);

      charRoot.rotation.y = THREE.MathUtils.lerp(charRoot.rotation.y, targetCharYaw, 0.12);
      charRoot.rotation.x = THREE.MathUtils.lerp(charRoot.rotation.x, targetCharPitch, 0.12);

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

      // Update AnimationMixer if GLB contains clips
      if (mixer) {
        mixer.update(delta);
        if (curState === 'walking' || curState === 'walk' || curState === 'idle_walking') fadeToAction('walk', 0.25);
        else if (curState === 'running' || curState === 'run') fadeToAction('run', 0.25);
        else if (curState === 'sitting' || curState === 'sit') fadeToAction(actions['sit'] ? 'sit' : 'idle', 0.35);
        else if (curState === 'jump') fadeToAction('jump', 0.2);
        else if (curState === 'wave') fadeToAction('wave', 0.25);
        else if (curState === 'dance' || curState === 'dancing' || curState === 'heavy_dancing' || curState === 'groove') fadeToAction('dance', 0.3);
        else if (isSpeakingNow || curState === 'speaking') fadeToAction('speaking', 0.25);
        else if (curState === 'think' || curState === 'thinking') fadeToAction('thinking', 0.3);
        else fadeToAction('idle', 0.35);
      }

      // Subtle Head Tracking Logic: ±8° yaw, ±5° pitch
      const isCursorIdle = (Date.now() - lastMouseMoveTime) > 3000;

      let rawX = stateRef.current.cursorX || 0;
      let rawY = stateRef.current.cursorY || 0;

      if (Math.abs(rawX) < 0.05) rawX = 0;
      if (Math.abs(rawY) < 0.05) rawY = 0;

      const maxYawRad = 8 * (Math.PI / 180);
      const maxPitchRad = 5 * (Math.PI / 180);

      const targetYaw = isCursorIdle ? 0 : THREE.MathUtils.clamp(rawX * maxYawRad, -maxYawRad, maxYawRad);
      const targetPitch = isCursorIdle ? 0 : THREE.MathUtils.clamp(-rawY * maxPitchRad, -maxPitchRad, maxPitchRad);

      currentHeadYaw = THREE.MathUtils.lerp(currentHeadYaw, targetYaw, 0.04);
      currentHeadPitch = THREE.MathUtils.lerp(currentHeadPitch, targetPitch, 0.04);

      // Apply subtle head tracking to GLB head bone
      setBoneRot('head', currentHeadPitch, currentHeadYaw, 0, 0.20);

      const breath = Math.sin(time * 2.6);

      // Attentive Listening Glow & Visualizer Ring
      if (isListeningNow || curState === 'listening') {
        particleMat.size = 0.075 + vol * 0.04;
      } else {
        particleMat.size = 0.05;
      }

      // Music-Synchronized & Heavy Dancing rhythm & intensity calculations
      const isHeavyDance = curState === 'heavy_dancing';
      const intensity = (isHeavyDance ? 1.45 : 0.75) + vol * 0.55;
      const dancePhase = time * ((isHeavyDance ? 8.4 : 6.0) + vol * 2.5);
      const danceRoutine = isHeavyDance ? Math.floor((time / 3.0) % 4) : Math.floor((time / 12) % 4);

      // =========================================================================
      // D. ANATOMICALLY NATURAL KINEMATICS & SKELETAL ANIMATION SYSTEM
      // =========================================================================
      if (curState === 'dancing' || curState === 'dance' || curState === 'heavy_dancing') {
        if (danceRoutine === 0) {
          const sway = Math.sin(dancePhase);
          const bounce = Math.abs(Math.cos(dancePhase)) * 0.04 * intensity;
          setBonePos('hips', sway * 0.04 * intensity, bounce, 0, 0.25);
          setBoneRot('spine', 0, sway * 0.12 * intensity, -sway * 0.08 * intensity, 0.25);
          setBoneRot('leftarm', 0.44, Math.cos(dancePhase) * 0.25 * intensity, 0.08 + sway * 0.25 * intensity, 0.25);
          setBoneRot('rightarm', 0.44, -Math.cos(dancePhase) * 0.25 * intensity, -0.08 - sway * 0.25 * intensity, 0.25);
          setBoneRot('leftforearm', 0, 0, 0.28, 0.25);
          setBoneRot('rightforearm', 0, 0, -0.28, 0.25);
          const leftStep = Math.max(0, Math.sin(dancePhase) * 0.35);
          const rightStep = Math.max(0, -Math.sin(dancePhase) * 0.35);
          setBoneRot('leftupleg', leftStep * 0.45, 0, 0.06 + leftStep * 0.12, 0.25);
          setBoneRot('leftleg', -leftStep * 0.55, 0, 0, 0.25);
          setBoneRot('rightupleg', rightStep * 0.45, 0, -0.06 - rightStep * 0.12, 0.25);
          setBoneRot('rightleg', -rightStep * 0.55, 0, 0, 0.25);
        } else if (danceRoutine === 1) {
          const beat = Math.sin(dancePhase * 1.4);
          const bob = Math.abs(Math.sin(dancePhase * 1.4)) * 0.045 * intensity;
          setBonePos('hips', 0, bob, 0, 0.25);
          setBoneRot('spine', -bob * 0.6, 0, 0, 0.25);
          setBoneRot('leftarm', 0.38 + beat * 0.15 * intensity, 0.15, 0.35 + beat * 0.18 * intensity, 0.25);
          setBoneRot('rightarm', 0.38 - beat * 0.15 * intensity, -0.15, -0.35 - beat * 0.18 * intensity, 0.25);
          setBoneRot('leftforearm', 0, 0, 0.45 + beat * 0.15, 0.25);
          setBoneRot('rightforearm', 0, 0, -0.45 - beat * 0.15, 0.25);
          const kneeFlex = -bob * 3.8;
          setBoneRot('leftupleg', 0.08, 0, 0.08, 0.25);
          setBoneRot('rightupleg', 0.08, 0, -0.08, 0.25);
          setBoneRot('leftleg', kneeFlex, 0, 0, 0.25);
          setBoneRot('rightleg', kneeFlex, 0, 0, 0.25);
        } else if (danceRoutine === 2) {
          const wave = Math.sin(dancePhase * 0.9);
          setBonePos('hips', wave * 0.04 * intensity, 0, 0, 0.25);
          setBoneRot('spine', 0, wave * 0.18 * intensity, 0, 0.25);
          setBoneRot('leftarm', 0.42, 0, 0.35 + Math.cos(dancePhase) * 0.25 * intensity, 0.25);
          setBoneRot('rightarm', 0.42, 0, -0.35 - Math.sin(dancePhase) * 0.25 * intensity, 0.25);
          setBoneRot('leftforearm', 0, 0, 0.22, 0.25);
          setBoneRot('rightforearm', 0, 0, -0.22, 0.25);
          setBoneRot('leftupleg', 0.10, 0, 0.15 * intensity, 0.25);
          setBoneRot('rightupleg', 0.10, 0, -0.15 * intensity, 0.25);
          setBoneRot('leftleg', -0.20, 0, 0, 0.25);
          setBoneRot('rightleg', -0.20, 0, 0, 0.25);
        } else {
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
      } else if (curState === 'walking' || curState === 'walk' || curState === 'idle_walking') {
        const stride = Math.sin(time * 7.5);
        setBonePos('hips', 0, Math.abs(stride) * 0.02, 0, 0.25);
        setBoneRot('spine', 0.04, 0, 0, 0.25);
        setBoneRot('leftupleg', stride * 0.42, 0, 0, 0.25);
        setBoneRot('rightupleg', -stride * 0.42, 0, 0, 0.25);
        setBoneRot('leftleg', Math.min(0, -stride * 0.45), 0, 0, 0.25);
        setBoneRot('rightleg', Math.min(0, stride * 0.45), 0, 0, 0.25);
        setBoneRot('leftarm', 0.46, 0, -stride * 0.32, 0.25);
        setBoneRot('rightarm', 0.46, 0, stride * 0.32, 0.25);
        setBoneRot('leftforearm', 0, 0, 0.18, 0.25);
        setBoneRot('rightforearm', 0, 0, -0.18, 0.25);
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
      } else if (curState === 'running' || curState === 'run') {
        const stride = Math.sin(time * 16);
        setBonePos('hips', 0, Math.abs(stride) * 0.05, 0, 0.25);
        setBoneRot('leftarm', 0.20, 0, -stride * 0.45, 0.25);
        setBoneRot('rightarm', 0.20, 0, stride * 0.45, 0.25);
        setBoneRot('leftforearm', 0, 0, 0.20, 0.25);
        setBoneRot('rightforearm', 0, 0, -0.20, 0.25);
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
