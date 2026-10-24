/**
 * SpendSense — Transparent Month-End Forecast & Affordability Decision Engine
 *
 * MATHEMATICAL MODEL & METHODOLOGY:
 * 1. Separation of Fixed vs. Variable Outflows:
 *    - Fixed Lump-Sum: Rent, Housing, and scheduled major bills occur once or twice per cycle.
 *      Blindly dividing total monthly expenses by elapsed days would extrapolate rent 31x.
 *    - Variable Living Expenses: Food, Groceries, Commute, Discretionary Shopping occur daily.
 *      Only variable expenses are used to compute the daily variable run-rate.
 * 2. Conservative Income Assumption:
 *    - The model DOES NOT assume future income arrives continuously.
 *      It anchors strictly to liquid cash already received in the current cycle.
 * 3. Pending Essential Commitments:
 *    - If essential budget categories (Rent, Utilities) have not yet been spent,
 *      the unpaid headroom is reserved as a committed future liability.
 * 4. Historical Benchmarking:
 *    - When prior months of statement data exist, historical daily variable spending
 *      is calculated to provide a benchmark comparison against current spending pace.
 * 5. Transparent Confidence & Safety:
 *    - Confidence tiers (High, Moderate, Low, Insufficient) reflect sample size and elapsed days.
 *    - Strictly deterministic arithmetic; zero black-box AI or fabricated predictions.
 */

import { roundINR } from './calculations.js';

/**
 * Calculates a transparent, auditable month-end financial forecast.
 *
 * @param {object} params
 * @param {Array<object>} params.transactions - All transactions (current and historical)
 * @param {Array<object>} params.budgets - Active category spending budgets
 * @param {string} [params.targetMonth='2026-10'] - Month to forecast (YYYY-MM)
 * @param {string} [params.asOfDate='2026-10-24'] - Anchor date for simulation (YYYY-MM-DD)
 * @returns {object} Full auditable forecast snapshot
 */
