/**
 * SpendSense — Phase 8 Automated Validation Suite
 * Tests "Can I Afford This?" Purchase Decision Simulator Engine
 *
 * Test Matrix:
 * 1. Sufficient funds -> "Looks affordable"
 * 2. Category budget breach -> "Consider waiting"
 * 3. Essential expense conflict -> "Consider waiting" or "Not affordable"
 * 4. Liquid cash deficit / Month-end deficit -> "Not affordable under your current plan"
 * 5. Savings goal compression -> Flags savings shortfall
 * 6. Deduplication of expenses -> Ensures already-paid commitments are not double-subtracted
 * 7. Insufficient data caveats & transparent disclaimers
 * 8. Scenario comparison alternatives matrix
 */

import { evaluatePurchaseDecision } from '../src/utils/affordability.js';
import { roundINR } from '../src/utils/calculations.js';

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

console.log('=== SpendSense Phase 8 Simulator Validation Suite ===\n');

// -----------------------------------------------------------------------------
// Test 1: Sufficient Funds & Safe Headroom ("Looks affordable")
// -----------------------------------------------------------------------------
console.log('1. Testing Case: Sufficient Funds & Healthy Buffer...');
{
  const result = evaluatePurchaseDecision({
    purchaseName: 'Noise Cancelling Earbuds',
    purchaseAmount: 2500,
    category: 'Shopping & Discretionary',
    availableFunds: 35000,
    forecast: {
      estimatedMonthEndPosition: 22000,
      remainingFixedCommitments: 0
    },
    budgets: [
      { category: 'Shopping & Discretionary', allocatedAmount: 8000 }
    ],
    monthTransactions: [
      { type: 'expense', category: 'Shopping & Discretionary', amount: 2000 }
    ],
    goals: [
      { monthlyAllocation: 5000 }
    ],
    hasReliableOpeningBalance: true
  });

  assert(result.assessment === 'Looks affordable', 'Assessment is "Looks affordable"');
  assert(result.tier === 'AFFORDABLE', 'Tier is AFFORDABLE');
  assert(result.badgeVariant === 'emerald', 'Badge variant is emerald');
  assert(result.metrics.liquidCashAfter === 32500, 'Post-purchase cash is 32,500');
  assert(result.metrics.monthEndAfter === 19500, 'Month-end after is 19,500 (> 5,000 savings target)');
  assert(result.metrics.categoryHeadroomAfter === 3500, 'Category headroom after is 3,500');
  assert(!result.metrics.isCategoryOverBudget, 'Category cap is not breached');
  assert(result.conflicts.length === 0, 'Zero conflicts detected');
}

// -----------------------------------------------------------------------------
// Test 2: Category Budget Breach ("Consider waiting")
// -----------------------------------------------------------------------------
console.log('\n2. Testing Case: Category Budget Breach...');
{
  const result = evaluatePurchaseDecision({
    purchaseName: 'Designer Jacket',
    purchaseAmount: 5000,
    category: 'Shopping & Discretionary',
    availableFunds: 40000,
    forecast: {
      estimatedMonthEndPosition: 28000,
      remainingFixedCommitments: 0
    },
    budgets: [
      { category: 'Shopping & Discretionary', allocatedAmount: 6000 }
    ],
    monthTransactions: [
      { type: 'expense', category: 'Shopping & Discretionary', amount: 4000 }
    ], // Headroom before is 2,000. Purchase of 5,000 exceeds cap by 3,000
    goals: [],
    hasReliableOpeningBalance: true
  });

  assert(result.assessment === 'Consider waiting', 'Assessment is "Consider waiting"');
  assert(result.tier === 'CAUTION', 'Tier is CAUTION');
  assert(result.badgeVariant === 'amber', 'Badge variant is amber');
  assert(result.metrics.isCategoryOverBudget === true, 'Category budget is flagged as over-budget');
  assert(result.metrics.categoryOverage === 3000, 'Overage is exactly 3,000');
  assert(result.conflicts.some((c) => c.includes('budget breach')), 'Conflicts list contains budget breach');
}

// -----------------------------------------------------------------------------
// Test 3: Essential Expense Conflict
// -----------------------------------------------------------------------------
console.log('\n3. Testing Case: Essential Expense Collision...');
{
  const result = evaluatePurchaseDecision({
    purchaseName: 'Smart TV',
    purchaseAmount: 18000,
    category: 'Shopping & Discretionary',
    availableFunds: 25000,
    forecast: {
      estimatedMonthEndPosition: 12000,
      remainingFixedCommitments: 16000 // Unpaid upcoming rent/bills
    },
    budgets: [],
    monthTransactions: [],
    goals: [],
    userUpcomingEssentials: 2000 // Total essentials = 18,000
  });

  // Post-purchase cash = 25,000 - 18,000 = 7,000.
  // But remaining essentials = 18,000! Shortfall = 11,000!
  assert(result.assessment === 'Not affordable under your current plan', 'Assessment is "Not affordable under your current plan"');
  assert(result.tier === 'NOT_AFFORDABLE', 'Tier is NOT_AFFORDABLE');
  assert(result.badgeVariant === 'rose', 'Badge variant is rose');
  assert(result.metrics.hasEssentialConflict === true, 'Essential conflict flagged');
  assert(result.metrics.essentialShortfall === 11000, 'Essential shortfall is 11,000');
  assert(result.conflicts.some((c) => c.includes('Essential expense collision')), 'Conflicts list contains essential expense collision');
}

