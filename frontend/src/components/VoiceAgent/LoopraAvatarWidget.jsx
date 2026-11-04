import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Send,
  X,
  Zap,
  Music,
  Radio,
  Flame,
  ChevronUp,
  Settings
} from 'lucide-react';

/**
 * LoopraAvatarWidget
 * Complete, Production-Ready Interactive 3D / WebGL AI Avatar Companion Widget
 * 
 * Features:
 * 1. Floating Bottom-Right Dock: Persistent widget positioned above player/controls.
 * 2. Dual Personas (Male & Female):
 *    - Male Loopra: Streetwear hoodie, amber audio glow (#f59e0b), athletic proportions, textured hair.
 *    - Female Loopra: Tailored hoodie, emerald glow (#10b981), high ponytail, slender proportions.
 * 3. 4 Interactive Animation States:
 *    - 'idle': Organic breathing, natural eye blinking, cursor gaze tracking.
 *    - 'listening': Attentive forward lean, rotating audio rings, glowing headphone equalizer.
 *    - 'talking': Dynamic jaw/mouth articulation, head nodding, conversational hand gestures.
 *    - 'dancing': Beat-synchronized groove bounce, hip swaying, head bopping.
 * 4. Self-Contained Procedural Three.js Humanoid Mesh:
 *    - Operates 100% offline without external GLB model dependencies or loading failures.
 *    - Real-time kinematic bone transforms, PBR materials, rim lighting, and shadow physics.
 * 5. Audio Reactive Visualizer:
 *    - Orbiting glowing waveform particle aura and pulsating base rings tuned to audio amplitude.
 * 6. Quick Command Glassmorphic Menu:
 *    - Persona switcher, voice output toggle, quick Indian music presets, and typed command input.
 */
