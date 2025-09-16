/**
 * HTTP Polling Service
 * Reliable fallback for real-time data without connection issues
 * Implements smart polling with exponential backoff on errors
 */

class HttpPollingService {
  constructor() {
    this.pollingIntervals = new Map(); // endpoint -> intervalId
    this.subscribers = new Map(); // endpoint -> Set of callbacks
    this.lastData = new Map(); // endpoint -> last received data
    this.errorCounts = new Map(); // endpoint -> error count for backoff
    this.isPolling = new Map(); // endpoint -> boolean

    // Default configuration
    this.config = {
      defaultInterval: 30000, // 30 seconds default
      maxErrorInterval: 300000, // 5 minutes max backoff
      minInterval: 5000, // 5 seconds minimum
      maxRetries: 10
    };
  }

  /**
   * Start polling an endpoint
   */
  startPolling(endpoint, options = {}) {
    const {
      interval = this.config.defaultInterval,
      immediate = true,
      onData = null,
      onError = null,
      transform = null
    } = options;

    console.log(`🔄 Starting HTTP polling for ${endpoint} (every ${interval}ms)`);

    // Stop existing polling for this endpoint
    this.stopPolling(endpoint);

    // Initialize tracking
    this.errorCounts.set(endpoint, 0);
    this.isPolling.set(endpoint, true);

    // Add subscriber if provided
    if (onData) {
      this.subscribe(endpoint, onData);
    }

    // Function to perform the actual poll
    const pollOnce = async () => {
      if (!this.isPolling.get(endpoint)) {
        return; // Polling was stopped
      }

      try {
        console.log(`📡 Polling ${endpoint}...`);
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let data = await response.json();

        // Apply transform if provided
        if (transform && typeof transform === 'function') {
          data = transform(data);
        }

        // Reset error count on success
        this.errorCounts.set(endpoint, 0);

        // Store last data
        this.lastData.set(endpoint, data);

        // Notify subscribers
        this.notifySubscribers(endpoint, {
          type: 'data',
          endpoint,
          data,
          timestamp: new Date().toISOString(),
          success: true
        });

        console.log(`✅ Successfully polled ${endpoint}`);

      } catch (error) {
        console.error(`❌ Error polling ${endpoint}:`, error.message);

        // Increment error count
        const errorCount = this.errorCounts.get(endpoint) + 1;
        this.errorCounts.set(endpoint, errorCount);

        // Notify error subscribers
        this.notifySubscribers(endpoint, {
          type: 'error',
          endpoint,
          error: error.message,
          errorCount,
          timestamp: new Date().toISOString(),
          success: false
        });

        // Call error handler if provided
        if (onError) {
          onError(error, errorCount);
        }

        // Stop polling if max retries reached
        if (errorCount >= this.config.maxRetries) {
          console.error(`🛑 Max retries reached for ${endpoint}, stopping polling`);
          this.stopPolling(endpoint);
          return;
        }
      }

      // Schedule next poll if still active
      if (this.isPolling.get(endpoint)) {
        const nextInterval = this.calculateNextInterval(endpoint, interval);
        const intervalId = setTimeout(pollOnce, nextInterval);
        this.pollingIntervals.set(endpoint, intervalId);
      }
    };

    // Start immediately if requested
    if (immediate) {
      pollOnce();
    } else {
      const intervalId = setTimeout(pollOnce, interval);
      this.pollingIntervals.set(endpoint, intervalId);
    }

    return endpoint; // Return endpoint as subscription ID
  }

  /**
   * Calculate next polling interval with exponential backoff on errors
   */
  calculateNextInterval(endpoint, baseInterval) {
    const errorCount = this.errorCounts.get(endpoint) || 0;

    if (errorCount === 0) {
      return baseInterval; // No errors, use normal interval
    }

    // Exponential backoff: interval * 2^errorCount, capped at max
    const backoffInterval = Math.min(
      baseInterval * Math.pow(2, errorCount - 1),
      this.config.maxErrorInterval
    );

    console.log(`⏰ Next poll for ${endpoint} in ${backoffInterval}ms (${errorCount} errors)`);
    return backoffInterval;
  }

  /**
   * Stop polling an endpoint
   */
  stopPolling(endpoint) {
    console.log(`🛑 Stopping HTTP polling for ${endpoint}`);

    const intervalId = this.pollingIntervals.get(endpoint);
    if (intervalId) {
      clearTimeout(intervalId);
      this.pollingIntervals.delete(endpoint);
    }

    this.isPolling.set(endpoint, false);
  }

  /**
   * Subscribe to polling updates
   */
  subscribe(endpoint, callback) {
    if (!this.subscribers.has(endpoint)) {
      this.subscribers.set(endpoint, new Set());
    }

    this.subscribers.get(endpoint).add(callback);

    // If we have cached data, send it immediately
    const lastData = this.lastData.get(endpoint);
    if (lastData) {
      try {
        callback({
          type: 'cached',
          endpoint,
          data: lastData,
          timestamp: new Date().toISOString(),
          success: true
        });
      } catch (error) {
        console.error(`Error in subscriber callback for ${endpoint}:`, error);
      }
    }

    // Return unsubscribe function
    return () => this.unsubscribe(endpoint, callback);
  }

  /**
   * Unsubscribe from polling updates
   */
  unsubscribe(endpoint, callback) {
    const endpointSubscribers = this.subscribers.get(endpoint);
    if (endpointSubscribers) {
      endpointSubscribers.delete(callback);

      // If no more subscribers, stop polling
      if (endpointSubscribers.size === 0) {
        this.subscribers.delete(endpoint);
        this.stopPolling(endpoint);
      }
    }
  }

  /**
   * Notify all subscribers of an endpoint
   */
  notifySubscribers(endpoint, data) {
    const endpointSubscribers = this.subscribers.get(endpoint);
    if (endpointSubscribers) {
      endpointSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in subscriber callback for ${endpoint}:`, error);
        }
      });
    }
  }

  /**
   * Get cached data for an endpoint
   */
  getCachedData(endpoint) {
    return this.lastData.get(endpoint) || null;
  }

  /**
   * Get polling status
   */
  getPollingStatus(endpoint) {
    return {
      isPolling: this.isPolling.get(endpoint) || false,
      errorCount: this.errorCounts.get(endpoint) || 0,
      hasSubscribers: this.subscribers.has(endpoint) && this.subscribers.get(endpoint).size > 0,
      lastData: this.lastData.get(endpoint) || null
    };
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      activePolling: Array.from(this.isPolling.entries())
        .filter(([, isActive]) => isActive)
        .map(([endpoint]) => endpoint),
      totalSubscribers: Array.from(this.subscribers.values())
        .reduce((total, subscriberSet) => total + subscriberSet.size, 0),
      cachedEndpoints: Array.from(this.lastData.keys()),
      errorCounts: Object.fromEntries(this.errorCounts)
    };
  }

  /**
   * Cleanup all polling
   */
  cleanup() {
    console.log('🧹 Cleaning up HTTP polling service...');

    // Stop all polling
    for (const endpoint of this.isPolling.keys()) {
      this.stopPolling(endpoint);
    }

    // Clear all data
    this.subscribers.clear();
    this.lastData.clear();
    this.errorCounts.clear();
    this.isPolling.clear();
  }
}

// Create and export singleton
const httpPollingService = new HttpPollingService();

export default httpPollingService;