/**
 * Loopra Voice Agent API Routes
 * Exposes AI intent parsing, permission gates, and execution validation.
 */

import express from 'express';
import { voiceAgentService } from '../services/voiceAgentService.js';
import { featureFlagService } from '../services/featureFlagService.js';
import { verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const router = express.Router();

/**
 * Optional user authentication helper
 */
const resolveCallingUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return null;

  try {
    const user = await User.findById(decoded.userId).select('role status username email').lean();
    if (user && (user.status === 'suspended' || user.status === 'deactivated')) {
      return null;
    }
    return user;
  } catch (_) {
    return null;
  }
};

/**
 * POST /api/voice-agent/recognize-audio
 * Accepts raw base64 microphone audio directly from the client.
 * Calls Gemini's native multimodal audio model (gemini-3.8-flash) to:
 * 1. Accurately transcribe Indian English, Hindi, and Hinglish speech.
 * 2. Comprehend slang, incomplete sentences, and contextual follow-ups.
 * 3. Return structured plan with intent, parameters, and instant speech confirmation.
 */
router.post('/recognize-audio', async (req, res) => {
  try {
    const user = await resolveCallingUser(req);

    // Validate feature flag permission gate
    const config = await featureFlagService.getFeatureConfig('voice_control');
    const allowed = featureFlagService.evaluateAccess(config, user);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: 'Voice Control is not enabled for your account.',
        allowed: false
      });
    }

    const { audioData, mimeType, currentTrack, activeTab, history } = req.body;
    if (!audioData || typeof audioData !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid "audioData" (base64 string expected).'
      });
    }

    const result = await voiceAgentService.recognizeAndParseAudio({
      audioData,
      mimeType: mimeType || 'audio/webm',
      currentTrack,
      activeTab: activeTab || 'home',
      history: Array.isArray(history) ? history : []
    });

    return res.json({
      success: true,
      allowed: true,
      ...result
    });
  } catch (err) {
    console.error('[VoiceAgentRoute] recognize-audio error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to recognize and parse audio: ' + err.message
    });
  }
});

/**
 * POST /api/voice-agent/parse-intent
 * Translates multi-lingual voice/typed utterance into structured execution plan
 */
router.post('/parse-intent', async (req, res) => {
  try {
    const user = await resolveCallingUser(req);

    // Validate feature flag permission gate
    const config = await featureFlagService.getFeatureConfig('voice_control');
    const allowed = featureFlagService.evaluateAccess(config, user);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: 'Voice Control is not enabled for your account.',
        allowed: false
      });
    }

    const { utterance, currentTrack, activeTab, history } = req.body;
    if (!utterance || typeof utterance !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid "utterance" in request body.'
      });
    }

    const plan = await voiceAgentService.parseIntent({
      utterance,
      currentTrack,
      activeTab: activeTab || 'home',
      history: Array.isArray(history) ? history : []
    });

    return res.json({
      success: true,
      allowed: true,
      ...plan
    });
  } catch (err) {
    console.error('[VoiceAgentRoute] parse-intent error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to parse voice command intent: ' + err.message
    });
  }
});

/**
 * GET /api/voice-agent/tools
 * Returns registry of all native Loopra tools
 */
router.get('/tools', (req, res) => {
  return res.json({
    success: true,
    tools: voiceAgentService.getTools ? voiceAgentService.getTools() : []
  });
});

/**
 * Common conversational Romanized Hindi phrases mapped to crystal-clear Devanagari Hindi
 * This ensures Microsoft Edge Neural TTS pronounces phrases with 100% authentic Indian Hindi accent.
 */
