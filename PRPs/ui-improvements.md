name: "RIS PDM Dashboard UI Improvements - Comprehensive Navigation & User Management Enhancement"
description: |
  Complete overhaul of navigation consistency, user authentication system, and visual hierarchy improvements for RIS PDM Dashboard.
  Eliminates hardcoded user data, implements responsive breadcrumbs, enhances mobile experience, and adds comprehensive notification system.

---

## Goal

**Feature Goal**: Transform RIS PDM Dashboard from placeholder-driven UI to production-ready enterprise dashboard with centralized user management, consistent navigation, and modern interaction patterns

**Deliverable**: Complete UI enhancement package including:
- Functional user authentication and profile management system
- Navigation consistency across desktop/mobile with breadcrumb support
- Modern dropdown menus and notification system
- Enhanced loading states and visual hierarchy
- Settings page with user preferences and theme management

**Success Definition**:
- All hardcoded user data eliminated (Header, MobileNav, UserMenu)
- Navigation parity between desktop sidebar and mobile menus
- Working user profile/settings/logout functionality
- Breadcrumb navigation for all routes
- Professional notification system with badge counts
- 98%+ accessibility compliance (WCAG 2.1 AA)

## User Persona (if applicable)

**Target User**: Dashboard administrators, team managers, and individual contributors accessing RIS PDM metrics

**Use Case**: Daily dashboard usage requiring user profile management, efficient navigation between sections, and personalized settings/preferences

**User Journey**: Login → Dashboard overview → Navigate to Individual Performance/Reports → Manage user settings → Access notifications → Logout

**Pain Points Addressed**:
- Frustration with inconsistent navigation between desktop/mobile
- Inability to manage user profile or access settings
- Confusion with hardcoded placeholder data
- Poor mobile navigation experience with duplicate navigation systems

## Why

- **Production Readiness**: Current hardcoded user data makes dashboard unsuitable for production deployment
- **User Experience**: Navigation inconsistencies create cognitive load and reduce efficiency
- **Professional Standards**: Modern enterprise dashboards require proper authentication and user management
- **Mobile Experience**: Growing need for mobile access requires polished mobile interface
- **Accessibility Compliance**: Enterprise requirements for inclusive design

## What

### Core User Experience Improvements
- **Centralized User Context**: Replace all hardcoded user data with dynamic context-driven system
- **Navigation Consistency**: Align desktop sidebar with mobile navigation, eliminate route mismatches
- **Professional User Interface**: Modern dropdown menus, notification system, and settings management
- **Responsive Breadcrumbs**: Dynamic breadcrumb navigation adapting to current route context
- **Enhanced Visual Hierarchy**: Improved typography, spacing, and loading states

### Technical Enhancements
- **HeadlessUI Integration**: Accessible dropdown menus with proper focus management
- **React Context**: Performance-optimized user state management following existing memoization patterns
- **React Router v6**: Dynamic breadcrumb system with route handles and data loaders
- **Tailwind Design System**: Extended design tokens for typography scale and spacing system

### Success Criteria

- [ ] User can login/logout with persistent session management
- [ ] Profile dropdown shows actual user data (name, email, avatar)
- [ ] Settings page allows theme selection and preference management
- [ ] Navigation items consistent between desktop sidebar and mobile interfaces
- [ ] Breadcrumb navigation works for all routes with dynamic data
- [ ] Notification system displays badge counts and manages read/unread state
- [ ] Mobile experience streamlined with single navigation system
- [ ] All components follow existing RIS PDM performance optimization patterns
- [ ] Test coverage >90% for new components with accessibility testing

## All Needed Context

### Context Completeness Check

_✅ Validated: An AI agent with no prior RIS PDM knowledge could successfully implement these improvements using only this PRP content and the referenced documentation._

### Documentation & References

