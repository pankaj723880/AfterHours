import React, { useState, useEffect, useRef } from 'react';
import { voiceControlService } from '../../services/voiceControlService';
import { voiceSessionService } from '../../services/voiceSessionService';

// Supported recognition languages
const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', label: 'English (India)', flag: '🇮🇳' },
  { code: 'hi-IN', label: 'हिंदी (Hindi)', flag: '🇮🇳' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳' }
];

export default function VoiceSearchButton({
  onSearch,
  onPlaySong,
  onTranscriptChange,
  className = '',
  disabled = false,
  allowed = null, // Can be explicitly passed or resolved via service
  user = null,
  token = null,
  backendUrl = '',
  onAccessRevoked = null
}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [detectedCommand, setDetectedCommand] = useState(null); // 'play' | 'search' | null

  // Centralized feature access state
  const [hasAccess, setHasAccess] = useState(() => {
    if (typeof allowed === 'boolean') return allowed;
    const initial = voiceControlService.getAccessState();
    if (user) {
      return voiceControlService.evaluateLocalAccess(initial, user);
    }
    return Boolean(initial.allowed);
  });

  const recognitionRef = useRef(null);
  const menuRef = useRef(null);
  const timeoutRef = useRef(null);
  const isListeningRef = useRef(false);
  isListeningRef.current = isListening;

  // Subscribe to central voice control feature service
  useEffect(() => {
    // If explicitly controlled via prop, respect prop
    if (typeof allowed === 'boolean') {
      setHasAccess(allowed);
      if (!allowed && isListeningRef.current) {
        abortListening('Voice control access was revoked by administrator.');
      }
      return;
    }

    const unsubscribe = voiceControlService.subscribe((state) => {
      const allowedNow = user
        ? voiceControlService.evaluateLocalAccess(state, user)
        : Boolean(state.allowed);

      setHasAccess(allowedNow);
      if (!allowedNow && isListeningRef.current) {
        abortListening('Voice control access was revoked by administrator.');
        onAccessRevoked?.();
      }
    });

    // Initial check on mount
    voiceControlService.checkAccess({ token, user, backendUrl }).then((state) => {
      const allowedNow = user
        ? voiceControlService.evaluateLocalAccess(state, user)
        : Boolean(state.allowed);
      setHasAccess(allowedNow);
    });

    return () => unsubscribe();
  }, [allowed, user, token, backendUrl, onAccessRevoked]);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition || null;

    if (SpeechRecognition) {
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, []);

  // Close language popup when clicked outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowLanguageMenu(false);
      }
    }
    if (showLanguageMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLanguageMenu]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const abortListening = (reason = null) => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (reason) {
      setErrorMessage(reason);
    }
  };

  const parseVoiceCommand = (text) => {
    if (!text) return { command: 'search', query: '' };
    const lower = text.toLowerCase().trim();

    // Check for "play" intent in English or Hindi / Hinglish
    const playPrefixes = [
      'play song ',
      'play track ',
      'play ',
      'bajao ',
      'chalao ',
      'sunao ',
      'gana bajao ',
      'gaana bajao '
    ];
    for (const prefix of playPrefixes) {
      if (lower.startsWith(prefix)) {
        const query = text.slice(prefix.length).trim();
        return { command: 'play', query };
      }
    }

    // Check for "search" prefix
    const searchPrefixes = [
      'search for ',
      'search ',
      'look up ',
      'find ',
      'dhundo ',
      'khojo '
    ];
    for (const prefix of searchPrefixes) {
      if (lower.startsWith(prefix)) {
        const query = text.slice(prefix.length).trim();
        return { command: 'search', query };
      }
    }

    return { command: 'search', query: text.trim() };
  };

  const startListening = async () => {
    setErrorMessage(null);
    setInterimTranscript('');
    setFinalTranscript('');
    setDetectedCommand(null);

    // Live permission check before starting voice recognition
    try {
      const liveState = await voiceControlService.checkAccess({ token, user, backendUrl });
      const canProceed = user
        ? voiceControlService.evaluateLocalAccess(liveState, user)
        : Boolean(liveState.allowed);

      if (!canProceed) {
        setHasAccess(false);
        setErrorMessage('Voice control is currently not available for your account.');
        return;
      }
    } catch {
      // If network fails, rely on cached permission
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition || null;

    if (!SpeechRecognition) {
      setErrorMessage('Voice recognition is not supported in this browser. Please try Google Chrome or Microsoft Edge.');
      return;
    }

    // Pause global continuous session to prevent hardware lockup
    if (voiceSessionService.isSessionActive) {
      voiceSessionService.stopSession('search_active');
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = selectedLang;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        // Safety timeout in case speech ends with no audio event
        timeoutRef.current = setTimeout(() => {
          stopListening();
        }, 12000);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcriptText = item[0]?.transcript || '';
          if (item.isFinal) {
            final += transcriptText;
          } else {
            interim += transcriptText;
          }
        }

        const activeText = final || interim;
        setInterimTranscript(interim);
        if (final) setFinalTranscript(final);

        if (onTranscriptChange && activeText) {
          onTranscriptChange(activeText);
        }

        const parsed = parseVoiceCommand(activeText);
        if (parsed.command === 'play') {
          setDetectedCommand('play');
        } else {
          setDetectedCommand('search');
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access blocked. Please allow microphone permissions in your browser settings.');
        } else if (event.error === 'no-speech') {
          setErrorMessage('No voice detected. Please try speaking closer to your microphone.');
        } else if (event.error === 'network') {
          setErrorMessage('Speech service network error. Check your internet connection.');
        } else {
          setErrorMessage(`Speech error: ${event.error}`);
        }
        setIsListening(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };

      recognition.onend = async () => {
        setIsListening(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Recheck permissions before executing any parsed voice command
        const currentState = voiceControlService.getAccessState();
        const canExecute = user
          ? voiceControlService.evaluateLocalAccess(currentState, user)
          : Boolean(currentState.allowed);

        if (!canExecute) {
          setHasAccess(false);
          setErrorMessage('Voice control access was revoked before command execution.');
          return;
        }

        // Process final speech
        const speechToProcess = finalTranscript || interimTranscript;
        if (speechToProcess && speechToProcess.trim()) {
          const { command, query } = parseVoiceCommand(speechToProcess);
          const finalQuery = query || speechToProcess;
          if (command === 'play' && onPlaySong) {
            onPlaySong(finalQuery);
          } else if (onSearch) {
            onSearch(finalQuery);
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setErrorMessage('Could not initialize speech recognition.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const toggleListening = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // If user does not have access to Voice Control, hide the button completely!
  if (!hasAccess) {
    return null;
  }

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Mic trigger button */}
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled || !isSupported}
        title={
          !isSupported
            ? 'Voice search is not supported in this browser'
            : `Search with voice (${SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.label || 'Voice'})`
        }
        aria-label={isListening ? 'Stop voice listening' : 'Start voice search'}
        className={`p-2 sm:p-2.5 rounded-full transition-all duration-300 flex items-center justify-center shrink-0 cursor-pointer ${
          isListening
            ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.7)] animate-pulse scale-105'
            : 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-800/80 active:scale-95'
        } ${disabled || !isSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {isListening ? (
          <span className="relative flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <svg className="relative w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </span>
        ) : (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* Language badge trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowLanguageMenu((prev) => !prev);
        }}
        className="ml-0.5 text-[10px] font-bold text-neutral-400 hover:text-amber-400 px-1 py-0.5 rounded bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition cursor-pointer"
        title="Change voice language"
        aria-label="Select voice language"
      >
        {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.flag || '🌐'}
      </button>

      {/* Language Selector Dropdown */}
      {showLanguageMenu && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-2 w-48 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl p-1.5 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2 py-1 text-[10px] uppercase font-bold text-neutral-400 tracking-wider border-b border-neutral-800 mb-1">
            Voice Language
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                setSelectedLang(lang.code);
                setShowLanguageMenu(false);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                selectedLang === lang.code
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                  : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </span>
              {selectedLang === lang.code && <span className="text-amber-400">✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Live Voice Search Floating Overlay Dialog when active */}
      {isListening && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-80 sm:w-96 bg-neutral-950/95 border border-amber-500/40 rounded-2xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.2)] z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Listening... ({SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.label})
              </span>
            </div>
            <button
              type="button"
              onClick={stopListening}
              className="text-neutral-400 hover:text-white text-xs px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 transition"
            >
              Cancel
            </button>
          </div>

          <div className="py-4 text-center">
            {finalTranscript || interimTranscript ? (
              <p className="text-sm font-semibold text-amber-200 break-words leading-relaxed">
                "{finalTranscript || interimTranscript}"
              </p>
            ) : (
              <p className="text-xs text-neutral-400 italic">
                Speak now... e.g. "Play Kesariya", "Arijit Singh hits", "gana bajao"
              </p>
            )}
          </div>

          {detectedCommand && (
            <div className="mt-2.5 flex items-center justify-between text-xs text-neutral-400">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium">
                Action: {detectedCommand === 'play' ? '▶ Play Immediately' : '🔍 Search Catalogue'}
              </span>
              <span className="text-[11px] text-neutral-500">Tap Cancel or stop speaking to submit</span>
            </div>
          )}
        </div>
      )}

      {/* Error notification banner */}
      {errorMessage && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-red-950/90 border border-red-500/40 rounded-xl p-3 shadow-2xl z-50 text-xs text-red-200 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-neutral-400 hover:text-white shrink-0 p-0.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
