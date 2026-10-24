/**
 * SpendSense — Financial Calculations & Analysis Engine
 *
 * MATHEMATICAL DEFINITIONS & CONVENTIONS:
 * 1. Storage Sign:
 *    All transaction amounts are strictly positive numbers.
 * 2. Refunds:
 *    - Inflow refunds are recorded as type: 'income' (or nature: 'refund').
 *    - Offsets reduce outflow totals or increase net liquid cash.
 * 3. Zero-Income Months:
 *    - In months where total income is 0 or expenses exceed income,
 *      the savings rate is mathematically defined as 0% (never NaN or Infinity).
 * 4. Division Safety:
 *    - All division operations are guarded with non-zero denominators.
 */

/**
 * Rounds an INR currency figure safely to 2 decimal places.
 * @param {number} val
 * @returns {number}
 */
export function roundINR(val) {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Filters transactions belonging to a specific month (YYYY-MM).
 * @param {Array} transactions
 * @param {string} month - "YYYY-MM"
 * @returns {Array}
 */
export function filterTransactionsByMonth(transactions, month = '2026-10') {
  if (!Array.isArray(transactions)) return [];
  return transactions.filter((t) => {
    if (!t || !t.date) return false;
    return t.date.startsWith(month);
  });
}

/**
 * Calculates total income for a given transaction list.
 * Safely handles positive amounts and skips malformed records.
 * @param {Array} transactions
 * @returns {number} Total income in INR
 */
export function calculateTotalIncome(transactions) {
  if (!Array.isArray(transactions)) return 0;
  const total = transactions
    .filter((t) => t && t.type === 'income')
    .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);
  return roundINR(total);
}

/**
 * Calculates total expenses for a given transaction list.
 * @param {Array} transactions
 * @returns {number} Total expenses in INR
 */
export function calculateTotalExpenses(transactions) {
  if (!Array.isArray(transactions)) return 0;
  const total = transactions
    .filter((t) => t && t.type === 'expense')
    .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);
  return roundINR(total);
}

/**
 * Calculates net cash flow (Total Inflow - Total Outflow).
 * @param {number} income
 * @param {number} expenses
 * @returns {number} Net balance in INR (can be positive or negative)
 */
export function calculateNetBalance(income, expenses) {
  const inc = roundINR(income);
  const exp = roundINR(expenses);
  return roundINR(inc - exp);
}

/**
 * Calculates savings rate percentage.
 * Safely handles zero income or deficit months by returning 0% (never NaN or Infinity).
 *
 * Formula: ((Income - Expenses) / Income) * 100
 *
 * @param {number} income
 * @param {number} expenses
 * @returns {number} Clamped between 0 and 100
 */
export function calculateSavingsRate(income, expenses) {
  const inc = Number(income) || 0;
  const exp = Number(expenses) || 0;

  // Guard against zero or negative income
  if (inc <= 0) {
    return 0;
  }

  const savings = inc - exp;
  if (savings <= 0) {
    return 0;
  }

  const rate = (savings / inc) * 100;
  return roundINR(Math.min(100, Math.max(0, rate)));
}

/**
 * Aggregates expense spending grouped by category.
 * Calculates exact sums, counts, and percentage of total expenses.
 * Handles zero total expense safely without division by zero.
 *
 * @param {Array} transactions
 * @returns {Array<{ category: string, amount: number, count: number, percentage: number }>}
 */
