// Jest globals are available automatically
//
// This suite exercises the CURRENT cacheService API. The service is a singleton
// that wraps a `redisConfig` abstraction (primary tier) plus a node-cache
// in-memory fallback tier. It auto-initializes in the constructor — there is no
// `init()` lifecycle method (the old API this test used to target was renamed:
// init->initialize, del->delete, exists/expire/mget/mset/mdel/flush/close were
// removed). We mock redisConfig so the suite runs hermetically.

// Mock the redisConfig abstraction the service actually depends on.
jest.mock('../../src/config/redisConfig', () => {
  const ready = { value: false };
  const store = new Map();
  const mock = {
    __ready: ready,
    __store: store,
    cacheTTL: { workItems: 300, workItemDetails: 900, iterations: 1800 },
    isReady: jest.fn(() => ready.value),
    connect: jest.fn(async () => { ready.value = true; return true; }),
    disconnect: jest.fn(async () => { ready.value = false; }),
    generateKey: (...parts) => `ris:${parts.join(':')}`,
    get: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    set: jest.fn(async (key, data) => { store.set(key, data); return true; }),
    delete: jest.fn(async (key) => store.delete(key)),
    deletePattern: jest.fn(async () => true),
    healthCheck: jest.fn(async () => ({ status: ready.value ? 'connected' : 'disconnected' }))
  };
  return { redisConfig: mock };
});

const cacheService = require('../../src/services/cacheService');
const { redisConfig } = require('../../src/config/redisConfig');
const { environmentHelpers } = require('../utils/testHelpers');

