import React from 'react';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom';
import Breadcrumbs from '../Breadcrumbs';

// Mock components for testing
const MockDashboard = () => <div>Dashboard</div>;
const MockSettings = () => <div>Settings</div>;
const MockUserDetail = () => <div>User Detail</div>;

// Test route configuration with nested routes to generate breadcrumbs
const createTestRouter = (initialEntries = ['/']) => {
  return createMemoryRouter([
    {
      path: "/",
      element: <div><MockDashboard /><Breadcrumbs /></div>,
      handle: {
        crumb: () => <Link to="/" className="text-primary-600 hover:text-primary-700">Dashboard</Link>
      },
      children: [
        {
          path: "settings",
          element: <MockSettings />,
          handle: {
            crumb: () => <Link to="/settings" className="text-primary-600 hover:text-primary-700">Settings</Link>
          }
        },
        {
          path: "individual/:userId",
          element: <MockUserDetail />,
          handle: {
            crumb: (data) => {
              const userName = data?.user?.name || `User ${data?.userId}`;
              return <span className="text-gray-500 font-medium">{userName}</span>;
            }
          },
          loader: ({ params }) => ({ user: { name: 'John Doe' }, userId: params.userId })
        }
      ]
    }
  ], {
    initialEntries
  });
};

const TestWrapper = ({ router }) => (
  <RouterProvider router={router} />
);

describe('Breadcrumbs', () => {
  test('does not render on home page (single crumb)', () => {
    const router = createTestRouter(['/']);
    render(<TestWrapper router={router} />);

    // Should not render breadcrumbs on home page (only one crumb)
    expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
  });

  test('renders breadcrumbs for settings page', async () => {
    const router = createTestRouter(['/settings']);
    render(<TestWrapper router={router} />);

    // Should render breadcrumb navigation
    const breadcrumbNav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(breadcrumbNav).toBeInTheDocument();

    // Should show home icon (SVG)
    const homeIcon = screen.getByRole('navigation').querySelector('svg[data-slot="icon"]');
    expect(homeIcon).toBeInTheDocument();

    // Should show Dashboard and Settings links
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  test('renders nested breadcrumbs for user detail page', async () => {
    const router = createTestRouter(['/individual/123']);
    render(<TestWrapper router={router} />);

    // Should render breadcrumb navigation
    const breadcrumbNav = await screen.findByRole('navigation', { name: /breadcrumb/i });
    expect(breadcrumbNav).toBeInTheDocument();

    // Should show Dashboard link and User name
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  test('applies correct CSS classes', () => {
    const router = createTestRouter(['/settings']);
    render(<TestWrapper router={router} />);

    const breadcrumbNav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(breadcrumbNav).toHaveClass('flex');

    // Check for primary color styling on links
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toHaveClass('text-primary-600', 'hover:text-primary-700');
  });

  test('renders with custom className', () => {
    // Create a custom router with Breadcrumbs having custom className
    const customRouter = createMemoryRouter([
      {
        path: "/",
        element: <div><MockDashboard /><Breadcrumbs className="custom-class" /></div>,
        handle: {
          crumb: () => <Link to="/" className="text-primary-600 hover:text-primary-700">Dashboard</Link>
        },
        children: [
          {
            path: "settings",
            element: <MockSettings />,
            handle: {
              crumb: () => <Link to="/settings" className="text-primary-600 hover:text-primary-700">Settings</Link>
            }
          }
        ]
      }
    ], {
      initialEntries: ['/settings']
    });

    render(<RouterProvider router={customRouter} />);

    const breadcrumbNav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(breadcrumbNav).toHaveClass('custom-class');
  });

  test('handles missing route handles gracefully', () => {
    const routerWithoutHandles = createMemoryRouter([
      {
        path: "/",
        element: <MockDashboard />
        // No handle property
      },
      {
        path: "/settings",
        element: <MockSettings />
        // No handle property
      }
    ], {
      initialEntries: ['/settings']
    });

    render(<TestWrapper router={routerWithoutHandles} />);

    // Should not render breadcrumbs when no handles are present
    expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
  });

  test('shows correct chevron separators', () => {
    const router = createTestRouter(['/settings']);
    render(<TestWrapper router={router} />);

    // Should have chevron separator between breadcrumbs
    const chevronIcons = screen.getByRole('navigation').querySelectorAll('svg[class*="mx-2"]');

    expect(chevronIcons.length).toBeGreaterThan(0);
  });
});