const HINDI_PHONETIC_MAP = [
  [/saloon fm khol raha hu/gi, 'सलून एफएम खोल रही हूँ'],
  [/chalo, saloon fm kholte hai/gi, 'चलो, सलून एफएम खोलते हैं'],
  [/main saloon fm open kar rahi hu/gi, 'मैं सलून एफएम ओपन कर रही हूँ'],
  [/horn ok please station chalu kar raha hu/gi, 'हॉर्न ओके प्लीज स्टेशन चालू कर रही हूँ'],
  [/horn ok please station open ho gaya dost/gi, 'हॉर्न ओके प्लीज स्टेशन ओपन हो गया दोस्त'],
  [/desi theka session start kar diya/gi, 'देसी ठेका सेशन स्टार्ट कर दिया दोस्त'],
  [/desi theka session open kar rahi hu/gi, 'देसी ठेका सेशन ओपन कर रही हूँ'],
  [/time machine radio open kar diya/gi, 'टाइम मशीन रेडियो ओपन कर दिया दोस्त'],
  [/time machine radio chalu kar diya/gi, 'टाइम मशीन रेडियो चालू कर दिया दोस्त'],
  [/indian live radio chalu kar diya/gi, 'इंडियन लाइव रेडियो चालू कर दिया दोस्त'],
  [/home page par aa gaye/gi, 'होम पेज पर आ गए हैं दोस्त'],
  [/home page khol diya/gi, 'होम पेज खोल दिया है दोस्त'],
  [/aapki library open kar di/gi, 'आपकी लाइब्रेरी ओपन कर दी है'],
  [/liked songs open kar diye/gi, 'लाइक्ड सॉन्ग्स ओपन कर दिए हैं'],
  [/trending songs dikha raha hu/gi, 'ट्रेंडिंग सॉन्ग्स दिखा रही हूँ'],
  [/gaana baja diya hai/gi, 'गाना बजा दिया है, एन्जॉय करो'],
  [/music pause kar diya hai/gi, 'म्यूजिक पॉज़ कर दिया है'],
  [/music rok diya hai/gi, 'म्यूजिक रोक दिया है'],
  [/gaana wapas play kar diya/gi, 'गाना वापस प्ले कर दिया दोस्त'],
  [/music resume ho gaya hai/gi, 'म्यूजिक रिज्यूम हो गया है दोस्त'],
  [/agla gaana chala diya bhai/gi, 'अगला गाना चला दिया दोस्त!'],
  [/next song chala diya hai dost/gi, 'नेक्स्ट सॉन्ग चला दिया है दोस्त!'],
  [/pichla gaana chala diya bhai/gi, 'पिछला गाना चला दिया दोस्त!'],
  [/pichle gaane par le aayi hu/gi, 'पिछले गाने पर ले आई हूँ दोस्त!'],
  [/volume kam kar di hai/gi, 'वॉल्यूम कम कर दी है'],
  [/volume dheere kar di hai dost/gi, 'वॉल्यूम धीरे कर दी है दोस्त'],
  [/volume badha di hai/gi, 'वॉल्यूम बढ़ा दी है'],
  [/volume tej kar di hai dost/gi, 'वॉल्यूम तेज़ कर दी है दोस्त'],
  [/hey! main loopra hoon, bataiye kaunsa gaana lagau aapke liye\?/gi, 'हे! मैं लूप्रा हूँ, बताइए कौन सा गाना लगाऊँ आपके लिए?'],
  [/namaste dost! loopra aapke saath hai, bataiye kya sunenge\?/gi, 'नमस्ते दोस्त! लूप्रा आपके साथ है, बताइए क्या सुनेंगे?'],
  [/done dost! command execute ho gaya/gi, 'डन दोस्त! कमांड एक्जीक्यूट हो गया'],
  [/bilkul! command complete ho gaya dost/gi, 'बिल्कुल! काम हो गया दोस्त']
];

