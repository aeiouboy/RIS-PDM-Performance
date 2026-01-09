---
name: "Story PRP Template - Task Implementation Focus"
description: "Template for converting user stories into executable implementation tasks"
---

## Original Story

```
As the RIS PDM dashboard team
We need the backend velocity services to read the same story point field that Azure DevOps boards use
So that our sprint velocity charts stop returning 0 points when Azure shows 60+ points stored in Custom.StoryPoint.
```

**Source**: `docs/velocity-data-discrepancy-analysis-plan.md` - Root cause analysis revealing Custom.StoryPoint field discovery

## Story Metadata

**Story Type**: Bug
**Estimated Complexity**: Medium
**Primary Systems Affected**: Azure DevOps API integration layer, metrics calculation services, field mapping transformations, cache invalidation

---

## CONTEXT REFERENCES

- `backend/src/services/azureDevOpsService.js:807-836` - Complex story points extraction logic with fallback patterns
- `backend/src/services/metricsCalculator.js:265,792` - WIQL queries using Microsoft field in velocity calculations
- `backend/src/config/azureDevOpsConfig.js:61` - Default field arrays used across services
- `backend/tests/mocks/azureDevOpsMocks.js:18` - Mock data generators using old field names
- `backend/src/services/cacheService.js` - Multi-tier Redis/Memory cache requiring invalidation
- Express.js service injection pattern from `server.js` - AzureDevOpsService → MetricsCalculatorService → Routes
- Jest test framework with 80% coverage thresholds and nock for API mocking
- Field transformation pattern: `fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 0`

---

## IMPLEMENTATION TASKS

### Guidelines for Tasks

- Follow Express.js layered service architecture patterns discovered in codebase analysis
- Maintain existing fallback logic patterns while prioritizing Custom.StoryPoint field
- Use Jest testing patterns with nock for API mocking and AzureDevOpsMockFactory for test data
- Preserve cache invalidation patterns using Redis keys: `ris:cache:workItems:*` and `ris:cache:metrics:*`
- Each task includes dependency-aware validation commands based on service injection order

### UPDATE backend/src/services/azureDevOpsService.js:

- **PRIORITY FIELD SWITCH**: In transformWorkItem() method (lines 807-836), change primary field read from `fields['Microsoft.VSTS.Scheduling.StoryPoints']` to `fields['Custom.StoryPoint']`
- **FALLBACK PRESERVATION**: Keep existing fallback logic but reorder: Custom.StoryPoint → custom aliases → effort fields → default 0
- **WIQL FIELD UPDATES**: Replace all WIQL query field references (lines 330, 437, 2494) from `[Microsoft.VSTS.Scheduling.StoryPoints]` to `[Custom.StoryPoint]`
- **CRUD PATH UPDATES**: Update PATCH operation paths (lines 1375, 1528) from `/fields/Microsoft.VSTS.Scheduling.StoryPoints` to `/fields/Custom.StoryPoint`
- **PATTERN**: Follow existing field validation pattern `fields['System.AssignedTo']?.displayName || 'Unassigned'`
- **GOTCHA**: Preserve null/undefined checking pattern `|| 0` to avoid breaking existing consumers
- **VALIDATE**: `cd backend && npm test -- --testNamePattern="azureDevOpsService.*storyPoint" --coverage`

### UPDATE backend/src/config/azureDevOpsConfig.js:

- **DEFAULT FIELDS**: Replace `Microsoft.VSTS.Scheduling.StoryPoints` with `Custom.StoryPoint` in defaultFields array (line 61)
- **QUERY TEMPLATES**: Update all queryTemplates (lines 110, 131, 143) to use Custom.StoryPoint field
- **FIELD DOCUMENTATION**: Update inline comments to reflect Custom.StoryPoint as organization standard
- **PATTERN**: Follow existing field array structure with System.* fields first, then custom fields
- **IMPORTS**: No new imports required
- **GOTCHA**: Ensure field order maintains compatibility with existing query result processing
- **VALIDATE**: `cd backend && npm run lint && npm test -- --testNamePattern="config" --coverage`

### UPDATE backend/src/services/metricsCalculator.js:

- **WIQL STRING UPDATES**: Replace hardcoded `[Microsoft.VSTS.Scheduling.StoryPoints]` with `[Custom.StoryPoint]` in getWorkItemsForPeriod and getWorkItemsForUser methods (lines 265, 792)
- **AGGREGATION CONSISTENCY**: Ensure direct field reads use consistent `fields['Custom.StoryPoint'] ?? 0` pattern without Microsoft fallback
- **CACHE KEY REFRESH**: Clear any field-name-dependent cache keys to prevent stale data
- **PATTERN**: Follow existing WIQL query construction patterns with parameterized project filtering
- **IMPORTS**: No new imports required (already uses azureDevOpsService.transformWorkItem)
- **GOTCHA**: MetricsCalculator depends on AzureDevOpsService transformation - changes must be coordinated
- **VALIDATE**: `cd backend && npm test -- --testNamePattern="metricsCalculator.*velocity|storyPoint" --coverage`

