import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, GripVertical, PictureInPicture, X } from 'lucide-react';

/**
 * FloatingAudioControlPill:
 * A compact, freely draggable (touch + mouse) floating control pill
 * for in-app audio playback (Prev, Play/Pause, Next) with Picture-in-Picture trigger.
 */
export default function FloatingAudioControlPill({
  currentSong,
  isPlaying,
  onTogglePlayPause,
  onPrevTrack,
  onNextTrack,
  onTriggerPip,
  isPipEnabled = true
}) {
  // Track position: default bottom-right above bottom nav / bottom player
  const [position, setPosition] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('loopra_floating_pill_pos');
        if (saved) return JSON.parse(saved);
      } catch (_) { }
      const w = window.innerWidth || 360;
      const h = window.innerHeight || 640;
      return { x: Math.max(16, w - 240), y: Math.max(80, h - 145) };
    }
    return { x: 40, y: 400 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0, moved: false });
  const pillRef = useRef(null);

  // Drag handlers (Pointer events unified for mouse & touch)
  const handlePointerDown = (e) => {
    // Only drag from the drag handle or pill container background, not action buttons
    if (e.target.closest('button.action-btn')) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
      moved: false
    };

    const handlePointerMove = (moveEvt) => {
      const dx = moveEvt.clientX - dragStartRef.current.mouseX;
      const dy = moveEvt.clientY - dragStartRef.current.mouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragStartRef.current.moved = true;
      }
      const maxX = (window.innerWidth || 360) - 210;
      const maxY = (window.innerHeight || 640) - 60;
      const nextX = Math.min(Math.max(10, dragStartRef.current.startX + dx), maxX);
      const nextY = Math.min(Math.max(60, dragStartRef.current.startY + dy), maxY);
      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      setPosition((curr) => {
        try {
          localStorage.setItem('loopra_floating_pill_pos', JSON.stringify(curr));
        } catch (_) { }
        return curr;
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  if (!currentSong) return null;

  return (
    <div
      ref={pillRef}
      onPointerDown={handlePointerDown}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: 'none'
      }}
      className={`fixed top-0 left-0 z-[9990] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-950/95 text-white border border-amber-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(245,158,11,0.15)] backdrop-blur-2xl select-none transition-shadow ${isDragging ? 'cursor-grabbing shadow-amber-500/30 scale-105' : 'cursor-grab'
        }`}
      title="Draggable Mini Player (Drag anywhere to reposition)"
    >
      {/* Drag Grip Handle */}
      <div className="flex items-center text-neutral-400 hover:text-amber-400 p-0.5 cursor-grab shrink-0">
        <GripVertical size={14} />
      </div>

      {/* Tiny Track Thumbnail / Indicator */}
      <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 overflow-hidden">
        {isPlaying ? (
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
        )}
      </div>

      {/* Action: Previous */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPrevTrack?.();
        }}
        className="action-btn p-1.5 rounded-full hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 transition cursor-pointer active:scale-90"
        title="Previous Track"
        aria-label="Previous Track"
      >
        <SkipBack size={15} />
      </button>

      {/* Action: Play/Pause */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlayPause?.();
        }}
        className="action-btn p-1.5 rounded-full bg-amber-500 text-neutral-950 hover:bg-amber-400 transition cursor-pointer active:scale-90 shadow-md font-bold"
        title={isPlaying ? "Pause" : "Play"}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={15} className="fill-current" /> : <Play size={15} className="fill-current translate-x-0.5" />}
      </button>

      {/* Action: Next */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNextTrack?.();
        }}
        className="action-btn p-1.5 rounded-full hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 transition cursor-pointer active:scale-90"
        title="Next Track"
        aria-label="Next Track"
      >
        <SkipForward size={15} />
      </button>

      {/* Action: Trigger Floating Picture-in-Picture (PiP) */}
      {typeof onTriggerPip === 'function' && isPipEnabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTriggerPip();
          }}
          className="action-btn p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 transition cursor-pointer active:scale-90 border-l border-neutral-800 pl-2 shrink-0"
          title="Float Mini Player (Picture-in-Picture)"
          aria-label="Float Mini Player (Picture-in-Picture)"
        >
          <PictureInPicture size={14} />
        </button>
      )}
    </div>
  );
}

