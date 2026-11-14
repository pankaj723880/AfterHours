import React from 'react';
import { Sliders, CheckCircle2, XCircle, Sparkles, Radio, Headphones, Sparkle, Flame, Mic, Download, MessageSquare, Star, Music } from 'lucide-react';

export default function CmsFeatureManager({ draft, onUpdateDraft, showToast }) {
  const features = draft?.featureControls || {
    djClubEnabled: true,
    moodAiEnabled: true,
    timeMachineEnabled: true,
    activityFeedEnabled: true,
    discoverSwipeEnabled: true,
    voiceAgentEnabled: true,
    aiChatEnabled: true,
    offlineDownloadsEnabled: true,
    ratingsPopupEnabled: true,
    lyricsEnabled: true,
    sleepTimerEnabled: true,
    listeningRoomsEnabled: true
  };

  const featureList = [
    {
      key: 'djClubEnabled',
      name: 'Loopra 3D DJ Club',
      desc: 'Full-screen dual turntable mixing deck with WebGL lighting and 3D visualizers.',
      icon: Headphones,
      badge: 'Interactive'
    },
    {
      key: 'moodAiEnabled',
      name: 'Mood-to-Music AI',
      desc: 'Emotional mood picker generating real-time smart genre recommendations.',
      icon: Sparkle,
      badge: 'AI Feature'
    },
    {
      key: 'timeMachineEnabled',
      name: 'Time Machine Retro Radio',
      desc: 'Interactive era selector exploring 70s, 80s, 90s, and 2000s Bollywood hits.',
      icon: Radio,
      badge: 'Nostalgia'
    },
    {
      key: 'discoverSwipeEnabled',
      name: 'Discover Swipe Deck',
      desc: 'Mobile-first swipe cards for rapid music discovery and instant favorites.',
      icon: Sliders,
      badge: 'Mobile'
    },
    {
      key: 'activityFeedEnabled',
      name: 'Live Listening Activity Feed',
      desc: 'Real-time social pulse showing tracks currently played or liked across Loopra.',
      icon: Flame,
      badge: 'Real-time'
    },
    {
      key: 'voiceAgentEnabled',
      name: 'Voice Agent & 3D Interactive Avatar',
      desc: 'Hands-free voice playback commands and roaming 3D character companion.',
      icon: Mic,
      badge: 'Experimental'
    },
    {
      key: 'aiChatEnabled',
      name: 'AI Music Companion Chat',
      desc: 'Conversational chat buddy assisting users in finding niche songs and playlists.',
      icon: MessageSquare,
      badge: 'Chatbot'
    },
    {
      key: 'offlineDownloadsEnabled',
      name: 'Offline Music Downloads & Cache',
      desc: 'Licensed local audio caching for offline and airplane-mode listening.',
      icon: Download,
      badge: 'Storage'
    },
    {
      key: 'lyricsEnabled',
      name: 'Synchronized Lyrics Overlay',
      desc: 'Time-stamped lyrics viewer with auto-scroll and manual search.',
      icon: Music,
      badge: 'Player'
    },
    {
      key: 'ratingsPopupEnabled',
      name: 'User Feedback & Rating Prompt',
      desc: 'In-app 5-star user review modal routed directly to the Admin reviews tab.',
      icon: Star,
      badge: 'Feedback'
    }
  ];

  const handleToggle = (featureKey, currentVal) => {
    onUpdateDraft(prev => ({
      ...prev,
      featureControls: {
        ...(prev.featureControls || {}),
        [featureKey]: !currentVal
      }
    }));
    showToast?.(`Feature ${featureKey} toggled in draft`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            Interactive Feature Controls
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Safely enable or disable user-facing interactive features, 3D experiences, and AI modules without modifying code.
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {featureList.map(f => {
          const isEnabled = features[f.key] !== false;
          const IconComp = f.icon;

          return (
            <div
              key={f.key}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${isEnabled
                  ? 'bg-neutral-900/60 border-neutral-800 shadow-sm'
                  : 'bg-neutral-950/40 border-neutral-900 opacity-60'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${isEnabled
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                    }`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{f.name}</h3>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 font-mono">
                        {f.badge}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-800/80">
                <span className="text-[11px] font-mono text-neutral-400">
                  Status: <strong className={isEnabled ? 'text-emerald-400' : 'text-neutral-500'}>{isEnabled ? 'Enabled' : 'Disabled'}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => handleToggle(f.key, isEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${isEnabled
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700'
                    }`}
                >
                  {isEnabled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Enabled</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Disabled</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
        <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
        <span>Feature toggles are drafted instantly. Publish changes to reflect them live in the user navigation and UI.</span>
      </div>
    </div>
  );
}

