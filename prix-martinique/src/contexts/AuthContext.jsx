import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userBadges, setUserBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from user_profiles table
  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return null;
      }
      return data;
    } catch (err) {
      return null;
    }
  };

  // Fetch user badges
  const fetchUserBadges = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          id,
          earned_at,
          badges (
            id,
            name,
            description,
            icon,
            points_required
          )
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      if (error) {
        // Table might not exist yet - this is not critical
        return [];
      }
      return data || [];
    } catch (err) {
      return [];
    }
  };

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;
    let isInitialized = false;
    let currentLoadedUserId = null; // Track which user's data we've loaded

    // Helper to load user data
    const loadUserData = async (userId) => {
      const [profile, badges] = await Promise.all([
        fetchUserProfile(userId),
        fetchUserBadges(userId)
      ]);
      return { profile, badges };
    };

    // Set up auth state change listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          currentLoadedUserId = null;
          setUser(null);
          setUserProfile(null);
          setUserBadges([]);
          setLoading(false);
          return;
        }

        // Only handle SIGNED_IN if we're already initialized AND user data not already loaded
        if (event === 'SIGNED_IN' && isInitialized && session?.user) {
          // Check if we've already loaded this user's data
          if (currentLoadedUserId === session.user.id) {
            return;
          }

          setUser(session.user);
          setLoading(true);

          const { profile, badges } = await loadUserData(session.user.id);
          if (isMounted) {
            currentLoadedUserId = session.user.id;
            setUserProfile(profile);
            setUserBadges(badges);
            setLoading(false);
          }
        }

        // Handle token refresh
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }
      }
    );

    // Main initialization function
    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          if (isMounted) setLoading(false);
          isInitialized = true;
          return;
        }

        if (session?.user && isMounted) {
          setUser(session.user);
          const { profile, badges } = await loadUserData(session.user.id);
          if (isMounted) {
            currentLoadedUserId = session.user.id;
            setUserProfile(profile);
            setUserBadges(badges);
          }
        }

        if (isMounted) {
          setLoading(false);
        }

        // Mark as initialized so future SIGNED_IN events are handled
        isInitialized = true;
      } catch (err) {
        if (isMounted) setLoading(false);
        isInitialized = true;
      }
    };

    // Initialize auth state
    initializeAuth();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Sign up with email
  const signUp = async (email, password, displayName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error };
    }
  };

  // Sign in with email
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      // Use current origin for redirect (works for both localhost and production)
      const redirectUrl = window.location.origin;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { data: null, error };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setUserProfile(null);
      setUserBadges([]);
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    }
  };

  // Award points to user (calls the Supabase function)
  const awardPoints = async (activityType, points, description) => {
    if (!user) return { error: new Error('User not authenticated') };

    try {
      const { data, error } = await supabase.rpc('award_points', {
        p_user_id: user.id,
        p_activity_type: activityType,
        p_points: points,
        p_description: description
      });

      if (error) throw error;

      // Refresh user profile and badges after awarding points
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
      const badges = await fetchUserBadges(user.id);
      setUserBadges(badges);

      return { data, error: null };
    } catch (error) {
      console.error('Award points error:', error);
      return { data: null, error };
    }
  };

  // Refresh user profile (can be called after point updates)
  const refreshProfile = async () => {
    if (!user) return;

    const profile = await fetchUserProfile(user.id);
    setUserProfile(profile);
    const badges = await fetchUserBadges(user.id);
    setUserBadges(badges);
  };

  const value = {
    user,
    userProfile,
    userBadges,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    awardPoints,
    refreshProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
