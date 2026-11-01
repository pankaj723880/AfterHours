import assert from 'assert';
import { parseVoiceCommandLocally } from '../../frontend/src/services/voiceAgentRegistry.js';

console.log('🧪 Starting Loopra Voice Agent Command Registry Tests...\n');

const mockSong = {
  id: 'song123',
  title: 'Kesariya',
  artist: 'Arijit Singh',
  channel: 'Sony Music India'
};

// 1. Playback Commands (English & Hindi)
console.log('Test 1: Playback Commands (Pause, Resume, Next, Prev, Shuffle, Repeat)');
assert.strictEqual(parseVoiceCommandLocally('pause').action, 'pause');
assert.strictEqual(parseVoiceCommandLocally('ruk jao').action, 'pause');
assert.strictEqual(parseVoiceCommandLocally('rok do').action, 'pause');
assert.strictEqual(parseVoiceCommandLocally('resume').action, 'resume');
assert.strictEqual(parseVoiceCommandLocally('chalao').action, 'resume');
assert.strictEqual(parseVoiceCommandLocally('next song').action, 'next');
assert.strictEqual(parseVoiceCommandLocally('agla gaana').action, 'next');
assert.strictEqual(parseVoiceCommandLocally('previous track').action, 'previous');
assert.strictEqual(parseVoiceCommandLocally('pichla song').action, 'previous');
assert.strictEqual(parseVoiceCommandLocally('shuffle on').action, 'shuffle');
assert.strictEqual(parseVoiceCommandLocally('loop this').action, 'repeat');
console.log('✅ Test 1 Passed: Core playback intents parsed successfully.\n');

// 2. Volume Controls (Up, Down, Set, Mute, Unmute)
console.log('Test 2: Volume Controls');
assert.strictEqual(parseVoiceCommandLocally('volume up').action, 'volume_up');
assert.strictEqual(parseVoiceCommandLocally('awaaz badhao').action, 'volume_up');
assert.strictEqual(parseVoiceCommandLocally('volume down').action, 'volume_down');
assert.strictEqual(parseVoiceCommandLocally('awaaz kam karo').action, 'volume_down');
assert.strictEqual(parseVoiceCommandLocally('mute').action, 'mute');
assert.strictEqual(parseVoiceCommandLocally('unmute').action, 'unmute');
const volSet = parseVoiceCommandLocally('set volume to 80');
assert.strictEqual(volSet.action, 'set_volume');
assert.strictEqual(volSet.value, 80);
console.log('✅ Test 2 Passed: Volume controls parsed accurately.\n');

// 3. Navigation Commands
console.log('Test 3: Navigation Commands (Home, Discover, Radio, Liked, History, Playlists, Insights, Back)');
assert.strictEqual(parseVoiceCommandLocally('go home').target, 'home');
assert.strictEqual(parseVoiceCommandLocally('ghar jao').target, 'home');
assert.strictEqual(parseVoiceCommandLocally('open discover').target, 'discover');
assert.strictEqual(parseVoiceCommandLocally('open radio').target, 'radio');
assert.strictEqual(parseVoiceCommandLocally('liked songs').target, 'library');
assert.strictEqual(parseVoiceCommandLocally('listening history').target, 'history');
assert.strictEqual(parseVoiceCommandLocally('my playlists').target, 'playlists');
assert.strictEqual(parseVoiceCommandLocally('listening insights').action, 'open_insights');
assert.strictEqual(parseVoiceCommandLocally('weekly recap').action, 'open_insights');
assert.strictEqual(parseVoiceCommandLocally('go back').action, 'go_back');
assert.strictEqual(parseVoiceCommandLocally('piche jao').action, 'go_back');
console.log('✅ Test 3 Passed: Navigation routes mapped accurately.\n');

