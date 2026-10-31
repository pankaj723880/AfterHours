import React from 'react';
import { Radio, Sparkles, History, Music, ArrowRight } from 'lucide-react';

export default function FeatureShortcuts({ onNavigate, onOpenInsights }) {
  const shortcuts = [
    {
      id: 'radio',
      title: 'Indian Live Radio',
      subtitle: '24/7 Live Indian Stations',
      badge: 'Live',
      hasRedDot: true,
      badgeStyle: 'bg-rose-950/70 text-rose-300 border-rose-500/40',
      icon: Radio,
      iconColor: 'text-amber-400',
      bgGradient: 'from-[#2a1333] via-[#1a0c20] to-[#110715]',
      borderColor: 'border-purple-500/30 hover:border-purple-500/60',
      arrowBg: 'bg-purple-600/80 text-white',
      artType: 'radio',
      action: () => onNavigate?.('radio')
    },
    {
      id: 'mood',
      title: 'Mood-to-Music AI',
      subtitle: 'Smart Vibe Companion',
      badge: 'AI',
      badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: Sparkles,
      iconColor: 'text-amber-300',
      bgGradient: 'from-[#0c1e38] via-[#091527] to-[#050d18]',
      borderColor: 'border-blue-500/30 hover:border-blue-500/60',
      arrowBg: 'bg-blue-600/80 text-white',
      artType: 'chart',
      action: () => onNavigate?.('mood')
    },
    {
      id: 'timemachine',
      title: 'Time Machine Radio',
      subtitle: 'Retro Eras & Decades',
      badge: 'Retro',
      badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: History,
      iconColor: 'text-amber-400',
      bgGradient: 'from-[#2c190a] via-[#1c1006] to-[#100903]',
      borderColor: 'border-amber-600/30 hover:border-amber-500/60',
      arrowBg: 'bg-amber-600/80 text-white',
      artType: 'vinyl',
      action: () => onNavigate?.('timemachine')
    },
    {
      id: 'barber',
      title: 'Nostalgia Stations',
      subtitle: 'Saloon, Dhaba & Theka',
      badge: '90s / Desi',
      badgeStyle: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
      icon: Music,
      iconColor: 'text-amber-400',
      bgGradient: 'from-[#300d27] via-[#1f0819] to-[#12050f]',
      borderColor: 'border-fuchsia-500/30 hover:border-fuchsia-500/60',
      arrowBg: 'bg-fuchsia-600/80 text-white',
      artType: 'cassette',
      action: () => onNavigate?.('barber')
    }
  ];

  return (
    <div className="w-full min-w-0">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        {shortcuts.map((sc) => {
          const IconComp = sc.icon;
          return (
            <div
              key={sc.id}
              onClick={sc.action}
              className={`group relative flex flex-col justify-between p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${sc.bgGradient} border ${sc.borderColor} shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden select-none active:scale-[0.98] min-h-[120px] sm:min-h-[140px]`}
            >
              {/* Subtle visual ambient graphic in top-right corner */}
              <div className="absolute top-2 right-2 opacity-20 group-hover:opacity-35 transition-opacity pointer-events-none">
                {sc.artType === 'radio' && (
                  <svg className="w-16 h-16 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4.93 19.07A10 10 0 0 1 2 12a10 10 0 0 1 2.93-7.07M19.07 4.93A10 10 0 0 1 22 12a10 10 0 0 1-2.93 7.07M7.76 16.24A6 6 0 0 1 6 12a6 6 0 0 1 1.76-4.24M16.24 7.76A6 6 0 0 1 18 12a6 6 0 0 1-1.76 4.24" />
                  </svg>
                )}
                {sc.artType === 'chart' && (
                  <svg className="w-16 h-16 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                )}
                {sc.artType === 'vinyl' && (
                  <svg className="w-16 h-16 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                )}
                {sc.artType === 'cassette' && (
                  <svg className="w-16 h-16 text-fuchsia-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <circle cx="8" cy="10" r="2" />
                    <circle cx="16" cy="10" r="2" />
                    <path d="M8 14h8" />
                  </svg>
                )}
              </div>

              {/* Top Row: Icon Container on Left, Badge on Right */}
              <div className="relative z-10 flex items-start justify-between gap-2 mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-neutral-900/80 border border-neutral-700/60 flex items-center justify-center shadow-md">
                  <IconComp className={`w-4 h-4 sm:w-5 sm:h-5 ${sc.iconColor}`} />
                </div>
                {sc.badge && (
                  <span
                    className={`text-[9px] sm:text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${sc.badgeStyle} flex items-center gap-1 shrink-0`}
                  >
                    {sc.hasRedDot && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_6px_#f43f5e]" />
                    )}
                    {sc.badge}
                  </span>
                )}
              </div>

              {/* Bottom: Title, Subtitle, and Circular Arrow Button */}
              <div className="relative z-10 flex items-end justify-between gap-1.5">
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm md:text-base font-extrabold text-white group-hover:text-amber-400 transition-colors truncate">
                    {sc.title}
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-neutral-400 font-medium mt-0.5 truncate">
                    {sc.subtitle}
                  </p>
                </div>

                <div className={`w-6 h-6 rounded-full ${sc.arrowBg} flex items-center justify-center shrink-0 shadow-md transform group-hover:translate-x-0.5 transition-transform`}>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


