import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ArrowUp,
  Shield,
  FileText,
  Mail,
  HelpCircle,
  AlertCircle,
  MessageSquare,
  Sparkles,
  Radio,
  Music,
  Headphones,
  Compass,
  X
} from 'lucide-react';

export default function LoopraFooter({
  footer = null,
  branding = null,
  onNavigate = null,
  onOpenInsights = null,
  onOpenRatingModal = null,
  onScrollToTop = null
}) {
  const [openAccordion, setOpenAccordion] = useState(null);
  const [legalModalTab, setLegalModalTab] = useState(null);

  const siteName = branding?.siteName || 'Loopra';
  const logoUrl = branding?.logoUrl || '/loopra-logo.png';
  const contactEmail = footer?.contactEmail || footer?.takedownEmail || 'admin@loopra.in';
  const copyrightText = footer?.copyright || `© ${new Date().getFullYear()} Loopra. All rights reserved.`;
  const disclaimerText = footer?.disclaimerText || 'Audio plays through YouTube embedded player API. Loopra does not host copyrighted files directly.';

  const toggleAccordion = (groupKey) => {
    setOpenAccordion(prev => (prev === groupKey ? null : groupKey));
  };

  const handleLinkClick = (e, action) => {
    e.preventDefault();
    if (typeof action === 'function') {
      action();
    }
  };

  const handleTopClick = () => {
    if (typeof onScrollToTop === 'function') {
      onScrollToTop();
    } else {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  // Verified navigation groups mapping to real routes
  const navigationGroups = [
    {
      key: 'discover',
      title: 'Discover',
      icon: Compass,
      links: [
        { label: 'Home', action: () => onNavigate?.('home') },
        { label: 'Discover & Search', action: () => onNavigate?.('discover') },
        { label: 'Trending Songs', action: () => onNavigate?.('home') },
        { label: 'Popular Artists', action: () => onNavigate?.('home') },
        { label: 'Popular Albums', action: () => onNavigate?.('home') },
        { label: 'Discover Swipe', action: () => onNavigate?.('swipe') }
      ]
    },
    {
      key: 'listen',
      title: 'Listen',
      icon: Radio,
      links: [
        { label: 'Indian Live Radio', action: () => onNavigate?.('radio') },
        { label: 'Time Machine Radio', action: () => onNavigate?.('timemachine') },
        { label: 'Nostalgia Stations', action: () => onNavigate?.('barber') },
        { label: 'Saloon FM', action: () => onNavigate?.('barber') },
        { label: 'Horn Ok Please', action: () => onNavigate?.('truck') },
        { label: 'Theka Session', action: () => onNavigate?.('pauwa') }
      ]
    },
    {
      key: 'your-music',
      title: 'Your Music',
      icon: Music,
      links: [
        { label: 'Liked Songs', action: () => onNavigate?.('library') },
        { label: 'Playlists', action: () => onNavigate?.('playlists') },
        { label: 'Listening History', action: () => onNavigate?.('history') },
        { label: 'Listening Insights & Recap', action: () => onOpenInsights ? onOpenInsights() : onNavigate?.('activity') },
        { label: 'Daily Mix', action: () => onNavigate?.('for-you') }
      ]
    },
    {
      key: 'ai-personalization',
      title: 'AI & Personalization',
      icon: Sparkles,
      links: [
        { label: 'Mood-to-Music AI', action: () => onNavigate?.('mood') },
        { label: 'AI Assistant', action: () => onNavigate?.('mood') },
        { label: 'Personalized Recommendations', action: () => onNavigate?.('for-you') },
        { label: 'Curated Just For You', action: () => onNavigate?.('for-you') }
      ]
    },
    {
      key: 'support',
      title: 'Support',
      icon: HelpCircle,
      links: [
        { label: 'Contact Us', href: `mailto:${contactEmail}?subject=Contact%20Loopra` },
        { label: 'Report an Issue', href: `mailto:${contactEmail}?subject=Report%20an%20Issue%20-%20Loopra` },
        { label: 'Feedback', action: () => onOpenRatingModal ? onOpenRatingModal('review') : (window.location.href = `mailto:${contactEmail}?subject=Loopra%20Feedback`) },
        { label: 'Help & Support', href: `mailto:${contactEmail}?subject=Help%20and%20Support` },
        { label: 'Copyright Concerns', href: `mailto:${contactEmail}?subject=Copyright%20Concern%20Takedown` }
      ]
    },
    {
      key: 'legal',
      title: 'Legal & Policies',
      icon: Shield,
      links: [
        { label: 'Privacy Policy', action: () => setLegalModalTab('privacy') },
        { label: 'Terms of Service', action: () => setLegalModalTab('terms') },
        { label: 'Copyright Policy', action: () => setLegalModalTab('copyright') },
        { label: 'Disclaimer', action: () => setLegalModalTab('disclaimer') },
        { label: 'Cookie Policy', action: () => setLegalModalTab('cookies') }
      ]
    }
  ];

  return (
    <footer className="w-full mt-12 pt-10 pb-8 bg-gradient-to-b from-[#111111] via-[#0d0d0d] to-[#070707] border-t border-neutral-800/80 text-neutral-300 relative select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 space-y-8">
        
        {/* 1. BRAND SECTION */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-neutral-800/70">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-900 border border-amber-500/40 p-1 flex items-center justify-center shadow-lg shadow-amber-500/10 shrink-0">
                <img src={logoUrl} alt={siteName} className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-display font-black tracking-wider text-white uppercase flex items-center gap-1.5">
                  <span>{siteName}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-amber-300/90 font-display tracking-wide">
              More Than Music — Stream. Discover. Relive. Repeat.
            </p>

            <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">
              Your personal destination for music discovery, live radio, AI-powered recommendations and nostalgic listening experiences. Explore music that matches your mood, memories and moments.
            </p>
          </div>

          {/* Social Connection & Back to Top Header */}
          <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end gap-3.5 shrink-0 w-full sm:w-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 font-mono">
              <span className="text-amber-400">⚡</span>
              <span>Connect With Loopra</span>
            </span>

            <div className="flex items-center gap-2.5">
              {/* Instagram */}
              <a
                href="https://instagram.com/loopra.in"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-pink-500/50 text-neutral-400 hover:text-pink-400 flex items-center justify-center transition shadow-md group cursor-pointer"
                title="Follow Loopra on Instagram"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>

              {/* YouTube */}
              <a
                href="https://youtube.com/@loopra"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-red-500/50 text-neutral-400 hover:text-red-500 flex items-center justify-center transition shadow-md group cursor-pointer"
                title="Subscribe to Loopra on YouTube"
                aria-label="YouTube"
              >
                <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>

              {/* Facebook */}
              <a
                href="https://facebook.com/loopra.in"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/50 text-neutral-400 hover:text-blue-400 flex items-center justify-center transition shadow-md group cursor-pointer"
                title="Connect with Loopra on Facebook"
                aria-label="Facebook"
              >
                <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>

              {/* Back to Top Quick Button */}
              <button
                type="button"
                onClick={handleTopClick}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/40 text-neutral-300 hover:text-amber-400 text-xs font-semibold transition cursor-pointer shadow-md active:scale-95 ml-2"
                title="Back to Top"
                aria-label="Back to top"
              >
                <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden min-[400px]:inline">Top</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. NAVIGATION CATEGORIES */}
        {/* Mobile Accordion View (< sm) */}
        <div className="sm:hidden space-y-2">
          {navigationGroups.map((group) => {
            const IconComp = group.icon;
            const isOpen = openAccordion === group.key;

            return (
              <div
                key={group.key}
                className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 overflow-hidden transition-all duration-200"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(group.key)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between px-4 py-3 min-h-[46px] text-left text-sm font-bold text-neutral-200 hover:text-white transition active:bg-neutral-800/50 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <IconComp className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{group.title}</span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-3.5 pt-1 border-t border-neutral-800/60 bg-neutral-950/40 space-y-1 animate-in fade-in duration-150">
                    {group.links.map((link, idx) => {
                      if (link.href) {
                        return (
                          <a
                            key={idx}
                            href={link.href}
                            className="block py-2 text-xs font-medium text-neutral-400 hover:text-amber-300 active:text-amber-400 transition cursor-pointer"
                          >
                            {link.label}
                          </a>
                        );
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => handleLinkClick(e, link.action)}
                          className="w-full text-left py-2 text-xs font-medium text-neutral-400 hover:text-amber-300 active:text-amber-400 transition cursor-pointer"
                        >
                          {link.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Multi-Column Grid View (>= sm) */}
        <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8 pb-4">
          {navigationGroups.map((group) => {
            const IconComp = group.icon;
            return (
              <div key={group.key} className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2 font-display">
                  <IconComp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{group.title}</span>
                </h4>
                <ul className="space-y-2">
                  {group.links.map((link, idx) => {
                    if (link.href) {
                      return (
                        <li key={idx}>
                          <a
                            href={link.href}
                            className="text-xs text-neutral-400 hover:text-amber-300 transition-colors inline-block cursor-pointer font-medium"
                          >
                            {link.label}
                          </a>
                        </li>
                      );
                    }
                    return (
                      <li key={idx}>
                        <button
                          type="button"
                          onClick={(e) => handleLinkClick(e, link.action)}
                          className="text-xs text-neutral-400 hover:text-amber-300 transition-colors text-left inline-block cursor-pointer font-medium"
                        >
                          {link.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* 3. LEGAL & POLICIES HORIZONTAL BADGES (TABLET & DESKTOP) */}
        <div className="hidden sm:flex flex-wrap items-center justify-center gap-4 py-3 border-y border-neutral-800/70 text-xs text-neutral-400">
          <button
            type="button"
            onClick={() => setLegalModalTab('privacy')}
            className="hover:text-amber-300 transition cursor-pointer"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setLegalModalTab('terms')}
            className="hover:text-amber-300 transition cursor-pointer"
          >
            Terms of Service
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setLegalModalTab('copyright')}
            className="hover:text-amber-300 transition cursor-pointer"
          >
            Copyright Policy
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setLegalModalTab('disclaimer')}
            className="hover:text-amber-300 transition cursor-pointer"
          >
            Disclaimer
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setLegalModalTab('cookies')}
            className="hover:text-amber-300 transition cursor-pointer"
          >
            Cookie Policy
          </button>
        </div>

        {/* 4. FOOTER BOTTOM BAR */}
        <div className="pt-2 space-y-3 text-xs leading-relaxed text-neutral-400 border-t sm:border-t-0 border-neutral-800/60">
          {/* Statutory Disclosure */}
          <p className="text-[11px] sm:text-xs text-neutral-400">
            {disclaimerText}
          </p>

          <p className="text-[11px] sm:text-xs text-neutral-400">
            If you are a copyright owner and have concerns, please contact us at{' '}
            <a href={`mailto:${contactEmail}`} className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2">
              {contactEmail}
            </a>.
          </p>

          {/* Copyright & Made For Music Lovers */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-neutral-800/60 text-[11px] sm:text-xs text-neutral-400 text-center sm:text-left">
            <p className="font-mono">{copyrightText}</p>
            <p className="text-neutral-400 font-medium flex items-center gap-1.5">
              <span>Made for music lovers.</span>
              <span className="text-amber-400">♥</span>
            </p>
          </div>
        </div>

      </div>

      {/* 5. LEGAL & POLICIES POPUP MODAL */}
      {legalModalTab && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setLegalModalTab(null)}
        >
          <div
            className="relative w-full max-w-xl max-h-[85vh] bg-neutral-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/70">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider">
                  {legalModalTab === 'privacy' && 'Privacy Policy'}
                  {legalModalTab === 'terms' && 'Terms of Service'}
                  {legalModalTab === 'copyright' && 'Copyright Policy & DMCA'}
                  {legalModalTab === 'disclaimer' && 'Platform Disclaimer'}
                  {legalModalTab === 'cookies' && 'Cookie Policy'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLegalModalTab(null)}
                className="p-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-neutral-300 leading-relaxed">
              {legalModalTab === 'privacy' && (
                <>
                  <p className="font-semibold text-white">Your privacy is fundamental to Loopra.</p>
                  <p>
                    Loopra respects your personal information. When you use our service, we do not sell your personal data or listening history to third-party advertisers.
                  </p>
                  <h4 className="font-bold text-amber-400 pt-2">Data We Collect</h4>
                  <p>
                    - Account information (username, email, avatar) provided during authentication.
                    <br />
                    - Local playback state (liked tracks, custom playlists, recent history) stored securely to sync your music experience.
                  </p>
                  <h4 className="font-bold text-amber-400 pt-2">AI Personalization</h4>
                  <p>
                    Recommendations generated through our Gemini AI engines are based purely on musical tempo, genres, and audio descriptors. You can opt out of recommendation tracking at any time in your AI Lounge settings.
                  </p>
                </>
              )}

              {legalModalTab === 'terms' && (
                <>
                  <p className="font-semibold text-white">Terms of Service</p>
                  <p>
                    By accessing or using Loopra, you agree to comply with and be bound by these Terms.
                  </p>
                  <h4 className="font-bold text-amber-400 pt-2">Audio Playback & Content</h4>
                  <p>
                    All songs, music streams, and audio elements rendered on Loopra stream directly through the YouTube IFrame Player API in compliance with YouTube Developer Terms of Service.
                  </p>
                  <h4 className="font-bold text-amber-400 pt-2">Acceptable Use</h4>
                  <p>
                    You agree not to attempt to extract, scrape, or download copyrighted audio streams directly, or use automated systems that disrupt the sanctuary of the platform.
                  </p>
                </>
              )}

              {legalModalTab === 'copyright' && (
                <>
                  <p className="font-semibold text-white">Copyright & DMCA Notice</p>
                  <p>
                    Loopra does not host, store, or distribute any copyrighted sound recordings or media files directly on its servers.
                  </p>
                  <p>
                    All multimedia content is embedded client-side via authorized developer APIs provided by official content distributors (such as YouTube).
                  </p>
                  <h4 className="font-bold text-amber-400 pt-2">Takedown Requests</h4>
                  <p>
                    If you are a copyright owner or an authorized agent and believe that content referenced on Loopra infringes upon your copyright, please notify our administrative team at{' '}
                    <a href={`mailto:${contactEmail}`} className="text-amber-400 underline font-semibold">
                      {contactEmail}
                    </a>
                    . Verified requests are processed promptly.
                  </p>
                </>
              )}

              {legalModalTab === 'disclaimer' && (
                <>
                  <p className="font-semibold text-white">Platform Disclaimer</p>
                  <p>
                    {disclaimerText}
                  </p>
                  <p>
                    All trademarks, logos, and brand names featured on Loopra are the property of their respective owners. Their inclusion does not imply affiliation or endorsement.
                  </p>
                  <p>
                    Loopra is designed to provide music lovers with an immersive, retro-inspired aesthetic and discovery lounge.
                  </p>
                </>
              )}

              {legalModalTab === 'cookies' && (
                <>
                  <p className="font-semibold text-white">Cookie & Local Storage Policy</p>
                  <p>
                    Loopra utilizes browser LocalStorage and essential session tokens exclusively to remember your preferences (such as your liked songs, theme choices, and volume settings).
                  </p>
                  <p>
                    We do not use invasive third-party cross-site tracking cookies.
                  </p>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950/70 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModalTab(null)}
                className="px-4 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
