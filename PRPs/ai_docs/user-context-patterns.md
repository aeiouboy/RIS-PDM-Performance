# User Context & Authentication Patterns for RIS PDM

## Critical: Why User Context for RIS PDM

**Centralized State**: Eliminates hardcoded user data across Header, MobileNav, and UserMenu components.

**Performance Optimized**: Follows RIS PDM's memoization patterns with Context providers.

**React 19 Compatible**: Uses latest React Context patterns optimized for React 19.

**No External Dependencies**: Uses built-in React context, avoiding additional state management libraries.

## Core User Context Implementation

### User Context Setup

Create `/Users/tachongrak/Projects/ris-pdm/frontend/src/contexts/UserContext.jsx`:

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// User interface following RIS PDM TypeScript patterns
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'developer' | 'viewer';
  department: string;
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
    language: string;
  };
  permissions: string[];
  lastLogin?: Date;
}

// Context interfaces
interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updatePreferences: (preferences: Partial<User['preferences']>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface LoginCredentials {
  email: string;
  password: string;
}

// Create contexts with performance optimization
const UserContext = createContext<UserContextType | undefined>(undefined);

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
    canAccess: (permission: string) => user?.permissions?.includes(permission) || false
  };
};
```

### User Provider Implementation

```jsx
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize user from localStorage/sessionStorage
  useEffect(() => {
    const initializeUser = async () => {
      try {
        setLoading(true);

        // Check for stored authentication token
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setLoading(false);
          return;
        }

        // Validate token and fetch user data
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          // Token invalid, clear storage
          localStorage.removeItem('auth_token');
          setLoading(false);
          return;
        }

        const userData = await response.json();
        setUser(userData);
      } catch (err) {
        console.error('Failed to initialize user:', err);
        setError('Failed to load user data');
        // Clear potentially invalid token
        localStorage.removeItem('auth_token');
      } finally {
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

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const { user: userData, token } = await response.json();

      // Store token
      localStorage.setItem('auth_token', token);

      // Update user state
      setUser(userData);

      return userData;
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

      // Call logout endpoint if needed
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
    } catch (err) {
      console.error('Logout API call failed:', err);
      // Continue with local logout even if API fails
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

      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const updatedUser = await response.json();
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

    try {
      const updatedUser = await updateUser({
        preferences: { ...user.preferences, ...preferences }
      });

      // Apply theme immediately
      if (preferences.theme) {
        document.documentElement.classList.toggle('dark', preferences.theme === 'dark');
      }

      return updatedUser;
    } catch (err) {
      throw err;
    }
  }, [user, updateUser]);

  // Avatar upload function
  const uploadAvatar = useCallback(async (file) => {
    if (!user) return;

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const { avatarUrl } = await response.json();

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
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh user data');
      }

      const refreshedUser = await response.json();
      setUser(refreshedUser);

      return refreshedUser;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      // Don't set error state for silent refresh failures
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
};
```

## Integration with App Layout

Update `/Users/tachongrak/Projects/ris-pdm/frontend/src/App.jsx`:

```jsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UserProvider, useAuth } from './contexts/UserContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import MobileBottomNav from './components/MobileBottomNav';
import Dashboard from './pages/Dashboard';
import IndividualPerformance from './pages/IndividualPerformance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage';

// App Layout Component with User Context
function AppLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { user, logout, loading } = useAuth();

  const toggleMobileNav = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
  };

  const closeMobileNav = () => {
    setIsMobileNavOpen(false);
  };

  // Show loading spinner during user initialization
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Navigation */}
      <MobileNav isOpen={isMobileNavOpen} onClose={closeMobileNav} />

      {/* Desktop Layout */}
      <div className="flex h-screen">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col">
          <Sidebar />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header with user context */}
          <Header
            onMobileMenuToggle={toggleMobileNav}
            user={user}
            onSignOut={logout}
          />

          {/* Page content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 pb-16 md:pb-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/individual" element={<IndividualPerformance />} />
              <Route path="/individual/:userId" element={<IndividualPerformance />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}

function App() {
  return (
    <Router>
      <UserProvider>
        <AppLayout />
      </UserProvider>
    </Router>
  );
}

export default App;
```

## Protected Routes Implementation

Create `/Users/tachongrak/Projects/ris-pdm/frontend/src/components/ProtectedRoute.jsx`:

```jsx
import React from 'react';
import { useAuth } from '../contexts/UserContext';

const ProtectedRoute = ({
  children,
  requireRole = null,
  requirePermission = null,
  fallback = null
}) => {
  const { user, loading, isAuthenticated, canAccess } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Check authentication
  if (!isAuthenticated) {
    return fallback || <div>Access denied</div>;
  }

  // Check role requirements
  if (requireRole && user.role !== requireRole) {
    return fallback || <div>Insufficient permissions</div>;
  }

  // Check permission requirements
  if (requirePermission && !canAccess(requirePermission)) {
    return fallback || <div>Insufficient permissions</div>;
  }

  return children;
};

export default ProtectedRoute;
```

## Settings Page with User Context

Create `/Users/tachongrak/Projects/ris-pdm/frontend/src/pages/Settings.jsx`:

```jsx
import React, { useState, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';

const Settings = () => {
  const { user, updateUser, updatePreferences, uploadAvatar, loading, error } = useUser();
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    department: user?.department || '',
  });
  const [preferences, setPreferences] = useState(user?.preferences || {});

  // Handle profile update
  const handleProfileSubmit = useCallback(async (e) => {
    e.preventDefault();
    try {
      await updateUser(formData);
      // Show success message
    } catch (err) {
      // Show error message
      console.error('Failed to update profile:', err);
    }
  }, [formData, updateUser]);

  // Handle preferences update
  const handlePreferencesSubmit = useCallback(async (e) => {
    e.preventDefault();
    try {
      await updatePreferences(preferences);
      // Show success message
    } catch (err) {
      console.error('Failed to update preferences:', err);
    }
  }, [preferences, updatePreferences]);

  // Handle avatar upload
  const handleAvatarUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadAvatar(file);
      // Show success message
    } catch (err) {
      console.error('Failed to upload avatar:', err);
    }
  }, [uploadAvatar]);

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {['profile', 'preferences', 'security'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow-dashboard border p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h2>

            {/* Avatar Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Photo
              </label>
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-medium text-gray-500">
                      {user?.name?.charAt(0) || 'U'}
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="bg-white rounded-lg shadow-dashboard border p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Preferences</h2>

            <form onSubmit={handlePreferencesSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Theme
                </label>
                <select
                  value={preferences.theme || 'light'}
                  onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="notifications"
                  checked={preferences.notifications || false}
                  onChange={(e) => setPreferences({ ...preferences, notifications: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="notifications" className="ml-2 text-sm text-gray-700">
                  Enable notifications
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
```

## Login Page Implementation

Create `/Users/tachongrak/Projects/ris-pdm/frontend/src/pages/LoginPage.jsx`:

```jsx
import React, { useState, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import ProjectLogo from '../components/ProjectLogo';

const LoginPage = () => {
  const { login, loading, error } = useUser();
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    try {
      await login(credentials);
    } catch (err) {
      // Error is handled by context
      console.error('Login failed:', err);
    }
  }, [credentials, login]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <ProjectLogo size="lg" showText={true} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-dashboard rounded-lg sm:px-10">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={credentials.email}
                  onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
```

This comprehensive user context implementation provides RIS PDM with centralized user state management, authentication, and user preferences, eliminating all hardcoded user data while following the existing performance optimization patterns.