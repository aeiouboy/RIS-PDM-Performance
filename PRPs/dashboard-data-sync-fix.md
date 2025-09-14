name: "Dashboard Data Synchronization Fix - Azure DevOps Real-Time Integration"
description: |
  Fix critical data discrepancies between performance dashboard and Azure DevOps, implement real-time synchronization with accurate sprint dates and work item counts.

---

## Goal

**Feature Goal**: Eliminate all data discrepancies between the RIS-PDM performance dashboard and Azure DevOps API, ensuring 100% data accuracy with real-time synchronization.

**Deliverable**: Fixed Azure DevOps data synchronization service with corrected sprint dates, accurate work item counts, and real-time updates for dashboard metrics.

**Success Definition**: Dashboard displays identical data to Azure DevOps with automatic refresh every 15 minutes during business hours, falling back gracefully to corrected mock data during API failures.

## User Persona

**Target User**: Development team managers and stakeholders monitoring sprint progress

**Use Case**: Daily review of sprint velocity, bug tracking, and team performance metrics during standup meetings and retrospectives

**User Journey**:
1. User opens dashboard and selects project (Product - Data as a Service or Product - Partner Management Platform)
2. User filters by specific sprint (Delivery 2, Delivery 3, Current Sprint)
3. User views accurate sprint dates, work item counts, and velocity metrics
4. User sees real-time updates when work items change in Azure DevOps

**Pain Points Addressed**: Incorrect sprint dates causing confusion in planning, inflated bug counts leading to misallocated resources, smoothed velocity data hiding actual performance variations

## Why

- **Business Value**: Accurate metrics enable better sprint planning and resource allocation decisions
- **User Impact**: Eliminates confusion and misalignment between dashboard reports and Azure DevOps reality
- **Integration Enhancement**: Strengthens existing Azure DevOps integration with real-time capabilities
- **Problem Resolution**: Fixes specific data discrepancies identified in PRD analysis affecting team velocity tracking

## What

Fix three critical data accuracy issues:
1. **Sprint Date Correction**: Update Delivery 2 from July 28-Aug 9 to July 29-Aug 8, Delivery 3 from Aug 12-Aug 23 to Aug 11-Aug 22
2. **Work Item Count Accuracy**: Display actual Azure DevOps work item counts (15 bugs) instead of mock generated counts (20 bugs)
3. **Real-Time Synchronization**: Replace static mock data with live Azure DevOps API integration with 15-minute refresh intervals

### Success Criteria

- [ ] Delivery 2 sprint dates match Azure DevOps: July 29 - Aug 8
- [ ] Delivery 3 sprint dates match Azure DevOps: Aug 11 - Aug 22
- [ ] Current sprint shows 15 bugs (matching Azure DevOps) not 20 bugs
- [ ] Work item counts update automatically every 15 minutes during business hours (8 AM - 6 PM weekdays)
- [ ] Dashboard falls back gracefully to corrected mock data during Azure DevOps API failures
- [ ] Real-time updates complete within 2 seconds
- [ ] Data validation dashboard shows last sync timestamp and status

## All Needed Context

### Context Completeness Check

_"If someone knew nothing about this codebase, would they have everything needed to implement this successfully?"_ ✅ YES - All patterns, file locations, API documentation, and gotchas are provided below.

### Documentation & References

