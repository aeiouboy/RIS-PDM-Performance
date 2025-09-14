---
name: "Story PRP - Dashboard UI Redesign Implementation"
description: "Tactical implementation guide for redesigning the performance dashboard UI with improved layout, typography, and accessibility"
---

## Original Story

User story from: `/Users/tachongrak/Projects/ris-pdm/docs/user-story-dashboard-ui-redesign.md`

```
As a product manager and team lead
I want an improved, professional-looking performance dashboard interface
So that I can easily interpret team performance metrics and make data-driven decisions

Current Issues:
- Inconsistent spacing between dashboard components
- Poor color contrast in chart elements
- Crowded layout that makes data interpretation difficult
- Typography hierarchy needs improvement
- Charts and widgets lack visual cohesion
```

## Story Metadata

**Story Type**: Enhancement (UI Redesign)
**Estimated Complexity**: High
**Primary Systems Affected**: Frontend dashboard components, Tailwind styling system, Recharts visualization layer

---

## CONTEXT REFERENCES

[Auto-discovered documentation and patterns from codebase analysis]

- `/frontend/src/pages/Dashboard.jsx` - Main dashboard layout with 590 lines, contains grid system and state management patterns
- `/frontend/src/components/KPICard.jsx` - Reusable KPI card component with trend indicators, memoized for performance
- `/frontend/tailwind.config.js` - Custom design system with primary color palette and shadows
- `/frontend/src/components/SprintBurndownChart.jsx` - Recharts line chart implementation with custom tooltips
- `/frontend/src/components/TeamVelocityChart.jsx` - Combined chart with performance metrics
- `/frontend/src/components/TaskDistributionDashboard.jsx` - Pie/bar chart implementation
- `Recharts ^3.1.0 documentation` - React charting library with ResponsiveContainer patterns
- `Tailwind CSS ^4.1.11 documentation` - Utility-first CSS framework with custom extensions
- `@headlessui/react ^2.2.8` - Accessible UI components for improved UX

---

## IMPLEMENTATION TASKS

[Task blocks in dependency order - each block is atomic and testable]

### Guidelines for Tasks

- Using information-dense keywords for specific implementation details
- Tasks detailed for execution using only this context file
- Developer should complete tasks with references to existing codebase patterns
- Each task includes validation commands using project's testing setup

### UPDATE tailwind.config.js:

- **ENHANCE**: Expand color palette for improved contrast and accessibility
- **PATTERN**: Follow existing custom color structure with 50-900 shades
- **ADD**: New color variants for better visual hierarchy
```javascript
colors: {
  primary: {
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe',
    300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6',
    600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a'
  },
  gray: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
    300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b',
    600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a'
  },
  semantic: {
    success: '#22c55e', warning: '#f59e0b', error: '#ef4444', info: '#06b6d4'
  }
}
```
- **ADD**: Enhanced spacing system for consistent layout
```javascript
extend: {
  spacing: {
    '4.5': '1.125rem', '18': '4.5rem', '88': '22rem', '100': '25rem'
  }
}
```
- **VALIDATE**: `cd frontend && npm run build && echo "✓ Tailwind config compiled"`

### CREATE frontend/src/styles/dashboard.css:

- **IMPLEMENT**: CSS custom properties for dashboard-specific design tokens
- **PATTERN**: Follow existing `src/index.css` structure
- **CONTENT**:
```css
/* Dashboard Design System */
:root {
  --dashboard-spacing-unit: 8px;
  --dashboard-border-radius: 8px;
  --dashboard-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
  --dashboard-shadow-hover: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --dashboard-header-height: 4rem;
}

/* Typography Scale */
.dashboard-title { @apply text-2xl font-bold text-gray-900 tracking-tight; }
.dashboard-subtitle { @apply text-lg font-semibold text-gray-700; }
.dashboard-body { @apply text-sm text-gray-600 leading-relaxed; }
.dashboard-caption { @apply text-xs text-gray-500; }

/* Component Base Classes */
.dashboard-card {
  @apply bg-white rounded-lg border border-gray-200 transition-all duration-200;
  box-shadow: var(--dashboard-shadow);
}
.dashboard-card:hover {
  box-shadow: var(--dashboard-shadow-hover);
  @apply border-gray-300;
}

/* Layout Utilities */
.dashboard-grid { @apply grid gap-6; }
.dashboard-grid-kpi { @apply grid-cols-1 md:grid-cols-2 lg:grid-cols-4; }
.dashboard-grid-charts { @apply grid-cols-1 lg:grid-cols-2; }
```
- **IMPORT**: Add to `/frontend/src/main.jsx` after existing imports
- **VALIDATE**: `cd frontend && npm run build && echo "✓ Dashboard styles compiled"`

