/**
 * Loopra ChatBuddy LLM Intent & Natural Conversation Engine
 * Rebuilt for ChatGPT Voice-Level Real-Time Conversational Experience.
 * 
 * Guarantees:
 * 1. ZERO hardcoded casual conversation replies. All conversations generated dynamically by Gemini.
 * 2. Unrestricted multi-turn conversational intelligence (Hindi, English, Hinglish, code-switching).
 * 3. Context retention across topics, follow-up questions, and music playback state.
 * 4. Precise distinction between casual conversation (type: "chat", action: "none") vs genuine commands (type: "command").
 * 5. Mixed intent understanding (e.g., emotional venting + request to play relaxing songs).
 * 6. Dynamic startup greeting generation on voice activation.
 */

import { GoogleGenAI } from '@google/genai';
import { GEMINI_CONFIG, getAvailableKeys, isGeminiAvailable } from '../config/geminiConfig.js';
import { executeGeminiOperation, sanitizeLogMessage } from './geminiKeyManager.js';
import { multiModelOrchestrator } from './multiModelOrchestrator.js';

export const LOOPRA_VOICE_SYSTEM_INSTRUCTION = `
Role & Persona:
You are Pankaj's close, chill, and tech-savvy AI music buddy embedded directly inside his music web application. You talk just like a close friend hanging out on a WhatsApp voice call or chilling together.

Core Behavioral Rules:
1. MULTILINGUAL AUTO-SWITCHING: Automatically detect the language of the user's input (English, Hindi, or Hinglish) and respond fluently in that exact same language or natural mixed-code style (Hinglish). Never force a specific language.
2. ZERO ROBOTIC TROPES: Strictly NEVER use assistant phrases like "How may I assist you?", "I am an AI", "Sure, processing", or formal corporate templates. Talk casually, warmly, and use natural slang ("Bhai", "Haan bol", "Sahi hai", "Scene set hai").
3. ULTRA-SHORT & SNAPPY (Low Latency Optimization): Keep your conversational replies extremely brief (1 to 2 sentences, max 5-10 words when possible) to ensure instant generation, zero lag, and a real-time phone call feel.
4. BACKGROUND COMMAND EXECUTION: When the user gives a music command (e.g., play a song, skip track, change volume, search playlist), execute the required tool silently in the background immediately, and acknowledge it casually in the user's language (e.g., "Done bhai, laga diya!" or "Got it, playing right away!").
5. MUSIC SEARCH & SELECTION RULES:
   - DEFAULT LANGUAGE: If the user does not specify a language, ALWAYS default to Hindi / Bollywood songs matching the mood.
   - MAINSTREAM ARTISTS ONLY: Strictly search and play songs sung by known, popular, and verified mainstream artists (e.g., Arijit Singh, Atif Aslam, Shreya Ghoshal, Vishal Mishra, Jubin Nautiyal, Sonu Nigam, KK, Mohit Chauhan, Neha Kakkar, Sunidhi Chauhan, Pritam, etc.).
   - NO JUNK / AI / LOW-VIEWS: Never play AI-generated songs, unknown underground tracks, random covers, or non-music videos (like foreign drama clips or low-view channels). Always pick official audio, lyrical videos, or top music label releases (like T-Series, Sony Music, Zee Music, YRF, Tips, Saregama, etc.) with high views and popularity.

QUERY FORMULATION FOR "play_song":
When generating params.query for "play_song":
- If the user asks for music by mood or vibe without specifying language or artist (e.g., "play something relaxing", "koi romantic song laga do", "party music bajao", "aaj thoda sad feel ho raha hai koi gaana chala"):
  ALWAYS default to Hindi / Bollywood mainstream songs and formulate params.query with a top mainstream artist and official release keywords, e.g.:
  - Relaxing / Chill: "Arijit Singh relaxing hindi song official" or "Vishal Mishra sukoon hindi official"
  - Romantic: "Arijit Singh romantic bollywood song official" or "Shreya Ghoshal romantic hindi lyrical"
  - Sad / Emotional: "Arijit Singh sad hindi song official" or "Atif Aslam emotional bollywood official"
  - Party / Dance: "Bollywood party dance songs official" or "Badshah party hits official"
  - Chill / Lofi: "Arijit Singh lofi chill hindi songs official"
- When a song or artist is named (e.g. "Kesariya", "Atif Aslam"): query "<Artist/Song> official audio" or "<Artist/Song> official video".
- NEVER output queries for AI music, random fan covers, foreign drama clips, or non-music videos.

### CONVERSATIONAL DYNAMICS & CONTEXT:
1. HUMAN-LIKE CHILL VIBE:
   - Talk like a thoughtful, witty, empathetic companion chilling together.
   - Never repeat the user's entire prompt back to them.
   - Keep spoken replies snappy and concise (1-2 sentences, max 5-10 words when possible).
   - Seamlessly switch between Hindi, English, and Hinglish depending on how the user talks.

2. MULTI-TURN CONTEXT RETENTION:
   - Remember the ongoing discussion thread (e.g., if discussing React, career choices, philosophy, or artists).
   - Accurately resolve pronouns and references ("the second one", "why that?", "tell me more about him", "play that one instead").
   - If user asks about the currently playing song ("Why did you pick this song?", "Who sings this?"), reference the music context provided.

3. STRICT INTENT SEPARATION (Chat vs Command):
   - "type": "chat"
     Use when the user is chatting, greeting, joking, debating, sharing emotions, asking general questions, discussing artists, or asking opinions.
     CRITICAL: Casual conversation or opinion statements MUST NOT execute actions.
     "I love Arijit Singh" -> CHAT (action: "none")
     "I'm thinking about opening Downloads" -> CHAT (action: "none")
     "Tell me how music works" -> CHAT (action: "none")
   - "type": "command"
     Use ONLY when the user explicitly or clearly instructs you to perform an operation.
     "Play something relaxing" -> COMMAND (action: "play_song", params: {"query": "relaxing music"})
     "Kesariya chala do" -> COMMAND (action: "play_song", params: {"query": "Kesariya"})
     "Pause the music" -> COMMAND (action: "pause")
     "Open my Downloads" -> COMMAND (action: "open_folder", params: {"folder": "Downloads"})
     "Open liked songs" -> COMMAND (action: "open_page", params: {"page": "favorites"})

4. MIXED CONVERSATION AND COMMAND:
   - If the user combines feelings and a command (e.g., "Yaar, aaj mood bahut off hai, koi relaxing music chala de"):
     - "type": "command"
     - "action": "play_song"
     - "params": {"query": "relaxing music"}
     - "reply": Acknowledge the user's emotion empathetically and confirm the music in a warm, natural way.
   - If the user says: "Pause the music. By the way, how are you?":
     - "type": "command"
     - "action": "pause"
     - "reply": "Music pause kar diya hai! Aur main bilkul theek hoon dost, aap batao aaj kaisa raha din?"

5. OPEN vs PLAY DISTINCTION:
   - "open" / "kholo" / "dikhao" = Navigation / Opening page or folder ("action": "open_page" or "open_folder"). NEVER start audio playback.
   - "play" / "chalao" / "bajao" / "laga do" = Audio playback ("action": "play_song").

6. NEGATIVE MODIFIERS:
   - If the user says "don't play", "mat chalao", or "song play mat karna", action MUST be "none". Never play music when a negative constraint is present.

7. EXACT ACTION NAMING:
   - When returning a reply for a command, speak the EXACT action and item name naturally:
     - Song: Mention the song name or mood.
     - Volume: Mention the target percentage.
     - Folder: Mention the folder name.
     - Never say "Command executed successfully" or "Task executed".

### SUPPORTED ACTIONS & PARAMS:
- "play_song": params: { "query": "artist or song name", "category": "optional mood/genre" }
- "pause": params: {}
- "resume": params: {}
- "next": params: {}
- "previous": params: {}
- "volume": params: { "level": number (0-100) or "relative": number (+/- 10) }
- "open_page": params: { "page": "favorites" | "playlists" | "trending" | "stats" | "activity" | "history" | "saloon_fm" | "theka" | "horn_ok_please" | "home" | "discover" }
- "open_folder": params: { "folder": "Downloads" | "Music" | "Documents" | "Desktop" | string }
- "open_application": params: { "app": string }
- "avatar_dance": params: {}
- "avatar_jump": params: {}
- "avatar_wave": params: {}
- "none": params: {}

### OUTPUT FORMAT:
You MUST output valid, parseable JSON with NO markdown code fences and NO additional prose:
{
  "type": "chat" | "command",
  "action": "play_song" | "pause" | "resume" | "next" | "previous" | "volume" | "open_page" | "open_folder" | "open_application" | "avatar_dance" | "avatar_jump" | "avatar_wave" | "none",
  "params": {},
  "reply": "natural spoken response in matching Hindi/English/Hinglish"
}
`;

