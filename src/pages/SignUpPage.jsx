import React, { useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { LegalModal } from '../components/common/LegalModal';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export function SignUpPage() {
  const { setCurrentPage } = useFinance();
  const { signUp, isConfigured } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState('privacy');

  const openLegal = (e, type) => {
    e.preventDefault();
    setLegalModalType(type);
    setLegalModalOpen(true);
  };

  // Validation checks
  const isMinLength = password.length >= 8;
  const isMatching = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessInfo(null);

    // Form field checks
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!isMinLength) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Password and Confirm Password do not match.');
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    if (!isConfigured) {
      setErrorMessage(
        'Supabase is not configured yet. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env.local file to register.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await signUp({
        fullName,
        email,
        password
      });

      if (error) {
        // Handle common Supabase auth errors
        if (error.message?.toLowerCase().includes('already registered')) {
          setErrorMessage('An account with this email address already exists. Please sign in instead.');
        } else {
          setErrorMessage(error.message || 'Registration failed. Please check your inputs and try again.');
        }
        setLoading(false);
        return;
      }

      // Check if email confirmation is required or if session was established immediately
      if (data?.session) {
        // Automatically logged in by Supabase
        setCurrentPage('dashboard');
      } else if (data?.user) {
        // Email confirmation flow is enabled on Supabase project
        setSuccessInfo({
          email: data.user.email,
          message:
            'Account created successfully! We sent a verification link to your email address. Please confirm your email to sign in.'
        });
        setLoading(false);
      } else {
        setErrorMessage('Unable to complete registration. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      setErrorMessage(err.message || 'A network error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card-container auth-card-wide">
        {/* Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-brand-logo" onClick={() => setCurrentPage('landing')}>
            <span>₹</span>
          </div>
          <h1 className="auth-card-title">Create your SpendSense account</h1>
          <p className="auth-card-subtitle">
            Start tracking spending patterns, setting budgets, and making confident money decisions.
          </p>
        </div>

        {/* Development configuration banner if Supabase env vars missing */}
        {!isConfigured && (
          <div className="dev-config-banner">
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <strong>Supabase Setup Notice:</strong> Authentication requires Supabase keys.
              Create a <code>.env.local</code> file with your <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.
            </div>
          </div>
        )}

        {/* Main Sign Up Card */}
        <div className="auth-card">
          {successInfo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--soft-emerald-bg)', color: 'var(--emerald-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={26} />
                </div>
              </div>
              <h2 style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                Verification Email Sent
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {successInfo.message}
              </p>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setCurrentPage('signin')}
                  style={{ width: '100%' }}
                >
                  Proceed to Sign In
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

              {/* Full Name */}
              <div className="auth-input-group">
                <label className="form-label" htmlFor="signup-name">
                  Full Name
                </label>
                <div className="input-prefix-wrapper">
                  <span className="input-prefix">
                    <User size={15} />
                  </span>
                  <input
                    id="signup-name"
                    type="text"
                    className="form-input with-prefix"
                    placeholder="e.g. Sai Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="auth-input-group">
                <label className="form-label" htmlFor="signup-email">
                  Email Address
                </label>
                <div className="input-prefix-wrapper">
                  <span className="input-prefix">
                    <Mail size={15} />
                  </span>
                  <input
                    id="signup-email"
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

              {/* Password */}
              <div className="auth-input-group">
                <label className="form-label" htmlFor="signup-password">
                  Password
                </label>
                <div className="password-toggle-wrapper">
                  <div className="input-prefix-wrapper" style={{ width: '100%' }}>
                    <span className="input-prefix">
                      <Lock size={15} />
                    </span>
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input with-prefix"
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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

              {/* Confirm Password */}
              <div className="auth-input-group">
                <label className="form-label" htmlFor="signup-confirm-password">
                  Confirm Password
                </label>
                <div className="password-toggle-wrapper">
                  <div className="input-prefix-wrapper" style={{ width: '100%' }}>
                    <span className="input-prefix">
                      <Lock size={15} />
                    </span>
                    <input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-input with-prefix"
                      placeholder="Re-enter your password"
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

              {/* Real-time accessible password requirements indicator */}
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

              {/* Terms & Privacy checkbox */}
              <div className="auth-checkbox-row">
                <input
                  id="signup-terms"
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  disabled={loading}
                  required
                />
                <label htmlFor="signup-terms" className="auth-checkbox-label">
                  I agree to the{' '}
                  <button
                    type="button"
                    className="auth-link"
                    onClick={(e) => openLegal(e, 'terms')}
                  >
                    Terms of Service
                  </button>{' '}
                  and acknowledge the{' '}
                  <button
                    type="button"
                    className="auth-link"
                    onClick={(e) => openLegal(e, 'privacy')}
                  >
                    Privacy Policy
                  </button>
                  .
                </label>
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
                {loading ? 'Creating Account...' : 'Sign Up'}
              </Button>
            </form>
          )}

          {/* Existing user link */}
          <div className="auth-footer">
            <span>Already have an account? </span>
            <button
              type="button"
              className="auth-link"
              onClick={() => setCurrentPage('signin')}
            >
              Sign In
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

      {/* Legal Dialog */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        type={legalModalType}
      />
    </div>
  );
}
