import React, { memo } from 'react';
import { useMatches, Link } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/20/solid';

const Breadcrumbs = memo(({ className = '' }) => {
  const matches = useMatches();

  // Filter matches that have breadcrumb handles and generate crumbs
  const crumbs = matches
    .filter((match) => Boolean(match.handle?.crumb))
    .map((match, index, array) => ({
      id: `${match.pathname}-${index}`,
      element: match.handle.crumb(match.data),
      pathname: match.pathname,
      isLast: index === array.length - 1
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
            <HomeIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            {crumbs[0]?.element}
          </div>
        </li>

        {/* Remaining crumbs */}
        {crumbs.slice(1).map((crumb) => (
          <li key={crumb.id} className="flex items-center">
            <ChevronRightIcon className="h-5 w-5 text-gray-400 mx-2" aria-hidden="true" />
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

// Set display name for debugging (RIS PDM convention)
Breadcrumbs.displayName = 'Breadcrumbs';

export default Breadcrumbs;