### UPDATE backend/src/services/azureDevOpsApiService.js:

- **QUERY FIELD LISTS**: Update SELECT clauses in getWorkItemsBySprintName and getWorkItemsByIterationPath (lines 222, 274) to use Custom.StoryPoint
- **METRIC PROCESSING**: Update calculateSprintMetrics and processWorkItems (lines 345, 465) to read `item.fields['Custom.StoryPoint'] ?? 0`
- **FIELD ARRAYS**: Include Custom.StoryPoint in fields query parameters (line 683) and remove Microsoft field
- **PATTERN**: Follow existing field access pattern with null coalescing operator
- **IMPORTS**: No new imports required
- **GOTCHA**: Coordinate with AzureDevOpsService to avoid duplicate field mapping logic
- **VALIDATE**: `cd backend && npm test -- --testNamePattern="azureDevOpsApiService.*storyPoint" --coverage`

### INVALIDATE backend cache layers:

- **REDIS CACHE CLEAR**: Clear all story point related cache entries using pattern `ris:cache:workItems:*` and `ris:cache:metrics:*`
- **MEMORY CACHE FLUSH**: Force memory cache refresh to prevent stale fallback data
- **WARMUP EXECUTION**: Execute requestBatchingService.warmUpCache() to populate with Custom.StoryPoint data
- **PATTERN**: Follow existing cacheService.clearPattern() method for bulk invalidation
- **IMPORTS**: Requires cacheService access (already injected in services)
- **GOTCHA**: Execute cache clear AFTER service updates but BEFORE API testing
- **VALIDATE**: `cd backend && node -e "require('./src/services/cacheService').clearPattern('ris:cache:workItems:*').then(() => console.log('✓ Cache cleared'))"`

### UPDATE backend/tests/mocks/azureDevOpsMocks.js:

- **MOCK GENERATOR**: Update generateWorkItem function (line 18) to use `'Custom.StoryPoint': options.storyPoints || Math.floor(Math.random() * 13) + 1`
- **FACTORY PATTERN**: Ensure AzureDevOpsMockFactory generates only Custom.StoryPoint field, remove Microsoft field references
- **FIXTURE CONSISTENCY**: Update all mock work items to eliminate Microsoft field references
- **PATTERN**: Follow existing mock data structure with fields object containing System.* and Custom.* fields
- **IMPORTS**: No new imports required
- **GOTCHA**: Tests will fail if any service still expects Microsoft field - coordinate with service updates
- **VALIDATE**: `cd backend && npm test -- --testPathPattern="mocks" --testNamePattern="generateWorkItem"`

### UPDATE backend/tests/azureDevOpsService.test.js:

- **MOCK DATA**: Replace all `'Microsoft.VSTS.Scheduling.StoryPoints'` references with `'Custom.StoryPoint'` in test fixtures (lines 129, 219, 605)
- **ASSERTION UPDATES**: Update test expectations to verify Custom.StoryPoint field mapping
- **TRANSFORMATION TESTS**: Add specific tests for Custom.StoryPoint field prioritization over Microsoft field
- **PATTERN**: Follow existing Jest test structure with describe/it blocks and nock for API mocking
- **IMPORTS**: Uses existing nock and jest-extended imports
- **GOTCHA**: Update nock endpoint mocks to match new field structure
- **VALIDATE**: `cd backend && npm test -- --testPathPattern="azureDevOpsService" --coverage`

### UPDATE backend/tests/azureDevOpsCrud.test.js:

- **CRUD FIXTURES**: Update work item creation/update test data (lines 47, 162) to use Custom.StoryPoint field
- **PATCH ASSERTIONS**: Verify PATCH operations target `/fields/Custom.StoryPoint` path
- **FIELD MAPPING**: Ensure CRUD test expectations validate Custom.StoryPoint property mapping
- **PATTERN**: Follow existing CRUD test pattern with nock response validation and field assertion
- **IMPORTS**: Uses existing test framework imports
- **GOTCHA**: CRUD operations must use exact field paths - verify PATCH body structure
- **VALIDATE**: `cd backend && npm test -- --testPathPattern="azureDevOpsCrud" --testNamePattern="storyPoint"`

### UPDATE backend/scripts/azureDevOpsCrudDemo.js:

- **DEMO PATHS**: Update PATCH operation examples (lines 73, 213) to use `/fields/Custom.StoryPoint` paths
- **CONSOLE OUTPUT**: Update demo guidance to reference Custom.StoryPoint field for manual testing
- **SAMPLE DATA**: Ensure demo creates work items with Custom.StoryPoint field structure
- **PATTERN**: Follow existing demo script pattern with explicit PATCH operations and console logging
- **IMPORTS**: Uses existing axios and dotenv imports
- **GOTCHA**: Demo script used for manual validation - ensure field paths match service implementation
- **VALIDATE**: `cd backend && node scripts/azureDevOpsCrudDemo.js | grep -i "custom.storypoint"`

