import { Area } from "../entities/Area";
import { handleAuthResponse } from "./authUtils";

export const fetchAreas = async (): Promise<Area[]> => {
  const response = await fetch("/api/areas?active=true", {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
    },
  });
  await handleAuthResponse(response, 'Failed to fetch areas.');
  return await response.json();
};

export const createArea = async (areaData: Partial<Area>): Promise<Area> => {
  const response = await fetch('/api/areas', {
    method: 'POST',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(areaData),
  });

  await handleAuthResponse(response, 'Failed to create area.');
  return await response.json();
};

export const updateArea = async (areaId: number, areaData: Partial<Area>): Promise<Area> => {
  const response = await fetch(`/api/areas/${areaId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(areaData),
  });

  await handleAuthResponse(response, 'Failed to update area.');
  return await response.json();
};

export const deleteArea = async (areaId: number): Promise<void> => {
  const response = await fetch(`/api/areas/${areaId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
    },
  });

  await handleAuthResponse(response, 'Failed to delete area.');
};