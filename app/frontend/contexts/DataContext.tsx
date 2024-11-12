// app/frontend/contexts/DataContext.tsx

import React, { createContext, useContext } from 'react';
import useFetchTags from '../hooks/useFetchTags';
import useFetchAreas from '../hooks/useFetchAreas';
import useFetchProjects from '../hooks/useFetchProjects'; // Use the updated hook
import useManageAreas from '../hooks/useManageAreas';
import useManageNotes from '../hooks/useManageNotes';
import useManageProjects from '../hooks/useManageProjects';
import useManageTags from '../hooks/useManageTags';
import useManageTasks from '../hooks/useManageTasks';
import { Project } from '../entities/Project';

interface DataContextProps {
  tasks: any[];
  tags: any[];
  areas: any[];
  notes: any[];
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
  createNote: (noteData: any) => Promise<void>;
  updateNote: (noteId: number, noteData: any) => Promise<void>;
  deleteNote: (noteId: number) => Promise<void>;
  createArea: (areaData: any) => Promise<void>;
  updateArea: (areaId: number, areaData: any) => Promise<void>;
  deleteArea: (areaId: number) => Promise<void>;
  createProject: (projectData: any) => Promise<Project>;
  updateProject: (projectId: number, projectData: any) => Promise<void>;
  deleteProject: (projectId: number) => Promise<void>;
  createTag: (tagData: any) => Promise<void>;
  updateTag: (tagId: number, tagData: any) => Promise<void>;
  deleteTag: (tagId: number) => Promise<void>;
  createTask: (taskData: any) => Promise<void>;
  updateTask: (taskId: number, taskData: any) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  mutateTags: () => void;
  mutateAreas: () => void;
  mutateNotes: () => void;
  mutateProjects: () => void; // Include mutateProjects
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

export const useDataContext = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tags, isLoading: isLoadingTags, isError: isErrorTags, mutate: mutateTags } = useFetchTags();
  const { areas, isLoading: isLoadingAreas, isError: isErrorAreas, mutate: mutateAreas } = useFetchAreas();
  const {
    projects,
    isLoading: isLoadingProjects,
    isError: isErrorProjects,
    mutate: mutateProjects,
  } = useFetchProjects(); // Use the updated hook without options
  const { createArea, updateArea, deleteArea } = useManageAreas();
  const { createProject, updateProject, deleteProject } = useManageProjects();
  const { createTag, updateTag, deleteTag } = useManageTags();
  const {
    tasks,
    isLoading: isLoadingTasks,
    isError: isErrorTasks,
    createTask,
    updateTask,
    deleteTask,
  } = useManageTasks();
  const {
    notes,
    isLoading: isLoadingNotes,
    isError: isErrorNotes,
    createNote,
    updateNote,
    deleteNote,
    mutate: mutateNotes,
  } = useManageNotes();

  const isLoading = isLoadingTags || isLoadingAreas || isLoadingNotes || isLoadingTasks || isLoadingProjects;
  const isError = isErrorTags || isErrorAreas || isErrorNotes || isErrorTasks || isErrorProjects;

  return (
    <DataContext.Provider
      value={{
        tasks,
        tags,
        areas,
        notes,
        projects,
        isLoading,
        isError,
        createNote,
        updateNote,
        deleteNote,
        createArea,
        updateArea,
        deleteArea,
        createProject,
        updateProject,
        deleteProject,
        createTag,
        updateTag,
        deleteTag,
        createTask,
        updateTask,
        deleteTask,
        mutateTags,
        mutateAreas,
        mutateNotes,
        mutateProjects, // Include mutateProjects
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
