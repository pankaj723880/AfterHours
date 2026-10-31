import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { listeningStatsService, formatListeningHours } from '../../services/listeningStatsService';

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
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'recap' | 'monthly' | 'all-time'
  const [stats, setStats] = useState(null);
  const [dailyRecap, setDailyRecap] = useState(null);
  const [weeklyRecap, setWeeklyRecap] = useState(null);
  const [monthlyRecap, setMonthlyRecap] = useState(null);
  const [streaks, setStreaks] = useState(null);
  const [telemetryStatus, setTelemetryStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activityMetric, setActivityMetric] = useState('hours'); // 'hours' | 'plays'
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [shareDataUrl, setShareDataUrl] = useState(null);

  // Helper to format any hour value strictly to two decimal places
  const fmtHours = useCallback((val, isSec = false) => {
    return formatListeningHours(val, isSec);
  }, []);

  // Month & year selection for Monthly Recap (defaults to current date e.g. Oct 2026)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const canvasRef = useRef(null);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const loadStats = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      let data = null;
      if (typeof listeningStatsService?.fetchStats === 'function') {
        data = await listeningStatsService.fetchStats({
          backendUrl,
          token: authToken,
          user,
          forceRefresh: force,
          month: selectedMonth,
          year: selectedYear
        });
      }

      if (data) {
        setDailyRecap(data.dailyRecap || null);
        setWeeklyRecap(data.weeklyRecap || null);
        setMonthlyRecap(data.monthlyRecap || null);
        setStats(data.allTimeStats || null);
        setStreaks(data.streaks || null);
        setTelemetryStatus(data.telemetryStatus || null);
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
  }, [backendUrl, authToken, user, showToast, selectedMonth, selectedYear]);

  // Initial load
  useEffect(() => {
    if (!isOpen) {
      hasLoadedRef.current = false;
      return;
    }

    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    // Instant paint from local cache
    const local = typeof listeningStatsService?.computeLocalStats === 'function'
      ? listeningStatsService.computeLocalStats(user)
      : null;
    if (local) {
      if (local.dailyRecap) setDailyRecap(local.dailyRecap);
      if (local.weeklyRecap) setWeeklyRecap(local.weeklyRecap);
      if (local.monthlyRecap) setMonthlyRecap(local.monthlyRecap);
      if (local.allTimeStats) setStats(local.allTimeStats);
      if (local.streaks) setStreaks(local.streaks);
      if (local.updatedAt) setLastUpdated(new Date(local.updatedAt));
    }

    loadStats(false);
  }, [isOpen, loadStats, user]);

  // Refetch when selected month or year changes on monthly tab
  useEffect(() => {
    if (isOpen && activeTab === 'monthly') {
      loadStats(false);
    }
  }, [selectedMonth, selectedYear, activeTab, isOpen, loadStats]);

  // Real-time update listener for new playback events
  useEffect(() => {
    if (!isOpen) return;

    let timeoutId = null;
    const handleStatsUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadStats(true);
      }, 1000);
    };

    window.addEventListener('loopra_listening_stats_updated', handleStatsUpdate);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('loopra_listening_stats_updated', handleStatsUpdate);
    };
  }, [isOpen, loadStats]);

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
        artist: track.artist || track.name,
        thumbnail: track.thumbnail || track.image,
        image: track.thumbnail || track.image
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
      const recapCategoryLabel = activeTab === 'daily'
        ? 'DAILY RECAP'
        : activeTab === 'monthly'
        ? (monthlyRecap?.monthLabel?.toUpperCase() || 'MONTHLY RECAP')
        : activeTab === 'all-time'
        ? 'ALL-TIME STATS'
        : 'WEEKLY RECAP';
      ctx.fillText(recapCategoryLabel, 90, 185);

      // 3. Hero Header
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 84px Outfit, Inter, sans-serif';
      const storyTitlePrefix = activeTab === 'daily'
        ? 'Your Day'
        : activeTab === 'monthly'
        ? (monthlyRecap?.monthLabel || 'Your Month')
        : activeTab === 'all-time'
        ? 'All-Time'
        : 'Your Week';
      ctx.fillText(storyTitlePrefix, 90, 310);
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

      const hrs = activeTab === 'daily'
        ? fmtHours(dailyRecap?.totalHours)
        : activeTab === 'recap'
        ? fmtHours(weeklyRecap?.totalHours)
        : activeTab === 'monthly'
        ? fmtHours(monthlyRecap?.totalHours || monthlyRecap?.totalListeningHours)
        : fmtHours(stats?.totalHours);

      const plays = activeTab === 'daily'
        ? (dailyRecap?.totalPlays || 0)
        : activeTab === 'recap'
        ? (weeklyRecap?.totalPlays || 0)
        : activeTab === 'monthly'
        ? (monthlyRecap?.totalPlays || 0)
        : (stats?.totalPlays || 0);

      const tracks = activeTab === 'daily'
        ? (dailyRecap?.distinctTracksCount || 0)
        : activeTab === 'recap'
        ? (weeklyRecap?.distinctTracksCount || 0)
        : activeTab === 'monthly'
        ? (monthlyRecap?.distinctTracksCount || 0)
        : (stats?.distinctTracksCount || 0);

      const peak = activeTab === 'daily'
        ? (dailyRecap?.peakHour && dailyRecap.peakHour !== 'None' ? dailyRecap.peakHour : 'None')
        : activeTab === 'recap'
        ? (weeklyRecap?.peakDay && weeklyRecap.peakDay !== 'None' ? weeklyRecap.peakDay : 'None')
        : activeTab === 'monthly'
        ? (monthlyRecap?.peakDay && monthlyRecap.peakDay !== 'None' ? monthlyRecap.peakDay : 'None')
        : `${fmtHours(stats?.totalActiveWebsiteHours)}h Web`;

      const peakSub = activeTab === 'daily'
        ? `${dailyRecap?.peakHourPlays || 0} plays today`
        : activeTab === 'all-time'
        ? `${stats?.totalSessions || 0} active sessions`
        : activeTab === 'monthly'
        ? `${fmtHours(monthlyRecap?.peakDayHours)}h peak`
        : `${fmtHours(weeklyRecap?.peakDayHours)}h peak`;

      const peakLabel = activeTab === 'daily' ? 'Peak Hour' : activeTab === 'all-time' ? 'Web Usage' : 'Peak Day';

      renderStatBox(90, 520, 420, 220, 'Hours Listened', `${hrs}h`, activeTab === 'daily' ? 'Today' : activeTab === 'monthly' ? (monthlyRecap?.monthLabel || 'This month') : activeTab === 'all-time' ? 'Lifetime' : 'This week');
      renderStatBox(570, 520, 420, 220, 'Total Plays', `${plays}`, 'Valid Plays');
      renderStatBox(90, 780, 420, 220, 'Unique Tracks', `${tracks}`, 'Diverse taste');
      renderStatBox(570, 780, 420, 220, peakLabel, `${peak}`, peakSub);

      // 5. Top Song Banner
      const currentTopTracks = activeTab === 'daily' ? (dailyRecap?.topTracks || []) : activeTab === 'recap' ? (weeklyRecap?.topTracks || []) : activeTab === 'monthly' ? (monthlyRecap?.topTracks || []) : (stats?.topTracks || []);
      const topSong = currentTopTracks[0];

      ctx.fillStyle = 'rgba(24, 24, 27, 0.8)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(90, 1050, 900, 260, 32);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '700 26px Inter, sans-serif';
      ctx.fillText(activeTab === 'daily' ? '#1 TOP SONG TODAY' : activeTab === 'monthly' ? `#1 TOP SONG (${monthlyRecap?.monthLabel?.toUpperCase() || 'THIS MONTH'})` : activeTab === 'all-time' ? '#1 TOP SONG (ALL-TIME)' : '#1 TOP SONG THIS WEEK', 140, 1115);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 48px Outfit, Inter, sans-serif';
      const songTitle = topSong?.title ? (topSong.title.length > 25 ? topSong.title.slice(0, 24) + '...' : topSong.title) : 'Loopra Music Sanctuary';
      ctx.fillText(songTitle, 140, 1185);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '500 32px Inter, sans-serif';
      const songArtist = (topSong?.artist || topSong?.name) ? (topSong.artist || topSong.name) : 'Discovering sounds';
      ctx.fillText(songArtist.length > 30 ? songArtist.slice(0, 29) + '...' : songArtist, 140, 1245);

      // 6. Top Artist Banner
      const currentTopArtists = activeTab === 'daily' ? (dailyRecap?.topArtists || []) : activeTab === 'recap' ? (weeklyRecap?.topArtists || []) : activeTab === 'monthly' ? (monthlyRecap?.topArtists || []) : (stats?.topArtists || []);
      const topArtist = currentTopArtists[0];

      ctx.fillStyle = 'rgba(24, 24, 27, 0.8)';
      ctx.strokeStyle = 'rgba(234, 88, 12, 0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(90, 1350, 900, 220, 32);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ea580c';
      ctx.font = '700 26px Inter, sans-serif';
      ctx.fillText(activeTab === 'daily' ? 'TOP ARTIST TODAY' : activeTab === 'monthly' ? `TOP ARTIST (${monthlyRecap?.monthLabel?.toUpperCase() || 'THIS MONTH'})` : activeTab === 'all-time' ? 'TOP ARTIST (ALL-TIME)' : 'TOP ARTIST THIS WEEK', 140, 1415);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 48px Outfit, Inter, sans-serif';
      const rawArtName = topArtist?.artist || topArtist?.name || 'Various Artists';
      const artName = rawArtName.length > 25 ? rawArtName.slice(0, 24) + '...' : rawArtName;
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
      ctx.fillText('Listen to verified music at loopra1.vercel.app', W / 2, 1765);
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
    link.download = `loopra-${activeTab}-recap-${Date.now()}.png`;
    link.href = shareDataUrl;
    link.click();
    if (showToast) showToast('Recap story card downloaded!');
  };

  const handleNativeShare = async () => {
    if (!shareDataUrl) return;
    const currentHrs = activeTab === 'daily'
      ? fmtHours(dailyRecap?.totalHours)
      : activeTab === 'recap'
      ? fmtHours(weeklyRecap?.totalHours)
      : activeTab === 'monthly'
      ? fmtHours(monthlyRecap?.totalHours || monthlyRecap?.totalListeningHours)
      : fmtHours(stats?.totalHours);

    try {
      const res = await fetch(shareDataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'loopra-recap.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Loopra Music Recap',
          text: `🎶 Check out my Loopra Music Recap: ${currentHrs}h listened on Loopra!`
        });
        return;
      }
    } catch (e) {}

    const summaryText = `🎶 My Loopra ${activeTab === 'daily' ? 'Daily' : activeTab === 'monthly' ? monthlyRecap?.monthLabel : activeTab === 'all-time' ? 'All-Time' : 'Weekly'} Recap:\n⏱️ ${currentHrs} hrs listened\nCheck out loopra1.vercel.app!`;
    navigator.clipboard?.writeText(summaryText);
    if (showToast) showToast('Recap text copied to clipboard!');
  };

  // Synchronized lists for the active period
  const topTracksList = useMemo(() => {
    if (activeTab === 'daily') return dailyRecap?.topTracks || [];
    if (activeTab === 'recap') return weeklyRecap?.topTracks || [];
    if (activeTab === 'monthly') return monthlyRecap?.topTracks || [];
    return stats?.topTracks || [];
  }, [activeTab, dailyRecap, weeklyRecap, monthlyRecap, stats]);

  const topArtistsList = useMemo(() => {
    if (activeTab === 'daily') return dailyRecap?.topArtists || [];
    if (activeTab === 'recap') return weeklyRecap?.topArtists || [];
    if (activeTab === 'monthly') return monthlyRecap?.topArtists || [];
    return stats?.topArtists || [];
  }, [activeTab, dailyRecap, weeklyRecap, monthlyRecap, stats]);

  const moodsList = useMemo(() => {
    if (activeTab === 'monthly') return monthlyRecap?.topMoods || weeklyRecap?.topMoods || [];
    return weeklyRecap?.topMoods || [];
  }, [activeTab, weeklyRecap, monthlyRecap]);

  // Period-aware daily activity bars for the chart
  const dailyBars = useMemo(() => {
    if (activeTab === 'daily') {
      if (dailyRecap?.hourlyActivity && dailyRecap.hourlyActivity.length === 24) {
        return dailyRecap.hourlyActivity;
      }
      return Array.from({ length: 24 }, (_, h) => {
        const ampm = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
        return {
          hourIndex: h,
          dayLabel: ampm,
          dayShort: `${String(h).padStart(2, '0')}:00`,
          hours: 0,
          plays: 0,
          seconds: 0,
          isPeak: false
        };
      });
    }

    if (activeTab === 'recap') {
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
    }

    if (activeTab === 'monthly') {
      if (monthlyRecap?.dailyActivity && monthlyRecap.dailyActivity.length > 0) {
        return monthlyRecap.dailyActivity;
      }
      const daysCount = new Date(selectedYear, selectedMonth, 0).getDate();
      return Array.from({ length: daysCount }, (_, i) => ({
        dayIndex: i,
        dayLabel: String(i + 1),
        dayShort: `${i + 1}`,
        hours: 0,
        plays: 0,
        seconds: 0,
        isPeak: false
      }));
    }

    // All-time activity bars (monthly historical buckets)
    if (stats?.activityOverTime && stats.activityOverTime.length > 0) {
      return stats.activityOverTime;
    }
    const defaultMonths = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    return defaultMonths.map((m, i) => ({
      dayIndex: i,
      dayLabel: m,
      dayShort: m,
      hours: 0,
      plays: 0,
      seconds: 0,
      isPeak: false
    }));
  }, [activeTab, dailyRecap, weeklyRecap, monthlyRecap, stats, selectedMonth, selectedYear]);

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

                {/* DYNAMIC TELEMETRY STATUS BADGE (Audit Section 7) */}
                {isRefreshing ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider animate-pulse">
                    Syncing Telemetry...
                  </span>
                ) : user && (stats?.totalPlays > 0 || monthlyRecap?.totalPlays > 0 || weeklyRecap?.totalPlays > 0) ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1">
                    <span>✓</span> Verified Data
                  </span>
                ) : user ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                    Verified Telemetry (0 Plays)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-neutral-800 text-neutral-400 border border-neutral-700 uppercase tracking-wider">
                    Guest Session Data
                  </span>
                )}
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
            <button onClick={() => setErrorMessage(null)} className="text-amber-400 hover:text-white ml-2 cursor-pointer">✕</button>
          </div>
        )}

        {/* 2. SUB-HEADER BAR: TABS & DATE RANGE & MONTH SWITCHER */}
        <div className="px-5 py-2.5 bg-[#090a0f] border-b border-neutral-800/60 flex items-center justify-between flex-wrap gap-2">
          {/* Tab buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'daily'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <span>Daily Recap</span>
            </button>
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
              onClick={() => setActiveTab('monthly')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'monthly'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <span>Monthly Recap</span>
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

          {/* Date Range, Month Switcher & Streak Badges */}
          <div className="flex items-center gap-2">
            {streaks && streaks.currentStreak > 0 && (
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 bg-amber-500/15 px-3 py-1 rounded-lg border border-amber-500/30 shadow-sm animate-pulse">
                <span>🔥</span>
                <span>{streaks.currentStreak} Day Streak</span>
              </div>
            )}

            {/* Month Switcher Controls for Monthly Tab */}
            {activeTab === 'monthly' && (
              <div className="flex items-center gap-1 bg-neutral-900/90 border border-neutral-800 px-2 py-0.5 rounded-lg text-xs font-mono">
                <button
                  onClick={() => {
                    let newM = selectedMonth - 1;
                    let newY = selectedYear;
                    if (newM < 1) { newM = 12; newY--; }
                    setSelectedMonth(newM);
                    setSelectedYear(newY);
                  }}
                  title="Previous Month"
                  className="text-neutral-400 hover:text-amber-400 px-1 font-bold cursor-pointer transition"
                >
                  ◀
                </button>
                <span className="text-amber-300 font-bold px-1.5">{monthlyRecap?.monthLabel || `${selectedMonth}/${selectedYear}`}</span>
                <button
                  onClick={() => {
                    let newM = selectedMonth + 1;
                    let newY = selectedYear;
                    if (newM > 12) { newM = 1; newY++; }
                    setSelectedMonth(newM);
                    setSelectedYear(newY);
                  }}
                  title="Next Month"
                  className="text-neutral-400 hover:text-amber-400 px-1 font-bold cursor-pointer transition"
                >
                  ▶
                </button>
              </div>
            )}

            {/* Date Range Pill */}
            <div className="text-xs text-neutral-400 font-mono flex items-center gap-1.5 bg-neutral-900/60 px-3 py-1 rounded-lg border border-neutral-800/60">
              <span>📅</span>
              <span>
                {activeTab === 'daily'
                  ? (dailyRecap?.dateRangeLabel || 'Today')
                  : activeTab === 'recap'
                  ? (weeklyRecap?.dateRangeLabel || 'Current Week')
                  : activeTab === 'monthly'
                  ? (monthlyRecap?.monthLabel || 'This Month')
                  : 'Lifetime Listening'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. MAIN DASHBOARD CONTENT */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[calc(92vh-130px)] custom-scrollbar">
          {/* Daily Listening Summary Banner */}
          {activeTab === 'daily' && dailyRecap?.dailySummary && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/15 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-200 shadow-sm animate-fadeIn">
              <span className="text-xl">✨</span>
              <p className="font-medium leading-relaxed">{dailyRecap.dailySummary}</p>
            </div>
          )}

          {/* TOP SECTION: HERO BANNER + 4 STAT CARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Hero Banner (30% on desktop) */}
            <div className="lg:col-span-4 bg-gradient-to-br from-neutral-900/90 via-[#13141f] to-amber-950/40 border border-amber-500/20 rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between shadow-lg">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight leading-tight">
                  {activeTab === 'daily' ? (
                    <>Your Day <br /></>
                  ) : activeTab === 'recap' ? (
                    <>Your Week <br /></>
                  ) : activeTab === 'monthly' ? (
                    <>{monthlyRecap?.monthLabel || 'Your Month'} <br /></>
                  ) : (
                    <>All-Time <br /></>
                  )}
                  <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
                    in Music
                  </span>
                </h2>
                <p className="text-xs text-neutral-400 mt-1.5 max-w-[220px] leading-relaxed">
                  {activeTab === 'daily'
                    ? 'Genuine beats and memories from your playback today.'
                    : activeTab === 'recap'
                    ? 'Genuine beats and memories from your weekly playback.'
                    : activeTab === 'monthly'
                    ? `Authentic playback memories across ${monthlyRecap?.monthLabel || 'this month'}.`
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
              {/* 1. Listening Hours (Period-Specific) */}
              <div className="bg-[#101118]/80 hover:bg-[#13141f]/90 border border-neutral-800 hover:border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-300 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    {activeTab === 'daily' ? "Today's Hours" : activeTab === 'recap' ? 'Listening Hours' : activeTab === 'monthly' ? 'Monthly Hours' : 'Lifetime Hours'}
                  </span>
                  <span className="text-amber-400 text-sm">🎧</span>
                </div>
                <div className="my-1.5">
                  <p className="text-2xl sm:text-3xl font-black text-white font-display">
                    {activeTab === 'daily'
                      ? fmtHours(dailyRecap?.totalHours)
                      : activeTab === 'recap'
                      ? fmtHours(weeklyRecap?.totalHours)
                      : activeTab === 'monthly'
                      ? fmtHours(monthlyRecap?.totalHours || monthlyRecap?.totalListeningHours)
                      : fmtHours(stats?.totalHours)}h
                  </p>
                  <p className="text-[11px] text-neutral-400 font-medium flex items-center gap-1 mt-0.5">
                    {activeTab === 'daily'
                      ? `${dailyRecap?.totalListeningMinutes || Math.round(Number(dailyRecap?.totalListeningSeconds || 0) / 60)} minutes today`
                      : activeTab === 'recap'
                      ? (weeklyRecap?.hoursTrend ? <span className="text-emerald-400 font-bold">{weeklyRecap.hoursTrend} vs last week</span> : 'Current week')
                      : activeTab === 'monthly'
                      ? `${monthlyRecap?.totalListeningMinutes || Math.round(Number(monthlyRecap?.totalListeningSeconds || 0) / 60)} minutes`
                      : 'Total playback'}
                  </p>
                </div>
                <svg className="w-full h-6 text-amber-500/50" viewBox="0 0 100 25" preserveAspectRatio="none">
                  <path d="M0,20 Q20,5 40,15 T80,8 T100,20" fill="none" stroke="currentColor" strokeWidth="2.5" />
                </svg>
              </div>

              {/* 2. Total Plays (Period-Specific) */}
              <div className="bg-[#101118]/80 hover:bg-[#13141f]/90 border border-neutral-800 hover:border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-300 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    {activeTab === 'daily' ? "Today's Plays" : activeTab === 'recap' ? 'Total Plays' : activeTab === 'monthly' ? 'Monthly Plays' : 'Lifetime Plays'}
                  </span>
                  <span className="text-amber-400 text-sm">▶️</span>
                </div>
                <div className="my-1.5">
                  <p className="text-2xl sm:text-3xl font-black text-white font-display">
                    {activeTab === 'daily'
                      ? (dailyRecap?.totalPlays || 0)
                      : activeTab === 'recap'
                      ? (weeklyRecap?.totalPlays || 0)
                      : activeTab === 'monthly'
                      ? (monthlyRecap?.totalPlays || 0)
                      : (stats?.totalPlays || 0)}
                  </p>
                  <p className="text-[11px] text-neutral-400 font-medium flex items-center gap-1 mt-0.5">
                    {activeTab === 'daily'
                      ? 'Verified plays today'
                      : activeTab === 'recap'
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

              {/* 3. Unique Tracks (Period-Specific) */}
              <div className="bg-[#101118]/80 hover:bg-[#13141f]/90 border border-neutral-800 hover:border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-300 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Unique Tracks</span>
                  <span className="text-amber-400 text-sm">🎵</span>
                </div>
                <div className="my-1.5">
                  <p className="text-2xl sm:text-3xl font-black text-white font-display">
                    {activeTab === 'daily'
                      ? (dailyRecap?.distinctTracksCount || 0)
                      : activeTab === 'recap'
                      ? (weeklyRecap?.distinctTracksCount || 0)
                      : activeTab === 'monthly'
                      ? (monthlyRecap?.distinctTracksCount || 0)
                      : (stats?.distinctTracksCount || 0)}
                  </p>
                  <p className="text-[11px] text-neutral-400 font-medium flex items-center gap-1 mt-0.5">
                    {activeTab === 'daily'
                      ? 'Songs today'
                      : activeTab === 'recap'
                      ? (weeklyRecap?.tracksTrend ? <span className="text-emerald-400 font-bold">{weeklyRecap.tracksTrend} vs last week</span> : 'Distinct songs')
                      : activeTab === 'monthly'
                      ? 'Songs this month'
                      : 'All unique songs'}
                  </p>
                </div>
                <svg className="w-full h-6 text-amber-500/50" viewBox="0 0 100 25" preserveAspectRatio="none">
                  <path d="M0,22 Q30,18 50,8 T100,12" fill="none" stroke="currentColor" strokeWidth="2.5" />
                </svg>
              </div>

              {/* 4. Peak Hour (Daily) / Peak Day (Weekly & Monthly) OR Web Usage (All-Time) */}
              {activeTab === 'daily' ? (
                <div className="bg-[#101118]/80 hover:bg-[#13141f]/90 border border-neutral-800 hover:border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-300 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Peak Hour</span>
                    <span className="text-amber-400 text-sm">⏱️</span>
                  </div>
                  <div className="my-1.5">
                    <p className="text-2xl sm:text-3xl font-black text-amber-400 font-display">
                      {dailyRecap?.peakHour && dailyRecap.peakHour !== 'None' ? dailyRecap.peakHour : 'None'}
                    </p>
                    <p className="text-[11px] text-neutral-300 font-medium mt-0.5">
                      {dailyRecap?.peakHourHours && Number(dailyRecap.peakHourHours) > 0 ? `${fmtHours(dailyRecap.peakHourHours)}h peak` : '0.00h peak'}
                    </p>
                  </div>
                  <div className="text-[9px] text-neutral-400 font-mono">
                    Highest activity today
                  </div>
                </div>
              ) : activeTab === 'recap' || activeTab === 'monthly' ? (
                <div className="bg-[#101118]/80 hover:bg-[#13141f]/90 border border-neutral-800 hover:border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-300 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Peak Day</span>
                    <span className="text-amber-400 text-sm">🔥</span>
                  </div>
                  <div className="my-1.5">
                    <p className="text-2xl sm:text-3xl font-black text-amber-400 font-display">
                      {activeTab === 'recap'
                        ? (weeklyRecap?.peakDay && weeklyRecap.peakDay !== 'None' ? weeklyRecap.peakDay : 'None')
                        : (monthlyRecap?.peakDay && monthlyRecap.peakDay !== 'None' ? monthlyRecap.peakDay : 'None')}
                    </p>
                    <p className="text-[11px] text-neutral-300 font-medium mt-0.5">
                      {activeTab === 'recap'
                        ? (weeklyRecap?.peakDayHours && weeklyRecap.totalListeningSeconds > 0 ? `${fmtHours(weeklyRecap.peakDayHours)}h peak` : '0.00h peak')
                        : (monthlyRecap?.peakDayHours && monthlyRecap.totalListeningSeconds > 0 ? `${fmtHours(monthlyRecap.peakDayHours)}h peak` : '0.00h peak')}
                    </p>
                  </div>
                  <div className="text-[9px] text-neutral-400 font-mono">
                    {activeTab === 'monthly' ? `${monthlyRecap?.monthLabel || 'Selected month'} peak` : 'Current week peak'}
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
                      {fmtHours(stats?.totalActiveWebsiteHours)}h
                    </p>
                    <p className="text-[11px] text-neutral-300 font-medium mt-0.5">
                      {stats?.totalSessions || 0} active sessions
                    </p>
                  </div>
                  <div className="text-[9px] text-neutral-400 font-mono">
                    App presence (distinct from music)
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
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {activeTab === 'daily'
                      ? 'Hourly Activity (Today)'
                      : activeTab === 'recap'
                      ? 'Weekly Listening Activity'
                      : activeTab === 'monthly'
                      ? `Daily Activity (${monthlyRecap?.monthLabel || 'Month'})`
                      : 'Lifetime Activity by Month'}
                  </h4>
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

              {/* Bar Chart Canvas with Responsive X-Axis */}
              <div className="relative pt-4 pb-1 overflow-x-auto custom-scrollbar">
                <div className="h-40 flex items-end justify-between gap-1 px-1 min-w-[240px]">
                  {dailyBars.map((d, i) => {
                    const val = activityMetric === 'hours' ? d.hours : d.plays;
                    const heightPct = val > 0 ? Math.max(10, Math.min(100, Math.round((val / maxChartValue) * 100))) : 4;
                    const isPeak = Boolean(d.isPeak && val > 0);

                    // For monthly charts with 28-31 bars or daily with 24 bars, render compact labels
                    const showLabel = activeTab === 'recap' || activeTab === 'all-time' || (i % (activeTab === 'daily' ? 4 : 5) === 0) || (i === dailyBars.length - 1);

                    return (
                      <div key={d.dayLabel || i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                        {/* Tooltip value */}
                        <span className={`text-[8px] font-mono transition font-semibold ${isPeak ? 'text-amber-400' : 'text-neutral-400'} ${(activeTab === 'monthly' || activeTab === 'daily') && val === 0 ? 'invisible group-hover:visible' : ''}`}>
                          {activityMetric === 'hours' ? `${fmtHours(d.hours)}h` : d.plays}
                        </span>

                        {/* Bar */}
                        <div
                          style={{ height: `${heightPct}%` }}
                          title={`${d.dayShort || d.dayLabel}: ${fmtHours(d.hours)}h (${d.plays} plays)`}
                          className={`w-full rounded-t-sm sm:rounded-t-md transition-all duration-500 ${
                            isPeak
                              ? 'bg-gradient-to-t from-orange-600 via-amber-500 to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                              : val > 0
                                ? 'bg-gradient-to-t from-orange-950/80 via-amber-900/40 to-amber-700/60 group-hover:to-amber-500'
                                : 'bg-neutral-800/40'
                          }`}
                        />

                        {/* X-axis labels */}
                        <div className="text-center leading-tight">
                          <p className={`text-[9px] font-bold ${isPeak ? 'text-amber-400' : 'text-neutral-300'}`}>
                            {showLabel ? d.dayLabel : '·'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom activity callout */}
              <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5 truncate pr-2">
                  <span>🔥</span>
                  <span className="truncate">
                    {activeTab === 'daily' ? (
                      <>Today: <strong className="text-amber-300">{fmtHours(dailyRecap?.totalHours)}h</strong> across {dailyRecap?.totalPlays || 0} plays</>
                    ) : activeTab === 'all-time' ? (
                      <>Lifetime: <strong className="text-amber-300">{fmtHours(stats?.totalHours)}h</strong> across {stats?.totalPlays || 0} plays • Web: <strong className="text-amber-300">{fmtHours(stats?.totalActiveWebsiteHours)}h</strong></>
                    ) : activeTab === 'monthly' ? (
                      <>Listened <strong className="text-amber-300">{fmtHours(monthlyRecap?.totalHours || monthlyRecap?.totalListeningHours)}h</strong> in {monthlyRecap?.monthLabel || 'this month'}</>
                    ) : (
                      <>Listened <strong className="text-amber-300">{fmtHours(weeklyRecap?.totalHours)}h</strong> this week</>
                    )}
                  </span>
                </span>
                <span className="text-neutral-400 font-mono text-[11px] shrink-0">
                  {activeTab === 'recap' && weeklyRecap?.hoursTrend ? (
                    <span className="text-emerald-400 font-bold">{weeklyRecap.hoursTrend}</span>
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
                    {activeTab === 'daily'
                      ? 'Top Songs Today'
                      : activeTab === 'recap'
                      ? 'Top Songs This Week'
                      : activeTab === 'monthly'
                      ? `Top Songs (${monthlyRecap?.monthLabel || 'This Month'})`
                      : 'Top Songs (All-Time)'}
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-neutral-400 font-mono">
                  {topTracksList.length} tracks
                </span>
              </div>

              {/* List of Songs */}
              <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[260px] custom-scrollbar pr-1">
                {topTracksList.slice(0, 5).map((track, idx) => {
                  const isCurrent = currentSong && (currentSong.id === track.id || currentSong.videoId === track.id || currentSong.videoId === track.videoId);
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
                          {track.thumbnail || track.image ? (
                            <img src={track.thumbnail || track.image} alt={track.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs">🎶</div>
                          )}
                        </div>

                        {/* Title & Artist */}
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${isCurrent ? 'text-amber-300' : 'text-white'}`}>
                            {track.title || 'Unknown Track'}
                          </p>
                          <p className="text-[10px] text-neutral-400 truncate">{track.artist || track.name || 'Unknown Artist'}</p>
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
                    <p>No verified plays in this period.</p>
                    <p className="text-[10px] text-neutral-400 mt-1">Listen to music for 30+ seconds to generate rankings.</p>
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
                    {activeTab === 'daily'
                      ? 'Top Artists Today'
                      : activeTab === 'recap'
                      ? 'Top Artists This Week'
                      : activeTab === 'monthly'
                      ? `Top Artists (${monthlyRecap?.monthLabel || 'This Month'})`
                      : 'Top Artists (All-Time)'}
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
                  const artistDisplayName = (artist.artist || artist.name || 'Unknown Artist').trim();
                  const avatarInitial = artistDisplayName.replace(/[^a-zA-Z0-9]/g, '')[0]?.toUpperCase() || 'A';

                  return (
                    <div key={artistDisplayName + idx} className="flex items-center gap-3">
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
                          <img src={artist.avatar} alt={artistDisplayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-amber-400">{avatarInitial}</span>
                        )}
                      </div>

                      {/* Name & Progress Bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-white truncate max-w-[120px]" title={artistDisplayName}>
                            {artistDisplayName}
                          </span>
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

          {/* BOTTOM SECTION: MUSIC VIBES (7 cols) + SHARE YOUR RECAP (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Card 1: Music Vibes */}
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
                  <p className="text-[10px] text-neutral-400">
                    {activeTab === 'monthly'
                      ? `Create an authentic story card of your ${monthlyRecap?.monthLabel || 'month'}.`
                      : activeTab === 'all-time'
                      ? 'Create an authentic story card of your lifetime stats.'
                      : 'Create and share an authentic summary of your music week.'}
                  </p>
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
            <span>Genuine User Listening Telemetry • Period Isolated</span>
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
