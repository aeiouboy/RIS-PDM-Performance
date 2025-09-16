import React, { memo } from 'react';
import { RealtimeStatusDot } from './RealtimeStatus';
import ProjectLogo from './ProjectLogo';
import UserDropdownMenu from './UserDropdownMenu';
import NotificationDropdown from './NotificationDropdown';
import Breadcrumbs from './Breadcrumbs';
import MobileBreadcrumbs from './MobileBreadcrumbs';

const Header = memo(({ onMobileMenuToggle }) => {
  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          {/* Mobile menu button */}
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
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
          <div className="flex items-center space-x-2">
            {/* Real-time status indicator */}
            <RealtimeStatusDot className="hidden sm:block" />

            {/* Notifications dropdown */}
            <NotificationDropdown />

            {/* User dropdown menu */}
            <UserDropdownMenu />
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
});

// Set display name for debugging (RIS PDM convention)
Header.displayName = 'Header';

export default Header;