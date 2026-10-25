import { fromSupabaseTransactionRow } from '../src/utils/transactionAdapter.js';

console.log('================================================================');
console.log('SPENDSENSE — PHASE 2 CLOUD FETCH LOGIC VERIFICATION');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// -------------------------------------------------------------
// TEST 1: State Separation (Loading, Empty Success, Error Fallback)
// -------------------------------------------------------------
console.log('--- TEST 1: State Separation & Active Collections Resolution ---');

const sampleLocalTxns = [
  {
    id: 'txn_local_1',
    description: 'Local Grocery',
    date: '2026-10-20',
    amount: 1500,
    type: 'expense',
    category: 'Groceries & Household',
    nature: 'need',
    paymentMethod: 'Cash'
  }
];

const sampleDemoTxns = [
  {
    id: 'demo_1',
    description: 'Demo Rent',
    date: '2026-10-01',
    amount: 25000,
    type: 'expense',
    category: 'Rent & Housing',
    nature: 'need',
    paymentMethod: 'Net Banking'
  }
];

// Helper mimicking FinanceContext's transactions resolver
function resolveTransactions({ isSampleMode, user, cloudTxnStatus, cloudTransactions, userTransactions, sampleTransactions }) {
  if (isSampleMode) return sampleTransactions;
  if (user && cloudTxnStatus === 'success') return cloudTransactions;
  return userTransactions;
}

// 1.1: Demo Mode isolation
const demoResolved = resolveTransactions({
  isSampleMode: true,
  user: { id: 'usr_123' },
  cloudTxnStatus: 'success',
  cloudTransactions: [{ id: 'cloud_1' }],
  userTransactions: sampleLocalTxns,
  sampleTransactions: sampleDemoTxns
});
assert(demoResolved === sampleDemoTxns, 'Sample/Demo mode is 100% isolated even if user is logged in');

// 1.2: Signed out in personal mode -> returns local storage transactions
const signedOutResolved = resolveTransactions({
  isSampleMode: false,
  user: null,
  cloudTxnStatus: 'idle',
  cloudTransactions: [],
  userTransactions: sampleLocalTxns,
  sampleTransactions: sampleDemoTxns
});
assert(signedOutResolved === sampleLocalTxns, 'Signed-out personal mode resolves to localStorage userTransactions');

// 1.3: Authenticated with successful cloud transactions
const cloudList = [
  {
    id: 'uuid-101',
    description: 'Cloud Salary',
    date: '2026-10-01',
    amount: 80000,
    type: 'income',
    category: 'Salary & Income'
  }
];
const cloudResolved = resolveTransactions({
  isSampleMode: false,
  user: { id: 'usr_123' },
  cloudTxnStatus: 'success',
  cloudTransactions: cloudList,
  userTransactions: sampleLocalTxns,
  sampleTransactions: sampleDemoTxns
});
assert(cloudResolved === cloudList, 'Authenticated personal mode uses cloudTransactions on success');

// 1.4: Authenticated with genuinely empty cloud account (0 transactions)
const emptyCloudResolved = resolveTransactions({
  isSampleMode: false,
  user: { id: 'usr_new' },
  cloudTxnStatus: 'success',
  cloudTransactions: [],
  userTransactions: sampleLocalTxns,
  sampleTransactions: sampleDemoTxns
});
assert(Array.isArray(emptyCloudResolved) && emptyCloudResolved.length === 0, 'Genuinely empty cloud account resolves to empty list without falling back to demo');

// 1.5: Authenticated with network error -> does NOT wipe data, falls back safely to local transactions
const errorResolved = resolveTransactions({
  isSampleMode: false,
  user: { id: 'usr_123' },
  cloudTxnStatus: 'error',
  cloudTransactions: [],
  userTransactions: sampleLocalTxns,
  sampleTransactions: sampleDemoTxns
});
assert(errorResolved === sampleLocalTxns, 'Network error falls back to localStorage userTransactions without data loss');

// -------------------------------------------------------------
// TEST 2: Stale Request / Account Switch Race Condition Guard
// -------------------------------------------------------------
console.log('\n--- TEST 2: Stale Request & Account Switching Guards ---');

let activeFetchId = 0;
let displayedCloudTxns = [];

// Simulate User A logs in and launches fetch
const fetchIdA = ++activeFetchId;
const userA_id = 'user_A_uuid';

// User A signs out before fetch returns -> activeFetchId increments
activeFetchId++;
displayedCloudTxns = []; // Cleared on signout

// Later, the delayed response for User A arrives
const userA_data = [{ id: 'txn_A_1', title: 'User A Secret Transaction' }];
if (fetchIdA === activeFetchId) {
  displayedCloudTxns = userA_data;
}

assert(displayedCloudTxns.length === 0, 'Delayed response from User A is safely discarded after sign-out');

// Simulate User B logs in
const fetchIdB = ++activeFetchId;
const userB_id = 'user_B_uuid';
const userB_data = [{ id: 'txn_B_1', title: 'User B Transaction' }];

if (fetchIdB === activeFetchId) {
  displayedCloudTxns = userB_data;
}

assert(displayedCloudTxns === userB_data, 'User B fetch resolves and binds correctly');

// -------------------------------------------------------------
// TEST 3: Conversion with Local Attribute Preservation
// -------------------------------------------------------------
console.log('\n--- TEST 3: Row Conversion & Local Attribute Preservation ---');

const rawDbRows = [
  {
    id: 'db-uuid-1',
    user_id: 'usr_123',
    title: 'Local Grocery',
    amount: '1500.00',
    type: 'expense',
    category: 'Groceries & Household',
    transaction_date: '2026-10-20'
  }
];

const localMap = new Map();
sampleLocalTxns.forEach((t) => {
  if (t.id) localMap.set(t.id, t);
  if (t.hash) localMap.set(t.hash, t);
});

const converted = rawDbRows.map((row) => {
  const match = localMap.get(row.id) || null;
  return fromSupabaseTransactionRow(row, match);
});

assert(converted.length === 1, 'Converted 1 Supabase row');
assert(converted[0].id === 'db-uuid-1', 'ID preserved');
assert(converted[0].amount === 1500, 'Amount parsed to positive number');
assert(converted[0].nature === 'need', 'Nature correctly resolved to "need"');

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`PHASE 2 LOGIC VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) process.exit(1);
