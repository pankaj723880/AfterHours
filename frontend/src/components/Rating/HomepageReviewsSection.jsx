import React, { useState, useEffect, useCallback } from 'react';
import { Star, ChevronLeft, ChevronRight, MessageSquare, Sparkles, UserCheck } from 'lucide-react';
import { getApiUrl } from '../../utils/apiUrl';

export default function HomepageReviewsSection({ refreshTrigger = 0, onOpenRatingModal = null }) {
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReviewsCount, setTotalReviewsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);

  // Coordinated data fetching to eliminate race conditions between summary & reviews
  const loadRatingsAndReviews = useCallback(async (page = 1) => {
    if (page === 1) setIsLoading(true);
    setIsReviewsLoading(true);

    try {
      // 1. Fetch summary with cache buster
      const summaryRes = await fetch(getApiUrl(`/api/reviews/summary?_t=${Date.now()}`), {
        cache: 'no-store'
      });
      let freshSummary = null;
      if (summaryRes.ok) {
        freshSummary = await summaryRes.json();
        setSummary(freshSummary);
      }

      // 2. Determine mode directly from fresh summary
      const isConfigured = Boolean(freshSummary?.editorialSummary?.enabled);
      const sourceQuery = isConfigured ? 'editorial' : 'user';

      // 3. Fetch strictly corresponding reviews (strictly isolated, no fallback)
      const reviewsRes = await fetch(
        getApiUrl(`/api/reviews?page=${page}&limit=5&source=${sourceQuery}&_t=${Date.now()}`),
        { cache: 'no-store' }
      );

      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        setReviews(reviewsData.reviews || []);
        setCurrentPage(reviewsData.page || 1);
        setTotalPages(reviewsData.totalPages || 1);
        setTotalReviewsCount(reviewsData.totalReviews || 0);
      } else {
        setReviews([]);
        setCurrentPage(1);
        setTotalPages(1);
        setTotalReviewsCount(0);
      }
    } catch (e) {
      console.warn('[HomepageReviews] Load failed:', e.message);
    } finally {
      setIsLoading(false);
      setIsReviewsLoading(false);
    }
  }, []);

  // Fetch reviews for a specific page without refetching summary
  const handlePageChange = useCallback(async (newPage) => {
    if (newPage < 1 || isReviewsLoading) return;
    setIsReviewsLoading(true);

    try {
      const isConfigured = Boolean(summary?.editorialSummary?.enabled);
      const sourceQuery = isConfigured ? 'editorial' : 'user';

      const reviewsRes = await fetch(
        getApiUrl(`/api/reviews?page=${newPage}&limit=5&source=${sourceQuery}&_t=${Date.now()}`),
        { cache: 'no-store' }
      );

      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        setReviews(reviewsData.reviews || []);
        setCurrentPage(reviewsData.page || newPage);
        setTotalPages(reviewsData.totalPages || 1);
        setTotalReviewsCount(reviewsData.totalReviews || 0);
      }
    } catch (e) {
      console.warn('[HomepageReviews] Page change error:', e.message);
    } finally {
      setIsReviewsLoading(false);
    }
  }, [summary?.editorialSummary?.enabled, isReviewsLoading]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  useEffect(() => {
    loadRatingsAndReviews(1);
  }, [loadRatingsAndReviews, refreshTrigger]);

  const isConfigured = Boolean(summary?.editorialSummary?.enabled);
  const editorial = summary?.editorialSummary;

  const activeRating = isConfigured 
    ? (Number(editorial?.displayRating) || 0.0) 
    : (Number(summary?.averageRating) || 0.0);

  const activeTotal = isConfigured 
    ? (Number(editorial?.displayCount) || 0) 
    : (Number(summary?.totalRatings) || 0);

  const activeDistribution = isConfigured 
    ? (editorial?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }) 
    : (summary?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  const activeBadge = isConfigured 
    ? (editorial?.editorialLabel || 'Curated Editorial Highlights') 
    : 'Listener Community';

  const formatRatingDisplay = (val) => {
    if (!val || val <= 0) return '0.0';
    const num = Number(val);
    if (Number.isInteger(num)) return `${num}.0`;
    const str = num.toString();
    const decimalParts = str.split('.')[1] || '';
    if (decimalParts.length === 1) return num.toFixed(1);
    return num.toFixed(2);
  };

  const formatDate = (dateString) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <section className="w-full mt-10 mb-8 pt-8 pb-6 border-t border-neutral-800/80">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/25 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_#f59e0b]" />
              <span>{activeBadge}</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
              Ratings & Reviews
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl leading-relaxed">
              {isConfigured
                ? 'Curated listener ratings, impressions, and highlights selected by our editorial team.'
                : 'Authentic listening impressions and ratings from our passionate community of music enthusiasts.'}
            </p>

            {/* Direct Rate & Review CTAs */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenRatingModal?.('rate')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs tracking-wide transition shadow-md active:scale-95 cursor-pointer"
              >
                <Star className="w-3.5 h-3.5 fill-neutral-950" />
                <span>Rate Loopra</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenRatingModal?.('review')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white hover:text-amber-300 border border-neutral-700/80 font-semibold text-xs transition active:scale-95 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Write a Review</span>
              </button>
            </div>
          </div>

          {/* Compact Mobile & Desktop Score Box */}
          <div className="self-start sm:self-center bg-neutral-900/90 border border-neutral-800/90 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center min-w-[125px] shadow-lg shrink-0">
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-baseline gap-1">
              <span>{formatRatingDisplay(activeRating || 5.0)}</span>
              <span className="text-sm sm:text-base text-neutral-400 font-semibold">/5</span>
            </div>
            
            {/* 5 Stars */}
            <div className="flex items-center gap-1 text-amber-400 my-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-3.5 h-3.5 ${
                    (activeRating || 5) >= star
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-neutral-700'
                  }`}
                />
              ))}
            </div>

            <p className="text-[10px] text-neutral-400 font-medium">
              {activeTotal > 0 ? `${activeTotal.toLocaleString()} genuine rating${activeTotal !== 1 ? 's' : ''}` : '1 genuine rating'}
            </p>
          </div>
        </div>

        {/* Written Reviews Wall */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>{isConfigured ? 'Curated Reviews' : 'Listener Reviews'}</span>
              <span className="text-xs text-neutral-400 font-mono">
                ({totalReviewsCount > 0 ? totalReviewsCount : (reviews.length > 0 ? reviews.length : 1)})
              </span>
            </h3>
          </div>

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-4 flex flex-col gap-2.5 transition">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-amber-900/60 border border-amber-600/40 flex items-center justify-center text-amber-200 text-xs font-bold uppercase shrink-0">
                    P
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                      <span>Pankaj Singh</span>
                      <svg className="w-3.5 h-3.5 text-blue-400 fill-current shrink-0" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </h4>
                    <span className="text-[10px] text-neutral-400 block font-mono">
                      Oct 31, 2026
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 text-amber-400 shrink-0">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed break-words font-medium">
                "Better than most of the music players this time"
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {reviews.map((rev) => (
                <div
                  key={rev._id || rev.id}
                  className="bg-neutral-900/70 border border-neutral-800/80 hover:border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between gap-2.5 transition group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-amber-900/60 border border-amber-600/40 flex items-center justify-center text-amber-200 text-xs font-bold uppercase shrink-0">
                          {rev.displayName ? rev.displayName.charAt(0) : 'U'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            <span>{rev.displayName || rev.username || 'Listener'}</span>
                            <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" title="Verified Listener" />
                          </h4>
                          <span className="text-[10px] text-neutral-400 block font-mono">
                            {formatDate(rev.submittedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-0.5 text-amber-400 shrink-0">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              rev.rating >= s
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-neutral-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed break-words line-clamp-4 font-medium">
                      "{rev.reviewText}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
