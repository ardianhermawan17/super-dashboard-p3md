import type { RouteTourConfig } from '../types';

export const ROUTE_TOURS: RouteTourConfig[] = [
  {
    routePrefix: '/dashboard/overview',
    featureName: 'Overview & Briefing',
    icon: 'dashboard',
    summary: 'Executive dashboard featuring daily AI briefings, real-time KPI metrics, and team activity.',
    steps: [
      {
        id: 'overview-digest',
        title: 'Daily AI Morning Briefing',
        badge: 'Executive AI',
        description:
          'Every morning at 06:00 WIB, an executive AI briefing aggregates the last 24h of team activities, today’s calendar agenda, and overdue tasks into an actionable summary.',
        actionHint: 'Expand or collapse the briefing card using the top right controls.',
      },
      {
        id: 'overview-kpi',
        title: 'Real-Time Financial & Task KPIs',
        badge: 'Financial Health',
        description:
          'Monitor overall revenue, active expenditure, team task completion rates, and active operational events at a single glance.',
      },
      {
        id: 'overview-charts',
        title: 'Activity & Cashflow Charts',
        badge: 'Visual Analytics',
        description:
          'Interactive bar charts and category breakdowns provide transparent insights into department spend and sprint velocity.',
      },
      {
        id: 'overview-shortcuts',
        title: 'Quick Navigation',
        badge: 'Productivity',
        description:
          'Use the top search bar (or press ⌘K / Ctrl+K) and sidebar links to jump directly into boards, calendar, or financial ledgers.',
      },
    ],
  },
  {
    routePrefix: '/dashboard/finance',
    featureName: 'Finance Ledger & Budget',
    icon: 'billing',
    summary: 'Centralized transaction ledger with category breakdowns, cashflow tracking, and board tagging.',
    steps: [
      {
        id: 'finance-stats',
        title: 'Cashflow Overview',
        badge: 'KPI Cards',
        description:
          'View your net cashflow, total income (inflow), and total spending (outflow) in Indonesian Rupiah (IDR) with percentage trends.',
      },
      {
        id: 'finance-add-entry',
        title: 'Recording Income & Expenses',
        badge: 'Transaction CRUD',
        description:
          'Click "+ Add Entry" to record financial transactions. You can categorize entries, assign specific dates, and optionally link them to a project board or task.',
        actionHint: 'Entries can also be created directly from task cards or event boards!',
      },
      {
        id: 'finance-table',
        title: 'Searchable Transaction Ledger',
        badge: 'Audit & Records',
        description:
          'Filter transactions by category, type (income/expense), date range, or keywords. Edit or delete existing records with immediate balance recalculation.',
      },
      {
        id: 'finance-ai',
        title: 'AI Financial Insights',
        badge: 'AI Assistant',
        description:
          'Authorized roles can ask the in-app AI Assistant questions like "Summarize recent operational expenses" or "What was our net cashflow this month?".',
      },
    ],
  },
  {
    routePrefix: '/dashboard/kanban',
    featureName: 'Kanban Tasks & Boards',
    icon: 'kanban',
    summary: 'Visual agile project management with drag-and-drop workflow and integrated event/finance tracking.',
    steps: [
      {
        id: 'kanban-board-select',
        title: 'Multi-Board Project Workspace',
        badge: 'Project Boards',
        description:
          'Switch between different project boards and event-linked boards using the board selector tabs at the top.',
      },
      {
        id: 'kanban-columns-drag',
        title: 'Workflow Columns & Drag-and-Drop',
        badge: 'Task Workflow',
        description:
          'Organize work across custom columns (e.g. Backlog, Ready, In Progress, Review, Blocked, Done). Drag cards effortlessly to update task status in real time.',
      },
      {
        id: 'kanban-task-details',
        title: 'Task Details & Linked Event / Finance',
        badge: 'Integrated Context',
        description:
          'Click on any task card to open the Task Detail Dialog. Here you can edit task attributes, view linked Google Calendar events, and inspect task-scoped finance entries.',
      },
      {
        id: 'kanban-members',
        title: 'Board Collaboration & RBAC',
        badge: 'Permissions',
        description:
          'Assign task owners, set priority badges, and collaborate securely with team members and permission groups.',
      },
    ],
  },
  {
    routePrefix: '/dashboard/boards',
    featureName: 'Kanban Tasks & Boards',
    icon: 'kanban',
    summary: 'Visual agile project management with drag-and-drop workflow and integrated event/finance tracking.',
    steps: [
      {
        id: 'boards-select',
        title: 'Multi-Board Workspace',
        badge: 'Project Boards',
        description:
          'Switch between different project boards and event-linked boards using the board selector at the top.',
      },
      {
        id: 'boards-drag',
        title: 'Drag-and-Drop Task Flow',
        badge: 'Task Management',
        description:
          'Move task cards across workflow columns to update statuses instantly.',
      },
      {
        id: 'boards-task-modal',
        title: 'Task Details Panel',
        badge: 'Contextual Details',
        description:
          'Click any task card to edit attributes, link calendar events, and view task-scoped finance entries.',
      },
    ],
  },
  {
    routePrefix: '/dashboard/calendar',
    featureName: 'Calendar & Operational Agenda',
    icon: 'calendar',
    summary: 'Google Calendar 2-way synchronization with event-driven board creation and scheduling.',
    steps: [
      {
        id: 'calendar-sync',
        title: 'Google Calendar 2-Way Sync',
        badge: 'Live Sync',
        description:
          'Your operational schedule stays automatically in sync with your organization Google Calendar account in real time.',
      },
      {
        id: 'calendar-agenda',
        title: 'Interactive Agenda & Event Scheduling',
        badge: 'Scheduling',
        description:
          'Create meetings, deadlines, and multi-day operational milestones with reminders, locations, and attendee groups.',
      },
      {
        id: 'calendar-streamline',
        title: 'Event → Board Streamline',
        badge: 'Streamline',
        description:
          'Easily spin up a dedicated Kanban board directly from any calendar event with one click, linking tasks and budget to the event.',
      },
    ],
  },
  {
    routePrefix: '/dashboard/ai-chat',
    featureName: 'In-App AI Assistant',
    icon: 'sparkles',
    summary: 'Enterprise AI assistant grounded in real-time project, calendar, activity, and finance data.',
    steps: [
      {
        id: 'ai-chat-grounding',
        title: 'Grounded Live Answers',
        badge: 'No Hallucinations',
        description:
          'The AI assistant queries live database tools (boards, agenda, recent activity, finance summaries) before responding, ensuring reliable, factual answers.',
      },
      {
        id: 'ai-chat-starters',
        title: 'Suggested Prompts & Starters',
        badge: 'Fast Insights',
        description:
          'Click prompt suggestions like "What happened this week across our boards?" or "Show today\'s agenda" for instant briefings.',
      },
      {
        id: 'ai-chat-tools',
        title: 'Transparent Tool Execution',
        badge: 'Tool Auditing',
        description:
          'Watch the assistant invoke read-only tools in real time. Expand tool result cards to inspect the underlying data query.',
      },
      {
        id: 'ai-chat-models',
        title: 'Multi-Provider Inference',
        badge: 'Cost Efficient',
        description:
          'Supports flexible LLM backends including DeepSeek, Claude, Hermes, and OpenRouter for high-speed, cost-effective reasoning.',
      },
    ],
  },
  {
    routePrefix: '/dashboard/documents',
    featureName: 'Documents & Google Drive',
    icon: 'folder',
    summary: 'Secure document management synchronized with Google Drive folders and scoped by RBAC permissions.',
    steps: [
      {
        id: 'documents-drive',
        title: 'Google Drive Document Sync',
        badge: 'Cloud Storage',
        description:
          'Access organization documents, contracts, templates, and reports synchronized directly from linked Google Drive roots.',
      },
      {
        id: 'documents-rbac',
        title: 'Role-Based Access Protection',
        badge: 'Security',
        description:
          'Document visibility is strictly filtered by your user roles and permission groups to prevent unauthorized exposure.',
      },
    ],
  },
  {
    routePrefix: '/dashboard/talent',
    featureName: 'Talent & Candidate Search',
    icon: 'userPen',
    summary: 'Candidate pipeline management, CV intake with privacy consent, and skill taxonomy ranking.',
    steps: [
      {
        id: 'talent-pipeline',
        title: 'Candidate Pipeline Board',
        badge: 'Recruiting',
        description:
          'Track applicants across stages from Initial Intake, Screened, Technical Review, to Hired.',
      },
      {
        id: 'talent-consent',
        title: 'Privacy Consent & CV Upload',
        badge: 'Data Protection',
        description:
          'Upload candidate CVs to private storage with explicit consent tracking. Files are processed securely with zero public exposure.',
      },
      {
        id: 'talent-skills',
        title: 'AI Skill Taxonomy & Ranking',
        badge: 'Skill Matching',
        description:
          'Automated skill extraction normalizes aliases and scores candidates against required job criteria.',
      },
    ],
  },
  {
    routePrefix: '/dashboard/admin',
    featureName: 'RBAC & Access Control',
    icon: 'shield',
    summary: 'Manage users, permission groups, customized roles, and module-level permission matrices.',
    steps: [
      {
        id: 'admin-users',
        title: 'User Management & Invites',
        badge: 'Directory & Auth',
        description:
          'View all team members, direct and inherited roles, and last sign-in. Invite new colleagues via email and assign their initial roles and groups.',
      },
      {
        id: 'admin-groups',
        title: 'Permission Groups',
        badge: 'Group Scoping',
        description:
          'Create collaborative groups (e.g. Operations, Finance, Management). Assigning roles to a group automatically propagates permissions to all members.',
      },
      {
        id: 'admin-roles',
        title: 'Role-Permission Matrix',
        badge: 'Security Matrix',
        description:
          'Customize roles and toggle permissions across Kanban, Calendar, Finance, Talent, and Agent modules. Built-in escalation guards prevent grant abuse.',
      },
      {
        id: 'admin-permissions',
        title: 'Permissions Catalogue',
        badge: 'Catalogue & Audit',
        description:
          'Inspect the system catalogue of all 17 granular permissions, their module ownership, and which active roles hold each capability.',
      },
    ],
  },
  {
    routePrefix: '/dashboard/settings',
    featureName: 'Settings & Connected Apps',
    icon: 'settings',
    summary: 'Manage user profiles, theme customization, Supabase OAuth 2.1 apps, and MCP integrations.',
    steps: [
      {
        id: 'settings-connected-apps',
        title: 'Connected Apps & OAuth 2.1',
        badge: 'Integrations',
        description:
          'Authorize external MCP clients (Claude Desktop, Cursor, Hermes Agent) and manage third-party OAuth access securely.',
      },
      {
        id: 'settings-revocation',
        title: 'Instant Access Revocation',
        badge: 'Security',
        description:
          'Revoke any third-party app with one click to immediately invalidate tokens across the network.',
      },
    ],
  },
];

export const DEFAULT_TOUR: RouteTourConfig = {
  routePrefix: '/dashboard',
  featureName: 'Dashboard Navigation',
  icon: 'dashboard',
  summary: 'Quick guide to getting around the P3MD executive dashboard.',
  steps: [
    {
      id: 'default-sidebar',
      title: 'Sidebar Navigation',
      badge: 'Main Menu',
      description:
        'Access all dashboard modules including Overview, Kanban Boards, Calendar, Finance, and AI Assistant from the left sidebar.',
    },
    {
      id: 'default-help',
      title: 'Contextual Feature Tour',
      badge: 'Help Anywhere',
      description:
        'Whenever you navigate to a new page, click the "?" icon in the top header to take an interactive tour explaining that specific feature!',
    },
    {
      id: 'default-notifications',
      title: 'Notifications & Alerts',
      badge: 'Real-Time Alerts',
      description:
        'Receive immediate notifications for daily digest briefings, calendar reminders, and task updates in the top right notification bell.',
    },
  ],
};

export function getTourForRoute(pathname: string): RouteTourConfig {
  const match = ROUTE_TOURS.find((t) => pathname.startsWith(t.routePrefix));
  return match ?? DEFAULT_TOUR;
}
