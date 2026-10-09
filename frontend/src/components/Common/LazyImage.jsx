import React, { useState } from 'react';
import DEFAULT_COVER from '../../assets/default-cover.png';

export const LazyImage = ({ src, alt, className, ...props }) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(DEFAULT_COVER); // Silent visual fallback without broken browser icon
    }
  };

  return (
    <img
      src={imgSrc || DEFAULT_COVER}
      alt={alt || 'Track thumbnail'}
      onError={handleError}
      className={className}
      {...props}
    />
  );
};