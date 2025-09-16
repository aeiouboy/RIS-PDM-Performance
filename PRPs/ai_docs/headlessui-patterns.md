# HeadlessUI Implementation Patterns for RIS PDM

## Critical: Why HeadlessUI for RIS PDM

**Perfect Tailwind Integration**: HeadlessUI is built by the same team as Tailwind CSS, ensuring seamless integration with the existing design system.

**Performance Optimized**: Components are headless (no styling), reducing bundle size while providing robust accessibility.

**React 19 Compatible**: Fully compatible with React 19 which RIS PDM is using.

## User Menu Dropdown Implementation

### Required Dependencies
```bash
npm install @headlessui/react
```

### Core Pattern - Dropdown Menu with User Profile

```jsx
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'

function UserDropdownMenu({ user, onSignOut, onProfile, onSettings }) {
  return (
    <Menu as="div" className="relative">
      <div>
        <Menu.Button className="flex items-center space-x-2 p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
          <div className="h-8 w-8 bg-primary-500 rounded-full flex items-center justify-center">
            {user?.avatar ? (
              <img className="h-8 w-8 rounded-full object-cover" src={user.avatar} alt="" />
            ) : (
              <span className="text-white text-sm font-medium">
                {user?.name?.charAt(0) || 'U'}
              </span>
            )}
          </div>
          <span className="hidden sm:block text-sm font-medium">{user?.name || 'User'}</span>
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
            {/* User Info Section */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>

            {/* Menu Items */}
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={onProfile}
                  className={`${
                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                  } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                >
                  Your Profile
                </button>
              )}
            </Menu.Item>

            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={onSettings}
                  className={`${
                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                  } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                >
                  Settings
                </button>
              )}
            </Menu.Item>

            <div className="border-t border-gray-100 mt-1 pt-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onSignOut}
                    className={`${
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                  >
                    Sign out
                  </button>
                )}
              </Menu.Item>
            </div>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  )
}
```

## Critical Gotchas for RIS PDM Integration

### 1. Z-Index Management
```jsx
// CRITICAL: Menu must appear above other content
<Menu.Items className="... z-50">
```

### 2. Focus Management
HeadlessUI handles focus automatically, but ensure parent components don't interfere:
```jsx
// Good: Let HeadlessUI manage focus
<Menu.Button className="focus:outline-none focus:ring-2 focus:ring-primary-500">

// Bad: Don't add custom focus handlers that conflict
<Menu.Button onClick={customFocusHandler}> // This breaks accessibility
```

### 3. Mobile Considerations
```jsx
// Ensure menu doesn't overflow on mobile
<Menu.Items className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] origin-top-right">
```

## Notification System Pattern

```jsx
import { Popover, Transition } from '@headlessui/react'
import { BellIcon } from '@heroicons/react/24/outline'

function NotificationDropdown({ notifications, onMarkAsRead, onClearAll }) {
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <Popover className="relative">
      <Popover.Button className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md">
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Popover.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Popover.Panel className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              {notifications.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Clear all
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No notifications</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-md border ${
                      notification.read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <p className="text-sm text-gray-900">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{notification.timestamp}</p>
                    {!notification.read && (
                      <button
                        onClick={() => onMarkAsRead(notification.id)}
                        className="text-xs text-primary-600 hover:text-primary-700 mt-1"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  )
}
```

## Modal Dialog Pattern (for Settings/Profile)

```jsx
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

function SettingsModal({ isOpen, onClose, user, onSave }) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-lg font-medium text-gray-900">
                    User Settings
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Settings form content */}
                <div className="space-y-4">
                  {/* Form fields here */}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSave}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-md hover:bg-primary-600"
                  >
                    Save Changes
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
```

## Performance Optimization for RIS PDM

### Component Memoization (following RIS PDM patterns)

```jsx
// Following RIS PDM's memoization patterns
const UserDropdownMenu = memo(({ user, onSignOut, onProfile, onSettings }) => {
  // Component implementation
});

// Set display name for debugging (RIS PDM convention)
UserDropdownMenu.displayName = 'UserDropdownMenu';
```

### Event Handler Optimization

```jsx
// Use useCallback for event handlers to prevent unnecessary re-renders
const UserDropdownMenu = memo(({ user, onSignOut, onProfile, onSettings }) => {
  const handleProfileClick = useCallback(() => {
    onProfile?.(user);
  }, [onProfile, user]);

  const handleSignOutClick = useCallback(() => {
    onSignOut?.(user);
  }, [onSignOut, user]);

  // Component implementation
});
```

## Integration with Existing RIS PDM Components

### Header.jsx Integration

Replace the existing user button section in `/Users/tachongrak/Projects/ris-pdm/frontend/src/components/Header.jsx`:

```jsx
// Replace this section in Header.jsx
<div className="relative">
  <UserDropdownMenu
    user={user}
    onProfile={handleProfile}
    onSettings={handleSettings}
    onSignOut={handleSignOut}
  />
</div>
```

### Navigation Consistency

Ensure the dropdown menu matches the navigation styling in Sidebar.jsx:
- Use same `text-gray-700 hover:bg-gray-50` pattern
- Follow same focus ring styling: `focus:ring-2 focus:ring-primary-500`
- Use consistent rounded corners: `rounded-md`

## Testing Patterns for HeadlessUI Components

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserDropdownMenu from './UserDropdownMenu'

test('opens and closes menu with keyboard navigation', async () => {
  const user = userEvent.setup()
  const mockUser = { name: 'John Doe', email: 'john@example.com' }

  render(<UserDropdownMenu user={mockUser} />)

  // Test button is accessible
  const menuButton = screen.getByRole('button', { name: /john doe/i })
  expect(menuButton).toBeInTheDocument()

  // Test keyboard navigation
  await user.keyboard('{Tab}') // Focus on button
  await user.keyboard('{Enter}') // Open menu

  // Check menu items are visible
  expect(screen.getByRole('menuitem', { name: /your profile/i })).toBeInTheDocument()

  // Test escape key closes menu
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menuitem', { name: /your profile/i })).not.toBeInTheDocument()
})
```

This documentation provides the essential patterns for implementing HeadlessUI components in the RIS PDM dashboard, ensuring consistency with existing design patterns and performance optimizations.