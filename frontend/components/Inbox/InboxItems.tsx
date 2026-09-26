import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import {
    loadInboxItemsToStore,
    loadMoreInboxItemsToStore,
    processInboxItemWithStore,
    deleteInboxItemWithStore,
    updateInboxItemWithStore,
    ProcessedInto,
} from '../../utils/inboxService';
import InboxItemDetail from './InboxItemDetail';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { InboxIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import LoadingScreen from '../Shared/LoadingScreen';
import ProjectModal from '../Project/ProjectModal';
import NoteModal from '../Note/NoteModal';
import QuickCaptureInput from './QuickCaptureInput';
import { createTask } from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import { createNote } from '../../utils/notesService';
import { OfflineQueuedError } from '../../utils/authUtils';
import { isUrl } from '../../utils/urlService';
import { takeSharedText } from '../../utils/shareTargetService';
import { fetchAreas } from '../../utils/areasService';
import { fetchProjects } from '../../utils/projectsService';
import {
    getInboxRecentlyCapturedExpanded,
    updateUiSettings,
} from '../../utils/profileService';
import { useStore } from '../../store/useStore';
const InboxItems: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [hasInitialized, setHasInitialized] = useState(false);

    // Content handed over by the OS share sheet (see shareTargetService) is
    // prefilled into the composer rather than captured straight away, so the
    // user can still edit it or pick task/note/project
    const [sharedDraft] = useState<string>(() => takeSharedText() || '');

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

    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);
    const [inboxListExpanded, setInboxListExpanded] = useState(false);
    const [lastAddedUid, setLastAddedUid] = useState<string | null>(null);

    const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
    const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);

    const [currentConversionItemUid, setCurrentConversionItemUid] = useState<
        string | null
    >(null);

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

        getInboxRecentlyCapturedExpanded().then(setInboxListExpanded);

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

    // Track newly-added items: when the list grows while initialized, mark the
    // newest item as "new" (entry animation) and auto-expand the list.
    const prevInboxLengthRef = React.useRef<number>(0);
    useEffect(() => {
        if (!hasInitialized) {
            prevInboxLengthRef.current = inboxItems.length;
            return;
        }
        const prev = prevInboxLengthRef.current;
        const curr = inboxItems.length;
        if (curr > prev && inboxItems[0]?.uid) {
            setLastAddedUid(inboxItems[0].uid);
            setInboxListExpanded(true);
            // Clear the "new" flag after the animation completes
            const timer = setTimeout(() => setLastAddedUid(null), 500);
            prevInboxLengthRef.current = curr;
            return () => clearTimeout(timer);
        }
        prevInboxLengthRef.current = curr;
    }, [inboxItems, hasInitialized]);

    // ── Item handlers ─────────────────────────────────────────────────────────

    const handleProcessItem = async (
        uid: string,
        showToast: boolean = true,
        processedInto?: ProcessedInto
    ) => {
        try {
            await processInboxItemWithStore(uid, processedInto);
            if (showToast) {
                showSuccessToast(t('inbox.itemProcessed'));
            }
        } catch (error) {
            console.error('Failed to process inbox item:', error);
            showErrorToast(t('inbox.processError'));
        }
    };

    const handleUpdateItem = async (
        uid: string,
        newContent: string
    ): Promise<void> => {
        try {
            await updateInboxItemWithStore(uid, newContent);
            showSuccessToast(t('inbox.itemUpdated'));
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

    const createTaskAndHandleConversion = async (
        taskData: Task,
        options: { inboxItemUid?: string; navigateAfterCreate?: boolean } = {}
    ) => {
        try {
            const createdTask = await createTask(taskData);
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

            const inboxUid =
                options.inboxItemUid ?? currentConversionItemUid ?? undefined;

            if (inboxUid) {
                await handleProcessItem(
                    inboxUid,
                    false,
                    createdTask.uid ? { task_uid: createdTask.uid } : undefined
                );
                if (!options.inboxItemUid) {
                    setCurrentConversionItemUid(null);
                }
            }

            if (options.navigateAfterCreate && createdTask.uid) {
                navigate(`/task/${createdTask.uid}`, { state: { from: location.pathname + location.search } });
            }

            return createdTask;
        } catch (error) {
            if (!(error instanceof OfflineQueuedError)) {
                console.error('Failed to create task:', error);
                showErrorToast(t('task.createError'));
            }
            throw error;
        } finally {
            if (options.inboxItemUid) {
                setCurrentConversionItemUid(null);
            }
        }
    };

    const handleOpenTaskModal = async (task: Task, inboxItemUid?: string) => {
        if (inboxItemUid) {
            setCurrentConversionItemUid(inboxItemUid);
        }

        try {
            await createTaskAndHandleConversion(task, {
                inboxItemUid,
                navigateAfterCreate: false,
            });
        } catch (error) {
            if (error instanceof OfflineQueuedError) {
                showSuccessToast(
                    t(
                        'inbox.itemQueuedOffline',
                        "Saved offline. It'll sync automatically once you're back online."
                    )
                );
            }
            // Other errors are already reported via toast notifications
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

    const handleSaveProject = async (project: Project) => {
        try {
            const createdProject = await createProject(project);

            const updatedProjects = await fetchProjects();
            setProjects(updatedProjects);

            const { setProjects: setGlobalProjects } = useStore.getState().projectsStore;
            setGlobalProjects(updatedProjects);

            if (currentConversionItemUid !== null) {
                await handleProcessItem(
                    currentConversionItemUid,
                    false,
                    createdProject?.uid
                        ? { project_uid: createdProject.uid }
                        : undefined
                );
                setCurrentConversionItemUid(null);
            }
        } catch (error) {
            if (error instanceof OfflineQueuedError) {
                showSuccessToast(
                    t(
                        'inbox.itemQueuedOffline',
                        "Saved offline. It'll sync automatically once you're back online."
                    )
                );
                return;
            }
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

            const createdNote = await createNote(note);

            if (currentConversionItemUid !== null) {
                await handleProcessItem(
                    currentConversionItemUid,
                    false,
                    createdNote?.uid ? { note_uid: createdNote.uid } : undefined
                );
                setCurrentConversionItemUid(null);
            }

            setIsNoteModalOpen(false);
        } catch (error) {
            if (error instanceof OfflineQueuedError) {
                throw error;
            }
            console.error('Failed to create note:', error);
            showErrorToast(t('note.createError', 'Failed to create note'));
        }
    };

    const handleCreateProject = async (name: string): Promise<Project> => {
        try {
            const project = await createProject({ name, status: 'planned' });
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
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-8">
            <div className="w-full max-w-7xl mx-auto">
                {/* ── Page header ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-light text-gray-900 dark:text-gray-100">
                        {t('inbox.title')}
                    </h1>
                    <button
                        onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                            isInfoExpanded
                                ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'text-gray-400 dark:text-gray-500 hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                        }`}
                        aria-expanded={isInfoExpanded}
                        aria-label={isInfoExpanded ? 'Collapse info panel' : 'Show inbox information'}
                        title={isInfoExpanded ? 'Hide info' : 'About Inbox'}
                    >
                        <InformationCircleIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* ── Info banner ──────────────────────────────────────────── */}
                <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isInfoExpanded ? 'max-h-48 opacity-100 mb-5' : 'max-h-0 opacity-0 mb-0'
                    }`}
                >
                    <div className="flex gap-3 px-4 py-3.5 bg-blue-50/60 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/20">
                        <InformationCircleIcon className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-[13.5px] text-gray-600 dark:text-gray-300 leading-relaxed">
                            {t(
                                'inbox.infoShort',
                                'Inbox is where uncategorized thoughts land — jot things down, sort them later.'
                            )}{' '}
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">#tag</span>
                            {' '}{t('inbox.shortcutTag', 'to label with a tag')},{' '}
                            <span className="text-green-700 dark:text-green-400 font-semibold">+Project</span>
                            {' '}{t('inbox.shortcutProject', 'to assign to a project')}.
                        </div>
                    </div>
                </div>

                {/* ── Quick capture ────────────────────────────────────────── */}
                <QuickCaptureInput
                    unified
                    projects={projects}
                    initialValue={sharedDraft}
                    autoFocus={true}
                    cardClassName="mb-5"
                    onCaptured={(items) => {
                        if (items.some((item) => item.target === 'project')) {
                            fetchProjects()
                                .then(setProjects)
                                .catch(() => {});
                        }
                    }}
                />

                {/* ── Item list ────────────────────────────────────────────── */}
                {inboxItems.length > 0 && (
                    <>
                        {/* Recently captured – collapsible header */}
                        <button
                            onClick={() =>
                                setInboxListExpanded((prev) => {
                                    const next = !prev;
                                    updateUiSettings({
                                        inbox: { recentlyCapturedExpanded: next },
                                    }).catch(() => {});
                                    return next;
                                })
                            }
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 mt-1 rounded-lg text-left hover:bg-gray-100/60 dark:hover:bg-white/[0.04] transition-colors"
                        >
                            <span className="text-[10.5px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                {t('inbox.recentlyCaptured', 'Recently captured')}
                            </span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                {inboxItems.length}
                            </span>

                            <span className="flex-1" />

                            <svg
                                className={`w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform duration-150 ${inboxListExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>

                        {inboxListExpanded && (
                            <div className="flex flex-col">
                                {/* Normal item list */}
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
                                        isNew={item.uid === lastAddedUid}
                                    />
                                ))}

                                {/* Load more */}
                                {pagination.hasMore && (
                                    <div className="flex justify-center pt-5">
                                        <button
                                            onClick={handleLoadMore}
                                            disabled={isLoading}
                                            className="inline-flex items-center gap-2 px-5 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    {t('inbox.loading', 'Loading…')}
                                                </>
                                            ) : (
                                                <>
                                                    <InboxIcon className="h-3.5 w-3.5" />
                                                    {t('inbox.loadMore', 'Load more')}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Item count */}
                                <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-4 pb-2">
                                    {t(
                                        'inbox.showingItems',
                                        'Showing {{current}} of {{total}} items',
                                        { current: inboxItems.length, total: pagination.total }
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

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
            </div>
        </div>
    );
};

export default InboxItems;
