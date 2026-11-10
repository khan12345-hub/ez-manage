/** Ready-made Space templates (Template Center → "Use Templates" on Create Space). */
type Cat = 'NOT_STARTED' | 'ACTIVE' | 'DONE';
export interface SpaceTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  color: string;
  icon: string;
  statuses: { name: string; color: string; category: Cat }[];
  folders: { name: string; lists: string[] }[];
  lists: string[];
}

const S = (name: string, color: string, category: Cat) => ({ name, color, category });

export const SPACE_TEMPLATES: SpaceTemplate[] = [
  {
    id: 'agency',
    name: 'Agency Management',
    category: 'Marketing',
    description: 'Run client work end to end: leads, onboarding, delivery and retainers.',
    color: '#7C3AED',
    icon: 'briefcase',
    statuses: [S('Backlog', '#9CA3AF', 'NOT_STARTED'), S('In progress', '#2563EB', 'ACTIVE'), S('Client review', '#D97706', 'ACTIVE'), S('Complete', '#16A34A', 'DONE')],
    folders: [{ name: 'Clients', lists: ['Onboarding', 'Active projects', 'Retainers'] }],
    lists: ['Leads', 'Internal'],
  },
  {
    id: 'marketing',
    name: 'Marketing Team Operations',
    category: 'Marketing',
    description: 'Campaigns, content and requests in one place.',
    color: '#DB2777',
    icon: 'megaphone',
    statuses: [S('To do', '#9CA3AF', 'NOT_STARTED'), S('In progress', '#2563EB', 'ACTIVE'), S('In review', '#B08D57', 'ACTIVE'), S('Approved', '#0D9488', 'ACTIVE'), S('Complete', '#16A34A', 'DONE')],
    folders: [
      { name: 'Campaigns', lists: ['Planning', 'Launches'] },
      { name: 'Content', lists: ['Blog', 'Social media'] },
    ],
    lists: ['Requests'],
  },
  {
    id: 'seo',
    name: 'SEO Project Management',
    category: 'Marketing',
    description: 'Keyword research, on-page work, links and monthly reporting.',
    color: '#16A34A',
    icon: 'search',
    statuses: [S('To do', '#9CA3AF', 'NOT_STARTED'), S('In progress', '#2563EB', 'ACTIVE'), S('Needs review', '#D97706', 'ACTIVE'), S('Complete', '#16A34A', 'DONE')],
    folders: [],
    lists: ['Keyword research', 'On-page', 'Link building', 'Reporting'],
  },
  {
    id: 'social',
    name: 'Social Media Marketing',
    category: 'Marketing',
    description: 'Plan, create, approve and publish posts.',
    color: '#EA580C',
    icon: 'share',
    statuses: [S('Idea', '#9CA3AF', 'NOT_STARTED'), S('Drafting', '#2563EB', 'ACTIVE'), S('Scheduled', '#7C3AED', 'ACTIVE'), S('Published', '#16A34A', 'DONE')],
    folders: [],
    lists: ['Content calendar', 'Ideas', 'Published'],
  },
  {
    id: 'product',
    name: 'Product Management',
    category: 'Product',
    description: 'Roadmap, backlog and sprints for a product team.',
    color: '#2563EB',
    icon: 'rocket',
    statuses: [S('Backlog', '#9CA3AF', 'NOT_STARTED'), S('Scoping', '#B08D57', 'ACTIVE'), S('In development', '#2563EB', 'ACTIVE'), S('Testing', '#D97706', 'ACTIVE'), S('Shipped', '#16A34A', 'DONE')],
    folders: [{ name: 'Sprints', lists: ['Sprint 1', 'Sprint 2'] }],
    lists: ['Roadmap', 'Backlog'],
  },
  {
    id: 'software',
    name: 'Software Development',
    category: 'Engineering',
    description: 'Bugs, features and releases with code review and QA.',
    color: '#0891B2',
    icon: 'code',
    statuses: [S('Open', '#9CA3AF', 'NOT_STARTED'), S('In progress', '#2563EB', 'ACTIVE'), S('Code review', '#7C3AED', 'ACTIVE'), S('QA', '#D97706', 'ACTIVE'), S('Done', '#16A34A', 'DONE')],
    folders: [],
    lists: ['Bugs', 'Features', 'Releases'],
  },
  {
    id: 'operations',
    name: 'Operations',
    category: 'Operations',
    description: 'Recurring operations, requests and SOPs.',
    color: '#475569',
    icon: 'settings',
    statuses: [S('To do', '#9CA3AF', 'NOT_STARTED'), S('In progress', '#2563EB', 'ACTIVE'), S('Complete', '#16A34A', 'DONE')],
    folders: [],
    lists: ['Requests', 'Recurring', 'SOPs'],
  },
  {
    id: 'hr',
    name: 'HR & Recruiting',
    category: 'People',
    description: 'Hiring pipeline, onboarding and people ops.',
    color: '#B08D57',
    icon: 'users',
    statuses: [S('Applied', '#9CA3AF', 'NOT_STARTED'), S('Interviewing', '#2563EB', 'ACTIVE'), S('Offer', '#7C3AED', 'ACTIVE'), S('Hired', '#16A34A', 'DONE')],
    folders: [],
    lists: ['Candidates', 'Onboarding', 'Policies'],
  },
];
