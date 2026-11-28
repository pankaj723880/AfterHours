import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, RefreshCw, Globe, Navigation, Power, Radio } from 'lucide-react';
import { getApiUrl } from '../../utils/apiUrl';
import { useUiConfig } from '../../context/UiConfigContext';
import { socket as fallbackSocket } from '../../App';

export default function RegionalLocationsAnalytics({ token, backendUrl, socket }) {
  const { isVisible, updateVisibility } = useUiConfig();
  const isRegionalEnabled = isVisible('section.regionalMusic') !== false;
  const [isToggling, setIsToggling] = useState(false);
  const [data, setData] = useState({ total: 0, byCountry: [], byRegion: [], byCity: [], recentLocations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLocations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const endpoint = backendUrl
        ? `${String(backendUrl).replace(/\/$/, '')}/api/admin/locations`
        : getApiUrl('/api/admin/locations');
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Location API returned non-JSON response (HTTP ${res.status}). Check backend/proxy URL.`);
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to load location analytics (HTTP ${res.status})`);
      }
      setData(json);
    } catch (err) {
      setError(err.message || 'Unable to fetch regional locations');
    } finally {
      setLoading(false);
    }
  }, [token, backendUrl]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Real-time live location reporting over Socket.io
  useEffect(() => {
    const activeSocket = socket || fallbackSocket;
    if (!activeSocket) return;

    const handleLocationRecorded = (payload) => {
      const newLoc = payload?.location;
      if (!newLoc || !newLoc._id) return;

      setData((prev) => {
        const prevRecent = prev.recentLocations || [];
        if (prevRecent.some(r => r._id === newLoc._id)) return prev;

        return {
          ...prev,
          total: (prev.total || 0) + 1,
          recentLocations: [newLoc, ...prevRecent].slice(0, 50)
        };
      });
    };

    activeSocket.on('location:recorded', handleLocationRecorded);
    return () => {
      activeSocket.off('location:recorded', handleLocationRecorded);
    };
  }, [socket]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              <span>User Locations & Regional Analytics</span>
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real-time permitted user locations sent on every app open with exact GPS coordinates & district/sub-region
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={isToggling}
            onClick={async () => {
              setIsToggling(true);
              try {
                await updateVisibility({ 'section.regionalMusic': !isRegionalEnabled }, token);
              } finally {
                setIsToggling(false);
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50 ${
              isRegionalEnabled
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40'
            }`}
            title="Toggle Location Prompt & Home Regional Music Section"
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isRegionalEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={fetchLocations}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white border border-neutral-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800">
          <p className="text-[11px] font-mono uppercase text-neutral-400">Permitted Locations</p>
          <p className="text-2xl font-black text-white mt-1">{data.total || 0}</p>
        </div>
        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800">
          <p className="text-[11px] font-mono uppercase text-neutral-400">Top Country</p>
          <p className="text-lg font-bold text-amber-400 mt-1 truncate">
            {data.byCountry?.[0]?.country || '—'} {data.byCountry?.[0] ? `(${data.byCountry[0].count})` : ''}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800">
          <p className="text-[11px] font-mono uppercase text-neutral-400">Top City</p>
          <p className="text-lg font-bold text-emerald-400 mt-1 truncate">
            {data.byCity?.[0]?.city || '—'} {data.byCity?.[0] ? `(${data.byCity[0].count})` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>By Country</span>
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {(data.byCountry || []).length === 0 ? (
              <p className="text-xs text-neutral-500">No country data yet.</p>
            ) : (
              data.byCountry.map((item) => (
                <div key={item.country} className="flex items-center justify-between text-xs py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-200 truncate">{item.country}</span>
                  <span className="font-mono text-amber-400 font-bold">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">By State / Region</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {(data.byRegion || []).length === 0 ? (
              <p className="text-xs text-neutral-500">No region data yet.</p>
            ) : (
              data.byRegion.map((item, i) => (
                <div key={`${item.state}-${i}`} className="flex items-center justify-between text-xs py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-200 truncate">{item.state}{item.country ? `, ${item.country}` : ''}</span>
                  <span className="font-mono text-amber-400 font-bold">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">By City</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {(data.byCity || []).length === 0 ? (
              <p className="text-xs text-neutral-500">No city data yet.</p>
            ) : (
              data.byCity.map((item, i) => (
                <div key={`${item.city}-${i}`} className="flex items-center justify-between text-xs py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-200 truncate">{item.city}{item.state ? `, ${item.state}` : ''}</span>
                  <span className="font-mono text-emerald-400 font-bold">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-neutral-900/70 border border-neutral-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">Recent Permitted Locations</h3>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            Showing {(data.recentLocations || []).length} most recent
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/60 text-neutral-400 font-mono text-[11px]">
              <tr>
                <th className="px-4 py-2.5">User / Session</th>
                <th className="px-4 py-2.5">City & District</th>
                <th className="px-4 py-2.5">Sub-Region / State</th>
                <th className="px-4 py-2.5">Exact Coordinates</th>
                <th className="px-4 py-2.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {(data.recentLocations || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    No permitted user locations recorded yet.
                  </td>
                </tr>
              ) : (
                data.recentLocations.map((loc) => {
                  const cityPart = loc.city || '';
                  const districtPart = loc.district && loc.district !== loc.city ? loc.district : '';
                  const subregionPart = loc.subregion || '';
                  const stateCountry = [loc.state, loc.country].filter(Boolean).join(', ');

                  return (
                    <tr key={loc._id} className="hover:bg-neutral-800/40">
                      <td className="px-4 py-2.5 text-neutral-200">
                        <div className="font-medium text-white truncate max-w-[140px]">
                          {loc.userId?.displayName || loc.userId?.username || 'Guest'}
                        </div>
                        {loc.sessionId && (
                          <div className="text-[10px] font-mono text-neutral-500 truncate max-w-[140px]">
                            {loc.sessionId.slice(0, 14)}...
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-300">
                        <div className="font-semibold text-neutral-100">
                          {cityPart || districtPart || 'Unknown'}
                        </div>
                        {districtPart && districtPart !== cityPart && (
                          <div className="text-[11px] text-amber-400/90 font-medium">
                            District: {districtPart}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-300">
                        {subregionPart && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-0.5">
                            {subregionPart}
                          </span>
                        )}
                        <div className="text-xs text-neutral-400">
                          {stateCountry || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-amber-300 whitespace-nowrap">
                        <div>
                          {Number(loc.latitude).toFixed(4)}, {Number(loc.longitude).toFixed(4)}
                        </div>
                        {Number.isFinite(loc.accuracyMeters) && loc.accuracyMeters > 0 && (
                          <div className="text-[10px] text-neutral-400">
                            ±{Math.round(loc.accuracyMeters)}m
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400 whitespace-nowrap">
                        {loc.createdAt ? new Date(loc.createdAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
