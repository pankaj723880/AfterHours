import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { listeningStatsService } from '../../services/listeningStatsService';

export default function ListeningStatsModal({
  isOpen,
  onClose,
  showToast,
  authToken = null,
  user = null,
  backendUrl = '',
  onPlaySong = null,
  currentSong = null,
  isPlaying = false
}) {
  const [activeTab, setActiveTab] = useState('recap'); // 'recap' | 'all-time'
  const [stats, setStats] = useState(null);
  const [weeklyRecap, setWeeklyRecap] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activityMetric, setActivityMetric] = useState('hours'); // 'hours' | 'plays'
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [shareDataUrl, setShareDataUrl] = useState(null);

  const canvasRef = useRef(null);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const loadStats = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const data = await listeningStatsService.fetchStats({
        backendUrl,
        token: authToken,
        user,
        forceRefresh: force
      });

      if (data) {
        setWeeklyRecap(data.weeklyRecap || null);
        setStats(data.allTimeStats || null);
        setLastUpdated(data.updatedAt ? new Date(data.updatedAt) : new Date());
      }
    } catch (err) {
      console.warn('[ListeningStatsModal] Refresh notice:', err.message);
      setErrorMessage('Could not refresh latest stats. Showing saved records.');
      if (showToast) showToast('Could not refresh stats right now');
    } finally {
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [backendUrl, authToken, user, showToast]);

  useEffect(() => {
    if (!isOpen) {
      hasLoadedRef.current = false;
      return;
    }

    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    // Instant paint from local cache
    const local = listeningStatsService.computeLocalStats(user);
    if (local) {
      if (local.weeklyRecap) setWeeklyRecap(local.weeklyRecap);
      if (local.allTimeStats) setStats(local.allTimeStats);
      if (local.updatedAt) setLastUpdated(new Date(local.updatedAt));
    }

    loadStats(false);
  }, [isOpen, loadStats, user]);

  const handleManualRefresh = () => {
    if (isRefreshing) return;
    loadStats(true);
  };

  const handleTrackPlayClick = (track, e) => {
    if (e) e.stopPropagation();
    if (!track) return;
    if (onPlaySong) {
      onPlaySong({
        id: track.id || track.videoId,
        videoId: track.videoId || track.id,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        image: track.thumbnail
      });
      if (showToast) showToast(`Playing ${track.title}`);
    }
  };

  // Generate 9:16 Instagram Story Canvas
  const generateShareCard = () => {
    setIsGeneratingShare(true);
    setIsShareModalOpen(true);

    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        setIsGeneratingShare(false);
        return;
      }

      const ctx = canvas.getContext('2d');
      const W = 1080;
      const H = 1920;
      canvas.width = W;
      canvas.height = H;

      // 1. Dark Gradient Background
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, '#0c0d14');
      bgGrad.addColorStop(0.4, '#12131c');
      bgGrad.addColorStop(0.8, '#18120b');
      bgGrad.addColorStop(1, '#090a0f');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Gold Glow Orbs
      const glow1 = ctx.createRadialGradient(W * 0.8, H * 0.2, 10, W * 0.8, H * 0.2, 500);
      glow1.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
      glow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, W, H);

      const glow2 = ctx.createRadialGradient(W * 0.2, H * 0.7, 10, W * 0.2, H * 0.7, 450);
      glow2.addColorStop(0, 'rgba(234, 88, 12, 0.2)');
      glow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, W, H);

      // 2. Loopra Branding Header
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 44px Outfit, Inter, sans-serif';
      ctx.fillText('LOOPRA', 90, 140);

      ctx.fillStyle = '#a3a3a3';
      ctx.font = '600 30px Inter, sans-serif';
      ctx.fillText('WEEKLY RECAP', 90, 185);

      // 3. Hero Header
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 84px Outfit, Inter, sans-serif';
      ctx.fillText('Your Week', 90, 310);
      const inMusicGrad = ctx.createLinearGradient(90, 390, 450, 390);
      inMusicGrad.addColorStop(0, '#f59e0b');
      inMusicGrad.addColorStop(1, '#ea580c');
      ctx.fillStyle = inMusicGrad;
      ctx.fillText('in Music', 90, 395);

      ctx.fillStyle = '#d4d4d8';
      ctx.font = '400 32px Inter, sans-serif';
      ctx.fillText('Genuine beats and memories from your Loopra sessions.', 90, 450);

      // 4. Stat Badges Grid (2x2)
      const renderStatBox = (x, y, w, h, label, val, sub) => {
        ctx.fillStyle = 'rgba(24, 24, 27, 0.7)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 28);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#a1a1aa';
        ctx.font = '600 24px Inter, sans-serif';
        ctx.fillText(label.toUpperCase(), x + 40, y + 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 64px Outfit, Inter, sans-serif';
        ctx.fillText(val, x + 40, y + 135);

        ctx.fillStyle = '#f59e0b';
        ctx.font = '600 24px Inter, sans-serif';
        ctx.fillText(sub, x + 40, y + 180);
      };

      const hrs = weeklyRecap?.totalHours || '0.0';
      const plays = weeklyRecap?.totalPlays || stats?.totalPlays || 0;
      const tracks = weeklyRecap?.distinctTracksCount || stats?.distinctTracksCount || 0;
      const peak = weeklyRecap?.peakDay && weeklyRecap.peakDay !== 'None' ? weeklyRecap.peakDay : 'None';
      const peakHours = weeklyRecap?.peakDayHours || '0.0';

      renderStatBox(90, 520, 420, 220, 'Hours Listened', `${hrs}h`, 'This week');
      renderStatBox(570, 520, 420, 220, 'Total Plays', `${plays}`, 'Valid Plays');
      renderStatBox(90, 780, 420, 220, 'Unique Tracks', `${tracks}`, 'Diverse taste');
      renderStatBox(570, 780, 420, 220, 'Peak Day', `${peak}`, `${peakHours}h peak`);

      // 5. Top Song Banner
      const topSong = weeklyRecap?.topTracks?.[0] || stats?.topTracks?.[0];
      ctx.fillStyle = 'rgba(24, 24, 27, 0.8)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(90, 1050, 900, 260, 32);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '700 26px Inter, sans-serif';
      ctx.fillText('#1 TOP SONG THIS WEEK', 140, 1115);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 48px Outfit, Inter, sans-serif';
      const songTitle = topSong?.title ? (topSong.title.length > 25 ? topSong.title.slice(0, 24) + '...' : topSong.title) : 'Loopra Music Sanctuary';
      ctx.fillText(songTitle, 140, 1185);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '500 32px Inter, sans-serif';
      const songArtist = topSong?.artist ? (topSong.artist.length > 30 ? topSong.artist.slice(0, 29) + '...' : topSong.artist) : 'Discovering sounds';
      ctx.fillText(songArtist, 140, 1245);

      // 6. Top Artist Banner
      const topArtist = weeklyRecap?.topArtists?.[0] || stats?.topArtists?.[0];
      ctx.fillStyle = 'rgba(24, 24, 27, 0.8)';
      ctx.strokeStyle = 'rgba(234, 88, 12, 0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(90, 1350, 900, 220, 32);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ea580c';
      ctx.font = '700 26px Inter, sans-serif';
      ctx.fillText('TOP ARTIST', 140, 1415);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 48px Outfit, Inter, sans-serif';
      const artName = topArtist?.artist ? (topArtist.artist.length > 25 ? topArtist.artist.slice(0, 24) + '...' : topArtist.artist) : 'Various Artists';
      ctx.fillText(artName, 140, 1485);

      ctx.fillStyle = '#f59e0b';
      ctx.font = '600 28px Inter, sans-serif';
      const artPlays = topArtist?.plays || topArtist?.count || 0;
      const artPct = topArtist?.percentage || 0;
      ctx.fillText(`${artPlays} plays • ${artPct}% of listening`, 140, 1530);

      // 7. Footer Call to Action
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 32px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Music Hits Different With Loopra', W / 2, 1720);

      ctx.fillStyle = '#71717a';
      ctx.font = '500 24px Inter, sans-serif';
      ctx.fillText('Listen to verified single songs at loopra.vercel.app', W / 2, 1765);
      ctx.textAlign = 'left';

      try {
        const dataUrl = canvas.toDataURL('image/png');
        setShareDataUrl(dataUrl);
      } catch (e) {}

      setIsGeneratingShare(false);
    }, 120);
  };

  const handleDownloadShareCard = () => {
    if (!shareDataUrl) return;
    const link = document.createElement('a');
    link.download = `loopra-weekly-recap-${Date.now()}.png`;
    link.href = shareDataUrl;
    link.click();
    if (showToast) showToast('Recap story card downloaded!');
  };

  const handleNativeShare = async () => {
    if (!shareDataUrl) return;
    try {
      const res = await fetch(shareDataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'loopra-recap.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Loopra Music Recap',
          text: `🎶 Check out my Loopra Music Recap: ${weeklyRecap?.totalHours || '0.0'}h listened on Loopra!`
        });
        return;
      }
    } catch (e) {}

    const summaryText = `🎶 My Loopra Weekly Recap:\n⏱️ ${weeklyRecap?.totalHours || '0.0'} hrs listened\n🎵 ${weeklyRecap?.distinctTracksCount || 0} distinct tracks\nCheck out loopra.vercel.app!`;
    navigator.clipboard?.writeText(summaryText);
    if (showToast) showToast('Recap text copied to clipboard!');
  };

  const topTracksList = activeTab === 'recap' ? (weeklyRecap?.topTracks || []) : (stats?.topTracks || []);
  const topArtistsList = activeTab === 'recap' ? (weeklyRecap?.topArtists || []) : (stats?.topArtists || []);
  const moodsList = weeklyRecap?.topMoods || [];

  // Daily activity bars for the chart (STRICTLY genuine data)
  const dailyBars = useMemo(() => {
    if (weeklyRecap?.dailyActivity && weeklyRecap.dailyActivity.length === 7) {
      return weeklyRecap.dailyActivity;
    }
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return dayNames.map((dayLabel, i) => ({
      dayIndex: i,
      dayLabel,
      dayShort: '',
      hours: 0,
      plays: 0,
      seconds: 0,
      isPeak: false
    }));
  }, [weeklyRecap?.dailyActivity]);

  const maxChartValue = useMemo(() => {
    if (activityMetric === 'hours') {
      const maxH = Math.max(...dailyBars.map(d => d.hours || 0), 0);
      return maxH > 0 ? Math.ceil(maxH * 1.25) : 1;
    }
    const maxP = Math.max(...dailyBars.map(d => d.plays || 0), 0);
    return maxP > 0 ? Math.ceil(maxP * 1.25) : 5;
  }, [dailyBars, activityMetric]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Hidden high-res canvas for 9:16 Instagram Story generation */}
      <canvas ref={canvasRef} className="hidden" />

      <div
        className="w-full max-w-5xl bg-[#0b0c10] border border-amber-500/20 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(245,158,11,0.12)] flex flex-col my-auto max-h-[92vh] relative text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. TOP HEADER BAR */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#12131c] via-[#0f1017] to-[#14120f] border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-neutral-950 font-black shadow-lg shadow-amber-500/20 text-lg">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white font-display tracking-tight">
                  Listening Insights & Recap
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  Verified Data
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Authentic user playback analytics'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Sync latest listening records"
              className={`px-3.5 py-1.5 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800/90 border border-neutral-700/80 hover:border-amber-500/50 text-neutral-200 hover:text-white transition flex items-center gap-2 text-xs font-semibold shadow-inner cursor-pointer ${
                isRefreshing ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <svg
                className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white transition flex items-center justify-center border border-neutral-800 cursor-pointer text-sm"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error notification banner if refresh fails */}
        {errorMessage && (
          <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-amber-400 hover:text-white ml-2">✕</button>
          </div>
        )}

        {/* 2. SUB-HEADER BAR: TABS & DATE RANGE */}
        <div className="px-5 py-2.5 bg-[#090a0f] border-b border-neutral-800/60 flex items-center justify-between flex-wrap gap-2">
          {/* Tab buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('recap')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'recap'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <span>Weekly Recap</span>
            </button>
            <button
              onClick={() => setActiveTab('all-time')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all-time'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <span>All-Time Stats</span>
            </button>
          </div>

          {/* Date Range Badge */}
          <div className="text-xs text-neutral-400 font-mono flex items-center gap-1.5 bg-neutral-900/60 px-3 py-1 rounded-lg border border-neutral-800/60">
            <span>📅</span>
            <span>{activeTab === 'recap' ? (weeklyRecap?.dateRangeLabel || 'Current Week') : 'Lifetime Listening'}</span>
          </div>
        </div>

        {/* 3. MAIN DASHBOARD CONTENT */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[calc(92vh-130px)] custom-scrollbar">
          {/* TOP SECTION: HERO BANNER + 4 STAT CARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Hero Banner (30% on desktop) */}
            <div className="lg:col-span-4 bg-gradient-to-br from-neutral-900/90 via-[#13141f] to-amber-950/40 border border-amber-500/20 rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between shadow-lg">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight leading-tight">
                  {activeTab === 'recap' ? 'Your Week' : 'All-Time'} <br />
                  <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
                    in Music
                  </span>
                </h2>
                <p className="text-xs text-neutral-400 mt-1.5 max-w-[220px] leading-relaxed">
                  {activeTab === 'recap'
                    ? 'Genuine beats and memories from your weekly playback.'
                    : 'Your complete lifetime music journey on Loopra.'}
                </p>
              </div>

              <div className="my-3 text-right">
                <span className="text-amber-400/80 font-serif italic text-sm tracking-wide block drop-shadow-sm">
                  "Music Hits Different With You"
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/60">
                <div className="w-5 h-5 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center font-bold text-[10px]">
                  ∞
                </div>
                <span className="text-xs font-extrabold tracking-wider text-neutral-200">Loopra Analytics</span>
              </div>
            </div>

            {/* 4 Stat Cards Grid (70% on desktop) */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* 1. Listening Hours */}
              <div className="bg-[#101118]/80 hover:bg-[#13141f]/90 border border-neutral-800 hover:border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-300 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    {activeTab === 'recap' ? 'Listening Hours' : 'Lifetime Hours'}
                  </span>
                  <span className="text-amber-400 text-sm">🎧</span>
                </div>
                <div className="my-1.5">
                  <p className="text-2xl sm:text-3xl font-black text-white font-display">
                    {activeTab === 'recap' ? (weeklyRecap?.totalHours || '0.0') : (stats?.totalHours || '0.0')}h
                  </p>
                  <p className="text-[11px] text-neutral-400 font-medium flex items-center gap-1 mt-0.5">
                    {activeTab === 'recap'
                      ? (weeklyRecap?.hoursTrend ? <span className="text-emerald-400 font-bold">{weeklyRecap.hoursTrend} vs last week</span> : 'Current week')
                      : 'Total playback'}
                  </p>
                </div>
                <svg className="w-full h-6 text-amber-500/50" viewBox="0 0 100 25" preserveAspectRatio="none">
                  <path d="M0,20 Q20,5 40,15 T80,8 T100,20" fill="none" stroke="currentColor" strokeWidth="2.5" />
                </svg>
              </div>

              {/* 2. Total Plays */}
              <div className="bg-[#101118]/80 hover:bg-[#13141f]/90 border border-neutral-800 hover:border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-300 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    {activeTab === 'recap' ? 'Total Plays' : 'Lifetime Plays'}
                  </span>
                  <span className="text-amber-400 text-sm">▶️</span>
                </div>
                <div className="my-1.5">
                  <p className="text-2xl sm:text-3xl font-black text-white font-display">
                    {activeTab === 'recap' ? (weeklyRecap?.totalPlays || 0) : (stats?.totalPlays || 0)}
                  </p>
                  <p className="text-[11px] text-neutral-400 font-medium flex items-center gap-1 mt-0.5">
                    {activeTab === 'recap'
                      ? (weeklyRecap?.playsTrend ? <span className="text-emerald-400 font-bold">{weeklyRecap.playsTrend} vs last week</span> : 'Valid (≥30s)')
                      : 'Verified plays'}
                  </p>
                </div>
                <div className="flex items-end justify-between h-6 gap-1 px-1">
                  {[4, 8, 12, 16, 22, 18, 14].map((h, i) => (
                    <span key={i} style={{ height: `${h}px` }} className="flex-1 bg-amber-500/60 rounded-t-sm" />
                  ))}
                </div>
              </div>

              {/* 3. Unique Tracks */}
              <div className="bg-[#101118]/80 hover:bg-[#13141f]/90 border border-neutral-800 hover:border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-300 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Unique Tracks</span>
                  <span className="text-amber-400 text-sm">🎵</span>
                </div>
                <div className="my-1.5">
                  <p className="text-2xl sm:text-3xl font-black text-white font-display">
                    {activeTab === 'recap' ? (weeklyRecap?.distinctTracksCount || 0) : (stats?.distinctTracksCount || 0)}
                  </p>
                  <p className="text-[11px] text-neutral-400 font-medium flex items-center gap-1 mt-0.5">
                    {activeTab === 'recap'
                      ? (weeklyRecap?.tracksTrend ? <span className="text-emerald-400 font-bold">{weeklyRecap.tracksTrend} vs last week</span> : 'Distinct songs')
                      : 'All unique songs'}
                  </p>
                </div>
                <svg className="w-full h-6 text-amber-500/50" viewBox="0 0 100 25" preserveAspectRatio="none">
                  <path d="M0,22 Q30,18 50,8 T100,12" fill="none" stroke="currentColor" strokeWidth="2.5" />
                </svg>
              </div>

              {/* 4. Peak Day OR Web Usage */}
              {activeTab === 'recap' ? (
                <div className="bg-[#101118]/80 hover:bg-[#13141f]/90 border border-neutral-800 hover:border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-300 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Peak Day</span>
                    <span className="text-amber-400 text-sm">🔥</span>
                  </div>
                  <div className="my-1.5">
                    <p className="text-2xl sm:text-3xl font-black text-amber-400 font-display">
                      {weeklyRecap?.peakDay && weeklyRecap.peakDay !== 'None' ? weeklyRecap.peakDay : 'None'}
                    </p>
                    <p className="text-[11px] text-neutral-300 font-medium mt-0.5">
                      {weeklyRecap?.peakDayHours && weeklyRecap.totalListeningSeconds > 0 ? `${weeklyRecap.peakDayHours}h peak` : '0.0h peak'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[8px] font-mono text-neutral-400">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
                      const isPeakDay = Boolean(weeklyRecap?.totalListeningSeconds > 0 && weeklyRecap?.dailyActivity?.[i]?.isPeak);
                      return (
                        <span
                          key={i}
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold ${
                            isPeakDay ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'bg-neutral-800/80 text-neutral-400'
                          }`}
                        >
                          {d}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-[#101118]/80 hover:bg-[#13141f]/90 border border-neutral-800 hover:border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-300 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Web Usage</span>
                    <span className="text-amber-400 text-sm">💻</span>
                  </div>
                  <div className="my-1.5">
                    <p className="text-2xl sm:text-3xl font-black text-amber-400 font-display">
                      {stats?.totalActiveWebsiteHours || '0.0'}h
                    </p>
                    <p className="text-[11px] text-neutral-300 font-medium mt-0.5">
                      {stats?.totalSessions || 0} active sessions
                    </p>
                  </div>
                  <div className="text-[9px] text-neutral-400 font-mono">
                    Loopra application time
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MIDDLE SECTION: 3 EQUAL COLUMNS (Activity Chart, Top Songs, Top Artists) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* CARD 1: LISTENING ACTIVITY CHART (4 cols) */}
            <div className="lg:col-span-4 bg-[#101118]/90 border border-neutral-800/90 rounded-2xl p-4 flex flex-col justify-between shadow-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">📊</span>
                  <h4 className="text-xs sm:text-sm font-bold text-white">Your Listening Activity</h4>
                </div>
                {/* Toggle Hours / Plays */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 flex items-center text-[10px]">
                  <button
                    onClick={() => setActivityMetric('hours')}
                    className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                      activityMetric === 'hours'
                        ? 'bg-amber-500 text-neutral-950 shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Hours
                  </button>
                  <button
                    onClick={() => setActivityMetric('plays')}
                    className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                      activityMetric === 'plays'
                        ? 'bg-amber-500 text-neutral-950 shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Plays
                  </button>
                </div>
              </div>

              {/* Bar Chart Canvas with Y-Axis */}
              <div className="relative pt-4 pb-1">
                <div className="h-40 flex items-end justify-between gap-1.5 px-2">
                  {dailyBars.map((d, i) => {
                    const val = activityMetric === 'hours' ? d.hours : d.plays;
                    const heightPct = val > 0 ? Math.max(10, Math.min(100, Math.round((val / maxChartValue) * 100))) : 4;
                    const isPeak = Boolean(d.isPeak && val > 0);

                    return (
                      <div key={d.dayLabel || i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        {/* Tooltip value */}
                        <span className={`text-[9px] font-mono transition font-semibold ${isPeak ? 'text-amber-400' : 'text-neutral-400'}`}>
                          {activityMetric === 'hours' ? `${d.hours}h` : d.plays}
                        </span>

                        {/* Bar */}
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[28px] rounded-t-lg transition-all duration-500 ${
                            isPeak
                              ? 'bg-gradient-to-t from-orange-600 via-amber-500 to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                              : val > 0
                                ? 'bg-gradient-to-t from-orange-950/80 via-amber-900/40 to-amber-700/60 group-hover:to-amber-500'
                                : 'bg-neutral-800/40'
                          }`}
                        />

                        {/* X-axis labels */}
                        <div className="text-center leading-tight">
                          <p className={`text-[10px] font-bold ${isPeak ? 'text-amber-400' : 'text-neutral-300'}`}>
                            {d.dayLabel}
                          </p>
                          <p className="text-[8px] text-neutral-400 font-mono">{d.dayShort || ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom activity callout */}
              <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <span>🔥</span>
                  <span>
                    {activeTab === 'all-time' ? (
                      <>Lifetime: <strong className="text-amber-300">{stats?.totalHours || '0.0'} hours</strong> across {stats?.totalPlays || 0} plays</>
                    ) : (
                      <>Listened <strong className="text-amber-300">{weeklyRecap?.totalHours || '0.0'} hours</strong> this week</>
                    )}
                  </span>
                </span>
                <span className="text-neutral-400 font-mono text-[11px] shrink-0">
                  {activeTab === 'recap' && weeklyRecap?.hoursTrend ? (
                    <span className="text-emerald-400 font-bold">{weeklyRecap.hoursTrend} from last week</span>
                  ) : (
                    <span>Verified</span>
                  )}
                </span>
              </div>
            </div>

            {/* CARD 2: TOP SONGS (4 cols) */}
            <div className="lg:col-span-4 bg-[#101118]/90 border border-neutral-800/90 rounded-2xl p-4 flex flex-col justify-between shadow-md">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">🎵</span>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {activeTab === 'all-time' ? 'Top Songs (All-Time)' : 'Top Songs This Week'}
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-neutral-400 font-mono">
                  {topTracksList.length} tracks
                </span>
              </div>

              {/* List of Songs */}
              <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[260px] custom-scrollbar pr-1">
                {topTracksList.slice(0, 5).map((track, idx) => {
                  const isCurrent = currentSong && (currentSong.id === track.id || currentSong.videoId === track.id);
                  const isRankOne = idx === 0;

                  return (
                    <div
                      key={track.id || track.videoId || idx}
                      onClick={(e) => handleTrackPlayClick(track, e)}
                      className={`p-2 rounded-xl border transition-all duration-200 flex items-center justify-between gap-2.5 cursor-pointer group ${
                        isCurrent
                          ? 'bg-amber-500/15 border-amber-500/40 shadow-sm shadow-amber-500/10'
                          : 'bg-[#0d0e14]/70 hover:bg-[#141520] border-neutral-800/80 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Rank Badge */}
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${
                            isRankOne
                              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-neutral-950 shadow-md shadow-amber-500/30'
                              : 'bg-neutral-800/90 text-neutral-400 border border-neutral-700/60'
                          }`}
                        >
                          {isRankOne ? '👑' : idx + 1}
                        </div>

                        {/* Artwork */}
                        <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-neutral-800 bg-neutral-900">
                          {track.thumbnail ? (
                            <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs">🎶</div>
                          )}
                        </div>

                        {/* Title & Artist */}
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${isCurrent ? 'text-amber-300' : 'text-white'}`}>
                            {track.title || 'Unknown Track'}
                          </p>
                          <p className="text-[10px] text-neutral-400 truncate">{track.artist || 'Unknown Artist'}</p>
                        </div>
                      </div>

                      {/* Right Play Count & Play Action */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-neutral-400">
                          {track.plays || track.count || 0} plays
                        </span>
                        <button
                          onClick={(e) => handleTrackPlayClick(track, e)}
                          title="Play song"
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                            isCurrent && isPlaying
                              ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/30'
                              : 'bg-neutral-800 hover:bg-amber-500 text-amber-400 hover:text-neutral-950 border border-amber-500/30'
                          }`}
                        >
                          {isCurrent && isPlaying ? (
                            <div className="flex items-end gap-0.5 h-3">
                              <span className="w-0.5 bg-neutral-950 h-3 animate-pulse" />
                              <span className="w-0.5 bg-neutral-950 h-2" />
                              <span className="w-0.5 bg-neutral-950 h-3 animate-pulse" />
                            </div>
                          ) : (
                            <span className="text-[10px] ml-0.5">▶</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {topTracksList.length === 0 && (
                  <div className="py-12 text-center text-xs text-neutral-400">
                    <p className="text-lg mb-1">🎧</p>
                    <p>No songs played yet.</p>
                    <p className="text-[10px] text-neutral-400 mt-1">Play music on Loopra to generate your rankings.</p>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 3: TOP ARTISTS (4 cols) */}
            <div className="lg:col-span-4 bg-[#101118]/90 border border-neutral-800/90 rounded-2xl p-4 flex flex-col justify-between shadow-md">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">👤</span>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {activeTab === 'all-time' ? 'Top Artists (All-Time)' : 'Top Artists This Week'}
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-neutral-400 font-mono">
                  {topArtistsList.length} artists
                </span>
              </div>

              {/* List of Artists */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[260px] custom-scrollbar pr-1">
                {topArtistsList.slice(0, 5).map((artist, idx) => {
                  const isRankOne = idx === 0;
                  const pct = artist.percentage || 0;

                  return (
                    <div key={artist.artist || idx} className="flex items-center gap-3">
                      {/* Rank Indicator */}
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          isRankOne
                            ? 'bg-amber-500 text-neutral-950 font-black shadow-sm'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {idx + 1}
                      </div>

                      {/* Circular Avatar */}
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-800 border border-amber-500/30 shrink-0 flex items-center justify-center">
                        {artist.avatar ? (
                          <img src={artist.avatar} alt={artist.artist} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-amber-400">{artist.artist?.[0] || 'A'}</span>
                        )}
                      </div>

                      {/* Name & Progress Bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-white truncate max-w-[120px]">{artist.artist}</span>
                          <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                            {artist.plays || artist.count || 0} plays
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                          />
                        </div>
                      </div>

                      {/* Percentage */}
                      <span className="text-[10px] font-mono text-neutral-400 w-8 text-right shrink-0">
                        {pct}%
                      </span>
                    </div>
                  );
                })}

                {topArtistsList.length === 0 && (
                  <div className="py-12 text-center text-xs text-neutral-400">
                    <p className="text-lg mb-1">🎤</p>
                    <p>No artists recorded yet.</p>
                    <p className="text-[10px] text-neutral-400 mt-1">Play music to calculate your favourite artists.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BOTTOM SECTION: WEEKLY VIBES (7 cols) + SHARE YOUR RECAP (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Card 1: Your Weekly Vibes */}
            <div className="lg:col-span-7 bg-[#101118]/90 border border-neutral-800/90 rounded-2xl p-4 flex flex-col justify-between shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-400">✨</span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">Your Music Vibes</h4>
                  <p className="text-[10px] text-neutral-400">Top moods based on genuine playback</p>
                </div>
              </div>

              {/* Mood Pills */}
              <div className="flex flex-wrap gap-2 my-2">
                {moodsList.map((m) => (
                  <div
                    key={m.mood}
                    className="px-3.5 py-2 rounded-xl bg-neutral-900/90 border border-neutral-700/80 hover:border-amber-500/40 flex items-center gap-2 transition hover:scale-102"
                  >
                    <span className="text-sm">{m.icon}</span>
                    <span className="text-xs font-semibold text-white">{m.mood}</span>
                    <span className="text-[10px] font-mono text-amber-400 font-bold">{m.percentage}%</span>
                  </div>
                ))}

                {moodsList.length === 0 && (
                  <div className="py-4 text-xs text-neutral-400">
                    Play songs on Loopra to generate your music vibe profile.
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Share Your Recap */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#101118] via-[#141522] to-amber-950/30 border border-amber-500/25 rounded-2xl p-4 flex flex-col justify-between shadow-md relative overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-400">📲</span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">Share Your Recap</h4>
                  <p className="text-[10px] text-neutral-400">Create and share an authentic summary of your music week.</p>
                </div>
              </div>

              <div className="mt-3">
                <button
                  onClick={generateShareCard}
                  className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition cursor-pointer hover:scale-101 active:scale-99"
                >
                  <span>⚡</span>
                  <span>Generate Share Card (9:16)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. FOOTER */}
        <div className="p-3 sm:p-4 bg-[#0e0f16] border-t border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>🎧</span>
            <span>Genuine User Listening Telemetry</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={generateShareCard}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/40 transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>📤</span>
              <span>Share Recap</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* 9:16 INSTAGRAM STORY SHARE MODAL */}
      {isShareModalOpen && (
        <div
          className="fixed inset-0 z-[10010] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-3 animate-fadeIn"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-neutral-900 border border-amber-500/40 rounded-3xl p-4 flex flex-col items-center gap-4 max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 border-b border-neutral-800">
              <h4 className="font-extrabold text-white text-sm">Instagram Story Card</h4>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="w-full max-w-[280px] aspect-[9/16] rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl bg-neutral-950 relative flex items-center justify-center">
              {isGeneratingShare ? (
                <div className="flex flex-col items-center gap-2 text-amber-400 text-xs font-bold animate-pulse">
                  <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                  <span>Designing 9:16 Story Card...</span>
                </div>
              ) : shareDataUrl ? (
                <img src={shareDataUrl} alt="Loopra 9:16 Recap Card" className="w-full h-full object-cover" />
              ) : null}
            </div>

            <div className="w-full flex gap-2">
              <button
                onClick={handleDownloadShareCard}
                disabled={isGeneratingShare || !shareDataUrl}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <span>⬇️</span>
                <span>Download PNG</span>
              </button>
              <button
                onClick={handleNativeShare}
                disabled={isGeneratingShare || !shareDataUrl}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-neutral-700 cursor-pointer"
              >
                <span>📲</span>
                <span>Share Story</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
