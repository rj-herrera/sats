import { describe, expect, it } from 'vitest';
import {
  canCancelFrom,
  canRecordDecision,
  canResubmitFrom,
  explainInvalidTransition,
  isTerminalRequestStatus,
} from '@/utils/requestTransitions';

describe('requestTransitions', () => {
  it('treats Approved, Rejected, Cancelled as terminal', () => {
    expect(isTerminalRequestStatus('Approved')).toBe(true);
    expect(isTerminalRequestStatus('Rejected')).toBe(true);
    expect(isTerminalRequestStatus('Cancelled')).toBe(true);
    expect(isTerminalRequestStatus('Pending')).toBe(false);
    expect(isTerminalRequestStatus('Returned')).toBe(false);
  });

  it('allows decisions only from Pending', () => {
    expect(canRecordDecision('Pending')).toBe(true);
    expect(canRecordDecision('Returned')).toBe(false);
    expect(canRecordDecision('Approved')).toBe(false);
  });

  it('allows resubmit only from Returned', () => {
    expect(canResubmitFrom('Returned')).toBe(true);
    expect(canResubmitFrom('Pending')).toBe(false);
    expect(canResubmitFrom('Rejected')).toBe(false);
  });

  it('allows cancel from Pending or Returned', () => {
    expect(canCancelFrom('Pending')).toBe(true);
    expect(canCancelFrom('Returned')).toBe(true);
    expect(canCancelFrom('Approved')).toBe(false);
  });

  it('validates key transitions', () => {
    expect(explainInvalidTransition('Pending', 'Approved')).toBeNull();
    expect(explainInvalidTransition('Returned', 'Pending')).toBeNull();
    expect(explainInvalidTransition('Pending', 'Cancelled')).toBeNull();
    expect(explainInvalidTransition('Approved', 'Pending')).toMatch(/Cannot/);
    expect(explainInvalidTransition('Rejected', 'Cancelled')).toMatch(/Cannot/);
  });
});
