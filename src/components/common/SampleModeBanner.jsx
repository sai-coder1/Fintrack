import React from 'react';
import { useFinance } from '../../hooks/useFinance';
import { Sparkles, RefreshCw, UserCheck, ShieldCheck } from 'lucide-react';

export function SampleModeBanner() {
  const {
    isSampleMode,
    switchToPersonalMode,
    switchToSampleMode,
    resetDemoData,
    userTransactions
  } = useFinance();

  const handleResetDemo = () => {
    if (window.confirm('Reset sample demo dataset back to defaults?')) {
      resetDemoData();
    }
  };

  if (!isSampleMode) {
    return (
      <div
        className="sample-mode-banner"
        style={{
          background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)'
        }}
      >
        <div className="sample-mode-left">
          <ShieldCheck size={14} style={{ color: 'var(--emerald-600)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Personal Workspace Active</span>
          <span style={{ color: 'var(--text-muted)' }}>—</span>
          <span>
            {userTransactions.length > 0
              ? `Displaying your ${userTransactions.length} recorded transactions stored privately in your browser.`
              : 'Your personal ledger is currently empty. Record an expense or import a statement.'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem' }}
            onClick={switchToSampleMode}
            title="Explore demo dataset with pre-filled transactions"
          >
            <Sparkles size={11} />
            Explore Demo Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sample-mode-banner">
      <div className="sample-mode-left">
        <span className="sample-pulse-dot" />
        <span style={{ fontWeight: 700, color: 'var(--primary-indigo)' }}>Demo Sample Mode Active</span>
        <span style={{ color: 'var(--interactive-indigo)' }}>—</span>
        <span>Viewing sample October 2026 transactions from Indian merchants.</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-outline-indigo btn-sm"
          style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem' }}
          onClick={handleResetDemo}
          title="Reset demo data to default preset"
        >
          <RefreshCw size={11} />
          Reset Demo
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem' }}
          onClick={switchToPersonalMode}
          title="Switch to your personal ledger without modifying demo data"
        >
          <UserCheck size={11} />
          Switch to My Data ({userTransactions.length})
        </button>
      </div>
    </div>
  );
}
