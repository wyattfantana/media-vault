import path from 'path';
import { tmdbService, TMDBTVShowDetails, TMDBSeason } from './tmdb.service';

export interface ParsedTVShow {
  showName: string;
  season: number;
  episode: number;
  episodeTitle?: string;
  year?: number;
  quality?: string;
  releaseGroup?: string;
}

export interface ParsedMovie {
  title: string;
  year?: number;
  quality?: string;
  releaseGroup?: string;
}

export interface FormattedPath {
  contentType: 'tv' | 'movie' | 'music' | 'documentary' | 'other';
  originalName: string;
  formattedPath: string;
  folderStructure: {
    showName?: string;
    movieName?: string;
    year?: number;
    season?: number;
    episode?: number;
    episodeTitle?: string;
  };
  preview: string;
  baseDir: string; // e.g., "TV Shows" or "Movies"
}

export class JellyfinFormatterService {
  /**
   * Parse TV show filename to extract season/episode info
   * Supports formats: S01E01, 1x01, 101, Season 1 Episode 1
   */
  parseTVShowFilename(filename: string): ParsedTVShow | null {
    const cleanName = filename.replace(/\.(mkv|mp4|avi)$/i, '');

    // Pattern: S01E01 or s01e01
    const s01e01Pattern = /s(\d{1,2})e(\d{1,2})/i;
    const s01e01Match = cleanName.match(s01e01Pattern);
    if (s01e01Match) {
      const [, season, episode] = s01e01Match;
      const showName = cleanName.split(s01e01Pattern)[0].trim();
      const year = this.extractYear(cleanName);
      const quality = this.extractQuality(cleanName);
      const releaseGroup = this.extractReleaseGroup(cleanName);
      const episodeTitle = this.extractEpisodeTitle(cleanName);

      return {
        showName: this.cleanShowName(showName),
        season: parseInt(season, 10),
        episode: parseInt(episode, 10),
        episodeTitle,
        year,
        quality,
        releaseGroup
      };
    }

    // Pattern: 1x01
    const nxnPattern = /(\d{1,2})x(\d{1,2})/i;
    const nxnMatch = cleanName.match(nxnPattern);
    if (nxnMatch) {
      const [, season, episode] = nxnMatch;
      const showName = cleanName.split(nxnPattern)[0].trim();
      const year = this.extractYear(cleanName);

      return {
        showName: this.cleanShowName(showName),
        season: parseInt(season, 10),
        episode: parseInt(episode, 10),
        year
      };
    }

    // Pattern: 101, 102, etc. (first digit = season, last two = episode)
    const numericPattern = /[\s\.](\d)(\d{2})[\s\.]/;
    const numericMatch = cleanName.match(numericPattern);
    if (numericMatch) {
      const [, season, episode] = numericMatch;
      const showName = cleanName.split(numericPattern)[0].trim();
      const year = this.extractYear(cleanName);

      return {
        showName: this.cleanShowName(showName),
        season: parseInt(season, 10),
        episode: parseInt(episode, 10),
        year
      };
    }

    // Pattern: Season 1 Episode 1
    const seasonEpisodePattern = /season[\s\._-]*(\d{1,2})[\s\._-]*episode[\s\._-]*(\d{1,2})/i;
    const seasonEpisodeMatch = cleanName.match(seasonEpisodePattern);
    if (seasonEpisodeMatch) {
      const [, season, episode] = seasonEpisodeMatch;
      const showName = cleanName.split(seasonEpisodePattern)[0].trim();
      const year = this.extractYear(cleanName);

      return {
        showName: this.cleanShowName(showName),
        season: parseInt(season, 10),
        episode: parseInt(episode, 10),
        year
      };
    }

    return null;
  }

  /**
   * Parse movie filename
   */
  parseMovieFilename(filename: string): ParsedMovie | null {
    const cleanName = filename.replace(/\.(mkv|mp4|avi)$/i, '');

    const year = this.extractYear(cleanName);
    const quality = this.extractQuality(cleanName);
    const releaseGroup = this.extractReleaseGroup(cleanName);

    // Remove year, quality, and release group from title
    let title = cleanName
      .replace(/\(\d{4}\)/, '')
      .replace(/\d{4}/, '')
      .replace(/\d{3,4}p/i, '')
      .replace(/x26[45]/i, '')
      .replace(/\[.*?\]/g, '')
      .trim();

    title = this.cleanShowName(title);

    return {
      title,
      year,
      quality,
      releaseGroup
    };
  }

