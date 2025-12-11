import TorrentSearchApi from 'torrent-search-api';

export interface TorrentResult {
  title: string;
  magnet: string;
  seeds: number;
  peers: number;
  size: string;
  source: '1337x' | 'piratebay' | 'ext' | 'rarbg' | 'torrentproject' | 'yts';
  quality?: string;
  uploadDate?: string;
  uploader?: string;
}

export class TorrentSearchService {
  private api: typeof TorrentSearchApi;

  constructor() {
    this.api = TorrentSearchApi;
    // Don't enable providers here - enable them individually during search
    console.log('[TorrentSearch] Service initialized');
  }

  /**
   * Search all torrent sites and return combined results sorted by seeds
   */
  async searchAll(query: string): Promise<TorrentResult[]> {
    console.log(`[TorrentSearch] Searching all sites for: ${query}`);

    try {
      // Search each provider separately by enabling only that provider
      const providers = ['ThePirateBay', '1337x', 'Yts'];
      const allResults: any[] = [];

      for (const provider of providers) {
        try {
          // Disable all providers first
          const activeProviders = this.api.getActiveProviders();
          activeProviders.forEach(p => this.api.disableProvider(p.name));

          // Enable only this provider
          this.api.enableProvider(provider);
          console.log(`[TorrentSearch] Enabled only ${provider}, searching with 'All'...`);

          // Search with 'All' category (which will use only the enabled provider)
          const results = await this.api.search(query, 'All', 25);
          console.log(`[TorrentSearch] ${provider} returned ${results.length} results`);
          allResults.push(...results);
        } catch (error: any) {
          console.log(`[TorrentSearch] ${provider} failed: ${error.message}`);
        }
      }

      const rawResults = allResults;
      console.log(`[TorrentSearch] Found ${rawResults.length} total raw results`);

      // Convert to our format
      const results: TorrentResult[] = rawResults.map((torrent: any) => ({
        title: torrent.title || 'Unknown',
        magnet: torrent.magnet || '',
        seeds: parseInt(torrent.seeds) || 0,
        peers: parseInt(torrent.peers) || 0,
        size: torrent.size || 'Unknown',
        source: this.mapProvider(torrent.provider),
        quality: this.extractQuality(torrent.title || ''),
        uploadDate: torrent.time,
        uploader: torrent.provider,
      }));

      // Count results by provider
      const providerCounts: Record<string, number> = {};
      results.forEach(r => {
        providerCounts[r.source] = (providerCounts[r.source] || 0) + 1;
      });
      console.log('[TorrentSearch] Results by provider:', providerCounts);

      // Filter out results without magnet links
      const validResults = results.filter(r => r.magnet && r.magnet.startsWith('magnet:'));

      // Deduplicate by magnet link (some providers may have duplicates)
      const uniqueResults = Array.from(
        new Map(validResults.map(r => [r.magnet, r])).values()
      );

      // Sort by seeds (descending) but try to show diverse sources
      const sorted = uniqueResults.sort((a, b) => {
        // Prioritize by seeds first
        const seedDiff = b.seeds - a.seeds;
        if (Math.abs(seedDiff) > 50) return seedDiff; // If seed difference is significant, use that
        // Otherwise, prefer diverse sources
        return 0; // Keep relative order for similar seeds
      });

      console.log(`[TorrentSearch] Returning ${sorted.length} valid results (${validResults.length} before deduplication)`);

      return sorted;
    } catch (error: any) {
      console.error('[TorrentSearch] Search failed:', error.message);
      return [];
    }
  }

  /**
   * Map provider names to our source types
   */
  private mapProvider(provider: string): any {
    const normalized = provider.toLowerCase();
    if (normalized.includes('1337x')) return '1337x';
    if (normalized.includes('pirate')) return 'piratebay';
    if (normalized.includes('yts')) return 'yts';
    if (normalized.includes('eztv')) return 'ext';
    if (normalized.includes('rarbg')) return 'rarbg';
    if (normalized.includes('torrentproject')) return 'torrentproject';
    return '1337x'; // default
  }

  /**
   * Extract quality information from torrent title
   */
  private extractQuality(title: string): string | undefined {
    const qualityPatterns = [
      /\b(4K|2160p)\b/i,
      /\b(1080p)\b/i,
      /\b(720p)\b/i,
      /\b(480p)\b/i,
      /\b(360p)\b/i,
      /\b(HDTV|HDRip|BluRay|BRRip|WEBRip|WEB-DL)\b/i,
    ];

    for (const pattern of qualityPatterns) {
      const match = title.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }
}

export const torrentSearchService = new TorrentSearchService();
