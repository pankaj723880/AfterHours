// Central Experimental Feature Flags for Mobile UI V2 Refactor
// Toggle to false to cleanly revert 100% of the UI refactor to legacy layout
export const USE_COMPACT_V2_UI = true;

// Time Machine Radio V2 Mobile UI Feature Flag
export const USE_COMPACT_TIMEMACHINE_V2 = true;

// V2 Mobile Slide-out Navigation Drawer / Sidebar Feature Flag
// When true: sleek glassmorphism background, grouped sections, glowing pills, refined touch targets
// When false: renders 100% original sidebar with zero visual/functional regression
export const USE_V2_DRAWER = true;

// V2 Playlists & Mixtapes UI Feature Flag (/playlists)
export const USE_V2_PLAYLISTS_UI = true;

// V2 Liked Songs Collection / Library UI Feature Flag (/library)
export const USE_V2_LIBRARY_UI = true;

// V2 Discover & Search UI Feature Flag (/discover)
export const USE_V2_DISCOVER_UI = true;

// V2 Discover Swipe UI Feature Flag (/swipe)
// When true: fits 100dvh, full-bleed high-res cover cards, unified dock action row, buttery 60fps touch gestures, image preloading, hides sticky bottom mini-player
// When false: preserves 100% of legacy DiscoverSwipe layout without regression
export const USE_V2_SWIPE_UI = true;

// V2 Profile Modal / Drawer UI Feature Flag
// When true: modern frosted glass container, prominent music identity, interactive neon genre pills, listener persona badge, zero bio/visibility clutter
// When false: preserves 100% of legacy UserProfileModal layout without regression
export const USE_V2_PROFILE_MODAL = true;

// V2 3D Avatar Voice Companion Feature Flag
// When true: sleek floating hologram bubble in bottom-right with audio reactivity, zero content obstruction,
// interactive assistant bottom-sheet modal with quick actions & live transcription, and optimized render loop.
// When false: renders autonomous world-roaming, dancing and sitting full-body CharacterBuddy overlay.
export const USE_V2_AVATAR_COMPANION = false;
export const USE_V2_AVATAR = true;

// V2 Voice Engine Feature Flag
// When true: Gemini AI persona with natural Hindi/Hinglish speech, high-def female voice (Aoede / Sulafat or Swara / Google Hindi),
// calibrated 1.35x rate, 1.05 pitch, speech-to-text sanitization, and 2s state coordination.
// When false: falls back to original WebSpeech synthesis pipeline.
export const USE_V2_VOICE_ENGINE = true;

// Autonomous 3D Avatar World-Roaming, Dancing & Sitting Suite Feature Flag
// When true: full-screen transparent Three.js overlay canvas, DOM-aware landing spot scanner (usePageWaypoints.js),
// 2-second voice inactivity debounce, smooth lerp locomotion across page sections, card perching, music beat dancing,
// and dedicated Free Roam settings toggle.
// When false: cleanly falls back to the static/docked avatar logic.
export const USE_V2_AVATAR_ROAMING_SUITE = true;







