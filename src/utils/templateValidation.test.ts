import { beforeEach, describe, expect, it } from 'vitest';
import { MOCK_GROUPS } from '@/data/mockUsers';
import { validateTemplateDraft, validateTemplateForActivation } from '@/utils/templateValidation';
import type { FormTemplate } from '@/types';

beforeEach(() => {
  localStorage.setItem('sats.mock.groups', JSON.stringify(MOCK_GROUPS));
});

function baseTemplate(
  overrides: Partial<FormTemplate> = {},
): Pick<
  FormTemplate,
  | 'name'
  | 'description'
  | 'scope'
  | 'owningGroupId'
  | 'allowedGroupIds'
  | 'fields'
  | 'workflow'
> {
  return {
    name: 'Sample',
    description: 'A sample template',
    scope: 'group',
    owningGroupId: 'grp-analysis',
    allowedGroupIds: ['grp-analysis'],
    fields: [
      {
        id: 'f1',
        label: 'Title',
        type: 'text',
        required: true,
      },
    ],
    workflow: {
      type: 'review_checking',
    },
    ...overrides,
  };
}

describe('templateValidation', () => {
  it('requires a name even for drafts', () => {
    const result = validateTemplateDraft(baseTemplate({ name: '  ' }));
    expect(result.valid).toBe(false);
  });

  it('blocks activation without fields', () => {
    const result = validateTemplateForActivation(baseTemplate({ fields: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /field/i.test(e))).toBe(true);
  });

  it('accepts a valid group template for activation', () => {
    const result = validateTemplateForActivation(baseTemplate());
    expect(result.valid).toBe(true);
  });
});
