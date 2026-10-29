/**
 * Mood-to-Music NLP Classifier & Intent Extraction Engine
 * Provides deterministic and multilingual semantic analysis for Hindi, English, Punjabi, and Hinglish.
 */

const MOOD_KEYWORDS = {
  sad: [
    'sad', 'dard', 'dard bhare', 'gam', 'gham', 'breakup', 'heartbreak', 'broken', 'alone', 
    'lonely', 'tanhai', 'udaas', 'rona', 'crying', 'depressed', 'tears', 'bikhra', 'judaai'
  ],
  happy: [
    'happy', 'khushi', 'joy', 'smile', 'upbeat', 'cheerful', 'mast', 'masti', 'khush', 
    'celebration', 'fun', 'bhangra', 'dhamaal', 'positive', 'good vibes'
  ],
  romantic: [
    'romantic', 'pyaar', 'ishq', 'mohabbat', 'love', 'couple', 'dil', 'sweetheart', 
    'valentine', 'romance', 'propose', 'date', 'deewana', 'sanam', 'humdum'
  ],
  chill: [
    'chill', 'relax', 'soothing', 'peaceful', 'calm', 'shanti', 'sukoon', 'lofi', 
    'lo-fi', 'slowed', 'reverb', 'evening', 'shaam', 'sunset', 'meditation'
  ],
  focus: [
    'focus', 'study', 'studying', 'reading', 'work', 'working', 'coding', 'programming', 
    'concentration', 'instrumental', 'ambient', 'deep focus', 'binaural', 'brain'
  ],
  energetic: [
    'energetic', 'energy', 'workout', 'gym', 'running', 'cardio', 'dhol', 'josh', 
    'power', 'beast mode', 'motivation', 'motivational', 'pump', 'heavy', 'fast'
  ],
  nostalgic: [
    'nostalgic', 'nostalgia', 'old', 'purane', 'purana', 'retro', 'golden era', 'vintage', 
    'classic', 'yaadein', 'bachpan', 'memories', 'evergreen', 'radio'
  ],
  rainy: [
    'rain', 'rainy', 'rainy day', 'baarish', 'barish', 'barsaat', 'badal', 'clouds', 
    'monsoon', 'rimjhim', 'boondein', 'mausam'
  ],
  roadtrip: [
    'road trip', 'drive', 'long drive', 'highway', 'travelling', 'travel', 'car', 'safar', 
    'trip', 'journey', 'rasta', 'cruising'
  ],
  party: [
    'party', 'dance', 'club', 'dj', 'nightclub', 'bass', 'edm', 'banger', 'party anthems', 
    'celebrate', 'nachna', 'dhamaka'
  ]
};

const LANGUAGE_KEYWORDS = {
  hindi: ['hindi', 'bollywood', 'deshi', 'desi', 'urdu', 'hindustani'],
  punjabi: ['punjabi', 'bhangra', 'dhol', 'chandigarh', 'amritsar', 'pollywood'],
  english: ['english', 'hollywood', 'western', 'pop', 'global'],
  tamil: ['tamil', 'kollywood'],
  telugu: ['telugu', 'tollywood'],
  bengali: ['bengali', 'rabindra', 'bangla']
};

const ERA_KEYWORDS = {
  '1970s': ['70s', '1970s', 'seventies', 'kishore', 'rd burman', 'rafi', 'lata'],
  '1980s': ['80s', '1980s', 'eighties', 'disco', 'bappi', 'mithun'],
  '1990s': ['90s', '1990s', 'nineties', 'kumar sanu', 'alka yagnik', 'udit narayan'],
  '2000s': ['2000s', '2k', 'y2k', 'kk', 'sonu nigam', 'shreya', 'mohabbat'],
  '2010s': ['2010s', 'arijit', 'yo yo honey singh', 'atif aslam', 'pritam', 'badshah'],
  latest: ['latest', '2024', '2025', '2026', 'trending', 'new', 'nayi', 'nava']
};

const ENERGY_KEYWORDS = {
  low: ['slow', 'calm', 'soft', 'gentle', 'deep', 'acoustic', 'low energy', 'peaceful'],
  high: ['fast', 'high energy', 'intense', 'hard', 'explosive', 'loud', 'bass boosted'],
  medium: ['medium', 'balanced', 'rhythmic', 'groove']
};

