# Dashboard Azure API Filtering Fix Plan

## **Problem Analysis**
The dashboard shows incorrect data when filtering by different sprints or projects due to several architectural issues:

### **Root Causes Identified:**

1. **Inconsistent Project/Sprint Mapping**
   - Frontend project IDs don't match Azure DevOps project names
   - Sprint ID resolution fails between frontend and backend
   - Iteration path construction is inconsistent across services

2. **Cache Contamination**
   - Cached data from previous filters bleeds into new requests
   - Cache keys don't properly differentiate between project/sprint combinations
   - Stale iteration resolution data persists

3. **API Service Layer Issues**
   - `AzureDevOpsApiService` has complex fallback logic that can return wrong data
   - `getWorkItemsForProduct()` method has iteration path resolution conflicts
   - Multiple API services (real vs fallback) can return inconsistent results

4. **Frontend Filter State Management**
   - Complex sprint-to-iteration-path resolution in frontend
   - `getSprintIterationPath()` has project-specific logic that conflicts with backend
   - Multiple useEffect hooks can trigger conflicting API calls

## **Comprehensive Fix Strategy**

### **Phase 1: Backend API Consistency (Priority: Critical)**
1. **Standardize Project Mapping**
   - Fix `mapFrontendProjectToAzure()` function consistency
   - Ensure all services use same mapping logic
   - Add validation for project ID resolution

2. **Improve Iteration Path Resolution**
   - Centralize iteration path logic in `AzureIterationResolver`
   - Fix `resolveIteration()` method cache conflicts
   - Add debugging for iteration path construction

3. **Fix Cache Key Strategy**
   - Update cache keys to include `project+sprint+timestamp`
   - Implement proper cache invalidation on filter changes
   - Add cache debugging endpoints

### **Phase 2: Data Retrieval Robustness (Priority: High)**
1. **Enhance Work Items Filtering**
   - Fix `getWorkItemsForProduct()` to properly handle sprint filters
   - Improve error handling for failed iteration resolution
   - Add validation for returned data consistency

2. **Standardize Burndown Calculation**
   - Fix `calculateSprintBurndown()` method data consistency
   - Ensure proper project/sprint scoping
   - Add data validation before chart rendering

### **Phase 3: Frontend Filter Coordination (Priority: Medium)**
1. **Simplify Filter State Management**
   - Remove duplicate sprint resolution logic from frontend
   - Let backend handle all iteration path construction
   - Add proper loading states during filter changes

2. **Fix Component Data Flow**
   - Ensure KPI, burndown, and velocity components use same filter parameters
   - Add proper error boundaries for data inconsistencies
   - Implement unified refresh mechanism

### **Phase 4: Testing & Validation (Priority: Medium)**
1. **Add Comprehensive Testing**
   - Unit tests for project mapping functions
   - Integration tests for filter combinations
   - End-to-end tests for dashboard filtering scenarios

2. **Add Monitoring & Debugging**
   - Enhanced logging for filter operations
   - Performance monitoring for API calls
   - Data validation checkpoints

## **Expected Outcomes**
- ✅ Consistent data when switching between projects
- ✅ Accurate sprint filtering across all dashboard components
- ✅ Eliminated cache contamination issues
- ✅ Improved error handling and user feedback
- ✅ Faster dashboard response times

## **Implementation Approach**
- **Sequential phases** to minimize risk
- **Extensive testing** at each phase
- **Backwards compatibility** maintained
- **Progressive enhancement** of existing functionality

## **Technical Implementation Details**

### **Files to Modify:**

#### **Backend Services:**
- `backend/src/services/azureDevOpsApiService.js` - Fix project mapping and work item retrieval
- `backend/src/services/azureIterationResolver.js` - Improve iteration path resolution
- `backend/src/services/metricsCalculator.js` - Fix data filtering and caching
- `backend/routes/metrics.js` - Improve cache key strategy

#### **Frontend Components:**
- `frontend/src/pages/Dashboard.jsx` - Simplify filter state management
- `frontend/src/components/SprintBurndownChart.jsx` - Add data validation
- `frontend/src/components/filters/SprintFilter.jsx` - Remove duplicate logic

### **Key Methods to Fix:**

1. **`mapFrontendProjectToAzure()`** - Standardize project mapping
2. **`getWorkItemsForProduct()`** - Fix sprint filtering
3. **`calculateSprintBurndown()`** - Ensure data consistency
4. **`resolveIteration()`** - Improve cache handling
5. **`getSprintIterationPath()`** - Simplify frontend logic

### **Cache Strategy:**
- Cache keys format: `{endpoint}_{projectId}_{sprintId}_{timestamp}`
- Implement cache invalidation on filter changes
- Add cache debugging for troubleshooting

### **Error Handling:**
- Add validation at data retrieval points
- Implement graceful fallbacks for failed API calls
- Improve user feedback for filtering errors

### **Testing Strategy:**
- Unit tests for all mapping functions
- Integration tests for filter combinations
- Manual testing with different project/sprint scenarios
- Performance testing for cache effectiveness

## **Rollback Plan**
- All changes will be backwards compatible
- Original functions preserved as fallbacks
- Feature flags for new filtering logic
- Monitoring for any regressions

---

**Status:** Ready for implementation
**Priority:** Critical - affects core dashboard functionality
**Estimated Time:** 2-3 days for full implementation and testing