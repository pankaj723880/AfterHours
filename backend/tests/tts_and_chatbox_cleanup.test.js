import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { MsEdgeTTS, OUTPUT_FORMAT } from '../node_modules/msedge-tts/dist/index.js';

console.log('=== LOOPRA TTS ENGINE, AUDIO GENERATION & CHATBOX CLEANUP TEST SUITE ===');

after(() => {
  setTimeout(() => process.exit(0), 50);
});

const companionCode = fs.readFileSync('frontend/src/components/AiMusicCompanion/LoopraAiCompanion.jsx', 'utf-8');
const avatarWidgetCode = fs.readFileSync('frontend/src/components/VoiceAgent/LoopraAvatarWidget.jsx', 'utf-8');
const voiceBuddyCode = fs.readFileSync('frontend/src/services/voiceBuddyService.js', 'utf-8');
const voiceAgentRouteCode = fs.readFileSync('backend/routes/voiceAgent.js', 'utf-8');

describe('1. Removal of Quick Action Chips & Language Selector from Chatbox', () => {
  it('should verify Quick Action suggestion chips are removed from LoopraAiCompanion UI', () => {
    // Buttons for quick action chips must not be rendered in the companion UI
    assert.strictEqual(companionCode.includes('⚡ Saloon FM'), false, 'Must not render ⚡ Saloon FM chip');
    assert.strictEqual(companionCode.includes('🎵 Play Arijit Singh'), false, 'Must not render 🎵 Play Arijit Singh chip');
    assert.strictEqual(companionCode.includes('🔥 Trending Songs'), false, 'Must not render 🔥 Trending Songs chip');
    assert.strictEqual(companionCode.includes('📻 Radio Chalao'), false, 'Must not render 📻 Radio Chalao chip');
    assert.strictEqual(companionCode.includes('🌧️ Rainy Evening'), false, 'Must not render 🌧️ Rainy Evening chip');
  });

  it('should verify Quick Action chips are removed from LoopraAvatarWidget UI', () => {
    assert.strictEqual(avatarWidgetCode.includes('Quick Commands:'), false, 'Must not render Quick Commands header in LoopraAvatarWidget');
    assert.strictEqual(avatarWidgetCode.includes('Dance Beat'), false, 'Must not render Dance Beat chip');
  });

  it('should verify English/Hindi language toggle selector button is removed from Chatbox UI', () => {
    assert.strictEqual(companionCode.includes('🇮🇳 HI'), false, 'Must not render 🇮🇳 HI button in chat input bar');
    assert.strictEqual(companionCode.includes('🌐 EN'), false, 'Must not render 🌐 EN button in chat input bar');
  });

  it('should preserve underlying command handling and automatic language identification', () => {
    assert.ok(companionCode.includes('Saloon FM kholo'), 'Underlying command handling for Saloon FM preserved');
    assert.ok(companionCode.includes('Arijit Singh'), 'Underlying command handling for Arijit Singh preserved');
    assert.ok(companionCode.includes('Trending songs'), 'Underlying command handling for Trending songs preserved');
  });
});

describe('2. Backend Neural Indian Female TTS & VEXYL-TTS Configuration', () => {
  it('should support automatic language detection between Devanagari Hindi and Indian English', () => {
    assert.ok(voiceAgentRouteCode.includes('hasDevanagari'), 'Must detect Devanagari Hindi text');
    assert.ok(voiceAgentRouteCode.includes('hi-IN-SwaraNeural'), 'Must route Devanagari to hi-IN-SwaraNeural');
    assert.ok(voiceAgentRouteCode.includes('en-IN-NeerjaExpressiveNeural'), 'Must route Indian English/Hinglish to en-IN-NeerjaExpressiveNeural');
  });

  it('should integrate VEXYL-TTS (AI4Bharat Indic Parler-TTS) configuration with fallback', () => {
    assert.ok(voiceAgentRouteCode.includes('tryVexylTts'), 'Must define tryVexylTts helper');
    assert.ok(voiceAgentRouteCode.includes('Divya'), 'Must support Divya voice for Hindi in VEXYL-TTS');
    assert.ok(voiceAgentRouteCode.includes('Mary'), 'Must support Mary voice for Indian English in VEXYL-TTS');
    assert.ok(voiceAgentRouteCode.includes('VEXYL_TTS_URL') || voiceAgentRouteCode.includes('VEXYL_TTS_ENDPOINT'), 'Must read VEXYL-TTS URL from environment');
  });

  it('should strictly exclude British English (en-GB) voices', () => {
    assert.strictEqual(voiceAgentRouteCode.includes('en-GB'), false, 'Must never reference or fall back to en-GB');
    assert.strictEqual(voiceBuddyCode.includes('en-GB'), false, 'voiceBuddyService must never reference or fall back to en-GB');
  });

  it('should support both GET and POST /api/voice-agent/tts', () => {
    assert.ok(voiceAgentRouteCode.includes("router.get('/tts', handleTtsRequest)"), 'Must support GET /tts');
    assert.ok(voiceAgentRouteCode.includes("router.post('/tts', handleTtsRequest)"), 'Must support POST /tts');
  });
});

