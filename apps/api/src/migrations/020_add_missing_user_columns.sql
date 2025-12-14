-- Migration: Add missing Better Auth user columns
-- These columns are required by Better Auth but were missing from initial migration

-- Add twoFactorEnabled column
ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN DEFAULT false;

-- Add banReason column
ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "banReason" TEXT;

-- Add banExpires column
ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "banExpires" TIMESTAMP;

-- Verify columns exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user' AND column_name = 'twoFactorEnabled') THEN
        RAISE EXCEPTION 'Failed to add twoFactorEnabled column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user' AND column_name = 'banReason') THEN
        RAISE EXCEPTION 'Failed to add banReason column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user' AND column_name = 'banExpires') THEN
        RAISE EXCEPTION 'Failed to add banExpires column';
    END IF;

    RAISE NOTICE 'All missing user columns added successfully';
END $$;
