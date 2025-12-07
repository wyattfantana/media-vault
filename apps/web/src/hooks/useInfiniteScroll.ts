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
      return;
    }

    let distanceFromBottom: number;

    if (useWindow) {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    } else {
      if (!containerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    }

    if (distanceFromBottom < threshold) {
      loadingRef.current = true;
      onLoadMoreRef.current();
      setTimeout(() => {
        loadingRef.current = false;
      }, 1000);
    }
  }, [threshold, useWindow]);

  useEffect(() => {
    if (useWindow) {
      window.addEventListener('scroll', handleScroll);
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    } else {
      const container = containerRef.current;
      if (!container) return;
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll, useWindow]);

  return containerRef;
};
