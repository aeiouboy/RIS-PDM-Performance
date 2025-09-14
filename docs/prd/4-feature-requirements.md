# 4. Feature Requirements

## 4.1 High-Level Features

### 4.1.1 Product Selection
- Dropdown หรือ Tab Navigation สำหรับเลือก Product
- Quick Switch between Products
- Product Comparison View (Phase 2)

### 4.1.2 Metrics Dashboard
**P/L Metrics:**
- Revenue Tracking
- Cost Analysis
- Profit Margin Trends
- Budget vs Actual

**Stakeholder Metrics:**
- Satisfaction Score
- Feedback Summary
- Response Time Analytics

**Productivity Metrics:**
- Velocity Trends
- Story Points Completed
- Sprint Burndown
- Cycle Time Analysis

**Quality Metrics:**
- Bug Count & Severity
- Code Review Metrics
- Test Coverage
- Technical Debt Tracking

**Issue Tracking:**
- Open/Closed Issues Ratio
- Issue Resolution Time
- Priority Distribution
- Blocker Analysis

### 4.1.3 Visualization Types
- **Line Charts:** Trends over time (Velocity, P/L)
- **Bar Charts:** Comparisons (Story Points by Member)
- **Pie Charts:** Distribution (Task Types, Issue Priority)
- **Heatmaps:** Team Activity Patterns
- **KPI Cards:** Key metrics with trend indicators

### 4.1.4 Filtering System
- **Time Filters:**
  - Sprint Selection (Current, Previous, Custom Range)
  - Calendar Date Picker
  - Quick Filters (Last 7/30/90 days)
  - Quarter/Year View

- **Data Filters:**
  - Team Member Selection
  - Task Type
  - Status
  - Priority Level

### 4.1.5 Individual Performance View
- Personal Dashboard per Team Member
- Task Completion Rate
- Story Points Delivered
- Quality Metrics (Bugs Created vs Fixed)
- Contribution Timeline

## 4.2 Mid-Level Requirements

### 4.2.1 User Interface
- Clean, modern design using Tailwind CSS
- Dark/Light mode toggle
- Customizable Dashboard Layout
- Export functionality (PDF, Excel)
- Real-time data refresh indicators

### 4.2.2 Mobile Responsiveness
- Responsive grid system
- Touch-optimized interactions
- Simplified navigation for mobile
- Offline capability for viewing cached data
- Native app considerations (Phase 2)

### 4.2.3 Performance Requirements
- Initial load time < 3 seconds
- Chart rendering < 1 second
- API response time < 500ms
- Support 100+ concurrent users

## 4.3 Low-Level Technical Requirements

### 4.3.1 Azure DevOps Integration
**API Endpoints & Implementation:**

**1. Query Work Items (WIQL)**
```javascript
// Get all work items for a specific project
const getWorkItems = async () => {
  const organization = 'your-org';
  const project = 'your-project';
  const pat = 'YOUR_AZURE_DEVOPS_PAT_HERE';
  
  const response = await fetch(
    `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.0`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
      },
      body: JSON.stringify({
        query: `SELECT [System.Id], [System.Title], [System.WorkItemType], 
                [System.AssignedTo], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints],
                [System.CreatedDate], [System.ChangedDate], [System.AreaPath], 
                [System.IterationPath]
                FROM WorkItems 
                WHERE [System.TeamProject] = @project 
                AND [System.WorkItemType] IN ('Task', 'Bug', 'User Story')
                AND [System.State] <> 'Removed'
                ORDER BY [System.ChangedDate] DESC`
      })
    }
  );
  
  const data = await response.json();
  return data.workItems;
};
```

**2. Get Work Item Details with All Fields**
```javascript
// Fetch detailed information for specific work items
const getWorkItemDetails = async (workItemIds) => {
  const organization = 'your-org';
  const project = 'your-project';
  const pat = 'YOUR_AZURE_DEVOPS_PAT_HERE';
  
  // Batch request for multiple work items
  const ids = workItemIds.join(',');
  const fields = [
    'System.Id',
    'System.Title',
    'System.WorkItemType',
    'System.AssignedTo',
    'System.State',
    'Microsoft.VSTS.Scheduling.StoryPoints',
    'System.CreatedDate',
    'System.ChangedDate',
    'System.Tags',
    'System.AreaPath',
    'System.IterationPath',
    'Microsoft.VSTS.Common.Priority',
    'Microsoft.VSTS.Scheduling.RemainingWork',
    'Microsoft.VSTS.Scheduling.CompletedWork'
  ].join(',');
  
  const response = await fetch(
    `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems?ids=${ids}&fields=${fields}&api-version=7.0`,
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
      }
    }
  );
  
  return await response.json();
};
```

