# React Router v6 Breadcrumbs Implementation for RIS PDM

## Critical: Why React Router v6 Breadcrumbs for RIS PDM

**React Router v7.7.0 Compatible**: RIS PDM uses the latest React Router version that supports the `useMatches` hook.

**Dynamic Route Data**: Uses route handles and data loaders for dynamic breadcrumb generation.

**Nested Route Support**: Works perfectly with RIS PDM's route structure (/, /individual, /individual/:userId, /reports).

## Core Pattern - Dynamic Breadcrumbs with Route Handles

### Router Configuration Update

Update `/Users/tachongrak/Projects/ris-pdm/frontend/src/App.jsx` to include route handles:

```jsx
import { createBrowserRouter, RouterProvider, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import IndividualPerformance from './pages/IndividualPerformance';
import Reports from './pages/Reports';
import Settings from './pages/Settings'; // New page to add

// Define breadcrumb handle functions
const routeHandles = {
  home: {
    crumb: () => <Link to="/" className="text-primary-600 hover:text-primary-700">Dashboard</Link>
  },
  individual: {
    crumb: (data) => (
      <Link to="/individual" className="text-primary-600 hover:text-primary-700">
        Individual Performance
      </Link>
    )
  },
  individualUser: {
    crumb: (data) => {
      const userName = data?.user?.name || `User ${data?.userId}`;
      return (
        <span className="text-gray-500 font-medium">{userName}</span>
      );
    }
  },
  reports: {
    crumb: () => <Link to="/reports" className="text-primary-600 hover:text-primary-700">Reports</Link>
  },
  settings: {
    crumb: () => <Link to="/settings" className="text-primary-600 hover:text-primary-700">Settings</Link>
  }
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <Dashboard />,
    handle: routeHandles.home
  },
  {
    path: "/individual",
    element: <IndividualPerformance />,
    handle: routeHandles.individual
  },
  {
    path: "/individual/:userId",
    element: <IndividualPerformance />,
    handle: routeHandles.individualUser,
    loader: async ({ params }) => {
      // Fetch user data for breadcrumb
      try {
        const response = await fetch(`/api/users/${params.userId}`);
        if (!response.ok) throw new Error('User not found');
        const user = await response.json();
        return { user, userId: params.userId };
      } catch (error) {
        return { userId: params.userId }; // Fallback
      }
    }
  },
  {
    path: "/reports",
    element: <Reports />,
    handle: routeHandles.reports
  },
  {
    path: "/settings",
    element: <Settings />,
    handle: routeHandles.settings
  }
]);

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <RouterProvider router={router} />
    </div>
  );
}
```

## Breadcrumb Component Implementation

Create `/Users/tachongrak/Projects/ris-pdm/frontend/src/components/Breadcrumbs.jsx`:

