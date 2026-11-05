/**
 * Gemini Live API WebSocket Bridge for Loopra
 * 
 * Provides real-time bidirectional audio streaming over Socket.io:
 * - Uses Gemini Live API (gemini-3.8-live or gemini-2.5-flash-native-audio-latest)
 * - Raw PCM 16kHz audio streaming input
 * - Low-latency streaming audio response output (PCM 24kHz)
 * - Built-in server VAD and client barge-in interruption handling
 */

import { GoogleGenAI } from '@google/genai';
import { GEMINI_CONFIG, getAvailableKeys } from '../config/geminiConfig.js';
import { LOOPRA_VOICE_SYSTEM_INSTRUCTION } from './chatBuddyLlmService.js';
import { sanitizeLogMessage } from './geminiKeyManager.js';

class GeminiLiveBridge {
  constructor() {
    this.activeLiveSessions = new Map(); // socketId -> { session, aiClient }
  }

  /**
   * Initializes Live API listeners on a connected Socket.io socket.
   */
  registerSocket(socket) {
    socket.on('gemini_live_start', async (data = {}) => {
      await this.startLiveSession(socket, data);
    });

    socket.on('gemini_live_audio_chunk', (data) => {
      this.handleAudioChunk(socket.id, data);
    });

    socket.on('gemini_live_text', (data) => {
      this.handleTextInput(socket.id, data);
    });

    socket.on('gemini_live_interrupt', () => {
      this.handleInterruption(socket.id);
    });

    socket.on('gemini_live_stop', () => {
      this.closeLiveSession(socket.id);
    });

    socket.on('disconnect', () => {
      this.closeLiveSession(socket.id);
    });
  }

  async startLiveSession(socket, { lang = 'hi-IN', currentMusicState = null } = {}) {
    this.closeLiveSession(socket.id);

    const keys = getAvailableKeys();
    if (keys.length === 0) {
      socket.emit('gemini_live_error', { message: 'Gemini API key not configured on server.' });
      return;
    }

    const liveModel = GEMINI_CONFIG.liveModel || 'gemini-3.8-live';

    try {
      const ai = new GoogleGenAI({ apiKey: keys[0].key });

      let sysInstruction = LOOPRA_VOICE_SYSTEM_INSTRUCTION;
      if (currentMusicState?.title) {
        sysInstruction += `\nCurrently playing music: "${currentMusicState.title}" by ${currentMusicState.artist || 'Unknown'}.`;
      }

      console.log(`[GeminiLiveBridge] Connecting session for socket ${socket.id} using model ${liveModel}`);

      const session = await ai.live.connect({
        model: liveModel,
        config: {
          responseModalities: ['audio'],
          systemInstruction: { parts: [{ text: sysInstruction }] }
        },
        callbacks: {
          onopen: () => {
            console.log(`[GeminiLiveBridge] Live session open for ${socket.id}`);
            socket.emit('gemini_live_ready', { model: liveModel });
          },
          onmessage: (response) => {
            const content = response.serverContent;
            if (content?.modelTurn?.parts) {
              for (const part of content.modelTurn.parts) {
                if (part.inlineData && part.inlineData.data) {
                  socket.emit('gemini_live_audio_chunk', {
                    audioData: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000'
                  });
                }
              }
            }
            if (content?.outputTranscription?.text) {
              socket.emit('gemini_live_transcript', { text: content.outputTranscription.text, role: 'model' });
            }
            if (content?.inputTranscription?.text) {
              socket.emit('gemini_live_transcript', { text: content.inputTranscription.text, role: 'user' });
            }
            if (content?.interrupted) {
              socket.emit('gemini_live_interrupted');
            }
          },
          onerror: (err) => {
            console.warn(`[GeminiLiveBridge] Live session error for ${socket.id}:`, sanitizeLogMessage(err.message));
            socket.emit('gemini_live_error', { message: 'Live connection issue, falling back to standard voice mode.' });
          },
          onclose: () => {
            console.log(`[GeminiLiveBridge] Live session closed for ${socket.id}`);
            socket.emit('gemini_live_closed');
          }
        }
      });

      this.activeLiveSessions.set(socket.id, { session, socket });
    } catch (err) {
      console.warn(`[GeminiLiveBridge] Live connect error for ${socket.id}:`, sanitizeLogMessage(err.message));
      socket.emit('gemini_live_error', {
        message: 'Live API connection unavailable. Using ultra-fast standard voice mode.',
        fallback: true
      });
    }
  }

  handleAudioChunk(socketId, { audioData, mimeType = 'audio/pcm;rate=16000' } = {}) {
    const entry = this.activeLiveSessions.get(socketId);
    if (!entry || !entry.session || !audioData) return;

    try {
      entry.session.sendRealtimeInput({
        audio: { data: audioData, mimeType }
      });
    } catch (err) {
      console.warn(`[GeminiLiveBridge] sendAudio error for ${socketId}:`, sanitizeLogMessage(err.message));
    }
  }

  handleTextInput(socketId, { text } = {}) {
    const entry = this.activeLiveSessions.get(socketId);
    if (!entry || !entry.session || !text) return;

    try {
      entry.session.sendRealtimeInput({ text });
    } catch (err) {
      console.warn(`[GeminiLiveBridge] sendText error for ${socketId}:`, sanitizeLogMessage(err.message));
    }
  }

  handleInterruption(socketId) {
    const entry = this.activeLiveSessions.get(socketId);
    if (!entry || !entry.session) return;

    try {
      entry.socket.emit('gemini_live_interrupted');
    } catch (_) {}
  }

  closeLiveSession(socketId) {
    const entry = this.activeLiveSessions.get(socketId);
    if (!entry) return;

    try {
      if (entry.session && typeof entry.session.close === 'function') {
        entry.session.close();
      }
    } catch (_) {}

    this.activeLiveSessions.delete(socketId);
  }
}

export const geminiLiveBridge = new GeminiLiveBridge();
export default geminiLiveBridge;

