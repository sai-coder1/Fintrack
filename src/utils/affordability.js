/**
 * SpendSense — "Can I Afford This?" Purchase Decision Simulator Engine
 *
 * MATHEMATICAL CONVENTIONS & INTEGRITY RULES:
 * 1. Balance Model:
 *    - Uses available liquid cash based on recorded inflows minus outflows.
 *    - Never assumes current monthly cash flow equals total bank net worth.
 *    - Flags data caveats when opening statement balance is unlinked.
 *
 * 2. Deduplication of Expenses:
 *    - Never subtracts the same expense twice.
 *    - If rent or utility bills have already been paid in the current month,
 *      only the remaining unpaid headroom is counted as an upcoming liability.
 *
 * 3. 3-Tier Assessment Standard:
 *    - "Looks affordable" (Emerald)
 *    - "Consider waiting" (Amber)
 *    - "Not affordable under your current plan" (Rose)
 *
 * 4. Transparent Explanation & Disclaimers:
 *    - Every decision explicitly explains the underlying mathematical triggers.
 *    - Educational budgeting tool only; never professional financial advice.
 */

import { roundINR } from './calculations.js';
import { formatINR } from './formatters.js';

/**
 * Evaluates whether a proposed purchase is affordable under current cashflow,
 * category budgets, upcoming essential commitments, and savings goals.
 *
 * @param {object} params
 * @param {string} params.purchaseName - Name of the item/expense
 * @param {number|string} params.purchaseAmount - Purchase cost in INR
 * @param {string} params.category - Spending category
 * @param {string} [params.purchaseDate] - Proposed date (YYYY-MM-DD)
 * @param {'need' | 'want'} [params.nature='want'] - Essential vs Discretionary
 * @param {number} [params.userUpcomingEssentials=0] - Additional user-specified upcoming bills
 * @param {number} [params.availableFunds=0] - Current liquid cash (net balance)
 * @param {object} [params.forecast] - Transparent month-end forecast snapshot
 * @param {Array<object>} [params.budgets=[]] - Category budget caps
 * @param {Array<object>} [params.monthTransactions=[]] - Target month transactions
 * @param {Array<object>} [params.goals=[]] - Active savings goals
 * @param {string} [params.targetMonth='2026-10'] - Evaluated month
 * @param {boolean} [params.hasReliableOpeningBalance=false] - Whether statement opening balance exists
 * @returns {object} Full auditable decision evaluation
 */
