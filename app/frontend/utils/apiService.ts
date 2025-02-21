import { Project } from "../entities/Project";
import { Area } from "../entities/Area";
import { Note } from "../entities/Note";
import { Task } from "../entities/Task";
import { Tag } from "../entities/Tag";
import { Metrics } from "../entities/Metrics";

/**
 * Projects API
 */

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

  if (!response.ok) throw new Error('Failed to fetch projects.');

  const data = await response.json();
  return data.projects || data;
};

export const fetchProjectById = async (projectId: string): Promise<Project> => {
  const response = await fetch(`/api/project/${projectId}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new Error('Failed to fetch project details.');

  return await response.json();
};

export const createProject = async (projectData: Partial<Project>): Promise<Project> => {
  const response = await fetch('/api/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData),
  });

  if (!response.ok) throw new Error('Failed to create project.');

  return await response.json();
};

export const updateProject = async (projectId: number, projectData: Partial<Project>): Promise<Project> => {
  const response = await fetch(`/api/project/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData),
  });

  if (!response.ok) throw new Error('Failed to update project.');

  return await response.json();
};

export const deleteProject = async (projectId: number): Promise<void> => {
  const response = await fetch(`/api/project/${projectId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete project.');
};

/**
 * Areas API
 */

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

/**
 * Notes API
 */

export const fetchNotes = async (): Promise<Note[]> => {
  const response = await fetch("/api/notes");
  if (!response.ok) throw new Error('Failed to fetch notes.');

  return await response.json();
};

export const createNote = async (noteData: Note): Promise<Note> => {
  const response = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteData),
  });

  if (!response.ok) throw new Error('Failed to create note.');

  return await response.json();
};

export const updateNote = async (noteId: number, noteData: Note): Promise<Note> => {
  const response = await fetch(`/api/notes/${noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteData),
  });

  if (!response.ok) throw new Error('Failed to update note.');

  return await response.json();
};

export const deleteNote = async (noteId: number): Promise<void> => {
  const response = await fetch(`/api/notes/${noteId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete note.');
};

/**
 * Tasks API
 */

export const fetchTasks = async (query = ''): Promise<{ tasks: Task[]; metrics: Metrics }> => {
  const response = await fetch(`/api/tasks${query}`);
  
  if (!response.ok) throw new Error('Failed to fetch tasks.');

  const result = await response.json();
  
  if (!Array.isArray(result.tasks)) {
    throw new Error('Resulting tasks are not an array.');
  }
  
  if (!result.metrics) {
    throw new Error('Metrics data is not included.');
  }

  return { tasks: result.tasks, metrics: result.metrics };
};

export const createTask = async (taskData: Task): Promise<Task> => {
  const response = await fetch('/api/task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) throw new Error('Failed to create task.');

  return await response.json();
};

export const updateTask = async (taskId: number, taskData: Task): Promise<Task> => {
  const response = await fetch(`/api/task/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) throw new Error('Failed to update task.');

  return await response.json();
};

export const deleteTask = async (taskId: number): Promise<void> => {
  const response = await fetch(`/api/task/${taskId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete task.');
};

/**
 * Tags API
 */

export const fetchTags = async (): Promise<Tag[]> => {
  const response = await fetch("/api/tags");
  if (!response.ok) throw new Error('Failed to fetch tags.');

  return await response.json();
};

export const createTag = async (tagData: Tag): Promise<Tag> => {
  const response = await fetch('/api/tag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tagData),
  });

  if (!response.ok) throw new Error('Failed to create tag.');

  return await response.json();
};

export const updateTag = async (tagId: number, tagData: Tag): Promise<Tag> => {
  const response = await fetch(`/api/tag/${tagId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tagData),
  });

  if (!response.ok) throw new Error('Failed to update tag.');

  return await response.json();
};

export const deleteTag = async (tagId: number): Promise<void> => {
  const response = await fetch(`/api/tag/${tagId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete tag.');
};