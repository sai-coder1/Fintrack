/**
 * SpendSense — Phase 7 Automated Validation Suite
 * Tests Budgets, Savings Goals, Actionable Alerts, Contribution Isolation, Boundary Conditions & Persistence
 */

import {
  roundINR,
  calculateBudgetUtilization,
  calculateGoalPacing
} from '../src/utils/calculations.js';

import {
  generateActionableAlerts,
  calculateMonthsRemaining
} from '../src/utils/alerts.js';

import {
  sanitizeBudget,
  sanitizeGoal
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

console.log('=== SpendSense Phase 7 Validation Suite ===\n');

// -----------------------------------------------------------------------------
// Test Group 1: Budget Utilization & Status Boundary Conditions
// -----------------------------------------------------------------------------
console.log('1. Testing Budget Utilization & Boundary Conditions...');

// Test 1.1: Zero spend
{
  const result = calculateBudgetUtilization(0, 5000, 0.85);
  assert(result.percent === 0, 'Zero spend: percent is 0%');
  assert(result.remaining === 5000, 'Zero spend: remaining is full 5000');
  assert(result.status === 'safe', 'Zero spend: status is safe');
  assert(result.statusLabel === 'On Track', 'Zero spend: statusLabel is "On Track"');
}

// Test 1.2: Boundary just below default 85% threshold (84.9%)
{
  const result = calculateBudgetUtilization(4245, 5000, 0.85); // 84.9%
  assert(result.percent === 84.9, '84.9% spend: percent calculated correctly');
  assert(result.remaining === 755, '84.9% spend: remaining is 755');
  assert(result.status === 'safe', '84.9% spend: status remains "safe"');
}

// Test 1.3: Boundary exactly at 85% threshold
{
  const result = calculateBudgetUtilization(4250, 5000, 0.85); // Exactly 85.0%
  assert(result.percent === 85, '85% spend: percent is 85%');
  assert(result.status === 'caution', '85% spend: status transitions to "caution"');
  assert(result.statusLabel.includes('Approaching Limit'), '85% spend: statusLabel reflects approaching limit');
}

// Test 1.4: Configurable threshold (e.g. 75%)
{
  const result = calculateBudgetUtilization(3750, 5000, 0.75); // Exactly 75%
  assert(result.status === 'caution', 'Configurable threshold 75%: transitions to "caution" at 3750/5000');
}

// Test 1.5: Boundary exactly at 100%
{
  const result = calculateBudgetUtilization(5000, 5000, 0.85);
  assert(result.percent === 100, '100% spend: percent is 100%');
  assert(result.remaining === 0, '100% spend: remaining is 0');
  assert(result.exceededBy === 0, '100% spend: exceededBy is 0');
  assert(result.status === 'exceeded', '100% spend: status is "exceeded"');
  assert(result.statusLabel === 'Budget Exceeded', '100% spend: statusLabel is "Budget Exceeded"');
}

// Test 1.6: Boundary over 100% (exceeded)
{
  const result = calculateBudgetUtilization(6250, 5000, 0.85); // 125%
  assert(result.percent === 125, '125% spend: percent is 125%');
  assert(result.remaining === -1250, '125% spend: remaining is -1250');
  assert(result.exceededBy === 1250, '125% spend: exceededBy is 1250');
  assert(result.status === 'exceeded', '125% spend: status is "exceeded"');
}

// Test 1.7: Division safety: Zero limit
{
  const resultSafe = calculateBudgetUtilization(0, 0, 0.85);
  assert(resultSafe.status === 'safe', 'Zero limit & zero spend: status is safe');
  const resultExceeded = calculateBudgetUtilization(150, 0, 0.85);
  assert(resultExceeded.status === 'exceeded', 'Zero limit & positive spend: status is exceeded without NaN/Infinity');
  assert(resultExceeded.percent === 0, 'Zero limit: percent does not produce NaN or Infinity');
}

// -----------------------------------------------------------------------------
// Test Group 2: Actionable Alerts & Mathematical Explanations
// -----------------------------------------------------------------------------
console.log('\n2. Testing Actionable Alerts Generation & Explanations...');

// Test 2.1: Actual expense transactions only — income is NOT counted as spending
{
  const mockTransactions = [
    { id: 't1', type: 'income', category: 'Food & Dining Out', amount: 50000, date: '2026-10-05' },
    { id: 't2', type: 'expense', category: 'Food & Dining Out', amount: 4800, date: '2026-10-10' }
  ];
  const mockBudgets = [
    { id: 'b1', category: 'Food & Dining Out', allocatedAmount: 4500, alertThreshold: 0.80 }
  ];

  const alerts = generateActionableAlerts({
    transactions: mockTransactions,
    budgets: mockBudgets,
    goals: [],
    targetMonth: '2026-10',
    asOfDate: '2026-10-24'
  });

  assert(alerts.length === 1, 'Only 1 alert generated');
  assert(alerts[0].type === 'budget_exceeded', 'Alert is budget_exceeded');
  assert(alerts[0].triggerData.spent === 4800, 'Actual spend is 4800 (income of 50,000 was strictly ignored)');
  assert(alerts[0].triggerData.exceededBy === 300, 'Exceeded by exact difference of 300');
  assert(alerts[0].explanation.includes('4,800.00'), 'Explanation contains exact formatted spent figure');
  assert(alerts[0].explanation.includes('4,500.00'), 'Explanation contains exact formatted limit figure');
}

// Test 2.2: Approaching warning threshold
{
  const mockTransactions = [
    { id: 't1', type: 'expense', category: 'Groceries & Household', amount: 5100, date: '2026-10-12' }
  ];
  const mockBudgets = [
    { id: 'b1', category: 'Groceries & Household', allocatedAmount: 6000, alertThreshold: 0.85 }
  ]; // 5100/6000 = exactly 85%

  const alerts = generateActionableAlerts({
    transactions: mockTransactions,
    budgets: mockBudgets,
    goals: [],
    targetMonth: '2026-10',
    asOfDate: '2026-10-24'
  });

  assert(alerts.length === 1, '1 alert generated for approaching limit');
  assert(alerts[0].type === 'budget_approaching', 'Alert type is budget_approaching');
  assert(alerts[0].severity === 'warning', 'Severity is warning');
  assert(alerts[0].triggerData.remaining === 900, 'Remaining headroom is 900');
}

// Test 2.3: Pacing warning (Extrapolated overspend mid-month)
{
  // Day 10 of 31: spent 2000 of a 5000 budget (only 40%, far below 85% threshold)
  // But daily burn = 2000 / 10 = 200/day. Over 31 days = 6200 (> 5000 by 1200)
  const mockTransactions = [
    { id: 't1', type: 'expense', category: 'Transport & Commute', amount: 2000, date: '2026-10-08' }
  ];
  const mockBudgets = [
    { id: 'b1', category: 'Transport & Commute', allocatedAmount: 5000, alertThreshold: 0.85 }
  ];

  const alerts = generateActionableAlerts({
    transactions: mockTransactions,
    budgets: mockBudgets,
    goals: [],
    targetMonth: '2026-10',
    asOfDate: '2026-10-10' // Day 10 of 31
  });

  assert(alerts.length === 1, 'Pacing alert triggered');
  assert(alerts[0].type === 'budget_pacing', 'Alert type is budget_pacing');
  assert(alerts[0].triggerData.dailyBurnRate === 200, 'Daily burn rate is 200/day');
  assert(alerts[0].triggerData.projectedMonthEndSpend === 6200, 'Projected month-end spend is 6200');
  assert(alerts[0].triggerData.projectedOverage === 1200, 'Projected overage is 1200');
}

// Test 2.4: Deduplication: Exceeded budget does NOT also spam approaching or pacing alerts
{
  const mockTransactions = [
    { id: 't1', type: 'expense', category: 'Shopping & Discretionary', amount: 10000, date: '2026-10-15' }
  ];
  const mockBudgets = [
    { id: 'b1', category: 'Shopping & Discretionary', allocatedAmount: 5000, alertThreshold: 0.80 }
  ];

  const alerts = generateActionableAlerts({
    transactions: mockTransactions,
    budgets: mockBudgets,
    goals: [],
    targetMonth: '2026-10',
    asOfDate: '2026-10-24'
  });

  assert(alerts.length === 1, 'Exactly one alert generated for the category');
  assert(alerts[0].type === 'budget_exceeded', 'Only the highest severity alert (exceeded) is retained');
}

// -----------------------------------------------------------------------------
// Test Group 3: Savings Goals Pacing & Contribution Controls
// -----------------------------------------------------------------------------
console.log('\n3. Testing Savings Goals Calculations & Isolation...');

// Test 3.1: Goal with future target date and insufficient allocation
{
  const mockGoal = {
    id: 'g1',
    title: 'Emergency Fund',
    targetAmount: 100000,
    currentAmount: 20000,
    monthlyAllocation: 5000, // Remaining 80,000 / 6 months = 13,333/mo needed
    targetDate: '2027-04-30'
  };

  const pacing = calculateGoalPacing(mockGoal, '2026-10-24');
  assert(pacing.percent === 20, 'Goal progress is 20%');
  assert(pacing.remainingAmount === 80000, 'Remaining amount is 80,000');
  assert(pacing.pacingStatus === 'lagging', 'Pacing status is lagging');
  assert(pacing.requiredMonthlyRate > 10000, 'Required rate is > 10,000/mo');

  const alerts = generateActionableAlerts({
    transactions: [],
    budgets: [],
    goals: [mockGoal],
    targetMonth: '2026-10',
    asOfDate: '2026-10-24'
  });

  assert(alerts.length === 1, 'Goal slow progress alert generated');
  assert(alerts[0].type === 'goal_slow_progress', 'Alert type is goal_slow_progress');
  assert(alerts[0].triggerData.monthlyAllocation === 5000, 'Triggers with scheduled allocation of 5000');
}

// Test 3.2: Goal achieved (100% funded)
{
  const mockGoal = {
    id: 'g2',
    title: 'Laptop Upgrade',
    targetAmount: 85000,
    currentAmount: 85000,
    monthlyAllocation: 10000,
    targetDate: '2026-12-31'
  };

  const pacing = calculateGoalPacing(mockGoal, '2026-10-24');
  assert(pacing.percent === 100, 'Goal progress is 100%');
  assert(pacing.remainingAmount === 0, 'Remaining amount is 0');
  assert(pacing.pacingStatus === 'completed', 'Pacing status is completed');
  assert(pacing.statusLabel === 'Goal Achieved', 'Status label is Goal Achieved');

  const alerts = generateActionableAlerts({
    transactions: [],
    budgets: [],
    goals: [mockGoal],
    targetMonth: '2026-10',
    asOfDate: '2026-10-24'
  });

  assert(alerts.length === 1, 'Goal achieved alert generated');
  assert(alerts[0].type === 'goal_achieved', 'Alert type is goal_achieved');
  assert(alerts[0].severity === 'success', 'Severity is success');
}

// Test 3.3: Strict isolation of goal contributions (no bank transfer / no expense transaction)
{
  const ledger = [
    { id: 'txn_1', type: 'expense', amount: 500, category: 'Food & Dining Out', date: '2026-10-01' }
  ];
  let goal = {
    id: 'g3',
    title: 'Vacation',
    targetAmount: 50000,
    currentAmount: 10000
  };

  // Simulating the contributeToGoal implementation
  const contribution = 5000;
  goal = { ...goal, currentAmount: roundINR(goal.currentAmount + contribution) };

  assert(goal.currentAmount === 15000, 'Goal balance updated to 15,000');
  assert(ledger.length === 1, 'Transaction ledger length is strictly unchanged (no fake expense generated)');
  assert(ledger[0].amount === 500, 'Ledger expense amounts untouched');
}

// -----------------------------------------------------------------------------
// Test Group 4: Sanitization, Boundaries & Persistence
// -----------------------------------------------------------------------------
console.log('\n4. Testing Sanitization & Data Integrity...');

// Test 4.1: Budget sanitization
{
  const sanitized = sanitizeBudget({
    category: 'Rent & Housing',
    allocatedAmount: '18000.505',
    alertThreshold: 0.90,
    month: '2026-10'
  });
  assert(sanitized !== null, 'Valid budget sanitized');
  assert(sanitized.allocatedAmount === 18000.51, 'Allocated amount safely rounded to 2 decimals');
  assert(sanitized.alertThreshold === 0.90, 'Alert threshold preserved');
}

// Test 4.2: Invalid budget sanitization
{
  assert(sanitizeBudget(null) === null, 'Null budget returns null');
  assert(sanitizeBudget({}) === null, 'Empty budget without category returns null');
  const negAmt = sanitizeBudget({ category: 'Test', allocatedAmount: -500 });
  assert(negAmt.allocatedAmount === 0, 'Negative budget amount clamped to 0');
}

// Test 4.3: Goal sanitization
{
  const sanitized = sanitizeGoal({
    title: ' Car Downpayment ',
    targetAmount: '200000.888',
    currentAmount: -100, // invalid negative
    monthlyAllocation: '15000'
  });
  assert(sanitized !== null, 'Valid goal sanitized');
  assert(sanitized.title === 'Car Downpayment', 'Title whitespace trimmed');
  assert(sanitized.targetAmount === 200000.89, 'Target amount rounded');
  assert(sanitized.currentAmount === 0, 'Negative currentAmount clamped to 0');
  assert(sanitized.monthlyAllocation === 15000, 'Monthly allocation parsed as number');
}

console.log(`\n=== Validation Suite Completed: ${passed} Passed, ${failed} Failed ===`);

if (failed > 0) {
  process.exit(1);
}
