import {
  toSupabaseTransactionRow,
  fromSupabaseTransactionRow,
  batchToSupabaseTransactionRows,
  batchFromSupabaseTransactionRows
} from '../src/utils/transactionAdapter.js';

console.log('================================================================');
console.log('SPENDSENSE — TRANSACTION ADAPTER UNIT TEST SUITE (PHASE 1)');
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

function assertThrows(fn, testName, expectedErrorSnippet = '') {
  try {
    fn();
    console.error(`  [FAIL] ${testName} — Expected function to throw error, but it succeeded.`);
    failed++;
  } catch (err) {
    if (expectedErrorSnippet && !err.message.includes(expectedErrorSnippet)) {
      console.error(`  [FAIL] ${testName} — Threw error, but missing snippet "${expectedErrorSnippet}". Actual: "${err.message}"`);
      failed++;
    } else {
      console.log(`  [PASS] ${testName} (Threw: ${err.message})`);
      passed++;
    }
  }
}

// -------------------------------------------------------------
// SUITE 1: toSupabaseTransactionRow (Client -> DB)
// -------------------------------------------------------------
console.log('--- SUITE 1: Frontend Transaction -> Supabase DB Row ---');

const sampleClientExpense = {
  id: 'txn_12345_local',
  description: 'Swiggy Dinner Order',
  date: '2026-10-24',
  amount: 450.50,
  type: 'expense',
  category: 'Food & Dining Out',
  nature: 'want',
  paymentMethod: 'UPI',
  notes: 'Order with colleagues',
  createdAt: '2026-10-24T18:30:00.000Z'
};

const dummyUserId = 'usr_uuid_0000-1111-2222-3333';

const convertedRow = toSupabaseTransactionRow(sampleClientExpense, dummyUserId);

assert(convertedRow.user_id === dummyUserId, 'Maps user_id correctly');
assert(convertedRow.title === 'Swiggy Dinner Order', 'Maps description -> title');
assert(convertedRow.transaction_date === '2026-10-24', 'Maps date -> transaction_date');
assert(convertedRow.amount === 450.50, 'Preserves numeric positive amount');
assert(convertedRow.type === 'expense', 'Preserves type');
assert(convertedRow.category === 'Food & Dining Out', 'Preserves category');
assert(convertedRow.notes === 'Order with colleagues', 'Preserves notes');
assert(convertedRow.created_at === '2026-10-24T18:30:00.000Z', 'Preserves timestamp');
assert(!('id' in convertedRow), 'Omits client string ID from row to allow Supabase to assign native UUID');

// Strict Validation Tests for toSupabaseTransactionRow (Correction 1)
console.log('\n--- SUITE 2: Validation & Error Rejection (No Silent Coercion) ---');

assertThrows(
  () => toSupabaseTransactionRow({ ...sampleClientExpense, amount: -150 }, dummyUserId),
  'Rejects negative amounts (does not silently apply Math.abs)',
  'Amount must be strictly greater than 0'
);

assertThrows(
  () => toSupabaseTransactionRow({ ...sampleClientExpense, amount: 0 }, dummyUserId),
  'Rejects zero amount',
  'Amount must be strictly greater than 0'
);

assertThrows(
  () => toSupabaseTransactionRow({ ...sampleClientExpense, amount: 'invalid-amt' }, dummyUserId),
  'Rejects non-numeric amount strings',
  'Amount must be a valid number'
);

assertThrows(
  () => toSupabaseTransactionRow({ ...sampleClientExpense, type: 'debit' }, dummyUserId),
  'Rejects invalid type "debit" (does not silently default to expense)',
  'Type must be either "income" or "expense"'
);

assertThrows(
  () => toSupabaseTransactionRow({ ...sampleClientExpense, type: 'credit' }, dummyUserId),
  'Rejects invalid type "credit"',
  'Type must be either "income" or "expense"'
);

assertThrows(
  () => toSupabaseTransactionRow(sampleClientExpense, null),
  'Rejects missing userId',
  'user ID is required'
);

assertThrows(
  () => toSupabaseTransactionRow({ ...sampleClientExpense, description: '   ' }, dummyUserId),
  'Rejects empty description',
  'Title/description is required'
);

assertThrows(
  () => toSupabaseTransactionRow({ ...sampleClientExpense, date: 'not-a-date' }, dummyUserId),
  'Rejects malformed date',
  'Expected YYYY-MM-DD format'
);

// -------------------------------------------------------------
// SUITE 3: fromSupabaseTransactionRow (DB -> Client)
// -------------------------------------------------------------
console.log('\n--- SUITE 3: Supabase DB Row -> Frontend Transaction ---');

const sampleDbRow = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  user_id: dummyUserId,
  title: 'Salary Deposit October',
  amount: '85000.00',
  type: 'income',
  category: 'Salary & Income',
  transaction_date: '2026-10-01',
  notes: 'Direct monthly credit',
  created_at: '2026-10-01T09:00:00.000Z'
};