```yaml
# MUST READ - Critical for implementation success
- url: https://headlessui.com/react/menu#menu-button
  why: Dropdown menu implementation patterns for user profile menu
  critical: Focus management and accessibility requirements for React 19

- url: https://www.radix-ui.com/primitives/docs/components/dropdown-menu#styling
  why: Alternative dropdown implementation with Tailwind integration
  critical: Compound component patterns and event handling

- url: https://reactrouter.com/en/main/hooks/use-matches
  why: Dynamic breadcrumb implementation with React Router v6
  critical: Route handle configuration and data loading for breadcrumbs

- file: /Users/tachongrak/Projects/ris-pdm/frontend/src/components/Header.jsx
  why: Current user interface implementation to replace
  pattern: User button structure and real-time status integration
  gotcha: Existing onClick handlers need HeadlessUI Menu integration

- file: /Users/tachongrak/Projects/ris-pdm/frontend/src/components/UserMenu.jsx
  why: Complete user menu already exists but not integrated
  pattern: User dropdown structure and styling classes
  gotcha: Component exists but not imported/used in Header.jsx

- file: /Users/tachongrak/Projects/ris-pdm/frontend/src/components/Sidebar.jsx
  why: Navigation patterns and Quick Actions structure
  pattern: NavLink usage, active states, rounded-md focus rings
  gotcha: Quick Actions buttons are placeholder - need actual functionality

- file: /Users/tachongrak/Projects/ris-pdm/frontend/src/components/MobileBottomNav.jsx
  why: Mobile navigation structure and active state management
  pattern: Icon state management, active class application
  gotcha: Has /settings route but no corresponding page exists

- file: /Users/tachongrak/Projects/ris-pdm/frontend/src/components/KPICard.jsx
  why: Performance optimization patterns used throughout RIS PDM
  pattern: React.memo, useMemo, useCallback usage, displayName setting
  gotcha: All new components MUST follow these memoization patterns

- file: /Users/tachongrak/Projects/ris-pdm/frontend/tailwind.config.js
  why: Design system tokens and color palette
  pattern: Primary colors, shadow-dashboard, spacing extensions
  gotcha: Use existing design tokens, don't create new color schemes

- docfile: PRPs/ai_docs/headlessui-patterns.md
  why: Complete HeadlessUI implementation patterns specific to RIS PDM
  section: UserDropdownMenu component and performance optimization

- docfile: PRPs/ai_docs/react-router-breadcrumbs.md
  why: React Router v6 breadcrumb implementation with route handles
  section: Dynamic breadcrumbs and mobile responsive patterns

- docfile: PRPs/ai_docs/user-context-patterns.md
  why: User context implementation eliminating hardcoded data
  section: UserProvider setup and authentication flow
```

### Current Codebase tree (frontend structure)

```bash
src/
├── components/
│   ├── Header.jsx                     # Contains hardcoded user button - needs HeadlessUI integration
│   ├── UserMenu.jsx                   # Complete dropdown menu exists but not integrated
│   ├── Sidebar.jsx                    # Desktop navigation - template for consistency
│   ├── MobileNav.jsx                  # Slide-out mobile menu with hardcoded user data
│   ├── MobileBottomNav.jsx            # Bottom nav with /settings route (page missing)
│   ├── KPICard.jsx                    # Performance patterns to follow
│   └── __tests__/                     # Testing patterns and utilities
├── pages/
│   ├── Dashboard.jsx                  # Main dashboard page
│   ├── IndividualPerformance.jsx     # Individual metrics page
│   ├── Reports.jsx                    # Reports page
│   └── [MISSING] Settings.jsx        # Settings page needs creation
├── hooks/
│   ├── useRealtimeMetrics.js         # WebSocket integration patterns
│   └── useSwipeNavigation.jsx        # Mobile navigation utilities
├── config/
│   └── branding.js                   # Project branding configuration
├── test/
│   ├── setup.js                      # Test environment setup
│   └── test-utils.jsx                # Custom render with router context
└── App.jsx                           # Main app structure needs Context integration
```

### Desired Codebase tree with files to be added and responsibility of file

```bash
src/
├── contexts/
│   └── UserContext.jsx               # [NEW] Centralized user state management with auth
├── components/
│   ├── Breadcrumbs.jsx               # [NEW] Desktop breadcrumb navigation
│   ├── MobileBreadcrumbs.jsx         # [NEW] Mobile back navigation
│   ├── NotificationDropdown.jsx      # [NEW] Notification system with badges
│   ├── ProtectedRoute.jsx            # [NEW] Route protection wrapper
│   ├── Header.jsx                    # [MODIFY] Integrate UserDropdown and breadcrumbs
│   ├── UserDropdownMenu.jsx          # [NEW] HeadlessUI dropdown replacing UserMenu.jsx
│   ├── Sidebar.jsx                   # [MODIFY] Connect Quick Actions functionality
│   ├── MobileNav.jsx                 # [MODIFY] Remove hardcoded user, use context
│   └── MobileBottomNav.jsx           # [MODIFY] Ensure routes match actual pages
├── pages/
│   ├── Settings.jsx                  # [NEW] User settings and preferences page
│   ├── LoginPage.jsx                 # [NEW] Authentication page
│   └── [MODIFY] App.jsx              # Router configuration with handles, UserProvider
└── hooks/
    └── useAuth.jsx                   # [NEW] Authentication hook with permissions
```

