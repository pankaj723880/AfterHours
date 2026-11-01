import React, { useState, useEffect, useCallback } from 'react';
import {
  Mic,
  Shield,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  UserCheck,
  Settings,
  Sliders,
  Radio
} from 'lucide-react';
import { safeParseJsonResponse } from '../../utils/errorHandler';

export default function VoiceControlManagement({ token, backendUrl, showToast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Configuration state
  const [enabled, setEnabled] = useState(true);
  const [globalRollout, setGlobalRollout] = useState(false);
  const [adminAccess, setAdminAccess] = useState(true);

  // Statistics state
  const [stats, setStats] = useState({
    featureStatus: 'Enabled',
    rolloutStatus: 'Admin Only',
    adminAccessStatus: 'Enabled',
    totalEligibleUsers: 0,
    usersWithAccess: 0,
    lastConfigurationUpdate: null,
    lastUpdatedBy: 'System'
  });

  const cleanBackendUrl = (backendUrl && backendUrl.trim().startsWith('http'))
    ? backendUrl.trim().replace(/\/+$/, '')
    : '';

  const fetchConfiguration = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/features/voice-control`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to fetch voice control configuration');
      if (parsed.ok && parsed.data) {
        const { config, stats: newStats } = parsed.data;
        if (config) {
          setEnabled(Boolean(config.enabled));
          setGlobalRollout(Boolean(config.globalRollout));
          setAdminAccess(Boolean(config.adminAccess));
        }
        if (newStats) {
          setStats(newStats);
        }
      } else {
        setError(parsed?.error || 'Failed to retrieve configuration');
      }
    } catch (err) {
      console.error('[VoiceControlManagement] Fetch error:', err);
      setError(err.message || 'Network error fetching configuration');
    } finally {
      setLoading(false);
    }
  }, [cleanBackendUrl, token]);

  useEffect(() => {
    fetchConfiguration();
  }, [fetchConfiguration]);

  const handleUpdateConfig = async (newEnabled, newGlobalRollout, newAdminAccess) => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/features/voice-control`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          enabled: newEnabled,
          globalRollout: newGlobalRollout,
          adminAccess: newAdminAccess
        })
      });

      const parsed = await safeParseJsonResponse(res, 'Failed to update voice control configuration');
      if (parsed.ok && parsed.data) {
        setEnabled(newEnabled);
        setGlobalRollout(newGlobalRollout);
        setAdminAccess(newAdminAccess);
        if (parsed.data.stats) {
          setStats(parsed.data.stats);
        }
        if (showToast) {
          showToast('Voice Control settings updated & broadcast to all clients', 'success');
        }
      } else {
        if (showToast) {
          showToast(parsed?.error || 'Failed to update configuration', 'error');
        }
      }
    } catch (err) {
      console.error('[VoiceControlManagement] Update error:', err);
      if (showToast) {
        showToast(err.message || 'Network error updating configuration', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return 'Never';
    try {
      const d = new Date(dateVal);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateVal);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-neutral-900 to-neutral-900/90 border border-amber-500/20 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Voice Control Management</h2>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                enabled
                  ? globalRollout
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {enabled ? (globalRollout ? 'Public Rollout' : 'Admin Only Beta') : 'Feature Disabled'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Admin-controlled voice recognition, language parsing, and gradual rollout mechanism
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={loading || saving}
          onClick={fetchConfiguration}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-800 transition cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Feature Toggles Card */}
      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-5 sm:p-6 backdrop-blur-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          Feature Controls & Rollout Toggles
        </h3>

        <div className="divide-y divide-neutral-800/80">
          {/* Toggle A: Master Feature Toggle */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Voice Control Feature</span>
                <span className="text-[10px] uppercase font-semibold text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                  Master Switch
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Master switch for the entire voice recognition engine. When OFF, voice control is completely disabled across Loopra for everyone including administrators.
              </p>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleUpdateConfig(!enabled, globalRollout, adminAccess)}
              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                enabled ? 'bg-amber-500' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-neutral-950 shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Toggle B: Global User Rollout Toggle */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Enable Voice Control for All Users</span>
                <span className="text-[10px] uppercase font-semibold text-cyan-400/90 bg-cyan-400/10 px-1.5 py-0.5 rounded border border-cyan-400/20">
                  Public Rollout
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                When OFF, only authorized administrators can access Voice Control. When ON, all authenticated users receive access (subject to the master toggle).
              </p>
            </div>

            <button
              type="button"
              disabled={saving || !enabled}
              onClick={() => handleUpdateConfig(enabled, !globalRollout, adminAccess)}
              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed ${
                globalRollout ? 'bg-emerald-500' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-neutral-950 shadow ring-0 transition duration-200 ease-in-out ${
                  globalRollout ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Toggle C: Admin Access Toggle */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Allow Admin Access</span>
                <span className="text-[10px] uppercase font-semibold text-purple-400/90 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">
                  Admin Testing
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Controls whether administrators can use Voice Control. Keep ON to test speech commands, language switching, and voice playback controls.
              </p>
            </div>

            <button
              type="button"
              disabled={saving || !enabled}
              onClick={() => handleUpdateConfig(enabled, globalRollout, !adminAccess)}
              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed ${
                adminAccess ? 'bg-amber-500' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-neutral-950 shadow ring-0 transition duration-200 ease-in-out ${
                  adminAccess ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* D. Current Rollout Status Card */}
      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-5 sm:p-6 backdrop-blur-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" />
          Current Rollout Status & Live Metrics
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Feature Status */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/70">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span>Feature Status</span>
              {enabled ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className={`text-base font-extrabold ${enabled ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.featureStatus || (enabled ? 'Enabled' : 'Disabled')}
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              {enabled ? 'Voice engine is operational' : 'Globally turned off'}
            </p>
          </div>

          {/* 2. Rollout Status */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/70">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span>Rollout Status</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-base font-extrabold text-amber-400">
              {stats.rolloutStatus || (globalRollout ? 'All Users' : 'Admin Only')}
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              {globalRollout ? 'Available to all logged-in users' : 'Restricted to administrators'}
            </p>
          </div>

          {/* 3. Admin Access */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/70">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span>Admin Access</span>
              <UserCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div className={`text-base font-extrabold ${adminAccess ? 'text-purple-400' : 'text-neutral-500'}`}>
              {stats.adminAccessStatus || (adminAccess ? 'Enabled' : 'Disabled')}
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              {adminAccess ? 'Admins can use voice control' : 'Admins cannot use voice control'}
            </p>
          </div>

          {/* 4. Users with Feature Access */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/70">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span>Users with Access</span>
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-base font-extrabold text-white">
              {stats.usersWithAccess}{' '}
              <span className="text-xs font-normal text-neutral-400">/ {stats.totalEligibleUsers} eligible</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Real-time active database count
            </p>
          </div>
        </div>

        {/* Audit Meta Row */}
        <div className="mt-4 pt-4 border-t border-neutral-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            <span>
              Last Configuration Update:{' '}
              <strong className="text-neutral-300 font-semibold">{formatDate(stats.lastConfigurationUpdate)}</strong>
            </span>
          </div>
          <div>
            Last Updated By:{' '}
            <strong className="text-amber-400 font-semibold">{stats.lastUpdatedBy || 'System'}</strong>
          </div>
        </div>
      </div>

      {/* Permission Logic Reference Info Box */}
      <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-xs text-neutral-400 leading-relaxed space-y-2">
        <div className="font-bold text-neutral-300 flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-amber-400" />
          <span>Real-time Permission Hierarchy</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-neutral-400 text-[11px]">
          <li><strong>Master OFF:</strong> Voice control denied to all users (including admins).</li>
          <li><strong>Admin Access:</strong> Authorized administrators can test speech input, Hindi/English parsing, and voice playback controls.</li>
          <li><strong>Global Rollout ON:</strong> All authenticated users receive access to voice search throughout Loopra.</li>
          <li><strong>Real-time Revocation:</strong> Turning OFF rollout instantly revokes access and closes active voice sessions on connected devices without page refresh.</li>
        </ul>
      </div>
    </div>
  );
}
