/**
 * Redis Configuration and Client Setup
 * Enhanced caching strategies for Azure DevOps data
 */

const { createClient } = require('redis');
const logger = require('../../utils/logger');

class RedisConfig {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetryAttempts = 5;
    this.retryDelay = 2000; // 2 seconds
    
    // Cache TTL configurations (in seconds)
    this.cacheTTL = {
      workItems: 300,           // 5 minutes - real-time data
      workItemDetails: 900,     // 15 minutes - detailed data
      iterations: 1800,         // 30 minutes - sprint data
      teamCapacity: 900,        // 15 minutes - capacity data
      metrics: 300,            // 5 minutes - calculated metrics
      teamMembers: 1800,       // 30 minutes - team structure
      trends: 3600,            // 1 hour - historical trends
      health: 60               // 1 minute - health checks
    };
  }

  /**
   * Initialize Redis connection with Railway-friendly fallback
   */
  async connect() {
    try {
      // Check if Redis should be disabled (Railway deployment)
      if (process.env.DISABLE_REDIS === 'true' || !process.env.REDIS_URL) {
        logger.info('🚫 Redis disabled or not configured, using memory cache only');
        return null;
      }

      const redisUrl = process.env.REDIS_URL;

      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,  // Shorter timeout for Railway
          lazyConnect: true,
          reconnectDelay: this.retryDelay
        },
        retryDelayOnFailover: 100,
        enableAutoPipelining: true,
        maxRetriesPerRequest: 2  // Fewer retries for faster failover
      });

      // Enhanced error handling for Railway
      this.client.on('error', (err) => {
        logger.warn('Redis Client Error (non-fatal):', {
          message: err.message,
          code: err.code
        });
        this.isConnected = false;
        // Don't throw - let application continue with memory cache
      });

      this.client.on('connect', () => {
        logger.info('🔗 Redis client connected');
        this.isConnected = true;
        this.retryAttempts = 0;
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis client ready');
      });

      this.client.on('end', () => {
        logger.info('🔌 Redis client disconnected');
        this.isConnected = false;
      });

      // Connect with timeout
      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
      });

      await Promise.race([connectPromise, timeoutPromise]);

      // Test connection
      await this.client.ping();
      logger.info('✅ Redis connection established successfully');

      return this.client;
    } catch (error) {
      logger.warn('Redis unavailable, continuing with memory cache:', {
        message: error.message,
        code: error.code
      });
      this.isConnected = false;
      this.client = null;

      // Don't retry in production environments like Railway
      // This prevents endless retry loops that can crash the app
      return null;
    }
  }

  /**
   * Get Redis client instance
   */
  getClient() {
    return this.client;
  }

  /**
   * Check if Redis is connected and ready
   */
  isReady() {
    return this.isConnected && this.client && this.client.isReady;
  }

  /**
   * Generate cache key with consistent naming convention
   */
  generateKey(prefix, ...parts) {
    const sanitizedParts = parts
      .filter(part => part !== null && part !== undefined)
      .map(part => String(part).replace(/[^a-zA-Z0-9-_]/g, '_'));
    
    return `ris:${prefix}:${sanitizedParts.join(':')}`;
  }

  /**
   * Set data in cache with automatic serialization
   */
  async set(key, data, ttl = null) {
    if (!this.isReady()) {
      logger.warn('Redis not available, skipping cache set');
      return false;
    }

    try {
      const serializedData = JSON.stringify({
        data,
        timestamp: Date.now(),
        ttl: ttl || this.cacheTTL.workItems
      });

      if (ttl) {
        await this.client.setEx(key, ttl, serializedData);
      } else {
        await this.client.setEx(key, this.cacheTTL.workItems, serializedData);
      }

      logger.debug(`Cached data for key: ${key} (TTL: ${ttl || this.cacheTTL.workItems}s)`);
      return true;
    } catch (error) {
      logger.error(`Failed to set cache for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get data from cache with automatic deserialization
   */
  async get(key) {
    if (!this.isReady()) {
      logger.warn('Redis not available, cache miss');
      return null;
    }

    try {
      const cachedData = await this.client.get(key);
      
      if (!cachedData) {
        logger.debug(`Cache miss for key: ${key}`);
        return null;
      }

      const parsed = JSON.parse(cachedData);
      logger.debug(`Cache hit for key: ${key} (age: ${Date.now() - parsed.timestamp}ms)`);
      
      return parsed.data;
    } catch (error) {
      logger.error(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete specific cache entry
   */
  async delete(key) {
    if (!this.isReady()) {
      return false;
    }

    try {
      await this.client.del(key);
      logger.debug(`Deleted cache key: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cache entries matching pattern
   */
  async deletePattern(pattern) {
    if (!this.isReady()) {
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Deleted ${keys.length} cache entries matching pattern: ${pattern}`);
      }
      return true;
    } catch (error) {
      logger.error(`Failed to delete cache pattern ${pattern}:`, error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.isReady()) {
      return {
        connected: false,
        error: 'Redis not connected'
      };
    }

    try {
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbSize();
      
      return {
        connected: true,
        keyCount,
        memoryInfo: this.parseRedisInfo(info),
        connectionStatus: this.client.status
      };
    } catch (error) {
      logger.error('Failed to get Redis stats:', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const result = {};
    
    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value !== undefined) {
          result[key] = isNaN(value) ? value : Number(value);
        }
      }
    });
    
    return result;
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck() {
    try {
      if (!this.isReady()) {
        return {
          status: 'unhealthy',
          error: 'Redis not connected',
          timestamp: new Date().toISOString()
        };
      }

      const start = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - start;

      const stats = await this.getStats();

      return {
        status: 'healthy',
        responseTime,
        keyCount: stats.keyCount,
        memoryUsed: stats.memoryInfo?.used_memory_human,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis client disconnected gracefully');
      } catch (error) {
        logger.error('Error disconnecting Redis client:', error);
        try {
          await this.client.disconnect();
        } catch (forceError) {
          logger.error('Error force disconnecting Redis client:', forceError);
        }
      }
    }
  }
}

// Singleton instance
const redisConfig = new RedisConfig();

module.exports = {
  redisConfig,
  RedisConfig
};