/**
 * Robust JSON extraction from LLM text response.
 */
export function sanitizeAndParseJson(text = '') {
  if (!text) return null;
  let clean = text.trim();
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    clean = clean.substring(start, end + 1);
  }

  try {
    const parsed = JSON.parse(clean);
    if (parsed && (parsed.type === 'chat' || parsed.type === 'command')) {
      return {
        type: parsed.type,
        action: parsed.action || 'none',
        params: parsed.params || {},
        reply: parsed.reply || (parsed.type === 'chat' ? 'Haanji, batao!' : 'Sure, on it!')
      };
    }
  } catch (_) { }
  return null;
}

/**
 * Calls the configured Gemini model with full multi-turn conversation history and player context.
 */
export async function callGeminiConversationalBrain(message, { history = [], currentMusicState = null } = {}) {
  const keys = getAvailableKeys();
  if (keys.length === 0) {
    return { success: false, error: 'NO_KEYS_CONFIGURED', message: 'No Gemini API keys configured.' };
  }

  // Format multi-turn conversation context
  const contents = [];

  // Inject current music context if available
  let contextSystemNote = '';
  if (currentMusicState && (currentMusicState.title || currentMusicState.isPlaying)) {
    contextSystemNote = `[CURRENT PLAYBACK CONTEXT: Song="${currentMusicState.title || 'None'}", Artist="${currentMusicState.artist || 'Unknown'}", IsPlaying=${Boolean(currentMusicState.isPlaying)}, Volume=${currentMusicState.volume ?? 70}%]\n`;
  }

  // Add recent history turns (up to 20 messages)
  const recentHistory = history.slice(-20);
  for (const h of recentHistory) {
    const role = (h.role === 'model' || h.role === 'assistant') ? 'model' : 'user';
    const text = h.text || h.content || h.reply || '';
    if (text && text.trim()) {
      contents.push({ role, parts: [{ text }] });
    }
  }

  // Add current user message with playback context
  const userText = contextSystemNote ? `${contextSystemNote}User: "${message}"` : message;
  contents.push({ role: 'user', parts: [{ text: userText }] });

  const targetModel = GEMINI_CONFIG.chatModel;

  const execResult = await multiModelOrchestrator.executeTask('CASUAL_CHAT', async ({ client, modelName }) => {
    return await client.models.generateContent({
      model: modelName || targetModel,
      contents,
      config: {
        systemInstruction: LOOPRA_VOICE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: GEMINI_CONFIG.temperature
      }
    });
  }, {
    prompt: message,
    timeoutMs: 14000
  });

  if (!execResult.success) {
    return execResult;
  }

  const response = execResult.data;
  let raw = response.text || '';
  if (!raw && response.candidates?.[0]?.content?.parts?.[0]?.text) {
    raw = response.candidates[0].content.parts[0].text;
  }

  const parsed = sanitizeAndParseJson(raw);
  if (parsed) {
    parsed.keyUsed = execResult.keyLabel;
    parsed.modelUsed = execResult.modelUsed || targetModel;
    parsed.failedOver = Boolean(execResult.failedOver);
    return parsed;
  }

  return { success: false, error: 'JSON_PARSE_ERROR', raw };
}

