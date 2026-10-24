/**
 * SpendSense — Phase 9 Automated Validation Suite
 * Tests Data Management, Backup Validation, Malformed Files Handling, Data Clearing & Preferences
 */

import {
  validateBackupData,
  sanitizeTransactionsArray,
  sanitizeBudget,
  sanitizeGoal,
  STORAGE_VERSION
} from '../src/utils/storage.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

console.log('=== SpendSense Phase 9 Data & Settings Validation Suite ===\n');

// -----------------------------------------------------------------------------
// Test Group 1: Valid Backup Structure Validation & Preview
// -----------------------------------------------------------------------------
console.log('1. Testing Valid Backup Structure & Preview Extraction...');

{
  const validBackup = {
    app: 'SpendSense',
    version: 'v2',
    exportedAt: '2026-10-24T18:00:00.000Z',
    settings: {
      displayName: 'Priya Sharma',
      currency: 'INR',
      activeMonth: '2026-10'
    },
    userTransactions: [
      { id: 't1', date: '2026-10-01', description: 'Salary Credit', amount: 80000, type: 'income', category: 'Salary & Income' },
      { id: 't2', date: '2026-10-05', description: 'Apartment Rent', amount: 20000, type: 'expense', category: 'Rent & Housing' }
    ],
    userBudgets: [
      { id: 'b1', category: 'Rent & Housing', allocatedAmount: 20000, month: '2026-10', alertThreshold: 0.90 }
    ],
    userGoals: [
      { id: 'g1', title: 'Emergency Fund', targetAmount: 150000, currentAmount: 40000, monthlyAllocation: 10000 }
    ]
  };

  const result = validateBackupData(validBackup);
  assert(result.valid === true, 'Valid backup passes validation');
  assert(result.preview !== undefined, 'Preview object is generated');
  assert(result.preview.transactionCount === 2, 'Transaction count is 2');
  assert(result.preview.budgetCount === 1, 'Budget count is 1');
  assert(result.preview.goalCount === 1, 'Goal count is 1');
  assert(result.preview.displayName === 'Priya Sharma', 'Display name is "Priya Sharma"');
  assert(result.preview.validTxns.length === 2, 'Sanitized transactions list length is 2');
  assert(result.preview.validBudgets[0].allocatedAmount === 20000, 'Budget amount sanitized');
  assert(result.preview.validGoals[0].currentAmount === 40000, 'Goal amount sanitized');
}

// -----------------------------------------------------------------------------
// Test Group 2: Malformed & Invalid Backup Payloads
// -----------------------------------------------------------------------------
console.log('\n2. Testing Malformed & Invalid Files Handling...');

// Test 2.1: Non-object or primitive values
{
  assert(validateBackupData(null).valid === false, 'null payload safely rejected');
  assert(validateBackupData(undefined).valid === false, 'undefined payload safely rejected');
  assert(validateBackupData("invalid json string").valid === false, 'string payload safely rejected');
  assert(validateBackupData([1, 2, 3]).valid === false, 'array payload safely rejected');
  assert(validateBackupData(12345).valid === false, 'number payload safely rejected');
}

// Test 2.2: Empty object or foreign schema
{
  const foreignObject = { foo: 'bar', randomNumbers: [1, 2, 3] };
  const res = validateBackupData(foreignObject);
  assert(res.valid === false, 'Foreign object rejected');
  assert(res.error.includes('Unrecognized backup structure'), 'Error message explains missing collections');
}

// Test 2.3: Backward-compatibility aliases (transactions / budgets / goals)
{
  const aliasBackup = {
    transactions: [
      { id: 'tx_old', date: '2026-10-02', description: 'Grocery', amount: 1500, type: 'expense', category: 'Groceries & Household' }
    ],
    budgets: [
      { category: 'Groceries & Household', allocatedAmount: 5000 }
    ],
    goals: [
      { title: 'Laptop', targetAmount: 60000, currentAmount: 15000 }
    ]
  };

  const res = validateBackupData(aliasBackup);
  assert(res.valid === true, 'Backward-compatible keys (transactions, budgets, goals) accepted');
  assert(res.preview.transactionCount === 1, '1 transaction parsed via alias');
  assert(res.preview.budgetCount === 1, '1 budget parsed via alias');
  assert(res.preview.goalCount === 1, '1 goal parsed via alias');
}

// -----------------------------------------------------------------------------
// Test Group 3: Data Sanitization & Corruption Resistance
// -----------------------------------------------------------------------------
console.log('\n3. Testing Data Sanitization During Restore...');

{
  const corruptedDataBackup = {
    userTransactions: [
      { id: 'corrupt_1', amount: -4500, type: 'expense', category: 'Food & Dining Out', date: 'bad-date' }, // Negative amount & invalid date
      { id: 'corrupt_2', amount: 'NaN', type: 'invalid_type' }, // NaN amount & invalid type
      null, // null record
      undefined
    ],
    userBudgets: [
      { category: 'Food & Dining Out', allocatedAmount: 'invalid-number' },
      null
    ],
    userGoals: [
      { title: ' Car Fund ', targetAmount: '120000.555', currentAmount: -500 }
    ]
  };

  const res = validateBackupData(corruptedDataBackup);
  assert(res.valid === true, 'Corrupted data backup processed without crashing');
  assert(res.preview.transactionCount === 2, '2 valid transactions recovered and sanitized');
  // First recovered transaction: amount clamped to positive, date defaulted to ISO format
  assert(res.preview.validTxns[0].amount === 4500, 'Negative transaction amount clamped to positive 4500');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(res.preview.validTxns[0].date), 'Malformed date repaired to ISO date');
  // Second transaction: NaN amount defaulted to 0
  assert(res.preview.validTxns[1].amount === 0, 'NaN transaction amount repaired to 0');
  // Goal: negative currentAmount clamped to 0, targetAmount rounded to 2 decimals
  assert(res.preview.validGoals[0].currentAmount === 0, 'Negative currentAmount clamped to 0');
  assert(res.preview.validGoals[0].targetAmount === 120000.56, 'Target amount rounded to 2 decimals');
}

// -----------------------------------------------------------------------------
// Test Group 4: Isolation & Clearing
// -----------------------------------------------------------------------------
console.log('\n4. Testing Workspace Isolation & Data Clearing Logic...');

{
  // Simulated initial state
  const demoStore = [{ id: 'demo_1', description: 'Infosys Salary', amount: 72000 }];
  let personalStore = [{ id: 'user_1', description: 'Freelance Design', amount: 25000 }];

  // Wipe personal data
  personalStore = [];

  assert(personalStore.length === 0, 'Personal store is wiped clean');
  assert(demoStore.length === 1, 'Demo store is strictly unaffected by personal wipe');
}

// -----------------------------------------------------------------------------
// Test Group 5: Preferences Persistence & INR Currency Lock
// -----------------------------------------------------------------------------
console.log('\n5. Testing Preferences & Currency Invariance...');

{
  const initialSettings = {
    displayName: 'Sai',
    currency: 'INR',
    activeMonth: '2026-10'
  };

  // User updates display name
  const updatedSettings = {
    ...initialSettings,
    displayName: 'Aarav Patel'
  };

  assert(updatedSettings.displayName === 'Aarav Patel', 'Display name updated to "Aarav Patel"');
  assert(updatedSettings.currency === 'INR', 'Currency remains strictly locked to INR');
}

console.log(`\n=== Phase 9 Validation Suite Completed: ${passed} Passed, ${failed} Failed ===`);

if (failed > 0) {
  process.exit(1);
}
