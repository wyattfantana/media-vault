import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for persisting state to localStorage with debouncing
 *
 * @param key - localStorage key
 * @param initialValue - initial value if no saved state exists
 * @param debounceMs - debounce time in milliseconds (default: 500ms)
 * @returns [state, setState] tuple like useState
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  debounceMs: number = 500
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Initialize state from localStorage or use initial value
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.warn(`Failed to load persisted state for key "${key}":`, err);
    }
    return initialValue;
  });

  const timeoutRef = useRef<NodeJS.Timeout>();

  // Save to localStorage whenever state changes (with debouncing)
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (err) {
        console.warn(`Failed to persist state for key "${key}":`, err);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, state, debounceMs]);

  return [state, setState];
}

/**
 * Hook for persisting scroll position
 *
 * @param key - localStorage key
 * @returns restore function to call when content is ready
 */
export function usePersistedScroll(key: string) {
  const hasRestoredRef = useRef(false);

  // Save scroll position on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      localStorage.setItem(key, scrollY.toString());
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [key]);

  // Function to restore scroll position
  const restoreScroll = () => {
    if (hasRestoredRef.current) return;

    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const scrollY = parseInt(saved, 10);
        if (!isNaN(scrollY)) {
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            window.scrollTo(0, scrollY);
            hasRestoredRef.current = true;
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to restore scroll position for key "${key}":`, err);
    }
  };

  return restoreScroll;
}
