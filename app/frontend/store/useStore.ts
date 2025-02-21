import { create } from "zustand";
import { Project } from "../entities/Project";
import { Area } from "../entities/Area";
import { Note } from "../entities/Note";
import { Task } from "../entities/Task";
import { Tag } from "../entities/Tag";

interface NotesStore {
  notes: Note[];
  isLoading: boolean;
  isError: boolean;
  setNotes: (notes: Note[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (isError: boolean) => void;
}

interface AreasStore {
  areas: Area[];
  isLoading: boolean;
  isError: boolean;
  setAreas: (areas: Area[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (isError: boolean) => void;
}

interface ProjectsStore {
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
  setProjects: (projects: Project[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (isError: boolean) => void;
}

interface TagsStore {
  tags: Tag[];
  isLoading: boolean;
  isError: boolean;
  setTags: (tags: Tag[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (isError: boolean) => void;
}

interface TasksStore {
  tasks: Task[];
  isLoading: boolean;
  isError: boolean;
  setTasks: (tasks: Task[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (isError: boolean) => void;
}

interface StoreState {
  notesStore: NotesStore;
  areasStore: AreasStore;
  projectsStore: ProjectsStore;
  tagsStore: TagsStore;
  tasksStore: TasksStore;
}

export const useStore = create<StoreState>((set) => ({
  notesStore: {
    notes: [],
    isLoading: false,
    isError: false,
    setNotes: (notes) => set((state) => ({ notesStore: { ...state.notesStore, notes } })),
    setLoading: (isLoading) => set((state) => ({ notesStore: { ...state.notesStore, isLoading } })),
    setError: (isError) => set((state) => ({ notesStore: { ...state.notesStore, isError } })),
  },
  areasStore: {
    areas: [],
    isLoading: false,
    isError: false,
    setAreas: (areas) => set((state) => ({ areasStore: { ...state.areasStore, areas } })),
    setLoading: (isLoading) => set((state) => ({ areasStore: { ...state.areasStore, isLoading } })),
    setError: (isError) => set((state) => ({ areasStore: { ...state.areasStore, isError } })),
  },
  projectsStore: {
    projects: [],
    isLoading: false,
    isError: false,
    setProjects: (projects) => set((state) => ({ projectsStore: { ...state.projectsStore, projects } })),
    setLoading: (isLoading) => set((state) => ({ projectsStore: { ...state.projectsStore, isLoading } })),
    setError: (isError) => set((state) => ({ projectsStore: { ...state.projectsStore, isError } })),
  },
  tagsStore: {
    tags: [],
    isLoading: false,
    isError: false,
    setTags: (tags) => set((state) => ({ tagsStore: { ...state.tagsStore, tags } })),
    setLoading: (isLoading) => set((state) => ({ tagsStore: { ...state.tagsStore, isLoading } })),
    setError: (isError) => set((state) => ({ tagsStore: { ...state.tagsStore, isError } })),
  },
  tasksStore: {
    tasks: [],
    isLoading: false,
    isError: false,
    setTasks: (tasks) => set((state) => ({ tasksStore: { ...state.tasksStore, tasks } })),
    setLoading: (isLoading) => set((state) => ({ tasksStore: { ...state.tasksStore, isLoading } })),
    setError: (isError) => set((state) => ({ tasksStore: { ...state.tasksStore, isError } })),
  },
}));