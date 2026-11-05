/**
 * Vercel Serverless Function: /api/chat
 * Loopra ChatBuddy brain: intent classification + friendly chat via Google Gemini.
 */

const ALLOWED_ACTIONS = new Set([
  'play_song', 'pause', 'resume', 'next', 'previous', 'volume', 'open_page', 'none'
]);

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: ['chat', 'command'] },
    action: { type: 'STRING', enum: ['play_song', 'pause', 'resume', 'next', 'previous', 'volume', 'open_page', 'none'] },
    params: { type: 'OBJECT', properties: { query: { type: 'STRING' }, category: { type: 'STRING' }, page: { type: 'STRING' }, level: { type: 'NUMBER' }, relative: { type: 'NUMBER' }, target: { type: 'STRING' } } },
    reply: { type: 'STRING' }
  },
  required: ['type', 'action', 'params', 'reply']
};

const SYSTEM_PROMPT = `You are Loopra, a warm, friendly AI music companion who talks like a close friend.
You speak Hindi, English and Hinglish, often mixed. Replies are 1-2 short sentences because they are spoken aloud.

CORE RULES:
1. Output STRICT JSON only. No markdown, no extra text.
2. Schema: {"type":"chat"|"command","action":"play_song|pause|resume|next|previous|volume|open_page|none","params":{},"reply":"..."}
3. Decide by INTENT, not tone.
   - "command" only if the user clearly asks the app to DO something (play, stop, skip, open, change volume), even casually.
   - "chat" for everything else: greetings, how are you, questions, time, opinions, feelings, jokes, or merely mentioning music.
   - "I like Arijit songs" is chat, not a command.
4. "play" starts music. "open" navigates to a page/section. Never mix them.
5. If a message has both small talk and a command, run the command AND reply to both.
6. If unsure, treat as chat and ask a short clarifying question. Never guess an action.
7. On "command", action must be one of the allow-list; params hold details (query, page, level, relative).
8. Never use robotic phrases: "Executed", "Clarified", "Command received", "Processing your request", "As an AI".
   Confirm casually: "Sure, playing it now!" or "Done, paused."
9. Reply in the same language/style as the user. Light humour, follow-up questions in chat, remember recent context.

FEW-SHOT EXAMPLES (25+):
1. User: "Kya haal hai Loopra?" -> {"type":"chat","action":"none","params":{},"reply":"Sab badiya! Aap batao, aaj kya chal raha hai?"}
2. User: "I am feeling so bored today" -> {"type":"chat","action":"none","params":{},"reply":"Arey re! Chaho toh energetic ya chill gaane sun sakte ho. Batao kaisa mood hai?"}
3. User: "Play Kesariya" -> {"type":"command","action":"play_song","params":{"query":"Kesariya"},"reply":"Sure, Kesariya play kar rahi hoon!"}
4. User: "pause" -> {"type":"command","action":"pause","params":{},"reply":"Done, paused."}
5. User: "next song" -> {"type":"command","action":"next","params":{},"reply":"Agla gaana play ho raha hai."}
6. User: "previous" -> {"type":"command","action":"previous","params":{},"reply":"Pichle gaane par chalte hain."}
7. User: "Volume thoda kam kar" -> {"type":"command","action":"volume","params":{"relative":-15},"reply":"Volume kam kar diya hai."}
8. User: "Volume 80 percent karo" -> {"type":"command","action":"volume","params":{"level":80},"reply":"Volume 80% par set kar diya."}
9. User: "Mute kar do" -> {"type":"command","action":"volume","params":{"level":0},"reply":"Music mute kar diya hai."}
10. User: "open liked songs" -> {"type":"command","action":"open_page","params":{"page":"favorites"},"reply":"Aapke Liked Songs open kar rahi hoon!"}
11. User: "playlists kholo" -> {"type":"command","action":"open_page","params":{"page":"playlists"},"reply":"Aapki playlists khol rahi hoon!"}
12. User: "open trending" -> {"type":"command","action":"open_page","params":{"page":"trending"},"reply":"Trending page open kar rahi hoon!"}
13. User: "history kholo" -> {"type":"command","action":"open_page","params":{"page":"history"},"reply":"Listening history open kar rahi hoon!"}
14. User: "Saloon FM par jao" -> {"type":"command","action":"open_page","params":{"page":"saloon_fm"},"reply":"Saloon FM open kar rahi hoon!"}
15. User: "Arijit Singh ke songs search karo par play mat karna" -> {"type":"chat","action":"none","params":{},"reply":"Theek hai, Arijit Singh ke gaane bina play kiye dekh sakte ho."}
16. User: "I like Arijit songs" -> {"type":"chat","action":"none","params":{},"reply":"Arijit Singh ki aawaaz sach mein dil chhu leti hai! Kaunsa gaana sabse zyada pasand hai?"}
17. User: "Aaj kaunsa song sunu?" -> {"type":"chat","action":"none","params":{},"reply":"Aaj ke vibe ke liye chill lofi ya acoustic Bollywood try kar sakte ho. Kaisa mood hai aapka?"}
18. User: "Ek joke sunao" -> {"type":"chat","action":"none","params":{},"reply":"Ek music joke: Why did the musician keep his trumpet in the fridge? Because he liked cool jazz!"}
19. User: "Tumhara naam kya hai?" -> {"type":"chat","action":"none","params":{},"reply":"Mera naam Loopra hai, aapki musical dost!"}
20. User: "Open Headlights" -> {"type":"chat","action":"none","params":{},"reply":"Kya aap Headlights ka song play karna chahte ho, ya search karna? Batao na."}
21. User: "Hey, pause the music and how are you?" -> {"type":"command","action":"pause","params":{},"reply":"Music pause kar diya! Main bilkul mast hoon, aap batao."}
22. User: "Kya tum mujhe gaana suggest kar sakti ho?" -> {"type":"chat","action":"none","params":{},"reply":"Bilkul! Batao aaj kaisa mood hai, main perfect gaana suggest karungi."}
23. User: "play that song" -> {"type":"command","action":"play_song","params":{"query":"that song"},"reply":"Kaunsa gaana? Thoda specific batao na."}
24. User: "resume" -> {"type":"command","action":"resume","params":{},"reply":"Music shuru kar diya."}
25. User: "Aur batao" -> {"type":"chat","action":"none","params":{},"reply":"Bas yahin hoon, aapke gaanon ke beech! Kuch aur poochna hai?"}
`;

