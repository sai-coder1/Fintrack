import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Sidebar } from './components/common/Sidebar';
import { Navbar } from './components/common/Navbar';
import { SampleModeBanner } from './components/common/SampleModeBanner';
import { PROTECTED_PAGES, PUBLIC_PAGES } from './utils/navigation';

// Public & Authentication Views
import { LandingPage } from './pages/LandingPage';
import { SignUpPage } from './pages/SignUpPage';
import { SignInPage } from './pages/SignInPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

// Protected Application Views
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { CsvImportPage } from './pages/CsvImportPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BudgetsGoalsPage } from './pages/BudgetsGoalsPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionFormModal } from './components/transactions/TransactionFormModal';

function AppContent() {
  const { currentPage, setCurrentPage } = useFinance();
  const { user, loading, setIntendedPage, isPasswordRecovery } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 1. Synchronize root & recovery state
  useEffect(() => {
    if (loading) return;

    if (isPasswordRecovery && currentPage !== 'reset-password') {
      setCurrentPage('reset-password');
      return;
    }

    if (currentPage === 'root') {
      setCurrentPage(user ? 'dashboard' : 'landing');
    }
  }, [loading, user, isPasswordRecovery, currentPage, setCurrentPage]);

  // 2. Protect routes: redirect unauthenticated users away from financial pages
  useEffect(() => {
    if (loading) return;

    const isProtected = PROTECTED_PAGES.includes(currentPage);
    if (isProtected && !user) {
      setIntendedPage(currentPage);
      setCurrentPage('signin');
    }
  }, [loading, user, currentPage, setCurrentPage, setIntendedPage]);

  // 3. Redirect authenticated users away from public auth/landing pages to dashboard
  useEffect(() => {
    if (loading) return;

    const isPublicAuthOrLanding = ['landing', 'signin', 'signup', 'forgot-password'].includes(currentPage);
    if (user && isPublicAuthOrLanding) {
      setCurrentPage('dashboard');
    }
  }, [loading, user, currentPage, setCurrentPage]);

  // 4. Loading Splash Screen while checking initial Supabase session
  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-logo">
          <span>₹</span>
        </div>
        <p className="auth-loading-text">Loading SpendSense...</p>
      </div>
    );
  }

  // 5. Render Standalone Public & Auth Pages
  if (currentPage === 'landing' || (!user && currentPage === 'root')) {
    return <LandingPage />;
  }

  if (currentPage === 'signup') {
    return <SignUpPage />;
  }

  if (currentPage === 'signin' || (!user && !PROTECTED_PAGES.includes(currentPage) && currentPage !== 'reset-password' && currentPage !== 'forgot-password')) {
    return <SignInPage />;
  }

  if (currentPage === 'forgot-password') {
    return <ForgotPasswordPage />;
  }

  if (currentPage === 'reset-password') {
    return <ResetPasswordPage />;
  }

  // 6. Active Financial Application Views
  const renderActivePage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'transactions':
        return <TransactionsPage />;
      case 'import':
        return <CsvImportPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'budgets':
        return <BudgetsGoalsPage />;
      case 'simulator':
        return <SimulatorPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  // If user is not authenticated, do not expose any financial views or data shell
  if (!user) {
    return <SignInPage />;
  }

  return (
    <div className="app-wrapper">
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <div className="app-main">
        <Navbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <SampleModeBanner />
        <main className="page-container" id="main-content">
          {renderActivePage()}
        </main>
      </div>
      <TransactionFormModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <AppContent />
      </FinanceProvider>
    </AuthProvider>
  );
}
