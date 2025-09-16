import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, memo } from 'react';

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} [avatar]
 * @property {'admin'|'manager'|'developer'|'viewer'} role
 * @property {string} department
 * @property {Object} preferences
 * @property {'light'|'dark'} preferences.theme
 * @property {boolean} preferences.notifications
 * @property {string} preferences.language
 * @property {string[]} permissions
 * @property {Date} [lastLogin]
 */

/**
 * @typedef {Object} LoginCredentials
 * @property {string} email
 * @property {string} password
 */

/**
 * @typedef {Object} UserContextType
 * @property {User|null} user
 * @property {boolean} loading
 * @property {string|null} error
 * @property {(credentials: LoginCredentials) => Promise<void>} login
 * @property {() => Promise<void>} logout
 * @property {(updates: Partial<User>) => Promise<void>} updateUser
 * @property {(preferences: Partial<User['preferences']>) => Promise<void>} updatePreferences
 * @property {(file: File) => Promise<void>} uploadAvatar
 * @property {() => Promise<void>} refreshUser
 */

// Create contexts with performance optimization
/** @type {React.Context<UserContextType|undefined>} */
const UserContext = createContext(undefined);

// Custom hook with error handling
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// Optional: Auth-specific hook
export const useAuth = () => {
  const { user, login, logout, loading } = useUser();
  return {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    canAccess: (permission) => user?.permissions?.includes(permission) || false
  };
};

// User Provider Implementation with RIS PDM patterns
export const UserProvider = memo(({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false); // Start as false for demo
  const [error, setError] = useState(null);

  // Initialize user with demo data for RIS PDM
  useEffect(() => {
    const initializeUser = async () => {
      try {
        setLoading(true);

        // Demo user data for RIS PDM - replace with actual API calls
        const demoUser = {
          id: 'demo-user-1',
          name: 'Sarah Chen',
          email: 'sarah.chen@company.com',
          avatar: null, // Will be generated from initials
          role: 'manager',
          department: 'Engineering',
          preferences: {
            theme: 'light',
            notifications: true,
            language: 'en'
          },
          permissions: ['read', 'write', 'admin'],
          lastLogin: new Date()
        };

        // Simulate API delay
        setTimeout(() => {
          setUser(demoUser);
          setLoading(false);
        }, 1000);

      } catch (err) {
        console.error('Failed to initialize user:', err);
        setError('Failed to load user data');
        setLoading(false);
      }
    };

    initializeUser();
  }, []);

  // Login function with proper error handling
  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      // Demo login - replace with actual API
      const response = await new Promise((resolve, reject) => {
        setTimeout(() => {
          if (credentials.email && credentials.password) {
            resolve({
              user: {
                id: 'demo-user-1',
                name: 'Sarah Chen',
                email: credentials.email,
                avatar: null,
                role: 'manager',
                department: 'Engineering',
                preferences: {
                  theme: 'light',
                  notifications: true,
                  language: 'en'
                },
                permissions: ['read', 'write', 'admin'],
                lastLogin: new Date()
              },
              token: 'demo-token-123'
            });
          } else {
            reject(new Error('Invalid credentials'));
          }
        }, 1500);
      });

      // Store token (demo)
      localStorage.setItem('auth_token', response.token);

      // Update user state
      setUser(response.user);

      return response.user;
    } catch (err) {
      setError(err.message);
      throw err; // Re-throw for component handling
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      setLoading(true);

      // Call logout endpoint if needed (demo)
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('Logout API call failed:', err);
    } finally {
      // Always clear local state
      localStorage.removeItem('auth_token');
      setUser(null);
      setError(null);
      setLoading(false);
    }
  }, []);

  // Update user profile
  const updateUser = useCallback(async (updates) => {
    if (!user) return;

    try {
      setLoading(true);

      // Demo API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);

      return updatedUser;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update user preferences
  const updatePreferences = useCallback(async (preferences) => {
    if (!user) return;

    const updatedUser = await updateUser({
      preferences: { ...user.preferences, ...preferences }
    });

    // Apply theme immediately
    if (preferences.theme) {
      document.documentElement.classList.toggle('dark', preferences.theme === 'dark');
    }

    return updatedUser;
  }, [user, updateUser]);

  // Avatar upload function
  const uploadAvatar = useCallback(async (file) => {
    if (!user) return;

    try {
      setLoading(true);

      // Demo file upload
      const avatarUrl = URL.createObjectURL(file); // Demo - replace with actual upload
      
      // Update user with new avatar URL
      const updatedUser = { ...user, avatar: avatarUrl };
      setUser(updatedUser);

      return avatarUrl;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!user) return;

    try {
      // Demo refresh
      await new Promise(resolve => setTimeout(resolve, 500));
      // In real app, fetch fresh user data
      return user;
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  }, [user]);

  // Memoize context value to prevent unnecessary re-renders (following RIS PDM patterns)
  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    login,
    logout,
    updateUser,
    updatePreferences,
    uploadAvatar,
    refreshUser,
  }), [user, loading, error, login, logout, updateUser, updatePreferences, uploadAvatar, refreshUser]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
});

// Set display name for debugging (RIS PDM convention)
UserProvider.displayName = 'UserProvider';

export default UserProvider;