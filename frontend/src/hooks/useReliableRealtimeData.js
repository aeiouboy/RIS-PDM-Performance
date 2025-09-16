/**
 * Reliable Real-time Data Hook
 * Combines SSE and HTTP polling for maximum reliability
 * Falls back to polling when SSE fails
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import dashboardSSEClient from '../services/dashboardSSEClient';
import httpPollingService from '../services/httpPollingService';

export const useReliableRealtimeData = (endpoint, options = {}) => {
  const {
    pollingInterval = 30000, // 30 seconds default
    sseEnabled = true,
    pollingEnabled = true,
    immediate = true,
    transform = null,
    onError = null
  } = options;

  // State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionType, setConnectionType] = useState('none'); // 'sse', 'polling', 'none'
  const [retryCount, setRetryCount] = useState(0);

  // Refs for cleanup
  const sseUnsubscribeRef = useRef(null);
  const pollingUnsubscribeRef = useRef(null);
  const componentMountedRef = useRef(true);

  // Handle data updates from either source
  const handleDataUpdate = useCallback((update) => {
    if (!componentMountedRef.current) return;

    console.log(`📊 Data update from ${update.source || 'unknown'}:`, update);

    // Apply transform if provided
    let processedData = update.data;
    if (transform && typeof transform === 'function') {
      try {
        processedData = transform(processedData);
      } catch (transformError) {
        console.error('Transform error:', transformError);
        processedData = update.data; // Use original data if transform fails
      }
    }

    setData(processedData);
    setLastUpdate(new Date(update.timestamp || Date.now()));
    setLoading(false);
    setError(null);
    setRetryCount(0); // Reset retry count on success
  }, [transform]);

  // Handle errors from either source
  const handleError = useCallback((errorInfo) => {
    if (!componentMountedRef.current) return;

    console.error(`❌ Error from ${errorInfo.source}:`, errorInfo.error);

    setError(errorInfo.error);
    setRetryCount(prev => prev + 1);

    if (onError) {
      onError(errorInfo.error, errorInfo.source);
    }
  }, [onError]);

  // SSE connection management
  const setupSSE = useCallback(() => {
    if (!sseEnabled || !endpoint) return;

    console.log('🔗 Setting up SSE connection...');

    // Map endpoint to SSE event type
    const eventType = endpoint.includes('sprints') ? 'sprint_data_updated' : 'dashboard_data_updated';

    const handleSSEData = (sseEvent) => {
      handleDataUpdate({
        data: sseEvent.payload,
        timestamp: sseEvent.timestamp,
        source: 'sse'
      });
      setConnectionType('sse');
    };

    const unsubscribe = dashboardSSEClient.subscribe(eventType, handleSSEData);
    sseUnsubscribeRef.current = unsubscribe;

    // Monitor SSE connection status
    const handleConnectionStatus = (status) => {
      if (status.connected) {
        console.log('✅ SSE connected successfully');
        setConnectionType('sse');
      } else {
        console.log('❌ SSE connection failed, will fallback to polling');
        setConnectionType('polling');
        // Start polling as fallback
        setupPolling();
      }
    };

    dashboardSSEClient.addStatusListener(handleConnectionStatus);

    return () => {
      if (unsubscribe) unsubscribe();
      dashboardSSEClient.removeStatusListener(handleConnectionStatus);
    };
  }, [endpoint, sseEnabled, handleDataUpdate]);

  // HTTP Polling management
  const setupPolling = useCallback(() => {
    if (!pollingEnabled || !endpoint) return;

    console.log('🔄 Setting up HTTP polling fallback...');

    const handlePollingData = (pollingUpdate) => {
      if (pollingUpdate.success) {
        handleDataUpdate({
          data: pollingUpdate.data,
          timestamp: pollingUpdate.timestamp,
          source: 'polling'
        });
        setConnectionType('polling');
      } else {
        handleError({
          error: pollingUpdate.error,
          source: 'polling'
        });
      }
    };

    const unsubscribe = httpPollingService.subscribe(endpoint, handlePollingData);
    pollingUnsubscribeRef.current = unsubscribe;

    // Start polling
    httpPollingService.startPolling(endpoint, {
      interval: pollingInterval,
      immediate,
      transform
    });

    return unsubscribe;
  }, [endpoint, pollingEnabled, pollingInterval, immediate, transform, handleDataUpdate, handleError]);

  // Intelligent connection strategy
  const initializeConnections = useCallback(() => {
    setLoading(true);
    setError(null);

    // Try SSE first if enabled
    if (sseEnabled) {
      const sseCleanup = setupSSE();

      // If SSE fails after 5 seconds, start polling
      setTimeout(() => {
        if (connectionType !== 'sse' && pollingEnabled) {
          console.log('⏰ SSE timeout, starting polling fallback...');
          setupPolling();
        }
      }, 5000);

      return sseCleanup;
    } else if (pollingEnabled) {
      // SSE disabled, go straight to polling
      return setupPolling();
    } else {
      console.warn('⚠️ Both SSE and polling are disabled');
      setLoading(false);
    }
  }, [sseEnabled, pollingEnabled, setupSSE, setupPolling, connectionType]);

  // Refresh data manually
  const refresh = useCallback(async () => {
    if (!endpoint) return;

    setLoading(true);

    try {
      console.log(`🔄 Manual refresh for ${endpoint}...`);
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      handleDataUpdate({
        data,
        timestamp: new Date().toISOString(),
        source: 'manual'
      });

    } catch (error) {
      handleError({
        error: error.message,
        source: 'manual'
      });
    }
  }, [endpoint, handleDataUpdate, handleError]);

  // Main effect - setup connections
  useEffect(() => {
    if (!endpoint) {
      setLoading(false);
      return;
    }

    const cleanup = initializeConnections();

    return () => {
      // Cleanup SSE
      if (sseUnsubscribeRef.current) {
        sseUnsubscribeRef.current();
        sseUnsubscribeRef.current = null;
      }

      // Cleanup polling
      if (pollingUnsubscribeRef.current) {
        pollingUnsubscribeRef.current();
        pollingUnsubscribeRef.current = null;
      }

      // Call additional cleanup if provided
      if (cleanup) {
        cleanup();
      }
    };
  }, [endpoint, initializeConnections]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      componentMountedRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    lastUpdate,
    connectionType,
    retryCount,
    refresh,

    // Status information
    isConnected: connectionType !== 'none',
    isSSEConnected: connectionType === 'sse',
    isPollingActive: connectionType === 'polling',

    // Configuration
    endpoint,
    options: {
      sseEnabled,
      pollingEnabled,
      pollingInterval
    }
  };
};