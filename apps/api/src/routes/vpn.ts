import express from 'express';
import { auth } from '../auth.js';
import { vpnService } from '../services/vpn.service.js';
import { qbittorrentService } from '../services/qbittorrent.service.js';

export const vpnRouter = express.Router();

/**
 * Middleware to require authentication
 */
const requireAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    (req as any).user = session.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

/**
 * GET /api/v1/vpn/status
 * Get current VPN connection status
 */
vpnRouter.get('/status', requireAuth, async (req, res) => {
  try {
    // Check if Mullvad is installed
    const installed = await vpnService.isInstalled();
    if (!installed) {
      return res.json({
        installed: false,
        connected: false,
        message: 'Mullvad VPN not installed. Install with: sudo apt install mullvad-vpn',
      });
    }

    const status = await vpnService.getStatus();

    // Check if we're using Windows Mullvad from WSL2
    const isWindowsMullvad = status.interface === 'Mullvad';

    // Also get qBittorrent binding status
    const qbtInterface = await qbittorrentService.getNetworkInterface();
    const boundToVPN = qbtInterface === status.interface;

    // Test if traffic is protected (compare public IP with VPN IP)
    let trafficProtected = false;
    if (status.connected && isWindowsMullvad) {
      try {
        const testResult = await vpnService.testConnection();
        trafficProtected = testResult.isProtected;
      } catch (err) {
        console.error('[VPN] Failed to test connection:', err);
      }
    }

    return res.json({
      installed: true,
      ...status,
      isWindowsMullvad,
      bindingAvailable: !isWindowsMullvad,
      trafficProtected: isWindowsMullvad ? trafficProtected : boundToVPN,
      qbittorrent: {
        interface: qbtInterface || 'All interfaces (no binding)',
        boundToVPN,
        protectedViaWindowsVPN: isWindowsMullvad && trafficProtected,
      },
    });
  } catch (error: any) {
    console.error('[VPN API] Failed to get status:', error);
    return res.status(500).json({
      error: 'Failed to get VPN status',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/vpn/connect
 * Connect to Mullvad VPN
 */
vpnRouter.post('/connect', requireAuth, async (req, res) => {
  try {
    const installed = await vpnService.isInstalled();
    if (!installed) {
      return res.status(400).json({
        error: 'Mullvad VPN not installed',
        message: 'Install Mullvad VPN first: sudo apt install mullvad-vpn',
      });
    }

    await vpnService.connect();

    // Get the new status
    const status = await vpnService.getStatus();

    return res.json({
      success: true,
      message: 'Connected to VPN successfully',
      status,
    });
  } catch (error: any) {
    console.error('[VPN API] Failed to connect:', error);
    return res.status(500).json({
      error: 'Failed to connect to VPN',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/vpn/disconnect
 * Disconnect from Mullvad VPN
 */
vpnRouter.post('/disconnect', requireAuth, async (req, res) => {
  try {
    await vpnService.disconnect();

    return res.json({
      success: true,
      message: 'Disconnected from VPN successfully',
    });
  } catch (error: any) {
    console.error('[VPN API] Failed to disconnect:', error);
    return res.status(500).json({
      error: 'Failed to disconnect from VPN',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/vpn/bind-qbittorrent
 * Bind qBittorrent to VPN interface (auto-kill switch)
 */
vpnRouter.post('/bind-qbittorrent', requireAuth, async (req, res) => {
  try {
    // Check VPN status
    const status = await vpnService.getStatus();

    if (!status.connected) {
      return res.status(400).json({
        error: 'VPN not connected',
        message: 'Connect to VPN before binding qBittorrent',
      });
    }

    // Check if we're using Windows Mullvad from WSL2
    const isWindowsMullvad = status.interface === 'Mullvad';

    if (isWindowsMullvad) {
      // Test if traffic is protected
      const testResult = await vpnService.testConnection();

      return res.json({
        success: true,
        message: 'Traffic already protected via Windows Mullvad',
        bindingNotNeeded: true,
        trafficProtected: testResult.isProtected,
        explanation: 'qBittorrent in WSL2 automatically uses Windows VPN thanks to mirrored networking. Interface binding is not available, but your torrents are protected.',
      });
    }

    if (!status.interface) {
      return res.status(400).json({
        error: 'VPN interface not found',
        message: 'Could not detect VPN network interface',
      });
    }

    // Bind qBittorrent to VPN interface
    await qbittorrentService.bindToVPN(status.interface);

    return res.json({
      success: true,
      message: 'qBittorrent bound to VPN interface successfully',
      interface: status.interface,
    });
  } catch (error: any) {
    console.error('[VPN API] Failed to bind qBittorrent:', error);
    return res.status(500).json({
      error: 'Failed to bind qBittorrent to VPN',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/vpn/unbind-qbittorrent
 * Unbind qBittorrent from VPN interface
 */
vpnRouter.post('/unbind-qbittorrent', requireAuth, async (req, res) => {
  try {
    await qbittorrentService.unbindFromVPN();

    return res.json({
      success: true,
      message: 'qBittorrent unbound from VPN successfully',
    });
  } catch (error: any) {
    console.error('[VPN API] Failed to unbind qBittorrent:', error);
    return res.status(500).json({
      error: 'Failed to unbind qBittorrent from VPN',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/vpn/auto-bind
 * Auto-bind qBittorrent to VPN if connected
 */
vpnRouter.post('/auto-bind', requireAuth, async (req, res) => {
  try {
    const status = await vpnService.getStatus();

    if (status.connected && status.interface) {
      await qbittorrentService.bindToVPN(status.interface);
      return res.json({
        success: true,
        message: 'qBittorrent auto-bound to VPN successfully',
        interface: status.interface,
      });
    } else {
      return res.json({
        success: false,
        message: 'VPN not connected - qBittorrent not bound',
        vpnConnected: status.connected,
      });
    }
  } catch (error: any) {
    console.error('[VPN API] Failed to auto-bind:', error);
    return res.status(500).json({
      error: 'Failed to auto-bind qBittorrent',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/vpn/location
 * Set VPN server location
 */
vpnRouter.post('/location', requireAuth, async (req, res) => {
  try {
    const { country, city } = req.body;

    if (!country) {
      return res.status(400).json({
        error: 'Country is required',
      });
    }

    await vpnService.setLocation(country, city);

    return res.json({
      success: true,
      message: `VPN location set to ${country}${city ? ` - ${city}` : ''}`,
    });
  } catch (error: any) {
    console.error('[VPN API] Failed to set location:', error);
    return res.status(500).json({
      error: 'Failed to set VPN location',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/vpn/locations
 * Get available VPN server locations
 */
vpnRouter.get('/locations', requireAuth, async (req, res) => {
  try {
    const locations = await vpnService.getLocations();

    return res.json({
      locations,
    });
  } catch (error: any) {
    console.error('[VPN API] Failed to get locations:', error);
    return res.status(500).json({
      error: 'Failed to get VPN locations',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/vpn/test
 * Test VPN connection by checking public IP
 */
vpnRouter.get('/test', requireAuth, async (req, res) => {
  try {
    const status = await vpnService.getStatus();
    const testResult = await vpnService.testConnection();

    return res.json({
      vpnConnected: status.connected,
      vpnIP: status.ip,
      publicIP: testResult.publicIP,
      isProtected: testResult.isProtected,
      message: testResult.isProtected
        ? 'VPN is working - your traffic is protected'
        : 'VPN may not be working - check connection',
    });
  } catch (error: any) {
    console.error('[VPN API] Failed to test VPN:', error);
    return res.status(500).json({
      error: 'Failed to test VPN connection',
      message: error.message,
    });
  }
});