export function evaluatePurchaseDecision({
  purchaseName = 'Proposed Purchase',
  purchaseAmount = 0,
  category = 'Shopping & Discretionary',
  purchaseDate = '2026-10-24',
  nature = 'want',
  userUpcomingEssentials = 0,
  availableFunds = 0,
  forecast = {},
  budgets = [],
  monthTransactions = [],
  goals = [],
  targetMonth = '2026-10',
  hasReliableOpeningBalance = false
}) {
  const cost = Math.max(0, roundINR(Number(purchaseAmount) || 0));
  const cleanName = String(purchaseName || 'Proposed Purchase').trim();
  const isEssential = nature === 'need';

  // 1. Available Liquid Funds Before & After
  const liquidCashBefore = roundINR(availableFunds);
  const liquidCashAfter = roundINR(liquidCashBefore - cost);
  const hasDirectCashDeficit = liquidCashAfter < 0;

  // 2. Upcoming Essential Commitments (Prevent double-counting!)
  // Remaining unpaid fixed obligations from forecast (unpaid rent, utilities, etc.)
  const forecastFixedRemaining = Math.max(0, Number(forecast.remainingFixedCommitments) || 0);
  const additionalEssentials = Math.max(0, roundINR(Number(userUpcomingEssentials) || 0));
  const totalUpcomingEssentials = roundINR(forecastFixedRemaining + additionalEssentials);

  // Available cash cushion after reserving upcoming essentials
  const cushionAfterEssentials = roundINR(liquidCashAfter - totalUpcomingEssentials);
  const hasEssentialConflict = cushionAfterEssentials < 0;
  const essentialShortfall = hasEssentialConflict ? Math.abs(cushionAfterEssentials) : 0;

  // 3. Category Budget Impact
  const budgetObj = budgets.find((b) => b && b.category === category);
  const categoryCap = budgetObj ? Math.max(0, Number(budgetObj.allocatedAmount) || 0) : 0;
  const hasCategoryBudget = categoryCap > 0;

  // Actual expense transactions in target month for this category
  const categorySpentBefore = roundINR(
    (monthTransactions || [])
      .filter((t) => t && t.type === 'expense' && t.category === category)
      .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0)
  );
  const categorySpentAfter = roundINR(categorySpentBefore + cost);
  const categoryHeadroomBefore = hasCategoryBudget ? roundINR(categoryCap - categorySpentBefore) : 0;
  const categoryHeadroomAfter = hasCategoryBudget ? roundINR(categoryCap - categorySpentAfter) : 0;

  const isCategoryOverBudget = hasCategoryBudget && categoryHeadroomAfter < 0;
  const categoryOverage = isCategoryOverBudget ? Math.abs(categoryHeadroomAfter) : 0;
  const categoryPercentBefore = hasCategoryBudget ? roundINR((categorySpentBefore / categoryCap) * 100) : 0;
  const categoryPercentAfter = hasCategoryBudget ? roundINR((categorySpentAfter / categoryCap) * 100) : 0;

  // 4. Estimated Month-End Position Impact
  const monthEndBefore = roundINR(
    Number(forecast.estimatedMonthEndPosition) ||
    Number(forecast.projectedMonthEndBalance) ||
    liquidCashBefore
  );
  const monthEndAfter = roundINR(monthEndBefore - cost);
  const isMonthEndDeficit = monthEndAfter < 0;
  const projectedDeficit = isMonthEndDeficit ? Math.abs(monthEndAfter) : 0;

  // 5. Savings Goals & Protected Targets
  const monthlySavingsTarget = roundINR(
    (goals || []).reduce((sum, g) => sum + (Math.max(0, Number(g.monthlyAllocation)) || 0), 0)
  );
  const totalGoalAccumulated = roundINR(
    (goals || []).reduce((sum, g) => sum + (Math.max(0, Number(g.currentAmount)) || 0), 0)
  );

  // Does the purchase eat into planned monthly savings?
  const hasSavingsConflict = monthlySavingsTarget > 0 && monthEndAfter < monthlySavingsTarget;
  const savingsCompression = hasSavingsConflict
    ? roundINR(Math.min(monthlySavingsTarget, monthlySavingsTarget - Math.max(0, monthEndAfter)))
    : 0;

  // 6. Multi-Factor Assessment Engine
  let assessment = 'Looks affordable';
  let tier = 'AFFORDABLE'; // 'AFFORDABLE' | 'CAUTION' | 'NOT_AFFORDABLE'
  let badgeVariant = 'emerald';
  const conflicts = [];
  const reasons = [];

  // Edge Case: Zero cost
  if (cost === 0) {
    return {
      assessment: 'Looks affordable',
      tier: 'AFFORDABLE',
      badgeVariant: 'emerald',
      headline: 'Enter an amount to simulate purchase impact',
      summary: 'Please enter a purchase cost greater than ₹0 to calculate financial viability.',
      explanation: 'No cost was entered.',
      cost: 0,
      liquidCashBefore,
      liquidCashAfter: liquidCashBefore,
      monthEndBefore,
      monthEndAfter: monthEndBefore,
      categoryCap,
      categorySpentBefore,
      categorySpentAfter: categorySpentBefore,
      categoryHeadroomBefore,
      categoryHeadroomAfter: categoryHeadroomBefore,
      conflicts: [],
      tradeOffs: [],
      caveats: []
    };
  }

  // --- Collect All Independent Friction Points & Conflicts ---
  if (hasDirectCashDeficit) {
    conflicts.push(`Immediate cash deficit: Purchase exceeds available liquid balance by ${formatINR(Math.abs(liquidCashAfter))}.`);
    reasons.push(`You do not have enough recorded cash on hand (${formatINR(liquidCashBefore)}) to pay ${formatINR(cost)}.`);
  }

  if (isMonthEndDeficit) {
    conflicts.push(`Projected month-end deficit of ${formatINR(projectedDeficit)}.`);
    reasons.push(`At your current variable spending run-rate, spending ${formatINR(cost)} now causes you to run out of money before the end of the month.`);
  }

  if (hasEssentialConflict) {
    conflicts.push(`Essential expense collision: Short by ${formatINR(essentialShortfall)} for remaining rent and utility bills.`);
    reasons.push(`This purchase directly cannibalizes cash needed for upcoming non-negotiable living liabilities.`);
  }

  if (isCategoryOverBudget) {
    conflicts.push(`Category budget breach: Exceeds ${category} limit by ${formatINR(categoryOverage)}.`);
    reasons.push(`This purchase pushes ${category} spend to ${formatINR(categorySpentAfter)} (${categoryPercentAfter}% of your ${formatINR(categoryCap)} limit).`);
  }

  if (hasSavingsConflict) {
    conflicts.push(`Savings goal compression: Encroaches on your ${formatINR(monthlySavingsTarget)}/month savings plan by ${formatINR(savingsCompression)}.`);
    reasons.push(`Your month-end runway will drop below your planned monthly savings commitment of ${formatINR(monthlySavingsTarget)}.`);
  }

  if (monthEndAfter < 2000 && !isMonthEndDeficit) {
    conflicts.push(`Razor-thin runway: Estimated month-end surplus drops to ${formatINR(monthEndAfter)}.`);
    reasons.push(`Leaves very little safety cushion for unexpected emergencies.`);
  }

  // --- Determine Assessment Tier ---
  if (hasDirectCashDeficit || isMonthEndDeficit || cushionAfterEssentials < -2000) {
    assessment = 'Not affordable under your current plan';
    tier = 'NOT_AFFORDABLE';
    badgeVariant = 'rose';
  } else if (conflicts.length > 0) {
    assessment = 'Consider waiting';
    tier = 'CAUTION';
    badgeVariant = 'amber';
  } else {
    assessment = 'Looks affordable';
    tier = 'AFFORDABLE';
    badgeVariant = 'emerald';
    reasons.push(`You have sufficient liquid cash (${formatINR(liquidCashBefore)}), your month-end position remains positive (${formatINR(monthEndAfter)}), and all upcoming essential bills remain fully protected.`);
    if (hasCategoryBudget) {
      reasons.push(`Category spend stays within your cap with ${formatINR(categoryHeadroomAfter)} remaining headroom.`);
    }
  }

  // 7. Humanized Actionable Explanation & Trade-Offs
  let headline = '';
  let summary = '';
  const tradeOffs = [];

  if (tier === 'AFFORDABLE') {
    headline = `Comfortably fits within your ${targetMonth} spending plan`;
    summary = `This purchase leaves ${formatINR(liquidCashAfter)} in liquid cash and projects a healthy month-end surplus of ${formatINR(monthEndAfter)} after funding all planned savings and essential bills.`;
    tradeOffs.push('Record the transaction promptly after making the purchase to keep category pacing accurate.');
    tradeOffs.push(`Remaining ${category} budget after purchase: ${hasCategoryBudget ? formatINR(categoryHeadroomAfter) : 'No cap set'}.`);
  } else if (tier === 'CAUTION') {
    headline = 'Affordable with trade-offs — consider timing or budget adjustments';
    summary = `You have the liquid cash today, but committing ${formatINR(cost)} now triggers budget or savings friction: ${reasons.join(' ')}`;
    if (isCategoryOverBudget) {
      tradeOffs.push(`Offset the ${formatINR(categoryOverage)} category overage by trimming discretionary spending in other categories.`);
    }
    if (hasSavingsConflict) {
      tradeOffs.push(`Temporarily reduce this month's savings goal contributions by ${formatINR(savingsCompression)} or defer purchase to next salary cycle.`);
    }
    tradeOffs.push('Consider waiting until the last week of the month to confirm your variable run-rate holds up.');
  } else {
    headline = 'High financial risk — likely to create month-end cashflow distress';
    summary = `Making this purchase now leaves an estimated month-end shortfall of ${formatINR(projectedDeficit > 0 ? projectedDeficit : essentialShortfall)}. It is not recommended under your current plan.`;
    tradeOffs.push('Postpone this purchase until your next salary credit or cash inflow arrives.');
    tradeOffs.push(`Explore a lower-cost option (e.g. ₹${Math.round(cost * 0.5).toLocaleString('en-IN')}) that fits within remaining cash.`);
    tradeOffs.push('Create a dedicated savings goal to accumulate funds over 2 to 3 months without risking essentials.');
  }

  // 8. Data-Quality Caveats & Disclaimers
  const caveats = [];
  if (!hasReliableOpeningBalance) {
    caveats.push('Calculations are based strictly on recorded statement transactions. Unlinked external bank accounts or opening balances are not factored in.');
  }
  if (monthTransactions.length < 5) {
    caveats.push('Limited transaction history in the current month reduces the accuracy of the variable run-rate forecast.');
  }
  caveats.push('Projections assume regular daily living spend continues at your current burn rate without unbudgeted emergencies.');

  // 9. Scenario Comparison Alternatives
  const lowerCostAmount = roundINR(cost * 0.55);
  const scenarios = [
    {
      id: 'current',
      title: 'Current Proposal',
      description: cleanName,
      amount: cost,
      liquidCashAfter,
      monthEndAfter,
      categoryHeadroomAfter,
      assessment,
      badgeVariant
    },
    {
      id: 'lower_cost',
      title: 'Lower-Cost Alternative',
      description: `Budget-friendly option at ~55% cost`,
      amount: lowerCostAmount,
      liquidCashAfter: roundINR(liquidCashBefore - lowerCostAmount),
      monthEndAfter: roundINR(monthEndBefore - lowerCostAmount),
      categoryHeadroomAfter: hasCategoryBudget ? roundINR(categoryCap - (categorySpentBefore + lowerCostAmount)) : 0,
      assessment: (liquidCashBefore - lowerCostAmount >= 0 && monthEndBefore - lowerCostAmount >= monthlySavingsTarget)
        ? 'Looks affordable'
        : 'Consider waiting',
      badgeVariant: (liquidCashBefore - lowerCostAmount >= 0 && monthEndBefore - lowerCostAmount >= monthlySavingsTarget)
        ? 'emerald'
        : 'amber'
    },
    {
      id: 'postpone',
      title: 'Postpone to Next Month',
      description: 'Defer until next regular salary credit',
      amount: 0,
      liquidCashAfter: liquidCashBefore,
      monthEndAfter: monthEndBefore,
      categoryHeadroomAfter: categoryHeadroomBefore,
      assessment: 'Looks affordable',
      badgeVariant: 'emerald'
    }
  ];

  return {
    purchaseName: cleanName,
    purchaseAmount: cost,
    category,
    purchaseDate,
    nature,
    isEssential,
    assessment,
    tier,
    badgeVariant,
    headline,
    summary,
    reasons,
    conflicts,
    tradeOffs,
    caveats,

    // Quantitative metrics Before vs After
    metrics: {
      liquidCashBefore,
      liquidCashAfter,
      cashChange: -cost,

      monthEndBefore,
      monthEndAfter,
      monthEndChange: -cost,

      categoryCap,
      categorySpentBefore,
      categorySpentAfter,
      categoryHeadroomBefore,
      categoryHeadroomAfter,
      categoryPercentBefore,
      categoryPercentAfter,
      isCategoryOverBudget,
      categoryOverage,

      totalUpcomingEssentials,
      cushionAfterEssentials,
      hasEssentialConflict,
      essentialShortfall,

      monthlySavingsTarget,
      totalGoalAccumulated,
      hasSavingsConflict,
      savingsCompression
    },

    scenarios,
    disclaimer: 'SpendSense purchase affordability simulations are mathematical cashflow estimations for budgeting guidance only. They do not constitute certified financial advisory services.'
  };
}