export function calculateMonthEndForecast({
  transactions = [],
  budgets = [],
  targetMonth = '2026-10',
  asOfDate = '2026-10-24'
}) {
  // 1. Time Horizon Calculation
  const [targetYear, targetMonthNum] = targetMonth.split('-').map((v) => parseInt(v, 10));
  // Total days in target month (e.g. Oct = 31, Sep = 30, Feb = 28/29)
  const daysInMonth = new Date(targetYear || 2026, targetMonthNum || 10, 0).getDate();

  // Determine elapsed days based on asOfDate
  let currentDay = 24;
  if (asOfDate && asOfDate.startsWith(targetMonth)) {
    const parts = asOfDate.split('-');
    if (parts.length === 3) {
      currentDay = parseInt(parts[2], 10) || 24;
    }
  }

  const daysElapsed = Math.min(daysInMonth, Math.max(1, currentDay));
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  // 2. Filter target month transactions up to asOfDate
  const monthTxns = (transactions || []).filter((t) => {
    if (!t || !t.date || !t.date.startsWith(targetMonth)) return false;
    return t.date <= asOfDate;
  });

  // Current month actuals to date
  const actualIncomeToDate = roundINR(
    monthTxns
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0)
  );

  const actualExpensesToDate = roundINR(
    monthTxns
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0)
  );

  const actualPositionToDate = roundINR(actualIncomeToDate - actualExpensesToDate);

  // 3. Separate Fixed from Variable Outflows
  const fixedCategories = ['Rent & Housing', 'Bills & Utilities'];

  const fixedExpensesSpent = roundINR(
    monthTxns
      .filter((t) => t.type === 'expense' && fixedCategories.includes(t.category))
      .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0)
  );

  const variableExpensesSpent = roundINR(
    monthTxns
      .filter((t) => t.type === 'expense' && !fixedCategories.includes(t.category))
      .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0)
  );

  // Current Variable Daily Run-Rate
  const currentVariableBurnRate = daysElapsed > 0
    ? roundINR(variableExpensesSpent / daysElapsed)
    : 0;

  // 4. Historical Spending Pace (from prior months if available)
  const priorTxns = (transactions || []).filter((t) => {
    if (!t || !t.date) return false;
    return t.date < `${targetMonth}-01` && t.type === 'expense' && !fixedCategories.includes(t.category);
  });

  let historicalDailySpend = null;
  let pacingComparison = null;

  if (priorTxns.length >= 5) {
    // Determine number of distinct prior days
    const priorDaysSet = new Set(priorTxns.map((t) => t.date));
    const priorTotalVariable = priorTxns.reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);
    const priorDaysCount = Math.max(1, priorDaysSet.size);
    historicalDailySpend = roundINR(priorTotalVariable / priorDaysCount);

    if (historicalDailySpend > 0) {
      const diff = roundINR(currentVariableBurnRate - historicalDailySpend);
      const pctDiff = roundINR((diff / historicalDailySpend) * 100);
      pacingComparison = {
        historicalDailySpend,
        difference: diff,
        percentDifference: pctDiff,
        isHigher: diff > 0
      };
    }
  }

  // 5. Projected Variable Remaining Outflows
  const projectedVariableRemaining = roundINR(currentVariableBurnRate * daysRemaining);

  // 6. Pending Committed / Budgeted Fixed Obligations
  let remainingFixedCommitments = 0;
  (budgets || [])
    .filter((b) => fixedCategories.includes(b.category))
    .forEach((b) => {
      const spent = monthTxns
        .filter((t) => t.type === 'expense' && t.category === b.category)
        .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);
      const unspent = Math.max(0, (Number(b.allocatedAmount) || 0) - spent);
      remainingFixedCommitments += unspent;
    });
  remainingFixedCommitments = roundINR(remainingFixedCommitments);

  // 7. Projected Total Remaining Expenses
  const projectedRemainingExpenses = roundINR(
    remainingFixedCommitments + projectedVariableRemaining
  );

  // 8. Estimated Month-End Position
  const projectedMonthEndPosition = roundINR(
    actualPositionToDate - projectedRemainingExpenses
  );

  // Safe daily allowance
  const safeDailySpend = daysRemaining > 0
    ? roundINR(Math.max(0, actualPositionToDate - remainingFixedCommitments) / daysRemaining)
    : 0;

  // Days of Liquidity Runway at current burn rate
  const runwayDays = currentVariableBurnRate > 0
    ? roundINR(actualPositionToDate / currentVariableBurnRate)
    : actualPositionToDate > 0 ? 999 : 0;

  // 9. Data Quality & Confidence Assessment
  let dataQuality = 'moderate';
  let confidenceLabel = 'Moderate Confidence';
  let warningMessage = null;

  if (monthTxns.length === 0) {
    dataQuality = 'insufficient';
    confidenceLabel = 'Insufficient Data';
    warningMessage = 'No transactions recorded for this month yet. Projections cannot be computed accurately.';
  } else if (daysElapsed < 5) {
    dataQuality = 'low';
    confidenceLabel = 'Preliminary Estimate (Early in Cycle)';
    warningMessage = `Only ${daysElapsed} days have elapsed in this month. Early-cycle spending rates exhibit high volatility.`;
  } else if (daysElapsed >= 15 && historicalDailySpend !== null) {
    dataQuality = 'high';
    confidenceLabel = 'High Confidence';
  } else if (daysElapsed >= 10) {
    dataQuality = 'moderate';
    confidenceLabel = 'Moderate Confidence';
  }

  if (projectedMonthEndPosition < 0 && dataQuality !== 'insufficient') {
    warningMessage = `At your current spending pace (₹${currentVariableBurnRate}/day), an estimated month-end deficit of ₹${Math.abs(projectedMonthEndPosition).toLocaleString('en-IN')} is projected before month-end.`;
  }

  // 10. Transparent Calculation Assumptions
  const assumptions = [
    `Separated lump-sum fixed costs (₹${fixedExpensesSpent} spent, ₹${remainingFixedCommitments} remaining) from variable daily living expenses.`,
    `Variable spend run-rate is ₹${currentVariableBurnRate}/day across ${daysElapsed} elapsed days.`,
    `Projected variable outlays: ₹${currentVariableBurnRate}/day × ${daysRemaining} remaining days = ₹${projectedVariableRemaining}.`,
    `Reserved ₹${remainingFixedCommitments} for upcoming unpaid essential category budgets.`,
    `Income is anchored strictly to ₹${actualIncomeToDate} already credited; no assumed future lump-sum credits.`
  ];

  return {
    targetMonth,
    daysInMonth,
    daysElapsed,
    daysRemaining,

    // Actuals to date
    actualIncomeToDate,
    actualExpensesToDate,
    actualPositionToDate,
    fixedExpensesSpent,
    variableExpensesSpent,

    // Burn rates & Runways
    currentVariableBurnRate,
    historicalDailySpend,
    pacingComparison,
    safeDailySpend,
    runwayDays,

    // Future obligations & projections
    remainingFixedCommitments,
    projectedVariableRemaining,
    projectedRemainingExpenses,
    estimatedMonthEndPosition: projectedMonthEndPosition,

    // Transparency & Quality
    dataQuality,
    confidenceLabel,
    warningMessage,
    assumptions,

    // Backward-compatibility aliases
    projectedMonthEndBalance: projectedMonthEndPosition,
    dailyVariableBurnRate: currentVariableBurnRate
  };
}

