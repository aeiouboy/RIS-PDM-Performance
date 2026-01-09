# Velocity Data Discrepancy Analysis & Fix Plan

## Executive Summary

**Problem:** Our RIS PDM Dashboard velocity calculations show significant discrepancies from Azure DevOps web board data.

**Root Cause:** Azure DevOps REST API is not returning story points that are clearly visible in the web interface.

**Impact:** Velocity charts show 0 story points despite Azure board showing 60+ story points across 93 work items in Delivery 13.

## Detailed Analysis

### Current State Investigation (Delivery 13 - DaaS)

#### Azure Web Board Reality:
- **Total Work Items:** 20+ visible with story points ranging 1-5 points each
- **Estimated Total Story Points:** 60+ points
- **Work Item Types:** Mix of User Stories, Tasks, Bugs, Features
- **Status:** All items show "Closed" with clear story point values

#### API Investigation Results:
- **Search Results:** 93 total work items found in Delivery 13
- **Story Points Retrieved:** 0 (zero) across all API calls
- **Work Item Types Found:**
  - Tasks: 40+ items (should count per our requirement)
  - User Stories: 20+ items (excluded per our requirement)
  - Bugs: 5+ items (should count per our requirement)
  - Features/Epics: Few items (excluded per our requirement)

#### API Response Analysis:
```json
// Example API response - CUSTOM story points field found!
{
  "System.Id": 51793,
  "System.WorkItemType": "Task",
  "System.Title": "RMS12 Price ETL",
  "System.State": "Closed",
  "Custom.StoryPoint": 3,  // ✅ FOUND: Custom field with story points!
  "Custom.TaskTypes": "Development"
}
```

**🔍 KEY DISCOVERY: Story points are stored in `Custom.StoryPoint` field, not the standard Microsoft field!**

### Problem Identification

#### Issue 1: Wrong Story Points Field Used ✅ SOLVED
- **Root Cause:** Using standard `Microsoft.VSTS.Scheduling.StoryPoints` field
- **Solution:** Use custom field `Custom.StoryPoint` instead
- **Impact:** Our queries never requested the correct field name

#### Issue 2: Web Board vs API Data Mismatch
- **Symptom:** Web interface shows story points that API cannot access
- **Possible Causes:**
  1. Web UI using different API endpoints
  2. Calculated fields vs stored fields
  3. Team-specific configurations
  4. Sprint assignment vs iteration path differences

#### Issue 3: Query Scope Issues
- **Symptom:** Our queries may not be capturing all relevant work items
- **Current Approach:** Date-based filtering + work item type filtering
- **Better Approach:** Iteration path + team-based filtering

## Fix Plan

### Phase 1: Diagnostic & Discovery (Day 1)

#### 1.1 Story Points Field Investigation
- **Test different field names:**
  - `Microsoft.VSTS.Scheduling.StoryPoints`
  - `Microsoft.VSTS.Scheduling.Effort`
  - `System.StoryPoints`
  - Custom field variations

- **Verify field permissions:**
  - Test with different authentication levels
  - Check Azure DevOps process template configuration
  - Validate field access in project settings

#### 1.2 Query Method Comparison
- **Test iteration-based queries:**
  ```sql
  SELECT [System.Id], [System.Title], [System.WorkItemType],
         [Microsoft.VSTS.Scheduling.StoryPoints], [System.State]
  FROM WorkItems
  WHERE [System.IterationPath] = 'Product - Data as a Service\Delivery 13'
  ```

- **Test team-based queries:**
  - Use team iteration assignments
  - Compare results with web board data

#### 1.3 Web UI Reverse Engineering
- **Analyze Azure DevOps web requests:**
  - Check browser network tab for API calls
  - Identify exact endpoints used by web interface
  - Document request parameters and headers

### Phase 2: Implementation Fixes (Day 2-3)

#### 2.1 Update WIQL Queries
**Target Files:**
- `backend/src/services/metricsCalculator.js`
- `backend/src/services/azureDevOpsService.js`

**Changes:**
```sql
-- OLD (date-based)
WHERE [System.TeamProject] = @project
AND [System.WorkItemType] IN ('Task', 'Bug')
AND [System.ChangedDate] >= '${startDate}'

-- NEW (iteration-based)
WHERE [System.TeamProject] = @project
AND [System.WorkItemType] IN ('Task', 'Bug')
AND [System.IterationPath] = '${iterationPath}'
AND [Custom.StoryPoint] IS NOT NULL
```

#### 2.2 Enhanced Field Selection
```javascript
// Use CORRECT custom story points field
const fields = [
  'System.Id',
  'System.Title',
  'System.WorkItemType',
  'System.State',
  'System.AssignedTo',
  'Custom.StoryPoint', // ✅ CORRECT: Custom field for story points
  'Custom.TaskTypes',  // Additional custom field available
  'System.IterationPath',
  'System.AreaPath',
  'System.CreatedDate',
  'System.ChangedDate'
];
```