const convertedClientTxn = fromSupabaseTransactionRow(sampleDbRow);

assert(convertedClientTxn.id === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Maps Supabase UUID to client id');
assert(convertedClientTxn.description === 'Salary Deposit October', 'Maps title -> description');
assert(convertedClientTxn.date === '2026-10-01', 'Maps transaction_date -> date');
assert(convertedClientTxn.amount === 85000, 'Parses numeric amount correctly');
assert(convertedClientTxn.type === 'income', 'Maps type');
assert(convertedClientTxn.category === 'Salary & Income', 'Maps category');
assert(convertedClientTxn.nature === 'income', 'Infers canonical nature="income" for Salary & Income category');
assert(convertedClientTxn.source === 'supabase', 'Tags source as supabase');
assert(typeof convertedClientTxn.hash === 'string' && convertedClientTxn.hash.length > 5, 'Computes deterministic hash fingerprint');

// Strict DB row validation
assertThrows(
  () => fromSupabaseTransactionRow({ ...sampleDbRow, amount: -500 }),
  'DB Read rejects negative amounts',
  'has non-positive amount'
);

assertThrows(
  () => fromSupabaseTransactionRow({ ...sampleDbRow, type: 'refund' }),
  'DB Read rejects invalid type "refund"',
  'Expected "income" or "expense"'
);

assertThrows(
  () => fromSupabaseTransactionRow({ ...sampleDbRow, id: null }),
  'DB Read rejects missing id',
  'missing primary key "id"'
);

// -------------------------------------------------------------
// SUITE 4: Nature & PaymentMethod Fallback & Preservation
// -------------------------------------------------------------
console.log('\n--- SUITE 4: Nature & PaymentMethod Handling (Corrections 2 & 3) ---');

// Known category fallback
const diningRow = {
  id: 'uuid-1',
  title: 'Starbucks Coffee',
  amount: 320,
  type: 'expense',
  category: 'Food & Dining Out',
  transaction_date: '2026-10-15'
};
const diningTxn = fromSupabaseTransactionRow(diningRow);
assert(diningTxn.nature === 'want', 'Infers nature "want" for Food & Dining Out category');
assert(diningTxn.paymentMethod === '', 'Neutral fallback for missing paymentMethod is empty string (not hardcoded to UPI)');

const rentRow = {
  id: 'uuid-2',
  title: 'Monthly Flat Rent',
  amount: 25000,
  type: 'expense',
  category: 'Rent & Housing',
  transaction_date: '2026-10-05'
};
const rentTxn = fromSupabaseTransactionRow(rentRow);
assert(rentTxn.nature === 'need', 'Infers nature "need" for Rent & Housing category');

// Unknown category fallback
const unknownCatRow = {
  id: 'uuid-3',
  title: 'Antique Auction',
  amount: 15000,
  type: 'expense',
  category: 'Rare Collectibles',
  transaction_date: '2026-10-20'
};
const unknownTxn = fromSupabaseTransactionRow(unknownCatRow);
assert(unknownTxn.nature === 'want', 'Unknown expense category safely falls back to "want"');

// Preservation of existing local transaction attributes (Correction 3)
const existingLocalCustomTxn = {
  id: 'local_1',
  description: 'Starbucks Coffee',
  nature: 'need', // User specifically marked this coffee as a "need"
  paymentMethod: 'Credit Card' // User specifically recorded payment via Credit Card
};

const preservedTxn = fromSupabaseTransactionRow(diningRow, existingLocalCustomTxn);
assert(
  preservedTxn.nature === 'need',
  'Preserves existing local transaction custom nature="need" (never overwritten by category default)'
);
assert(
  preservedTxn.paymentMethod === 'Credit Card',
  'Preserves existing local transaction custom paymentMethod="Credit Card"'
);

// -------------------------------------------------------------
// SUITE 5: Batch Conversions
// -------------------------------------------------------------
console.log('\n--- SUITE 5: Batch Operations ---');

const batchClient = [
  sampleClientExpense,
  {
    description: 'Grocery run',
    date: '2026-10-22',
    amount: 1200,
    type: 'expense',
    category: 'Groceries & Household'
  }
];

const batchRows = batchToSupabaseTransactionRows(batchClient, dummyUserId);
assert(batchRows.length === 2, 'Batch converts client transactions to DB rows');
assert(batchRows[1].title === 'Grocery run', 'Second item converted cleanly');

const batchDb = [sampleDbRow, diningRow];
const batchResult = batchFromSupabaseTransactionRows(batchDb);
assert(batchResult.length === 2, 'Batch converts DB rows to frontend models');
assert(batchResult[0].description === 'Salary Deposit October', 'First DB row converted');
assert(batchResult[1].description === 'Starbucks Coffee', 'Second DB row converted');

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`TRANSACTION ADAPTER TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
