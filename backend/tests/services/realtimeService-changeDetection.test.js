/**
 * Realtime SSE Change-Detection Verification (P1.8 / bug #4)
 *
 * The latent bug: realtimeService's change detection hashes its read-path. Before P0.0
 * the cron wrote to an orphan keyspace the read-path never saw, AND the webhook could
 * not evict the read-path cache (no deletePattern on cacheService), so a fresh sync
 * never changed the hash and no SSE event fired.
 *
 * After P0.0 the keyspace is unified so the webhook's `workItems:*` invalidation evicts
 * what the read-path serves, forcing a re-fetch. This test verifies the remaining link
 * in the chain: when the underlying data changes, calculateDataHash changes and an SSE
 * `metrics-update` event is actually emitted to subscribed clients.
 */

const RealtimeService = require('../../src/services/realtimeService');

function buildService(getWorkItemsImpl) {
  const emit = jest.fn();
  const fakeSocket = { id: 'client-1', emit };

  // Minimal Socket.IO mock: `on('connection')` is invoked in the constructor.
  const io = {
    on: jest.fn(),
    sockets: { sockets: new Map([['client-1', fakeSocket]]) }
  };

  const azureService = { getWorkItems: getWorkItemsImpl };

  const service = new RealtimeService(azureService, io);
  return { service, emit };
}

describe('RealtimeService change detection (SSE) — P0.0 verification', () => {
  test('calculateDataHash differs when data differs and matches when identical', () => {
    const { service } = buildService(jest.fn());
    const a = { totalCount: 10, items: [1, 2, 3] };
    const b = { totalCount: 11, items: [1, 2, 3] };

    expect(service.calculateDataHash(a)).toBe(service.calculateDataHash({ ...a }));
    expect(service.calculateDataHash(a)).not.toBe(service.calculateDataHash(b));
  });

  test('emits metrics-update when workitems data changes between polls', async () => {
    let call = 0;
    const getWorkItems = jest.fn().mockImplementation(async () => {
      call += 1;
      // First poll returns 5 items, second poll (post-sync/invalidation) returns 6.
      const totalCount = call === 1 ? 5 : 6;
      return {
        workItems: Array.from({ length: totalCount }, (_, i) => ({
          id: i + 1,
          fields: { 'System.WorkItemType': 'Task', 'System.State': 'Active' }
        })),
        totalCount
      };
    });

    const { service, emit } = buildService(getWorkItems);

    const subscription = {
      type: 'workitems',
      clients: new Set(['client-1']),
      lastUpdate: null,
      dataHash: null
    };

    // First poll establishes the baseline hash — emits the initial update.
    await service.checkSubscriptionForUpdates('workitems-all-all', subscription);
    const emitsAfterFirst = emit.mock.calls.filter(c => c[0] === 'metrics-update').length;
    expect(emitsAfterFirst).toBe(1);

    // Second poll sees changed data -> hash differs -> a new SSE event fires.
    await service.checkSubscriptionForUpdates('workitems-all-all', subscription);
    const emitsAfterSecond = emit.mock.calls.filter(c => c[0] === 'metrics-update').length;
    expect(emitsAfterSecond).toBe(2);
  });

  test('does NOT emit when data is unchanged (change-detection suppresses noise)', async () => {
    const getWorkItems = jest.fn().mockResolvedValue({
      workItems: [{ id: 1, fields: { 'System.WorkItemType': 'Task', 'System.State': 'Active' } }],
      totalCount: 1
    });

    const { service, emit } = buildService(getWorkItems);

    const subscription = {
      type: 'workitems',
      clients: new Set(['client-1']),
      lastUpdate: null,
      dataHash: null
    };

    await service.checkSubscriptionForUpdates('workitems-all-all', subscription);
    await service.checkSubscriptionForUpdates('workitems-all-all', subscription);

    const totalEmits = emit.mock.calls.filter(c => c[0] === 'metrics-update').length;
    expect(totalEmits).toBe(1); // only the first (baseline) emit, no duplicate
  });
});