describe('CacheService', () => {
  beforeAll(() => {
    environmentHelpers.setTestEnvVars();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // NOTE: this Jest project clears mock implementations on clearAllMocks, so we
    // re-establish the redisConfig behaviors here (after the clear) on every test.
    const store = redisConfig.__store;
    const ready = redisConfig.__ready;
    redisConfig.isReady.mockImplementation(() => ready.value);
    redisConfig.connect.mockImplementation(async () => { ready.value = true; return true; });
    redisConfig.disconnect.mockImplementation(async () => { ready.value = false; });
    redisConfig.get.mockImplementation(async (key) => (store.has(key) ? store.get(key) : null));
    redisConfig.set.mockImplementation(async (key, data) => { store.set(key, data); return true; });
    redisConfig.delete.mockImplementation(async (key) => store.delete(key));
    redisConfig.deletePattern.mockImplementation(async () => true);
    redisConfig.healthCheck.mockImplementation(async () => ({ status: ready.value ? 'connected' : 'disconnected' }));

    // Reset Redis tier to unavailable (memory-only) by default; tests that need
    // Redis opt in explicitly.
    redisConfig.__ready.value = false;
    redisConfig.__store.clear();
    // Clear the in-memory fallback tier between tests.
    cacheService.memoryCache.flushAll();
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  describe('Initialization', () => {
    test('should initialize with Redis when available', async () => {
      const result = await cacheService.initialize();

      expect(result).toBe(true);
      expect(redisConfig.connect).toHaveBeenCalled();
      expect(redisConfig.isReady()).toBe(true);
    });

    test('should fall back to memory cache when Redis is unavailable', async () => {
      redisConfig.connect.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await cacheService.initialize();

      expect(result).toBe(false);
      expect(cacheService.memoryCache).toBeDefined();
    });

    test('should handle Redis connection errors gracefully', async () => {
      redisConfig.connect.mockRejectedValueOnce(new Error('Connection error'));

      await expect(cacheService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Redis-backed Operations', () => {
    beforeEach(async () => {
      redisConfig.__ready.value = true;
    });

    test('should read a value that lives in Redis', async () => {
      const testKey = 'test-key';
      const testValue = { data: 'test-data' };
      redisConfig.get.mockResolvedValueOnce(testValue);

      const result = await cacheService.get(testKey);

      expect(redisConfig.get).toHaveBeenCalledWith(testKey);
      expect(result).toEqual(testValue);
    });

    test('should write a value into Redis', async () => {
      const testKey = 'test-key';
      const testValue = { data: 'test-data' };

      const ok = await cacheService.set(testKey, testValue, { ttl: 300 });

      expect(ok).toBe(true);
      expect(redisConfig.set).toHaveBeenCalledWith(testKey, testValue, 300);
    });

    test('should delete a value from all tiers', async () => {
      const testKey = 'test-key';
      redisConfig.delete.mockResolvedValueOnce(true);

      await cacheService.delete(testKey);

      expect(redisConfig.delete).toHaveBeenCalledWith(testKey);
    });

    test('should return null and not throw on a Redis read error', async () => {
      redisConfig.get.mockRejectedValueOnce(new Error('Redis error'));

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('Memory Cache Operations', () => {
    // Redis stays unavailable (default), so everything routes to the memory tier.
    test('should set then get a value from the memory tier', async () => {
      const testKey = 'mem-key';
      const testValue = { data: 'mem-data' };

      await cacheService.set(testKey, testValue);
      const result = await cacheService.get(testKey);

      expect(result).toEqual(testValue);
    });

    test('should return null for a missing key', async () => {
      const result = await cacheService.get('does-not-exist');
      expect(result).toBeNull();
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent keys for identical inputs', () => {
      const key1 = cacheService.generateKey('workitems', 'query', { type: 'story', state: 'active' });
      const key2 = cacheService.generateKey('workitems', 'query', { type: 'story', state: 'active' });

      expect(key1).toBe(key2);
      expect(key1).toContain('workitems');
    });

    test('should generate different keys for different parameters', () => {
      const key1 = cacheService.generateKey('workitems', 'query', { type: 'story' });
      const key2 = cacheService.generateKey('workitems', 'query', { type: 'bug' });

      expect(key1).not.toBe(key2);
    });

    test('should incorporate filter context (project/sprint/endpoint)', () => {
      const key = cacheService.generateKey('workitems', 'product', {
        project: 'omnia',
        sprint: 'current',
        endpoint: 'getWorkItemsForProduct'
      });

      expect(key).toContain('project:omnia');
      expect(key).toContain('sprint:current');
      expect(key).toContain('endpoint:getWorkItemsForProduct');
    });
  });

  describe('Pattern Invalidation', () => {
    test('clearPattern clears matching memory keys and delegates to Redis when ready', async () => {
      redisConfig.__ready.value = true;

      await cacheService.set('workItems:a', { v: 1 });
      await cacheService.set('workItems:b', { v: 2 });
      await cacheService.set('other:c', { v: 3 });

      const cleared = await cacheService.clearPattern('workItems:*');

      expect(cleared).toBe(true);
      expect(redisConfig.deletePattern).toHaveBeenCalledWith('workItems:*');
      // Matching memory keys are evicted; non-matching remain.
      expect(cacheService.memoryCache.get('workItems:a')).toBeUndefined();
      expect(cacheService.memoryCache.get('other:c')).toBeDefined();
    });

    test('deletePattern is an alias for clearPattern (used by webhook invalidation)', async () => {
      const spy = jest.spyOn(cacheService, 'clearPattern');

      await cacheService.deletePattern('workItems:*');

      expect(spy).toHaveBeenCalledWith('workItems:*');
      spy.mockRestore();
    });
  });

  describe('getOrSet (cache-aside)', () => {
    test('should invoke the loader on a miss and cache the result', async () => {
      const key = 'aside-key';
      const loader = jest.fn().mockResolvedValue({ data: 'fetched-data' });

      const result = await cacheService.getOrSet(key, loader);

      expect(loader).toHaveBeenCalled();
      expect(result).toEqual({ data: 'fetched-data' });

      // Second call should hit the cache and not re-invoke the loader.
      loader.mockClear();
      const cached = await cacheService.getOrSet(key, loader);
      expect(loader).not.toHaveBeenCalled();
      expect(cached).toEqual({ data: 'fetched-data' });
    });
  });

  describe('Batch Operations', () => {
    test('getBatch returns a keyed map of values', async () => {
      await cacheService.set('k1', 'v1');
      await cacheService.set('k2', 'v2');

      const result = await cacheService.getBatch(['k1', 'k2', 'k3']);

      expect(result.k1).toBe('v1');
      expect(result.k2).toBe('v2');
      expect(result.k3).toBeNull();
    });

    test('setBatch stores multiple entries and reports success count', async () => {
      const count = await cacheService.setBatch([
        { key: 'b1', data: 'v1' },
        { key: 'b2', data: 'v2' }
      ]);

      expect(count).toBe(2);
      expect(await cacheService.get('b1')).toBe('v1');
    });
  });

  describe('Statistics and Health', () => {
    test('getStatistics returns overall + cacheStats shape', async () => {
      const stats = await cacheService.getStatistics();

      expect(stats).toHaveProperty('overall');
      expect(stats.overall).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('cacheStats');
      expect(stats.cacheStats).toHaveProperty('redisEnabled');
    });

    test('healthCheck reports degraded when Redis is unavailable', async () => {
      redisConfig.__ready.value = false;
      const health = await cacheService.healthCheck();

      expect(health).toHaveProperty('status', 'degraded');
      expect(health.memory).toHaveProperty('status', 'healthy');
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('shutdown flushes memory and disconnects Redis', async () => {
      await cacheService.set('temp', 'value');

      await cacheService.shutdown();

      expect(redisConfig.disconnect).toHaveBeenCalled();
      expect(cacheService.memoryCache.get('temp')).toBeUndefined();
    });
  });
});
