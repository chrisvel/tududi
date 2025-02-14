import { create } from "zustand";
import { Project } from "../entities/Project";
import { Note } from "../entities/Note";
import { Area } from "../entities/Area";
import { Task } from "../entities/Task";
import { Tag } from "../entities/Tag";

interface NotesStore {
  notes: Note[];
  create: (noteData: Note) => Promise<Note>;
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
  create: (projectData: Project) => Promise<Project>;
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
        if (!response.ok) throw new Error('Failed to create note.');
        const newNote = await response.json();
        set((state) => ({
          notesStore: {
            ...state.notesStore,
            notes: [...state.notesStore.notes, newNote],
          },
        }));
        return newNote; // Make sure to return the new note here
      } catch (error) {
        console.error("Error creating note:", error);
        throw error;
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
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error('Failed to fetch projects.');
        
        const projects = await response.json();
        set((state) => ({
          projectsStore: {
            ...state.projectsStore,
            projects
          }
        }));
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    },
    
    create: async (projectData: Partial<Project>): Promise<Project> => {
      try {
        const response = await fetch('/api/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData),
        });
        
        if (!response.ok) throw new Error('Failed to create project.');
        
        const newProject = await response.json();
        set((state) => ({
          projectsStore: {
            ...state.projectsStore,
            projects: [...state.projectsStore.projects, newProject],
          }
        }));
        return newProject;
      } catch (error) {
        console.error('Error creating project:', error);
        throw error;
      }
    },
    
    update: async (projectId, projectData: Partial<Project>) => {
      try {
        const response = await fetch(`/api/project/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update project.');
        }
        
        const updatedProject = await response.json();
        set((state) => ({
          projectsStore: {
            ...state.projectsStore,
            projects: state.projectsStore.projects.map((project) =>
              project.id === projectId ? updatedProject : project
            ),
          }
        }));
        return updatedProject;
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
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete project.');
        }
        
        set((state) => ({
          projectsStore: {
            ...state.projectsStore,
            projects: state.projectsStore.projects.filter((project) => project.id !== projectId),
          }
        }));
      } catch (error) {
        console.error('Error deleting project:', error);
        throw error;
      }
    },
  },

  tagsStore: {
    tags: [],

    fetchAll: async () => {
      try {
        const response = await fetch('/api/tags');
        if (!response.ok) throw new Error('Failed to fetch tags.');
        
        const tags = await response.json();
        set((state) => ({
          tagsStore: {
            ...state.tagsStore,
            tags,
          },
        }));
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    },

    create: async (tagData) => {
      try {
        const response = await fetch('/api/tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tagData),
        });
        if (!response.ok) throw new Error('Failed to create tag.');

        const newTag = await response.json();
        set((state) => ({
          tagsStore: {
            ...state.tagsStore,
            tags: [...state.tagsStore.tags, newTag],
          },
        }));
      } catch (error) {
        console.error('Error creating tag:', error);
        throw error;
      }
    },

    update: async (tagId, tagData) => {
      try {
        const response = await fetch(`/api/tag/${tagId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tagData),
        });
        if (!response.ok) throw new Error('Failed to update tag.');

        const updatedTag = await response.json();
        set((state) => ({
          tagsStore: {
            ...state.tagsStore,
            tags: state.tagsStore.tags.map(tag =>
              tag.id === tagId ? updatedTag : tag
            ),
          },
        }));
      } catch (error) {
        console.error('Error updating tag:', error);
        throw error;
      }
    },

    delete: async (tagId) => {
      try {
        const response = await fetch(`/api/tag/${tagId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete tag.');

        set((state) => ({
          tagsStore: {
            ...state.tagsStore,
            tags: state.tagsStore.tags.filter(tag => tag.id !== tagId),
          },
        }));
      } catch (error) {
        console.error('Error deleting tag:', error);
        throw error;
      }
    },
  },

  tasksStore: {
    tasks: [],

    fetchAll: async (query: string = '') => {
      set({ isLoading: true, isError: false });
      try {
        const response = await fetch(`/api/tasks${query}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch tasks.');
        
        const tasks = await response.json();
        set((state) => ({
          tasksStore: {
            ...state.tasksStore,
            tasks,
          },
          isLoading: false,
        }));
      } catch (error) {
        console.error('Error fetching tasks:', error);
        set({ isError: true, isLoading: false });
      }
    },

    create: async (taskData) => {
      try {
        const response = await fetch('/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(taskData),
        });
        if (!response.ok) throw new Error('Failed to create task.');

        const newTask = await response.json();
        set((state) => ({
          tasksStore: {
            ...state.tasksStore,
            tasks: [newTask, ...state.tasksStore.tasks],
          },
        }));
      } catch (error) {
        console.error('Error creating task:', error);
        throw error;
      }
    },

    update: async (taskId, taskData) => {
      try {
        const response = await fetch(`/api/task/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(taskData),
        });
        if (!response.ok) throw new Error('Failed to update task.');

        const updatedTask = await response.json();
        set((state) => ({
          tasksStore: {
            ...state.tasksStore,
            tasks: state.tasksStore.tasks.map((task) => 
              task.id === taskId ? updatedTask : task
            ),
          },
        }));
      } catch (error) {
        console.error('Error updating task:', error);
        throw error;
      }
    },

    delete: async (taskId) => {
      try {
        const response = await fetch(`/api/task/${taskId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to delete task.');

        set((state) => ({
          tasksStore: {
            ...state.tasksStore,
            tasks: state.tasksStore.tasks.filter((task) => task.id !== taskId),
          },
        }));
      } catch (error) {
        console.error('Error deleting task:', error);
        throw error;
      }
    },
  },
}));
