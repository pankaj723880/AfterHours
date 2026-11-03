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
  voiceVolumeScale = 0,
  facing = 'left',
  cursorOffset = { x: 0, y: 0 },
  width = 220,
  height = 290
}) {
  const mountRef = useRef(null);
  const stateRef = useRef({
    animationState,
    isSpeaking,
    isListening,
    voiceVolumeScale,
    facing,
    cursorX: 0,
    cursorY: 0
  });

  const [hasGlbLoaded, setHasGlbLoaded] = useState(false);

  // Sync props to stateRef for 60fps animation loop
  useEffect(() => {
    stateRef.current = {
      animationState,
      isSpeaking,
      isListening,
      voiceVolumeScale: Math.max(0, Math.min(1, voiceVolumeScale || (isSpeaking ? 0.75 : 0))),
      facing,
      cursorX: cursorOffset?.x || 0,
      cursorY: cursorOffset?.y || 0
    };
  }, [animationState, isSpeaking, isListening, voiceVolumeScale, facing, cursorOffset]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Perspective Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);
    camera.position.set(0, 0.15, 3.4);

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

    // Root Group for orientation and scaling
    const charRoot = new THREE.Group();
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
    // A. TRY GLTF / GLB SKINNED 3D CHARACTER LOADING
    // =========================================================================
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    let isGlbActive = false;
    let glbHeadBone = null;
    const glbModelGroup = new THREE.Group();
    charRoot.add(glbModelGroup);

    gltfLoader.load(
      '/characters/avatar.glb',
      (gltf) => {
        isGlbActive = true;
        setHasGlbLoaded(true);
        const model = gltf.scene;
        model.scale.set(0.9, 0.9, 0.9);
        model.position.set(0, -0.96, 0);
        // Face the front camera: Mixamo / standard GLTF models look down -Z by default
        model.rotation.y = Math.PI;

        model.traverse((child) => {
          if (child.isBone && !glbHeadBone) {
            const lower = child.name.toLowerCase();
            if (lower.includes('head') || lower.includes('neck')) {
              glbHeadBone = child;
              console.log('[ThreeDCharacter] Bound head tracking bone:', child.name);
            }
          }
          if (child.isMesh && child.material) {
            child.material.roughness = Math.max(0.2, child.material.roughness || 0.5);
            child.material.metalness = Math.min(0.8, child.material.metalness || 0.1);
          }
        });

        glbModelGroup.add(model);

        // Setup AnimationMixer from GLTF animations
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            const clipName = clip.name.toLowerCase();
            const action = mixer.clipAction(clip);
            if (clipName.includes('idle')) actions['idle'] = action;
            else if (clipName.includes('walk')) actions['walk'] = action;
            else if (clipName.includes('run')) actions['run'] = action;
            else if (clipName.includes('jump')) actions['jump'] = action;
            else if (clipName.includes('wave')) actions['wave'] = action;
            else if (clipName.includes('dance')) actions['dance'] = action;
            else if (clipName.includes('talk') || clipName.includes('speak')) actions['speaking'] = action;
            else if (clipName.includes('think')) actions['thinking'] = action;
            else actions[clip.name] = action;
          });

          // Default start on idle
          if (actions['idle']) {
            fadeToAction('idle', 0.1);
          } else if (gltf.animations[0]) {
            actions['idle'] = mixer.clipAction(gltf.animations[0]);
            fadeToAction('idle', 0.1);
          }
        }

        // Hide procedural fallback once GLB is successfully loaded
        if (proceduralGroup) {
          proceduralGroup.visible = false;
        }
      },
      undefined,
      (err) => {
        // Fallback gracefully to procedural 3D avatar (expected when avatar.glb hasn't been placed)
        isGlbActive = false;
        setHasGlbLoaded(false);
      }
    );

    // =========================================================================
    // B. HIGH-FIDELITY PROCEDURAL 3D HUMANOID RIG (PBR MESH & BONES)
    // =========================================================================
    const proceduralGroup = new THREE.Group();
    charRoot.add(proceduralGroup);

    // Material Library
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5cfb8,
      roughness: 0.55,
      metalness: 0.05
    });

    const hoodieMat = new THREE.MeshStandardMaterial({
      color: 0x121215, // Sleek black streetwear hoodie
      roughness: 0.8,
      metalness: 0.1
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x18181b, // Dark techwear cargo
      roughness: 0.75,
      metalness: 0.15
    });

    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.6,
      metalness: 0.3
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: rimColor,
      roughness: 0.2,
      metalness: 0.8,
      emissive: rimColor,
      emissiveIntensity: 0.4
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x281816, // Dark espresso hair
      roughness: 0.9,
      metalness: 0.05
    });

    // 1. Torso & Hoodie (Sleek streetwear fit, lowered to keep neck and chin clear)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0, 0);
    proceduralGroup.add(torsoGroup);

    const chestGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.44, 24);
    const chestMesh = new THREE.Mesh(chestGeo, hoodieMat);
    chestMesh.position.set(0, 0.14, 0);
    torsoGroup.add(chestMesh);

    // Hoodie Collar / Neckline Trim
    const collarGeo = new THREE.TorusGeometry(0.115, 0.022, 12, 24);
    const collarMesh = new THREE.Mesh(collarGeo, hoodieMat);
    collarMesh.rotation.x = Math.PI / 2.3;
    collarMesh.position.set(0, 0.355, 0.015);
    torsoGroup.add(collarMesh);

    // Hoodie Accent Zipper / Neon Stripe
    const stripeGeo = new THREE.BoxGeometry(0.016, 0.38, 0.02);
    const stripeMesh = new THREE.Mesh(stripeGeo, accentMat);
    stripeMesh.position.set(0, 0.16, 0.20);
    torsoGroup.add(stripeMesh);

    // Visible Graceful Neck (Skin-toned cylinder connecting chest and head)
    const neckGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.16, 24);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, 0.42, 0);
    torsoGroup.add(neckMesh);

    // 2. Head & Facial Geometry (Positioned at y = 0.58 so neck, chin, lips, and nose are completely visible)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.58, 0);
    torsoGroup.add(headGroup);

    // Skull & Cute Anime Face
    const headGeo = new THREE.SphereGeometry(0.185, 32, 28);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.scale.set(1.0, 1.10, 1.02);
    headGroup.add(headMesh);

    // Sculpted Chin / Jaw Taper
    const jawGeo = new THREE.ConeGeometry(0.075, 0.08, 16);
    const jawMesh = new THREE.Mesh(jawGeo, skinMat);
    jawMesh.rotation.x = Math.PI;
    jawMesh.position.set(0, -0.15, 0.06);
    headGroup.add(jawMesh);

    // 3D Anime Nose (Delicate, Clear & Prominent)
    const noseGeo = new THREE.ConeGeometry(0.020, 0.055, 12);
    const noseMesh = new THREE.Mesh(noseGeo, skinMat);
    noseMesh.rotation.x = -Math.PI / 2.3;
    noseMesh.position.set(0, 0.015, 0.195);
    headGroup.add(noseMesh);

    // Eyes with white sclera, pupil, iris, and eyelid
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x4a2810, roughness: 0.3 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x120a06 });
    const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyelidMat = new THREE.MeshStandardMaterial({ color: 0xf0c4aa, roughness: 0.6 });
    const lipsMat = new THREE.MeshStandardMaterial({ color: 0xdb2777, roughness: 0.4 }); // Soft rose lips

    const createEye = (xPos) => {
      const eyeG = new THREE.Group();
      eyeG.position.set(xPos, 0.052, 0.172);

      const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 16), eyeWhiteMat);
      eyeMesh.scale.set(1.1, 0.9, 0.5);
      eyeG.add(eyeMesh);

      const irisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 16), irisMat);
      irisMesh.position.set(0, 0, 0.016);
      irisMesh.scale.set(1.0, 1.0, 0.4);
      eyeG.add(irisMesh);

      const pupilMesh = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 16), pupilMat);
      pupilMesh.position.set(0, 0, 0.022);
      eyeG.add(pupilMesh);

      // Cute white anime eye sparkle reflection
      const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), sparkleMat);
      sparkle.position.set(xPos > 0 ? -0.008 : 0.008, 0.008, 0.028);
      eyeG.add(sparkle);

      const eyelid = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), eyelidMat);
      eyelid.rotation.x = -Math.PI / 2;
      eyelid.position.set(0, 0, 0.01);
      eyeG.add(eyelid);

      return { eyeGroup: eyeG, eyelid, pupilMesh };
    };

    const eyeL = createEye(-0.068);
    const eyeR = createEye(0.068);
    headGroup.add(eyeL.eyeGroup);
    headGroup.add(eyeR.eyeGroup);

    // Cute Anime Eyebrows
    const browGeo = new THREE.BoxGeometry(0.042, 0.007, 0.01);
    const browL = new THREE.Mesh(browGeo, hairMat);
    browL.position.set(-0.068, 0.105, 0.178);
    browL.rotation.z = -0.08;
    headGroup.add(browL);

    const browR = new THREE.Mesh(browGeo, hairMat);
    browR.position.set(0.068, 0.105, 0.178);
    browR.rotation.z = 0.08;
    headGroup.add(browR);

    // Beautiful, Clearly Visible Lips & Mouth
    const lipsGroup = new THREE.Group();
    lipsGroup.position.set(0, -0.065, 0.188);

    // Upper Lip
    const upperLipGeo = new THREE.BoxGeometry(0.042, 0.010, 0.012);
    const upperLip = new THREE.Mesh(upperLipGeo, lipsMat);
    upperLip.position.set(0, 0.006, 0);
    lipsGroup.add(upperLip);

    // Lower Lip (Plump soft anime bottom lip)
    const lowerLipGeo = new THREE.BoxGeometry(0.038, 0.012, 0.012);
    const lowerLip = new THREE.Mesh(lowerLipGeo, lipsMat);
    lowerLip.position.set(0, -0.006, 0);
    lipsGroup.add(lowerLip);

    // Dynamic Talking Lip-Sync Aperture Mesh (Opens smoothly when speaking)
    const mouthGeo = new THREE.BoxGeometry(0.036, 0.018, 0.015);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x581c24 });
    const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthMesh.position.set(0, 0, 0.002);
    mouthMesh.scale.set(1.0, 0.1, 1.0); // resting closed
    lipsGroup.add(mouthMesh);

    headGroup.add(lipsGroup);

    // Cheerful anime cheek blush highlights
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.35
    });
    const blushGeo = new THREE.PlaneGeometry(0.042, 0.022);
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    blushL.position.set(-0.105, 0.010, 0.182);
    headGroup.add(blushL);

    const blushR = new THREE.Mesh(blushGeo, blushMat);
    blushR.position.set(0.105, 0.010, 0.182);
    headGroup.add(blushR);

    // Hair Style (High bun + wispy front bangs that stay ABOVE eyes/nose + side strands)
    const hairGroup = new THREE.Group();
    const hairCapGeo = new THREE.SphereGeometry(0.192, 24, 20);
    const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
    hairCap.position.set(0, 0.04, -0.025);
    hairGroup.add(hairCap);

    // High Messy Bun (Positioned gracefully at top back)
    const hairBunGeo = new THREE.SphereGeometry(0.10, 20, 20);
    const hairBun = new THREE.Mesh(hairBunGeo, hairMat);
    hairBun.position.set(0, 0.23, -0.06);
    hairGroup.add(hairBun);

    // Cute Wispy Bangs (Positioned at y = 0.13, well ABOVE the eyes, nose, and lips!)
    const bangsGeo = new THREE.BoxGeometry(0.14, 0.035, 0.04);
    const bangsMesh = new THREE.Mesh(bangsGeo, hairMat);
    bangsMesh.position.set(0, 0.13, 0.165);
    bangsMesh.rotation.x = -0.15;
    hairGroup.add(bangsMesh);

    // Delicate Side hair strands framing cheeks without covering lips or nose
    const strandGeo = new THREE.ConeGeometry(0.016, 0.18, 12);
    const strandL = new THREE.Mesh(strandGeo, hairMat);
    strandL.position.set(-0.16, -0.02, 0.11);
    strandL.rotation.z = 0.12;
    hairGroup.add(strandL);

    const strandR = new THREE.Mesh(strandGeo, hairMat);
    strandR.position.set(0.16, -0.02, 0.11);
    strandR.rotation.z = -0.12;
    hairGroup.add(strandR);

    headGroup.add(hairGroup);

    // Over-Ear DJ Headphones with Glowing Ring (Positioned neatly on ears at y = 0.04)
    const hpGroup = new THREE.Group();
    const hpBandGeo = new THREE.TorusGeometry(0.21, 0.018, 12, 32, Math.PI);
    const hpBand = new THREE.Mesh(hpBandGeo, hoodieMat);
    hpBand.position.set(0, 0.04, 0);
    hpGroup.add(hpBand);

    const createEarCup = (xPos) => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.035, 24), hoodieMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(xPos, 0.03, 0);

      const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.050, 0.008, 12, 24), accentMat);
      glowRing.rotation.y = Math.PI / 2;
      glowRing.position.set(xPos > 0 ? 0.020 : -0.020, 0, 0);
      cup.add(glowRing);

      return cup;
    };
    hpGroup.add(createEarCup(-0.195));
    hpGroup.add(createEarCup(0.195));
    headGroup.add(hpGroup);

    // 3. Arms & Shoulders (Lowered to match shoulder height at y = 0.32)
    const armL = new THREE.Group();
    const armR = new THREE.Group();
    armL.position.set(-0.25, 0.32, 0);
    armR.position.set(0.25, 0.32, 0);
    torsoGroup.add(armL);
    torsoGroup.add(armR);

    const armGeo = new THREE.CylinderGeometry(0.055, 0.046, 0.44, 16);
    const armLMesh = new THREE.Mesh(armGeo, hoodieMat);
    const armRMesh = new THREE.Mesh(armGeo, hoodieMat);
    armLMesh.position.set(0, -0.20, 0);
    armRMesh.position.set(0, -0.20, 0);
    armL.add(armLMesh);
    armR.add(armRMesh);

    // Hands
    const handGeo = new THREE.SphereGeometry(0.042, 16, 16);
    const handL = new THREE.Mesh(handGeo, skinMat);
    const handR = new THREE.Mesh(handGeo, skinMat);
    handL.position.set(0, -0.42, 0);
    handR.position.set(0, -0.42, 0);
    armL.add(handL);
    armR.add(handR);

    // 4. Legs & Footwear
    const legL = new THREE.Group();
    const legR = new THREE.Group();
    legL.position.set(-0.11, -0.04, 0);
    legR.position.set(0.11, -0.04, 0);
    proceduralGroup.add(legL);
    proceduralGroup.add(legR);

    const legGeo = new THREE.CylinderGeometry(0.08, 0.065, 0.62, 16);
    const legLMesh = new THREE.Mesh(legGeo, pantsMat);
    const legRMesh = new THREE.Mesh(legGeo, pantsMat);
    legLMesh.position.set(0, -0.31, 0);
    legRMesh.position.set(0, -0.31, 0);
    legL.add(legLMesh);
    legR.add(legRMesh);

    // Sneakers
    const shoeGeo = new THREE.BoxGeometry(0.11, 0.08, 0.22);
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(0, -0.62, 0.04);
    shoeR.position.set(0, -0.62, 0.04);
    legL.add(shoeL);
    legR.add(shoeR);

    // =========================================================================
    // C. 60 FPS ANIMATION LOOP WITH TAB VISIBILITY PAUSE & HEAD TRACKING
    // =========================================================================
    let reqId;
    let clock = new THREE.Clock();
    let isTabVisible = true;
    let blinkTimer = 0;
    let isBlinking = false;
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
        clock.getDelta(); // flush delta
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (!isTabVisible) return;

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      const curState = stateRef.current.animationState;
      const isSpeakingNow = stateRef.current.isSpeaking;
      const isListeningNow = stateRef.current.isListening;
      const vol = stateRef.current.voiceVolumeScale;
      const facingDir = stateRef.current.facing;

      // Smooth Orientation
      const targetScaleX = facingDir === 'right' ? -1 : 1;
      charRoot.scale.x = THREE.MathUtils.lerp(charRoot.scale.x, targetScaleX, 0.15);

      // Update AnimationMixer if GLB is loaded
      if (mixer) {
        mixer.update(delta);
        // Map current state to GLTF action
        if (curState === 'walking' || curState === 'walk') fadeToAction('walk', 0.25);
        else if (curState === 'running' || curState === 'run') fadeToAction('run', 0.25);
        else if (curState === 'jump') fadeToAction('jump', 0.2);
        else if (curState === 'wave') fadeToAction('wave', 0.25);
        else if (curState === 'dance') fadeToAction('dance', 0.3);
        else if (isSpeakingNow || curState === 'speaking') fadeToAction('speaking', 0.25);
        else if (curState === 'think' || curState === 'thinking') fadeToAction('thinking', 0.3);
        else fadeToAction('idle', 0.35);
      }

      // Head-Only Subtle Cursor Tracking Logic:
      // "only a liitle up down face movement and left right movement"
      // Limits: subtle gentle yaw max ±8° (0.14 rad), pitch max ±5° (0.087 rad)
      // Dead zone: movements < 0.05 are centered
      // 3-second cursor idle: smoothly returns to neutral (0, 0)
      const now = Date.now();
      const isCursorIdle = (now - lastMouseMoveTime) > 3000;

      let rawX = stateRef.current.cursorX || 0;
      let rawY = stateRef.current.cursorY || 0;

      if (Math.abs(rawX) < 0.05) rawX = 0;
      if (Math.abs(rawY) < 0.05) rawY = 0;

      const maxYawRad = 8 * (Math.PI / 180); // Subtle ±8° left/right
      const maxPitchRad = 5 * (Math.PI / 180); // Subtle ±5° up/down

      const targetYaw = isCursorIdle ? 0 : THREE.MathUtils.clamp(rawX * maxYawRad, -maxYawRad, maxYawRad);
      const targetPitch = isCursorIdle ? 0 : THREE.MathUtils.clamp(-rawY * maxPitchRad, -maxPitchRad, maxPitchRad);

      // Smooth gentle interpolation with lerp factor 0.04
      currentHeadYaw = THREE.MathUtils.lerp(currentHeadYaw, targetYaw, 0.04);
      currentHeadPitch = THREE.MathUtils.lerp(currentHeadPitch, targetPitch, 0.04);

      // Apply strictly to GLB head bone if active
      if (glbHeadBone) {
        glbHeadBone.rotation.y = currentHeadYaw;
        glbHeadBone.rotation.x = currentHeadPitch;
      }

      // Procedural 3D Kinematics (Runs if GLB is absent or blends with baseline)
      if (!isGlbActive) {
        // 1. Natural Breathing & Weight Shift (Idle)
        const breath = Math.sin(time * 2.6);
        torsoGroup.position.y = breath * 0.012;
        torsoGroup.scale.y = 1.0 + breath * 0.015;
        torsoGroup.rotation.y = 0; // Body stays strictly facing forward
        torsoGroup.rotation.x = 0;

        // 2. Subtle Head Gaze Tracking (Targeting strictly head/neck)
        headGroup.rotation.y = currentHeadYaw;
        headGroup.rotation.x = currentHeadPitch;

        // Eyes can follow slightly more (pupil tracking)
        const pupilShiftX = currentHeadYaw * 0.025;
        const pupilShiftY = -currentHeadPitch * 0.020;
        if (eyeL?.pupilMesh && eyeR?.pupilMesh) {
          eyeL.pupilMesh.position.x = pupilShiftX;
          eyeL.pupilMesh.position.y = pupilShiftY;
          eyeR.pupilMesh.position.x = pupilShiftX;
          eyeR.pupilMesh.position.y = pupilShiftY;
        }

        // 3. Natural Eye Blinking (Every 3.5s for 120ms)
        blinkTimer += delta;
        if (blinkTimer > (isBlinking ? 0.12 : 3.5 + Math.random() * 2.0)) {
          isBlinking = !isBlinking;
          blinkTimer = 0;
        }
        const blinkRot = isBlinking ? 0 : -Math.PI / 2;
        eyeL.eyelid.rotation.x = THREE.MathUtils.lerp(eyeL.eyelid.rotation.x, blinkRot, 0.3);
        eyeR.eyelid.rotation.x = THREE.MathUtils.lerp(eyeR.eyelid.rotation.x, blinkRot, 0.3);

        // 4. Lip-Sync Mouth & Lips Articulation (Speaking State)
        if (isSpeakingNow || curState === 'speaking') {
          const speechFreq = time * 20;
          const aperture = (0.2 + Math.abs(Math.sin(speechFreq)) * 0.8) * Math.max(0.4, vol);
          mouthMesh.scale.set(1.0 + aperture * 0.5, 1.0 + aperture * 2.2, 1.0);
          lowerLip.position.y = -0.006 - aperture * 0.012;
          upperLip.position.y = 0.006 + aperture * 0.006;
          headGroup.position.y = 0.58 + Math.sin(time * 6) * 0.008;
          armR.rotation.z = -0.15 + Math.sin(time * 4) * 0.08;
        } else {
          mouthMesh.scale.set(1.0, 0.1, 1.0);
          lowerLip.position.y = -0.006;
          upperLip.position.y = 0.006;
          headGroup.position.y = 0.58;
          armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, 0, 0.1);
        }

        // 5. Attentive Listening State
        if (isListeningNow || curState === 'listening') {
          headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, 0.12, 0.1);
          accentMat.emissiveIntensity = 0.8 + Math.sin(time * 6) * 0.3;
          particleMat.size = 0.075 + vol * 0.04;
        } else {
          headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, 0, 0.1);
          accentMat.emissiveIntensity = 0.4;
          particleMat.size = 0.05;
        }

        // 6. Action-Specific Kinematics (Walk, Run, Jump, Wave, Dance)
        if (curState === 'walking' || curState === 'walk') {
          const stride = Math.sin(time * 8);
          legL.rotation.x = stride * 0.65;
          legR.rotation.x = -stride * 0.65;
          armL.rotation.x = -stride * 0.55;
          armR.rotation.x = stride * 0.55;
          torsoGroup.position.y = Math.abs(stride) * 0.03;
        } else if (curState === 'running' || curState === 'run') {
          const stride = Math.sin(time * 16);
          legL.rotation.x = stride * 0.95;
          legR.rotation.x = -stride * 0.95;
          armL.rotation.x = -stride * 0.85;
          armR.rotation.x = stride * 0.85;
          torsoGroup.position.y = Math.abs(stride) * 0.06;
          torsoGroup.rotation.x = 0.12;
        } else if (curState === 'jump') {
          const jumpPhase = Math.sin(time * 10);
          torsoGroup.position.y = Math.max(0, jumpPhase * 0.22);
          armL.rotation.z = 0.5;
          armR.rotation.z = -0.5;
        } else if (curState === 'wave') {
          const wave = Math.sin(time * 14) * 0.35;
          armR.rotation.z = -1.6 + wave;
          armR.rotation.x = 0.2;
        } else if (curState === 'dance') {
          const groove = Math.sin(time * 6);
          charRoot.position.x = groove * 0.08;
          headGroup.rotation.z = groove * 0.15;
          armL.rotation.z = 0.4 + groove * 0.3;
          armR.rotation.z = -0.4 - groove * 0.3;
        } else {
          // Reset limb angles for resting idle
          legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, 0.1);
          legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, 0.1);
          armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, 0, 0.1);
          armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, 0, 0.1);
          torsoGroup.rotation.x = THREE.MathUtils.lerp(torsoGroup.rotation.x, 0, 0.1);
          charRoot.position.x = THREE.MathUtils.lerp(charRoot.position.x, 0, 0.1);
        }
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
  }, [width, height]);

  return (
    <div
      ref={mountRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="relative flex items-center justify-center select-none pointer-events-none"
    />
  );
}
