import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { aiMusicCompanionClient } from '../../services/aiMusicCompanionClient';

const STORAGE_KEY_DESKTOP = 'loopra_ai_chat_dims_desktop';
const STORAGE_KEY_MOBILE = 'loopra_ai_chat_dims_mobile';

const DEFAULT_DESKTOP_WIDTH = 420; // 400-440px
const DEFAULT_DESKTOP_HEIGHT = 580; // 550-620px

const getViewportInfo = () => {
  if (typeof window === 'undefined') {
    return { width: 1200, height: 800, isMobile: false };
  }
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth);
  const vh = Math.round(vv ? vv.height : window.innerHeight);
  const isMobile = window.innerWidth <= 768;
  return { width: vw, height: vh, isMobile };
};

const getDefaultDimensions = (isMobile, vp) => {
  if (isMobile) {
    // Mobile: 85-90% width (approx 88%), 55-65% height (approx 60%)
    const targetW = Math.round(vp.width * 0.88);
    const targetH = Math.round(vp.height * 0.60);
    const maxW = Math.max(260, vp.width - 24);
    const maxH = Math.max(260, vp.height - 96);
    return {
      width: Math.min(targetW, maxW),
      height: Math.min(targetH, maxH),
    };
  }
  // Desktop/Laptop: 400-440px width (420px), 550-620px height (580px)
  const maxW = Math.max(340, vp.width - 48);
  const maxH = Math.max(380, vp.height - 110);
  return {
    width: Math.min(DEFAULT_DESKTOP_WIDTH, maxW),
    height: Math.min(DEFAULT_DESKTOP_HEIGHT, maxH),
  };
};

const loadSavedDimensions = () => {
  const vp = getViewportInfo();
  const key = vp.isMobile ? STORAGE_KEY_MOBILE : STORAGE_KEY_DESKTOP;
  const defaults = getDefaultDimensions(vp.isMobile, vp);

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.width === 'number' &&
        typeof parsed.height === 'number' &&
        parsed.width >= (vp.isMobile ? 240 : 300) &&
        parsed.height >= (vp.isMobile ? 220 : 340)
      ) {
        const rightOffset = vp.isMobile ? 16 : 24;
        const bottomOffset = vp.isMobile ? 96 : 92;
        const maxW = Math.max(260, vp.width - rightOffset - 12);
        const maxH = Math.max(240, vp.height - bottomOffset - 12);

        // Clamp to current viewport
        return {
          width: Math.min(Math.max(vp.isMobile ? 240 : 300, Math.round(parsed.width)), maxW),
          height: Math.min(Math.max(vp.isMobile ? 220 : 340, Math.round(parsed.height)), maxH)
        };
      }
    }
  } catch (e) {}

  return defaults;
};

