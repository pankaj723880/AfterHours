/**
 * ChatBuddy LLM Intent & Conversation Service
 * 
 * Strict Two-Layer Intent Detection:
 * - Layer A (Fast local engine): 0ms instant execution for basic media controls
 * - Layer B (LLM engine): Strict JSON output with 25+ few-shot examples
 * 
 * Schema:
 * {
 *   "type": "chat" | "command",
 *   "action": "play_song" | "pause" | "resume" | "next" | "previous" | "volume" | "open_page" | "avatar_walk" | "avatar_jump" | "avatar_dance" | "avatar_wave" | "none",
 *   "params": { ... },
 *   "reply": "short friendly reply in the user's language"
 * }
 */

import { GoogleGenAI } from '@google/genai';

export const CHATBUDDY_SYSTEM_PROMPT = `
You are Loopra ChatBuddy, a culturally tuned, friendly, and accurate personal AI music assistant.
You speak naturally in Hindi, Hinglish, Roman Hindi, and casual English.

CORE RULES:
1. STRICT JSON ONLY: You MUST output valid JSON and nothing else. No markdown fences, no explanations.
2. STRICT TYPE SEPARATION:
   - "type": "chat" -> Casual conversation, greetings, compliments, music opinions, philosophical questions, complaints, jokes. Action MUST be "none".
   - "type": "command" -> Explicit user instructions or orders to play music, navigate pages, adjust volume, or perform avatar motions.
3. OPEN vs PLAY DISTINCTION:
   - "open" / "kholo" / "dikhao" = Navigation ("action": "open_page"). NEVER start music playback.
     Examples: "open liked songs", "playlists kholo", "open trending", "go to saloon fm".
   - "play" / "chalao" / "bajao" / "laga do" = Music playback ("action": "play_song").
     Examples: "play Arijit Singh", "Kesariya chala do", "play romantic songs".
4. NEGATIVE ACTIONS:
   - If the user says "don't play", "mat chalao", or "song play mat karna", action MUST be "none" or appropriate non-play action. NEVER play music when a negative modifier is present.
5. AVATAR ACTIONS:
   - "avatar_jump", "avatar_dance", "avatar_wave", "avatar_walk" occur ONLY when the user explicitly tells the avatar to do a physical action (e.g., "dance karo", "jump", "wave karo", "go to play button").
   - During casual chat, the avatar action is ALWAYS "none".

SUPPORTED ACTIONS AND PARAMS:
- "play_song": params: { "query": "artist or song name", "category": "optional genre/mood" }
- "pause": params: {}
- "resume": params: {}
- "next": params: {}
- "previous": params: {}
- "volume": params: { "level": number (0-100) or "relative": number (+/- 10) }
- "open_page": params: { "page": "favorites" | "playlists" | "trending" | "stats" | "activity" | "history" | "saloon_fm" | "theka" | "horn_ok_please" | "home" | "discover" }
- "avatar_walk": params: { "target": "search_bar" | "play_button" | "logo" | "nav_item" }
- "avatar_jump": params: {}
- "avatar_dance": params: {}
- "avatar_wave": params: {}
- "none": params: {}

FEW-SHOT EXAMPLES (25 Benchmark Examples):

[Example 1 - Casual Greeting]
User: "Kya haal hai Loopra?"
Output: {"type":"chat","action":"none","params":{},"reply":"Sab badiya! Aap batao, aaj kaisa chal raha hai sab?"}

[Example 2 - Casual Feeling / Boredom]
User: "I am feeling so bored today"
Output: {"type":"chat","action":"none","params":{},"reply":"Arey re! Chaho toh thode energetic ya chill gaane sun sakte ho. Batao kaisa mood hai?"}

[Example 3 - Opinion on song (No action)]
User: "Ye song kitna achha hai na?"
Output: {"type":"chat","action":"none","params":{},"reply":"Sach mein, iska vibe aur lyrics dil ko chhu lene wale hain!"}

[Example 4 - Open Page vs Play (Favorites)]
User: "Open my liked songs"
Output: {"type":"command","action":"open_page","params":{"page":"favorites"},"reply":"Aapke Liked Songs open kar rahi hoon!"}

[Example 5 - Play Liked Songs (Play command)]
User: "Play my liked songs"
Output: {"type":"command","action":"play_song","params":{"query":"liked songs"},"reply":"Aapke favorite songs play kar rahi hoon!"}

[Example 6 - Open vs Play (Playlists)]
User: "Meri playlists kholo"
Output: {"type":"command","action":"open_page","params":{"page":"playlists"},"reply":"Aapki playlists screen khol di hai!"}

[Example 7 - Explicit Artist Playback]
User: "Arijit Singh ke sad songs play karo"
Output: {"type":"command","action":"play_song","params":{"query":"Arijit Singh sad songs"},"reply":"Arijit Singh ke emotional gaane laga rahi hoon."}

[Example 8 - Hindi Playback]
User: "Kesariya song chalao"
Output: {"type":"command","action":"play_song","params":{"query":"Kesariya"},"reply":"Kesariya song shuru kar rahi hoon!"}

[Example 9 - Pause playback]
User: "Gaana roko"
Output: {"type":"command","action":"pause","params":{},"reply":"Music pause kar diya hai."}

[Example 10 - Resume playback]
User: "Song resume karo"
Output: {"type":"command","action":"resume","params":{},"reply":"Music wapas shuru kar diya!"}

[Example 11 - Next Track]
User: "Agla gaana lagao"
Output: {"type":"command","action":"next","params":{},"reply":"Agla gaana play ho raha hai."}

[Example 12 - Previous Track]
User: "Pichla gaana wapas chalao"
Output: {"type":"command","action":"previous","params":{},"reply":"Pichle gaane par chalte hain."}

[Example 13 - Volume Reduction]
User: "Volume thoda kam kar"
Output: {"type":"command","action":"volume","params":{"relative":-15},"reply":"Volume kam kar diya hai."}

[Example 14 - Volume Set Exact]
User: "Volume 80 percent karo"
Output: {"type":"command","action":"volume","params":{"level":80},"reply":"Volume 80% par set kar diya."}

[Example 15 - Mute]
User: "Mute kar do"
Output: {"type":"command","action":"volume","params":{"level":0},"reply":"Music mute kar diya hai."}

[Example 16 - Navigation to Activity]
User: "Listening activity dikhao"
Output: {"type":"command","action":"open_page","params":{"page":"activity"},"reply":"Aapki listening activity khol rahi hoon."}

[Example 17 - Navigation to History]
User: "History kholo"
Output: {"type":"command","action":"open_page","params":{"page":"history"},"reply":"Listening history page open kar rahi hoon."}

[Example 18 - Navigation to Recap & Stats]
User: "Recap and stats khol do"
Output: {"type":"command","action":"open_page","params":{"page":"stats"},"reply":"Aapka personal music recap aur stats load ho rahe hain!"}

[Example 19 - Radio Station Navigation]
User: "Saloon FM par jao"
Output: {"type":"command","action":"open_page","params":{"page":"saloon_fm"},"reply":"Saloon FM station open kar rahi hoon!"}

[Example 20 - Negative Play Modifier (Do NOT play)]
User: "Arijit Singh ke songs search karo par play mat karna"
Output: {"type":"chat","action":"none","params":{},"reply":"Theek hai, Arijit Singh ke gaane bina play kiye dekh sakte ho."}

[Example 21 - Avatar Dance]
User: "Loopra thoda dance karke dikhao"
Output: {"type":"command","action":"avatar_dance","params":{},"reply":"Ye lo, thoda groove karte hain!"}

[Example 22 - Avatar Jump]
User: "Jump karo"
Output: {"type":"command","action":"avatar_jump","params":{},"reply":"Woohoo! Jump!"}

[Example 23 - Avatar Wave]
User: "Wave hello"
Output: {"type":"command","action":"avatar_wave","params":{},"reply":"Hey there! 👋"}

[Example 24 - Avatar Walk to Target]
User: "Go to the search bar"
Output: {"type":"command","action":"avatar_walk","params":{"target":"search_bar"},"reply":"Search bar ke paas chal rahi hoon!"}

[Example 25 - Conversational Question (No action)]
User: "Aaj kaunsa song sunu?"
Output: {"type":"chat","action":"none","params":{},"reply":"Aaj ke vibe ke liye chill lofi ya acoustic Bollywood try kar sakte ho. Kaisa mood hai aapka?"}
`;

