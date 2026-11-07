import React from 'react';
import { Download, Smartphone, ShieldCheck, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function AndroidApkDownloadSection({ onBack = null }) {
  return (
    <div className="w-full max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 sm:space-y-8 select-none">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-amber-400 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      )}

      {/* Main Download Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-black border border-amber-500/30 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-amber-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-orange-500/10 blur-[80px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10">
          <div className="flex items-center gap-5 sm:gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-neutral-900 border border-amber-500/40 p-2.5 flex items-center justify-center shadow-xl shadow-amber-500/10 shrink-0">
              <img src="/loopra-logo.png?v=3" alt="Loopra Android App" className="w-full h-full object-contain" />
            </div>
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold tracking-wide">
                <ShieldCheck className="w-3 h-3" />
                <span>OFFICIAL STANDALONE APK</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-wide">
                Loopra for Android
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400">
                Immersive 3D audio streaming, offline playback & live radio.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto shrink-0">
            <a
              href="/Loopra.apk"
              download="Loopra.apk"
              className="w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-bold text-sm sm:text-base shadow-xl shadow-amber-500/25 active:scale-95 transition cursor-pointer"
            >
              <Download className="w-5 h-5 text-neutral-950" />
              <span>Download APK (v1.0.0)</span>
            </a>
            <span className="text-[11px] font-mono text-neutral-400">
              Direct Package • Size: ~2.8 MB • Android 7.0+
            </span>
          </div>
        </div>

        {/* Specifications Grid */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-6 border-t border-neutral-800/80">
          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">App Name</p>
            <p className="text-sm font-bold text-white font-display mt-0.5">Loopra</p>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Version</p>
            <p className="text-sm font-bold text-amber-400 font-mono mt-0.5">1.0.0</p>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Platform</p>
            <p className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Android</span>
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">License</p>
            <p className="text-sm font-bold text-white mt-0.5">Free / Verified</p>
          </div>
        </div>
      </div>

      {/* Sideload Installation Guide */}
      <div className="rounded-3xl bg-neutral-900/70 border border-neutral-800 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          <h2 className="text-sm sm:text-base font-bold font-display uppercase tracking-wider text-white">
            How to Install (.apk Sideload Guide)
          </h2>
        </div>

        <ol className="space-y-3 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <span>
              Tap <strong>Download APK</strong> to save <code>Loopra.apk</code> to your device.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <span>
              Open the downloaded file from your notification bar or <strong>Files / Downloads</strong> app.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <span>
              If prompted with <em>"Install unknown apps"</em>, grant permission for your browser or file manager in <strong>Settings</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              4
            </span>
            <span>
              Tap <strong>Install</strong>, then launch Loopra from your home screen or app drawer.
            </span>
          </li>
        </ol>

        <div className="flex items-center gap-2 pt-2 text-[11px] text-neutral-400 border-t border-neutral-800/80">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Safe package built directly from the official Loopra web runtime.</span>
        </div>
      </div>
    </div>
  );
}

