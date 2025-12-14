# Filters System Architecture Analysis & Improvements

## Executive Summary

The MediaVault filters system has solid foundations but suffers from **critical security vulnerabilities**, **inconsistent filter behavior**, and **performance bottlenecks**. This document outlines actionable improvements.

---

## Critical Issues (Fix Immediately)

### 1. SQL Injection Vulnerability
**Location:** `apps/api/src/routes/media.ts:121`

```typescript
// CURRENT (VULNERABLE)
queryBuilder.orderBy(`m.${sortBy}`, sortOrder as 'ASC' | 'DESC')
```

**Fix:** Whitelist allowed columns
```typescript
const ALLOWED_SORT_COLUMNS = ['created_at', 'title', 'duration', 'updated_at'];
const safeSortBy = ALLOWED_SORT_COLUMNS.includes(sortBy) ? sortBy : 'created_at';
queryBuilder.orderBy(`m.${safeSortBy}`, sortOrder as 'ASC' | 'DESC');
```

### 2. Year Range Inconsistency
**Problem:** Frontend sends year ranges for movies, but TMDB API only accepts single year
- **Movies API:** Only `primary_release_year` (single year)
- **TV Shows API:** Supports `first_air_date.gte/lte` (range)
- **Frontend:** Sends both ranges regardless

**Fix:** Add platform-aware filter mapping
```typescript
// In tmdb.service.ts
if (type === 'movie' && filters.year_from) {
  params.primary_release_year = filters.year_from; // Use start year only
} else if (type === 'tv') {
  if (filters.year_from) params['first_air_date.gte'] = `${filters.year_from}-01-01`;
  if (filters.year_to) params['first_air_date.lte'] = `${filters.year_to}-12-31`;
}
```

### 3. Min Votes Default Inconsistency
**Current:** Movies apply defaults (1000/500), TV shows don't

**Fix:** Unify logic across both
```typescript
const getDefaultMinVotes = (sortBy: string, mediaType: 'movie' | 'tv'): number => {
  if (sortBy === 'vote_average.desc') return 1000;
  if (sortBy === 'vote_count.desc') return 500;
  return 100; // Reasonable minimum for quality
};
```

---

## High-Priority Improvements

### 4. Unified Filter Schema
**Problem:** Multiple filter objects, inconsistent null handling

**Solution:** Create typed filter schema with validation
```typescript
// filters.schema.ts
import { z } from 'zod';

export const MovieFilterSchema = z.object({
  genres: z.array(z.number()).optional(),
  excludeGenres: z.array(z.number()).optional(),
  year: z.number().min(1900).max(2100).optional(),
  minRating: z.number().min(0).max(10).default(0),
  minVotes: z.number().min(0).default(0),
  sortBy: z.enum(['popularity.desc', 'vote_average.desc', 'release_date.desc', 'vote_count.desc']).default('popularity.desc'),
});

export const TVFilterSchema = z.object({
  genres: z.array(z.number()).optional(),
  excludeGenres: z.array(z.number()).optional(),
  yearFrom: z.number().min(1900).max(2100).optional(),
  yearTo: z.number().min(1900).max(2100).optional(),
  minRating: z.number().min(0).max(10).default(0),
  minVotes: z.number().min(0).default(0),
  sortBy: z.enum(['popularity.desc', 'vote_average.desc', 'first_air_date.desc']).default('popularity.desc'),
});

export type MovieFilters = z.infer<typeof MovieFilterSchema>;
export type TVFilters = z.infer<typeof TVFilterSchema>;
```

**Benefits:**
- Runtime validation
- Consistent defaults
- Type safety
- Self-documenting

### 5. Filter Builder Pattern
**Problem:** Manual URL string concatenation in frontend

