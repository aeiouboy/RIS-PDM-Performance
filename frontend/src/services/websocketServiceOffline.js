/**
 * Offline WebSocket Service - Nuclear Option
 * This service NEVER attempts to connect to WebSocket servers
 * Always returns offline status to prevent connection loops
 * Provides compatible API for existing components
 */

console.log('🔧 Loading Offline WebSocket Service (Nuclear Option)...');

class OfflineWebSocketService {
  constructor() {
    console.log('🔧 OfflineWebSocketService created - NO CONNECTIONS EVER');

    // Return existing instance if it exists
    if (OfflineWebSocketService.instance) {
      console.log('🔧 Returning existing OfflineWebSocketService instance');
      return OfflineWebSocketService.instance;
    }

    // State - always offline
    this.socket = null;
    this.isConnected = false;
    this.connectionAttempted = false;
    this.socketIOImported = false;

    // Storage for listeners (but never call them with true)
    this.connectionListeners = new Set();
    this.subscriptions = new Map();
    this.subscriptionCounter = 0;

    // Set singleton
    OfflineWebSocketService.instance = this;

    console.log('🔧 OfflineWebSocketService instance created - PERMANENTLY OFFLINE');
  }

  async connect() {
    console.log('🔧 OFFLINE connect() called - PERMANENTLY BLOCKED');

    // Never actually connect, but mark as attempted
    if (!this.connectionAttempted) {
      this.connectionAttempted = true;

      // Immediately call connection listeners with false
      setTimeout(() => {
        this.notifyConnectionListeners(false);
      }, 100);
    }

    return false; // Always return false
  }

  subscribeToMetrics(type, callback, options = {}) {
    console.log('📊 OFFLINE subscribe to metrics:', type, '- NO ACTUAL SUBSCRIPTION');

    // Create a fake subscription ID but don't actually subscribe
    const subscriptionId = `offline-${type}-${++this.subscriptionCounter}`;
    this.subscriptions.set(subscriptionId, { type, callback, options });

    // Never call the callback with real data
    return subscriptionId;
  }

  unsubscribeFromMetrics(subscriptionId) {
    console.log('📊 OFFLINE unsubscribe from metrics:', subscriptionId);
    this.subscriptions.delete(subscriptionId);
  }

  addConnectionListener(listener) {
    console.log('🔌 OFFLINE add connection listener');
    this.connectionListeners.add(listener);

    // Immediately call with offline status
    if (listener) {
      try {
        listener(false);
      } catch (error) {
        console.error('🔌 Error in connection listener:', error);
      }
    }
  }

  removeConnectionListener(listener) {
    console.log('🔌 OFFLINE remove connection listener');
    this.connectionListeners.delete(listener);
  }

  notifyConnectionListeners(connected) {
    // Always pass false, never true
    const status = false;

    for (const listener of this.connectionListeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('🔌 Error in connection listener:', error);
      }
    }
  }

  getConnectionStatus() {
    return false; // Always offline
  }

  getStats() {
    return {
      connected: false,
      subscriptions: this.subscriptions.size,
      serverUrl: 'OFFLINE - No connections attempted',
      socketId: null,
      offlineMode: true,
      connectionAttempted: this.connectionAttempted,
      socketIOImported: false
    };
  }

  disconnect() {
    console.log('🔌 OFFLINE disconnect called - already disconnected');
    // Already disconnected, nothing to do
  }

  cleanup() {
    console.log('🔧 OFFLINE cleanup called');
    // Clear subscriptions but don't attempt any socket cleanup
    this.subscriptions.clear();
    this.notifyConnectionListeners(false);
  }

  forceReconnect() {
    console.log('🔌 OFFLINE force reconnect - PERMANENTLY BLOCKED');
    // Never allow reconnect
    this.notifyConnectionListeners(false);
  }
}

// Create and export singleton
const offlineWebsocketService = new OfflineWebSocketService();

console.log('🔧 Offline WebSocket service exported - NO CONNECTIONS EVER');

export default offlineWebsocketService;