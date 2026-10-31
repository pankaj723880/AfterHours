import React, { useState, useEffect } from 'react';

export default function SimilarSongsModal({
  isOpen,
  onClose,
  track,
  onPlaySong,
  onAddToQueue,
  showToast
}) {
  const [loading, setLoading] = useState(false);
  const [similarTracks, setSimilarTracks] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !track) {
      setSimilarTracks([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const trackId = track.id || track.videoId || '';
    const title = track.title || '';
    const artist = track.artist || track.channel || '';

    const params = new URLSearchParams({
      trackId,
      title,
      artist
    });

    fetch(`/api/recommendations/similar?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.items) {
          setSimilarTracks(data.items);
        } else {
          setSimilarTracks([]);
        }
      })
      .catch(err => {
        console.warn('[SimilarSongsModal Error]:', err.message);
        setError('Could not fetch similar tracks right now.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, track]);

  if (!isOpen || !track) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            {track.thumbnail && (
              <img
                src={track.thumbnail}
                alt={track.title}
                className="w-10 h-10 rounded-xl object-cover border border-neutral-700/60 shrink-0"
              />
            )}
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider">Similar Songs Finder</span>
              <h3 className="font-bold text-sm sm:text-base text-white truncate">{track.title}</h3>
              <p className="text-[11px] text-neutral-400 truncate">{track.artist || track.channel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer shrink-0"
            aria-label="Close Similar Songs Modal"
          >
            ✕
          </button>
        </div>

        {/* List of Similar Tracks */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-neutral-400">
              <span className="animate-spin text-2xl text-amber-500">✨</span>
              <p className="text-xs">Finding songs with similar acoustic vibe & genre...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 text-center">
              {error}
            </div>
          ) : similarTracks.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-xs">
              <p>No similar tracks found for this title.</p>
            </div>
          ) : (
            similarTracks.map((item, idx) => (
              <div
                key={item.id || item.videoId || idx}
                className="p-2.5 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 hover:border-amber-500/40 flex items-center justify-between gap-3 transition group"
              >
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => {
                    if (onPlaySong) onPlaySong(item);
                    onClose();
                  }}
                >
                  <img
                    src={item.thumbnail || `https://i.ytimg.com/vi/${item.id || item.videoId}/hqdefault.jpg`}
                    alt={item.title}
                    className="w-10 h-10 rounded-xl object-cover shrink-0 border border-neutral-800"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white group-hover:text-amber-300 transition truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate">{item.artist || item.channel}</p>
                    {item.reason && (
                      <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {item.reason}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      if (onPlaySong) onPlaySong(item);
                      onClose();
                    }}
                    className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-neutral-950 transition text-xs font-bold"
                    title="Play track"
                    aria-label={`Play ${item.title}`}
                  >
                    ▶
                  </button>
                  {onAddToQueue && (
                    <button
                      onClick={() => {
                        onAddToQueue(item);
                        if (showToast) showToast('Added to queue');
                      }}
                      className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition text-xs"
                      title="Add to queue"
                      aria-label={`Add ${item.title} to queue`}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

