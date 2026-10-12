import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';
import { ActionInboxPage } from '@/pages/ActionInboxPage';
import { MyRequestsPage } from '@/pages/MyRequestsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { EditRequestPage } from '@/pages/EditRequestPage';
import { RequestDetailsPage } from '@/pages/RequestDetailsPage';
import { RequestFormPage } from '@/pages/RequestFormPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { TemplateEditorPage } from '@/pages/TemplateEditorPage';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { paths } from './paths';

export function AppRouter() {
  return (
    <Routes>
      {/* Legacy login URL — production uses token identity; redirect into the app */}
      <Route path={paths.login} element={<Navigate to={paths.requests} replace />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={paths.requests} replace />} />

        <Route
          path={paths.requestNew}
          element={
            <ProtectedRoute anyOf={['requests:create']}>
              <RequestFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={paths.requests}
          element={
            <ProtectedRoute anyOf={['requests:view_own']}>
              <MyRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/:id/review"
          element={
            <ProtectedRoute>
              <ReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/:id/edit"
          element={
            <ProtectedRoute anyOf={['requests:view_own']}>
              <EditRequestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/:id"
          element={
            <ProtectedRoute>
              <RequestDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={paths.inbox}
          element={
            <ProtectedRoute>
              <ActionInboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={paths.templates}
          element={
            <ProtectedRoute
              anyOf={['templates:manage_group', 'templates:manage_generic']}
            >
              <TemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={paths.templateNew}
          element={
            <ProtectedRoute
              anyOf={['templates:manage_group', 'templates:manage_generic']}
            >
              <TemplateEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates/:id/edit"
          element={
            <ProtectedRoute
              anyOf={['templates:manage_group', 'templates:manage_generic']}
            >
              <TemplateEditorPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<Navigate to={paths.requests} replace />} />
    </Routes>
  );
}
