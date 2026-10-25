import React, { useState, useMemo, useEffect } from 'react';
import { useFinance } from '../hooks/useFinance';
import { formatINR, formatPercentage } from '../utils/formatters';
import {
  filterTransactionsByMonth,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetBalance,
  calculateSavingsRate,
  aggregateSpendingByCategory,
  aggregateNeedsVsWants,
  aggregateMonthlyTotals,
  roundINR
} from '../utils/calculations.js';
import { calculateMonthEndForecast } from '../utils/forecasting.js';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Flame,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  ShieldCheck,
  Plus
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';

const CATEGORY_COLORS = [
  '#4338ca', // Primary Indigo
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48', // Rose
  '#8b5cf6', // Violet
  '#0284c7', // Sky blue
  '#ec4899', // Pink
  '#64748b'  // Slate
];

/**
 * Route-level Error Boundary to ensure unexpected render failures never produce a blank screen.
 */
class AnalyticsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AnalyticsPage caught runtime error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', margin: '2rem 0' }}>
          <AlertTriangle size={36} style={{ color: 'var(--rose-600)', margin: '0 auto var(--space-3)' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            Unable to Display Financial Analytics
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AnalyticsPage() {
  return (
    <AnalyticsErrorBoundary>
      <AnalyticsContent />
    </AnalyticsErrorBoundary>
  );
}

function AnalyticsContent() {
  const {
    transactions = [],
    budgets = [],
    activeMonth: defaultMonth,
    setCurrentPage,
    openAddTxnModal,
    cloudTxnLoading,
    cloudTxnError,
    refetchCloudTransactions
  } = useFinance();

  // Extract distinct available months from all transactions
  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    (transactions || []).forEach((t) => {
      if (t && t.date && t.date.length >= 7) {
        monthsSet.add(t.date.substring(0, 7));
      }
    });
    const sorted = Array.from(monthsSet).sort().reverse();
    return sorted.length > 0 ? sorted : [defaultMonth || '2026-10'];
  }, [transactions, defaultMonth]);

  // Selected Filter Month: default to activeMonth or first available
  const [selectedMonth, setSelectedMonth] = useState(() => availableMonths[0] || '2026-10');

  // Synchronize selectedMonth when availableMonths list changes (e.g. cloud sync completes)
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Multi-month comparison selector (secondary month to compare against)
  const previousMonthOption = useMemo(() => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx >= 0 && idx + 1 < availableMonths.length) {
      return availableMonths[idx + 1];
    }
    return availableMonths.find((m) => m !== selectedMonth) || null;
  }, [availableMonths, selectedMonth]);

  // Filtered transactions for the selected month
  const activeMonthTxns = useMemo(
    () => filterTransactionsByMonth(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  // Financial Metrics for the selected month
  const monthIncome = useMemo(() => calculateTotalIncome(activeMonthTxns), [activeMonthTxns]);
  const monthExpenses = useMemo(() => calculateTotalExpenses(activeMonthTxns), [activeMonthTxns]);
  const monthNet = useMemo(() => calculateNetBalance(monthIncome, monthExpenses), [monthIncome, monthExpenses]);
  const monthSavingsRate = useMemo(() => calculateSavingsRate(monthIncome, monthExpenses), [monthIncome, monthExpenses]);

  // Category breakdown for selected month
  const categoryBreakdown = useMemo(
    () => aggregateSpendingByCategory(activeMonthTxns),
    [activeMonthTxns]
  );

  // Needs vs Wants for selected month
  const needsVsWants = useMemo(
    () => aggregateNeedsVsWants(activeMonthTxns),
    [activeMonthTxns]
  );

  // Month-end forecast for selected month
  const forecast = useMemo(() => {
    const target = selectedMonth || defaultMonth || '2026-10';
    return calculateMonthEndForecast({
      transactions,
      budgets,
      targetMonth: target,
      asOfDate: `${target}-24`
    });
  }, [transactions, budgets, selectedMonth, defaultMonth]);

  // Multi-Month Trends (Income vs Expenses vs Net across all distinct months)
  const monthlyTrendsData = useMemo(() => {
    // Generate chronological order from available months
    const sortedChronological = [...availableMonths].sort();
    return sortedChronological.map((mKey) => {
      const txns = filterTransactionsByMonth(transactions, mKey);
      const inc = calculateTotalIncome(txns);
      const exp = calculateTotalExpenses(txns);
      const net = calculateNetBalance(inc, exp);
      const rate = calculateSavingsRate(inc, exp);

      // Human-readable label (e.g. "Oct 2026")
      const safeKey = mKey && typeof mKey === 'string' && mKey.includes('-') ? mKey : '2026-10';
      const [y, m] = safeKey.split('-');
      const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      const label = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
        : safeKey;

      return {
        monthKey: mKey,
        label,
        income: inc,
        expenses: exp,
        netBalance: net,
        savingsRate: rate
      };
    });
  }, [transactions, availableMonths]);

  // Multi-Month Category Comparison Data (Selected Month vs Previous Month)
  const categoryComparisonData = useMemo(() => {
    if (!previousMonthOption) return [];

    const prevMonthTxns = filterTransactionsByMonth(transactions, previousMonthOption);
    const prevCatSpending = aggregateSpendingByCategory(prevMonthTxns);
    const prevCatMap = new Map(prevCatSpending.map((c) => [c.category, c.amount]));

    // Top categories from current month
    return (categoryBreakdown || []).slice(0, 5).map((c) => {
      const prevAmt = prevCatMap.get(c.category) || 0;
      const diff = roundINR(c.amount - prevAmt);
      const pctDiff = prevAmt > 0 ? roundINR((diff / prevAmt) * 100) : null;

      return {
        category: c.category && c.category.length > 16 ? `${c.category.slice(0, 14)}...` : (c.category || 'Other'),
        fullName: c.category || 'Other',
        currentMonthAmount: c.amount || 0,
        previousMonthAmount: prevAmt,
        difference: diff,
        percentDifference: pctDiff
      };
    });
  }, [categoryBreakdown, transactions, previousMonthOption]);

  // Notable Changes insights derived strictly from data
  const notableInsights = useMemo(() => {
    const list = [];

    // Largest category
    if (categoryBreakdown && categoryBreakdown.length > 0) {
      const topCat = categoryBreakdown[0];
      list.push({
        type: 'info',
        text: `Largest expense category in ${selectedMonth} is "${topCat.category}" at ${formatINR(topCat.amount)} (${topCat.percentage}% of all monthly outlays).`
      });
    }

    // Month-over-month notable changes
    if (previousMonthOption && categoryComparisonData.length > 0) {
      const biggestMoMChange = [...categoryComparisonData]
        .filter((c) => c && c.previousMonthAmount > 0)
        .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))[0];

      if (biggestMoMChange) {
        const isUp = biggestMoMChange.difference > 0;
        const pctDiff = biggestMoMChange.percentDifference;
        const pctText = pctDiff !== null && !isNaN(pctDiff)
          ? ` (${Math.abs(pctDiff)}%)`
          : '';
        list.push({
          type: isUp ? 'warning' : 'success',
          text: `Spending in "${biggestMoMChange.fullName}" ${isUp ? 'increased' : 'decreased'} by ${formatINR(Math.abs(biggestMoMChange.difference))}${pctText} compared to ${previousMonthOption}.`
        });
      }
    } else {
      list.push({
        type: 'neutral',
        text: 'Month-over-month comparisons will activate automatically when statement records from two or more months exist.'
      });
    }

    // Savings rate status
    if (monthIncome > 0) {
      if (monthSavingsRate >= 20) {
        list.push({
          type: 'success',
          text: `Your savings rate of ${monthSavingsRate}% meets the recommended financial benchmark (>= 20%).`
        });
      } else {
        list.push({
          type: 'warning',
          text: `Your savings rate is ${monthSavingsRate}%, below the 20% target. Discretionary wants accounted for ${needsVsWants.wantsPct}% of expenditures.`
        });
      }
    }

    return list;
  }, [categoryBreakdown, categoryComparisonData, selectedMonth, previousMonthOption, monthIncome, monthSavingsRate, needsVsWants]);

  // Loading state while initially fetching cloud data for authenticated user
  if (cloudTxnLoading && (!transactions || transactions.length === 0)) {
    return (
      <div className="flex flex-col gap-6">
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', margin: '2rem 0' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid var(--border-subtle)',
              borderTopColor: 'var(--primary-indigo)',
              borderRadius: '50%',
              margin: '0 auto var(--space-4)',
              animation: 'spin 1s linear infinite'
            }}
          />
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Loading Financial Analytics...
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)', marginBottom: 0 }}>
            Fetching transaction history and computing cashflow projections.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header with Active Month Filter */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: '4px' }}>
            Financial Analytics &amp; Trajectory
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Auditable cashflow trends, spending distribution, and transparent month-end projections.
          </p>
        </div>

        {/* Working Month Selector */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
            Analysis Month:
          </span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.45rem 0.85rem', fontSize: 'var(--text-xs)', fontWeight: 600 }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label="Select month for analytics"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cloud Sync Error Alert Banner (if Supabase query fails) */}
      {cloudTxnError && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--rose-50)',
            color: 'var(--rose-700)',
            border: '1px solid var(--rose-200)',
            fontSize: 'var(--text-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)'
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>
              Unable to sync cloud transaction records: {cloudTxnError?.message || String(cloudTxnError)}.
            </span>
          </div>
          {refetchCloudTransactions && (
            <button
              className="btn btn-outline"
              style={{
                padding: '0.25rem 0.65rem',
                fontSize: 'var(--text-xs)',
                borderColor: 'var(--rose-300)',
                color: 'var(--rose-700)'
              }}
              onClick={() => refetchCloudTransactions()}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Empty Ledger Notice */}
      {(!transactions || transactions.length === 0) && (
        <div
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)'
          }}
        >
          <div className="flex items-center gap-3">
            <Info size={20} style={{ color: 'var(--primary-indigo)', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                No transaction records found
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Import a bank statement or record your first transaction to unlock live spending trends and month-end projections.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {setCurrentPage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage('import')}
              >
                Import Statement
              </Button>
            )}
            {openAddTxnModal && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={openAddTxnModal}
              >
                Add Transaction
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 2. Primary Financial Position KPI Cards */}
      <div className="grid grid-cols-4">
        <StatCard
          label={`Actual Inflows (${selectedMonth})`}
          value={formatINR(monthIncome)}
          subtext="Total confirmed income credits"
          icon={ArrowDownLeft}
          variant="emerald"
        />
        <StatCard
          label={`Actual Outflows (${selectedMonth})`}
          value={formatINR(monthExpenses)}
          subtext="Total confirmed debits"
          icon={ArrowUpRight}
          variant="rose"
        />
        <StatCard
          label="Net Cash Position"
          value={formatINR(monthNet)}
          subtext={monthNet >= 0 ? 'Surplus retained liquidity' : 'Net monthly cash deficit'}
          icon={TrendingUp}
          variant={monthNet >= 0 ? 'emerald' : 'rose'}
        />
        <StatCard
          label="Savings Rate to Date"
          value={formatPercentage(monthSavingsRate)}
          subtext={`Needs: ${needsVsWants.needsPct}% | Wants: ${needsVsWants.wantsPct}%`}
          icon={PiggyBank}
          variant={monthSavingsRate >= 20 ? 'emerald' : 'amber'}
        />
      </div>

      {/* 3. Transparent Month-End Forecast Section */}
      <div className="card" style={{ padding: 'var(--space-6)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 'var(--space-4)' }}>
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>
                Transparent Month-End Forecast ({selectedMonth})
              </h3>
              <Badge
                variant={
                  forecast.dataQuality === 'high'
                    ? 'emerald'
                    : forecast.dataQuality === 'moderate'
                    ? 'indigo'
                    : forecast.dataQuality === 'low'
                    ? 'amber'
                    : 'rose'
                }
              >
                {forecast.confidenceLabel}
              </Badge>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
              Deterministic projection separating fixed commitments from daily variable run-rate.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Anchor:</span>
            <Badge variant="neutral">
              Day {forecast.daysElapsed} of {forecast.daysInMonth} ({forecast.daysRemaining} days remaining)
            </Badge>
          </div>
        </div>

        {/* Forecast Warning Banner if Deficit or Sparse Data */}
        {forecast.warningMessage && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: forecast.estimatedMonthEndPosition < 0 ? 'var(--rose-50)' : 'var(--amber-50)',
              color: forecast.estimatedMonthEndPosition < 0 ? 'var(--rose-700)' : 'var(--amber-700)',
              border: `1px solid ${forecast.estimatedMonthEndPosition < 0 ? 'var(--rose-200)' : 'var(--amber-200)'}`,
              fontSize: 'var(--text-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-5)'
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{forecast.warningMessage}</span>
          </div>
        )}

        {/* 4 Forecast Comparison Metrics */}
        <div className="grid grid-cols-4" style={{ gap: 'var(--space-4)' }}>
          {/* Metric 1: Actual Position to Date */}
          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              1. Actual Position to Date
            </span>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatINR(forecast.actualPositionToDate)}
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Income ({formatINR(forecast.actualIncomeToDate)}) - Spent ({formatINR(forecast.actualExpensesToDate)})
            </span>
          </div>

          {/* Metric 2: Variable Daily Burn */}
          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              2. Variable Daily Run-Rate
            </span>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatINR(forecast.currentVariableBurnRate)} / day
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {forecast.pacingComparison
                ? `${forecast.pacingComparison.isHigher ? '+' : ''}${forecast.pacingComparison.percentDifference}% vs historical pace (₹${forecast.pacingComparison.historicalDailySpend}/d)`
                : `Computed across ${forecast.daysElapsed} elapsed days`}
            </span>
          </div>

          {/* Metric 3: Projected Remaining Outflows */}
          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              3. Projected Remaining Outflows
            </span>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--rose-600)' }}>
              -{formatINR(forecast.projectedRemainingExpenses)}
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Fixed Bills ({formatINR(forecast.remainingFixedCommitments)}) + Variable ({formatINR(forecast.projectedVariableRemaining)})
            </span>
          </div>

          {/* Metric 4: Estimated Month-End Position */}
          <div
            className="card"
            style={{
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              backgroundColor: forecast.estimatedMonthEndPosition >= 0 ? 'var(--soft-emerald-bg)' : 'var(--soft-rose-bg)',
              borderColor: forecast.estimatedMonthEndPosition >= 0 ? 'var(--emerald-200)' : 'var(--rose-200)'
            }}
          >
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: forecast.estimatedMonthEndPosition >= 0 ? 'var(--emerald-900)' : 'var(--rose-900)' }}>
              4. Estimated Month-End Position
            </span>
            <div
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 800,
                color: forecast.estimatedMonthEndPosition >= 0 ? 'var(--emerald-600)' : 'var(--expense-rose)'
              }}
            >
              {formatINR(forecast.estimatedMonthEndPosition)}
            </div>
            <span style={{ fontSize: '0.6875rem', color: forecast.estimatedMonthEndPosition >= 0 ? 'var(--emerald-700)' : 'var(--rose-700)' }}>
              Safe discretionary allowance: <strong>{formatINR(forecast.safeDailySpend)}/day</strong>
            </span>
          </div>
        </div>

        {/* Calculation Assumptions Explanation Box */}
        <div
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div className="flex items-center gap-2" style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            <Info size={14} style={{ color: 'var(--primary-indigo)' }} />
            <span>Methodology &amp; Transparent Assumptions:</span>
          </div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: 0, paddingLeft: 'var(--space-4)' }}>
            {forecast.assumptions.map((item, idx) => (
              <li key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 4. Chart Row 1: Income vs. Expenses Over Time & Monthly Net Cash Flow */}
      <div className="grid grid-cols-2">
        {/* Income vs Expenses Over Time */}
        <Card
          title="Income vs. Expenses Over Time"
          subtitle="Multi-month comparison of total confirmed inflows and outflows"
        >
          <div style={{ width: '100%', height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendsData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                />
                <Tooltip
                  formatter={(val, name) => [formatINR(val), name === 'income' ? 'Income' : 'Expenses']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                />
                <Bar name="Income" dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar name="Expenses" dataKey="expenses" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly Net Cash Flow */}
        <Card
          title="Monthly Net Cash Flow"
          subtitle="Net retained liquidity (surplus or deficit) across months"
        >
          <div style={{ width: '100%', height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendsData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                />
                <Tooltip
                  formatter={(val) => [formatINR(val), 'Net Cash Flow']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <ReferenceLine y={0} stroke="#cbd5e1" />
                <Bar
                  dataKey="netBalance"
                  name="Net Cash Flow"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                >
                  {monthlyTrendsData.map((entry, index) => (
                    <Cell
                      key={`cell-net-${index}`}
                      fill={entry.netBalance >= 0 ? '#059669' : '#e11d48'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* 5. Chart Row 2: Category Spending Breakdown & Multi-Month Category Comparison */}
      <div className="grid grid-cols-2">
        {/* Spending Breakdown by Category */}
        <Card
          title={`Category Spending Share (${selectedMonth})`}
          subtitle="Percentage distribution across spending buckets"
          action={
            <Badge variant="indigo">{categoryBreakdown.length} Categories</Badge>
          }
        >
          {categoryBreakdown.length > 0 ? (
            <div className="flex flex-col items-center">
              <div style={{ width: '100%', height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown.slice(0, 6)}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {categoryBreakdown.slice(0, 6).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => formatINR(val)}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2" style={{ width: '100%', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {categoryBreakdown.slice(0, 6).map((item, idx) => (
                  <div key={item.category} className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)' }}>
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
                        }}
                      />
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {item.category.length > 18 ? `${item.category.slice(0, 16)}...` : item.category}
                      </span>
                    </div>
                    <span className="amount-cell" style={{ fontSize: 'var(--text-xs)' }}>
                      {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'center', margin: '3rem 0' }}>
              No expenses recorded for {selectedMonth}.
            </p>
          )}
        </Card>

        {/* Category-Level Comparison Across Available Months */}
        <Card
          title="Category Comparisons Across Months"
          subtitle={
            previousMonthOption
              ? `Comparing top categories: ${selectedMonth} vs. ${previousMonthOption}`
              : 'Multi-month category comparison'
          }
        >
          {categoryComparisonData.length > 0 ? (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryComparisonData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                  />
                  <Tooltip
                    formatter={(val, name) => [
                      formatINR(val),
                      name === 'currentMonthAmount' ? selectedMonth : previousMonthOption
                    ]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                  />
                  <Bar
                    name={`${selectedMonth} (Current)`}
                    dataKey="currentMonthAmount"
                    fill="#4338ca"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />
                  <Bar
                    name={`${previousMonthOption} (Previous)`}
                    dataKey="previousMonthAmount"
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="placeholder-card" style={{ border: 'none', margin: '2rem auto' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
                Category-level comparative trends require statements from at least two distinct months. Import a prior statement to activate this chart.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* 6. Savings Rate Trend & Notable Changes Section */}
      <div className="grid grid-cols-2">
        {/* Savings Rate Trends Over Available Months */}
        <Card
          title="Savings Rate Trajectory (%)"
          subtitle="Historical savings efficiency compared against the 20% healthy benchmark"
        >
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendsData} margin={{ top: 15, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Savings Rate']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <ReferenceLine
                  y={20}
                  stroke="#d97706"
                  strokeDasharray="4 4"
                  label={{ value: '20% Target', position: 'top', fill: '#d97706', fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="savingsRate"
                  name="Savings Rate"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#059669' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Notable Changes & Data-Driven Insights */}
        <Card
          title="Data-Supported Spending Insights"
          subtitle="Observed patterns and material changes derived from verified ledger data"
        >
          <div className="flex flex-col gap-3">
            {notableInsights.map((insight, idx) => {
              let badgeVariant = 'neutral';
              let Icon = Info;
              if (insight.type === 'success') {
                badgeVariant = 'emerald';
                Icon = CheckCircle2;
              } else if (insight.type === 'warning') {
                badgeVariant = 'amber';
                Icon = AlertTriangle;
              }

              return (
                <div
                  key={idx}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor:
                      insight.type === 'success'
                        ? 'var(--emerald-50)'
                        : insight.type === 'warning'
                        ? 'var(--amber-50)'
                        : 'var(--bg-subtle)',
                    border: `1px solid ${
                      insight.type === 'success'
                        ? 'var(--emerald-200)'
                        : insight.type === 'warning'
                        ? 'var(--amber-200)'
                        : 'var(--border-subtle)'
                    }`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)'
                  }}
                >
                  <Icon
                    size={16}
                    style={{
                      flexShrink: 0,
                      marginTop: 2,
                      color:
                        insight.type === 'success'
                          ? 'var(--emerald-600)'
                          : insight.type === 'warning'
                          ? 'var(--amber-600)'
                          : 'var(--primary-indigo)'
                    }}
                  />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {insight.text}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
