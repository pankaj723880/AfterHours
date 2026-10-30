/**
 * Client service for Loopra AI Music Companion & External Song Recognition.
 */
export const aiMusicCompanionClient = {
  /**
   * Fetches service status & configuration.
   */
  async getContext(backendUrl, authToken = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    try {
      const res = await fetch(`${backendUrl}/api/ai-music/context`, {
        method: 'GET',
        headers
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[AiMusicClient] Context notice:', err.message);
      return {
        geminiConfigured: false,
        recognition: { configured: false, provider: 'none' }
      };
    }
  },

  /**
   * Sends a conversational message to Loopra AI with streaming SSE support for high speed.
   */
  async sendChat(backendUrl, authToken = null, { message, currentTrack = null, history = [], onChunk = null }) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const url = onChunk ? `${backendUrl}/api/ai-music/chat?stream=true` : `${backendUrl}/api/ai-music/chat`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        currentTrack,
        history
      })
    });

    if (!res.ok) {
      let errMsg = 'Failed to get response from Loopra AI';
      try {
        const data = await res.json();
        if (data.error) errMsg = data.error;
      } catch (e) {}
      throw new Error(errMsg);
    }

    // If streaming handler provided and body readable
    if (onChunk && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let donePayload = null;
      let textAccumulator = '';

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                if (data.type === 'chunk') {
                  textAccumulator += data.text || '';
                  onChunk(data.text);
                } else if (data.type === 'done') {
                  donePayload = data;
                }
              } catch (e) {}
            }
          }
        }
      } catch (streamErr) {
        console.warn('[AiMusicClient] Stream reader notice:', streamErr);
      }

      if (donePayload) return donePayload;
      return {
        success: true,
        reply: textAccumulator || "Here's what I found for you in Loopra:",
        tracks: [],
        action: null
      };
    }

    // Default non-streaming JSON path (only when onChunk is not provided)
    return await res.json();
  },

  /**
   * Sends microphone audio recording to backend for identification.
   */
  async identifySong(backendUrl, authToken = null, { audioBlob, mimeType = 'audio/webm', durationSeconds = 6 }) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    // Convert Blob to Base64
    const audioBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    const res = await fetch(`${backendUrl}/api/ai-music/identify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        audioBase64,
        mimeType,
        durationSeconds
      })
    });

    if (!res.ok) {
      let errMsg = 'Song identification request failed';
      try {
        const data = await res.json();
        if (data.error) errMsg = data.error;
      } catch (e) {}
      throw new Error(errMsg);
    }

    return await res.json();
  }
};
