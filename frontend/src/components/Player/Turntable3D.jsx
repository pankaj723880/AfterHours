import React, { useState, useEffect, useRef } from 'react';

export default function Turntable3D({ 
  currentSong, 
  isPlaying = false, 
  thumbnail = '', 
  onTogglePlay,
  size = 'large' // 'large' for Now Playing modal / hero, 'compact' for smaller spaces
}) {
  const [tilt, setTilt] = useState({ x: 12, y: -6 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const handleMouseMove = (e) => {
    if (prefersReducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    // Subtle tilt range (-10 to 10 deg)
    const tiltX = Math.max(-12, Math.min(20, -(y / rect.height) * 18 + 10));
    const tiltY = Math.max(-18, Math.min(18, (x / rect.width) * 18 - 4));
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 12, y: -6 });
  };

  const displayImage = thumbnail || currentSong?.thumbnail || currentSong?.image || '/loopra-logo.png';

  const sizeClass = {
    compact: 'w-48 h-48 min-[360px]:w-56 min-[360px]:h-56 sm:w-64 sm:h-64',
    responsive: 'w-36 h-36 min-[380px]:w-44 min-[380px]:h-44 sm:w-52 sm:h-52 md:w-64 md:h-64 lg:w-72 lg:h-72 max-h-[35vh] max-w-[35vh] aspect-square',
    large: 'w-40 h-40 min-[380px]:w-48 min-[380px]:h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96',
  }[size] || 'w-40 h-40 min-[380px]:w-48 min-[380px]:h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96';

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative flex flex-col items-center justify-center select-none ${sizeClass}`}
      style={{ perspective: '1100px' }}
      aria-label="3D Turntable Music Player"
    >
      {/* Dynamic 3D Turntable Assembly */}
      <div 
        className="relative w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: prefersReducedMotion 
            ? 'rotateX(10deg) rotateY(0deg)' 
            : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
        }}
      >
        {/* Soft Ambient Floor Shadow & Amber Underglow */}
        <div 
          className="absolute -bottom-3 sm:-bottom-4 w-[88%] h-8 sm:h-10 rounded-[50%] blur-lg transition-all duration-700 pointer-events-none"
          style={{
            background: isPlaying 
              ? 'radial-gradient(ellipse at center, rgba(var(--accent-rgb, 245, 158, 11), 0.45) 0%, rgba(var(--accent-rgb, 245, 158, 11), 0.2) 40%, rgba(0,0,0,0.8) 75%)' 
              : 'radial-gradient(ellipse at center, rgba(var(--accent-rgb, 245, 158, 11), 0.15) 0%, rgba(0,0,0,0.7) 70%)',
            transform: 'translateZ(-50px) rotateX(75deg)'
          }}
        />

        {/* Turntable Plinth / Base Deck */}
        <div 
          className="relative w-[92%] h-[92%] rounded-2xl sm:rounded-3xl md:rounded-[32px] p-2.5 sm:p-3 md:p-4 flex items-center justify-center border border-amber-500/25 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.9),0_0_35px_rgba(var(--accent-rgb,245,158,11),0.15)]"
          style={{
            background: 'linear-gradient(145deg, #18181b 0%, #09090b 60%, #040405 100%)',
            transform: 'translateZ(0px)',
            boxShadow: isPlaying 
              ? '0 30px 60px rgba(0,0,0,0.9), inset 0 1px 2px rgba(255,255,255,0.12), 0 0 40px rgba(var(--accent-rgb, 245, 158, 11), 0.2)'
              : '0 20px 45px rgba(0,0,0,0.8), inset 0 1px 2px rgba(255,255,255,0.08)'
          }}
        >
          {/* Deck Corner Accents & Branding */}
          <div className="absolute top-2 left-2.5 sm:top-3 sm:left-4 flex items-center gap-1.5 sm:gap-2">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 shadow-[0_0_8px_var(--accent-color,#f59e0b)] animate-pulse" />
            <span className="text-[7px] sm:text-[8px] md:text-[9px] font-mono font-bold tracking-widest uppercase text-amber-400/80">
              LOOPRA • MK-III
            </span>
          </div>

          <div className="absolute top-2 right-2.5 sm:top-3 sm:right-4 flex items-center gap-1 sm:gap-1.5">
            <span className="px-1 sm:px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-mono font-bold bg-neutral-900 border border-amber-500/30 text-amber-300">
              {isPlaying ? '33 RPM' : 'STANDBY'}
            </span>
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-colors ${isPlaying ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-neutral-600'}`} />
          </div>

          {/* Strobe Pitch Dots Pattern along Platter Rim */}
          <div 
            className="absolute inset-4 rounded-full border border-amber-500/20 pointer-events-none flex items-center justify-center"
            style={{
              boxShadow: isPlaying 
                ? 'inset 0 0 25px rgba(var(--accent-rgb, 245, 158, 11), 0.25), 0 0 25px rgba(var(--accent-rgb, 245, 158, 11), 0.2)' 
                : 'none'
            }}
          />

          {/* Platter Metal Rim */}
          <div 
            className="relative w-[84%] aspect-square rounded-full flex items-center justify-center p-2.5 shadow-2xl"
            style={{
              background: 'radial-gradient(circle, #27272a 0%, #18181b 70%, #09090b 100%)',
              border: '2px solid rgba(245, 158, 11, 0.3)',
              transform: 'translateZ(15px)'
            }}
          >
            {/* Spinning Vinyl Record Disc */}
            <div 
              onClick={onTogglePlay}
              role="button"
              tabIndex={0}
              title={isPlaying ? "Click to Pause" : "Click to Play"}
              className={`relative w-full h-full rounded-full flex items-center justify-center cursor-pointer transition-transform duration-700 ${
                isPlaying && !prefersReducedMotion ? 'animate-[spin_4.5s_linear_infinite]' : ''
              }`}
              style={{
                background: `
                  radial-gradient(circle, transparent 28%, rgba(0,0,0,0.95) 29%),
                  repeating-radial-gradient(circle, #0a0a0c 0px, #0a0a0c 2px, #1c1c20 3px, #0a0a0c 4px)
                `,
                boxShadow: '0 10px 30px rgba(0,0,0,0.8), inset 0 0 15px rgba(0,0,0,0.9)'
              }}
            >
              {/* Vinyl Specular Light Reflections (Shimmer Sheen) */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none opacity-40 mix-blend-screen"
                style={{
                  background: 'conic-gradient(from 45deg, transparent 0deg, rgba(255,255,255,0.18) 45deg, transparent 90deg, transparent 180deg, rgba(255,255,255,0.18) 225deg, transparent 270deg)'
                }}
              />

              {/* Vinyl Outer Rim Amber Edge Light */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-500"
                style={{
                  boxShadow: isPlaying 
                    ? 'inset 0 0 12px rgba(245,158,11,0.5), 0 0 15px rgba(245,158,11,0.3)' 
                    : 'inset 0 0 4px rgba(255,255,255,0.1)'
                }}
              />

              {/* Center Album Art Label */}
              <div 
                className="relative w-[42%] aspect-square rounded-full overflow-hidden p-0.5 border sm:border-2 border-amber-500/70 shadow-lg"
                style={{
                  background: 'radial-gradient(circle, #d97706 0%, #b45309 80%, #78350f 100%)'
                }}
              >
                <img
                  src={displayImage}
                  alt={currentSong?.title || "Now Playing"}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentSong?.title || 'Loopra')}&background=18181b&color=f59e0b&size=300`;
                  }}
                />

                {/* Brass Center Spindle Hole */}
                <div 
                  className="absolute inset-0 m-auto w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-gradient-to-tr from-amber-600 via-amber-300 to-amber-700 border border-neutral-950 shadow-inner flex items-center justify-center pointer-events-none"
                >
                  <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-neutral-950 shadow-inner" />
                </div>
              </div>
            </div>
          </div>

          {/* Tonearm Assembly */}
          <div 
            className="absolute right-2 sm:right-4 top-2 sm:top-5 w-12 sm:w-18 md:w-24 h-28 sm:h-44 md:h-64 pointer-events-none transition-transform duration-1000 ease-in-out"
            style={{
              transformOrigin: 'top center',
              transform: isPlaying 
                ? 'rotate(-26deg) translateZ(30px)' 
                : 'rotate(-4deg) translateZ(30px)',
              filter: 'drop-shadow(2px 5px 8px rgba(0,0,0,0.8))'
            }}
          >
            {/* Tonearm Base / Gimbal Pivot */}
            <div className="absolute top-0 right-1 sm:right-2 w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-b from-neutral-300 via-neutral-700 to-neutral-900 border border-amber-500/40 shadow-lg flex items-center justify-center">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 shadow-inner" />
            </div>

            {/* Tonearm Arm Wand (Metallic Chrome Tube) */}
            <div 
              className="absolute top-4 sm:top-5 md:top-6 right-3 sm:right-4 md:right-5 w-0.5 sm:w-1 h-20 sm:h-34 md:h-48 rounded-full"
              style={{
                background: 'linear-gradient(to right, #71717a 0%, #f4f4f5 50%, #52525b 100%)',
                boxShadow: '1px 2px 4px rgba(0,0,0,0.7)'
              }}
            />

            {/* Headshell / Cartridge at Arm End */}
            <div 
              className="absolute bottom-2 sm:bottom-4 md:bottom-6 right-2 sm:right-3 md:right-3.5 w-3 sm:w-3.5 md:w-4 h-5 sm:h-6 md:h-7 rounded-sm bg-neutral-900 border border-amber-500/80 shadow-md flex flex-col items-center justify-end pb-0.5 sm:pb-1"
              style={{ transform: 'rotate(18deg)' }}
            >
              {/* Stylus Glowing Needle Tip */}
              <div 
                className={`w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full transition-all duration-500 ${
                  isPlaying 
                    ? 'bg-amber-400 shadow-[0_0_8px_var(--accent-color,#f59e0b)]' 
                    : 'bg-amber-700'
                }`} 
              />
            </div>
          </div>

          {/* Interactive Play/Pause Holographic Overlay on Hover */}
          <div 
            onClick={onTogglePlay}
            className="absolute inset-0 hidden sm:flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-black/30 rounded-[32px] cursor-pointer"
          >
            <div className="p-3 rounded-full bg-amber-500/90 hover:bg-amber-400 text-neutral-950 shadow-2xl transform scale-90 hover:scale-100 active:scale-95 transition-all">
              {isPlaying ? (
                <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 fill-current translate-x-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
