import React, { useState, useMemo } from 'react';
import { useFinance } from '../hooks/useFinance';
import { formatINR, formatPercentage } from '../utils/formatters';
import { simulatePurchaseAffordability } from '../utils/forecasting';
import { DEFAULT_CATEGORIES } from '../data/defaultCategories';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  Sparkles,
  Calculator,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Wallet,
  PiggyBank,
  CheckCircle2,
  HelpCircle,
  Clock
} from 'lucide-react';

export function SimulatorPage() {
  const {
    netBalance,
    forecast,
    budgets,
    monthTransactions,
    goals
  } = useFinance();

  // Simulation Form State
  const [purchaseForm, setPurchaseForm] = useState({
    description: 'Sony WH-1000XM5 Noise Cancelling Headphones',
    cost: '24999',
    category: 'Shopping & Discretionary',
    nature: 'want'
  });

  // Calculate current spend in the selected category
  const categorySpent = useMemo(() => {
    return monthTransactions
      .filter((t) => t.type === 'expense' && t.category === purchaseForm.category)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [monthTransactions, purchaseForm.category]);

  // Find budget for the selected category
  const categoryBudget = useMemo(() => {
    const b = budgets.find((item) => item.category === purchaseForm.category);
    return b ? Number(b.allocatedAmount) || 0 : 0;
  }, [budgets, purchaseForm.category]);

  // Total monthly savings commitment
  const totalMonthlySavingsTarget = useMemo(() => {
    return goals.reduce((sum, g) => sum + (Number(g.monthlyAllocation) || 0), 0);
  }, [goals]);

  // Run deterministic affordability evaluation
  const evaluation = useMemo(() => {
    const costNum = parseFloat(purchaseForm.cost) || 0;
    return simulatePurchaseAffordability({
      cost: costNum,
      category: purchaseForm.category,
      nature: purchaseForm.nature,
      currentBalance: netBalance,
      projectedMonthEnd: forecast.projectedMonthEndBalance,
      categoryBudgetCap: categoryBudget,
      categorySpent,
      monthlySavingsTarget: totalMonthlySavingsTarget
    });
  }, [
    purchaseForm,
    netBalance,
    forecast.projectedMonthEndBalance,
    categoryBudget,
    categorySpent,
    totalMonthlySavingsTarget
  ]);

  const setPreset = (desc, cost, cat, nature) => {
    setPurchaseForm({
      description: desc,
      cost: String(cost),
      category: cat,
      nature
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header */}
      <div>
        <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: '4px' }}>
          Purchase Affordability Simulator
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
          Evaluate proposed purchases before committing to avoid month-end deficits.
        </p>
      </div>

      <div className="grid grid-cols-2">
        {/* Left Column: Proposed Purchase Input Form */}
        <Card
          title="Simulate a Purchase"
          subtitle="Input purchase details to project consequences on cashflow and budgets"
        >
          <form className="flex flex-col gap-4">
            {/* Quick Preset Buttons */}
            <div>
              <span className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                Quick Test Scenarios:
              </span>
              <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreset('Weekend Gourmet Dinner', 1800, 'Food & Dining Out', 'want')}
                >
                  ₹1,800 Dining
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreset('Smart Watch Upgrade', 7500, 'Shopping & Discretionary', 'want')}
                >
                  ₹7,500 Gadget
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreset('Flagship Smartphone', 45000, 'Shopping & Discretionary', 'want')}
                >
                  ₹45,000 Phone
                </Button>
              </div>
            </div>

            {/* Item Description */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="sim-item">
                Purchase Item / Expense Title
              </label>
              <input
                id="sim-item"
                type="text"
                placeholder="e.g. Ergonomic Office Chair"
                className="form-input"
                value={purchaseForm.description}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, description: e.target.value })}
              />
            </div>

            {/* Cost (₹ INR) */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="sim-cost">
                Estimated Cost (₹ INR)
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="sim-cost"
                  type="number"
                  min="1"
                  step="100"
                  placeholder="0.00"
                  className="form-input with-prefix"
                  value={purchaseForm.cost}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, cost: e.target.value })}
                />
              </div>
            </div>

            {/* Target Category & Nature in 2 columns */}
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="sim-cat">Category Bucket</label>
                <select
                  id="sim-cat"
                  className="form-select"
                  value={purchaseForm.category}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, category: e.target.value })}
                >
                  {DEFAULT_CATEGORIES.filter((c) => c.type === 'expense').map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="sim-nature">Purchase Nature</label>
                <select
                  id="sim-nature"
                  className="form-select"
                  value={purchaseForm.nature}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, nature: e.target.value })}
                >
                  <option value="want">Want (Discretionary)</option>
                  <option value="need">Need (Essential)</option>
                </select>
              </div>
            </div>

            <div className="sidebar-card-helper" style={{ marginTop: 'var(--space-2)' }}>
              <div className="flex items-center gap-2" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <Clock size={14} />
                <span>Simulation Timing</span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                Simulating this purchase for <strong>24 October 2026</strong> against 7 remaining days in the month.
              </p>
            </div>
          </form>
        </Card>

        {/* Right Column: Reserved Results Area for Projected Financial Impact */}
        <div className="flex flex-col gap-4">
          {/* Decision Verdict Banner */}
          <div
            className="card"
            style={{
              padding: 'var(--space-5)',
              borderLeftWidth: 4,
              borderLeftColor:
                evaluation.tier === 'COMFORTABLE'
                  ? 'var(--emerald-600)'
                  : evaluation.tier === 'CAUTION'
                  ? 'var(--amber-500)'
                  : 'var(--rose-600)',
              backgroundColor:
                evaluation.tier === 'COMFORTABLE'
                  ? 'var(--emerald-50)'
                  : evaluation.tier === 'CAUTION'
                  ? 'var(--amber-50)'
                  : 'var(--rose-50)'
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color:
                    evaluation.tier === 'COMFORTABLE'
                      ? 'var(--emerald-700)'
                      : evaluation.tier === 'CAUTION'
                      ? 'var(--amber-700)'
                      : 'var(--rose-700)'
                }}
              >
                Simulator Verdict
              </span>
              <Badge variant={evaluation.badgeVariant}>
                {evaluation.tier === 'COMFORTABLE' ? 'Comfortably Affordable' : evaluation.tier === 'CAUTION' ? 'Proceed with Caution' : 'High Financial Risk'}
              </Badge>
            </div>
            <h3
              style={{
                fontSize: 'var(--text-lg)',
                color:
                  evaluation.tier === 'COMFORTABLE'
                    ? 'var(--emerald-700)'
                    : evaluation.tier === 'CAUTION'
                    ? 'var(--amber-700)'
                    : 'var(--rose-700)',
                marginBottom: 4
              }}
            >
              {evaluation.headline}
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {evaluation.summary}
            </p>
          </div>

          {/* 3 Comparative Impact Cards */}
          <div className="grid grid-cols-3">
            {/* Impact 1: Cash on Hand */}
            <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                <Wallet size={13} />
                <span>Liquid Cash</span>
              </div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: evaluation.postPurchaseCash >= 0 ? 'var(--text-primary)' : 'var(--rose-600)' }}>
                {formatINR(evaluation.postPurchaseCash)}
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                From {formatINR(netBalance)}
              </span>
            </div>

            {/* Impact 2: Category Headroom */}
            <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                <TrendingDown size={13} />
                <span>{purchaseForm.category.slice(0, 10)}...</span>
              </div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: evaluation.categoryDeficit > 0 ? 'var(--expense-rose)' : 'var(--emerald-600)' }}>
                {evaluation.categoryDeficit > 0 ? `-${formatINR(evaluation.categoryDeficit)}` : formatINR(evaluation.categoryHeadroom - evaluation.purchaseCost)}
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {evaluation.categoryDeficit > 0 ? 'Over category cap' : 'Remaining headroom'}
              </span>
            </div>

            {/* Impact 3: Month-End Cushion */}
            <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                <PiggyBank size={13} />
                <span>Projected End</span>
              </div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: evaluation.postPurchaseForecast >= 0 ? 'var(--emerald-600)' : 'var(--expense-rose)' }}>
                {formatINR(evaluation.postPurchaseForecast)}
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                Baseline: {formatINR(forecast.projectedMonthEndBalance)}
              </span>
            </div>
          </div>

          {/* Actionable Trade-Off Recommendations */}
          <Card
            title="Decision Advice & Trade-Offs"
            subtitle="Transparent steps to safeguard your monthly finances"
          >
            <div className="flex flex-col gap-2">
              {evaluation.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2" style={{ fontSize: 'var(--text-xs)' }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--interactive-indigo)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rec}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