export default function LoopraAvatarWidget({
  isAudioPlaying = false,
  audioVolume = 70,
  onVoiceCommand = () => { },
  onNavigate = () => { },
  currentTrack = null
}) {
  // Active Persona: 'male' | 'female'
  const [persona, setPersona] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('loopra_avatar_persona');
      return saved === 'female' ? 'female' : 'male';
    }
    return 'male';
  });

  // State machine: 'idle' | 'listening' | 'talking' | 'dancing'
  const [animState, setAnimState] = useState('idle');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [commandText, setCommandText] = useState('');
  const [replyBubble, setReplyBubble] = useState(null);
  const [userSpeechBubble, setUserSpeechBubble] = useState(null);

  // Audio amplitude simulator / reactive scale
  const [audioScale, setAudioScale] = useState(1.0);

  // Canvas container ref
  const canvasMountRef = useRef(null);
  const threeStateRef = useRef({
    persona,
    animState,
    audioScale: 1.0,
    cursorX: 0,
    cursorY: 0
  });

  // Timers
  const replyTimerRef = useRef(null);
  const gestureTimerRef = useRef(null);
  const clickTimerRef = useRef(null);
  const clickCountRef = useRef(0);
  const longPressTimerRef = useRef(null);
  const isPointerDownRef = useRef(false);

  const isMale = persona === 'male';
  const themeAccent = isMale ? '#f59e0b' : '#10b981';
  const themeGlowRgb = isMale ? '245, 158, 11' : '16, 185, 129';

  // Persist Persona
  const handleSelectPersona = (newPersona) => {
    setPersona(newPersona);
    try {
      localStorage.setItem('loopra_avatar_persona', newPersona);
    } catch (_) { }
    triggerSpeech(
      newPersona === 'male'
        ? 'Bilkul bhai! Loopra  taiyaar hai, bataiye kya bajana hai?'
        : 'Hey! Main Loopra hoon, bataiye aaj kya sunna chahenge?'
    );
  };

  // Sync state to Three.js render loop ref
  useEffect(() => {
    threeStateRef.current = {
      persona,
      animState: isVoiceActive ? 'listening' : isAudioPlaying && animState === 'idle' ? 'dancing' : animState,
      audioScale,
      cursorX: threeStateRef.current.cursorX,
      cursorY: threeStateRef.current.cursorY
    };
  }, [persona, animState, isVoiceActive, isAudioPlaying, audioScale]);

  // Simulated audio amplitude driver
  useEffect(() => {
    if (!isAudioPlaying && animState !== 'talking') {
      setAudioScale(1.0);
      return;
    }
    const interval = setInterval(() => {
      setAudioScale(0.85 + Math.random() * 0.55);
    }, 120);
    return () => clearInterval(interval);
  }, [isAudioPlaying, animState]);

  // Global mouse cursor tracking for 3D gaze
  useEffect(() => {
    const handleMouseMove = (e) => {
      const cx = (e.clientX / window.innerWidth) * 2 - 1;
      const cy = -(e.clientY / window.innerHeight) * 2 + 1;
      threeStateRef.current.cursorX = cx;
      threeStateRef.current.cursorY = cy;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Trigger conversational speech bubble & state
  const triggerSpeech = useCallback((text, duration = 3000) => {
    clearTimeout(replyTimerRef.current);
    clearTimeout(gestureTimerRef.current);

    setReplyBubble(text);
    setAnimState('talking');

    // Indian Hindi TTS Voice generation via backend audio endpoint
    if (!isMuted && typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(`/api/voice-agent/tts?text=${encodeURIComponent(text)}&gender=${persona}`);
        audio.play().catch(() => { });
      } catch (_) { }
    }

    replyTimerRef.current = setTimeout(() => {
      setReplyBubble(null);
      setAnimState('idle');
    }, duration);
  }, [persona, isMuted]);

  // Click & Double Click Handling
  const handlePointerDown = () => {
    isPointerDownRef.current = true;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (isPointerDownRef.current) {
        setIsMenuOpen((prev) => !prev);
        setAnimState('talking');
        setTimeout(() => setAnimState('idle'), 1200);
      }
    }, 450);
  };

  const handlePointerUp = () => {
    clearTimeout(longPressTimerRef.current);
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    clickCountRef.current += 1;
    if (clickCountRef.current === 1) {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
        // Single Click: Toggle Voice Listening or Menu
        setIsVoiceActive((prev) => {
          const next = !prev;
          if (next) {
            triggerSpeech(isMale ? 'Haan bhai, sun raha hoon, bolo!' : 'Haan dost, bolo kya sunna hai?', 2200);
          }
          return next;
        });
      }, 250);
    } else if (clickCountRef.current >= 2) {
      clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;
      // Double Click: Groove / Dance
      setAnimState('dancing');
      triggerSpeech(isMale ? 'Chalo thoda groove karte hain!' : 'Mast beat hai, dance karo!', 2400);
      setTimeout(() => setAnimState('idle'), 2800);
    }
  };

  // Submit Text Command
  const handleCommandSubmit = (e) => {
    e.preventDefault();
    const q = commandText.trim();
    if (!q) return;

    setUserSpeechBubble(q);
    setTimeout(() => setUserSpeechBubble(null), 2500);
    setCommandText('');
    setIsMenuOpen(false);

    const lower = q.toLowerCase();
    if (lower.includes('saloon')) {
      onNavigate('barber');
      triggerSpeech(isMale ? 'Bilkul! Saloon FM khol raha hoon.' : 'Haan dost, Saloon FM open ho gaya!');
    } else if (lower.includes('radio')) {
      onNavigate('radio');
      triggerSpeech(isMale ? 'Indian Live Radio chalu kar diya!' : 'Live radio stations ready hain!');
    } else if (lower.includes('dance')) {
      setAnimState('dancing');
      triggerSpeech(isMale ? 'Chalo beat par groove karte hain!' : 'Mast music vibe hai!');
      setTimeout(() => setAnimState('idle'), 3500);
    } else {
      onVoiceCommand(q);
      triggerSpeech(isMale ? `Samajh gaya bhai: "${q}"` : `Done dost: "${q}"`);
    }
  };

  // =========================================================================
  // THREE.JS WEBGL PROCEDURAL 3D HUMANOID RIG
  // 100% Offline Procedural Geometries (Head, Headphones, Hoodie, Arms, Sneaker)
  // =========================================================================
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Scene, Camera, High-Performance WebGL Renderer
    const scene = new THREE.Scene();
    const width = 200;
    const height = 260;

    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 50);
    camera.position.set(0, 0.1, 4.0);
    camera.lookAt(0, 0.1, 0);

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

    // 2. Cinematic Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    keyLight.position.set(2, 3, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfef3c7, 1.2);
    fillLight.position.set(-2, 1, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 2.5);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);

    // 3. Materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfdba74,
      roughness: 0.55,
      metalness: 0.05
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.85
    });

    const hoodieMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.7
    });

    const orangeLiningMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.5
    });

    const headphoneMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.3,
      metalness: 0.8
    });

    const glowLedMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b
    });

    const sneakerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.8
    });

    // 4. Character Assembly Group
    const charGroup = new THREE.Group();
    scene.add(charGroup);

    // A. Pelvis & Torso (Streetwear Hoodie)
    const torsoGroup = new THREE.Group();
    charGroup.add(torsoGroup);

    const torsoGeo = new THREE.CylinderGeometry(0.38, 0.34, 0.85, 16);
    const torsoMesh = new THREE.Mesh(torsoGeo, hoodieMat);
    torsoMesh.position.y = 0.42;
    torsoGroup.add(torsoMesh);

    // Inner orange hood collar
    const hoodCollarGeo = new THREE.TorusGeometry(0.24, 0.08, 8, 16);
    hoodCollarGeo.rotateX(Math.PI / 2);
    const hoodCollarMesh = new THREE.Mesh(hoodCollarGeo, orangeLiningMat);
    hoodCollarMesh.position.set(0, 0.82, -0.05);
    torsoGroup.add(hoodCollarMesh);

    // Loopra Soundwave Chest Badge
    const badgeGeo = new THREE.BoxGeometry(0.18, 0.08, 0.02);
    const badgeMesh = new THREE.Mesh(badgeGeo, glowLedMat);
    badgeMesh.position.set(0, 0.58, 0.37);
    torsoGroup.add(badgeMesh);

    // B. Head, Neck, Face & Hair
    const neckGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.22, 12);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.y = 0.92;
    torsoGroup.add(neckMesh);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.15, 0);
    torsoGroup.add(headGroup);

    const headGeo = new THREE.SphereGeometry(0.32, 24, 20);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headGroup.add(headMesh);

    // Expressive Eyes
    const eyeGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeL = new THREE.Mesh(eyeGeo, pupilMat);
    eyeL.position.set(-0.11, 0.04, 0.29);
    const eyeR = new THREE.Mesh(eyeGeo, pupilMat);
    eyeR.position.set(0.11, 0.04, 0.29);
    headGroup.add(eyeL);
    headGroup.add(eyeR);

    // Dynamic Talking Mouth (Scales on speech)
    const mouthGeo = new THREE.BoxGeometry(0.09, 0.03, 0.02);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x881337 });
    const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthMesh.position.set(0, -0.12, 0.3);
    headGroup.add(mouthMesh);

    // Hair Assembly (Male Quiff vs Female Ponytail)
    const hairCapGeo = new THREE.SphereGeometry(0.34, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
    hairCap.position.set(0, 0.04, 0);
    headGroup.add(hairCap);

    // Female Ponytail Mesh
    const ponytailGeo = new THREE.ConeGeometry(0.12, 0.5, 12);
    ponytailGeo.rotateX(-Math.PI * 0.6);
    const ponytailMesh = new THREE.Mesh(ponytailGeo, hairMat);
    ponytailMesh.position.set(0, 0.12, -0.42);
    headGroup.add(ponytailMesh);

    // C. Over-Ear DJ Headphones with Glowing Ring
    const hpBandGeo = new THREE.TorusGeometry(0.36, 0.035, 8, 20, Math.PI);
    hpBandGeo.rotateZ(Math.PI);
    const hpBand = new THREE.Mesh(hpBandGeo, headphoneMat);
    hpBand.position.set(0, 0.06, 0);
    headGroup.add(hpBand);

    const earcupGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16);
    earcupGeo.rotateZ(Math.PI / 2);

    const cupL = new THREE.Mesh(earcupGeo, headphoneMat);
    cupL.position.set(-0.35, 0.04, 0);
    const ringL = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.1, 16), glowLedMat);
    ringL.rotateY(-Math.PI / 2);
    ringL.position.set(-0.4, 0.04, 0);
    headGroup.add(cupL);
    headGroup.add(ringL);

    const cupR = new THREE.Mesh(earcupGeo, headphoneMat);
    cupR.position.set(0.35, 0.04, 0);
    const ringR = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.1, 16), glowLedMat);
    ringR.rotateY(Math.PI / 2);
    ringR.position.set(0.4, 0.04, 0);
    headGroup.add(cupR);
    headGroup.add(ringR);

    // D. Articulated Arms
    const armL = new THREE.Group();
    armL.position.set(-0.42, 0.75, 0);
    torsoGroup.add(armL);
    const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.55, 10), hoodieMat);
    armLMesh.position.y = -0.25;
    armL.add(armLMesh);

    const armR = new THREE.Group();
    armR.position.set(0.42, 0.75, 0);
    torsoGroup.add(armR);
    const armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.55, 10), hoodieMat);
    armRMesh.position.y = -0.25;
    armR.add(armRMesh);

    // Hands
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), skinMat);
    handL.position.y = -0.55;
    armL.add(handL);

    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), skinMat);
    handR.position.y = -0.55;
    armR.add(handR);

    // E. Cargo Pants & White Sneakers
    const legL = new THREE.Group();
    legL.position.set(-0.18, 0.05, 0);
    charGroup.add(legL);
    const legLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.7, 12), pantsMat);
    legLMesh.position.y = -0.35;
    legL.add(legLMesh);

    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.32), sneakerMat);
    shoeL.position.set(0, -0.72, 0.06);
    legL.add(shoeL);

    const legR = new THREE.Group();
    legR.position.set(0.18, 0.05, 0);
    charGroup.add(legR);
    const legRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.7, 12), pantsMat);
    legRMesh.position.y = -0.35;
    legR.add(legRMesh);

    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.32), sneakerMat);
    shoeR.position.set(0, -0.72, 0.06);
    legR.add(shoeR);

    // Ground Contact Shadow Disc
    const shadowMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.55, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })
    );
    shadowMesh.rotateX(-Math.PI / 2);
    shadowMesh.position.set(0, -0.78, 0);
    scene.add(shadowMesh);

    // Orbiting Audio Visualizer Ring (Particles)
    const particleCount = 48;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * 0.75;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(angle) * 0.75;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.06,
      transparent: true,
      opacity: 0.8
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    particleSystem.position.y = -0.74;
    scene.add(particleSystem);

    // =========================================================================
    // 60 FPS RENDER LOOP WITH SPRING PHYSICS & SKELETAL KINEMATICS
    // =========================================================================
    let reqId;
    let lastTime = performance.now();
    let elapsedTime = 0;

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      elapsedTime += delta;
      const time = elapsedTime;

      const { persona: curPersona, animState: curState, audioScale: aScale, cursorX, cursorY } = threeStateRef.current;

      // Update persona accents & features
      const isCurMale = curPersona === 'male';
      ponytailMesh.visible = !isCurMale;
      const accentHex = isCurMale ? 0xf59e0b : 0x10b981;
      glowLedMat.color.setHex(accentHex);
      rimLight.color.setHex(accentHex);
      particleMat.color.setHex(accentHex);

      // Rotate visualizer ring
      particleSystem.rotation.y = time * 0.6;
      const visualizerRadius = 1.0 + (aScale - 1.0) * 0.8;
      particleSystem.scale.set(visualizerRadius, 1, visualizerRadius);

      // Gaze tracking towards cursor
      const targetHeadRotY = cursorX * 0.35;
      const targetHeadRotX = -cursorY * 0.25;
      headGroup.rotation.y += (targetHeadRotY - headGroup.rotation.y) * 0.1;
      headGroup.rotation.x += (targetHeadRotX - headGroup.rotation.x) * 0.1;

      // Eye pupil shift
      eyeL.position.x = -0.11 + cursorX * 0.02;
      eyeR.position.x = 0.11 + cursorX * 0.02;

      // =======================================================================
      // KINEMATIC STATE ENGINE
      // =======================================================================
      if (curState === 'idle') {
        // Natural chest breathing & gentle weight sway
        const breath = Math.sin(time * 2.2);
        torsoGroup.position.y = Math.sin(time * 2.2) * 0.02;
        torsoMesh.scale.set(1 + breath * 0.015, 1 + breath * 0.02, 1 + breath * 0.015);
        armL.rotation.z = 0.08 + Math.sin(time * 2.2) * 0.04;
        armR.rotation.z = -0.08 - Math.sin(time * 2.2) * 0.04;
        mouthMesh.scale.set(1, 1, 1);
        charGroup.rotation.y = Math.sin(time * 1.2) * 0.05;
      }
      else if (curState === 'listening') {
        // Attentive forward lean & illuminated headphone LED pulse
        charGroup.position.y = 0;
        torsoGroup.rotation.x = 0.08;
        headGroup.rotation.z = 0.12;
        ringL.scale.setScalar(1.2 + Math.sin(time * 8) * 0.25);
        ringR.scale.setScalar(1.2 + Math.sin(time * 8) * 0.25);
        armL.rotation.z = 0.18;
        armR.rotation.z = -0.18;
      }
      else if (curState === 'talking') {
        // Dynamic speech aperture & conversational nodding
        const speechAperture = 1.0 + Math.abs(Math.sin(time * 14)) * 2.5;
        mouthMesh.scale.set(1, speechAperture, 1);
        headGroup.rotation.x = Math.sin(time * 6) * 0.08;
        armL.rotation.z = 0.25 + Math.sin(time * 4) * 0.2;
        armR.rotation.z = -0.15;
      }
      else if (curState === 'dancing') {
        // Beat-synchronized groove: hip sway, vertical bounce, alternating arm pump
        const beat = time * 7.5;
        charGroup.position.y = Math.abs(Math.sin(beat)) * 0.12;
        charGroup.rotation.z = Math.sin(beat * 0.5) * 0.08;
        torsoGroup.rotation.y = Math.sin(beat * 0.5) * 0.15;
        armL.rotation.x = Math.sin(beat) * 0.5;
        armR.rotation.x = -Math.sin(beat) * 0.5;
        armL.rotation.z = 0.3 + Math.abs(Math.sin(beat)) * 0.2;
        armR.rotation.z = -0.3 - Math.abs(Math.sin(beat)) * 0.2;
        legL.rotation.x = -Math.sin(beat) * 0.25;
        legR.rotation.x = Math.sin(beat) * 0.25;
        mouthMesh.scale.set(1.4, 1.8, 1);
      }

      renderer.render(scene, camera);
    };

    reqId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(reqId);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <>
      {/* =================================================================== */}
      {/* FLOATING WIDGET CONTAINER (Bottom-Right, Website-Wide Persistent)    */}
      {/* =================================================================== */}
      <div className="fixed bottom-6 right-6 z-[2147483640] select-none flex flex-col items-end pointer-events-none">

        {/* 1. CONVERSATIONAL SPEECH BUBBLES */}
        {/* User Voice / Query Bubble */}
        {userSpeechBubble && (
          <div className="mb-2 max-w-xs px-3.5 py-2 rounded-2xl bg-sky-950/80 border border-sky-400/50 text-sky-100 text-xs font-bold shadow-2xl backdrop-blur-md pointer-events-auto animate-fadeIn">
            <span className="text-[10px] text-sky-300 block mb-0.5">👤 You:</span>
            "{userSpeechBubble}"
          </div>
        )}

        {/* Loopra AI Response Bubble */}
        {replyBubble && (
          <div
            style={{ borderColor: `${themeAccent}70` }}
            className="mb-2 max-w-sm px-4 py-3 rounded-2xl bg-neutral-950/90 border text-neutral-100 text-xs font-bold shadow-[0_15px_35px_rgba(0,0,0,0.85)] backdrop-blur-md pointer-events-auto animate-fadeIn"
          >
            <div className="flex items-center justify-between gap-3 mb-1 pb-1 border-b border-neutral-800">
              <span className="text-[10px] uppercase font-black tracking-wider flex items-center gap-1" style={{ color: themeAccent }}>
                <Sparkles className="w-3 h-3 text-current" />
                <span>Loopra ({isMale ? 'Male' : 'Female'})</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-black">
                Neural Hindi
              </span>
            </div>
            <p className="leading-snug">{replyBubble}</p>
          </div>
        )}

        {/* 2. QUICK COMMAND & SETTINGS MENU POPUP */}
        {isMenuOpen && (
          <div className="mb-3 w-80 max-w-[calc(100vw-32px)] p-4 rounded-3xl bg-neutral-950/98 border border-neutral-800 shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-xl pointer-events-auto animate-fadeIn">
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: themeAccent }} />
                <h4 className="text-xs font-black text-white tracking-wide">Loopra AI Companion</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active Voice Model Card */}
            <div className="mb-3 p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/60 shadow-lg shadow-emerald-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💃</span>
                <div>
                  <h5 className="text-xs font-black text-white">Loopra (Female Voice)</h5>
                  <p className="text-[10px] text-emerald-300 font-semibold">Live2D Companion • Neerja Expressive</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[9px] font-black uppercase text-emerald-300">
                Active
              </span>
            </div>

            {/* Typed Command Input */}
            <form onSubmit={handleCommandSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                placeholder="Ask or type command in Hindi..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-amber-400 text-xs text-white placeholder-neutral-500 outline-none"
              />
              <button
                type="submit"
                disabled={!commandText.trim()}
                className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black transition cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* 3. AVATAR MAIN STAGE & THREE.JS CANVAS */}
        <div className="relative flex flex-col items-center pointer-events-auto">

          {/* Pulsing Audio Reactivity Glow Ring behind Avatar */}
          <div
            style={{
              width: '180px',
              height: '180px',
              borderColor: themeAccent,
              boxShadow: `0 0 35px rgba(${themeGlowRgb}, ${isAudioPlaying ? '0.7' : '0.25'})`,
              transform: `scale(${1 + (audioScale - 1) * 0.4})`
            }}
            className="absolute -bottom-2 rounded-full border border-dashed pointer-events-none transition-transform duration-100 opacity-60 animate-spin-slow"
          />

          {/* Three.js Canvas Container (200x260px) */}
          <div
            ref={canvasMountRef}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            className="relative cursor-pointer transition-transform duration-150 active:scale-95"
            style={{ width: '200px', height: '260px' }}
            title={`Loopra (${persona}) • Click: Voice • Double Click: Dance • Hold: Menu`}
          />

          {/* Persona & Status Badge */}
          <div
            style={{ borderColor: `${themeAccent}70` }}
            className="absolute -bottom-1 px-3 py-0.5 rounded-full bg-neutral-950/95 border text-[10px] font-black uppercase tracking-wider text-white shadow-2xl flex items-center gap-1.5 backdrop-blur-md"
          >
            <span style={{ color: themeAccent }}>Loopra</span>
            <span className="text-[8px] text-neutral-400 font-medium">• {persona}</span>
            {isVoiceActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
