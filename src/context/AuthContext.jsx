import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [intendedPage, setIntendedPage] = useState(null);

  // Check URL hash for recovery tokens on direct links (e.g. #access_token=...&type=recovery)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      if (params.get('type') === 'recovery') {
        setIsPasswordRecovery(true);
      }
    }
  }, []);

  // Initialize session and set up real-time auth state listener
  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session: initSession }, error }) => {
      if (mounted) {
        if (error) {
          console.error('[SpendSense Auth] Initial session fetch error:', error.message);
        }
        setSession(initSession);
        setUser(initSession?.user || null);
        setLoading(false);
      }
    }).catch((err) => {
      if (mounted) {
        console.error('[SpendSense Auth] Unexpected session load error:', err);
        setLoading(false);
      }
    });

    // 2. Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user || null);
        setLoading(false);

        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          setIsPasswordRecovery(false);
        }
      }
    );

    return () => {
      mounted = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  /**
   * Register a new user with full name stored in user metadata
   */
  const signUp = useCallback(async ({ fullName, email, password }) => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: null,
        error: new Error(
          'Supabase credentials are not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env.local file.'
        )
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim()
          }
        }
      });

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  }, []);

  /**
   * Sign in an existing user with email and password
   */
  const signIn = useCallback(async ({ email, password }) => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: null,
        error: new Error(
          'Supabase credentials are not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env.local file.'
        )
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  }, []);

  /**
   * Sign out current user and clear local session state
   */
  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setUser(null);
      setSession(null);
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setIsPasswordRecovery(false);
      return { error };
    } catch (err) {
      console.error('[SpendSense Auth] Sign out error:', err);
      setUser(null);
      setSession(null);
      return { error: err };
    }
  }, []);

  /**
   * Request password reset link to be sent to user's email
   */
  const resetPasswordForEmail = useCallback(async (email) => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: null,
        error: new Error(
          'Supabase credentials are not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env.local file.'
        )
      };
    }

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { data, error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: redirectUrl }
      );

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  }, []);

  /**
   * Update the user password (used during password recovery reset)
   */
  const updatePassword = useCallback(async (newPassword) => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: null,
        error: new Error(
          'Supabase credentials are not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env.local file.'
        )
      };
    }

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (!error) {
        setIsPasswordRecovery(false);
      }

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  }, []);

  const value = {
    session,
    user,
    loading,
    isConfigured: isSupabaseConfigured,
    isPasswordRecovery,
    setIsPasswordRecovery,
    intendedPage,
    setIntendedPage,
    signUp,
    signIn,
    signOut,
    resetPasswordForEmail,
    updatePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
