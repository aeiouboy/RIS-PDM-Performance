import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { UserProvider, useUser, useAuth } from '../../contexts/UserContext';

// Test component that uses the UserContext
const TestComponent = () => {
  const { user, login, logout, loading, error } = useUser();
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}
      {user ? (
        <div>
          <div>Welcome, {user.name}</div>
          <div>Email: {user.email}</div>
          <div>Role: {user.role}</div>
          <div>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</div>
          <div>Admin: {isAdmin ? 'Yes' : 'No'}</div>
          <button onClick={() => logout()}>Logout</button>
        </div>
      ) : (
        <div>
          <div>Not logged in</div>
          <button
            onClick={() => login({ email: 'test@example.com', password: 'password' })}
          >
            Login
          </button>
        </div>
      )}
    </div>
  );
};

const TestWrapper = ({ children }) => (
  <UserProvider>
    {children}
  </UserProvider>
);

describe('UserContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  test('provides initial user state', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Should show loading initially
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for demo user to load
    await waitFor(() => {
      expect(screen.getByText('Welcome, Sarah Chen')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Should show user details
    expect(screen.getByText('Email: sarah.chen@company.com')).toBeInTheDocument();
    expect(screen.getByText('Role: manager')).toBeInTheDocument();
    expect(screen.getByText('Authenticated: Yes')).toBeInTheDocument();
  });

  test('handles login process', async () => {
    // Mock the demo user loading to not happen automatically
    const OriginalUserProvider = UserProvider;
    
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Wait for initial load to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    // If already logged in (demo), test logout first
    if (screen.queryByText('Welcome, Sarah Chen')) {
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(screen.getByText('Not logged in')).toBeInTheDocument();
      });
    }

    // Test login
    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    // Should show loading during login
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for login to complete
    await waitFor(() => {
      expect(screen.getByText('Welcome, Sarah Chen')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  test('handles logout process', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Wait for user to load
    await waitFor(() => {
      expect(screen.getByText('Welcome, Sarah Chen')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Test logout
    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    // Should show not logged in state
    await waitFor(() => {
      expect(screen.getByText('Not logged in')).toBeInTheDocument();
    });

    expect(screen.getByText('Authenticated: No')).toBeInTheDocument();
  });

  test('provides admin status correctly', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Wait for user to load
    await waitFor(() => {
      expect(screen.getByText('Welcome, Sarah Chen')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Should show admin status (manager role is not admin)
    expect(screen.getByText('Admin: No')).toBeInTheDocument();
  });

  test('throws error when used outside provider', () => {
    // Mock console.error to avoid noise in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useUser must be used within a UserProvider');

    consoleSpy.mockRestore();
  });

  test('memoizes context value correctly', async () => {
    let renderCount = 0;
    
    const TestMemoComponent = () => {
      renderCount++;
      const { user } = useUser();
      return <div>{user ? user.name : 'No user'}</div>;
    };

    const { rerender } = render(
      <TestWrapper>
        <TestMemoComponent />
      </TestWrapper>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    }, { timeout: 2000 });

    const initialRenderCount = renderCount;

    // Rerender should not cause unnecessary re-renders due to memoization
    rerender(
      <TestWrapper>
        <TestMemoComponent />
      </TestWrapper>
    );

    // Should not have increased render count significantly
    expect(renderCount - initialRenderCount).toBeLessThanOrEqual(2);
  });
});