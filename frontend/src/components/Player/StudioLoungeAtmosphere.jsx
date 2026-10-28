import React, { useEffect, useRef } from 'react';
import { hexToRgb } from '../../services/cmsClient';

export default function StudioLoungeAtmosphere({ isPlaying = false, theme }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  const safeTheme = (theme && typeof theme === 'object') ? theme : {
    accentColor: '#f59e0b',
    meshGradient: true,
    particles: true
  };

  const showMesh = safeTheme.meshGradient !== false;
  const showParticles = safeTheme.particles !== false;
  const accentHex = (typeof safeTheme.accentColor === 'string' && safeTheme.accentColor.trim()) 
    ? safeTheme.accentColor.trim() 
    : '#f59e0b';
  const rgb = hexToRgb(accentHex);

  useEffect(() => {
    if (!showParticles) {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate floating ambient warm dust particles
    const particleCount = 26;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 0.8,
      speedY: Math.random() * 0.4 + 0.1,
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.5 + 0.2,
      pulse: Math.random() * Math.PI
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.y -= p.speedY * (isPlaying ? 1.3 : 1.0);
        p.x += p.speedX;
        p.pulse += 0.03;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        const currentOpacity = p.opacity * (0.7 + 0.3 * Math.sin(p.pulse));

        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${currentOpacity * 0.45})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, showParticles, rgb.r, rgb.g, rgb.b]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* 3D Dynamic Mesh: Stage Spotlights & Plinth Halo */}
      {showMesh && (
        <>
          <div 
            className="absolute -top-32 left-1/4 w-96 h-96 rounded-full blur-[120px] transition-opacity duration-1000"
            style={{
              background: isPlaying 
                ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)` 
                : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`
            }}
          />
          <div 
            className="absolute -top-32 right-1/4 w-96 h-96 rounded-full blur-[120px] transition-opacity duration-1000"
            style={{
              background: isPlaying 
                ? `rgba(${Math.min(rgb.r + 20, 255)}, ${Math.max(rgb.g - 20, 0)}, ${rgb.b}, 0.12)` 
                : `rgba(${Math.min(rgb.r + 20, 255)}, ${Math.max(rgb.g - 20, 0)}, ${rgb.b}, 0.05)`
            }}
          />

          {/* Center Plinth Backlight Halo */}
          <div 
            className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full blur-[140px] transition-all duration-1000"
            style={{
              background: isPlaying 
                ? `radial-gradient(circle, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06) 50%, transparent 80%)` 
                : `radial-gradient(circle, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08) 0%, transparent 70%)`
            }}
          />
        </>
      )}

      {/* Particle Stars Canvas */}
      {showParticles && (
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full opacity-70"
        />
      )}
    </div>
  );
}
