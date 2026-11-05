/**
 * ChatBuddy Client Service
 * 
 * Orchestrates the Two-Layer Intent & Conversation Pipeline:
 * Layer A: 0ms fast local rule engine (play, pause, resume, next, prev, volume, mute)
 * Layer B: LLM API (/api/chat) for all nuanced conversations, recommendations, and actions
 */

import { parseCommandToAction, INTENT_CATEGORIES } from './commandActionEngine.js';

class ChatBuddyClient {
  constructor() {
    this.history = []; // Keep last 10 messages
    this.inFlightRequests = new Map();
  }

  getHistory() {
    return this.history.slice(-10);
  }

  addHistory(role, text) {
    this.history.push({ role, text, timestamp: Date.now() });
    if (this.history.length > 20) {
      this.history = this.history.slice(-10);
    }
  }

  clearHistory() {
    this.history = [];
  }

  /**
   * Fast Local Rule Layer
   * Evaluates if text is an obvious local media command.
   * Returns action object if matched, or null if it should go to LLM.
   */
  evaluateLocalCommand(text = '', context = {}) {
    const action = parseCommandToAction(text, context);
    if (!action) return null;

    // Obvious local media controls that MUST run instantly in 0ms without API call
    switch (action.intent) {
      case INTENT_CATEGORIES.PAUSE_PLAYBACK:
        return {
          isLocalFast: true,
          type: 'command',
          action: 'pause',
          params: {},
          reply: 'Music pause kar diya hai.'
        };
      case INTENT_CATEGORIES.RESUME_PLAYBACK:
        return {
          isLocalFast: true,
          type: 'command',
          action: 'resume',
          params: {},
          reply: 'Music resume kar diya.'
        };
      case INTENT_CATEGORIES.NEXT_TRACK:
        return {
          isLocalFast: true,
          type: 'command',
          action: 'next',
          params: {},
          reply: 'Agla gaana play kar rahi hoon.'
        };
      case INTENT_CATEGORIES.PREVIOUS_TRACK:
        return {
          isLocalFast: true,
          type: 'command',
          action: 'previous',
          params: {},
          reply: 'Pichla gaana chala rahi hoon.'
        };
      case INTENT_CATEGORIES.CHANGE_VOLUME:
        return {
          isLocalFast: true,
          type: 'command',
          action: 'volume',
          params: { level: action.value },
          reply: `Volume ${action.value}% par set kar diya.`
        };
      default:
        // Everything else (complex play, open, avatar gestures, casual chats) goes through LLM pipeline
        return null;
    }
  }

  /**
   * Sends user message through the Two-Layer Pipeline.
   */
  async sendMessage(text = '', backendUrl = '', context = {}) {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      return {
        type: 'chat',
        action: 'none',
        params: {},
        reply: 'Boliye, main sun rahi hoon!'
      };
    }

    // Deduplication guard: if identical request is currently in-flight, reuse promise
    const dedupeKey = cleanText.toLowerCase();
    if (this.inFlightRequests.has(dedupeKey)) {
      return this.inFlightRequests.get(dedupeKey);
    }

    const requestPromise = (async () => {
      // 1. LAYER A: Fast Local Rule Engine (0ms, No API Call)
      const localResult = this.evaluateLocalCommand(cleanText, context);
      if (localResult) {
        this.addHistory('user', cleanText);
        this.addHistory('model', localResult.reply);
        return localResult;
      }

      // 2. LAYER B: LLM Engine via /api/chat
      const cleanBase = (backendUrl || '').replace(/\/+$/, '');
      const endpoint = cleanBase ? `${cleanBase}/api/chat` : '/api/chat';

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanText,
            history: this.getHistory(),
            currentMusicState: context.currentSong ? {
              title: context.currentSong.title,
              artist: context.currentSong.artist,
              isPlaying: Boolean(context.isPlaying),
              volume: context.volume
            } : (context.currentMusicState || null)
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data && (data.type === 'chat' || data.type === 'command')) {
            this.addHistory('user', cleanText);
            this.addHistory('model', data.reply);
            return {
              isLocalFast: false,
              type: data.type,
              action: data.action || 'none',
              params: data.params || {},
              reply: data.reply,
              isError: Boolean(data.isError || data.isFallback),
              error: data.error
            };
          }
        }
      } catch (err) {
        console.warn('[ChatBuddyClient] /api/chat error, using graceful fallback:', err.message);
      }

      // 3. Graceful Fallback if LLM endpoint fails or network error
      const fallbackReply = 'AI service se connect nahi ho pa raha hai. Kripya thodi der baad try karein!';
      return {
        isLocalFast: false,
        type: 'chat',
        action: 'none',
        params: {},
        reply: fallbackReply,
        isError: true,
        error: 'NETWORK_ERROR'
      };
    })();

    this.inFlightRequests.set(dedupeKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      this.inFlightRequests.delete(dedupeKey);
    }
  }
  /**
   * Fetches a dynamic startup greeting from Gemini for session initialization.
   */
  async getStartupGreeting(backendUrl = '', { lang = 'hi-IN', currentMusicState = null } = {}) {
    const cleanBase = (backendUrl || '').replace(/\/+$/, '');
    const endpoint = cleanBase ? `${cleanBase}/api/chat/greeting` : '/api/chat/greeting';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, currentMusicState })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.greeting) {
          return data.greeting;
        }
      }
    } catch (_) {}

    return 'Hey! Main Loopra hoon, aapki AI music companion. Boliye, aaj kya baat karenge ya kya sunenge?';
  }
}

export const chatBuddyClient = new ChatBuddyClient();
export default chatBuddyClient;

