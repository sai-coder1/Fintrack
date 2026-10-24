import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Sidebar } from './components/common/Sidebar';
import { Navbar } from './components/common/Navbar';
import { SampleModeBanner } from './components/common/SampleModeBanner';

// Page Views
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { CsvImportPage } from './pages/CsvImportPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BudgetsGoalsPage } from './pages/BudgetsGoalsPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionFormModal } from './components/transactions/TransactionFormModal';

function AppContent() {
  const { currentPage } = useFinance();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
}
