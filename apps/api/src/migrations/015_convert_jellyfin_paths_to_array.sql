-- Migration 015: Convert jellyfin_library_paths from object to array format
-- This allows users to add unlimited custom library paths

-- Convert existing object structure to array of {name, path} objects
UPDATE user_preferences
SET jellyfin_library_paths = (
  SELECT jsonb_agg(
    jsonb_build_object('name', item.key, 'path', item.value)
    ORDER BY
      CASE item.key
        WHEN 'movies' THEN 1
        WHEN 'tv' THEN 2
        WHEN 'music' THEN 3
        WHEN 'documentaries' THEN 4
        WHEN 'iplayer' THEN 5
        ELSE 6
      END
  )
  FROM jsonb_each_text(jellyfin_library_paths) AS item
)
WHERE jsonb_typeof(jellyfin_library_paths) = 'object';

-- Update default to array format
ALTER TABLE user_preferences
ALTER COLUMN jellyfin_library_paths
SET DEFAULT '[
  {"name": "Movies", "path": "/media/Movies"},
  {"name": "TV Shows", "path": "/media/TV Shows"},
  {"name": "Music", "path": "/media/Music"},
  {"name": "Documentaries", "path": "/media/Documentaries"},
  {"name": "iPlayer", "path": "/media/iPlayer"}
]'::jsonb;
