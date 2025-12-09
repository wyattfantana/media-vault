# MediaVault Scripts

Utility scripts for MediaVault development and maintenance.

## Database Setup

### `setup-database.sh`
Automated PostgreSQL setup script for MediaVault.

**What it does:**
- Installs PostgreSQL if not already installed
- Creates `mediavault` database
- Creates `mediavault` user with password `mediavault123`
- Grants all necessary privileges

**Usage:**
```bash
./scripts/setup-database.sh
```

**Note:** Only needs to be run once during initial setup.

---

## Development Tools

### `fix_turbo.py`
Python utility to fix/regenerate the `turbo.json` configuration file.

**What it does:**
- Generates a fresh `turbo.json` with correct schema reference
- Sets up proper task configurations for build, dev, lint, clean

**Usage:**
```bash
python3 scripts/fix_turbo.py
```

**When to use:** If turbo.json gets corrupted or needs to be reset.

---

## Startup Script Location

The main startup script `start-mediavault.sh` lives in your home directory (`~/start-mediavault.sh`) for easy access from anywhere.

**Usage:**
```bash
~/start-mediavault.sh
```

This is intentional - keeping it in home allows you to start MediaVault from any directory.
