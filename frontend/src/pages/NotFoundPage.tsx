import { Link } from 'react-router-dom';
import { PageScroll } from '@/layouts/PageScroll';
import { paths } from '@/routes/paths';

export function NotFoundPage() {
  return (
    <PageScroll>
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-semibold text-brand-900">Page not found</h1>
        <p className="mt-2 text-sm text-brand-600">
          The page you requested does not exist.
        </p>
        <Link
          to={paths.requests}
          className="mt-6 inline-block rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          Go to My Requests
        </Link>
      </div>
    </PageScroll>
  );
}
