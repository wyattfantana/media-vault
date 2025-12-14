/**
 * Weighted Rating Service
 * Implements IMDb's Bayesian average formula for calculating Top 250 lists
 *
 * Formula: WR = (v/(v+m)) * R + (m/(v+m)) * C
 * Where:
 * - WR = weighted rating
 * - v = number of votes for the item
 * - m = minimum votes required to be listed (25,000 for IMDb)
 * - R = average rating for the item
 * - C = mean vote across all items (typically 7.0 for movies)
 */

export interface WeightedRatingItem {
  id: number;
  title: string;
  rating: number;        // Average rating (R)
  votes: number;         // Number of votes (v)
  weightedRating?: number; // Calculated weighted rating (WR)
  imdb_id?: string;
  [key: string]: any;    // Allow other properties
}

export class WeightedRatingService {
  // IMDb uses approximately 25,000 as the minimum vote threshold
  private readonly MIN_VOTES_THRESHOLD = 25000;

  // Mean vote across all movies (IMDb average is around 7.0)
  private readonly MEAN_VOTE = 7.0;

  /**
   * Calculate weighted rating for a single item
   */
  calculateWeightedRating(
    rating: number,
    votes: number,
    minVotes: number = this.MIN_VOTES_THRESHOLD,
    meanVote: number = this.MEAN_VOTE
  ): number {
    // WR = (v/(v+m)) * R + (m/(v+m)) * C
    const v = votes;
    const m = minVotes;
    const R = rating;
    const C = meanVote;

    const weightedRating = (v / (v + m)) * R + (m / (v + m)) * C;
    return weightedRating;
  }

  /**
   * Calculate weighted ratings for multiple items
   */
  calculateWeightedRatings(items: WeightedRatingItem[]): WeightedRatingItem[] {
    return items.map(item => ({
      ...item,
      weightedRating: this.calculateWeightedRating(item.rating, item.votes)
    }));
  }

  /**
   * Get top N items by weighted rating
   */
  getTopRated(
    items: WeightedRatingItem[],
    limit: number = 250,
    minVotes: number = this.MIN_VOTES_THRESHOLD
  ): WeightedRatingItem[] {
    // Filter items with minimum votes
    const qualified = items.filter(item => item.votes >= minVotes);

    // Calculate weighted ratings
    const withWeightedRatings = this.calculateWeightedRatings(qualified);

    // Sort by weighted rating descending
    const sorted = withWeightedRatings.sort((a, b) =>
      (b.weightedRating || 0) - (a.weightedRating || 0)
    );

    // Return top N
    return sorted.slice(0, limit);
  }

  /**
   * Calculate dynamic mean vote from a dataset
   * Useful for calculating the C parameter from actual data
   */
  calculateMeanVote(items: WeightedRatingItem[]): number {
    if (items.length === 0) return this.MEAN_VOTE;

    const totalRating = items.reduce((sum, item) => sum + item.rating, 0);
    return totalRating / items.length;
  }

  /**
   * Calculate weighted mean vote (weighted by vote count)
   * This gives more weight to items with more votes
   */
  calculateWeightedMeanVote(items: WeightedRatingItem[]): number {
    if (items.length === 0) return this.MEAN_VOTE;

    const totalWeightedRating = items.reduce(
      (sum, item) => sum + (item.rating * item.votes),
      0
    );
    const totalVotes = items.reduce((sum, item) => sum + item.votes, 0);

    if (totalVotes === 0) return this.MEAN_VOTE;

    return totalWeightedRating / totalVotes;
  }

  /**
   * Get configuration parameters
   */
  getConfig() {
    return {
      minVotesThreshold: this.MIN_VOTES_THRESHOLD,
      meanVote: this.MEAN_VOTE
    };
  }

  /**
   * Update configuration parameters
   */
  setConfig(minVotesThreshold?: number, meanVote?: number) {
    if (minVotesThreshold !== undefined) {
      (this as any).MIN_VOTES_THRESHOLD = minVotesThreshold;
    }
    if (meanVote !== undefined) {
      (this as any).MEAN_VOTE = meanVote;
    }
  }
}

export const weightedRatingService = new WeightedRatingService();
