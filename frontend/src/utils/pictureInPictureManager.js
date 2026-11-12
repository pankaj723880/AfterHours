/**
 * PictureInPictureManager:
 * Manages floating Picture-in-Picture window overlay for both Video Mode and Audio Mode.
 * - Video Mode: Requests native video PiP or Document PiP.
 * - Audio Mode: Generates a canvas stream with album artwork & track details,
 *   coupled with navigator.mediaSession action handlers (play, pause, previoustrack, nexttrack)
 *   to present a true OS-level floating overlay over other apps.
 */

let audioPipVideoElement = null;
let audioPipCanvas = null;
let audioPipStream = null;
let isAudioPipActive = false;

/**
 * Creates or updates the hidden canvas stream used to host audio PiP.
 */
function ensureAudioCanvas(song, isPlaying) {
  if (typeof document === 'undefined') return null;
  if (!audioPipCanvas) {
    audioPipCanvas = document.createElement('canvas');
    audioPipCanvas.width = 512;
    audioPipCanvas.height = 512;
  }
  const ctx = audioPipCanvas.getContext('2d');
  if (!ctx) return null;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#09090b');
  grad.addColorStop(0.5, '#18181b');
  grad.addColorStop(1, '#09090b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Border glow
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 500, 500);

  // Inner vinyl / artwork circle
  ctx.beginPath();
  ctx.arc(256, 210, 140, 0, Math.PI * 2);
  ctx.fillStyle = '#27272a';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#d97706';
  ctx.stroke();

  // Music icon / glyph in center
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎵', 256, 210);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  const title = (song?.title || 'Loopra Audio').slice(0, 28);
  ctx.fillText(title, 256, 400);

  // Artist / Status
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 20px sans-serif';
  const artist = (song?.channel || song?.artist || (isPlaying ? 'Playing • Loopra' : 'Paused • Loopra')).slice(0, 32);
  ctx.fillText(artist, 256, 440);

  return audioPipCanvas;
}

/**
 * Requests native Picture-in-Picture for Video Mode.
 * Looks for any active video element in the player container.
 */
export async function requestVideoPictureInPicture(containerElement) {
  if (typeof document === 'undefined') return false;

  try {
    // 1. Check if Document Picture-in-Picture API is supported (Chrome 111+)
    if ('documentPictureInPicture' in window && typeof window.documentPictureInPicture.requestWindow === 'function') {
      try {
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 380,
          height: 240
        });
        // Copy stylesheets into PiP window
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWindow.document.head.appendChild(style);
          } catch (_) {
            if (styleSheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = styleSheet.href;
              pipWindow.document.head.appendChild(link);
            }
          }
        });
        if (containerElement) {
          pipWindow.document.body.appendChild(containerElement.cloneNode(true));
        }
        return true;
      } catch (docPipErr) {
        console.warn('[PiP] Document PiP notice, falling back to standard video PiP:', docPipErr.message);
      }
    }

    // 2. Standard HTML5 Video element PiP
    const video = containerElement ? containerElement.querySelector('video') : document.querySelector('video');
    if (video && document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') {
      if (document.pictureInPictureElement !== video) {
        await video.requestPictureInPicture();
        return true;
      }
    }
  } catch (err) {
    console.warn('[PiP] Video PiP activation notice:', err.message);
  }
  return false;
}

/**
 * Requests floating Picture-in-Picture for Audio Mode using canvas video stream.
 */
export async function requestAudioPictureInPicture(song, isPlaying) {
  if (typeof document === 'undefined' || !document.pictureInPictureEnabled) return false;

  try {
    const canvas = ensureAudioCanvas(song, isPlaying);
    if (!canvas || typeof canvas.captureStream !== 'function') return false;

    if (!audioPipVideoElement) {
      audioPipVideoElement = document.createElement('video');
      audioPipVideoElement.muted = true;
      audioPipVideoElement.playsInline = true;
      audioPipVideoElement.autoplay = true;
      audioPipVideoElement.style.position = 'fixed';
      audioPipVideoElement.style.width = '1px';
      audioPipVideoElement.style.height = '1px';
      audioPipVideoElement.style.opacity = '0.01';
      audioPipVideoElement.style.pointerEvents = 'none';
      audioPipVideoElement.style.left = '-9999px';
      document.body.appendChild(audioPipVideoElement);
    }

    if (!audioPipStream) {
      audioPipStream = canvas.captureStream(10);
      audioPipVideoElement.srcObject = audioPipStream;
      await audioPipVideoElement.play().catch(() => { });
    }

    if (document.pictureInPictureElement !== audioPipVideoElement && typeof audioPipVideoElement.requestPictureInPicture === 'function') {
      await audioPipVideoElement.requestPictureInPicture();
      isAudioPipActive = true;
      audioPipVideoElement.addEventListener('leavepictureinpicture', () => {
        isAudioPipActive = false;
      }, { once: true });
      return true;
    }
  } catch (err) {
    console.warn('[PiP] Audio PiP stream activation notice:', err.message);
  }
  return false;
}

/**
 * Exits any active native Picture-in-Picture window.
 */
export async function exitPictureInPicture() {
  if (typeof document === 'undefined') return;
  try {
    if (document.pictureInPictureElement && typeof document.exitPictureInPicture === 'function') {
      await document.exitPictureInPicture();
    }
  } catch (_) { }
  isAudioPipActive = false;
}

/**
 * Returns whether any PiP window is currently active.
 */
export function isAnyPipActive() {
  if (typeof document === 'undefined') return false;
  return Boolean(document.pictureInPictureElement) || isAudioPipActive;
}