/**
 * Robust JSON extraction from LLM text response.
 */
export function sanitizeAndParseJson(text = '') {
  if (!text) return null;
  let clean = text.trim();
  // Strip code block markers if present
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Find opening { and closing }
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
  } catch (_) {}
  return null;
}

/**
 * Fallback intent classifier when no LLM key is set or when API times out.
 */
export function fallbackHeuristicClassifier(message = '') {
  const lower = message.toLowerCase().trim();

  // Negative play guard: NEVER play if negative words exist
  const hasNeg = /\b(don'?t|do not|mat|na|never|without|stop)\b/i.test(lower);

  // Obvious open/navigation commands
  if (/\b(open|kholo|dikhao|go to)\b/i.test(lower)) {
    if (/\b(like|liked|favorite|favourite|pasandida)\b/i.test(lower)) {
      return { type: 'command', action: 'open_page', params: { page: 'favorites' }, reply: 'Aapke Liked Songs open kar rahi hoon!' };
    }
    if (/\b(playlist|playlists)\b/i.test(lower)) {
      return { type: 'command', action: 'open_page', params: { page: 'playlists' }, reply: 'Aapki playlists khol rahi hoon!' };
    }
    if (/\b(stat|stats|recap|insight|insights)\b/i.test(lower)) {
      return { type: 'command', action: 'open_page', params: { page: 'stats' }, reply: 'Stats aur Recap open kar rahi hoon!' };
    }
    if (/\b(activity|recently played)\b/i.test(lower)) {
      return { type: 'command', action: 'open_page', params: { page: 'activity' }, reply: 'Listening activity page open kar rahi hoon!' };
    }
    if (/\b(history)\b/i.test(lower)) {
      return { type: 'command', action: 'open_page', params: { page: 'history' }, reply: 'Listening history open kar rahi hoon!' };
    }
    if (/\b(saloon)\b/i.test(lower)) {
      return { type: 'command', action: 'open_page', params: { page: 'saloon_fm' }, reply: 'Saloon FM open kar rahi hoon!' };
    }
  }

  // Obvious media commands
  if (/\b(pause|roko|ruk jao|chup)\b/i.test(lower)) {
    return { type: 'command', action: 'pause', params: {}, reply: 'Music pause kar diya.' };
  }
  if (/\b(resume|wapas chalao|shuru karo)\b/i.test(lower)) {
    return { type: 'command', action: 'resume', params: {}, reply: 'Music shuru kar diya.' };
  }
  if (/\b(next|agla|skip)\b/i.test(lower)) {
    return { type: 'command', action: 'next', params: {}, reply: 'Agla gaana play ho raha hai.' };
  }
  if (/\b(previous|prev|pichla)\b/i.test(lower)) {
    return { type: 'command', action: 'previous', params: {}, reply: 'Pichle gaane par chalte hain.' };
  }
  if (/\b(volume|aawaz|awaaz)\b/i.test(lower)) {
    if (/\b(kam|ghatao|down|low|chhota)\b/i.test(lower)) {
      return { type: 'command', action: 'volume', params: { relative: -15 }, reply: 'Volume kam kar diya hai.' };
    }
    if (/\b(badhao|tez|up|high)\b/i.test(lower)) {
      return { type: 'command', action: 'volume', params: { relative: 15 }, reply: 'Volume badha diya hai.' };
    }
  }

  // Explicit avatar motion commands
  if (/\b(dance|nacho|nach)\b/i.test(lower)) {
    return { type: 'command', action: 'avatar_dance', params: {}, reply: 'Chalo dance karte hain!' };
  }
  if (/\b(jump|kudo)\b/i.test(lower)) {
    return { type: 'command', action: 'avatar_jump', params: {}, reply: 'Wheee! Jump!' };
  }
  if (/\b(wave|hath hilao|hi bolo)\b/i.test(lower)) {
    return { type: 'command', action: 'avatar_wave', params: {}, reply: 'Namaste! 👋' };
  }

  // Explicit play command (unless negative modifier is present)
  if (!hasNeg && /\b(play|chalao|bajao|laga do|chala de|sunao)\b/i.test(lower)) {
    const q = lower.replace(/\b(play|chalao|bajao|laga do|chala de|sunao|song|gaana|track|karo)\b/gi, '').trim();
    if (q.length > 1) {
      return { type: 'command', action: 'play_song', params: { query: q }, reply: `"${q}" play kar rahi hoon!` };
    }
  }

  // Default to pure chat (NO action)
  return {
    type: 'chat',
    action: 'none',
    params: {},
    reply: 'Main yahin hoon! Kuch chat karni ho ya koi gaana sunna ho, bataiye.'
  };
}

/**
 * Call Gemini Free Tier API with conversation history.
 */
async function callGeminiApi(message, history = []) {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey || apiKey.length < 10) return null;

  const client = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-2.5-flash';

  const historyContext = history.slice(-10).map(h => ({
    role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
    content: h.text || h.content || h.reply || ''
  }));

  const contents = [
    CHATBUDDY_SYSTEM_PROMPT,
    `\nRECENT CONVERSATION HISTORY (Last 10 messages):\n${JSON.stringify(historyContext, null, 2)}\n`,
    `USER MESSAGE:\n"${message}"\n\nSTRICT JSON OUTPUT:`
  ].join('\n');

  const response = await Promise.race([
    client.models.generateContent({
      model: modelName,
      contents,
      config: {
        responseMimeType: 'application/json'
      }
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 4000))
  ]);

  let raw = response.text || '';
  if (!raw && response.candidates?.[0]?.content?.parts?.[0]?.text) {
    raw = response.candidates[0].content.parts[0].text;
  }

  return sanitizeAndParseJson(raw);
}

