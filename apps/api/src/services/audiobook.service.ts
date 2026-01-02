import axios from 'axios';

const OPEN_LIBRARY_BASE = 'https://openlibrary.org';
const OPEN_LIBRARY_COVERS = 'https://covers.openlibrary.org';

// Cache for subject work counts to avoid repeated API calls
const subjectCountCache: Map<string, { count: number; timestamp: number }> = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface AudiobookResult {
  id: string;
  title: string;
  authors: string[];
  authorKeys: string[];
  coverUrl: string | null;
  year: number | null;
  subjects: string[];
  description?: string;
  workKey: string;
  editionCount: number;
}

export interface AudiobookDetails extends AudiobookResult {
  description: string;
  publishers: string[];
  isbn: string[];
  pageCount?: number;
  firstSentence?: string;
}

export interface SubjectResult {
  name: string;
  workCount: number;
  books: AudiobookResult[];
  page: number;
  totalPages: number;
}

// Popular audiobook subjects/genres
export const AUDIOBOOK_GENRES = [
  { id: 'fiction', name: 'Fiction', emoji: '📚' },
  { id: 'science_fiction', name: 'Science Fiction', emoji: '🚀' },
  { id: 'fantasy', name: 'Fantasy', emoji: '🧙' },
  { id: 'mystery', name: 'Mystery', emoji: '🔍' },
  { id: 'thriller', name: 'Thriller', emoji: '😱' },
  { id: 'romance', name: 'Romance', emoji: '💕' },
  { id: 'horror', name: 'Horror', emoji: '👻' },
  { id: 'biography', name: 'Biography', emoji: '👤' },
  { id: 'history', name: 'History', emoji: '📜' },
  { id: 'self-help', name: 'Self-Help', emoji: '🌟' },
  { id: 'business', name: 'Business', emoji: '💼' },
  { id: 'true_crime', name: 'True Crime', emoji: '🔪' },
  { id: 'humor', name: 'Humor', emoji: '😂' },
  { id: 'young_adult', name: 'Young Adult', emoji: '🎒' },
  { id: 'classics', name: 'Classics', emoji: '📖' },
];

export class AudiobookService {
  /**
   * Search for books by query
   */
  async search(query: string, page: number = 1, limit: number = 20): Promise<{
    results: AudiobookResult[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const offset = (page - 1) * limit;
      const response = await axios.get(`${OPEN_LIBRARY_BASE}/search.json`, {
        params: {
          q: query,
          limit,
          offset,
          fields: 'key,title,author_name,author_key,cover_i,first_publish_year,subject,edition_count',
        },
        timeout: 10000,
      });

      const results: AudiobookResult[] = response.data.docs
        .filter((doc: any) => doc.cover_i) // Only include books with covers
        .map((doc: any) => ({
          id: doc.key?.replace('/works/', '') || '',
          title: doc.title || 'Unknown Title',
          authors: doc.author_name || [],
          authorKeys: doc.author_key || [],
          coverUrl: `${OPEN_LIBRARY_COVERS}/b/id/${doc.cover_i}-M.jpg`,
          year: doc.first_publish_year || null,
          subjects: (doc.subject || []).slice(0, 5),
          workKey: doc.key || '',
          editionCount: doc.edition_count || 1,
        }));

      return {
        results,
        total: response.data.numFound || 0,
        page,
        totalPages: Math.ceil((response.data.numFound || 0) / limit),
      };
    } catch (error) {
      console.error('[Audiobook] Search error:', error);
      throw new Error('Failed to search audiobooks');
    }
  }

  /**
   * Get books by subject/genre with proper pagination
   */
  async getBySubject(subject: string, page: number = 1, limit: number = 20): Promise<SubjectResult> {
    try {
      const offset = (page - 1) * limit;
      const response = await axios.get(`${OPEN_LIBRARY_BASE}/subjects/${subject}.json`, {
        params: {
          limit,
          offset,
        },
        timeout: 15000,
      });

      const workCount = response.data.work_count || 0;
      const totalPages = Math.ceil(workCount / limit);

      const books: AudiobookResult[] = (response.data.works || [])
        .filter((work: any) => work.cover_id) // Only include books with covers
        .map((work: any) => ({
          id: work.key?.replace('/works/', '') || '',
          title: work.title || 'Unknown Title',
          authors: work.authors?.map((a: any) => a.name) || [],
          authorKeys: work.authors?.map((a: any) => a.key?.replace('/authors/', '')) || [],
          coverUrl: `${OPEN_LIBRARY_COVERS}/b/id/${work.cover_id}-M.jpg`,
          year: work.first_publish_year || null,
          subjects: (work.subject || []).slice(0, 5),
          workKey: work.key || '',
          editionCount: work.edition_count || 1,
        }));

      // Cache the work count for this subject
      subjectCountCache.set(subject, { count: workCount, timestamp: Date.now() });

      return {
        name: response.data.name || subject,
        workCount,
        books,
        page,
        totalPages,
      };
    } catch (error) {
      console.error('[Audiobook] Get by subject error:', error);
      throw new Error('Failed to get books by subject');
    }
  }

