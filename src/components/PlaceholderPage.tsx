import { PageScroll } from '@/layouts/PageScroll';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <PageScroll>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-brand-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-600">{description}</p>
        <div className="mt-8 rounded-lg border border-dashed border-brand-200 bg-white px-6 py-10 text-center">
          <p className="text-sm text-brand-500">
            Placeholder — functionality will be implemented in a later phase.
          </p>
        </div>
      </div>
    </PageScroll>
  );
}
