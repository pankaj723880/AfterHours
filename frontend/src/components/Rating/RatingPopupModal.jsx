import React, { useState, useEffect, useRef } from 'react';
import { Star, X, Sparkles, CheckCircle2, MessageSquare } from 'lucide-react';
import { getApiUrl } from '../../utils/apiUrl';

const ACTIVE_THRESHOLD_SECONDS = 300; // 5 minutes of genuine continuous active usage
const IDLE_TIMEOUT_MS = 60000; // 60 seconds without interaction considered idle

const STAR_LABELS = {
  1: 'Could be better',
  2: 'Fair',
  3: 'Good experience',
  4: 'Great music sanctuary',
  5: 'Exceptional & Love it!'
};

export default function RatingPopupModal({
  user,
  authToken,
  isPlaying = false,
  showToast = null,
  onReviewSubmitted = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasRatedOrDismissed, setHasRatedOrDismissed] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const activeSecondsRef = useRef(0);
  const timerRef = useRef(null);
  const broadcastChannelRef = useRef(null);

  const isAdmin = Boolean(
    user?.role === 'admin' ||
    user?.username === 'admin@afterhours.com' ||
    user?.username === 'pankajsss7238@gmail.com' ||
    user?.username === 'pss809352@gmail.com'
  );

  // Initialize BroadcastChannel to coordinate multi-tab popups
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('loopra_ratings_channel');
        channel.onmessage = (event) => {
          if (event.data?.type === 'RATING_SUBMITTED' || event.data?.type === 'RATING_DISMISSED') {
            setHasRatedOrDismissed(true);
            setIsOpen(false);
          }
        };
        broadcastChannelRef.current = channel;
      } catch (e) {}
    }
    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, []);

  // Fetch initial rating status from backend or localStorage
  useEffect(() => {
    if (isAdmin) {
      setHasRatedOrDismissed(true);
      return;
    }

    // Anonymous check in localStorage
    if (!authToken) {
      try {
        const anonStatus = localStorage.getItem('loopra_anon_rating_status');
        if (anonStatus) {
          const parsed = JSON.parse(anonStatus);
          if (parsed.hasRated || parsed.hasDismissed) {
            setHasRatedOrDismissed(true);
            return;
          }
        }
      } catch (e) {}
    }

    // Authenticated check from backend
    if (authToken) {
      fetch(getApiUrl('/api/reviews/user-status'), {
        headers: { Authorization: `Bearer ${authToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.isAdmin || data.hasRated || data.hasDismissed) {
            setHasRatedOrDismissed(true);
          }
        })
        .catch(() => {});
    }
  }, [authToken, user, isAdmin]);

  // Track genuine continuous active usage (5 minutes)
  useEffect(() => {
    if (hasRatedOrDismissed || isAdmin || isOpen || isSubmitted) return;

    // Load persisted active seconds for anonymous or current session
    try {
      const storedSec = parseInt(localStorage.getItem('loopra_active_usage_seconds') || '0', 10);
      if (!isNaN(storedSec) && storedSec > 0) {
        activeSecondsRef.current = storedSec;
      }
    } catch (e) {}

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', markActive, { passive: true });
    window.addEventListener('keydown', markActive, { passive: true });
    window.addEventListener('click', markActive, { passive: true });
    window.addEventListener('scroll', markActive, { passive: true });
    window.addEventListener('touchstart', markActive, { passive: true });

    timerRef.current = setInterval(() => {
      if (document.hidden) return; // Tab is hidden or minimized: pause

      const now = Date.now();
      const isRecentlyActive = (now - lastActivityRef.current) < IDLE_TIMEOUT_MS;
      const isGenuinelyActive = isRecentlyActive || isPlaying; // Active interaction or listening

      if (isGenuinelyActive) {
        activeSecondsRef.current += 1;
        // Persist accumulated seconds periodically
        if (activeSecondsRef.current % 10 === 0) {
          try {
            localStorage.setItem('loopra_active_usage_seconds', activeSecondsRef.current.toString());
          } catch (e) {}
        }

        if (activeSecondsRef.current >= ACTIVE_THRESHOLD_SECONDS) {
          setIsOpen(true);
          clearInterval(timerRef.current);
        }
      }
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      window.removeEventListener('mousemove', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('click', markActive);
      window.removeEventListener('scroll', markActive);
      window.removeEventListener('touchstart', markActive);
    };
  }, [hasRatedOrDismissed, isAdmin, isOpen, isSubmitted, isPlaying]);

  const handleDismiss = async () => {
    setIsOpen(false);
    setHasRatedOrDismissed(true);

    // Broadcast to other tabs
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'RATING_DISMISSED' });
    }

    // Save anonymous dismissal
    try {
      localStorage.setItem('loopra_anon_rating_status', JSON.stringify({ hasDismissed: true, dismissedAt: Date.now() }));
    } catch (e) {}

    // Save authenticated dismissal to MongoDB
    if (authToken) {
      try {
        await fetch(getApiUrl('/api/reviews/dismiss-popup'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          }
        });
      } catch (e) {}
    }

    if (showToast) showToast('Rating reminder postponed. Enjoy the music!');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (rating < 1 || rating > 5) {
      if (showToast) showToast('Please select a star rating (1 to 5 stars)', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!authToken) {
        // Anonymous fallback storage
        localStorage.setItem('loopra_anon_rating_status', JSON.stringify({
          hasRated: true,
          rating,
          reviewText: reviewText.trim(),
          ratedAt: Date.now()
        }));
        setIsSubmitted(true);
        setHasRatedOrDismissed(true);
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: 'RATING_SUBMITTED' });
        }
        if (showToast) showToast('Thank you for rating Loopra!');
        setTimeout(() => setIsOpen(false), 2000);
        return;
      }

      const res = await fetch(getApiUrl('/api/reviews'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          rating,
          reviewText: reviewText.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit rating');
      }

      setIsSubmitted(true);
      setHasRatedOrDismissed(true);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'RATING_SUBMITTED' });
      }

      if (showToast) showToast('Thank you for rating Loopra!');
      if (onReviewSubmitted) onReviewSubmitted();

      setTimeout(() => {
        setIsOpen(false);
      }, 2000);
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-neutral-900/95 border border-amber-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-amber-500/10 text-white overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-labelledby="rating-title"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          aria-label="Close rating dialog"
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isSubmitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-extrabold text-white">Thank You!</h3>
            <p className="text-xs text-neutral-300 max-w-xs">
              Your rating helps us craft an even richer sonic sanctuary for Bollywood and retro music lovers.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Header Badge & Title */}
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Listener Feedback</span>
              </div>
              <h2 id="rating-title" className="text-2xl font-black text-white tracking-tight">
                Enjoying Loopra?
              </h2>
              <p className="text-xs text-neutral-300 max-w-sm mx-auto leading-relaxed">
                You've been immersed in Loopra for a while! How has your listening experience been?
              </p>
            </div>

            {/* Interactive Stars */}
            <div className="flex flex-col items-center justify-center gap-2 pt-1">
              <div className="flex items-center gap-2 sm:gap-3" role="radiogroup" aria-label="Rating stars">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      className="p-1 sm:p-1.5 rounded-xl transition-all duration-150 transform hover:scale-125 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    >
                      <Star
                        className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
                          isFilled
                            ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                            : 'text-neutral-600 hover:text-neutral-400'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Star Rating Label */}
              <div className="h-5">
                <span className="text-xs font-semibold text-amber-400/90 tracking-wide transition-all">
                  {STAR_LABELS[hoverRating || rating] || 'Tap a star to rate'}
                </span>
              </div>
            </div>

            {/* Optional Review Text Area */}
            <div className="space-y-1.5">
              <label htmlFor="review-text" className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
                  Your Thoughts (Optional)
                </span>
                <span className="text-[10px] text-neutral-400">{reviewText.length}/1000</span>
              </label>
              <textarea
                id="review-text"
                rows={3}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value.slice(0, 1000))}
                placeholder="What do you love most or how can we improve your experience?"
                className="w-full bg-neutral-950/80 border border-neutral-700/80 rounded-2xl p-3 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleDismiss}
                className="flex-1 py-3 px-4 rounded-2xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold transition active:scale-95 cursor-pointer border border-neutral-700/50"
              >
                Maybe Later
              </button>
              <button
                type="submit"
                disabled={rating === 0 || isSubmitting}
                className={`flex-1 py-3 px-4 rounded-2xl font-extrabold text-xs tracking-wide transition active:scale-95 shadow-lg cursor-pointer ${
                  rating === 0 || isSubmitting
                    ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed border border-neutral-700'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 shadow-amber-500/20'
                }`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

