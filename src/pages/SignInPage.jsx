import React, { useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  LogIn
} from 'lucide-react';

export function SignInPage() {
  const { setCurrentPage } = useFinance();
  const { signIn, isConfigured, intendedPage, setIntendedPage } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (!isConfigured) {
      setErrorMessage(
        'Supabase is not configured yet. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env.local file to sign in.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await signIn({ email, password });

      if (error) {
        // Human-friendly error messages
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          setErrorMessage('Invalid email address or password. Please check your credentials and try again.');
        } else if (msg.includes('email not confirmed')) {
          setErrorMessage('Your email address has not been confirmed yet. Please verify your email via the confirmation link sent to your inbox.');
        } else {
          setErrorMessage(error.message || 'Failed to sign in. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Check if user session established
      if (data?.session) {
        const destination = intendedPage || 'dashboard';
        setIntendedPage(null);
        setCurrentPage(destination);
      } else {
        setErrorMessage('Authentication succeeded but session could not be established. Please try again.');
        setLoading(false);
      }
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
          <h1 className="auth-card-title">Welcome back to FinTrack</h1>
          <p className="auth-card-subtitle">
            Sign in to access your personal dashboard, track budgets, and evaluate purchases.
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

        {/* Main Sign In Card */}
        <div className="auth-card">
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Error Banner */}
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
              <label className="form-label" htmlFor="signin-email">
                Email Address
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">
                  <Mail size={15} />
                </span>
                <input
                  id="signin-email"
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
              <div className="auth-input-label-row">
                <label className="form-label" htmlFor="signin-password">
                  Password
                </label>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => setCurrentPage('forgot-password')}
                  tabIndex="-1"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="password-toggle-wrapper">
                <div className="input-prefix-wrapper" style={{ width: '100%' }}>
                  <span className="input-prefix">
                    <Lock size={15} />
                  </span>
                  <input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input with-prefix"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="current-password"
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

            {/* Submit Button */}
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={loading}
              icon={loading ? null : LogIn}
              iconPosition="left"
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          {/* Account Creation Link */}
          <div className="auth-footer">
            <span>Don't have an account yet? </span>
            <button
              type="button"
              className="auth-link"
              onClick={() => setCurrentPage('signup')}
            >
              Get Started
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
