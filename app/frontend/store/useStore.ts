import { create } from 'zustand';
import { Project } from '../entities/Project';
import { Note } from '../entities/Note';
import { Area } from '../entities/Area';
import { Task } from '../entities/Task';
import { Tag } from '../entities/Tag';

interface NotesStore {
  notes: Note[];
  create: (noteData: Note) => Promise<void>;
  update: (noteId: number, noteData: Note) => Promise<void>;
  delete: (noteId: number) => Promise<void>;
  mutate: () => void;
}

interface AreasStore {
  areas: Area[];
  create: (areaData: Partial<Area>) => Promise<void>;
  update: (areaId: number, areaData: Partial<Area>) => Promise<void>;
  delete: (areaId: number) => Promise<void>;
  fetchAll: () => Promise<void>;
}

interface ProjectsStore {
  projects: Project[];
  create: (projectData: Project) => Promise<void>;
  update: (projectId: number, projectData: Project) => Promise<void>;
  delete: (projectId: number) => Promise<void>;
  mutate: () => void;
}

interface TagsStore {
  tags: Tag[];
  create: (tagData: Tag) => Promise<void>;
  update: (tagId: number, tagData: Tag) => Promise<void>;
  delete: (tagId: number) => Promise<void>;
  mutate: () => void;
}

interface TasksStore {
  tasks: Task[];
  create: (taskData: Task) => Promise<void>;
  update: (taskId: number, taskData: Task) => Promise<void>;
  delete: (taskId: number) => Promise<void>;
}

interface StoreState {
  isLoading: boolean;
  isError: boolean;
  notesStore: NotesStore;
  areasStore: AreasStore;
  projectsStore: ProjectsStore;
  tagsStore: TagsStore;
  tasksStore: TasksStore;
}

export const useStore = create<StoreState>((set) => ({
  isLoading: false,
  isError: false,

  notesStore: {
    notes: [],
    create: async (noteData) => { /* Implementation */ },
    update: async (noteId, noteData) => { /* Implementation */ },
    delete: async (noteId) => { /* Implementation */ },
    mutate: () => { /* Implementation */ },
  },

  areasStore: {
    areas: [],

    fetchAll: async () => {
      try {
        const response = await fetch('/api/areas?active=true');
        const areas = await response.json();
        set((state) => ({
          areasStore: {
            ...state.areasStore,
            areas,
          },
        }));
      } catch (error) {
        console.error('Failed to fetch areas:', error);
      }
    },

    create: async (areaData) => {
      try {
        const response = await fetch('/api/areas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(areaData),
        });
        const newArea = await response.json();
        set((state) => ({
          areasStore: {
            ...state.areasStore,
            areas: [...state.areasStore.areas, newArea],
          },
        }));
      } catch (error) {
        console.error('Error creating area:', error);
      }
    },

    update: async (areaId, areaData) => {
      try {
        const response = await fetch(`/api/areas/${areaId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(areaData),
        });
        const updatedArea = await response.json();
        set((state) => ({
          areasStore: {
            ...state.areasStore,
            areas: state.areasStore.areas.map((area) =>
              area.id === areaId ? updatedArea : area
            ),
          },
        }));
      } catch (error) {
        console.error('Error updating area:', error);
      }
    },

    delete: async (areaId) => {
      try {
        await fetch(`/api/areas/${areaId}`, {
          method: 'DELETE',
        });
        set((state) => ({
          areasStore: {
            ...state.areasStore,
            areas: state.areasStore.areas.filter((area) => area.id !== areaId),
          },
        }));
      } catch (error) {
        console.error('Error deleting area:', error);
      }
    },
  },

  projectsStore: {
    projects: [],
    create: async (projectData) => { /* Implementation */ },
    update: async (projectId, projectData) => { /* Implementation */ },
    delete: async (projectId) => { /* Implementation */ },
    mutate: () => { /* Implementation */ },
  },

  tagsStore: {
    tags: [],
    create: async (tagData) => { /* Implementation */ },
    update: async (tagId, tagData) => { /* Implementation */ },
    delete: async (tagId) => { /* Implementation */ },
    mutate: () => { /* Implementation */ },
  },

  tasksStore: {
    tasks: [],
    create: async (taskData) => { /* Implementation */ },
    update: async (taskId, taskData) => { /* Implementation */ },
    delete: async (taskId) => { /* Implementation */ },
  },
}));