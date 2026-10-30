import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { aiMusicCompanionClient } from '../../services/aiMusicCompanionClient';

const MIN_PANEL_WIDTH = 340;
const MIN_PANEL_HEIGHT = 420;
const DEFAULT_PANEL_WIDTH = 410;
const DEFAULT_PANEL_HEIGHT = 580;

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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

  // Single shared position anchor for BOTH the button and the chat window
  const [anchor, setAnchor] = useState(() => {
    try {
      const saved = localStorage.getItem('loopra_ai_companion_anchor');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(16, window.innerWidth - 80),
        y: Math.max(60, window.innerHeight - 130)
      };
    }
    return { x: 300, y: 500 };
  });

  // Chat panel dimensions
  const [panelDims, setPanelDims] = useState(() => {
    try {
      const saved = localStorage.getItem('loopra_ai_companion_dims');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.width && parsed.height) return parsed;
      }
    } catch (e) {}
    return { width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT };
  });

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
        text: "Hey! I'm Loopra AI, your personal music companion. Ask me about what's playing right now, request vibes for any mood, or use Identify Song to name music playing on your device or around you!",
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

  // Audio Recognition State (Device Audio Output + Mic Fallback)
  const [showRecognition, setShowRecognition] = useState(false);
  const [recognitionMode, setRecognitionMode] = useState('device'); // 'device' | 'mic'
  const [recognitionState, setRecognitionState] = useState('idle'); // 'idle' | 'recording' | 'analyzing' | 'result' | 'error' | 'unconfigured'
  const [countdown, setCountdown] = useState(6);
  const [identifiedResult, setIdentifiedResult] = useState(null);
  const [recognitionError, setRecognitionError] = useState(null);

  // Dragging & Interaction Refs
  const isDraggingUnitRef = useRef(false);
  const unitDragStartRef = useRef({ x: 0, y: 0, startAnchorX: 0, startAnchorY: 0, hasMoved: false });
  const resizeDirectionRef = useRef(null);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, anchorX: 0, anchorY: 0 });

  const activeCaptureStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionTimerRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Responsive screen clamping
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);

      setAnchor(prev => {
        const maxX = window.innerWidth - (isOpen && !mobile ? panelDims.width + 16 : 76);
        const maxY = window.innerHeight - (isOpen && !mobile ? panelDims.height + 16 : 80);
        return {
          x: Math.min(Math.max(12, prev.x), Math.max(12, maxX)),
          y: Math.min(Math.max(40, prev.y), Math.max(40, maxY))
        };
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isOpen, panelDims]);

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
  }, [messages, isTyping, streamingText, showRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioCapture();
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

  // -------------------------------------------------------------
  // AUDIO RECOGNITION: DEVICE / TAB OUTPUT + MIC FALLBACK
  // -------------------------------------------------------------

  const startAudioRecognition = async (useMic = false) => {
    stopAudioCapture();
    setRecognitionState('recording');
    setCountdown(6);
    setRecognitionError(null);
    setIdentifiedResult(null);
    audioChunksRef.current = [];

    let stream = null;

    try {
      if (!useMic && navigator.mediaDevices?.getDisplayMedia) {
        setRecognitionMode('device');
        // Capture browser tab or system audio
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 2
          }
        });

        // Check if user shared audio
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          stream.getTracks().forEach(t => t.stop());
          setRecognitionState('error');
          setRecognitionError("No audio track was shared. Please check 'Share audio' in the browser dialog, or click 'Switch to Mic' below.");
          return;
        }

        // Stop video track immediately since we only analyze audio
        stream.getVideoTracks().forEach(t => t.stop());
      } else {
        setRecognitionMode('mic');
        if (!navigator.mediaDevices?.getUserMedia) {
          setRecognitionState('error');
          setRecognitionError('Microphone capture is not supported in this browser.');
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 44100
          }
        });
      }

      activeCaptureStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (activeCaptureStreamRef.current) {
          activeCaptureStreamRef.current.getTracks().forEach(t => t.stop());
          activeCaptureStreamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        await processCapturedAudio(audioBlob, mimeType);
      };

      recorder.start(500);

      let timeLeft = 6;
      recognitionTimerRef.current = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);
        if (timeLeft <= 0) {
          clearInterval(recognitionTimerRef.current);
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }
      }, 1000);

    } catch (err) {
      setRecognitionState('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setRecognitionError('Permission was cancelled or denied. Please select an audio source and allow access to identify music.');
      } else {
        setRecognitionError('Capture failed: ' + err.message);
      }
    }
  };

  const stopAudioCapture = () => {
    if (recognitionTimerRef.current) {
      clearInterval(recognitionTimerRef.current);
      recognitionTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (activeCaptureStreamRef.current) {
      activeCaptureStreamRef.current.getTracks().forEach(t => t.stop());
      activeCaptureStreamRef.current = null;
    }
  };

  const processCapturedAudio = async (audioBlob, mimeType) => {
    setRecognitionState('analyzing');
    try {
      const res = await aiMusicCompanionClient.identifySong(backendUrl, authToken, {
        audioBlob,
        mimeType: mimeType || 'audio/webm',
        durationSeconds: 6
      });

      if (!res.configured && res.configured === false) {
        setRecognitionState('unconfigured');
        setRecognitionError(res.message);
        return;
      }

      if (!res.success || !res.match) {
        setRecognitionState('error');
        setRecognitionError(res.message || 'No matching track identified. Try capturing again during a clearer section of the song.');
        return;
      }

      setIdentifiedResult(res.match);
      setRecognitionState('result');
    } catch (err) {
      setRecognitionState('error');
      setRecognitionError(err.message || 'Recognition service failed. Please try again.');
    }
  };

  const clearChat = () => {
    const welcome = {
      id: 'welcome_' + Date.now(),
      role: 'model',
      text: "Chat cleared! How can I help you today? Ask about the current track, explore a vibe, or identify ambient/device songs.",
      tracks: [],
      timestamp: Date.now()
    };
    setMessages([welcome]);
    try { sessionStorage.removeItem('loopra_ai_chat_history'); } catch (e) {}
    if (showToast) showToast('Conversation cleared');
  };

  // -------------------------------------------------------------
  // ONE SHARED UNIT DRAG HANDLERS (Moves button AND panel together)
  // -------------------------------------------------------------

  const handleUnitPointerDown = (e) => {
    // Exclude clicks on inputs, buttons, or resize handles
    if (e.target.closest('button, input, select, textarea, [data-no-drag]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingUnitRef.current = true;
    unitDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startAnchorX: anchor.x,
      startAnchorY: anchor.y,
      hasMoved: false
    };
  };

  const handleUnitPointerMove = (e) => {
    if (!isDraggingUnitRef.current) return;
    const dx = e.clientX - unitDragStartRef.current.x;
    const dy = e.clientY - unitDragStartRef.current.y;

    if (Math.hypot(dx, dy) > 5) {
      unitDragStartRef.current.hasMoved = true;
      const maxX = window.innerWidth - (isOpen && !isMobile ? panelDims.width + 16 : 76);
      const maxY = window.innerHeight - (isOpen && !isMobile ? panelDims.height + 16 : 80);

      const newX = Math.min(Math.max(12, unitDragStartRef.current.startAnchorX + dx), Math.max(12, maxX));
      const newY = Math.min(Math.max(40, unitDragStartRef.current.startAnchorY + dy), Math.max(40, maxY));
      setAnchor({ x: newX, y: newY });
    }
  };

  const handleUnitPointerUp = (e) => {
    if (!isDraggingUnitRef.current) return;
    isDraggingUnitRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (unitDragStartRef.current.hasMoved) {
      try {
        localStorage.setItem('loopra_ai_companion_anchor', JSON.stringify(anchor));
      } catch (err) {}
    }
  };

  // Handle Button Click (Toggles Open/Close if not dragged)
  const handleButtonClick = (e) => {
    if (unitDragStartRef.current.hasMoved) return;
    setIsOpen(prev => !prev);
  };

  // -------------------------------------------------------------
  // RESIZE HANDLERS (Keeps button attached at corner)
  // -------------------------------------------------------------

  const handleResizePointerDown = (dir, e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeDirectionRef.current = dir;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: panelDims.width,
      height: panelDims.height,
      anchorX: anchor.x,
      anchorY: anchor.y
    };
  };

  const handleResizePointerMove = (e) => {
    const dir = resizeDirectionRef.current;
    if (!dir) return;

    const dx = e.clientX - resizeStartRef.current.x;
    const dy = e.clientY - resizeStartRef.current.y;

    const maxW = Math.min(850, window.innerWidth - 32);
    const maxH = Math.min(900, window.innerHeight - 40);

    let newW = resizeStartRef.current.width;
    let newH = resizeStartRef.current.height;
    let newAnchorX = resizeStartRef.current.anchorX;
    let newAnchorY = resizeStartRef.current.anchorY;

    if (dir.includes('e')) {
      newW = Math.max(MIN_PANEL_WIDTH, Math.min(resizeStartRef.current.width + dx, maxW));
    }
    if (dir.includes('s')) {
      newH = Math.max(MIN_PANEL_HEIGHT, Math.min(resizeStartRef.current.height + dy, maxH));
    }
    if (dir.includes('w')) {
      const candidateW = Math.max(MIN_PANEL_WIDTH, Math.min(resizeStartRef.current.width - dx, maxW));
      newAnchorX = resizeStartRef.current.anchorX + (resizeStartRef.current.width - candidateW);
      newW = candidateW;
    }
    if (dir.includes('n')) {
      const candidateH = Math.max(MIN_PANEL_HEIGHT, Math.min(resizeStartRef.current.height - dy, maxH));
      newAnchorY = resizeStartRef.current.anchorY + (resizeStartRef.current.height - candidateH);
      newH = candidateH;
    }

    setPanelDims({ width: newW, height: newH });
    setAnchor({
      x: Math.min(Math.max(12, newAnchorX), window.innerWidth - newW - 12),
      y: Math.min(Math.max(40, newAnchorY), window.innerHeight - newH - 16)
    });
  };

  const handleResizePointerUp = (e) => {
    if (!resizeDirectionRef.current) return;
    resizeDirectionRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    try {
      localStorage.setItem('loopra_ai_companion_dims', JSON.stringify(panelDims));
      localStorage.setItem('loopra_ai_companion_anchor', JSON.stringify(anchor));
    } catch (err) {}
  };

  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <div
      style={
        isMobile && isOpen
          ? {
              position: 'fixed',
              left: '8px',
              right: '8px',
              bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
              zIndex: 9990,
              touchAction: 'none'
            }
          : {
              position: 'fixed',
              left: `${anchor.x}px`,
              top: `${anchor.y}px`,
              zIndex: 9990,
              touchAction: 'none'
            }
      }
      className="select-none pointer-events-auto"
    >
      {/* ------------------------------------------------------------- */}
      {/* ONE CONNECTED FLOATING ASSISTANT UNIT (Panel + Button)        */}
      {/* ------------------------------------------------------------- */}
      <div className="relative flex flex-col items-end">

        {/* EXPANDABLE CHAT PANEL (Directly attached to anchor) */}
        {isOpen && (
          <div
            style={
              isMobile
                ? {
                    width: '100%',
                    height: '560px',
                    maxHeight: 'calc(100dvh - 130px)'
                  }
                : {
                    width: `${panelDims.width}px`,
                    height: `${panelDims.height}px`
                  }
            }
            className="flex flex-col bg-neutral-950/95 border border-amber-500/40 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden mb-2 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header (Acts as drag handle for the entire unit) */}
            <div
              onPointerDown={handleUnitPointerDown}
              onPointerMove={handleUnitPointerMove}
              onPointerUp={handleUnitPointerUp}
              className="px-4 py-3 bg-gradient-to-r from-neutral-900 via-neutral-900/95 to-neutral-950 border-b border-white/10 flex items-center justify-between shrink-0 cursor-move active:cursor-grabbing select-none"
              title="Drag to reposition complete assistant unit"
            >
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
              <div className="flex items-center gap-1 shrink-0" data-no-drag="true">
                <button
                  onClick={() => {
                    setShowRecognition(prev => !prev);
                    if (!showRecognition) setRecognitionState('idle');
                  }}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    showRecognition
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Identify Device or Tab Music"
                >
                  🎧
                </button>

                <button
                  onClick={clearChat}
                  className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg text-xs transition cursor-pointer"
                  title="Clear conversation"
                >
                  🗑️
                </button>

                <button
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

            {/* AUDIO RECOGNITION VIEW (Device Audio Output + Mic Fallback) */}
            {showRecognition ? (
              <div className="flex-1 p-5 flex flex-col items-center justify-center text-center overflow-y-auto bg-neutral-950/80">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 flex items-center justify-center mb-3 shadow-xl shadow-amber-500/20">
                  <div className="w-full h-full bg-neutral-900 rounded-full flex items-center justify-center text-2xl">
                    {recognitionMode === 'device' ? '🎧' : '🎙️'}
                  </div>
                </div>

                <h4 className="text-base font-bold text-white mb-1">
                  {recognitionMode === 'device' ? 'Identify Device Audio Output' : 'Identify Environment Sound'}
                </h4>
                <p className="text-xs text-neutral-400 max-w-xs mb-4">
                  {recognitionMode === 'device'
                    ? 'Captures audio playing in a browser tab, YouTube, Spotify, or headphones.'
                    : 'Listens via microphone to music playing on physical speakers in the room.'}
                </p>

                {/* If already playing inside Loopra */}
                {currentSong && (
                  <div className="w-full max-w-xs bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 mb-4 text-left flex items-center justify-between gap-2">
                    <div className="min-w-0 text-[11px]">
                      <span className="text-amber-400 font-bold block truncate">Playing inside Loopra:</span>
                      <span className="text-neutral-200 truncate block">{currentSong.title}</span>
                    </div>
                    <button
                      onClick={() => {
                        setShowRecognition(false);
                        handleSendMessage("Tell me about this current playing song");
                      }}
                      className="px-2.5 py-1 bg-amber-500 text-neutral-950 font-bold rounded text-[10px] shrink-0"
                    >
                      View Info
                    </button>
                  </div>
                )}

                {/* Mode Selector */}
                <div className="flex items-center gap-2 mb-5 bg-neutral-900 p-1 rounded-xl border border-white/10 text-xs">
                  <button
                    onClick={() => {
                      setRecognitionMode('device');
                      setRecognitionState('idle');
                    }}
                    className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                      recognitionMode === 'device'
                        ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    🎧 Tab / System Audio
                  </button>
                  <button
                    onClick={() => {
                      setRecognitionMode('mic');
                      setRecognitionState('idle');
                    }}
                    className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                      recognitionMode === 'mic'
                        ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    🎙️ Microphone
                  </button>
                </div>

                {recognitionState === 'idle' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => startAudioRecognition(recognitionMode === 'mic')}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs rounded-full shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer"
                    >
                      {recognitionMode === 'device' ? 'Select Tab/Screen & Capture' : 'Listen via Mic (6s)'}
                    </button>
                    {recognitionMode === 'device' && (
                      <p className="text-[10px] text-neutral-500 italic max-w-xs">
                        Tip: In the browser pop-up, choose a Tab and make sure <strong>"Share audio"</strong> is checked!
                      </p>
                    )}
                  </div>
                )}

                {recognitionState === 'recording' && (
                  <div className="space-y-4">
                    <div className="relative flex items-center justify-center w-20 h-20 mx-auto">
                      <span className="absolute inset-0 rounded-full bg-amber-500/30 animate-ping" />
                      <span className="absolute inset-2 rounded-full bg-amber-500/20 animate-pulse" />
                      <span className="relative text-2xl font-black text-amber-400">{countdown}s</span>
                    </div>
                    <p className="text-xs text-amber-300 font-medium animate-pulse">
                      {recognitionMode === 'device' ? 'Capturing audio output stream...' : 'Listening to room audio...'}
                    </p>
                    <button
                      onClick={stopAudioCapture}
                      className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-full border border-white/10 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {recognitionState === 'analyzing' && (
                  <div className="space-y-3">
                    <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-neutral-300 font-medium">
                      Fingerprinting audio and matching music catalogue...
                    </p>
                  </div>
                )}

                {recognitionState === 'result' && identifiedResult && (
                  <div className="w-full max-w-sm bg-neutral-900/90 border border-amber-500/40 rounded-xl p-4 text-left shadow-xl space-y-3 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">
                        Match {identifiedResult.confidence}%
                      </span>
                      <span className="text-[10px] text-neutral-400">Song Identified</span>
                    </div>

                    <div>
                      <h5 className="text-sm font-bold text-white line-clamp-1">{identifiedResult.title}</h5>
                      <p className="text-xs text-amber-400/90 line-clamp-1">{identifiedResult.artist}</p>
                      {identifiedResult.album && (
                        <p className="text-[10px] text-neutral-400 line-clamp-1">Album: {identifiedResult.album}</p>
                      )}
                    </div>

                    {identifiedResult.commentary && (
                      <p className="text-[11px] text-neutral-300 italic bg-neutral-950/60 p-2.5 rounded-lg border border-white/5">
                        "{identifiedResult.commentary}"
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      {identifiedResult.playableTrack && (
                        <button
                          onClick={() => handleCardPlayPauseClick(identifiedResult.playableTrack)}
                          className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-bold text-xs rounded-lg shadow-md hover:brightness-110 active:scale-95 transition text-center flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {isTrackPlaying(identifiedResult.playableTrack) ? (
                            <>
                              <span>⏸️</span> Pause
                            </>
                          ) : (
                            <>
                              <span>▶</span> Play in Loopra
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => setRecognitionState('idle')}
                        className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-lg border border-white/10 cursor-pointer"
                      >
                        Capture Again
                      </button>
                    </div>
                  </div>
                )}

                {recognitionState === 'unconfigured' && (
                  <div className="w-full max-w-sm bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-left space-y-2">
                    <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>⚙️</span> Recognition API Setup Required
                    </h5>
                    <p className="text-[11px] text-neutral-300 leading-relaxed">
                      Song fingerprinting requires ACRCloud credentials configured on Render:
                    </p>
                    <div className="bg-neutral-900/90 p-2 rounded text-[10px] font-mono text-amber-400 space-y-1">
                      <div>ACRCLOUD_HOST</div>
                      <div>ACRCLOUD_ACCESS_KEY</div>
                      <div>ACRCLOUD_SECRET_KEY</div>
                    </div>
                    <button
                      onClick={() => setRecognitionState('idle')}
                      className="w-full py-1.5 bg-neutral-800 text-xs text-neutral-300 rounded font-medium hover:bg-neutral-700 transition cursor-pointer"
                    >
                      Got It
                    </button>
                  </div>
                )}

                {recognitionState === 'error' && (
                  <div className="w-full max-w-sm bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center space-y-3">
                    <p className="text-xs text-red-300 font-medium">{recognitionError || 'Song recognition failed'}</p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setRecognitionState('idle')}
                        className="px-4 py-1.5 bg-neutral-800 text-xs text-white rounded font-medium hover:bg-neutral-700 transition cursor-pointer"
                      >
                        Try Again
                      </button>
                      {recognitionMode === 'device' && (
                        <button
                          onClick={() => {
                            setRecognitionMode('mic');
                            setRecognitionState('idle');
                          }}
                          className="px-4 py-1.5 bg-amber-500 text-neutral-950 text-xs rounded font-bold hover:bg-amber-400 transition cursor-pointer"
                        >
                          Switch to Mic
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowRecognition(false)}
                  className="mt-6 text-xs text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                >
                  Back to Chat
                </button>
              </div>
            ) : (
              /* CHAT MESSAGES STREAM */
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
            )}

            {/* Quick Suggestion Chips */}
            {!showRecognition && (
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
            )}

            {/* Input Bar */}
            {!showRecognition && (
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
            )}

            {/* Desktop 8-Directional Resize Handles */}
            {!isMobile && (
              <>
                <div
                  onPointerDown={(e) => handleResizePointerDown('se', e)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 flex items-end justify-end p-0.5"
                  title="Resize window"
                >
                  <svg className="w-2.5 h-2.5 text-amber-500/60" viewBox="0 0 6 6">
                    <circle cx="5" cy="5" r="1" fill="currentColor" />
                    <circle cx="5" cy="2" r="1" fill="currentColor" />
                    <circle cx="2" cy="5" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div
                  onPointerDown={(e) => handleResizePointerDown('sw', e)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50"
                />
                <div
                  onPointerDown={(e) => handleResizePointerDown('ne', e)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50"
                />
                <div
                  onPointerDown={(e) => handleResizePointerDown('nw', e)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50"
                />
                <div
                  onPointerDown={(e) => handleResizePointerDown('e', e)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  className="absolute top-4 bottom-4 right-0 w-2 cursor-e-resize z-40"
                />
                <div
                  onPointerDown={(e) => handleResizePointerDown('w', e)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  className="absolute top-4 bottom-4 left-0 w-2 cursor-w-resize z-40"
                />
                <div
                  onPointerDown={(e) => handleResizePointerDown('s', e)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  className="absolute bottom-0 left-4 right-4 h-2 cursor-s-resize z-40"
                />
                <div
                  onPointerDown={(e) => handleResizePointerDown('n', e)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  className="absolute top-0 left-4 right-4 h-2 cursor-n-resize z-40"
                />
              </>
            )}
          </div>
        )}

        {/* FLOATING BUTTON (Connected visually & structurally as part of the unit) */}
        <div
          onPointerDown={handleUnitPointerDown}
          onPointerMove={handleUnitPointerMove}
          onPointerUp={handleUnitPointerUp}
          className="relative flex items-center justify-end select-none cursor-grab active:cursor-grabbing"
          title="Drag to reposition entire Loopra AI unit"
        >
          <button
            type="button"
            onClick={handleButtonClick}
            className={`group relative flex items-center justify-center w-14 h-14 rounded-full transition-transform duration-150 shadow-2xl active:scale-95 cursor-pointer ${
              isOpen
                ? 'bg-amber-500 text-black shadow-amber-500/40 rotate-90 scale-105'
                : 'bg-neutral-900/95 text-amber-400 hover:text-white border border-amber-500/40 hover:border-amber-400 shadow-amber-500/20 hover:scale-105 backdrop-blur-2xl'
            }`}
            aria-label="Toggle Loopra AI Music Companion"
          >
            {isOpen ? (
              <svg className="w-6 h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                Loopra AI • Connected Companion
              </span>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
