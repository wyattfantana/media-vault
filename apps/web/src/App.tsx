import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Downloads } from './pages/Downloads';
import { Browse } from './pages/Browse';
import { Media } from './pages/Media';
import { Clients } from './pages/Clients';
import { Estimates } from './pages/Estimates';
import { Invoices } from './pages/Invoices';
import { Products } from './pages/Products';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { SignUp } from './pages/auth/SignUp';
import { SignIn } from './pages/auth/SignIn';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/sign-up/*" element={<SignUp />} />
          <Route path="/sign-in/*" element={<SignIn />} />

          {/* Admin Routes (Separate Auth System) */}
          <Route path="/system/control" element={<AdminLogin />} />
          <Route path="/system/dashboard" element={<AdminDashboard />} />

          {/* Protected User Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="downloads" element={<Downloads />} />
            <Route path="browse" element={<Browse />} />
            <Route path="media" element={<Media />} />
            <Route path="clients" element={<Clients />} />
            <Route path="estimates" element={<Estimates />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="products" element={<Products />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
