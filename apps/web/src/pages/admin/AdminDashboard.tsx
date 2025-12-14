import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '@/lib/config';

interface SystemStats {
  totalClients: number;
  totalUsers: number;
  timestamp: string;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('${API_URL}/system/control/stats', {
        credentials: 'include',
      });

      if (response.status === 403 || response.status === 401) {
        // Not authenticated, redirect to login
        navigate('/system/control');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('${API_URL}/system/control/logout', {
        method: 'POST',
        credentials: 'include',
      });
      navigate('/system/control');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
            <button
              onClick={handleLogout}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-gray-800 p-6 shadow">
            <h3 className="text-sm font-medium text-gray-400">Total Users</h3>
            <p className="mt-2 text-3xl font-bold text-white">{stats?.totalUsers || 0}</p>
          </div>

          <div className="rounded-lg bg-gray-800 p-6 shadow">
            <h3 className="text-sm font-medium text-gray-400">Total Clients</h3>
            <p className="mt-2 text-3xl font-bold text-white">{stats?.totalClients || 0}</p>
          </div>

          <div className="rounded-lg bg-gray-800 p-6 shadow">
            <h3 className="text-sm font-medium text-gray-400">Last Updated</h3>
            <p className="mt-2 text-sm text-gray-300">
              {stats?.timestamp ? new Date(stats.timestamp).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-yellow-900/20 border border-yellow-600 p-4">
          <p className="text-sm text-yellow-200">
            ⚠️ Admin Panel - All actions are logged and monitored
          </p>
        </div>
      </main>
    </div>
  );
}