**Solution:** Backend filter builder
```typescript
// filter-builder.ts
class TMDBFilterBuilder {
  private params: Record<string, string> = {};

  constructor(private mediaType: 'movie' | 'tv') {}

  withGenres(genreIds: number[]): this {
    if (genreIds.length > 0) {
      this.params.with_genres = genreIds.join(',');
    }
    return this;
  }

  withoutGenres(genreIds: number[]): this {
    if (genreIds.length > 0) {
      this.params.without_genres = genreIds.join(',');
    }
    return this;
  }

  withRating(min: number, minVotes?: number): this {
    if (min > 0) {
      this.params['vote_average.gte'] = min.toString();
      this.params['vote_count.gte'] = (minVotes || 100).toString();
    }
    return this;
  }

  withYear(year: number | { from?: number; to?: number }): this {
    if (typeof year === 'number') {
      if (this.mediaType === 'movie') {
        this.params.primary_release_year = year.toString();
      } else {
        this.params['first_air_date.gte'] = `${year}-01-01`;
        this.params['first_air_date.lte'] = `${year}-12-31`;
      }
    } else {
      // Range only for TV shows
      if (this.mediaType === 'tv') {
        if (year.from) this.params['first_air_date.gte'] = `${year.from}-01-01`;
        if (year.to) this.params['first_air_date.lte'] = `${year.to}-12-31`;
      }
    }
    return this;
  }

  sortBy(sort: string): this {
    this.params.sort_by = sort;
    return this;
  }

  build(): Record<string, string> {
    return { ...this.params };
  }
}

// Usage
const filters = new TMDBFilterBuilder('movie')
  .withGenres([28, 12])
  .withRating(7.0, 1000)
  .withYear(2024)
  .sortBy('vote_average.desc')
  .build();
```

### 6. Server-Side Genre Sorting
**Problem:** Client-side sorting breaks pagination

**Current (Movies.tsx:456-479):**
```typescript
const allMovies = [...genreMovies, ...results];
if (filters.sortBy === 'vote_average.desc') {
  allMovies.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
}
```

**Fix:** Let TMDB API handle sorting
```typescript
// In genre fetch
const url = `${API_BASE}/tmdb/discover/movies?with_genres=${genreId}&sort_by=${filters.sortBy}`;
// Remove client-side sorting completely
```

---

## Performance Optimizations

### 7. Request Batching for Genres
**Problem:** 5-6 separate API calls on Movies page load

**Solution:** Single batch endpoint
```typescript
// New route: GET /tmdb/genres/batch
router.get('/genres/batch', async (req, res) => {
  const { genre_ids, media_type, filters } = req.query;
  const genreIdArray = genre_ids.split(',').map(Number);

  const results = await Promise.all(
    genreIdArray.map(id =>
      tmdbService.discoverMovies({
        ...filters,
        genre: id,
        page: 1
      })
    )
  );

  res.json(results);
});
```

### 8. Backend Caching Layer
**Add Redis/in-memory cache for popular filters**

```typescript
// cache.service.ts
import NodeCache from 'node-cache';

class FilterCacheService {
  private cache = new NodeCache({ stdTTL: 600 }); // 10 min TTL

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get<T>(key);
    if (cached) return cached;

    const result = await fetcher();
    this.cache.set(key, result);
    return result;
  }

  buildKey(prefix: string, filters: object): string {
    return `${prefix}:${JSON.stringify(filters)}`;
  }
}

// Usage in tmdb.service.ts
const cacheKey = filterCache.buildKey('discover_movies', filters);
return filterCache.getOrFetch(cacheKey, () =>
  this.callTMDBApi('/discover/movie', params)
);
```

### 9. Database Indexing
**Add indexes for common filter queries**

```sql
-- migrations/011_add_filter_indexes.sql
CREATE INDEX idx_media_user_type ON media(user_id, media_type);
CREATE INDEX idx_media_user_created ON media(user_id, created_at DESC);
CREATE INDEX idx_media_title_search ON media USING gin(to_tsvector('english', title));
CREATE INDEX idx_downloads_user_status ON downloads(user_id, status);
CREATE INDEX idx_downloads_created ON downloads(created_at DESC);
```

### 10. Filter Debouncing
**Problem:** Every filter change triggers full reload

**Solution:** Debounce filter updates
```typescript
// In Movies.tsx
import { useDebouncedCallback } from 'use-debounce';

const debouncedLoadMovies = useDebouncedCallback(
  (filters) => {
    loadManyPages(1, 10, filters);
  },
  500 // Wait 500ms after last change
);

// In filter change handler
const handleFilterChange = (newFilters) => {
  setAllMoviesFilters(newFilters);
  debouncedLoadMovies(newFilters);
};
```

---

## Architecture Improvements

### 11. Separate Filter State Management
**Create dedicated filter hooks**

