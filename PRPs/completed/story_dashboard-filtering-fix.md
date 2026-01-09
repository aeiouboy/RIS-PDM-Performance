---
name: "Story PRP Template - Dashboard Azure API Filtering Fix"
description: "Fix inconsistent dashboard data when filtering by different sprints or projects"
---

## Original Story

Paste in the original story shared by the user below:

```
Dashboard Azure API Filtering Fix Plan

The dashboard shows incorrect data when filtering by different sprints or projects due to several architectural issues:

1. Inconsistent Project/Sprint Mapping - Frontend project IDs don't match Azure DevOps project names
2. Cache Contamination - Cached data from previous filters bleeds into new requests
3. API Service Layer Issues - Complex fallback logic that can return wrong data
4. Frontend Filter State Management - Complex sprint-to-iteration-path resolution conflicts with backend
```

## Story Metadata

**Story Type**: Bug Fix
**Estimated Complexity**: High
**Primary Systems Affected**: Azure DevOps API integration, Cache management, Frontend state management, Project/Sprint mapping

---

## CONTEXT REFERENCES

[Auto-discovered documentation and patterns]

- `backend/src/services/azureDevOpsApiService.js` - Main Azure DevOps API integration with project mapping
- `backend/src/services/azureIterationResolver.js` - Sprint/iteration path resolution with caching
- `backend/src/services/metricsCalculator.js` - Contains getWorkItemsForProduct method that needs fixing
- `backend/src/services/cacheService.js` - Redis+NodeCache hybrid system for cache management
- `backend/src/config/projectMapping.js` - mapFrontendProjectToAzure function for project ID resolution
- `frontend/src/pages/Dashboard.jsx` - Complex state management with multiple useEffect hooks
- `frontend/src/components/SprintBurndownChart.jsx` - Chart component requiring data validation
- `frontend/src/components/SprintFilter.jsx` - Sprint selection with duplicate resolution logic
- `backend/tests/services/metricsCalculator.test.js` - Existing test patterns for service validation
- `backend/package.json` - Jest testing framework with scripts: test, test:watch, test:coverage
- `frontend/package.json` - Vitest + Testing Library for frontend testing

---

## IMPLEMENTATION TASKS

[Task blocks in dependency order - each block is atomic and testable]

### Guidelines for Tasks

- We are using Information dense keywords to be specific and concise about implementation steps and details.
- The tasks have to be detailed and specific to ensure clarity and accuracy.
- The developer who will execute the tasks should be able to complete the task using only the context of this file, with references to relevant codebase paths and integration points.

### ENHANCE backend/src/services/cacheService.js:

- **IMPLEMENT**: Enhanced cache key strategy with project+sprint+timestamp combinations
- **PATTERN**: Follow existing `generateKey` method structure but enhance for filtering contexts
- **UPDATE**: `generateKey` method to accept `{ project, sprint, endpoint, timestamp }` parameters
- **ADD**: `clearFilterCache(project, sprint)` method for targeted cache invalidation
- **GOTCHA**: Ensure Redis and NodeCache both get cleared consistently
- **VALIDATE**: `npm test -- --testNamePattern="CacheService" && echo "✓ Cache service tests passed"`

### UPDATE backend/src/services/azureIterationResolver.js:

- **FIX**: `resolveIteration` method cache key format from `${project}:${teamName}:${requestedIteration}` to include mapped Azure project
- **PATTERN**: Use mapFrontendProjectToAzure before creating cache keys
- **IMPORTS**: Ensure `mapFrontendProjectToAzure` is imported from `../config/projectMapping.js`
- **ENHANCE**: Cache invalidation to use new project+sprint combination keys
- **GOTCHA**: Don't break existing cache behavior for non-filtering requests
- **VALIDATE**: `npm test -- --testNamePattern="azureIterationResolver" && echo "✓ Iteration resolver tests passed"`

### REFACTOR backend/src/services/metricsCalculator.js:

- **FIX**: `getWorkItemsForProduct` method to use enhanced cache keys for filtering contexts
- **UPDATE**: Cache key generation to include both frontend project and resolved Azure project
- **ADD**: Cache invalidation call before fetching new filter data
- **PATTERN**: Follow existing async/await pattern but add cache clearing step
- **IMPORTS**: Import enhanced `cacheService.clearFilterCache` method
- **GOTCHA**: Ensure iteration path resolution happens before cache operations
- **VALIDATE**: `npm test -- --testNamePattern="getWorkItemsForProduct" && echo "✓ Metrics calculator tests passed"`

