const AzureDevOpsWebhookService = require('../../src/services/azureDevOpsWebhookService');

describe('AzureDevOpsWebhookService processing duration metrics', () => {
  const fixedNow = new Date('2026-05-24T10:00:00.000Z').getTime();

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('calculates webhook processing times from recorded duration fields only', () => {
    const service = new AzureDevOpsWebhookService({ enableSignatureValidation: false });
    service.stats.eventsReceived = 3;
    service.stats.eventsProcessed = 3;
    service.stats.processingTimes = [
      { processingTimeMs: 120, completedAt: '2026-05-24T09:55:00.000Z' },
      { durationMs: 240, processedAt: '2026-05-24T09:56:00.000Z' },
      { elapsedMs: 360, timestamp: '2026-05-24T09:57:00.000Z' },
      { durationMs: 999, completedAt: '2026-05-23T09:00:00.000Z' },
      { completedAt: '2026-05-24T09:58:00.000Z' }
    ];

    const detailedMetrics = service.getDetailedMetrics('1h');
    const statistics = service.getStatistics();
    const basicStatistics = service.getBasicStatistics();
    const currentMetrics = service.getCurrentMetrics();

    expect(detailedMetrics.performance).toEqual({
      averageProcessingTime: '240ms',
      minProcessingTime: '120ms',
      maxProcessingTime: '360ms',
      totalEventsProcessed: 3,
      eventsPerHour: 3
    });
    expect(statistics.statistics.averageProcessingTime).toBe('240ms');
    expect(basicStatistics.statistics.averageProcessingTime).toBe('240ms');
    expect(currentMetrics.avgProcessingTime).toBe(240);
  });

  test('returns not_available processing time state when no recorded duration exists', () => {
    const service = new AzureDevOpsWebhookService({ enableSignatureValidation: false });
    service.stats.eventsReceived = 2;
    service.stats.eventsProcessed = 2;
    service.stats.processingTimes = [
      { completedAt: '2026-05-24T09:55:00.000Z' },
      { processingTimeMs: undefined, timestamp: '2026-05-24T09:56:00.000Z' }
    ];

    const notAvailableProcessingTime = {
      status: 'not_available',
      dataSource: 'runtime_webhook_processing_times',
      value: null,
      unit: 'ms',
      message: 'No recorded webhook processing duration is available'
    };

    const detailedMetrics = service.getDetailedMetrics('1h');
    const statistics = service.getStatistics();
    const basicStatistics = service.getBasicStatistics();
    const currentMetrics = service.getCurrentMetrics();

    expect(detailedMetrics.performance.averageProcessingTime).toEqual(notAvailableProcessingTime);
    expect(detailedMetrics.performance.minProcessingTime).toEqual(notAvailableProcessingTime);
    expect(detailedMetrics.performance.maxProcessingTime).toEqual(notAvailableProcessingTime);
    expect(statistics.statistics.averageProcessingTime).toEqual(notAvailableProcessingTime);
    expect(basicStatistics.statistics.averageProcessingTime).toEqual(notAvailableProcessingTime);
    expect(currentMetrics.avgProcessingTime).toEqual(notAvailableProcessingTime);
    expect(currentMetrics.avgProcessingTime).not.toBe(0);
    expect(currentMetrics.avgProcessingTime).not.toBe('0ms');
  });
});
