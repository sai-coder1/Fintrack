/**
 * SpendSense — Actionable Alerts & Financial Intelligence Engine
 *
 * DETERMINISTIC RULES:
 * 1. Budget Exceeded:
 *    - Actual category expense spend in target month >= allocated budget cap.
 *    - Severity: danger (Rose)
 *    - Triggers exact data explanation: spent, limit, overage amount, percentage.
 *
 * 2. Budget Approaching Limit:
 *    - Actual category expense spend >= allocatedAmount * (budget.alertThreshold || 0.85)
 *      AND spend < allocatedAmount.
 *    - Severity: warning (Amber)
 *    - Triggers exact data explanation: spent, limit, threshold, remaining headroom.
 *
 * 3. Budget Spending Pace Warning:
 *    - In the current cycle (daysElapsed >= 4), if daily burn rate projects month-end
 *      spend to exceed allocated limit by > 5%, while not yet in approaching/exceeded state.
 *    - Severity: warning (Amber)
 *    - Triggers exact data explanation: burn rate, days elapsed, projected total, projected overage.
 *
 * 4. Savings Goal Pacing:
 *    - If targetDate exists and targetAmount > currentAmount:
 *      * If targetDate is in the past: danger alert (overdue).
 *      * If targetDate is future: required monthly pace = (target - current) / monthsRemaining.
 *        If monthlyAllocation < requiredMonthlyPace * 0.9: warning alert (lagging pace).
 *    - If target reached (currentAmount >= targetAmount): success alert (completed).
 *
 * 5. Deduplication & Non-Fabrication:
 *    - Stable unique IDs per rule + entity.
 *    - Every alert embeds full `triggerData` payload explaining mathematical origin.
 *    - Zero AI hallucination or fabricated notification strings.
 */

import { roundINR } from './calculations.js';
import { formatINR, formatDate } from './formatters.js';

/**
 * Helper to calculate months between two date strings (YYYY-MM-DD or YYYY-MM).
 * @param {string} fromDateStr - e.g. "2026-10-24"
 * @param {string} toDateStr - e.g. "2027-04-30"
 * @returns {number} Float or integer months remaining
 */
export function calculateMonthsRemaining(fromDateStr, toDateStr) {
  if (!fromDateStr || !toDateStr) return 0;
  try {
    const from = new Date(fromDateStr);
    const to = new Date(toDateStr);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return 0;

    const diffYears = to.getFullYear() - from.getFullYear();
    const diffMonths = to.getMonth() - from.getMonth();
    const diffDays = (to.getDate() - from.getDate()) / 30; // fractional month approx

    const totalMonths = diffYears * 12 + diffMonths + diffDays;
    return Math.max(0, Math.round(totalMonths * 10) / 10);
  } catch {
    return 0;
  }
}

/**
 * Generates meaningful, actionable alerts from real calculation models.
 *
 * @param {object} params
 * @param {Array<object>} params.transactions - Full transaction ledger
 * @param {Array<object>} params.budgets - Active category spending budgets
 * @param {Array<object>} params.goals - Active savings goals
 * @param {string} [params.targetMonth='2026-10'] - Month to evaluate (YYYY-MM)
 * @param {string} [params.asOfDate='2026-10-24'] - Simulation anchor date (YYYY-MM-DD)
 * @returns {Array<object>} Actionable alert list sorted by severity
 */
