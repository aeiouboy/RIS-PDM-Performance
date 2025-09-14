# Azure DevOps Work Items API - Implementation Guide

**Purpose**: Complete implementation reference for Azure DevOps Work Items API integration for dashboard data sync fix.

## Core API Endpoints

### Work Items Batch Retrieval (Recommended)
**Endpoint**: `POST https://dev.azure.com/{organization}/{project}/_apis/wit/workitemsbatch?api-version=7.1`

**Benefits**:
- Retrieve up to 200 work items in single request (vs 20 for GET)
- More efficient than individual work item requests
- Supports filtering and field selection

**Request Body**:
```json
{
  "ids": [1234, 1235, 1236],
  "fields": [
    "System.Id",
    "System.Title",
    "System.WorkItemType",
    "System.State",
    "System.AssignedTo",
    "System.IterationPath",
    "Microsoft.VSTS.Scheduling.StoryPoints",
    "Microsoft.VSTS.Common.Priority",
    "System.CreatedDate",
    "System.ChangedDate"
  ]
}
```

### Query Work Items by Iteration
**Endpoint**: `GET https://dev.azure.com/{organization}/{project}/{team}/_apis/work/teamsettings/iterations/{iterationId}/workitems?api-version=7.1`

**Response**: Returns work item references that need batch retrieval for full details

## Authentication Pattern

**Personal Access Token (Recommended for Implementation)**:
```javascript
const headers = {
  'Authorization': `Basic ${Buffer.from(`:${personalAccessToken}`).toString('base64')}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};
```

**Rate Limiting**: 300 requests per 15-minute window per user

## Work Item Classification

### Bug vs Story vs Task Identification
```javascript
function classifyWorkItems(workItems) {
  return {
    bugs: workItems.filter(wi => wi.fields['System.WorkItemType'] === 'Bug'),
    stories: workItems.filter(wi => wi.fields['System.WorkItemType'] === 'User Story'),
    tasks: workItems.filter(wi => wi.fields['System.WorkItemType'] === 'Task')
  };
}
```

### Current Sprint Bug Count Fix
**Problem**: Dashboard shows 20 bugs, Azure DevOps has 15 bugs
**Solution**: Use real API counts instead of mock data generation

```javascript
// ❌ Current (wrong): generates 6 bugs via percentage
bugs: Math.round(sprintTaskCount * 0.15)

// ✅ Fixed: use actual Azure DevOps counts
const workItems = await azureService.getCurrentSprintWorkItems();
const bugCount = workItems.filter(wi => wi.fields['System.WorkItemType'] === 'Bug').length;
```

## Error Handling Patterns

### Retry Logic with Exponential Backoff
```javascript
async function apiCallWithRetry(operation, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Rate Limit Handling
```javascript
if (error.response?.status === 429) {
  const retryAfter = error.response.headers['retry-after'] || 60;
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  return apiCallWithRetry(operation, maxAttempts - 1);
}
```

## Data Transformation

### Azure DevOps to Dashboard Format
```javascript
function transformWorkItem(azureWorkItem) {
  return {
    id: azureWorkItem.id,
    title: azureWorkItem.fields['System.Title'],
    type: azureWorkItem.fields['System.WorkItemType'],
    state: azureWorkItem.fields['System.State'],
    assignee: azureWorkItem.fields['System.AssignedTo']?.displayName,
    storyPoints: azureWorkItem.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
    priority: azureWorkItem.fields['Microsoft.VSTS.Common.Priority'],
    createdDate: azureWorkItem.fields['System.CreatedDate'],
    changedDate: azureWorkItem.fields['System.ChangedDate']
  };
}
```

## Implementation Notes

1. **Use Batch Endpoints**: Always prefer batch operations over individual calls
2. **Field Selection**: Only request needed fields to reduce response size
3. **Caching Strategy**: Cache work item details for 5 minutes, sprint data for 30 minutes
4. **Error Fallback**: Gracefully fall back to cached/mock data when API fails
5. **Rate Limiting**: Implement client-side rate limiting to stay under quotas

**Reference**: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items