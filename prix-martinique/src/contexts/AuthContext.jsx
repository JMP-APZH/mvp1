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
  const [userRoles, setUserRoles] = useState([]);
  const [userFavorites, setUserFavorites] = useState(new Set());
  const [userFavoriteStores, setUserFavoriteStores] = useState(new Set());
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


  // Fetch user roles
  const fetchUserRoles = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) return [];
      return data.map(r => r.role);
    } catch (err) {
      return [];
    }
  };

  // Fetch user favorites
  const fetchUserFavorites = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('product_id')
        .eq('user_id', userId);

      if (error) return new Set();
      return new Set(data.map(item => item.product_id));
    } catch (err) {
      return new Set();
    }
  };

  // Fetch user favorite stores
  const fetchUserFavoriteStores = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_favorite_stores')
        .select('store_id')
        .eq('user_id', userId);

      if (error) return new Set();
      return new Set(data.map(item => item.store_id));
    } catch (err) {
      return new Set();
    }
  };

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;
    let isInitialized = false;
    let currentLoadedUserId = null; // Track which user's data we've loaded

    const loadUserData = async (userId) => {
      const [profile, badges, roles, favorites, favoriteStores] = await Promise.all([
        fetchUserProfile(userId),
        fetchUserBadges(userId),
        fetchUserRoles(userId),
        fetchUserFavorites(userId),
        fetchUserFavoriteStores(userId)
      ]);
      return { profile, badges, roles, favorites, favoriteStores };
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
          setUserRoles([]);
          setUserFavorites(new Set());
          setUserFavoriteStores(new Set());
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

          const { profile, badges, roles, favorites, favoriteStores } = await loadUserData(session.user.id);
          if (isMounted) {
            currentLoadedUserId = session.user.id;
            setUserProfile(profile);
            setUserBadges(badges);
            setUserRoles(roles);
            setUserFavorites(favorites);
            setUserFavoriteStores(favoriteStores);
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
          const { profile, badges, roles, favorites, favoriteStores } = await loadUserData(session.user.id);
          if (isMounted) {
            currentLoadedUserId = session.user.id;
            setUserProfile(profile);
            setUserBadges(badges);
            setUserRoles(roles || []);
            setUserFavorites(favorites);
            setUserFavoriteStores(favoriteStores);
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
      setUserRoles([]);
      setUserFavorites(new Set());
      setUserFavoriteStores(new Set());
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    }
  };

  // Award points
  const awardPoints = async (points, description) => {
    try {
      if (!user) return { data: null, error: 'Not authenticated' };

      const { data, error } = await supabase.rpc('award_points', {
        p_user_id: user.id,
        p_points: points,
        p_description: description
      });

      if (error) throw error;
      await refreshProfile();
      return { data, error: null };
    } catch (error) {
      console.error('Award points error:', error);
      return { data: null, error };
    }
  };

  // Toggle Favorite
  const toggleFavorite = async (productId) => {
    if (!user) return { error: new Error('User not authenticated') };

    const previousFavorites = new Set(userFavorites);
    const newFavorites = new Set(userFavorites);
    const isAdding = !newFavorites.has(productId);

    if (isAdding) newFavorites.add(productId);
    else newFavorites.delete(productId);

    setUserFavorites(newFavorites);

    try {
      if (isAdding) {
        const { error } = await supabase
          .from('user_favorites')
          .insert([{ user_id: user.id, product_id: productId }]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);
        if (error) throw error;
      }
      return { error: null };
    } catch (error) {
      console.error('Toggle favorite error:', error);
      setUserFavorites(previousFavorites);
      return { error };
    }
  };

  // Toggle Favorite Store
  const toggleFavoriteStore = async (storeId) => {
    if (!user) return { error: new Error('User not authenticated') };

    const previousFavoriteStores = new Set(userFavoriteStores || []);
    const newFavoriteStores = new Set(userFavoriteStores || []);

    // Allow max 3
    const isAdding = !newFavoriteStores.has(storeId);
    if (isAdding && newFavoriteStores.size >= 3) {
      return { error: new Error('Maximum 3 magasins favoris autorisés') };
    }

    if (isAdding) newFavoriteStores.add(storeId);
    else newFavoriteStores.delete(storeId);

    setUserFavoriteStores(newFavoriteStores);

    try {
      if (isAdding) {
        const { error } = await supabase
          .from('user_favorite_stores')
          .insert([{ user_id: user.id, store_id: storeId }]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_favorite_stores')
          .delete()
          .eq('user_id', user.id)
          .eq('store_id', storeId);
        if (error) throw error;
      }
      return { error: null };
    } catch (error) {
      console.error('Toggle favorite store error:', error);
      setUserFavoriteStores(previousFavoriteStores);
      return { error };
    }
  };

  // Refresh profile data
  const refreshProfile = async () => {
    if (user) {
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
      const badges = await fetchUserBadges(user.id);
      setUserBadges(badges);
      const roles = await fetchUserRoles(user.id);
      setUserRoles(roles || []);
      const favorites = await fetchUserFavorites(user.id);
      setUserFavorites(favorites);
      const favoriteStores = await fetchUserFavoriteStores(user.id);
      setUserFavoriteStores(favoriteStores);
    }
  };

  // Update user profile (e.g., city)
  const updateProfile = async (updates) => {
    try {
      if (!user) return { error: 'Not authenticated' };

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      return { error: null };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { error };
    }
  };

  const value = {
    user,
    userProfile,
    userBadges,
    userRoles,
    isAdmin: userRoles.includes('admin'),
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    awardPoints,
    refreshProfile,
    updateProfile,
    userFavorites,
    toggleFavorite,
    userFavoriteStores,
    toggleFavoriteStore
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
