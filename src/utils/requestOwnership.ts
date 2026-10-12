import type { SubmittedRequest, User } from '@/types';

export function isRequestOwner(
  user: User | null | undefined,
  request: SubmittedRequest | null | undefined,
): boolean {
  if (!user || !request) return false;
  return user.id === request.requesterId;
}

export function canRequesterEditResubmit(
  user: User | null | undefined,
  request: SubmittedRequest | null | undefined,
): boolean {
  return isRequestOwner(user, request) && request?.status === 'Returned';
}

export function canRequesterCancel(
  user: User | null | undefined,
  request: SubmittedRequest | null | undefined,
): boolean {
  if (!isRequestOwner(user, request) || !request) return false;
  return request.status === 'Pending' || request.status === 'Returned';
}