```jsx
import React, { memo } from 'react';
import { useMatches } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/20/solid';

const Breadcrumbs = memo(({ className = '' }) => {
  const matches = useMatches();

  // Filter matches that have breadcrumb handles and generate crumbs
  const crumbs = matches
    .filter((match) => Boolean(match.handle?.crumb))
    .map((match, index) => ({
      id: `${match.pathname}-${index}`,
      element: match.handle.crumb(match.data),
      pathname: match.pathname,
      isLast: index === matches.filter(m => Boolean(m.handle?.crumb)).length - 1
    }));

  // Don't render if only one crumb (home page)
  if (crumbs.length <= 1) {
    return null;
  }

  return (
    <nav className={`flex ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {/* Home icon for first crumb */}
        <li className="flex items-center">
          <div className="flex items-center space-x-2">
            <HomeIcon className="h-5 w-5 text-gray-400" />
            {crumbs[0]?.element}
          </div>
        </li>

        {/* Remaining crumbs */}
        {crumbs.slice(1).map((crumb, index) => (
          <li key={crumb.id} className="flex items-center">
            <ChevronRightIcon className="h-5 w-5 text-gray-400 mx-2" />
            <div className={`text-sm ${
              crumb.isLast
                ? 'text-gray-500 font-medium'
                : 'text-primary-600 hover:text-primary-700'
            }`}>
              {crumb.element}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
});

Breadcrumbs.displayName = 'Breadcrumbs';

export default Breadcrumbs;
```

## Mobile Responsive Breadcrumbs

Create `/Users/tachongrak/Projects/ris-pdm/frontend/src/components/MobileBreadcrumbs.jsx`:

```jsx
import React, { memo } from 'react';
import { useMatches, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from '@heroicons/react/20/solid';

const MobileBreadcrumbs = memo(({ className = '' }) => {
  const matches = useMatches();
  const navigate = useNavigate();

  // Get the parent route for back navigation
  const currentPath = matches[matches.length - 1]?.pathname;
  const parentMatch = matches[matches.length - 2];

  // Don't show if we're at the root
  if (!parentMatch || currentPath === '/') {
    return null;
  }

  const handleBack = () => {
    if (parentMatch.pathname) {
      navigate(parentMatch.pathname);
    } else {
      navigate(-1); // Fallback to browser back
    }
  };

  const currentCrumb = matches[matches.length - 1]?.handle?.crumb?.(matches[matches.length - 1]?.data);
  const parentCrumb = parentMatch?.handle?.crumb?.(parentMatch?.data);

  return (
    <div className={`flex items-center space-x-2 md:hidden ${className}`}>
      <button
        onClick={handleBack}
        className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 p-2 -m-2"
        aria-label="Go back"
      >
        <ChevronLeftIcon className="h-5 w-5" />
        <span className="text-sm font-medium">
          {parentCrumb ? 'Back' : 'Back'}
        </span>
      </button>
    </div>
  );
});

MobileBreadcrumbs.displayName = 'MobileBreadcrumbs';

export default MobileBreadcrumbs;
```

## Integration with Header Component

Update `/Users/tachongrak/Projects/ris-pdm/frontend/src/components/Header.jsx`:

```jsx
import React from 'react';
import { RealtimeStatusDot } from './RealtimeStatus';
import ProjectLogo from './ProjectLogo';
import Breadcrumbs from './Breadcrumbs';
import MobileBreadcrumbs from './MobileBreadcrumbs';
import UserDropdownMenu from './UserDropdownMenu'; // From previous documentation

const Header = ({ onMobileMenuToggle, user, onProfile, onSettings, onSignOut }) => {
  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          {/* Mobile menu button */}
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Open sidebar"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo and title */}
          <div className="flex items-center">
            <div className="flex-shrink-0 md:hidden">
              <ProjectLogo size="sm" showText={true} />
            </div>
          </div>

          {/* Right side - User menu and notifications */}
          <div className="flex items-center space-x-4">
            {/* Real-time status indicator */}
            <RealtimeStatusDot className="hidden sm:block" />

            {/* User menu dropdown */}
            <UserDropdownMenu
              user={user}
              onProfile={onProfile}
              onSettings={onSettings}
              onSignOut={onSignOut}
            />
          </div>
        </div>
      </header>

      {/* Breadcrumb navigation */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 sm:px-6">
        {/* Desktop breadcrumbs */}
        <Breadcrumbs className="hidden md:flex" />

        {/* Mobile breadcrumbs */}
        <MobileBreadcrumbs className="md:hidden" />
      </div>
    </>
  );
};

export default Header;
```

## Advanced Pattern - Breadcrumbs with Search Integration

For complex routes like `/individual/:userId`, you might want to show user search capability:

```jsx
// Enhanced individualUser handle with search
const routeHandles = {
  individualUser: {
    crumb: (data, searchUsers) => {
      const userName = data?.user?.name || `User ${data?.userId}`;
      return (
        <div className="flex items-center space-x-2">
          <span className="text-gray-500 font-medium">{userName}</span>
          {/* Optional: Add user search dropdown */}
          <button
            className="text-xs text-primary-600 hover:text-primary-700 ml-2"
            onClick={() => searchUsers?.()}
          >
            (change)
          </button>
        </div>
      );
    }
  }
};
```

## Critical Integration Points for RIS PDM

### 1. Update App.jsx Layout Structure

```jsx
function AppLayout({ children }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [user, setUser] = useState(null); // Add user state

  // Add user management functions
  const handleProfile = useCallback(() => {
    // Navigate to profile or open profile modal
  }, []);

  const handleSettings = useCallback(() => {
    // Navigate to settings page
  }, []);

  const handleSignOut = useCallback(() => {
    // Handle user logout
    setUser(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Navigation */}
      <MobileNav isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />

      {/* Desktop Layout */}
      <div className="flex h-screen">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col">
          <Sidebar />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Enhanced Header with breadcrumbs */}
          <Header
            onMobileMenuToggle={() => setIsMobileNavOpen(!isMobileNavOpen)}
            user={user}
            onProfile={handleProfile}
            onSettings={handleSettings}
            onSignOut={handleSignOut}
          />

          {/* Page content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 pb-16 md:pb-0">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
```

### 2. Add Settings Route

Create `/Users/tachongrak/Projects/ris-pdm/frontend/src/pages/Settings.jsx`:

```jsx
import React from 'react';

function Settings() {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
        {/* Settings content */}
        <div className="bg-white rounded-lg shadow-dashboard border p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">User Preferences</h2>
          {/* Settings form */}
        </div>
      </div>
    </div>
  );
}

export default Settings;
```

### 3. Update Navigation Consistency

Ensure `/Users/tachongrak/Projects/ris-pdm/frontend/src/components/MobileBottomNav.jsx` routes match the new breadcrumb system.

## Testing Breadcrumbs

```jsx
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';

test('renders breadcrumbs for nested route', () => {
  const router = createMemoryRouter([
    {
      path: "/",
      element: <div>Home</div>,
      handle: { crumb: () => <span>Dashboard</span> }
    },
    {
      path: "/individual/:userId",
      element: <div>User</div>,
      handle: {
        crumb: (data) => <span>{data?.user?.name || 'User'}</span>
      },
      loader: () => ({ user: { name: 'John Doe' } })
    }
  ], {
    initialEntries: ['/individual/123']
  });

  render(
    <RouterProvider router={router}>
      <Breadcrumbs />
    </RouterProvider>
  );

  expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
  expect(screen.getByText('Dashboard')).toBeInTheDocument();
  expect(screen.getByText('John Doe')).toBeInTheDocument();
});
```

This implementation provides RIS PDM with a comprehensive breadcrumb navigation system that integrates seamlessly with the existing React Router setup and design system.