import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ErrorState } from '@/components/feedback/states';
import { NotFoundPage } from './not-found-page';

/** Router error boundary: catches render/loader errors so users never see a blank screen. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  if (import.meta.env.DEV) console.error(error);
  return (
    <ErrorState
      fullPage
      title="Something went wrong"
      message="An unexpected error occurred. Reload the page to try again."
      onRetry={() => { window.location.reload(); }}
    />
  );
}
