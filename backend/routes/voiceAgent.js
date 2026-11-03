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
  [/saloon fm khol raha hoon/gi, 'सलून एफएम खोल रहा हूँ'],
  [/chalo, saloon fm kholte hain/gi, 'चलो, सलून एफएम खोलते हैं'],
  [/main saloon fm open kar rahi hoon/gi, 'मैं सलून एफएम ओपन कर रही हूँ'],
  [/horn ok please station chalu kar raha hoon/gi, 'हॉर्न ओके प्लीज स्टेशन चालू कर रहा हूँ'],
  [/horn ok please station open ho gaya dost/gi, 'हॉर्न ओके प्लीज स्टेशन ओपन हो गया दोस्त'],
  [/desi theka session start kar diya/gi, 'देसी ठेका सेशन स्टार्ट कर दिया भाई'],
  [/desi theka session open kar rahi hoon/gi, 'देसी ठेका सेशन ओपन कर रही हूँ'],
  [/time machine radio open kar diya/gi, 'टाइम मशीन रेडियो ओपन कर दिया भाई'],
  [/time machine radio chalu kar diya/gi, 'टाइम मशीन रेडियो चालू कर दिया दोस्त'],
  [/indian live radio chalu kar diya/gi, 'इंडियन लाइव रेडियो चालू कर दिया दोस्त'],
  [/home page par aa gaye/gi, 'होम पेज पर आ गए हैं भाई'],
  [/home page khol diya/gi, 'होम पेज खोल दिया है दोस्त'],
  [/aapki library open kar di/gi, 'आपकी लाइब्रेरी ओपन कर दी है'],
  [/liked songs open kar diye/gi, 'लाइक्ड सॉन्ग्स ओपन कर दिए हैं'],
  [/trending songs dikha raha hoon/gi, 'ट्रेंडिंग सॉन्ग्स दिखा रहा हूँ'],
  [/gaana baja diya hai/gi, 'गाना बजा दिया है, एन्जॉय करो'],
  [/music pause kar diya hai/gi, 'म्यूजिक पॉज़ कर दिया है'],
  [/music rok diya hai/gi, 'म्यूजिक रोक दिया है'],
  [/gaana wapas play kar diya/gi, 'गाना वापस प्ले कर दिया भाई'],
  [/music resume ho gaya hai/gi, 'म्यूजिक रिज्यूम हो गया है दोस्त'],
  [/agla gaana chala diya bhai/gi, 'अगला गाना चला दिया भाई!'],
  [/next song chala diya hai dost/gi, 'नेक्स्ट सॉन्ग चला दिया है दोस्त!'],
  [/pichla gaana chala diya bhai/gi, 'पिछला गाना चला दिया भाई!'],
  [/pichle gaane par le aayi hoon/gi, 'पिछले गाने पर ले आई हूँ दोस्त!'],
  [/volume kam kar di hai/gi, 'वॉल्यूम कम कर दी है'],
  [/volume dheere kar di hai dost/gi, 'वॉल्यूम धीरे कर दी है दोस्त'],
  [/volume badha di hai/gi, 'वॉल्यूम बढ़ा दी है'],
  [/volume tej kar di hai dost/gi, 'वॉल्यूम तेज़ कर दी है दोस्त'],
  [/bilkul! loopra ready hai, bataiye kya sunna chahenge aap\?/gi, 'बिल्कुल! लूप्रा रेडी है, बताइए क्या सुनना चाहेंगे आप?'],
  [/haan bilkul! loopra ready hai, batao kya play karun\?/gi, 'हाँ बिल्कुल! लूप्रा रेडी है, बताओ क्या प्ले करूँ?'],
  [/done dost! command execute ho gaya/gi, 'डन दोस्त! कमांड एक्जीक्यूट हो गया'],
  [/bilkul! command complete ho gaya bhai/gi, 'बिल्कुल! काम हो गया भाई']
];

function optimizeForIndianSpeech(text, isDevanagariPreferred = true) {
  if (!text) return '';
  let cleaned = text.trim();
  if (isDevanagariPreferred) {
    for (const [regex, devanagari] of HINDI_PHONETIC_MAP) {
      if (regex.test(cleaned)) {
        return devanagari;
      }
    }
  }
  return cleaned;
}

/**
 * GET /api/voice-agent/tts
 * Generates genuine neural Indian Hindi/English TTS audio stream with crystal-clear Indian accent.
 * Uses 100% free Microsoft Edge Neural Indian voice:
 * Retained Female Voice: en-IN-NeerjaExpressiveNeural (Single official female voice across all Loopra)
 * Male: hi-IN-MadhurNeural / en-IN-PrabhatNeural
 */
router.get('/tts', async (req, res) => {
  const rawText = (req.query.text || '').trim();
  const gender = (req.query.gender || 'female').toLowerCase();
  const customVoice = req.query.voice;
  const emotion = (req.query.emotion || 'friendly').toLowerCase();

  if (!rawText) {
    return res.status(400).json({ error: 'Text query parameter is required' });
  }

  // 1. High-Fidelity Microsoft Edge Neural Indian Speech Engine
  // Strict Single Female Voice: 'en-IN-NeerjaExpressiveNeural'
  let voiceName = customVoice;
  if (!voiceName) {
    voiceName = gender === 'male' ? 'en-IN-PrabhatNeural' : 'en-IN-NeerjaExpressiveNeural';
  } else if (voiceName.includes('Swara') || voiceName.includes('NeerjaNeural')) {
    voiceName = 'en-IN-NeerjaExpressiveNeural';
  }

  // Optimize text phonetics so it speaks with 100% natural Indian pronunciation
  const isHindiVoice = voiceName.startsWith('hi-IN');
  const speechText = optimizeForIndianSpeech(rawText, isHindiVoice);

  // Dynamic prosody based on emotion
  let rateModifier = '+12%';
  let pitchModifier = '+0Hz';
  if (emotion === 'enthusiastic') {
    rateModifier = '+15%';
    pitchModifier = '+6Hz';
  } else if (emotion === 'chill') {
    rateModifier = '-4%';
    pitchModifier = '-4Hz';
  } else if (emotion === 'formal') {
    rateModifier = '+2%';
    pitchModifier = '+0Hz';
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
    console.warn('[VoiceAgentTTS] Edge Neural TTS notice, retrying with en-IN-NeerjaExpressiveNeural:', err.message);
    try {
      // Direct retry with default official voice
      const fallbackVoice = gender === 'male' ? 'en-IN-PrabhatNeural' : 'en-IN-NeerjaExpressiveNeural';
      const tts2 = new MsEdgeTTS();
      await tts2.setMetadata(fallbackVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const readable2 = tts2.toStream(rawText);
      res.setHeader('Content-Type', 'audio/mpeg');
      return readable2.audioStream.pipe(res);
    } catch (_) {
      try {
        const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(speechText)}&tl=hi&client=tw-ob`;
        const gRes = await fetch(gUrl);
        if (gRes.ok) {
          res.setHeader('Content-Type', 'audio/mpeg');
          const arrayBuffer = await gRes.arrayBuffer();
          return res.send(Buffer.from(arrayBuffer));
        }
      } catch (gErr) {
        console.error('[VoiceAgentTTS] Fallback Google TTS failed:', gErr.message);
      }
    }
    return res.status(500).json({ error: 'TTS generation failed' });
  }
});

export default router;

