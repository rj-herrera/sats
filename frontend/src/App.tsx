import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppRouter } from '@/routes/AppRouter';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/">
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