export default function LoopraAiCompanion({
  backendUrl,
  authToken,
  user,
  currentSong,
  isPlaying,
  playbackPosition,
  duration,
  onPlayTrack,
  onTogglePlayPause,
  onToggleLike,
  isLiked,
  onAddToPlaylist,
  showToast
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dimensions, setDimensions] = useState(loadSavedDimensions);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [isResizing, setIsResizing] = useState(false);

  const resizeRef = useRef({
    isResizing: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    dir: 'bl',
    pointerId: null
  });

  // Clean up legacy drag anchor persistence so it never overrides fixed positioning
  useEffect(() => {
    try {
      localStorage.removeItem('loopra_ai_companion_anchor_v2');
      localStorage.removeItem('loopra_ai_companion_anchor');
      localStorage.removeItem('loopra_ai_companion_dims');
    } catch (e) {}
  }, []);

  // Viewport resize & device orientation handling
  useEffect(() => {
    const handleViewportChange = () => {
      const vp = getViewportInfo();
      setIsMobile(prevMobile => {
        if (prevMobile !== vp.isMobile) {
          // Device profile changed (e.g. desktop window shrank to mobile size)
          setDimensions(loadSavedDimensions());
        } else {
          // Same profile: verify dimensions stay within new viewport bounds
          setDimensions(prev => {
            const rightOffset = vp.isMobile ? 16 : 24;
            const bottomOffset = vp.isMobile ? 96 : 92;
            const maxW = Math.max(260, vp.width - rightOffset - 12);
            const maxH = Math.max(240, vp.height - bottomOffset - 12);
            const minW = vp.isMobile ? 240 : 320;
            const minH = vp.isMobile ? 220 : 380;

            if (prev.width > maxW || prev.height > maxH) {
              return {
                width: Math.min(Math.max(minW, prev.width), maxW),
                height: Math.min(Math.max(minH, prev.height), maxH)
              };
            }
            return prev;
          });
        }
        return vp.isMobile;
      });
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []);

  // Chat message history (session persistence)
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('loopra_ai_chat_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 'welcome',
        role: 'model',
        text: "Hey! I'm Loopra AI, your personal music companion. Ask me about what's playing right now, request vibes for any mood, or ask for recommendations!",
        tracks: [],
        timestamp: Date.now()
      }
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speechRecognitionRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Save chat history
  useEffect(() => {
    try {
      sessionStorage.setItem('loopra_ai_chat_history', JSON.stringify(messages.slice(-25)));
    } catch (e) {}
  }, [messages]);

  // Scroll to bottom on updates
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, streamingText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Strict Real-time Track Matching
  const isTrackPlaying = useCallback((track) => {
    if (!currentSong || !isPlaying) return false;
    const tId = track?.id || track?.videoId;
    const cId = currentSong?.id || currentSong?.videoId;
    return Boolean(tId && cId && tId === cId);
  }, [currentSong, isPlaying]);

  const isTrackLoaded = useCallback((track) => {
    if (!currentSong) return false;
    const tId = track?.id || track?.videoId;
    const cId = currentSong?.id || currentSong?.videoId;
    return Boolean(tId && cId && tId === cId);
  }, [currentSong]);

  // Play / Pause Click handler with exact track mapping
  const handleCardPlayPauseClick = useCallback((track) => {
    if (!track) return;

    if (isTrackPlaying(track)) {
      if (typeof onTogglePlayPause === 'function') {
        onTogglePlayPause();
      }
    } else if (isTrackLoaded(track)) {
      if (typeof onTogglePlayPause === 'function') {
        onTogglePlayPause();
      } else {
        onPlayTrack(track);
      }
    } else {
      // Ensure track object has exact verified video ID
      const targetTrack = {
        ...track,
        id: track.id || track.videoId,
        videoId: track.videoId || track.id
      };
      onPlayTrack(targetTrack);
      if (showToast) showToast(`Now playing: ${targetTrack.title}`);
    }
  }, [isTrackPlaying, isTrackLoaded, onTogglePlayPause, onPlayTrack, showToast]);

  // Current track context for AI
  const getCurrentTrackContext = useCallback(() => {
    if (!currentSong || (!currentSong.title && !currentSong.id)) return null;
    return {
      id: currentSong.id,
      videoId: currentSong.videoId || currentSong.id,
      title: currentSong.title,
      artist: currentSong.artist || currentSong.channel || 'Artist',
      album: currentSong.album || null,
      duration: duration || currentSong.duration || null,
      currentTime: playbackPosition || null,
      isPlaying: Boolean(isPlaying)
    };
  }, [currentSong, isPlaying, playbackPosition, duration]);

  // Send message to Loopra AI with streaming
  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputText).trim();
    if (!text || isTyping) return;

    const userMsg = {
      id: 'usr_' + Date.now(),
      role: 'user',
      text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    setStreamingText('');

    try {
      const historyContext = messages.slice(-6).map(m => ({
        role: m.role,
        text: m.text,
        tracks: m.tracks || []
      }));

      let accumulatedStream = '';

      const res = await aiMusicCompanionClient.sendChat(backendUrl, authToken, {
        message: text,
        currentTrack: getCurrentTrackContext(),
        history: historyContext,
        onChunk: (chunk) => {
          accumulatedStream += chunk;
          setStreamingText(accumulatedStream);
        }
      });

      const aiMsg = {
        id: 'ai_' + Date.now(),
        role: 'model',
        text: res.reply || accumulatedStream || "Here's what I found for you:",
        tracks: res.tracks || [],
        action: res.action || null,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMsg]);
      setStreamingText('');

      // Playback action resolution
      if (res.action?.type === 'PLAY_TRACK' && res.action?.track) {
        onPlayTrack(res.action.track);
        if (showToast) showToast(`Now playing: ${res.action.track.title}`);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'model',
          text: `⚠️ ${err.message || 'I had trouble connecting to the music network. Please try again!'}`,
          tracks: [],
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsTyping(false);
      setStreamingText('');
    }
  };

  // Text-to-Speech
  const speakMessage = (text) => {
    if (!('speechSynthesis' in window)) {
      if (showToast) showToast('Speech synthesis not supported in this browser');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanSpeech = text.replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Speech-to-Text Voice Query
  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (showToast) showToast('Speech recognition not supported in this browser');
      return;
    }

    if (isVoiceListening) {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch (e) {}
      }
      setIsVoiceListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsVoiceListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInputText(transcript);
          handleSendMessage(transcript);
        }
      };
      recognition.onerror = (e) => {
        setIsVoiceListening(false);
        if (e.error === 'not-allowed' && showToast) {
          showToast('Microphone access was denied for voice input');
        }
      };
      recognition.onend = () => setIsVoiceListening(false);

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setIsVoiceListening(false);
    }
  };

  const clearChat = () => {
    const welcome = {
      id: 'welcome_' + Date.now(),
      role: 'model',
      text: "Chat cleared! How can I help you today? Ask about what's playing, request personalized vibes, or discover fresh music.",
      tracks: [],
      timestamp: Date.now()
    };
    setMessages([welcome]);
    try { sessionStorage.removeItem('loopra_ai_chat_history'); } catch (e) {}
    if (showToast) showToast('Conversation cleared');
  };

  // -------------------------------------------------------------
  // MANUAL RESIZE HANDLERS (Bottom-left corner & edges)
  // Mouse & touch unified via pointer events with pointer capture
  // -------------------------------------------------------------

  const handleResizePointerDown = (dir, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    setIsResizing(true);
    resizeRef.current = {
      isResizing: true,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: dimensions.width,
      startHeight: dimensions.height,
      dir,
      pointerId: e.pointerId
    };
  };

  const handleResizePointerMove = (e) => {
    if (!resizeRef.current.isResizing) return;
    e.preventDefault();
    const { startX, startY, startWidth, startHeight, dir } = resizeRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const vp = getViewportInfo();
    const isMob = vp.isMobile;
    const rightOffset = isMob ? 16 : 24;
    const bottomOffset = isMob ? 96 : 92;

    const maxW = Math.max(260, vp.width - rightOffset - 12);
    const maxH = Math.max(240, vp.height - bottomOffset - 12);
    const minW = isMob ? Math.min(240, maxW) : 320;
    const minH = isMob ? Math.min(220, maxH) : 380;

    let newW = startWidth;
    let newH = startHeight;

    // Bottom-left corner or left edge: dragging left expands width, dragging right shrinks
    if (dir === 'bl' || dir === 'l') {
      newW = Math.min(maxW, Math.max(minW, Math.round(startWidth - dx)));
    }
    // Bottom-left corner or bottom edge: dragging up expands height, dragging down shrinks
    if (dir === 'bl' || dir === 'b') {
      newH = Math.min(maxH, Math.max(minH, Math.round(startHeight - dy)));
    }

    setDimensions({ width: newW, height: newH });
  };

  const handleResizePointerUp = (e) => {
    if (!resizeRef.current.isResizing) return;
    resizeRef.current.isResizing = false;
    setIsResizing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    // Persist preferred dimensions separately for desktop and mobile
    try {
      const vp = getViewportInfo();
      const key = vp.isMobile ? STORAGE_KEY_MOBILE : STORAGE_KEY_DESKTOP;
      localStorage.setItem(key, JSON.stringify(dimensions));
    } catch (err) {}
  };

  const handleButtonClick = () => {
    setIsOpen(prev => !prev);
  };

  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <>
      {/* ------------------------------------------------------------- */}
      {/* 1. EXPANDABLE CHAT PANEL                                      */}
      {/* Fixed: anchored strictly above and to left of floating button */}
      {/* ------------------------------------------------------------- */}
      {isOpen && (
        <div
          style={{
            '--chat-panel-width': `${dimensions.width}px`,
            '--chat-panel-height': `${dimensions.height}px`,
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`
          }}
          className={`ai-assistant-chat-panel flex flex-col bg-neutral-950/95 border border-amber-500/40 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 pointer-events-auto ${
            isResizing ? 'ring-2 ring-amber-500/40 select-none' : ''
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-neutral-900 via-neutral-900/95 to-neutral-950 border-b border-white/10 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                <div className="w-full h-full bg-neutral-950 rounded-full flex items-center justify-center">
                  <span className="text-amber-400 text-xs font-black">AI</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white tracking-wide truncate">Loopra AI</h3>
                  <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                    Companion
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 truncate">Connected Music Intelligence</p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={clearChat}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg text-xs transition cursor-pointer"
                title="Clear conversation"
              >
                🗑️
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg text-xs transition cursor-pointer"
                title="Close assistant panel"
              >
                ✕
              </button>
            </div>
          </div>

            {/* Current Playing Song Awareness Pill */}
            <div className="px-4 py-2 bg-neutral-900/60 border-b border-white/5 flex items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {currentSong ? (
                  <>
                    <div className="flex items-end gap-0.5 h-3.5 shrink-0">
                      <span className={`w-0.5 h-3 bg-amber-400 rounded-full ${isPlaying ? 'animate-pulse' : ''}`} />
                      <span className={`w-0.5 h-2 bg-amber-300 rounded-full ${isPlaying ? 'animate-ping' : ''}`} />
                      <span className={`w-0.5 h-3.5 bg-amber-400 rounded-full ${isPlaying ? 'animate-pulse' : ''}`} />
                    </div>
                    <button
                      onClick={() => handleSendMessage("Tell me about this current playing song")}
                      className="text-left text-neutral-300 hover:text-amber-300 transition truncate max-w-[240px] text-[11px] cursor-pointer"
                      title="Click to ask about current track"
                    >
                      <span className="font-semibold text-amber-400">Now: </span>
                      {currentSong.title}
                      {currentSong.artist ? ` • ${currentSong.artist}` : ''}
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                    <span>⏸️</span> No music currently playing in Loopra
                  </span>
                )}
              </div>

              {currentSong && (
                <button
                  onClick={() => handleSendMessage("Suggest 4 songs similar to this track")}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-medium px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded shrink-0 transition cursor-pointer"
                >
                  Similar ✨
                </button>
              )}
            </div>

            {/* Speaking banner */}
            {isSpeaking && (
              <div className="px-3 py-1.5 bg-amber-500/20 border-b border-amber-500/30 flex items-center justify-between text-xs text-amber-300 shrink-0">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <span className="animate-spin text-xs">🔊</span> Speaking response...
                </span>
                <button
                  onClick={stopSpeaking}
                  className="text-[10px] font-bold text-amber-200 hover:text-white px-2 py-0.5 bg-neutral-900 rounded border border-amber-500/40 cursor-pointer"
                >
                  Stop
                </button>
              </div>
            )}

            {/* CHAT MESSAGES STREAM */}
            <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-4 text-xs scroll-smooth select-text">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-medium rounded-br-none'
                          : 'bg-neutral-900/90 text-neutral-200 border border-white/10 rounded-bl-none'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.text}</div>

                      {msg.role === 'model' && (
                        <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-400">
                          <button
                            onClick={() => speakMessage(msg.text)}
                            className="hover:text-amber-400 flex items-center gap-1 transition cursor-pointer"
                            title="Read aloud"
                          >
                            <span>🔊</span> Listen
                          </button>
                          <span>Loopra AI</span>
                        </div>
                      )}
                    </div>

                    {/* PLAYABLE RECOMMENDATION CARDS */}
                    {msg.tracks && msg.tracks.length > 0 && (
                      <div className="w-full mt-2 space-y-2">
                        {msg.tracks.map((track, idx) => {
                          const isFav = isLiked ? isLiked(track) : false;
                          const activePlaying = isTrackPlaying(track);
                          const activeLoaded = isTrackLoaded(track);

                          return (
                            <div
                              key={track.id || track.videoId || idx}
                              className={`flex items-center gap-3 p-2.5 rounded-xl transition group ${
                                activePlaying
                                  ? 'bg-amber-500/15 border border-amber-500/50 shadow-md shadow-amber-500/10'
                                  : 'bg-neutral-900/70 hover:bg-neutral-800/80 border border-white/10 hover:border-amber-500/30'
                              }`}
                            >
                              {/* Track Thumbnail with Play/Pause Overlay */}
                              <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-neutral-800">
                                <img
                                  src={track.thumbnail || `https://i.ytimg.com/vi/${track.id || track.videoId}/hqdefault.jpg`}
                                  alt={track.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                  onError={(e) => {
                                    e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80';
                                  }}
                                />
                                <button
                                  onClick={() => handleCardPlayPauseClick(track)}
                                  className={`absolute inset-0 flex items-center justify-center transition text-amber-400 text-sm ${
                                    activePlaying ? 'bg-black/40 opacity-100' : 'bg-black/40 opacity-0 group-hover:opacity-100'
                                  }`}
                                  title={activePlaying ? 'Pause' : 'Play'}
                                >
                                  {activePlaying ? '⏸' : '▶'}
                                </button>
                              </div>

                              {/* Title & Artist */}
                              <div className="flex-1 min-w-0">
                                <h5 className={`font-semibold truncate text-xs transition ${activePlaying ? 'text-amber-400' : 'text-white group-hover:text-amber-300'}`}>
                                  {track.title}
                                </h5>
                                <p className="text-[11px] text-neutral-400 truncate">
                                  {track.artist || track.channel || 'Artist'}
                                </p>
                                {track.reason && (
                                  <p className="text-[10px] text-amber-400/90 truncate italic">
                                    {track.reason}
                                  </p>
                                )}
                              </div>

                              {/* Action Buttons: Like & Play/Pause */}
                              <div className="flex items-center gap-1 shrink-0">
                                {onToggleLike && (
                                  <button
                                    onClick={() => onToggleLike(track)}
                                    className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                                      isFav ? 'text-red-500' : 'text-neutral-500 hover:text-white'
                                    }`}
                                    title={isFav ? 'Remove like' : 'Like'}
                                  >
                                    {isFav ? '❤️' : '🤍'}
                                  </button>
                                )}

                                <button
                                  onClick={() => handleCardPlayPauseClick(track)}
                                  className={`px-2.5 py-1.5 font-bold text-[11px] rounded-lg shadow-sm active:scale-95 transition flex items-center gap-1 cursor-pointer ${
                                    activePlaying
                                      ? 'bg-neutral-800 text-amber-400 border border-amber-500/40 hover:bg-neutral-700'
                                      : 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                                  }`}
                                  title={activePlaying ? 'Pause playback' : 'Play song in Loopra'}
                                >
                                  {activePlaying ? (
                                    <>
                                      <span>⏸️</span> Pause
                                    </>
                                  ) : activeLoaded ? (
                                    <>
                                      <span>▶</span> Resume
                                    </>
                                  ) : (
                                    <>
                                      <span>▶</span> Play
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming text or typing indicator */}
                {isTyping && (
                  <div className="flex flex-col items-start space-y-1">
                    {streamingText ? (
                      <div className="max-w-[88%] rounded-2xl px-3.5 py-2.5 bg-neutral-900/90 text-neutral-200 border border-white/10 rounded-bl-none text-xs leading-relaxed animate-in fade-in">
                        {streamingText}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 p-3 bg-neutral-900/60 border border-white/5 rounded-2xl w-fit">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    )}
                  </div>
                )}
              </div>

            {/* Quick Suggestion Chips */}
            <div className="px-3 py-2 bg-neutral-900/40 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-[11px]">
              {currentSong && (
                <button
                  onClick={() => handleSendMessage("Who is singing this song?")}
                  className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full whitespace-nowrap border border-white/5 transition cursor-pointer"
                >
                  🎙️ Who is singing?
                </button>
              )}
              <button
                onClick={() => handleSendMessage("Recommend songs for a rainy evening mood")}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full whitespace-nowrap border border-white/5 transition cursor-pointer"
              >
                🌧️ Rainy Evening
              </button>
              <button
                onClick={() => handleSendMessage("Suggest 5 underrated 90s bollywood gems")}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full whitespace-nowrap border border-white/5 transition cursor-pointer"
              >
                📻 90s Gems
              </button>
              <button
                onClick={() => handleSendMessage("Suggest an upbeat party playlist")}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full whitespace-nowrap border border-white/5 transition cursor-pointer"
              >
                🔥 Party Vibes
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-neutral-900/90 border-t border-white/10 flex items-center gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  isVoiceListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-800'
                }`}
                title={isVoiceListening ? 'Listening... click to stop' : 'Voice input (Speech to text)'}
              >
                🎤
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={currentSong ? "Ask about current song or request vibes..." : "Ask Loopra AI anything about music..."}
                className="flex-1 bg-neutral-950/80 border border-white/10 focus:border-amber-500/50 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 outline-none transition"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md active:scale-95 cursor-pointer"
                title="Send message"
              >
                <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </form>

            {/* --------------------------------------------------------- */}
            {/* MANUAL RESIZE HANDLERS                                    */}
            {/* Touch & pointer friendly bottom-left corner & edge grips  */}
            {/* --------------------------------------------------------- */}

            {/* 1. Primary Bottom-Left Corner Handle */}
            <div
              onPointerDown={(e) => handleResizePointerDown('bl', e)}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              className="absolute bottom-0 left-0 w-11 h-11 sm:w-9 sm:h-9 z-50 flex items-end justify-start p-1.5 cursor-sw-resize select-none touch-none group/resize"
              title="Drag to resize chat window"
              aria-label="Resize assistant chat window"
            >
              <div className="w-4 h-4 rounded-bl-md border-b-2 border-l-2 border-amber-500/70 group-hover/resize:border-amber-400 group-active/resize:border-amber-300 transition-colors flex items-end justify-start p-0.5 shadow-sm">
                <div className="w-1.5 h-1.5 border-b border-l border-amber-400/90" />
              </div>
            </div>

            {/* 2. Bottom Edge Handle */}
            <div
              onPointerDown={(e) => handleResizePointerDown('b', e)}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              className="absolute bottom-0 left-12 right-12 h-2.5 z-40 cursor-s-resize select-none touch-none flex items-center justify-center group/bottom"
              title="Drag bottom edge to adjust height"
            >
              <div className="w-8 h-1 rounded-full bg-white/10 group-hover/bottom:bg-amber-400/50 group-active/bottom:bg-amber-400 transition-colors" />
            </div>

            {/* 3. Left Edge Handle */}
            <div
              onPointerDown={(e) => handleResizePointerDown('l', e)}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              className="absolute top-14 bottom-12 left-0 w-2.5 z-40 cursor-w-resize select-none touch-none group/left flex items-center justify-start"
              title="Drag left edge to adjust width"
            >
              <div className="w-1 h-8 rounded-full bg-white/10 group-hover/left:bg-amber-400/50 group-active/left:bg-amber-400 ml-0.5 transition-colors" />
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* 2. FLOATING ASSISTANT BUTTON                                  */}
        {/* Strictly fixed at bottom-right of viewport via CSS class      */}
        {/* ------------------------------------------------------------- */}
        <button
          type="button"
          onClick={handleButtonClick}
          className={`ai-assistant-floating-button group relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl active:scale-95 cursor-pointer pointer-events-auto transition-colors duration-150 ${
            isOpen
              ? 'bg-amber-500 text-black shadow-amber-500/40'
              : 'bg-neutral-900/95 text-amber-400 hover:text-white border border-amber-500/40 hover:border-amber-400 shadow-amber-500/20 backdrop-blur-2xl'
          }`}
          aria-label="Toggle Loopra AI Music Companion"
          title="Loopra AI Assistant"
        >
          {isOpen ? (
            <svg className="w-6 h-6 pointer-events-none transition-transform duration-200 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <div className="relative flex items-center justify-center pointer-events-none">
              <span className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-amber-500/40 via-orange-500/30 to-amber-500/40 blur-sm animate-pulse" />
              <div className="relative flex items-end gap-1 h-5 px-1">
                <span className={`w-1 bg-amber-400 rounded-full transition-all duration-300 ${isPlaying ? 'h-5 animate-pulse' : 'h-3'}`} />
                <span className={`w-1 bg-amber-300 rounded-full transition-all duration-300 ${isPlaying ? 'h-3 animate-ping' : 'h-4'}`} />
                <span className={`w-1 bg-amber-400 rounded-full transition-all duration-300 ${isPlaying ? 'h-4 animate-pulse' : 'h-2'}`} />
              </div>
            </div>
          )}

          {!isOpen && (
            <span className="absolute right-16 top-1/2 -translate-y-1/2 hidden md:group-hover:inline-block px-3 py-1.5 bg-neutral-900/95 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none backdrop-blur-md">
              Loopra AI • Music Companion
            </span>
          )}
        </button>
      </>,
      document.body
    );
}
