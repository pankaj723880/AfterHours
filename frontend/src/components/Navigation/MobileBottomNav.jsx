import React from 'react';
import { Home, Compass, Heart, ListMusic, Radio, Users } from 'lucide-react';
import { useUiConfig } from '../../context/UiConfigContext';

/**
 * MobileBottomNav component for Loopra
 * Provides persistent bottom navigation on mobile devices (< md).
 * Respects global Admin UI Visibility configuration.
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
  const { isVisible: isUiVisible } = useUiConfig();
  if (!isVisible) return null;

  const rawNavItems = [
    {
      id: 'home',
      uiKey: 'nav.home',
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
      uiKey: 'nav.discover',
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
      uiKey: 'nav.liked',
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
      uiKey: 'nav.playlists',
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
      id: 'rooms',
      uiKey: 'nav.rooms',
      label: 'Rooms',
      icon: Users,
      isActive: activeTab === 'rooms' && !isProfileOpen,
      onClick: (e) => {
        e.stopPropagation();
        onNavigate('rooms');
      },
    },
    {
      id: 'radio',
      uiKey: 'nav.radio',
      label: 'Radio',
      icon: Radio,
      isActive: (activeTab === 'radio' || activeTab === 'indian-radio') && !isProfileOpen,
      onClick: (e) => {
        e.stopPropagation();
        onNavigate('radio');
      },
    },
  ];

  // Filter items dynamically based on Admin UI Visibility settings
  const navItems = rawNavItems.filter(item => isUiVisible(item.uiKey));
  if (navItems.length === 0) return null;

  return (
    <nav
      role="navigation"
      aria-label="Mobile Navigation"
      style={{ paddingBottom: 'max(var(--safe-area-bottom, 0px), env(safe-area-inset-bottom, 0px), 8px)' }}
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800/80 px-1 select-none shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
    >
      <div 
        className="h-14 max-w-md mx-auto items-stretch grid"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const active = item.isActive;

          return (
            <button
              key={item.id}
              data-nav-id={item.id}
              type="button"
              onClick={item.onClick}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 transition-colors duration-180 ease-out relative group cursor-pointer active:scale-95 touch-manipulation focus:outline-none select-none ${active
                  ? 'text-amber-400 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
                }`}
            >
              {/* Subtle top indicator bar for active item */}
              {active && (
                <span
                  className="absolute top-0 w-8 h-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-fadeIn"
                  aria-hidden="true"
                />
              )}

              <div className="relative">
                <IconComponent
                  className={`w-5 h-5 transition-transform duration-180 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${active ? 'scale-110 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)] stroke-[2.25]' : 'stroke-[1.75]'
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

