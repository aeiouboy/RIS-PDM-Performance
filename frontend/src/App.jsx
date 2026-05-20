import React, { useState, useEffect, memo, Suspense } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Link,
  Navigate
} from 'react-router-dom';
import { UserProvider, useAuth } from './contexts/UserContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import MobileBottomNav from './components/MobileBottomNav';
import Dashboard from './pages/Dashboard';
import IndividualPerformance from './pages/IndividualPerformance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage';

// Define breadcrumb handle functions
const routeHandles = {
  home: {
    crumb: () => <Link to="/" className="text-primary-600 hover:text-primary-700 transition-colors">Dashboard</Link>
  },
  individual: {
    crumb: () => (
      <Link to="/individual" className="text-primary-600 hover:text-primary-700 transition-colors">
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
    crumb: () => <Link to="/reports" className="text-primary-600 hover:text-primary-700 transition-colors">Reports</Link>
  },
  settings: {
    crumb: () => <Link to="/settings" className="text-primary-600 hover:text-primary-700 transition-colors">Settings</Link>
  }
};

// Loading component
const LoadingSpinner = memo(() => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
));
LoadingSpinner.displayName = 'LoadingSpinner';

// App Layout Component with User Context
const AppLayout = memo(() => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ris-pdm.sidebar.collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const { user, loading } = useAuth();

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ris-pdm.sidebar.collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const toggleMobileNav = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
  };

  const closeMobileNav = () => {
    setIsMobileNavOpen(false);
  };

  // Show loading spinner during user initialization
  if (loading) {
    return <LoadingSpinner />;
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
        <div className={`hidden md:flex md:flex-col flex-shrink-0 transition-[width] duration-200 ease-out ${isSidebarCollapsed ? 'md:w-16' : 'md:w-64'}`}>
          <Sidebar collapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header with user context */}
          <Header onMobileMenuToggle={toggleMobileNav} />

          {/* Page content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 pb-16 md:pb-0">
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            }>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
});
AppLayout.displayName = 'AppLayout';

// Router configuration with handles for breadcrumbs
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
        handle: routeHandles.home
      },
      {
        path: "individual",
        element: <IndividualPerformance />,
        handle: routeHandles.individual
      },
      {
        path: "individual/:userId",
        element: <IndividualPerformance />,
        handle: routeHandles.individualUser,
        loader: async ({ params }) => {
          // Breadcrumb just needs an id; real name resolution happens inside the
          // IndividualPerformance page once it fetches from /api/users/:id.
          return { userId: params.userId };
        }
      },
      {
        path: "reports",
        element: <Reports />,
        handle: routeHandles.reports
      },
      {
        path: "settings",
        element: <Settings />,
        handle: routeHandles.settings
      }
    ]
  },
  {
    path: "*",
    element: <Navigate to="/" replace />
  }
]);

// Main App component with providers
function App() {
  return (
    <UserProvider>
      <WebSocketProvider>
        <RouterProvider router={router} />
      </WebSocketProvider>
    </UserProvider>
  );
}

export default App;
