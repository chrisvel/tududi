import React, { createContext, useContext } from 'react';
import useFetchTags from '../hooks/useFetchTags';
import useFetchProjects from '../hooks/useFetchProjects'; 
import useManageTags from '../hooks/useManageTags';
import useManageTasks from '../hooks/useManageTasks';
import { Project } from '../entities/Project';

interface DataContextProps {
  tasks: any[];
  tags: any[];
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
  createTag: (tagData: any) => Promise<void>;
  updateTag: (tagId: number, tagData: any) => Promise<void>;
  deleteTag: (tagId: number) => Promise<void>;
  createTask: (taskData: any) => Promise<void>;
  updateTask: (taskId: number, taskData: any) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  mutateTags: () => void;
  mutateProjects: () => void; 
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
  const {
    projects,
    isLoading: isLoadingProjects,
    isError: isErrorProjects,
    mutate: mutateProjects,
  } = useFetchProjects(); 
  const { createTag, updateTag, deleteTag } = useManageTags();
  const {
    tasks,
    isLoading: isLoadingTasks,
    isError: isErrorTasks,
    createTask,
    updateTask,
    deleteTask,
  } = useManageTasks();

  const isLoading = isLoadingTags || isLoadingTasks || isLoadingProjects;
  const isError = isErrorTags || isErrorTasks || isErrorProjects;

  return (
    <DataContext.Provider
      value={{
        tasks,
        tags,
        projects,
        isLoading,
        isError,
        createTag,
        updateTag,
        deleteTag,
        createTask,
        updateTask,
        deleteTask,
        mutateTags,
        mutateProjects, 
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
