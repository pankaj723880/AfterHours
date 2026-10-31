import React, { useRef, useState, useEffect } from 'react';
import { Play, Sparkles, ChevronLeft, ChevronRight, ListMusic, Loader2 } from 'lucide-react';

export default function CmsCuratedCollectionsRow({ 
  collections: initialCollections, 
  backendUrl, 
  title = "Curated Featured Collections",
  subtitle = "Handpicked mixes, nostalgia sets, and soundtracks curated by our editors",
  onPlayTrack,
  onPlayCollection, 
  onSelectCollection 
}) {
  const [collections, setCollections] = useState(initialCollections || []);
  const [loading, setLoading] = useState(!initialCollections || initialCollections.length === 0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (initialCollections && initialCollections.length > 0) {
      setCollections(initialCollections);
      setLoading(false);
      return;
    }

    if (backendUrl) {
      let isSubscribed = true;
      const cleanUrl = backendUrl.replace(/\/$/, '');
      fetch(`${cleanUrl}/api/cms/curated`)
        .then(res => res.json())
        .then(data => {
          if (isSubscribed && data.collections) {
            setCollections(data.collections);
          }
        })
        .catch(err => {
          console.warn('[CMS Collections Row Notice]:', err.message);
        })
        .finally(() => {
          if (isSubscribed) setLoading(false);
        });

      return () => { isSubscribed = false; };
    } else {
      setLoading(false);
    }
  }, [backendUrl, initialCollections]);

  if (!loading && (!Array.isArray(collections) || collections.length === 0)) {
    return null;
  }

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.75;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleCollectionClick = async (col) => {
    if (onPlayCollection) {
      onPlayCollection(col);
      return;
    }

    if (onPlayTrack && backendUrl) {
      try {
        const cleanUrl = backendUrl.replace(/\/$/, '');
        const res = await fetch(`${cleanUrl}/api/cms/curated/${col.slug || col.id}`);
        const data = await res.json();
        if (data.tracks && data.tracks.length > 0) {
          const firstTrack = data.tracks[0];
          onPlayTrack(firstTrack, data.tracks);
        }
      } catch (err) {
        console.error('[CMS Collection Play error]:', err.message);
      }
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">
      {/* Row Header */}
      <div className="flex items-end justify-between">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <h2 className="text-base sm:text-lg md:text-xl font-display font-extrabold text-white tracking-tight truncate">
              {title}
            </h2>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5 sm:mt-1 line-clamp-1">
            {subtitle}
          </p>
        </div>

        {/* Scroll Arrows */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition"
            title="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition"
            title="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-3 sm:pb-4 scrollbar-none snap-x snap-mandatory w-full min-w-0"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {collections.map((col) => {
          const firstTrack = col.tracks?.[0];
          const firstTrackId = firstTrack?.videoId || firstTrack?.id;
          const coverImage = col.coverArt || (firstTrackId ? `https://i.ytimg.com/vi/${firstTrackId}/hqdefault.jpg` : '');
          if (!coverImage) return null;

          return (
            <div
              key={col.id || col.slug}
              onClick={() => handleCollectionClick(col)}
              className="group snap-start shrink-0 w-36 sm:w-52 p-2.5 sm:p-3.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 transition-all duration-300 cursor-pointer shadow-lg backdrop-blur-md flex flex-col justify-between"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-neutral-950">
                <img
                  src={coverImage}
                  alt={col.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    const target = e.currentTarget;
                    const card = target.closest('.group');
                    if (card) card.style.display = 'none';
                  }}
                />
                <span className="absolute top-2 left-2 text-[9px] uppercase font-bold text-amber-300 bg-neutral-950/80 backdrop-blur-md border border-amber-500/20 px-2 py-0.5 rounded-full">
                  {col.category}
                </span>

                {/* Play button overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-500/30 transform scale-90 group-hover:scale-100 transition">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-400 transition">
                  {col.name}
                </h3>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                  {col.tracksCount || col.tracks?.length || 0} tracks • {col.description || 'Curated mix'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
