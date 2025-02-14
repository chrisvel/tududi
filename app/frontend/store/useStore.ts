import { create } from "zustand";
import { Project } from "../entities/Project";
import { Note } from "../entities/Note";
import { Area } from "../entities/Area";
import { Task } from "../entities/Task";
import { Tag } from "../entities/Tag";

interface NotesStore {
  notes: Note[];
  create: (noteData: Note) => Promise<void>;
  update: (noteId: number, noteData: Note) => Promise<void>;
  delete: (noteId: number) => Promise<void>;
  fetchAll: () => void;
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
  update: (projectId: number, projectData: Project) => Promise<Project>;
  delete: (projectId: number) => Promise<void>;
  fetchAll: () => void;
}

interface TagsStore {
  tags: Tag[];
  create: (tagData: Tag) => Promise<void>;
  update: (tagId: number, tagData: Tag) => Promise<void>;
  delete: (tagId: number) => Promise<void>;
  fetchAll: () => void;
}

interface TasksStore {
  tasks: Task[];
  create: (taskData: Task) => Promise<void>;
  update: (taskId: number, taskData: Task) => Promise<void>;
  delete: (taskId: number) => Promise<void>;
  fetchAll: () => void;
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
    create: async (noteData) => {
      try {
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(noteData),
        });
        const createdNote = await response.json();
        set((state) => ({
          notesStore: {
            ...state.notesStore,
            notes: [...state.notesStore.notes, createdNote],
          },
        }));
      } catch (error) {
        console.error("Error creating note:", error);
      }
    },
    update: async (noteId, noteData) => {
      try {
        const response = await fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(noteData),
        });
        const updatedNote = await response.json();
        set((state) => ({
          notesStore: {
            ...state.notesStore,
            notes: state.notesStore.notes.map((note) =>
              note.id === noteId ? updatedNote : note
            ),
          },
        }));
      } catch (error) {
        console.error("Error updating note:", error);
      }
    },
    delete: async (noteId) => {
      try {
        await fetch(`/api/notes/${noteId}`, {
          method: "DELETE",
        });
        set((state) => ({
          notesStore: {
            ...state.notesStore,
            notes: state.notesStore.notes.filter((note) => note.id !== noteId),
          },
        }));
      } catch (error) {
        console.error("Error deleting note:", error);
      }
    },
    fetchAll: () => {
      /* Implementation */
    },
  },

  areasStore: {
    areas: [],

    fetchAll: async () => {
      try {
        const response = await fetch("/api/areas?active=true");
        const areas = await response.json();
        set((state) => ({
          areasStore: {
            ...state.areasStore,
            areas,
          },
        }));
      } catch (error) {
        console.error("Failed to fetch areas:", error);
      }
    },

    create: async (areaData) => {
      try {
        const response = await fetch("/api/areas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        console.error("Error creating area:", error);
      }
    },

    update: async (areaId, areaData) => {
      try {
        const response = await fetch(`/api/areas/${areaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
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
        console.error("Error updating area:", error);
      }
    },

    delete: async (areaId) => {
      try {
        await fetch(`/api/areas/${areaId}`, {
          method: "DELETE",
        });
        set((state) => ({
          areasStore: {
            ...state.areasStore,
            areas: state.areasStore.areas.filter((area) => area.id !== areaId),
          },
        }));
      } catch (error) {
        console.error("Error deleting area:", error);
      }
    },
  },

  projectsStore: {
    projects: [],

    fetchAll: async () => {
      try {
        // Fetching all projects
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error('Failed to fetch projects.');
        const projects = await response.json();
        set((state) => ({ projectsStore: { ...state.projectsStore, projects } }));
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    },

    create: async (projectData) => {
      try {
        const response = await fetch('/api/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData),
        });

        if (response.ok) {
          const newProject = await response.json();
          set((state) => ({
            projectsStore: {
              ...state.projectsStore,
              projects: [...state.projectsStore.projects, newProject],
            },
          }));
          return newProject;
        } else {
          throw new Error('Failed to create project.');
        }
      } catch (error) {
        console.error('Error creating project:', error);
        throw error;
      }
    },

    update: async (projectId, projectData) => {
      try {
        const response = await fetch(`/api/project/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData),
        });
    
        if (response.ok) {
          const updatedProject = await response.json();
          set((state) => ({
            projectsStore: {
              ...state.projectsStore,
              projects: state.projectsStore.projects.map((project) =>
                project.id === projectId ? updatedProject : project
              ),
            },
          }));
          return updatedProject; 
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update project.');
        }
      } catch (error) {
        console.error('Error updating project:', error);
        throw error;
      }
    },

    delete: async (projectId) => {
      try {
        const response = await fetch(`/api/project/${projectId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          set((state) => ({
            projectsStore: {
              ...state.projectsStore,
              projects: state.projectsStore.projects.filter((project) => project.id !== projectId),
            },
          }));
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete project.');
        }
      } catch (error) {
        console.error('Error deleting project:', error);
        throw error;
      }
    },
  },

  tagsStore: {
    tags: [],
    create: async (tagData) => {
      /* Implementation */
    },
    update: async (tagId, tagData) => {
      /* Implementation */
    },
    delete: async (tagId) => {
      /* Implementation */
    },
    fetchAll: () => {
      /* Implementation */
    },
  },

  tasksStore: {
    tasks: [],
    create: async (taskData) => {
      /* Implementation */
    },
    update: async (taskId, taskData) => {
      /* Implementation */
    },
    delete: async (taskId) => {
      /* Implementation */
    },
    fetchAll: () => {
      /* Implementation */
    },
  },
}));
