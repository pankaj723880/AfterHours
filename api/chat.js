/**
 * Vercel Serverless Function: /api/chat
 * Handles ChatBuddy intent classification and conversations via Gemini REST API.
 * Standalone, 100% dependency-free implementation for Vercel deployment.
 */

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const model = (process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();

  // Handle Startup Greeting Request
  if (req.method === 'GET' || req.body?.isGreeting) {
    if (!apiKey) {
      return res.status(200).json({ success: true, greeting: 'Hey! Kya haal hai?' });
    }
    try {
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: 'Generate a short, confident, natural greeting as Loopra (a warm AI friend) in natural Hinglish or Hindi (under 7 words). Examples: "Hey! Kya haal hai?", "Hello! Kaise ho?", "Hey there! I\'m here." DO NOT ask the user what they want to discuss or listen to. Output JSON: {"greeting": "..."}' }]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.8
          }
        })
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        const raw = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(raw);
        if (parsed?.greeting) {
          return res.status(200).json({ success: true, greeting: parsed.greeting });
        }
      }
    } catch (_) {}
    return res.status(200).json({ success: true, greeting: 'Hey! Kya haal hai?' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message, history, currentMusicState } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(200).json({
      type: 'chat',
      action: 'none',
      params: {},
      reply: 'Boliye, main sun rahi hoon!'
    });
  }

  // Fast local rule check
  const lower = message.toLowerCase().trim();
  if (/^(pause|roko|ruk jao)$/i.test(lower)) {
    return res.status(200).json({ type: 'command', action: 'pause', params: {}, reply: 'Music pause kar diya hai.' });
  }
  if (/^(resume|wapas chalao|shuru karo)$/i.test(lower)) {
    return res.status(200).json({ type: 'command', action: 'resume', params: {}, reply: 'Music dobara shuru kar diya hai.' });
  }
  if (/^(next|agla|skip)$/i.test(lower)) {
    return res.status(200).json({ type: 'command', action: 'next', params: {}, reply: 'Next song chala diya hai.' });
  }
  if (/^(previous|prev|pichla)$/i.test(lower)) {
    return res.status(200).json({ type: 'command', action: 'previous', params: {}, reply: 'Pichla gaana chala diya hai.' });
  }

  if (!apiKey) {
    return res.status(200).json({
      type: 'chat',
      action: 'none',
      params: {},
      reply: 'Main bilkul taiyaar hoon dost! Boliye, kya sunenge ya kya baat karenge?'
    });
  }

  const systemInstruction = `
Role & Persona:
You are Pankaj's close, chill, and tech-savvy AI music buddy embedded directly inside his music web application. You talk just like a close friend hanging out on a WhatsApp voice call or chilling together.

Core Behavioral Rules:
1. MULTILINGUAL AUTO-SWITCHING: Automatically detect the language of the user's input (English, Hindi, or Hinglish) and respond fluently in that exact same language or natural mixed-code style (Hinglish). Never force a specific language.
2. ZERO ROBOTIC TROPES: Strictly NEVER use assistant phrases like "How may I assist you?", "I am an AI", "Sure, processing", or formal corporate templates. Talk casually, warmly, and use natural slang ("Bhai", "Haan bol", "Sahi hai", "Scene set hai").
3. ULTRA-SHORT & SNAPPY (Low Latency Optimization): Keep your conversational replies extremely brief (1 to 2 sentences, max 5-10 words when possible) to ensure instant generation, zero lag, and a real-time phone call feel.
4. BACKGROUND COMMAND EXECUTION: When the user gives a music command (e.g., play a song, skip track, change volume, search playlist), execute the required tool silently in the background immediately, and acknowledge it casually in the user's language (e.g., "Done bhai, laga diya!" or "Got it, playing right away!").

STRICT JSON OUTPUT:
{"type":"chat"|"command","action":"play_song|pause|resume|next|previous|volume|open_page|open_folder|open_application|avatar_dance|avatar_jump|avatar_wave|none","params":{},"reply":"ultra-short snappy reply (5-10 words) in user's detected language"}
RULES:
- Casual conversation, opinions, feelings, questions -> "type": "chat", "action": "none". Never play music on casual talk.
- Explicit actions -> "type": "command", with exact action and parameter.
- Mixed feeling and command -> "type": "command", execute action and acknowledge emotion casually.
- Mention exact song, folder, or setting in reply. Never say "task executed" or "command executed".
`;

  const contents = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-15)) {
      const role = h.role === 'model' || h.role === 'assistant' ? 'model' : 'user';
      const text = h.text || h.content || h.reply || '';
      if (text.trim()) contents.push({ role, parts: [{ text }] });
    }
  }

  let userMsg = message;
  if (currentMusicState?.title) {
    userMsg = `[CURRENT PLAYBACK: Song="${currentMusicState.title}", Artist="${currentMusicState.artist || 'Unknown'}"]\nUser: "${message}"`;
  }
  contents.push({ role: 'user', parts: [{ text: userMsg }] });

  try {
    let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.35
        }
      })
    });

    // 1 Retry on 429 rate limit or 503
    if (response.status === 429 || response.status === 503) {
      await new Promise(r => setTimeout(r, 1200));
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.35
          }
        })
      });
    }

    if (!response.ok) {
      return res.status(200).json({
        type: 'chat',
        action: 'none',
        params: {},
        reply: 'AI service se connect nahi ho paaya, kripya thodi der baad try karein!'
      });
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    const parsed = JSON.parse(text);
    return res.status(200).json({
      type: parsed.type || 'chat',
      action: parsed.action || 'none',
      params: parsed.params || {},
      reply: parsed.reply || 'Haanji, bilkul!'
    });
  } catch (err) {
    return res.status(200).json({
      type: 'chat',
      action: 'none',
      params: {},
      reply: 'Connection mein dikkat aayi dost! Ek baar fir se boliye.'
    });
  }
}