```yaml
- docfile: PRPs/ai_docs/azure-devops-work-items-api.md
  why: Complete Work Items API patterns for accurate bug/story/task counting
  section: Bug vs Story vs Task Identification, Current Sprint Bug Count Fix
  critical: Batch API usage (200 items vs 20), proper work item classification

- docfile: PRPs/ai_docs/azure-devops-iterations-api.md
  why: Sprint date synchronization patterns and exact date corrections needed
  section: Sprint Date Transformation, Current Problems vs Fixed Implementation
  critical: Project/team mapping for correct API calls, exact PRD date requirements

- docfile: PRPs/ai_docs/real-time-dashboard-sync-patterns.md
  why: Real-time synchronization architecture and caching strategies
  section: SSE Implementation Pattern, Intelligent Caching Strategy
  critical: Server-Sent Events over WebSocket, threshold-based updates (5% change detection)

- url: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items#get-work-items-batch
  why: Official batch work items API for efficient data retrieval
  critical: 200 items per request limit, field selection optimization, rate limiting (300 requests/15min)

- url: https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations#get-team-iterations
  why: Sprint/iteration retrieval for accurate date synchronization
  critical: timeframe parameter for current sprint detection, team-specific iteration paths

- file: /Users/tachongrak/Projects/ris-pdm/backend/routes/metrics.js
  why: Current implementation with hardcoded sprint dates and incorrect bug counts (lines 2112-2161)
  pattern: API route structure, error handling with Azure DevOps service integration
  gotcha: Mock data fallback pattern must be preserved but with corrected values

- file: /Users/tachongrak/Projects/ris-pdm/backend/src/services/azureDevOpsService.js
  why: Existing Azure DevOps integration patterns with rate limiting and caching
  pattern: PAT authentication, batch request handling, multi-level caching (Redis + memory)
  gotcha: 180 requests/minute rate limit, exponential backoff retry logic

- file: /Users/tachongrak/Projects/ris-pdm/backend/src/config/projectMapping.js
  why: Project-to-team mapping for correct Azure DevOps API calls
  pattern: PROJECT_MAPPING and TEAM_MAPPING constants for frontend→Azure DevOps resolution
  critical: 'Product - Partner Management Platform' → 'PMP Developer Team'

- file: /Users/tachongrak/Projects/ris-pdm/frontend/src/components/SprintFilter.jsx
  why: Frontend sprint selection component integration patterns
  pattern: API call structure, error handling, real-time data integration
  gotcha: hasFetchedRef prevents duplicate API calls, requires forceTs prop for cache coordination

- file: /Users/tachongrak/Projects/ris-pdm/backend/src/services/taskDistributionService.js
  why: Current bug count generation logic (line 811) that creates wrong counts
  pattern: Mock data generation patterns that must be preserved for fallback
  critical: bugs: Math.round(sprintTaskCount * 0.15) generates only 6 bugs, not 15-20
```

### Current Codebase Tree (Critical Files Only)

```bash
backend/
├── routes/metrics.js                         # MODIFY - Fix hardcoded sprint dates (lines 2112-2161)
├── src/
│   ├── services/
│   │   ├── azureDevOpsService.js            # EXTEND - Add sprint date and work item sync methods
│   │   ├── metricsCalculator.js             # MODIFY - Update work item calculation logic
│   │   ├── taskDistributionService.js       # MODIFY - Fix bug count generation (line 811)
│   │   ├── cacheService.js                  # EXTEND - Add TTL management for real-time data
│   │   └── realtimeService.js               # EXTEND - Add SSE broadcasting for data updates
│   ├── config/
│   │   ├── azureDevOpsConfig.js             # REFERENCE - Use existing rate limiting and auth
│   │   └── projectMapping.js                # REFERENCE - Use for team resolution
│   └── utils/
│       └── dataTransformers.js              # EXTEND - Add real-time data transformation
frontend/src/
├── components/SprintFilter.jsx              # MODIFY - Add real-time data subscription
├── hooks/useRealtimeMetrics.js              # EXTEND - Add sprint data real-time updates
└── pages/Dashboard.jsx                      # MODIFY - Add forceTs prop coordination
```

### Desired Codebase Tree with Files Added

