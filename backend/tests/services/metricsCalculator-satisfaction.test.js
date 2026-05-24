const MetricsCalculatorService = require('../../src/services/metricsCalculator');

describe('MetricsCalculatorService calculateSatisfactionMetrics honest data contract', () => {
  test('returns not_available/not_implemented until a real survey source exists', async () => {
    const service = new MetricsCalculatorService({});
    const workItems = [
      { id: 1, satisfactionScore: 4.9, customerFeedback: 'positive' },
      { id: 2, satisfactionScore: 1.2, customerFeedback: 'negative' }
    ];

    const result = await service.calculateSatisfactionMetrics(workItems);

    expect(result).toEqual({
      value: null,
      trend: null,
      trendValue: '—',
      target: null,
      status: 'not_available',
      message: 'Satisfaction metric is not implemented until a real survey data source is wired.',
      dataSource: 'not_implemented'
    });
  });
});
