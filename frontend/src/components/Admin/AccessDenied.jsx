import React from 'react';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';

export default function AccessDenied({ onBack, onLogin, user }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-neutral-900/80 border border-red-500/30 rounded-2xl p-8 text-center backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-400 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Access Restricted</h2>
        <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
          {user 
            ? `Signed in as ${user.username || 'User'}, but administrator permissions are required to access this dashboard.`
            : 'You must be signed in with an authorized administrator account to view the dashboard.'}
        </p>

        <div className="flex flex-col gap-3">
          {!user && (
            <button
              onClick={onLogin}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold py-2.5 px-4 rounded-xl transition shadow-lg shadow-amber-500/20"
            >
              <LogIn className="w-4 h-4" />
              Sign in with Admin Account
            </button>
          )}

          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium py-2.5 px-4 rounded-xl border border-neutral-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Music Player
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-800/80 text-[11px] text-neutral-500">
          Server-side Role Based Access Control (RBAC) enforced. Unauthorized attempts are logged.
        </div>
      </div>
    </div>
  );
}
