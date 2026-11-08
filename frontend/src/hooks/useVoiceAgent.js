import { useState, useEffect, useRef, useCallback } from 'react';

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

  // Filter strictly for high-clarity Indian female voices
  const getBestHindiVoice = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    return (
      voices.find(v => v.lang === 'hi-IN' && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Swara'))) ||
      voices.find(v => v.lang === 'hi-IN') ||
      voices.find(v => v.lang === 'en-IN' && (v.name.includes('Google') || v.name.includes('India'))) ||
      voices.find(v => v.lang.startsWith('hi'))
    );
  }, []);

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

    window.speechSynthesis.cancel(); // Stop any pending speech

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getBestHindiVoice();
    if (voice) utterance.voice = voice;

    // Clear, crisp female tuning (avoid robotic pitch artifacts)
    utterance.rate = 1.05; // Normal clear speed (not rushed)
    utterance.pitch = 1.0; // Natural female pitch (avoid robotic 1.2+)
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  }, [isMuted, getBestHindiVoice, showSpeech]);

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

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const err = new Error('Speech recognition not supported in this browser.');
      setError(err.message);
      onError?.(err.message);
      return;
    }

    stopListening();
    setError(null);
    setTranscript('');
    setInterimText('');

    try {
      // Duck music volume as soon as user taps mic
      duckVolume();

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      // Mobile Chrome drops connections if continuous is true; use false for mobile single commands
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      recognition.continuous = !isMobile;
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
    toggleListening
  };
}

export default useVoiceAgent;