export function aggregateSpendingByCategory(transactions) {
  if (!Array.isArray(transactions)) return [];
  const expenses = transactions.filter((t) => t && t.type === 'expense');
  const totalExpense = expenses.reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

  const categoryMap = {};
  expenses.forEach((t) => {
    const cat = t.category || 'General & Miscellaneous';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { category: cat, amount: 0, count: 0 };
    }
    categoryMap[cat].amount += Math.abs(Number(t.amount)) || 0;
    categoryMap[cat].count += 1;
  });

  return Object.values(categoryMap)
    .map((item) => ({
      ...item,
      amount: roundINR(item.amount),
      percentage: totalExpense > 0 ? roundINR((item.amount / totalExpense) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Aggregates monthly totals across an entire year (e.g. 2026-01 through 2026-12).
 * Returns monthly breakdown of income, expense, and net cashflow.
 *
 * @param {Array} transactions
 * @param {number|string} [year=2026]
 * @returns {Array<{ month: string, label: string, income: number, expense: number, net: number, count: number }>}
 */
export function aggregateMonthlyTotals(transactions, year = 2026) {
  if (!Array.isArray(transactions)) return [];

  const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const yearStr = String(year);
  const monthlyData = MONTH_NAMES.map((name, index) => {
    const monthNum = String(index + 1).padStart(2, '0');
    const monthKey = `${yearStr}-${monthNum}`;
    return {
      month: monthKey,
      label: `${name} ${yearStr}`,
      income: 0,
      expense: 0,
      net: 0,
      count: 0
    };
  });

  transactions.forEach((t) => {
    if (!t || !t.date || !t.date.startsWith(yearStr)) return;
    const monthPart = t.date.substring(0, 7); // "YYYY-MM"
    const entry = monthlyData.find((m) => m.month === monthPart);
    if (entry) {
      const amt = Math.abs(Number(t.amount)) || 0;
      if (t.type === 'income') entry.income += amt;
      else if (t.type === 'expense') entry.expense += amt;
      entry.count += 1;
    }
  });

  return monthlyData.map((m) => ({
    ...m,
    income: roundINR(m.income),
    expense: roundINR(m.expense),
    net: roundINR(m.income - m.expense)
  }));
}

/**
 * Calculates budget utilization and pacing status with configurable alert thresholds.
 *
 * @param {number} spent - Actual expense amount spent during the period
 * @param {number} budgetLimit - Maximum spending ceiling
 * @param {number} [alertThreshold=0.85] - Warning threshold ratio (e.g. 0.85 for 85%)
 * @returns {{
 *   percent: number,
 *   remaining: number,
 *   exceededBy: number,
 *   status: 'safe' | 'caution' | 'exceeded',
 *   statusLabel: string
 * }}
 */
export function calculateBudgetUtilization(spent, budgetLimit, alertThreshold = 0.85) {
  const limit = Math.max(0, Number(budgetLimit) || 0);
  const totalSpent = Math.max(0, Number(spent) || 0);
  const threshold = typeof alertThreshold === 'number' && alertThreshold > 0 ? alertThreshold : 0.85;

  if (limit <= 0) {
    const isExceeded = totalSpent > 0;
    return {
      percent: 0,
      remaining: 0,
      exceededBy: totalSpent,
      status: isExceeded ? 'exceeded' : 'safe',
      statusLabel: isExceeded ? 'Budget Exceeded' : 'On Track'
    };
  }

  const percent = roundINR((totalSpent / limit) * 100);
  const remaining = roundINR(limit - totalSpent);
  const exceededBy = totalSpent > limit ? roundINR(totalSpent - limit) : 0;

  let status = 'safe';
  let statusLabel = 'On Track';

  if (totalSpent >= limit) {
    status = 'exceeded';
    statusLabel = 'Budget Exceeded';
  } else if (totalSpent >= limit * threshold) {
    status = 'caution';
    statusLabel = `Approaching Limit (${percent}%)`;
  }

  return {
    percent,
    remaining,
    exceededBy,
    status,
    statusLabel
  };
}

/**
 * Calculates savings goal progress and required monthly pacing towards target date.
 *
 * @param {object} goal - Goal object { targetAmount, currentAmount, targetDate, monthlyAllocation }
 * @param {string} [asOfDate='2026-10-24'] - Anchor date
 * @returns {{
 *   percent: number,
 *   remainingAmount: number,
 *   monthsRemaining: number,
 *   requiredMonthlyRate: number,
 *   pacingStatus: 'completed' | 'on_track' | 'lagging' | 'overdue' | 'no_target_date',
 *   statusLabel: string
 * }}
 */
export function calculateGoalPacing(goal, asOfDate = '2026-10-24') {
  if (!goal) {
    return {
      percent: 0,
      remainingAmount: 0,
      monthsRemaining: 0,
      requiredMonthlyRate: 0,
      pacingStatus: 'no_target_date',
      statusLabel: 'Not Set'
    };
  }

  const targetAmount = Math.max(0, Number(goal.targetAmount) || 0);
  const currentAmount = Math.max(0, Number(goal.currentAmount) || 0);
  const monthlyAllocation = Math.max(0, Number(goal.monthlyAllocation) || 0);

  const percent = targetAmount > 0 ? roundINR(Math.min(100, (currentAmount / targetAmount) * 100)) : 0;
  const remainingAmount = Math.max(0, roundINR(targetAmount - currentAmount));

  if (targetAmount > 0 && currentAmount >= targetAmount) {
    return {
      percent: 100,
      remainingAmount: 0,
      monthsRemaining: 0,
      requiredMonthlyRate: 0,
      pacingStatus: 'completed',
      statusLabel: 'Goal Achieved'
    };
  }

  if (!goal.targetDate) {
    return {
      percent,
      remainingAmount,
      monthsRemaining: 0,
      requiredMonthlyRate: 0,
      pacingStatus: 'no_target_date',
      statusLabel: 'No Target Date'
    };
  }

  // Calculate remaining months
  try {
    const from = new Date(asOfDate);
    const to = new Date(goal.targetDate);
    const diffMonths = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + (to.getDate() - from.getDate()) / 30;
    const monthsRemaining = Math.max(0, Math.round(diffMonths * 10) / 10);

    if (monthsRemaining <= 0) {
      return {
        percent,
        remainingAmount,
        monthsRemaining: 0,
        requiredMonthlyRate: remainingAmount,
        pacingStatus: 'overdue',
        statusLabel: 'Target Date Passed'
      };
    }

    const requiredMonthlyRate = roundINR(remainingAmount / Math.max(1, monthsRemaining));
    const isLagging = monthlyAllocation > 0 && monthlyAllocation < requiredMonthlyRate * 0.9;

    return {
      percent,
      remainingAmount,
      monthsRemaining,
      requiredMonthlyRate,
      pacingStatus: isLagging ? 'lagging' : 'on_track',
      statusLabel: isLagging ? 'Behind Pace' : 'On Track'
    };
  } catch {
    return {
      percent,
      remainingAmount,
      monthsRemaining: 0,
      requiredMonthlyRate: 0,
      pacingStatus: 'no_target_date',
      statusLabel: 'Active'
    };
  }
}

/**
 * Backwards compatibility alias for calculateBudgetUtilization
 */
export const calculateBudgetPacing = calculateBudgetUtilization;

/**
 * Aggregates expenses by nature: "need" vs "want" vs "investment".
 * @param {Array} transactions
 * @returns {{ needs: number, wants: number, investments: number, total: number, needsPct: number, wantsPct: number, investmentsPct: number }}
 */
export function aggregateNeedsVsWants(transactions) {
  if (!Array.isArray(transactions)) {
    return { needs: 0, wants: 0, investments: 0, total: 0, needsPct: 0, wantsPct: 0, investmentsPct: 0 };
  }

  const expenses = transactions.filter((t) => t && t.type === 'expense');
  let needs = 0;
  let wants = 0;
  let investments = 0;

  expenses.forEach((t) => {
    const amt = Math.abs(Number(t.amount)) || 0;
    if (t.nature === 'need') needs += amt;
    else if (t.nature === 'investment') investments += amt;
    else wants += amt;
  });

  const total = needs + wants + investments;
  return {
    needs: roundINR(needs),
    wants: roundINR(wants),
    investments: roundINR(investments),
    total: roundINR(total),
    needsPct: total > 0 ? roundINR((needs / total) * 100) : 0,
    wantsPct: total > 0 ? roundINR((wants / total) * 100) : 0,
    investmentsPct: total > 0 ? roundINR((investments / total) * 100) : 0
  };
}

