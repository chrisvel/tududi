import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import {
    loadInboxItemsToStore,
    loadMoreInboxItemsToStore,
    processInboxItemWithStore,
    deleteInboxItemWithStore,
    updateInboxItemWithStore,
} from '../../utils/inboxService';
import InboxItemDetail from './InboxItemDetail';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { InboxIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import LoadingScreen from '../Shared/LoadingScreen';
import TaskModal from '../Task/TaskModal';
import ProjectModal from '../Project/ProjectModal';
import NoteModal from '../Note/NoteModal';
import InboxModal from './InboxModal';
import { createTask } from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import { createNote } from '../../utils/notesService';
import { isUrl } from '../../utils/urlService';
import { fetchAreas } from '../../utils/areasService';
import { fetchProjects } from '../../utils/projectsService';
import { useStore } from '../../store/useStore';

const InboxItems: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    const [hasInitialized, setHasInitialized] = useState(false);

    const { inboxItems, isLoading, pagination } = useStore(
        (state) => state.inboxStore
    );
    const {
        areas,
        setAreas,
        setError: setAreasError,
    } = useStore((state) => state.areasStore);
    const {
        loadTags,
        hasLoaded: tagsHasLoaded,
        isLoading: tagsLoading,
    } = useStore((state) => state.tagsStore);

    const [projects, setProjects] = useState<Project[]>([]);

    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);

    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
    const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);

    const [currentConversionItemUid, setCurrentConversionItemUid] = useState<
        string | null
    >(null);

    const [itemToEdit, setItemToEdit] = useState<string | null>(null);

    const defaultTask = useMemo(
        () => ({
            name: '',
            status: 'not_started' as const,
            priority: null,
            completed_at: null,
        }),
        []
    );

    useEffect(() => {
        const urlPageSize = searchParams.get('loaded');
        const currentLoadedCount = urlPageSize ? parseInt(urlPageSize, 10) : 20;

        loadInboxItemsToStore(true, currentLoadedCount);
        setHasInitialized(true);

        const loadInitialProjects = async () => {
            try {
                const projectData = await fetchProjects();
                setProjects(Array.isArray(projectData) ? projectData : []);
            } catch (error) {
                console.error('Failed to load initial projects:', error);
                setProjects([]);
            }
        };
        loadInitialProjects();

        const loadInitialAreas = async () => {
            try {
                const areasData = await fetchAreas();
                setAreas(areasData);
            } catch (error) {
                console.error('Failed to load initial areas:', error);
                setAreasError(true);
            }
        };
        loadInitialAreas();

        const loadInitialTags = async () => {
            if (!tagsHasLoaded && !tagsLoading) {
                try {
                    await loadTags();
                } catch (error) {
                    console.error('Failed to load initial tags:', error);
                }
            }
        };
        loadInitialTags();
        const handleForceReload = () => {
            setTimeout(() => {
                const currentInboxStore = useStore.getState().inboxStore;
                const currentCount = currentInboxStore.inboxItems.length;
                loadInboxItemsToStore(false, currentCount);
            }, 500);
        };

        const handleInboxItemsUpdated = (
            event: CustomEvent<{ count: number; firstItemContent: string }>
        ) => {
            if (event.detail.count > 0) {
                showSuccessToast(
                    t(
                        'inbox.newTelegramItem',
                        'New item from Telegram: {{content}}',
                        {
                            content: event.detail.firstItemContent,
                        }
                    )
                );

                if (event.detail.count > 1) {
                    showSuccessToast(
                        t(
                            'inbox.multipleNewItems',
                            '{{count}} more new items added',
                            {
                                count: event.detail.count - 1,
                            }
                        )
                    );
                }
            }
        };

        const pollInterval = setInterval(() => {
            const currentInboxStore = useStore.getState().inboxStore;
            const currentCount = currentInboxStore.inboxItems.length;
            loadInboxItemsToStore(false, currentCount);
        }, 15000);

        window.addEventListener('forceInboxReload', handleForceReload);
        window.addEventListener(
            'inboxItemsUpdated',
            handleInboxItemsUpdated as EventListener
        );

        return () => {
            clearInterval(pollInterval);
            window.removeEventListener('forceInboxReload', handleForceReload);
            window.removeEventListener(
                'inboxItemsUpdated',
                handleInboxItemsUpdated as EventListener
            );
        };
    }, [t, showSuccessToast]);

    useEffect(() => {
        if (!hasInitialized) return;

        const urlPageSize = searchParams.get('loaded');
        const urlLoadedCount = urlPageSize ? parseInt(urlPageSize, 10) : 0;

        if (inboxItems.length > 20 && inboxItems.length !== urlLoadedCount) {
            setSearchParams(
                { loaded: inboxItems.length.toString() },
                { replace: true }
            );
        } else if (inboxItems.length <= 20 && urlLoadedCount > 0) {
            setSearchParams({}, { replace: true });
        }
    }, [inboxItems.length, hasInitialized]);

    const handleProcessItem = async (
        uid: string,
        showToast: boolean = true
    ) => {
        try {
            await processInboxItemWithStore(uid);
            if (showToast) {
                showSuccessToast(t('inbox.itemProcessed'));
            }
        } catch (error) {
            console.error('Failed to process inbox item:', error);
            showErrorToast(t('inbox.processError'));
        }
    };

    const handleUpdateItem = async (uid: string): Promise<void> => {
        setItemToEdit(uid);
        setIsEditModalOpen(true);
    };

    const handleSaveEditedItem = async (text: string) => {
        try {
            if (itemToEdit !== null) {
                await updateInboxItemWithStore(itemToEdit, text);
                showSuccessToast(t('inbox.itemUpdated'));
            }
            setIsEditModalOpen(false);
            setItemToEdit(null);
        } catch (error) {
            console.error('Failed to update inbox item:', error);
            showErrorToast(t('inbox.updateError'));
        }
    };

    const handleDeleteItem = async (uid: string) => {
        try {
            await deleteInboxItemWithStore(uid);
            showSuccessToast(t('inbox.itemDeleted'));
        } catch (error) {
            console.error('Failed to delete inbox item:', error);
            showErrorToast(t('inbox.deleteError'));
        }
    };

    const handleOpenTaskModal = async (task: Task, inboxItemUid?: string) => {
        try {
            try {
                const projectData = await fetchProjects();
                setProjects(Array.isArray(projectData) ? projectData : []);
            } catch (error) {
                console.error('Failed to load projects:', error);
                showErrorToast(
                    t('project.loadError', 'Failed to load projects')
                );
                setProjects([]);
            }

            setTaskToEdit(task);

            if (inboxItemUid) {
                setCurrentConversionItemUid(inboxItemUid);
            }

            setIsTaskModalOpen(true);
        } catch (error) {
            console.error('Failed to open task modal:', error);
        }
    };

    const handleOpenProjectModal = async (
        project: Project | null,
        inboxItemUid?: string
    ) => {
        try {
            try {
                const areasData = await fetchAreas();
                setAreas(areasData);
            } catch (error) {
                console.error('Failed to load areas:', error);
                showErrorToast(t('area.loadError', 'Failed to load areas'));
                setAreas([]);
            }

            setProjectToEdit(project);

            if (inboxItemUid) {
                setCurrentConversionItemUid(inboxItemUid);
            }

            setIsProjectModalOpen(true);
        } catch (error) {
            console.error('Failed to open project modal:', error);
        }
    };

    const handleOpenNoteModal = async (
        note: Note | null,
        inboxItemUid?: string
    ) => {
        if (note && note.content && isUrl(note.content.trim())) {
            if (!note.tags) {
                note.tags = [{ name: 'bookmark' }];
            } else if (!note.tags.some((tag) => tag.name === 'bookmark')) {
                note.tags.push({ name: 'bookmark' });
            }
        }

        setNoteToEdit(note);

        if (inboxItemUid) {
            setCurrentConversionItemUid(inboxItemUid);
        }

        setIsNoteModalOpen(true);
    };

    const handleSaveTask = async (task: Task) => {
        try {
            const createdTask = await createTask(task);
            const taskLink = (
                <span>
                    {t('task.created', 'Task')}{' '}
                    <a
                        href={`/task/${createdTask.uid}`}
                        className="text-green-200 underline hover:text-green-100"
                    >
                        {createdTask.name}
                    </a>{' '}
                    {t('task.createdSuccessfully', 'created successfully!')}
                </span>
            );
            showSuccessToast(taskLink);

            if (currentConversionItemUid !== null) {
                await handleProcessItem(currentConversionItemUid, false);
                setCurrentConversionItemUid(null);
            }

            setIsTaskModalOpen(false);
        } catch (error) {
            console.error('Failed to create task:', error);
            showErrorToast(t('task.createError'));
        }
    };

    const handleSaveProject = async (project: Project) => {
        try {
            await createProject(project);
            showSuccessToast(t('project.createSuccess'));

            if (currentConversionItemUid !== null) {
                await handleProcessItem(currentConversionItemUid, false);
                setCurrentConversionItemUid(null);
            }
        } catch (error) {
            console.error('Failed to create project:', error);
            showErrorToast(t('project.createError'));
        }
    };

    const handleSaveNote = async (note: Note) => {
        try {
            const noteContent = note.content || '';
            const isBookmarkContent = isUrl(noteContent.trim());

            if (!note.tags) {
                note.tags = [];
            }

            if (
                isBookmarkContent &&
                !note.tags.some((tag) => tag.name === 'bookmark')
            ) {
                note.tags = [...note.tags, { name: 'bookmark' }];
            }

            await createNote(note);
            showSuccessToast(
                t('note.createSuccess', 'Note created successfully')
            );

            if (currentConversionItemUid !== null) {
                await handleProcessItem(currentConversionItemUid, false);
                setCurrentConversionItemUid(null);
            }

            setIsNoteModalOpen(false);
        } catch (error) {
            console.error('Failed to create note:', error);
            showErrorToast(t('note.createError', 'Failed to create note'));
        }
    };

    const handleCreateProject = async (name: string): Promise<Project> => {
        try {
            const project = await createProject({ name, state: 'planned' });
            showSuccessToast(t('project.createSuccess'));
            return project;
        } catch (error) {
            console.error('Failed to create project:', error);
            showErrorToast(t('project.createError'));
            throw error;
        }
    };

    const handleLoadMore = async () => {
        try {
            await loadMoreInboxItemsToStore();
        } catch (error) {
            console.error('Failed to load more inbox items:', error);
            showErrorToast(
                t('inbox.loadMoreError', 'Failed to load more items')
            );
        }
    };

    if (isLoading && inboxItems.length === 0) {
        return <LoadingScreen />;
    }

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full max-w-5xl mx-auto">
                <div className="flex items-center mb-8 justify-between">
                    <div className="flex items-center">
                        <h1 className="text-2xl font-light">
                            {t('inbox.title')}
                        </h1>
                    </div>
                    <button
                        onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                        className={`flex items-center hover:bg-blue-100/50 dark:hover:bg-blue-800/20 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg${isInfoExpanded ? ' bg-blue-50/70 dark:bg-blue-900/20' : ''} p-2`}
                        aria-expanded={isInfoExpanded}
                        aria-label={
                            isInfoExpanded
                                ? 'Collapse info panel'
                                : 'Show inbox information'
                        }
                        title={isInfoExpanded ? 'Hide info' : 'About Inbox'}
                    >
                        <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                        <span className="sr-only">
                            {isInfoExpanded ? 'Hide info' : 'About Inbox'}
                        </span>
                    </button>
                </div>

                <div
                    className={`transition-all duration-300 ease-in-out ${
                        isInfoExpanded
                            ? 'max-h-96 opacity-100 mb-6'
                            : 'max-h-0 opacity-0 mb-0'
                    } overflow-hidden`}
                >
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg px-6 py-5 flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <InformationCircleIcon className="h-12 w-12 text-blue-400 opacity-20" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                {t(
                                    'taskViews.inbox',
                                    "Inbox is where all uncategorized tasks are located. Tasks that have not been assigned to a project or don't have a due date will appear here. This is your 'brain dump' area where you can quickly note down tasks and organize them later."
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {inboxItems.length === 0 ? (
                    <div className="flex justify-center items-center mt-4">
                        <div className="w-full max-w bg-black/2 dark:bg-gray-900/25 rounded-l px-10 py-24 flex flex-col items-center opacity-95">
                            <InboxIcon className="h-20 w-20 text-gray-400 opacity-30 mb-6" />
                            <p className="text-2xl font-light text-center text-gray-600 dark:text-gray-300 mb-2">
                                {t('inbox.empty')}
                            </p>
                            <p className="text-base text-center text-gray-400 dark:text-gray-400">
                                {t('inbox.emptyDescription')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            {inboxItems.map((item) => (
                                <InboxItemDetail
                                    key={item.uid || item.id}
                                    item={item}
                                    onDelete={handleDeleteItem}
                                    onUpdate={handleUpdateItem}
                                    openTaskModal={handleOpenTaskModal}
                                    openProjectModal={handleOpenProjectModal}
                                    openNoteModal={handleOpenNoteModal}
                                    projects={projects}
                                />
                            ))}
                        </div>

                        {pagination.hasMore && (
                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoading}
                                    className="inline-flex items-center px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg
                                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                ></circle>
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                ></path>
                                            </svg>
                                            {t('inbox.loading', 'Loading...')}
                                        </>
                                    ) : (
                                        <>
                                            <InboxIcon className="h-4 w-4 mr-2" />
                                            {t(
                                                'inbox.loadMore',
                                                'Load more inbox items'
                                            )}
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {inboxItems.length > 0 && (
                            <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2">
                                {t(
                                    'inbox.showingItems',
                                    'Showing {{current}} of {{total}} items',
                                    {
                                        current: inboxItems.length,
                                        total: pagination.total,
                                    }
                                )}
                            </div>
                        )}
                    </div>
                )}

                {(() => {
                    try {
                        return (
                            <TaskModal
                                isOpen={isTaskModalOpen}
                                onClose={() => {
                                    setIsTaskModalOpen(false);
                                    setTaskToEdit(null);
                                }}
                                task={taskToEdit || defaultTask}
                                onSave={handleSaveTask}
                                onDelete={async () => {}}
                                projects={
                                    Array.isArray(projects) ? projects : []
                                }
                                onCreateProject={handleCreateProject}
                                showToast={false}
                            />
                        );
                    } catch (error) {
                        console.error('TaskModal rendering error:', error);
                        return null;
                    }
                })()}

                {(() => {
                    return (
                        isProjectModalOpen &&
                        (() => {
                            try {
                                return (
                                    <ProjectModal
                                        isOpen={isProjectModalOpen}
                                        onClose={() => {
                                            setIsProjectModalOpen(false);
                                            setProjectToEdit(null);
                                        }}
                                        onSave={handleSaveProject}
                                        project={projectToEdit || undefined}
                                        areas={
                                            Array.isArray(areas) ? areas : []
                                        }
                                    />
                                );
                            } catch (error) {
                                console.error(
                                    'ProjectModal rendering error:',
                                    error
                                );
                                return null;
                            }
                        })()
                    );
                })()}

                {(() => {
                    try {
                        return (
                            <NoteModal
                                isOpen={isNoteModalOpen}
                                onClose={() => {
                                    setIsNoteModalOpen(false);
                                    setNoteToEdit(null);
                                }}
                                onSave={handleSaveNote}
                                note={noteToEdit}
                                projects={
                                    Array.isArray(projects) ? projects : []
                                }
                                onCreateProject={handleCreateProject}
                            />
                        );
                    } catch (error) {
                        console.error('NoteModal rendering error:', error);
                        return null;
                    }
                })()}

                {isEditModalOpen && itemToEdit !== null && (
                    <InboxModal
                        isOpen={isEditModalOpen}
                        onClose={() => {
                            setIsEditModalOpen(false);
                            setItemToEdit(null);
                        }}
                        onSave={handleSaveTask}
                        onSaveNote={handleSaveNote}
                        initialText={
                            inboxItems.find((item) => item.uid === itemToEdit)
                                ?.content || ''
                        }
                        editMode={true}
                        onEdit={handleSaveEditedItem}
                        onConvertToTask={async () => {
                            if (itemToEdit !== null) {
                                await handleProcessItem(itemToEdit);
                            }
                        }}
                        onConvertToNote={async () => {
                            if (itemToEdit !== null) {
                                await handleProcessItem(itemToEdit);
                            }
                        }}
                        projects={projects}
                    />
                )}
            </div>
        </div>
    );
};

export default InboxItems;
