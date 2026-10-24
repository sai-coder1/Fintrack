import React, { useState, useRef, useMemo } from 'react';
import { useFinance } from '../hooks/useFinance';
import { formatINR } from '../utils/formatters';
import { DEFAULT_CATEGORIES } from '../data/defaultCategories';
import {
  parseCsvFile,
  suggestColumnMapping,
  normalizeCsvRows
} from '../utils/csvParser';
import { detectBatchDuplicates } from '../utils/duplicateDetector';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  Check,
  XCircle,
  Table,
  Sliders,
  Filter,
  Layers,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function CsvImportPage() {
  const { transactions, addTransactionsBatch, setCurrentPage } = useFinance();

  // Wizard Step: 1: Upload | 2: Map Columns | 3: Preview & Deduplicate | 4: Complete
  const [currentStep, setCurrentStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState(null);

  // File metadata
  const [fileMeta, setFileMeta] = useState(null);
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [rawParsedRows, setRawParsedRows] = useState([]);

  // Column Mapping state
  const [mapping, setMapping] = useState({
    dateCol: '',
    descCol: '',
    amountMode: 'separate', // 'separate' | 'single'
    amountCol: '',
    debitCol: '',
    creditCol: '',
    typeCol: '',
    categoryCol: '',
    dateOrder: 'DD/MM/YYYY',
    signedConvention: 'negative_is_expense'
  });

  // Preview Candidate Rows (normalized and duplicate checked)
  const [previewRows, setPreviewRows] = useState([]);
  const [importSummary, setImportSummary] = useState(null);

  // Filter in preview table
  const [previewFilter, setPreviewFilter] = useState('all'); // 'all' | 'valid' | 'duplicates' | 'invalid'

  const fileInputRef = useRef(null);

  // Parse file content using Papa Parse
  const processCsvFile = async (fileOrText, fileName, fileSizeStr) => {
    setParseError(null);
    try {
      const result = await parseCsvFile(fileOrText);

      if (!result.headers || result.headers.length === 0) {
        throw new Error('No headers found in CSV file. Please ensure the file has a header row.');
      }

      if (!result.rows || result.rows.length === 0) {
        throw new Error('CSV file contains no transaction data rows.');
      }

      setParsedHeaders(result.headers);
      setRawParsedRows(result.rows);
      setFileMeta({
        name: fileName,
        size: fileSizeStr,
        totalRows: result.rows.length
      });

      // Suggest intelligent mapping
      const suggested = suggestColumnMapping(result.headers);
      setMapping(suggested);

      setCurrentStep(2);
    } catch (err) {
      console.error('[SpendSense CSV] Parsing error:', err);
      setParseError(err.message || 'Failed to parse CSV file. Ensure it is a valid comma-separated file.');
    }
  };

  // Handle local file selection from input
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Invalid file type: Please select a .csv statement file.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setParseError('File too large: Maximum supported CSV file size is 10MB.');
      return;
    }

    const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
    processCsvFile(file, file.name, sizeStr);
    e.target.value = '';
  };

  // Handle Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please drop a valid .csv bank statement file.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setParseError('File exceeds 10MB limit.');
      return;
    }

    const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
    processCsvFile(file, file.name, sizeStr);
  };

  // Quick Demo Statement Loader
  const loadDemoStatement = async (fileName) => {
    setParseError(null);
    try {
      const response = await fetch(`/${fileName}`);
      if (!response.ok) {
        throw new Error(`Could not fetch demo file /${fileName}`);
      }
      const text = await response.text();
      processCsvFile(text, fileName, `${(text.length / 1024).toFixed(1)} KB`);
    } catch (err) {
      setParseError(`Failed to load demo statement: ${err.message}`);
    }
  };

  // Proceed from Mapping to Preview
  const handleProceedToPreview = () => {
    // Basic mapping validation
    if (!mapping.dateCol) {
      alert('Please select the Transaction Date column.');
      return;
    }
    if (!mapping.descCol) {
      alert('Please select the Narration / Description column.');
      return;
    }
    if (mapping.amountMode === 'separate') {
      if (!mapping.debitCol && !mapping.creditCol) {
        alert('Please select at least one of Debit or Credit columns.');
        return;
      }
    } else {
      if (!mapping.amountCol) {
        alert('Please select the Amount column.');
        return;
      }
    }

    // 1. Normalize rows into candidate transactions
    const normalized = normalizeCsvRows(rawParsedRows, mapping);

    // 2. Run duplicate detection against existing storage and within batch
    const deduplicated = detectBatchDuplicates(normalized, transactions);

    setPreviewRows(deduplicated);
    setCurrentStep(3);
  };

  // Toggle selection for a specific row
  const toggleRowSelection = (id) => {
    setPreviewRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  // Override category in preview
  const handleCategoryOverride = (id, newCatName) => {
    const matched = DEFAULT_CATEGORIES.find((c) => c.name === newCatName);
    setPreviewRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            category: newCatName,
            nature: matched ? matched.defaultNature : r.nature
          };
        }
        return r;
      })
    );
  };

  // Bulk selection actions
  const selectAllValid = () => {
    setPreviewRows((prev) =>
      prev.map((r) => ({ ...r, selected: r.isValid && !r.isDuplicate }))
    );
  };

  const selectEverythingValid = () => {
    setPreviewRows((prev) =>
      prev.map((r) => ({ ...r, selected: r.isValid }))
    );
  };

  const deselectAll = () => {
    setPreviewRows((prev) =>
      prev.map((r) => ({ ...r, selected: false }))
    );
  };

  // Confirm Import
  const handleConfirmImport = () => {
    const toImport = previewRows.filter((r) => r.selected && r.isValid);

    if (toImport.length === 0) {
      alert('No valid rows selected for import.');
      return;
    }

    // Prepare clean transactions for insertion
    const importPayload = toImport.map((r) => ({
      date: r.date,
      description: r.description,
      amount: r.amount,
      type: r.type,
      category: r.category,
      nature: r.nature,
      paymentMethod: r.paymentMethod || 'Net Banking',
      source: 'csv_import',
      hash: r.hash
    }));

    // Commit batch to FinanceContext
    const countAdded = addTransactionsBatch(importPayload);

    const duplicateCount = previewRows.filter((r) => r.isDuplicate).length;
    const invalidCount = previewRows.filter((r) => !r.isValid).length;
    const skippedCount = previewRows.length - countAdded;

    setImportSummary({
      total: previewRows.length,
      imported: countAdded,
      duplicates: duplicateCount,
      invalid: invalidCount,
      skipped: skippedCount
    });

    setCurrentStep(5);
  };

  const handleResetWorkflow = () => {
    setCurrentStep(1);
    setFileMeta(null);
    setParsedHeaders([]);
    setRawParsedRows([]);
    setPreviewRows([]);
    setImportSummary(null);
    setParseError(null);
  };

  // Preview Filtered Rows
  const displayedPreviewRows = useMemo(() => {
    if (previewFilter === 'valid') {
      return previewRows.filter((r) => r.isValid && !r.isDuplicate);
    }
    if (previewFilter === 'duplicates') {
      return previewRows.filter((r) => r.isDuplicate);
    }
    if (previewFilter === 'invalid') {
      return previewRows.filter((r) => !r.isValid);
    }
    return previewRows;
  }, [previewRows, previewFilter]);

  // Statistics for Preview Table
  const previewStats = useMemo(() => {
    const total = previewRows.length;
    const valid = previewRows.filter((r) => r.isValid && !r.isDuplicate).length;
    const duplicates = previewRows.filter((r) => r.isDuplicate).length;
    const invalid = previewRows.filter((r) => !r.isValid).length;
    const selected = previewRows.filter((r) => r.selected && r.isValid).length;
    return { total, valid, duplicates, invalid, selected };
  }, [previewRows]);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header with Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: '4px' }}>
            CSV Bank Statement Ingestion
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Upload, map columns, auto-categorize, and verify duplicate transactions client-side.
          </p>
        </div>
        {currentStep > 1 && (
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={handleResetWorkflow}>
            Start Over
          </Button>
        )}
      </div>

      {/* 2. Visual 5-Step Pipeline Indicator */}
      <div className="card" style={{ padding: 'var(--space-4) var(--space-6)' }}>
        <div className="pipeline-steps">
          <div className={`step-node ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}>
            <span className="step-number">{currentStep > 1 ? <Check size={14} /> : '1'}</span>
            <span className="step-label">Upload Statement</span>
          </div>
          <div className={`step-node ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}>
            <span className="step-number">{currentStep > 2 ? <Check size={14} /> : '2'}</span>
            <span className="step-label">Map Columns</span>
          </div>
          <div className={`step-node ${currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : ''}`}>
            <span className="step-number">{currentStep > 3 ? <Check size={14} /> : '3'}</span>
            <span className="step-label">Preview &amp; Validate</span>
          </div>
          <div className={`step-node ${currentStep === 5 ? 'completed' : ''}`}>
            <span className="step-number">{currentStep === 5 ? <Check size={14} /> : '4'}</span>
            <span className="step-label">Import Complete</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {parseError && (
        <div
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--rose-50)',
            color: 'var(--rose-700)',
            border: '1px solid var(--rose-200)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>{parseError}</span>
        </div>
      )}

      {/* 3. Step 1: Upload Dropzone & Supported Guidance */}
      {currentStep === 1 && (
        <div className="flex flex-col gap-6">
          <input
            type="file"
            accept=".csv,text/csv"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />

          <div
            className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="upload-icon-box">
              <UploadCloud size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 4 }}>
                Drag and drop your bank statement (.csv) here
              </h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                Supports standard comma-separated bank statements (up to 10MB)
              </p>
            </div>
            <div className="flex items-center gap-2" style={{ marginTop: 'var(--space-2)' }}>
              <Button
                variant="primary"
                size="sm"
                icon={FileSpreadsheet}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Browse Local File
              </Button>
            </div>
          </div>

          {/* Preset Demo Statement Loaders */}
          <Card
            title="Try with Pre-Configured Sample Statements"
            subtitle="Explore statement ingestion using realistic Indian bank statement formats"
          >
            <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <Button
                variant="outline-indigo"
                size="sm"
                icon={FileSpreadsheet}
                onClick={() => loadDemoStatement('sample_hdfc_statement.csv')}
              >
                Load HDFC Statement (Dual Debit &amp; Credit Columns)
              </Button>
              <Button
                variant="outline-indigo"
                size="sm"
                icon={FileSpreadsheet}
                onClick={() => loadDemoStatement('sample_sbi_statement.csv')}
              >
                Load SBI Statement (Single Signed Amount Column)
              </Button>
            </div>
          </Card>

          {/* Supported Format Guidance Cards */}
          <div className="grid grid-cols-3">
            <Card title="HDFC, ICICI & Kotak Format">
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Handles separate <strong>Withdrawal Amount</strong> and <strong>Deposit Amount</strong> columns, comma-separated narrations, and dates formatted as <code>DD/MM/YYYY</code>.
              </p>
            </Card>
            <Card title="SBI & Axis Bank Format">
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Handles single <strong>Txn Amount</strong> with negative numbers or CR/DR indicators and date formats formatted as <code>DD-MM-YYYY</code>.
              </p>
            </Card>
            <Card title="Client-Side Privacy Guarantee">
              <div className="flex items-center gap-2" style={{ color: 'var(--primary-indigo)', fontWeight: 600, fontSize: 'var(--text-xs)', marginBottom: 4 }}>
                <ShieldCheck size={16} />
                <span>Zero Server Uploads</span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                Statements are parsed purely inside your browser using Papa Parse. No financial figures or banking narrations leave your device.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* 4. Step 2: Column Mapping Interface */}
      {currentStep === 2 && fileMeta && (
        <Card
          title="Map Statement Columns"
          subtitle={`File: ${fileMeta.name} (${fileMeta.size}, ${fileMeta.totalRows} raw rows detected)`}
          footer={
            <div className="flex items-center justify-between" style={{ width: '100%' }}>
              <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => setCurrentStep(1)}>
                Back to Upload
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={ArrowRight}
                iconPosition="right"
                onClick={handleProceedToPreview}
              >
                Proceed to Preview &amp; Validate
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-6">
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}
            >
              SpendSense automatically evaluated the header row and pre-mapped matching columns. Verify or adjust the mapping below.
            </div>

            {/* Date & Date Format Settings */}
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Transaction Date Column <span style={{ color: 'var(--rose-600)' }}>*</span>
                </label>
                <select
                  className="form-select"
                  value={mapping.dateCol}
                  onChange={(e) => setMapping({ ...mapping, dateCol: e.target.value })}
                >
                  <option value="">-- Select Date Column --</option>
                  {parsedHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date Order Convention</label>
                <select
                  className="form-select"
                  value={mapping.dateOrder}
                  onChange={(e) => setMapping({ ...mapping, dateOrder: e.target.value })}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (Standard Indian Banking)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Format)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (US Bank Format)</option>
                </select>
              </div>
            </div>

            {/* Description Column */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Narration / Description Column <span style={{ color: 'var(--rose-600)' }}>*</span>
              </label>
              <select
                className="form-select"
                value={mapping.descCol}
                onChange={(e) => setMapping({ ...mapping, descCol: e.target.value })}
              >
                <option value="">-- Select Narration Column --</option>
                {parsedHeaders.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Configuration Mode Toggle */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Amount Column Structure</label>
              <div className="segmented-control" role="group">
                <button
                  type="button"
                  className={`segmented-btn ${mapping.amountMode === 'separate' ? 'active' : ''}`}
                  onClick={() => setMapping({ ...mapping, amountMode: 'separate' })}
                >
                  Separate Debit &amp; Credit Columns (e.g. HDFC/ICICI)
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${mapping.amountMode === 'single' ? 'active' : ''}`}
                  onClick={() => setMapping({ ...mapping, amountMode: 'single' })}
                >
                  Single Amount Column (e.g. SBI/Axis)
                </button>
              </div>
            </div>

            {/* Separate Mode Options */}
            {mapping.amountMode === 'separate' ? (
              <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Withdrawal / Debit Column (Outflows) <span style={{ color: 'var(--rose-600)' }}>*</span>
                  </label>
                  <select
                    className="form-select"
                    value={mapping.debitCol}
                    onChange={(e) => setMapping({ ...mapping, debitCol: e.target.value })}
                  >
                    <option value="">-- None / Select Debit Column --</option>
                    {parsedHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Deposit / Credit Column (Inflows) <span style={{ color: 'var(--rose-600)' }}>*</span>
                  </label>
                  <select
                    className="form-select"
                    value={mapping.creditCol}
                    onChange={(e) => setMapping({ ...mapping, creditCol: e.target.value })}
                  >
                    <option value="">-- None / Select Credit Column --</option>
                    {parsedHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              /* Single Amount Column Options */
              <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Amount Column <span style={{ color: 'var(--rose-600)' }}>*</span>
                  </label>
                  <select
                    className="form-select"
                    value={mapping.amountCol}
                    onChange={(e) => setMapping({ ...mapping, amountCol: e.target.value })}
                  >
                    <option value="">-- Select Amount Column --</option>
                    {parsedHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Signed Amount Convention</label>
                  <select
                    className="form-select"
                    value={mapping.signedConvention}
                    onChange={(e) => setMapping({ ...mapping, signedConvention: e.target.value })}
                  >
                    <option value="negative_is_expense">Negative numbers = Outflows / Debits (-450 = Expense)</option>
                    <option value="positive_is_expense">Positive numbers = Outflows / Debits (450 = Expense)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 5. Step 3: Interactive Preview & Deduplication Table */}
      {currentStep === 3 && (
        <Card
          title="Preview &amp; Validate Import Rows"
          subtitle="Review candidate transactions, duplicate detection results, and auto-assigned categories"
          action={
            <div className="flex items-center gap-2">
              <Badge variant="indigo">
                {previewStats.selected} of {previewStats.total} Rows Selected
              </Badge>
            </div>
          }
          footer={
            <div className="flex items-center justify-between" style={{ width: '100%' }}>
              <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => setCurrentStep(2)}>
                Back to Mapping
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={CheckCircle2}
                disabled={previewStats.selected === 0}
                onClick={handleConfirmImport}
              >
                Confirm Import ({previewStats.selected} Transactions)
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            {/* Filter Pills & Bulk Select Actions */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${previewFilter === 'all' ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setPreviewFilter('all')}
                >
                  All Rows ({previewStats.total})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${previewFilter === 'valid' ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setPreviewFilter('valid')}
                >
                  Valid New ({previewStats.valid})
                </button>
                {previewStats.duplicates > 0 && (
                  <button
                    type="button"
                    className={`btn btn-sm ${previewFilter === 'duplicates' ? 'btn-secondary' : 'btn-ghost'}`}
                    style={{ color: 'var(--amber-700)' }}
                    onClick={() => setPreviewFilter('duplicates')}
                  >
                    Duplicates ({previewStats.duplicates})
                  </button>
                )}
                {previewStats.invalid > 0 && (
                  <button
                    type="button"
                    className={`btn btn-sm ${previewFilter === 'invalid' ? 'btn-secondary' : 'btn-ghost'}`}
                    style={{ color: 'var(--rose-700)' }}
                    onClick={() => setPreviewFilter('invalid')}
                  >
                    Invalid Rows ({previewStats.invalid})
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.6875rem' }}
                  onClick={selectAllValid}
                >
                  Select Valid Only
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.6875rem' }}
                  onClick={deselectAll}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Candidate Preview Table */}
            <div className="table-container">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>Import</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Row #</th>
                    <th style={{ width: '100px' }}>Date</th>
                    <th>Description</th>
                    <th style={{ width: '180px' }}>Category</th>
                    <th style={{ textAlign: 'right', width: '130px' }}>Amount (₹)</th>
                    <th style={{ width: '170px', textAlign: 'center' }}>Validation &amp; Duplicates</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPreviewRows.map((r) => {
                    const isIncome = r.type === 'income';

                    return (
                      <tr
                        key={r.id}
                        style={{
                          backgroundColor: !r.isValid
                            ? 'var(--rose-50)'
                            : r.isDuplicate && !r.selected
                            ? 'var(--amber-50)'
                            : undefined
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(r.selected)}
                            disabled={!r.isValid}
                            onChange={() => toggleRowSelection(r.id)}
                            aria-label={`Select row ${r.rowIndex}`}
                          />
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          #{r.rowIndex}
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)' }}>
                          {r.date || <span style={{ color: 'var(--rose-600)' }}>Missing</span>}
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {r.description}
                            </span>
                            {r.errors && r.errors.length > 0 && (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--rose-600)' }}>
                                {r.errors.join(' • ')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {r.isValid ? (
                            <select
                              className="form-select"
                              style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-xs)' }}
                              value={r.category}
                              onChange={(e) => handleCategoryOverride(r.id, e.target.value)}
                            >
                              {DEFAULT_CATEGORIES.map((cat) => (
                                <option key={cat.id} value={cat.name}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge variant="neutral">Unassigned</Badge>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span
                            className={`amount-cell ${isIncome ? 'amount-income' : 'amount-expense'}`}
                          >
                            {isIncome ? `+${formatINR(r.amount)}` : `-${formatINR(r.amount)}`}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {!r.isValid ? (
                            <Badge variant="rose" icon={XCircle}>
                              Invalid Data
                            </Badge>
                          ) : r.isDuplicate ? (
                            <Badge
                              variant="amber"
                              icon={AlertTriangle}
                              title={r.duplicateReason}
                            >
                              {r.duplicateSource === 'existing' ? 'Matches Ledger' : 'Batch Duplicate'}
                            </Badge>
                          ) : (
                            <Badge variant="emerald" icon={CheckCircle2}>
                              Valid New
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* 6. Step 5: Import Complete Result State */}
      {currentStep === 5 && importSummary && (
        <Card>
          <div className="placeholder-card" style={{ border: 'none', margin: '1rem auto' }}>
            <div
              className="placeholder-icon-box"
              style={{
                backgroundColor: 'var(--emerald-50)',
                color: 'var(--emerald-600)',
                borderColor: 'var(--emerald-100)'
              }}
            >
              <CheckCircle2 size={34} />
            </div>
            <h3 style={{ fontSize: 'var(--text-2xl)', color: 'var(--text-primary)', margin: 0 }}>
              Statement Successfully Imported!
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: 520, lineHeight: 1.6 }}>
              Added <strong>{importSummary.imported}</strong> new transactions into your active SpendSense ledger. Your Dashboard, Transactions ledger, and Analytics are updated immediately.
            </p>

            {/* Diagnostic breakdown tags */}
            <div className="flex items-center gap-3" style={{ margin: 'var(--space-2) 0' }}>
              <Badge variant="emerald">{importSummary.imported} Transactions Imported</Badge>
              {importSummary.duplicates > 0 && (
                <Badge variant="amber">{importSummary.duplicates} Duplicates Skipped</Badge>
              )}
              {importSummary.invalid > 0 && (
                <Badge variant="neutral">{importSummary.invalid} Invalid Rows Ignored</Badge>
              )}
            </div>

            <div className="flex items-center gap-3" style={{ marginTop: 'var(--space-2)' }}>
              <Button variant="primary" icon={Table} onClick={() => setCurrentPage('transactions')}>
                View in Transactions Ledger
              </Button>
              <Button variant="secondary" icon={RefreshCw} onClick={handleResetWorkflow}>
                Import Another Statement
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
