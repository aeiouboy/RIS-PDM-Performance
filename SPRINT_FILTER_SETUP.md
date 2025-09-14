# Sprint Filter Implementation Guide

## Overview
Complete implementation of sprint filter for performance dashboard with real Azure DevOps API integration.

## Quick Setup

### 1. Install Dependencies
```bash
npm install azure-devops-node-api --save
```

### 2. Configure Environment Variables
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your Azure DevOps details:
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/yourorganization
AZURE_PERSONAL_ACCESS_TOKEN=your_token_here
AZURE_DEVOPS_PROJECT=your_project_name
```

### 3. Generate Azure Personal Access Token
1. Go to `https://dev.azure.com/yourorg/_usersSettings/tokens`
2. Create new token with these scopes:
   - **Work Items**: Read
   - **Project and team**: Read
3. Copy token to `.env` file

### 4. Import Components
```javascript
// In your main dashboard page
import PerformanceDashboard from './components/PerformanceDashboard';
import './styles/PerformanceDashboard.css';

// Use the component
<PerformanceDashboard />
```

## Features Implemented

✅ **Sprint Dropdown Filter**
- Shows last 4 completed sprints
- Auto-selects most recent sprint
- Clean date formatting

✅ **Real Azure API Integration**
- Fetches actual sprint iterations
- Pulls work item data per sprint
- Handles authentication via PAT

✅ **Performance Metrics**
- Sprint velocity (story points completed)
- Completion rate percentage
- Work item breakdown (stories, bugs, tasks)
- Hours logged per sprint

✅ **Error Handling & Loading States**
- Loading indicators
- Error messages with retry
- Graceful degradation

✅ **Responsive Design**
- Mobile-friendly layout
- Clean, professional styling
- Hover effects and animations

## File Structure
```
src/
├── services/
│   └── azureDevOpsService.js     # Azure API integration
├── components/
│   ├── SprintFilter.jsx          # Dropdown filter component
│   └── PerformanceDashboard.jsx  # Main dashboard
├── hooks/
│   └── usePerformanceDashboard.js # Dashboard state management
└── styles/
    └── PerformanceDashboard.css  # Component styles
```

## Usage Example

```javascript
import React from 'react';
import PerformanceDashboard from './components/PerformanceDashboard';

function App() {
  return (
    <div className="app">
      <PerformanceDashboard />
    </div>
  );
}
```

## API Requirements

**Azure DevOps Personal Access Token Scopes:**
- Work Items (Read) - Required
- Project and team (Read) - Required

**Supported Azure DevOps Work Item Types:**
- User Story
- Bug
- Task

## Troubleshooting

**Issue**: "Failed to fetch sprints"
- **Solution**: Check Azure PAT token and organization URL

**Issue**: "No sprints found"
- **Solution**: Verify team name in environment variables

**Issue**: Performance data not loading
- **Solution**: Ensure work items exist in sprint iterations

## Next Steps

1. **Test with your Azure DevOps instance**
2. **Customize work item types** if needed
3. **Add velocity trending** across sprints
4. **Integrate with existing dashboard** components

The implementation is complete and ready for integration with your performance dashboard!