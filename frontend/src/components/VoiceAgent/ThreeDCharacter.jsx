import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * ThreeDCharacter
 * High-Quality Humanoid 3D AI Companion (Loopra Male & Loopra Female)
 * 
 * Features:
 * - Proper human body proportions (~1.8m scale)
 * - Sculpted face, jaw, 3D nose, lips, natural eyes with eyelids & blinking
 * - Detailed hairstyle (textured quiff for male, long flowing layers for female)
 * - Streetwear black hoodie with Loopra soundwave badge, pouch, and drawstrings
 * - Over-ear DJ headphones with audio-reactive glowing LED rings
 * - Detailed hands with individual fingers
 * - Cargo streetwear joggers & high-top designer sneakers
 * - Complete skeletal kinematic animation engine:
 *   - Idle: breathing chest, subtle weight shift, head glance, natural blinking
 *   - Listening: attentive head tilt, pulsing headphone glow
 *   - Speaking: dynamic mouth articulation, head nodding, conversational gestures
 *   - Walking: natural bipedal gait cycle with arm/leg swings & vertical bobbing
 *   - Running: athletic forward lean, rapid arm pump, high knee lift
 *   - Tapping: reaches forward with index finger to tap UI elements
 *   - Celebrating: cheerful double thumbs-up cheer
 *   - Playful: occasional cute bounce / mini-dance when idle
 */
