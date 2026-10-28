import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function CmsHeroBanner({ banner, onActionClick }) {
  if (!banner?.enabled || (!banner?.title && !banner?.subtitle)) {
    return null;
  }

  const handleAction = () => {
    if (onActionClick && banner.actionUrl) {
      onActionClick(banner.actionUrl);
    }
  };

  return (
    <div className="relative rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 md:p-8 bg-gradient-to-r from-neutral-900/90 via-neutral-900/60 to-neutral-950/90 border border-amber-500/25 shadow-xl backdrop-blur-2xl overflow-hidden mb-4 sm:mb-6 w-full min-w-0">
      {banner.imageUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: `url(${banner.imageUrl})` }}
        />
      )}
      <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full bg-amber-500/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-orange-500/10 blur-[80px] pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
        <div className="space-y-1.5 sm:space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] sm:text-xs font-mono font-semibold">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>FEATURED SPOTLIGHT</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
            {banner.title}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 font-medium">
            {banner.subtitle}
          </p>
        </div>

        {banner.actionText && (
          <button
            onClick={handleAction}
            className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs sm:text-sm shadow-xl shadow-amber-500/20 transition cursor-pointer shrink-0"
          >
            <span>{banner.actionText}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
