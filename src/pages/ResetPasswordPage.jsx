import React, { useState, useEffect } from 'react';
import { useFinance } from '../hooks/useFinance';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import {
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  KeyRound
} from 'lucide-react';

export function ResetPasswordPage() {
  const { setCurrentPage } = useFinance();
  const { session, user, isPasswordRecovery, updatePassword, isConfigured } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  // Determine if recovery session or token is valid
  // (Either isPasswordRecovery flag is true, an active session exists, or url hash has access_token)
  const [isLinkValid, setIsLinkValid] = useState(true);

  useEffect(() => {
    const hash = window.location.hash || '';
    const hasRecoveryToken = hash.includes('access_token') || hash.includes('type=recovery');
    const hasSession = Boolean(session || user || isPasswordRecovery);

    // If neither recovery session nor recovery hash is found, mark as invalid link
    if (!hasRecoveryToken && !hasSession && isConfigured) {
      setIsLinkValid(false);
    } else {
      setIsLinkValid(true);
    }
  }, [session, user, isPasswordRecovery, isConfigured]);

  const isMinLength = newPassword.length >= 8;
  const isMatching = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isMinLength) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await updatePassword(newPassword);

      if (error) {
        if (error.message?.toLowerCase().includes('expired') || error.message?.toLowerCase().includes('invalid')) {
          setErrorMessage('The recovery session has expired or is invalid. Please request a new password recovery link.');
          setIsLinkValid(false);
        } else {
          setErrorMessage(error.message || 'Failed to update password. Please try again.');
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
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
          <h1 className="auth-card-title">Set new password</h1>
          <p className="auth-card-subtitle">
            Choose a strong, secure password for your FinTrack account.
          </p>
        </div>

        {/* Main Card */}
        <div className="auth-card">
          {!isLinkValid ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--soft-rose-bg)', color: 'var(--expense-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={26} />
                </div>
              </div>
              <h2 style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                Invalid or Expired Link
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                This password reset link is invalid or has already expired. For security reasons, recovery links can only be used once.
              </p>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setCurrentPage('forgot-password')}
                  style={{ width: '100%' }}
                >
                  Request a New Link
                </Button>
              </div>
            </div>
          ) : success ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--soft-emerald-bg)', color: 'var(--emerald-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={26} />
                </div>
              </div>
              <h2 style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                Password Updated!
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Your FinTrack password has been successfully reset. You can now access your dashboard.
              </p>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Button
                  variant="primary"
                  size="md"
                  icon={ArrowRight}
                  iconPosition="right"
                  onClick={() => setCurrentPage('dashboard')}
                  style={{ width: '100%' }}
                >
                  Continue to Dashboard
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

              {/* New Password */}
              <div className="auth-input-group">
                <label className="form-label" htmlFor="reset-new-password">
                  New Password
                </label>
                <div className="password-toggle-wrapper">
                  <div className="input-prefix-wrapper" style={{ width: '100%' }}>
                    <span className="input-prefix">
                      <Lock size={15} />
                    </span>
                    <input
                      id="reset-new-password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input with-prefix"
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex="-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="auth-input-group">
                <label className="form-label" htmlFor="reset-confirm-password">
                  Confirm New Password
                </label>
                <div className="password-toggle-wrapper">
                  <div className="input-prefix-wrapper" style={{ width: '100%' }}>
                    <span className="input-prefix">
                      <Lock size={15} />
                    </span>
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-input with-prefix"
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    tabIndex="-1"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Validation checks */}
              <div className="password-requirements" aria-live="polite">
                <div className={`password-req-item ${isMinLength ? 'met' : 'unmet'}`}>
                  {isMinLength ? <Check size={13} /> : <span style={{ width: 13, textAlign: 'center' }}>&bull;</span>}
                  <span>At least 8 characters long</span>
                </div>
                <div className={`password-req-item ${isMatching ? 'met' : 'unmet'}`}>
                  {isMatching ? <Check size={13} /> : <span style={{ width: 13, textAlign: 'center' }}>&bull;</span>}
                  <span>Passwords match</span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={loading}
                icon={loading ? null : KeyRound}
                iconPosition="left"
                style={{ width: '100%', marginTop: 'var(--space-2)' }}
              >
                {loading ? 'Updating Password...' : 'Save New Password'}
              </Button>
            </form>
          )}

          {/* Footer Back Link */}
          <div className="auth-footer">
            <button
              type="button"
              className="auth-link"
              onClick={() => setCurrentPage('signin')}
            >
              Back to Sign In
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
            &larr; Back to FinTrack Home
          </button>
        </div>
      </div>
    </div>
  );
}
