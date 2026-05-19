// Project Branding Configuration
export const brandingConfig = {
  project: {
    name: 'Performance Dashboard',
    fullName: 'RIS Performance Dashboard',
    description: 'Project Management Platform',
    abbreviation: 'RP'
  },
  
  logo: {
    src: '/logo.svg',
    favicon: '/favicon.svg',
    alt: 'RIS Performance Dashboard'
  },
  
  colors: {
    primary: '#3B82F6',
    secondary: '#1E40AF',
    accent: '#60A5FA'
  },
  
  // Organization info (similar to Azure DevOps project structure)
  organization: {
    name: 'RIS Organization',
    abbreviation: 'RIS'
  },
  
  // Display preferences
  display: {
    showFullNameInSidebar: false,
    showLogoInHeader: true,
    showDescriptionInSidebar: false
  }
};

// ✅ ENABLED PROJECTS - DaaS, OMNIA, Slick (PMP hidden temporarily — re-enable by uncommenting)
export const projectsConfig = [
  // {
  //   id: 'Product - Partner Management Platform',
  //   name: 'Product - Partner Management Platform',
  //   abbreviation: 'PP',
  //   description: 'Partner Management Platform',
  //   icon: '👥',
  //   color: '#059669',
  //   lastUpdate: '7/14/2025',
  //   process: 'Align',
  //   visibility: 'Private'
  // },
  {
    id: 'Product - Data as a Service',
    name: 'Product - Data as a Service',
    abbreviation: 'PD',
    description: 'Data as a Service Platform',
    icon: '📊', // Using icon instead of logo
    color: '#0891B2',
    lastUpdate: '4/3/2025',
    process: 'Align',
    visibility: 'Private'
  },
  {
    id: 'Product - OMNIA',
    name: 'Product - OMNIA',
    abbreviation: 'PO',
    description: 'OMNIA Order Management System',
    icon: '🛒', // Shopping cart for OMS
    color: '#7C3AED',
    lastUpdate: '1/12/2026',
    process: 'Align',
    visibility: 'Private'
  },
  {
    id: 'Product - Slick Picking Tool',
    name: 'Product - Slick Picking Tool',
    abbreviation: 'SL',
    description: 'Slick Picking Tool',
    icon: '📦', // Warehouse/picking
    color: '#F59E0B',
    lastUpdate: '5/15/2026',
    process: 'Align',
    visibility: 'Private'
  },
  {
    id: 'all-projects',
    name: 'All Projects',
    abbreviation: 'ALL',
    description: 'Combined view of all projects',
    icon: '🔄', // Using icon instead of logo
    color: '#6B7280',
    lastUpdate: 'Now',
    process: 'Mixed',
    visibility: 'Private'
  }
];

export default brandingConfig;