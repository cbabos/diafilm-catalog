import { useState, useEffect } from 'react';

/**
 * Debounce a value by a specified delay.
 * @param value The value to debounce
 * @param delay Delay in milliseconds (default 150ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 150): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}