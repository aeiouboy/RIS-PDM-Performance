/**
 * WebSocket Context Provider
 * Provides global WebSocket connection sharing to prevent connection loops
 * Ensures only one WebSocket connection is established for the entire application
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import offlineWebsocketService from '../services/websocketServiceOffline';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  // Connection state
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  // Subscription management
  const subscriptionsRef = useRef(new Map()); // componentId -> subscription details
  const initializationRef = useRef(false);
  const connectionInitializedRef = useRef(false);

  /**
   * Initialize WebSocket connection once
   */
  const initializeConnection = useCallback(async () => {
    if (connectionInitializedRef.current) {
      console.log('🔌 WebSocket already initialized, skipping...');
      return;
    }

    console.log('🔌 Initializing global WebSocket connection...');
    connectionInitializedRef.current = true;

    try {
      // Add connection listener before connecting
      offlineWebsocketService.addConnectionListener((isConnected) => {
        console.log(`🔌 Global WebSocket connection status changed: ${isConnected}`);
        setConnected(isConnected);
        setStats(offlineWebsocketService.getStats());
      });

      // Attempt to connect
      const connectionSuccess = await offlineWebsocketService.connect();
      console.log(`🔌 Global WebSocket connection result: ${connectionSuccess}`);

      // Update initial state
      setConnected(offlineWebsocketService.getConnectionStatus());
      setStats(offlineWebsocketService.getStats());

    } catch (error) {
      console.error('🔌 Failed to initialize global WebSocket connection:', error);
      setConnected(false);
    }
  }, []);

  /**
   * Subscribe to metrics updates with component tracking
   */
  const subscribeToMetrics = useCallback((componentId, metricsType, callback, options = {}) => {
    console.log(`📊 Global context: Subscribing ${componentId} to ${metricsType}`);

    // Check if component already has a subscription
    if (subscriptionsRef.current.has(componentId)) {
      console.log(`📊 Component ${componentId} already has subscription, updating...`);
      unsubscribeFromMetrics(componentId);
    }

    // Create subscription through service
    const subscriptionId = offlineWebsocketService.subscribeToMetrics(metricsType, callback, options);

    if (subscriptionId) {
      // Store subscription details
      subscriptionsRef.current.set(componentId, {
        subscriptionId,
        metricsType,
        callback,
        options
      });
      console.log(`📊 Subscription created for ${componentId}: ${subscriptionId}`);
      return subscriptionId;
    } else {
      console.error(`📊 Failed to create subscription for ${componentId}`);
      return null;
    }
  }, []);

  /**
   * Unsubscribe from metrics updates
   */
  const unsubscribeFromMetrics = useCallback((componentId) => {
    const subscription = subscriptionsRef.current.get(componentId);
    if (subscription) {
      console.log(`📊 Global context: Unsubscribing ${componentId} from ${subscription.metricsType}`);
      offlineWebsocketService.unsubscribeFromMetrics(subscription.subscriptionId);
      subscriptionsRef.current.delete(componentId);
    }
  }, []);

  /**
   * Get connection status
   */
  const getConnectionStatus = useCallback(() => {
    return offlineWebsocketService.getConnectionStatus();
  }, []);

  /**
   * Force reconnection
   */
  const forceReconnect = useCallback(() => {
    console.log('🔌 Global context: Force reconnecting...');
    offlineWebsocketService.forceReconnect();
  }, []);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    console.log('🔌 Global context: Disconnecting...');
    offlineWebsocketService.disconnect();
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    if (!initializationRef.current) {
      initializationRef.current = true;
      initializeConnection();
    }

    // Cleanup on unmount
    return () => {
      console.log('🔌 WebSocket context cleanup...');

      // Unsubscribe all components
      for (const [componentId] of subscriptionsRef.current) {
        unsubscribeFromMetrics(componentId);
      }

      // Remove connection listener
      offlineWebsocketService.removeConnectionListener(setConnected);
    };
  }, [initializeConnection, unsubscribeFromMetrics]);

  // Stats update interval
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(offlineWebsocketService.getStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const contextValue = {
    // Connection state
    connected,
    stats,
    lastUpdate,

    // Connection control
    connect: initializeConnection,
    disconnect,
    forceReconnect,
    getConnectionStatus,

    // Subscription management
    subscribeToMetrics,
    unsubscribeFromMetrics,

    // Service access (for direct access if needed)
    websocketService: offlineWebsocketService
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Hook to access WebSocket context
 */
export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

/**
 * Hook for connection status (replacement for useWebSocketConnection)
 */
export const useWebSocketConnection = () => {
  const { connected, stats, connect, disconnect, forceReconnect } = useWebSocketContext();

  return {
    connected,
    stats,
    connect,
    disconnect,
    forceReconnect
  };
};

/**
 * Hook for real-time metrics (replacement for useRealtimeMetrics)
 */
export const useRealtimeMetrics = (metricsType = 'all', options = {}) => {
  const { subscribeToMetrics, unsubscribeFromMetrics, connected } = useWebSocketContext();
  const componentIdRef = useRef(`${metricsType}-${Math.random().toString(36).substr(2, 9)}`);

  // State for metrics data
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);

  const {
    userId = null,
    teamId = null,
    enabled = true,
    pollingFallback = 30000
  } = options;

  // Handle metrics update callback
  const handleMetricsUpdate = useCallback((update) => {
    console.log(`📊 ${componentIdRef.current} received update:`, update);
    setData(update.data);
    setLastUpdate(new Date(update.timestamp));
    setUpdateCount(prev => prev + 1);
    setLoading(false);
    setError(null);
  }, []);

  // Subscribe/unsubscribe effect
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const componentId = componentIdRef.current;

    if (connected) {
      console.log(`📊 Subscribing ${componentId} to ${metricsType}`);
      const subscriptionId = subscribeToMetrics(
        componentId,
        metricsType,
        handleMetricsUpdate,
        { userId, teamId }
      );

      if (subscriptionId) {
        setError(null);
      } else {
        setError('Failed to subscribe to metrics');
      }
    }

    return () => {
      console.log(`📊 Unsubscribing ${componentId} from ${metricsType}`);
      unsubscribeFromMetrics(componentId);
    };
  }, [enabled, connected, metricsType, userId, teamId, subscribeToMetrics, unsubscribeFromMetrics, handleMetricsUpdate]);

  // Refresh function (placeholder for API fallback)
  const refresh = useCallback(async () => {
    setLoading(true);
    // In a real implementation, this would call an API endpoint as fallback
    setTimeout(() => setLoading(false), 1000);
  }, []);

  return {
    data,
    loading,
    error,
    connected,
    lastUpdate,
    updateCount,
    refresh,
    isEnabled: enabled,
    subscriptionActive: connected && enabled,
    metricsType,
    options: { userId, teamId }
  };
};

export default WebSocketContext;