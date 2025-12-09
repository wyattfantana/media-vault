#!/bin/bash
# MediaVault Database Setup Script

echo "🗄️  Setting up PostgreSQL for MediaVault..."
echo ""

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Start PostgreSQL service
echo "🚀 Starting PostgreSQL service..."
sudo service postgresql start

# Wait a moment for service to start
sleep 2

# Create database and user
echo "🔧 Creating database and user..."
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE mediavault;

-- Create user (if doesn't exist)
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'mediavault') THEN
    CREATE USER mediavault WITH PASSWORD 'mediavault123';
  END IF;
END
\$\$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE mediavault TO mediavault;

-- Connect to database and grant schema privileges
\c mediavault
GRANT ALL ON SCHEMA public TO mediavault;

EOF

echo ""
echo "✅ PostgreSQL setup complete!"
echo ""
echo "Database: mediavault"
echo "User: mediavault"
echo "Password: mediavault123"
echo "Host: localhost"
echo "Port: 5432"
echo ""
