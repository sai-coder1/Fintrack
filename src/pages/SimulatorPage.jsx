import React, { useState, useMemo } from 'react';
import { useFinance } from '../hooks/useFinance';
import { formatINR, formatPercentage, formatDate } from '../utils/formatters';
import { evaluatePurchaseDecision } from '../utils/affordability';
import { DEFAULT_CATEGORIES } from '../data/defaultCategories';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
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
  Clock,
  Layers,
  Receipt,
  RotateCcw,
  Info,
  Calendar,
  AlertCircle,
  FileCheck
} from 'lucide-react';

export function SimulatorPage() {
  const {
    netBalance,
    forecast,
    budgets,
    monthTransactions,
    goals,
    activeMonth,
    addTransaction,
    setCurrentPage
  } = useFinance();

  // 1. Simulation Form State
  const [purchaseForm, setPurchaseForm] = useState({
    name: 'Sony WH-1000XM5 Noise Cancelling Headphones',
    amount: '24999',
    category: 'Shopping & Discretionary',
    date: '2026-10-24',
    nature: 'want', // 'want' | 'need'
    userUpcomingEssentials: '0'
  });

  // 2. Transaction Record Confirmation Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordSuccessMessage, setRecordSuccessMessage] = useState('');

  // 3. Run Affordability Evaluation
  const evaluation = useMemo(() => {
    const costNum = parseFloat(purchaseForm.amount) || 0;
    const additionalBills = parseFloat(purchaseForm.userUpcomingEssentials) || 0;

    return evaluatePurchaseDecision({
      purchaseName: purchaseForm.name,
      purchaseAmount: costNum,
      category: purchaseForm.category,
      purchaseDate: purchaseForm.date || '2026-10-24',
      nature: purchaseForm.nature,
      userUpcomingEssentials: additionalBills,
      availableFunds: netBalance,
      forecast,
      budgets,
      monthTransactions,
      goals,
      targetMonth: activeMonth,
      hasReliableOpeningBalance: false // Documented transparent balance model
    });
  }, [
    purchaseForm,
    netBalance,
    forecast,
    budgets,
    monthTransactions,
    goals,
    activeMonth
  ]);

  // Quick Preset Handlers
  const applyPreset = (name, amount, category, nature) => {
    setPurchaseForm((prev) => ({
      ...prev,
      name,
      amount: String(amount),
      category,
      nature,
      userUpcomingEssentials: '0'
    }));
    setRecordSuccessMessage('');
  };

  // Quick Scenario Selection
  const applyScenarioAmount = (amount) => {
    setPurchaseForm((prev) => ({
      ...prev,
      amount: String(amount)
    }));
    setRecordSuccessMessage('');
  };

  // Explicit Transaction Recording Handler
  const handleConfirmRecordTransaction = () => {
    const costNum = parseFloat(purchaseForm.amount) || 0;
    if (costNum <= 0) return;

    addTransaction({
      description: purchaseForm.name.trim() || 'Simulated Purchase',
      amount: costNum,
      type: 'expense',
      category: purchaseForm.category,
      nature: purchaseForm.nature,
      date: purchaseForm.date || '2026-10-24',
      notes: `Recorded via Affordability Simulator on ${new Date().toLocaleDateString('en-IN')}`,
      paymentMethod: 'UPI',
      source: 'manual'
    });

    setIsRecordModalOpen(false);
    setRecordSuccessMessage(
      `Successfully recorded "${purchaseForm.name}" (${formatINR(costNum)}) into your ${purchaseForm.category} ledger.`
    );
  };

  const { metrics, scenarios } = evaluation;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Area */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: '4px' }}>
            &ldquo;Can I Afford This?&rdquo; Purchase Decision Simulator
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Simulate purchases before committing cash. Evaluate instant consequences on cashflow, category budgets, and month-end runways.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={RotateCcw}
            onClick={() =>
              applyPreset(
                'Sony WH-1000XM5 Noise Cancelling Headphones',
                24999,
                'Shopping & Discretionary',
                'want'
              )
            }
          >
            Reset Simulator
          </Button>
        </div>
      </div>

      {/* Success Notification if recorded */}
      {recordSuccessMessage && (
        <div
          className="alert-card alert-card-success"
          style={{ padding: 'var(--space-3) var(--space-4)' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} style={{ color: 'var(--emerald-600)' }} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--emerald-800)' }}>
                {recordSuccessMessage}
              </span>
            </div>
            <Button
              variant="outline-teal"
              size="sm"
              onClick={() => setCurrentPage('transactions')}
            >
              View in Ledger
            </Button>
          </div>
        </div>
      )}

      {/* 2. Primary 2-Column Simulation Studio */}
      <div className="grid grid-cols-2">
        {/* Left Column: Purchase Parameters Form */}
        <Card
          title="Proposed Purchase Parameters"
          subtitle="Input the expense details to run transparent cashflow and budget projections"
        >
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-col gap-4"
          >
            {/* Quick Test Presets */}
            <div>
              <span className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                Quick Test Scenarios:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => applyPreset('Weekend Gourmet Dinner', 1200, 'Food & Dining Out', 'want')}
                >
                  ₹1,200 Dinner (Safe)
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => applyPreset('Smart Watch Upgrade', 7500, 'Shopping & Discretionary', 'want')}
                >
                  ₹7,500 Gadget (Budget Breach)
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => applyPreset('Home Inverter Battery', 18000, 'Bills & Utilities', 'need')}
                >
                  ₹18,000 Essential (Savings Tension)
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => applyPreset('Flagship 4K OLED TV', 65000, 'Shopping & Discretionary', 'want')}
                >
                  ₹65,000 Luxury (Deficit)
                </button>
              </div>
            </div>

            {/* Item Name */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="sim-name">
                Proposed Purchase Name
              </label>
              <input
                id="sim-name"
                type="text"
                placeholder="e.g. Ergonomic Office Chair, Laptop, Vacation Trip"
                className="form-input"
                value={purchaseForm.name}
                onChange={(e) => {
                  setPurchaseForm({ ...purchaseForm, name: e.target.value });
                  setRecordSuccessMessage('');
                }}
                required
              />
            </div>

            {/* Cost & Category */}
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="sim-amount">
                  Purchase Amount (₹ INR)
                </label>
                <div className="input-prefix-wrapper">
                  <span className="input-prefix">₹</span>
                  <input
                    id="sim-amount"
                    type="number"
                    min="1"
                    step="50"
                    placeholder="25000.00"
                    className="form-input with-prefix"
                    value={purchaseForm.amount}
                    onChange={(e) => {
                      setPurchaseForm({ ...purchaseForm, amount: e.target.value });
                      setRecordSuccessMessage('');
                    }}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="sim-category">
                  Spending Category
                </label>
                <select
                  id="sim-category"
                  className="form-select"
                  value={purchaseForm.category}
                  onChange={(e) => {
                    setPurchaseForm({ ...purchaseForm, category: e.target.value });
                    setRecordSuccessMessage('');
                  }}
                >
                  {DEFAULT_CATEGORIES.filter((c) => c.type === 'expense').map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date & Nature */}
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="sim-date">
                  Target Purchase Date
                </label>
                <input
                  id="sim-date"
                  type="date"
                  className="form-input"
                  value={purchaseForm.date}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, date: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="sim-nature">
                  Nature of Purchase
                </label>
                <select
                  id="sim-nature"
                  className="form-select"
                  value={purchaseForm.nature}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, nature: e.target.value })}
                >
                  <option value="want">Discretionary (Want)</option>
                  <option value="need">Essential Living Need</option>
                </select>
              </div>
            </div>

            {/* Optional Additional Upcoming Obligations */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <label className="form-label" htmlFor="sim-upcoming-essentials" style={{ margin: 0 }}>
                  Additional Unbudgeted Bills (Optional)
                </label>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  e.g. Planned medical, family gift
                </span>
              </div>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="sim-upcoming-essentials"
                  type="number"
                  min="0"
                  placeholder="0.00"
                  className="form-input with-prefix"
                  value={purchaseForm.userUpcomingEssentials}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, userUpcomingEssentials: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Analysis refreshes in real-time.
              </span>
              <Button
                variant="primary"
                size="sm"
                icon={Calculator}
                onClick={() => setRecordSuccessMessage('')}
              >
                Analyze Purchase
              </Button>
            </div>
          </form>
        </Card>

        {/* Right Column: Decision Verdict & Comparative Impact */}
        <div className="flex flex-col gap-4">
          {/* Primary Assessment Verdict Banner */}
          <div
            className={`alert-card alert-card-${evaluation.badgeVariant}`}
            style={{
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}
          >
            <div className="flex items-center justify-between">
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)'
                }}
              >
                SpendSense Verdict
              </span>
              <Badge variant={evaluation.badgeVariant}>
                {evaluation.assessment}
              </Badge>
            </div>

            <div className="flex items-start gap-3">
              <div style={{ marginTop: 2, flexShrink: 0 }}>
                {evaluation.tier === 'AFFORDABLE' && (
                  <ShieldCheck size={24} style={{ color: 'var(--emerald-600)' }} />
                )}
                {evaluation.tier === 'CAUTION' && (
                  <AlertTriangle size={24} style={{ color: 'var(--warning-amber)' }} />
                )}
                {evaluation.tier === 'NOT_AFFORDABLE' && (
                  <ShieldAlert size={24} style={{ color: 'var(--expense-rose)' }} />
                )}
              </div>

              <div>
                <h3
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 700,
                    margin: '0 0 4px 0',
                    color: 'var(--text-primary)'
                  }}
                >
                  {evaluation.assessment}
                </h3>
                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.55,
                    margin: 0
                  }}
                >
                  {evaluation.summary}
                </p>
              </div>
            </div>

            {/* Explicit CTA: Record as real transaction */}
            <div
              className="flex items-center justify-between"
              style={{
                marginTop: 'var(--space-3)',
                paddingTop: 'var(--space-3)',
                borderTop: '1px solid rgba(0,0,0,0.06)'
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Ready to commit? Record it to your ledger:
              </span>
              <Button
                variant={evaluation.tier === 'NOT_AFFORDABLE' ? 'outline' : 'emerald'}
                size="sm"
                icon={Receipt}
                onClick={() => setIsRecordModalOpen(true)}
              >
                I Bought This — Record Expense
              </Button>
            </div>
          </div>

          {/* Before vs. After 3-Column Comparative Metrics */}
          <div className="grid grid-cols-3">
            {/* 1. Liquid Cash Balance */}
            <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                <Wallet size={13} />
                <span>Liquid Cash</span>
              </div>
              <div
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 700,
                  color: metrics.liquidCashAfter >= 0 ? 'var(--text-primary)' : 'var(--expense-rose)'
                }}
              >
                {formatINR(metrics.liquidCashAfter)}
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                Before: {formatINR(metrics.liquidCashBefore)} (-{formatINR(evaluation.purchaseAmount)})
              </span>
            </div>

            {/* 2. Category Budget Headroom */}
            <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                <TrendingDown size={13} />
                <span>{purchaseForm.category.slice(0, 10)}...</span>
              </div>
              <div
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 700,
                  color: metrics.isCategoryOverBudget ? 'var(--expense-rose)' : 'var(--emerald-600)'
                }}
              >
                {metrics.categoryCap > 0
                  ? metrics.isCategoryOverBudget
                    ? `-${formatINR(metrics.categoryOverage)}`
                    : formatINR(metrics.categoryHeadroomAfter)
                  : 'No Cap'}
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {metrics.categoryCap > 0
                  ? metrics.isCategoryOverBudget
                    ? 'Over category ceiling'
                    : 'Remaining headroom'
                  : 'Uncapped category'}
              </span>
            </div>

            {/* 3. Estimated Month-End Position */}
            <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                <PiggyBank size={13} />
                <span>Projected End</span>
              </div>
              <div
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 700,
                  color: metrics.monthEndAfter >= 0 ? 'var(--emerald-600)' : 'var(--expense-rose)'
                }}
              >
                {formatINR(metrics.monthEndAfter)}
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                Before: {formatINR(metrics.monthEndBefore)}
              </span>
            </div>
          </div>

          {/* Actionable Trade-Off Recommendations */}
          <Card
            title="Strategic Advice & Decision Trade-Offs"
            subtitle="Calculated recommendations to protect your monthly financial plan"
          >
            <div className="flex flex-col gap-2">
              {evaluation.tradeOffs.map((advice, idx) => (
                <div key={idx} className="flex items-start gap-2" style={{ fontSize: 'var(--text-xs)' }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--primary-indigo)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{advice}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* 3. Deep-Dive Financial Impact & Conflict Detection */}
      <Card
        title="Comprehensive Financial Position Impact (Before vs. After)"
        subtitle="Transparent reconciliation of category caps, upcoming essential bills, and savings goal reserves"
      >
        <div className="grid grid-cols-3" style={{ gap: 'var(--space-4)' }}>
          {/* Panel A: Category Budget Breach Check */}
          <div
            className="card"
            style={{
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                1. Category Budget Impact
              </span>
              <Badge variant={metrics.isCategoryOverBudget ? 'rose' : 'emerald'}>
                {metrics.categoryCap > 0 ? (metrics.isCategoryOverBudget ? 'Cap Breached' : 'Within Budget') : 'No Limit'}
              </Badge>
            </div>

            {metrics.categoryCap > 0 ? (
              <>
                <div className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  <span>Before: {formatINR(metrics.categorySpentBefore)} ({metrics.categoryPercentBefore}%)</span>
                  <span>After: <strong style={{ color: 'var(--text-primary)' }}>{formatINR(metrics.categorySpentAfter)} ({metrics.categoryPercentAfter}%)</strong></span>
                </div>

                <div className="pacing-bar-bg" style={{ height: 8 }}>
                  <div
                    className="pacing-bar-fill"
                    style={{
                      width: `${Math.min(100, metrics.categoryPercentAfter)}%`,
                      backgroundColor: metrics.isCategoryOverBudget ? 'var(--expense-rose)' : 'var(--emerald-600)'
                    }}
                  />
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Category Cap: <strong>{formatINR(metrics.categoryCap)}</strong>
                  {metrics.isCategoryOverBudget && (
                    <span style={{ color: 'var(--expense-rose)', fontWeight: 600, display: 'block', marginTop: 2 }}>
                      Breaches limit by {formatINR(metrics.categoryOverage)}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                No budget cap has been configured for {purchaseForm.category}. This purchase will not trigger a budget overrun.
              </p>
            )}
          </div>

          {/* Panel B: Upcoming Essential Obligations */}
          <div
            className="card"
            style={{
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                2. Essential Bills Protection
              </span>
              <Badge variant={metrics.hasEssentialConflict ? 'rose' : 'emerald'}>
                {metrics.hasEssentialConflict ? 'Collision Risk' : 'Protected'}
              </Badge>
            </div>

            <div className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <span>Reserved for Unpaid Bills:</span>
              <strong>{formatINR(metrics.totalUpcomingEssentials)}</strong>
            </div>

            <div className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <span>Cushion After Bills:</span>
              <strong style={{ color: metrics.cushionAfterEssentials >= 0 ? 'var(--emerald-600)' : 'var(--rose-600)' }}>
                {formatINR(metrics.cushionAfterEssentials)}
              </strong>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 4 }}>
              *Deduplication verified: Already paid rent and bills are excluded. Only unpaid commitments are reserved.
            </div>
          </div>

          {/* Panel C: Savings Goal Commitments */}
          <div
            className="card"
            style={{
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                3. Savings Goals Protection
              </span>
              <Badge variant={metrics.hasSavingsConflict ? 'amber' : 'emerald'}>
                {metrics.hasSavingsConflict ? 'Savings Compressed' : 'Target Safe'}
              </Badge>
            </div>

            <div className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <span>Monthly Target Across Goals:</span>
              <strong>{formatINR(metrics.monthlySavingsTarget)}/mo</strong>
            </div>

            <div className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <span>Projected Month-End Cushion:</span>
              <strong style={{ color: metrics.monthEndAfter >= metrics.monthlySavingsTarget ? 'var(--emerald-600)' : 'var(--warning-amber)' }}>
                {formatINR(metrics.monthEndAfter)}
              </strong>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 4 }}>
              {metrics.hasSavingsConflict
                ? `Encroaches on your monthly savings plan by ${formatINR(metrics.savingsCompression)}.`
                : 'Month-end surplus fully covers your scheduled savings contributions.'}
            </div>
          </div>
        </div>

        {/* Identified Friction Points & Conflicts */}
        {evaluation.conflicts.length > 0 && (
          <div
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-4)',
              backgroundColor: '#fff1f2',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #fecdd3'
            }}
          >
            <div className="flex items-center gap-2" style={{ fontWeight: 700, color: 'var(--rose-700)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
              <AlertCircle size={16} />
              <span>Identified Financial Conflicts ({evaluation.conflicts.length}):</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', fontSize: 'var(--text-xs)', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {evaluation.conflicts.map((c, idx) => (
                <li key={idx}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* 4. Scenario Comparison Alternatives Matrix */}
      <Card
        title="Immediate Scenario Comparison: Explore Alternatives"
        subtitle="Evaluate trade-offs between the full purchase, a budget-friendly alternative, and deferring to next month"
      >
        <div className="grid grid-cols-3" style={{ gap: 'var(--space-4)' }}>
          {scenarios.map((sc) => (
            <div
              key={sc.id}
              className="card"
              style={{
                padding: 'var(--space-5)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                borderTop: `4px solid ${
                  sc.badgeVariant === 'emerald'
                    ? 'var(--emerald-600)'
                    : sc.badgeVariant === 'amber'
                    ? 'var(--warning-amber)'
                    : 'var(--expense-rose)'
                }`
              }}
            >
              <div className="flex items-center justify-between">
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                  {sc.title}
                </h4>
                <Badge variant={sc.badgeVariant}>{sc.assessment}</Badge>
              </div>

              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatINR(sc.amount)}
              </div>

              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                {sc.description}
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: 'var(--text-xs)',
                  padding: 'var(--space-2) 0',
                  borderTop: '1px solid var(--border-subtle)',
                  borderBottom: '1px solid var(--border-subtle)'
                }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Liquid Cash After:</span>
                  <strong>{formatINR(sc.liquidCashAfter)}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Projected Month-End:</span>
                  <strong style={{ color: sc.monthEndAfter >= 0 ? 'var(--emerald-600)' : 'var(--expense-rose)' }}>
                    {formatINR(sc.monthEndAfter)}
                  </strong>
                </div>
              </div>

              {sc.id !== 'current' ? (
                <Button
                  variant="outline-indigo"
                  size="sm"
                  onClick={() => applyScenarioAmount(sc.amount)}
                >
                  Apply this Option ({formatINR(sc.amount)})
                </Button>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--primary-indigo)', fontWeight: 600, textAlign: 'center' }}>
                  Currently Active Simulation
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 5. Data Quality Caveats & Transparent Disclaimers */}
      <div
        className="card"
        style={{
          padding: 'var(--space-4) var(--space-5)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)'
        }}
      >
        <div className="flex items-center gap-2" style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
          <Info size={14} style={{ color: 'var(--primary-indigo)' }} />
          <span>Data-Quality Caveats &amp; Model Limitations:</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {evaluation.caveats.map((c, idx) => (
            <li key={idx}>{c}</li>
          ))}
        </ul>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
          *Disclaimer: {evaluation.disclaimer}
        </div>
      </div>

      {/* Confirmation Modal to Record Transaction */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Confirm Purchase Recording"
        subtitle="Officially record this transaction into your financial ledger"
        maxWidth="460px"
        footer={
          <div className="flex items-center justify-end gap-3" style={{ width: '100%' }}>
            <Button variant="secondary" onClick={() => setIsRecordModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmRecordTransaction}>
              Confirm &amp; Record Expense
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            You are about to record the following transaction into your <strong>October 2026</strong> transactions ledger:
          </p>

          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Item Name:</span>
              <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{purchaseForm.name}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Amount:</span>
              <strong style={{ fontSize: 'var(--text-base)', color: 'var(--expense-rose)' }}>{formatINR(parseFloat(purchaseForm.amount) || 0)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Category:</span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{purchaseForm.category}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Nature:</span>
              <Badge variant={purchaseForm.nature === 'need' ? 'indigo' : 'neutral'}>
                {purchaseForm.nature === 'need' ? 'Essential Need' : 'Discretionary Want'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Transaction Date:</span>
              <span style={{ fontSize: 'var(--text-xs)' }}>{formatDate(purchaseForm.date)}</span>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Note: This action will permanently update your cashflow metrics, category budget pacing, and alerts.
          </div>
        </div>
      </Modal>
    </div>
  );
}
