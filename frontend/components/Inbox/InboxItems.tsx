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
    trashInboxItemWithStore,
    restoreAllTrashedWithStore,
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
import { isUrl } from '../../utils/urlService';
import { fetchAreas } from '../../utils/areasService';
import { fetchProjects } from '../../utils/projectsService';
import { useStore } from '../../store/useStore';
import ClarifyOverlay, { ClarifyStep, ClarifyOutcome } from './ClarifyOverlay';
import { ENABLE_INBOX_CLARIFY } from '../../config/featureFlags';

interface ClarifyState {
    active: boolean;
    itemUids: string[];
    currentIndex: number;
    step: ClarifyStep;
    history: Array<{ step: ClarifyStep }>;
    singleMode: boolean;
    pendingModalUid: string | null;
}

const CLARIFY_INITIAL: ClarifyState = {
    active: false,
    itemUids: [],
    currentIndex: 0,
    step: 'actionable',
    history: [],
    singleMode: false,
    pendingModalUid: null,
};

const InboxItems: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [hasInitialized, setHasInitialized] = useState(false);

    const { inboxItems, isLoading, pagination, trashedCount } = useStore(
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

    const [clarify, setClarify] = useState<ClarifyState>(CLARIFY_INITIAL);

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

    // ── Clarify lifecycle ─────────────────────────────────────────────────────

    const startClarify = () => {
        const uids = inboxItems.map((i) => i.uid).filter((uid): uid is string => Boolean(uid));
        if (uids.length === 0) return;
        setInboxListExpanded(true);
        setClarify({
            active: true,
            itemUids: uids,
            currentIndex: 0,
            step: 'actionable',
            history: [],
            singleMode: false,
            pendingModalUid: null,
        });
    };

    const startSingleClarify = (uid: string) => {
        setInboxListExpanded(true);
        setClarify({
            active: true,
            itemUids: [uid],
            currentIndex: 0,
            step: 'actionable',
            history: [],
            singleMode: true,
            pendingModalUid: null,
        });
    };

    const exitClarify = () => setClarify(CLARIFY_INITIAL);

    const advanceClarify = () => {
        setClarify((prev) => ({
            ...prev,
            currentIndex: prev.currentIndex + 1,
            step: 'actionable',
            history: [],
            pendingModalUid: null,
        }));
    };

    const stepClarifyTo = (step: ClarifyStep) => {
        setClarify((prev) => ({
            ...prev,
            step,
            history: [...prev.history, { step: prev.step }],
        }));
    };

    const goBackClarify = () => {
        setClarify((prev) => {
            const history = [...prev.history];
            const last = history.pop();
            if (!last) return prev;
            return { ...prev, step: last.step, history };
        });
    };

    const fileClarifyOutcome = async (outcome: ClarifyOutcome) => {
        const uid = clarify.itemUids[clarify.currentIndex];
        if (!uid) return;
        const item = inboxItems.find((i) => i.uid === uid);
        const itemName = item?.title?.trim() || item?.content?.trim() || '';

        if (outcome === 'trash' || outcome === 'done') {
            try {
                await trashInboxItemWithStore(uid);
            } catch {
                showErrorToast(t('inbox.trashError', 'Failed to trash item'));
                return;
            }
            advanceClarify();
            return;
        }

        if (outcome === 'someday') {
            try {
                await createTask({
                    name: itemName,
                    status: 'not_started',
                    priority: null,
                    completed_at: null,
                    tags: [{ name: 'someday' }],
                });
                await processInboxItemWithStore(uid);
                showSuccessToast(t('inbox.somedayCreated', 'Added to Someday'));
            } catch {
                showErrorToast(t('task.createError'));
                return;
            }
            advanceClarify();
            return;
        }

        if (outcome === 'task') {
            try {
                await createTask({ name: itemName, status: 'not_started', priority: null, completed_at: null });
                await processInboxItemWithStore(uid);
                showSuccessToast(t('task.createdSuccessfully', 'Task created successfully!'));
            } catch {
                showErrorToast(t('task.createError'));
                return;
            }
            advanceClarify();
            return;
        }

        if (outcome === 'waiting') {
            try {
                await createTask({ name: itemName, status: 'waiting', priority: null, completed_at: null, tags: [{ name: 'waiting-for' }] });
                await processInboxItemWithStore(uid);
                showSuccessToast(t('task.createdSuccessfully', 'Task created successfully!'));
            } catch {
                showErrorToast(t('task.createError'));
                return;
            }
            advanceClarify();
            return;
        }

        // Modal-based outcomes: open the modal; advance happens in modal's onSave
        setClarify((prev) => ({ ...prev, pendingModalUid: uid }));

        if (outcome === 'note') {
            const noteContent = item?.content || '';
            await handleOpenNoteModal({ title: itemName, content: noteContent }, uid);
        } else if (outcome === 'project') {
            handleOpenProjectModal({ name: itemName, description: '', status: 'planned' as const }, uid);
        }
    };

    // ── Item handlers ─────────────────────────────────────────────────────────

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
                await handleProcessItem(inboxUid, false);
                if (!options.inboxItemUid) {
                    setCurrentConversionItemUid(null);
                }
            }

            if (options.navigateAfterCreate && createdTask.uid) {
                navigate(`/task/${createdTask.uid}`, { state: { from: location.pathname + location.search } });
            }

            return createdTask;
        } catch (error) {
            console.error('Failed to create task:', error);
            showErrorToast(t('task.createError'));
            throw error;
        } finally {
            if (options.inboxItemUid) {
                setCurrentConversionItemUid(null);
                if (clarify.pendingModalUid) {
                    advanceClarify();
                }
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
        } catch {
            // Errors are already reported via toast notifications
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
        await createTaskAndHandleConversion(task);
    };

    const handleSaveProject = async (project: Project) => {
        try {
            await createProject(project);

            const updatedProjects = await fetchProjects();
            setProjects(updatedProjects);

            const { setProjects: setGlobalProjects } = useStore.getState().projectsStore;
            setGlobalProjects(updatedProjects);

            if (currentConversionItemUid !== null) {
                await handleProcessItem(currentConversionItemUid, false);
                setCurrentConversionItemUid(null);
                if (clarify.pendingModalUid) {
                    advanceClarify();
                }
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
                if (clarify.pendingModalUid) {
                    advanceClarify();
                }
            }

            setIsNoteModalOpen(false);
        } catch (error) {
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
                    onTaskCreate={handleSaveTask}
                    onNoteCreate={handleSaveNote}
                    projects={projects}
                    autoFocus={true}
                    openTaskModal={handleOpenTaskModal}
                    openProjectModal={handleOpenProjectModal}
                    openNoteModal={handleOpenNoteModal}
                    cardClassName="mb-5"
                />

                {/* ── Item list ────────────────────────────────────────────── */}
                {inboxItems.length > 0 && (
                    <>
                        {/* Recently captured – collapsible header */}
                        <button
                            onClick={() => setInboxListExpanded(prev => !prev)}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 mt-1 rounded-lg text-left hover:bg-gray-100/60 dark:hover:bg-white/[0.04] transition-colors"
                        >
                            <span className="text-[10.5px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                {t('inbox.recentlyCaptured', 'Recently captured')}
                            </span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                {inboxItems.length}
                            </span>

                            {/* Process N button */}
                            {ENABLE_INBOX_CLARIFY && inboxItems.length > 0 && !clarify.active && (
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); startClarify(); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); startClarify(); } }}
                                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:opacity-75 transition-opacity cursor-pointer"
                                >
                                    {t('inbox.processN', 'Process {{count}}', { count: inboxItems.length })}
                                </span>
                            )}

                            {/* Trashed affordance */}
                            {ENABLE_INBOX_CLARIFY && trashedCount > 0 && (
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void (async () => {
                                            try {
                                                await restoreAllTrashedWithStore();
                                                showSuccessToast(t('inbox.restored', 'Trashed items restored'));
                                            } catch {
                                                showErrorToast(t('inbox.restoreError', 'Failed to restore'));
                                            }
                                        })();
                                    }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}
                                    className="text-[10.5px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                                >
                                    {t('inbox.trashedRestore', '{{count}} trashed · restore', { count: trashedCount })}
                                </span>
                            )}

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
                                {/* Clarify overlay — shown instead of the list when active */}
                                {ENABLE_INBOX_CLARIFY && clarify.active && !clarify.pendingModalUid && (() => {
                                    const uid = clarify.itemUids[clarify.currentIndex];
                                    const currentItem = inboxItems.find((i) => i.uid === uid);
                                    const isDone = clarify.currentIndex >= clarify.itemUids.length;
                                    return (
                                        <ClarifyOverlay
                                            itemText={currentItem?.title?.trim() || currentItem?.content?.trim() || ''}
                                            step={clarify.step}
                                            progress={`${Math.min(clarify.currentIndex + 1, clarify.itemUids.length)} of ${clarify.itemUids.length}`}
                                            canGoBack={clarify.history.length > 0}
                                            isDone={isDone}
                                            onStepTo={stepClarifyTo}
                                            onFile={(outcome) => void fileClarifyOutcome(outcome)}
                                            onBack={goBackClarify}
                                            onExit={exitClarify}
                                        />
                                    );
                                })()}

                                {/* Normal item list */}
                                {(!ENABLE_INBOX_CLARIFY || !clarify.active) && inboxItems.map((item) => (
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
                                        onReClarify={ENABLE_INBOX_CLARIFY ? startSingleClarify : undefined}
                                    />
                                ))}

                                {/* Load more */}
                                {(!ENABLE_INBOX_CLARIFY || !clarify.active) && pagination.hasMore && (
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
                                {(!ENABLE_INBOX_CLARIFY || !clarify.active) && (
                                    <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-4 pb-2">
                                        {t(
                                            'inbox.showingItems',
                                            'Showing {{current}} of {{total}} items',
                                            { current: inboxItems.length, total: pagination.total }
                                        )}
                                    </div>
                                )}
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
                                            if (clarify.pendingModalUid) {
                                                setClarify((prev) => ({ ...prev, pendingModalUid: null }));
                                            }
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
                                    if (clarify.pendingModalUid) {
                                        setClarify((prev) => ({ ...prev, pendingModalUid: null }));
                                    }
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
