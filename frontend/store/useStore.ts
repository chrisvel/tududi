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
    loadTasks: (query?: string) => Promise<void>;
    createTask: (taskData: Task) => Promise<Task>;
    updateTask: (taskId: number, taskData: Task) => Promise<Task>;
    deleteTask: (taskId: number) => Promise<void>;
    toggleTaskCompletion: (taskId: number) => Promise<Task>;
    toggleTaskToday: (taskId: number) => Promise<Task>;
    loadTaskById: (taskId: number) => Promise<Task>;
    loadTaskByUuid: (uuid: string) => Promise<Task>;
    loadSubtasks: (parentTaskId: number) => Promise<Task[]>;
    addTask: (task: Task) => void;
    removeTask: (taskId: number) => void;
    updateTaskInStore: (updatedTask: Task) => void;
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
        loadTasks: async (query = '') => {
            const { fetchTasks } = await import('../utils/tasksService');
            set((state) => ({
                tasksStore: {
                    ...state.tasksStore,
                    isLoading: true,
                    isError: false,
                },
            }));
            try {
                const { tasks } = await fetchTasks(query);
                set((state) => ({
                    tasksStore: {
                        ...state.tasksStore,
                        tasks,
                        isLoading: false,
                    },
                }));
            } catch (error) {
                console.error('loadTasks: Failed to load tasks:', error);
                set((state) => ({
                    tasksStore: {
                        ...state.tasksStore,
                        isError: true,
                        isLoading: false,
                    },
                }));
            }
        },
        createTask: async (taskData) => {
            const { createTask } = await import('../utils/tasksService');
            try {
                const newTask = await createTask(taskData);
                set((state) => ({
                    tasksStore: {
                        ...state.tasksStore,
                        tasks: [newTask, ...state.tasksStore.tasks],
                    },
                }));
                return newTask;
            } catch (error) {
                console.error('createTask: Failed to create task:', error);
                set((state) => ({
                    tasksStore: { ...state.tasksStore, isError: true },
                }));
                throw error;
            }
        },
        updateTask: async (taskId, taskData) => {
            const { updateTask } = await import('../utils/tasksService');
            try {
                const updatedTask = await updateTask(taskId, taskData);
                set((state) => ({
                    tasksStore: {
                        ...state.tasksStore,
                        tasks: state.tasksStore.tasks.map((task) =>
                            task.id === taskId ? updatedTask : task
                        ),
                    },
                }));
                return updatedTask;
            } catch (error) {
                console.error('updateTask: Failed to update task:', error);
                set((state) => ({
                    tasksStore: { ...state.tasksStore, isError: true },
                }));
                throw error;
            }
        },
        deleteTask: async (taskId) => {
            const { deleteTask } = await import('../utils/tasksService');
            try {
                await deleteTask(taskId);
                set((state) => ({
                    tasksStore: {
                        ...state.tasksStore,
                        tasks: state.tasksStore.tasks.filter(
                            (task) => task.id !== taskId
                        ),
                    },
                }));
            } catch (error) {
                console.error('deleteTask: Failed to delete task:', error);
                set((state) => ({
                    tasksStore: { ...state.tasksStore, isError: true },
                }));
                throw error;
            }
        },
        toggleTaskCompletion: async (taskId) => {
            const { toggleTaskCompletion } = await import(
                '../utils/tasksService'
            );
            try {
                const updatedTask = await toggleTaskCompletion(taskId);
                set((state) => ({
                    tasksStore: {
                        ...state.tasksStore,
                        tasks: state.tasksStore.tasks.map((task) =>
                            task.id === taskId ? updatedTask : task
                        ),
                    },
                }));
                return updatedTask;
            } catch (error) {
                console.error(
                    'toggleTaskCompletion: Failed to toggle task completion:',
                    error
                );
                set((state) => ({
                    tasksStore: { ...state.tasksStore, isError: true },
                }));
                throw error;
            }
        },
        toggleTaskToday: async (taskId) => {
            const { toggleTaskToday } = await import('../utils/tasksService');
            try {
                const updatedTask = await toggleTaskToday(taskId);
                set((state) => ({
                    tasksStore: {
                        ...state.tasksStore,
                        tasks: state.tasksStore.tasks.map((task) =>
                            task.id === taskId ? updatedTask : task
                        ),
                    },
                }));
                return updatedTask;
            } catch (error) {
                console.error(
                    'toggleTaskToday: Failed to toggle task today status:',
                    error
                );
                set((state) => ({
                    tasksStore: { ...state.tasksStore, isError: true },
                }));
                throw error;
            }
        },
        loadTaskById: async (taskId) => {
            const { fetchTaskById } = await import('../utils/tasksService');
            try {
                const task = await fetchTaskById(taskId);
                set((state) => ({
                    tasksStore: {
                        ...state.tasksStore,
                        tasks: state.tasksStore.tasks.some(
                            (t) => t.id === taskId
                        )
                            ? state.tasksStore.tasks.map((t) =>
                                  t.id === taskId ? task : t
                              )
                            : [task, ...state.tasksStore.tasks],
                    },
                }));
                return task;
            } catch (error) {
                console.error('loadTaskById: Failed to load task:', error);
                set((state) => ({
                    tasksStore: { ...state.tasksStore, isError: true },
                }));
                throw error;
            }
        },
        loadTaskByUuid: async (uuid) => {
            const { fetchTaskByUuid } = await import('../utils/tasksService');
            try {
                const task = await fetchTaskByUuid(uuid);
                set((state) => ({
                    tasksStore: {
                        ...state.tasksStore,
                        tasks: state.tasksStore.tasks.some(
                            (t) => t.uuid === uuid
                        )
                            ? state.tasksStore.tasks.map((t) =>
                                  t.uuid === uuid ? task : t
                              )
                            : [task, ...state.tasksStore.tasks],
                    },
                }));
                return task;
            } catch (error) {
                console.error('loadTaskByUuid: Failed to load task:', error);
                set((state) => ({
                    tasksStore: { ...state.tasksStore, isError: true },
                }));
                throw error;
            }
        },
        loadSubtasks: async (parentTaskId) => {
            const { fetchSubtasks } = await import('../utils/tasksService');
            try {
                const subtasks = await fetchSubtasks(parentTaskId);
                set((state) => ({
                    tasksStore: {
                        ...state.tasksStore,
                        tasks: [
                            ...state.tasksStore.tasks.filter(
                                (task) => task.parent_task_id !== parentTaskId
                            ),
                            ...subtasks,
                        ],
                    },
                }));
                return subtasks;
            } catch (error) {
                console.error('loadSubtasks: Failed to load subtasks:', error);
                set((state) => ({
                    tasksStore: { ...state.tasksStore, isError: true },
                }));
                throw error;
            }
        },
        addTask: (task) =>
            set((state) => ({
                tasksStore: {
                    ...state.tasksStore,
                    tasks: [task, ...state.tasksStore.tasks],
                },
            })),
        removeTask: (taskId) =>
            set((state) => ({
                tasksStore: {
                    ...state.tasksStore,
                    tasks: state.tasksStore.tasks.filter(
                        (task) => task.id !== taskId
                    ),
                },
            })),
        updateTaskInStore: (updatedTask) =>
            set((state) => ({
                tasksStore: {
                    ...state.tasksStore,
                    tasks: state.tasksStore.tasks.map((task) =>
                        task.id === updatedTask.id
                            ? {
                                  ...task,
                                  ...updatedTask,
                                  // Explicitly preserve subtasks data
                                  subtasks:
                                      updatedTask.subtasks ||
                                      updatedTask.Subtasks ||
                                      task.subtasks ||
                                      task.Subtasks ||
                                      [],
                                  Subtasks:
                                      updatedTask.subtasks ||
                                      updatedTask.Subtasks ||
                                      task.subtasks ||
                                      task.Subtasks ||
                                      [],
                              }
                            : task
                    ),
                },
            })),
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
