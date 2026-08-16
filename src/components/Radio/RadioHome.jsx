import React, { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { safeGet, safeSet, STORAGE_KEYS, CACHE_TTL_MS } from '../../utils/storage';
import { sanitizeErrorMessage } from '../../utils/errorHandler';

export const RadioHome = () => {
  const { updateQueue } = usePlayer();
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);

  const fetchStationTracks = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setErrorInfo(null);

    // 1. Check local cache first unless force refreshed
    if (!forceRefresh) {
      const cached = safeGet(STORAGE_KEYS.STATION_CACHE);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        updateQueue(cached, 0);
        setLoading(false);
        return;
      }
    }

    try {
      // Replace with your actual station fetch API endpoint/function
      const response = await fetch('/api/station/live-stream'); 
      if (!response.ok) {
        throw { status: response.status, message: 'Failed to fetch radio tracks' };
      }

      const tracks = await response.json();

      if (!tracks || tracks.length === 0) {
        throw new Error('No tracks returned for this station');
      }

      // Save valid tracks to temporary cache with 24-hr TTL
      safeSet(STORAGE_KEYS.STATION_CACHE, tracks, { ttl: CACHE_TTL_MS });

      // Update PlayerContext queue
      updateQueue(tracks, 0);
      setLoading(false);
    } catch (err) {
      console.error('[RadioHome] Track load error:', err);
      const sanitized = sanitizeErrorMessage(err);
      setErrorInfo(sanitized);
      setLoading(false);
    }
  }, [updateQueue]);

  useEffect(() => {
    fetchStationTracks();
  }, [fetchStationTracks]);

  return (
    <div className="radio-container">
      {loading && (
        <div className="flex items-center gap-2 text-yellow-400">
          <span className="spinner animate-spin">✦</span>
          <span>Fetching station music tracks...</span>
        </div>
      )}

      {!loading && errorInfo && (
        <div className="error-banner bg-red-900/40 p-4 rounded-lg border border-red-500/30">
          <p className="text-red-200 text-sm mb-2">{errorInfo.message}</p>
          {errorInfo.retryable && (
            <button
              onClick={() => fetchStationTracks(true)}
              className="px-3 py-1 bg-yellow-500 text-black text-xs font-semibold rounded hover:bg-yellow-400 transition"
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
};