export default function ThreeDCharacter({
  gender = 'male',
  animationState = 'idle',
  isSpeaking = false,
  isListening = false,
  voiceVolumeScale = 0,
  facing = 'left',
  width = 200,
  height = 265
}) {
  const mountRef = useRef(null);
  const stateRef = useRef({
    animationState,
    isSpeaking,
    isListening,
    voiceVolumeScale,
    facing
  });

  useEffect(() => {
    stateRef.current = {
      animationState,
      isSpeaking,
      isListening,
      voiceVolumeScale,
      facing
    };
  }, [animationState, isSpeaking, isListening, voiceVolumeScale, facing]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera & High-Performance WebGL Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 50);
    // Camera framed so the full body (from sneakers up to headphones) is prominently visible
    camera.position.set(0, 0.05, 3.8);
    camera.lookAt(0, 0.05, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // 2. Cinematic Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(gender === 'male' ? 0xfff0dd : 0xf0fdf4, 2.0);
    keyLight.position.set(2.5, 3.5, 3.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfff7ed, 1.2);
    fillLight.position.set(-2.5, 1.5, 2.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(gender === 'male' ? 0xf59e0b : 0x10b981, 1.8);
    rimLight.position.set(0, 2.0, -3.0);
    scene.add(rimLight);

    // 3. PBR & Stylized Materials
    const skinColor = gender === 'male' ? 0xfcd5b8 : 0xfce0cb;
    const skinMat = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.55,
      metalness: 0.05
    });

    const hairColor = gender === 'male' ? 0x221814 : 0x281912;
    const hairMat = new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.65,
      metalness: 0.1
    });

    const hoodieMat = new THREE.MeshStandardMaterial({
      color: 0x141418, // Matte Streetwear Black
      roughness: 0.85,
      metalness: 0.05
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x1f222a, // Charcoal cargo
      roughness: 0.8,
      metalness: 0.1
    });

    const accentColor = gender === 'male' ? 0xf59e0b : 0x10b981;
    const goldMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.6,
      metalness: 0.85,
      roughness: 0.25
    });

    const headphoneMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a20,
      metalness: 0.9,
      roughness: 0.2
    });

    const sneakerWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.05
    });

    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const irisMat = new THREE.MeshBasicMaterial({ color: gender === 'male' ? 0x78350f : 0x065f46 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const eyeHighlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x9f1239 });

    // 4. Humanoid Skeletal Kinematics Hierarchy
    const characterRoot = new THREE.Group();
    scene.add(characterRoot);

    // Ground Contact Shadow & Base
    const shadowGeo = new THREE.CircleGeometry(0.55, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.92;
    characterRoot.add(shadowMesh);

    // Subtle holographic floor pedestal ring
    const ringGeo = new THREE.TorusGeometry(0.65, 0.02, 16, 48);
    const ringMesh = new THREE.Mesh(ringGeo, goldMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = -0.91;
    characterRoot.add(ringMesh);

    // Pelvis / Hips (Root of body skeletal chain)
    const pelvis = new THREE.Group();
    pelvis.position.y = -0.05;
    characterRoot.add(pelvis);

    // Spine & Chest
    const spine = new THREE.Group();
    spine.position.y = 0.08;
    pelvis.add(spine);

    // Torso (Oversized Streetwear Hoodie)
    const torsoGeo = new THREE.CylinderGeometry(0.26, 0.22, 0.52, 20);
    const torso = new THREE.Mesh(torsoGeo, hoodieMat);
    torso.position.y = 0.26;
    spine.add(torso);

    // Hoodie Kangaroo Pouch Pocket
    const pouchGeo = new THREE.BoxGeometry(0.24, 0.16, 0.06);
    const pouch = new THREE.Mesh(pouchGeo, hoodieMat);
    pouch.position.set(0, 0.16, 0.21);
    pouch.rotation.x = -0.08;
    spine.add(pouch);

    // Luminous Loopra Soundwave Badge on Chest
    const badgeGroup = new THREE.Group();
    badgeGroup.position.set(0.08, 0.36, 0.24);
    badgeGroup.rotation.y = 0.12;
    spine.add(badgeGroup);

    // 4 equalizer bars on badge
    [-0.036, -0.012, 0.012, 0.036].forEach((xOffset, idx) => {
      const barH = [0.04, 0.07, 0.05, 0.06][idx];
      const barGeo = new THREE.BoxGeometry(0.014, barH, 0.01);
      const barMesh = new THREE.Mesh(barGeo, goldMat);
      barMesh.position.set(xOffset, 0, 0);
      badgeGroup.add(barMesh);
    });

    // Neck Collar / Hood Rim
    const hoodCollarGeo = new THREE.TorusGeometry(0.16, 0.05, 12, 24);
    const hoodCollar = new THREE.Mesh(hoodCollarGeo, hoodieMat);
    hoodCollar.rotation.x = Math.PI / 2;
    hoodCollar.position.set(0, 0.54, -0.02);
    spine.add(hoodCollar);

    // Drawstrings hanging from hood
    [-0.05, 0.05].forEach((xPos) => {
      const strGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.18, 8);
      const strMesh = new THREE.Mesh(strGeo, sneakerWhiteMat);
      strMesh.position.set(xPos, 0.42, 0.23);
      spine.add(strMesh);

      // Gold aglet tip
      const agletGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.03, 8);
      const agletMesh = new THREE.Mesh(agletGeo, goldMat);
      agletMesh.position.set(xPos, 0.32, 0.23);
      spine.add(agletMesh);
    });

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.12, 16);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.set(0, 0.56, 0);
    spine.add(neck);

    // Head Group (rotates on neck)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.72, 0.02);
    spine.add(headGroup);

    // Sculpted Head Geometry
    const headGeo = new THREE.SphereGeometry(0.24, 28, 28);
    headGeo.scale(0.92, 1.05, 0.98);
    const head = new THREE.Mesh(headGeo, skinMat);
    headGroup.add(head);

    // Chin / Jawline definition
    const chinGeo = new THREE.SphereGeometry(0.09, 16, 16);
    chinGeo.scale(1.0, 0.8, 1.2);
    const chin = new THREE.Mesh(chinGeo, skinMat);
    chin.position.set(0, -0.20, 0.14);
    headGroup.add(chin);

    // 3D Nose with Bridge
    const noseGeo = new THREE.ConeGeometry(0.032, 0.08, 12);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.rotation.x = -Math.PI / 2 + 0.3;
    nose.position.set(0, -0.02, 0.245);
    headGroup.add(nose);

    // 3D Mouth
    const mouthGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.016, 16);
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(0, -0.12, 0.22);
    mouth.scale.set(1, 0.3, 1);
    headGroup.add(mouth);

    // Left & Right Eyes
    const createEye = (isLeft) => {
      const eyeGroup = new THREE.Group();
      const xSign = isLeft ? -1 : 1;
      eyeGroup.position.set(xSign * 0.082, 0.03, 0.215);

      // Sclera (White)
      const scleraGeo = new THREE.SphereGeometry(0.038, 16, 16);
      scleraGeo.scale(1.2, 0.9, 0.6);
      const sclera = new THREE.Mesh(scleraGeo, eyeWhiteMat);
      eyeGroup.add(sclera);

      // Iris (Warm Honey Amber / Vibrant Emerald)
      const irisGeo = new THREE.CircleGeometry(0.024, 16);
      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.set(0, 0, 0.028);
      eyeGroup.add(iris);

      // Pupil
      const pupilGeo = new THREE.CircleGeometry(0.014, 16);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0, 0, 0.030);
      eyeGroup.add(pupil);

      // Specular Highlight
      const hlGeo = new THREE.CircleGeometry(0.007, 8);
      const hl = new THREE.Mesh(hlGeo, eyeHighlightMat);
      hl.position.set(xSign * 0.007, 0.007, 0.032);
      eyeGroup.add(hl);

      // Eyelid for Natural Blinking
      const lidGeo = new THREE.BoxGeometry(0.075, 0.045, 0.04);
      const lid = new THREE.Mesh(lidGeo, skinMat);
      lid.position.set(0, 0.032, 0.02);
      eyeGroup.add(lid);

      return { eyeGroup, lid };
    };

    const leftEye = createEye(true);
    const rightEye = createEye(false);
    headGroup.add(leftEye.eyeGroup);
    headGroup.add(rightEye.eyeGroup);

    // Natural 3D Eyebrows
    [-0.082, 0.082].forEach((xPos, idx) => {
      const browGeo = new THREE.BoxGeometry(0.065, 0.014, 0.02);
      const brow = new THREE.Mesh(browGeo, hairMat);
      brow.position.set(xPos, 0.085, 0.22);
      brow.rotation.z = (idx === 0 ? 0.08 : -0.08);
      headGroup.add(brow);
    });

    // Sculpted Hair
    if (gender === 'male') {
      // Modern textured quiff & layered bangs
      const hairBaseGeo = new THREE.SphereGeometry(0.255, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58);
      const hairBase = new THREE.Mesh(hairBaseGeo, hairMat);
      hairBase.position.set(0, 0.06, -0.02);
      hairBase.rotation.x = -0.12;
      headGroup.add(hairBase);

      // Volumetric quiff peaks
      [-0.08, 0, 0.08].forEach((xOff, i) => {
        const strandGeo = new THREE.ConeGeometry(0.08, 0.22, 10);
        const strand = new THREE.Mesh(strandGeo, hairMat);
        strand.position.set(xOff, 0.22, 0.10);
        strand.rotation.set(-0.6, (i - 1) * 0.25, (i - 1) * 0.2);
        headGroup.add(strand);
      });
    } else {
      // Flowing layered locks with side bangs
      const hairBaseGeo = new THREE.SphereGeometry(0.26, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.68);
      const hairBase = new THREE.Mesh(hairBaseGeo, hairMat);
      hairBase.position.set(0, 0.05, -0.02);
      headGroup.add(hairBase);

      // Flowing side locks down shoulders
      [-0.24, 0.24].forEach((xOff, i) => {
        const lockGeo = new THREE.CylinderGeometry(0.045, 0.025, 0.65, 10);
        const lock = new THREE.Mesh(lockGeo, hairMat);
        lock.position.set(xOff, -0.16, 0.06);
        lock.rotation.z = (i === 0 ? -0.12 : 0.12);
        headGroup.add(lock);
      });
    }

    // Over-Ear DJ Headphones with Luminous LED Equalizer Rings
    const bandGeo = new THREE.TorusGeometry(0.27, 0.03, 16, 32, Math.PI);
    const band = new THREE.Mesh(bandGeo, headphoneMat);
    band.rotation.x = Math.PI;
    band.rotation.z = Math.PI;
    band.position.set(0, 0.08, 0);
    headGroup.add(band);

    const createEarCup = (isLeft) => {
      const cupGroup = new THREE.Group();
      const xSign = isLeft ? -1 : 1;
      cupGroup.position.set(xSign * 0.275, 0.04, 0);

      // Cushion pad
      const cushionGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20);
      const cushion = new THREE.Mesh(cushionGeo, headphoneMat);
      cushion.rotation.z = Math.PI / 2;
      cupGroup.add(cushion);

      // Outer cup housing
      const outerGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 20);
      const outer = new THREE.Mesh(outerGeo, headphoneMat);
      outer.rotation.z = Math.PI / 2;
      outer.position.set(xSign * 0.03, 0, 0);
      cupGroup.add(outer);

      // Luminous LED Ring
      const ledRingGeo = new THREE.TorusGeometry(0.055, 0.012, 12, 24);
      const ledRing = new THREE.Mesh(ledRingGeo, goldMat);
      ledRing.rotation.y = Math.PI / 2;
      ledRing.position.set(xSign * 0.046, 0, 0);
      cupGroup.add(ledRing);

      return { cupGroup, ledRing };
    };

    const leftCup = createEarCup(true);
    const rightCup = createEarCup(false);
    headGroup.add(leftCup.cupGroup);
    headGroup.add(rightCup.cupGroup);

    // Shoulders, Arms & Hands (Articulated Kinematic Chain)
    const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.28, 16);
    const forearmGeo = new THREE.CylinderGeometry(0.05, 0.042, 0.26, 16);

    // Hand with sculpted palm & fingers
    const createHand = () => {
      const handGroup = new THREE.Group();
      
      // Palm
      const palmGeo = new THREE.BoxGeometry(0.06, 0.07, 0.035);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.position.y = -0.035;
      handGroup.add(palm);

      // Thumb
      const thumbGeo = new THREE.CylinderGeometry(0.012, 0.01, 0.04, 8);
      const thumb = new THREE.Mesh(thumbGeo, skinMat);
      thumb.position.set(-0.035, -0.02, 0.015);
      thumb.rotation.z = 0.5;
      handGroup.add(thumb);

      // 4 Fingers
      [-0.02, -0.007, 0.007, 0.02].forEach((xOff, fIdx) => {
        const fLen = [0.04, 0.048, 0.044, 0.034][fIdx];
        const fGeo = new THREE.CylinderGeometry(0.009, 0.007, fLen, 8);
        const finger = new THREE.Mesh(fGeo, skinMat);
        finger.position.set(xOff, -0.07 - fLen / 2, 0);
        handGroup.add(finger);
      });

      return handGroup;
    };

    // Left Arm Hierarchy
    const leftShoulder = new THREE.Group();
    leftShoulder.position.set(-0.31, 0.44, 0);
    spine.add(leftShoulder);

    const leftUpperArm = new THREE.Mesh(armGeo, hoodieMat);
    leftUpperArm.position.y = -0.14;
    leftShoulder.add(leftUpperArm);

    const leftElbow = new THREE.Group();
    leftElbow.position.y = -0.28;
    leftShoulder.add(leftElbow);

    const leftForearm = new THREE.Mesh(forearmGeo, hoodieMat);
    leftForearm.position.y = -0.13;
    leftElbow.add(leftForearm);

    const leftHand = createHand();
    leftHand.position.y = -0.26;
    leftElbow.add(leftHand);

    // Right Arm Hierarchy
    const rightShoulder = new THREE.Group();
    rightShoulder.position.set(0.31, 0.44, 0);
    spine.add(rightShoulder);

    const rightUpperArm = new THREE.Mesh(armGeo, hoodieMat);
    rightUpperArm.position.y = -0.14;
    rightShoulder.add(rightUpperArm);

    const rightElbow = new THREE.Group();
    rightElbow.position.y = -0.28;
    rightShoulder.add(rightElbow);

    const rightForearm = new THREE.Mesh(forearmGeo, hoodieMat);
    rightForearm.position.y = -0.13;
    rightElbow.add(rightForearm);

    const rightHand = createHand();
    rightHand.position.y = -0.26;
    rightElbow.add(rightHand);

    // Legs Hierarchy (Thighs, Knees, Shins, High-Top Designer Sneakers)
    const thighGeo = new THREE.CylinderGeometry(0.09, 0.075, 0.38, 16);
    const shinGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.38, 16);

    const createSneaker = () => {
      const sneakerGroup = new THREE.Group();

      // Sole
      const soleGeo = new THREE.BoxGeometry(0.12, 0.04, 0.24);
      const sole = new THREE.Mesh(soleGeo, sneakerWhiteMat);
      sole.position.set(0, -0.02, 0.04);
      sneakerGroup.add(sole);

      // Upper
      const upperGeo = new THREE.BoxGeometry(0.11, 0.08, 0.20);
      const upper = new THREE.Mesh(upperGeo, hoodieMat);
      upper.position.set(0, 0.04, 0.03);
      sneakerGroup.add(upper);

      // Gold loop accent on sneaker
      const accentGeo = new THREE.BoxGeometry(0.115, 0.02, 0.06);
      const accent = new THREE.Mesh(accentGeo, goldMat);
      accent.position.set(0, 0.04, 0.08);
      sneakerGroup.add(accent);

      return sneakerGroup;
    };

    // Left Leg
    const leftHip = new THREE.Group();
    leftHip.position.set(-0.13, -0.04, 0);
    pelvis.add(leftHip);

    const leftThigh = new THREE.Mesh(thighGeo, pantsMat);
    leftThigh.position.y = -0.19;
    leftHip.add(leftThigh);

    const leftKnee = new THREE.Group();
    leftKnee.position.y = -0.38;
    leftHip.add(leftKnee);

    const leftShin = new THREE.Mesh(shinGeo, pantsMat);
    leftShin.position.y = -0.19;
    leftKnee.add(leftShin);

    const leftFoot = createSneaker();
    leftFoot.position.set(0, -0.38, 0);
    leftKnee.add(leftFoot);

    // Right Leg
    const rightHip = new THREE.Group();
    rightHip.position.set(0.13, -0.04, 0);
    pelvis.add(rightHip);

    const rightThigh = new THREE.Mesh(thighGeo, pantsMat);
    rightThigh.position.y = -0.19;
    rightHip.add(rightThigh);

    const rightKnee = new THREE.Group();
    rightKnee.position.y = -0.38;
    rightHip.add(rightKnee);

    const rightShin = new THREE.Mesh(shinGeo, pantsMat);
    rightShin.position.y = -0.19;
    rightKnee.add(rightShin);

    const rightFoot = createSneaker();
    rightFoot.position.set(0, -0.38, 0);
    rightKnee.add(rightFoot);

    // 5. Kinematic Animation Loop with Transitions
    let reqId;
    let clock = new THREE.Clock();
    let idleTimer = 0;
    let isPlayful = false;
    let playfulTimer = 0;

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();
      const state = stateRef.current;

      // Natural Blinking Cycle (blinks every ~3.5s for 0.15s)
      const blinkCycle = t % 3.6;
      const isBlinking = blinkCycle > 3.45;
      const lidY = isBlinking ? 0.005 : 0.035;
      leftEye.lid.position.y = THREE.MathUtils.lerp(leftEye.lid.position.y, lidY, 0.4);
      rightEye.lid.position.y = THREE.MathUtils.lerp(rightEye.lid.position.y, lidY, 0.4);

      // Facing orientation smoothly interpolates
      const targetFacingY = state.facing === 'right' ? 0.25 : -0.25;
      characterRoot.rotation.y = THREE.MathUtils.lerp(characterRoot.rotation.y, targetFacingY, 0.1);

      // Headphone LED reactive glow
      const baseGlow = state.isListening ? 1.4 : state.isSpeaking ? 1.2 : 0.5;
      const pulseGlow = baseGlow + (state.voiceVolumeScale || 0) * 0.8 + Math.sin(t * 4) * 0.15;
      goldMat.emissiveIntensity = pulseGlow;

      // Handle Periodic Playful Trigger (every ~11s of idle)
      if (state.animationState === 'idle' && !state.isSpeaking && !state.isListening) {
        idleTimer += dt;
        if (idleTimer > 10.5 && !isPlayful) {
          isPlayful = true;
          playfulTimer = 0;
        }
      } else {
        idleTimer = 0;
        isPlayful = false;
      }

      if (isPlayful) {
        playfulTimer += dt;
        if (playfulTimer > 2.4) {
          isPlayful = false;
          idleTimer = 0;
        }
      }

      // ==========================================
      // STATE-SPECIFIC SKELETAL POSING & KINEMATICS
      // ==========================================
      if (state.animationState === 'walking') {
        // Humanoid Bipedal Walk Cycle
        const phi = t * 6.5;
        const stride = Math.sin(phi);

        // Pelvis & Spine Bobbing
        pelvis.position.y = -0.05 + Math.abs(Math.sin(phi * 2)) * 0.04;
        spine.rotation.x = 0.06;
        spine.rotation.y = stride * 0.06;

        // Legs
        leftHip.rotation.x = stride * 0.55;
        leftKnee.rotation.x = Math.max(0, -stride * 0.65);
        rightHip.rotation.x = -stride * 0.55;
        rightKnee.rotation.x = Math.max(0, stride * 0.65);

        // Opposite Arms
        leftShoulder.rotation.x = -stride * 0.45;
        leftShoulder.rotation.z = -0.15;
        leftElbow.rotation.x = -0.25;

        rightShoulder.rotation.x = stride * 0.45;
        rightShoulder.rotation.z = 0.15;
        rightElbow.rotation.x = -0.25;

        // Head looks forward
        headGroup.rotation.x = 0;
        headGroup.rotation.y = -targetFacingY * 0.5;
        mouth.scale.set(1, 0.3, 1);

      } else if (state.animationState === 'running') {
        // Athletic Sprint Cycle
        const phi = t * 11.0;
        const stride = Math.sin(phi);

        // Forward Torso Lean
        pelvis.position.y = -0.05 + Math.abs(Math.sin(phi * 2)) * 0.08;
        spine.rotation.x = 0.22;
        spine.rotation.y = stride * 0.10;

        // High Knee Drive & Deep Stride
        leftHip.rotation.x = stride * 0.85;
        leftKnee.rotation.x = Math.max(0, -stride * 1.1);
        rightHip.rotation.x = -stride * 0.85;
        rightKnee.rotation.x = Math.max(0, stride * 1.1);

        // Pumping Arms
        leftShoulder.rotation.x = -stride * 0.9;
        leftShoulder.rotation.z = -0.2;
        leftElbow.rotation.x = -0.7;

        rightShoulder.rotation.x = stride * 0.9;
        rightShoulder.rotation.z = 0.2;
        rightElbow.rotation.x = -0.7;

        headGroup.rotation.x = -0.12;
        headGroup.rotation.y = 0;
        mouth.scale.set(1, 0.3, 1);

      } else if (state.animationState === 'tapping') {
        // Reaching Forward with Index Finger to Tap Element
        spine.rotation.x = 0.12;
        spine.rotation.y = -0.1;

        rightShoulder.rotation.x = -0.85; // Raise arm forward
        rightShoulder.rotation.y = -0.2;
        rightShoulder.rotation.z = 0.25;
        rightElbow.rotation.x = -0.15; // Straighten elbow

        leftShoulder.rotation.x = 0.1;
        leftShoulder.rotation.z = -0.18;
        leftElbow.rotation.x = -0.3;

        leftHip.rotation.x = -0.12;
        rightHip.rotation.x = 0.12;
        headGroup.rotation.set(-0.05, -0.15, 0);

      } else if (state.animationState === 'celebrating') {
        // Double Thumbs-Up Cheering Jump
        const hop = Math.abs(Math.sin(t * 8)) * 0.08;
        pelvis.position.y = -0.05 + hop;
        spine.rotation.x = -0.08;

        leftShoulder.rotation.x = -1.2;
        leftShoulder.rotation.z = -0.6;
        leftElbow.rotation.x = -0.9;

        rightShoulder.rotation.x = -1.2;
        rightShoulder.rotation.z = 0.6;
        rightElbow.rotation.x = -0.9;

        headGroup.rotation.set(-0.2 + Math.sin(t * 6) * 0.08, 0, 0);
        mouth.scale.set(1.4, 0.9, 1);

      } else if (isPlayful) {
        // Cute Playful Bounce / Mini Dance
        const pPhase = playfulTimer * 7.0;
        pelvis.position.y = -0.05 + Math.abs(Math.sin(pPhase)) * 0.06;
        spine.rotation.z = Math.sin(pPhase) * 0.12;
        headGroup.rotation.z = -Math.sin(pPhase) * 0.15;
        headGroup.rotation.y = Math.cos(pPhase * 0.5) * 0.2;

        leftShoulder.rotation.x = -0.5 + Math.sin(pPhase) * 0.3;
        leftShoulder.rotation.z = -0.4;
        rightShoulder.rotation.x = -0.5 - Math.sin(pPhase) * 0.3;
        rightShoulder.rotation.z = 0.4;

        leftHip.rotation.x = Math.sin(pPhase) * 0.25;
        rightHip.rotation.x = -Math.sin(pPhase) * 0.25;

      } else if (state.animationState === 'speaking' || state.isSpeaking) {
        // Conversational Speaking with Dynamic Mouth Articulation
        const speakPulse = Math.abs(Math.sin(t * 14)) * 0.8 + 0.2;
        mouth.scale.set(1.2, speakPulse, 1);

        // Gentle head nodding & arm gestures
        headGroup.rotation.x = Math.sin(t * 4.5) * 0.08 - 0.04;
        headGroup.rotation.y = Math.cos(t * 2.2) * 0.12;

        rightShoulder.rotation.x = -0.35 + Math.sin(t * 3.5) * 0.18;
        rightShoulder.rotation.z = 0.22;
        rightElbow.rotation.x = -0.55;

        leftShoulder.rotation.x = -0.1;
        leftShoulder.rotation.z = -0.15;
        leftElbow.rotation.x = -0.25;

        // Reset lower body to stable standing
        pelvis.position.y = -0.05 + Math.sin(t * 2.0) * 0.015;
        spine.rotation.x = 0;
        leftHip.rotation.x = 0;
        rightHip.rotation.x = 0;

      } else if (state.animationState === 'listening' || state.isListening) {
        // Attentive Listening Pose
        headGroup.rotation.x = 0.08;
        headGroup.rotation.z = -0.14; // Attentive head tilt
        headGroup.rotation.y = targetFacingY * 0.4;

        spine.rotation.x = 0.04;
        mouth.scale.set(1, 0.25, 1);

        leftShoulder.rotation.set(0.05, 0, -0.12);
        rightShoulder.rotation.set(0.05, 0, 0.12);
        leftElbow.rotation.x = -0.15;
        rightElbow.rotation.x = -0.15;

        pelvis.position.y = -0.05 + Math.sin(t * 1.5) * 0.01;

      } else {
        // Natural Human Standing Idle (breathing, subtle weight shift, scanning glances)
        const breath = Math.sin(t * 2.2);
        torso.scale.set(1 + breath * 0.02, 1 + breath * 0.015, 1 + breath * 0.025);
        pelvis.position.y = -0.05 + breath * 0.008;

        // Subtle postural weight shift
        const sway = Math.sin(t * 0.8) * 0.025;
        pelvis.rotation.z = sway;
        spine.rotation.z = -sway * 0.5;

        // Gentle head scan
        headGroup.rotation.x = breath * 0.02;
        headGroup.rotation.y = Math.sin(t * 0.5) * 0.09;
        headGroup.rotation.z = sway * 0.3;
        mouth.scale.set(1, 0.25, 1);

        // Relaxed resting arms
        leftShoulder.rotation.set(0.04, 0, -0.14 + breath * 0.02);
        leftElbow.rotation.x = -0.18;
        rightShoulder.rotation.set(0.04, 0, 0.14 - breath * 0.02);
        rightElbow.rotation.x = -0.18;

        leftHip.rotation.x = 0;
        leftKnee.rotation.x = 0;
        rightHip.rotation.x = 0;
        rightKnee.rotation.x = 0;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(reqId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [gender, width, height]);

  return <div ref={mountRef} className="relative flex items-center justify-center select-none" />;
}