// -----------------------------------------------------------------------------
// Test 4: Direct Liquid Cash Deficit / Projected Month-End Deficit
// -----------------------------------------------------------------------------
console.log('\n4. Testing Case: Direct Cash Deficit...');
{
  const result = evaluatePurchaseDecision({
    purchaseName: 'Motorcycle Downpayment',
    purchaseAmount: 60000,
    category: 'Transport & Commute',
    availableFunds: 35000, // Only 35,000 available
    forecast: {
      estimatedMonthEndPosition: 15000,
      remainingFixedCommitments: 0
    },
    budgets: [],
    monthTransactions: [],
    goals: []
  });

  assert(result.assessment === 'Not affordable under your current plan', 'Assessment is "Not affordable under your current plan"');
  assert(result.tier === 'NOT_AFFORDABLE', 'Tier is NOT_AFFORDABLE');
  assert(result.metrics.liquidCashAfter === -25000, 'Post-purchase cash is -25,000');
  assert(result.conflicts.some((c) => c.includes('Immediate cash deficit')), 'Direct cash deficit explicitly identified');
}

// -----------------------------------------------------------------------------
// Test 5: Savings Goal Compression
// -----------------------------------------------------------------------------
console.log('\n5. Testing Case: Savings Goal Conflict...');
{
  const result = evaluatePurchaseDecision({
    purchaseName: 'Weekend Resort Stay',
    purchaseAmount: 14000,
    category: 'Food & Dining Out',
    availableFunds: 30000,
    forecast: {
      estimatedMonthEndPosition: 20000, // Month-end drops to 6,000
      remainingFixedCommitments: 0
    },
    budgets: [],
    monthTransactions: [],
    goals: [
      { title: 'Emergency Fund', monthlyAllocation: 10000 } // Need 10,000
    ]
  });

  assert(result.assessment === 'Consider waiting', 'Assessment is "Consider waiting"');
  assert(result.metrics.hasSavingsConflict === true, 'Savings conflict flagged');
  assert(result.metrics.savingsCompression === 4000, 'Compresses savings by 4,000 (10,000 - 6,000)');
  assert(result.conflicts.some((c) => c.includes('Savings goal compression')), 'Identifies savings compression');
}

// -----------------------------------------------------------------------------
// Test 6: Deduplication Check (No double counting of paid expenses)
// -----------------------------------------------------------------------------
console.log('\n6. Testing Deduplication of Expenses...');
{
  // Rent was 18,000 and has already been paid in recorded transactions.
  // remainingFixedCommitments should be 0, not 18,000 again.
  const result = evaluatePurchaseDecision({
    purchaseName: 'Office Chair',
    purchaseAmount: 5000,
    category: 'Shopping & Discretionary',
    availableFunds: 20000,
    forecast: {
      estimatedMonthEndPosition: 15000,
      remainingFixedCommitments: 0 // Correctly reflects rent was already subtracted in liquid cash
    },
    budgets: [],
    monthTransactions: [
      { type: 'expense', category: 'Rent & Housing', amount: 18000 }
    ],
    goals: []
  });

  assert(result.metrics.totalUpcomingEssentials === 0, 'Upcoming essentials is 0 (already paid rent is not counted twice)');
  assert(result.metrics.cushionAfterEssentials === 15000, 'Cushion after essentials is full 15,000');
}

// -----------------------------------------------------------------------------
// Test 7: Data Quality Caveats & Disclaimer
// -----------------------------------------------------------------------------
console.log('\n7. Testing Data Quality Caveats & Disclaimers...');
{
  const result = evaluatePurchaseDecision({
    purchaseName: 'Camera',
    purchaseAmount: 30000,
    hasReliableOpeningBalance: false,
    monthTransactions: [
      { type: 'expense', amount: 100 }
    ] // Only 1 transaction
  });

  assert(result.caveats.length >= 2, 'Caveats list contains at least 2 data quality notices');
  assert(result.caveats.some((c) => c.includes('opening balance')), 'Flags unlinked opening balance caveat');
  assert(result.caveats.some((c) => c.includes('Limited transaction history')), 'Flags limited transaction history caveat');
  assert(result.disclaimer.includes('financial advisory'), 'Contains explicit non-guarantee / non-advisory disclaimer');
}

// -----------------------------------------------------------------------------
// Test 8: Scenario Comparison Alternatives Matrix
// -----------------------------------------------------------------------------
console.log('\n8. Testing Scenario Comparison Alternatives Matrix...');
{
  const result = evaluatePurchaseDecision({
    purchaseName: 'Gaming Laptop',
    purchaseAmount: 80000,
    availableFunds: 50000,
    forecast: { estimatedMonthEndPosition: 30000 }
  });

  assert(result.scenarios.length === 3, 'Generates exactly 3 scenarios');
  assert(result.scenarios[0].id === 'current', 'Scenario 1 is current proposal');
  assert(result.scenarios[0].amount === 80000, 'Scenario 1 amount is 80,000');
  assert(result.scenarios[1].id === 'lower_cost', 'Scenario 2 is lower-cost alternative');
  assert(result.scenarios[1].amount === 44000, 'Scenario 2 amount is 55% = 44,000');
  assert(result.scenarios[2].id === 'postpone', 'Scenario 3 is postpone');
  assert(result.scenarios[2].amount === 0, 'Scenario 3 amount is 0');
  assert(result.scenarios[2].assessment === 'Looks affordable', 'Postponing is assessed as Looks affordable');
}

console.log(`\n=== Simulator Suite Completed: ${passed} Passed, ${failed} Failed ===`);

if (failed > 0) {
  process.exit(1);
}
