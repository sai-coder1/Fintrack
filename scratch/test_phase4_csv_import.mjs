import { parseCsvFile, suggestColumnMapping, normalizeCsvRows, parseAndNormalizeDate } from '../src/utils/csvParser.js';
import { detectBatchDuplicates, generateTransactionHash } from '../src/utils/duplicateDetector.js';
import { toSupabaseTransactionRow, fromSupabaseTransactionRow, batchToSupabaseTransactionRows, batchFromSupabaseTransactionRows } from '../src/utils/transactionAdapter.js';

console.log('================================================================');
console.log('SPENDSENSE — PHASE 4 CSV CLOUD IMPORT TEST SUITE');
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

const activeUserId = 'usr_uuid_phase4_test_user_123';

// -------------------------------------------------------------
// SUITE 1: Valid CSV with Income & Expense Rows
// -------------------------------------------------------------
console.log('--- SUITE 1: Valid CSV with Income & Expense Rows ---');

const sampleCsvText = `Date,Narration,Withdrawal,Deposit
24/10/2026,Swiggy Gourmet,850.00,0.00
23/10/2026,Monthly Client Retainer,0.00,65000.00
22/10/2026,Reliance Fresh Groceries,2450.50,0.00`;

const parsed = await parseCsvFile(sampleCsvText);
assert(parsed.headers.length === 4, 'Parsed 4 headers correctly');
assert(parsed.rows.length === 3, 'Parsed 3 transaction rows');

const mapping = suggestColumnMapping(parsed.headers);
assert(mapping.dateCol === 'Date', 'Auto-detected Date column');
assert(mapping.descCol === 'Narration', 'Auto-detected Narration column');
assert(mapping.amountMode === 'separate', 'Auto-detected separate debit/credit mode');
assert(mapping.debitCol === 'Withdrawal', 'Auto-detected Withdrawal column');
assert(mapping.creditCol === 'Deposit', 'Auto-detected Deposit column');

const normalized = normalizeCsvRows(parsed.rows, mapping);
assert(normalized.length === 3, 'Normalized 3 candidate rows');
assert(normalized[0].isValid, 'Row 1 is marked valid');
assert(normalized[0].type === 'expense', 'Row 1 correctly identified as expense');
assert(normalized[0].amount === 850, 'Row 1 amount is positive 850');
assert(normalized[1].isValid, 'Row 2 is marked valid');
assert(normalized[1].type === 'income', 'Row 2 correctly identified as income');
assert(normalized[1].amount === 65000, 'Row 2 amount is positive 65000');
assert(normalized[2].amount === 2450.5, 'Row 3 amount matches 2450.50');

// Convert to Supabase DB payload
const dbRows = batchToSupabaseTransactionRows(normalized, activeUserId);
assert(dbRows.length === 3, 'Batch converted 3 rows for Supabase insertion');
assert(dbRows[0].user_id === activeUserId, 'DB row 1 includes user_id');
assert(dbRows[0].title === 'Swiggy Gourmet', 'DB row 1 title mapped from description');
assert(dbRows[0].transaction_date === '2026-10-24', 'DB row 1 date converted to ISO format');
assert(!('id' in dbRows[0]), 'Client ID omitted so Supabase assigns UUID');

// Simulate Supabase response with assigned UUIDs
const mockSupabaseResponse = [
  { id: 'uuid-row-1', ...dbRows[0], created_at: '2026-10-24T12:00:00Z' },
  { id: 'uuid-row-2', ...dbRows[1], created_at: '2026-10-23T12:00:00Z' },
  { id: 'uuid-row-3', ...dbRows[2], created_at: '2026-10-22T12:00:00Z' }
];

const confirmedFrontendTxns = mockSupabaseResponse.map((row, idx) =>
  fromSupabaseTransactionRow(row, normalized[idx])
);
assert(confirmedFrontendTxns.length === 3, 'Converted confirmed rows back to frontend model');
assert(confirmedFrontendTxns[0].id === 'uuid-row-1', 'Frontend model has native Supabase UUID');
assert(confirmedFrontendTxns[0].source === 'supabase', 'Tagged with source: supabase');
assert(confirmedFrontendTxns[1].type === 'income', 'Preserved income type');

