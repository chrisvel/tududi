import useSWR from 'swr';
import { Area } from '../entities/Area';
import { fetcher } from '../utils/fetcher';

const useFetchAreas = () => {
  const { data, error, mutate } = useSWR<Area[]>('/api/areas?active=true', fetcher);

  return {
    areas: data || [],
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

export default useFetchAreas;
