-- Migration 010: Add VPN preferences to user_preferences table
-- This migration adds VPN-related settings for torrent download protection

-- Add VPN preference columns
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS vpn_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_vpn_for_torrents BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS vpn_auto_connect BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vpn_auto_bind_qbittorrent BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS vpn_preferred_location VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vpn_kill_switch_enabled BOOLEAN DEFAULT true;

-- Set default values for existing users
UPDATE user_preferences
SET
  vpn_enabled = false,
  require_vpn_for_torrents = true,
  vpn_auto_connect = false,
  vpn_auto_bind_qbittorrent = true,
  vpn_kill_switch_enabled = true
WHERE
  vpn_enabled IS NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN user_preferences.vpn_enabled IS 'Enable VPN functionality for this user';
COMMENT ON COLUMN user_preferences.require_vpn_for_torrents IS 'Block torrent downloads if VPN is not connected';
COMMENT ON COLUMN user_preferences.vpn_auto_connect IS 'Automatically connect to VPN when downloading torrents';
COMMENT ON COLUMN user_preferences.vpn_auto_bind_qbittorrent IS 'Automatically bind qBittorrent to VPN interface when connected';
COMMENT ON COLUMN user_preferences.vpn_preferred_location IS 'Preferred VPN server location (e.g., "Sweden", "US New York")';
COMMENT ON COLUMN user_preferences.vpn_kill_switch_enabled IS 'Enable kill switch to stop torrents if VPN disconnects';
