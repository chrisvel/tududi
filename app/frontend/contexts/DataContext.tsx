import React, { createContext, useContext } from 'react';
import useFetchTags from '../hooks/useFetchTags';
import useFetchAreas from '../hooks/useFetchAreas';
import useFetchProjects from '../hooks/useFetchProjects'; // New project fetching hook
import useManageAreas from '../hooks/useManageAreas';
import useManageNotes from '../hooks/useManageNotes';
import useManageProjects from '../hooks/useManageProjects'; // New project management hook
import useManageTags from '../hooks/useManageTags'; // New tag management hook

interface DataContextProps {
  tags: any[];
  areas: any[];
  projects: any[];
  notes: any[];
  isLoading: boolean;
  isError: boolean;
  createNote: (noteData: any) => Promise<void>;
  updateNote: (noteId: number, noteData: any) => Promise<void>;
  deleteNote: (noteId: number) => Promise<void>;
  createArea: (areaData: any) => Promise<void>;
  updateArea: (areaId: number, areaData: any) => Promise<void>;
  deleteArea: (areaId: number) => Promise<void>;
  createProject: (projectData: any) => Promise<void>;
  updateProject: (projectId: number, projectData: any) => Promise<void>;
  deleteProject: (projectId: number) => Promise<void>;
  createTag: (tagData: any) => Promise<void>;
  updateTag: (tagId: number, tagData: any) => Promise<void>;
  deleteTag: (tagId: number) => Promise<void>;
  mutateTags: () => void;
  mutateAreas: () => void;
  mutateProjects: () => void;
  mutateNotes: () => void;
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
  const { projects, isLoading: isLoadingProjects, isError: isErrorProjects, mutate: mutateProjects } = useFetchProjects('true', ''); // Default filters
  const { createArea, updateArea, deleteArea } = useManageAreas();
  const { createProject, updateProject, deleteProject } = useManageProjects(); // Project management
  const { createTag, updateTag, deleteTag } = useManageTags(); // Tag management
  const {
    notes,
    isLoading: isLoadingNotes,
    isError: isErrorNotes,
    createNote,
    updateNote,
    deleteNote,
    mutate: mutateNotes
  } = useManageNotes();

  const isLoading = isLoadingTags || isLoadingAreas || isLoadingProjects || isLoadingNotes;
  const isError = isErrorTags || isErrorAreas || isErrorProjects || isErrorNotes;

  return (
    <DataContext.Provider
      value={{
        tags,
        areas,
        projects,
        notes,
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
        mutateTags,
        mutateAreas,
        mutateProjects,
        mutateNotes,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
