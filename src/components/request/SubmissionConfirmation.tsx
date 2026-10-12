import { Link } from 'react-router-dom';
import { paths } from '@/routes/paths';

interface SubmissionConfirmationProps {
  requestNumber: string;
  onCreateAnother: () => void;
}

export function SubmissionConfirmation({
  requestNumber,
  onCreateAnother,
}: SubmissionConfirmationProps) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-medium text-emerald-700">Request submitted</p>
      <h1 className="mt-1 text-2xl font-semibold text-brand-900">Submission confirmed</h1>
      <p className="mt-3 text-sm leading-relaxed text-brand-600">
        Your request has been submitted and is now Pending. The assigned reviewer can act
        on it from the Action Inbox. Use the request number below to find it in My Requests.
      </p>
      <div className="mt-5 rounded-md border border-brand-100 bg-brand-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
          Request number
        </p>
        <p className="mt-1 font-mono text-lg font-semibold text-brand-900">{requestNumber}</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          onClick={onCreateAnother}
        >
          Create another request
        </button>
        <Link
          to={paths.requests}
          className="rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
        >
          Go to My Requests
        </Link>
      </div>
    </div>
  );
}
