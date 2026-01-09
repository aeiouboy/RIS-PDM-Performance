---
name: "Story PRP - Velocity Story Points Field Fix"
description: "Implementation plan to realign velocity calculations with the Custom.StoryPoint Azure DevOps field and restore sprint metrics"
---

## Original Story

Source: `docs/velocity-data-discrepancy-analysis-plan.md`

```
As the RIS PDM dashboard team
We need the backend velocity services to read the same story point field that Azure DevOps boards use
So that our sprint velocity charts stop returning 0 points when Azure shows 60+ points stored in Custom.StoryPoint.
```

## Story Metadata

**Story Type**: Bug
**Estimated Complexity**: Medium
**Primary Systems Affected**: `backend/src/services/azureDevOpsService.js`, `backend/src/services/metricsCalculator.js`, `backend/src/services/azureDevOpsApiService.js`, backend WIQL query templates, associated tests and mocks

---

## CONTEXT REFERENCES

- `docs/velocity-data-discrepancy-analysis-plan.md` - Root-cause write-up showing API payload with Custom.StoryPoint
- `backend/src/services/azureDevOpsService.js` - Primary adapter for WIQL queries, work item hydration, and CRUD operations
- `backend/src/services/metricsCalculator.js` - Velocity aggregation uses raw WIQL strings that reference the story points field
- `backend/src/services/azureDevOpsApiService.js` - REST and analytics pipeline that must surface story points for trend charts
- `backend/src/config/azureDevOpsConfig.js` - Default field lists and canned WIQL templates reused by services and routes
- `backend/routes/products.js` - Velocity endpoint building project-level WIQL with explicit field list
- `backend/routes/users.js` - User metrics endpoint reusing the incorrect field selector
- `backend/tests/azureDevOpsService.test.js` - Verifies mapping to storyPoints property; currently asserts Microsoft field
- `backend/tests/azureDevOpsCrud.test.js` - Ensures work item CRUD includes the story points path
- `backend/tests/mocks/azureDevOpsMocks.js` - Generates fixture data for story points
- `backend/scripts/azureDevOpsCrudDemo.js` - Manual demo script patching the story points field
- `PRPs/ai_docs/azure-devops-work-items-api.md` - Reference doc that should mirror the field change for future work

---

## IMPLEMENTATION TASKS

### Guidelines for Tasks

- Use precise action verbs and keep instructions self-contained
- Prefer updating existing helpers over duplicating logic
- Ensure every surface reads and writes the Custom.StoryPoint field consistently
- Each task includes a validation command scoped to the touched area

### UPDATE backend/src/services/azureDevOpsService.js:

- **REVISE WIQL SELECTS**: replace every `[Microsoft.VSTS.Scheduling.StoryPoints]` occurrence with `[Custom.StoryPoint]`, and remove the Microsoft field from select lists entirely
- **REQUEST FIELDS**: ensure `Custom.StoryPoint` appears in any field arrays (for example, `defaultFields`, `fieldReferences`) and delete the Microsoft variant so no consumers rely on it
- **MAP STORY POINTS**: update the storyPoints computed property to read `fields['Custom.StoryPoint']` and default to `0` when the field is missing; remove alias searches that reintroduce the Microsoft field
- **CRUD PATCHES**: switch the PATCH paths in create and update flows to `/fields/Custom.StoryPoint` and drop any code that still targets `/fields/Microsoft.VSTS.Scheduling.StoryPoints`
- **VALIDATE**: `cd backend && npm test -- --testNamePattern="azureDevOpsService"`

### UPDATE backend/src/services/metricsCalculator.js:

- **SELECT FIELD**: adjust custom WIQL strings in `getWorkItemsForPeriod` and `getWorkItemsForUser` to pull `[Custom.StoryPoint]` and remove the Microsoft field from the projection
- **AGGREGATION**: ensure any direct story point reads from raw WIQL responses use `fields['Custom.StoryPoint'] ?? 0` without falling back to the Microsoft field
- **CACHE KEYS**: if cache keys contain field names, refresh them to avoid stale data keyed by the old query
- **VALIDATE**: `cd backend && npm test -- --testNamePattern="metricsCalculator"`

### UPDATE backend/src/services/azureDevOpsApiService.js:

- **WIQL QUERIES**: swap the SELECT lists in `getWorkItemsBySprintName` and `getWorkItemsByIterationPath` to reference only `Custom.StoryPoint`
- **METRIC PIPELINE**: update `calculateSprintMetrics`, `processWorkItems`, and any helper that totals story points to look for `item.fields['Custom.StoryPoint'] ?? 0`
- **DETAIL FIELDS**: include `Custom.StoryPoint` in the `fields` query string inside `getWorkItemDetails` and remove the Microsoft field
- **VALIDATE**: `cd backend && npm test -- --testNamePattern="azureDevOpsApiService"`

