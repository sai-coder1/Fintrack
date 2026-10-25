import React, { useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LegalModal } from '../components/common/LegalModal';
import {
  TrendingUp,
  PiggyBank,
  Sparkles,
  Receipt,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  HelpCircle,
  Lock,
  PieChart,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight
} from 'lucide-react';

export function LandingPage() {
  const { setCurrentPage } = useFinance();
  const { user } = useAuth();
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState('privacy');

  const openLegal = (type) => {
    setLegalModalType(type);
    setLegalModalOpen(true);
  };

  const handleGetStarted = () => {
    if (user) {
      setCurrentPage('dashboard');
    } else {
      setCurrentPage('signup');
    }
  };

  const handleSignIn = () => {
    if (user) {
      setCurrentPage('dashboard');
    } else {
      setCurrentPage('signin');
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-wrapper">
      {/* 1. Sticky Public Header Navigation */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="brand-logo-icon">
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>₹</span>
            </div>
            <div>
              <span className="brand-title">SpendSense</span>
              <span className="brand-subtitle-badge">Decision Assistant</span>
            </div>
          </div>

          <nav className="landing-nav-menu">
            <button
              type="button"
              className="landing-nav-link"
              onClick={() => scrollToSection('features')}
            >
              Features
            </button>
            <button
              type="button"
              className="landing-nav-link"
              onClick={() => scrollToSection('how-it-works')}
            >
              How It Works
            </button>
          </nav>

          <div className="landing-nav-actions">
            {user ? (
              <Button
                variant="primary"
                size="sm"
                icon={ChevronRight}
                iconPosition="right"
                onClick={() => setCurrentPage('dashboard')}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignIn}
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={ArrowRight}
                  iconPosition="right"
                  onClick={handleGetStarted}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-container">
          <div className="landing-hero-pill">
            <Sparkles size={14} style={{ color: 'var(--primary-indigo)' }} />
            <span>Smart Personal Finance for India</span>
          </div>

          <h1 className="landing-hero-title">
            Make Every Rupee Count.
          </h1>

          <p className="landing-hero-subtitle">
            Understand your spending, plan for what's ahead, and make more confident money decisions.
          </p>

          <div className="landing-hero-ctas">
            <Button
              variant="primary"
              size="lg"
              icon={ArrowRight}
              iconPosition="right"
              onClick={handleGetStarted}
            >
              Get Started
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={handleSignIn}
            >
              Sign In
            </Button>
          </div>

          {/* Privacy & Scope Trust Strip */}
          <div className="landing-trust-strip">
            <div className="landing-trust-item">
              <ShieldCheck size={16} style={{ color: 'var(--emerald-600)' }} />
              <span>100% Client-Side Privacy</span>
            </div>
            <div className="landing-trust-item">
              <CheckCircle2 size={16} style={{ color: 'var(--primary-indigo)' }} />
              <span>Standard CSV Statements &amp; Manual Entry</span>
            </div>
            <div className="landing-trust-item">
              <Lock size={16} style={{ color: 'var(--text-muted)' }} />
              <span>Zero Bank Password Access</span>
            </div>
          </div>

          {/* Realistic Dashboard Preview Mockup */}
          <div className="landing-mockup-wrapper">
            <div className="mockup-header-bar">
              <div className="mockup-dots">
                <span className="mockup-dot"></span>
                <span className="mockup-dot"></span>
                <span className="mockup-dot"></span>
              </div>
              <span className="mockup-title">SpendSense Financial Overview &mdash; October 2026</span>
              <Badge variant="indigo" icon={Calendar}>
                Active Month: Oct 2026
              </Badge>
            </div>

            <div className="mockup-content">
              {/* Top KPI Mockup Cards */}
              <div className="grid grid-cols-4" style={{ gap: 'var(--space-4)' }}>
                <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
                  <div className="stat-card-header">
                    <span className="stat-card-label">Monthly Inflow</span>
                    <div className="stat-card-icon" style={{ backgroundColor: 'var(--soft-emerald-bg)', color: 'var(--emerald-600)' }}>
                      <ArrowDownLeft size={16} />
                    </div>
                  </div>
                  <span className="stat-card-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--emerald-600)' }}>
                    ₹92,500
                  </span>
                  <span className="stat-card-footer">Salary &amp; investments</span>
                </div>

                <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
                  <div className="stat-card-header">
                    <span className="stat-card-label">Expenses (MTD)</span>
                    <div className="stat-card-icon" style={{ backgroundColor: 'var(--soft-rose-bg)', color: 'var(--expense-rose)' }}>
                      <ArrowUpRight size={16} />
                    </div>
                  </div>
                  <span className="stat-card-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--expense-rose)' }}>
                    ₹48,200
                  </span>
                  <span className="stat-card-footer">52% of planned budget</span>
                </div>

                <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
                  <div className="stat-card-header">
                    <span className="stat-card-label">Savings Rate</span>
                    <div className="stat-card-icon" style={{ backgroundColor: 'var(--soft-indigo-bg)', color: 'var(--primary-indigo)' }}>
                      <PiggyBank size={16} />
                    </div>
                  </div>
                  <span className="stat-card-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--primary-indigo)' }}>
                    47.9%
                  </span>
                  <span className="stat-card-footer">Target: 30.0% min</span>
                </div>

                <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
                  <div className="stat-card-header">
                    <span className="stat-card-label">Projected Surplus</span>
                    <div className="stat-card-icon" style={{ backgroundColor: 'var(--soft-indigo-bg)', color: 'var(--interactive-indigo)' }}>
                      <TrendingUp size={16} />
                    </div>
                  </div>
                  <span className="stat-card-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>
                    ₹24,350
                  </span>
                  <span className="stat-card-footer">On-track month end</span>
                </div>
              </div>

              {/* Feature highlight mini preview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--space-4)' }}>
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      “Can I Afford This?” Purchase Simulator
                    </span>
                    <Badge variant="emerald" icon={CheckCircle2}>
                      Safe to Purchase
                    </Badge>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0', fontWeight: 600 }}>
                    Evaluating: Ergonomic Office Chair (₹12,499)
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    Affordability score: <strong>88/100</strong>. Your Shopping budget has ₹18,500 remaining and your emergency fund buffer remains untouched.
                  </p>
                </div>

                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Needs vs. Wants Ratio
                    </span>
                    <Badge variant="indigo">50 / 30 / 20</Badge>
                  </div>
                  <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ width: '58%', backgroundColor: 'var(--primary-indigo)' }} title="Needs: 58%"></div>
                    <div style={{ width: '28%', backgroundColor: 'var(--warning-amber)' }} title="Wants: 28%"></div>
                    <div style={{ width: '14%', backgroundColor: 'var(--emerald-600)' }} title="Savings: 14%"></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    <span>Needs: ₹27.9k (58%)</span>
                    <span>Wants: ₹13.5k (28%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section id="features" className="landing-features-section">
        <div className="landing-section-header">
          <span className="landing-section-tag">Core Capabilities</span>
          <h2 className="landing-section-title">
            Purpose-Built for Everyday Indian Households
          </h2>
          <p className="landing-section-desc">
            SpendSense provides actionable, real-time financial intelligence without requiring bank passwords or automatic SMS access.
          </p>
        </div>

        <div className="features-grid">
          {/* Feature 1 */}
          <div className="feature-card">
            <div className="feature-icon-box">
              <PieChart size={22} />
            </div>
            <h3 className="feature-title">Smart Spending Insights</h3>
            <p className="feature-desc">
              Understand where your money goes with automatic Needs vs. Wants segregation, categorical distribution breakdowns, and irregular expense alerts.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="feature-card">
            <div className="feature-icon-box">
              <Receipt size={22} />
            </div>
            <h3 className="feature-title">Monthly Budget Tracking</h3>
            <p className="feature-desc">
              Set monthly category limits for groceries, rent, dining, and shopping. Get early amber warnings when spending velocity threatens your limits.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="feature-card">
            <div className="feature-icon-box">
              <PiggyBank size={22} />
            </div>
            <h3 className="feature-title">Savings Goals</h3>
            <p className="feature-desc">
              Target ambitious milestones like emergency funds, home down-payments, and vacation savings with run-rate pacing calculations and direct fund tracking.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="feature-card">
            <div className="feature-icon-box">
              <TrendingUp size={22} />
            </div>
            <h3 className="feature-title">Month-End Forecasting</h3>
            <p className="feature-desc">
              Anticipate your cash position before the month finishes. Forecast your projected closing balance using your daily burn-rate and scheduled obligations.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="feature-card">
            <div className="feature-icon-box">
              <Sparkles size={22} />
            </div>
            <h3 className="feature-title">“Can I Afford This?” Purchase Simulator</h3>
            <p className="feature-desc">
              Test big purchase decisions before swiping. Evaluate instant impacts on remaining budget caps, cash buffer safety, and month-end savings rate.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="feature-card">
            <div className="feature-icon-box">
              <FileSpreadsheet size={22} />
            </div>
            <h3 className="feature-title">CSV Transaction Imports</h3>
            <p className="feature-desc">
              Easily upload standard bank statement files (HDFC, SBI, ICICI, etc.) with automatic column mapping, duplicate detection, and instant ledger populating.
            </p>
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section id="how-it-works" className="landing-how-section">
        <div className="landing-section-header">
          <span className="landing-section-tag">Simple 3-Step Process</span>
          <h2 className="landing-section-title">
            Take Control in Minutes
          </h2>
          <p className="landing-section-desc">
            No complicated setup or bank connections. You stay in full control of your financial records from day one.
          </p>
        </div>

        <div className="how-steps-grid">
          <div className="how-step-card">
            <div className="how-step-number">01</div>
            <h3 className="how-step-title">Import or Log Transactions</h3>
            <p className="how-step-desc">
              Upload your bank CSV statements or log transactions manually as you spend. Statements are parsed directly in your browser without cloud tracking.
            </p>
          </div>

          <div className="how-step-card">
            <div className="how-step-number">02</div>
            <h3 className="how-step-title">Define Budgets &amp; Goals</h3>
            <p className="how-step-desc">
              Set monthly spending caps for your essential categories and configure targets for emergency reserves, investments, or upcoming travel plans.
            </p>
          </div>

          <div className="how-step-card">
            <div className="how-step-number">03</div>
            <h3 className="how-step-title">Decide With Confidence</h3>
            <p className="how-step-desc">
              Use real-time forecasts and the “Can I Afford This?” simulator to know exactly what fits within your financial plan before committing to a purchase.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Privacy & Data Integrity Banner */}
      <section className="landing-privacy-section">
        <div className="landing-privacy-card">
          <div className="landing-privacy-info">
            <div className="landing-privacy-badge">
              <ShieldCheck size={16} />
              <span>Client-Side Privacy Guarantee</span>
            </div>
            <h3 className="landing-privacy-title">
              Your Bank Credentials Stay In Your Hands. Always.
            </h3>
            <p className="landing-privacy-desc">
              SpendSense does not require automatic PhonePe, Google Pay, or net banking credential synchronization. You can manually enter daily expenses or import supported bank CSV files whenever you choose.
            </p>
          </div>
          <Button
            variant="emerald"
            size="lg"
            icon={ArrowRight}
            iconPosition="right"
            onClick={handleGetStarted}
          >
            Start Free Now
          </Button>
        </div>
      </section>

      {/* 6. Public Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="brand-logo-icon">
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>₹</span>
            </div>
            <div>
              <span className="brand-title">SpendSense</span>
              <span className="brand-subtitle-badge">Make Every Rupee Count</span>
            </div>
          </div>

          <div className="landing-footer-links">
            <button
              type="button"
              className="landing-footer-link"
              onClick={() => scrollToSection('features')}
            >
              Features
            </button>
            <button
              type="button"
              className="landing-footer-link"
              onClick={() => scrollToSection('how-it-works')}
            >
              How It Works
            </button>
            <button
              type="button"
              className="landing-footer-link"
              onClick={handleSignIn}
            >
              Sign In
            </button>
            <button
              type="button"
              className="landing-footer-link"
              onClick={handleGetStarted}
            >
              Get Started
            </button>
            <button
              type="button"
              className="landing-footer-link"
              onClick={() => openLegal('privacy')}
            >
              Privacy Policy
            </button>
            <button
              type="button"
              className="landing-footer-link"
              onClick={() => openLegal('terms')}
            >
              Terms of Service
            </button>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <span>&copy; 2026 SpendSense. Designed for Indian Rupee (INR) personal budgeting.</span>
          <span>Client-side data security &bull; No automatic bank scraping</span>
        </div>
      </footer>

      {/* Legal Dialog */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        type={legalModalType}
      />
    </div>
  );
}
