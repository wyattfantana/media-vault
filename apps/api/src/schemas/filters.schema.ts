import { z } from 'zod';

/**
 * Movie Filter Schema
 * Movies use single year (primary_release_year)
 */
export const MovieFilterSchema = z.object({
  genres: z.array(z.number()).optional(),
  excludeGenres: z.array(z.number()).optional(),
  year: z.number().min(1900).max(2100).optional(),
  minRating: z.number().min(0).max(10).default(0),
  minVotes: z.number().min(0).default(0),
  originCountries: z.array(z.string()).optional(),
  sortBy: z.enum([
    'popularity.desc',
    'popularity.asc',
    'vote_average.desc',
    'vote_average.asc',
    'release_date.desc',
    'release_date.asc',
    'vote_count.desc',
    'vote_count.asc'
  ]).default('popularity.desc'),
});

/**
 * TV Show Filter Schema
 * TV shows support year ranges (first_air_date.gte/lte)
 */
export const TVFilterSchema = z.object({
  genres: z.array(z.number()).optional(),
  excludeGenres: z.array(z.number()).optional(),
  yearFrom: z.number().min(1900).max(2100).optional(),
  yearTo: z.number().min(1900).max(2100).optional(),
  minRating: z.number().min(0).max(10).default(0),
  minVotes: z.number().min(0).default(0),
  originCountries: z.array(z.string()).optional(),
  sortBy: z.enum([
    'popularity.desc',
    'popularity.asc',
    'vote_average.desc',
    'vote_average.asc',
    'first_air_date.desc',
    'first_air_date.asc',
    'vote_count.desc',
    'vote_count.asc'
  ]).default('popularity.desc'),
});

/**
 * Documentary Filter Schema
 * Uses same rules as movies (single year)
 */
export const DocumentaryFilterSchema = z.object({
  genres: z.array(z.number()).optional(),
  excludeGenres: z.array(z.number()).optional(),
  year: z.number().min(1900).max(2100).optional(),
  minRating: z.number().min(0).max(10).default(0),
  minVotes: z.number().min(0).default(0),
  originCountries: z.array(z.string()).optional(),
  sortBy: z.enum([
    'popularity.desc',
    'popularity.asc',
    'vote_average.desc',
    'vote_average.asc',
    'release_date.desc',
    'release_date.asc',
    'vote_count.desc',
    'vote_count.asc'
  ]).default('popularity.desc'),
});

/**
 * Media Filter Schema (for downloaded media)
 */
export const MediaFilterSchema = z.object({
  type: z.enum(['movie', 'tv', 'music', 'documentary', 'other']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['created_at', 'title', 'duration', 'updated_at', 'file_size']).default('created_at'),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

/**
 * Helper function to get default min_votes based on sort type
 */
export function getDefaultMinVotes(sortBy: string, mediaType: 'movie' | 'tv' | 'documentary' = 'movie'): number {
  if (sortBy === 'vote_average.desc') return 1000;
  if (sortBy === 'vote_count.desc') return 500;
  return 100; // Reasonable minimum for quality
}

/**
 * Type exports
 */
export type MovieFilters = z.infer<typeof MovieFilterSchema>;
export type TVFilters = z.infer<typeof TVFilterSchema>;
export type DocumentaryFilters = z.infer<typeof DocumentaryFilterSchema>;
export type MediaFilters = z.infer<typeof MediaFilterSchema>;
