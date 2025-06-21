import { Project } from "../entities/Project";
import { handleAuthResponse } from "./authUtils";

export const fetchProjects = async (activeFilter = "all", areaFilter = ""): Promise<Project[]> => {
  let url = `/api/projects`;
  const params = new URLSearchParams();

  if (activeFilter !== "all") params.append("active", activeFilter);
  if (areaFilter) params.append("area_id", areaFilter);
  if (params.toString()) url += `?${params.toString()}`;

  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  await handleAuthResponse(response, 'Failed to fetch projects.');

  const data = await response.json();
  return data.projects || data;
};

export const fetchGroupedProjects = async (activeFilter = "all", areaFilter = ""): Promise<Record<string, Project[]>> => {
  let url = `/api/projects`;
  const params = new URLSearchParams();

  params.append("grouped", "true");
  if (activeFilter !== "all") params.append("active", activeFilter);
  if (areaFilter) params.append("area_id", areaFilter);
  if (params.toString()) url += `?${params.toString()}`;


  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  await handleAuthResponse(response, 'Failed to fetch projects.');

  const data = await response.json();
  return data;
};

export const fetchProjectById = async (projectId: string): Promise<Project> => {
  const response = await fetch(`/api/project/${projectId}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  await handleAuthResponse(response, 'Failed to fetch project details.');
  return await response.json();
};

export const createProject = async (projectData: Partial<Project>): Promise<Project> => {
  const response = await fetch('/api/project', {
    method: 'POST',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(projectData),
  });

  await handleAuthResponse(response, 'Failed to create project.');
  return await response.json();
};

export const updateProject = async (projectId: number, projectData: Partial<Project>): Promise<Project> => {
  const response = await fetch(`/api/project/${projectId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(projectData),
  });

  await handleAuthResponse(response, 'Failed to update project.');
  return await response.json();
};

export const deleteProject = async (projectId: number): Promise<void> => {
  const response = await fetch(`/api/project/${projectId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
    },
  });

  await handleAuthResponse(response, 'Failed to delete project.');
};
