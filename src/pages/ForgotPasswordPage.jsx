import React, { useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import {
  Mail,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

export function ForgotPasswordPage() {
  const { setCurrentPage } = useFinance();
  const { resetPasswordForEmail, isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!isConfigured) {
      setErrorMessage(
        'Supabase is not configured yet. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env.local file.'
      );
      return;
    }

    setLoading(true);

    try {
      const { error } = await resetPasswordForEmail(email);

      if (error) {
        setErrorMessage(error.message || 'Unable to process recovery request. Please try again.');
        setLoading(false);
        return;
      }

      // Show confirmation message without exposing account existence details
      setSubmitted(true);
      setLoading(false);
    } catch (err) {
      setErrorMessage(err.message || 'A network error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card-container">
        {/* Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-brand-logo" onClick={() => setCurrentPage('landing')}>
            <span>₹</span>
          </div>
          <h1 className="auth-card-title">Reset your password</h1>
          <p className="auth-card-subtitle">
            Enter your email and we'll send you a secure link to reset your SpendSense password.
          </p>
        </div>

        {/* Development configuration banner if Supabase env vars missing */}
        {!isConfigured && (
          <div className="dev-config-banner">
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <strong>Supabase Setup Notice:</strong> Password recovery requires configured Supabase keys.
              Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code>.
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="auth-card">
          {submitted ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--soft-emerald-bg)', color: 'var(--emerald-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={26} />
                </div>
              </div>
              <h2 style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                Check Your Inbox
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                If an account exists with <strong>{email}</strong>, a password reset link has been dispatched.
                Please check your inbox and spam folder.
              </p>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setCurrentPage('signin')}
                  style={{ width: '100%' }}
                >
                  Return to Sign In
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {/* Error banner */}
              {errorMessage && (
                <div className="alert-card alert-card-danger" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--expense-rose)' }} />
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>
                      {errorMessage}
                    </span>
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className="auth-input-group">
                <label className="form-label" htmlFor="forgot-email">
                  Account Email Address
                </label>
                <div className="input-prefix-wrapper">
                  <span className="input-prefix">
                    <Mail size={15} />
                  </span>
                  <input
                    id="forgot-email"
                    type="email"
                    className="form-input with-prefix"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={loading}
                icon={loading ? null : ArrowRight}
                iconPosition="right"
                style={{ width: '100%', marginTop: 'var(--space-2)' }}
              >
                {loading ? 'Sending Link...' : 'Send Recovery Link'}
              </Button>
            </form>
          )}

          {/* Back to Sign In Link */}
          <div className="auth-footer">
            <button
              type="button"
              className="auth-link"
              onClick={() => setCurrentPage('signin')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
            >
              <ArrowLeft size={14} />
              <span>Back to Sign In</span>
            </button>
          </div>
        </div>

        {/* Back to Home */}
        <div className="auth-back-to-home">
          <button
            type="button"
            className="auth-link"
            onClick={() => setCurrentPage('landing')}
          >
            &larr; Back to SpendSense Home
          </button>
        </div>
      </div>
    </div>
  );
}
