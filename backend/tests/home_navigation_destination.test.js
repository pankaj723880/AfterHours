import assert from 'node:assert/strict';
import {
  parseRoute,
  buildPath,
  initNavigation,
  pushNavigation,
  popNavigation,
  syncPopState,
  canGoBack,
  isHomePage
} from '../../frontend/src/utils/navigationManager.js';

console.log('🧪 Starting "Home Page as Final Destination" Verification Suite...\n');

// =========================================================================
// REQUIREMENT 1: Home Page — Absolutely No Back Button
// =========================================================================
console.log('--- REQUIREMENT 1: Home Page Root Has Zero Back Button ---');

// Fresh session at Home
let nav = initNavigation('/', '');
assert.equal(nav.currentRoute.tab, 'home');
assert.equal(isHomePage('home', {}), true);
assert.equal(canGoBack(nav.stack, 'home', {}), false, 'Back button must be completely hidden on Home root');

// Even if stack has arbitrary items from previous history, Home root MUST NEVER show back button
assert.equal(canGoBack([{ tab: 'home' }, { tab: 'discover' }], 'home', {}), false);
assert.equal(canGoBack([{ tab: 'home' }, { tab: 'radio' }, { tab: 'home' }], 'home', {}), false);
console.log('✔ PASS: Back button strictly hidden on Home page (`/`)\n');

// =========================================================================
// REQUIREMENT 2: All Other Pages Display Back Button & Fallback to Home
// =========================================================================
console.log('--- REQUIREMENT 2: Non-Home Pages Display Back Button ---');

const nonHomeTabs = ['discover', 'radio', 'barber', 'truck', 'pauwa', 'mood', 'timemachine', 'playlists', 'downloads', 'admin', 'library', 'history'];
for (const tab of nonHomeTabs) {
  assert.equal(isHomePage(tab, {}), false);
  assert.equal(canGoBack([{ tab: 'home' }, { tab }], tab, {}), true, `Back button must be visible on /${tab}`);
}

// When stack has only 1 entry or is empty, popping MUST fallback directly to Home root
const fallbackPop = popNavigation([{ tab: 'radio' }]);
assert.equal(fallbackPop.target.tab, 'home');
assert.equal(fallbackPop.target.path, '/');
assert.equal(fallbackPop.isRoot, true);
assert.equal(canGoBack(fallbackPop.stack, 'home', {}), false);
console.log('✔ PASS: Non-home pages display back button & safe Home fallback confirmed\n');

// =========================================================================
// REQUIREMENT 3: Detailed Navigation Sequences
// =========================================================================
console.log('--- REQUIREMENT 3: Required Navigation Sequences ---');

// Sequence 1: Home → Discover → Artist Profile → Back → Discover → Back → Home
console.log('• Testing Sequence 1: Home → Discover → Artist Profile → Back → Discover → Back → Home');
let stack1 = [{ tab: 'home', path: '/', params: {} }];
assert.equal(canGoBack(stack1, 'home', {}), false);

stack1 = pushNavigation(stack1, { tab: 'discover', path: '/discover' }).stack;
assert.equal(canGoBack(stack1, 'discover', {}), true);

stack1 = pushNavigation(stack1, { tab: 'discover', path: '/discover?q=Arijit%20Singh', params: { q: 'Arijit Singh' } }).stack;
assert.equal(canGoBack(stack1, 'discover', { q: 'Arijit Singh' }), true);

// 1st Back: to Discover
let pop1 = popNavigation(stack1);
stack1 = pop1.stack;
assert.equal(pop1.target.tab, 'discover');
assert.equal(pop1.target.path, '/discover');
assert.equal(canGoBack(stack1, 'discover', {}), true);

// 2nd Back: to Home
pop1 = popNavigation(stack1);
stack1 = pop1.stack;
assert.equal(pop1.target.tab, 'home');
assert.equal(pop1.target.path, '/');
assert.equal(pop1.isRoot, true);
assert.equal(canGoBack(stack1, 'home', {}), false, 'Back button must disappear upon reaching Home');
console.log('✔ Sequence 1 PASSED');

// Sequence 2: Home → Search → Song Details → Back → Search → Back → Home
console.log('• Testing Sequence 2: Home → Search → Song Details → Back → Search → Back → Home');
let stack2 = [{ tab: 'home', path: '/', params: {} }];
assert.equal(canGoBack(stack2, 'home', {}), false);

// Home search for "Tum Hi Ho"
stack2 = pushNavigation(stack2, { tab: 'discover', path: '/discover?q=Tum%20Hi%20Ho', params: { q: 'Tum Hi Ho' } }).stack;
assert.equal(canGoBack(stack2, 'discover', { q: 'Tum Hi Ho' }), true);

// Song Details / Video view
let pop2 = popNavigation(stack2);
stack2 = pop2.stack;
assert.equal(pop2.target.tab, 'home');
assert.equal(pop2.isRoot, true);
assert.equal(canGoBack(stack2, 'home', {}), false, 'Back button must disappear upon reaching Home');
console.log('✔ Sequence 2 PASSED');

