import assert from 'assert';
import { MOCK_AA_ACCOUNTS, MOCK_INVALID_TRANSACTION } from '../src/data/mockAAData.js';
import {
  normalizeAATransaction,
  batchNormalizeAATransactions,
  toSupabaseAATransactionRow
} from '../src/utils/aaTransactionAdapter.js';

console.log('--- RUNNING SIMULATED AA DEMO PIPELINE TESTS ---');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

// 1. Mock Data Contract Conformance
runTest('MOCK_AA_ACCOUNTS contains valid mock institutions and accounts', () => {
  assert.ok(Array.isArray(MOCK_AA_ACCOUNTS), 'Must be an array');
  assert.ok(MOCK_AA_ACCOUNTS.length >= 3, 'Must have at least 3 mock accounts');

  const bankIds = MOCK_AA_ACCOUNTS.map((a) => a.bankId);
  assert.ok(bankIds.includes('hdfc'), 'Must include HDFC');
  assert.ok(bankIds.includes('sbi'), 'Must include SBI');
  assert.ok(bankIds.includes('icici'), 'Must include ICICI');

  MOCK_AA_ACCOUNTS.forEach((acc) => {
    assert.ok(acc.accountName, 'Must have accountName');
    assert.ok(acc.accountNumberMasked, 'Must have masked account number');
    assert.ok(acc.balance > 0, 'Must have positive balance');
    assert.ok(Array.isArray(acc.transactions) && acc.transactions.length > 0, 'Must have transactions');
  });
});

// 2. Normalization of HDFC Mock Account Transactions
runTest('Normalizes all HDFC mock statement transactions into SpendSense client model', () => {
  const hdfc = MOCK_AA_ACCOUNTS.find((a) => a.bankId === 'hdfc');
  const result = batchNormalizeAATransactions(hdfc.transactions, []);

  assert.strictEqual(result.total, 6);
  assert.strictEqual(result.validCount, 6);
  assert.strictEqual(result.invalidCount, 0);
  assert.strictEqual(result.duplicateCount, 0);

  // Check source tag and provider reference
  result.validTransactions.forEach((t) => {
    assert.strictEqual(t.source, 'aa', 'Every transaction must have source="aa"');
    assert.ok(t.providerReference.startsWith('AA-HDFC-TXN-'), 'Must preserve provider reference');
    assert.ok(t.hash, 'Must generate hash fingerprint');
  });

  // Verify salary credit
  const salary = result.validTransactions.find((t) => t.providerReference === 'AA-HDFC-TXN-101');
  assert.strictEqual(salary.type, 'income');
  assert.strictEqual(salary.amount, 75000);
  assert.strictEqual(salary.category, 'Salary & Income');

  // Verify Swiggy debit
  const swiggy = result.validTransactions.find((t) => t.providerReference === 'AA-HDFC-TXN-104');
  assert.strictEqual(swiggy.type, 'expense');
  assert.strictEqual(swiggy.amount, 680);
  assert.strictEqual(swiggy.category, 'Food & Dining Out');
});

// 3. Normalization of SBI and ICICI Mock Transactions
runTest('Normalizes SBI and ICICI mock statements cleanly', () => {
  const sbi = MOCK_AA_ACCOUNTS.find((a) => a.bankId === 'sbi');
  const icici = MOCK_AA_ACCOUNTS.find((a) => a.bankId === 'icici');

  const sbiResult = batchNormalizeAATransactions(sbi.transactions, []);
  assert.strictEqual(sbiResult.validCount, sbi.transactions.length);
  assert.strictEqual(sbiResult.invalidCount, 0);

  const iciciResult = batchNormalizeAATransactions(icici.transactions, []);
  assert.strictEqual(iciciResult.validCount, icici.transactions.length);
  assert.strictEqual(iciciResult.invalidCount, 0);
});

// 4. Cross-Batch Deduplication (Re-importing Same Statement)
runTest('Deduplication prevents re-importing identical statement transactions', () => {
  const hdfc = MOCK_AA_ACCOUNTS.find((a) => a.bankId === 'hdfc');

  // Initial import into simulated ledger
  const firstImport = batchNormalizeAATransactions(hdfc.transactions, []);
  assert.strictEqual(firstImport.validCount, 6);
  assert.strictEqual(firstImport.duplicateCount, 0);

  const activeLedger = [...firstImport.validTransactions];

  // Second import attempt of identical statement
  const secondImport = batchNormalizeAATransactions(hdfc.transactions, activeLedger);
  assert.strictEqual(secondImport.total, 6);
  assert.strictEqual(secondImport.validCount, 0, 'All 6 rows should be recognized as duplicates');
  assert.strictEqual(secondImport.duplicateCount, 6, 'All 6 rows should be flagged duplicate');
  assert.strictEqual(secondImport.invalidCount, 0);
});

// 5. Deliberate Malformed Record Handling
runTest('Correctly isolates and reports structured errors for malformed records without failing valid ones', () => {
  const hdfc = MOCK_AA_ACCOUNTS.find((a) => a.bankId === 'hdfc');
  const mixedBatch = [...hdfc.transactions, MOCK_INVALID_TRANSACTION];

  const result = batchNormalizeAATransactions(mixedBatch, []);
  assert.strictEqual(result.total, 7);
  assert.strictEqual(result.validCount, 6, '6 valid records should succeed');
  assert.strictEqual(result.invalidCount, 1, '1 invalid record should be isolated');
  assert.strictEqual(result.duplicateCount, 0);

  const invalidItem = result.invalidTransactions[0];
  assert.strictEqual(invalidItem.batchIndex, 6);
  assert.ok(invalidItem.errors.length >= 2, 'Should have multiple validation errors for malformed row');
});

// 6. Supabase Database Row Parity
runTest('Normalized AA transaction is fully compatible with Supabase database schema via adapter', () => {
  const hdfc = MOCK_AA_ACCOUNTS.find((a) => a.bankId === 'hdfc');
  const norm = normalizeAATransaction(hdfc.transactions[0]);
  assert.ok(norm.success);

  const testUserId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const dbRow = toSupabaseAATransactionRow(norm.transaction, testUserId);

  assert.strictEqual(dbRow.user_id, testUserId);
  assert.strictEqual(dbRow.title, norm.transaction.description);
  assert.strictEqual(dbRow.amount, 75000);
  assert.strictEqual(dbRow.type, 'income');
  assert.strictEqual(dbRow.category, 'Salary & Income');
  assert.ok(dbRow.notes.includes('[src:aa]'), 'Must include [src:aa] tag');
  assert.ok(dbRow.notes.includes('Ref: AA-HDFC-TXN-101'), 'Must include provider reference in notes');
  assert.strictEqual(dbRow.id, undefined, 'Client temporary ID must NOT overwrite database UUID');
});

console.log(`\nTESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
if (failed > 0) process.exit(1);
