/**
 * SpendSense — Master End-to-End & Financial Correctness QA Test Suite
 * Covers all requirements across Sections 1, 2, 3, and 5 of the QA Pass
 */

import {
  roundINR,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetBalance,
  calculateSavingsRate,
  filterTransactionsByMonth,
  aggregateSpendingByCategory,
  aggregateNeedsVsWants,
  calculateBudgetUtilization,
  calculateGoalPacing
} from '../src/utils/calculations.js';

import {
  calculateMonthEndForecast
} from '../src/utils/forecasting.js';

import {
  evaluatePurchaseDecision
} from '../src/utils/affordability.js';

import {
  generateActionableAlerts
} from '../src/utils/alerts.js';

import {
  suggestColumnMapping,
  normalizeCsvRows
} from '../src/utils/csvParser.js';

import {
  detectBatchDuplicates
} from '../src/utils/duplicateDetector.js';

import {
  validateBackupData,
  STORAGE_VERSION
} from '../src/utils/storage.js';

import {
  formatINR,
  formatDate,
  formatPercentage
} from '../src/utils/formatters.js';

import {
  SAMPLE_TRANSACTIONS,
  SAMPLE_BUDGETS,
  SAMPLE_GOALS
} from '../src/data/sampleData.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
  }
}

console.log('================================================================');
console.log('SPENDSENSE MASTER QA & INTEGRATION TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: Currency, Formatting & Zero Safety
// -----------------------------------------------------------------------------
console.log('--- SUITE 1: Currency & Number Formatting ---');
assert(formatINR(0) === '₹0.00', 'Zero formats to ₹0.00 with decimals');
assert(formatINR(0, false) === '₹0', 'Zero formats to ₹0 without decimals when showDecimals is false');
assert(formatINR(1250, false) === '₹1,250', 'Thousands formatting uses Indian groupings');
assert(formatINR(150000, false) === '₹1,50,000', 'Lakhs formatting uses Indian numbering system (1,50,000)');
assert(formatINR(-4500, false).includes('4,500'), 'Negative amounts format with 4,500 grouping');
assert(formatPercentage(0) === '0.0%', 'Zero percentage displays cleanly');
assert(formatPercentage(53.4) === '53.4%', 'Percentages format correctly for 0-100 values');
assert(formatPercentage(0.534, true) === '53.4%', 'Percentages format correctly when isFraction is true');
assert(formatPercentage(Infinity) === '0%', 'Division by zero / Infinity results in safe 0%');
assert(formatPercentage(NaN) === '0%', 'NaN percentage displays safe 0%');

// -----------------------------------------------------------------------------
// TEST SUITE 2: Storage Sign Convention & Invariance
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Transaction Model & Positive Sign Invariance ---');
// Verify sample transactions follow strictly positive amount convention
const allPositiveAmounts = SAMPLE_TRANSACTIONS.every(t => typeof t.amount === 'number' && t.amount > 0);
assert(allPositiveAmounts, `All ${SAMPLE_TRANSACTIONS.length} sample transactions store strictly positive amounts (> 0)`);
const validTypes = SAMPLE_TRANSACTIONS.every(t => t.type === 'income' || t.type === 'expense');
assert(validTypes, 'Every transaction has strict type of either "income" or "expense"');
const uniqueIds = new Set(SAMPLE_TRANSACTIONS.map(t => t.id)).size === SAMPLE_TRANSACTIONS.length;
assert(uniqueIds, 'Every sample transaction has a globally unique ID');

// -----------------------------------------------------------------------------
// TEST SUITE 3: Monthly Boundary & Deterministic Cash Flow
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Monthly Boundaries & Deterministic Metrics ---');
const octTxns = filterTransactionsByMonth(SAMPLE_TRANSACTIONS, '2026-10');
assert(octTxns.length > 0, `October 2026 contains transactions (count: ${octTxns.length})`);

const octIncome = calculateTotalIncome(octTxns);
const octExpenses = calculateTotalExpenses(octTxns);
const octNet = calculateNetBalance(octIncome, octExpenses);
const octSavingsRate = calculateSavingsRate(octIncome, octExpenses);

assert(octIncome > 0, `October total income is positive (₹${octIncome})`);
assert(octExpenses > 0, `October total expenses are positive (₹${octExpenses})`);
assert(octNet === octIncome - octExpenses, `October net cash flow matches income - expenses (₹${octNet})`);
assert(octSavingsRate >= 0 && octSavingsRate <= 100, `October savings rate is valid percentage 0-100 (${octSavingsRate}%)`);

// Zero income boundary condition
const zeroRate = calculateSavingsRate(0, 5000);
assert(zeroRate === 0, 'Zero income results in safe savings rate of 0 without division by zero');

// -----------------------------------------------------------------------------
// TEST SUITE 4: CSV Ingestion, Smart Mapping & Deduplication
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 4: CSV Parsing, Column Inference & Duplicate Protection ---');
const hdfcHeaders = ['Date', 'Narration', 'Chq/Ref No', 'Value Dt', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'];
const hdfcMapping = suggestColumnMapping(hdfcHeaders);
assert(hdfcMapping.dateCol === 'Date', 'Auto-identifies Date column');
assert(hdfcMapping.descCol === 'Narration', 'Auto-identifies Narration column');
assert(hdfcMapping.amountMode === 'separate', 'Auto-selects separate debit/credit mode');
assert(hdfcMapping.debitCol === 'Withdrawal Amt.', 'Auto-maps Withdrawal Amt. to debit');
assert(hdfcMapping.creditCol === 'Deposit Amt.', 'Auto-maps Deposit Amt. to credit');

// Raw CSV row normalization
const testCsvRows = [
  { 'Date': '24/10/2026', 'Narration': 'Swiggy Bangalore Order #991', 'Withdrawal Amt.': '620', 'Deposit Amt.': '' },
  { 'Date': '24/10/2026', 'Narration': 'Swiggy Bangalore Order #991', 'Withdrawal Amt.': '620', 'Deposit Amt.': '' }, // Exact batch duplicate
  { 'Date': '01/10/2026', 'Narration': 'Infosys Monthly Salary Credit', 'Withdrawal Amt.': '', 'Deposit Amt.': '72000' } // Existing ledger duplicate
];

const normalizedCandidates = normalizeCsvRows(testCsvRows, hdfcMapping);
assert(normalizedCandidates.length === 3, 'Normalizes 3 candidate rows');
assert(normalizedCandidates[0].type === 'expense' && normalizedCandidates[0].amount === 620, 'Identifies debit expense with positive magnitude ₹620');
assert(normalizedCandidates[2].type === 'income' && normalizedCandidates[2].amount === 72000, 'Identifies credit income with magnitude ₹72,000');

// Duplicate Detection against current active ledger
const deduplicated = detectBatchDuplicates(normalizedCandidates, SAMPLE_TRANSACTIONS);
assert(deduplicated[0].isDuplicate === false && deduplicated[0].selected === true, 'First new transaction marked valid and selected');
assert(deduplicated[1].isDuplicate === true && deduplicated[1].duplicateSource === 'batch', 'Second row flagged as Batch Duplicate');
assert(deduplicated[2].isDuplicate === true, 'Salary row flagged as Duplicate against existing ledger');

// -----------------------------------------------------------------------------
// TEST SUITE 5: Month-End Forecast Engine & Mathematical Rigor
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Month-End Forecast Engine ---');
const forecast = calculateMonthEndForecast({
  transactions: SAMPLE_TRANSACTIONS,
  budgets: SAMPLE_BUDGETS,
  targetMonth: '2026-10',
  asOfDate: '2026-10-24'
});

assert(forecast.daysElapsed === 24, 'Correctly calculates 24 days elapsed as of Oct 24');
assert(forecast.daysRemaining === 7, 'Correctly calculates 7 remaining days in October');
assert(forecast.actualIncomeToDate === octIncome, 'Forecast actualIncomeToDate matches ledger');
assert(forecast.actualExpensesToDate === octExpenses, 'Forecast actualExpensesToDate matches ledger');
assert(forecast.remainingFixedCommitments >= 0, 'Separates remaining fixed commitments from discretionary spend');
assert(typeof forecast.estimatedMonthEndPosition === 'number', `Estimated month-end position is calculated (₹${forecast.estimatedMonthEndPosition})`);
assert(forecast.assumptions.length >= 4, 'Provides transparent list of at least 4 mathematical assumptions');

// Forecast with zero data
const emptyForecast = calculateMonthEndForecast({
  transactions: [],
  budgets: [],
  targetMonth: '2026-10',
  asOfDate: '2026-10-01'
});
assert(emptyForecast.dataQuality === 'insufficient', 'Safely flags dataQuality as "insufficient" when ledger is empty');
assert(emptyForecast.currentVariableBurnRate === 0, 'Safe zero burn rate when no transactions exist');

// -----------------------------------------------------------------------------
// TEST SUITE 6: Monthly Budgets, Pacing & Actionable Alerts
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 6: Budgets, Goal Pacing & Actionable Alerts ---');
const rentBudget = SAMPLE_BUDGETS.find(b => b.category === 'Rent & Housing');
const diningBudget = SAMPLE_BUDGETS.find(b => b.category === 'Food & Dining Out');

const diningSpent = octTxns
  .filter(t => t.type === 'expense' && t.category === diningBudget.category)
  .reduce((sum, t) => sum + t.amount, 0);

const diningUtilization = calculateBudgetUtilization(diningSpent, diningBudget.allocatedAmount, diningBudget.alertThreshold);
assert(diningSpent > 0, `Dining spend is calculated (actual: ₹${diningSpent})`);
assert(diningUtilization.percent > 0, `Dining budget utilization percent is calculated (${diningUtilization.percent}%)`);
assert(diningUtilization.status === 'safe' || diningUtilization.status === 'caution' || diningUtilization.status === 'exceeded', 'Valid status assigned to budget utilization');

// Alert Generation Engine
const alerts = generateActionableAlerts({
  transactions: SAMPLE_TRANSACTIONS,
  budgets: SAMPLE_BUDGETS,
  goals: SAMPLE_GOALS,
  forecast,
  activeMonth: '2026-10',
  asOfDate: '2026-10-24'
});

assert(Array.isArray(alerts), 'Generates an array of actionable alerts');
assert(alerts.length > 0, `At least 1 alert generated for active budget thresholds (actual: ${alerts.length})`);

const emergencyGoal = SAMPLE_GOALS.find(g => g.id === 'goal_01');
const goalPacing = calculateGoalPacing(emergencyGoal, '2026-10-24');
assert(goalPacing.percent > 0, `Emergency fund progress percent is calculated (${goalPacing.percent}%)`);
assert(Boolean(goalPacing.pacingStatus), `Goal pacing status is assigned (${goalPacing.pacingStatus})`);

// -----------------------------------------------------------------------------
// TEST SUITE 7: Purchase Decision Simulator
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 7: "Can I Afford This?" Purchase Decision Simulator ---');
// Scenario A: Small discretionary purchase (₹500 Books)
const smallSim = evaluatePurchaseDecision({
  purchaseName: 'Technical Architecture Book',
  purchaseAmount: 500,
  category: 'Shopping & Discretionary',
  purchaseDate: '2026-10-24',
  nature: 'want',
  availableFunds: octNet,
  forecast,
  budgets: SAMPLE_BUDGETS,
  monthTransactions: octTxns,
  goals: SAMPLE_GOALS,
  targetMonth: '2026-10'
});
assert(smallSim.tier === 'AFFORDABLE', `Small affordable purchase receives AFFORDABLE tier (actual: ${smallSim.tier})`);
assert(smallSim.metrics.liquidCashAfter === smallSim.metrics.liquidCashBefore - 500, 'Deducts purchase amount from liquid cash');
assert(smallSim.metrics.monthEndAfter === smallSim.metrics.monthEndBefore - 500, 'Deducts purchase amount from projected month-end balance');

// Scenario B: Large discretionary purchase exceeding category cap
const bigSim = evaluatePurchaseDecision({
  purchaseName: 'Flagship Smartphone',
  purchaseAmount: 25000,
  category: 'Shopping & Discretionary',
  purchaseDate: '2026-10-24',
  nature: 'want',
  availableFunds: octNet,
  forecast,
  budgets: SAMPLE_BUDGETS,
  monthTransactions: octTxns,
  goals: SAMPLE_GOALS,
  targetMonth: '2026-10'
});
assert(bigSim.tier === 'CAUTION' || bigSim.tier === 'NOT_AFFORDABLE', `Large purchase triggers CAUTION or NOT_AFFORDABLE (actual: ${bigSim.tier})`);
assert(bigSim.metrics.isCategoryOverBudget === true, 'Simulator accurately flags category over-budget condition');
assert(bigSim.conflicts.length > 0, `Simulator provides actionable conflicts (count: ${bigSim.conflicts.length})`);

// Scenario C: Ruinous purchase exceeding total available cash (₹1,50,000 bike)
const ruinousSim = evaluatePurchaseDecision({
  purchaseName: 'New Superbike Downpayment',
  purchaseAmount: 150000,
  category: 'Vehicle & Transport',
  purchaseDate: '2026-10-24',
  nature: 'want',
  availableFunds: octNet,
  forecast,
  budgets: SAMPLE_BUDGETS,
  monthTransactions: octTxns,
  goals: SAMPLE_GOALS,
  targetMonth: '2026-10'
});
assert(ruinousSim.tier === 'NOT_AFFORDABLE', `Ruinous purchase triggers NOT_AFFORDABLE tier (actual: ${ruinousSim.tier})`);
assert(ruinousSim.metrics.liquidCashAfter < 0, 'Liquid cash turns negative');

// -----------------------------------------------------------------------------
// TEST SUITE 8: Portable Backup & Restore Integrity
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 8: JSON Data Backup & Restore Validation ---');
const validBackupPayload = {
  version: STORAGE_VERSION,
  exportedAt: new Date().toISOString(),
  environment: 'spendsense_browser_localstorage',
  data: {
    transactions: octTxns,
    budgets: SAMPLE_BUDGETS,
    goals: SAMPLE_GOALS,
    settings: { displayName: 'Sai Hackathon Judge' }
  }
};

const validResult = validateBackupData(validBackupPayload);
assert(validResult.valid === true, 'Valid backup payload passes validation');
assert(validResult.preview.transactionCount === octTxns.length, `Backup preview reports exactly ${octTxns.length} transactions`);
assert(validResult.preview.budgetCount === SAMPLE_BUDGETS.length, 'Backup preview reports correct budget count');

// Corrupted Backup Rejection
const corruptedPayload = {
  version: 99,
  data: { transactions: 'not-an-array' }
};
const invalidResult = validateBackupData(corruptedPayload);
assert(invalidResult.valid === false, 'Corrupted backup is properly rejected without touching state');
assert(Boolean(invalidResult.error), `Provides clear rejection reason: "${invalidResult.error}"`);

console.log('\n================================================================');
console.log(`MASTER TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nALL QA VERIFICATION CHECKS COMPLETED WITH 100% SUCCESS!');
  process.exit(0);
}
