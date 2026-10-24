// Phase 6 Validation: Analytics and Transparent Month-End Forecast Engine
import { calculateMonthEndForecast } from '../../../../../OneDrive/Desktop/spendSense/src/utils/forecasting.js';
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetBalance,
  calculateSavingsRate,
  aggregateSpendingByCategory,
  aggregateMonthlyTotals
} from '../../../../../OneDrive/Desktop/spendSense/src/utils/calculations.js';

console.log('--- RUNNING SPENDSENSE PHASE 6 FORECAST & ANALYTICS TESTS ---');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failed++;
  }
}

function assertNoNaN(obj, prefix = '') {
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'number') {
      if (isNaN(val) || !isFinite(val)) {
        console.error(`✗ FAIL: ${prefix}${key} is NaN or non-finite: ${val}`);
        failed++;
        return;
      }
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      assertNoNaN(val, `${prefix}${key}.`);
    }
  }
}

// 1. Empty History Scenario
console.log('\n[Scenario 1: Empty History]');
const emptyForecast = calculateMonthEndForecast({
  transactions: [],
  budgets: [],
  targetMonth: '2026-10',
  asOfDate: '2026-10-24'
});
assertNoNaN(emptyForecast, 'emptyForecast.');
assert(emptyForecast.dataQuality === 'insufficient', 'Empty history flags insufficient data quality');
assert(Boolean(emptyForecast.warningMessage), 'Warning message provided for empty history');
assert(emptyForecast.actualPositionToDate === 0, 'Actual position is 0');
assert(emptyForecast.estimatedMonthEndPosition === 0, 'Estimated position is 0');
assert(emptyForecast.currentVariableBurnRate === 0, 'Burn rate is 0 without dividing by zero');

// 2. One Month of Data Scenario (No Prior History)
console.log('\n[Scenario 2: Single Month Data]');
const oneMonthTxns = [
  { date: '2026-10-01', amount: 60000, type: 'income', category: 'Salary & Income' },
  { date: '2026-10-02', amount: 15000, type: 'expense', category: 'Rent & Housing' },
  { date: '2026-10-05', amount: 3000, type: 'expense', category: 'Groceries & Household' },
  { date: '2026-10-10', amount: 1800, type: 'expense', category: 'Food & Dining Out' },
  { date: '2026-10-15', amount: 1200, type: 'expense', category: 'Transport & Commute' }
];

const oneMonthForecast = calculateMonthEndForecast({
  transactions: oneMonthTxns,
  budgets: [{ category: 'Bills & Utilities', allocatedAmount: 2000 }],
  targetMonth: '2026-10',
  asOfDate: '2026-10-20'
});

assertNoNaN(oneMonthForecast, 'oneMonthForecast.');
assert(oneMonthForecast.actualIncomeToDate === 60000, 'Income to date matches 60,000');
assert(oneMonthForecast.fixedExpensesSpent === 15000, 'Fixed rent of 15,000 isolated correctly');
assert(oneMonthForecast.variableExpensesSpent === 6000, 'Variable expenses sum to 6,000');
assert(oneMonthForecast.daysElapsed === 20, '20 elapsed days calculated');
assert(oneMonthForecast.currentVariableBurnRate === 300, 'Variable burn rate is 6000/20 = 300/day');
assert(oneMonthForecast.daysRemaining === 11, '11 days remaining in October');
assert(oneMonthForecast.projectedVariableRemaining === 3300, 'Projected variable remaining is 300 * 11 = 3,300');
assert(oneMonthForecast.remainingFixedCommitments === 2000, 'Unpaid utility budget of 2,000 reserved');
assert(oneMonthForecast.projectedRemainingExpenses === 5300, 'Total remaining outflows = 3,300 + 2,000 = 5,300');
assert(oneMonthForecast.actualPositionToDate === 39000, 'Current position = 60,000 - 21,000 = 39,000');
assert(oneMonthForecast.estimatedMonthEndPosition === 33700, 'Projected month end = 39,000 - 5,300 = 33,700');
assert(oneMonthForecast.historicalDailySpend === null, 'Historical daily spend is null when no prior months exist');
assert(oneMonthForecast.dataQuality === 'high', '20 elapsed days gives high confidence');

