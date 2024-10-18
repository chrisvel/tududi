// src/hooks/useFetchTags.ts
import useSWR from 'swr';
import { fetcher } from '../utils/fetcher'; // Adjust the path to the fetcher if needed

const useFetchTags = () => {
  const { data, error, mutate } = useSWR('/api/tags', fetcher);

  return {
    tags: data || [],
    isLoading: !data && !error,
    isError: !!error,
    mutate,
  };
};

export default useFetchTags;
