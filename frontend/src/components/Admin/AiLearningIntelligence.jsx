import React, { useState, useEffect } from 'react';
import {
  Brain,
  Cpu,
  Activity,
  Users,
  Search,
  RefreshCw,
  TrendingUp,
  BarChart2,
  Clock,
  Sparkles,
  ShieldAlert,
  Flame,
  Radio,
  Compass,
  ListMusic,
  Heart,
  SkipForward,
  Repeat,
  Trash2,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Layers,
  Sliders,
  Filter
} from 'lucide-react';
import { learningIntelligenceClient } from '../../services/learningIntelligenceClient';

export default function AiLearningIntelligence({ token, backendUrl, showToast }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users'
  const [overview, setOverview] = useState(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Users Tab State
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // User Detail Modal / Screen
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Fetch Overview Data
  const loadOverview = async () => {
    setIsLoadingOverview(true);
    try {
      const data = await learningIntelligenceClient.getOverview(backendUrl, token);
      setOverview(data);
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsLoadingOverview(false);
    }
  };

  // Fetch Users List
  const loadUsers = async (p = 1, q = searchQuery) => {
    setIsLoadingUsers(true);
    try {
      const data = await learningIntelligenceClient.getUsers(backendUrl, token, {
        search: q,
        page: p,
        limit: 12
      });
      setUsers(data.users || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      setPage(p);
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch Specific User Profile
  const loadUserDetail = async (userId) => {
    setIsLoadingDetail(true);
    setSelectedUserId(userId);
    try {
      const data = await learningIntelligenceClient.getUserDetail(backendUrl, token, userId);
      setUserDetail(data);
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
      setSelectedUserId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Initial mount load
  useEffect(() => {
    loadOverview();
  }, [backendUrl, token]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers(1, searchQuery);
    }
  }, [activeTab]);

  // Trigger immediate batch processing
  const handleProcessBatchNow = async () => {
    setIsProcessingBatch(true);
    try {
      const res = await learningIntelligenceClient.processBatchNow(backendUrl, token);
      if (showToast) {
        showToast(`Batch processed successfully: ${res.result?.processedCount || 0} events learned!`, 'success');
      }
      loadOverview();
      if (selectedUserId) {
        loadUserDetail(selectedUserId);
      } else if (activeTab === 'users') {
        loadUsers(page, searchQuery);
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Handle Profile Deletion (Privacy compliance)
  const handleDeleteProfile = async () => {
    if (!selectedUserId) return;
    setIsDeletingProfile(true);
    try {
      await learningIntelligenceClient.deleteUserProfile(backendUrl, token, selectedUserId);
      if (showToast) showToast('User learning profile and derived intelligence successfully deleted', 'success');
      setDeleteModalOpen(false);
      setUserDetail(null);
      setSelectedUserId(null);
      loadOverview();
      loadUsers(page, searchQuery);
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsDeletingProfile(false);
    }
  };

  const getConfidenceBadgeColor = (level) => {
    switch (level) {
      case 'very_high':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'high':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-neutral-500/10 text-neutral-400 border-neutral-700/50';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-neutral-100 pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/80 border border-neutral-800 p-4 sm:p-6 rounded-3xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-2xl shadow-lg shadow-purple-500/20 text-white">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">AI Learning Intelligence Engine</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300">
                Passive Mode
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Continuous per-user behavior observation, weighted affinity scoring, and intelligence audit trail.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleProcessBatchNow}
            disabled={isProcessingBatch}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessingBatch ? 'animate-spin' : ''}`} />
            <span>{isProcessingBatch ? 'Processing Batch...' : 'Process Pending Batch'}</span>
          </button>

          <button
            onClick={() => {
              loadOverview();
              if (activeTab === 'users') loadUsers(page, searchQuery);
            }}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TOP SUB-NAV TABS */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('overview');
              setSelectedUserId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'overview' && !selectedUserId
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Global Overview & Analytics</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('users');
              setSelectedUserId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'users' && !selectedUserId
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Individual User Profiles</span>
          </button>
        </div>

        {overview?.engine && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px] text-neutral-300">v{overview.engine.version} ({overview.engine.status})</span>
          </div>
        )}
      </div>

      {/* VIEW 1: SINGLE USER DETAIL SCREEN */}
      {selectedUserId ? (
        <div className="space-y-6">
          <button
            onClick={() => {
              setSelectedUserId(null);
              setUserDetail(null);
            }}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Users Directory</span>
          </button>

          {isLoadingDetail || !userDetail ? (
            <div className="flex flex-col items-center justify-center p-16 text-neutral-500 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
              <p className="text-xs">Loading learned intelligence profile...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* User Hero Banner */}
              <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-purple-950/40 border border-neutral-800 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-extrabold text-2xl">
                    {userDetail.user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-extrabold text-white">{userDetail.user?.username}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                        ID: {userDetail.user?.id}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Member since {new Date(userDetail.user?.registeredAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="bg-neutral-900/90 border border-neutral-800 px-4 py-2 rounded-2xl">
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold block">Learning Confidence</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-bold text-white">
                        {Math.round((userDetail.profile?.confidenceScore || 0) * 100)}%
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getConfidenceBadgeColor(userDetail.profile?.confidenceLevel)}`}>
                        {userDetail.profile?.confidenceLevel || 'low'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-neutral-900/90 border border-neutral-800 px-4 py-2 rounded-2xl">
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold block">Observed Events</span>
                    <span className="text-sm font-bold text-white mt-0.5 block">
                      {userDetail.profile?.totalEventsObserved || 0}
                    </span>
                  </div>

                  <button
                    onClick={() => setDeleteModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Profile</span>
                  </button>
                </div>
              </div>

              {/* CORE AFFINITIES: GENRES & ARTISTS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Learned Genres */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ListMusic className="w-4 h-4 text-purple-400" />
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">Learned Genres</h4>
                    </div>
                    <span className="text-[11px] text-neutral-500">{userDetail.profile?.learnedGenres?.length || 0} discovered</span>
                  </div>

                  {(!userDetail.profile?.learnedGenres || userDetail.profile.learnedGenres.length === 0) ? (
                    <p className="text-xs text-neutral-500 py-6 text-center">No genre affinity observed yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {userDetail.profile.learnedGenres.slice(0, 7).map((genre, idx) => (
                        <div key={idx} className="bg-neutral-950/60 border border-neutral-800/80 p-3 rounded-2xl flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-neutral-200">{genre.name}</span>
                              <span className="text-[10px] text-purple-400 font-mono">Score: {genre.score.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-neutral-500 mt-1">
                              <span>Plays: {genre.playCount}</span>
                              <span>Skips: {genre.skipCount}</span>
                              <span>Confidence: {Math.round(genre.confidence * 100)}%</span>
                            </div>
                          </div>
                          <div className="w-16 bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-purple-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, Math.max(10, genre.confidence * 100))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Favorite Artists */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">Favourite Artists</h4>
                    </div>
                    <span className="text-[11px] text-neutral-500">{userDetail.profile?.favoriteArtists?.length || 0} tracked</span>
                  </div>

                  {(!userDetail.profile?.favoriteArtists || userDetail.profile.favoriteArtists.length === 0) ? (
                    <p className="text-xs text-neutral-500 py-6 text-center">No artist affinity observed yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {userDetail.profile.favoriteArtists.slice(0, 7).map((artist, idx) => (
                        <div key={idx} className="bg-neutral-950/60 border border-neutral-800/80 p-3 rounded-2xl flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-neutral-200">{artist.name}</span>
                              {artist.liked && <Heart className="w-3 h-3 text-pink-400 fill-pink-400" />}
                              <span className="text-[10px] text-amber-400 font-mono">Score: {artist.score.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-neutral-500 mt-1">
                              <span>Plays: {artist.playCount}</span>
                              <span>Completed: {artist.completedCount}</span>
                              <span>Skips: {artist.skipCount}</span>
                              {artist.replayCount > 0 && <span>Replays: {artist.replayCount}</span>}
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getConfidenceBadgeColor(artist.confidence > 0.7 ? 'very_high' : (artist.confidence > 0.4 ? 'medium' : 'low'))}`}>
                            {Math.round(artist.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SECONDARY TRAITS: LANGUAGES, ERAS & MOODS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Languages */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs font-bold text-neutral-300 uppercase">Preferred Languages</span>
                  </div>
                  <div className="space-y-1.5">
                    {userDetail.profile?.preferredLanguages?.slice(0, 4).map((lang, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-neutral-800/60 last:border-0">
                        <span className="text-neutral-300">{lang.language}</span>
                        <span className="text-neutral-500 font-mono text-[11px]">{lang.count} events</span>
                      </div>
                    ))}
                    {(!userDetail.profile?.preferredLanguages || userDetail.profile.preferredLanguages.length === 0) && (
                      <p className="text-[11px] text-neutral-600">None detected</p>
                    )}
                  </div>
                </div>

                {/* Eras */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-neutral-300 uppercase">Preferred Eras</span>
                  </div>
                  <div className="space-y-1.5">
                    {userDetail.profile?.preferredEras?.slice(0, 4).map((era, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-neutral-800/60 last:border-0">
                        <span className="text-neutral-300">{era.era}</span>
                        <span className="text-neutral-500 font-mono text-[11px]">{era.count} events</span>
                      </div>
                    ))}
                    {(!userDetail.profile?.preferredEras || userDetail.profile.preferredEras.length === 0) && (
                      <p className="text-[11px] text-neutral-600">None detected</p>
                    )}
                  </div>
                </div>

                {/* Moods */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    <span className="text-xs font-bold text-neutral-300 uppercase">Mood Preferences</span>
                  </div>
                  <div className="space-y-1.5">
                    {userDetail.profile?.moodPreferences?.slice(0, 4).map((mood, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-neutral-800/60 last:border-0">
                        <span className="text-neutral-300">{mood.mood}</span>
                        <span className="text-neutral-500 font-mono text-[11px]">{mood.count} events</span>
                      </div>
                    ))}
                    {(!userDetail.profile?.moodPreferences || userDetail.profile.moodPreferences.length === 0) && (
                      <p className="text-[11px] text-neutral-600">None detected</p>
                    )}
                  </div>
                </div>
              </div>

              {/* BEHAVIOR SIGNALS & INTEREST TIMELINE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Signals Summary */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-3xl space-y-3">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-purple-400" />
                    <span>Signals Classification</span>
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Strong Positive Signals</span>
                      <div className="flex flex-wrap gap-1.5">
                        {userDetail.profile?.signalsSummary?.strongSignals?.map((sig, i) => (
                          <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                            {sig}
                          </span>
                        ))}
                        {(!userDetail.profile?.signalsSummary?.strongSignals || userDetail.profile.signalsSummary.strongSignals.length === 0) && (
                          <span className="text-neutral-600 text-[11px]">None classified yet</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">Uncertain / Mixed Signals</span>
                      <div className="flex flex-wrap gap-1.5">
                        {userDetail.profile?.signalsSummary?.uncertainSignals?.map((sig, i) => (
                          <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                            {sig}
                          </span>
                        ))}
                        {(!userDetail.profile?.signalsSummary?.uncertainSignals || userDetail.profile.signalsSummary.uncertainSignals.length === 0) && (
                          <span className="text-neutral-600 text-[11px]">None classified</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Short-Term vs Long-Term Interests */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-3xl space-y-3">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>Short-Term vs Long-Term Interests</span>
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-1">Short-Term Interests (Past 7 Days)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {userDetail.profile?.interests?.shortTerm?.map((item, i) => (
                          <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                            {item.topic} ({item.category})
                          </span>
                        ))}
                        {(!userDetail.profile?.interests?.shortTerm || userDetail.profile.interests.shortTerm.length === 0) && (
                          <span className="text-neutral-600 text-[11px]">No short term interests</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-purple-400 block mb-1">Long-Term Sustained Preferences</span>
                      <div className="flex flex-wrap gap-1.5">
                        {userDetail.profile?.interests?.longTerm?.map((item, i) => (
                          <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">
                            {item.topic} ({item.category})
                          </span>
                        ))}
                        {(!userDetail.profile?.interests?.longTerm || userDetail.profile.interests.longTerm.length === 0) && (
                          <span className="text-neutral-600 text-[11px]">No sustained long term preferences</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LISTENING PATTERNS & HABITS */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Peak Listening Time</span>
                  <span className="text-sm font-bold text-white capitalize mt-1 block">
                    {userDetail.profile?.listeningTimePatterns?.peakTimeOfDay || 'Undetermined'}
                  </span>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Total Listening Hours</span>
                  <span className="text-sm font-bold text-white mt-1 block">
                    {userDetail.profile?.listeningTimePatterns?.totalListeningHours || 0} hrs
                  </span>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Replay Affinity</span>
                  <span className="text-sm font-bold text-white mt-1 block">
                    {Math.round((userDetail.profile?.repeatedListening?.replayRatio || 0) * 100)}% ratio
                  </span>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Skip Ratio</span>
                  <span className="text-sm font-bold text-white mt-1 block">
                    {Math.round((userDetail.profile?.skipPatterns?.skipRate || 0) * 100)}%
                  </span>
                </div>
              </div>

              {/* RECENT LEARNING AUDIT LOGS */}
              <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Recent Learning Updates & Audit Trail</span>
                  </h4>
                  <span className="text-[11px] text-neutral-500">Last 10 update batches</span>
                </div>

                {(!userDetail.recentUpdates || userDetail.recentUpdates.length === 0) ? (
                  <p className="text-xs text-neutral-500 py-4 text-center">No learning batches logged yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 text-neutral-500 text-[10px] uppercase">
                          <th className="pb-2">Timestamp</th>
                          <th className="pb-2">Batch ID</th>
                          <th className="pb-2">Events Processed</th>
                          <th className="pb-2">Duration</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2">Summary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60 font-mono">
                        {userDetail.recentUpdates.map((log) => (
                          <tr key={log.id} className="hover:bg-neutral-800/30">
                            <td className="py-2.5 text-neutral-400 text-[11px]">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="py-2.5 text-purple-400 text-[11px]">{log.batchId}</td>
                            <td className="py-2.5 text-neutral-200">{log.eventsCount}</td>
                            <td className="py-2.5 text-neutral-400">{log.durationMs}ms</td>
                            <td className="py-2.5">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                                log.status === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                              }`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="py-2.5 text-neutral-300 text-[11px] truncate max-w-[200px]">
                              Genre: {log.changes?.topGenre || 'N/A'}, Artist: {log.changes?.topArtist || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'users' ? (
        /* VIEW 2: USERS SEARCH & DIRECTORY */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/60 border border-neutral-800 p-4 rounded-2xl">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search user by username or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  loadUsers(1, e.target.value);
                }}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition"
              />
            </div>
            <span className="text-xs text-neutral-400 font-mono">
              Total Tracked Users: {pagination.total}
            </span>
          </div>

          {isLoadingUsers ? (
            <div className="flex flex-col items-center justify-center p-16 text-neutral-500 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
              <p className="text-xs">Loading user directories...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 bg-neutral-900/40 rounded-3xl border border-neutral-800">
              <p className="text-xs">No users found matching query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((u) => (
                <div
                  key={u.id}
                  onClick={() => loadUserDetail(u.id)}
                  className="bg-neutral-900/80 hover:bg-neutral-800/80 border border-neutral-800 hover:border-purple-500/50 p-4 rounded-2xl transition cursor-pointer flex flex-col justify-between group space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                        {u.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block group-hover:text-purple-300 transition">
                          {u.username}
                        </span>
                        <span className="text-[10px] text-neutral-500">{u.role}</span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getConfidenceBadgeColor(u.confidenceLevel)}`}>
                      {u.hasProfile ? `${Math.round(u.confidenceScore * 100)}%` : 'New'}
                    </span>
                  </div>

                  <div className="bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/60 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Learned Genre:</span>
                      <span className="text-purple-300 font-medium truncate max-w-[120px]">{u.topGenre || 'None yet'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Top Artist:</span>
                      <span className="text-amber-300 font-medium truncate max-w-[120px]">{u.topArtist || 'None yet'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Events Observed:</span>
                      <span className="text-neutral-300 font-mono">{u.totalEvents}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1">
                    <span>{u.lastLearnedAt ? `Updated ${new Date(u.lastLearnedAt).toLocaleDateString()}` : 'Idle'}</span>
                    <span className="text-purple-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-1 transition">
                      Inspect Profile <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                disabled={page <= 1}
                onClick={() => loadUsers(page - 1, searchQuery)}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs text-neutral-400 font-mono px-2">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => loadUsers(page + 1, searchQuery)}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 3: GLOBAL OVERVIEW DASHBOARD */
        <div className="space-y-6">
          {isLoadingOverview || !overview ? (
            <div className="flex flex-col items-center justify-center p-16 text-neutral-500 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
              <p className="text-xs">Loading intelligence metrics and model telemetry...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* TOP LEVEL KPIS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold block">Tracked Users</span>
                  <span className="text-xl font-extrabold text-white mt-1 block">
                    {overview.metrics?.totalTrackedUsers || 0}
                  </span>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold block">Active Profiles</span>
                  <span className="text-xl font-extrabold text-purple-400 mt-1 block">
                    {overview.metrics?.usersWithLearningProfiles || 0}
                  </span>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold block">Recorded Events</span>
                  <span className="text-xl font-extrabold text-white mt-1 block">
                    {overview.metrics?.totalRecordedEvents || 0}
                  </span>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold block">Processed Events</span>
                  <span className="text-xl font-extrabold text-emerald-400 mt-1 block">
                    {overview.metrics?.processedEventsCount || 0}
                  </span>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold block">Pending Queue</span>
                  <span className="text-xl font-extrabold text-amber-400 mt-1 block">
                    {overview.metrics?.pendingEventsCount || 0}
                  </span>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold block">Model Health</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-bold text-white capitalize">{overview.engine?.status || 'Active'}</span>
                  </div>
                </div>
              </div>

              {/* CONFIDENCE & BEHAVIOR TELEMETRY */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Confidence Score Distribution */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-purple-400" />
                      <span>Learning Confidence Distribution</span>
                    </h4>
                    <span className="text-[11px] text-neutral-500">Across All Users</span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: 'Very High Confidence (85-100%)', key: 'very_high', color: 'bg-emerald-500' },
                      { label: 'High Confidence (60-84%)', key: 'high', color: 'bg-cyan-500' },
                      { label: 'Medium Confidence (30-59%)', key: 'medium', color: 'bg-amber-500' },
                      { label: 'Low / Exploratory (<30%)', key: 'low', color: 'bg-neutral-600' }
                    ].map((item) => {
                      const count = overview.confidenceDistribution?.[item.key] || 0;
                      const total = overview.metrics?.usersWithLearningProfiles || 1;
                      const pct = Math.round((count / (total || 1)) * 100);
                      return (
                        <div key={item.key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-300">{item.label}</span>
                            <span className="text-neutral-400 font-mono">{count} users ({pct}%)</span>
                          </div>
                          <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-800">
                            <div className={`${item.color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Behavior Trends (Music vs Discovery vs Website) */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <span>Observed Behavior Telemetry</span>
                    </h4>
                    <span className="text-[11px] text-neutral-500">Category breakdown</span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: 'Music Playback Events', key: 'music', color: 'bg-purple-500' },
                      { label: 'Discovery & Searches', key: 'discovery', color: 'bg-indigo-500' },
                      { label: 'Website & Feature Navigation', key: 'website', color: 'bg-cyan-500' }
                    ].map((item) => {
                      const count = overview.behaviorTrends?.[item.key] || 0;
                      const total = overview.metrics?.totalRecordedEvents || 1;
                      const pct = Math.round((count / (total || 1)) * 100);
                      return (
                        <div key={item.key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-300">{item.label}</span>
                            <span className="text-neutral-400 font-mono">{count} events ({pct}%)</span>
                          </div>
                          <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-800">
                            <div className={`${item.color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* MOST COMMON PREFERENCES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Most Common Genres */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-3xl space-y-4">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-purple-400" />
                    <span>Global Top Learned Genres</span>
                  </h4>

                  {(!overview.mostCommonGenres || overview.mostCommonGenres.length === 0) ? (
                    <p className="text-xs text-neutral-500 py-4 text-center">No genre preferences aggregated yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {overview.mostCommonGenres.map((g, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-lg bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-400 font-mono">
                              #{i + 1}
                            </span>
                            <span className="font-semibold text-neutral-200">{g.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-neutral-400 font-mono text-[11px]">
                            <span>{g.userCount} users</span>
                            <span className="text-purple-400">Score: {g.avgScore}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Most Common Artists */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-3xl space-y-4">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>Global Top Learned Artists</span>
                  </h4>

                  {(!overview.mostCommonArtists || overview.mostCommonArtists.length === 0) ? (
                    <p className="text-xs text-neutral-500 py-4 text-center">No artist preferences aggregated yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {overview.mostCommonArtists.map((a, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-lg bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-400 font-mono">
                              #{i + 1}
                            </span>
                            <span className="font-semibold text-neutral-200">{a.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-neutral-400 font-mono text-[11px]">
                            <span>{a.userCount} users</span>
                            <span className="text-amber-400">Score: {a.avgScore}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RECENT GLOBAL LEARNING UPDATES */}
              <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Real-Time Learning Updates Timeline</span>
                  </h4>
                  <span className="text-[11px] text-neutral-500">Live processing records</span>
                </div>

                {(!overview.recentLearningUpdates || overview.recentLearningUpdates.length === 0) ? (
                  <p className="text-xs text-neutral-500 py-6 text-center">No learning batches recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 text-neutral-500 text-[10px] uppercase">
                          <th className="pb-2">Timestamp</th>
                          <th className="pb-2">User</th>
                          <th className="pb-2">Batch ID</th>
                          <th className="pb-2">Events</th>
                          <th className="pb-2">Latency</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60 font-mono">
                        {overview.recentLearningUpdates.map((u) => (
                          <tr key={u.id} className="hover:bg-neutral-800/30">
                            <td className="py-2.5 text-neutral-400 text-[11px]">
                              {new Date(u.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="py-2.5 text-white font-sans font-medium">{u.username}</td>
                            <td className="py-2.5 text-purple-400 text-[11px]">{u.batchId}</td>
                            <td className="py-2.5 text-neutral-200">{u.eventsCount}</td>
                            <td className="py-2.5 text-neutral-400">{u.durationMs}ms</td>
                            <td className="py-2.5">
                              <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-bold bg-emerald-500/20 text-emerald-300">
                                {u.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 max-w-md w-full p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Delete User Learning Profile?</h3>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              This will permanently wipe all recorded behavior events, learned affinities, confidence scores, and update logs for user <span className="font-bold text-white">"{userDetail?.user?.username}"</span>.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProfile}
                disabled={isDeletingProfile}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
              >
                {isDeletingProfile ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

