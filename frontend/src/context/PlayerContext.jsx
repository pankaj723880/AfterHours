import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { safeGet, safeSet, STORAGE_KEYS } from '../utils/storage';
import { sanitizeErrorMessage } from '../utils/errorHandler';

const PlayerContext = createContext();

// Fisher-Yates non-mutating shuffle algorithm
const fisherYatesShuffle = (arr) => {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export const PlayerProvider = ({ children }) => {
  // Load initial player state safely from local storage preferences
  const initialPrefs = safeGet(STORAGE_KEYS.PREFERENCES, {}) || {};

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffledQueue, setShuffledQueue] = useState([]);
  const [shuffleIndex, setShuffleIndex] = useState(0);
  const [isShuffle, setIsShuffle] = useState(Boolean(initialPrefs.isShuffle));
  const [repeatMode, setRepeatMode] = useState(initialPrefs.repeatMode || 'off'); // 'off' | 'all' | 'one'
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);
  
  // Sound Customizer State
  const [soundProfile, setSoundProfile] = useState(initialPrefs.soundProfile || 'flat'); // 'hall', 'theatre', 'flat'

  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const convolverRef = useRef(null);
  const eqNodesRef = useRef(null);

  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
  }

  // Current track selector based on shuffle mode
  const currentTrack = isShuffle 
    ? shuffledQueue[shuffleIndex] 
    : queue[currentIndex];

  // Sync preferences to localStorage when repeat or shuffle changes
  useEffect(() => {
    const currentPrefs = safeGet(STORAGE_KEYS.PREFERENCES, {}) || {};
    safeSet(STORAGE_KEYS.PREFERENCES, {
      ...currentPrefs,
      isShuffle,
      repeatMode,
      soundProfile
    });
  }, [isShuffle, repeatMode, soundProfile]);

  // Record successfully played tracks into historical storage
  useEffect(() => {
    if (currentTrack && isPlaying) {
      const history = safeGet(STORAGE_KEYS.HISTORY, []) || [];
      const updatedHistory = [...history.filter((t) => t.id !== currentTrack.id), currentTrack];
      safeSet(STORAGE_KEYS.HISTORY, updatedHistory);
    }
  }, [currentTrack, isPlaying]);

  // Helper to build a shuffled array keeping the current song at index 0
  const buildShuffledOrder = (fullQueue, currentTrackToKeep) => {
    if (!fullQueue || fullQueue.length <= 1) return [...fullQueue];
    
    const remainingTracks = fullQueue.filter((track) => track.id !== currentTrackToKeep?.id);
    const shuffledRemaining = fisherYatesShuffle(remainingTracks);
    
    return currentTrackToKeep ? [currentTrackToKeep, ...shuffledRemaining] : shuffledRemaining;
  };

  // Toggle Shuffle
  const toggleShuffle = () => {
    if (queue.length === 0) {
      setIsShuffle(!isShuffle);
      return;
    }

    if (!isShuffle) {
      const newShuffled = buildShuffledOrder(queue, currentTrack);
      setShuffledQueue(newShuffled);
      setShuffleIndex(0);
      setIsShuffle(true);
    } else {
      const normalIdx = queue.findIndex((t) => t.id === currentTrack?.id);
      if (normalIdx !== -1) {
        setCurrentIndex(normalIdx);
      }
      setIsShuffle(false);
    }
  };

  // Toggle Repeat Mode ('off' -> 'all' -> 'one')
  const toggleRepeat = () => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  };

  // Next Song Handler
  const handleNext = useCallback(() => {
    if (queue.length === 0) return;

    if (repeatMode === 'one') {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => handlePlaybackError(err));
      return;
    }

    if (isShuffle) {
      if (shuffleIndex < shuffledQueue.length - 1) {
        setShuffleIndex((prev) => prev + 1);
      } else if (repeatMode === 'all') {
        const remaining = shuffledQueue.slice(0, shuffledQueue.length - 1);
        const reshuffled = [shuffledQueue[shuffleIndex], ...fisherYatesShuffle(remaining)];
        if (reshuffled.length > 1) {
          const last = reshuffled.shift();
          reshuffled.push(last);
        }
        setShuffledQueue(reshuffled);
        setShuffleIndex(0);
      } else {
        setIsPlaying(false);
      }
    } else {
      if (currentIndex < queue.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else if (repeatMode === 'all') {
        setCurrentIndex(0);
      } else {
        setIsPlaying(false);
      }
    }
  }, [queue.length, repeatMode, isShuffle, shuffleIndex, shuffledQueue, currentIndex]);

  // Handle stream decoding or audio loading errors gracefully
  const handlePlaybackError = useCallback((errorEvent) => {
    const sanitized = sanitizeErrorMessage(errorEvent);
    setPlaybackError(sanitized.message);

    // Auto-skip to next track on unplayable stream or error to preserve playback flow
    if (queue.length > 1) {
      handleNext();
    } else {
      setIsPlaying(false);
    }
  }, [queue.length, handleNext]);

  // Previous Song Handler
  const handlePrevious = () => {
    if (queue.length === 0) return;

    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (isShuffle) {
      if (shuffleIndex > 0) {
        setShuffleIndex((prev) => prev - 1);
      } else if (repeatMode === 'all') {
        setShuffleIndex(shuffledQueue.length - 1);
      }
    } else {
      if (currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      } else if (repeatMode === 'all') {
        setCurrentIndex(queue.length - 1);
      }
    }
  };

  // Add Song(s) to Queue dynamically
  const addToQueue = (newTracks) => {
    const tracksToAdd = Array.isArray(newTracks) ? newTracks : [newTracks];
    setQueue((prev) => [...prev, ...tracksToAdd]);

    if (isShuffle) {
      const unplayedShuffled = fisherYatesShuffle(tracksToAdd);
      setShuffledQueue((prev) => [
        ...prev.slice(0, shuffleIndex + 1),
        ...unplayedShuffled,
        ...prev.slice(shuffleIndex + 1),
      ]);
    }
  };

  // Synchronize dynamic updates to full queue
  const updateQueue = (newQueue, startIdx = 0) => {
    setQueue(newQueue);
    setCurrentIndex(startIdx);
    if (isShuffle) {
      const selectedTrack = newQueue[startIdx];
      const reshuffled = buildShuffledOrder(newQueue, selectedTrack);
      setShuffledQueue(reshuffled);
      setShuffleIndex(0);
    }
  };

  // Handle source updating and playing
  useEffect(() => {
    if (currentTrack) {
      const audio = audioRef.current;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      audio.src = `${backendUrl}/api/stream/${currentTrack.id}`;
      
      if (isPlaying) {
        audio.play().catch(e => handlePlaybackError(e));
      }
    }
  }, [currentTrack]);

  // Load IR for Reverb
  const fetchImpulseResponse = async (type) => {
    if (!audioContextRef.current) return null;
    const ctx = audioContextRef.current;
    
    let duration = 0.5;
    let decay = 2.0;
    
    if (type === 'hall') {
      duration = 2.5;
      decay = 2.0;
    } else if (type === 'theatre') {
      duration = 1.0;
      decay = 4.0;
    } else {
      return null;
    }

    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    
    for (let i = 0; i < 2; i++) {
      const channel = impulse.getChannelData(i);
      for (let j = 0; j < length; j++) {
        channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
      }
    }
    return impulse;
  };

  // Audio Context and Effects setup
  useEffect(() => {
    const applyProfile = async () => {
      if (!audioContextRef.current) return;
      const ctx = audioContextRef.current;

      if (!convolverRef.current) {
        convolverRef.current = ctx.createConvolver();
      }
      
      // Create EQ nodes
      if (!eqNodesRef.current) {
        const bands = [60, 230, 910, 3600, 14000];
        eqNodesRef.current = bands.map(freq => {
          const filter = ctx.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = freq;
          filter.Q.value = 1;
          filter.gain.value = 0;
          return filter;
        });
      }

      // Configure EQ and Reverb based on profile
      let ir = null;
      const eq = eqNodesRef.current;
      
      // Reset EQ
      eq.forEach(node => node.gain.value = 0);

      if (soundProfile === 'hall') {
        ir = await fetchImpulseResponse('hall');
        eq[0].gain.value = 4; // bass
        eq[4].gain.value = 5; // treble
      } else if (soundProfile === 'theatre') {
        ir = await fetchImpulseResponse('theatre');
        eq[1].gain.value = 3; // low-mid
        eq[2].gain.value = 3; // mid
      }
      
      convolverRef.current.buffer = ir;
      
      // Disconnect existing graph
      if (sourceNodeRef.current) {
         sourceNodeRef.current.disconnect();
      }
      if (eqNodesRef.current) {
        eqNodesRef.current.forEach(node => node.disconnect());
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
      }
      if (convolverRef.current) {
        convolverRef.current.disconnect();
      }

      // Re-connect graph
      let currentNode = sourceNodeRef.current;
      if (currentNode) {
         // Connect through EQ
         eq.forEach(node => {
           currentNode.connect(node);
           currentNode = node;
         });
         
         if (ir) {
           currentNode.connect(convolverRef.current);
           currentNode = convolverRef.current;
         }
         
         if (!gainNodeRef.current) {
            gainNodeRef.current = ctx.createGain();
         }
         gainNodeRef.current.gain.value = 1;
         
         currentNode.connect(gainNodeRef.current);
         gainNodeRef.current.connect(ctx.destination);
      }
    };
    
    applyProfile();
  }, [soundProfile]);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      gainNodeRef.current = audioContextRef.current.createGain();
      sourceNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);
      
      // Trigger effect application
      setSoundProfile(prev => {
        setSoundProfile('temp');
        setTimeout(() => setSoundProfile(prev), 10);
        return prev;
      });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const togglePlay = () => {
    initAudioContext();
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(handlePlaybackError);
    }
    setIsPlaying(!isPlaying);
  };

  const updateQueueWithPlay = (newQueue, startIdx = 0) => {
    initAudioContext();
    updateQueue(newQueue, startIdx);
    setIsPlaying(true);
  };

  // Bind audio element lifecycle and error handlers
  useEffect(() => {
    const audio = audioRef.current;
    
    const onEnded = () => handleNext();
    const onError = (e) => handlePlaybackError(e);

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [handleNext, handlePlaybackError]);

  return (
    <PlayerContext.Provider
      value={{
        queue,
        currentTrack,
        isPlaying,
        isShuffle,
        repeatMode,
        playbackError,
        toggleShuffle,
        toggleRepeat,
        togglePlay,
        handleNext,
        handlePrevious,
        addToQueue,
        updateQueue: updateQueueWithPlay,
        soundProfile,
        setSoundProfile,
        audioRef,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);