# 14. Claude Code Implementation Guide

## 14.1 Project Structure for Claude Code

```
performance-dashboard/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   │   ├── MetricCard.jsx
│   │   │   │   ├── VelocityChart.jsx
│   │   │   │   ├── BurndownChart.jsx
│   │   │   │   └── TeamPerformance.jsx
│   │   │   ├── Filters/
│   │   │   │   ├── ProductSelector.jsx
│   │   │   │   ├── SprintFilter.jsx
│   │   │   │   └── DateRangePicker.jsx
│   │   │   └── Layout/
│   │   │       ├── Header.jsx
│   │   │       ├── Sidebar.jsx
│   │   │       └── MobileNav.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── IndividualPerformance.jsx
│   │   │   └── Reports.jsx
│   │   ├── hooks/
│   │   │   ├── useAzureDevOps.js
│   │   │   ├── useMetrics.js
│   │   │   └── useFilters.js
│   │   ├── utils/
│   │   │   ├── api.js
│   │   │   ├── chartConfigs.js
│   │   │   └── dataTransformers.js
│   │   ├── App.jsx
│   │   └── index.js
│   ├── public/
│   ├── package.json
│   └── tailwind.config.js
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── metrics.js
│   │   │   ├── workItems.js
│   │   │   └── auth.js
│   │   ├── services/
│   │   │   ├── azureDevOpsService.js
│   │   │   ├── metricsCalculator.js
│   │   │   └── cacheService.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   ├── config/
│   │   │   └── database.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
├── docker-compose.yml
├── README.md
└── .gitignore
```

## 14.2 Step-by-Step Implementation with Claude Code

### Phase 1: Initial Setup (Day 1)
```bash
# Claude Code commands to initialize project
claude-code create performance-dashboard
cd performance-dashboard

# Setup frontend
claude-code generate react-app frontend --tailwind --routing
cd frontend
npm install axios recharts date-fns

# Setup backend
cd ..
claude-code generate express-api backend --cors --auth
cd backend
npm install node-fetch redis bull dotenv
```

### Phase 2: Azure DevOps Integration (Days 2-3)
```javascript
// Request to Claude Code:
// "Create an Azure DevOps service that fetches work items with caching"

// Expected implementation by Claude Code:
// backend/src/services/azureDevOpsService.js
class AzureDevOpsService {
  constructor() {
    this.baseUrl = `https://dev.azure.com/${process.env.AZURE_ORG}`;
    this.headers = {
      'Authorization': `Basic ${Buffer.from(`:${process.env.AZURE_PAT}`).toString('base64')}`,
      'Content-Type': 'application/json'
    };
  }

  async getWorkItems(project, query) {
    // Implementation with error handling and caching
  }
}
```

### Phase 3: Frontend Components (Days 4-6)
```bash
# Claude Code prompts for component generation:
claude-code generate component MetricCard --props "title,value,trend,icon"
claude-code generate component VelocityChart --with-recharts
claude-code generate component ProductSelector --with-api-integration
```

## 14.3 Claude Code-Specific Considerations

### 14.3.1 Environment Configuration
```bash
# .env.example for Claude Code
AZURE_DEVOPS_ORG=your-organization
AZURE_DEVOPS_PROJECT=your-project
AZURE_DEVOPS_PAT=your-personal-access-token
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:password@localhost:5432/dashboard
PORT=3001
REACT_APP_API_URL=http://localhost:3001/api
```

### 14.3.2 Claude Code Prompts for Complex Features

**1. Dashboard State Management:**
```
"Create a React context for managing dashboard filters including product selection, 
sprint filter, and date range. Include localStorage persistence for user preferences."
```

**2. Real-time Updates:**
```
"Implement WebSocket connection for real-time metric updates. Create a hook called 
useRealtimeMetrics that subscribes to metric changes for the selected product."
```

**3. Mobile Optimization:**
```
"Create a responsive dashboard layout that switches from grid to stack on mobile. 
Include swipe gestures for switching between metric cards on mobile devices."
```

### 14.3.3 Testing with Claude Code
```bash
# Generate test files
claude-code generate tests --unit --integration

# Test file structure
tests/
├── unit/
│   ├── services/
│   │   └── azureDevOpsService.test.js
│   └── utils/
│       └── dataTransformers.test.js
├── integration/
│   └── api/
│       └── metrics.test.js
└── e2e/
    └── dashboard.test.js
```

## 14.4 Claude Code Implementation Checklist

### Week 1: Foundation
- [ ] Initialize project structure
- [ ] Setup development environment
- [ ] Configure Azure DevOps authentication
- [ ] Create base API structure
- [ ] Setup database schema
- [ ] Implement basic caching

### Week 2: Core Features
- [ ] Work items fetching and transformation
- [ ] Metrics calculation service
- [ ] Basic dashboard UI components
- [ ] Product selection functionality
- [ ] Sprint/date filtering
- [ ] Basic charts implementation

### Week 3: Advanced Features
- [ ] Individual performance views
- [ ] Advanced filtering options
- [ ] Export functionality
- [ ] Mobile responsive design
- [ ] Performance optimizations
- [ ] Error handling and logging

### Week 4: Polish & Deploy
- [ ] UI/UX refinements
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] Docker containerization
- [ ] CI/CD pipeline setup
- [ ] Production deployment

## 14.5 Common Claude Code Commands for This Project

```bash
# Development shortcuts
claude-code run dev              # Start both frontend and backend
claude-code test                 # Run all tests
claude-code build               # Build for production
claude-code deploy              # Deploy to cloud

# Code generation
claude-code generate api-endpoint GET /api/metrics/:productId
claude-code generate chart-component BurndownChart
claude-code generate auth-middleware jwt

# Debugging
claude-code debug api           # Debug API issues
claude-code analyze performance # Performance analysis
claude-code check security      # Security audit
```

## 14.6 Performance Optimization Tips for Claude Code

1. **Implement request batching for Azure DevOps API**
```javascript
// Tell Claude Code: "Implement a batch processor for Azure DevOps API 
// calls that groups multiple requests and respects rate limits"
```

2. **Use React.memo and useMemo for chart components**
```javascript
// Claude Code prompt: "Optimize chart components using React.memo 
// and useMemo to prevent unnecessary re-renders"
```

3. **Implement virtual scrolling for large datasets**
```javascript
// Claude Code prompt: "Add virtual scrolling to the work items 
// list using react-window"
```

## 14.7 Troubleshooting Guide for Claude Code

**Common Issues and Solutions:**

1. **Azure DevOps API Rate Limiting**
   - Implement exponential backoff
   - Use Redis queue for API requests
   - Cache responses aggressively

2. **Large Dataset Performance**
   - Implement pagination
   - Use data virtualization
   - Progressive loading for charts

3. **Mobile Performance**
   - Lazy load chart libraries
   - Use CSS containment
   - Implement service worker for offline support

## 14.8 Production Deployment with Claude Code

```bash
# Production setup commands
claude-code setup production --provider azure
claude-code config ssl
claude-code setup monitoring --datadog
claude-code deploy --environment production

# Environment-specific configurations
production/
├── nginx.conf
├── docker-compose.prod.yml
├── kubernetes/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
└── monitoring/
    ├── alerts.yaml
    └── dashboards.json
```

---