```bash
backend/
├── routes/metrics.js                         # MODIFIED - Real-time sprint endpoint integration
├── src/
│   ├── services/
│   │   ├── azureDevOpsService.js            # EXTENDED - +getCurrentSprintWorkItems(), +getAccurateSprintDates()
│   │   ├── metricsCalculator.js             # MODIFIED - Real Azure DevOps counts vs mock calculations
│   │   ├── taskDistributionService.js       # MODIFIED - Accurate fallback bug counts (15 bugs not 6)
│   │   ├── cacheService.js                  # EXTENDED - +invalidateByPattern(), +setWithTTL()
│   │   └── dataValidationService.js         # NEW - Data sync accuracy monitoring and validation
│   └── jobs/
│       └── backgroundSyncJob.js             # NEW - 15-minute scheduled Azure DevOps data sync
frontend/src/
├── components/SprintFilter.jsx              # MODIFIED - Real-time sprint subscription integration
└── services/dashboardSSEClient.js          # NEW - Server-Sent Events client for real-time updates
```

### Known Gotchas of Codebase & Library Quirks

```javascript
// CRITICAL: Azure DevOps API rate limiting is 180 requests/minute (not 300)
// Existing azureDevOpsService.js has proper rate limiting - DO NOT change

// CRITICAL: Project mapping is case-sensitive and must match exactly
'Product - Partner Management Platform' // Frontend project ID
'PMP Developer Team'                    // Corresponding Azure DevOps team name

// GOTCHA: SprintFilter uses hasFetchedRef to prevent duplicate API calls
// Must implement forceTs prop to coordinate cache invalidation

// GOTCHA: Mock fallback data generation in taskDistributionService.js
// Currently generates only 6 bugs (15% of 42 tasks) - must fix to generate 15 bugs

// GOTCHA: Hardcoded sprint dates in metrics.js lines 2112-2161
// Use dynamic date generation based on Date.now() but with PRD-corrected dates

// CRITICAL: Redis cache TTL is in milliseconds, not seconds
const cacheTTL = {
  workItems: 5 * 60 * 1000,      // 5 minutes
  sprints: 30 * 60 * 1000,       // 30 minutes
};

// GOTCHA: Azure DevOps batch API accepts max 200 work item IDs, not unlimited
// Existing service handles this - follow existing batch patterns
```

## Implementation Blueprint

### Data Models and Structure

Extend existing data transformation patterns for real-time synchronization:

```javascript
// Use existing transformation in /backend/src/utils/dataTransformers.js
const sprintDataStructure = {
  id: 'string',                    // Sprint identifier
  name: 'string',                  // Display name
  startDate: 'YYYY-MM-DD',         // ISO date string
  endDate: 'YYYY-MM-DD',           // ISO date string
  status: 'active|completed|future', // Sprint status
  workItemSummary: {
    total: 'number',               // Total work items
    bugs: 'number',                // Bug work items
    stories: 'number',             // User Story work items
    tasks: 'number'                // Task work items
  },
  lastSyncTimestamp: 'ISO string', // Last Azure DevOps sync
  dataSource: 'azure|fallback'     // Data source indicator
};
```

### Implementation Tasks (Ordered by Dependencies)