  /**
   * Extract year from filename
   */
  private extractYear(filename: string): number | undefined {
    const yearMatch = filename.match(/\((\d{4})\)|[\s\.](\d{4})[\s\.]/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1] || yearMatch[2], 10);
      if (year >= 1900 && year <= new Date().getFullYear() + 2) {
        return year;
      }
    }
    return undefined;
  }

  /**
   * Extract quality (1080p, 4K, etc.)
   */
  private extractQuality(filename: string): string | undefined {
    const qualityMatch = filename.match(/(\d{3,4}p|4K|2160p)/i);
    return qualityMatch ? qualityMatch[1] : undefined;
  }

  /**
   * Extract release group
   */
  private extractReleaseGroup(filename: string): string | undefined {
    const releaseMatch = filename.match(/[\[\(-]([A-Za-z0-9]+)[\]\)]?$/);
    return releaseMatch ? releaseMatch[1] : undefined;
  }

  /**
   * Extract episode title if present
   */
  private extractEpisodeTitle(filename: string): string | undefined {
    // Look for dash followed by title before quality/release info
    const titleMatch = filename.match(/s\d{1,2}e\d{1,2}\s*[-\s]+([^-\[\(]+)/i);
    if (titleMatch) {
      return this.cleanShowName(titleMatch[1]);
    }
    return undefined;
  }

  /**
   * Clean show/movie name
   */
  private cleanShowName(name: string): string {
    return name
      .replace(/[\._]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();
  }

  /**
   * Format TV show for Jellyfin
   * Format: Show Name (Year)/Season 01/Show Name - S01E01 - Episode Title.ext
   */
  async formatTVShow(
    filename: string,
    parsedInfo?: ParsedTVShow,
    searchTMDB: boolean = true
  ): Promise<FormattedPath> {
    const ext = path.extname(filename);
    const parsed = parsedInfo || this.parseTVShowFilename(filename);

    if (!parsed) {
      throw new Error('Could not parse TV show information from filename');
    }

    let { showName, season, episode, year, episodeTitle } = parsed;

    // Search TMDB for accurate metadata
    if (searchTMDB && tmdbService.isConfigured()) {
      try {
        const searchResults = await tmdbService.searchTVShows(showName);
        if (searchResults.results.length > 0) {
          const tvShow = searchResults.results[0];
          showName = tvShow.name;
          year = year || parseInt(tvShow.first_air_date?.substring(0, 4) || '', 10);

          // Get episode title from TMDB
          try {
            const seasonDetails = await tmdbService.getSeasonDetails(tvShow.id, season);
            const episodeData = seasonDetails.episodes.find(ep => ep.episode_number === episode);
            if (episodeData) {
              episodeTitle = episodeData.name;
            }
          } catch (err) {
            console.log(`Could not fetch episode details from TMDB: ${err}`);
          }
        }
      } catch (err) {
        console.log(`TMDB search failed, using parsed data: ${err}`);
      }
    }

    // Format the path components
    const showFolder = year ? `${showName} (${year})` : showName;
    const seasonFolder = `Season ${season.toString().padStart(2, '0')}`;
    const seasonEp = `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
    const episodeName = episodeTitle
      ? `${showName} - ${seasonEp} - ${episodeTitle}${ext}`
      : `${showName} - ${seasonEp}${ext}`;

    const formattedPath = path.join(showFolder, seasonFolder, episodeName);

    const preview = `📁 ${showFolder}\n   └─ 📁 ${seasonFolder}\n      └─ 📄 ${episodeName}`;

    return {
      contentType: 'tv',
      originalName: filename,
      formattedPath,
      folderStructure: {
        showName,
        year,
        season,
        episode,
        episodeTitle
      },
      preview,
      baseDir: 'TV Shows'
    };
  }

  /**
   * Format movie for Jellyfin
   * Format: Movie Name (Year)/Movie Name (Year).ext
   */
  async formatMovie(
    filename: string,
    parsedInfo?: ParsedMovie,
    searchTMDB: boolean = true
  ): Promise<FormattedPath> {
    const ext = path.extname(filename);
    const parsed = parsedInfo || this.parseMovieFilename(filename);

    if (!parsed) {
      throw new Error('Could not parse movie information from filename');
    }

    let { title, year } = parsed;

    // Search TMDB for accurate metadata
    if (searchTMDB && tmdbService.isConfigured()) {
      try {
        const searchResults = await tmdbService.searchMovies(title);
        if (searchResults.results.length > 0) {
          const movie = searchResults.results[0];
          title = movie.title;
          year = year || parseInt(movie.release_date?.substring(0, 4) || '', 10);
        }
      } catch (err) {
        console.log(`TMDB search failed, using parsed data: ${err}`);
      }
    }

    const movieFolder = year ? `${title} (${year})` : title;
    const movieFile = `${movieFolder}${ext}`;
    const formattedPath = path.join(movieFolder, movieFile);

    const preview = `📁 ${movieFolder}\n   └─ 📄 ${movieFile}`;

    return {
      contentType: 'movie',
      originalName: filename,
      formattedPath,
      folderStructure: {
        movieName: title,
        year
      },
      preview,
      baseDir: 'Movies'
    };
  }

  /**
   * Auto-detect content type and format accordingly
   */
  async autoFormat(filename: string, searchTMDB: boolean = true): Promise<FormattedPath> {
    // Try TV show first
    const tvParsed = this.parseTVShowFilename(filename);
    if (tvParsed) {
      return this.formatTVShow(filename, tvParsed, searchTMDB);
    }

    // Otherwise treat as movie
    return this.formatMovie(filename, undefined, searchTMDB);
  }

  /**
   * Detect if filename is a TV show
   */
  isTVShow(filename: string): boolean {
    return this.parseTVShowFilename(filename) !== null;
  }

  /**
   * Batch format multiple files
   */
  async batchFormat(filenames: string[], searchTMDB: boolean = true): Promise<FormattedPath[]> {
    const results: FormattedPath[] = [];

    for (const filename of filenames) {
      try {
        const formatted = await this.autoFormat(filename, searchTMDB);
        results.push(formatted);
      } catch (err) {
        console.error(`Failed to format ${filename}:`, err);
      }
    }

    return results;
  }
}

// Export singleton instance
export const jellyfinFormatter = new JellyfinFormatterService();
