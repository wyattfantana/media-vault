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
  const hasMoreRef = useRef(hasMore);
  const isLoadingRef = useRef(isLoading);
  const onLoadMoreRef = useRef(onLoadMore);

  // Update refs when props change
  useEffect(() => {
    hasMoreRef.current = hasMore;
    isLoadingRef.current = isLoading;
    onLoadMoreRef.current = onLoadMore;
  }, [hasMore, isLoading, onLoadMore]);

  const handleScroll = useCallback(() => {
    if (loadingRef.current || !hasMoreRef.current || isLoadingRef.current) {
      console.log('[InfiniteScroll] Blocked:', { loadingRef: loadingRef.current, hasMore: hasMoreRef.current, isLoading: isLoadingRef.current });
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
      onLoadMoreRef.current();
      // Reset loading flag after a delay to prevent rapid triggers
      setTimeout(() => {
        loadingRef.current = false;
      }, 1000);
    }
  }, [threshold, useWindow]);

  useEffect(() => {
    console.log('[InfiniteScroll] Setting up scroll listener. useWindow:', useWindow, 'hasMore:', hasMore, 'isLoading:', isLoading);

    // Test scroll event
    const testScroll = () => {
      console.log('[InfiniteScroll] SCROLL EVENT FIRED!');
    };

    if (useWindow) {
      console.log('[InfiniteScroll] Attaching window scroll listener');
      window.addEventListener('scroll', handleScroll);
      window.addEventListener('scroll', testScroll);
      return () => {
        console.log('[InfiniteScroll] Removing window scroll listener');
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('scroll', testScroll);
      };
    } else {
      const container = containerRef.current;
      if (!container) {
        console.log('[InfiniteScroll] No container ref found!');
        return;
      }
      console.log('[InfiniteScroll] Attaching container scroll listener');
      container.addEventListener('scroll', handleScroll);
      container.addEventListener('scroll', testScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
        container.removeEventListener('scroll', testScroll);
      };
    }
  }, [handleScroll, useWindow]);

  return containerRef;
};
