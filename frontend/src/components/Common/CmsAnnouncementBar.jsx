import React, { useState } from 'react';
import { Bell, Sparkles, AlertTriangle, AlertCircle, X, ExternalLink } from 'lucide-react';

export default function CmsAnnouncementBar({ announcement }) {
  const [dismissed, setDismissed] = useState(false);

  if (!announcement?.enabled || !announcement?.message || dismissed) {
    return null;
  }

  const typeStyles = {
    info: 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200 shadow-emerald-950/50',
    promo: 'bg-amber-950/80 border-amber-500/30 text-amber-200 shadow-amber-950/50',
    warning: 'bg-orange-950/80 border-orange-500/30 text-orange-200 shadow-orange-950/50',
    alert: 'bg-rose-950/80 border-rose-500/30 text-rose-200 shadow-rose-950/50'
  };

  const typeIcons = {
    info: <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
    promo: <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />,
    alert: <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
  };

  const styleClass = typeStyles[announcement.type] || typeStyles.info;
  const icon = typeIcons[announcement.type] || typeIcons.info;

  return (
    <div className={`w-full py-1.5 sm:py-2 px-2.5 sm:px-4 border-b backdrop-blur-xl flex items-center justify-between gap-2 sm:gap-3 text-xs z-30 transition-all ${styleClass}`}>
      <div className="flex items-center gap-2 max-w-5xl mx-auto flex-1 justify-center text-center">
        {icon}
        <span className="font-medium">{announcement.message}</span>
        {announcement.linkUrl && (
          <a
            href={announcement.linkUrl}
            target={announcement.linkUrl.startsWith('http') ? '_blank' : '_self'}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold underline hover:opacity-80 ml-2"
          >
            <span>{announcement.linkText || 'Learn More'}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {announcement.dismissible !== false && (
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-white/10 opacity-70 hover:opacity-100 transition shrink-0"
          title="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
