/**
 * SpendSense Phase 6 Test Suite: Analytics and Transparent Month-End Forecasting
 *
 * Scenarios tested:
 * 1. Empty history (0 transactions)
 * 2. One month of data
 * 3. Several months of data (with historical pacing comparison)
 * 4. Zero income (strictly expenses, deficit forecast)
 * 5. Unusual / lump-sum expenses (e.g. rent ₹30,000 on day 1 does NOT inflate daily variable burn)
 * 6. Future-dated transactions (transactions past asOfDate ignored in actuals-to-date)
 * 7. Non-finite safety verification: ensures zero NaN or Infinity across all numeric outputs.
 */

import { calculateMonthEndForecast } from '../src/utils/forecasting.js';
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetBalance,
  calculateSavingsRate,
  aggregateSpendingByCategory,
  aggregateMonthlyTotals
} from '../src/utils/calculations.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertNoNaN(obj, prefix = '') {
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'number') {
      assert(!isNaN(val) && isFinite(val), `${prefix}${key} is finite and not NaN (value: ${val})`);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      assertNoNaN(val, `${prefix}${key}.`);
    }
  }
}

console.log('--- Test Suite 1: Empty History ---');
{
  const result = calculateMonthEndForecast({
    transactions: [],
    budgets: [],
    targetMonth: '2026-10',
    asOfDate: '2026-10-24'
  });

  assert(result.dataQuality === 'insufficient', 'Data quality is insufficient for empty transactions');
  assert(result.actualIncomeToDate === 0, 'Actual income is 0');
  assert(result.actualExpensesToDate === 0, 'Actual expenses is 0');
  assert(result.actualPositionToDate === 0, 'Actual position is 0');
  assert(result.currentVariableBurnRate === 0, 'Variable burn rate is 0');
  assert(result.estimatedMonthEndPosition === 0, 'Projected month end position is 0');
  assert(result.warningMessage !== null, 'Warning message is provided for empty history');
  assertNoNaN(result, 'EmptyHistory.');
}

console.log('\n--- Test Suite 2: Single Month Data ---');
{
  const txns = [
    { id: '1', date: '2026-10-01', amount: 50000, type: 'income', category: 'Salary & Wages' },
    { id: '2', date: '2026-10-02', amount: 15000, type: 'expense', category: 'Rent & Housing' },
    { id: '3', date: '2026-10-05', amount: 2000, type: 'expense', category: 'Groceries' },
    { id: '4', date: '2026-10-10', amount: 1500, type: 'expense', category: 'Dining Out' },
    { id: '5', date: '2026-10-15', amount: 1200, type: 'expense', category: 'Groceries' }
  ];

  const budgets = [
    { category: 'Rent & Housing', allocatedAmount: 15000 },
    { category: 'Groceries', allocatedAmount: 8000 }
  ];

  const result = calculateMonthEndForecast({
    transactions: txns,
    budgets,
    targetMonth: '2026-10',
    asOfDate: '2026-10-20' // 20 days elapsed, 11 remaining
  });

  assert(result.actualIncomeToDate === 50000, 'Actual income to date is ₹50,000');
  assert(result.fixedExpensesSpent === 15000, 'Fixed expenses (Rent) separated cleanly: ₹15,000');
  assert(result.variableExpensesSpent === 4700, 'Variable expenses spent: 2000+1500+1200 = ₹4,700');
  // 4700 / 20 = 235 / day
  assert(result.currentVariableBurnRate === 235, `Variable burn rate is 4700 / 20 = ₹235/day (got ${result.currentVariableBurnRate})`);
  // Remaining days: 31 - 20 = 11 days. Projected variable = 235 * 11 = 2585
  assert(result.projectedVariableRemaining === 2585, `Projected variable remaining is 235 * 11 = ₹2,585 (got ${result.projectedVariableRemaining})`);
  // Month-end estimated position = 50000 - 19700 - 2585 = 27715
  assert(result.estimatedMonthEndPosition === 27715, `Month-end estimated is ₹27,715 (got ${result.estimatedMonthEndPosition})`);
  assert(result.dataQuality === 'high' || result.dataQuality === 'moderate', `Data quality label is valid: ${result.confidenceLabel}`);
  assertNoNaN(result, 'SingleMonth.');
}

console.log('\n--- Test Suite 3: Multi-Month Data & Historical Pacing ---');
{
  const txns = [
    // September prior transactions (variable: 6000 across 30 days)
    { id: 'p1', date: '2026-09-01', amount: 50000, type: 'income', category: 'Salary & Wages' },
    { id: 'p2', date: '2026-09-02', amount: 15000, type: 'expense', category: 'Rent & Housing' },
    { id: 'p3', date: '2026-09-05', amount: 1000, type: 'expense', category: 'Groceries' },
    { id: 'p4', date: '2026-09-10', amount: 1000, type: 'expense', category: 'Dining Out' },
    { id: 'p5', date: '2026-09-15', amount: 1000, type: 'expense', category: 'Transportation' },
    { id: 'p6', date: '2026-09-20', amount: 1000, type: 'expense', category: 'Groceries' },
    { id: 'p7', date: '2026-09-25', amount: 1000, type: 'expense', category: 'Shopping' },
    // October transactions
    { id: 'c1', date: '2026-10-01', amount: 50000, type: 'income', category: 'Salary & Wages' },
    { id: 'c2', date: '2026-10-05', amount: 6000, type: 'expense', category: 'Groceries' }
  ];

  const result = calculateMonthEndForecast({
    transactions: txns,
    targetMonth: '2026-10',
    asOfDate: '2026-10-20'
  });

  assert(result.historicalDailySpend !== null, `Historical variable daily spend computed: ₹${result.historicalDailySpend}/d`);
  assert(result.pacingComparison !== null, 'Pacing comparison object is generated');
  assert(typeof result.pacingComparison.percentDifference === 'number', 'Percent difference is a number');
  assertNoNaN(result, 'MultiMonth.');
}