const HINDI_WORD_TRANS_MAP = [
  [/\bmain\b/gi, 'मैं'],
  [/\bhoon\b/gi, 'हूँ'],
  [/\bhu\b/gi, 'हूँ'],
  [/\bloopra\b/gi, 'लूप्रा'],
  [/\bnamaste\b/gi, 'नमस्ते'],
  [/\bdost\b/gi, 'दोस्त'],
  [/\baapke\b/gi, 'आपके'],
  [/\baapka\b/gi, 'आपका'],
  [/\bliye\b/gi, 'लिए'],
  [/\bkaunsa\b/gi, 'कौन सा'],
  [/\bgaana\b/gi, 'गाना'],
  [/\bgaane\b/gi, 'गाने'],
  [/\bgeet\b/gi, 'गीत'],
  [/\blagau\b/gi, 'लगाऊँ'],
  [/\bchalao\b/gi, 'चलाओ'],
  [/\bchalau\b/gi, 'चलाऊँ'],
  [/\bchala\b/gi, 'चला'],
  [/\bbajao\b/gi, 'बजाओ'],
  [/\bbaja\b/gi, 'बजा'],
  [/\bsunenge\b/gi, 'सुनेंगे'],
  [/\bsunao\b/gi, 'सुनाओ'],
  [/\bsuno\b/gi, 'सुनो'],
  [/\bkhol\b/gi, 'खोल'],
  [/\bkholo\b/gi, 'खोलो'],
  [/\bdiya\b/gi, 'दिया'],
  [/\bdiye\b/gi, 'दिए'],
  [/\brahi\b/gi, 'रही'],
  [/\braha\b/gi, 'रही'], // Strictly female speaker
  [/\bhai\b/gi, 'है'],
  [/\bhain\b/gi, 'हैं'],
  [/\bkaro\b/gi, 'करो'],
  [/\bkar\b/gi, 'कर'],
  [/\btheek\b/gi, 'ठीक'],
  [/\bthik\b/gi, 'ठीक'],
  [/\bachha\b/gi, 'अच्छा'],
  [/\bbilkul\b/gi, 'बिल्कुल'],
  [/\broko\b/gi, 'रोको'],
  [/\brok\b/gi, 'रोक'],
  [/\bshukriya\b/gi, 'शुक्रिया'],
  [/\balvida\b/gi, 'अलविदा'],
  [/\bagla\b/gi, 'अगला'],
  [/\bpichla\b/gi, 'पिछला'],
  [/\bkam\b/gi, 'कम'],
  [/\btez\b/gi, 'तेज़'],
  [/\bdheere\b/gi, 'धीरे'],
  [/\bbadha\b/gi, 'बढ़ा'],
  [/\bsuno\b/gi, 'सुनो']
];

const HINDI_DETECT_REGEX = /[\u0900-\u097F]|\b(namaste|khol|chalu|chala|chalao|chalau|baja|bajao|gaana|gaane|geet|sunenge|suno|sunao|karo|kar|rahi|raha|hoon|hu|hai|hain|dost|bhai|aapke|aapka|kaunsa|kya|kyun|achha|theek|thik|shukriya|alvida|badha|dheere|tez|rok|roko|agla|pichla|meri|mera|saloon)\b/i;

function optimizeForIndianSpeech(text, isDevanagariPreferred = true) {
  if (!text) return '';
  let cleaned = text.trim();
  
  // 1. First check phrase-level exact mappings
  for (const [regex, devanagari] of HINDI_PHONETIC_MAP) {
    if (regex.test(cleaned)) {
      return devanagari;
    }
  }

  // 2. If Hindi voice preferred, convert common Roman Hindi words to Devanagari
  if (isDevanagariPreferred) {
    let converted = cleaned;
    for (const [regex, devanagari] of HINDI_WORD_TRANS_MAP) {
      converted = converted.replace(regex, devanagari);
    }
    return converted;
  }
  return cleaned;
}

/**
 * Helper: Synthesize speech via VEXYL-TTS (AI4Bharat Indic Parler-TTS) if configured
 */