```typescript
// hooks/useMovieFilters.ts
import { useCallback, useState } from 'react';
import { MovieFilters, MovieFilterSchema } from '../schemas/filters.schema';

export function useMovieFilters(initialFilters?: Partial<MovieFilters>) {
  const [filters, setFilters] = useState<MovieFilters>(() =>
    MovieFilterSchema.parse(initialFilters || {})
  );

  const updateFilter = useCallback(<K extends keyof MovieFilters>(
    key: K,
    value: MovieFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(MovieFilterSchema.parse({}));
  }, []);

  const hasActiveFilters = useCallback(() => {
    return filters.minRating > 0 ||
           filters.genres?.length > 0 ||
           filters.year !== undefined;
  }, [filters]);

  return { filters, updateFilter, resetFilters, hasActiveFilters };
}
```

### 12. Filter Preset System
**Allow users to save filter combinations**

```sql
-- migrations/012_filter_presets.sql
CREATE TABLE filter_presets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  media_type VARCHAR(50) NOT NULL,
  filters JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

```typescript
// API endpoint
router.post('/filter-presets', async (req, res) => {
  const { name, media_type, filters } = req.body;
  const preset = await db.query(
    'INSERT INTO filter_presets (user_id, name, media_type, filters) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.userId, name, media_type, filters]
  );
  res.json(preset.rows[0]);
});
```

---

## Testing Strategy

### 13. Filter Unit Tests
```typescript
// __tests__/filters.test.ts
describe('TMDBFilterBuilder', () => {
  it('should handle movie year as single value', () => {
    const builder = new TMDBFilterBuilder('movie');
    const params = builder.withYear(2024).build();
    expect(params.primary_release_year).toBe('2024');
    expect(params['first_air_date.gte']).toBeUndefined();
  });

  it('should handle TV year ranges', () => {
    const builder = new TMDBFilterBuilder('tv');
    const params = builder.withYear({ from: 2020, to: 2024 }).build();
    expect(params['first_air_date.gte']).toBe('2020-01-01');
    expect(params['first_air_date.lte']).toBe('2024-12-31');
  });

  it('should only apply rating filter when > 0', () => {
    const builder = new TMDBFilterBuilder('movie');
    const params = builder.withRating(0).build();
    expect(params['vote_average.gte']).toBeUndefined();
  });
});
```

---

## Implementation Priority

### Phase 1: Security & Correctness (1-2 days)
1. Fix SQL injection (sortBy whitelist)
2. Add filter validation schema (Zod)
3. Fix year range handling
4. Standardize min_votes defaults

### Phase 2: Architecture (3-4 days)
5. Implement FilterBuilder pattern
6. Create useMovieFilters/useTVFilters hooks
7. Move genre sorting server-side
8. Add unit tests

### Phase 3: Performance (2-3 days)
9. Add database indexes
10. Implement request debouncing
11. Add batch genre endpoint
12. Implement caching layer

### Phase 4: Features (2-3 days)
13. Filter preset system
14. Advanced filters (cast, keywords, runtime)
15. Filter history/recent searches

---

## Metrics for Success

**Before:**
- 6 sequential API calls on Movies page load
- No input validation
- SQL injection vulnerability
- Inconsistent filter behavior

**After:**
- 1 batched API call (or cached)
- Runtime validation with Zod
- No security vulnerabilities
- Consistent, predictable filtering
- 50%+ reduction in API calls via caching
- User-saveable filter presets

---

## Additional Recommendations

1. **Advanced Filters:** Add runtime range, cast search, keyword filtering
2. **Filter Analytics:** Track popular filter combinations for cache optimization
3. **Filter URL State:** Sync filters to URL for shareable links
4. **Mobile Optimization:** Collapsible filter panel for mobile
5. **A/B Testing:** Test different default filter values for engagement

---

## Conclusion

The filters system needs immediate security fixes but has a solid foundation for powerful improvements. By implementing typed schemas, builder patterns, and caching, you'll achieve:

- **Reliability:** Consistent behavior across platforms
- **Performance:** 50-70% reduction in API calls
- **Security:** No injection vulnerabilities
- **Power:** Composable, testable filter logic
- **UX:** Faster, more responsive filtering

Estimated total implementation: **8-12 days** for all phases.
