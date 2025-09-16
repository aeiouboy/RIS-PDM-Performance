import React, { memo, useCallback, useMemo } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  ChevronDownIcon,
  UserIcon,
  Cog6ToothIcon,
  BellIcon,
  QuestionMarkCircleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/20/solid';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

const UserDropdownMenu = memo(({ className = '' }) => {
  const { user, logout, loading } = useUser();
  const navigate = useNavigate();

  // Generate user initials for avatar fallback
  const userInitials = useMemo(() => {
    if (!user?.name) return 'U';
    return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }, [user?.name]);

  // Event handlers with useCallback for performance
  const handleProfile = useCallback(() => {
    console.log('Navigate to profile'); // Implement profile navigation
  }, []);

  const handleSettings = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  const handleNotifications = useCallback(() => {
    console.log('Open notifications'); // Implement notifications
  }, []);

  const handleHelp = useCallback(() => {
    window.open('https://docs.company.com/help', '_blank');
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }, [logout]);

  // Menu items configuration
  const menuItems = useMemo(() => [
    {
      id: 'profile',
      label: 'Your Profile',
      icon: UserIcon,
      onClick: handleProfile,
      divider: false
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Cog6ToothIcon,
      onClick: handleSettings,
      divider: false
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: BellIcon,
      onClick: handleNotifications,
      divider: false
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: QuestionMarkCircleIcon,
      onClick: handleHelp,
      divider: true
    },
    {
      id: 'logout',
      label: 'Sign Out',
      icon: ArrowRightOnRectangleIcon,
      onClick: handleSignOut,
      divider: false,
      danger: true
    }
  ], [handleProfile, handleSettings, handleNotifications, handleHelp, handleSignOut]);

  if (!user) {
    return null;
  }

  return (
    <Menu as="div" className={`relative ${className}`}>
      <div>
        <Menu.Button className="flex items-center space-x-2 p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors">
          {/* User Avatar */}
          <div className="h-8 w-8 bg-primary-500 rounded-full flex items-center justify-center">
            {user.avatar ? (
              <img
                className="h-8 w-8 rounded-full object-cover"
                src={user.avatar}
                alt={user.name}
              />
            ) : (
              <span className="text-white text-sm font-medium">
                {userInitials}
              </span>
            )}
          </div>
          
          {/* User Info - Hidden on mobile */}
          <div className="hidden sm:block text-left min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {user.name}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </div>
          </div>
          
          {/* Dropdown Arrow */}
          <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="p-1">
            {/* User Info Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-primary-500 rounded-full flex items-center justify-center">
                  {user.avatar ? (
                    <img
                      className="h-10 w-10 rounded-full object-cover"
                      src={user.avatar}
                      alt={user.name}
                    />
                  ) : (
                    <span className="text-white text-base font-medium">
                      {userInitials}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {user.email}
                  </p>
                  <p className="text-xs text-gray-400">
                    {user.department} • {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            {menuItems.map((item, index) => (
              <Fragment key={item.id}>
                {item.divider && index > 0 && (
                  <div className="border-t border-gray-200 my-1" />
                )}
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={item.onClick}
                      disabled={loading && item.id === 'logout'}
                      className={`${
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors ${
                        item.danger ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : ''
                      } ${
                        loading && item.id === 'logout' ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <item.icon
                        className={`mr-3 h-4 w-4 ${
                          item.danger ? 'text-red-500' : 'text-gray-400'
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        {loading && item.id === 'logout' ? 'Signing out...' : item.label}
                      </span>
                    </button>
                  )}
                </Menu.Item>
              </Fragment>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500">
              Performance Dashboard v2.0
            </div>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
});

// Set display name for debugging (RIS PDM convention)
UserDropdownMenu.displayName = 'UserDropdownMenu';

export default UserDropdownMenu;