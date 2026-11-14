import React, { useRef, useEffect } from 'react';
import { relaxAudioEngine } from '../../services/relaxAudioEngine';

export default function RelaxVisualizer({ activeCategories = [] }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const hasForest = activeCategories.includes('forest');
  const hasBirds = activeCategories.includes('birds');
  const hasWater = activeCategories.includes('water');
  const hasBinaural = activeCategories.includes('binaural');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle & Entity pools
    // 1. Birds
    const birdEntities = Array.from({ length: 6 }, (_, i) => ({
      x: -50 - i * 140,
      y: 60 + Math.random() * (height * 0.35),
      speedX: 1.2 + Math.random() * 1.5,
      wingPhase: Math.random() * Math.PI * 2,
      scale: 0.6 + Math.random() * 0.5
    }));

    // 2. Water / Rain drops
    const rainDrops = Array.from({ length: 70 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: 12 + Math.random() * 16,
      speedY: 6 + Math.random() * 8,
      opacity: 0.15 + Math.random() * 0.25
    }));

    // 3. Water surface waves
    let waveOffset = 0;

    // 4. Forest leaves
    const leaves = Array.from({ length: 24 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 4 + Math.random() * 5,
      speedX: 0.4 + Math.random() * 0.8,
      speedY: 0.3 + Math.random() * 0.6,
      rot: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 0.04
    }));

    // 5. Binaural wave phase
    let binauralPhase = 0;

    const render = () => {
      const audioLevels = relaxAudioEngine.getAverageFrequencies();

      ctx.clearRect(0, 0, width, height);

      // Base Gradient
      const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
      baseGrad.addColorStop(0, 'rgba(8, 11, 16, 0.95)');
      baseGrad.addColorStop(0.5, 'rgba(12, 17, 24, 0.9)');
      baseGrad.addColorStop(1, 'rgba(6, 9, 14, 0.98)');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, width, height);

      // ==========================================
      // LAYER 1: FOREST (Trees & Swaying Leaves)
      // ==========================================
      if (hasForest) {
        const forestPulse = (audioLevels.forest || 0.1) * 1.5;
        // Background mountain/forest hills
        ctx.fillStyle = 'rgba(16, 32, 24, 0.45)';
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 40) {
          const y = height * 0.65 + Math.sin(x * 0.003 + waveOffset * 0.2) * 28;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        // Tree silhouettes
        ctx.fillStyle = 'rgba(12, 24, 18, 0.6)';
        for (let x = 20; x < width; x += 90) {
          const treeH = 120 + Math.sin(x * 12) * 40;
          const sway = Math.sin(waveOffset * 0.8 + x) * (3 + forestPulse * 4);
          ctx.beginPath();
          ctx.moveTo(x + sway, height * 0.75 - treeH);
          ctx.lineTo(x - 22 + sway, height * 0.75);
          ctx.lineTo(x + 22 + sway, height * 0.75);
          ctx.closePath();
          ctx.fill();
        }

        // Falling & swaying leaves
        ctx.fillStyle = 'rgba(92, 180, 110, 0.35)';
        leaves.forEach(leaf => {
          leaf.x += leaf.speedX + (audioLevels.forest || 0) * 0.8;
          leaf.y += leaf.speedY;
          leaf.rot += leaf.rotSpeed;
          if (leaf.x > width) leaf.x = -10;
          if (leaf.y > height) leaf.y = -10;

          ctx.save();
          ctx.translate(leaf.x, leaf.y);
          ctx.rotate(leaf.rot);
          ctx.beginPath();
          ctx.ellipse(0, 0, leaf.size, leaf.size * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      // ==========================================
      // LAYER 2: WATER (River Waves & Rain Drops)
      // ==========================================
      if (hasWater) {
        const waterPulse = (audioLevels.water || 0.1) * 2.2;
        waveOffset += 0.02 + waterPulse * 0.03;

        // Flowing Water Waves at bottom
        for (let layer = 0; layer < 3; layer++) {
          const yBase = height * 0.78 + layer * 25;
          const waveAmp = (8 + layer * 4) * (1 + waterPulse);
          ctx.fillStyle = layer === 0
            ? 'rgba(32, 90, 140, 0.25)'
            : layer === 1
              ? 'rgba(40, 110, 160, 0.35)'
              : 'rgba(20, 60, 95, 0.5)';

          ctx.beginPath();
          ctx.moveTo(0, height);
          for (let x = 0; x <= width; x += 25) {
            const y = yBase + Math.sin(x * 0.008 + waveOffset + layer * 1.5) * waveAmp;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fill();
        }

        // Rain particle overlay
        ctx.strokeStyle = 'rgba(180, 220, 255, 0.35)';
        ctx.lineWidth = 1.2;
        rainDrops.forEach(drop => {
          drop.y += drop.speedY + waterPulse * 3;
          if (drop.y > height) {
            drop.y = -20;
            drop.x = Math.random() * width;
          }
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - 1, drop.y + drop.length);
          ctx.stroke();
        });
      }

      // ==========================================
      // LAYER 3: BIRDS (Silhouettes Flying Across)
      // ==========================================
      if (hasBirds) {
        ctx.fillStyle = 'rgba(230, 240, 255, 0.65)';
        birdEntities.forEach(b => {
          b.x += b.speedX + (audioLevels.birds || 0) * 1.5;
          b.wingPhase += 0.15;
          if (b.x > width + 60) {
            b.x = -60;
            b.y = 50 + Math.random() * (height * 0.35);
          }

          const wingY = Math.sin(b.wingPhase) * 6 * b.scale;
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.beginPath();
          // Minimalist elegant bird silhouette
          ctx.moveTo(-10 * b.scale, wingY);
          ctx.quadraticCurveTo(0, -4 * b.scale, 10 * b.scale, wingY);
          ctx.quadraticCurveTo(0, 2 * b.scale, -10 * b.scale, wingY);
          ctx.fill();
          ctx.restore();
        });
      }

      // ==========================================
      // LAYER 4: BINAURAL BEATS (Frequency Pulses)
      // ==========================================
      if (hasBinaural) {
        binauralPhase += 0.03;
        const binLevel = (audioLevels.binaural || 0.15) * 35;
        const centerY = height * 0.42;

        // Stereo Dual Waveforms (Left cyan, Right amber/violet)
        ctx.lineWidth = 2;
        // Left Channel
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.beginPath();
        for (let x = 0; x <= width; x += 15) {
          const y = centerY + Math.sin(x * 0.015 + binauralPhase) * (15 + binLevel);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Right Channel (slightly shifted frequency creating visual beat)
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
        ctx.beginPath();
        for (let x = 0; x <= width; x += 15) {
          const y = centerY + Math.sin(x * 0.018 - binauralPhase * 1.1) * (15 + binLevel);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [hasForest, hasBirds, hasWater, hasBinaural]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}

