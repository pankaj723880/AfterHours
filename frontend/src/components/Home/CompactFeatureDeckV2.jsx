import React from 'react';
import { Radio, Sparkles, History, Music, ArrowRight } from 'lucide-react';

export default function CompactFeatureDeckV2({ onNavigate }) {
  const cards = [
    {
      id: 'radio',
      title: 'Live Radio',
      badge: '24/7 Live',
      isLive: true,
      icon: Radio,
      gradient: 'from-purple-950/40 via-neutral-900/90 to-neutral-950',
      border: 'border-purple-500/30 hover:border-purple-500/60',
      accentText: 'text-purple-300',
      action: () => onNavigate?.('radio')
    },
    {
      id: 'mood',
      title: 'Mood AI',
      badge: 'Gemini AI',
      icon: Sparkles,
      gradient: 'from-blue-950/40 via-neutral-900/90 to-neutral-950',
      border: 'border-blue-500/30 hover:border-blue-500/60',
      accentText: 'text-blue-300',
      action: () => onNavigate?.('mood')
    },
    {
      id: 'timemachine',
      title: 'Time Machine',
      badge: 'Golden Era',
      icon: History,
      gradient: 'from-amber-950/40 via-neutral-900/90 to-neutral-950',
      border: 'border-amber-500/30 hover:border-amber-500/60',
      accentText: 'text-amber-300',
      action: () => onNavigate?.('timemachine')
    },
    {
      id: 'barber',
      title: 'Nostalgia',
      badge: 'Saloon 90s',
      icon: Music,
      gradient: 'from-fuchsia-950/40 via-neutral-900/90 to-neutral-950',
      border: 'border-fuchsia-500/30 hover:border-fuchsia-500/60',
      accentText: 'text-fuchsia-300',
      action: () => onNavigate?.('barber')
    }
  ];

  return (
    <div className="w-full min-w-0">
      {/* Sleek 2x2 compact card deck with glassmorphic styling */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {cards.map((c) => {
          const IconComp = c.icon;
          return (
            <div
              key={c.id}
              onClick={c.action}
              className={`group relative flex items-center justify-between p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-br ${c.gradient} border ${c.border} shadow-md backdrop-blur-md hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer overflow-hidden select-none`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-amber-500/40 transition">
                  <IconComp className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate font-display">
                    {c.title}
                  </h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    {c.isLive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                    )}
                    <span className={`text-[9.5px] font-mono font-medium ${c.accentText} truncate`}>
                      {c.badge}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-neutral-400 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition ml-1">
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