### UPDATE backend/src/config/projectMapping.js:

- **ENHANCE**: `mapFrontendProjectToAzure` function with better logging and validation
- **ADD**: Validation for unmapped projects with fallback strategy
- **IMPLEMENT**: `validateProjectMapping(frontendProject, azureProject)` helper function
- **PATTERN**: Maintain existing fallback behavior but add debugging info
- **GOTCHA**: Don't change existing mapping behavior, only enhance logging
- **VALIDATE**: `grep -q "validateProjectMapping" backend/src/config/projectMapping.js && echo "✓ Project mapping enhanced"`

### UPDATE backend/routes/metrics.js:

- **ENHANCE**: Cache key strategy for all filtering endpoints (`/burndown`, `/kpis`, `/products/:productId`)
- **ADD**: Cache clearing headers for force refresh functionality
- **PATTERN**: Follow existing router callback pattern in metrics.js
- **FIND**: Lines with `metricsCalculator.getWorkItemsForProduct` calls
- **INSERT**: Cache invalidation before data fetching when `forceRefresh` param is present
- **GOTCHA**: Maintain backward compatibility with existing API contracts
- **VALIDATE**: `npm test -- --testNamePattern="metrics.*routes" && echo "✓ Routes tests passed"`

### SIMPLIFY frontend/src/pages/Dashboard.jsx:

- **REMOVE**: `getSprintIterationPath` function - delegate to backend completely
- **PATTERN**: Follow existing useEffect patterns but simplify filter logic
- **UPDATE**: All API calls to remove frontend iteration path resolution
- **REFACTOR**: Multiple useEffect hooks to single filter dependency effect
- **FIND**: Lines 62 and 687 with `getSprintIterationPath` usage
- **REPLACE**: Direct sprint ID passing to backend APIs
- **GOTCHA**: Ensure loading states remain consistent during transition
- **VALIDATE**: `npm run test -- Dashboard && echo "✓ Dashboard component tests passed"`

### ADD frontend/src/components/SprintBurndownChart.jsx:

- **IMPLEMENT**: Data validation before chart rendering
- **ADD**: Error boundary for invalid data scenarios
- **PATTERN**: Follow existing React error handling patterns in other components
- **ENHANCE**: Loading state handling for cache refresh scenarios
- **IMPORTS**: Import error handling utilities if available
- **GOTCHA**: Maintain existing chart functionality while adding validation
- **VALIDATE**: `npm run test -- SprintBurndownChart && echo "✓ Burndown chart tests passed"`

### ENHANCE frontend/src/components/SprintFilter.jsx:

- **REMOVE**: Duplicate sprint resolution logic
- **SIMPLIFY**: Component to pure selection UI without backend logic
- **PATTERN**: Follow existing dropdown component patterns
- **UPDATE**: Event handlers to pass raw sprint IDs to parent
- **GOTCHA**: Ensure sprint list fetching remains functional
- **VALIDATE**: `npm run test -- SprintFilter && echo "✓ Sprint filter tests passed"`

### CREATE backend/tests/integration/dashboard-filtering.test.js:

- **IMPLEMENT**: Integration tests for project/sprint filtering scenarios
- **PATTERN**: Follow existing integration test structure in `backend/tests/integration/api.test.js`
- **IMPORTS**: `const request = require('supertest'); const app = require('../../server');`
- **TEST CASES**: Different project/sprint combinations, cache invalidation, data consistency
- **GOTCHA**: Use test database/mock data to avoid affecting real Azure DevOps
- **VALIDATE**: `npm test -- --testNamePattern="dashboard-filtering" && echo "✓ Integration tests passed"`

### ADD backend/tests/services/cacheService-filtering.test.js:

- **CREATE**: Tests for enhanced cache key strategy
- **IMPLEMENT**: Test cases for `clearFilterCache`, enhanced `generateKey`
- **PATTERN**: Follow existing service test patterns in `backend/tests/services/cacheService.test.js`
- **IMPORTS**: Existing CacheService test imports and mocks
- **GOTCHA**: Mock Redis properly to avoid external dependencies
- **VALIDATE**: `npm test -- --testNamePattern="cacheService-filtering" && echo "✓ Cache filtering tests passed"`

