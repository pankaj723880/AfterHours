import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Mathematical 3D Infinity (Figure-8 / Lemniscate) Space Curve
 * Creates a genuine, non-self-intersecting 3D loop in space where
 * one branch curves in front (+Z) and the opposite branch curves behind (-Z).
 */
class InfinityCurve3D extends THREE.Curve {
  constructor(scaleX = 2.05, scaleY = 1.05, heightZ = 0.65) {
    super();
    this.scaleX = scaleX;
    this.scaleY = scaleY;
    this.heightZ = heightZ;
  }

  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const u = t * 2 * Math.PI;
    // Lissajous 3D figure-8 parametric path
    const x = this.scaleX * Math.cos(u);
    const y = this.scaleY * Math.sin(2 * u);
    const z = this.heightZ * Math.sin(u);
    return optionalTarget.set(x, y, z);
  }
}

/**
 * Checks for genuine WebGL support in the user's browser
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
  isAppReady = false,
  onFinished,
  branding
}) {
  const [shouldRender, setShouldRender] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isInfinityVisible, setIsInfinityVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);

  const mountRef = useRef(null);
  const animationFrameRef = useRef(null);
  const rendererRef = useRef(null);

  const siteName = branding?.siteName || 'Loopra';
  const siteTagline = branding?.tagline || 'Retro & High-Vibe Radio';
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

  // Choreographed Logo-to-Infinity emergence:
  // Phase 1 (0ms - 450ms): Official Loopra logo is clearly presented against obsidian background
  // Phase 2 (450ms+): 3D metallic infinity loop unfurls seamlessly around the centered logo
  useEffect(() => {
    const emergeTimer = setTimeout(() => {
      setIsInfinityVisible(true);
    }, 450);

    return () => clearTimeout(emergeTimer);
  }, []);

  // Handle initialization completion & graceful fade-out transition
  useEffect(() => {
    if (!isAppReady) return;

    // Trigger smooth fade-out exit transition
    setIsFadingOut(true);

    const fadeTimer = setTimeout(() => {
      setShouldRender(false);
      if (typeof onFinished === 'function') {
        onFinished();
      }
    }, 600);

    return () => clearTimeout(fadeTimer);
  }, [isAppReady, onFinished]);

  // Three.js 3D Infinity Loop setup and render loop
  useEffect(() => {
    if (!shouldRender || prefersReducedMotion || !hasWebGL || !mountRef.current) {
      return;
    }

    const container = mountRef.current;
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 220;

    // Scene & Perspective Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.8);

    // High-performance WebGL Renderer with alpha transparency
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 3D Infinity Tube Geometry
    const curve = new InfinityCurve3D(2.1, 1.05, 0.65);
    const geometry = new THREE.TubeGeometry(curve, 140, 0.14, 20, true);

    // Premium Metallic Gold & Amber-Orange Physical Material
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf59e0b), // Vibrant metallic gold
      emissive: new THREE.Color(0xd97706), // Rich warm amber glow
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 0.95,
      transparent: true,
      opacity: 0.95
    });

    const infinityMesh = new THREE.Mesh(geometry, material);
    infinityMesh.scale.set(0.75, 0.75, 0.75);
    scene.add(infinityMesh);

    // Lighting setup: realistic highlights and reflections
    const ambientLight = new THREE.AmbientLight(0xffedd5, 1.2);
    scene.add(ambientLight);

    // Key Light: creates intense gold sheen on curves
    const keyLight = new THREE.DirectionalLight(0xfef08a, 2.8);
    keyLight.position.set(5, 5, 5);
    scene.add(keyLight);

    // Accent Orange Rim Light: creates glowing orange highlights from below
    const rimLight = new THREE.DirectionalLight(0xf97316, 2.2);
    rimLight.position.set(-5, -4, -3);
    scene.add(rimLight);

    // Warm Point Light at center for core amber glow
    const centerGlowLight = new THREE.PointLight(0xfbbf24, 2.4, 9);
    centerGlowLight.position.set(0, 0, 1.2);
    scene.add(centerGlowLight);

    // Animation Loop
    let startTime = performance.now();
    let isDisposed = false;

    const animate = (time) => {
      if (isDisposed) return;

      const elapsed = (time - startTime) * 0.001;

      // Smooth continuous 3D rotation with natural pitch & roll
      infinityMesh.rotation.y = elapsed * 0.85;
      infinityMesh.rotation.x = Math.sin(elapsed * 0.7) * 0.18 + 0.12;
      infinityMesh.rotation.z = Math.cos(elapsed * 0.5) * 0.1;

      // Dynamic emergence ramp: mesh smoothly scales from 0.75 to 1.0 around the centered logo
      const emergeProgress = Math.min(1.0, Math.max(0, (elapsed - 0.4) / 0.9));
      const easeOut = 1 - Math.pow(1 - emergeProgress, 3);
      const meshScale = 0.75 + 0.25 * easeOut;
      infinityMesh.scale.set(meshScale, meshScale, meshScale);

      // Flowing energy pulsation along the infinity path
      const pulse = Math.sin(elapsed * 2.2);
      material.emissiveIntensity = (0.35 + 0.22 * pulse) * easeOut;
      centerGlowLight.intensity = (2.2 + 0.7 * pulse) * easeOut;

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Resize handler
    const handleResize = () => {
      if (!container || isDisposed) return;
      const newW = container.clientWidth || 320;
      const newH = container.clientHeight || 220;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup WebGL resources on unmount
    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      geometry.dispose();
      material.dispose();
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
      aria-label="Loading Loopra"
      className={`fixed inset-0 z-[99999] bg-[#09090b] flex flex-col items-center justify-center select-none overflow-hidden transition-all duration-600 ease-out ${
        isFadingOut
          ? 'opacity-0 scale-105 pointer-events-none'
          : 'opacity-100 scale-100 pointer-events-auto'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      {/* Background Radial Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[500px] h-[340px] sm:h-[500px] bg-gradient-to-tr from-amber-500/15 via-orange-500/10 to-transparent rounded-full blur-[80px] pointer-events-none animate-pulse-slow" />
      </div>

      {/* Main Centered Composition */}
      <div className="relative flex flex-col items-center justify-center px-4 max-w-sm w-full z-10">
        {/* 3D Infinity Canvas Container with Centered Logo */}
        <div className="relative w-72 sm:w-88 h-48 sm:h-56 flex items-center justify-center">
          {/* Smooth emergence wrapper for the 3D infinity loop / fallback */}
          <div
            className={`absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none transition-all duration-1000 ease-out ${
              isInfinityVisible
                ? 'opacity-100 scale-100 filter-none'
                : 'opacity-0 scale-75 blur-sm'
            }`}
          >
            {hasWebGL && !prefersReducedMotion ? (
              <div
                ref={mountRef}
                className="w-full h-full flex items-center justify-center pointer-events-none"
              />
            ) : (
              /* Accessible reduced-motion / non-WebGL fallback: elegant dual-loop gold glow */
              <div className="w-full h-full flex items-center justify-center pointer-events-none">
                <svg
                  viewBox="0 0 240 120"
                  className="w-56 h-28 text-amber-500 drop-shadow-[0_0_25px_rgba(245,158,11,0.45)]"
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

          {/* Centered Loopra Logo Asset - perfectly stationary and sharp in loop nexus */}
          <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl p-1 flex items-center justify-center drop-shadow-[0_4px_30px_rgba(245,158,11,0.5)]">
            <img
              src={logoUrl}
              alt={siteName}
              className="w-full h-full object-contain pointer-events-none select-none transition-transform duration-500"
              onError={(e) => {
                if (e.target.src !== '/loopra-logo.png') {
                  e.target.src = '/loopra-logo.png';
                }
              }}
            />
          </div>
        </div>

        {/* Branding Typography */}
        <div className="mt-4 text-center space-y-1.5 animate-fadeIn">
          <h1 className="text-2xl sm:text-3xl font-display font-black tracking-widest text-white drop-shadow-md uppercase">
            {siteName}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-amber-400/90 tracking-wider">
            {siteTagline}
          </p>
        </div>

        {/* Elegant Gold Progress Indicator */}
        <div className="mt-6 w-36 sm:w-44 h-1 bg-neutral-900 rounded-full overflow-hidden border border-amber-500/20 shadow-inner">
          <div className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-300 rounded-full animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
        </div>
      </div>
    </div>
  );
}
