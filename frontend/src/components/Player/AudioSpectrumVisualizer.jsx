import React, { useEffect, useRef } from 'react';

export default function AudioSpectrumVisualizer({ 
  isPlaying = false, 
  barCount = 28,
  height = 48,
  className = ''
}) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const barsRef = useRef([]);

  useEffect(() => {
    // Initialize bars data with height and target
    barsRef.current = Array.from({ length: barCount }, () => ({
      current: 4,
      target: 4,
      peak: 4,
      peakTimer: 0
    }));
  }, [barCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let step = 0;

    const render = () => {
      step += 0.08;
      const width = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, width, h);

      const totalBars = barsRef.current.length;
      const barSpacing = 3;
      const totalSpacing = (totalBars - 1) * barSpacing;
      const barWidth = Math.max(2, (width - totalSpacing) / totalBars);

      // Create rich amber-to-orange gradient
      const gradient = ctx.createLinearGradient(0, h, 0, 0);
      gradient.addColorStop(0, '#d97706'); // amber-600
      gradient.addColorStop(0.5, '#f59e0b'); // amber-500
      gradient.addColorStop(0.85, '#f97316'); // orange-500
      gradient.addColorStop(1, '#fde68a'); // amber-200

      barsRef.current.forEach((bar, i) => {
        if (isPlaying) {
          // Dynamic organic wave pattern simulating audio frequency bands
          const wave1 = Math.sin(step * 2.5 + i * 0.45);
          const wave2 = Math.cos(step * 1.8 - i * 0.3);
          const wave3 = Math.sin(step * 4.2 + (i % 5) * 1.2);
          const bassBoost = i < totalBars * 0.35 ? 1.4 : 0.85;
          const energy = Math.max(0.12, (wave1 * 0.35 + wave2 * 0.35 + wave3 * 0.3 + 0.5) * bassBoost);
          
          bar.target = Math.min(h - 4, Math.max(4, energy * (h - 6)));
          // Smooth interpolation
          bar.current += (bar.target - bar.current) * 0.35;

          // Peak hold indicator
          if (bar.current >= bar.peak) {
            bar.peak = bar.current;
            bar.peakTimer = 12;
          } else {
            if (bar.peakTimer > 0) {
              bar.peakTimer -= 1;
            } else {
              bar.peak = Math.max(bar.current, bar.peak - 1.2);
            }
          }
        } else {
          // Calm drop when paused
          bar.current += (3 - bar.current) * 0.15;
          bar.peak += (3 - bar.peak) * 0.15;
        }

        const x = i * (barWidth + barSpacing);
        const y = h - bar.current;

        // Draw frequency bar with rounded top
        ctx.fillStyle = gradient;
        ctx.beginPath();
        const radius = Math.min(barWidth / 2, 2);
        ctx.roundRect(x, y, barWidth, bar.current, [radius, radius, 0, 0]);
        ctx.fill();

        // Draw peak dot if playing
        if (isPlaying && bar.peak > 6) {
          ctx.fillStyle = '#fde68a';
          ctx.fillRect(x, Math.max(0, h - bar.peak - 2), barWidth, 1.5);
        }
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={height} 
        className="w-full max-w-sm h-full pointer-events-none drop-shadow-[0_0_12px_rgba(245,158,11,0.35)]" 
      />
    </div>
  );
}
