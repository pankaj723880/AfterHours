import React from 'react';
import { Home, Compass, Heart, ListMusic, Radio } from 'lucide-react';

/**
 * MobileBottomNav component for Loopra
 * Provides persistent bottom navigation on mobile devices (< md).
 * 
 * Order of destinations:
 * 1. Home (house icon) -> 'home'
 * 2. Discover (compass icon) -> 'discover'
 * 3. Liked (heart icon) -> 'library'
 * 4. Playlists (list-music icon) -> 'playlists'
 * 5. Radio (radio icon) -> 'radio' (Indian Live Radio)
 */
export default function MobileBottomNav({
  activeTab,
  isProfileOpen = false,
  onNavigate,
  onOpenPlaylists,
  onOpenProfile,
  user,
  isVisible = true,
}) {
  if (!isVisible) return null;

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      isActive: activeTab === 'home' && !isProfileOpen,
      onClick: (e) => {
        e.stopPropagation();
        onNavigate('home');
      },
    },
    {
      id: 'discover',
      label: 'Discover',
      icon: Compass,
      isActive: activeTab === 'discover' && !isProfileOpen,
      onClick: (e) => {
        e.stopPropagation();
        onNavigate('discover');
      },
    },
    {
      id: 'liked',
      label: 'Liked',
      icon: Heart,
      isActive: activeTab === 'library' && !isProfileOpen,
      onClick: (e) => {
        e.stopPropagation();
        onNavigate('library');
      },
    },
    {
      id: 'playlists',
      label: 'Playlists',
      icon: ListMusic,
      isActive: activeTab === 'playlists' && !isProfileOpen,
      onClick: (e) => {
        e.stopPropagation();
        if (onOpenPlaylists) {
          onOpenPlaylists();
        } else {
          onNavigate('playlists');
        }
      },
    },
    {
      id: 'radio',
      label: 'Radio',
      icon: Radio,
      isActive: (activeTab === 'radio' || activeTab === 'indian-radio') && !isProfileOpen,
      onClick: (e) => {
        e.stopPropagation();
        onNavigate('radio');
      },
    },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800/80 px-2 pb-[env(safe-area-inset-bottom,0px)] select-none shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
    >
      <div className="grid grid-cols-5 h-14 max-w-md mx-auto items-stretch">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const active = item.isActive;

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 transition-all duration-200 relative group cursor-pointer active:scale-95 touch-manipulation focus:outline-none ${active
                  ? 'text-amber-400 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
                }`}
            >
              {/* Subtle top indicator bar for active item */}
              {active && (
                <span
                  className="absolute top-0 w-8 h-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                  aria-hidden="true"
                />
              )}

              <div className="relative">
                <IconComponent
                  className={`w-5 h-5 transition-transform duration-200 ${active ? 'scale-110 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)] stroke-[2.25]' : 'stroke-[1.75]'
                    }`}
                  aria-hidden="true"
                />
              </div>

              <span
                className={`text-[10px] tracking-tight leading-none truncate max-w-[64px] ${active ? 'text-amber-400 font-semibold' : 'text-neutral-400'
                  }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

