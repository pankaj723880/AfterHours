import React, { useState, useEffect } from 'react';
import { getAvatarUrl, getUserInitials } from '../../utils/avatar';

/**
 * Universal UserAvatar component:
 * - Automatically resolves local upload paths (/uploads/...) with BACKEND_URL
 * - Handles Google OAuth avatar URLs with referrerPolicy="no-referrer"
 * - Gracefully falls back to stylish initials on 404/image loading error without showing broken image icon
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

  // If the targetSrc changes (e.g. user uploaded new avatar or switched accounts), reset error state
  useEffect(() => {
    setLoadFailed(false);
  }, [targetSrc]);

  const initials = fallbackInitial || getUserInitials(user);

  if (targetSrc && !loadFailed) {
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