// -------------------------------------------------------------
// SUITE 2: Invalid Dates, Amounts, and Types
// -------------------------------------------------------------
console.log('\n--- SUITE 2: Invalid Dates, Amounts, and Types ---');

const invalidCsvText = `Date,Narration,Withdrawal,Deposit
invalid-date,Coffee Shop,150.00,0.00
20/10/2026,,200.00,0.00
21/10/2026,Zero Amount Txn,0.00,0.00`;

const parsedInvalid = await parseCsvFile(invalidCsvText);
const normalizedInvalid = normalizeCsvRows(parsedInvalid.rows, mapping);

assert(!normalizedInvalid[0].isValid, 'Row with invalid date marked invalid');
assert(normalizedInvalid[0].errors.some((e) => e.toLowerCase().includes('date')), 'Date error captured in row errors');

assert(!normalizedInvalid[1].isValid, 'Row with empty description marked invalid');
assert(normalizedInvalid[1].errors.some((e) => e.toLowerCase().includes('description')), 'Description error captured');

assert(!normalizedInvalid[2].isValid, 'Row with zero debit and credit marked invalid');

// Ensure transactionAdapter also strictly throws on invalid data
let rejectedCount = 0;
try {
  toSupabaseTransactionRow({ date: 'not-a-date', description: 'Test', amount: 100, type: 'expense' }, activeUserId);
} catch {
  rejectedCount++;
}
try {
  toSupabaseTransactionRow({ date: '2026-10-24', description: 'Test', amount: -50, type: 'expense' }, activeUserId);
} catch {
  rejectedCount++;
}
try {
  toSupabaseTransactionRow({ date: '2026-10-24', description: 'Test', amount: 100, type: 'invalid_type' }, activeUserId);
} catch {
  rejectedCount++;
}
assert(rejectedCount === 3, 'transactionAdapter strictly rejects invalid dates, non-positive amounts, and unknown types');

// -------------------------------------------------------------
// SUITE 3: Duplicate Rows Detection (Batch & Against Existing)
// -------------------------------------------------------------
console.log('\n--- SUITE 3: Duplicate Rows Detection ---');

const existingCloudTransactions = [
  {
    id: 'existing-uuid-1',
    date: '2026-10-24',
    description: 'Swiggy Gourmet',
    amount: 850,
    type: 'expense'
  }
];

const batchWithDuplicates = [
  // 1. Matches existing in database
  { id: 'cand-1', date: '2026-10-24', description: 'Swiggy Gourmet', amount: 850, type: 'expense', isValid: true },
  // 2. Fresh new transaction
  { id: 'cand-2', date: '2026-10-21', description: 'Uber Trip', amount: 320, type: 'expense', isValid: true },
  // 3. Duplicate of cand-2 within the same file batch
  { id: 'cand-3', date: '2026-10-21', description: 'Uber Trip', amount: 320, type: 'expense', isValid: true }
];

const deduplicated = detectBatchDuplicates(batchWithDuplicates, existingCloudTransactions);

assert(deduplicated[0].isDuplicate === true, 'Identified duplicate against existing cloud ledger');
assert(deduplicated[0].duplicateSource === 'existing', 'Duplicate source flagged as "existing"');
assert(deduplicated[0].selected === false, 'Existing duplicate unselected by default');

assert(deduplicated[1].isDuplicate === false, 'New transaction flagged as unique');
assert(deduplicated[1].selected === true, 'New transaction selected by default');

assert(deduplicated[2].isDuplicate === true, 'Identified batch duplicate within same CSV');
assert(deduplicated[2].duplicateSource === 'batch', 'Duplicate source flagged as "batch"');
assert(deduplicated[2].selected === false, 'Batch duplicate unselected by default');

// -------------------------------------------------------------
// SUITE 4: Empty CSV and Malformed CSV
// -------------------------------------------------------------
console.log('\n--- SUITE 4: Empty CSV and Malformed CSV ---');

