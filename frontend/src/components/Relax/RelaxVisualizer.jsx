import React, { useRef, useEffect } from 'react';
import { relaxAudioEngine } from '../../services/relaxAudioEngine';

export default function RelaxVisualizer({ activeCategories = [] }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const hasForest = activeCategories.includes('forest');
  const hasBirds = activeCategories.includes('birds');
  const hasWater = activeCategories.includes('water');
  const hasRain = activeCategories.includes('rain');
  const hasWind = activeCategories.includes('wind');
  const hasFireplace = activeCategories.includes('fire');
  const hasNature = activeCategories.includes('nature');

  // When no specific sound is toggled yet, default to full tranquil nature atmosphere
  const isDefaultView = activeCategories.length === 0;

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
    // 1. Birds (soaring silhouettes across sky)
    const birdEntities = Array.from({ length: 8 }, (_, i) => ({
      x: -60 - i * 140,
      y: 50 + Math.random() * (height * 0.38),
      speedX: 1.2 + Math.random() * 1.5,
      wingPhase: Math.random() * Math.PI * 2,
      scale: 0.65 + Math.random() * 0.5
    }));

    // 2. Rain / Water drops
    const rainDrops = Array.from({ length: 75 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: 12 + Math.random() * 18,
      speedY: 7 + Math.random() * 8,
      opacity: 0.2 + Math.random() * 0.3
    }));

    // 3. Falling / Drifting forest leaves
    const leaves = Array.from({ length: 24 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 4 + Math.random() * 5,
      speedX: 0.5 + Math.random() * 0.9,
      speedY: 0.3 + Math.random() * 0.6,
      rot: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 0.04
    }));

    // 4. Fireplace Embers
    const embers = Array.from({ length: 30 }, () => ({
      x: width * 0.35 + Math.random() * (width * 0.3),
      y: height * 0.7 + Math.random() * (height * 0.3),
      size: 1.5 + Math.random() * 2.8,
      speedY: 1.0 + Math.random() * 2.0,
      driftX: (Math.random() - 0.5) * 1.5,
      opacity: 0.4 + Math.random() * 0.6,
      hue: 22 + Math.random() * 26
    }));

    // 5. Waterfall droplets & splash mist
    const waterfallColumns = Array.from({ length: 35 }, () => ({
      x: width * 0.5 + (Math.random() - 0.5) * 140,
      y: height * 0.18 + Math.random() * (height * 0.55),
      speedY: 8 + Math.random() * 7,
      length: 14 + Math.random() * 22,
      opacity: 0.3 + Math.random() * 0.4
    }));

    const splashMist = Array.from({ length: 22 }, () => ({
      x: width * 0.5 + (Math.random() - 0.5) * 180,
      y: height * 0.74 + Math.random() * 18,
      vx: (Math.random() - 0.5) * 2.2,
      vy: -1.2 - Math.random() * 3.0,
      radius: 3 + Math.random() * 7,
      opacity: 0.2 + Math.random() * 0.35
    }));

    let waveOffset = 0;

    const render = () => {
      const audioLevels = relaxAudioEngine.getAverageFrequencies();

      ctx.clearRect(0, 0, width, height);

      // Dynamic Sky & Atmosphere Gradient
      const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
      baseGrad.addColorStop(0, 'rgba(8, 12, 18, 0.96)');
      baseGrad.addColorStop(0.5, 'rgba(12, 18, 26, 0.92)');
      baseGrad.addColorStop(1, 'rgba(6, 10, 15, 0.98)');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric starlight particles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 12347) % width);
        const sy = ((i * 34897) % (height * 0.45));
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }

      // ==========================================
      // LAYER 1: FOREST (Distant Hills, Pines & Leaves)
      // Shown when Forest is active OR in Default View
      // ==========================================
      if (hasForest || isDefaultView) {
        const forestPulse = (audioLevels.forest || 0.1) * 1.5;

        // Distant Mountain/Forest Ridge
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

        // Pine Tree silhouettes
        ctx.fillStyle = 'rgba(12, 24, 18, 0.65)';
        for (let x = 15; x < width; x += 75) {
          const treeH = 120 + Math.sin(x * 12) * 45;
          const sway = Math.sin(waveOffset * 0.8 + x) * (3 + forestPulse * 4);
          ctx.beginPath();
          ctx.moveTo(x + sway, height * 0.76 - treeH);
          ctx.lineTo(x - 22 + sway, height * 0.76);
          ctx.lineTo(x + 22 + sway, height * 0.76);
          ctx.closePath();
          ctx.fill();
        }

        // Falling / Swaying leaves
        ctx.fillStyle = 'rgba(92, 180, 110, 0.35)';
        leaves.forEach(leaf => {
          leaf.x += leaf.speedX + (audioLevels.forest || 0.05) * 0.8;
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
      // LAYER 2: WATERFALL (Flowing cascade & splash mist)
      // Shown when Water is active OR in Default View
      // ==========================================
      if (hasWater || isDefaultView) {
        const fallLevel = (audioLevels.water || 0.15) * 1.6;
        ctx.strokeStyle = 'rgba(165, 230, 255, 0.38)';
        ctx.lineWidth = 1.6;
        waterfallColumns.forEach(w => {
          w.y += w.speedY + fallLevel * 3.5;
          if (w.y > height * 0.74) {
            w.y = height * 0.18;
            w.x = width * 0.5 + (Math.random() - 0.5) * 140;
          }
          ctx.beginPath();
          ctx.moveTo(w.x, w.y);
          ctx.lineTo(w.x + (Math.random() - 0.5) * 2, w.y + w.length);
          ctx.stroke();
        });

        // Bottom splash ripples & mist
        splashMist.forEach(m => {
          m.x += m.vx;
          m.y += m.vy;
          m.opacity *= 0.95;
          if (m.opacity < 0.05) {
            m.x = width * 0.5 + (Math.random() - 0.5) * 180;
            m.y = height * 0.74;
            m.vx = (Math.random() - 0.5) * 2.5;
            m.vy = -1.2 - Math.random() * 3.0;
            m.opacity = 0.3 + fallLevel * 0.25;
          }
          ctx.fillStyle = `rgba(180, 235, 255, ${m.opacity})`;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // ==========================================
      // LAYER 3: FLOWING RIVER & WAVES
      // Shown when Water, Rain is active OR in Default View
      // ==========================================
      if (hasWater || hasRain || isDefaultView) {
        const waterPulse = (audioLevels.water || audioLevels.rain || 0.15) * 2.0;
        waveOffset += 0.02 + waterPulse * 0.025;

        // Flowing Water Waves at bottom
        for (let layer = 0; layer < 3; layer++) {
          const yBase = height * 0.78 + layer * 20;
          const waveAmp = (8 + layer * 4) * (1 + waterPulse);
          ctx.fillStyle = layer === 0
            ? 'rgba(32, 90, 140, 0.24)'
            : layer === 1
              ? 'rgba(40, 110, 160, 0.34)'
              : 'rgba(16, 50, 85, 0.5)';

          ctx.beginPath();
          ctx.moveTo(0, height);
          for (let x = 0; x <= width; x += 25) {
            const y = yBase + Math.sin(x * 0.007 + waveOffset + layer * 1.5) * waveAmp;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fill();
        }
      }

      // ==========================================
      // LAYER 4: RAIN (Falling streaks)
      // ==========================================
      if (hasRain) {
        const rainPulse = (audioLevels.rain || 0.2) * 2.5;
        ctx.strokeStyle = 'rgba(180, 220, 255, 0.38)';
        ctx.lineWidth = 1.3;
        rainDrops.forEach(drop => {
          drop.y += drop.speedY + rainPulse * 2;
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
      // LAYER 5: WIND (Atmospheric drifting streamlines)
      // ==========================================
      if (hasWind || isDefaultView) {
        const windPulse = (audioLevels.wind || 0.1) * 1.8;
        ctx.strokeStyle = isDefaultView ? 'rgba(210, 235, 250, 0.12)' : 'rgba(210, 235, 250, 0.2)';
        ctx.lineWidth = 1.4;
        for (let w = 0; w < 4; w++) {
          const yTrack = height * (0.24 + w * 0.15);
          ctx.beginPath();
          for (let x = 0; x <= width; x += 30) {
            const y = yTrack + Math.sin(x * 0.005 + waveOffset * 1.5 + w) * (10 + windPulse * 12);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // ==========================================
      // LAYER 6: FIREPLACE (Rising embers & warm floor glow)
      // ==========================================
      if (hasFireplace) {
        const fireLevel = (audioLevels.fire || 0.2) * 2;
        const glowGrad = ctx.createRadialGradient(
          width * 0.5, height * 0.85, 20,
          width * 0.5, height * 0.85, width * 0.4
        );
        glowGrad.addColorStop(0, 'rgba(251, 146, 60, 0.22)');
        glowGrad.addColorStop(0.5, 'rgba(234, 88, 12, 0.08)');
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, width, height);

        embers.forEach(e => {
          e.y -= e.speedY + fireLevel;
          e.x += e.driftX + Math.sin(e.y * 0.05) * 0.8;
          if (e.y < height * 0.3) {
            e.y = height * 0.85;
            e.x = width * 0.35 + Math.random() * (width * 0.3);
          }
          ctx.fillStyle = `hsla(${e.hue}, 95%, 60%, ${e.opacity})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // ==========================================
      // LAYER 7: BIRDS (Silhouettes Soaring Across)
      // Shown when Birds is active OR in Default View
      // ==========================================
      if (hasBirds || isDefaultView) {
        ctx.fillStyle = 'rgba(235, 245, 255, 0.72)';
        birdEntities.forEach(b => {
          b.x += b.speedX + (audioLevels.birds || 0.08) * 1.5;
          b.wingPhase += 0.16;
          if (b.x > width + 60) {
            b.x = -60;
            b.y = 45 + Math.random() * (height * 0.35);
          }

          const wingY = Math.sin(b.wingPhase) * 6 * b.scale;
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.beginPath();
          ctx.moveTo(-10 * b.scale, wingY);
          ctx.quadraticCurveTo(0, -4 * b.scale, 10 * b.scale, wingY);
          ctx.quadraticCurveTo(0, 2 * b.scale, -10 * b.scale, wingY);
          ctx.fill();
          ctx.restore();
        });
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [hasForest, hasBirds, hasWater, hasRain, hasWind, hasFireplace, hasNature, isDefaultView]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
