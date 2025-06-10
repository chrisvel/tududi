import { Area } from "../entities/Area";

export const fetchAreas = async (): Promise<Area[]> => {
  const response = await fetch("/api/areas?active=true");
  if (!response.ok) throw new Error('Failed to fetch areas.');

  return await response.json();
};

export const createArea = async (areaData: Partial<Area>): Promise<Area> => {
  const response = await fetch('/api/areas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(areaData),
  });

  if (!response.ok) throw new Error('Failed to create area.');

  return await response.json();
};

export const updateArea = async (areaId: number, areaData: Partial<Area>): Promise<Area> => {
  const response = await fetch(`/api/areas/${areaId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(areaData),
  });

  if (!response.ok) throw new Error('Failed to update area.');

  return await response.json();
};

export const deleteArea = async (areaId: number): Promise<void> => {
  const response = await fetch(`/api/areas/${areaId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete area.');
};