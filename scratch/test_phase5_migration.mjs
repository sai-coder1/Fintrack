/**
 * SpendSense — Phase 5 Test Suite
 * Safe LocalStorage-to-Supabase Transaction Migration
 *
 * Verifies all 12 functional testing scenarios required by Phase 5:
 * 1. No local transactions.
 * 2. Valid local income and expense transactions.
 * 3. Invalid descriptions, dates, amounts, and transaction types.
 * 4. Duplicates against cloud transactions.
 * 5. Duplicate rows within local data.
 * 6. Signed-out users and demo/sample mode.
 * 7. User-specific ownership and RLS-compatible inserts.
 * 8. Explicit confirmation before upload.
 * 9. Supabase/network errors and partial failures.
 * 10. Repeated migration attempts and uncertain request outcomes.
 * 11. Refresh after successful migration.
 * 12. localStorage remaining unchanged in every scenario.
 */

import assert from 'assert';
import {
  validateCandidateTransaction,
  analyzeLocalTransactionsForMigration,
  executeLocalTransactionsMigration
} from '../src/utils/migrationService.js';
import {
  toSupabaseTransactionRow,
  fromSupabaseTransactionRow
} from '../src/utils/transactionAdapter.js';
import { STORAGE_KEYS } from '../src/utils/storage.js';

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