async function tryVexylTts({ text, lang, speaker, style = 'warm' }) {
  const vexylUrl = process.env.VEXYL_TTS_URL || process.env.VEXYL_TTS_ENDPOINT;
  if (!vexylUrl) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const targetSpeaker = speaker || (lang === 'hi-IN' ? 'Divya' : 'Mary');
    const res = await fetch(`${vexylUrl.replace(/\/+$/, '')}/batch/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.VEXYL_TTS_API_KEY ? { 'Authorization': `Bearer ${process.env.VEXYL_TTS_API_KEY}` } : {})
      },
      body: JSON.stringify({
        text,
        lang,
        speaker: targetSpeaker,
        style
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('audio/')) {
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
      const data = await res.json();
      if (data && data.audio_b64) {
        return Buffer.from(data.audio_b64, 'base64');
      }
    }
  } catch (err) {
    console.warn('[VoiceAgentTTS] VEXYL-TTS endpoint unreachable or timed out, routing to hosted neural engine:', err.message);
  }
  return null;
}

/**
 * GET / POST /api/voice-agent/tts
 * Generates genuine neural Indian Hindi/English TTS audio stream with natural human Indian female voice.
 * Primary models & voices:
 * 1. VEXYL-TTS (AI4Bharat Indic Parler-TTS):
 *    - Hindi: Divya (hi-IN, warm style)
 *    - Indian English: Mary (en-IN, warm style)
 * 2. Hosted Neural Indian Speech Engine (100% Free, Zero API Key):
 *    - Hindi (Devanagari): hi-IN-SwaraNeural (Expressive, warm conversational Indian female voice)
 *    - Indian English & Hinglish: en-IN-NeerjaExpressiveNeural (Natural, fluent conversational Indian female voice)
 * Strictly NO British voices or unnatural accents.
 */
const handleTtsRequest = async (req, res) => {
  const rawText = (req.method === 'POST' ? req.body?.text : req.query.text) || '';
  const cleanText = (typeof rawText === 'string' ? rawText : '').trim();
  const customVoice = req.method === 'POST' ? req.body?.voice : req.query.voice;
  const emotion = ((req.method === 'POST' ? req.body?.emotion : req.query.emotion) || 'friendly').toLowerCase();

  if (!cleanText) {
    return res.status(400).json({ error: 'Text query parameter is required' });
  }

  // 1. Intelligent Indian Hindi / Hinglish Identification
  const isHindiDetected = HINDI_DETECT_REGEX.test(cleanText);
  const detectedLang = isHindiDetected ? 'hi-IN' : 'en-IN';

  // 2. Select appropriate 100% natural Indian female voice (Strictly NO male voices)
  let voiceName = customVoice;
  if (!voiceName) {
    voiceName = isHindiDetected ? 'hi-IN-SwaraNeural' : 'en-IN-NeerjaExpressiveNeural';
  } else if (voiceName.includes('Swara') || voiceName.includes('Neerja')) {
    // Verified Indian female voice
  } else {
    voiceName = isHindiDetected ? 'hi-IN-SwaraNeural' : 'en-IN-NeerjaExpressiveNeural';
  }

  // 3. Try VEXYL-TTS (AI4Bharat Indic Parler-TTS: Divya / Mary) if server configured
  const vexylSpeaker = detectedLang === 'hi-IN' ? 'Divya' : 'Mary';
  const vexylAudio = await tryVexylTts({
    text: cleanText,
    lang: detectedLang,
    speaker: vexylSpeaker,
    style: 'warm'
  });

  if (vexylAudio) {
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(vexylAudio);
  }

  // 4. Hosted High-Fidelity Neural Indian Voice (Swara / Neerja)
  const isHindiVoice = voiceName.startsWith('hi-IN');
  const speechText = optimizeForIndianSpeech(cleanText, isHindiVoice);

  // Natural human conversational pacing (+4% rate)
  let rateModifier = '+4%';
  let pitchModifier = '+0Hz';
  if (emotion === 'enthusiastic') {
    rateModifier = '+8%';
    pitchModifier = '+4Hz';
  } else if (emotion === 'chill') {
    rateModifier = '-2%';
    pitchModifier = '-2Hz';
  }

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const readable = tts.toStream(speechText, {
      rate: rateModifier,
      pitch: pitchModifier
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    readable.audioStream.pipe(res);
  } catch (err) {
    console.warn('[VoiceAgentTTS] Edge Neural TTS notice, retrying with fallback Indian voice:', err.message);
    try {
      const fallbackVoice = hasDevanagari ? 'hi-IN-SwaraNeural' : 'en-IN-NeerjaExpressiveNeural';
      const tts2 = new MsEdgeTTS();
      await tts2.setMetadata(fallbackVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const readable2 = tts2.toStream(speechText || cleanText);
      res.setHeader('Content-Type', 'audio/mpeg');
      return readable2.audioStream.pipe(res);
    } catch (gErr) {
      console.error('[VoiceAgentTTS] Secondary neural TTS retry failed:', gErr.message);
      return res.status(500).json({ error: 'TTS generation failed' });
    }
  }
};

router.get('/tts', handleTtsRequest);
router.post('/tts', handleTtsRequest);

export default router;

