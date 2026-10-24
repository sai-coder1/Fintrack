import React, { useState, useMemo } from 'react';
import { useFinance } from '../hooks/useFinance';
import { formatINR, formatDate, formatPercentage } from '../utils/formatters';
import { calculateBudgetUtilization, calculateGoalPacing } from '../utils/calculations';
import { DEFAULT_CATEGORIES } from '../data/defaultCategories';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  PiggyBank,
  Target,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Coins,
  Sparkles,
  ArrowDownLeft,
  Clock,
  HelpCircle
} from 'lucide-react';

const AVAILABLE_MONTHS = [
  { value: '2026-10', label: 'October 2026 (Active)' },
  { value: '2026-09', label: 'September 2026' },
  { value: '2026-08', label: 'August 2026' },
  { value: '2026-11', label: 'November 2026' },
  { value: '2026-12', label: 'December 2026' }
];

export function BudgetsGoalsPage() {
  const {
    budgets,
    goals,
    transactions,
    activeMonth,
    setActiveMonth,
    addBudget,
    updateBudget,
    deleteBudget,
    addGoal,
    updateGoal,
    deleteGoal,
    contributeToGoal,
    alerts = [],
    setCurrentPage
  } = useFinance();

  // 0. Dynamic Month Options merged with preset months
  const allAvailableMonths = useMemo(() => {
    const map = new Map();
    AVAILABLE_MONTHS.forEach((m) => map.set(m.value, m.label));
    (transactions || []).forEach((t) => {
      if (t?.date && t.date.length >= 7) {
        const mKey = t.date.substring(0, 7);
        if (!map.has(mKey)) {
          const [y, m] = mKey.split('-');
          const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
          const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
          map.set(mKey, label);
        }
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [transactions]);

  // 1. Alert Panel Filtering & Expansion State
  const [alertFilter, setAlertFilter] = useState('all'); // 'all' | 'danger' | 'warning' | 'goals'
  const [expandedAlerts, setExpandedAlerts] = useState({});

  const toggleAlertExpand = (alertId) => {
    setExpandedAlerts((prev) => ({
      ...prev,
      [alertId]: !prev[alertId]
    }));
  };

  const filteredAlerts = useMemo(() => {
    if (alertFilter === 'danger') {
      return alerts.filter((a) => a.severity === 'danger');
    }
    if (alertFilter === 'warning') {
      return alerts.filter((a) => a.severity === 'warning');
    }
    if (alertFilter === 'goals') {
      return alerts.filter((a) => a.type.startsWith('goal_'));
    }
    return alerts;
  }, [alerts, alertFilter]);

  // 2. Budget Modal State
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetForm, setBudgetForm] = useState({
    category: 'Groceries & Household',
    allocatedAmount: '',
    month: activeMonth,
    alertThreshold: 0.85
  });

  // 3. Goal Modal State
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalForm, setGoalForm] = useState({
    title: '',
    targetAmount: '',
    currentAmount: '',
    monthlyAllocation: '',
    targetDate: '2027-04-30',
    hasTargetDate: true,
    color: '#4338ca',
    notes: ''
  });

  // 4. Quick Contribution Modal State
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [selectedGoalForContribution, setSelectedGoalForContribution] = useState(null);
  const [contributionMode, setContributionMode] = useState('add'); // 'add' | 'withdraw'
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionError, setContributionError] = useState('');

  // 5. Calculate Actual Expense Spending for the selected month
  // STRICT RULE: Actual expense transactions only. Do NOT count income as spending.
  const currentMonthExpenses = useMemo(() => {
    return (transactions || []).filter(
      (t) => t && t.type === 'expense' && t.date && t.date.startsWith(activeMonth)
    );
  }, [transactions, activeMonth]);

  const spentByCategory = useMemo(() => {
    const map = {};
    currentMonthExpenses.forEach((t) => {
      const cat = t.category || 'General & Miscellaneous';
      map[cat] = (map[cat] || 0) + (Math.abs(Number(t.amount)) || 0);
    });
    return map;
  }, [currentMonthExpenses]);

  // 6. Time Horizon Calculations for Pacing
  const [targetYear, targetMonthNum] = activeMonth.split('-').map((v) => parseInt(v, 10));
  const daysInMonth = new Date(targetYear || 2026, targetMonthNum || 10, 0).getDate();
  const daysElapsed = Math.min(daysInMonth, 24); // Anchor day 24 for Oct 2026

  // 7. Overall Budget Aggregates for Selected Month
  const totalAllocated = budgets.reduce((sum, b) => sum + (Number(b.allocatedAmount) || 0), 0);
  const totalSpentInBudgeted = budgets.reduce(
    (sum, b) => sum + (spentByCategory[b.category] || 0),
    0
  );
  const overallPacing = totalAllocated > 0 ? (totalSpentInBudgeted / totalAllocated) * 100 : 0;
  const totalGoalTargets = goals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
  const totalGoalAccumulated = goals.reduce((sum, g) => sum + (Number(g.currentAmount) || 0), 0);

  // Handlers for Budget CRUD
  const openBudgetModal = (b = null) => {
    if (b) {
      setEditingBudget(b);
      setBudgetForm({
        category: b.category,
        allocatedAmount: String(b.allocatedAmount),
        month: b.month || activeMonth,
        alertThreshold: typeof b.alertThreshold === 'number' ? b.alertThreshold : 0.85
      });
    } else {
      setEditingBudget(null);
      setBudgetForm({
        category: 'Groceries & Household',
        allocatedAmount: '',
        month: activeMonth,
        alertThreshold: 0.85
      });
    }
    setIsBudgetModalOpen(true);
  };

  const handleBudgetSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(budgetForm.allocatedAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid spending limit greater than zero.');
      return;
    }

    if (editingBudget && editingBudget.id) {
      updateBudget(editingBudget.id, {
        category: budgetForm.category,
        allocatedAmount: amt,
        month: budgetForm.month || activeMonth,
        alertThreshold: parseFloat(budgetForm.alertThreshold)
      });
    } else {
      addBudget({
        category: budgetForm.category,
        allocatedAmount: amt,
        month: budgetForm.month || activeMonth,
        alertThreshold: parseFloat(budgetForm.alertThreshold)
      });
    }
    setIsBudgetModalOpen(false);
  };

  // Handlers for Goal CRUD
  const openGoalModal = (g = null) => {
    if (g) {
      setEditingGoal(g);
      setGoalForm({
        title: g.title,
        targetAmount: String(g.targetAmount),
        currentAmount: String(g.currentAmount),
        monthlyAllocation: String(g.monthlyAllocation || ''),
        targetDate: g.targetDate || '2027-04-30',
        hasTargetDate: Boolean(g.targetDate),
        color: g.color || '#4338ca',
        notes: g.notes || ''
      });
    } else {
      setEditingGoal(null);
      setGoalForm({
        title: '',
        targetAmount: '',
        currentAmount: '0',
        monthlyAllocation: '',
        targetDate: '2027-04-30',
        hasTargetDate: true,
        color: '#4338ca',
        notes: ''
      });
    }
    setIsGoalModalOpen(true);
  };

  const handleGoalSubmit = (e) => {
    e.preventDefault();
    if (!goalForm.title.trim()) {
      alert('Please enter a valid title for the savings goal.');
      return;
    }
    const targetAmt = parseFloat(goalForm.targetAmount);
    if (isNaN(targetAmt) || targetAmt <= 0) {
      alert('Please enter a valid target amount greater than zero.');
      return;
    }

    const payload = {
      title: goalForm.title.trim(),
      targetAmount: targetAmt,
      currentAmount: Math.max(0, parseFloat(goalForm.currentAmount) || 0),
      monthlyAllocation: Math.max(0, parseFloat(goalForm.monthlyAllocation) || 0),
      targetDate: goalForm.hasTargetDate ? goalForm.targetDate : null,
      color: goalForm.color || '#4338ca',
      notes: goalForm.notes.trim()
    };

    if (editingGoal && editingGoal.id) {
      updateGoal(editingGoal.id, payload);
    } else {
      addGoal(payload);
    }
    setIsGoalModalOpen(false);
  };

  // Handlers for Goal Contributions
  const openContributionModal = (goal) => {
    setSelectedGoalForContribution(goal);
    setContributionMode('add');
    setContributionAmount('');
    setContributionError('');
    setIsContributionModalOpen(true);
  };

  const handleContributionSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(contributionAmount);
    if (isNaN(amt) || amt <= 0) {
      setContributionError('Please enter a contribution amount greater than zero.');
      return;
    }

    if (contributionMode === 'withdraw' && amt > (selectedGoalForContribution.currentAmount || 0)) {
      setContributionError(
        `Cannot withdraw ${formatINR(amt)}. Current balance is ${formatINR(selectedGoalForContribution.currentAmount || 0)}.`
      );
      return;
    }

    const result = contributeToGoal(selectedGoalForContribution.id, amt, contributionMode);
    if (!result.success) {
      setContributionError(result.error || 'Failed to update goal funds.');
      return;
    }

    setIsContributionModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header with Controls & Month Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: '4px' }}>
            Budgets &amp; Savings Goals
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Establish monthly category spending caps, track savings targets, and review real-time alerts.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Active Month Selector */}
          <div className="flex items-center gap-2" style={{ backgroundColor: 'var(--bg-surface)', padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <Calendar size={15} style={{ color: 'var(--primary-indigo)' }} />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>Month:</span>
            <select
              className="form-select"
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              style={{ padding: '3px 8px', fontSize: 'var(--text-xs)', border: 'none', background: 'transparent', fontWeight: 600, cursor: 'pointer' }}
            >
              {allAvailableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={Target}
            onClick={() => openGoalModal()}
          >
            New Savings Goal
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => openBudgetModal()}
          >
            Set Category Budget
          </Button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-4">
        <StatCard
          label="Total Monthly Budget"
          value={formatINR(totalAllocated)}
          subtext={`${budgets.length} Category Caps Set (${activeMonth})`}
          icon={Layers}
          variant="indigo"
        />
        <StatCard
          label="Total Spent in Budgets"
          value={formatINR(totalSpentInBudgeted)}
          subtext={`Remaining Headroom: ${formatINR(Math.max(0, totalAllocated - totalSpentInBudgeted))}`}
          icon={ArrowUpRight}
          variant="rose"
        />
        <StatCard
          label="Overall Budget Pacing"
          value={formatPercentage(overallPacing)}
          subtext={overallPacing <= 100 ? 'Within aggregate ceiling' : 'Exceeding aggregate cap'}
          icon={TrendingUp}
          variant={overallPacing <= 85 ? 'emerald' : overallPacing <= 100 ? 'amber' : 'rose'}
        />
        <StatCard
          label="Total Savings Accumulated"
          value={formatINR(totalGoalAccumulated)}
          subtext={`Towards ${formatINR(totalGoalTargets)} across ${goals.length} goals`}
          icon={PiggyBank}
          variant="indigo"
        />
      </div>

      {/* 3. Actionable Alerts Panel */}
      <Card
        title="Actionable Financial Alerts & Early Warnings"
        subtitle={`Deterministic alerts triggered by actual expense transactions and savings timelines for ${activeMonth}`}
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`quick-chip ${alertFilter === 'all' ? 'active' : ''}`}
              style={{
                backgroundColor: alertFilter === 'all' ? 'var(--primary-indigo)' : 'var(--bg-subtle)',
                color: alertFilter === 'all' ? '#fff' : 'var(--text-secondary)'
              }}
              onClick={() => setAlertFilter('all')}
            >
              All ({alerts.length})
            </button>
            <button
              type="button"
              className="quick-chip"
              style={{
                backgroundColor: alertFilter === 'danger' ? 'var(--expense-rose)' : 'var(--bg-subtle)',
                color: alertFilter === 'danger' ? '#fff' : 'var(--text-secondary)'
              }}
              onClick={() => setAlertFilter('danger')}
            >
              Critical ({alerts.filter((a) => a.severity === 'danger').length})
            </button>
            <button
              type="button"
              className="quick-chip"
              style={{
                backgroundColor: alertFilter === 'warning' ? 'var(--warning-amber)' : 'var(--bg-subtle)',
                color: alertFilter === 'warning' ? '#fff' : 'var(--text-secondary)'
              }}
              onClick={() => setAlertFilter('warning')}
            >
              Warnings ({alerts.filter((a) => a.severity === 'warning').length})
            </button>
            <button
              type="button"
              className="quick-chip"
              style={{
                backgroundColor: alertFilter === 'goals' ? 'var(--interactive-indigo)' : 'var(--bg-subtle)',
                color: alertFilter === 'goals' ? '#fff' : 'var(--text-secondary)'
              }}
              onClick={() => setAlertFilter('goals')}
            >
              Goals ({alerts.filter((a) => a.type.startsWith('goal_')).length})
            </button>
          </div>
        }
      >
        {filteredAlerts.length > 0 ? (
          <div className="alerts-container">
            {filteredAlerts.map((alert) => {
              const isExpanded = Boolean(expandedAlerts[alert.id]);
              let icon = <AlertCircle size={18} style={{ color: 'var(--primary-indigo)' }} />;
              if (alert.severity === 'danger') {
                icon = <ShieldAlert size={18} style={{ color: 'var(--expense-rose)' }} />;
              } else if (alert.severity === 'warning') {
                icon = <AlertTriangle size={18} style={{ color: 'var(--warning-amber)' }} />;
              } else if (alert.severity === 'success') {
                icon = <CheckCircle2 size={18} style={{ color: 'var(--emerald-600)' }} />;
              }

              return (
                <div
                  key={alert.id}
                  className={`alert-card alert-card-${alert.severity}`}
                >
                  <div className="alert-header">
                    <div className="flex items-start gap-3">
                      <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="alert-title">{alert.title}</h4>
                          <Badge
                            variant={
                              alert.severity === 'danger'
                                ? 'rose'
                                : alert.severity === 'warning'
                                ? 'amber'
                                : alert.severity === 'success'
                                ? 'emerald'
                                : 'indigo'
                            }
                          >
                            {alert.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="alert-message">{alert.message}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {alert.action && (
                        <Button
                          variant={alert.severity === 'danger' ? 'danger-outline' : 'outline-indigo'}
                          size="sm"
                          onClick={() => {
                            if (alert.action.actionType === 'contribute_goal') {
                              const targetGoal = goals.find((g) => g.id === alert.goalId);
                              if (targetGoal) openContributionModal(targetGoal);
                            } else if (alert.action.actionType === 'edit_budget') {
                              const targetBudget = budgets.find((b) => b.id === alert.action.budgetId);
                              if (targetBudget) openBudgetModal(targetBudget);
                            } else if (alert.action.actionType === 'view_transactions') {
                              setCurrentPage('transactions');
                            }
                          }}
                        >
                          {alert.action.label}
                        </Button>
                      )}

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon-only"
                        onClick={() => toggleAlertExpand(alert.id)}
                        title="View mathematical trigger calculation"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Mathematical Trigger Evidence */}
                  {isExpanded && (
                    <div className="alert-trigger-box">
                      <div className="flex items-center gap-1" style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                        <HelpCircle size={13} style={{ color: 'var(--primary-indigo)' }} />
                        <span>Data Evidence &amp; Calculation Trigger:</span>
                      </div>
                      <p style={{ margin: '0 0 6px 0' }}>{alert.explanation}</p>
                      <div className="flex items-center gap-4 flex-wrap" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {Object.entries(alert.triggerData || {}).map(([key, value]) => (
                          <div key={key}>
                            <strong style={{ color: 'var(--text-primary)' }}>{key}:</strong>{' '}
                            {typeof value === 'number' ? (key.toLowerCase().includes('amount') || key.toLowerCase().includes('spent') || key.toLowerCase().includes('limit') || key.toLowerCase().includes('overage') || key.toLowerCase().includes('shortfall') || key.toLowerCase().includes('rate') ? formatINR(value) : value) : String(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: 'var(--space-6)',
              textAlign: 'center',
              backgroundColor: 'var(--emerald-50)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--emerald-200)',
              color: 'var(--emerald-800)'
            }}
          >
            <CheckCircle2 size={24} style={{ margin: '0 auto 8px auto', color: 'var(--emerald-600)' }} />
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
              All Budgets &amp; Goals On Track
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-xs)' }}>
              No budget overruns, pacing hazards, or savings timeline shortfalls detected for {activeMonth}.
            </p>
          </div>
        )}
      </Card>

      {/* 4. Section: Category Spending Limits */}
      <Card
        title={`Monthly Category Budgets (${activeMonth})`}
        subtitle="Live spending, configurable alert thresholds, and remaining spending headroom"
        action={
          <Button variant="outline-indigo" size="sm" icon={Plus} onClick={() => openBudgetModal()}>
            Add Budget Cap
          </Button>
        }
      >
        {budgets.length > 0 ? (
          <div className="grid grid-cols-3">
            {budgets.map((b) => {
              const spent = spentByCategory[b.category] || 0;
              const { percent, remaining, exceededBy, status, statusLabel } =
                calculateBudgetUtilization(spent, b.allocatedAmount, b.alertThreshold);

              // Projected month-end burn rate
              const dailyBurn = daysElapsed > 0 ? spent / daysElapsed : 0;
              const projectedSpend = Math.round(dailyBurn * daysInMonth);

              let fillClass = 'pacing-fill-safe';
              let badge = <Badge variant="emerald">On Track</Badge>;
              if (status === 'caution') {
                fillClass = 'pacing-fill-caution';
                badge = <Badge variant="amber">Near Cap ({percent}%)</Badge>;
              } else if (status === 'exceeded') {
                fillClass = 'pacing-fill-exceeded';
                badge = <Badge variant="rose">Budget Exceeded</Badge>;
              }

              return (
                <div
                  key={b.id}
                  className="card"
                  style={{
                    padding: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                    borderLeft: `4px solid ${
                      status === 'exceeded'
                        ? 'var(--expense-rose)'
                        : status === 'caution'
                        ? 'var(--warning-amber)'
                        : 'var(--emerald-600)'
                    }`
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                      {b.category}
                    </span>
                    {badge}
                  </div>

                  <div className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    <span>
                      Spent: <strong style={{ color: 'var(--text-primary)' }}>{formatINR(spent)}</strong>
                    </span>
                    <span>
                      Limit: <strong>{formatINR(b.allocatedAmount)}</strong>
                    </span>
                  </div>

                  {/* Progress Bar with Color Coding */}
                  <div className="pacing-bar-bg">
                    <div
                      className={`pacing-bar-fill ${fillClass}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>

                  {/* Burn rate & Projection */}
                  <div className="flex items-center justify-between" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Pace: {formatINR(dailyBurn)}/day</span>
                    <span>Projected: <strong>{formatINR(projectedSpend)}</strong></span>
                  </div>

                  <div
                    className="flex items-center justify-between"
                    style={{
                      fontSize: 'var(--text-xs)',
                      paddingTop: 'var(--space-2)',
                      borderTop: '1px solid var(--border-subtle)'
                    }}
                  >
                    <span
                      style={{
                        color: remaining >= 0 ? 'var(--emerald-600)' : 'var(--rose-600)',
                        fontWeight: 600
                      }}
                    >
                      {remaining >= 0
                        ? `${formatINR(remaining)} Left`
                        : `${formatINR(exceededBy)} Exceeded`}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon-only"
                        onClick={() => openBudgetModal(b)}
                        title="Edit budget limit or threshold"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon-only"
                        style={{ color: 'var(--rose-600)' }}
                        onClick={() => {
                          if (window.confirm(`Delete budget for "${b.category}"?`)) {
                            deleteBudget(b.id);
                          }
                        }}
                        title="Delete budget"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', margin: '2rem 0' }}>
            No category budgets created yet. Click "Set Category Budget" to define spending caps.
          </p>
        )}
      </Card>

      {/* 5. Section: Savings Goals & Milestones */}
      <Card
        title="Long-Term Savings Goals & Milestones"
        subtitle="Dedicated target funds with scheduled monthly allocations and direct contribution controls"
        action={
          <Button variant="outline-indigo" size="sm" icon={Plus} onClick={() => openGoalModal()}>
            Add Savings Goal
          </Button>
        }
      >
        {goals.length > 0 ? (
          <div className="grid grid-cols-2">
            {goals.map((g) => {
              const {
                percent,
                remainingAmount,
                monthsRemaining,
                requiredMonthlyRate,
                pacingStatus,
                statusLabel
              } = calculateGoalPacing(g, `${activeMonth}-24`);

              let badgeVariant = 'indigo';
              if (pacingStatus === 'completed') badgeVariant = 'emerald';
              else if (pacingStatus === 'lagging' || pacingStatus === 'overdue') badgeVariant = 'amber';

              return (
                <div
                  key={g.id}
                  className="card"
                  style={{
                    padding: 'var(--space-5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 3,
                          backgroundColor: g.color || '#4338ca'
                        }}
                      />
                      <h3 style={{ fontSize: 'var(--text-base)', margin: 0, fontWeight: 700 }}>
                        {g.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={badgeVariant}>{statusLabel}</Badge>
                      <Badge variant="neutral">{percent}%</Badge>
                    </div>
                  </div>

                  {g.notes && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                      {g.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>
                    <span>
                      Accumulated: <strong>{formatINR(g.currentAmount)}</strong>
                    </span>
                    <span>
                      Target: <strong>{formatINR(g.targetAmount)}</strong>
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="pacing-bar-bg" style={{ height: 10 }}>
                    <div
                      className="pacing-bar-fill"
                      style={{
                        width: `${Math.min(100, percent)}%`,
                        backgroundColor: percent >= 100 ? 'var(--emerald-600)' : g.color || 'var(--primary-indigo)'
                      }}
                    />
                  </div>

                  {/* Pacing & Timeline Details */}
                  <div className="flex items-center justify-between flex-wrap gap-2" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>
                      {g.targetDate ? `Target: ${formatDate(g.targetDate)} (${monthsRemaining} mo)` : 'No deadline'}
                    </span>
                    <span>
                      Allocated: <strong>{formatINR(g.monthlyAllocation || 0)}/mo</strong>
                      {requiredMonthlyRate > 0 && ` (Need: ${formatINR(requiredMonthlyRate)}/mo)`}
                    </span>
                  </div>

                  {/* Footer Controls & Contribution Button */}
                  <div
                    className="flex items-center justify-between"
                    style={{
                      fontSize: 'var(--text-xs)',
                      paddingTop: 'var(--space-3)',
                      borderTop: '1px solid var(--border-subtle)'
                    }}
                  >
                    <span style={{ color: 'var(--emerald-600)', fontWeight: 600 }}>
                      {remainingAmount > 0 ? `${formatINR(remainingAmount)} Remaining` : 'Goal Complete!'}
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="emerald"
                        size="sm"
                        icon={Coins}
                        onClick={() => openContributionModal(g)}
                      >
                        Add Funds
                      </Button>

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon-only"
                        onClick={() => openGoalModal(g)}
                        title="Edit goal"
                      >
                        <Edit2 size={13} />
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon-only"
                        style={{ color: 'var(--rose-600)' }}
                        onClick={() => {
                          if (window.confirm(`Delete savings goal "${g.title}"?`)) {
                            deleteGoal(g.id);
                          }
                        }}
                        title="Delete goal"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', margin: '2rem 0' }}>
            No savings goals set. Click "Add Savings Goal" to track your future objectives.
          </p>
        )}
      </Card>

      {/* Modal: Set/Edit Budget */}
      <Modal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title={editingBudget ? 'Edit Category Budget' : 'Set Category Spending Limit'}
        subtitle={`Establish a monthly spending ceiling for ${budgetForm.month || activeMonth}`}
        maxWidth="460px"
        footer={
          <div className="flex items-center justify-end gap-3" style={{ width: '100%' }}>
            <Button variant="secondary" onClick={() => setIsBudgetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleBudgetSubmit}>
              {editingBudget ? 'Update Limit' : 'Set Budget'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleBudgetSubmit} className="flex flex-col gap-4">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={budgetForm.category}
              onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })}
              disabled={Boolean(editingBudget)}
            >
              {DEFAULT_CATEGORIES.filter((c) => c.type === 'expense').map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Monthly Spending Cap (₹ INR)</label>
            <div className="input-prefix-wrapper">
              <span className="input-prefix">₹</span>
              <input
                type="number"
                min="1"
                step="50"
                placeholder="5000.00"
                className="form-input with-prefix"
                value={budgetForm.allocatedAmount}
                onChange={(e) => setBudgetForm({ ...budgetForm, allocatedAmount: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Warning Alert Threshold</label>
            <select
              className="form-select"
              value={budgetForm.alertThreshold}
              onChange={(e) =>
                setBudgetForm({ ...budgetForm, alertThreshold: parseFloat(e.target.value) })
              }
            >
              <option value="0.75">Alert when 75% of budget is reached</option>
              <option value="0.80">Alert when 80% of budget is reached</option>
              <option value="0.85">Alert when 85% of budget is reached (Recommended)</option>
              <option value="0.90">Alert when 90% of budget is reached</option>
              <option value="0.95">Alert when 95% of budget is reached</option>
            </select>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              Triggers a proactive warning alert before your category limit is exceeded.
            </span>
          </div>
        </form>
      </Modal>

      {/* Modal: Set/Edit Savings Goal */}
      <Modal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        title={editingGoal ? 'Edit Savings Goal' : 'Create New Savings Goal'}
        subtitle="Define an objective with a target fund amount and scheduled contributions"
        maxWidth="480px"
        footer={
          <div className="flex items-center justify-end gap-3" style={{ width: '100%' }}>
            <Button variant="secondary" onClick={() => setIsGoalModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleGoalSubmit}>
              {editingGoal ? 'Save Goal' : 'Create Goal'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleGoalSubmit} className="flex flex-col gap-4">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Goal Title</label>
            <input
              type="text"
              placeholder="e.g. Emergency Fund, Laptop Upgrade, Vacation"
              className="form-input"
              value={goalForm.title}
              onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Target Amount (₹ INR)</label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  min="1"
                  placeholder="50000.00"
                  className="form-input with-prefix"
                  value={goalForm.targetAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Current Saved (₹ INR)</label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  className="form-input with-prefix"
                  value={goalForm.currentAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, currentAmount: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Target Date Section */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
              <label className="form-label" style={{ margin: 0 }}>Target Completion Date</label>
              <label className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={goalForm.hasTargetDate}
                  onChange={(e) => setGoalForm({ ...goalForm, hasTargetDate: e.target.checked })}
                />
                <span>Set Deadline</span>
              </label>
            </div>
            {goalForm.hasTargetDate && (
              <input
                type="date"
                className="form-input"
                value={goalForm.targetDate}
                onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
              />
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Planned Monthly Allocation (₹)</label>
            <div className="input-prefix-wrapper">
              <span className="input-prefix">₹</span>
              <input
                type="number"
                min="0"
                placeholder="5000.00"
                className="form-input with-prefix"
                value={goalForm.monthlyAllocation}
                onChange={(e) => setGoalForm({ ...goalForm, monthlyAllocation: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Notes / Motivation</label>
            <input
              type="text"
              placeholder="e.g. 3 months of basic living expenses buffer"
              className="form-input"
              value={goalForm.notes}
              onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Quick Goal Contribution Controls */}
      <Modal
        isOpen={isContributionModalOpen}
        onClose={() => setIsContributionModalOpen(false)}
        title={selectedGoalForContribution ? `Adjust Funds: ${selectedGoalForContribution.title}` : 'Goal Funds'}
        subtitle="Directly deposit or adjust savings progress towards this goal"
        maxWidth="460px"
        footer={
          <div className="flex items-center justify-end gap-3" style={{ width: '100%' }}>
            <Button variant="secondary" onClick={() => setIsContributionModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="emerald" onClick={handleContributionSubmit}>
              {contributionMode === 'withdraw' ? 'Withdraw Funds' : 'Confirm Deposit'}
            </Button>
          </div>
        }
      >
        {selectedGoalForContribution && (
          <form onSubmit={handleContributionSubmit} className="flex flex-col gap-4">
            {/* Current Balance Overview */}
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Currently Saved:</span>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatINR(selectedGoalForContribution.currentAmount)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Target:</span>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {formatINR(selectedGoalForContribution.targetAmount)}
                </div>
              </div>
            </div>

            {/* Mode Toggle: Deposit vs Withdraw */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  flex: 1,
                  backgroundColor: contributionMode === 'add' ? 'var(--emerald-600)' : 'var(--bg-subtle)',
                  color: contributionMode === 'add' ? '#fff' : 'var(--text-secondary)'
                }}
                onClick={() => setContributionMode('add')}
              >
                Deposit Funds (+)
              </button>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  flex: 1,
                  backgroundColor: contributionMode === 'withdraw' ? 'var(--expense-rose)' : 'var(--bg-subtle)',
                  color: contributionMode === 'withdraw' ? '#fff' : 'var(--text-secondary)'
                }}
                onClick={() => setContributionMode('withdraw')}
              >
                Withdraw Funds (-)
              </button>
            </div>

            {/* Quick Amount Chips */}
            {contributionMode === 'add' && (
              <div className="flex items-center gap-2 flex-wrap">
                {[500, 1000, 2500, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="quick-chip"
                    onClick={() => setContributionAmount(String(amt))}
                  >
                    +{formatINR(amt, false)}
                  </button>
                ))}
              </div>
            )}

            {/* Amount Input */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                {contributionMode === 'withdraw' ? 'Withdrawal Amount (₹ INR)' : 'Contribution Amount (₹ INR)'}
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  min="1"
                  step="10"
                  placeholder="2500.00"
                  className="form-input with-prefix"
                  value={contributionAmount}
                  onChange={(e) => {
                    setContributionAmount(e.target.value);
                    setContributionError('');
                  }}
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Error Message */}
            {contributionError && (
              <div style={{ color: 'var(--expense-rose)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                {contributionError}
              </div>
            )}

            {/* Explicit Fintech Transparency Notice */}
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-surface-hover)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                lineHeight: 1.4
              }}
            >
              <strong style={{ color: 'var(--primary-indigo)' }}>Fintech Clarity:</strong> Goal contributions adjust your goal progress balance directly. They are not simulated bank transfers and will not create expense transactions in your cash flow ledger.
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
