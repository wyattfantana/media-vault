import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number; // Distance from bottom to trigger load (in pixels)
  useWindow?: boolean; // Use window scroll instead of container scroll
}

export const useInfiniteScroll = ({
  onLoadMore,
  hasMore,
  isLoading,
  threshold = 500,
  useWindow = false
}: UseInfiniteScrollOptions) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const handleScroll = useCallback(() => {
    if (loadingRef.current || !hasMore || isLoading) {
      console.log('[InfiniteScroll] Blocked:', { loadingRef: loadingRef.current, hasMore, isLoading });
      return;
    }

    let distanceFromBottom: number;

    if (useWindow) {
      // Window scroll calculation
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      console.log('[InfiniteScroll] Window scroll:', { scrollTop, scrollHeight, clientHeight, distanceFromBottom, threshold });
    } else {
      // Container scroll calculation
      if (!containerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      console.log('[InfiniteScroll] Container scroll:', { scrollTop, scrollHeight, clientHeight, distanceFromBottom, threshold });
    }

    if (distanceFromBottom < threshold) {
      console.log('[InfiniteScroll] Triggering load! Distance:', distanceFromBottom, 'Threshold:', threshold);
      loadingRef.current = true;
      onLoadMore();
      // Reset loading flag after a delay to prevent rapid triggers
      setTimeout(() => {
        loadingRef.current = false;
      }, 1000);
    }
  }, [onLoadMore, hasMore, isLoading, threshold, useWindow]);

  useEffect(() => {
    if (useWindow) {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    } else {
      const container = containerRef.current;
      if (!container) return;
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, useWindow]);

  return containerRef;
};
