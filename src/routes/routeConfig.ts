import type { Permission } from '@/types';
import { paths } from './paths';

export interface RouteMeta {
  path: string;
  title: string;
  /** If set, user must have at least one of these permissions */
  permissions?: Permission[];
  /** Public routes skip auth */
  public?: boolean;
}

/**
 * Central route metadata used by guards and the header title.
 * Pattern routes use React Router path syntax.
 */
export const routeMeta: RouteMeta[] = [
  { path: paths.requestNew, title: 'New Request', permissions: ['requests:create'] },
  { path: paths.requests, title: 'My Requests', permissions: ['requests:view_own'] },
  {
    path: '/requests/:id/review',
    title: 'Review / Approval',
    permissions: ['requests:approve', 'inbox:access'],
  },
  {
    path: '/requests/:id/edit',
    title: 'Edit & Resubmit',
    permissions: ['requests:view_own'],
  },
  {
    path: '/requests/:id',
    title: 'Request Details',
    permissions: ['requests:view_own', 'requests:view_assigned'],
  },
  {
    path: paths.inbox,
    title: 'Action Inbox',
    // Page-level canAccessActionInbox (assignment-aware); not role-only.
  },
  {
    path: paths.templates,
    title: 'Template Management',
    permissions: ['templates:manage_group', 'templates:manage_generic'],
  },
  {
    path: paths.templateNew,
    title: 'New Template',
    permissions: ['templates:manage_group', 'templates:manage_generic'],
  },
  {
    path: '/templates/:id/edit',
    title: 'Edit Template',
    permissions: ['templates:manage_group', 'templates:manage_generic'],
  },
];

export function getPageTitle(pathname: string): string {
  const exact = routeMeta.find((r) => r.path === pathname);
  if (exact) return exact.title;

  if (/^\/requests\/[^/]+\/review$/.test(pathname)) return 'Review / Approval';
  if (/^\/requests\/[^/]+\/edit$/.test(pathname)) return 'Edit & Resubmit';
  if (/^\/requests\/[^/]+$/.test(pathname) && pathname !== paths.requestNew) {
    return 'Request Details';
  }
  if (/^\/templates\/[^/]+\/edit$/.test(pathname)) return 'Edit Template';

  return 'SATS';
}