```yaml
Task 1: MODIFY backend/src/services/taskDistributionService.js
  - FIX: Line 811 bug count generation from 6 bugs to 15 bugs for fallback data
  - REPLACE: bugs: Math.round(sprintTaskCount * 0.15) with bugs: 15
  - PRESERVE: Existing mock data generation patterns for other work item types
  - NAMING: Keep existing generateCurrentSprintMockDistribution function name
  - REASON: Fixes immediate bug count discrepancy (20 vs 15) with corrected fallback

Task 2: MODIFY backend/routes/metrics.js
  - FIX: Lines 2112-2161 hardcoded sprint dates to match PRD requirements
  - UPDATE: Delivery 2 dates to startDate: '2025-07-29', endDate: '2025-08-08'
  - UPDATE: Delivery 3 dates to startDate: '2025-08-11', endDate: '2025-08-22'
  - PRESERVE: Existing API route structure and error handling patterns
  - FOLLOW pattern: Existing generateMockSprints() function structure
  - DEPENDENCIES: Task 1 completed (corrected fallback data)

Task 3: EXTEND backend/src/services/azureDevOpsService.js
  - IMPLEMENT: async getCurrentSprintWorkItems(projectId, teamId) method
  - IMPLEMENT: async getAccurateSprintDates(projectId, teamId) method
  - FOLLOW pattern: Existing service methods with rate limiting and error handling
  - USE: Existing batch work items API pattern (max 200 items per request)
  - APPLY: Existing authentication and caching patterns from file
  - DEPENDENCIES: Task 2 completed (route structure updated)
  - PLACEMENT: Add methods to existing AzureDevOpsService class

Task 4: CREATE backend/src/services/dataValidationService.js
  - IMPLEMENT: DataValidationService class for monitoring sync accuracy
  - CREATE: validateSprintDates(), validateWorkItemCounts(), getLastSyncStatus() methods
  - FOLLOW pattern: backend/src/services/cacheService.js (service class structure)
  - INTEGRATION: Use existing cacheService for storing validation results
  - DEPENDENCIES: Task 3 completed (Azure service methods available)
  - PURPOSE: Provides admin monitoring of data sync accuracy per NFR-005

Task 5: CREATE backend/src/jobs/backgroundSyncJob.js
  - IMPLEMENT: Scheduled job for 15-minute Azure DevOps data synchronization
  - USE: node-cron for scheduling (8 AM - 6 PM weekdays only)
  - FOLLOW pattern: Real-time patterns from PRPs/ai_docs/real-time-dashboard-sync-patterns.md
  - INTEGRATE: Use services from Tasks 3 and 4 for data sync and validation
  - DEPENDENCIES: Tasks 3 and 4 completed (services available)
  - PLACEMENT: New jobs directory for background task organization

Task 6: CREATE frontend/src/services/dashboardSSEClient.js
  - IMPLEMENT: Server-Sent Events client for real-time dashboard updates
  - FOLLOW pattern: PRPs/ai_docs/real-time-dashboard-sync-patterns.md SSE implementation
  - CREATE: DashboardSSEClient class with automatic reconnection logic
  - INTEGRATION: Connect to backend SSE endpoint for live data streams
  - DEPENDENCIES: Task 5 completed (background sync providing data updates)

Task 7: MODIFY frontend/src/components/SprintFilter.jsx
  - ADD: forceTs prop for coordinated cache invalidation with parent Dashboard
  - INTEGRATE: Real-time sprint data updates from dashboardSSEClient (Task 6)
  - PRESERVE: Existing API call patterns and error handling
  - FOLLOW pattern: Existing useRealtimeMetrics hook integration approach
  - DEPENDENCIES: Task 6 completed (SSE client available)
  - GOTCHA: Must reset hasFetchedRef.current when forceTs changes

Task 8: EXTEND backend/src/services/realtimeService.js
  - ADD: SSE endpoint /api/sse/dashboard for broadcasting data updates
  - IMPLEMENT: Broadcast methods for sprint and work item updates
  - FOLLOW pattern: Existing WebSocket service structure in file
  - CONNECT: Integration with backgroundSyncJob (Task 5) for update notifications
  - DEPENDENCIES: Task 5 completed (background sync job providing update triggers)
```

### Implementation Patterns & Key Details

