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

  return (
    <div className={`flex items-center justify-between md:hidden ${className}`}>
      <button
        onClick={handleBack}
        className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 p-2 -m-2 transition-colors"
        aria-label="Go back"
      >
        <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-medium">
          Back
        </span>
      </button>
      
      {/* Current page title */}
      {currentCrumb && (
        <div className="text-sm font-medium text-gray-900 truncate max-w-48">
          {typeof currentCrumb === 'string' ? currentCrumb : 'Page'}
        </div>
      )}
    </div>
  );
});

// Set display name for debugging (RIS PDM convention)
MobileBreadcrumbs.displayName = 'MobileBreadcrumbs';

export default MobileBreadcrumbs;