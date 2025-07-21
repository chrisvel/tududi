import { create } from 'zustand';
import { Project } from '../entities/Project';
import { Area } from '../entities/Area';
import { Note } from '../entities/Note';
import { Task } from '../entities/Task';
import { Tag } from '../entities/Tag';
import { InboxItem } from '../entities/InboxItem';

interface NotesStore {
    notes: Note[];
    isLoading: boolean;
    isError: boolean;
    hasLoaded: boolean;
    setNotes: (notes: Note[]) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (isError: boolean) => void;
    loadNotes: () => Promise<void>;
}

interface AreasStore {
    areas: Area[];
    isLoading: boolean;
    isError: boolean;
    hasLoaded: boolean;
    setAreas: (areas: Area[]) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (isError: boolean) => void;
    loadAreas: () => Promise<void>;
}

interface ProjectsStore {
    projects: Project[];
    currentProject: Project | null;
    isLoading: boolean;
    isError: boolean;
    setProjects: (projects: Project[]) => void;
    setCurrentProject: (project: Project | null) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (isError: boolean) => void;
}

interface TagsStore {
    tags: Tag[];
    isLoading: boolean;
    isError: boolean;
    hasLoaded: boolean;
    setTags: (tags: Tag[]) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (isError: boolean) => void;
    loadTags: () => Promise<void>;
}

interface TasksStore {
    tasks: Task[];
    isLoading: boolean;
    isError: boolean;
    setTasks: (tasks: Task[]) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (isError: boolean) => void;
}

interface InboxStore {
    inboxItems: InboxItem[];
    isLoading: boolean;
    isError: boolean;
    setInboxItems: (inboxItems: InboxItem[]) => void;
    addInboxItem: (inboxItem: InboxItem) => void;
    updateInboxItem: (inboxItem: InboxItem) => void;
    removeInboxItem: (id: number) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (isError: boolean) => void;
}

interface StoreState {
    notesStore: NotesStore;
    areasStore: AreasStore;
    projectsStore: ProjectsStore;
    tagsStore: TagsStore;
    tasksStore: TasksStore;
    inboxStore: InboxStore;
}

