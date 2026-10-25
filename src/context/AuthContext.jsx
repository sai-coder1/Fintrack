import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [intendedPage, setIntendedPage] = useState(null);

  // Active user ID ref for stale request guards
  const activeUserIdRef = useRef(null);

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

  /**
   * Fetches the user profile from public.profiles with metadata fallback.
   * Ensures the profile record is populated from auth user metadata if missing.
   */
  const fetchProfile = useCallback(async (activeUserId, userMetadata = null) => {
    if (!activeUserId || !isSupabaseConfigured || !supabase) {
      setProfile(null);
      setProfileLoading(false);
      setProfileError(null);
      return null;
    }

    activeUserIdRef.current = activeUserId;
    setProfileLoading(true);
    setProfileError(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, created_at')
        .eq('id', activeUserId)
        .maybeSingle();

      // Stale check
      if (activeUserIdRef.current !== activeUserId) return null;

      if (error) {
        console.warn('[SpendSense Auth] Could not query public.profiles (falling back to user metadata):', error.message);
        setProfileError(error.message);
        const fallbackName = userMetadata?.full_name?.trim() || null;
        const fallbackProfile = fallbackName ? { id: activeUserId, full_name: fallbackName } : null;
        setProfile(fallbackProfile);
        setProfileLoading(false);
        return fallbackProfile;
      }

      if (data && data.full_name && data.full_name.trim()) {
        setProfile(data);
        setProfileLoading(false);
        return data;
      }

      // If profile record exists but full_name is blank, or profile record does not exist yet:
      const metaFullName = userMetadata?.full_name?.trim();
      if (metaFullName) {
        try {
          const { data: upsertedData } = await supabase
            .from('profiles')
            .upsert({ id: activeUserId, full_name: metaFullName })
            .select('id, full_name, created_at')
            .maybeSingle();

          if (activeUserIdRef.current !== activeUserId) return null;

          const activeProfile = upsertedData || { id: activeUserId, full_name: metaFullName };
          setProfile(activeProfile);
          setProfileLoading(false);
          return activeProfile;
        } catch (upsertErr) {
          const activeProfile = { id: activeUserId, full_name: metaFullName };
          setProfile(activeProfile);
          setProfileLoading(false);
          return activeProfile;
        }
      }

      setProfile(data || null);
      setProfileLoading(false);
      return data || null;
    } catch (err) {
      console.error('[SpendSense Auth] Unexpected error loading user profile:', err);
      if (activeUserIdRef.current === activeUserId) {
        setProfileError(err.message);
        const fallbackName = userMetadata?.full_name?.trim() || null;
        const fallbackProfile = fallbackName ? { id: activeUserId, full_name: fallbackName } : null;
        setProfile(fallbackProfile);
        setProfileLoading(false);
        return fallbackProfile;
      }
      return null;
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
        const currentUser = initSession?.user || null;
        setUser(currentUser);
        setLoading(false);

        if (currentUser?.id) {
          fetchProfile(currentUser.id, currentUser.user_metadata);
        } else {
          setProfile(null);
        }
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
        const currentUser = currentSession?.user || null;
        setUser(currentUser);
        setLoading(false);

        if (currentUser?.id) {
          fetchProfile(currentUser.id, currentUser.user_metadata);
        } else {
          activeUserIdRef.current = null;
          setProfile(null);
          setProfileError(null);
        }

        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          setIsPasswordRecovery(false);
          setProfile(null);
          setProfileError(null);
        }
      }
    );

    return () => {
      mounted = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [fetchProfile]);

  /**
   * Register a new user with full name stored in user metadata and profile record
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
      const cleanName = fullName.trim();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: cleanName
          }
        }
      });

      if (error) {
        return { data, error };
      }

      // If user session was immediately established (email auto-confirm enabled)
      if (data?.session && data?.user?.id) {
        try {
          const { data: profData } = await supabase
            .from('profiles')
            .upsert({ id: data.user.id, full_name: cleanName })
            .select('id, full_name, created_at')
            .maybeSingle();

          if (profData) {
            setProfile(profData);
          } else {
            setProfile({ id: data.user.id, full_name: cleanName });
          }
        } catch (profErr) {
          console.warn('[SpendSense Auth] Note: Profile record will be created on first login:', profErr.message);
          setProfile({ id: data.user.id, full_name: cleanName });
        }
      }

      return { data, error: null };
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

      if (!error && data?.user?.id) {
        fetchProfile(data.user.id, data.user.user_metadata);
      }

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  }, [fetchProfile]);

  /**
   * Sign out current user and clear local session & profile state
   */
  const signOut = useCallback(async () => {
    activeUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setProfile(null);
    setProfileError(null);

    if (!isSupabaseConfigured || !supabase) {
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signOut();
      setIsPasswordRecovery(false);
      return { error };
    } catch (err) {
      console.error('[SpendSense Auth] Sign out error:', err);
      return { error: err };
    }
  }, []);

  /**
   * Updates user full name across public.profiles and auth user_metadata
   */
  const updateProfileName = useCallback(async (newFullName) => {
    const trimmed = (newFullName || '').trim();
    if (!trimmed) {
      return { data: null, error: new Error('Display name cannot be empty.') };
    }

    if (!user?.id || !isSupabaseConfigured || !supabase) {
      // Local fallback
      setProfile((prev) => ({ ...(prev || {}), full_name: trimmed }));
      return { data: { full_name: trimmed }, error: null };
    }

    try {
      // 1. Update public.profiles record
      const { data: dbData, error: dbError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, full_name: trimmed })
        .select('id, full_name, created_at')
        .maybeSingle();

      if (dbError) {
        console.warn('[SpendSense Auth] Error updating profiles table:', dbError.message);
      } else if (dbData) {
        setProfile(dbData);
      } else {
        setProfile((prev) => ({ ...(prev || {}), id: user.id, full_name: trimmed }));
      }

      // 2. Update Supabase Auth user metadata
      const { data: authData, error: authError } = await supabase.auth.updateUser({
        data: { full_name: trimmed }
      });

      if (authData?.user) {
        setUser(authData.user);
      }

      return { data: dbData || { full_name: trimmed }, error: dbError || authError || null };
    } catch (err) {
      console.error('[SpendSense Auth] Unexpected error updating profile name:', err);
      return { data: null, error: err };
    }
  }, [user?.id]);

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

  // Compute canonical display name for the user
  const resolvedDisplayName = profile?.full_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    (user?.email ? user.email.split('@')[0] : '');

  const value = {
    session,
    user,
    profile,
    profileLoading,
    profileError,
    displayName: resolvedDisplayName,
    loading,
    isConfigured: isSupabaseConfigured,
    isPasswordRecovery,
    setIsPasswordRecovery,
    intendedPage,
    setIntendedPage,
    refreshProfile: () => user?.id && fetchProfile(user.id, user.user_metadata),
    updateProfileName,
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