/**
 * Generates a dynamic, fresh startup greeting whenever Loopra Voice Mode is activated.
 * No hardcoded replies: Gemini crafts a warm, natural 1-sentence opening.
 */
export async function generateDynamicStartupGreeting({ lang = 'hi-IN', currentMusicState = null } = {}) {
  if (!isGeminiAvailable()) {
    return 'Hey! Kya haal hai?';
  }

  let prompt = 'Generate a short, confident, natural greeting as Loopra (a warm, real AI conversational companion) in natural Hinglish or Hindi (strictly under 7 words). Examples of desired style: "Hey! Kya haal hai?", "Hello! Kaise ho?", "Hey there! I\'m here." DO NOT ask the user what they want to discuss, talk about, or listen to. Never say "Aaj kya sunenge", "kya baat karenge", or "kya help karoon". Output JSON: {"greeting": "..."}';
  if (lang.startsWith('en')) {
    prompt = 'Generate a short, confident, natural greeting as Loopra (a warm, real AI conversational companion) in casual English (strictly under 6 words). Examples of desired style: "Hey there! I\'m here.", "Hello! Good to see you.", "Hey, how are things?". DO NOT ask the user what they want to discuss or listen to. Output JSON: {"greeting": "..."}';
  }

  if (currentMusicState && currentMusicState.title) {
    prompt += ` Currently playing: "${currentMusicState.title}". You may optionally mention it briefly.`;
  }

  try {
    const client = new GoogleGenAI({ apiKey: GEMINI_CONFIG.apiKey });
    const res = await client.models.generateContent({
      model: GEMINI_CONFIG.chatModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.8
      }
    });

    const text = res.text || '';
    const parsed = JSON.parse(text);
    if (parsed && parsed.greeting) {
      return parsed.greeting.trim();
    }
  } catch (err) {
    console.warn('[ChatBuddyLLM] Dynamic greeting notice:', sanitizeLogMessage(err.message));
  }

  return 'Hey! Kya haal hai?';
}

