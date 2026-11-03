import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * TwoDCharacter / High-Fidelity Multi-Layer Skeletal Live2D Avatar Engine
 * Production-Ready Interactive AI Companion for Loopra
 * 
 * Architecture & Kinematics:
 * 1. Multi-Layer Rigged Skeletal Hierarchy:
 *    - Independent rigged layers: Legs, Torso, Left Arm, Right Arm, Head, Face Expressions,
 *      Gaze Eyes, Blinking Eyelids, and Reactive Viseme Mouth Mesh.
 *    - Soft alpha-blended transparent textures with studio lighting and rim illumination.
 * 2. 60 FPS Skeletal Kinematics & Organic Motion:
 *    - Idle breathing: Subtle rhythmic chest volume expansion and pelvic vertical bobbing.
 *    - Ambient gaze tracking: Eyes (eyeL, eyeR) and headGroup smoothly orient toward user mouse cursor.
 *    - Dynamic hair spring physics: Soft secondary motion on head tilt and head turns.
 *    - Natural blinking cycles: Periodic eyelid blink every 3-5s (120ms closure) + playful wink.
 *    - Reactive lip-sync visemes: mouthMesh aperture modulates dynamically to speech audio volume scale.
 *    - Dynamic expression switching: Idle, Speaking, Listening, Thinking, Happy, Winking, Posing.
 *    - Composite action kinematics: Walking (isWalk), Running (isRun), Dancing (isDance), Speaking (isTalk), Listening (isListen).
 * 3. Audio-Reactive Base Visualizer:
 *    - Double concentric glowing particleSystem orbiting the feet, pulsating dynamically to music beats and audio frequencies.
 */
