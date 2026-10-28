import React from 'react';
import { AlertTriangle, ShieldCheck, ArrowRight, Music2 } from 'lucide-react';

export default function CmsMaintenanceOverlay({ maintenance, branding, isAdmin, onOpenAdmin, onOpenAuth }) {
  if (!maintenance?.enabled) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-950/95 backdrop-blur-2xl text-neutral-100 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-rose-500/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full flex flex-col items-center space-y-6">
        {/* Brand Icon with Pulsing Halo */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl flex items-center justify-center text-amber-400">
            <Music2 className="w-10 h-10 animate-pulse" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shadow-lg">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* Brand Title & Badge */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>SYSTEM MAINTENANCE IN PROGRESS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {maintenance.title || `${branding?.siteName || 'Loopra'} Under Maintenance`}
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed max-w-md mx-auto">
            {maintenance.message || 'We are currently tuning our audio nodes and optimizing streaming capacity. Audio service will resume shortly.'}
          </p>
        </div>

        {/* Administrator Controls */}
        <div className="pt-4 border-t border-neutral-800/80 w-full flex flex-col sm:flex-row items-center justify-center gap-3">
          {isAdmin ? (
            <button
              onClick={onOpenAdmin}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Enter Admin CMS</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Administrator Sign In</span>
            </button>
          )}
        </div>

        <p className="text-[11px] text-neutral-500 font-mono">
          © 2026 {branding?.siteName || 'Loopra'} • Scheduled Infrastructure Maintenance
        </p>
      </div>
    </div>
  );
}
