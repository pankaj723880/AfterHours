import React, { useState, useEffect, useRef } from 'react';

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
  disabled = false
}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [detectedCommand, setDetectedCommand] = useState(null); // 'play' | 'search' | null

  const recognitionRef = useRef(null);
  const menuRef = useRef(null);
  const timeoutRef = useRef(null);

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

  const startListening = () => {
    setErrorMessage(null);
    setInterimTranscript('');
    setFinalTranscript('');
    setDetectedCommand(null);

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition || null;

    if (!SpeechRecognition) {
      setErrorMessage('Voice recognition is not supported in this browser. Please try Google Chrome or Microsoft Edge.');
      return;
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

      recognition.onend = () => {
        setIsListening(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

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
            : isListening
            ? 'Listening... Click to stop'
            : `Search with voice (${SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.label || 'Voice'})`
        }
        aria-label={isListening ? 'Stop voice listening' : 'Start voice search'}
        className={`relative p-2 sm:p-2.5 rounded-full transition-all duration-300 flex items-center justify-center shrink-0 cursor-pointer ${
          !isSupported
            ? 'opacity-40 cursor-not-allowed text-neutral-500'
            : isListening
            ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse'
            : 'text-neutral-400 hover:text-amber-400 hover:bg-white/5 active:scale-95'
        }`}
      >
        {isListening ? (
          <>
            {/* Pulsing ring animation */}
            <span className="absolute -inset-1 rounded-full bg-red-500/30 animate-ping opacity-75" />
            <svg className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </>
        ) : (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* Language menu button when supported */}
      {isSupported && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowLanguageMenu((prev) => !prev);
          }}
          className="text-[10px] font-semibold text-neutral-400 hover:text-amber-300 px-1 py-0.5 rounded transition-colors hidden sm:inline-flex items-center gap-0.5"
          title="Change voice language"
          aria-label="Select voice language"
        >
          <span>{SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.flag}</span>
          <svg className="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Language dropdown modal / popover */}
      {showLanguageMenu && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-2 w-48 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl p-1.5 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2 py-1 text-[10px] font-bold tracking-wider uppercase text-neutral-400 border-b border-neutral-800">
            Voice Language
          </div>
          <div className="py-1">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedLang(lang.code);
                  setShowLanguageMenu(false);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors ${
                  selectedLang === lang.code
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </span>
                {selectedLang === lang.code && (
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live Voice Search Floating Overlay Dialog when active */}
      {isListening && (
        <div className="fixed inset-x-4 top-20 sm:top-24 max-w-lg mx-auto bg-neutral-950/95 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl z-[90] animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-400">
                Listening in {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.label}...
              </span>
            </div>

            <button
              type="button"
              onClick={stopListening}
              className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Real-time transcript display */}
          <div className="min-h-[50px] p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-center text-center">
            {interimTranscript || finalTranscript ? (
              <p className="text-sm sm:text-base text-white font-medium break-words">
                {finalTranscript}{' '}
                <span className="text-amber-400/80 italic">{interimTranscript}</span>
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-neutral-500 italic flex items-center gap-2">
                <span>Say something like "Play Kesariya", "Arijit Singh hits", or "Sunao Sidhu Moosewala"...</span>
              </p>
            )}
          </div>

          {/* Detected intent pill */}
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