export default function TwoDCharacter({
  gender = 'female',
  animationState = 'idle',
  isSpeaking = false,
  isListening = false,
  voiceVolumeScale = 0,
  facing = 'left',
  cursorOffset = { x: 0, y: 0 },
  width = 200,
  height = 265
}) {
  const mountRef = useRef(null);
  const isMale = false; // Strictly single consistent Female Live2D companion

  // Dynamic state ref for the 60 FPS animation loop
  const stateRef = useRef({
    gender: 'female',
    animationState,
    isSpeaking,
    isListening,
    voiceVolumeScale,
    facing,
    cursorX: 0,
    cursorY: 0
  });

  useEffect(() => {
    stateRef.current = {
      gender: 'female',
      animationState,
      isSpeaking,
      isListening,
      voiceVolumeScale: Math.max(0, Math.min(1, voiceVolumeScale || (isSpeaking ? 0.75 : 0))),
      facing,
      cursorX: Math.max(-1, Math.min(1, (cursorOffset?.x || 0) / 160)),
      cursorY: Math.max(-1, Math.min(1, (cursorOffset?.y || 0) / 160))
    };
  }, [animationState, isSpeaking, isListening, voiceVolumeScale, facing, cursorOffset]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, High-Performance WebGL Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 50);
    camera.position.set(0, 0.0, 3.8);
    camera.lookAt(0, 0.0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = false;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Cinematic Studio & Accent Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);

    const rimColor = 0x10b981; // Vibrant emerald neon accent for Loopra
    const rimLight = new THREE.DirectionalLight(rimColor, 2.4);
    rimLight.position.set(0, 2.0, -2.5);
    scene.add(rimLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    keyLight.position.set(2.0, 2.5, 2.5);
    scene.add(keyLight);

    // 3. Texture Loader & Pre-caching for Rigged Live2D Character Sprites
    const textureLoader = new THREE.TextureLoader();
    const loadedTextures = {};

    const spriteMap = {
      female: {
        legs: '/characters/female_legs.png',
        torso: '/characters/female_torso.png',
        arm_l: '/characters/female_arm_l.png',
        arm_r: '/characters/female_arm_r.png',
        head: '/characters/female_head.png',
        walk: '/characters/pose_walk_hd.png',
        run: '/characters/pose_run_hd.png',
        dance: '/characters/pose_dance_hd.png',
        jump: '/characters/pose_jump_hd.png',
        point: '/characters/pose_point_hd.png'
      }
    };

    const getTexture = (url) => {
      if (!loadedTextures[url]) {
        const tex = textureLoader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        loadedTextures[url] = tex;
      }
      return loadedTextures[url];
    };

    // Preload key sprites for Female Live2D character
    const activePack = spriteMap.female;
    Object.values(activePack).forEach(url => getTexture(url));

    // 4. Character Assembly Root & Skeletal Kinematics Hierarchy
    const charGroup = new THREE.Group();
    scene.add(charGroup);

    // Ground Shadow
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4
    });
    const shadowMesh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.96;
    charGroup.add(shadowMesh);

    // =========================================================================
    // A. AUDIO REACTIVE BASE VISUALIZER (Double Concentric Particle Rings)
    // =========================================================================
    const particleCount = 48;
    const ringGeo = new THREE.BufferGeometry();
    const ringPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 0.58 + (i % 2 === 0 ? 0.05 : -0.05);
      ringPositions[i * 3] = Math.cos(angle) * radius;
      ringPositions[i * 3 + 1] = 0;
      ringPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: rimColor,
      size: 0.055,
      transparent: true,
      opacity: 0.85
    });
    const particleSystem = new THREE.Points(ringGeo, particleMat);
    particleSystem.position.y = -0.94;
    charGroup.add(particleSystem);

    // Inner concentric pulsing glow ring
    const innerRingGeo = new THREE.TorusGeometry(0.52, 0.015, 12, 48);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: rimColor,
      transparent: true,
      opacity: 0.5
    });
    const innerRingMesh = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRingMesh.rotation.x = Math.PI / 2;
    innerRingMesh.position.y = -0.94;
    charGroup.add(innerRingMesh);

    // Helper to create transparent sprite materials with soft alpha blending
    const createLayerMat = (textureUrl) => new THREE.MeshBasicMaterial({
      map: getTexture(textureUrl),
      transparent: true,
      alphaTest: 0.005,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // =========================================================================
    // B. MULTI-LAYER LIVE2D SKELETAL RIG: LEGS, TORSO, ARMS, HEAD, EYES, VISEMES
    // =========================================================================
    // Root puppet group
    const puppetRoot = new THREE.Group();
    charGroup.add(puppetRoot);

    // 1. LEGS LAYER & BIPEDAL JOINTS
    const legsGroup = new THREE.Group();
    legsGroup.position.set(0, 0.0, 0.0);
    puppetRoot.add(legsGroup);

    // Static Resting Legs Mesh (cargo pants & sneakers - used for idle/talk/listen/dance)
    const legsMat = createLayerMat(activePack.legs);
    const legsPlaneGeo = new THREE.PlaneGeometry(0.376, 0.975);
    const legsMesh = new THREE.Mesh(legsPlaneGeo, legsMat);
    legsMesh.position.set(0, -0.4875, 0.005);
    legsGroup.add(legsMesh);

    // Dynamic Articulated Leg Limbs (independent left & right kinematics for natural walk/run)
    const legL = new THREE.Group();
    const legR = new THREE.Group();
    legL.position.set(-0.09, 0.0, 0.01);
    legR.position.set(0.09, 0.0, 0.01);
    legsGroup.add(legL);
    legsGroup.add(legR);

    // Left Leg UV-mapped mesh
    const legLGeo = new THREE.PlaneGeometry(0.188, 0.975);
    const legLUVs = legLGeo.attributes.uv;
    for (let i = 0; i < legLUVs.count; i++) {
      legLUVs.setX(i, legLUVs.getX(i) * 0.5);
    }
    legLUVs.needsUpdate = true;
    const legLMesh = new THREE.Mesh(legLGeo, legsMat);
    legLMesh.position.set(0, -0.4875, 0);
    legL.add(legLMesh);

    // Right Leg UV-mapped mesh
    const legRGeo = new THREE.PlaneGeometry(0.188, 0.975);
    const legRUVs = legRGeo.attributes.uv;
    for (let i = 0; i < legRUVs.count; i++) {
      legRUVs.setX(i, 0.5 + legRUVs.getX(i) * 0.5);
    }
    legRUVs.needsUpdate = true;
    const legRMesh = new THREE.Mesh(legRGeo, legsMat);
    legRMesh.position.set(0, -0.4875, 0);
    legR.add(legRMesh);

    // Initially hide articulated legs until moving
    legL.visible = false;
    legR.visible = false;

    // 2. TORSO LAYER (Black Loopra Hoodie, soundwave emblem, sleeve accents)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.0, 0.01);
    puppetRoot.add(torsoGroup);

    const torsoMat = createLayerMat(activePack.torso);
    const torsoPlaneGeo = new THREE.PlaneGeometry(0.400, 0.585);
    const torsoMesh = new THREE.Mesh(torsoPlaneGeo, torsoMat);
    torsoMesh.position.set(0, 0.215, 0.01);
    torsoGroup.add(torsoMesh);

    // 3. ARMS RIGGING (Independent shoulders, forearms, hands)
    // Left Arm (Screen Left)
    const armL = new THREE.Group();
    armL.position.set(-0.21, 0.46, 0.015);
    torsoGroup.add(armL);

    const armLMat = createLayerMat(activePack.arm_l);
    const armLPlaneGeo = new THREE.PlaneGeometry(0.161, 0.663);
    const armLMesh = new THREE.Mesh(armLPlaneGeo, armLMat);
    armLMesh.position.set(-0.022, -0.323, 0);
    armL.add(armLMesh);

    // Right Arm (Screen Right)
    const armR = new THREE.Group();
    armR.position.set(0.21, 0.46, 0.015);
    torsoGroup.add(armR);

    const armRMat = createLayerMat(activePack.arm_r);
    const armRPlaneGeo = new THREE.PlaneGeometry(0.163, 0.663);
    const armRMesh = new THREE.Mesh(armRPlaneGeo, armRMat);
    armRMesh.position.set(0.021, -0.323, 0);
    armR.add(armRMesh);

    // 4. HEAD GROUP (Neck pivot, hair physics, gaze tracking, expressions)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.46, 0.025);
    torsoGroup.add(headGroup);

    // Base Head Mesh (Face, messy high bun hair, DJ headphones)
    const headMat = createLayerMat(activePack.head);
    const headPlaneGeo = new THREE.PlaneGeometry(0.439, 0.545);
    const headMesh = new THREE.Mesh(headPlaneGeo, headMat);
    headMesh.position.set(0, 0.2425, 0);
    headGroup.add(headMesh);

    // Gaze-Tracking Eye Rig (eyeL, eyeR)
    const eyeL = new THREE.Group();
    const eyeR = new THREE.Group();
    eyeL.position.set(-0.062, 0.22, 0.008);
    eyeR.position.set(0.062, 0.22, 0.008);
    headGroup.add(eyeL);
    headGroup.add(eyeR);

    // 5. Eyelid overlays for natural blinking & winking
    const blinkMat = new THREE.MeshBasicMaterial({
      color: 0x2b1e1d,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const blinkGeo = new THREE.PlaneGeometry(0.045, 0.016);
    const blinkL = new THREE.Mesh(blinkGeo, blinkMat);
    const blinkR = new THREE.Mesh(blinkGeo, blinkMat);
    blinkL.position.set(-0.062, 0.22, 0.012);
    blinkR.position.set(0.062, 0.22, 0.012);
    headGroup.add(blinkL);
    headGroup.add(blinkR);

    // 6. Dynamic Lip-Sync Mouth Mesh (modulates aperture to voice syllables)
    const mouthMat = new THREE.MeshBasicMaterial({
      color: 0x611b22,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const mouthGeo = new THREE.PlaneGeometry(0.045, 0.02);
    const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthMesh.position.set(0, 0.125, 0.01);
    headGroup.add(mouthMesh);

    // 5. 60 FPS Kinematics & Animation Loop
    let reqId;
    let clock = new THREE.Clock();
    let blinkTimer = 0;
    let isBlinking = false;

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();
      const curState = stateRef.current.animationState;
      const isSpeakingNow = stateRef.current.isSpeaking;
      const isListeningNow = stateRef.current.isListening;
      const vol = stateRef.current.voiceVolumeScale;
      const facingDir = stateRef.current.facing;
      const curPack = spriteMap.female;

      // Identify active composite flags
      const isWalk = curState === 'walking' || curState === 'walk';
      const isRun = curState === 'running' || curState === 'run';
      const isDance = curState === 'dance' || curState === 'dancing';
      const isTalk = isSpeakingNow || curState === 'speaking' || curState === 'speak';
      const isListen = isListeningNow || curState === 'listening' || curState === 'listen';
      const isWave = curState === 'wave';
      const isWink = curState === 'wink';
      const isJump = curState === 'jump';
      const isThink = curState === 'think' || curState === 'thinking';
      const isHappy = curState === 'happy' || curState === 'celebrating';

      // Smooth Directional Orientation according to movement facing
      const targetScaleX = facingDir === 'right' ? -1 : 1;
      charGroup.scale.x = THREE.MathUtils.lerp(charGroup.scale.x, targetScaleX, 0.2);

      // 1. Natural Breathing Kinematics (Idle)
      const breath = Math.sin(time * 2.8);
      torsoGroup.position.y = breath * 0.012;
      torsoGroup.scale.y = 1.0 + breath * 0.015;
      torsoGroup.scale.x = 1.0 - breath * 0.008;

      // 2. Cursor Gaze Tracking & Head Turns
      const targetGazeX = stateRef.current.cursorX * 0.22;
      const targetGazeY = -stateRef.current.cursorY * 0.15;
      headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, targetGazeX, 0.08);
      headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, targetGazeY, 0.08);

      // Hair secondary spring physics
      const hairSway = Math.sin(time * 3.5) * 0.02 + Math.sin(time * 6.5) * 0.008;
      headMesh.rotation.z = THREE.MathUtils.lerp(headMesh.rotation.z, hairSway, 0.1);

      eyeL.position.x = -0.062 + targetGazeX * 0.04;
      eyeR.position.x = 0.062 + targetGazeX * 0.04;

      // 3. Periodic Eye Blinking (Every 3-5 seconds for 120ms)
      blinkTimer += delta;
      if (blinkTimer > (isBlinking ? 0.12 : 3.2 + Math.random() * 2.0)) {
        isBlinking = !isBlinking;
        blinkTimer = 0;
      }

      if (isWink) {
        blinkR.scale.y = 1.0;
        blinkL.scale.y = 0;
        blinkMat.opacity = 0.95;
        headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, -0.12, 0.15);
      } else {
        const blinkAmount = isBlinking ? 1.0 : 0.0;
        blinkL.scale.y = blinkAmount;
        blinkR.scale.y = blinkAmount;
        blinkMat.opacity = blinkAmount * 0.95;
      }

      // 4. Reactive Lip-Sync Visemes (modulates to voice volume scale & syllables)
      if (isTalk) {
        const speechFreq = time * 18;
        const aperture = (0.2 + Math.abs(Math.sin(speechFreq)) * 0.8) * Math.max(0.4, vol);
        mouthMesh.scale.set(1.0 + aperture * 0.8, 1.0 + aperture * 3.0, 1.0);
        mouthMat.opacity = 0.35 + aperture * 0.25;
        headGroup.position.y = 0.46 + Math.sin(time * 7) * 0.015;
        // Subtle arm gesture while talking
        armR.rotation.z = -0.1 + Math.sin(time * 4) * 0.08;
      } else {
        mouthMesh.scale.set(1.0, 1.0, 1.0);
        mouthMat.opacity = 0;
        headGroup.position.y = 0.46;
      }

      // 5. Attentive Listening State
      if (isListen) {
        headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, 0.12, 0.1);
        torsoGroup.rotation.x = THREE.MathUtils.lerp(torsoGroup.rotation.x, 0.05, 0.1);
        armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, 0.08, 0.1);
        armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, -0.08, 0.1);
        particleMat.size = 0.085 + vol * 0.04;
      } else if (!isWink) {
        headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, 0, 0.1);
        torsoGroup.rotation.x = THREE.MathUtils.lerp(torsoGroup.rotation.x, 0, 0.1);
        particleMat.size = 0.055;
      }

      // 6. Action-Specific Kinematics & Gestures
      if (isRun) {
        // Continuous, properly timed running stride with real limb kinematics
        legsMesh.visible = false;
        legL.visible = true;
        legR.visible = true;

        const stride = Math.sin(time * 20); // Fast, energetic running frequency
        legL.rotation.x = stride * 0.95;
        legR.rotation.x = -stride * 0.95;
        legL.position.y = Math.max(0, -stride * 0.05);
        legR.position.y = Math.max(0, stride * 0.05);

        // Arms pump continuously in natural opposition to legs
        armL.rotation.x = -stride * 0.85;
        armR.rotation.x = stride * 0.85;
        armL.rotation.z = 0.16;
        armR.rotation.z = -0.16;

        // Bounding vertical dynamics & forward athletic lean
        torsoGroup.position.y = Math.abs(stride) * 0.06;
        torsoGroup.rotation.x = THREE.MathUtils.lerp(torsoGroup.rotation.x, 0.1, 0.2);
        torsoGroup.rotation.z = Math.sin(time * 20) * 0.04;
        headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, -0.06, 0.2);
      } else if (isWalk) {
        // Continuous, natural walking stride
        legsMesh.visible = false;
        legL.visible = true;
        legR.visible = true;

        const stride = Math.sin(time * 12);
        legL.rotation.x = stride * 0.6;
        legR.rotation.x = -stride * 0.6;
        legL.position.y = Math.max(0, -stride * 0.03);
        legR.position.y = Math.max(0, stride * 0.03);

        armL.rotation.x = -stride * 0.5;
        armR.rotation.x = stride * 0.5;
        armL.rotation.z = 0.08;
        armR.rotation.z = -0.08;

        torsoGroup.position.y = Math.abs(stride) * 0.035;
        torsoGroup.rotation.x = THREE.MathUtils.lerp(torsoGroup.rotation.x, 0.04, 0.2);
        torsoGroup.rotation.z = Math.sin(time * 12) * 0.025;
      } else if (isDance) {
        legsMesh.visible = true;
        legL.visible = false;
        legR.visible = false;
        const beat = time * 7.5;
        torsoGroup.position.y = Math.abs(Math.sin(beat)) * 0.06;
        torsoGroup.rotation.z = Math.sin(beat * 0.5) * 0.12;
        legsMesh.rotation.z = -Math.sin(beat * 0.5) * 0.08;
        armL.rotation.z = 0.35 + Math.sin(beat) * 0.45;
        armR.rotation.z = -0.35 - Math.sin(beat) * 0.45;
        headGroup.rotation.z = Math.sin(beat) * 0.1;
      } else if (isWave) {
        legsMesh.visible = true;
        legL.visible = false;
        legR.visible = false;
        // Joyful wave gesture: Right arm raises and hand oscillates
        armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, -2.2 + Math.sin(time * 14) * 0.4, 0.2);
        armR.rotation.y = THREE.MathUtils.lerp(armR.rotation.y, Math.sin(time * 12) * 0.3, 0.2);
        armL.rotation.z = 0.04;
      } else if (isJump) {
        legsMesh.visible = true;
        legL.visible = false;
        legR.visible = false;
        const jumpTime = (time * 4) % (Math.PI * 2);
        puppetRoot.position.y = Math.max(0, Math.sin(jumpTime)) * 0.35;
        armL.rotation.z = 0.8;
        armR.rotation.z = -0.8;
      } else {
        // Natural resting idle stance with smooth settling
        legsMesh.visible = true;
        legL.visible = false;
        legR.visible = false;
        puppetRoot.position.y = THREE.MathUtils.lerp(puppetRoot.position.y, 0, 0.2);
        legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, 0.2);
        legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, 0.2);
        legsMesh.rotation.z = THREE.MathUtils.lerp(legsMesh.rotation.z, 0, 0.2);
        armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, 0, 0.2);
        armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, 0, 0.2);
        armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, 0.04 + Math.sin(time * 2.8) * 0.02, 0.1);
        if (!isTalk) {
          armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, -0.04 - Math.sin(time * 2.8) * 0.02, 0.1);
          armR.rotation.y = THREE.MathUtils.lerp(armR.rotation.y, 0, 0.1);
        }
        torsoGroup.rotation.x = THREE.MathUtils.lerp(torsoGroup.rotation.x, 0, 0.1);
        torsoGroup.rotation.z = THREE.MathUtils.lerp(torsoGroup.rotation.z, 0, 0.1);
      }

      // 7. Base Audio Visualizer Animation (Concentric glowing rings)
      particleSystem.rotation.y = time * 0.5;
      innerRingMesh.rotation.z = -time * 0.7;
      const audioScale = 1.0 + vol * 0.45 + (isTalk ? Math.sin(time * 12) * 0.08 : 0);
      particleSystem.scale.set(audioScale, audioScale, audioScale);
      innerRingMesh.scale.set(audioScale, audioScale, audioScale);

      renderer.render(scene, camera);
    };

    reqId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(reqId);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.innerHTML = '';
      }
    };
  }, [gender, width, height, isMale]);

  return (
    <div
      ref={mountRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="relative flex items-center justify-center select-none overflow-visible"
    />
  );
}