console.log('\n--- Test Suite 4: Zero Income / Deficit Scenario ---');
{
  const txns = [
    { id: 'z1', date: '2026-10-02', amount: 8000, type: 'expense', category: 'Groceries' },
    { id: 'z2', date: '2026-10-10', amount: 4000, type: 'expense', category: 'Dining Out' }
  ];

  const result = calculateMonthEndForecast({
    transactions: txns,
    targetMonth: '2026-10',
    asOfDate: '2026-10-12'
  });

  assert(result.actualIncomeToDate === 0, 'Income is 0');
  assert(result.actualPositionToDate < 0, `Actual position is negative: ${result.actualPositionToDate}`);
  assert(result.estimatedMonthEndPosition < 0, `Estimated month end is negative: ${result.estimatedMonthEndPosition}`);
  assert(result.warningMessage && result.warningMessage.includes('deficit'), 'Warning message flags deficit');
  assertNoNaN(result, 'ZeroIncome.');
}

console.log('\n--- Test Suite 5: Unusual / Lump-Sum Rent Expense (No 31x Distortion) ---');
{
  const txns = [
    { id: 'r1', date: '2026-10-01', amount: 40000, type: 'income', category: 'Salary & Wages' },
    // Major ₹25,000 rent payment on Day 2
    { id: 'r2', date: '2026-10-02', amount: 25000, type: 'expense', category: 'Rent & Housing' },
    // Only ₹300 spent on variable living expenses
    { id: 'r3', date: '2026-10-03', amount: 300, type: 'expense', category: 'Groceries' }
  ];

  const result = calculateMonthEndForecast({
    transactions: txns,
    targetMonth: '2026-10',
    asOfDate: '2026-10-03' // Only 3 days in
  });

  // If rent was NOT separated, daily burn would be 25300 / 3 = 8433/day -> projected 8433 * 31 = ₹261,433 expense (huge false deficit)!
  // Because fixed is separated: variable burn is 300 / 3 = 100/day.
  assert(result.currentVariableBurnRate === 100, `Variable daily burn correctly isolates rent: ₹${result.currentVariableBurnRate}/d (NOT ₹8433/d)`);
  assert(result.estimatedMonthEndPosition > 0, `User remains solvent at ₹${result.estimatedMonthEndPosition}`);
  assertNoNaN(result, 'LumpSumRent.');
}

console.log('\n--- Test Suite 6: Future-Dated Transactions ---');
{
  const txns = [
    { id: 'f1', date: '2026-10-01', amount: 45000, type: 'income', category: 'Salary & Wages' },
    { id: 'f2', date: '2026-10-10', amount: 5000, type: 'expense', category: 'Groceries' },
    // Future dated transaction after asOfDate
    { id: 'f3', date: '2026-10-28', amount: 12000, type: 'expense', category: 'Shopping' }
  ];

  const result = calculateMonthEndForecast({
    transactions: txns,
    targetMonth: '2026-10',
    asOfDate: '2026-10-15'
  });

  // The 12,000 on Oct 28 should not be included in actual expenses to date as of Oct 15
  assert(result.actualExpensesToDate === 5000, `Future dated Oct 28 txn is excluded from actuals to date (actual: ₹${result.actualExpensesToDate})`);
  assertNoNaN(result, 'FutureDated.');
}

console.log('\n--- Test Suite 7: Calculation Utilities Non-Finite & Zero-Division Safety ---');
{
  // Zero income test
  const rateZeroInc = calculateSavingsRate(0, 5000);
  assert(rateZeroInc === 0, `Savings rate with 0 income is 0% (got ${rateZeroInc}%)`);

  // Zero expenses test
  const rateZeroExp = calculateSavingsRate(50000, 0);
  assert(rateZeroExp === 100, `Savings rate with 0 expenses is 100% (got ${rateZeroExp}%)`);

  // Expenses > Income
  const rateDeficit = calculateSavingsRate(10000, 15000);
  assert(rateDeficit === 0, `Savings rate with deficit is clamped to 0% (got ${rateDeficit}%)`);

  // Category aggregations with empty list
  const catEmpty = aggregateSpendingByCategory([]);
  assert(Array.isArray(catEmpty) && catEmpty.length === 0, 'Empty transactions returns empty category breakdown');

  const monthlyEmpty = aggregateMonthlyTotals([]);
  assert(Array.isArray(monthlyEmpty) && monthlyEmpty.length === 12 && monthlyEmpty[0].income === 0, 'Empty transactions returns 12 months with zero balances');
}

console.log(`\n========================================`);
console.log(`Phase 6 Test Results: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
