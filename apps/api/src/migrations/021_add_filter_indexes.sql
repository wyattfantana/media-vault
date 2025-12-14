-- Migration 021: Add indexes for filter queries
-- Improves performance for common filter operations

-- Media table indexes for user queries
CREATE INDEX IF NOT EXISTS idx_media_user_type ON media(user_id, media_type);
CREATE INDEX IF NOT EXISTS idx_media_user_created ON media(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_user_tmdb ON media(user_id, tmdb_id) WHERE tmdb_id IS NOT NULL;

-- Full-text search index for media titles
CREATE INDEX IF NOT EXISTS idx_media_title_search ON media USING gin(to_tsvector('english', title));

-- Downloads table indexes for status filtering
CREATE INDEX IF NOT EXISTS idx_downloads_user_status ON downloads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_downloads_user_created ON downloads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_downloads_user_tmdb ON downloads(user_id, tmdb_id) WHERE tmdb_id IS NOT NULL;

-- Bookmarks table indexes
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_type ON bookmarks(user_id, type);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);

-- Verify indexes were created
DO $$
BEGIN
    RAISE NOTICE 'Filter indexes created successfully';
END $$;