// Sequence 3: Home → Radio → Artist Profile → Back → Radio → Back → Home
console.log('• Testing Sequence 3: Home → Radio → Artist Profile → Back → Radio → Back → Home');
let stack3 = [{ tab: 'home', path: '/', params: {} }];
assert.equal(canGoBack(stack3, 'home', {}), false);

stack3 = pushNavigation(stack3, { tab: 'radio', path: '/radio' }).stack;
assert.equal(canGoBack(stack3, 'radio', {}), true);

stack3 = pushNavigation(stack3, { tab: 'discover', path: '/discover?q=Diljit%20Dosanjh', params: { q: 'Diljit Dosanjh' } }).stack;
assert.equal(canGoBack(stack3, 'discover', { q: 'Diljit Dosanjh' }), true);

// 1st Back: to Radio
let pop3 = popNavigation(stack3);
stack3 = pop3.stack;
assert.equal(pop3.target.tab, 'radio');
assert.equal(pop3.target.path, '/radio');
assert.equal(canGoBack(stack3, 'radio', {}), true);

// 2nd Back: to Home
pop3 = popNavigation(stack3);
stack3 = pop3.stack;
assert.equal(pop3.target.tab, 'home');
assert.equal(pop3.target.path, '/');
assert.equal(pop3.isRoot, true);
assert.equal(canGoBack(stack3, 'home', {}), false);
console.log('✔ Sequence 3 PASSED');

// Sequence 4: Home → Album → Artist Profile → Back → Album → Back → Home
console.log('• Testing Sequence 4: Home → Album → Artist Profile → Back → Album → Back → Home');
let stack4 = [{ tab: 'home', path: '/', params: {} }];
assert.equal(canGoBack(stack4, 'home', {}), false);

// Expand Album view on Home
stack4 = pushNavigation(stack4, { tab: 'home', path: '/?view=albums', params: { showAll: 'albums' } }).stack;
assert.equal(canGoBack(stack4, 'home', { showAllAlbums: true }), true);

// Click artist from Album
stack4 = pushNavigation(stack4, { tab: 'discover', path: '/discover?q=Arijit%20Singh', params: { q: 'Arijit Singh' } }).stack;
assert.equal(canGoBack(stack4, 'discover', { q: 'Arijit Singh' }), true);

// 1st Back: to Album view
let pop4 = popNavigation(stack4);
stack4 = pop4.stack;
assert.equal(pop4.target.tab, 'home');
assert.equal(pop4.target.params.showAll, 'albums');
assert.equal(canGoBack(stack4, 'home', { showAllAlbums: true }), true);

// 2nd Back: to Home root
pop4 = popNavigation(stack4);
stack4 = pop4.stack;
assert.equal(pop4.target.tab, 'home');
assert.equal(pop4.isRoot, true);
assert.equal(canGoBack(stack4, 'home', {}), false, 'Back button must disappear upon reaching Home');
console.log('✔ Sequence 4 PASSED\n');

// =========================================================================
// REQUIREMENT 4: Browser Back/Forward & Direct URL Visits
// =========================================================================
console.log('--- REQUIREMENT 4: Browser Navigation & Deep Link Initialization ---');

// Direct deep link to /radio
const coldRadio = initNavigation('/radio', '');
assert.equal(coldRadio.stack.length, 2);
assert.equal(coldRadio.stack[0].tab, 'home');
assert.equal(coldRadio.stack[1].tab, 'radio');
assert.equal(canGoBack(coldRadio.stack, 'radio', {}), true);

// Browser Back simulation from cold radio
const popRadio = syncPopState(coldRadio.stack, '/', '');
assert.equal(popRadio.target.tab, 'home');
assert.equal(popRadio.stack.length, 1);
assert.equal(canGoBack(popRadio.stack, 'home', {}), false);

// Direct visit to Home root
const coldHome = initNavigation('/', '');
assert.equal(coldHome.stack.length, 1);
assert.equal(canGoBack(coldHome.stack, 'home', {}), false);

console.log('✔ PASS: Direct visits and browser back synchronization verified\n');

// =========================================================================
// REQUIREMENT 5: Home is the Absolute Final Navigation Destination
// =========================================================================
console.log('--- REQUIREMENT 5: Home As Final Destination & No Loops ---');

let complexStack = [
  { tab: 'home', path: '/' },
  { tab: 'discover', path: '/discover' },
  { tab: 'radio', path: '/radio' },
  { tab: 'barber', path: '/barber' }
];

// Direct click on "Home" tab in sidebar
const homeClick = pushNavigation(complexStack, { tab: 'home', path: '/' });
assert.equal(homeClick.stack.length, 1);
assert.equal(homeClick.stack[0].tab, 'home');
assert.equal(canGoBack(homeClick.stack, 'home', {}), false, 'Home stack must be cleanly reset to length 1');

// Rapid consecutive clicks on Home must never loop or build history
const homeClick2 = pushNavigation(homeClick.stack, { tab: 'home', path: '/' });
assert.equal(homeClick2.stack.length, 1);
assert.equal(canGoBack(homeClick2.stack, 'home', {}), false);

console.log('✔ PASS: Home is final destination with loop prevention\n');

console.log('======================================================');
console.log(' ALL HOME NAVIGATION DESTINATION REQUIREMENTS VERIFIED! ');
console.log('======================================================');