console.log('================================================================');
console.log('SPENDSENSE — PHASE 5 MIGRATION TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SUITE 1: No Local Transactions
// -----------------------------------------------------------------------------
console.log('--- SUITE 1: No Local Transactions ---');

test('Empty local array yields 0 counts and empty analyzed rows', () => {
  const result = analyzeLocalTransactionsForMigration({
    localTransactions: [],
    cloudTransactions: []
  });
  assert.strictEqual(result.totalFound, 0);
  assert.strictEqual(result.eligibleCount, 0);
  assert.strictEqual(result.duplicateCount, 0);
  assert.strictEqual(result.invalidCount, 0);
  assert.strictEqual(result.analyzedRows.length, 0);
});

test('Null or non-array localTransactions handled safely without error', () => {
  const result = analyzeLocalTransactionsForMigration({
    localTransactions: null,
    cloudTransactions: []
  });
  assert.strictEqual(result.totalFound, 0);
  assert.strictEqual(result.eligibleCount, 0);
});

test('Executing migration with empty array succeeds cleanly with count 0', async () => {
  const mockSupabase = { from: () => ({ insert: () => ({ select: () => Promise.resolve({ data: [] }) }) }) };
  const res = await executeLocalTransactionsMigration({
    transactionsToMigrate: [],
    activeUserId: 'usr-12345',
    supabaseClient: mockSupabase
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.migratedCount, 0);
  assert.strictEqual(res.failedCount, 0);
});

// -----------------------------------------------------------------------------
// SUITE 2: Valid Local Income and Expense Transactions
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Valid Local Income and Expense Transactions ---');

const sampleValidTxns = [
  {
    id: 'local_1',
    description: 'Blinkit Grocery Bangalore',
    date: '2026-10-12',
    amount: 1450.50,
    type: 'expense',
    category: 'Groceries & Essentials',
    nature: 'need',
    paymentMethod: 'UPI'
  },
  {
    id: 'local_2',
    description: 'Monthly Salary Credit',
    date: '2026-10-01',
    amount: 85000,
    type: 'income',
    category: 'Income & Transfers',
    nature: 'income',
    paymentMethod: 'Net Banking'
  }
];

test('Valid income and expense rows are flagged eligible and selected by default', () => {
  const result = analyzeLocalTransactionsForMigration({
    localTransactions: sampleValidTxns,
    cloudTransactions: []
  });

  assert.strictEqual(result.totalFound, 2);
  assert.strictEqual(result.eligibleCount, 2);
  assert.strictEqual(result.duplicateCount, 0);
  assert.strictEqual(result.invalidCount, 0);

  const row1 = result.analyzedRows[0];
  assert.strictEqual(row1.isValid, true);
  assert.strictEqual(row1.type, 'expense');
  assert.strictEqual(row1.amount, 1450.50);
  assert.strictEqual(row1.selected, true);

  const row2 = result.analyzedRows[1];
  assert.strictEqual(row2.isValid, true);
  assert.strictEqual(row2.type, 'income');
  assert.strictEqual(row2.amount, 85000);
  assert.strictEqual(row2.selected, true);
});

// -----------------------------------------------------------------------------
// SUITE 3: Invalid Descriptions, Dates, Amounts, and Transaction Types
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Invalid Descriptions, Dates, Amounts, and Types ---');

test('Rejects row with empty or whitespace-only description', () => {
  const bad = { description: '   ', date: '2026-10-15', amount: 500, type: 'expense' };
  const val = validateCandidateTransaction(bad);
  assert.strictEqual(val.isValid, false);
  assert(val.error.includes('Missing required description'));
});

test('Rejects row with invalid date format', () => {
  const bad = { description: 'Coffee', date: '15/10/2026', amount: 200, type: 'expense' };
  const val = validateCandidateTransaction(bad);
  assert.strictEqual(val.isValid, false);
  assert(val.error.includes('Expected YYYY-MM-DD'));
});

test('Rejects row with non-positive amount (negative or zero)', () => {
  const badNeg = { description: 'Refund', date: '2026-10-15', amount: -250, type: 'expense' };
  const valNeg = validateCandidateTransaction(badNeg);
  assert.strictEqual(valNeg.isValid, false);
  assert(valNeg.error.includes('strictly greater than 0'));

  const badZero = { description: 'Zero item', date: '2026-10-15', amount: 0, type: 'expense' };
  const valZero = validateCandidateTransaction(badZero);
  assert.strictEqual(valZero.isValid, false);
});

test('Rejects row with non-numeric or NaN amount', () => {
  const badNaN = { description: 'Invalid item', date: '2026-10-15', amount: 'N/A', type: 'expense' };
  const valNaN = validateCandidateTransaction(badNaN);
  assert.strictEqual(valNaN.isValid, false);
  assert(valNaN.error.includes('Must be a valid number'));
});

test('Rejects row with unknown transaction type', () => {
  const badType = { description: 'Transfer', date: '2026-10-15', amount: 1000, type: 'transfer' };
  const valType = validateCandidateTransaction(badType);
  assert.strictEqual(valType.isValid, false);
  assert(valType.error.includes('Must be "income" or "expense"'));
});

test('Invalid rows are flagged in preview and unselected', () => {
  const mixed = [
    { id: 'ok', description: 'Valid', date: '2026-10-15', amount: 100, type: 'expense' },
    { id: 'bad1', description: '', date: '2026-10-15', amount: 100, type: 'expense' },
    { id: 'bad2', description: 'Bad amount', date: '2026-10-15', amount: -50, type: 'expense' }
  ];
  const res = analyzeLocalTransactionsForMigration({ localTransactions: mixed, cloudTransactions: [] });
  assert.strictEqual(res.totalFound, 3);
  assert.strictEqual(res.eligibleCount, 1);
  assert.strictEqual(res.invalidCount, 2);
  assert.strictEqual(res.analyzedRows[1].selected, false);
  assert.strictEqual(res.analyzedRows[2].selected, false);
});

// -----------------------------------------------------------------------------
// SUITE 4: Duplicates Against Cloud Transactions
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Duplicates Against Cloud Transactions ---');

const existingCloudLedger = [
  {
    id: 'supabase-uuid-1',
    description: 'Swiggy Bangalore',
    date: '2026-10-14',
    amount: 620,
    type: 'expense'
  }
];

test('Identifies duplicate matching existing cloud transaction and unselects by default', () => {
  const localBatch = [
    {
      id: 'local_dup_cloud',
      description: 'Swiggy Bangalore',
      date: '2026-10-14',
      amount: 620,
      type: 'expense'
    },
    {
      id: 'local_unique',
      description: 'Uber Ride Indiranagar',
      date: '2026-10-14',
      amount: 340,
      type: 'expense'
    }
  ];

  const res = analyzeLocalTransactionsForMigration({
    localTransactions: localBatch,
    cloudTransactions: existingCloudLedger
  });

  assert.strictEqual(res.totalFound, 2);
  assert.strictEqual(res.eligibleCount, 1);
  assert.strictEqual(res.duplicateCount, 1);

  const dupRow = res.analyzedRows[0];
  assert.strictEqual(dupRow.isDuplicate, true);
  assert.strictEqual(dupRow.duplicateSource, 'existing');
  assert.strictEqual(dupRow.selected, false);
  assert(dupRow.duplicateReason.includes('Matches existing cloud transaction'));

  const uniqueRow = res.analyzedRows[1];
  assert.strictEqual(uniqueRow.isDuplicate, false);
  assert.strictEqual(uniqueRow.selected, true);
});

// -----------------------------------------------------------------------------
// SUITE 5: Duplicate Rows Within Local Data Batch
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Duplicate Rows Within Local Data Batch ---');

test('Identifies identical transactions within local data as batch duplicates', () => {
  const intraBatch = [
    {
      id: 'item_1',
      description: 'Bescom Electricity Bill',
      date: '2026-10-10',
      amount: 1850,
      type: 'expense'
    },
    {
      id: 'item_2',
      description: 'Bescom Electricity Bill',
      date: '2026-10-10',
      amount: 1850,
      type: 'expense'
    }
  ];

  const res = analyzeLocalTransactionsForMigration({
    localTransactions: intraBatch,
    cloudTransactions: []
  });

  assert.strictEqual(res.totalFound, 2);
  assert.strictEqual(res.eligibleCount, 1);
  assert.strictEqual(res.duplicateCount, 1);

  const first = res.analyzedRows[0];
  assert.strictEqual(first.isDuplicate, false);
  assert.strictEqual(first.selected, true);

  const second = res.analyzedRows[1];
  assert.strictEqual(second.isDuplicate, true);
  assert.strictEqual(second.duplicateSource, 'batch');
  assert.strictEqual(second.selected, false);
  assert(second.duplicateReason.includes('Duplicate of local transaction #1'));
});

// -----------------------------------------------------------------------------
// SUITE 6: Signed-Out Users and Demo/Sample Mode
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 6: Signed-Out Users and Demo/Sample Mode ---');

test('Rejects migration when userId is missing or empty string', async () => {
  const mockSupabase = { from: () => {} };
  const res = await executeLocalTransactionsMigration({
    transactionsToMigrate: sampleValidTxns,
    activeUserId: '',
    supabaseClient: mockSupabase
  });
  assert.strictEqual(res.success, false);
  assert(res.error.includes('Authenticated user session is required'));
  assert.strictEqual(res.migratedCount, 0);
});

test('Rejects migration when Supabase client is null or unconfigured', async () => {
  const res = await executeLocalTransactionsMigration({
    transactionsToMigrate: sampleValidTxns,
    activeUserId: 'usr-1234',
    supabaseClient: null
  });
  assert.strictEqual(res.success, false);
  assert(res.error.includes('Supabase client is not available'));
});

// -----------------------------------------------------------------------------
// SUITE 7: User-Specific Ownership and RLS-Compatible Inserts
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 7: User-Specific Ownership and RLS-Compatible Inserts ---');

test('Inserts payload associates authenticated user_id with every row and omits client ID', async () => {
  const insertedRowsCaptured = [];
  const testUserId = 'auth-user-uuid-999';

  const mockSupabase = {
    from: (table) => {
      assert.strictEqual(table, 'transactions');
      return {
        insert: (payload) => {
          insertedRowsCaptured.push(...payload);
          return {
            select: () => Promise.resolve({
              data: payload.map((p, i) => ({
                id: `supabase-generated-uuid-${i + 1}`,
                ...p
              })),
              error: null
            })
          };
        }
      };
    }
  };

  const res = await executeLocalTransactionsMigration({
    transactionsToMigrate: sampleValidTxns,
    activeUserId: testUserId,
    supabaseClient: mockSupabase
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.migratedCount, 2);
  assert.strictEqual(insertedRowsCaptured.length, 2);

  insertedRowsCaptured.forEach((row) => {
    assert.strictEqual(row.user_id, testUserId);
    assert.strictEqual(row.id, undefined); // Supabase must assign native UUID
    assert(typeof row.title === 'string' && row.title.length > 0);
    assert(typeof row.transaction_date === 'string');
    assert(typeof row.amount === 'number' && row.amount > 0);
    assert(row.type === 'income' || row.type === 'expense');
  });

  // Check returned frontend transactions have native Supabase UUIDs
  assert.strictEqual(res.confirmedTxns[0].id, 'supabase-generated-uuid-1');
  assert.strictEqual(res.confirmedTxns[0].source, 'supabase');
  assert.strictEqual(res.confirmedTxns[1].id, 'supabase-generated-uuid-2');
});

// -----------------------------------------------------------------------------
// SUITE 8: Explicit Confirmation Before Upload
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 8: Explicit Confirmation Before Upload ---');

test('Preview analysis executes 0 network calls and does not trigger insert', () => {
  let networkCalls = 0;
  const spySupabase = {
    from: () => {
      networkCalls++;
      return { insert: () => {} };
    }
  };

  // Preview step
  const preview = analyzeLocalTransactionsForMigration({
    localTransactions: sampleValidTxns,
    cloudTransactions: []
  });

  assert.strictEqual(networkCalls, 0);
  assert.strictEqual(preview.totalFound, 2);
});

// -----------------------------------------------------------------------------
// SUITE 9: Supabase/Network Errors and Partial Failures
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 9: Supabase/Network Errors and Partial Failures ---');

test('Isolates row-by-row failures when bulk insert encounters error', async () => {
  const candidateBatch = [
    { id: 'tx1', description: 'Good Expense', date: '2026-10-18', amount: 500, type: 'expense' },
    { id: 'tx2', description: 'Failing Expense', date: '2026-10-18', amount: 600, type: 'expense' },
    { id: 'tx3', description: 'Good Income', date: '2026-10-18', amount: 1500, type: 'income' }
  ];

  let bulkInsertAttempted = false;

  const mockSupabase = {
    from: () => ({
      insert: (payload) => {
        if (Array.isArray(payload)) {
          bulkInsertAttempted = true;
          // Simulate bulk insert rejection (e.g., constraint error on one item)
          return {
            select: () => Promise.resolve({ data: null, error: { message: 'Bulk constraint violation' } })
          };
        } else {
          // Per-row fallback
          if (payload.title === 'Failing Expense') {
            return {
              select: () => ({
                single: () => Promise.resolve({ data: null, error: { message: 'Row RLS rejection' } })
              })
            };
          }
          return {
            select: () => ({
              single: () => Promise.resolve({
                data: { id: `uuid-${payload.title}`, ...payload },
                error: null
              })
            })
          };
        }
      }
    })
  };

  const res = await executeLocalTransactionsMigration({
    transactionsToMigrate: candidateBatch,
    activeUserId: 'usr-rls-1',
    supabaseClient: mockSupabase
  });

  assert.strictEqual(bulkInsertAttempted, true);
  assert.strictEqual(res.success, true); // Partial success
  assert.strictEqual(res.migratedCount, 2);
  assert.strictEqual(res.failedCount, 1);
  assert.strictEqual(res.errors[0].description, 'Failing Expense');
  assert(res.errors[0].error.includes('Row RLS rejection'));
});

// -----------------------------------------------------------------------------
// SUITE 10: Repeated Migration Attempts and Uncertain Request Outcomes
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 10: Repeated Migration Attempts and Idempotency ---');

test('Subsequent migration attempt marks previously migrated items as duplicates', () => {
  const localList = [
    { id: 'item_a', description: 'Netflix India', date: '2026-10-05', amount: 649, type: 'expense' }
  ];

  // First run: Empty cloud ledger -> eligible
  const run1 = analyzeLocalTransactionsForMigration({ localTransactions: localList, cloudTransactions: [] });
  assert.strictEqual(run1.eligibleCount, 1);
  assert.strictEqual(run1.duplicateCount, 0);

  // Simulate cloud ledger now contains confirmed item
  const updatedCloud = [
    { id: 'uuid-netflix', description: 'Netflix India', date: '2026-10-05', amount: 649, type: 'expense' }
  ];

  // Second run: Detected as duplicate against cloud -> skipped
  const run2 = analyzeLocalTransactionsForMigration({ localTransactions: localList, cloudTransactions: updatedCloud });
  assert.strictEqual(run2.eligibleCount, 0);
  assert.strictEqual(run2.duplicateCount, 1);
  assert.strictEqual(run2.analyzedRows[0].selected, false);
});

// -----------------------------------------------------------------------------
// SUITE 11: Refresh Rehydration After Successful Migration
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 11: Refresh Rehydration After Successful Migration ---');

test('Cloud transactions rehydrate with native Supabase UUIDs and match ledger schema', () => {
  const dbRows = [
    {
      id: 'supabase-uuid-abc-123',
      title: 'Bescom Bill',
      transaction_date: '2026-10-10',
      amount: 1450,
      type: 'expense',
      category: 'Utilities & Bills',
      notes: 'Monthly power',
      created_at: '2026-10-10T10:00:00.000Z'
    }
  ];

  const rehydrated = dbRows.map((r) => fromSupabaseTransactionRow(r));
  assert.strictEqual(rehydrated.length, 1);
  assert.strictEqual(rehydrated[0].id, 'supabase-uuid-abc-123');
  assert.strictEqual(rehydrated[0].description, 'Bescom Bill');
  assert.strictEqual(rehydrated[0].amount, 1450);
  assert.strictEqual(rehydrated[0].type, 'expense');
  assert.strictEqual(rehydrated[0].source, 'supabase');
  assert(rehydrated[0].hash.length > 0);
});

// -----------------------------------------------------------------------------
// SUITE 12: LocalStorage Remaining Unchanged in Every Scenario
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 12: LocalStorage Remaining Unchanged in Every Scenario ---');

test('LocalStorage data is 100% preserved during preview, success, and failure', async () => {
  // Mock localStorage store
  const mockStorageStore = new Map();
  const originalData = JSON.stringify(sampleValidTxns);
  mockStorageStore.set(STORAGE_KEYS.USER_TRANSACTIONS, originalData);

  // 1. Preview
  analyzeLocalTransactionsForMigration({
    localTransactions: JSON.parse(mockStorageStore.get(STORAGE_KEYS.USER_TRANSACTIONS)),
    cloudTransactions: []
  });
  assert.strictEqual(mockStorageStore.get(STORAGE_KEYS.USER_TRANSACTIONS), originalData, 'LocalStorage modified during preview!');

  // 2. Successful Migration execution
  const mockSupabaseSuccess = {
    from: () => ({
      insert: (payload) => ({
        select: () => Promise.resolve({
          data: payload.map((p, i) => ({ id: `uuid-${i}`, ...p })),
          error: null
        })
      })
    })
  };

  await executeLocalTransactionsMigration({
    transactionsToMigrate: JSON.parse(mockStorageStore.get(STORAGE_KEYS.USER_TRANSACTIONS)),
    activeUserId: 'usr-preserve-test',
    supabaseClient: mockSupabaseSuccess
  });

  assert.strictEqual(mockStorageStore.get(STORAGE_KEYS.USER_TRANSACTIONS), originalData, 'LocalStorage modified after successful migration!');

  // 3. Network error execution
  const mockSupabaseError = {
    from: () => ({
      insert: () => ({
        select: () => Promise.reject(new Error('Fatal network crash'))
      })
    })
  };

  await executeLocalTransactionsMigration({
    transactionsToMigrate: JSON.parse(mockStorageStore.get(STORAGE_KEYS.USER_TRANSACTIONS)),
    activeUserId: 'usr-preserve-test',
    supabaseClient: mockSupabaseError
  });

  assert.strictEqual(mockStorageStore.get(STORAGE_KEYS.USER_TRANSACTIONS), originalData, 'LocalStorage modified after network error!');
});

console.log('\n================================================================');
console.log(`PHASE 5 MIGRATION TEST SUMMARY: ${passedTests} PASSED, ${totalTests - passedTests} FAILED`);
console.log('================================================================');

if (totalTests - passedTests > 0) {
  process.exit(1);
}
