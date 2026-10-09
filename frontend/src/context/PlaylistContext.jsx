import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'afterhours_playlists';
const PlaylistContext = createContext();

export function PlaylistProvider({ children }) {
  const [playlists, setPlaylists] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error loading playlists from localStorage:', error);
      return [];
    }
  });

  // Persist playlists to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    } catch (error) {
      console.error('Error saving playlists to localStorage:', error);
    }
  }, [playlists]);

  const createPlaylist = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const newPlaylist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: trimmed,
      createdAt: new Date().toISOString(),
      songs: []
    };

    setPlaylists((prev) => [newPlaylist, ...prev]);
    return newPlaylist;
  };

  const deletePlaylist = (playlistId) => {
    setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
  };

  const addToPlaylist = (playlistId, song) => {
    let added = false;
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;

        const songId = song.id || song._id;
        const exists = pl.songs.some((s) => (s.id || s._id) === songId);
        if (exists) return pl;

        added = true;
        return {
          ...pl,
          songs: [...pl.songs, song]
        };
      })
    );
    return added;
  };

  const removeFromPlaylist = (playlistId, songId) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        return {
          ...pl,
          songs: pl.songs.filter((s) => (s.id || s._id) !== songId)
        };
      })
    );
  };

  return (
    <PlaylistContext.Provider
      value={{
        playlists,
        createPlaylist,
        deletePlaylist,
        addToPlaylist,
        removeFromPlaylist
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
}

export const usePlaylists = () => useContext(PlaylistContext);