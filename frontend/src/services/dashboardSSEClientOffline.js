/**
 * Offline Dashboard SSE Client - Nuclear Option Extension
 * This client NEVER attempts to connect to SSE endpoints
 * Always returns offline status to prevent connection errors
 * Provides compatible API for existing components that use SSE
 */

console.log('🔧 Loading Offline Dashboard SSE Client (Nuclear Option Extension)...');

class OfflineDashboardSSEClient {
  constructor() {
    console.log('🔧 OfflineDashboardSSEClient created - NO CONNECTIONS EVER');

    // Return existing instance if it exists
    if (OfflineDashboardSSEClient.instance) {
      console.log('🔧 Returning existing OfflineDashboardSSEClient instance');
      return OfflineDashboardSSEClient.instance;
    }

    // State - always offline
    this.eventSource = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000;
    this.maxRetryDelay = 30000;
    this.subscriptions = new Map();
    this.connectionListeners = new Set();
    this.statusListeners = new Set();
    this.lastHeartbeat = null;
    this.heartbeatInterval = null;

    // Configuration - OFFLINE MODE
    this.config = {
      serverUrl: 'OFFLINE - No connections attempted',
      endpoint: '/api/sse/dashboard',
      autoConnect: false, // NEVER auto-connect
      reconnection: false, // NEVER reconnect
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      withCredentials: false
    };

    // Statistics tracking - all offline
    this.stats = {
      connectionAttempts: 0,
      successfulConnections: 0,
      reconnections: 0,
      messagesReceived: 0,
      lastConnectionTime: null,
      totalDowntime: 0,
      errors: 0,
      offlineMode: true
    };

    // Set singleton
    OfflineDashboardSSEClient.instance = this;

    console.log('🔧 OfflineDashboardSSEClient instance created - PERMANENTLY OFFLINE');
  }

  /**
   * Connect method - PERMANENTLY BLOCKED
   */
  async connect() {
    console.log('🔗 OFFLINE SSE connect() called - PERMANENTLY BLOCKED');

    // Immediately notify connection listeners with false
    setTimeout(() => {
      this.notifyConnectionListeners(false);
      this.notifyStatusListeners({
        connected: false,
        timestamp: new Date().toISOString(),
        reason: 'offline_mode',
        offlineMode: true
      });
    }, 10);

    return false; // Always return false
  }

  /**
   * Setup event handlers - NO-OP
   */
  setupEventHandlers() {
    console.log('🔗 OFFLINE SSE setupEventHandlers - NO-OP');
    // Never set up any real event handlers
  }

  /**
   * Handle connection - NO-OP
   */
  handleConnection() {
    console.log('🔗 OFFLINE SSE handleConnection - NO-OP');
    // Never actually connect
  }

  /**
   * Handle connection error - NO-OP
   */
  handleConnectionError(error) {
    console.log('🔗 OFFLINE SSE handleConnectionError - NO-OP:', error?.message || 'unknown error');
    // Always offline, so just notify offline status
    this.notifyConnectionListeners(false);
    this.notifyStatusListeners({
      connected: false,
      error: 'offline_mode',
      timestamp: new Date().toISOString(),
      offlineMode: true
    });
  }

  /**
   * Schedule reconnection - NO-OP
   */
  scheduleReconnection() {
    console.log('🔄 OFFLINE SSE scheduleReconnection - NO-OP');
    // Never reconnect
  }

  /**
   * Handle messages - NO-OP
   */
  handleMessage(event) {
    console.log('📨 OFFLINE SSE handleMessage - NO-OP');
    // Never handle real messages
  }

  /**
   * Handle sprint updates - NO-OP
   */
  handleSprintUpdate(event) {
    console.log('📊 OFFLINE SSE handleSprintUpdate - NO-OP');
    // Never handle real updates
  }

  /**
   * Handle work item updates - NO-OP
   */
  handleWorkItemUpdate(event) {
    console.log('📋 OFFLINE SSE handleWorkItemUpdate - NO-OP');
    // Never handle real updates
  }

  /**
   * Handle sync completion - NO-OP
   */
  handleSyncCompleted(event) {
    console.log('🔄 OFFLINE SSE handleSyncCompleted - NO-OP');
    // Never handle real updates
  }

  /**
   * Handle heartbeat - NO-OP
   */
  handleHeartbeat() {
    console.log('💓 OFFLINE SSE handleHeartbeat - NO-OP');
    // Never handle real heartbeats
  }

  /**
   * Subscribe to events - FAKE SUBSCRIPTION
   */
  subscribe(eventType, callback) {
    console.log(`📡 OFFLINE SSE subscribe to ${eventType} - FAKE SUBSCRIPTION`);

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }

