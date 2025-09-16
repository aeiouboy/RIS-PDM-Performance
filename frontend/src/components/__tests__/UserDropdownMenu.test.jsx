import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import UserDropdownMenu from '../UserDropdownMenu';
import { UserProvider } from '../../contexts/UserContext';

// Mock user context data
const mockUser = {
  id: 'test-user',
  name: 'John Doe',
  email: 'john.doe@company.com',
  role: 'manager',
  department: 'Engineering',
  preferences: {
    theme: 'light',
    notifications: true,
    language: 'en'
  },
  permissions: ['read', 'write']
};

// Mock UserContext module completely
vi.mock('../contexts/UserContext', () => {
  const React = require('react');

  // Mock context value
  const mockUserContextValue = {
    user: {
      id: 'test-user',
      name: 'PDM',
      email: 'PDM@central.co.th',
      role: 'manager',
      department: 'Product Team',
      preferences: {
        theme: 'light',
        notifications: true,
        language: 'en'
      },
      permissions: ['read', 'write']
    },
    loading: false,
    logout: vi.fn(),
    updatePreferences: vi.fn()
  };

  return {
    UserProvider: ({ children }) => children,
    useUser: () => mockUserContextValue
  };
});

// Test wrapper component
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('UserDropdownMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders user dropdown menu button', () => {
    render(
      <TestWrapper>
        <UserDropdownMenu />
      </TestWrapper>
    );

    // Should show user avatar/initials
    expect(screen.getByText('SC')).toBeInTheDocument(); // Sarah Chen initials from demo
  });

  test('opens dropdown when button is clicked', async () => {
    render(
      <TestWrapper>
        <UserDropdownMenu />
      </TestWrapper>
    );

    const dropdownButton = screen.getByRole('button');
    fireEvent.click(dropdownButton);

    // Wait for menu items to appear
    await waitFor(() => {
      expect(screen.getByText('Your Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
  });

  test('closes dropdown when clicking outside', async () => {
    render(
      <TestWrapper>
        <UserDropdownMenu />
      </TestWrapper>
    );

    const dropdownButton = screen.getByRole('button');
    fireEvent.click(dropdownButton);

    // Menu should be open
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Click outside (on document body)
    fireEvent.mouseDown(document.body);

    // Menu should close (HeadlessUI handles this automatically)
    await waitFor(() => {
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });

  test('displays user information correctly', async () => {
    render(
      <TestWrapper>
        <UserDropdownMenu />
      </TestWrapper>
    );

    const dropdownButton = screen.getByRole('button');
    fireEvent.click(dropdownButton);

    await waitFor(() => {
      // Should display user name from demo data
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
      expect(screen.getByText('sarah.chen@company.com')).toBeInTheDocument();
    });
  });

  test('handles keyboard navigation', async () => {
    render(
      <TestWrapper>
        <UserDropdownMenu />
      </TestWrapper>
    );

    const dropdownButton = screen.getByRole('button');
    
    // Focus on button
    dropdownButton.focus();
    expect(dropdownButton).toHaveFocus();

    // Press Enter to open menu
    fireEvent.keyDown(dropdownButton, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Press Escape to close menu
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });

  test('renders with proper accessibility attributes', () => {
    render(
      <TestWrapper>
        <UserDropdownMenu />
      </TestWrapper>
    );

    const dropdownButton = screen.getByRole('button');
    
    // Should have proper ARIA attributes
    expect(dropdownButton).toHaveAttribute('aria-expanded');
    expect(dropdownButton).toHaveClass('focus:ring-2');
  });
});