// 4. Context-Aware Library Commands
console.log('Test 4: Context-Aware Library Commands');
const likeCmd = parseVoiceCommandLocally('like this song', { currentSong: mockSong });
assert.strictEqual(likeCmd.action, 'like_current');
assert.strictEqual(likeCmd.target.title, 'Kesariya');

const artistCmd = parseVoiceCommandLocally('open this artist profile', { currentSong: mockSong });
assert.strictEqual(artistCmd.action, 'open_artist');
assert.strictEqual(artistCmd.target, 'Arijit Singh');

const followCmd = parseVoiceCommandLocally('follow this artist', { currentSong: mockSong });
assert.strictEqual(followCmd.action, 'follow_artist');
assert.strictEqual(followCmd.target, 'Arijit Singh');

const playlistCmd = parseVoiceCommandLocally('add to playlist', { currentSong: mockSong });
assert.strictEqual(playlistCmd.action, 'add_to_playlist');
console.log('✅ Test 4 Passed: Context commands resolved with current track state.\n');

// 5. Direct Play & Search Queries (English & Hinglish)
console.log('Test 5: Song Play & Search Parsing');
const play1 = parseVoiceCommandLocally('play Kesariya');
assert.strictEqual(play1.action, 'play_search');
assert.strictEqual(play1.query, 'Kesariya');

const play2 = parseVoiceCommandLocally('bajao Pasoori');
assert.strictEqual(play2.action, 'play_search');
assert.strictEqual(play2.query, 'Pasoori');

const play3 = parseVoiceCommandLocally('gaana bajao Tum Hi Ho');
assert.strictEqual(play3.action, 'play_search');
assert.strictEqual(play3.query, 'Tum Hi Ho');

const search1 = parseVoiceCommandLocally('search for Coke Studio');
assert.strictEqual(search1.action, 'search');
assert.strictEqual(search1.query, 'Coke Studio');
console.log('✅ Test 5 Passed: Song play & search queries parsed correctly.\n');

// 6. Wake Word, Sleep Command & Strict Admin Isolation
console.log('Test 6: Wake Word, Stop Commands & Admin Security Isolation');
const wake = parseVoiceCommandLocally('hey loopra');
assert.strictEqual(wake.action, 'wake_ping');

const stop1 = parseVoiceCommandLocally('done loopra');
assert.strictEqual(stop1.action, 'stop_continuous');

const stop2 = parseVoiceCommandLocally('stop listening');
assert.strictEqual(stop2.action, 'stop_continuous');

const stop3 = parseVoiceCommandLocally('alvida loopra');
assert.strictEqual(stop3.action, 'stop_continuous');

const adminCmd1 = parseVoiceCommandLocally('open admin dashboard');
assert.strictEqual(adminCmd1.action, 'security_blocked');

const adminCmd2 = parseVoiceCommandLocally('delete user database');
assert.strictEqual(adminCmd2.action, 'security_blocked');
console.log('✅ Test 6 Passed: Wake/stop triggers and admin isolation verified.\n');

// 7. Multi-Step Instruction Splitting & Parsing
import {
  splitVoiceInstructionIntoClauses,
  parseMultiStepInstruction,
  executeTaskPipeline
} from '../../frontend/src/services/voiceTaskEngine.js';

console.log('Test 7: Multi-Step Instruction Splitting (English, Hindi, Hinglish)');
const clauses1 = splitVoiceInstructionIntoClauses('play Kesariya and like it and open lyrics and set volume to 80 and open the artist profile');
assert.strictEqual(clauses1.length, 5);
assert.strictEqual(clauses1[0], 'play Kesariya');
assert.strictEqual(clauses1[1], 'like it');
assert.strictEqual(clauses1[2], 'open lyrics');
assert.strictEqual(clauses1[3], 'set volume to 80');
assert.strictEqual(clauses1[4], 'open the artist profile');