### Known Gotchas of our codebase & Library Quirks

```jsx
// CRITICAL: React 19 with HeadlessUI requires specific event handling
// HeadlessUI Menu automatically handles focus, don't override with custom focus handlers
<Menu.Button className="focus:outline-none focus:ring-2 focus:ring-primary-500">
// NOT: <Menu.Button onClick={customFocusHandler}>

// CRITICAL: RIS PDM uses React.memo everywhere - ALL new components must follow pattern
const Component = memo(({ prop1, prop2 }) => {
  // Component implementation
});
Component.displayName = 'ComponentName'; // Required for debugging

// CRITICAL: Tailwind v4.1.11 uses CSS-based configuration
// Use existing design tokens from tailwind.config.js, don't create new colors
className="bg-primary-500 text-white shadow-dashboard"

// CRITICAL: React Router v7.7.0 requires handle.crumb functions for breadcrumbs
// Route handles must return JSX elements, not strings
handle: { crumb: (data) => <Link to="/path">Page</Link> }

// CRITICAL: Mobile navigation z-index management
// HeadlessUI dropdowns need z-50, MobileBottomNav is z-40
<Menu.Items className="... z-50"> // Must be above bottom nav

// GOTCHA: UserMenu.jsx already exists but isn't imported in Header.jsx
// Don't duplicate functionality - integrate existing UserMenu or replace with HeadlessUI
```

## Implementation Blueprint

### Data models and structure

Core user and notification data structures for type safety:

```jsx
// User interface following TypeScript patterns
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'developer' | 'viewer';
  department: string;
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
    language: string;
  };
  permissions: string[];
  lastLogin?: Date;
}

// Notification interface
interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  timestamp: Date;
  actionUrl?: string;
}

// Context interfaces
interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  notifications: Notification[];
  markNotificationRead: (id: string) => void;
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE src/contexts/UserContext.jsx
  - IMPLEMENT: UserProvider with authentication state management
  - FOLLOW pattern: src/hooks/useRealtimeMetrics.js (WebSocket integration, error handling)
  - NAMING: UserContext, UserProvider, useUser, useAuth hooks
  - PLACEMENT: Context provider in src/contexts/
  - PERFORMANCE: Use useMemo for context value, useCallback for functions

Task 2: CREATE src/components/UserDropdownMenu.jsx
  - IMPLEMENT: HeadlessUI Menu with user profile, settings, logout
  - FOLLOW pattern: src/components/KPICard.jsx (React.memo, displayName, memoization)
  - NAMING: UserDropdownMenu component, memoized event handlers
  - DEPENDENCIES: HeadlessUI Menu, Transition components
  - PLACEMENT: Component in src/components/
  - CRITICAL: Follow PRPs/ai_docs/headlessui-patterns.md exactly

Task 3: MODIFY src/components/Header.jsx
  - INTEGRATE: UserDropdownMenu replacing hardcoded user button
  - MODIFY: Import UserDropdownMenu, add user context integration
  - PRESERVE: Existing RealtimeStatusDot, mobile menu toggle, ProjectLogo
  - FOLLOW pattern: Existing className patterns, focus ring styling
  - DEPENDENCIES: UserDropdownMenu from Task 2, UserContext from Task 1

Task 4: CREATE src/components/Breadcrumbs.jsx
  - IMPLEMENT: React Router v6 breadcrumb navigation with useMatches
  - FOLLOW pattern: src/components/Sidebar.jsx (NavLink structure, active states)
  - NAMING: Breadcrumbs component, memoized with displayName
  - DEPENDENCIES: React Router useMatches hook, route handles configuration
  - PLACEMENT: Navigation component in src/components/
  - CRITICAL: Follow PRPs/ai_docs/react-router-breadcrumbs.md patterns

Task 5: CREATE src/components/NotificationDropdown.jsx
  - IMPLEMENT: HeadlessUI Popover with notification list and badge
  - FOLLOW pattern: src/components/UserDropdownMenu.jsx (HeadlessUI structure)
  - NAMING: NotificationDropdown, notification badge component
  - PLACEMENT: Component in src/components/
  - STYLING: Use existing bell icon, red badge with notification count

Task 6: CREATE src/pages/Settings.jsx
  - IMPLEMENT: User settings form with theme, preferences, profile editing
  - FOLLOW pattern: src/pages/Dashboard.jsx (page structure, responsive grid)
  - NAMING: Settings page component, form handling functions
  - DEPENDENCIES: UserContext for user data and updateUser function
  - PLACEMENT: Page component in src/pages/

Task 7: CREATE src/pages/LoginPage.jsx
  - IMPLEMENT: Authentication form with email/password fields
  - FOLLOW pattern: src/pages/Dashboard.jsx (page layout structure)
  - NAMING: LoginPage component, credential state management
  - DEPENDENCIES: UserContext login function
  - PLACEMENT: Page component in src/pages/

Task 8: MODIFY src/App.jsx
  - INTEGRATE: UserProvider wrapper, router configuration with handles
  - MODIFY: Add route handles for breadcrumbs, Settings route, protected routing
  - PRESERVE: Existing route structure, mobile navigation state
  - FOLLOW pattern: Existing BrowserRouter setup, responsive layout
  - DEPENDENCIES: UserProvider from Task 1, Settings page from Task 6

Task 9: MODIFY src/components/MobileNav.jsx
  - REMOVE: Hardcoded user data in user section
  - INTEGRATE: User context for dynamic user information
  - PRESERVE: Existing navigation structure, slide-out animation
  - FOLLOW pattern: Existing Quick Actions section, NavLink usage

Task 10: CREATE tests for all new components
  - IMPLEMENT: Unit tests for UserContext, UserDropdownMenu, Breadcrumbs
  - FOLLOW pattern: src/components/__tests__/KPICard.test.jsx (React Testing Library)
  - NAMING: test_{component}_{scenario} function naming
  - COVERAGE: Authentication flows, dropdown interactions, breadcrumb navigation
  - PLACEMENT: Tests in component __tests__ directories
```

