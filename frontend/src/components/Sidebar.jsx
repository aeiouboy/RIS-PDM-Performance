import React from 'react';
import { NavLink } from 'react-router-dom';
import ProjectLogo from './ProjectLogo';

const Sidebar = ({ className = '', collapsed = false, onToggle }) => {
  const navItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v14l-3-3-3 3V5z" />
        </svg>
      ),
    },
    {
      name: 'Individual Performance',
      href: '/individual',
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden ${className}`}>
      {/* Logo + Toggle */}
      <div className={`border-b border-gray-200 flex items-center ${collapsed ? 'p-3 justify-center' : 'p-4 justify-between'}`}>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <ProjectLogo size="md" showText={true} />
          </div>
        )}
        {collapsed && (
          <ProjectLogo size="md" showText={false} />
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ${collapsed ? 'mt-1' : 'ml-2'}`}
        >
          {collapsed ? (
            // Chevron right
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            // Chevron left
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`mt-4 flex-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                title={collapsed ? item.name : undefined}
                className={({ isActive }) =>
                  `flex items-center py-2 text-sm font-medium rounded-md transition-colors ${
                    collapsed ? 'px-2 justify-center' : 'px-3'
                  } ${
                    isActive
                      ? 'bg-primary-50 text-primary-900 border-r-2 border-primary-500'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <span className={collapsed ? '' : 'mr-3'}>{item.icon}</span>
                {!collapsed && item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