**3. Get Sprint/Iteration Data**
```javascript
// Get current and past iterations
const getIterations = async (teamName) => {
  const organization = 'your-org';
  const project = 'your-project';
  const pat = 'YOUR_AZURE_DEVOPS_PAT_HERE';
  
  const response = await fetch(
    `https://dev.azure.com/${organization}/${project}/${teamName}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.0`,
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
      }
    }
  );
  
  return await response.json();
};
```

**4. Get Team Capacity and Velocity**
```javascript
// Get team capacity for a specific iteration
const getTeamCapacity = async (teamName, iterationId) => {
  const organization = 'your-org';
  const project = 'your-project';
  const pat = 'YOUR_AZURE_DEVOPS_PAT_HERE';
  
  const response = await fetch(
    `https://dev.azure.com/${organization}/${project}/${teamName}/_apis/work/teamsettings/iterations/${iterationId}/capacities?api-version=7.0`,
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
      }
    }
  );
  
  return await response.json();
};
```

**5. Real cURL Examples for Testing**
```bash
# Query work items with specific conditions
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic OjluZTdTS01WV04wZG5FakRmVmtpelIzSE9wbDU1UlBJWmpxR0gwcVFJa21JUnFTUU5iSUhKUVFKOTlCR0FDQUFBQXZBZTZKQUFBU0FaRE8xZDZ1" \
  -d '{
    "query": "SELECT [System.Id], [System.Title], [System.WorkItemType], [System.AssignedTo], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints] FROM WorkItems WHERE [System.State] = \"In Progress\" AND [System.WorkItemType] = \"Task\""
  }' \
  "https://dev.azure.com/your-org/your-project/_apis/wit/wiql?api-version=7.0"

# Get specific work item details
curl -X GET \
  -H "Authorization: Basic OjluZTdTS01WV04wZG5FakRmVmtpelIzSE9wbDU1UlBJWmpxR0gwcVFJa21JUnFTUU5iSUhKUVFKOTlCR0FDQUFBQXZBZTZKQUFBU0FaRE8xZDZ1" \
  "https://dev.azure.com/your-org/your-project/_apis/wit/workitems/123?api-version=7.0"
```

**Authentication Setup:**
```javascript
// Configuration object for Azure DevOps
const azureDevOpsConfig = {
  organization: process.env.AZURE_DEVOPS_ORG,
  project: process.env.AZURE_DEVOPS_PROJECT,
  pat: process.env.AZURE_DEVOPS_PAT,
  apiVersion: '7.0'
};

// Helper function for authenticated requests
const makeAzureRequest = async (endpoint, options = {}) => {
  const baseUrl = `https://dev.azure.com/${azureDevOpsConfig.organization}`;
  const auth = Buffer.from(`:${azureDevOpsConfig.pat}`).toString('base64');
  
  return fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
};
```

**Data Fields Mapping:**
```javascript
// Complete field mapping for Azure DevOps work items
const fieldMapping = {
  id: 'System.Id',
  title: 'System.Title',
  type: 'System.WorkItemType',
  assignee: 'System.AssignedTo',
  state: 'System.State',
  storyPoints: 'Microsoft.VSTS.Scheduling.StoryPoints',
  priority: 'Microsoft.VSTS.Common.Priority',
  createdDate: 'System.CreatedDate',
  changedDate: 'System.ChangedDate',
  closedDate: 'Microsoft.VSTS.Common.ClosedDate',
  tags: 'System.Tags',
  areaPath: 'System.AreaPath',
  iterationPath: 'System.IterationPath',
  remainingWork: 'Microsoft.VSTS.Scheduling.RemainingWork',
  completedWork: 'Microsoft.VSTS.Scheduling.CompletedWork',
  originalEstimate: 'Microsoft.VSTS.Scheduling.OriginalEstimate',
  blockedReason: 'System.Reason',
  parent: 'System.Parent'
};

// Transform Azure DevOps response to our data model
const transformWorkItem = (azureWorkItem) => {
  const fields = azureWorkItem.fields;
  return {
    id: fields['System.Id'],
    title: fields['System.Title'],
    type: fields['System.WorkItemType'],
    assignee: fields['System.AssignedTo']?.displayName || 'Unassigned',
    assigneeEmail: fields['System.AssignedTo']?.uniqueName,
    state: fields['System.State'],
    storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
    priority: fields['Microsoft.VSTS.Common.Priority'] || 4,
    createdDate: fields['System.CreatedDate'],
    changedDate: fields['System.ChangedDate'],
    closedDate: fields['Microsoft.VSTS.Common.ClosedDate'],
    tags: fields['System.Tags']?.split(';').filter(t => t) || [],
    areaPath: fields['System.AreaPath'],
    iterationPath: fields['System.IterationPath'],
    remainingWork: fields['Microsoft.VSTS.Scheduling.RemainingWork'] || 0,
    completedWork: fields['Microsoft.VSTS.Scheduling.CompletedWork'] || 0
  };
};
```

### 4.3.2 Data Processing
- **Caching Strategy:**
  - Redis for real-time data (5-minute TTL)
  - PostgreSQL for historical data
  - Background jobs for data synchronization

- **Aggregation Logic:**
  - Sprint velocity calculation
  - Burndown chart data preparation
  - Performance scoring algorithm
  - Trend analysis calculations

### 4.3.3 Technology Stack
**Frontend:**
- React.js or Vue.js
- Tailwind CSS for styling
- Chart.js or D3.js for visualizations
- Redux/Vuex for state management
- Progressive Web App (PWA) capabilities

**Backend:**
- Node.js with Express or .NET Core
- GraphQL or REST API
- WebSocket for real-time updates

**Infrastructure:**
- Docker containers
- Kubernetes for orchestration
- Azure App Service or AWS ECS
- CDN for static assets

---
