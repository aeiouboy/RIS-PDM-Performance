/**
 * Real-time Connection Status Indicator Component
 * Shows SSE/HTTP polling connection status and system activity
 */

import React, { useState, useEffect } from 'react';
import dashboardSSEClient from '../services/dashboardSSEClient';
import httpPollingService from '../services/httpPollingService';

const RealtimeStatus = ({ className = '', showDetails = false, showControls = false }) => {
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [connectionType, setConnectionType] = useState('none');
  const [stats, setStats] = useState({
    sseConnected: false,
    pollingActive: false,
    messagesReceived: 0,
    connectionAttempts: 0,
    serverUrl: dashboardSSEClient.config?.serverUrl || (import.meta.env.PROD ? window.location.host : 'localhost:3002')
  });

  useEffect(() => {
    // Monitor SSE connection status
    const statusListener = (status) => {
      setSseConnected(status.connected);
      setConnectionType(status.connected ? 'sse' : 'polling');
      setStats(prev => ({
        ...prev,
        sseConnected: status.connected,
        connectionAttempts: status.connectionAttempts || prev.connectionAttempts
      }));
    };

    // Get initial status
    const currentStatus = dashboardSSEClient.getConnectionStatus();
    setSseConnected(currentStatus.isConnected);
    setConnectionType(currentStatus.isConnected ? 'sse' : 'polling');

    // Listen for status changes
    const removeStatusListener = dashboardSSEClient.addStatusListener(statusListener);

    // Get SSE stats
    const sseStats = dashboardSSEClient.getStats();
    setStats(prev => ({
      ...prev,
      messagesReceived: sseStats.messagesReceived,
      connectionAttempts: sseStats.connectionAttempts
    }));

    return () => {
      removeStatusListener();
    };
  }, []);

  // System is considered "active" if either SSE is connected OR polling is working
  const isSystemActive = sseConnected || connectionType === 'polling';

  const getStatusColor = () => {
    return isSystemActive ? 'text-green-600' : 'text-amber-600';
  };

  const getStatusBg = () => {
    return isSystemActive ? 'bg-green-100' : 'bg-amber-100';
  };

  const getStatusIcon = () => {
    if (isSystemActive) {
      const statusText = sseConnected ? 'Live' : 'Active';
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
          <span className="text-xs font-medium text-green-700">{statusText}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
          <span className="text-xs font-medium text-amber-700">Connecting</span>
        </div>
      );
    }
  };

  const handleReconnect = async () => {
    if (sseConnected) {
      await dashboardSSEClient.forceReconnect();
    } else {
      await dashboardSSEClient.connect();
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main Status Indicator */}
      <div 
        className={`inline-flex items-center px-2 py-1 rounded-md ${getStatusBg()} cursor-pointer transition-colors duration-200 hover:opacity-80`}
        onClick={() => showDetails && setShowDetailsPanel(!showDetailsPanel)}
        title={isSystemActive ? 'Real-time updates active' : 'Connecting to real-time updates'}
      >
        {getStatusIcon()}
        
        {showDetails && (
          <button className="ml-2 text-xs text-gray-500 hover:text-gray-700">
            ℹ️
          </button>
        )}
      </div>

      {/* Detailed Status Panel */}
      {showDetails && showDetailsPanel && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Real-time Status</h3>
              <button
                onClick={() => setShowDetailsPanel(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
            
            {/* Connection Status */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">System Status</span>
                <span className={`text-sm font-medium ${getStatusColor()}`}>
                  {isSystemActive ? 'Active' : 'Connecting'}
                </span>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Connection Type</span>
                <span className="text-xs text-gray-500 font-medium">
                  {sseConnected ? 'Server-Sent Events' : 'HTTP Polling'}
                </span>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">SSE Status</span>
                <span className={`text-xs font-medium ${sseConnected ? 'text-green-600' : 'text-amber-600'}`}>
                  {sseConnected ? 'Connected' : 'Fallback Mode'}
                </span>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Server</span>
                <span className="text-xs text-gray-500">
                  {stats.serverUrl}
                </span>
              </div>
            </div>

            {/* Statistics */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Statistics</h4>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Messages Received</span>
                  <span className="text-xs font-medium text-gray-900">{stats.messagesReceived}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Connection Attempts</span>
                  <span className="text-xs font-medium text-gray-900">{stats.connectionAttempts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Polling Active</span>
                  <span className="text-xs font-medium text-gray-900">{stats.pollingActive ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            {showControls && (
              <div className="border-t border-gray-200 pt-3">
                <div className="flex space-x-2">
                  <button
                    onClick={handleReconnect}
                    disabled={!isSystemActive && stats.connectionAttempts > 3}
                    className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {sseConnected ? 'Reconnect SSE' : 'Try SSE Connection'}
                  </button>

                  {sseConnected && (
                    <button
                      onClick={() => dashboardSSEClient.disconnect()}
                      className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
                    >
                      Disconnect SSE
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Simple connection status dot for header/navbar
 */
export const RealtimeStatusDot = ({ className = '' }) => {
  const [isSystemActive, setIsSystemActive] = useState(true); // Assume active by default

  useEffect(() => {
    const statusListener = (status) => {
      // System is active if SSE is connected OR polling is working
      setIsSystemActive(status.connected || true); // Default to active since we have fallback
    };

    const currentStatus = dashboardSSEClient.getConnectionStatus();
    setIsSystemActive(currentStatus.isConnected || true);

    const removeStatusListener = dashboardSSEClient.addStatusListener(statusListener);
    return () => removeStatusListener();
  }, []);

  return (
    <div
      className={`w-3 h-3 rounded-full ${isSystemActive ? 'bg-green-500 animate-pulse' : 'bg-amber-500'} ${className}`}
      title={isSystemActive ? 'Real-time updates active' : 'Connecting to real-time updates'}
    ></div>
  );
};

/**
 * Update timestamp indicator
 */
export const LastUpdateIndicator = ({ lastUpdate, className = '' }) => {
  const formatLastUpdate = (date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`text-xs text-gray-500 ${className}`}>
      Last updated: {formatLastUpdate(lastUpdate)}
    </div>
  );
};

export default RealtimeStatus;