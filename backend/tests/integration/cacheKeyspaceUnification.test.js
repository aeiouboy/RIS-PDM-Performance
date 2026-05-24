/**
 * Cache Keyspace Unification Integration Test (AC-P0-0-3)
 *
 * Proves that the cron writer, the webhook invalidator, and the dashboard reader
 * all operate on the SAME keyspace: ris:cache:workitems:*
 *
 *   1. cacheService.buildServedWorkItemsKey() produces the canonical served key.
 *   2. cacheService.servedWorkItemsPattern() returns 'ris:cache:workitems:*'.
 *   3. A webhook event calls deletePattern(servedWorkItemsPattern()) and evicts
 *      the cron-written served key.
 *   4. All three touchpoints therefore share one namespace — no orphaned writes.
 *
 * Uses the REAL cacheService singleton (memory-cache tier; Redis is unavailable in
 * tests) and the REAL webhook service so the end-to-end wiring is exercised.
 */

const cacheService = require('../../src/services/cacheService');
const AzureDevOpsWebhookService = require('../../src/services/azureDevOpsWebhookService');

const FRONTEND_ID = 'Product - OMNIA';
const SPRINT_ID = 'sprint-123';
const AZURE_PROJECT = 'Product - OMNIA';

describe('Cache keyspace unification (AC-P0-0-3)', () => {
  let webhookService;

  beforeEach(() => {
    webhookService = new AzureDevOpsWebhookService({
      cacheService,
      enableSignatureValidation: false
    });
  });

  afterEach(async () => {
    // Clean up the served keyspace between tests
    await cacheService.clearPattern(cacheService.servedWorkItemsPattern());
    webhookService.clearQueue();
  });

  test('buildServedWorkItemsKey produces a ris:cache:workitems:* key', () => {
    const key = cacheService.buildServedWorkItemsKey(FRONTEND_ID, SPRINT_ID, AZURE_PROJECT);
    expect(key).toMatch(/^ris:cache:workitems:/);
    expect(key).toContain('product');
    expect(key).toContain('sprint');
    expect(key).toContain('endpoint_getWorkItemsForProduct');
  });

  test('servedWorkItemsPattern returns ris:cache:workitems:*', () => {
    expect(cacheService.servedWorkItemsPattern()).toBe('ris:cache:workitems:*');
  });

  test('cacheService exposes deletePattern (webhook invalidation contract)', () => {
    expect(typeof cacheService.deletePattern).toBe('function');
  });

  test('webhook invalidation evicts cron-written served keys', async () => {
    const servedKey = cacheService.buildServedWorkItemsKey(FRONTEND_ID, SPRINT_ID, AZURE_PROJECT);

    // Simulate the cron writer placing data in the served keyspace
    await cacheService.set(servedKey, { total: 42, lastSync: new Date().toISOString() });
    expect(await cacheService.get(servedKey)).not.toBeNull();

    // A webhook event for a work item must invalidate the served keyspace
    await webhookService.invalidateWorkItemCaches(999, {
      'System.IterationPath': 'Product - OMNIA\\OMS - Sprint 3'
    });

    // Cron-written served key must now be gone
    expect(await cacheService.get(servedKey)).toBeNull();
  });

  test('processing a webhook event invalidates served keys end-to-end', async () => {
    const servedKey = cacheService.buildServedWorkItemsKey(FRONTEND_ID, 'current', AZURE_PROJECT);
    await cacheService.set(servedKey, { total: 7 });
    expect(await cacheService.get(servedKey)).not.toBeNull();

    await webhookService.processEvent({
      eventType: 'workitem.updated',
      id: 'evt-1',
      resource: {
        id: 12345,
        fields: {
          'System.Title': 'Updated item',
          'System.WorkItemType': 'Task',
          'System.State': 'Active'
        }
      }
    });

    expect(await cacheService.get(servedKey)).toBeNull();
  });

  test('buildServedWorkItemsKey is stable across calls with same args', () => {
    const key1 = cacheService.buildServedWorkItemsKey(FRONTEND_ID, SPRINT_ID, AZURE_PROJECT);
    const key2 = cacheService.buildServedWorkItemsKey(FRONTEND_ID, SPRINT_ID, AZURE_PROJECT);
    expect(key1).toBe(key2);
  });
});
