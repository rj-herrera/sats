import type { ReviewerSnapshot, StepStatus } from '@/types';
import { getUserById } from '@/services/userRepository';
import { ProgressTimeline } from './ApprovalProgress';

interface ReviewerProgressProps {
  reviewers: ReviewerSnapshot[] | null;
}

function statusOf(reviewer: ReviewerSnapshot): StepStatus {
  return reviewer.status ?? 'Pending';
}

export function ReviewerProgress({ reviewers }: ReviewerProgressProps) {
  return (
    <ProgressTimeline
      title="Review progress"
      emptyMessage="Reviewer assignment data is missing for this request."
      items={(reviewers ?? []).map((reviewer) => ({
        key: reviewer.userId,
        name: reviewer.name,
        position: getUserById(reviewer.userId)?.designation?.trim() || 'Position unavailable',
        status: statusOf(reviewer),
        actionAt: reviewer.actionAt,
        comments: reviewer.comments,
      }))}
    />
  );
}
