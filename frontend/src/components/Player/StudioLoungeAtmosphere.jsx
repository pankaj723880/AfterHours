import React, { useEffect, useRef } from 'react';

export default function StudioLoungeAtmosphere({ isPlaying = false }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
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

        ctx.fillStyle = `rgba(245, 158, 11, ${currentOpacity * 0.45})`;
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
  }, [isPlaying]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Warm Amber Top Spotlights (Lounge Stage Cones) */}
      <div 
        className="absolute -top-32 left-1/4 w-96 h-96 rounded-full blur-[120px] transition-opacity duration-1000"
        style={{
          background: isPlaying ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.07)'
        }}
      />
      <div 
        className="absolute -top-32 right-1/4 w-96 h-96 rounded-full blur-[120px] transition-opacity duration-1000"
        style={{
          background: isPlaying ? 'rgba(249, 115, 22, 0.12)' : 'rgba(249, 115, 22, 0.05)'
        }}
      />

      {/* Center Plinth Backlight Halo */}
      <div 
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full blur-[140px] transition-all duration-1000"
        style={{
          background: isPlaying 
            ? 'radial-gradient(circle, rgba(217,119,6,0.18) 0%, rgba(180,83,9,0.08) 50%, transparent 80%)' 
            : 'radial-gradient(circle, rgba(217,119,6,0.08) 0%, transparent 70%)'
        }}
      />

      {/* Floating Ambient Light Particle Canvas */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full opacity-70"
      />
    </div>
  );
}
