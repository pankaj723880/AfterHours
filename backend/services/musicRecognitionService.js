import { GoogleGenAI } from '@google/genai';

/**
 * Gemini-Powered Music Recognition Service
 * Analyzes audio snippets using Gemini API multimodal audio understanding.
 * 
 * - Zero third-party paid song recognition APIs (No ACRCloud, AudD, AcoustID).
 * - Secured through backend GEMINI_API_KEY environment variable.
 * - Transient processing: recorded audio is never permanently saved to disk or DB.
 * - Distinguishes verified vs probable vs unknown detections without hallucination.
 */
export const musicRecognitionService = {
  /**
   * Initializes GoogleGenAI client using backend environment variables.
   */
  getClient() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return null;
    }
    return new GoogleGenAI({ apiKey: apiKey.trim() });
  },

  /**
   * Checks whether Gemini API credentials are configured.
   */
  isConfigured() {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    return Boolean(key && typeof key === 'string' && key.trim().length > 10);
  },

  /**
   * Returns details about the active recognition provider.
   */
  getProviderInfo() {
    const configured = this.isConfigured();
    const model = process.env.GEMINI_RECOGNITION_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    return {
      provider: 'gemini',
      model,
      configured,
      requiredEnvVars: configured ? [] : ['GEMINI_API_KEY']
    };
  },

  /**
   * Core audio recognition handler using Gemini multimodal audio analysis.
   * 
   * @param {Object} params
   * @param {string} params.audioBase64 - Base64 encoded audio sample (WebM, WAV, MP4, etc.)
   * @param {string} params.mimeType - MIME type of the audio stream
   * @param {number} params.durationSeconds - Length of captured sample in seconds (10-15s recommended)
   */
  async identifyAudio({ audioBase64, mimeType = 'audio/webm', durationSeconds = 10 } = {}) {
    if (!this.isConfigured()) {
      return {
        success: false,
        configured: false,
        message: 'Gemini song recognition requires GEMINI_API_KEY configured in backend environment variables.',
        requiredEnvVars: ['GEMINI_API_KEY']
      };
    }

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return {
        success: false,
        error: 'Missing or invalid audioBase64 data in request'
      };
    }

    // Strip optional data URI header (e.g. data:audio/webm;base64,)
    const cleanBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
    const audioBuffer = Buffer.from(cleanBase64, 'base64');

    // Reject undersized buffers (e.g., < 1KB is insufficient for audio recognition)
    if (audioBuffer.length < 1000) {
      return {
        success: false,
        error: 'Audio sample too short. Please capture 10–15 seconds of audio for accurate identification.'
      };
    }

    const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim();
    const client = this.getClient();
    const modelName = process.env.GEMINI_RECOGNITION_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const systemInstruction = `You are an expert audio musicologist and song recognition system for Loopra.
Analyze the provided audio recording snippet carefully.

CRITICAL INSTRUCTIONS:
1. Accurately identify the song playing in the audio clip:
   - title: The official or recognized song title. If uncertain or no recognizable music is playing, return "unknown".
   - artist: The primary performing artist, singer, or band. If uncertain, return "unknown".
   - album: The album or movie soundtrack, or null if unidentifiable.
   - language: The language of the song/lyrics (e.g. "Hindi", "English", "Punjabi", "Spanish", "Instrumental", etc.), or null if unidentifiable.
   - genre: The musical genre (e.g. "Bollywood Romantic", "Pop", "Rock", "Hip Hop", "Sufi", "EDM", etc.), or null if unknown.
   - confidence: An integer percentage from 0 to 100 representing your exact identification confidence.
   - status: "verified" if confidence >= 80% and the song is unmistakable; "probable" if confidence is between 45% and 79% (some characteristics match but clip is noisy, short, or ambiguous); "unknown" if confidence is < 45% or no distinct recognizable song is detected.
   - reason: A short 1-2 sentence explanation of detected vocals, melody, distinctive chords, lyrics, or why identification failed.

2. NEVER FABRICATE OR HALLUCINATE A SONG:
   - If the audio contains only ambient silence, talking, noise, distorted sounds, or an unrecognizable track, you MUST set status to "unknown", title to "unknown", artist to "unknown", and confidence to an integer below 40.
   - Never guess a popular song just because you hear faint chords or rhythms.`;

    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: cleanBase64
                }
              },
              {
                text: 'Identify the song in this audio recording. Output strictly valid JSON with title, artist, album, language, genre, confidence, status, and reason.'
              }
            ]
          }
        ],
        config: {
          systemInstruction,
          responseMimeType: 'application/json'
        }
      });

      let parsed = null;
      try {
        const text = response.text || '';
        const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.warn('[MusicRecognition] JSON parse warning from Gemini response:', parseErr.message);
      }

      const rawTitle = (parsed?.title || 'unknown').trim();
      const rawArtist = (parsed?.artist || 'unknown').trim();
      const album = parsed?.album ? String(parsed.album).trim() : null;
      const language = parsed?.language ? String(parsed.language).trim() : null;
      const genre = parsed?.genre ? String(parsed.genre).trim() : null;

      const rawConfidence = Number(parsed?.confidence);
      const confidence = Number.isFinite(rawConfidence) ? Math.min(Math.max(Math.round(rawConfidence), 0), 100) : 0;
      const rawStatus = parsed?.status;
      const status = (rawStatus === 'verified' || rawStatus === 'probable') ? rawStatus : 'unknown';
      const reason = parsed?.reason || (status === 'unknown' ? 'Audio sample was insufficient or no distinct song could be matched.' : 'Identified based on acoustic characteristics and vocals.');

      const isRecognized = status !== 'unknown' && confidence >= 45 && rawTitle.toLowerCase() !== 'unknown';

      return {
        success: true,
        configured: true,
        recognized: isRecognized,
        provider: 'gemini',
        model: modelName,
        title: isRecognized ? rawTitle : 'unknown',
        artist: isRecognized ? rawArtist : 'unknown',
        album: isRecognized ? album : null,
        language: isRecognized ? language : null,
        genre: isRecognized ? genre : null,
        confidence: isRecognized ? confidence : Math.min(confidence, 35),
        status: isRecognized ? status : 'unknown',
        reason
      };
    } catch (err) {
      console.error('[MusicRecognitionService] Gemini recognition error:', err);

      // Handle Quota and Rate Limit specifically
      if (err.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(err.message)) {
        return {
          success: false,
          configured: true,
          error: 'Gemini API quota exceeded. Please wait a moment before identifying another track.',
          isQuotaError: true
        };
      }

      return {
        success: false,
        configured: true,
        error: err.message || 'Gemini song recognition encountered an unexpected error.'
      };
    }
  }
};
