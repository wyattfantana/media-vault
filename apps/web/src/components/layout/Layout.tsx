import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';

interface VPNStatus {
  connected: boolean;
  server?: string;
}

export function Layout() {
  const [vpnStatus, setVpnStatus] = useState<VPNStatus | null>(null);
  const [vpnLoading, setVpnLoading] = useState(false);

  useEffect(() => {
    fetchVPNStatus();
    // Poll VPN status every 30 seconds
    const interval = setInterval(fetchVPNStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchVPNStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/vpn/status', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setVpnStatus(data);
      }
    } catch (err) {
      // Silently fail - VPN status is optional
    }
  };

  const toggleVPN = async () => {
    if (vpnLoading || !vpnStatus) return;

    const wasConnected = vpnStatus.connected;
    setVpnLoading(true);

    // Optimistic update - immediately show expected state
    setVpnStatus({
      ...vpnStatus,
      connected: !wasConnected
    });

    try {
      const endpoint = wasConnected ? 'disconnect' : 'connect';
      const res = await fetch(`http://localhost:3001/api/v1/vpn/${endpoint}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (res.ok) {
        // Poll for actual status quickly, then return to normal polling
        let attempts = 0;
        const quickPoll = setInterval(async () => {
          await fetchVPNStatus();
          attempts++;

          // Stop quick polling after 10 attempts (5 seconds) or when state matches expected
          if (attempts >= 10 || vpnStatus?.connected !== wasConnected) {
            clearInterval(quickPoll);
            setVpnLoading(false);
          }
        }, 500);
      } else {
        // Revert optimistic update on failure
        setVpnStatus({
          ...vpnStatus,
          connected: wasConnected
        });
        setVpnLoading(false);
      }
    } catch (err) {
      console.error('Failed to toggle VPN:', err);
      // Revert optimistic update on error
      setVpnStatus({
        ...vpnStatus,
        connected: wasConnected
      });
      setVpnLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-x-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900/95 backdrop-blur-sm border-r border-gray-800 fixed h-screen overflow-y-auto flex-shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">MediaVault</h1>
          <p className="text-sm text-gray-400">Your Personal Media Hub</p>
        </div>

        <nav className="px-4 space-y-1 pb-8">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </NavLink>

          <NavLink
            to="/discover"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Discover
          </NavLink>

          <NavLink
            to="/favorites"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            Favorites
          </NavLink>

          <NavLink
            to="/downloads"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Downloads
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </NavLink>

          {/* VPN Status Toggle */}
          {vpnStatus && (
            <div className="mt-6 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${vpnStatus.connected ? 'bg-green-500' : 'bg-red-500'} ${vpnLoading ? 'animate-pulse' : ''}`} />
                  <span className="text-xs font-medium text-gray-300">
                    VPN
                  </span>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={toggleVPN}
                  disabled={vpnLoading}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                    vpnStatus.connected ? 'bg-green-600' : 'bg-gray-600'
                  }`}
                  title={vpnLoading ? 'Switching...' : (vpnStatus.connected ? 'Disconnect VPN' : 'Connect VPN')}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      vpnStatus.connected ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Server info or loading state */}
              {vpnLoading ? (
                <p className="text-xs text-gray-400 mt-1">
                  {vpnStatus.connected ? 'Connecting...' : 'Disconnecting...'}
                </p>
              ) : (
                vpnStatus.connected && vpnStatus.server && (
                  <p className="text-xs text-gray-400 mt-1 truncate" title={vpnStatus.server}>
                    {vpnStatus.server}
                  </p>
                )
              )}
            </div>
          )}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