---

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Lint and format after each file update
cd backend && npm run lint
cd backend && npm run lint:fix

# Expected: Zero linting errors, consistent code formatting
```

### Level 2: Unit Tests (Component Validation)

```bash
# Test core service transformations
cd backend && npm test -- --testNamePattern="azureDevOpsService.*storyPoint" --coverage
cd backend && npm test -- --testNamePattern="metricsCalculator.*storyPoint" --coverage
cd backend && npm test -- --testNamePattern="azureDevOpsApiService.*storyPoint" --coverage

# Test mock data generators
cd backend && npm test -- --testPathPattern="mocks" --coverage

# Test CRUD operations
cd backend && npm test -- --testPathPattern="azureDevOpsCrud" --coverage

# Full test suite with coverage validation
cd backend && npm test -- --coverage --coverageThreshold='{"global":{"branches":80,"functions":80,"lines":80,"statements":80}}'

# Expected: All tests pass, 80%+ coverage maintained, no regressions
```

### Level 3: Integration Testing (System Validation)

```bash
# Start development server
cd backend && npm run dev &
DEV_PID=$!
sleep 5  # Allow startup time

# Test story points data endpoints
curl -f "http://localhost:3002/api/metrics/overview" | jq '.data.total_story_points' || echo "❌ Story points not found"
curl -f "http://localhost:3002/api/metrics/velocity-trend?productId=daas&period=sprint" | jq '.data[0].storyPoints' || echo "❌ Velocity endpoint failed"
curl -f "http://localhost:3002/api/workitems?limit=5" | jq '.data[0].storyPoints' || echo "❌ Work items endpoint failed"

# Validate cache invalidation
redis-cli KEYS "ris:cache:workItems:*" | wc -l | grep -q "0" && echo "✓ Cache cleared" || echo "❌ Cache not cleared"

# Test real-time WebSocket updates (optional)
# wscat -c "ws://localhost:3002" -x '{"type":"subscribe","channel":"metrics"}'

# Cleanup
kill $DEV_PID

# Expected: All endpoints return non-zero story points, cache properly cleared
```

### Level 4: Creative & Domain-Specific Validation

```bash
# Azure DevOps MCP validation (if available)
# Test actual Azure DevOps API integration with Custom.StoryPoint field
echo '{"method": "tools/call", "params": {"name": "get_work_item", "arguments": {"id": 51793}}}' | \
  grep -q "Custom.StoryPoint" && echo "✓ Azure MCP validates Custom.StoryPoint" || echo "❌ Custom field not found"

# Database/Cache validation using Redis CLI
redis-cli --scan --pattern "ris:cache:workItems:*" | head -5 | while read key; do
  redis-cli GET $key | jq '.storyPoints' 2>/dev/null && echo "✓ Cache contains story points"
done

# Performance baseline testing
cd backend && npm test -- --testPathPattern="performance" --testNamePattern="storyPoint.*metrics"

# Export functionality validation
curl -X POST "http://localhost:3002/api/exports/dashboard/pdf" \
  -H "Content-Type: application/json" \
  -d '{"productId":"daas","metrics":["velocity","storyPoints"]}' \
  -o test-export.pdf && echo "✓ Export includes story points" || echo "❌ Export failed"

# Expected: Azure MCP confirms Custom.StoryPoint field access, cache contains story points data, exports work
```

---

## COMPLETION CHECKLIST

- [ ] All WIQL queries reference Custom.StoryPoint field exclusively
- [ ] AzureDevOpsService.transformWorkItem() prioritizes Custom.StoryPoint with fallback logic maintained
- [ ] All PATCH operations target /fields/Custom.StoryPoint path
- [ ] Mock data generators produce Custom.StoryPoint field only
- [ ] Unit tests updated with 80%+ coverage maintained
- [ ] Cache layers invalidated and repopulated with Custom.StoryPoint data
- [ ] Integration tests pass with non-zero story points returned
- [ ] Demo scripts reference Custom.StoryPoint field structure
- [ ] All validation commands execute successfully

---

## Notes

### Implementation Dependencies
- **Service Update Order**: AzureDevOpsService → Config → MetricsCalculator → Cache Invalidation → Tests
- **Cache Strategy**: Clear Redis cache after service updates but before integration testing
- **Backward Compatibility**: Existing fallback logic ensures graceful degradation if Custom.StoryPoint missing

### Rollback Strategy
If implementation fails:
1. Revert AzureDevOpsService.transformWorkItem() to prioritize Microsoft field
2. Restore original WIQL query field references
3. Clear cache and restart services
4. Validate Microsoft field still accessible in Azure DevOps

### Performance Considerations
- Cache invalidation may cause temporary performance impact
- WebSocket clients will receive updated story points data automatically
- Export functionality should continue working with transformed data

### Azure DevOps Process Template Dependency
- Confirm Custom.StoryPoint field exists in project process template
- Test with actual Azure DevOps environment before production deployment
- Monitor for missing Custom.StoryPoint fields in logs after deployment

<!-- EOF -->