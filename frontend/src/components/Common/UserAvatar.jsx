import React, { useState, useEffect } from 'react';
import { getAvatarUrl, getUserInitials } from '../../utils/avatar';

/**
 * Clean User Avatar component:
 * - Completely avoids 404 image requests to backend /uploads/ paths
 * - Renders a sleek, text-initials fallback avatar
 * - Supports valid external avatar URLs (Google OAuth / https) when available
 */
export default function UserAvatar({
  user,
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  fallbackClassName = 'w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 text-neutral-950 font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-inner uppercase select-none',
  fallbackInitial
}) {
  const targetSrc = getAvatarUrl(src || user);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [targetSrc]);

  const initials = fallbackInitial || getUserInitials(user);

  if (targetSrc && !loadFailed && !targetSrc.includes('/uploads/')) {
    return (
      <img
        src={targetSrc}
        alt={alt || (typeof user === 'object' ? (user?.displayName || user?.username || 'Avatar') : 'Avatar')}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        loading="lazy"
        decoding="async"
        className={className}
        onError={() => setLoadFailed(true)}
      />
    );
  }

  return (
    <div className={fallbackClassName} aria-hidden="true">
      {initials}
    </div>
  );
}