export function generateActionableAlerts({
  transactions = [],
  budgets = [],
  goals = [],
  targetMonth = '2026-10',
  asOfDate = '2026-10-24'
}) {
  const alerts = [];

  // 1. Time Horizon Setup
  const [targetYear, targetMonthNum] = targetMonth.split('-').map((v) => parseInt(v, 10));
  const daysInMonth = new Date(targetYear || 2026, targetMonthNum || 10, 0).getDate();

  let currentDay = 24;
  if (asOfDate && asOfDate.startsWith(targetMonth)) {
    const parts = asOfDate.split('-');
    if (parts.length === 3) {
      currentDay = parseInt(parts[2], 10) || 24;
    }
  }
  const daysElapsed = Math.min(daysInMonth, Math.max(1, currentDay));
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  // 2. Aggregate actual expense spending for the target month
  // STRICT RULE: Do not count income as spending.
  const expenseTransactions = (transactions || []).filter(
    (t) => t && t.type === 'expense' && t.date && t.date.startsWith(targetMonth)
  );

  const spentByCategory = {};
  expenseTransactions.forEach((t) => {
    const cat = t.category || 'General & Miscellaneous';
    spentByCategory[cat] = (spentByCategory[cat] || 0) + (Math.abs(Number(t.amount)) || 0);
  });

  // 3. Evaluate Category Budgets
  (budgets || []).forEach((b) => {
    if (!b || !b.category) return;
    const limit = Math.max(0, Number(b.allocatedAmount) || 0);
    if (limit <= 0) return;

    const spent = roundINR(spentByCategory[b.category] || 0);
    const threshold = typeof b.alertThreshold === 'number' && b.alertThreshold > 0
      ? b.alertThreshold
      : 0.85;
    const thresholdPct = Math.round(threshold * 100);
    const percentUsed = roundINR((spent / limit) * 100);

    // Alert Rule A: Budget Exceeded
    if (spent >= limit) {
      const exceededBy = roundINR(spent - limit);
      alerts.push({
        id: `alert_bgt_exceeded_${b.category}_${targetMonth}`,
        type: 'budget_exceeded',
        severity: 'danger',
        category: b.category,
        title: `${b.category}: Budget Exceeded by ${formatINR(exceededBy)}`,
        message: `You have spent ${formatINR(spent)} (${percentUsed}%) against your monthly limit of ${formatINR(limit)}.`,
        explanation: `Triggered because total actual expenses in ${targetMonth} for ${b.category} (${formatINR(spent)}) exceeded the budgeted ceiling of ${formatINR(limit)} by ${formatINR(exceededBy)}.`,
        triggerData: {
          category: b.category,
          month: targetMonth,
          spent,
          limit,
          exceededBy,
          percentUsed,
          thresholdPct
        },
        action: {
          label: 'Adjust Budget',
          actionType: 'edit_budget',
          budgetId: b.id
        }
      });
      return; // Do not emit multiple alerts for the same budget
    }

    // Alert Rule B: Approaching Warning Threshold
    if (spent >= limit * threshold) {
      const remaining = roundINR(limit - spent);
      alerts.push({
        id: `alert_bgt_approaching_${b.category}_${targetMonth}`,
        type: 'budget_approaching',
        severity: 'warning',
        category: b.category,
        title: `${b.category}: Approaching Budget Limit (${percentUsed}%)`,
        message: `You have used ${percentUsed}% of your budget. Only ${formatINR(remaining)} remains for the rest of the month.`,
        explanation: `Triggered because current spending of ${formatINR(spent)} crossed your configured warning threshold of ${thresholdPct}% (${formatINR(limit * threshold)}) with ${daysRemaining} days left in ${targetMonth}.`,
        triggerData: {
          category: b.category,
          month: targetMonth,
          spent,
          limit,
          remaining,
          percentUsed,
          thresholdPct,
          daysRemaining
        },
        action: {
          label: 'Review Expenses',
          actionType: 'view_transactions',
          category: b.category
        }
      });
      return;
    }

    // Alert Rule C: Spending Pace Warning
    // If not yet at threshold, but current daily pace projects overspending by > 5%
    if (daysElapsed >= 4 && spent > 0) {
      const dailyBurnRate = roundINR(spent / daysElapsed);
      const projectedMonthEndSpend = roundINR(dailyBurnRate * daysInMonth);

      if (projectedMonthEndSpend > limit * 1.05) {
        const projectedOverage = roundINR(projectedMonthEndSpend - limit);
        alerts.push({
          id: `alert_bgt_pace_${b.category}_${targetMonth}`,
          type: 'budget_pacing',
          severity: 'warning',
          category: b.category,
          title: `${b.category}: Spending Pace May Exceed Budget`,
          message: `At ${formatINR(dailyBurnRate)}/day through Day ${daysElapsed}, you are on pace to spend ${formatINR(projectedMonthEndSpend)} by month-end (+${formatINR(projectedOverage)} over limit).`,
          explanation: `Triggered because average daily burn rate (${formatINR(dailyBurnRate)}/day over ${daysElapsed} days) projected over ${daysInMonth} days yields ${formatINR(projectedMonthEndSpend)}, surpassing the ${formatINR(limit)} limit.`,
          triggerData: {
            category: b.category,
            month: targetMonth,
            spent,
            limit,
            dailyBurnRate,
            daysElapsed,
            daysInMonth,
            projectedMonthEndSpend,
            projectedOverage
          },
          action: {
            label: 'Review Category',
            actionType: 'view_transactions',
            category: b.category
          }
        });
      }
    }
  });

  // 4. Evaluate Savings Goals
  (goals || []).forEach((g) => {
    if (!g || !g.title) return;
    const targetAmt = Math.max(0, Number(g.targetAmount) || 0);
    const currentAmt = Math.max(0, Number(g.currentAmount) || 0);
    const monthlyAlloc = Math.max(0, Number(g.monthlyAllocation) || 0);

    if (targetAmt <= 0) return;

    // Goal Completed Alert
    if (currentAmt >= targetAmt) {
      alerts.push({
        id: `alert_goal_achieved_${g.id}`,
        type: 'goal_achieved',
        severity: 'success',
        goalId: g.id,
        title: `Goal Achieved: ${g.title}!`,
        message: `Congratulations! You have reached 100% of your target with ${formatINR(currentAmt)} saved.`,
        explanation: `Triggered because current accumulated savings of ${formatINR(currentAmt)} meets or exceeds the target amount of ${formatINR(targetAmt)}.`,
        triggerData: {
          goalId: g.id,
          title: g.title,
          currentAmount: currentAmt,
          targetAmount: targetAmt,
          percent: 100
        },
        action: {
          label: 'View Goal',
          actionType: 'view_goals'
        }
      });
      return;
    }

    const remainingToSave = roundINR(targetAmt - currentAmt);

    // Goal with Target Date
    if (g.targetDate) {
      const monthsRem = calculateMonthsRemaining(asOfDate, g.targetDate);

      // Past target date
      if (monthsRem <= 0) {
        alerts.push({
          id: `alert_goal_overdue_${g.id}`,
          type: 'goal_overdue',
          severity: 'danger',
          goalId: g.id,
          title: `${g.title}: Target Date Passed`,
          message: `The target completion date (${formatDate(g.targetDate)}) has arrived with ${formatINR(remainingToSave)} still needed.`,
          explanation: `Triggered because target date ${g.targetDate} is on or before ${asOfDate}, and saved amount (${formatINR(currentAmt)}) is short of the ${formatINR(targetAmt)} target by ${formatINR(remainingToSave)}.`,
          triggerData: {
            goalId: g.id,
            title: g.title,
            currentAmount: currentAmt,
            targetAmount: targetAmt,
            remainingToSave,
            targetDate: g.targetDate,
            asOfDate
          },
          action: {
            label: 'Add Funds',
            actionType: 'contribute_goal',
            goalId: g.id
          }
        });
        return;
      }

      // Future target date: Check pacing
      const requiredMonthlyRate = roundINR(remainingToSave / Math.max(1, monthsRem));

      // Case 1: Monthly allocation is less than 90% of required run-rate
      if (monthlyAlloc > 0 && monthlyAlloc < requiredMonthlyRate * 0.9) {
        const shortfall = roundINR(requiredMonthlyRate - monthlyAlloc);
        alerts.push({
          id: `alert_goal_slow_${g.id}`,
          type: 'goal_slow_progress',
          severity: 'warning',
          goalId: g.id,
          title: `${g.title}: Savings Pace Below Target`,
          message: `Requires ${formatINR(requiredMonthlyRate)}/mo over the next ${monthsRem} months to reach target, but allocation is ${formatINR(monthlyAlloc)}/mo (shortfall of ${formatINR(shortfall)}/mo).`,
          explanation: `Triggered because scheduled monthly allocation (${formatINR(monthlyAlloc)}) is less than required pace (${formatINR(requiredMonthlyRate)}/month = ${formatINR(remainingToSave)} needed / ${monthsRem} months).`,
          triggerData: {
            goalId: g.id,
            title: g.title,
            currentAmount: currentAmt,
            targetAmount: targetAmt,
            remainingToSave,
            targetDate: g.targetDate,
            monthsRemaining: monthsRem,
            requiredMonthlyRate,
            monthlyAllocation: monthlyAlloc,
            shortfall
          },
          action: {
            label: 'Boost Contribution',
            actionType: 'contribute_goal',
            goalId: g.id
          }
        });
      } else if (monthlyAlloc === 0 && monthsRem <= 12) {
        // Case 2: No monthly allocation assigned for a goal with a deadline inside 12 months
        alerts.push({
          id: `alert_goal_no_alloc_${g.id}`,
          type: 'goal_no_allocation',
          severity: 'info',
          goalId: g.id,
          title: `${g.title}: No Monthly Allocation Set`,
          message: `To reach ${formatINR(targetAmt)} by ${formatDate(g.targetDate)} (${monthsRem} months left), consider setting a monthly contribution of ${formatINR(requiredMonthlyRate)}.`,
          explanation: `Triggered because target date is set for ${formatDate(g.targetDate)} with ${formatINR(remainingToSave)} needed, but no monthly contribution schedule has been assigned.`,
          triggerData: {
            goalId: g.id,
            title: g.title,
            currentAmount: currentAmt,
            targetAmount: targetAmt,
            remainingToSave,
            targetDate: g.targetDate,
            monthsRemaining: monthsRem,
            requiredMonthlyRate
          },
          action: {
            label: 'Set Contribution',
            actionType: 'edit_goal',
            goalId: g.id
          }
        });
      }
    }
  });

  // 5. Deterministic Severity Sorting: Danger -> Warning -> Info -> Success
  const severityRank = { danger: 1, warning: 2, info: 3, success: 4 };
  alerts.sort((a, b) => (severityRank[a.severity] || 5) - (severityRank[b.severity] || 5));

  return alerts;
}
