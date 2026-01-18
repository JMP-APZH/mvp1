import React, { createContext, useContext, useState, useEffect } from 'react';
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
      console.log('Fetching profile for user:', userId);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
      console.log('Profile fetched successfully');
      return data;
    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
      return null;
    }
  };

  // Fetch user badges
  const fetchUserBadges = async (userId) => {
    try {
      console.log('Fetching badges for user:', userId);
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
        console.warn('Error fetching user badges (non-critical):', error.message);
        return [];
      }
      console.log('Badges fetched:', data?.length || 0);
      return data || [];
    } catch (err) {
      console.warn('Error in fetchUserBadges (non-critical):', err);
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
      console.log('Loading user data for:', userId);
      const [profile, badges] = await Promise.all([
        fetchUserProfile(userId),
        fetchUserBadges(userId)
      ]);
      console.log('User data loaded - profile:', !!profile, 'badges:', badges?.length);
      return { profile, badges };
    };

    // Set up auth state change listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, 'isInitialized:', isInitialized);

        if (!isMounted) return;

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          console.log('User signed out, clearing state');
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
            console.log('SIGNED_IN for same user, skipping duplicate load');
            return;
          }

          console.log('User signed in (post-init), loading profile...');
          setUser(session.user);
          setLoading(true);

          const { profile, badges } = await loadUserData(session.user.id);
          if (isMounted) {
            currentLoadedUserId = session.user.id;
            setUserProfile(profile);
            setUserBadges(badges);
            setLoading(false);
            console.log('Sign in complete');
          }
        }

        // Handle token refresh
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('Token refreshed');
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
          console.error('Error getting session:', error);
          if (isMounted) setLoading(false);
          isInitialized = true;
          return;
        }

        console.log('Initial session:', !!session);

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
          console.log('Auth initialization complete');
        }

        // Mark as initialized so future SIGNED_IN events are handled
        isInitialized = true;
      } catch (err) {
        console.error('Error initializing auth:', err);
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
      console.log('Google OAuth redirect URL:', redirectUrl);

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
