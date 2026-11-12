/**
 * Multi-Step Voice Command Executor for Loopra AI Avatar
 * 
 * Decomposes compound multi-intent utterances into sequential steps,
 * handles state settlement synchronization between UI renders and track updates,
 * provides Hindi Devanagari-to-Latin transliteration and named playlist matching,
 * and executes context-scoped playback against the active collection tracks.
 */

// Devanagari phonetic dictionary for voice command normalization
const HINDI_DICT = {
  'सावन एफएम': 'salon fm',
  'सावन': 'salon fm',
  'सैलून एफएम': 'salon fm',
  'सैलून': 'salon fm',
  'टाइम मशीन रेडियो': 'time machine radio',
  'टाइम मशीन': 'time machine',
  'मूड टू म्यूजिक एआई': 'mood to music ai',
  'मूड टू म्यूजिक': 'mood to music',
  'मूड एआई': 'mood ai',
  'हॉर्न ओके प्लीज': 'horn ok please',
  'ठेका सेशन': 'theka session',
  'ठेका': 'theka',
  'लाइक्ड सॉन्ग्स': 'liked songs',
  'लाइक्ड सॉन्ग': 'liked songs',
  'लाइक्ड': 'liked',
  'डाउनलोड्स': 'downloads',
  'डाउनलोडेड': 'downloaded',
  'ऑफलाइन': 'offline',
  'हिस्ट्री': 'history',
  'प्लेलिस्ट': 'playlist',
  'गाना': 'gaana',
  'गाने': 'gaane',
  'सॉन्ग': 'song',
  'सॉन्ग्स': 'songs',
  'म्यूजिक': 'music',
  'चलाओ': 'chalao',
  'चला': 'chala',
  'बजाओ': 'bajao',
  'बजा': 'baja',
  'रोको': 'roko',
  'रोक': 'rok',
  'पॉज': 'pause',
  'प्ले': 'play',
  'अगला': 'agla',
  'नेक्स्ट': 'next',
  'पिछला': 'pichhla',
  'बैक': 'back',
  'आवाज': 'aawaz',
  'आवाज़': 'aawaz',
  'वॉल्यूम': 'volume',
  'कम': 'kam',
  'ज्यादा': 'zyada',
  'बढ़ाओ': 'badhao',
  'घटाओ': 'ghatao',
  'खोजो': 'khojo',
  'ढूंढो': 'dhundho',
  'सर्च': 'search',
  'खोलें': 'kholo',
  'खोलो': 'kholo',
  'ओपन': 'open',
  'बंद': 'band',
  'पसंद': 'pasand',
  'लाइक': 'like',
  'कतार': 'queue',
  'क्यू': 'queue',
  'क्यु': 'queue',
  'होम': 'home',
  'रेडियो': 'radio',
  'डिस्कवर': 'discover',
  'सेटिंग्स': 'settings',
  'प्रोफाइल': 'profile',
  'लूप्रा': 'loopra',
  'मेरा': 'mera',
  'नाम': 'naam',
  'पंकज': 'pankaj',
  'है': 'hai',
  'करो': 'karo',
  'कर': 'kar',
  'दो': 'do',
  'दे': 'de',
  'सुनो': 'suno',
  'सुनाओ': 'sunao',
  'डांस': 'dance',
  'नाचो': 'nacho',
  'कूद': 'jump',
  'कूदो': 'jump',
  'बाय': 'byeee',
  'बाये': 'byeee',
  'एंड': 'and',
  'और': 'aur',
  'में': 'mein',
  'से': 'se',
  'कोई': 'koi'
};

const DEVANAGARI_CHAR_MAP = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ः': 'h', '्': '',
  '़': '', '।': '.', 'ऽ': '', 'ॉ': 'o', 'ॅ': 'e'
};

/**
 * Transliterates Hindi Devanagari text to Latin / English phonetic representation.
 * e.g. "पंकज" -> "pankaj"
 */
export function transliterateDevanagariToLatin(text = '') {
  if (!text || typeof text !== 'string') return text || '';
  if (!/[\u0900-\u097F]/.test(text)) return text;
  let out = text;
  for (const [hindi, latin] of Object.entries(HINDI_DICT)) {
    out = out.replace(new RegExp(hindi, 'g'), latin);
  }
  out = out.replace(/[\u0900-\u097F]/g, char => DEVANAGARI_CHAR_MAP[char] || '');
  return out.replace(/\s+/g, ' ').trim();
}

// Noise / filler words to strip when extracting specific named playlist/folder targets
const PLAYLIST_FILLER_TOKENS = new Set([
  'open', 'kar', 'karo', 'kholo', 'khol', 'chalao', 'bajao', 'play',
  'playlist', 'playlists', 'folder', 'mein', 'me', 'se', 'ko', 'ka', 'ki', 'ke',
  'de', 'do', 'aur', 'and', 'then', 'phir', 'fir', 'wahan', 'usme', 'isme',
  'ओपन', 'कर', 'करो', 'खोलो', 'खोल', 'चलाओ', 'बजाओ', 'प्ले',
  'प्लेलिस्ट', 'फोल्डर', 'में', 'से', 'को', 'का', 'की', 'के',
  'दे', 'दो', 'और', 'एंड', 'फिर', 'वहां', 'उसमें', 'इसमें'
]);