#### 2.3 Iteration Path Resolution
**Update project mapping to use exact iteration paths:**
```javascript
// backend/src/config/projectMapping.js
const iterationMapping = {
  'daas': {
    project: 'Product - Data as a Service',
    team: 'DaaS Dev Team',
    currentIteration: 'Product - Data as a Service\\Delivery 13'
  }
};
```

### Phase 3: Data Validation (Day 4)

#### 3.1 Cross-Reference Testing
- **Compare API results with web board data**
- **Validate story point totals match**
- **Ensure work item counts align**

#### 3.2 Velocity Calculation Testing
```javascript
// Test with real Delivery 13 data
const expectedResults = {
  totalStoryPoints: 60+, // Based on web board observation
  taskCount: 40+,
  bugCount: 5+,
  excludedUserStories: 20+ // Should not count in velocity
};
```

#### 3.3 End-to-End Testing
- **Test velocity chart generation**
- **Verify burndown calculations**
- **Validate sprint-over-sprint comparisons**

### Phase 4: Quality Assurance (Day 5)

#### 4.1 Data Quality Checks
```javascript
// Add validation logic
function validateStoryPointsData(workItems) {
  const withStoryPoints = workItems.filter(item =>
    item.storyPoints && item.storyPoints > 0
  );

  if (withStoryPoints.length === 0) {
    logger.warn('No story points found in work items - check field configuration');
  }

  return withStoryPoints;
}
```

#### 4.2 Logging & Monitoring
- **Add detailed logging for story points retrieval**
- **Monitor API response data quality**
- **Alert on missing story points data**

#### 4.3 Fallback Mechanisms
```javascript
// If story points not available, provide clear messaging
if (totalStoryPoints === 0) {
  return {
    velocity: 0,
    message: 'Story points not configured for this iteration',
    workItemCount: workItems.length,
    recommendation: 'Configure story points in Azure DevOps'
  };
}
```

## Expected Outcomes

### Immediate Fixes
1. **Story points properly retrieved** from Azure DevOps API
2. **Velocity calculations reflect real data** (60+ points for Delivery 13)
3. **Only Tasks and Bugs counted** (per requirement)
4. **Web board data matches API data**

### Long-term Benefits
1. **Accurate sprint planning** based on real velocity
2. **Reliable burndown charts** showing actual progress
3. **Consistent data** across all dashboard views
4. **Team confidence** in dashboard metrics

## Risk Mitigation

### Risk 1: Story Points Field Not Accessible
**Mitigation:** Work with Azure DevOps admin to configure field access

### Risk 2: Process Template Incompatibility
**Mitigation:** Implement custom field mapping based on actual schema

### Risk 3: Breaking Existing Functionality
**Mitigation:** Comprehensive testing with multiple iterations/projects

## Success Criteria

✅ **Delivery 13 velocity shows 60+ story points** (not 0)
✅ **Only Tasks and Bugs contribute to velocity** (excluding User Stories)
✅ **API data matches Azure web board data**
✅ **All existing functionality preserved**
✅ **Performance remains optimal**

## Implementation Timeline

- **Day 1:** Investigation & root cause analysis
- **Day 2-3:** Code fixes and query updates
- **Day 4:** Data validation and testing
- **Day 5:** Quality assurance and monitoring

**Total Effort:** 5 days
**Priority:** High (data accuracy critical for sprint planning)

## BREAKTHROUGH: Custom Field Discovery

### 🎯 **Root Cause Identified**
The story points are stored in **`Custom.StoryPoint`** field, NOT the standard Microsoft field!

**Evidence from API:**
```json
{
  "System.Id": 51793,
  "System.Title": "RMS12 Price ETL",
  "System.WorkItemType": "Task",
  "Custom.StoryPoint": 3,  // ✅ This is the real story points field!
  "Custom.TaskTypes": "Development"
}
```

### 🚀 **Immediate Fix Required**
1. **Update all WIQL queries** to use `Custom.StoryPoint` instead of `Microsoft.VSTS.Scheduling.StoryPoints`
2. **Update field mappings** in data transformers
3. **Test with Delivery 13 data** to validate 60+ story points are retrieved

### 📊 **Expected Results After Fix**
- **Delivery 13 velocity:** 60+ story points (instead of 0)
- **Task count:** 40+ items with story points
- **Bug count:** 5+ items with story points
- **Excluded:** User Stories/Features (per requirement)

### ⚡ **Priority: CRITICAL**
This is a simple field name change that will immediately fix all velocity calculations across the dashboard.

---

*Document created: 2025-09-23*
*Last updated: 2025-09-23*
*Status: ROOT CAUSE FOUND - Custom Field `Custom.StoryPoint` Discovery*
*Next Step: Update field references in codebase*