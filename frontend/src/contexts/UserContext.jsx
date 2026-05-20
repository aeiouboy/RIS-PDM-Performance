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
 * @typedef {Object} UserContextType
 * @property {User|null} user
 * @property {boolean} loading
 * @property {string|null} error
 * @property {(credential: string) => Promise<User>} loginWithGoogle
 * @property {() => Promise<void>} logout
 * @property {(updates: Partial<User>) => Promise<void>} updateUser
 * @property {(preferences: Partial<User['preferences']>) => Promise<void>} updatePreferences
 * @property {(file: File) => Promise<void>} uploadAvatar
 * @property {() => Promise<void>} refreshUser
 */

// Default to "" (same-origin relative URLs) so the production build hits the
// Express server that's serving the SPA without needing VITE_API_URL set in
// Railway. In dev, Vite's proxy in vite.config.js forwards /auth + /api to the
// local backend, so "" also works there. Override only when frontend and backend
// are on different origins.
const API_URL = import.meta.env.VITE_API_URL || '';
// MUST match the key used by dashboard fetchers (Dashboard.jsx, SprintHealthCard,
// CurrentSprintByAssignee, IndividualPerformance, ExportButtons, SprintOverviewCard).
// All of them read `localStorage.getItem('authToken')`; keeping any other key here
// silently breaks every authenticated API call.
const AUTH_TOKEN_KEY = 'authToken';

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

// Auth-specific hook
export const useAuth = () => {
  const { user, loginWithGoogle, logout, loading } = useUser();
  return {
    user,
    loginWithGoogle,
    logout,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    canAccess: (permission) => user?.permissions?.includes(permission) || false
  };
};

/**
 * Build the app user from JWT claims returned by /auth/me.
 * The backend now embeds the full display identity (name, department, avatar)
 * in the JWT, so a session restore preserves the header's "Chongrak Tanaka"
 * rather than regressing to the raw email. Fields gracefully fall back when
 * the token is from an older release that only carried minimal claims.
 */
const userFromClaims = (claims) => ({
  id: claims.sub,
  email: claims.email,
  name: claims.name || claims.email,
  avatar: claims.avatar || null,
  role: claims.role || 'viewer',
  department: claims.department || '',
  preferences: { theme: 'light', notifications: true, language: 'en' },
  permissions: claims.permissions || ['read'],
  lastLogin: new Date().toISOString(),
});

export const UserProvider = memo(({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // On mount: try to restore a session from localStorage token.
  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 200) {
          const body = await res.json();
          if (!cancelled && body?.data?.user) {
            setUser(userFromClaims(body.data.user));
          }
        } else if (res.status === 401) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
      } catch (err) {
        console.error('Session restore failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  // Sign in with a Google ID token (credential from @react-oauth/google).
  const loginWithGoogle = useCallback(async (credential) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        const message = body?.message || body?.error || `Sign-in failed (${res.status})`;
        throw new Error(message);
      }

      const { token, user: signedInUser } = body.data;
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      setUser(signedInUser);
      return signedInUser;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await fetch(`${API_URL}/auth/logout`, { method: 'POST' }).catch(() => {});
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setUser(null);
      setError(null);
      setLoading(false);
    }
  }, []);

  // Update user profile (local-only; backend has no user store)
  const updateUser = useCallback(async (updates) => {
    if (!user) return;
    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 200));
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

    if (preferences.theme) {
      document.documentElement.classList.toggle('dark', preferences.theme === 'dark');
    }

    return updatedUser;
  }, [user, updateUser]);

  // Avatar upload (local preview only — no backend storage)
  const uploadAvatar = useCallback(async (file) => {
    if (!user) return;
    try {
      setLoading(true);
      const avatarUrl = URL.createObjectURL(file);
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
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) return user;
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.data?.user) {
          const refreshed = userFromClaims(body.data.user);
          setUser(refreshed);
          return refreshed;
        }
      }
      return user;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      return user;
    }
  }, [user]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    loginWithGoogle,
    logout,
    updateUser,
    updatePreferences,
    uploadAvatar,
    refreshUser,
  }), [user, loading, error, loginWithGoogle, logout, updateUser, updatePreferences, uploadAvatar, refreshUser]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
});

UserProvider.displayName = 'UserProvider';

export default UserProvider;