/**
 * Strips noise/filler words to isolate the target named playlist or folder.
 */
export function extractNamedPlaylistTarget(stepStr = '') {
  if (!stepStr || typeof stepStr !== 'string') return '';
  const tokens = stepStr.replace(/[?!,.;]/g, ' ').split(/\s+/).filter(Boolean);
  const remaining = tokens.filter(t => !PLAYLIST_FILLER_TOKENS.has(t.toLowerCase()));
  return remaining.join(' ').trim();
}

/**
 * Resolves a step string to a specific named user playlist using fuzzy matching
 * and Hindi Devanagari-to-Latin transliteration.
 */
export function matchNamedPlaylist(stepStr = '', userPlaylists = []) {
  if (!stepStr || !Array.isArray(userPlaylists) || userPlaylists.length === 0) return null;
  const targetRaw = extractNamedPlaylistTarget(stepStr);
  if (!targetRaw) return null;

  const targetTranslit = transliterateDevanagariToLatin(targetRaw).toLowerCase();
  const targetLower = targetRaw.toLowerCase();

  for (const pl of userPlaylists) {
    if (!pl || !pl.name) continue;
    const plName = pl.name.toLowerCase().trim();
    const plTranslit = transliterateDevanagariToLatin(plName).toLowerCase().trim();

    if (
      plName === targetLower ||
      plTranslit === targetTranslit ||
      plName.includes(targetLower) ||
      plTranslit.includes(targetTranslit) ||
      targetLower.includes(plName) ||
      targetTranslit.includes(plTranslit)
    ) {
      return pl;
    }
  }

  return null;
}

/**
 * Splits compound commands across English, Hindi, and Hinglish sequential conjunctions
 * and transition markers into an ordered array of action strings.
 * 
 * Supports: "and", "then", "after that", "aur", "phir", "fir", "uske baad", "me jaakar", "kholo aur", "एंड", ",", ";"
 */
export function splitCompoundVoiceCommand(utterance = '') {
  if (!utterance || typeof utterance !== 'string') return [];
  let text = utterance.trim();
  if (!text) return [];

  // 1. Normalize "me jaakar" / "mein jaakar" / "me jakar" / "में जाकर" -> converts "X me jaakar Y" to "X kholo aur Y"
  text = text.replace(/\s+(?:me\s+jaakar|mein\s+jaakar|me\s+jakar|mein\s+jakar|में\s+जाकर)\s+/gi, ' kholo aur ');

  // 2. Normalize "X (me se|में से) Y" where Y is a playback intent -> "X kholo aur wahan se Y"
  text = text.replace(/(?:me\s+se|mein\s+se|में\s*से)\s+(?=(?:koi|any|random|first|pehla|ek|kuch|play|chalao|bajao|sunao|koi bhi|गाना|सॉन्ग|कोई|पहला|प्ले|चलाओ|बजाओ))/gi, 'kholo aur wahan se ');

  // 3. Normalize "kholo aur" / "kholke aur" / "खोलो और" -> "kholo and"
  text = text.replace(/\b(?:kholo|khol\s+ke|kholke)\s+aur\b|(?:खोलो|खोल\s*के)\s*(?:और|aur)\b/gi, 'kholo and');

  // 4. Sequential conjunctions & transition markers pattern (including Hindi Devanagari "एंड", "और", "फिर")
  const splitPattern = /,\s*(?:then|and\s+then|aur\s+phir|phir|fir|uske\s+baad|and|aur|एंड|और|फिर)?\s*|;\s*|\s+(?:and\s+then|then|after\s+that|aur\s+phir|phir|fir|uske\s+baad|and\s+also|and|also|aur|tatha|&|एंड|और|फिर)\s+/i;

  const rawSteps = text.split(splitPattern)
    .map(s => s.trim())
    .filter(Boolean);

  const cleanSteps = [];
  for (let s of rawSteps) {
    // Strip leading connectors if any remain
    s = s.replace(/^(?:and\s+then|and\s+also|and|then|after\s+that|aur\s+phir|phir|fir|uske\s+baad|aur|also|tatha|&|एंड|और|फिर)\s+/i, '').trim();
    if (s) {
      cleanSteps.push(s);
    }
  }

  return cleanSteps;
}

/**
 * Returns true if the step asks to play from the newly opened view or active collection context.
 * Matches deictic markers: "from there", "from it", "wahan se", "usme se", "isme se", "me se", "mein se",
 * or generic directives: "any song", "random", "first song", "koi bhi gaana", etc.
 */