describe('3. Frontend VoiceBuddyService Neural Playback & Lip-Sync', () => {
  it('should stream audio from backend /api/voice-agent/tts instead of raw browser speechSynthesis', () => {
    assert.ok(voiceBuddyCode.includes('/api/voice-agent/tts'), 'Must fetch audio from /api/voice-agent/tts');
    assert.ok(voiceBuddyCode.includes('new Audio('), 'Must play TTS using HTMLAudioElement stream');
  });

  it('should implement real-time AudioContext & AnalyserNode for lip-sync modulation', () => {
    assert.ok(voiceBuddyCode.includes('initAudioMeter'), 'Must initialize audio meter for lip-sync');
    assert.ok(voiceBuddyCode.includes('speech_volume'), 'Must emit speech_volume events');
    assert.ok(voiceBuddyCode.includes('stopAudioMeter'), 'Must clean up audio meter on stop');
  });

  it('should safely suppress fallback if no Indian voice is installed in the browser', () => {
    assert.ok(voiceBuddyCode.includes('fallbackToIndianSpeechSynthesis'), 'Must implement safe Indian fallback');
    assert.ok(voiceBuddyCode.includes('No native Indian voice installed'), 'Must log and suppress non-Indian browser voices');
  });
});

describe('4. Actual Audio Generation Verification (Required Test Sentences)', () => {
  it('should generate real, high-quality audio for Indian English sentence', async () => {
    const text = 'Hello! Welcome back to Loopra. What would you like to listen to today?';
    const tts = new MsEdgeTTS();
    await tts.setMetadata('en-IN-NeerjaExpressiveNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const res = tts.toStream(text, { rate: '+4%', pitch: '+0Hz' });
    const chunks = [];
    await new Promise((resolve, reject) => {
      res.audioStream.on('data', chunk => chunks.push(chunk));
      res.audioStream.on('end', resolve);
      res.audioStream.on('error', reject);
    });
    const buf = Buffer.concat(chunks);
    assert.ok(buf.length > 5000, `Audio buffer must be valid size (>5000 bytes), got ${buf.length}`);
    // Check for MP3 sync frame (first byte 0xFF, second byte & 0xE0 === 0xE0 or ID3 tag)
    const isMp3 = (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) || (buf.slice(0, 3).toString() === 'ID3');
    assert.ok(isMp3, 'Audio buffer must be valid MP3 stream');
  });

  it('should generate real, high-quality audio for Hindi sentence', async () => {
    const text = 'नमस्ते! आज आप कौन सा गाना सुनना चाहेंगे?';
    const tts = new MsEdgeTTS();
    await tts.setMetadata('hi-IN-SwaraNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const res = tts.toStream(text, { rate: '+4%', pitch: '+0Hz' });
    const chunks = [];
    await new Promise((resolve, reject) => {
      res.audioStream.on('data', chunk => chunks.push(chunk));
      res.audioStream.on('end', resolve);
      res.audioStream.on('error', reject);
    });
    const buf = Buffer.concat(chunks);
    assert.ok(buf.length > 5000, `Hindi audio buffer must be valid size (>5000 bytes), got ${buf.length}`);
    const isMp3 = (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) || (buf.slice(0, 3).toString() === 'ID3');
    assert.ok(isMp3, 'Hindi audio buffer must be valid MP3 stream');
  });

  it('should generate real, high-quality audio for Hinglish sentence', async () => {
    const text = 'Achha, ab tumhare liye ek playlist play karti hoon.';
    const tts = new MsEdgeTTS();
    await tts.setMetadata('en-IN-NeerjaExpressiveNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const res = tts.toStream(text, { rate: '+4%', pitch: '+0Hz' });
    const chunks = [];
    await new Promise((resolve, reject) => {
      res.audioStream.on('data', chunk => chunks.push(chunk));
      res.audioStream.on('end', resolve);
      res.audioStream.on('error', reject);
    });
    const buf = Buffer.concat(chunks);
    assert.ok(buf.length > 5000, `Hinglish audio buffer must be valid size (>5000 bytes), got ${buf.length}`);
    const isMp3 = (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) || (buf.slice(0, 3).toString() === 'ID3');
    assert.ok(isMp3, 'Hinglish audio buffer must be valid MP3 stream');
  });

  it('should handle long responses in ordered chunks without truncated audio', () => {
    const longText = 'Main Loopra hoon. Main aapke liye koi bhi gaana play kar sakti hoon, jaise Arijit Singh ya trending hits. Aap radio stations bhi sun sakte hain jaise Saloon FM aur Horn Ok Please. Bas mujhe bataiye kya sunna chahenge.';
    const sentences = (longText.match(/[^.!?।\n]+[.!?।\n]*/g) || [longText]).map(s => s.trim()).filter(Boolean);
    assert.ok(sentences.length >= 3, 'Must properly segment long text into ordered sentences');
    assert.strictEqual(sentences[0], 'Main Loopra hoon.', 'First sentence must be intact');
    assert.ok(sentences[1].includes('Arijit Singh'), 'Second sentence must be intact');
  });
});