/**
 * Call Groq Free Tier API (Llama 3 / Mixtral) if configured.
 */
async function callGroqApi(message, history = []) {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey || apiKey.length < 10) return null;

  const messages = [
    { role: 'system', content: CHATBUDDY_SYSTEM_PROMPT }
  ];

  for (const h of history.slice(-10)) {
    messages.push({
      role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
      content: h.text || h.content || h.reply || ''
    });
  }

  messages.push({ role: 'user', content: message });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.3
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return sanitizeAndParseJson(content);
  } catch (_) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Master ChatBuddy Handler:
 * 1. Tries Gemini (if configured)
 * 2. Tries Groq (if configured)
 * 3. Falls back to deterministic rule-based classifier
 */
export async function processChatBuddyMessage({ message = '', history = [] }) {
  const cleanMsg = (message || '').trim();
  if (!cleanMsg) {
    return {
      type: 'chat',
      action: 'none',
      params: {},
      reply: 'Namaste! Main Loopra ChatBuddy hoon. Batao aaj kya sunna hai?'
    };
  }

  // 1. Try Gemini Free Tier
  try {
    const geminiRes = await callGeminiApi(cleanMsg, history);
    if (geminiRes) return geminiRes;
  } catch (err) {
    console.warn('[ChatBuddyLLM] Gemini call fallback:', err.message);
  }

  // 2. Try Groq Free Tier
  try {
    const groqRes = await callGroqApi(cleanMsg, history);
    if (groqRes) return groqRes;
  } catch (err) {
    console.warn('[ChatBuddyLLM] Groq call fallback:', err.message);
  }

  // 3. Fallback heuristic (graceful with 0 errors)
  return fallbackHeuristicClassifier(cleanMsg);
}

export default {
  processChatBuddyMessage,
  fallbackHeuristicClassifier,
  sanitizeAndParseJson,
  CHATBUDDY_SYSTEM_PROMPT
};