export function isContextualPlayStep(stepText = '') {
  if (!stepText || typeof stepText !== 'string') return false;
  const lower = stepText.toLowerCase().trim();

  // Deictic references to previously opened location
  if (
    /\b(from there|from it|from this|wahan se|waha se|usme se|isme se|me se|mein se|us collection se|playlist se|station se)\b/i.test(lower) ||
    /में\s*से|वहां\s*से|वहा\s*से|उसमें\s*से|इसमें\s*से/i.test(lower)
  ) {
    return true;
  }

  // Generic track picks
  if (
    /\b(any song|random song|random|first song|1st song|pehla gaana|pehla song|koi bhi gaana|koi gaana|koi ek gaana|koi song|ek gaana|kuch bajao|kuch chalao|shuru karo|play a song|play song)\b/i.test(lower) ||
    /कोई\s*भी\s*गाना|कोई\s*गाना|पहला\s*गाना|कोई\s*सॉन्ग|गाना\s*प्ले|गाना\s*चलाओ|गाना\s*बजाओ/i.test(lower)
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts a specific song query or target playback mode from a contextual play step string.
 */
export function parseContextualPlayMode(stepText = '') {
  if (!stepText || typeof stepText !== 'string') return { mode: 'random', songQuery: '' };
  const lower = stepText.toLowerCase().trim();

  // Strip deictic words and common verbs to isolate query if specified
  const clean = lower
    .replace(/\b(from there|from it|from this|wahan se|waha se|usme se|isme se|me se|mein se)\b/gi, '')
    .replace(/में\s*से|वहां\s*से|वहा\s*से|उसमें\s*से|इसमें\s*से/gi, '')
    .replace(/\b(play|chalao|bajao|sunao|play karo|start|lagao)\b/gi, '')
    .replace(/प्ले|कर|करो|चलाओ|बजाओ|सुनाओ/gi, '')
    .trim();

  if (/\b(first|1st|pehla)\b/i.test(clean) || /पहला/i.test(clean)) {
    return { mode: 'first', songQuery: '' };
  }
  if (
    /\b(random|shuffle|koi bhi|any song|koi song|koi gaana|kuch bhi)\b/i.test(clean) ||
    /कोई\s*भी\s*गाना|कोई\s*गाना|कोई|गाना/i.test(clean) ||
    !clean
  ) {
    return { mode: 'random', songQuery: '' };
  }

  return { mode: 'specific', songQuery: clean };
}

/**
 * Runs sequential steps in an async loop, with state settlement synchronization,
 * state-aware redundant navigation skipping, and context-scoped playback against handlers.getCurrentVisibleTracks().
 * 
 * @param {string[]} steps - Ordered list of step strings
 * @param {object} handlers - Object with execution handlers:
 *   - executeSingleStep: async (stepStr, isContextual) => { success, description, navigated, skipped }
 *   - getCurrentVisibleTracks: () => Array<Track>
 *   - playFromCurrentContext: async ({ mode, songQuery }) => { success, track }
 *   - showToast: (msg, type) => void
 *   - speak: (text) => void
 */
export async function runSequentialSteps(steps = [], handlers = {}) {
  const {
    executeSingleStep,
    getCurrentVisibleTracks,
    playFromCurrentContext,
    showToast,
    speak
  } = handlers;

  const completed = [];
  let isNavStepPreviously = false;

  for (let i = 0; i < steps.length; i++) {
    const stepText = steps[i];
    const isContextual = isContextualPlayStep(stepText) || (i > 0 && isNavStepPreviously && /\b(play|bajao|chalao|sunao|प्ले|गाना)\b/i.test(stepText));

    if (isContextual && typeof playFromCurrentContext === 'function') {
      // 1. If previous step was a navigation or collection open, await render and state settlement buffer
      if (isNavStepPreviously) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      const { mode, songQuery } = parseContextualPlayMode(stepText);
      const res = await playFromCurrentContext({ mode, songQuery });

      if (res && res.success) {
        completed.push(res.description || `Playing "${res.track?.title || 'track'}" from collection`);
      } else {
        // Report failure and abort further chain
        const failMsg = res?.message || 'Collection mein song nahi mila.';
        if (showToast) showToast(failMsg, 'warning');
        if (speak) speak(failMsg);
        return { success: false, completed, abortedAt: i, error: failMsg };
      }
      isNavStepPreviously = false;
    } else {
      // Execute normal navigation / collection open / control step
      if (typeof executeSingleStep === 'function') {
        const stepRes = await executeSingleStep(stepText, false);
        if (stepRes && stepRes.success) {
          if (!stepRes.skipped) {
            completed.push(stepRes.description || stepText);
          }
          isNavStepPreviously = Boolean(stepRes.navigated);
          if (isNavStepPreviously) {
            // Buffer to allow React state updates to mount the new route/collection
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        } else {
          const failMsg = stepRes?.message || `Could not complete step: ${stepText}`;
          if (showToast) showToast(failMsg, 'warning');
          if (speak) speak(failMsg);
          return { success: false, completed, abortedAt: i, error: failMsg };
        }
      }
    }
  }

  return {
    success: true,
    completed,
    summary: completed.join(' and ')
  };
}