---

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each file creation - fix before proceeding
cd backend && npm run lint -- --fix     # Auto-format and fix linting issues
cd backend && npm test -- --testNamePattern=".*" --passWithNoTests    # Run existing tests

cd frontend && npm run lint -- --fix    # Frontend linting
cd frontend && npm run test:run         # Frontend test suite

# Expected: Zero errors. If errors exist, READ output and fix before proceeding.
```

### Level 2: Unit Tests (Component Validation)

```bash
# Test each component as it's created
cd backend && npm test -- --testNamePattern="CacheService"
cd backend && npm test -- --testNamePattern="azureIterationResolver"
cd backend && npm test -- --testNamePattern="metricsCalculator"

# Frontend component tests
cd frontend && npm run test -- Dashboard
cd frontend && npm run test -- SprintBurndownChart
cd frontend && npm run test -- SprintFilter

# Expected: All tests pass. If failing, debug root cause and fix implementation.
```

### Level 3: Integration Testing (System Validation)

```bash
# Service startup validation
cd backend && npm start &
sleep 5  # Allow startup time

# Health check validation
curl -f http://localhost:3001/api/metrics/health || echo "Service health check failed"

# Feature-specific endpoint testing with different projects/sprints
curl -X GET "http://localhost:3001/api/metrics/burndown?project=Product%20-%20Partner%20Management%20Platform&sprint=current" \
  -H "Content-Type: application/json" | jq .

curl -X GET "http://localhost:3001/api/metrics/burndown?project=Product%20-%20Partner%20Management%20Platform&sprint=Sprint%2013" \
  -H "Content-Type: application/json" | jq .

# Test cache invalidation
curl -X GET "http://localhost:3001/api/metrics/burndown?project=Product%20-%20Partner%20Management%20Platform&sprint=current&forceRefresh=true" \
  -H "Content-Type: application/json" | jq .

# Frontend integration
cd frontend && npm run dev &
sleep 3
curl -f http://localhost:5173 || echo "Frontend health check failed"

# Expected: All integrations working, proper responses, no cache contamination
```

### Level 4: Creative & Domain-Specific Validation

You can use CLI that are installed on the system or MCP servers to extend the validation and self closing loop.

```bash
# Azure DevOps API validation (if credentials available)
# Test actual Azure DevOps integration with different projects
node backend/scripts/test-azure-integration.js

# Performance testing for cache improvements
cd backend && npm run test:performance

# End-to-end testing with Cypress (if available)
cd frontend && npm run cypress:run

# Dashboard filtering scenarios
cd frontend && npm run e2e -- --spec "cypress/e2e/dashboard-filtering.cy.js"
```

---

## COMPLETION CHECKLIST

- [ ] Enhanced cache key strategy implemented
- [ ] Project mapping validation added
- [ ] Iteration resolver cache keys fixed
- [ ] MetricsCalculator getWorkItemsForProduct method enhanced
- [ ] Routes updated with cache invalidation
- [ ] Frontend Sprint resolution logic removed
- [ ] Data validation added to chart components
- [ ] SprintFilter simplified
- [ ] Integration tests created
- [ ] All unit tests passing
- [ ] No linting errors
- [ ] Cache contamination eliminated
- [ ] Project filtering works consistently
- [ ] Sprint filtering works consistently
- [ ] Story acceptance criteria met

---

## Notes

**Key Implementation Strategy**:
1. **Backend-First Approach**: Fix caching and iteration resolution in backend services first
2. **Simplify Frontend**: Remove duplicate logic and delegate to backend completely
3. **Enhanced Testing**: Add comprehensive tests for filtering scenarios
4. **Backward Compatibility**: Maintain existing API contracts while fixing underlying issues

**Critical Success Factors**:
- Cache keys must include project+sprint combinations
- Frontend must trust backend iteration resolution completely
- All filtering operations must clear relevant caches first
- Project mapping must be consistent across all services

**Rollback Plan**:
- All changes are additive or enhance existing functionality
- Original cache behavior preserved for non-filtering contexts
- Frontend changes are isolated to specific components
- Tests validate both new and existing functionality

<!-- EOF -->