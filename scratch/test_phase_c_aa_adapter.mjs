/**
 * SpendSense — Phase C Test Suite
 * Account Aggregator (AA) Transaction Normalization Adapter
 *
 * Verifies:
 * 1. Valid AA income and expense records with explicit DEBIT/CREDIT direction.
 * 2. Invalid dates, non-positive amounts, and missing descriptions.
 * 3. Direction mapping invariance: never infer from signed negative amounts.
 * 4. Provider transaction reference preservation without UUID confusion.
 * 5. Source marking strictly as 'aa'.
 * 6. Structured error reporting for invalid records.
 * 7. Batch normalization and deduplication.
 * 8. Supabase row conversion parity via toSupabaseAATransactionRow.
 */

import assert from 'assert';
import {
  normalizeAATransaction,
  batchNormalizeAATransactions,
  toSupabaseAATransactionRow
} from '../src/utils/aaTransactionAdapter.js';

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
console.log('SPENDSENSE — PHASE C AA TRANSACTION ADAPTER TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SUITE 1: Valid Income and Expense Records
// -----------------------------------------------------------------------------
console.log('--- SUITE 1: Valid Income and Expense Records ---');

test('Normalizes valid DEBIT record into expense with positive amount', () => {
  const input = {
    date: '2026-10-14',
    narration: 'Swiggy Bangalore',
    amount: 540.50,
    direction: 'DEBIT',
    providerTransactionId: 'TXN_AA_98124',
    bankName: 'HDFC Bank',
    balance: 45210.25
  };

  const res = normalizeAATransaction(input);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.error, null);
  assert.strictEqual(res.errors.length, 0);

  const txn = res.transaction;
  assert.strictEqual(txn.date, '2026-10-14');
  assert.strictEqual(txn.description, 'Swiggy Bangalore');
  assert.strictEqual(txn.amount, 540.50);
  assert.strictEqual(txn.type, 'expense');
  assert.strictEqual(txn.source, 'aa');
  assert.strictEqual(txn.category, 'Food & Dining Out');
  assert.strictEqual(txn.nature, 'want');
  assert.strictEqual(txn.providerReference, 'TXN_AA_98124');
  assert(txn.notes.includes('Ref: TXN_AA_98124'));
  assert(txn.notes.includes('Bank: HDFC Bank'));
  assert(txn.notes.includes('Bal: ₹45210.25'));
  assert(typeof txn.hash === 'string' && txn.hash.length > 0);
});

test('Normalizes valid CREDIT record into income with positive amount', () => {
  const input = {
    date: '2026-10-01T09:30:00+05:30',
    narration: 'Infosys Monthly Salary Credit',
    amount: '85000.00',
    direction: 'CREDIT',
    providerTransactionId: 'SAL_20261001_891',
    paymentMode: 'NEFT'
  };

  const res = normalizeAATransaction(input);
  assert.strictEqual(res.success, true);

  const txn = res.transaction;
  assert.strictEqual(txn.date, '2026-10-01');
  assert.strictEqual(txn.description, 'Infosys Monthly Salary Credit');
  assert.strictEqual(txn.amount, 85000);
  assert.strictEqual(txn.type, 'income');
  assert.strictEqual(txn.source, 'aa');
  assert.strictEqual(txn.category, 'Salary & Income');
  assert.strictEqual(txn.nature, 'income');
  assert.strictEqual(txn.paymentMethod, 'Net Banking');
  assert.strictEqual(txn.providerReference, 'SAL_20261001_891');
});

// -----------------------------------------------------------------------------
// SUITE 2: Invalid Dates, Amounts, and Descriptions
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Invalid Dates, Amounts, and Descriptions ---');

test('Rejects missing or empty narration with structured error', () => {
  const input = {
    date: '2026-10-15',
    narration: '   ',
    amount: 500,
    direction: 'DEBIT'
  };

  const res = normalizeAATransaction(input);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.transaction, null);
  assert(res.errors.some((e) => e.includes('Missing required transaction description')));
});

test('Rejects invalid date format and unparseable dates', () => {
  const input1 = {
    date: '15-10-2026', // wrong format, expected YYYY-MM-DD
    narration: 'Coffee',
    amount: 150,
    direction: 'DEBIT'
  };
  const res1 = normalizeAATransaction(input1);
  assert.strictEqual(res1.success, false);
  assert(res1.errors.some((e) => e.includes('Invalid date format')));

  const input2 = {
    date: '',
    narration: 'Coffee',
    amount: 150,
    direction: 'DEBIT'
  };
  const res2 = normalizeAATransaction(input2);
  assert.strictEqual(res2.success, false);
  assert(res2.errors.some((e) => e.includes('Missing required transaction date')));
});

test('Rejects non-positive, zero, negative, and NaN amounts', () => {
  const zeroAmt = { date: '2026-10-15', narration: 'Zero Item', amount: 0, direction: 'DEBIT' };
  assert.strictEqual(normalizeAATransaction(zeroAmt).success, false);

  const negAmt = { date: '2026-10-15', narration: 'Neg Item', amount: -450, direction: 'DEBIT' };
  assert.strictEqual(normalizeAATransaction(negAmt).success, false);

  const nanAmt = { date: '2026-10-15', narration: 'NaN Item', amount: 'abc', direction: 'DEBIT' };
  assert.strictEqual(normalizeAATransaction(nanAmt).success, false);
});

// -----------------------------------------------------------------------------
// SUITE 3: Explicit Direction & Never Inferring from Sign
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Direction Handling & Sign Invariance ---');

