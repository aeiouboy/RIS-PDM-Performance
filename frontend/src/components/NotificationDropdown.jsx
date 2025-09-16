import React, { memo, useState, useCallback, useMemo } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

// Demo notifications data
const DEMO_NOTIFICATIONS = [
  {
    id: '1',
    message: 'Sprint 23 velocity increased by 15% compared to last sprint',
    type: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    read: false
  },
  {
    id: '2',
    message: 'Bug count exceeded threshold: 45 critical bugs need attention',
    type: 'warning',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    read: false
  },
  {
    id: '3',
    message: 'Weekly performance report is ready for review',
    type: 'info',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    read: true
  },
  {
    id: '4',
    message: 'Sarah Chen completed all assigned tasks for Sprint 23',
    type: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    read: true
  }
];

const NotificationDropdown = memo(({ className = '' }) => {
  const [notifications, setNotifications] = useState(DEMO_NOTIFICATIONS);

  // Calculate unread count
  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length, 
    [notifications]
  );

  // Mark notification as read
  const handleMarkAsRead = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
  }, []);

  // Clear all notifications
  const handleClearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Mark all as read
  const handleMarkAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  }, []);

  // Get notification type styles
  const getNotificationStyle = useCallback((type, read) => {
    const baseStyles = read ? 'bg-gray-50 border-gray-200' : '';
    
    switch (type) {
      case 'success':
        return read ? baseStyles : 'bg-green-50 border-green-200';
      case 'warning':
        return read ? baseStyles : 'bg-orange-50 border-orange-200';
      case 'error':
        return read ? baseStyles : 'bg-red-50 border-red-200';
      default:
        return read ? baseStyles : 'bg-blue-50 border-blue-200';
    }
  }, []);

  return (
    <Popover className={`relative ${className}`}>
      <Popover.Button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors">
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <span className="sr-only">
          {unreadCount > 0 ? `${unreadCount} unread notifications` : 'No unread notifications'}
        </span>
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
        <Popover.Panel className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50 focus:outline-none">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              
              {notifications.length > 0 && (
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-red-600 hover:text-red-700 transition-colors"
                    aria-label="Clear all notifications"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Notifications List */}
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No notifications</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-md border transition-colors ${
                      getNotificationStyle(notification.type, notification.read)
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 leading-5">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                        </p>
                      </div>
                      
                      {!notification.read && (
                        <div className="flex items-center ml-3">
                          <div className="h-2 w-2 bg-primary-500 rounded-full" aria-hidden="true" />
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="ml-2 text-xs text-primary-600 hover:text-primary-700 whitespace-nowrap transition-colors"
                          >
                            Mark read
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors">
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
});

// Set display name for debugging (RIS PDM convention)
NotificationDropdown.displayName = 'NotificationDropdown';

export default NotificationDropdown;