/**
 * Purchase Affordability Simulator Decision Function
 */
export function simulatePurchaseAffordability({
  cost = 0,
  category = 'General & Miscellaneous',
  nature = 'want',
  currentBalance = 0,
  projectedMonthEnd = 0,
  categoryBudgetCap = 0,
  categorySpent = 0,
  monthlySavingsTarget = 0
}) {
  const purchaseCost = Math.max(0, Number(cost) || 0);
  const postPurchaseCash = roundINR(currentBalance - purchaseCost);
  const postPurchaseForecast = roundINR(projectedMonthEnd - purchaseCost);
  const newCategorySpent = roundINR(categorySpent + purchaseCost);
  const categoryHeadroom = roundINR(categoryBudgetCap - categorySpent);
  const categoryDeficit = roundINR(Math.max(0, newCategorySpent - categoryBudgetCap));

  let tier = 'COMFORTABLE'; // 'COMFORTABLE' | 'CAUTION' | 'HIGH_RISK'
  let headline = 'Comfortably Affordable';
  let badgeVariant = 'emerald';
  let summary = '';
  let recommendations = [];

  if (purchaseCost > currentBalance || postPurchaseForecast < 0) {
    tier = 'HIGH_RISK';
    headline = 'High Financial Risk — Deficit Projected';
    badgeVariant = 'rose';
    summary = `Making this purchase now will leave an estimated month-end deficit of ₹${postPurchaseForecast < 0 ? Math.abs(postPurchaseForecast).toLocaleString('en-IN') : 0} before the end of the month.`;
    recommendations = [
      'Postpone this purchase until your next salary credit.',
      'Create a dedicated savings goal to accumulate funds over 2–3 months.',
      'Check if a lower-cost alternative fits within your current discretionary allowance.'
    ];
  } else if (
    (categoryBudgetCap > 0 && purchaseCost > categoryHeadroom) ||
    postPurchaseForecast < monthlySavingsTarget
  ) {
    tier = 'CAUTION';
    headline = 'Affordable with Budget Trade-Offs';
    badgeVariant = 'amber';
    summary = `You have sufficient cash on hand, but this purchase will exceed your ${category} budget by ₹${categoryDeficit.toLocaleString('en-IN')} or compress your targeted savings buffer.`;
    recommendations = [
      `Offset this expense by reducing discretionary spending in other categories by ₹${categoryDeficit.toLocaleString('en-IN')}.`,
      'Consider splitting the purchase or delaying by 1–2 weeks.',
      'Confirm that upcoming essential bills for rent and utilities remain protected.'
    ];
  } else {
    tier = 'COMFORTABLE';
    headline = 'Comfortably Affordable';
    badgeVariant = 'emerald';
    summary = `This purchase fits cleanly within your available ${category} budget headroom and leaves your projected month-end cushion and savings targets intact.`;
    recommendations = [
      'Your liquid buffer remains above safe thresholds.',
      'No category re-allocation is required.',
      'Ensure you record the expense promptly after making the payment.'
    ];
  }

  return {
    tier,
    headline,
    badgeVariant,
    summary,
    recommendations,
    purchaseCost,
    postPurchaseCash,
    postPurchaseForecast,
    categoryHeadroom,
    categoryDeficit,
    newCategorySpent
  };
}
