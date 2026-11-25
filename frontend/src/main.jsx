import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import App, { socket } from './App.jsx';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BACKEND_URL } from './utils/apiUrl';
import { UiConfigProvider } from './context/UiConfigContext';

// Immediate non-blocking app-boot wake-up ping for Render cold-starts
if (typeof window !== 'undefined' && typeof fetch === 'function') {
  try {
    fetch(`${BACKEND_URL}/api/health`, { method: 'GET', cache: 'no-store' }).catch(() => {});
  } catch (_) {}
}

// Page Visibility & Background Playback Spoof for Brave Browser & Android Chrome:
// 1. Intercept document.hidden and document.visibilityState to always report visible.
// 2. Stop propagation of visibilitychange events at the capture phase.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    Object.defineProperty(document, 'hidden', {
      get: () => false,
      configurable: true
    });
    Object.defineProperty(document, 'visibilityState', {
      get: () => 'visible',
      configurable: true
    });
    window.addEventListener('visibilitychange', (e) => {
      e.stopImmediatePropagation();
    }, true);
    document.addEventListener('visibilitychange', (e) => {
      e.stopImmediatePropagation();
    }, true);
  } catch (err) {
    console.warn('[Loopra] Page visibility spoof notice:', err);
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '335095702236-g3n6b7mgq2d3vbdg9qj9vv53b3nuohs7.apps.googleusercontent.com';

// Handle stale chunk errors after deployment (Vite preload error) with infinite reload loop prevention
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite] Chunk preload error detected:', event);
    const retryKey = 'loopra_vite_preload_retry';
    const lastRetry = sessionStorage.getItem(retryKey);
    const now = Date.now();
    if (!lastRetry || now - parseInt(lastRetry, 10) > 15000) {
      sessionStorage.setItem(retryKey, String(now));
      window.location.reload();
    } else {
      console.warn('[Vite] Suppressed infinite reload loop on chunk error.');
    }
  });
}

// React Root Error Boundary to prevent black screen on runtime initialization errors
class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[Loopra Root ErrorBoundary]', error, info);
  }

  handleReload = () => {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const reg of regs) reg.update();
        });
      }
    } catch (_) {}
    window.location.reload();
  };

  handleResetAndReload = () => {
    try {
      if (typeof window !== 'undefined') {
        // Clear session storage and transient caches
        sessionStorage.clear();
        if ('caches' in window) {
          caches.keys().then((keys) => {
            keys.forEach((k) => caches.delete(k));
          });
        }
      }
    } catch (_) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'A transient script error occurred.';
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#09090b',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            maxWidth: '440px',
            background: 'rgba(24, 24, 27, 0.85)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '20px',
            padding: '32px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#f59e0b' }}>
              Loopra Loading Recovery
            </h1>
            <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Loopra encountered a temporary script initialization issue. You can reload or reset your active session.
            </p>
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#d4d4d8',
              textAlign: 'left',
              wordBreak: 'break-all',
              maxHeight: '90px',
              overflowY: 'auto',
              marginBottom: '20px'
            }}>
              {errorMsg}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: '#f59e0b',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'opacity 0.2s'
                }}
              >
                Reload Loopra
              </button>
              <button
                onClick={this.handleResetAndReload}
                style={{
                  backgroundColor: 'rgba(39, 39, 42, 0.8)',
                  color: '#e4e4e7',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'background 0.2s'
                }}
              >
                Reset Session & Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <UiConfigProvider socket={socket}>
        <App />
      </UiConfigProvider>
    </GoogleOAuthProvider>
  </RootErrorBoundary>
);

// In development, automatically unregister stale Service Workers to guarantee live Vite updates
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister();
      console.log('[Dev] Unregistered stale service worker on localhost');
    }
  });
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => {
      for (const k of keys) caches.delete(k);
    });
  }
}

// Register the Service Worker for PWA support in production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Service Worker Registered!', reg);
        // Actively check for updates on each app open
        reg.update().catch(() => {});
      })
      .catch((err) => console.warn('Service Worker Registration notice:', err?.message || err));
  });

  // Automatically refresh when a new service worker version takes over
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}