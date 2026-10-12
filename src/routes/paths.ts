/** Centralized route path constants */
export const paths = {
  login: '/login',
  requests: '/requests',
  requestNew: '/requests/new',
  requestDetails: (id: string) => `/requests/${id}` as const,
  requestEdit: (id: string) => `/requests/${id}/edit` as const,
  requestReview: (id: string) => `/requests/${id}/review` as const,
  inbox: '/inbox',
  templates: '/templates',
  templateNew: '/templates/new',
  templateEdit: (id: string) => `/templates/${id}/edit` as const,
} as const;

export type AppPath =
  | typeof paths.login
  | typeof paths.requests
  | typeof paths.requestNew
  | typeof paths.inbox
  | typeof paths.templates
  | typeof paths.templateNew
  | `/requests/${string}`
  | `/requests/${string}/edit`
  | `/requests/${string}/review`
  | `/templates/${string}/edit`;