// 3. Multi-Month Data Scenario (Historical Pace Comparison)
console.log('\n[Scenario 3: Multi-Month Data with Historical Benchmark]');
const multiMonthTxns = [
  ...oneMonthTxns,
  // September records (30 days)
  { date: '2026-09-01', amount: 60000, type: 'income', category: 'Salary & Income' },
  { date: '2026-09-02', amount: 15000, type: 'expense', category: 'Rent & Housing' },
  { date: '2026-09-05', amount: 4500, type: 'expense', category: 'Groceries & Household' },
  { date: '2026-09-10', amount: 3000, type: 'expense', category: 'Food & Dining Out' },
  { date: '2026-09-15', amount: 2000, type: 'expense', category: 'Transport & Commute' },
  { date: '2026-09-20', amount: 1500, type: 'expense', category: 'Entertainment & OTT' }
];

const multiMonthForecast = calculateMonthEndForecast({
  transactions: multiMonthTxns,
  budgets: [],
  targetMonth: '2026-10',
  asOfDate: '2026-10-20'
});

assertNoNaN(multiMonthForecast, 'multiMonthForecast.');
assert(multiMonthForecast.historicalDailySpend !== null, 'Historical daily spend calculated from prior month');
assert(Boolean(multiMonthForecast.pacingComparison), 'Pacing comparison object provided');
console.log(`  Current Pace: ₹${multiMonthForecast.currentVariableBurnRate}/d vs Hist: ₹${multiMonthForecast.historicalDailySpend}/d`);

// 4. Zero Income Month Scenario
console.log('\n[Scenario 4: Zero Income Month]');
const zeroIncomeTxns = [
  { date: '2026-10-05', amount: 8000, type: 'expense', category: 'Food & Dining Out' },
  { date: '2026-10-10', amount: 4000, type: 'expense', category: 'Groceries & Household' }
];

const zeroIncomeForecast = calculateMonthEndForecast({
  transactions: zeroIncomeTxns,
  budgets: [],
  targetMonth: '2026-10',
  asOfDate: '2026-10-15'
});

assertNoNaN(zeroIncomeForecast, 'zeroIncomeForecast.');
assert(zeroIncomeForecast.actualIncomeToDate === 0, 'Income to date is 0');
assert(zeroIncomeForecast.estimatedMonthEndPosition < 0, 'Deficit projected in zero-income month');
assert(zeroIncomeForecast.warningMessage?.includes('deficit'), 'Warning message indicates deficit');
const zeroRate = calculateSavingsRate(0, 12000);
assert(zeroRate === 0, 'calculateSavingsRate returns 0% for zero income');

// 5. Unusual Expenses Scenario (Day 2 Rent Spike)
console.log('\n[Scenario 5: Early Month Rent Spike]');
const rentSpikeTxns = [
  { date: '2026-10-01', amount: 50000, type: 'income', category: 'Salary & Income' },
  { date: '2026-10-02', amount: 25000, type: 'expense', category: 'Rent & Housing' },
  { date: '2026-10-02', amount: 300, type: 'expense', category: 'Food & Dining Out' }
];

const earlyForecast = calculateMonthEndForecast({
  transactions: rentSpikeTxns,
  budgets: [],
  targetMonth: '2026-10',
  asOfDate: '2026-10-03'
});

assertNoNaN(earlyForecast, 'earlyForecast.');
assert(earlyForecast.currentVariableBurnRate === 100, 'Variable burn rate is 300 / 3 days = 100/day, NOT 8,433/day');
assert(earlyForecast.dataQuality === 'low', 'Early cycle flagged as low / preliminary estimate');

// 6. Future-Dated Transactions Scenario
console.log('\n[Scenario 6: Future-Dated Transactions]');
const futureTxns = [
  { date: '2026-10-10', amount: 1000, type: 'expense', category: 'Food & Dining Out' },
  { date: '2026-10-28', amount: 5000, type: 'expense', category: 'Food & Dining Out' } // Future dated
];

const futureForecast = calculateMonthEndForecast({
  transactions: futureTxns,
  budgets: [],
  targetMonth: '2026-10',
  asOfDate: '2026-10-20'
});

assertNoNaN(futureForecast, 'futureForecast.');
assert(futureForecast.actualExpensesToDate === 1000, 'Future dated transaction beyond asOfDate excluded from past actuals');

console.log(`\n========================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