```javascript
// Sprint date correction pattern (Task 2)
function getFallbackSprintsWithCorrectDates(projectId) {
  return [
    {
      id: 'delivery-2',
      name: 'Delivery 2',
      startDate: '2025-07-29',  // ✅ Corrected per PRD (was July 28)
      endDate: '2025-08-08',    // ✅ Corrected per PRD (was Aug 9)
      status: 'completed'
    },
    {
      id: 'delivery-3',
      name: 'Delivery 3',
      startDate: '2025-08-11',  // ✅ Corrected per PRD (was Aug 12)
      endDate: '2025-08-22',    // ✅ Corrected per PRD (was Aug 23)
      status: 'completed'
    }
  ];
}

// Real-time Azure DevOps integration pattern (Task 3)
async getCurrentSprintWorkItems(projectId, teamId) {
  try {
    // PATTERN: Use existing authentication and rate limiting from azureDevOpsService.js
    const currentSprint = await this.getCurrentIteration(projectId, teamId);
    const workItemRefs = await this.getIterationWorkItems(currentSprint.id);

    // CRITICAL: Use batch API (200 items max) following existing patterns
    const workItems = await this.getWorkItemsBatch(workItemRefs.map(ref => ref.id));

    // RETURN: Classified work items with exact bug count
    return this.classifyWorkItems(workItems);
  } catch (error) {
    // GOTCHA: Must preserve existing fallback behavior
    throw new Error(`Azure DevOps sync failed: ${error.message}`);
  }
}

// Bug count fix pattern (Task 1)
function generateCurrentSprintMockDistribution(sprintTaskCount = 42) {
  return {
    total: sprintTaskCount,
    bugs: 15,                           // ✅ Fixed - was Math.round(sprintTaskCount * 0.15) = 6
    stories: Math.round(sprintTaskCount * 0.43), // 18 stories
    tasks: Math.round(sprintTaskCount * 0.42)    // Remaining as tasks
  };
}

// SSE integration pattern (Task 6)
class DashboardSSEClient {
  connect() {
    this.eventSource = new EventSource('/api/sse/dashboard');
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'sprint_data_updated') {
        this.handleSprintUpdate(data.payload);
      }
    };

    // CRITICAL: Implement exponential backoff reconnection
    this.eventSource.onerror = () => this.handleReconnection();
  }
}
```

### Integration Points

```yaml
BACKEND_ROUTES:
  - modify: backend/routes/metrics.js
  - endpoint: GET /api/metrics/sprints (enhanced with real-time data)
  - endpoint: GET /api/sse/dashboard (new SSE endpoint)

CACHING:
  - extend: backend/src/services/cacheService.js
  - pattern: "workItems: 5 * 60 * 1000, sprints: 30 * 60 * 1000" (existing TTL patterns)
  - add: Cache invalidation for coordinated dashboard updates

FRONTEND_INTEGRATION:
  - modify: frontend/src/components/SprintFilter.jsx
  - pattern: "forceTs prop for cache coordination with parent Dashboard.jsx"
  - add: Real-time subscription to SSE data stream

BACKGROUND_JOBS:
  - create: backend/src/jobs/backgroundSyncJob.js
  - schedule: "*/15 8-18 * * 1-5" (every 15 minutes, business hours, weekdays)
  - integration: Uses azureDevOpsService and broadcasts via realtimeService
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Backend linting and formatting
cd backend && npm run lint
cd backend && npm run lint:fix

# Frontend linting and formatting
cd frontend && npm run lint
cd frontend && npx eslint . --fix

# Security auditing for new dependencies
cd backend && npm audit --audit-level=moderate
cd frontend && npm audit --audit-level=moderate

# Expected: Zero errors. Fix any linting or security issues before proceeding.
```

### Level 2: Unit Tests (Component Validation)

```bash
# Backend unit tests with coverage
cd backend && npm test
cd backend && npm run test:coverage

# Frontend component tests
cd frontend && npm test
cd frontend && npm run test:coverage

# Specialized test suites for metrics
cd spec-task && npm run test:bug-classification
cd spec-task && npm run test:integration

# Expected: All tests pass with >80% coverage. Fix failing tests before proceeding.
```

### Level 3: Integration Testing (System Validation)

```bash
# API endpoint integration testing
cd backend && npm run test:integration

# Dashboard functionality testing
cd frontend && npm run cypress:run

# Real-time functionality validation
cd spec-task && npm run test -- --testNamePattern="metrics-debug"

# WebSocket/SSE connection testing
cd frontend && npm run test -- --testNamePattern="real-time"

# Expected: All integrations working, API endpoints responding correctly, real-time updates functional.
```

### Level 4: Data Accuracy Validation (Business Logic)

