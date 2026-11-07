import { useState, useEffect, useCallback, useRef } from 'react';
import { USE_V2_AVATAR_ROAMING_SUITE } from '../constants/featureFlags';

/**
 * usePageWaypoints
 * DOM Coordinate Scanner hook for autonomous 3D Avatar roaming, sitting & dancing.
 * 
 * Automatically detects interactive landing spots on the page:
 * - Cards & Banners: .music-card, .hero-banner, .station-header, .vinyl-container, etc. -> 'sit' / 'perch'
 * - Open Floor: bottom screen lanes above player/navbar and horizontal spaces between content sections -> 'walk' / 'run'
 * 
 * Updates waypoints on route change (location.pathname), window resize, and DOM mutations.
 */
export function usePageWaypoints(isBottomPlayerVisible = false) {
  const [waypoints, setWaypoints] = useState({ sitSpots: [], walkLanes: [] });
  const mutationObserverRef = useRef(null);

  const scanDOM = useCallback(() => {
    if (!USE_V2_AVATAR_ROAMING_SUITE) {
      setWaypoints({ sitSpots: [], walkLanes: [] });
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width <= 768;

    // Usable safe boundary margins
    const bottomNavHeight = isMobile ? 64 : 0;
    const playerHeight = isBottomPlayerVisible ? (isMobile ? 74 : 84) : 0;
    const maxSafeY = height - bottomNavHeight - playerHeight - 80;
    const minSafeY = 80; // Below top Navbar

    // 1. Detect Sit / Perch Target Elements (Cards, Banners, Station Headers, Playlists)
    const sitSelectors = [
      '.music-card',
      '.hero-banner',
      '.station-header',
      '.vinyl-container',
      '[data-station-card]',
      '.featured-card',
      'article',
      '.turntable-container'
    ];

    const foundElements = document.querySelectorAll(sitSelectors.join(', '));
    const sitSpots = [];

    foundElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      // Must be currently visible in the active viewport
      if (
        rect.width > 60 &&
        rect.height > 60 &&
        rect.top >= minSafeY &&
        rect.top <= maxSafeY &&
        rect.left >= 0 &&
        rect.right <= width
      ) {
        sitSpots.push({
          type: 'sit',
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top - 15), // Perch right on top edge
          label: el.getAttribute('aria-label') || el.innerText?.slice(0, 20) || 'Card Perch'
        });
      }
    });

    // 2. Compute Walk / Run Lanes (Open Floor areas above mini-player and section margins)
    const walkLanes = [];
    const floorY = Math.max(minSafeY + 100, maxSafeY - 40);

    walkLanes.push({
      type: 'walk',
      x: Math.round(width * 0.25),
      y: floorY,
      label: 'Floor Left'
    });
    walkLanes.push({
      type: 'walk',
      x: Math.round(width * 0.5),
      y: floorY,
      label: 'Floor Center'
    });
    walkLanes.push({
      type: 'walk',
      x: Math.round(width * 0.75),
      y: floorY,
      label: 'Floor Right'
    });

    // Mid-screen corridor if desktop
    if (!isMobile) {
      walkLanes.push({
        type: 'walk',
        x: Math.round(width * 0.35),
        y: Math.round(height * 0.45),
        label: 'Mid Corridor Left'
      });
      walkLanes.push({
        type: 'walk',
        x: Math.round(width * 0.65),
        y: Math.round(height * 0.45),
        label: 'Mid Corridor Right'
      });
    }

    setWaypoints({ sitSpots, walkLanes });
  }, [isBottomPlayerVisible]);

  useEffect(() => {
    scanDOM();

    const handleResize = () => scanDOM();
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleResize, { passive: true });
    window.addEventListener('popstate', handleResize, { passive: true });

    // Observe DOM changes to pick up dynamically loaded cards & stations on route changes
    if (typeof MutationObserver !== 'undefined' && document.body) {
      let debounceTimer = null;
      mutationObserverRef.current = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scanDOM, 350);
      });
      mutationObserverRef.current.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
      window.removeEventListener('popstate', handleResize);
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
      }
    };
  }, [scanDOM]);

  return waypoints;
}

export default usePageWaypoints;

