import { useState, useEffect, useRef, useCallback } from 'react';

// Fallback Curated List of witty, funny Hinglish greetings
export const FALLBACK_GREETINGS = [
  "Arey badhiya! Phir se boring playlist chhod ke mere paas aa gaye?",
  "Aaye haaye, DJ saab padhar chuke hain! Boliye, dil toota hai ya mood party wala hai?",
  "Namaste boss! Aaj gaana sunenge ya bas meri taareef karne aaye ho?",
  "Welcome back! Chai-paani ho gaya ho toh chaliye gaane shuru karein?",
  "Arey aao aao! Earphones lagao aur batao aaj kya sunne ka plan hai?"
];

/**
 * useVoiceAgent
 * 
 * High-level voice agent hook specifically tailored for Mobile Web and PWA.
 * Features:
 * 1. Auto-ducking: Ducks active audio volume to 10% on listening start, restores to 100% on complete/error.
 * 2. Mobile-Compatible Web Speech Configuration:
 *    - continuous: false on mobile (Android/iOS) to prevent abrupt disconnections.
 *    - lang: 'hi-IN' default with Indian Hindi/Hinglish priority.
 *    - interimResults: true, maxAlternatives: 1.
 * 3. Dynamic Gemini API avatar greetings with instantaneous funny Hinglish fallback.
 */
