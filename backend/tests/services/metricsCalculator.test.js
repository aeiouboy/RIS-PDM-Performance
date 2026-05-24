// Jest globals are available automatically
//
// This suite targets the CURRENT MetricsCalculatorService API. Several methods
// the old suite referenced were renamed or removed:
//   - calculateIndividualPerformance  -> calculateIndividualMetrics
//   - calculateCurrentSprintMetrics   -> (removed; sprint data via getSprintData)
//   - getCacheStats / validateWorkItem / sanitizeMetrics / batchProcessWorkItems
//                                     -> never existed on the current service
// In addition, the honest-data hardening (2026-05) made a number of methods
// either return an explicit "not available / processing" contract or THROW a
// NOT_IMPLEMENTED error instead of fabricating numbers. We assert that contract
// here rather than re-introducing the old fabricated return values.

const MetricsCalculatorService = require('../../src/services/metricsCalculator');
const { createMockAzureDevOpsService, environmentHelpers } = require('../utils/testHelpers');

// The constructor builds a real cacheService + AzureDevOpsApiService internally.
// dataTransformers is real; we exercise the real calculations against fixture
// work items rather than mocking the math.

describe('MetricsCalculatorService', () => {
  let metricsCalculator;
  let mockAzureService;

  beforeAll(() => {
    environmentHelpers.setTestEnvVars();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAzureService = createMockAzureDevOpsService();
    metricsCalculator = new MetricsCalculatorService(mockAzureService);
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with the injected Azure DevOps service', () => {
      expect(metricsCalculator.azureService).toBe(mockAzureService);
      expect(metricsCalculator.cache).toBeInstanceOf(Map);
      expect(metricsCalculator.cacheTTL).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('Overview Metrics Calculation', () => {
    test('should assemble overview metrics from work items', async () => {
      const mockWorkItems = [
        { id: 1, type: 'Task', state: 'Closed', storyPoints: 5 },
        { id: 2, type: 'Bug', state: 'Active', storyPoints: 2 }
      ];

      // Stub the data-fetch boundary; let the real transformers/KPI math run.
      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockResolvedValue(mockWorkItems);

      const options = { period: 'sprint', startDate: '2024-01-01', endDate: '2024-01-14' };
      const result = await metricsCalculator.calculateOverviewMetrics(options);

      expect(result).toHaveProperty('period');
      expect(result.period).toMatchObject({ type: 'sprint', startDate: '2024-01-01', endDate: '2024-01-14' });
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('totalWorkItems', 2);
      expect(result).toHaveProperty('kpis');
      expect(result).toHaveProperty('trends');
      expect(result).toHaveProperty('alerts');
    });

    test('should serve cached overview metrics on a second call', async () => {
      const cachedData = { period: { type: 'sprint' }, summary: { totalWorkItems: 99 } };
      const options = { period: 'sprint', startDate: '2024-01-01', endDate: '2024-01-14' };
      const cacheKey = `overview_${options.period}_${options.startDate}_${options.endDate}_undefined`;

      metricsCalculator.cache.set(cacheKey, { data: cachedData, timestamp: Date.now() });
      metricsCalculator.getWorkItemsForPeriod = jest.fn();

      const result = await metricsCalculator.calculateOverviewMetrics(options);

      expect(result).toEqual(cachedData);
      expect(metricsCalculator.getWorkItemsForPeriod).not.toHaveBeenCalled();
    });

    test('should cache freshly computed overview metrics', async () => {
      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockResolvedValue([
        { id: 1, type: 'Task', state: 'Closed', storyPoints: 5 }
      ]);

      const options = { period: 'sprint' };
      await metricsCalculator.calculateOverviewMetrics(options);

      const cacheKey = `overview_${options.period}_undefined_undefined_undefined`;
      const cachedItem = metricsCalculator.cache.get(cacheKey);
      expect(cachedItem).toBeDefined();
      expect(cachedItem.data).toBeDefined();
    });

    test('should handle an empty work-item set without throwing', async () => {
      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockResolvedValue([]);

      const result = await metricsCalculator.calculateOverviewMetrics();

      expect(result).toHaveProperty('summary');
      expect(result.summary.totalWorkItems).toBe(0);
    });
  });

  describe('KPI Calculations', () => {
    test('should compute KPIs from work items and sprint data', async () => {
      const mockWorkItems = [
        { id: 1, type: 'Task', state: 'Closed', storyPoints: 8 },
        { id: 2, type: 'Bug', state: 'Active', storyPoints: 3 }
      ];
      const mockSprint = { id: 'sprint-1', workItemCount: 2 };

      const kpis = await metricsCalculator.calculateKPIs(mockWorkItems, mockSprint);

      // Current KPI shape (honest-data): teamSatisfaction is a status contract,
      // not a fabricated number; codeQuality/cycleTime are derived from real data.
      expect(kpis).toHaveProperty('deliveryPredictability');
      expect(kpis).toHaveProperty('teamSatisfaction');
      expect(kpis).toHaveProperty('codeQuality');
      expect(kpis).toHaveProperty('cycleTime');
      expect(typeof kpis.codeQuality).toBe('number');
    });

    test('teamSatisfaction is an honest "processing" contract, not a fabricated score', async () => {
      const kpis = await metricsCalculator.calculateKPIs([], null);

      // Fabricated 7.6 fallback was removed 2026-05-24 — must be the status object.
      expect(kpis.teamSatisfaction).toMatchObject({
        status: 'processing',
        dataSource: 'pending_survey_integration'
      });
    });

    test('deliveryPredictability is null when there is no sprint commitment data', async () => {
      // Fabricated 78.9 default removed 2026-05-24.
      const kpis = await metricsCalculator.calculateKPIs([{ id: 1, state: 'Closed' }], null);
      expect(kpis.deliveryPredictability).toBeNull();
    });
  });

  describe('Individual Metrics (calculateIndividualMetrics)', () => {
    test('should assemble individual metrics for a user with work items', async () => {
      const userId = 'user@company.com';
      const userWorkItems = [
        { id: 1, type: 'Task', workItemType: 'Task', state: 'Closed', storyPoints: 5, changedDate: '2024-01-10' },
        { id: 2, type: 'Bug', workItemType: 'Bug', state: 'Active', storyPoints: 2, changedDate: '2024-01-11' }
      ];

      mockAzureService.getUserWorkItems = jest.fn().mockResolvedValue(userWorkItems);
      mockAzureService.getUserPerformanceHistory = jest.fn().mockResolvedValue([]);
      mockAzureService.getUserCapacityData = jest.fn().mockResolvedValue(null);
      // Short-circuit team-member lookup (hits multiple projects otherwise).
      metricsCalculator.getUserInfoFromTeamMembers = jest.fn().mockResolvedValue({
        name: 'User', email: userId, avatar: null, role: 'Developer'
      });

      const result = await metricsCalculator.calculateIndividualMetrics(userId, {
        startDate: '2024-01-01',
        endDate: '2024-01-14'
      });

      expect(result).toHaveProperty('userId', userId);
      expect(result).toHaveProperty('performance');
      expect(result.performance).toHaveProperty('completionRate');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('workItems');
      expect(result.workItems).toHaveProperty('total', 2);
    });

    test('should handle a user with no work items', async () => {
      const userId = 'empty@company.com';
      mockAzureService.getUserWorkItems = jest.fn().mockResolvedValue([]);
      mockAzureService.getUserPerformanceHistory = jest.fn().mockResolvedValue([]);
      mockAzureService.getUserCapacityData = jest.fn().mockResolvedValue(null);
      metricsCalculator.getUserInfoFromTeamMembers = jest.fn().mockResolvedValue({
        name: 'Empty', email: userId, avatar: null, role: 'Developer'
      });

      const result = await metricsCalculator.calculateIndividualMetrics(userId);

      expect(result.userId).toBe(userId);
      expect(result.performance.completedStoryPoints).toBe(0);
      expect(result.performance.velocity).toBe(0);
      expect(result.workItems.total).toBe(0);
    });
  });

  describe('Honest-Data Contract (removed mock methods)', () => {
    // These methods now intentionally throw NOT_IMPLEMENTED instead of returning
    // fabricated numbers. Assert the throw/contract — do NOT expect old values.
    test('calculateUserPerformanceMetrics throws NOT_IMPLEMENTED', () => {
      expect(() => metricsCalculator.calculateUserPerformanceMetrics([])).toThrow(/mock removed/i);
      try {
        metricsCalculator.calculateUserPerformanceMetrics([]);
      } catch (e) {
        expect(e.code).toBe('NOT_IMPLEMENTED');
      }
    });

    test('getTeamAverageMetrics rejects with NOT_IMPLEMENTED', async () => {
      await expect(metricsCalculator.getTeamAverageMetrics()).rejects.toThrow(/real Azure DevOps integration required/i);
    });

    test('calculateUserTrends rejects with NOT_IMPLEMENTED', async () => {
      await expect(metricsCalculator.calculateUserTrends('user', 'sprint')).rejects.toThrow(/mock removed/i);
    });

    test('getTotalProducts / getActiveProjects return null (hardcoded counts removed)', async () => {
      await expect(metricsCalculator.getTotalProducts()).resolves.toBeNull();
      await expect(metricsCalculator.getActiveProjects()).resolves.toBeNull();
    });

    test('getVelocityTrend returns null and getVelocityHistory returns [] (fabricated values removed)', async () => {
      await expect(metricsCalculator.getVelocityTrend()).resolves.toBeNull();
      await expect(metricsCalculator.getVelocityHistory()).resolves.toEqual([]);
    });

    test('calculateUtilization surfaces a not_available contract instead of a magic number', () => {
      const util = metricsCalculator.calculateUtilization({ teamTotals: {}, totalMembers: 0 });
      expect(util).toMatchObject({ value: null, status: 'not_available' });
    });
  });

  describe('Sprint Data', () => {
    test('getSprintData returns null when no real iteration is found', async () => {
      // Fabricated "Delivery 13" fallback removed 2026-05-24 — must return null.
      mockAzureService.iterationResolver = {
        getProjectIterations: jest.fn().mockResolvedValue([])
      };

      const result = await metricsCalculator.getSprintData('current', 'omnia');
      expect(result).toBeNull();
    });

    test('calculateBurndownData returns [] when sprint info is absent', async () => {
      const result = await metricsCalculator.calculateBurndownData([{ id: 1 }], null);
      expect(result).toEqual([]);
    });
  });

  describe('Enhanced User Helpers', () => {
    test('calculateEnhancedUserPerformance computes completion rate and velocity', () => {
      const items = [
        { state: 'Closed', storyPoints: 5 },
        { state: 'Active', storyPoints: 3 }
      ];
      const perf = metricsCalculator.calculateEnhancedUserPerformance(items);

      expect(perf.completedStoryPoints).toBe(5);
      expect(perf.totalAssignedStoryPoints).toBe(8);
      expect(perf.completionRate).toBe(50);
      expect(perf.velocity).toBe(5);
    });

    test('categorizeWorkItemsByType buckets items by workItemType', () => {
      const items = [
        { workItemType: 'Task' },
        { workItemType: 'Bug' },
        { workItemType: 'Bug' },
        { workItemType: 'User Story' }
      ];
      const cats = metricsCalculator.categorizeWorkItemsByType(items);

      expect(cats.task).toBe(1);
      expect(cats.bug).toBe(2);
      expect(cats.userStory).toBe(1);
    });
  });

  describe('Cache Management', () => {
    test('getFromCache returns null for an expired entry', async () => {
      const options = { period: 'sprint' };
      const cacheKey = `overview_${options.period}_undefined_undefined_undefined`;
      metricsCalculator.cache.set(cacheKey, {
        data: { test: 'expired' },
        timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes ago (> 5min TTL)
      });

      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockResolvedValue([]);
      await metricsCalculator.calculateOverviewMetrics(options);

      // Expired cache => recompute path runs.
      expect(metricsCalculator.getWorkItemsForPeriod).toHaveBeenCalled();
    });

    test('clearCache empties the in-memory cache', () => {
      metricsCalculator.cache.set('k1', { data: 'v1', timestamp: Date.now() });
      metricsCalculator.cache.set('k2', { data: 'v2', timestamp: Date.now() });
      expect(metricsCalculator.cache.size).toBe(2);

      metricsCalculator.clearCache();

      expect(metricsCalculator.cache.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('propagates a wrapped error when the data fetch fails', async () => {
      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      await expect(metricsCalculator.calculateOverviewMetrics()).rejects.toThrow(/Service unavailable/);
    });
  });
});
