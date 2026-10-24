import React, { useState, useMemo } from 'react';
import { useFinance } from '../hooks/useFinance';
import { formatINR, formatDate } from '../utils/formatters';
import { DEFAULT_CATEGORIES } from '../data/defaultCategories';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  FileSpreadsheet,
  ArrowUpDown,
  Layers,
  Sparkles,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export function TransactionsPage() {
  const {
    transactions,
    isSampleMode,
    deleteTransaction,
    openAddTxnModal,
    switchToSampleMode,
    setCurrentPage
  } = useFinance();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('all'); // 'all' | '2026-10' | etc.
  const [typeFilter, setTypeFilter] = useState('all');   // 'all' | 'expense' | 'income'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [natureFilter, setNatureFilter] = useState('all'); // 'all' | 'need' | 'want' | 'investment'
  const [sortOrder, setSortOrder] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'desc-asc'

  // Delete Confirmation Modal State
  const [txnToDelete, setTxnToDelete] = useState(null);

  // Extract distinct available months from transactions
  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        monthsSet.add(t.date.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [transactions]);

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Search match
      const query = searchTerm.toLowerCase().trim();
      const matchSearch =
        !query ||
        t.description?.toLowerCase().includes(query) ||
        t.notes?.toLowerCase().includes(query) ||
        t.paymentMethod?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query);

      // Month match
      const matchMonth = monthFilter === 'all' || (t.date && t.date.startsWith(monthFilter));

      // Type match
      const matchType = typeFilter === 'all' || t.type === typeFilter;

      // Category match
      const matchCategory = categoryFilter === 'all' || t.category === categoryFilter;

      // Nature match
      const matchNature = natureFilter === 'all' || t.nature === natureFilter;

      return matchSearch && matchMonth && matchType && matchCategory && matchNature;
    }).sort((a, b) => {
      if (sortOrder === 'date-desc') return new Date(b.date || 0) - new Date(a.date || 0);
      if (sortOrder === 'date-asc') return new Date(a.date || 0) - new Date(b.date || 0);
      if (sortOrder === 'amount-desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortOrder === 'amount-asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      if (sortOrder === 'desc-asc') return (a.description || '').localeCompare(b.description || '');
      return 0;
    });
  }, [transactions, searchTerm, monthFilter, typeFilter, categoryFilter, natureFilter, sortOrder]);

  // Aggregated totals for the active filtered selection
  const filterStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((t) => {
      const amt = Math.abs(Number(t.amount)) || 0;
      if (t.type === 'income') income += amt;
      else expense += amt;
    });
    return {
      count: filteredTransactions.length,
      income,
      expense,
      net: income - expense
    };
  }, [filteredTransactions]);

  const confirmDelete = () => {
    if (txnToDelete && txnToDelete.id) {
      deleteTransaction(txnToDelete.id);
      setTxnToDelete(null);
    }
  };

  const hasActiveFilters =
    Boolean(searchTerm) ||
    monthFilter !== 'all' ||
    typeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    natureFilter !== 'all';

  const resetAllFilters = () => {
    setSearchTerm('');
    setMonthFilter('all');
    setTypeFilter('all');
    setCategoryFilter('all');
    setNatureFilter('all');
    setSortOrder('date-desc');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header with Stats & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
            <h2 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>Transactions Ledger</h2>
            <Badge variant={isSampleMode ? 'amber' : 'emerald'}>
              {isSampleMode ? 'Demo Mode' : 'Personal Data'}
            </Badge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Track, edit, categorize, and search all your income and expenses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={FileSpreadsheet}
            onClick={() => setCurrentPage('import')}
          >
            Import CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => openAddTxnModal()}
          >
            Add Transaction
          </Button>
        </div>
      </div>

      {/* 2. Selection Metric Summary Bar */}
      <div
        className="card"
        style={{
          padding: 'var(--space-3) var(--space-5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        <div className="flex items-center gap-3">
          <Badge variant="indigo" icon={Layers}>
            {filterStats.count} of {transactions.length} Records
          </Badge>
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-indigo)' }}
              onClick={resetAllFilters}
            >
              Clear all filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-6" style={{ fontSize: 'var(--text-xs)' }}>
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--text-muted)' }}>Filtered Inflows:</span>
            <span className="amount-cell amount-income">+{formatINR(filterStats.income)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--text-muted)' }}>Filtered Outflows:</span>
            <span className="amount-cell amount-expense">-{formatINR(filterStats.expense)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--text-muted)' }}>Net Balance:</span>
            <span
              className="amount-cell"
              style={{
                color: filterStats.net >= 0 ? 'var(--emerald-600)' : 'var(--rose-600)'
              }}
            >
              {formatINR(filterStats.net)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Search and Multi-Dimensional Filter Bar */}
      <div className="filter-bar">
        {/* Search Input */}
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by merchant, note, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search transactions"
          />
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: 'var(--text-xs)' }}
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            aria-label="Filter by month"
          >
            <option value="all">All Months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: 'var(--text-xs)' }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by transaction type"
          >
            <option value="all">All Types</option>
            <option value="expense">Debits (Expenses)</option>
            <option value="income">Credits (Income)</option>
          </select>

          {/* Category Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: 'var(--text-xs)' }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Nature Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: 'var(--text-xs)' }}
            value={natureFilter}
            onChange={(e) => setNatureFilter(e.target.value)}
            aria-label="Filter by nature"
          >
            <option value="all">All Natures</option>
            <option value="need">Needs (Essential)</option>
            <option value="want">Wants (Discretionary)</option>
            <option value="investment">Savings &amp; Investments</option>
          </select>

          {/* Sort Order */}
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: 'var(--text-xs)' }}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label="Sort order"
          >
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
            <option value="amount-desc">Amount (Highest First)</option>
            <option value="amount-asc">Amount (Lowest First)</option>
            <option value="desc-asc">Description (A-Z)</option>
          </select>
        </div>
      </div>

      {/* 4. Responsive Transaction Ledger Table */}
      <div className="table-container">
        <table className="fin-table">
          <thead>
            <tr>
              <th style={{ width: '110px' }}>Date</th>
              <th>Description / Narrative</th>
              <th style={{ width: '180px' }}>Category</th>
              <th style={{ width: '110px' }}>Nature</th>
              <th style={{ width: '130px' }}>Payment Mode</th>
              <th style={{ textAlign: 'right', width: '140px' }}>Amount (₹)</th>
              <th style={{ textAlign: 'center', width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((t) => {
                const isIncome = t.type === 'income';
                let natureBadge = <Badge variant="neutral">{t.nature || 'other'}</Badge>;
                if (t.nature === 'need') natureBadge = <Badge variant="indigo">Need</Badge>;
                else if (t.nature === 'want') natureBadge = <Badge variant="amber">Want</Badge>;
                else if (t.nature === 'investment') natureBadge = <Badge variant="indigo">Investment</Badge>;
                else if (t.nature === 'refund') natureBadge = <Badge variant="emerald">Refund</Badge>;
                else if (isIncome) natureBadge = <Badge variant="emerald">Income</Badge>;

                return (
                  <tr key={t.id}>
                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {formatDate(t.date)}
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {t.description}
                        </span>
                        {t.notes && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {t.notes}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: 'var(--text-xs)' }}>
                        {t.category}
                      </span>
                    </td>
                    <td>{natureBadge}</td>
                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {t.paymentMethod || 'UPI'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`amount-cell ${isIncome ? 'amount-income' : 'amount-expense'}`}>
                        {isIncome ? `+${formatINR(t.amount)}` : `-${formatINR(t.amount)}`}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icon-only"
                          title="Edit transaction"
                          onClick={() => openAddTxnModal(t)}
                          aria-label={`Edit ${t.description}`}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icon-only"
                          title="Delete transaction"
                          style={{ color: 'var(--rose-600)' }}
                          onClick={() => setTxnToDelete(t)}
                          aria-label={`Delete ${t.description}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : transactions.length === 0 ? (
              // Empty State 1: Completely empty ledger
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                  <div className="flex flex-col items-center gap-3" style={{ maxWidth: 440, margin: '0 auto' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        backgroundColor: 'var(--soft-indigo-bg)',
                        color: 'var(--primary-indigo)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Plus size={24} />
                    </div>
                    <h3 style={{ fontSize: 'var(--text-lg)', color: 'var(--text-primary)', margin: 0 }}>
                      Your Ledger is Empty
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', lineHeight: 1.6, margin: 0 }}>
                      You are in your private personal workspace. Start recording your daily income and expenses manually, or explore the pre-loaded demo data.
                    </p>
                    <div className="flex items-center gap-2" style={{ marginTop: 'var(--space-2)' }}>
                      <Button variant="primary" size="sm" icon={Plus} onClick={() => openAddTxnModal()}>
                        Add First Transaction
                      </Button>
                      <Button variant="outline" size="sm" icon={Sparkles} onClick={switchToSampleMode}>
                        Load Demo Dataset
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              // Empty State 2: Filter yielded 0 matches
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <div className="flex flex-col items-center gap-2" style={{ maxWidth: 380, margin: '0 auto' }}>
                    <h3 style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', margin: 0 }}>
                      No Matching Transactions
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', margin: 0 }}>
                      No records matched your active search or filter selection.
                    </p>
                    <Button variant="secondary" size="sm" onClick={resetAllFilters} style={{ marginTop: 'var(--space-2)' }}>
                      Reset All Filters
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Accessible Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(txnToDelete)}
        onClose={() => setTxnToDelete(null)}
        title="Confirm Deletion"
        subtitle="This action will permanently remove this entry from your ledger"
        maxWidth="440px"
        footer={
          <div className="flex items-center justify-end gap-3" style={{ width: '100%' }}>
            <Button variant="secondary" onClick={() => setTxnToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" icon={Trash2} onClick={confirmDelete}>
              Delete Transaction
            </Button>
          </div>
        }
      >
        {txnToDelete && (
          <div className="flex flex-col gap-3">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
              Are you sure you want to delete this transaction from your records?
            </p>
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {txnToDelete.description}
              </span>
              <div className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                <span>{formatDate(txnToDelete.date)} • {txnToDelete.category}</span>
                <span className="amount-cell" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatINR(txnToDelete.amount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