    this.subscriptions.get(eventType).add(callback);

    // Return unsubscribe function
    return () => this.unsubscribe(eventType, callback);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType, callback) {
    console.log(`📡 OFFLINE SSE unsubscribe from ${eventType}`);
    const eventSubscriptions = this.subscriptions.get(eventType);
    if (eventSubscriptions) {
      eventSubscriptions.delete(callback);
      if (eventSubscriptions.size === 0) {
        this.subscriptions.delete(eventType);
      }
    }
  }

  /**
   * Notify subscribers - NO-OP (never has real data)
   */
  notifySubscribers(eventType, data) {
    console.log(`📡 OFFLINE SSE notifySubscribers for ${eventType} - NO-OP`);
    // Never notify with real data
  }

  /**
   * Connection listener management
   */
  addConnectionListener(callback) {
    console.log('🔌 OFFLINE SSE add connection listener');
    this.connectionListeners.add(callback);

    // Immediately call with offline status
    if (callback) {
      try {
        callback(false);
      } catch (error) {
        console.error('🔌 Error in connection listener:', error);
      }
    }

    return () => this.removeConnectionListener(callback);
  }

  removeConnectionListener(callback) {
    console.log('🔌 OFFLINE SSE remove connection listener');
    this.connectionListeners.delete(callback);
  }

  notifyConnectionListeners(isConnected) {
    // Always pass false, never true
    const status = false;

    for (const callback of this.connectionListeners) {
      try {
        callback(status);
      } catch (error) {
        console.error('🔌 Error in connection listener:', error);
      }
    }
  }

  /**
   * Status listener management
   */
  addStatusListener(callback) {
    console.log('📊 OFFLINE SSE add status listener');
    this.statusListeners.add(callback);

    // Immediately call with offline status
    if (callback) {
      try {
        callback({
          connected: false,
          timestamp: new Date().toISOString(),
          reason: 'offline_mode',
          offlineMode: true
        });
      } catch (error) {
        console.error('📊 Error in status listener:', error);
      }
    }

    return () => this.removeStatusListener(callback);
  }

  removeStatusListener(callback) {
    console.log('📊 OFFLINE SSE remove status listener');
    this.statusListeners.delete(callback);
  }

  notifyStatusListeners(status) {
    // Always mark as offline
    const offlineStatus = {
      ...status,
      connected: false,
      offlineMode: true
    };

    for (const callback of this.statusListeners) {
      try {
        callback(offlineStatus);
      } catch (error) {
        console.error('📊 Error in status listener:', error);
      }
    }
  }

  /**
   * Heartbeat monitoring - NO-OP
   */
  startHeartbeatMonitoring() {
    console.log('💓 OFFLINE SSE startHeartbeatMonitoring - NO-OP');
    // Never monitor heartbeat
  }

  stopHeartbeatMonitoring() {
    console.log('💓 OFFLINE SSE stopHeartbeatMonitoring - NO-OP');
    // Never had monitoring to stop
  }

  /**
   * Disconnect - NO-OP (already disconnected)
   */
  disconnect() {
    console.log('🔗 OFFLINE SSE disconnect - already disconnected');
    this.notifyConnectionListeners(false);
    this.notifyStatusListeners({
      connected: false,
      timestamp: new Date().toISOString(),
      reason: 'offline_mode',
      offlineMode: true
    });
  }

  /**
   * Force reconnect - PERMANENTLY BLOCKED
   */
  async forceReconnect() {
    console.log('🔄 OFFLINE SSE forceReconnect - PERMANENTLY BLOCKED');
    this.notifyConnectionListeners(false);
    return false;
  }

  /**
   * Get connection status - always offline
   */
  getConnectionStatus() {
    return {
      isConnected: false,
      readyState: null,
      url: 'OFFLINE - No connections attempted',
      lastHeartbeat: null,
      connectionRetries: 0,
      offlineMode: true
    };
  }

  /**
   * Get service statistics - all offline
   */
  getStats() {
    return {
      ...this.stats,
      subscriptions: Array.from(this.subscriptions.keys()),
      connectionListeners: this.connectionListeners.size,
      statusListeners: this.statusListeners.size,
      currentStatus: this.getConnectionStatus(),
      uptime: 0,
      offlineMode: true
    };
  }
}

// Create and export singleton instance
const offlineDashboardSSEClient = new OfflineDashboardSSEClient();

console.log('🔧 Offline Dashboard SSE client exported - NO CONNECTIONS EVER');

export default offlineDashboardSSEClient;