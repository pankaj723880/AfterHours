import React, { useState, useEffect } from 'react';
import { getAvatarUrl, getUserInitials } from '../../utils/avatar';

/**
 * Universal Theme-Aware User Avatar component for Loopra:
 * - Dynamically renders the uploaded photo (Google OAuth, relative /uploads/, or blob/base64 preview)
 * - Renders a sleek, text-initials fallback avatar if no image exists or if network load fails
 * - Theme-Aware Subtle Overlay & Box Shadow:
 *   Applies a gentle theme-tinted vignette overlay and soft perimeter box-shadow
 *   using active theme CSS design tokens (--accent-color, --accent-rgb).
 *   Face and photograph details remain 100% crisp, clear, and recognizable.
 * - Pointer-events: none on the overlay ensures clicking and upload buttons are never obstructed.
 */
export default function UserAvatar({
  user,
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  fallbackClassName = 'w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 text-neutral-950 font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-inner uppercase select-none',
  fallbackInitial,
  themeOverlay = true // Enable theme-aware dynamic overlay
}) {
  const targetSrc = getAvatarUrl(src || user);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [targetSrc]);

  const initials = fallbackInitial || getUserInitials(user);

  if (targetSrc && !loadFailed) {
    return (
      <div className="relative w-full h-full overflow-hidden rounded-[inherit] select-none group">
        {/* Base Layer: Original Crisp Photograph */}
        <img
          src={targetSrc}
          alt={alt || (typeof user === 'object' ? (user?.displayName || user?.username || 'Avatar') : 'Avatar')}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          loading="lazy"
          decoding="async"
          className={`${className} transition-transform duration-300 group-hover:scale-105`}
          onError={() => setLoadFailed(true)}
        />

        {/* Dynamic Theme-Aware Subtle Tint & Perimeter Glow (Rendered via CSS variables) */}
        {themeOverlay && (
          <>
            {/* Soft theme-tinted bottom gradient vignette preserving facial clarity */}
            <div
              className="absolute inset-0 pointer-events-none rounded-[inherit] mix-blend-soft-light transition-opacity duration-300"
              style={{
                background: `linear-gradient(180deg, rgba(var(--accent-rgb, 245, 158, 11), 0.04) 0%, rgba(var(--accent-rgb, 245, 158, 11), 0.16) 100%)`,
                opacity: 0.85
              }}
              aria-hidden="true"
            />

            {/* Subtle perimeter border glow matching active theme */}
            <div
              className="absolute inset-0 pointer-events-none rounded-[inherit] transition-all duration-300"
              style={{
                boxShadow: `inset 0 0 0 1px rgba(var(--accent-rgb, 245, 158, 11), 0.22), 0 0 12px rgba(var(--accent-rgb, 245, 158, 11), 0.15)`
              }}
              aria-hidden="true"
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className={fallbackClassName} aria-hidden="true">
      {initials}
    </div>
  );
}
