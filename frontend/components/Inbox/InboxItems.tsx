import React, { useState, useEffect } from 'react';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import {
    loadInboxItemsToStore,
    processInboxItemWithStore,
    deleteInboxItemWithStore,
    updateInboxItemWithStore,
} from '../../utils/inboxService';
import InboxItemDetail from './InboxItemDetail';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { InboxIcon } from '@heroicons/react/24/outline';
import LoadingScreen from '../Shared/LoadingScreen';
import TaskModal from '../Task/TaskModal';
import ProjectModal from '../Project/ProjectModal';
import NoteModal from '../Note/NoteModal';
import InboxModal from './InboxModal';
import { fetchProjects } from '../../utils/projectsService';
import { createTask } from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import { createNote } from '../../utils/notesService';
import { isUrl } from '../../utils/urlService';
import { useStore } from '../../store/useStore';

const InboxItems: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    // Access store data
    const { inboxItems, isLoading } = useStore((state) => state.inboxStore);

    // Modal states
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isInfoExpanded, setIsInfoExpanded] = useState(false); 

    // Data for modals
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
    const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);

    // Track the current inbox item ID being converted (for task/project/note conversion)
    const [currentConversionItemId, setCurrentConversionItemId] = useState<
        number | null
    >(null);

    // Track the current inbox item being edited
    const [itemToEdit, setItemToEdit] = useState<number | null>(null);

    // Fetch projects for modals
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        // Initial data loading
        loadInboxItemsToStore(true);

        // Set up an event listener for force reload
        const handleForceReload = () => {
            // Wait a short time to ensure the backend has processed the new item
            setTimeout(() => {
                loadInboxItemsToStore(false); // Don't show loading state during forced reload
            }, 500);
        };

        // Handler for the inboxItemsUpdated custom event
        const handleInboxItemsUpdated = (
            event: CustomEvent<{ count: number; firstItemContent: string }>
        ) => {
            // Show toast notifications for new items
            if (event.detail.count > 0) {
                // Show notification for the first new item
                showSuccessToast(
                    t(
                        'inbox.newTelegramItem',
                        'New item from Telegram: {{content}}',
                        {
                            content: event.detail.firstItemContent,
                        }
                    )
                );

                // If multiple new items, show a summary notification as well
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

        // Set up polling for new inbox items (especially from Telegram)
        // This ensures real-time updates when items are added externally
        // Use a reasonable interval that balances responsiveness with performance
        const pollInterval = setInterval(() => {
            loadInboxItemsToStore(false); // Don't show loading state during polling
        }, 15000); // Check for new items every 15 seconds

        // Add event listeners
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
    }, [t, showSuccessToast]); // Include dependencies that are actually used

    const handleProcessItem = async (id: number) => {
        try {
            await processInboxItemWithStore(id);
            showSuccessToast(t('inbox.itemProcessed'));
        } catch (error) {
            console.error('Failed to process inbox item:', error);
            showErrorToast(t('inbox.processError'));
        }
    };

    const handleUpdateItem = async (id: number): Promise<void> => {
        // When edit button is clicked, we open the InboxModal instead of doing inline editing
        setItemToEdit(id);
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

    const handleDeleteItem = async (id: number) => {
        try {
            await deleteInboxItemWithStore(id);
            showSuccessToast(t('inbox.itemDeleted'));
        } catch (error) {
            console.error('Failed to delete inbox item:', error);
            showErrorToast(t('inbox.deleteError'));
        }
    };

    // Modal handlers
    const handleOpenTaskModal = async (task: Task, inboxItemId?: number) => {
        // Load projects first before opening the modal
        try {
            const projectData = await fetchProjects();
            // Make sure we always set an array
            setProjects(Array.isArray(projectData) ? projectData : []);
        } catch (error) {
            console.error('Failed to load projects:', error);
            showErrorToast(t('project.loadError', 'Failed to load projects'));
            setProjects([]); // Ensure we have an empty array even on error
        }

        setTaskToEdit(task);

        if (inboxItemId) {
            setCurrentConversionItemId(inboxItemId);
        }

        setIsTaskModalOpen(true);
    };

    const handleOpenProjectModal = (
        project: Project | null,
        inboxItemId?: number
    ) => {
        setProjectToEdit(project);

        if (inboxItemId) {
            setCurrentConversionItemId(inboxItemId);
        }

        setIsProjectModalOpen(true);
    };

    const handleOpenNoteModal = async (
        note: Note | null,
        inboxItemId?: number
    ) => {
        // Load projects first before opening the modal
        try {
            const projectData = await fetchProjects();
            // Make sure we always set an array
            setProjects(Array.isArray(projectData) ? projectData : []);
        } catch (error) {
            console.error('Failed to load projects:', error);
            showErrorToast(t('project.loadError', 'Failed to load projects'));
            setProjects([]); // Ensure we have an empty array even on error
        }

        // If note has content that's a URL, ensure it has a bookmark tag
        if (note && note.content && isUrl(note.content.trim())) {
            if (!note.tags) {
                note.tags = [{ name: 'bookmark' }];
            } else if (!note.tags.some((tag) => tag.name === 'bookmark')) {
                note.tags.push({ name: 'bookmark' });
            }
        }

        setNoteToEdit(note);

        if (inboxItemId) {
            setCurrentConversionItemId(inboxItemId);
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
                        href={`/task/${createdTask.uuid}`}
                        className="text-green-200 underline hover:text-green-100"
                    >
                        {createdTask.name}
                    </a>{' '}
                    {t('task.createdSuccessfully', 'created successfully!')}
                </span>
            );
            showSuccessToast(taskLink);

            // Process the inbox item after successful task creation
            if (currentConversionItemId !== null) {
                await handleProcessItem(currentConversionItemId);
                setCurrentConversionItemId(null);
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

            // Process the inbox item after successful project creation
            if (currentConversionItemId !== null) {
                await handleProcessItem(currentConversionItemId);
                setCurrentConversionItemId(null);
            }

            setIsProjectModalOpen(false);
        } catch (error) {
            console.error('Failed to create project:', error);
            showErrorToast(t('project.createError'));
        }
    };

    const handleSaveNote = async (note: Note) => {
        try {
            // Check if the content appears to be a URL and add the bookmark tag
            const noteContent = note.content || '';
            const isBookmarkContent = isUrl(noteContent.trim());

            // Ensure tags property exists
            if (!note.tags) {
                note.tags = [];
            }

            // Add a bookmark tag if content is a URL and doesn't already have the tag
            if (
                isBookmarkContent &&
                !note.tags.some((tag) => tag.name === 'bookmark')
            ) {
                // Use spread operator to create a new array with the bookmark tag added
                note.tags = [...note.tags, { name: 'bookmark' }];
            }

            // Create the note with proper tags
            await createNote(note);
            showSuccessToast(
                t('note.createSuccess', 'Note created successfully')
            );

            // Process the inbox item after successful note creation
            if (currentConversionItemId !== null) {
                await handleProcessItem(currentConversionItemId);
                setCurrentConversionItemId(null);
            }

            setIsNoteModalOpen(false);
        } catch (error) {
            console.error('Failed to create note:', error);
            showErrorToast(t('note.createError', 'Failed to create note'));
        }
    };

    const handleCreateProject = async (name: string): Promise<Project> => {
        try {
            const project = await createProject({ name, active: true });
            showSuccessToast(t('project.createSuccess'));
            return project;
        } catch (error) {
            console.error('Failed to create project:', error);
            showErrorToast(t('project.createError'));
            throw error;
        }
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Title row with info button on the right */}
                <div className="flex items-center mb-8 justify-between">
                    <div className="flex items-center">
                        <InboxIcon className="h-6 w-6 mr-2" />
                        <h1 className="text-2xl font-light">{t('inbox.title')}</h1>
                    </div>
                    <button
                        onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                        className={`flex items-center hover:bg-blue-100/50 dark:hover:bg-blue-800/20 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg${isInfoExpanded ? ' bg-blue-50/70 dark:bg-blue-900/20' : ''} p-2`}
                        aria-expanded={isInfoExpanded}
                        aria-label={isInfoExpanded ? 'Collapse info panel' : 'Show inbox information'}
                        title={isInfoExpanded ? 'Hide info' : 'About Inbox'}
                    >
                        <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                        </svg>
                        <span className="sr-only">{isInfoExpanded ? 'Hide info' : 'About Inbox'}</span>
                    </button>
                </div>

                {/* Info section below title row */}
                <div className={`transition-all duration-300 ease-in-out ${
                    isInfoExpanded ? 'max-h-96 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'
                } overflow-hidden`}
                >
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg px-6 py-5 flex items-start gap-4">
                        {/* Large low-opacity info icon */}
                        <div className="flex-shrink-0">
                            <svg className="h-12 w-12 text-blue-400 opacity-20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                            </svg>
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
                        <div className="w-full max-w bg-black/15 dark:bg-gray-900/25 rounded-l px-10 py-24 flex flex-col items-center opacity-95">
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
                    <div className="space-y-2">
                        {inboxItems.map((item) => (
                            <InboxItemDetail
                                key={item.id}
                                item={item}
                                onProcess={handleProcessItem}
                                onDelete={handleDeleteItem}
                                onUpdate={handleUpdateItem}
                                openTaskModal={handleOpenTaskModal}
                                openProjectModal={handleOpenProjectModal}
                                openNoteModal={handleOpenNoteModal}
                            />
                        ))}
                    </div>
                )}

                {/* Task Modal - Always render it but control visibility with isOpen */}
                {/* Add error boundary protection for modal rendering */}
                {(() => {
                    try {
                        return (
                            <TaskModal
                                isOpen={isTaskModalOpen}
                                onClose={() => {
                                    setIsTaskModalOpen(false);
                                    setTaskToEdit(null);
                                }}
                                task={
                                    taskToEdit || {
                                        name: '',
                                        status: 'not_started',
                                        priority: 'medium',
                                    }
                                }
                                onSave={handleSaveTask}
                                onDelete={async () => {}} // No need to delete since it's a new task
                                projects={Array.isArray(projects) ? projects : []}
                                onCreateProject={handleCreateProject}
                            />
                        );
                    } catch (error) {
                        console.error('TaskModal rendering error:', error);
                        return null;
                    }
                })()}

                {/* Project Modal - Only render when needed to prevent infinite loops */}
                {isProjectModalOpen &&
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
                                    areas={[]}
                                />
                            );
                        } catch (error) {
                            console.error('ProjectModal rendering error:', error);
                            return null;
                        }
                    })()}

                {/* Note Modal - Always render it but control visibility with isOpen */}
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
                                projects={Array.isArray(projects) ? projects : []}
                                onCreateProject={handleCreateProject}
                            />
                        );
                    } catch (error) {
                        console.error('NoteModal rendering error:', error);
                        return null;
                    }
                })()}

                {/* Edit Inbox Item Modal */}
                {isEditModalOpen && itemToEdit !== null && (
                    <InboxModal
                        isOpen={isEditModalOpen}
                        onClose={() => {
                            setIsEditModalOpen(false);
                            setItemToEdit(null);
                        }}
                        onSave={async () => {}} // Not used in edit mode
                        initialText={
                            inboxItems.find((item) => item.id === itemToEdit)
                                ?.content || ''
                        }
                        editMode={true}
                        onEdit={handleSaveEditedItem}
                    />
                )}
            </div>
        </div>
    );
};

export default InboxItems;