export function interpretMoodPrompt(prompt = '', userPreferences = {}) {
  const cleanPrompt = (prompt || '').trim().toLowerCase();
  
  // 1. Identify primary mood
  let detectedMood = userPreferences.mood || null;
  let moodConfidence = 0.5;

  for (const [moodKey, keywords] of Object.entries(MOOD_KEYWORDS)) {
    for (const kw of keywords) {
      if (cleanPrompt.includes(kw)) {
        detectedMood = moodKey;
        moodConfidence = 0.9;
        break;
      }
    }
    if (detectedMood && moodConfidence > 0.8) break;
  }

  // Fallback to chill/relax if still unknown
  if (!detectedMood) {
    detectedMood = 'chill';
    moodConfidence = 0.4;
  }

  // 2. Identify language
  let detectedLanguage = userPreferences.language || null;
  for (const [langKey, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
    for (const kw of keywords) {
      if (cleanPrompt.includes(kw)) {
        detectedLanguage = langKey;
        break;
      }
    }
    if (detectedLanguage) break;
  }
  if (!detectedLanguage) detectedLanguage = 'hindi'; // Default to catalog primary language

  // 3. Identify Era
  let detectedEra = userPreferences.era || null;
  for (const [eraKey, keywords] of Object.entries(ERA_KEYWORDS)) {
    for (const kw of keywords) {
      if (cleanPrompt.includes(kw)) {
        detectedEra = eraKey;
        break;
      }
    }
    if (detectedEra) break;
  }

  // 4. Identify Energy
  let detectedEnergy = userPreferences.energy || null;
  for (const [energyKey, keywords] of Object.entries(ENERGY_KEYWORDS)) {
    for (const kw of keywords) {
      if (cleanPrompt.includes(kw)) {
        detectedEnergy = energyKey;
        break;
      }
    }
    if (detectedEnergy) break;
  }
  if (!detectedEnergy) {
    if (['energetic', 'party'].includes(detectedMood)) detectedEnergy = 'high';
    else if (['sad', 'chill', 'focus'].includes(detectedMood)) detectedEnergy = 'low';
    else detectedEnergy = 'medium';
  }

  // 5. Construct high-relevance search queries targeting YouTube catalogue
  const queries = generateCatalogSearchQueries({
    mood: detectedMood,
    language: detectedLanguage,
    era: detectedEra,
    energy: detectedEnergy,
    prompt: cleanPrompt
  });

  return {
    mood: detectedMood,
    confidence: moodConfidence,
    language: detectedLanguage,
    era: detectedEra,
    energy: detectedEnergy,
    isRuleBased: true,
    suggestedQueries: queries
  };
}

function generateCatalogSearchQueries({ mood, language, era, energy, prompt }) {
  const queries = [];
  const langPrefix = language === 'hindi' ? 'hindi' : (language === 'punjabi' ? 'punjabi' : (language === 'english' ? 'english' : ''));

  // Query 1: Mood + Language + specific keyword
  if (mood === 'sad') {
    queries.push(`${langPrefix} sad heartbreak songs lyrical audio`.trim());
    queries.push(`${langPrefix} emotional painful songs playlist`.trim());
    if (era) queries.push(`${era} ${langPrefix} sad songs`.trim());
  } else if (mood === 'romantic') {
    queries.push(`${langPrefix} romantic love songs collection`.trim());
    queries.push(`${langPrefix} couple romantic playlist hits`.trim());
  } else if (mood === 'energetic') {
    queries.push(`${langPrefix} gym workout high energy songs`.trim());
    queries.push(`${langPrefix} motivational upbeat tracks`.trim());
  } else if (mood === 'party') {
    queries.push(`${langPrefix} party club dance songs mix`.trim());
    queries.push(`${langPrefix} wedding dhol blast hits`.trim());
  } else if (mood === 'chill') {
    queries.push(`${langPrefix} lofi chill relax songs slowed reverb`.trim());
    queries.push(`${langPrefix} peaceful acoustic midnight melody`.trim());
  } else if (mood === 'focus') {
    queries.push(`${langPrefix} instrumental calm study coding music`.trim());
    queries.push(`relaxing ambient flute sitar guitar study music`);
  } else if (mood === 'nostalgic') {
    queries.push(`90s 80s evergreen golden hits ${langPrefix}`.trim());
    queries.push(`retro ${langPrefix} classic melody radio`.trim());
  } else if (mood === 'rainy') {
    queries.push(`${langPrefix} baarish rain monsoon songs romantic`.trim());
    queries.push(`rainy day lofi ${langPrefix} soothing songs`.trim());
  } else if (mood === 'roadtrip') {
    queries.push(`${langPrefix} road trip highway car drive songs`.trim());
    queries.push(`indie travel ${langPrefix} feel good tracks`.trim());
  } else if (mood === 'happy') {
    queries.push(`${langPrefix} feel good cheerful happy songs`.trim());
    queries.push(`${langPrefix} positive vibes dance mix`.trim());
  }

  // If user entered era
  if (era && !queries.some(q => q.includes(era))) {
    queries.unshift(`${era} ${langPrefix} ${mood} songs`.trim());
  }

  // If prompt has specific artist names, prioritize them
  const artists = ['arijit', 'kk', 'atif', 'sidhu', 'diljit', 'kumar sanu', 'kishore', 'rafi', 'lata', 'sonu nigam', 'shreya'];
  for (const art of artists) {
    if (prompt.includes(art)) {
      queries.unshift(`${art} ${langPrefix} ${mood} best songs`.trim());
      break;
    }
  }

  return [...new Set(queries)];
}
