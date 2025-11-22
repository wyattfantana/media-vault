import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Discover } from './pages/Discover';
import { Downloads } from './pages/Downloads';
import { Media } from './pages/Media';
import { Favorites } from './pages/Favorites';
import { Settings } from './pages/Settings';
import { YouTube } from './pages/YouTube';
import { SoundCloud } from './pages/SoundCloud';
import { Rumble } from './pages/Rumble';
import { TikTok } from './pages/TikTok';
import { Twitch } from './pages/Twitch';
import { Reddit } from './pages/Reddit';
import { Vimeo } from './pages/Vimeo';
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
            <Route path="discover" element={<Discover />} />
            <Route path="downloads" element={<Downloads />} />
            <Route path="media" element={<Media />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="youtube" element={<YouTube />} />
            <Route path="soundcloud" element={<SoundCloud />} />
            <Route path="rumble" element={<Rumble />} />
            <Route path="tiktok" element={<TikTok />} />
            <Route path="twitch" element={<Twitch />} />
            <Route path="reddit" element={<Reddit />} />
            <Route path="vimeo" element={<Vimeo />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