### UPDATE frontend/src/components/KPICard.jsx:

- **REFACTOR**: Enhance visual hierarchy and accessibility
- **FIND**: Current color variant system in KPICard component
- **REPLACE**: Color mappings with improved contrast ratios
```javascript
const colorVariants = {
  blue: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-600 bg-blue-100',
    text: 'text-blue-900',
    accent: 'text-blue-600'
  },
  green: {
    bg: 'bg-emerald-50 border-emerald-200',
    icon: 'text-emerald-600 bg-emerald-100',
    text: 'text-emerald-900',
    accent: 'text-emerald-600'
  },
  orange: {
    bg: 'bg-orange-50 border-orange-200',
    icon: 'text-orange-600 bg-orange-100',
    text: 'text-orange-900',
    accent: 'text-orange-600'
  }
};
```
- **UPDATE**: Typography classes for better hierarchy
```javascript
// Replace existing title classes
<h3 className="dashboard-subtitle mb-1">{title}</h3>
// Replace value display
<p className="text-3xl font-bold tracking-tight mb-2">{formattedValue}</p>
// Replace description
<p className="dashboard-body">{description}</p>
```
- **ADD**: Improved loading state with skeleton animation
- **PATTERN**: Follow existing React.memo and useMemo patterns
- **VALIDATE**: `cd frontend && npm run test -- --run KPICard && echo "✓ KPICard tests pass"`

### UPDATE frontend/src/pages/Dashboard.jsx:

- **REFACTOR**: Layout grid system for better spacing and hierarchy
- **FIND**: Current grid implementation around line 200-300
- **REPLACE**: Grid container classes with new dashboard utilities
```javascript
{/* Filter Bar Section */}
<div className="dashboard-card p-6 mb-8">
  <div className="dashboard-grid grid-cols-1 md:grid-cols-3">
    {/* Filter components with improved spacing */}
  </div>
</div>

{/* KPI Cards Section */}
<div className="dashboard-grid dashboard-grid-kpi mb-8">
  {/* KPI cards with consistent spacing */}
</div>

{/* Charts Section */}
<div className="dashboard-grid dashboard-grid-charts">
  {/* Chart components with improved layout */}
</div>
```
- **UPDATE**: Loading states with consistent skeleton patterns
- **ADD**: Section headers with improved typography
```javascript
<h2 className="dashboard-title mb-6">Performance Overview</h2>
<h3 className="dashboard-subtitle mb-4">Key Metrics</h3>
```
- **PATTERN**: Maintain existing state management and useRealtimeMetrics hook
- **VALIDATE**: `cd frontend && npm run dev && curl -s http://localhost:5173 > /dev/null && echo "✓ Dashboard loads successfully"`

### UPDATE frontend/src/components/SprintBurndownChart.jsx:

- **ENHANCE**: Chart styling for better readability
- **FIND**: Recharts component styling around line 150-200
- **UPDATE**: Color scheme for improved accessibility
```javascript
const chartColors = {
  ideal: '#64748b',      // Neutral gray
  actual: '#3b82f6',     // Primary blue
  projected: '#06b6d4',  // Info cyan
  background: '#f8fafc'  // Light gray
};
```
- **IMPROVE**: Tooltip styling for consistency
```javascript
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="dashboard-card p-3 border-0 shadow-lg">
        <p className="dashboard-caption mb-2">{`Sprint Day ${label}`}</p>
        {payload.map((entry, index) => (
          <p key={index} className="dashboard-body"
             style={{ color: entry.color }}>
            {`${entry.dataKey}: ${entry.value} points`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};
```
- **ADD**: Better responsive breakpoints using ResponsiveContainer
- **VALIDATE**: `cd frontend && npm run test -- --run SprintBurndownChart && echo "✓ Chart tests pass"`

### UPDATE frontend/src/components/TeamVelocityChart.jsx:

- **REFACTOR**: Combined chart styling for visual coherence
- **FIND**: Chart color configuration around line 100-150
- **UPDATE**: Bar and line colors with semantic meaning
```javascript
const velocityColors = {
  commitment: '#e2e8f0',    // Light gray bars
  completed: '#22c55e',     // Success green bars
  velocity: '#3b82f6',      // Primary blue line
  average: '#f59e0b'        // Warning orange line
};
```
- **IMPROVE**: Legend positioning and styling
- **ADD**: Chart title and subtitle components
```javascript
<div className="mb-4">
  <h4 className="dashboard-subtitle">Team Velocity Trend</h4>
  <p className="dashboard-caption">Story points completed vs committed by sprint</p>
</div>
```
- **VALIDATE**: `cd frontend && npm run test -- --run TeamVelocityChart && echo "✓ Velocity chart tests pass"`

### UPDATE frontend/src/components/TaskDistributionDashboard.jsx:

- **ENHANCE**: Pie chart and bar chart visual consistency
- **FIND**: Chart type switching logic around line 200
- **UPDATE**: Color palette for categorical data visualization
```javascript
const distributionColors = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
];
```
- **IMPROVE**: Chart legends with better typography
- **ADD**: Data labels with improved readability
- **PATTERN**: Follow existing chart switching state management
- **VALIDATE**: `cd frontend && npm run test -- --run TaskDistributionDashboard && echo "✓ Distribution chart tests pass"`

### CREATE frontend/src/components/LoadingStates.jsx:

- **IMPLEMENT**: Reusable loading skeleton components for consistency
- **PATTERN**: Follow existing component structure with React.memo
- **CONTENT**:
```javascript
import React from 'react';

export const KPICardSkeleton = React.memo(() => (
  <div className="dashboard-card p-6 animate-pulse">
    <div className="flex items-center mb-4">
      <div className="w-8 h-8 bg-gray-200 rounded-lg mr-3"></div>
      <div className="h-4 bg-gray-200 rounded w-24"></div>
    </div>
    <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-32"></div>
  </div>
));

export const ChartSkeleton = React.memo(() => (
  <div className="dashboard-card p-6 animate-pulse">
    <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
    <div className="h-64 bg-gray-100 rounded"></div>
  </div>
));
```
- **EXPORT**: Add to `/frontend/src/components/index.js`
- **VALIDATE**: `cd frontend && node -e "const comp = require('./src/components/LoadingStates.jsx'); console.log('✓ LoadingStates exports valid')"`

### UPDATE frontend/src/main.jsx:

- **ADD**: Import new dashboard styles after existing imports
```javascript
import './styles/dashboard.css'
```
- **ENSURE**: Style load order maintains Tailwind cascade
- **VALIDATE**: `cd frontend && npm run build && echo "✓ Main entry builds successfully"`

### ADD frontend/src/components/__tests__/Dashboard.test.jsx:

- **CREATE**: Comprehensive dashboard component tests
- **IMPLEMENT**: Responsive layout testing
- **PATTERN**: Follow existing test structure using Testing Library
- **IMPORTS**: `from '@testing-library/react'`; `from '@testing-library/jest-dom'`
- **CONTENT**:
```javascript
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard.jsx';

describe('Dashboard UI', () => {
  const renderDashboard = () =>
    render(<BrowserRouter><Dashboard /></BrowserRouter>);

  test('renders with proper layout structure', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Performance Overview')).toBeInTheDocument();
    });

    // Test grid layout
    const kpiGrid = screen.getByTestId('kpi-grid');
    expect(kpiGrid).toHaveClass('dashboard-grid-kpi');
  });

  test('applies responsive classes correctly', () => {
    renderDashboard();
    const chartsGrid = screen.getByTestId('charts-grid');
    expect(chartsGrid).toHaveClass('dashboard-grid-charts');
  });
});
```
- **VALIDATE**: `cd frontend && npm run test -- --run Dashboard.test && echo "✓ Dashboard tests pass"`

### UPDATE cypress/integration/dashboard.spec.js:

- **CREATE**: E2E tests for responsive dashboard behavior
- **IMPLEMENT**: Visual regression tests for UI improvements
- **PATTERN**: Follow existing Cypress test patterns
- **CONTENT**:
```javascript
describe('Dashboard UI Redesign', () => {
  beforeEach(() => {
    cy.visit('/dashboard');
    cy.wait(2000); // Allow for data loading
  });

  it('displays improved layout on desktop', () => {
    cy.viewport(1280, 720);
    cy.get('[data-testid="kpi-grid"]').should('have.class', 'lg:grid-cols-4');
    cy.get('[data-testid="charts-grid"]').should('have.class', 'lg:grid-cols-2');
  });

  it('adapts layout for mobile devices', () => {
    cy.viewport(375, 667);
    cy.get('[data-testid="kpi-grid"]').should('have.class', 'grid-cols-1');
    cy.get('.dashboard-card').should('be.visible');
  });

  it('maintains accessibility standards', () => {
    cy.checkA11y(); // Requires cypress-axe
  });
});
```
- **VALIDATE**: `cd frontend && npm run e2e && echo "✓ E2E tests pass"`

---

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each file modification - fix before proceeding
cd frontend
npm run lint                    # ESLint validation with auto-fix
npm run build                   # Vite build validation
npm run test:run               # Unit test validation

# Expected: Zero errors. If errors exist, READ output and fix before proceeding.
```

### Level 2: Unit Tests (Component Validation)

```bash
# Test each component as updated
cd frontend
npm run test -- --run KPICard                     # KPI card component tests
npm run test -- --run SprintBurndownChart         # Burndown chart tests
npm run test -- --run TeamVelocityChart          # Velocity chart tests
npm run test -- --run TaskDistributionDashboard  # Distribution tests
npm run test -- --run Dashboard                   # Main dashboard tests

# Full test suite with coverage
npm run test:coverage

# Expected: All tests pass with >80% coverage. If failing, debug and fix implementation.
```

### Level 3: Integration Testing (System Validation)

```bash
# Frontend development server validation
cd frontend
npm run dev &
sleep 5  # Allow startup time

# Health check validation - dashboard loads correctly
curl -f http://localhost:5173 || echo "Frontend server failed"

# Visual validation - ensure dashboard renders
open http://localhost:5173/dashboard

# Mobile responsive validation
# Test at different viewport sizes in browser dev tools

# Backend integration validation (if needed)
cd ../backend
npm run dev &
sleep 3

# API health check
curl -f http://localhost:3002/api/health || echo "Backend API failed"

# Expected: Frontend loads, dashboard displays, responsive design works, API integration functions
```

### Level 4: Creative & Domain-Specific Validation

Using available tools for extended validation:

```bash
# Accessibility Testing (if cypress-axe available)
cd frontend
npm run e2e -- --spec="cypress/integration/accessibility.spec.js"

# Visual Regression Testing (if available)
npm run test:visual

# Performance Testing
npm run build
npm run preview &
# Test bundle size and load times

# Cross-browser Testing
npm run e2e:chrome
npm run e2e:firefox  # if configured

# Real Device Testing
# Test on actual mobile devices for touch interactions
```

---

## COMPLETION CHECKLIST

- [ ] Tailwind config updated with enhanced color system
- [ ] Dashboard CSS custom properties created
- [ ] KPICard component refactored with improved accessibility
- [ ] Dashboard page layout updated with new grid system
- [ ] All chart components enhanced with consistent styling
- [ ] Loading skeleton components implemented
- [ ] Main entry point updated with new styles
- [ ] Unit tests created for dashboard components
- [ ] E2E tests updated for responsive behavior
- [ ] All validation commands pass without errors
- [ ] Responsive design tested on multiple screen sizes
- [ ] Accessibility compliance verified (WCAG 2.1 AA)
- [ ] Story acceptance criteria met
- [ ] Cross-browser compatibility verified
- [ ] Performance benchmarks maintained (<2s load time)

---

## Notes

**Design System Implementation**: The redesign focuses on establishing a consistent design system using Tailwind's utility classes while maintaining the existing React component architecture. All changes preserve the current data flow and real-time functionality.

**Performance Considerations**: All components maintain their existing React.memo and useMemo optimizations. New styling additions use CSS custom properties to minimize runtime calculations.

**Responsive Strategy**: Enhanced mobile-first approach with better breakpoint utilization and dedicated mobile interaction patterns.

**Accessibility Focus**: Improved color contrast ratios, semantic HTML structure, and ARIA attributes where needed for screen reader compatibility.

**Testing Strategy**: Comprehensive unit and integration testing ensures UI changes don't break functionality, with specific responsive design validation.

<!-- EOF -->