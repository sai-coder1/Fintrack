import { getPageFromPath, getPathFromPage, PUBLIC_PAGES, PROTECTED_PAGES } from '../src/utils/navigation.js';

console.log('--- Testing Navigation Logic ---');

const navTests = [
  { path: '/', expected: 'root' },
  { path: '/landing', expected: 'landing' },
  { path: '/signin', expected: 'signin' },
  { path: '/login', expected: 'signin' },
  { path: '/signup', expected: 'signup' },
  { path: '/register', expected: 'signup' },
  { path: '/forgot-password', expected: 'forgot-password' },
  { path: '/forgot', expected: 'forgot-password' },
  { path: '/reset-password', expected: 'reset-password' },
  { path: '/reset', expected: 'reset-password' },
  { path: '/dashboard', expected: 'dashboard' },
  { path: '/transactions', expected: 'transactions' },
  { path: '/import', expected: 'import' },
  { path: '/analytics', expected: 'analytics' },
  { path: '/budgets', expected: 'budgets' },
  { path: '/simulator', expected: 'simulator' },
  { path: '/settings', expected: 'settings' },
  { path: '/', hash: '#access_token=123&type=recovery', expected: 'reset-password' }
];

let failed = 0;
for (const test of navTests) {
  const result = getPageFromPath(test.path, test.hash || '');
  if (result !== test.expected) {
    console.error(`FAIL: ${test.path} expected ${test.expected}, got ${result}`);
    failed++;
  } else {
    console.log(`PASS: ${test.path} (hash: ${test.hash || 'none'}) -> ${result}`);
  }
}

console.log('\n--- Testing Reverse Mapping (Page to Path) ---');
const reverseTests = [
  { page: 'landing', expected: '/' },
  { page: 'signin', expected: '/signin' },
  { page: 'signup', expected: '/signup' },
  { page: 'forgot-password', expected: '/forgot-password' },
  { page: 'reset-password', expected: '/reset-password' },
  { page: 'dashboard', expected: '/dashboard' },
  { page: 'transactions', expected: '/transactions' }
];

for (const test of reverseTests) {
  const result = getPathFromPage(test.page);
  if (result !== test.expected) {
    console.error(`FAIL: ${test.page} expected ${test.expected}, got ${result}`);
    failed++;
  } else {
    console.log(`PASS: ${test.page} -> ${result}`);
  }
}

console.log('\n--- Route Categorization ---');
console.log('Public pages:', PUBLIC_PAGES);
console.log('Protected pages:', PROTECTED_PAGES);

if (failed === 0) {
  console.log('\nALL NAVIGATION TESTS PASSED SUCCESSFULLY!');
} else {
  console.error(`\n${failed} TESTS FAILED!`);
  process.exit(1);
}
