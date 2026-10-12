import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  LayoutDashboard, 
  Activity, 
  Users, 
  Server, 
  Music2, 
  ShieldCheck, 
  ArrowLeft,
  RefreshCw,
  LogOut,
  Radio
} from 'lucide-react';
import AccessDenied from './AccessDenied';
import AdminOverview from './AdminOverview';
import LiveTraffic from './LiveTraffic';
import UserManagement from './UserManagement';
import ServerHealth from './ServerHealth';
import MusicAnalytics from './MusicAnalytics';
import AuditLogs from './AuditLogs';

export default function AdminDashboard({ user, token, backendUrl, onExit, onOpenAuth, showToast }) {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const socketRef = useRef(null);

  const isAdmin = Boolean(
    (user && user.role === 'admin') ||
    (user?.username && [
      'admin@afterhours.com',
      'pankajsss7238@gmail.com',
      'pss809352@gmail.com',
      'ps207800@gmail.com'
    ].includes(user.username.toLowerCase()))
  );

  // 1. Fetch initial metrics & health
  const fetchHealthDiagnostics = async () => {
    if (!token || !isAdmin) return;
    setIsHealthLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/admin/health`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Health fetch failed');
      setHealth(data);
    } catch (err) {
      console.warn('[Admin Health]:', err.message);
    } finally {
      setIsHealthLoading(false);
    }
  };

  const fetchInitialMetrics = async () => {
    if (!token || !isAdmin) return;
    try {
      const res = await fetch(`${backendUrl}/api/admin/metrics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Metrics fetch failed');
      setMetrics(data);
    } catch (err) {
      console.warn('[Admin Metrics]:', err.message);
    }
  };

  useEffect(() => {
    if (isAdmin && token) {
      fetchInitialMetrics();
      fetchHealthDiagnostics();

      // Setup Authenticated Socket.IO connection for live traffic stream
      const adminSocket = io(backendUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      adminSocket.on('connect', () => {
        setIsSocketConnected(true);
      });

      adminSocket.on('disconnect', () => {
        setIsSocketConnected(false);
      });

      adminSocket.on('admin_live_metrics', (data) => {
        setMetrics(data);
      });

      socketRef.current = adminSocket;

      return () => {
        adminSocket.disconnect();
      };
    }
  }, [isAdmin, token, backendUrl]);

  // If not admin, show Access Denied
  if (!isAdmin) {
    return <AccessDenied user={user} onBack={onExit} onLogin={onOpenAuth} />;
  }

  // If admin but token is not present in session, prompt to sign in to obtain authenticated stream token
  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Admin Session Authentication Required</h2>
        <p className="text-sm text-neutral-400 max-w-md mb-6">
          To connect to real-time telemetry, server diagnostics, and user management, please authenticate your administrator session.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAuth}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            Authenticate Admin Session
          </button>
          <button
            onClick={onExit}
            className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold border border-neutral-800 transition cursor-pointer"
          >
            Back to Music
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'traffic', label: 'Live Traffic', icon: Activity, badge: isSocketConnected ? 'LIVE' : null },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'health', label: 'API & Health', icon: Server },
    { id: 'music', label: 'Music Analytics', icon: Music2 },
    { id: 'audit', label: 'Audit Logs', icon: ShieldCheck }
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800/80 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Music</span>
          </button>

          <div className="h-5 w-px bg-neutral-800" />

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
            <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
              AfterHours <span className="text-amber-400 font-semibold text-xs ml-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase">Admin</span>
            </h1>
          </div>
        </div>

        {/* Status Indicators & Admin User pill */}
        <div className="flex items-center gap-3">
          {/* Real-time Socket status indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-full">
            <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-[11px] font-mono">{isSocketConnected ? 'Real-Time Sync' : 'Reconnecting...'}</span>
          </div>

          <div className="flex items-center gap-2 text-xs bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-semibold text-neutral-200 truncate max-w-[120px] sm:max-w-[200px]">
              {user.username}
            </span>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-56 shrink-0 space-y-1">
          <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider px-3 mb-2">
            Dashboard Sections
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-lg shadow-amber-500/20'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-neutral-950' : 'text-neutral-400'}`} />
                  {item.label}
                </div>
                {item.badge && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                    isActive ? 'bg-neutral-950 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          {activeSubTab === 'overview' && (
            <AdminOverview 
              metrics={metrics} 
              health={health} 
              onNavigate={setActiveSubTab} 
            />
          )}

          {activeSubTab === 'traffic' && (
            <LiveTraffic metrics={metrics} />
          )}

          {activeSubTab === 'users' && (
            <UserManagement 
              token={token} 
              backendUrl={backendUrl} 
              currentUser={user}
              showToast={showToast} 
            />
          )}

          {activeSubTab === 'health' && (
            <ServerHealth 
              health={health} 
              metrics={metrics} 
              onRefresh={fetchHealthDiagnostics}
              isLoading={isHealthLoading}
            />
          )}

          {activeSubTab === 'music' && (
            <MusicAnalytics 
              token={token} 
              backendUrl={backendUrl}
              showToast={showToast}
            />
          )}

          {activeSubTab === 'audit' && (
            <AuditLogs 
              token={token} 
              backendUrl={backendUrl}
              showToast={showToast}
            />
          )}
        </main>
      </div>
    </div>
  );
}
