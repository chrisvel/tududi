// src/hooks/useFetch.ts
import { useState, useEffect } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const useFetch = <T,>(url: string, options?: RequestInit): UseFetchResult<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true; // To prevent setting state on unmounted component
    const controller = new AbortController(); // To handle component unmounting

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch data.');
        }
        const result: T = await response.json();
        if (isMounted) {
          setData(result);
        }
      } catch (err: any) {
        if (isMounted) {
          if (err.name !== 'AbortError') {
            setError(err.message);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    // Cleanup function to abort fetch on unmount
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [url, JSON.stringify(options)]); // Note: Be cautious with dependencies

  return { data, loading, error };
};

export default useFetch;
