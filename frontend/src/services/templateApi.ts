import { apiGet, apiPost, apiPut, messageFromApi } from '@/services/apiClient';
import type { ApiResult } from '@/services/requestApi';
import type { FormTemplate, TemplateStatus } from '@/types';

export interface TemplateWriteBody {
  name: string;
  description: string;
  scope: FormTemplate['scope'];
  owningGroupId: string | null;
  allowedGroupIds: string[];
  fields: FormTemplate['fields'];
  workflow: FormTemplate['workflow'];
  status: TemplateStatus;
  version?: number;
}

function parseTemplate(value: unknown): FormTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || row.id === '') return null;
  if (typeof row.name !== 'string') return null;
  if (row.scope !== 'generic' && row.scope !== 'group') return null;
  if (row.status !== 'Active' && row.status !== 'Inactive') return null;
  if (typeof row.version !== 'number' || row.version < 1) return null;
  return value as FormTemplate;
}

function parseTemplateList(body: unknown): FormTemplate[] | null {
  if (!Array.isArray(body)) return null;
  const templates: FormTemplate[] = [];
  for (const item of body) {
    const template = parseTemplate(item);
    if (!template) return null;
    templates.push(template);
  }
  return templates;
}

async function templateList(path: string, fallback: string): Promise<ApiResult<FormTemplate[]>> {
  const response = await apiGet(path);
  if (response.status !== 200) {
    return { ok: false, error: messageFromApi(response.status, response.body, fallback) };
  }
  const templates = parseTemplateList(response.body);
  if (!templates) return { ok: false, error: fallback };
  return { ok: true, data: templates };
}

export function listAvailableTemplates(): Promise<ApiResult<FormTemplate[]>> {
  return templateList('/templates?view=available', 'Templates could not be loaded.');
}

export function listManageableTemplates(): Promise<ApiResult<FormTemplate[]>> {
  return templateList('/templates?view=manageable', 'Templates could not be loaded.');
}

export async function getTemplate(id: string): Promise<ApiResult<FormTemplate | null>> {
  if (!/^\d+$/.test(id)) return { ok: true, data: null };
  const response = await apiGet(`/templates/${id}`);
  if (response.status === 404) return { ok: true, data: null };
  if (response.status !== 200) {
    return { ok: false, error: messageFromApi(response.status, response.body, 'The template could not be loaded.') };
  }
  const template = parseTemplate(response.body);
  if (!template) return { ok: false, error: 'The template could not be loaded.' };
  return { ok: true, data: template };
}

async function writeTemplate(
  send: () => Promise<{ status: number; body: unknown }>,
  fallback: string,
): Promise<ApiResult<FormTemplate>> {
  const response = await send();
  if (response.status !== 200 && response.status !== 201) {
    return { ok: false, error: messageFromApi(response.status, response.body, fallback) };
  }
  const template = parseTemplate(response.body);
  if (!template) return { ok: false, error: fallback };
  return { ok: true, data: template };
}

export function createTemplateRecord(body: TemplateWriteBody): Promise<ApiResult<FormTemplate>> {
  return writeTemplate(() => apiPost('/templates', body), 'The template could not be saved.');
}

export function updateTemplateRecord(
  id: string,
  body: TemplateWriteBody & { version: number },
): Promise<ApiResult<FormTemplate>> {
  return writeTemplate(() => apiPut(`/templates/${id}`, body), 'The template could not be saved.');
}

export function setTemplateStatusRecord(
  template: FormTemplate,
  status: TemplateStatus,
): Promise<ApiResult<FormTemplate>> {
  return updateTemplateRecord(template.id, {
    name: template.name,
    description: template.description,
    scope: template.scope,
    owningGroupId: template.owningGroupId,
    allowedGroupIds: template.allowedGroupIds,
    fields: template.fields,
    workflow: template.workflow,
    status,
    version: template.version,
  });
}