### UPDATE backend/src/config/azureDevOpsConfig.js:

- **DEFAULT FIELDS**: replace `Microsoft.VSTS.Scheduling.StoryPoints` with `Custom.StoryPoint` in `defaultFields`
- **QUERY TEMPLATES**: update every template under `queryTemplates` so they select only the custom field for story points
- **DOC STRINGS**: refresh inline comments to note that the organization standardizes on `Custom.StoryPoint`
- **VALIDATE**: `cd backend && npm run lint`

### UPDATE backend/routes/products.js:

- **CUSTOM QUERY**: change the ad-hoc WIQL inside the velocity endpoint to select `[Custom.StoryPoint]` and remove the Microsoft field
- **METRIC CALCULATION**: ensure any direct use of `wi.storyPoints` expects only the custom field values
- **VALIDATE**: `cd backend && curl -s "http://localhost:3002/api/products/daas/velocity" | jq '.storyPoints'`

### UPDATE backend/routes/users.js:

- **CUSTOM QUERY**: update the user metrics WIQL to pull `[Custom.StoryPoint]` only
- **VALIDATE**: `cd backend && curl -s "http://localhost:3002/api/users/test@example.com/metrics" | jq '.storyPoints'`

### UPDATE backend/scripts/azureDevOpsCrudDemo.js:

- **PATCH PATHS**: change both occurrences of `/fields/Microsoft.VSTS.Scheduling.StoryPoints` to `/fields/Custom.StoryPoint` and delete any references to the Microsoft field
- **SAMPLE OUTPUT**: update any console guidance so manual testers know to look for the custom field
- **VALIDATE**: `cd backend && node scripts/azureDevOpsCrudDemo.js`

### UPDATE backend/tests/azureDevOpsService.test.js:

- **MOCK DATA**: replace mocked `Microsoft.VSTS.Scheduling.StoryPoints` fields with `Custom.StoryPoint` only
- **ASSERTIONS**: update expectations so the service populates `storyPoints` exclusively from the custom field and fails fast when it is missing
- **VALIDATE**: `cd backend && npm test -- --testNamePattern="azureDevOpsService"`

### UPDATE backend/tests/azureDevOpsCrud.test.js and backend/tests/mocks/azureDevOpsMocks.js:

- **MOCK GENERATORS**: update fixtures to emit only `Custom.StoryPoint` values so tests fail if the old field is referenced
- **CRUD EXPECTATIONS**: ensure tests assert that PATCH bodies target `/fields/Custom.StoryPoint`
- **VALIDATE**: `cd backend && npm test -- --testNamePattern="azureDevOpsCrud|azureDevOpsMocks"`

### UPDATE documentation references:

- **AI DOCS**: update `PRPs/ai_docs/azure-devops-work-items-api.md` to note that story points live under `Custom.StoryPoint` with no fallback field
- **PRODUCT DOCS**: refresh `docs/velocity-data-discrepancy-analysis-plan.md` and `docs/prd/4-feature-requirements.md` so every sample query and diagram references only the custom field
- **VALIDATE**: `rg "Microsoft.VSTS.Scheduling.StoryPoints" docs PRPs/ai_docs || echo "✓ No legacy field references"`

---

## Validation Loop

```bash
# Fast feedback
cd backend
npm run lint
npm test -- --testNamePattern="metricsCalculator|azureDevOpsService|azureDevOpsApiService"
npm run test:coverage

# Endpoint verification (requires dev server running)
npm run dev &
AZURE_PID=$!
sleep 3
curl -s "http://localhost:3002/api/metrics/velocity-trend?productId=daas&period=sprint" | jq '.data[0].storyPoints'
curl -s "http://localhost:3002/api/users/test@example.com/metrics" | jq '.storyPoints'
kill $AZURE_PID

# Documentation sweep
rg "Microsoft.VSTS.Scheduling.StoryPoints" backend docs PRPs || echo "✓ No legacy field references"
```

Expected: lint and tests pass, velocity endpoints return non-zero story points, and no references to the Microsoft field remain in the codebase or docs.

---

## Completion Checklist

- [ ] All WIQL queries reference only `Custom.StoryPoint`
- [ ] Story point mapping functions surface values from the custom field
- [ ] Work item create and update flows patch the custom field path
- [ ] Tests and mocks updated to the new field name
- [ ] Documentation and PRP references align with the custom field usage
- [ ] Velocity endpoints return the expected 60 or more story points for Delivery 13
- [ ] Full backend lint, tests, and coverage commands succeed

---

## Notes

- Azure DevOps rejects unknown fields in PATCH calls; confirm project process templates expose `Custom.StoryPoint` before rollout.
- Monitor logs after deployment for missing `Custom.StoryPoint` data so teams can backfill any old work items.
- Plan a follow-up cleanup story to remove the Microsoft field entirely once historical data is migrated or confirmed unused.
