/**
 * TMDB Filter Builder
 * Provides a fluent interface for building TMDB API query parameters
 * with platform-specific handling (movies vs TV shows)
 */
export class TMDBFilterBuilder {
  private params: Record<string, string> = {};

  constructor(private mediaType: 'movie' | 'tv') {}

  /**
   * Add genre filter (AND logic - must include all genres)
   */
  withGenres(genreIds: number[]): this {
    if (genreIds.length > 0) {
      this.params.with_genres = genreIds.join(',');
    }
    return this;
  }

  /**
   * Exclude genres (AND logic - must not include any of these genres)
   */
  withoutGenres(genreIds: number[]): this {
    if (genreIds.length > 0) {
      this.params.without_genres = genreIds.join(',');
    }
    return this;
  }

  /**
   * Add rating filter with minimum vote count
   */
  withRating(min: number, minVotes?: number): this {
    if (min > 0) {
      this.params['vote_average.gte'] = min.toString();
      this.params['vote_count.gte'] = (minVotes || 100).toString();
    }
    return this;
  }

  /**
   * Add year filter
   * - Movies: Single year (primary_release_year)
   * - TV: Year range (first_air_date.gte/lte)
   */
  withYear(year: number | { from?: number; to?: number }): this {
    if (typeof year === 'number') {
      if (this.mediaType === 'movie') {
        this.params.primary_release_year = year.toString();
      } else {
        // For TV, single year becomes a range for that year
        this.params['first_air_date.gte'] = `${year}-01-01`;
        this.params['first_air_date.lte'] = `${year}-12-31`;
      }
    } else {
      // Range only supported for TV shows
      if (this.mediaType === 'tv') {
        if (year.from) {
          this.params['first_air_date.gte'] = `${year.from}-01-01`;
        }
        if (year.to) {
          this.params['first_air_date.lte'] = `${year.to}-12-31`;
        }
      } else if (this.mediaType === 'movie' && year.from) {
        // For movies, use only the "from" year
        this.params.primary_release_year = year.from.toString();
      }
    }
    return this;
  }

  /**
   * Add sort parameter
   */
  sortBy(sort: string): this {
    this.params.sort_by = sort;
    return this;
  }

  /**
   * Add pagination
   */
  withPage(page: number): this {
    if (page > 0) {
      this.params.page = page.toString();
    }
    return this;
  }

  /**
   * Add minimum vote count filter
   */
  withMinVotes(minVotes: number): this {
    if (minVotes > 0) {
      this.params['vote_count.gte'] = minVotes.toString();
    }
    return this;
  }

  /**
   * Add language filter
   */
  withLanguage(language: string): this {
    this.params.with_original_language = language;
    return this;
  }

  /**
   * Build and return the query parameters
   */
  build(): Record<string, string> {
    return { ...this.params };
  }

  /**
   * Convert to URL query string
   */
  toQueryString(): string {
    return new URLSearchParams(this.params).toString();
  }

  /**
   * Reset all filters
   */
  reset(): this {
    this.params = {};
    return this;
  }
}

/**
 * Factory function for creating filter builders
 */
export function createFilterBuilder(mediaType: 'movie' | 'tv'): TMDBFilterBuilder {
  return new TMDBFilterBuilder(mediaType);
}