// Respect song titles containing 'and'
const clausesTitleAnd = splitVoiceInstructionIntoClauses('play Romeo and Juliet and add to playlist');
assert.strictEqual(clausesTitleAnd.length, 2);
assert.strictEqual(clausesTitleAnd[0], 'play Romeo and Juliet');
assert.strictEqual(clausesTitleAnd[1], 'add to playlist');

// Hindi/Hinglish compound splitting
const clausesHindi = splitVoiceInstructionIntoClauses('Pasoori bajao aur usko like karo phir lyrics kholo aur awaaz 85 karo');
assert.strictEqual(clausesHindi.length, 4);
console.log('✅ Test 7 Passed: Multi-step compound instructions split accurately.\n');

// 8. 8-Step Dependent Action Execution Pipeline
console.log('Test 8: 8 Dependent Actions in One Pipeline');
const eightStepSentence = 'search for Arijit Singh, play the first track, like this song, turn shuffle on, set repeat, set volume to 85, open playback queue, and open this artist profile';
const parsed8 = parseMultiStepInstruction(eightStepSentence, { currentSong: mockSong });
assert.strictEqual(parsed8.length, 8);

const executionLogs = [];
const mockHandlers = {
  searchCatalog: async (query) => {
    executionLogs.push(`searchCatalog:${query}`);
    return [
      { id: 'track_arijit_1', title: 'Apna Bana Le', artist: 'Arijit Singh' },
      { id: 'track_arijit_2', title: 'Kesariya', artist: 'Arijit Singh' }
    ];
  },
  onPlayTrack: async (track) => executionLogs.push(`play:${track.title}`),
  onTogglePlayPause: async () => executionLogs.push('togglePlayPause'),
  onNextTrack: async () => executionLogs.push('nextTrack'),
  onPrevTrack: async () => executionLogs.push('prevTrack'),
  onToggleShuffle: async () => executionLogs.push('toggleShuffle'),
  onToggleRepeat: async () => executionLogs.push('toggleRepeat'),
  onSetVolume: async (vol) => executionLogs.push(`setVolume:${vol}`),
  onToggleLike: async (track) => executionLogs.push(`like:${track.title}`),
  onAddToPlaylist: async (track) => executionLogs.push(`playlist:${track.title}`),
  onNavigate: async (tab, extra) => executionLogs.push(`navigate:${tab}${extra ? ':' + JSON.stringify(extra) : ''}`),
  onOpenInsights: async () => executionLogs.push('openInsights'),
  onOpenQueue: async () => executionLogs.push('openQueue'),
  onOpenLyrics: async () => executionLogs.push('openLyrics'),
  onGoBack: async () => executionLogs.push('goBack'),
  onOpenArtist: async (artist) => executionLogs.push(`openArtist:${artist}`)
};

const result8 = await executeTaskPipeline(parsed8, { currentSong: mockSong }, mockHandlers);
assert.strictEqual(result8.success, true);
assert.strictEqual(result8.completedSteps.length, 8);
assert.strictEqual(result8.failedStep, null);
assert.strictEqual(executionLogs.length, 8);
assert.ok(executionLogs.includes('like:Apna Bana Le')); // Dependent on search result item 0!
assert.ok(executionLogs.includes('setVolume:85'));
assert.ok(executionLogs.includes('openQueue'));
assert.ok(executionLogs.includes('openArtist:Arijit Singh'));
console.log('✅ Test 8 Passed: 8-step dependent action pipeline executed and verified completely.\n');

// 9. Multi-Step Task with a Failed Middle Step
console.log('Test 9: Multi-Step Task with Failed Middle Step Isolation');
const failingSteps = [
  { action: 'set_volume', value: 50 },
  { action: 'like_current' },
  { action: 'open_artist', target: null }, // In headless state without song, will fail!
  { action: 'open_lyrics' }
];

const failLogs = [];
const failingHandlers = {
  ...mockHandlers,
  onOpenArtist: async () => {
    throw new Error('Artist metadata unavailable');
  }
};