export function useVoiceAgent({
  lang = 'hi-IN',
  onTranscript,
  onFinal,
  onError,
  autoDuck = true,
  isMuted = false
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState(null);
  const [speechText, setSpeechText] = useState('');
  const [showSpeechBubble, setShowSpeechBubble] = useState(false);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const safetyTimeoutRef = useRef(null);
  const speechTimerRef = useRef(null);

  // Pre-warm voices on page load / voices changed
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const warmVoices = () => {
      try {
        window.speechSynthesis.getVoices();
      } catch (_) {}
    };
    warmVoices();
    if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = warmVoices;
    }
  }, []);

  // Clean & Direct In-Browser Voice Selection
  const pickNaturalFemaleVoice = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // 1. First priority: Indian English / Hindi Neural or Natural Female voices
    const preferred = voices.find(v => 
      (v.lang.startsWith('en-IN') || v.lang.startsWith('hi-IN')) &&
      /natural|online|google|female|neerja|swara/i.test(v.name)
    );
    if (preferred) return preferred;

    // 2. Second priority: Any Natural / Neural female voice (Google/Microsoft)
    const naturalFemale = voices.find(v => 
      /natural|online|google/i.test(v.name) && 
      /female|zira|samantha/i.test(v.name)
    );
    if (naturalFemale) return naturalFemale;

    // 3. Fallback: Any Indian English/Hindi voice or standard female voice
    return voices.find(v => v.lang.startsWith('en-IN') || v.lang.startsWith('hi-IN')) ||
           voices.find(v => /female/i.test(v.name)) ||
           voices[0];
  }, []);

  const getBestHindiVoice = pickNaturalFemaleVoice;

  // Atomic speech gate and clean text renderer (avoids multiple draft flashing)
  const showSpeech = useCallback((rawText, customDismissMs = 1200) => {
    if (!rawText || typeof rawText !== 'string') return;

    // Strip markdown, JSON tokens, reasoning tags, and clean up
    let cleanText = rawText
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[*_#`"“”]/g, '')
      .trim();

    // Take only the first natural sentence (prevent long multi-paragraph rambling)
    const firstSentence = cleanText.split(/[.!?।\n]/).filter(Boolean)[0] || cleanText;
    const finalSpeech = firstSentence.trim().slice(0, 100); // Strict length cap

    if (!finalSpeech) return;

    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    setSpeechText(finalSpeech);
    setShowSpeechBubble(true);

    // Auto-dismiss exactly after 1.2s
    speechTimerRef.current = setTimeout(() => {
      setSpeechText('');
      setShowSpeechBubble(false);
      speechTimerRef.current = null;
    }, customDismissMs || 1200);
  }, []);

  // Clear, crisp female tuning (avoid robotic pitch artifacts)
  const speakLine = useCallback((text) => {
    if (isMuted || !text || typeof window === 'undefined') return;
    if (!window.speechSynthesis) return;

    // First gate and display the clean bubble
    showSpeech(text);

    // Cancel any hanging speech and resume if paused
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      try { window.speechSynthesis.resume(); } catch (_) {}
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickNaturalFemaleVoice();
    if (voice) utterance.voice = voice;

    // Clear, crisp female tuning (avoid robotic pitch artifacts)
    utterance.rate = 1.05; // Normal clear speed (not rushed)
    utterance.pitch = 1.0; // Natural female pitch (avoid robotic 1.2+)
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  }, [isMuted, pickNaturalFemaleVoice, showSpeech]);

  // Audio ducking helpers
  const duckVolume = useCallback(() => {
    if (!autoDuck || typeof window === 'undefined') return;
    if (window.loopraPlayer?.setVolume) {
      window.loopraPlayer.setVolume(10);
    }
  }, [autoDuck]);

  const restoreVolume = useCallback(() => {
    if (!autoDuck || typeof window === 'undefined') return;
    if (window.loopraPlayer?.setVolume) {
      window.loopraPlayer.setVolume(100);
    }
  }, [autoDuck]);

  const stopListening = useCallback(() => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
    isListeningRef.current = false;
    setIsListening(false);
    restoreVolume();
  }, [restoreVolume]);

  const startListening = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Check insecure context
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      const warningMsg = 'Microphone access requires HTTPS or localhost';
      console.warn(`[useVoiceAgent] Insecure context: ${warningMsg}`);
      window.dispatchEvent(new CustomEvent('loopra:show-toast', { detail: { message: warningMsg, duration: 4000 } }));
      setError(warningMsg);
      onError?.(warningMsg);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const err = new Error('Speech recognition not supported in this browser engine.');
      setError(err.message);
      onError?.(err.message);
      return;
    }

    stopListening();
    setError(null);
    setTranscript('');
    setInterimText('');

    try {
      // Gracefully prompt for mic permission via getUserMedia before initializing webkitSpeechRecognition
      // to ensure Brave Browser / PWA grants device-level audio access
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr) {
          console.warn('[useVoiceAgent] getUserMedia permission check notice:', permErr.message);
          if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            const isBrave = (navigator.brave && typeof navigator.brave.isBrave === 'function') || navigator.userAgent?.includes('Brave');
            const hint = isBrave ? ' (Please allow microphone access or check Brave Shields)' : '';
            const msg = `Microphone permission denied${hint}. Please allow microphone access.`;
            setError(msg);
            onError?.(msg);
            return;
          }
        }
      }

      // Duck music volume as soon as user taps mic
      duckVolume();

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      // In Chromium/Brave PWA, speech recognition terminates quickly on silence; single-shot is vastly more reliable
      const isMobileOrBrave = /Android|iPhone|iPad|iPod|Brave/i.test(navigator.userAgent) || Boolean(navigator.brave?.isBrave);
      recognition.continuous = !isMobileOrBrave;
      recognition.interimResults = true;
      recognition.lang = lang || 'hi-IN'; // Prioritize Hindi/Hinglish Indian accent
      recognition.maxAlternatives = 1;

      let interimBuffer = '';
      let finalBuffer = '';

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        // Safety timeout (15s max listening window)
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = setTimeout(() => {
          stopListening();
        }, 15000);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }

        interimBuffer = interim;
        if (final) finalBuffer += final;

        const currentText = (finalBuffer || interimBuffer).trim();
        setTranscript(currentText);
        setInterimText(interimBuffer);
        onTranscript?.({ interim: interimBuffer, final: finalBuffer, transcript: currentText });
      };

      recognition.onerror = (event) => {
        console.warn('[useVoiceAgent] Speech error:', event.error);
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        restoreVolume();
        isListeningRef.current = false;
        setIsListening(false);

        let friendlyError = `Speech error: ${event.error}`;
        if (event.error === 'not-allowed') {
          friendlyError = 'Microphone permission blocked. Please allow mic access in your browser or app settings.';
        } else if (event.error === 'no-speech') {
          friendlyError = 'No voice detected. Please speak closer to your device.';
        } else if (event.error === 'network') {
          friendlyError = 'Voice network error. Please check your internet connection.';
        }

        setError(friendlyError);
        onError?.(friendlyError);
      };

      recognition.onend = () => {
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        restoreVolume();
        isListeningRef.current = false;
        setIsListening(false);

        const resolved = (finalBuffer || interimBuffer).trim();
        if (resolved) {
          onFinal?.(resolved);
        }
      };

      recognition.start();
    } catch (err) {
      restoreVolume();
      isListeningRef.current = false;
      setIsListening(false);
      const msg = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        ? 'Microphone permission denied. Please allow microphone access.'
        : err.message || 'Could not start voice recognition.';
      setError(msg);
      onError?.(msg);
    }
  }, [duckVolume, restoreVolume, stopListening, lang, onTranscript, onFinal, onError]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  // Dynamic witty avatar greeting powered by Gemini API with fast local fallback
  const greetUser = useCallback(async () => {
    const getRandomFallback = () => {
      const idx = Math.floor(Math.random() * FALLBACK_GREETINGS.length);
      return FALLBACK_GREETINGS[idx];
    };

    let greeting = getRandomFallback();

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('/api/voice-agent/greeting', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (data?.greeting && typeof data.greeting === 'string') {
            greeting = data.greeting.trim();
          }
        }
      } catch (_) {}
    }

    speakLine(greeting);
    return greeting;
  }, [speakLine]);

  useEffect(() => {
    return () => {
      stopListening();
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
        speechTimerRef.current = null;
      }
    };
  }, [stopListening]);

  return {
    isListening,
    transcript,
    interimText,
    error,
    speechText,
    showSpeechBubble,
    speakLine,
    showSpeech,
    getBestHindiVoice,
    startListening,
    stopListening,
    toggleListening,
    greetUser
  };
}

export default useVoiceAgent;