function sanitizeAndParse(text) {
  if (!text) return null;
  let clean = String(text).trim();
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) clean = clean.substring(start, end + 1);
  try {
    const parsed = JSON.parse(clean);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.type !== 'chat' && parsed.type !== 'command') return null;
    let action = parsed.action || 'none';
    if (!ALLOWED_ACTIONS.has(action)) { parsed.type = 'chat'; action = 'none'; }
    if (parsed.type === 'chat') action = 'none';
    if (parsed.type === 'command' && action === 'none') parsed.type = 'chat';
    const params = parsed.params && typeof parsed.params === 'object' ? parsed.params : {};
    let reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : 'Haanji, batao!';
    if (/executed|clarified|command received|processing your request|as an ai/i.test(reply)) reply = 'Sure, ho gaya! Aur batao?';
    return { type: parsed.type, action, params, reply };
  } catch (_) { return null; }
}

function fastLocalCommand(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.trim();
  let lower = text.toLowerCase().replace(/[?!,.]/g, '').replace(/\s+/g, ' ').trim();
  lower = lower.replace(/^(hey loopra|ok loopra|hello loopra|loopra)\s+/i, '');
  if (/^(pause|stop|hold on|ruk jao|rok do|chup ho jao|pause music|stop music)(\s+(music|song|gaana|gana|bhai|yaar|abhi|karo|please))*$/i.test(lower) || /\b(pause music|stop music|music roko|gaana roko|gana roko|pause the song)\b/i.test(lower)) {
    return { type: 'command', action: 'pause', params: {}, reply: 'Done, paused.' };
  }
  if (/^(resume|continue|play again|shuru karo|wapas chalao)(\s+(music|song|gaana|gana|karo|please))*$/i.test(lower) || /\b(resume music|continue music|music shuru karo)\b/i.test(lower)) {
    return { type: 'command', action: 'resume', params: {}, reply: 'Music shuru kar diya.' };
  }
  if (/\b(next song|next track|agla gaana|skip song|aage badhao|next|agla|skip)\b/i.test(lower) && !/\b(kya|kyun|kaise|what|how|why)\b/i.test(lower)) {
    return { type: 'command', action: 'next', params: {}, reply: 'Agla gaana play ho raha hai.' };
  }
  if (/\b(previous song|prev song|pichla gaana|piche karo|previous track|previous|prev|pichla)\b/i.test(lower) && !/\b(kya|kyun|kaise|what|how|why)\b/i.test(lower)) {
    return { type: 'command', action: 'previous', params: {}, reply: 'Pichle gaane par chalte hain.' };
  }
  if (/\b(volume|awaaz|aawaz|sound)\b/i.test(lower)) {
    if (/\b(mute)\b/i.test(lower)) return { type: 'command', action: 'volume', params: { level: 0 }, reply: 'Music mute kar diya hai.' };
    if (/\b(kam|ghatao|down|low|chhota|kam kar)\b/i.test(lower)) return { type: 'command', action: 'volume', params: { relative: -15 }, reply: 'Volume kam kar diya hai.' };
    if (/\b(badhao|tez|up|high|badha)\b/i.test(lower)) return { type: 'command', action: 'volume', params: { relative: 15 }, reply: 'Volume badha diya hai.' };
    const m = lower.match(/volume\s*(\d{1,3})/i);
    if (m) { const level = Math.max(0, Math.min(100, parseInt(m[1], 10))); return { type: 'command', action: 'volume', params: { level }, reply: 'Volume ' + level + '% par set kar diya.' }; }
  }
  const openMatch = lower.match(/^(open|kholo|dikhao|go to)\s+(.+)$/i);
  if (openMatch) {
    const entity = openMatch[2].trim();
    const pageMap = [
      { keys: ['like','liked','favorite','favourite','pasandida'], page: 'favorites' },
      { keys: ['playlist','playlists'], page: 'playlists' },
      { keys: ['trend','trending'], page: 'trending' },
      { keys: ['stat','stats','recap','insight','insights'], page: 'stats' },
      { keys: ['activity','recently played'], page: 'activity' },
      { keys: ['history'], page: 'history' },
      { keys: ['saloon'], page: 'saloon_fm' },
      { keys: ['theka'], page: 'theka' },
      { keys: ['horn'], page: 'horn_ok_please' },
      { keys: ['home'], page: 'home' },
      { keys: ['discover'], page: 'discover' }
    ];
    for (const { keys, page } of pageMap) {
      if (keys.some((k) => entity.includes(k))) return { type: 'command', action: 'open_page', params: { page }, reply: 'Opening ' + page.replace(/_/g, ' ') + '.' };
    }
  }
  const negative = /\b(don'?t|do not|mat|na|bina|without|never)\s+(play|chalao|bajao|sunao|laga)/i.test(lower) || /\b(play|chalao|bajao|sunao)\s+(mat|na|nahi)\b/i.test(lower);
  if (!negative) {
    let query = null;
    const prefixMatch = lower.match(/^(play|bajao|chalao|sunao|laga do|chala de)\s+(.+)$/i);
    if (prefixMatch) query = prefixMatch[2].trim();
    const suffixMatch = lower.match(/^(.+?)\s+(play karo|bajao|chalao|sunao)$/i);
    if (!query && suffixMatch) query = suffixMatch[1].trim();
    if (query && query.length > 1 && query !== 'music' && query !== 'song') {
      query = query.replace(/\b(song|gaana|gana|track|karo|please)\b/gi, '').trim() || query;
      return { type: 'command', action: 'play_song', params: { query }, reply: 'Sure, "' + query + '" play kar rahi hoon!' };
    }
  }
  return null;
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function retryDelay(err) {
  if (err && err.status === 429) {
    const sec = parseInt(err.retryAfter, 10);
    if (!isNaN(sec) && sec > 0) return Math.min(sec * 1000, 3000);
    return 1200;
  }
  return 600;
}

async function callGemini(message, history) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const model = (process.env.GEMINI_MODEL || '').trim();
  if (!apiKey) return { error: 'NO_KEY' };
  if (!model) return { error: 'NO_MODEL' };
  const historyContents = (Array.isArray(history) ? history : []).slice(-10).map((h) => ({
    role: h && (h.role === 'model' || h.role === 'assistant') ? 'model' : 'user',
    parts: [{ text: String((h && (h.text || h.content || h.reply)) || '') }]
  })).filter((c) => c.parts[0].text.trim().length > 0);
  const contents = [...historyContents, { role: 'user', parts: [{ text: message }] }];
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.3
    }
  };
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(errText);
        err.status = res.status;
        err.retryAfter = res.headers.get('retry-after');
        throw err;
      }
      const data = await res.json();
      const raw = (data && data.candidates && data.candidates[0] && data.candidates[0].content && Array.isArray(data.candidates[0].content.parts))
        ? data.candidates[0].content.parts.map((p) => p.text || '').join('')
        : (data && data.text) || '';
      const parsed = sanitizeAndParse(raw);
      if (parsed) return { result: parsed };
      throw new Error('JSON_PARSE_ERROR');
    } catch (err) {
      lastError = err;
      if (attempt === 0) await sleep(retryDelay(err));
    }
  }
  return { error: lastError ? String(lastError.message || lastError) : 'UNKNOWN', status: lastError && lastError.status };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const history = Array.isArray(body.history) ? body.history : [];
  if (!message) return res.status(200).json({ type: 'chat', action: 'none', params: {}, reply: 'Namaste! Main Loopra hoon. Batao aaj kya sunna hai?' });
  const fast = fastLocalCommand(message);
  if (fast) return res.status(200).json(fast);
  const gemini = await callGemini(message, history);
  if (gemini && gemini.result) return res.status(200).json(gemini.result);
  return res.status(200).json({ type: 'chat', action: 'none', params: {}, reply: 'Main abhi thoda busy hoon, ek baar phir se bolo na!' });
}
