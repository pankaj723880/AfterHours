import React, { useEffect, useRef } from 'react';

/**
 * DjWaveformVisualizer
 * High-Performance Beat-Reactive Audio Waveform Visualizer
 * Supports:
 * - 'stage': Wide stage barrier equalizer wave across crowd horizon.
 * - 'player': Compact glowing waveform inside bottom music player.
 */
export default function DjWaveformVisualizer({
  variant = 'stage', // 'stage' | 'player'
  isPlaying = false,
  barCount = 44,
  height = 40,
  className = ''
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const barsRef = useRef([]);

  useEffect(() => {
    const count = variant === 'player' ? 24 : barCount;
    barsRef.current = Array.from({ length: count }, (_, i) => ({
      h: 4,
      targetH: 4,
      freqSpeed: 0.04 + (i % 6) * 0.015,
      phase: i * 0.25
    }));
  }, [variant, barCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let step = 0;
    let isTabVisible = !document.hidden;

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      if (!isTabVisible) return;

      step += isPlaying ? 0.08 : 0.02;
      const width = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, width, h);

      const bars = barsRef.current;
      const totalBars = bars.length;
      if (totalBars === 0) return;

      const spacing = variant === 'player' ? 2.5 : 3.5;
      const totalSpacing = (totalBars - 1) * spacing;
      const barWidth = Math.max(2, (width - totalSpacing) / totalBars);

      // Create neon gradient
      const grad = ctx.createLinearGradient(0, h, 0, 0);
      if (variant === 'player') {
        grad.addColorStop(0, '#ec4899'); // Pink
        grad.addColorStop(0.6, '#f97316'); // Orange
        grad.addColorStop(1, '#fde047'); // Yellow glow
      } else {
        grad.addColorStop(0, '#a855f7'); // Purple
        grad.addColorStop(0.5, '#ec4899'); // Neon magenta
        grad.addColorStop(1, '#38bdf8'); // Sky cyan peak
      }

      ctx.fillStyle = grad;

      bars.forEach((b, i) => {
        if (isPlaying) {
          // Dynamic harmonic audio spectrum simulation
          const centerDist = 1 - Math.abs(i - totalBars / 2) / (totalBars / 2);
          const w1 = Math.sin(step * 3.2 + b.phase);
          const w2 = Math.cos(step * 2.1 - i * 0.4);
          const w3 = Math.sin(step * 5.4 + (i % 4) * 1.5);
          const energy = Math.max(0.12, (w1 * 0.4 + w2 * 0.35 + w3 * 0.25 + 0.5) * (0.4 + centerDist * 0.7));
          b.targetH = 4 + energy * (h - 6);
        } else {
          // Ambient gentle breathing
          b.targetH = 3 + Math.sin(step + i * 0.2) * 2;
        }

        // Smooth height interpolation
        b.h += (b.targetH - b.h) * 0.25;

        const x = i * (barWidth + spacing);
        const y = h - b.h;
        const radius = Math.min(barWidth * 0.5, 3);

        // Rounded vertical bar (rendered cleanly without expensive shadowBlur)
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, b.h, [radius, radius, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, b.h);
        }
        ctx.fill();
      });
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, variant]);

  return (
    <canvas
      ref={canvasRef}
      width={variant === 'player' ? 140 : 640}
      height={height}
      className={className}
    />
  );
}
