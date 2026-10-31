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
    <section className="w-full mt-16 mb-8 pt-10 pb-6 border-t border-neutral-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 space-y-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isConfigured 
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300' 
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
            }`}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{activeBadge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Ratings & Reviews
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl">
              {isConfigured
                ? 'Curated listener ratings, impressions, and highlights selected by our editorial team.'
                : 'Authentic listening impressions and ratings from our passionate community of music enthusiasts.'}
            </p>
          </div>

          {/* Header Actions: Editorial Badge + Direct Rate & Review CTAs */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {isConfigured && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-neutral-900/80 border border-amber-500/30 text-[11px] text-neutral-300 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-neutral-400">{activeBadge}:</span>
                <span className="font-extrabold text-amber-400">{formatRatingDisplay(activeRating)} ★</span>
                <span className="text-neutral-400">({activeTotal.toLocaleString()})</span>
              </div>
            )}

            {/* Prominent "Rate Loopra" Primary CTA */}
            <button
              type="button"
              onClick={() => onOpenRatingModal?.('rate')}
              className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-xs tracking-wide transition shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              <Star className="w-4 h-4 fill-neutral-950" />
              <span>Rate Loopra</span>
            </button>

            {/* Secondary "Write a Review" Option */}
            <button
              type="button"
              onClick={() => onOpenRatingModal?.('review')}
              className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 text-white hover:text-amber-300 border border-neutral-700/80 font-bold text-xs transition active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span>Write a Review</span>
            </button>
          </div>
        </div>

        {/* Top Summary & Distribution Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
          
          {/* Average Rating Hero Card */}
          <div className="md:col-span-5 flex flex-col justify-center items-center md:items-start text-center md:text-left space-y-3 md:border-r border-neutral-800/80 md:pr-8">
            <div className="text-5xl sm:text-6xl font-black text-white tracking-tight flex items-baseline gap-2">
              <span title={`Weighted Average: ${activeRating}`}>{formatRatingDisplay(activeRating)}</span>
              <span className="text-2xl text-neutral-400 font-semibold">/ 5</span>
            </div>
            
            {/* Stars rendering */}
            <div className="flex items-center gap-1.5 text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    activeRating >= star
                      ? 'fill-amber-400 text-amber-400'
                      : activeRating >= star - 0.5
                      ? 'fill-amber-400/50 text-amber-400'
                      : 'text-neutral-700'
                  }`}
                />
              ))}
            </div>

            <p className="text-xs text-neutral-400 font-medium">
              Based on <span className="font-bold text-white">{activeTotal.toLocaleString()}</span> {isConfigured ? 'curated' : 'genuine'} listener rating{activeTotal !== 1 ? 's' : ''}
              {activeRating > 0 && (
                <span className="ml-1 text-neutral-500 font-mono">
                  ({activeRating.toFixed(4).replace(/\.?0+$/, '')} avg)
                </span>
              )}
            </p>

            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenRatingModal?.('rate')}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline underline-offset-4 cursor-pointer transition"
              >
                Rate Loopra
              </button>
              <span className="text-neutral-600">•</span>
              <button
                type="button"
                onClick={() => onOpenRatingModal?.('review')}
                className="text-[11px] font-medium text-neutral-400 hover:text-white cursor-pointer transition"
              >
                Write a review
              </button>
            </div>
          </div>

          {/* Rating Distribution Bars */}
          <div className="md:col-span-7 flex flex-col justify-center space-y-2.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = Number(activeDistribution[star] ?? activeDistribution[`count${star}`] ?? 0);
              const percent = activeTotal > 0 ? (count / activeTotal) * 100 : 0;
              const roundedPercent = Math.round(percent);
              return (
                <div key={star} className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 w-12 text-neutral-400 shrink-0 font-semibold">
                    <span>{star}</span>
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  </div>
                  <div className="flex-1 h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800/80">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-neutral-400 font-mono text-[11px] shrink-0 flex items-center justify-end gap-1.5">
                    <span className="text-neutral-300 font-semibold">{count}</span>
                    <span className="text-neutral-500">({roundedPercent}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Written Reviews Wall */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span>{isConfigured ? 'Curated Reviews' : 'Listener Reviews'}</span>
              {totalReviewsCount > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                  {totalReviewsCount}
                </span>
              )}
            </h3>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenRatingModal?.('review')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 text-neutral-300 hover:text-amber-300 text-xs font-semibold transition cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Write a Review</span>
              </button>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-neutral-400 mr-1 font-mono">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={handlePrevPage}
                    disabled={currentPage <= 1 || isReviewsLoading}
                    aria-label="Previous reviews page"
                    className="p-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages || isReviewsLoading}
                    aria-label="Next reviews page"
                    className="p-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <div className="p-8 rounded-3xl bg-neutral-900/30 border border-neutral-800/80 text-center space-y-2">
              <p className="text-sm font-semibold text-neutral-300">
                {isConfigured ? 'No configured reviews published yet' : 'No written reviews yet'}
              </p>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                {isConfigured 
                  ? 'Configured reviews published by the editorial team in the Admin Dashboard will appear here.'
                  : 'Be among the first listeners to share your review after experiencing Loopra\'s music sanctuary.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.map((rev) => (
                <div
                  key={rev._id || rev.id}
                  className="bg-neutral-900/60 border border-neutral-800/80 hover:border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 transition group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500/20 to-amber-600/30 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black uppercase shrink-0">
                          {rev.displayName ? rev.displayName.charAt(0) : 'U'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            {rev.displayName || rev.username || 'Listener'}
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

                    <p className="text-xs text-neutral-300 leading-relaxed break-words line-clamp-4">
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