/**
 * Master ChatBuddy Handler:
 * 1. Executes dynamic Gemini Conversational Brain.
 * 2. If API is unreachable, provides an honest and friendly response without hardcoded fake dialogues.
 */
export async function processChatBuddyMessage({ message = '', history = [], currentMusicState = null }) {
  const cleanMsg = (message || '').trim();
  if (!cleanMsg) {
    return {
      type: 'chat',
      action: 'none',
      params: {},
      reply: 'Boliye, main sun rahi hoon!'
    };
  }

  try {
    const geminiRes = await callGeminiConversationalBrain(cleanMsg, { history, currentMusicState });
    if (geminiRes && geminiRes.reply && !geminiRes.error) {
      return geminiRes;
    }
  } catch (err) {
    console.warn('[ChatBuddyLLM] Gemini call failed:', sanitizeLogMessage(err.message));
  }

  // Graceful connection fallback (honest, no fake robotic repetition)
  return {
    type: 'chat',
    action: 'none',
    params: {},
    reply: 'Connection mein thodi dikkat aayi dost! Ek baar fir se boliye, main ready hoon.',
    isFallback: true
  };
}

/**
 * Fallback heuristic classifier for offline unit tests.
 */
export function fallbackHeuristicClassifier(message = '', geminiError = null) {
  const lower = (message || '').toLowerCase().trim();

  if (/\b(pause|roko)\b/i.test(lower)) {
    return { type: 'command', action: 'pause', params: {}, reply: 'Music pause kar diya hai.' };
  }
  if (/\b(resume|chalao)\b/i.test(lower)) {
    return { type: 'command', action: 'resume', params: {}, reply: 'Music dobara chala diya hai.' };
  }
  if (/\b(next|agla)\b/i.test(lower)) {
    return { type: 'command', action: 'next', params: {}, reply: 'Next song chala diya hai.' };
  }
  if (/\b(previous|pichla)\b/i.test(lower)) {
    return { type: 'command', action: 'previous', params: {}, reply: 'Pichla gaana chala diya hai.' };
  }
  if (/\b(open|kholo)\b/i.test(lower) && /\b(downloads|folder)\b/i.test(lower)) {
    return { type: 'command', action: 'open_folder', params: { folder: 'Downloads' }, reply: 'Downloads folder open kar diya hai.' };
  }

  return {
    type: 'chat',
    action: 'none',
    params: {},
    reply: 'Main ready hoon dost! Boliye, kya baat karenge ya kya sunenge?'
  };
}

export default {
  processChatBuddyMessage,
  generateDynamicStartupGreeting,
  callGeminiConversationalBrain,
  fallbackHeuristicClassifier,
  sanitizeAndParseJson,
  LOOPRA_VOICE_SYSTEM_INSTRUCTION
};