### Implementation Patterns & Key Details

```jsx
// UserContext provider pattern with performance optimization
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // PATTERN: Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user, loading, login, logout, updateUser
  }), [user, loading, login, logout, updateUser]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

// HeadlessUI Menu pattern with RIS PDM styling
const UserDropdownMenu = memo(({ user, onSignOut, onProfile, onSettings }) => {
  return (
    <Menu as="div" className="relative">
      <Menu.Button className="flex items-center space-x-2 p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
        {/* PATTERN: Avatar with fallback following RIS PDM design */}
        <div className="h-8 w-8 bg-primary-500 rounded-full flex items-center justify-center">
          {user?.avatar ? (
            <img className="h-8 w-8 rounded-full object-cover" src={user.avatar} alt="" />
          ) : (
            <span className="text-white text-sm font-medium">
              {user?.name?.charAt(0) || 'U'}
            </span>
          )}
        </div>
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          {/* CRITICAL: z-50 to appear above mobile bottom nav (z-40) */}
        </Menu.Items>
      </Transition>
    </Menu>
  );
});

// React Router breadcrumb pattern
const router = createBrowserRouter([
  {
    path: "/",
    element: <Dashboard />,
    handle: {
      crumb: () => <Link to="/" className="text-primary-600 hover:text-primary-700">Dashboard</Link>
    }
  },
  {
    path: "/individual/:userId",
    element: <IndividualPerformance />,
    handle: {
      crumb: (data) => (
        <span className="text-gray-500 font-medium">
          {data?.user?.name || `User ${data?.userId}`}
        </span>
      )
    },
    loader: async ({ params }) => {
      // PATTERN: Fetch user data for breadcrumb display
      const response = await fetch(`/api/users/${params.userId}`);
      return response.ok ? { user: await response.json() } : { userId: params.userId };
    }
  }
]);
```

### Integration Points

```yaml
DEPENDENCIES:
  - add: "@headlessui/react": "^2.0.0"
  - add: "@heroicons/react": "^2.0.0"
  - verify: "react-router-dom": "^7.7.0" (already present)

AUTHENTICATION:
  - endpoint: "/api/auth/login" - POST with email/password
  - endpoint: "/api/auth/me" - GET current user data
  - endpoint: "/api/auth/logout" - POST logout
  - storage: localStorage 'auth_token' for session persistence

NAVIGATION:
  - add route: "/settings" mapped to Settings page
  - modify: App.jsx router configuration with route handles
  - integrate: useMatches hook for breadcrumb generation

STYLING:
  - preserve: All existing Tailwind classes and design tokens
  - extend: Typography scale if needed in tailwind.config.js
  - follow: shadow-dashboard, focus:ring-primary-500 patterns
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each component creation - fix before proceeding
cd /Users/tachongrak/Projects/ris-pdm/frontend

# Linting and formatting
npm run lint                         # ESLint validation
npm run build                        # Build validation for type errors
npm run dev                          # Dev server startup validation

# Expected: Zero errors. If errors exist, READ output and fix before proceeding.
```

### Level 2: Unit Tests (Component Validation)