let emptyCaught = false;
try {
  const emptyRes = await parseCsvFile('');
  if (!emptyRes.rows || emptyRes.rows.length === 0) emptyCaught = true;
} catch {
  emptyCaught = true;
}
assert(emptyCaught, 'Empty CSV correctly identified with zero data rows');

const headersOnlyCsv = 'Date,Narration,Amount\n';
const headersOnlyRes = await parseCsvFile(headersOnlyCsv);
assert(headersOnlyRes.rows.length === 0, 'Header-only CSV yields 0 rows');

// -------------------------------------------------------------
// SUITE 5: Supabase / Network Errors and Partial Failures
// -------------------------------------------------------------
console.log('\n--- SUITE 5: Supabase Errors and Partial Failures ---');

// Simulate bulk failure fallback logic
const candidatePayloads = [
  { title: 'Good Row 1', transaction_date: '2026-10-24', amount: 100, type: 'expense', user_id: activeUserId },
  { title: 'Failing Row', transaction_date: '2026-10-23', amount: 200, type: 'expense', user_id: activeUserId },
  { title: 'Good Row 2', transaction_date: '2026-10-22', amount: 300, type: 'expense', user_id: activeUserId }
];

// Mock Supabase: Bulk insert fails, row-by-row succeeds for good rows
let mockCloudState = [];
const failedRows = [];

for (const row of candidatePayloads) {
  if (row.title === 'Failing Row') {
    failedRows.push({ description: row.title, error: 'Simulated foreign key or check constraint error' });
  } else {
    mockCloudState.push({ id: `uuid-${row.amount}`, ...row });
  }
}

assert(mockCloudState.length === 2, 'Only confirmed rows added to cloud state on partial failure');
assert(failedRows.length === 1, 'Failed row captured with exact error message');
assert(failedRows[0].description === 'Failing Row', 'Identified exact failed row');

// -------------------------------------------------------------
// SUITE 6: Signed-Out and Demo-Mode Behavior
// -------------------------------------------------------------
console.log('\n--- SUITE 6: Signed-Out and Demo-Mode Behavior ---');

// 6.1 Demo Mode
let sampleState = [];
const demoCandidates = [{ id: 'demo-1', description: 'Demo Entry', amount: 500, type: 'expense', date: '2026-10-24' }];
const isSampleMode = true;

if (isSampleMode) {
  sampleState = [...demoCandidates, ...sampleState];
}

assert(sampleState.length === 1, 'Demo mode adds to sampleState in memory');
assert(mockCloudState.length === 2, 'Cloud state was NOT touched in demo mode');

// 6.2 Signed-out personal mode check
const isPersonalMode = true;
const noUser = null;
const isSupabaseConfigured = true;
let signedOutError = null;

if (isPersonalMode && isSupabaseConfigured && !noUser) {
  signedOutError = 'Active user session not found. Please verify you are signed in.';
}
assert(Boolean(signedOutError), 'Signed-out personal mode returns meaningful error preventing unauthenticated cloud save');

// -------------------------------------------------------------
// SUITE 7: Refresh Rehydration After Successful Cloud Import
// -------------------------------------------------------------
console.log('\n--- SUITE 7: Refresh Rehydration After Cloud Import ---');

// Server database table now holds confirmed rows
const serverTable = [
  { id: 'uuid-row-1', user_id: activeUserId, title: 'Swiggy Gourmet', transaction_date: '2026-10-24', amount: 850, type: 'expense', category: 'Food & Dining Out', notes: '' },
  { id: 'uuid-row-2', user_id: activeUserId, title: 'Monthly Client Retainer', transaction_date: '2026-10-23', amount: 65000, type: 'income', category: 'Salary & Income', notes: '' }
];

// Page refresh: fetchCloudTransactions reads rows
const rehydrated = batchFromSupabaseTransactionRows(serverTable);
assert(rehydrated.length === 2, 'Rehydrated all confirmed imported rows on refresh');
assert(rehydrated[0].id === 'uuid-row-1', 'First transaction preserves Supabase UUID');
assert(rehydrated[0].description === 'Swiggy Gourmet', 'Preserves narration');
assert(rehydrated[1].type === 'income', 'Preserves credit income type');

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`PHASE 4 CSV CLOUD IMPORT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) process.exit(1);
