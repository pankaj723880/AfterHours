import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Mathematical 3D Infinity (Lemniscate / Figure-8) Space Curve
 * Generates a true, non-self-intersecting 3D loop in space where
 * one branch curves in front (+Z) and the opposing branch curves behind (-Z).
 */
class InfinityCurve3D extends THREE.Curve {
  constructor(scaleX = 2.2, scaleY = 1.1, heightZ = 0.7) {
    super();
    this.scaleX = scaleX;
    this.scaleY = scaleY;
    this.heightZ = heightZ;
  }

  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const u = t * 2 * Math.PI;
    // Lissajous 3D figure-8 parametric path with true depth separation
    const x = this.scaleX * Math.cos(u);
    const y = this.scaleY * Math.sin(2 * u) * 0.5;
    const z = this.heightZ * Math.sin(u);
    return optionalTarget.set(x, y, z);
  }
}

/**
 * Checks for reliable WebGL support
 */
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

export default function AppSplashScreen({
  isAppReady = true,
  onFinished,
  branding
}) {
  const [shouldRender, setShouldRender] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isInfinityVisible, setIsInfinityVisible] = useState(false);
  const [isLogoVisible, setIsLogoVisible] = useState(false);
  const [isTaglineVisible, setIsTaglineVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);

  const mountRef = useRef(null);
  const animationFrameRef = useRef(null);
  const rendererRef = useRef(null);

  const logoUrl = branding?.logoUrl || '/loopra-logo.png';

  // Check reduced motion & WebGL capabilities once on mount
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const motionHandler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', motionHandler);

    setHasWebGL(isWebGLAvailable());

    return () => {
      mediaQuery.removeEventListener('change', motionHandler);
    };
  }, []);

  // Coordinated Brand Emergence Animation Sequence:
  // 1. Dark background appears immediately (0ms)
  // 2. 3D Infinity Loop gently materializes with soft golden glow (120ms)
  // 3. Loopra logo fades in smoothly over the center of the loop (380ms)
  // 4. 3D Tagline "INFINITE SOUND. ENDLESS VIBES." fades in with depth at bottom (680ms)
  useEffect(() => {
    const t1 = setTimeout(() => setIsInfinityVisible(true), 120);
    const t2 = setTimeout(() => setIsLogoVisible(true), 380);
    const t3 = setTimeout(() => setIsTaglineVisible(true), 680);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Coordinated exit transition once app signals ready with smooth minimum duration
  useEffect(() => {
    if (!isAppReady) return;

    // Provide an elegant minimum presentation so users experience the premium sequence
    const presentationTimer = setTimeout(() => {
      setIsFadingOut(true);

      const finishTimer = setTimeout(() => {
        setShouldRender(false);
        if (typeof onFinished === 'function') {
          onFinished();
        }
      }, 550);

      return () => clearTimeout(finishTimer);
    }, 2200);

    return () => clearTimeout(presentationTimer);
  }, [isAppReady, onFinished]);

  // Three.js 3D Infinity Loop Setup and Render Loop
  useEffect(() => {
    if (!shouldRender || prefersReducedMotion || !hasWebGL || !mountRef.current) {
      return;
    }

    const container = mountRef.current;
    const width = container.clientWidth || Math.min(window.innerWidth - 32, 360);
    const height = container.clientHeight || 240;

    // Scene & Perspective Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.6);

    // High-performance WebGL Renderer with Alpha Transparency
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);
    } catch (e) {
      setHasWebGL(false);
      return;
    }

    // 3D Infinity Tube Geometry along Lissajous Space Curve
    const curve = new InfinityCurve3D(2.2, 1.15, 0.72);
    const tubeGeometry = new THREE.TubeGeometry(curve, 160, 0.16, 24, true);

    // Metallic Gold, Amber, and Vibrant Orange Material with Rich Sheen
    const goldMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf59e0b), // Vibrant metallic gold
      emissive: new THREE.Color(0xd97706), // Warm amber-orange glow
      emissiveIntensity: 0.38,
      metalness: 0.94,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 0.98,
      transparent: true,
      opacity: 0.96
    });

    const infinityMesh = new THREE.Mesh(tubeGeometry, goldMaterial);
    infinityMesh.scale.set(0.72, 0.72, 0.72);
    scene.add(infinityMesh);

    // Dynamic Orbital Core Ring (Subtle secondary light halo)
    const haloGeometry = new THREE.TorusGeometry(0.85, 0.02, 16, 100);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.25
    });
    const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
    scene.add(haloMesh);

    // Sophisticated Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffedd5, 1.4);
    scene.add(ambientLight);

    // Key Light (Intense gold sheen from upper right)
    const keyLight = new THREE.DirectionalLight(0xfef08a, 3.2);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    // Accent Orange Rim Light (Glowing amber-orange from bottom left)
    const rimLight = new THREE.DirectionalLight(0xf97316, 2.6);
    rimLight.position.set(-4, -4, -3);
    scene.add(rimLight);

    // Center Core Amber Light (Creates soft luminous bloom behind the logo)
    const centerGlowLight = new THREE.PointLight(0xf59e0b, 2.5, 8);
    centerGlowLight.position.set(0, 0, 0.8);
    scene.add(centerGlowLight);

    // Animation Loop
    let startTime = performance.now();
    let isDisposed = false;

    const animate = (time) => {
      if (isDisposed) return;

      const elapsed = (time - startTime) * 0.001;

      // Continuous 3D figure-8 precession and rotation
      infinityMesh.rotation.y = elapsed * 0.82;
      infinityMesh.rotation.x = Math.sin(elapsed * 0.75) * 0.18 + 0.12;
      infinityMesh.rotation.z = Math.cos(elapsed * 0.5) * 0.1;

      haloMesh.rotation.x = Math.PI / 2 + Math.sin(elapsed * 0.6) * 0.15;
      haloMesh.rotation.y = -elapsed * 0.4;

      // Smooth emergence scale ramp from 0.72 to 1.0
      const emergeProgress = Math.min(1.0, Math.max(0, (elapsed - 0.2) / 0.8));
      const easeOut = 1 - Math.pow(1 - emergeProgress, 3);
      const currentScale = 0.72 + 0.28 * easeOut;
      infinityMesh.scale.set(currentScale, currentScale, currentScale);

      // Gentle breathing pulsation along metallic curve
      const pulse = Math.sin(elapsed * 2.4);
      goldMaterial.emissiveIntensity = (0.38 + 0.2 * pulse) * easeOut;
      centerGlowLight.intensity = (2.5 + 0.8 * pulse) * easeOut;

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Responsive Canvas Resize Handler
    const handleResize = () => {
      if (!container || isDisposed) return;
      const newW = container.clientWidth || Math.min(window.innerWidth - 32, 360);
      const newH = container.clientHeight || 240;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // Thorough Resource Cleanup on Unmount
    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      tubeGeometry.dispose();
      goldMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [shouldRender, prefersReducedMotion, hasWebGL]);

  if (!shouldRender) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loopra Loading"
      className={`fixed inset-0 z-[99999] bg-[#09090b] flex flex-col justify-between items-center select-none overflow-hidden transition-all duration-500 ease-out ${
        isFadingOut
          ? 'opacity-0 scale-[1.02] pointer-events-none'
          : 'opacity-100 scale-100 pointer-events-auto'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 24px)',
        paddingBottom: 'env(safe-area-inset-bottom, 32px)'
      }}
    >
      {/* Top Balancing Spacer for generous negative space */}
      <div className="w-full h-8 sm:h-12 pointer-events-none" />

      {/* Ambient Radial Golden Aura in the Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[480px] h-[340px] sm:h-[480px] bg-gradient-to-tr from-amber-500/18 via-orange-500/12 to-transparent rounded-full blur-[72px] pointer-events-none animate-pulse-slow" />
      </div>

      {/* Centered Composition: 3D Infinity Loop with Foreground Loopra Logo */}
      <div className="relative flex flex-col items-center justify-center max-w-sm w-full z-10 px-4 my-auto">
        <div className="relative w-72 sm:w-88 h-56 sm:h-64 flex items-center justify-center">
          
          {/* Animated 3D Infinity Loop Layer (Canvas or SVG Fallback) */}
          <div
            className={`absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none transition-all duration-700 ease-out ${
              isInfinityVisible
                ? 'opacity-100 scale-100 filter-none'
                : 'opacity-0 scale-75 blur-md'
            }`}
          >
            {hasWebGL && !prefersReducedMotion ? (
              <div
                ref={mountRef}
                className="w-full h-full flex items-center justify-center pointer-events-none"
              />
            ) : (
              /* High-Fidelity Static / Reduced-Motion Metallic 3D Infinity Emblem */
              <div className="w-full h-full flex items-center justify-center pointer-events-none">
                <svg
                  viewBox="0 0 240 120"
                  className="w-60 h-30 text-amber-500 drop-shadow-[0_0_30px_rgba(245,158,11,0.55)]"
                  fill="none"
                >
                  <path
                    d="M60 20 C25 20 15 45 15 60 C15 75 25 100 60 100 C95 100 125 60 145 60 C165 60 195 100 215 100 C235 100 245 75 245 60 C245 45 235 20 200 20 C165 20 135 60 115 60 C95 60 65 20 60 20 Z"
                    stroke="url(#fallbackGrad)"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <defs>
                    <linearGradient id="fallbackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#ea580c" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            )}
          </div>

          {/* Official Loopra Logo — Stationary, Crisp, and Prominent in the Loop Center */}
          <div
            className={`relative z-20 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-1.5 flex items-center justify-center transition-all duration-700 ease-out drop-shadow-[0_4px_32px_rgba(245,158,11,0.65)] ${
              isLogoVisible
                ? 'opacity-100 scale-100 filter-none'
                : 'opacity-0 scale-90 blur-sm'
            }`}
          >
            <img
              src={logoUrl}
              alt="Loopra"
              className="w-full h-full object-contain pointer-events-none select-none"
              onError={(e) => {
                if (e.target.src !== '/loopra-logo.png') {
                  e.target.src = '/loopra-logo.png';
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Area: 3D Dimension Tagline above Navigation Safe-Area */}
      <div
        className={`w-full px-6 pb-6 sm:pb-8 flex flex-col items-center justify-center text-center z-20 transition-all duration-700 ease-out ${
          isTaglineVisible
            ? 'opacity-100 translate-y-0 filter-none'
            : 'opacity-0 translate-y-3 blur-xs'
        }`}
      >
        {/* 3D Dimensional Typography: INFINITE SOUND. ENDLESS VIBES. */}
        <h2
          className="text-xs sm:text-sm font-black tracking-[0.22em] uppercase select-none text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400"
          style={{
            textShadow: `
              0 1px 0 #b45309,
              0 2px 0 #92400e,
              0 3px 0 #78350f,
              0 4px 10px rgba(0, 0, 0, 0.85),
              0 0 24px rgba(245, 158, 11, 0.45)
            `,
            letterSpacing: '0.22em'
          }}
        >
          INFINITE SOUND. ENDLESS VIBES.
        </h2>

        {/* Subtle Ambient Gold Underline Accent */}
        <div className="mt-3 w-16 sm:w-24 h-[2px] bg-gradient-to-r from-transparent via-amber-500/80 to-transparent rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
      </div>
    </div>
  );
}
