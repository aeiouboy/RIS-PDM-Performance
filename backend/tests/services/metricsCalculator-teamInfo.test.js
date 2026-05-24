const MetricsCalculatorService = require('../../src/services/metricsCalculator');

describe('MetricsCalculatorService getTeamInfo honest data contract', () => {
  test('returns real Azure DevOps team member data without fabricated capacity or lead', async () => {
    const azureService = {
      getWorkItems: jest.fn().mockResolvedValue({
        workItems: [
          {
            id: 1,
            assignedTo: {
              displayName: 'Jane Developer',
              uniqueName: 'jane.developer@example.com',
              _links: { avatar: { href: 'https://example.com/avatar/jane.png' } }
            }
          },
          {
            id: 2,
            assignedTo: {
              displayName: 'Jane Developer',
              uniqueName: 'jane.developer@example.com'
            }
          },
          {
            id: 3,
            assignedTo: {
              displayName: 'Sam Tester',
              uniqueName: 'sam.tester@example.com'
            }
          }
        ]
      })
    };
    const service = new MetricsCalculatorService(azureService);

    const result = await service.getTeamInfo('oms-team');

    expect(result).toEqual({
      id: 'oms-team',
      name: 'oms-team',
      status: 'ok',
      dataSource: 'azure_devops_work_items_assigned_to',
      isHidden: false,
      members: [
        {
          id: 'jane.developer@example.com',
          name: 'Jane Developer',
          displayName: 'Jane Developer',
          email: 'jane.developer@example.com',
          avatar: 'https://example.com/avatar/jane.png'
        },
        {
          id: 'sam.tester@example.com',
          name: 'Sam Tester',
          displayName: 'Sam Tester',
          email: 'sam.tester@example.com',
          avatar: null
        }
      ]
    });
    expect(result).not.toHaveProperty('capacity');
    expect(result).not.toHaveProperty('lead');
  });

  test('returns not_available hidden state when team data is absent', async () => {
    const azureService = {
      getWorkItems: jest.fn().mockResolvedValue({ workItems: [] })
    };
    const service = new MetricsCalculatorService(azureService);

    const result = await service.getTeamInfo('empty-team');

    expect(result).toEqual({
      id: 'empty-team',
      name: 'empty-team',
      status: 'not_available',
      dataSource: 'azure_devops_work_items_assigned_to',
      isHidden: true,
      members: [],
      message: 'No Azure DevOps team member data is available for this team.'
    });
    expect(result).not.toHaveProperty('capacity');
    expect(result).not.toHaveProperty('lead');
  });
});
