import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';

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

// Suppress known benign YouTube IFrame API cross-origin postMessage handshake console warnings
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = function (...args) {
    const message = args.map(arg => (typeof arg === 'string' ? arg : (arg?.message || ''))).join(' ');
    if (
      message.includes("Failed to execute 'postMessage' on 'DOMWindow'") ||
      (message.includes('The target origin provided') && message.includes('youtube.com'))
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '335095702236-g3n6b7mgq2d3vbdg9qj9vv53b3nuohs7.apps.googleusercontent.com';

// Handle stale chunk errors after deployment (Vite preload error)
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite] Chunk preload error detected, reloading for latest deployment...', event);
    window.location.reload();
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

  render() {
    if (this.state.hasError) {
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
            <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Loopra encountered a temporary script initialization issue. Click below to refresh with the latest version.
            </p>
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
                width: '100%'
              }}
            >
              Reload Loopra
            </button>
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
      <App />
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
      .then((reg) => console.log('Service Worker Registered!', reg))
      .catch((err) => console.warn('Service Worker Registration notice:', err?.message || err));
  });
}