export const useStore = create<StoreState>((set) => ({
    notesStore: {
        notes: [],
        isLoading: false,
        isError: false,
        hasLoaded: false,
        setNotes: (notes) =>
            set((state) => ({ notesStore: { ...state.notesStore, notes } })),
        setLoading: (isLoading) =>
            set((state) => ({
                notesStore: { ...state.notesStore, isLoading },
            })),
        setError: (isError) =>
            set((state) => ({ notesStore: { ...state.notesStore, isError } })),
        loadNotes: async () => {
            const state = useStore.getState();
            if (state.notesStore.isLoading) return;

            const { fetchNotes } = await import('../utils/notesService');

            set((state) => ({
                notesStore: {
                    ...state.notesStore,
                    isLoading: true,
                    isError: false,
                },
            }));

            try {
                const notes = await fetchNotes();
                set((state) => ({
                    notesStore: {
                        ...state.notesStore,
                        notes,
                        isLoading: false,
                        hasLoaded: true,
                    },
                }));
            } catch (error) {
                console.error('loadNotes: Failed to load notes:', error);
                set((state) => ({
                    notesStore: {
                        ...state.notesStore,
                        isError: true,
                        isLoading: false,
                        hasLoaded: true,
                    },
                }));
            }
        },
    },
    areasStore: {
        areas: [],
        isLoading: false,
        isError: false,
        hasLoaded: false,
        setAreas: (areas) =>
            set((state) => ({ areasStore: { ...state.areasStore, areas } })),
        setLoading: (isLoading) =>
            set((state) => ({
                areasStore: { ...state.areasStore, isLoading },
            })),
        setError: (isError) =>
            set((state) => ({ areasStore: { ...state.areasStore, isError } })),
        loadAreas: async () => {
            const state = useStore.getState();
            if (state.areasStore.isLoading) return;

            const { fetchAreas } = await import('../utils/areasService');

            set((state) => ({
                areasStore: {
                    ...state.areasStore,
                    isLoading: true,
                    isError: false,
                },
            }));

            try {
                const areas = await fetchAreas();
                set((state) => ({
                    areasStore: {
                        ...state.areasStore,
                        areas,
                        isLoading: false,
                        hasLoaded: true,
                    },
                }));
            } catch (error) {
                console.error('loadAreas: Failed to load areas:', error);
                set((state) => ({
                    areasStore: {
                        ...state.areasStore,
                        isError: true,
                        isLoading: false,
                        hasLoaded: true,
                    },
                }));
            }
        },
    },
    projectsStore: {
        projects: [],
        currentProject: null,
        isLoading: false,
        isError: false,
        setProjects: (projects) =>
            set((state) => ({
                projectsStore: { ...state.projectsStore, projects },
            })),
        setCurrentProject: (currentProject) =>
            set((state) => ({
                projectsStore: { ...state.projectsStore, currentProject },
            })),
        setLoading: (isLoading) =>
            set((state) => ({
                projectsStore: { ...state.projectsStore, isLoading },
            })),
        setError: (isError) =>
            set((state) => ({
                projectsStore: { ...state.projectsStore, isError },
            })),
    },
    tagsStore: {
        tags: [],
        isLoading: false,
        isError: false,
        hasLoaded: false,
        setTags: (tags) =>
            set((state) => ({ tagsStore: { ...state.tagsStore, tags } })),
        setLoading: (isLoading) =>
            set((state) => ({ tagsStore: { ...state.tagsStore, isLoading } })),
        setError: (isError) =>
            set((state) => ({ tagsStore: { ...state.tagsStore, isError } })),
        loadTags: async () => {
            const state = useStore.getState();
            if (state.tagsStore.isLoading) return;

            const { fetchTags } = await import('../utils/tagsService');

            set((state) => ({
                tagsStore: {
                    ...state.tagsStore,
                    isLoading: true,
                    isError: false,
                },
            }));

            try {
                const tags = await fetchTags();
                set((state) => ({
                    tagsStore: {
                        ...state.tagsStore,
                        tags,
                        isLoading: false,
                        hasLoaded: true,
                    },
                }));
            } catch (error) {
                console.error('loadTags: Failed to load tags:', error);
                set((state) => ({
                    tagsStore: {
                        ...state.tagsStore,
                        isError: true,
                        isLoading: false,
                        hasLoaded: true,
                    },
                }));
            }
        },
    },
    tasksStore: {
        tasks: [],
        isLoading: false,
        isError: false,
        setTasks: (tasks) =>
            set((state) => ({ tasksStore: { ...state.tasksStore, tasks } })),
        setLoading: (isLoading) =>
            set((state) => ({
                tasksStore: { ...state.tasksStore, isLoading },
            })),
        setError: (isError) =>
            set((state) => ({ tasksStore: { ...state.tasksStore, isError } })),
    },
    inboxStore: {
        inboxItems: [],
        isLoading: false,
        isError: false,
        setInboxItems: (inboxItems) =>
            set((state) => ({
                inboxStore: { ...state.inboxStore, inboxItems },
            })),
        addInboxItem: (inboxItem) =>
            set((state) => ({
                inboxStore: {
                    ...state.inboxStore,
                    inboxItems: [inboxItem, ...state.inboxStore.inboxItems],
                },
            })),
        updateInboxItem: (inboxItem) =>
            set((state) => ({
                inboxStore: {
                    ...state.inboxStore,
                    inboxItems: state.inboxStore.inboxItems.map((item) =>
                        item.id === inboxItem.id ? inboxItem : item
                    ),
                },
            })),
        removeInboxItem: (id) =>
            set((state) => ({
                inboxStore: {
                    ...state.inboxStore,
                    inboxItems: state.inboxStore.inboxItems.filter(
                        (item) => item.id !== id
                    ),
                },
            })),
        setLoading: (isLoading) =>
            set((state) => ({
                inboxStore: { ...state.inboxStore, isLoading },
            })),
        setError: (isError) =>
            set((state) => ({
                inboxStore: { ...state.inboxStore, isError },
            })),
    },
}));
