// src/hooks/useManageAreas.ts

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { Area } from '../entities/Area';

const useManageAreas = () => {
  const { mutate } = useSWRConfig();

  const createArea = useCallback(async (areaData: Partial<Area>) => {
    try {
      const response = await fetch('/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(areaData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create area.');
      }
      const newArea: Area = await response.json();
      mutate('/api/areas?active=true', (current: Area[] = []) => [...current, newArea], false);
    } catch (error) {
      console.error('Error creating area:', error);
      throw error;
    }
  }, [mutate]);

  const updateArea = useCallback(async (areaId: number, areaData: Partial<Area>) => {
    try {
      const response = await fetch(`/api/areas/${areaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(areaData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update area.');
      }
      const updatedArea: Area = await response.json();
      mutate('/api/areas?active=true', (current: Area[] = []) =>
        current.map(area => (area.id === areaId ? updatedArea : area)),
        false
      );
    } catch (error) {
      console.error('Error updating area:', error);
      throw error;
    }
  }, [mutate]);

  const deleteArea = useCallback(async (areaId: number) => {
    try {
      const response = await fetch(`/api/areas/${areaId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete area.');
      }
      mutate('/api/areas?active=true', (current: Area[] = []) =>
        current.filter(area => area.id !== areaId),
        false
      );
    } catch (error) {
      console.error('Error deleting area:', error);
      throw error;
    }
  }, [mutate]);

  return { createArea, updateArea, deleteArea };
};

export default useManageAreas;
