// Jest globals are available automatically
//
// This suite targets the CURRENT AzureDevOpsService surface. The previous suite
// was written against an imagined API (authenticate/isAuthenticated/getWorkItem/
// getWorkItemsByQuery/getCurrentIteration/getCapacities/getWorkItemsBatch) that
// the real service never had, and it made un-mocked real HTTP calls that hit an
// HTML error page ("Unexpected token '<'").
//
// The real service funnels every network call through a single method:
//   makeRequest(endpoint, options) -> parsed JSON
// so we mock THAT (the network chokepoint) to run hermetically against fixtures,
// rather than intercepting native fetch. Public methods return rich objects, not
// bare arrays:
//   getWorkItems()        -> { workItems, query, totalCount, returnedCount }
//   getWorkItemDetails()  -> { workItems, count, fields }
//   getIterations(team)   -> { iterations, count, team, timeframe }  (team required)
//   getProjects()         -> { projects, count, organization }
//   getTeamMembers()      -> Array<member>

const AzureDevOpsService = require('../../src/services/azureDevOpsService');
const { environmentHelpers } = require('../utils/testHelpers');

describe('AzureDevOpsService', () => {
  let service;

  beforeAll(() => {
    environmentHelpers.setTestEnvVars();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AzureDevOpsService({
      organization: 'test-org',
      project: 'test-project',
      pat: 'test-pat-token'
    });
    // Disable the enhanced cache so each call exercises the real request path.
    service.cacheService = { generateKey: () => 'k', get: async () => null, set: async () => true };
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with the provided configuration', () => {
      expect(service.organization).toBe('test-org');
      expect(service.project).toBe('test-project');
      expect(service.pat).toBe('test-pat-token');
      expect(service.apiVersion).toBe('7.0');
      expect(service.baseUrl).toBe('https://dev.azure.com/test-org');
    });

    test('should fall back to environment variables when no config is provided', () => {
      const envService = new AzureDevOpsService();
      expect(envService.organization).toBe('test-org');
      expect(envService.project).toBe('test-project');
      expect(envService.pat).toBe('test-pat-token');
    });

    test('should throw when required configuration is missing', () => {
      environmentHelpers.cleanupTestEnvVars();
      try {
        // No org/project from config or env -> validateConfig throws.
        expect(() => new AzureDevOpsService({ pat: 'x' })).toThrow(/configuration incomplete/i);
      } finally {
        environmentHelpers.setTestEnvVars();
      }
    });

    test('should build PAT Basic auth headers', () => {
      expect(service.authHeaders.Authorization).toMatch(/^Basic /);
    });
  });

  describe('Work Items', () => {
    test('getWorkItems returns a structured result with a WIQL query', async () => {
      jest.spyOn(service, 'makeRequest').mockResolvedValue({
        workItems: [{ id: 1, url: 'u1' }, { id: 2, url: 'u2' }]
      });

      const result = await service.getWorkItems({ workItemTypes: ['Task'] });

      expect(result).toHaveProperty('workItems');
      expect(Array.isArray(result.workItems)).toBe(true);
      expect(result.workItems.length).toBe(2);
      expect(result).toHaveProperty('query');
      expect(result.query).toContain('SELECT');
      expect(result).toHaveProperty('totalCount', 2);
    });

    test('getWorkItems posts a WIQL query to the wiql endpoint', async () => {
      const spy = jest.spyOn(service, 'makeRequest').mockResolvedValue({ workItems: [] });

      await service.getWorkItems({ workItemTypes: ['Bug'] });

      const [endpoint, options] = spy.mock.calls[0];
      expect(endpoint).toContain('/_apis/wit/wiql');
      expect(options.method).toBe('POST');
      expect(options.body).toHaveProperty('query');
    });

    test('getWorkItemDetails transforms raw Azure work items', async () => {
      jest.spyOn(service, 'makeRequest').mockResolvedValue({
        value: [{
          id: 1,
          fields: {
            'System.Id': 1,
            'System.Title': 'Test',
            'System.WorkItemType': 'Task',
            'System.State': 'Active',
            'Custom.StoryPoint': 5
          }
        }]
      });

      const result = await service.getWorkItemDetails([1]);

      expect(result).toHaveProperty('workItems');
      expect(result.workItems[0]).toMatchObject({ id: 1, title: 'Test', type: 'Task', storyPoints: 5 });
      expect(result).toHaveProperty('count', 1);
    });

    test('getWorkItemDetails rejects a non-array id list', async () => {
      await expect(service.getWorkItemDetails(null)).rejects.toThrow(/non-empty array/i);
    });
  });

  describe('Team Members', () => {
    test('getTeamMembers aggregates members across project teams', async () => {
      jest.spyOn(service, 'makeRequest').mockImplementation(async (endpoint) => {
        if (endpoint.includes('/teams/')) {
          return {
            value: [
              { identity: { uniqueName: 'a@co.com', displayName: 'Alice', id: 'a' } },
              { identity: { uniqueName: 'b@co.com', displayName: 'Bob', id: 'b' } }
            ]
          };
        }
        // teams listing
        return { value: [{ id: 'team-1', name: 'Team 1' }] };
      });

      const members = await service.getTeamMembers();

      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBe(2);
      expect(members[0]).toHaveProperty('email');
      expect(members[0]).toHaveProperty('name');
    });
  });

  describe('Iterations', () => {
    test('getIterations requires a team name', async () => {
      await expect(service.getIterations(null, 'current')).rejects.toThrow(/Team name is required/i);
    });

    test('getIterations returns enriched iterations for a team', async () => {
      jest.spyOn(service, 'makeRequest').mockResolvedValue({
        value: [
          { id: 'it-1', name: 'Sprint 1', path: '\\proj\\Sprint 1', attributes: { timeFrame: 'current' } }
        ]
      });

      const result = await service.getIterations('Team 1', 'current');

      expect(result).toHaveProperty('iterations');
      expect(result.iterations.length).toBe(1);
      // Enrichment is intentionally skipped -> workItemCount is null (not a real 0).
      expect(result.iterations[0].workItemCount).toBeNull();
      expect(result).toHaveProperty('team', 'Team 1');
    });
  });

  describe('Team Capacity', () => {
    test('getTeamCapacity computes per-member and total capacity', async () => {
      jest.spyOn(service, 'makeRequest').mockResolvedValue({
        value: [
          { teamMember: { id: 'a' }, activities: [{ capacityPerDay: 6, assignedWork: 3 }] },
          { teamMember: { id: 'b' }, activities: [{ capacityPerDay: 8, assignedWork: 4 }] }
        ]
      });

      const result = await service.getTeamCapacity('Team 1', 'it-1');

      expect(result).toHaveProperty('teamCapacity');
      expect(result.teamCapacity.length).toBe(2);
      expect(result.teamCapacity[0]).toHaveProperty('totalCapacity', 6);
      expect(result).toHaveProperty('totalCapacity', 14);
      expect(result).toHaveProperty('memberCount', 2);
    });

    test('getTeamCapacity requires team name and iteration id', async () => {
      await expect(service.getTeamCapacity(null, null)).rejects.toThrow(/required/i);
    });
  });

  describe('Projects', () => {
    test('getProjects returns transformed projects', async () => {
      jest.spyOn(service, 'makeRequest').mockResolvedValue({
        value: [
          { id: 'p1', name: 'Project One', state: 'wellFormed', visibility: 'private', url: 'u' }
        ]
      });

      const result = await service.getProjects();

      expect(result).toHaveProperty('projects');
      expect(result.projects.length).toBe(1);
      expect(result.projects[0]).toMatchObject({ id: 'p1', name: 'Project One', status: 'active' });
      expect(result).toHaveProperty('count', 1);
    });
  });

  describe('Error Handling', () => {
    test('getWorkItems wraps a request failure in a descriptive error', async () => {
      jest.spyOn(service, 'makeRequest').mockRejectedValue(new Error('Failed to fetch from Azure DevOps: boom'));

      await expect(service.getWorkItems()).rejects.toThrow(/Failed to fetch/i);
    });

    test('getProjects wraps a request failure', async () => {
      jest.spyOn(service, 'makeRequest').mockRejectedValue(new Error('500 server error'));

      await expect(service.getProjects()).rejects.toThrow(/Failed to fetch projects/i);
    });
  });

  describe('Disabled Mode', () => {
    test('returns an empty disabled result when Azure DevOps is disabled', async () => {
      const prev = process.env.DISABLE_AZURE_DEVOPS;
      process.env.DISABLE_AZURE_DEVOPS = 'true';
      try {
        const disabled = new AzureDevOpsService();
        const result = await disabled.getWorkItems();
        expect(result).toMatchObject({ workItems: [], disabled: true });
      } finally {
        if (prev === undefined) delete process.env.DISABLE_AZURE_DEVOPS;
        else process.env.DISABLE_AZURE_DEVOPS = prev;
      }
    });
  });

  describe('Service Health', () => {
    test('getServiceHealth reports configuration and rate-limiter state', () => {
      const health = service.getServiceHealth();
      expect(health).toHaveProperty('configuration');
      expect(health.configuration).toMatchObject({ organization: 'test-org', project: 'test-project' });
      expect(health).toHaveProperty('rateLimiter');
    });
  });
});
