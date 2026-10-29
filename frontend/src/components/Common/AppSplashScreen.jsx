import { useEffect } from 'react';

/**
 * AppSplashScreen - Completely deactivated across all screens (mobile, tablet, desktop).
 * Immediately finishes and renders nothing to ensure instantaneous direct app launch.
 */
export default function AppSplashScreen({ isAppReady = false, onFinished }) {
  useEffect(() => {
    if (typeof onFinished === 'function') {
      onFinished();
    }
  }, [onFinished]);

  return null;
}
