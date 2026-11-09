import React, { useState, useEffect } from 'react';
const ThreeDCharacter = React.lazy(() => import('./ThreeDCharacter'));
import { Mic, MessageSquare, X, Sparkles } from 'lucide-react';
import { voiceBuddyService, CHARACTERS } from '../../services/voiceBuddyService';
import { voiceSessionService } from '../../services/voiceSessionService';

export default function FloatingAvatarTriggerV2({
  isSessionActive = false,
  isListening = false,
  isPlaying = false,
  sessionState = 'OFF',
  voiceVolumeScale = 0,
  onToggleVoiceMode = () => {},
  onToggleChat = () => {},
  onCloseAvatar = () => {},
  isBottomPlayerVisible = false,
  isVisible = true
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const character = CHARACTERS?.female || { gender: 'female' };

  // Listen to live speech events & interim/final transcriptions
  useEffect(() => {
    const unsubSession = voiceSessionService.subscribe((snapshot) => {
      if (snapshot.event === 'interim_transcript') {
        setLiveTranscript(snapshot.interimText || '');
      } else if (snapshot.event === 'final_transcript') {
        setLiveTranscript(snapshot.transcript || '');
      }
    });

    const unsubBuddy = voiceBuddyService.subscribe(({ event, text }) => {
      if (event === 'speech_start' || event === 'speech_pending') {
        setIsSpeaking(true);
        if (text) setLiveTranscript(text);
      } else if (event === 'speech_end') {
        setIsSpeaking(false);
      }
    });

    return () => {
      unsubSession();
      unsubBuddy();
    };
  }, []);

  if (!isVisible) return null;

  // Active voice synthesis / mic activity drives soft pulsating amber aura
  const isVoiceActive = isListening || isSpeaking || isSessionActive;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. NON-INTRUSIVE HOLOGRAM BUBBLE (Default View: bottom-28 right-4)        */}
      {/* ========================================================================= */}
      <div 
        className="fixed z-[2147483640] right-4 select-none transition-all duration-300 pointer-events-none"
        style={{
          bottom: isBottomPlayerVisible 
            ? 'calc(140px + env(safe-area-inset-bottom, 0px))' 
            : 'calc(7rem + env(safe-area-inset-bottom, 0px))' // bottom-28
        }}
      >
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className={`group relative pointer-events-auto w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center overflow-hidden backdrop-blur-md bg-black/60 border border-amber-500/30 shadow-xl transition-all duration-300 active:scale-95 cursor-pointer ${
            isVoiceActive
              ? 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] ring-2 ring-amber-400/60'
              : 'hover:border-amber-400/60 hover:shadow-[0_0_18px_rgba(245,158,11,0.25)]'
          }`}
          title="Loopra 3D Companion — Tap for Voice & Visuals"
          aria-label="Open 3D Avatar Companion"
        >
          {/* Audio & Speech Reactivity: Soft pulsating amber aura when voice/mic is active */}
          {isVoiceActive && (
            <span className="absolute -inset-1 rounded-full border-2 border-amber-400/50 pointer-events-none animate-ping" />
          )}
          {isPlaying && !isVoiceActive && (
            <span className="absolute -inset-1 rounded-full border border-amber-400/30 pointer-events-none animate-pulse" />
          )}

          {/* 3D Head-up / Bust Canvas inside circular aperture */}
          <div className="relative w-full h-full flex items-center justify-center pointer-events-none overflow-hidden rounded-full">
            <React.Suspense fallback={<div className="w-4 h-4 rounded-full border border-amber-400 border-t-transparent animate-spin" />}>
              <ThreeDCharacter
                gender={character.gender}
                animationState={isSpeaking ? 'speaking' : isListening ? 'listening' : 'idle'}
                isSpeaking={isSpeaking}
                isListening={isListening}
                isPlaying={isPlaying}
                voiceVolumeScale={voiceVolumeScale}
                framingMode="bust"
                width={72}
                height={72}
                isPaused={isExpanded} // Pause background bubble render loop when modal is open
              />
            </React.Suspense>
          </div>

          {/* Live Mic Activity Indicator Dot */}
          {isListening && (
            <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-rose-500 border border-neutral-950 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. INTERACTIVE ASSISTANT BOTTOM-SHEET / MODAL (Expanded View)             */}
      {/* ========================================================================= */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-[2147483645] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200 pointer-events-auto"
          onClick={() => {
            voiceBuddyService.speak('Byeee');
            setIsExpanded(false);
          }}
        >
          <div 
            className="relative w-full max-w-sm rounded-3xl bg-neutral-950/95 border border-amber-500/30 shadow-2xl p-4 overflow-hidden flex flex-col items-center select-none pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header controls */}
            <div className="w-full flex items-center justify-between pb-2 border-b border-neutral-800/80">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse" />
                <span className="text-xs font-bold text-white font-display uppercase tracking-wider">
                  Loopra Voice Companion
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  voiceBuddyService.speak('Byeee');
                  setIsExpanded(false);
                }}
                className="p-1 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                aria-label="Close Companion"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Upper section: Full 3D interactive avatar with natural animations */}
            <div className="relative w-full h-64 flex items-center justify-center overflow-hidden my-1">
              <React.Suspense fallback={<div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />}>
                <ThreeDCharacter
                  gender={character.gender}
                  animationState={isSpeaking ? 'speaking' : isListening ? 'listening' : 'idle'}
                  isSpeaking={isSpeaking}
                  isListening={isListening}
                  isPlaying={isPlaying}
                  voiceVolumeScale={voiceVolumeScale}
                  framingMode="full"
                  width={220}
                  height={260}
                  isPaused={!isExpanded}
                />
              </React.Suspense>
            </div>

            {/* Middle: Live speech transcription bubble (Hindi/English) */}
            <div className="w-full min-h-[44px] px-3 py-2 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-center text-center my-1.5">
              <p className="text-xs text-amber-200/90 font-medium italic line-clamp-2">
                {liveTranscript || (isListening ? 'Sun rahi hoon... boliye! (Listening)' : isSpeaking ? 'Speaking...' : 'Tap Mic or say "Hey Loopra"')}
              </p>
            </div>

            {/* Bottom: Quick action pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2 w-full">
              {[
                { label: 'Play Trending Hindi', query: 'play trending hindi songs' },
                { label: 'Horn Ok Please', query: 'play highway truck bollywood retro hits' },
                { label: 'Surprise Me', query: 'surprise me with great music' }
              ].map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => {
                    if (window.__loopraProcessCommand) {
                      window.__loopraProcessCommand(pill.query);
                    }
                  }}
                  className="px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 hover:border-amber-400 text-xs font-semibold text-amber-300 whitespace-nowrap transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{pill.label}</span>
                </button>
              ))}
            </div>

            {/* Primary Action Buttons */}
            <div className="w-full grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80 mt-1">
              <button
                type="button"
                onClick={onToggleVoiceMode}
                className={`py-2 px-3 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer active:scale-95 ${
                  isListening 
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 ring-2 ring-rose-400' 
                    : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-md shadow-amber-500/20'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isListening ? 'Stop Voice' : 'Voice Command'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  onToggleChat?.();
                }}
                className="py-2 px-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700/80 flex items-center justify-center gap-1.5 text-xs font-semibold transition cursor-pointer active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Chat Lounge</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
