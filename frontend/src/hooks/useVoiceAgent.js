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
  autoDuck = true
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const safetyTimeoutRef = useRef(null);

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
    };
  }, [stopListening]);

  return {
    isListening,
    transcript,
    interimText,
    error,
    startListening,
    stopListening,
    toggleListening
  };
}

export default useVoiceAgent;

