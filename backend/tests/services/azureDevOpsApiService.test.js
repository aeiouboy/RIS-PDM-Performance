const AzureDevOpsApiService = require('../../src/services/azureDevOpsApiService');

describe('AzureDevOpsApiService getRealSprintData', () => {
  let service;

  beforeEach(() => {
    process.env.AZURE_DEVOPS_ORG = 'test-org';
    process.env.AZURE_DEVOPS_PAT = 'test-pat';
    service = new AzureDevOpsApiService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns an empty sprint list without calling fabricated fallback when Azure DevOps has no iterations', async () => {
    jest.spyOn(service, 'getProjectIterations').mockResolvedValue([]);
    const fallbackSpy = jest
      .spyOn(service, 'getFallbackSprintData')
      .mockImplementation(() => {
        throw new Error('fabricated fallback must not be called');
      });

    const result = await service.getRealSprintData('omnia');

    expect(result).toEqual([]);
    expect(fallbackSpy).not.toHaveBeenCalled();
  });

  test('returns an empty sprint list without calling fabricated fallback when Azure DevOps request fails', async () => {
    jest.spyOn(service, 'getProjectIterations').mockRejectedValue(new Error('Azure DevOps unavailable'));
    const fallbackSpy = jest
      .spyOn(service, 'getFallbackSprintData')
      .mockImplementation(() => {
        throw new Error('fabricated fallback must not be called');
      });

    const result = await service.getRealSprintData('omnia');

    expect(result).toEqual([]);
    expect(fallbackSpy).not.toHaveBeenCalled();
  });
});
