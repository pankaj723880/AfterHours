import { useEffect, useRef, useCallback } from 'react';

/**
 * useAndroidBackHandler
 * 
 * Global Android hardware / system gesture Back button handler for SPA / TWA environments.
 * 
 * Ensures:
 * 1. Hardware/system back press first dismisses any open modals, dialogs, drawers, expanded players or overlays.
 * 2. If no modal is open, navigates backward in the internal SPA history stack until reaching root Home.
 * 3. Only when completely on root Home with all overlays closed does double-back tap exit/minimize the app.
 * 4. Communicates real-time back-navigation capability with Android native container via `window.LoopraAndroid.setCanGoBack`.
 */
export function useAndroidBackHandler({
  isOverlayActive,
  onGoBack,
  isAtHomeRoot,
  showToast
}) {
  const isOverlayActiveRef = useRef(isOverlayActive);
  const onGoBackRef = useRef(onGoBack);
  const isAtHomeRootRef = useRef(isAtHomeRoot);
  const showToastRef = useRef(showToast);
  const lastBackPressTimeRef = useRef(0);
  const isNavigatingBackRef = useRef(false);

  useEffect(() => {
    isOverlayActiveRef.current = isOverlayActive;
  }, [isOverlayActive]);

  useEffect(() => {
    onGoBackRef.current = onGoBack;
  }, [onGoBack]);

  useEffect(() => {
    isAtHomeRootRef.current = isAtHomeRoot;
  }, [isAtHomeRoot]);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // Continuously inform Android native layer (MainActivity.java) whether webView can handle back
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canGoBackInApp = Boolean(isOverlayActive || !isAtHomeRoot);
    try {
      window.LoopraAndroid?.setCanGoBack?.(canGoBackInApp);
    } catch (_) {}
  }, [isOverlayActive, isAtHomeRoot]);

  // Maintain loopraGuard history state entry to trap system back navigation in browsers and TWA
  const ensureGuardPushed = useCallback(() => {
    if (typeof window === 'undefined' || !window.history?.pushState) return;
    try {
      if (!window.history.state || !window.history.state.loopraGuard) {
        window.history.pushState({ loopraGuard: true }, '');
      }
    } catch (_) {}
  }, []);

  // Initialize guard on mount
  useEffect(() => {
    ensureGuardPushed();
  }, [ensureGuardPushed]);

  // Ensure guard exists whenever an overlay or subview opens
  useEffect(() => {
    if (isOverlayActive || !isAtHomeRoot) {
      ensureGuardPushed();
    }
  }, [isOverlayActive, isAtHomeRoot, ensureGuardPushed]);

  // Handle popstate (Hardware back, browser back, system back swipe)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (event) => {
      // Prevent rapid concurrent back presses
      if (isNavigatingBackRef.current) return;
      isNavigatingBackRef.current = true;
      setTimeout(() => {
        isNavigatingBackRef.current = false;
      }, 150);

      const hasOverlay = Boolean(isOverlayActiveRef.current);
      const isAtHome = Boolean(isAtHomeRootRef.current);

      // 1. If an overlay/modal is open, or if we are not at home root, intercept and close / go back
      if (hasOverlay || !isAtHome) {
        // Re-push guard state immediately so subsequent back presses are also trapped
        ensureGuardPushed();
        try {
          onGoBackRef.current?.();
        } catch (e) {
          console.warn('[useAndroidBackHandler] onGoBack error:', e);
        }
        return;
      }

      // 2. Already at Home Root with NO overlays or modals open:
      // Allow double-tap to exit within 2 seconds
      const now = Date.now();
      if (now - lastBackPressTimeRef.current < 2000) {
        // Exit cleanly - do not re-push guard, allowing Android/TWA to minimize/exit
        return;
      }

      // First back press at root: inform user and re-trap history
      lastBackPressTimeRef.current = now;
      showToastRef.current?.('Press back again to exit', 2000);
      ensureGuardPushed();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [ensureGuardPushed]);

  // Also listen for native container custom event 'loopra-native-control' with action 'back'
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleNativeControl = (e) => {
      if (e.detail === 'back') {
        try {
          onGoBackRef.current?.();
        } catch (err) {
          console.warn('[useAndroidBackHandler] Native control back error:', err);
        }
      }
    };

    window.addEventListener('loopra-native-control', handleNativeControl);
    return () => {
      window.removeEventListener('loopra-native-control', handleNativeControl);
    };
  }, []);
}

export default useAndroidBackHandler;