  /**
   * Get cached work count for a subject (for display purposes)
   */
  getCachedWorkCount(subject: string): number | null {
    const cached = subjectCountCache.get(subject);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.count;
    }
    return null;
  }

  /**
   * Get trending/popular books (uses popular subjects)
   */
  async getTrending(limit: number = 20): Promise<AudiobookResult[]> {
    try {
      // Get books from popular fiction
      const response = await axios.get(`${OPEN_LIBRARY_BASE}/trending/daily.json`, {
        params: { limit },
        timeout: 10000,
      });

      if (response.data.works) {
        return response.data.works
          .filter((work: any) => work.cover_i || work.cover_id) // Only include books with covers
          .map((work: any) => ({
            id: work.key?.replace('/works/', '') || '',
            title: work.title || 'Unknown Title',
            authors: work.author_name || [],
            authorKeys: work.author_key || [],
            coverUrl: work.cover_i
              ? `${OPEN_LIBRARY_COVERS}/b/id/${work.cover_i}-M.jpg`
              : `${OPEN_LIBRARY_COVERS}/b/id/${work.cover_id}-M.jpg`,
            year: work.first_publish_year || null,
            subjects: [],
            workKey: work.key || '',
            editionCount: work.edition_count || 1,
          }));
      }

      // Fallback to fiction if trending doesn't work
      const fiction = await this.getBySubject('fiction', 1, limit);
      return fiction.books;
    } catch (error) {
      console.error('[Audiobook] Get trending error:', error);
      // Fallback to fiction
      try {
        const fiction = await this.getBySubject('fiction', 1, limit);
        return fiction.books;
      } catch {
        return [];
      }
    }
  }

  /**
   * Get book details by work ID
   */
  async getDetails(workId: string): Promise<AudiobookDetails | null> {
    try {
      const response = await axios.get(`${OPEN_LIBRARY_BASE}/works/${workId}.json`, {
        timeout: 10000,
      });

      const data = response.data;

      // Get description
      let description = '';
      if (typeof data.description === 'string') {
        description = data.description;
      } else if (data.description?.value) {
        description = data.description.value;
      }

      // Get author names
      const authorNames: string[] = [];
      const authorKeys: string[] = [];
      if (data.authors) {
        for (const author of data.authors) {
          const authorKey = author.author?.key?.replace('/authors/', '');
          if (authorKey) {
            authorKeys.push(authorKey);
            try {
              const authorRes = await axios.get(`${OPEN_LIBRARY_BASE}/authors/${authorKey}.json`, {
                timeout: 5000,
              });
              authorNames.push(authorRes.data.name);
            } catch {
              // Skip if author fetch fails
            }
          }
        }
      }

      // Get cover
      let coverUrl = null;
      if (data.covers && data.covers.length > 0) {
        coverUrl = `${OPEN_LIBRARY_COVERS}/b/id/${data.covers[0]}-M.jpg`;
      }

      return {
        id: workId,
        title: data.title || 'Unknown Title',
        authors: authorNames,
        authorKeys,
        coverUrl,
        year: data.first_publish_date ? parseInt(data.first_publish_date) : null,
        subjects: (data.subjects || []).slice(0, 10),
        description,
        workKey: `/works/${workId}`,
        editionCount: 1,
        publishers: [],
        isbn: [],
        firstSentence: data.first_sentence?.value,
      };
    } catch (error) {
      console.error('[Audiobook] Get details error:', error);
      return null;
    }
  }

  /**
   * Get available genres
   */
  getGenres() {
    return AUDIOBOOK_GENRES;
  }
}

export const audiobookService = new AudiobookService();
