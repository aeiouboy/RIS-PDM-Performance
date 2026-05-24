const MetricsCalculatorService = require('../../src/services/metricsCalculator');

describe('MetricsCalculatorService calculatePLMetrics honest data contract', () => {
  test('returns explicit not_available/not_implemented without fabricated P/L values', async () => {
    const service = new MetricsCalculatorService({});
    const workItems = [
      { id: 1, businessValue: 1000000, effort: 10, state: 'Closed' },
      { id: 2, businessValue: 250000, effort: 3, state: 'Active' }
    ];

    const result = await service.calculatePLMetrics(workItems, 'Product - OMNIA');

    expect(result).toEqual({
      value: null,
      trend: null,
      trendValue: '—',
      target: null,
      status: 'not_available',
      message: 'P/L metric is not implemented until a real financial data source is wired.',
      dataSource: 'not_implemented'
    });
    expect(result.value).toBeNull();
    expect(result.trend).toBeNull();
    expect(result.target).toBeNull();
    expect(result.status).toBe('not_available');
    expect(result.dataSource).toBe('not_implemented');
  });
});
