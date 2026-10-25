import React, { useState, useEffect } from 'react';
import { useFinance } from '../../hooks/useFinance';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { DEFAULT_CATEGORIES } from '../../data/defaultCategories';
import { ArrowDownLeft, ArrowUpRight, IndianRupee, AlertCircle } from 'lucide-react';

export function TransactionFormModal() {
  const {
    isTxnModalOpen,
    closeTxnModal,
    editingTransaction,
    addTransaction,
    updateTransaction
  } = useFinance();

  const [formData, setFormData] = useState({
    date: '2026-10-24',
    description: '',
    amount: '',
    type: 'expense',
    category: 'Food & Dining Out',
    nature: 'want',
    paymentMethod: 'UPI',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (editingTransaction) {
      setFormData({
        date: editingTransaction.date || '2026-10-24',
        description: editingTransaction.description || '',
        amount: editingTransaction.amount !== undefined ? String(editingTransaction.amount) : '',
        type: editingTransaction.type || 'expense',
        category: editingTransaction.category || 'Food & Dining Out',
        nature: editingTransaction.nature || 'want',
        paymentMethod: editingTransaction.paymentMethod || 'UPI',
        notes: editingTransaction.notes || ''
      });
      setErrors({});
    } else {
      setFormData({
        date: '2026-10-24',
        description: '',
        amount: '',
        type: 'expense',
        category: 'Food & Dining Out',
        nature: 'want',
        paymentMethod: 'UPI',
        notes: ''
      });
      setErrors({});
    }
    setSubmitError(null);
    setSubmitting(false);
  }, [editingTransaction, isTxnModalOpen]);

  // Sync category change with default nature
  const handleCategoryChange = (e) => {
    const catName = e.target.value;
    const matched = DEFAULT_CATEGORIES.find((c) => c.name === catName);
    setFormData((prev) => ({
      ...prev,
      category: catName,
      nature: matched ? matched.defaultNature : prev.nature,
      type: matched && matched.type === 'income' ? 'income' : prev.type
    }));
  };

  const handleTypeChange = (newType) => {
    setFormData((prev) => {
      let defaultCat = prev.category;
      let defaultNature = prev.nature;
      if (newType === 'income') {
        defaultCat = 'Salary & Income';
        defaultNature = 'income';
      } else if (prev.category === 'Salary & Income') {
        defaultCat = 'Food & Dining Out';
        defaultNature = 'want';
      }
      return {
        ...prev,
        type: newType,
        category: defaultCat,
        nature: defaultNature
      };
    });
  };

  const validate = () => {
    const errs = {};
    if (!formData.description.trim()) {
      errs.description = 'Merchant or description is required';
    }
    const numAmt = parseFloat(formData.amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      errs.amount = 'Please enter a valid positive amount in ₹ (INR)';
    }
    if (!formData.date) {
      errs.date = 'Transaction date is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      ...formData,
      amount: parseFloat(formData.amount)
    };

    try {
      if (editingTransaction && editingTransaction.id) {
        const result = await updateTransaction(editingTransaction.id, payload);
        if (!result || result.error) {
          setSubmitError(result?.error || 'Failed to update transaction.');
          setSubmitting(false);
          return;
        }
      } else {
        const result = await addTransaction(payload);
        if (!result || result.error) {
          setSubmitError(result?.error || 'Failed to save transaction.');
          setSubmitting(false);
          return;
        }
      }

      closeTxnModal();
    } catch (err) {
      setSubmitError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = Boolean(editingTransaction && editingTransaction.id);

  return (
    <Modal
      isOpen={isTxnModalOpen}
      onClose={closeTxnModal}
      title={isEditing ? 'Edit Transaction' : 'Record New Transaction'}
      subtitle="Manually track a debit or credit in your local ledger"
      maxWidth="520px"
      footer={
        <div className="flex items-center justify-end gap-3" style={{ width: '100%' }}>
          <Button variant="secondary" onClick={closeTxnModal} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add to Ledger')}
          </Button>
        </div>
      }
    >
      {submitError && (
        <div className="alert-card alert-card-danger" style={{ padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--expense-rose)' }} />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-primary)' }}>
              {submitError}
            </span>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Type Toggle: Expense vs Income */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Transaction Type</label>
          <div className="segmented-control" role="group">
            <button
              type="button"
              className={`segmented-btn ${formData.type === 'expense' ? 'active danger' : ''}`}
              onClick={() => handleTypeChange('expense')}
            >
              <ArrowUpRight size={16} />
              <span>Expense (Debit)</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${formData.type === 'income' ? 'active success' : ''}`}
              onClick={() => handleTypeChange('income')}
            >
              <ArrowDownLeft size={16} />
              <span>Income (Credit)</span>
            </button>
          </div>
        </div>

        {/* Amount & Date in 2 columns */}
        <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="txn-amount">
              Amount (₹ INR) <span style={{ color: 'var(--rose-600)' }}>*</span>
            </label>
            <div className="input-prefix-wrapper">
              <span className="input-prefix">₹</span>
              <input
                id="txn-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? 'txn-amount-error' : undefined}
                className={`form-input with-prefix ${errors.amount ? 'error' : ''}`}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            {errors.amount && (
              <span id="txn-amount-error" className="form-error">
                {errors.amount}
              </span>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="txn-date">
              Date <span style={{ color: 'var(--rose-600)' }}>*</span>
            </label>
            <input
              id="txn-date"
              type="date"
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? 'txn-date-error' : undefined}
              className={`form-input ${errors.date ? 'error' : ''}`}
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
            {errors.date && (
              <span id="txn-date-error" className="form-error">
                {errors.date}
              </span>
            )}
          </div>
        </div>

        {/* Description / Merchant */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="txn-desc">
            Description / Merchant <span style={{ color: 'var(--rose-600)' }}>*</span>
          </label>
          <input
            id="txn-desc"
            type="text"
            placeholder="e.g. Swiggy Gourmet, Reliance Fresh, Apartment Rent"
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'txn-desc-error' : undefined}
            className={`form-input ${errors.description ? 'error' : ''}`}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          {errors.description && (
            <span id="txn-desc-error" className="form-error">
              {errors.description}
            </span>
          )}
        </div>

        {/* Category & Nature in 2 columns */}
        <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="txn-cat">Category</label>
            <select
              id="txn-cat"
              className="form-select"
              value={formData.category}
              onChange={handleCategoryChange}
            >
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="txn-nature">Nature of Expense</label>
            <select
              id="txn-nature"
              className="form-select"
              value={formData.nature}
              onChange={(e) => setFormData({ ...formData, nature: e.target.value })}
              disabled={formData.type === 'income'}
            >
              <option value="need">Need (Essential)</option>
              <option value="want">Want (Discretionary)</option>
              <option value="investment">Savings / Investment</option>
              {formData.type === 'income' && <option value="income">Income</option>}
            </select>
          </div>
        </div>

        {/* Payment Method */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="txn-payment">Payment Method</label>
          <select
            id="txn-payment"
            className="form-select"
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
          >
            <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Debit Card">Debit Card</option>
            <option value="Net Banking">Net Banking / NEFT / IMPS</option>
            <option value="Cash">Cash</option>
          </select>
        </div>

        {/* Notes */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="txn-notes">Notes (Optional)</label>
          <input
            id="txn-notes"
            type="text"
            placeholder="Add context or split details..."
            className="form-input"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
}
