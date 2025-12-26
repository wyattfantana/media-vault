-- Migration 024: Remove OMDB API key and search history toggle from user preferences

ALTER TABLE user_preferences
DROP COLUMN IF EXISTS omdb_api_key,
DROP COLUMN IF EXISTS clear_search_history_on_exit;