```bash
# Sprint date accuracy validation
curl -s "http://localhost:3001/api/metrics/sprints" | jq '.data[] | select(.name=="Delivery 2") | .startDate'
# Expected: "2025-07-29" (not "2025-07-28")

curl -s "http://localhost:3001/api/metrics/sprints" | jq '.data[] | select(.name=="Delivery 3") | .startDate'
# Expected: "2025-08-11" (not "2025-08-12")

# Work item count accuracy validation
curl -s "http://localhost:3001/api/metrics/kpis?productId=Product%20-%20Partner%20Management%20Platform" | \
  jq '.data.workItemDistribution.bugs'
# Expected: 15 (not 20 or 6)

# Real-time update validation
curl -s "http://localhost:3001/api/sse/dashboard" &
# Expected: SSE connection established, periodic data updates received

# Data validation dashboard
curl -s "http://localhost:3001/api/metrics/validation-status" | jq '.lastSyncTimestamp'
# Expected: Recent timestamp indicating successful Azure DevOps sync

# Performance validation
curl -w "@curl-format.txt" -s "http://localhost:3001/api/metrics/sprints" -o /dev/null
# Expected: Response time < 2 seconds per NFR-001
```

## Final Validation Checklist

### Technical Validation

- [ ] All 4 validation levels completed successfully
- [ ] Backend tests pass: `cd backend && npm test`
- [ ] Frontend tests pass: `cd frontend && npm test`
- [ ] Integration tests pass: `cd spec-task && npm run test:integration`
- [ ] No linting errors: `npm run lint` in both backend and frontend
- [ ] Security audit clean: `npm audit --audit-level=moderate`

### Feature Validation (PRD Requirements)

- [ ] Delivery 2 sprint dates: July 29 - Aug 8 (verified via API call)
- [ ] Delivery 3 sprint dates: Aug 11 - Aug 22 (verified via API call)
- [ ] Current sprint shows 15 bugs not 20 (verified via dashboard)
- [ ] Real-time updates working: Data refreshes every 15 minutes during business hours
- [ ] Graceful fallback: Dashboard shows corrected mock data during Azure DevOps API failures
- [ ] Performance target: API responses under 2 seconds (verified via curl timing)
- [ ] Data validation dashboard operational with sync status and timestamps

### Code Quality Validation

- [ ] Follows existing azureDevOpsService.js patterns for API integration
- [ ] Uses existing cacheService.js patterns for TTL and invalidation
- [ ] Preserves existing SprintFilter.jsx error handling and loading states
- [ ] Maintains existing metrics.js route structure and response format
- [ ] File placement matches desired codebase tree structure
- [ ] No hardcoded values - uses existing config/projectMapping.js patterns

### Business Impact Validation

- [ ] Sprint date confusion eliminated: Dates match Azure DevOps exactly
- [ ] Resource allocation accuracy: Bug counts reflect reality (15 not 20)
- [ ] Real-time visibility: Dashboard updates reflect current work item status
- [ ] Reduced manual verification: Automatic sync eliminates human cross-checking
- [ ] Stakeholder confidence: Dashboard reports align with Azure DevOps source of truth

---

## Anti-Patterns to Avoid

- ❌ Don't change existing Azure DevOps rate limiting (180 requests/minute is correct)
- ❌ Don't modify project mapping case sensitivity ('Product - Partner Management Platform' exact)
- ❌ Don't skip fallback mock data correction (must fix 6→15 bugs even in fallback)
- ❌ Don't use WebSocket for unidirectional dashboard updates (SSE is simpler and better)
- ❌ Don't hardcode sprint dates (use dynamic generation with PRD-corrected fallback values)
- ❌ Don't ignore hasFetchedRef in SprintFilter (must coordinate with forceTs prop)
- ❌ Don't batch more than 200 work items per Azure DevOps API call
- ❌ Don't sync outside business hours (8 AM - 6 PM weekdays only)
- ❌ Don't break existing cache TTL patterns (5min work items, 30min sprints)
- ❌ Don't remove existing error handling and graceful degradation patterns