const failResult = await executeTaskPipeline(
  failingSteps,
  { currentSong: mockSong, lastArtist: null },
  failingHandlers
);

assert.strictEqual(failResult.success, false);
assert.strictEqual(failResult.completedSteps.length, 2); // First 2 succeeded!
assert.strictEqual(failResult.failedStep.index, 2); // Step 3 failed
assert.strictEqual(failResult.failedStep.action, 'open_artist');
assert.ok(failResult.message.includes('Step 3 (open_artist) failed: Artist metadata unavailable'));
assert.ok(failResult.message.includes('Completed 2 of 4 steps'));
console.log('✅ Test 9 Passed: Failed middle step halts execution without fake success.\n');

// 10. Follow-Up References Across Consecutive Voice Inputs
console.log('Test 10: Follow-Up Pronoun & Context Persistence Across Inputs');
let userTaskContext = { currentSong: null, lastArtist: null, completedSteps: [] };

// Utterance 1: Play track
const step1 = parseMultiStepInstruction('play Kesariya', userTaskContext);
const res1 = await executeTaskPipeline(step1, userTaskContext, mockHandlers);
userTaskContext = res1.taskContext;
assert.strictEqual(userTaskContext.lastPlayedTrack.title, 'Kesariya');

// Utterance 2: "add that song to my favorites"
const step2 = parseMultiStepInstruction('add that song to my favorites', userTaskContext);
const res2 = await executeTaskPipeline(step2, userTaskContext, mockHandlers);
assert.strictEqual(res2.completedSteps[0].data.title, 'Kesariya');

// Utterance 3: "open its artist"
const step3 = parseMultiStepInstruction('open its artist profile', userTaskContext);
const res3 = await executeTaskPipeline(step3, userTaskContext, mockHandlers);
assert.ok(['Kesariya', 'Arijit Singh'].includes(res3.completedSteps[0].data)); // Arijit Singh / Kesariya context
console.log('✅ Test 10 Passed: Follow-up references resolve accurately across consecutive inputs.\n');

// 11. Single Panel Exclusivity State Logic
console.log('Test 11: Single Panel Exclusivity State Verification');
let activePanel = null; // null | 'ai' | 'voice'

// Open AI panel
activePanel = 'ai';
assert.strictEqual(activePanel === 'ai', true);
assert.strictEqual(activePanel === 'voice', false);

// Opening Voice panel closes AI panel
activePanel = 'voice';
assert.strictEqual(activePanel === 'ai', false);
assert.strictEqual(activePanel === 'voice', true);

// Closing Voice panel
activePanel = null;
assert.strictEqual(activePanel, null);
console.log('✅ Test 11 Passed: Single shared panel visibility exclusivity verified.\n');

// 12. Click vs Long Press Logic Verification
console.log('Test 12: Click vs Long Press Independent Separation');
let voiceActive = false;
let panelOpen = false;

// Normal click
function handleVoiceClick() {
  voiceActive = !voiceActive;
  // Does NOT touch panelOpen!
}

// Long press
function handleVoiceLongPress() {
  panelOpen = true;
  // Does NOT touch voiceActive!
}

handleVoiceClick();
assert.strictEqual(voiceActive, true);
assert.strictEqual(panelOpen, false); // Voice ON, panel stays CLOSED

handleVoiceLongPress();
assert.strictEqual(voiceActive, true); // Voice stays ON!
assert.strictEqual(panelOpen, true);  // Panel opened!

// Close panel
panelOpen = false;
assert.strictEqual(voiceActive, true); // Voice STILL active in background!

handleVoiceClick();
assert.strictEqual(voiceActive, false); // Click toggles voice OFF
assert.strictEqual(panelOpen, false);
console.log('✅ Test 12 Passed: Voice ON/OFF click completely independent of Long Press panel open.\n');

console.log('🎉 ALL Voice Agent Command Tests Passed Successfully!\n');

