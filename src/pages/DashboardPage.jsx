import React from 'react';
import { useFinance } from '../hooks/useFinance';
import { useAuth } from '../hooks/useAuth';
import { formatINR, formatDate, formatPercentage } from '../utils/formatters';
import { calculateBudgetPacing } from '../utils/calculations';
import { StatCard } from '../components/common/StatCard';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Sparkles,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const CHART_COLORS = ['#4338ca', '#059669', '#d97706', '#e11d48', '#8b5cf6', '#0284c7'];

export function DashboardPage() {
  const {
    transactions,
    monthTransactions,
    budgets,
    activeMonth,
    alerts = [],
    settings,
    totalIncome,
    totalExpenses,
    netBalance,
    savingsRate,
    categorySpending,
    needsVsWants,
    forecast,
    setCurrentPage,
    openAddTxnModal,
    isSampleMode
  } = useFinance();
  const { user, profile } = useAuth();

  const greetingName = isSampleMode
    ? (settings?.displayName?.trim() || 'Sai')
    : (profile?.full_name?.trim() ||
       user?.user_metadata?.full_name?.trim() ||
       (user?.email ? user.email.split('@')[0] : '') ||
       settings?.displayName?.trim() ||
       'User');

  // Prepare cash flow data for chart (group by day in current active month)
  const chartData = React.useMemo(() => {
    const [yearStr, monthStr] = (activeMonth || '2026-10').split('-');
    const year = parseInt(yearStr, 10) || 2026;
    const month = parseInt(monthStr, 10) || 10;
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthAbbr = monthNames[month - 1] || 'Oct';

    // Find latest day with transaction activity or baseline 24
    let maxDay = 24;
    monthTransactions.forEach((t) => {
      if (t.date && t.date.startsWith(`${yearStr}-${monthStr}`)) {
        const d = parseInt(t.date.split('-')[2], 10);
        if (d > maxDay) maxDay = Math.min(d, daysInMonth);
      }
    });

    const dayMap = {};
    for (let d = 1; d <= maxDay; d++) {
      const dayStr = d < 10 ? `0${d}` : `${d}`;
      const dateKey = `${yearStr}-${monthStr}-${dayStr}`;
      dayMap[dateKey] = { date: `${d} ${monthAbbr}`, income: 0, expense: 0, net: 0 };
    }

    monthTransactions.forEach((t) => {
      if (dayMap[t.date]) {
        if (t.type === 'income') dayMap[t.date].income += Number(t.amount) || 0;
        if (t.type === 'expense') dayMap[t.date].expense += Number(t.amount) || 0;
      }
    });

    let runningBalance = 0;
    return Object.values(dayMap).map((d) => {
      runningBalance += d.income - d.expense;
      return {
        ...d,
        runningBalance: Math.round(runningBalance)
      };
    });
  }, [monthTransactions, activeMonth]);

  // Top 4 categories for Donut chart
  const pieData = React.useMemo(() => {
    if (!categorySpending || categorySpending.length === 0) return [];
    return categorySpending.slice(0, 5).map((c) => ({
      name: c.category,
      value: c.amount
    }));
  }, [categorySpending]);

  // Recent 5 transactions
  const recentTransactions = React.useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 5);
  }, [transactions]);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Greeting Area */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: '4px' }}>
            Welcome back, {greetingName} 👋
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
            October 2026 Financial Overview &mdash; Track daily cash flow, anticipated month-end balance, and category limits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={Sparkles}
            onClick={() => setCurrentPage('simulator')}
          >
            Check Affordability
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Receipt}
            onClick={() => openAddTxnModal()}
          >
            Record Expense
          </Button>
        </div>
      </div>

      {/* Actionable Alerts Banner if alerts exist */}
      {alerts.length > 0 && (
        <div
          className={`alert-card alert-card-${alerts[0].severity}`}
          style={{ padding: 'var(--space-3) var(--space-4)' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle
                size={16}
                style={{
                  color:
                    alerts[0].severity === 'danger'
                      ? 'var(--expense-rose)'
                      : 'var(--warning-amber)'
                }}
              />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {alerts[0].title}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                — {alerts[0].message}
              </span>
            </div>
            <Button
              variant="outline-indigo"
              size="sm"
              onClick={() => setCurrentPage('budgets')}
            >
              <span>Manage Budgets ({alerts.length})</span>
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      )}

      {/* 2. Primary KPI Cards */}
      <div className="grid grid-cols-4">
        <StatCard
          label="Current Liquid Balance"
          value={formatINR(netBalance)}
          subtext="Available net liquidity"
          icon={Wallet}
          variant="indigo"
          badgeText="Active"
          badgeVariant="indigo"
        />
        <StatCard
          label="October Inflows"
          value={formatINR(totalIncome)}
          subtext={`${monthTransactions.filter((t) => t.type === 'income').length} credit entries`}
          icon={ArrowDownLeft}
          variant="emerald"
        />
        <StatCard
          label="October Outflows"
          value={formatINR(totalExpenses)}
          subtext={`${monthTransactions.filter((t) => t.type === 'expense').length} debits recorded`}
          icon={ArrowUpRight}
          variant="rose"
        />
        <StatCard
          label="Savings Rate"
          value={formatPercentage(Math.max(0, savingsRate))}
          subtext={`Needs: ${needsVsWants.needsPct}% | Wants: ${needsVsWants.wantsPct}%`}
          icon={PiggyBank}
          variant="emerald"
        />
      </div>

      {/* 3. Cash Flow Trajectory & Category Breakdown Charts */}
      <div className="grid grid-cols-3">
        {/* Cash Flow Running Balance Area Chart (Spans 2 columns on desktop, 1 on mobile) */}
        <div className="col-span-2-responsive">
          <Card
            title="October Cash Flow Runway"
            subtitle="Running net balance progression through the month"
            action={
              <Badge variant="indigo" icon={TrendingUp}>
                Day 24 of 31
              </Badge>
            }
          >
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                  />
                  <Tooltip
                    formatter={(val) => [formatINR(val), 'Running Balance']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.08)',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="runningBalance"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#balanceGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <span>Initial Inflow: {formatINR(totalIncome)}</span>
              <span>Projected Month-End: <strong>{formatINR(forecast.projectedMonthEndBalance)}</strong></span>
            </div>
          </Card>
        </div>

        {/* Category Spending Breakdown Donut (1 column) */}
        <div>
          <Card
            title="Spending Distribution"
            subtitle="Top categories by outflow"
            action={
              <Badge variant="neutral">
                {categorySpending.length} Categories
              </Badge>
            }
          >
            {pieData.length > 0 ? (
              <div className="flex flex-col items-center">
                <div style={{ width: '100%', height: 170 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
                <div className="flex flex-col gap-1" style={{ width: '100%', marginTop: 'var(--space-2)' }}>
                  {pieData.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)' }}>
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]
                          }}
                        />
                        <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                      </div>
                      <span className="amount-cell" style={{ fontSize: 'var(--text-xs)' }}>
                        {formatINR(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'center', margin: '2rem 0' }}>
                No expense entries recorded yet.
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* 4. Budget Pacing Overview & Recent Transactions Ledger */}
      <div className="grid grid-cols-2">
        {/* Budget Pacing Overview */}
        <Card
          title="Active Category Budgets"
          subtitle="Real-time spend pacing against monthly limits"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage('budgets')}
            >
              <span>Manage All</span>
              <ChevronRight size={14} />
            </Button>
          }
        >
          {budgets.length > 0 ? (
            <div className="flex flex-col gap-4">
              {budgets.slice(0, 4).map((b) => {
                const spent = monthTransactions
                  .filter((t) => t.type === 'expense' && t.category === b.category)
                  .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                const { percent, remaining, status } = calculateBudgetPacing(spent, b.allocatedAmount, b.alertThreshold);

                let fillClass = 'pacing-fill-safe';
                let badgeStatus = <Badge variant="emerald">On Track</Badge>;
                if (status === 'caution') {
                  fillClass = 'pacing-fill-caution';
                  badgeStatus = <Badge variant="amber">Near Cap</Badge>;
                } else if (status === 'exceeded') {
                  fillClass = 'pacing-fill-exceeded';
                  badgeStatus = <Badge variant="rose">Over Budget</Badge>;
                }

                return (
                  <div key={b.id} className="pacing-container">
                    <div className="pacing-header">
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.category}</span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: 'var(--text-muted)' }}>
                          {formatINR(spent)} / {formatINR(b.allocatedAmount)}
                        </span>
                        {badgeStatus}
                      </div>
                    </div>
                    <div className="pacing-bar-bg">
                      <div
                        className={`pacing-bar-fill ${fillClass}`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'center', margin: '2rem 0' }}>
              No category budgets set yet. Click &quot;Manage All&quot; to establish spending limits.
            </p>
          )}
        </Card>

        {/* Recent Transactions List */}
        <Card
          title="Recent Transactions"
          subtitle="Latest debits and credits recorded in your ledger"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage('transactions')}
            >
              <span>View Ledger</span>
              <ChevronRight size={14} />
            </Button>
          }
        >
          {recentTransactions.length > 0 ? (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="fin-table">
                <tbody>
                  {recentTransactions.map((t) => {
                    const isIncome = t.type === 'income';
                    return (
                      <tr key={t.id}>
                        <td style={{ width: '90px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {formatDate(t.date)}
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {t.description}
                            </span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              {t.category} • {t.paymentMethod}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span
                            className={`amount-cell ${isIncome ? 'amount-income' : 'amount-expense'}`}
                          >
                            {isIncome ? `+${formatINR(t.amount)}` : `-${formatINR(t.amount)}`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'center', margin: '2rem 0' }}>
              No transactions recorded yet. Click &quot;Record Expense&quot; to begin.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