```bash
# Test each component as it's created
npm run test:run src/contexts/UserContext.test.jsx
npm run test:run src/components/__tests__/UserDropdownMenu.test.jsx
npm run test:run src/components/__tests__/Breadcrumbs.test.jsx

# Full test suite for affected areas
npm run test:coverage               # Coverage validation (target: >90%)
npm run test:run                    # Full test suite

# Expected: All tests pass with >90% coverage. If failing, debug and fix implementation.
```

### Level 3: Integration Testing (System Validation)

```bash
# Frontend development server validation
cd /Users/tachongrak/Projects/ris-pdm/frontend
npm run dev &
sleep 3

# Navigation flow validation
curl -f http://localhost:5173 || echo "Frontend server failed"

# User authentication flow validation (when backend ready)
# POST login credentials
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test"}' \
  | jq .

# User profile validation
curl -H "Authorization: Bearer TOKEN" http://localhost:3002/api/auth/me | jq .

# Settings update validation
curl -X PATCH http://localhost:3002/api/auth/profile \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"preferences": {"theme": "dark"}}' \
  | jq .

# Expected: All API integrations working, proper responses, no authentication errors
```

### Level 4: Creative & Domain-Specific Validation

```bash
# Mobile responsiveness validation
# Test at breakpoints: 320px (mobile), 768px (tablet), 1024px (desktop)

# Accessibility validation with axe-core
npm run test:run -- --testPathPattern=accessibility

# Visual regression validation (if Storybook available)
npm run storybook &
npm run chromatic    # Visual regression testing

# Navigation consistency validation
# Verify desktop sidebar matches mobile navigation items
# Confirm breadcrumb navigation works for all routes
# Test user dropdown menu accessibility with keyboard navigation

# Performance validation
npm run build
npm run preview &
# Use Lighthouse to validate performance scores

# User experience validation
# Test complete user journey: login → navigate → settings → logout
# Verify notification system badge counts and interactions
# Test mobile swipe navigation if implemented

# Expected: Perfect navigation consistency, accessible interactions, performance scores >90
```

## Final Validation Checklist

### Technical Validation

- [ ] All 4 validation levels completed successfully
- [ ] All tests pass: `npm run test:run`
- [ ] No linting errors: `npm run lint`
- [ ] Build successful: `npm run build`
- [ ] No console errors in development: `npm run dev`

### Feature Validation

- [ ] User can login/logout with session persistence
- [ ] Profile dropdown shows dynamic user data (name, email, avatar)
- [ ] Settings page loads with current user preferences
- [ ] Navigation items consistent between desktop sidebar and mobile menus
- [ ] Breadcrumb navigation displays correctly for all routes
- [ ] Notification dropdown shows badge counts and manages read state
- [ ] All hardcoded user data eliminated from Header, MobileNav, UserMenu
- [ ] Quick Actions buttons functional (Add Employee, Export Data)

### Code Quality Validation

- [ ] All components follow React.memo and displayName patterns
- [ ] HeadlessUI components implemented per documentation patterns
- [ ] User context follows performance optimization patterns
- [ ] File placement matches desired codebase tree structure
- [ ] Breadcrumbs use React Router v6 useMatches hook correctly
- [ ] Mobile navigation streamlined (eliminated duplicate systems)

### User Experience Validation

- [ ] Complete user journey works: login → navigate → settings → logout
- [ ] Mobile experience professional with single navigation system
- [ ] Keyboard navigation works for all dropdown menus
- [ ] Screen reader compatibility validated
- [ ] Loading states smooth and informative
- [ ] Error states handled gracefully with user feedback

---

## Anti-Patterns to Avoid

- ❌ Don't create new Tailwind color schemes - use existing primary colors
- ❌ Don't skip React.memo and displayName for new components
- ❌ Don't duplicate UserMenu functionality - integrate existing or replace
- ❌ Don't create navigation inconsistencies - ensure desktop/mobile parity
- ❌ Don't ignore HeadlessUI focus management - let it handle accessibility
- ❌ Don't hardcode user data anywhere - use UserContext exclusively
- ❌ Don't skip route handle configuration - breadcrumbs require proper setup

---

## Confidence Score: 9/10

**Rationale**: Comprehensive research conducted across codebase patterns, external documentation, and implementation examples. Three specialized documentation files created for complex integration patterns. All existing RIS PDM conventions analyzed and incorporated. Clear dependency ordering and validation strategy provided.

**One-Pass Implementation Likelihood**: Very High - Agent has complete context including specific file references, gotchas, performance patterns, and step-by-step implementation guidance.