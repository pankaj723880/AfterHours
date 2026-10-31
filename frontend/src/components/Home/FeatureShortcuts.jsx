import React from 'react';
import { Radio, Sparkles, History, Music } from 'lucide-react';

export default function FeatureShortcuts({ onNavigate, onOpenInsights }) {
  const shortcuts = [
    {
      id: 'radio',
      title: 'Indian Live Radio',
      subtitle: '24/7 Live Indian Stations',
      badge: 'Live',
      badgeColor: 'bg-red-500/15 text-red-400 border-red-500/30',
      icon: Radio,
      iconColor: 'text-amber-400',
      glowColor: 'from-amber-500/15 via-orange-500/10 to-transparent',
      borderColor: 'hover:border-amber-500/50',
      action: () => onNavigate?.('radio')
    },
    {
      id: 'mood',
      title: 'Mood-to-Music AI',
      subtitle: 'Smart Vibe Companion',
      badge: 'AI',
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      icon: Sparkles,
      iconColor: 'text-amber-300',
      glowColor: 'from-orange-500/15 via-amber-500/10 to-transparent',
      borderColor: 'hover:border-amber-400/50',
      action: () => onNavigate?.('mood')
    },
    {
      id: 'timemachine',
      title: 'Time Machine Radio',
      subtitle: 'Retro Eras & Decades',
      badge: 'Retro',
      badgeColor: 'bg-amber-600/15 text-amber-300 border-amber-600/30',
      icon: History,
      iconColor: 'text-amber-400',
      glowColor: 'from-amber-600/15 via-yellow-500/10 to-transparent',
      borderColor: 'hover:border-amber-500/50',
      action: () => onNavigate?.('timemachine')
    },
    {
      id: 'barber',
      title: 'Nostalgia Stations',
      subtitle: 'Saloon, Dhaba & Theka',
      badge: '90s / Desi',
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      icon: Music,
      iconColor: 'text-amber-400',
      glowColor: 'from-yellow-500/15 via-amber-500/10 to-transparent',
      borderColor: 'hover:border-amber-500/50',
      action: () => onNavigate?.('barber')
    }
  ];

  return (
    <div className="w-full min-w-0">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {shortcuts.map((sc) => {
          const IconComp = sc.icon;
          return (
            <div
              key={sc.id}
              onClick={sc.action}
              className={`group relative flex flex-col justify-between p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-neutral-900/90 to-neutral-950/95 border border-neutral-800/80 ${sc.borderColor} hover:shadow-[0_10px_30px_rgba(245,158,11,0.12)] transition-all duration-300 cursor-pointer overflow-hidden select-none active:scale-[0.98]`}
            >
              {/* Subtle top ambient glow */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${sc.glowColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
              />

              <div className="relative z-10 flex items-start justify-between gap-2 mb-3 sm:mb-4">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-neutral-800/90 group-hover:bg-amber-500/20 border border-neutral-700/60 group-hover:border-amber-500/40 flex items-center justify-center transition-all duration-300 shadow-md">
                  <IconComp className={`w-4 h-4 sm:w-5 sm:h-5 ${sc.iconColor} group-hover:scale-110 transition-transform`} />
                </div>
                {sc.badge && (
                  <span
                    className={`text-[9px] sm:text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${sc.badgeColor} shrink-0`}
                  >
                    {sc.badge}
                  </span>
                )}
              </div>

              <div className="relative z-10">
                <h4 className="text-xs sm:text-base font-extrabold text-white group-hover:text-amber-400 transition-colors truncate">
                  {sc.title}
                </h4>
                <p className="text-[11px] sm:text-xs text-neutral-400 font-medium mt-0.5 truncate">
                  {sc.subtitle}
                </p>
              </div>

              {/* Bottom active accent line on hover */}
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