test('Rejects missing direction even if amount is negative (no silent inference)', () => {
  const inputWithoutDirection = {
    date: '2026-10-15',
    narration: 'Unsigned Debit',
    amount: -500 // Signed negative amount without explicit direction
  };

  const res = normalizeAATransaction(inputWithoutDirection);
  assert.strictEqual(res.success, false);
  // Both direction and amount should be flagged
  assert(res.errors.some((e) => e.includes('Direction must explicitly be')));
});

test('Rejects unsupported direction strings', () => {
  const badDir = {
    date: '2026-10-15',
    narration: 'Item',
    amount: 500,
    direction: 'HOLD'
  };
  const res = normalizeAATransaction(badDir);
  assert.strictEqual(res.success, false);
  assert(res.errors.some((e) => e.includes('Direction must explicitly be "DEBIT" or "CREDIT"')));
});

test('Accepts standard shorthand DR and CR directions', () => {
  const dr = normalizeAATransaction({ date: '2026-10-10', narration: 'Uber', amount: 250, direction: 'DR' });
  assert.strictEqual(dr.success, true);
  assert.strictEqual(dr.transaction.type, 'expense');

  const cr = normalizeAATransaction({ date: '2026-10-10', narration: 'Dividend', amount: 1200, direction: 'CR' });
  assert.strictEqual(cr.success, true);
  assert.strictEqual(cr.transaction.type, 'income');
});

// -----------------------------------------------------------------------------
// SUITE 4: Provider Reference Preservation Without UUID Confusion
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Provider Reference Preservation Without UUID Confusion ---');

test('Preserves provider reference in providerReference property and does NOT use it as ID', () => {
  const input = {
    date: '2026-10-20',
    narration: 'Bescom Bill',
    amount: 1450,
    direction: 'DEBIT',
    providerTransactionId: 'FIP_REF_99812489'
  };

  const res = normalizeAATransaction(input);
  assert.strictEqual(res.success, true);

  const txn = res.transaction;
  // Verify client ID is a SpendSense-generated identifier, NOT the external provider ref
  assert.notStrictEqual(txn.id, 'FIP_REF_99812489');
  assert(txn.id.startsWith('aa_txn_'));
  assert.strictEqual(txn.providerReference, 'FIP_REF_99812489');
});

// -----------------------------------------------------------------------------
// SUITE 5: Source Tagging Invariance
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Source Tagging Invariance ---');

test('Guarantees transaction source is marked strictly as "aa"', () => {
  const input = {
    date: '2026-10-21',
    narration: 'Zepto Groceries',
    amount: 320,
    direction: 'DEBIT',
    source: 'some_other_source' // Should be overridden to 'aa'
  };

  const res = normalizeAATransaction(input);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.transaction.source, 'aa');
});

// -----------------------------------------------------------------------------
// SUITE 6: Batch Normalization and Deduplication
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 6: Batch Normalization and Deduplication ---');

test('Batch processes transactions, separates invalid rows, and flags duplicates', () => {
  const batch = [
    { date: '2026-10-14', narration: 'Swiggy', amount: 500, direction: 'DEBIT' }, // Valid
    { date: '2026-10-14', narration: 'Swiggy', amount: 500, direction: 'DEBIT' }, // Duplicate in batch
    { date: '', narration: 'Bad Date', amount: 100, direction: 'DEBIT' },          // Invalid
    { date: '2026-10-15', narration: 'Infosys Salary', amount: 80000, direction: 'CREDIT' } // Valid
  ];

  const existingCloud = [
    { date: '2026-10-15', description: 'Infosys Salary', amount: 80000, type: 'income' } // Matches 4th item
  ];

  const res = batchNormalizeAATransactions(batch, existingCloud);

  assert.strictEqual(res.total, 4);
  assert.strictEqual(res.invalidCount, 1);
  assert.strictEqual(res.invalidTransactions[0].input.narration, 'Bad Date');

  assert.strictEqual(res.duplicateCount, 2); // 1 batch duplicate (2nd Swiggy) + 1 existing duplicate (Salary)
  assert.strictEqual(res.validCount, 1);     // Only 1st Swiggy is unique & valid
  assert.strictEqual(res.validTransactions[0].description, 'Swiggy');
});

// -----------------------------------------------------------------------------
// SUITE 7: Supabase Row Conversion Parity
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 7: Supabase Row Conversion Parity ---');

test('Converts normalized AA transaction to Supabase public.transactions payload', () => {
  const normalized = normalizeAATransaction({
    date: '2026-10-18',
    narration: 'Bescom Power Bill',
    amount: 1850.50,
    direction: 'DEBIT',
    providerTransactionId: 'UTR98124819'
  }).transaction;

  const dbRow = toSupabaseAATransactionRow(normalized, 'user-uuid-12345');

  assert.strictEqual(dbRow.user_id, 'user-uuid-12345');
  assert.strictEqual(dbRow.title, 'Bescom Power Bill');
  assert.strictEqual(dbRow.transaction_date, '2026-10-18');
  assert.strictEqual(dbRow.amount, 1850.50);
  assert.strictEqual(dbRow.type, 'expense');
  assert.strictEqual(dbRow.category, 'Bills & Utilities');
  assert(dbRow.notes.includes('Ref: UTR98124819'));
  assert.strictEqual(dbRow.id, undefined); // Supabase native UUID assigned on insert
});

console.log('\n================================================================');
console.log(`PHASE C AA ADAPTER TEST SUMMARY: ${passedTests} PASSED, ${totalTests - passedTests} FAILED`);
console.log('================================================================');

if (totalTests - passedTests > 0) {
  process.exit(1);
}
