import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
} from 'react';
import { Note } from '../../entities/Note';
import { Project } from '../../entities/Project';
import { useToast } from '../Shared/ToastContext';
import TagInput from '../Tag/TagInput';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import { Tag } from '../../entities/Tag';
import { useStore } from '../../store/useStore';
import { useTranslation } from 'react-i18next';
import ProjectDropdown from '../Shared/ProjectDropdown';
import ConfirmDialog from '../Shared/ConfirmDialog';
import DiscardChangesDialog from '../Shared/DiscardChangesDialog';
import {
    EyeIcon,
    PencilIcon,
    FolderIcon,
    TagIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';

interface NoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    note?: Note | null;
    onSave: (noteData: Note) => Promise<void>;
    onDelete?: (noteUid: string) => Promise<void>;
    projects?: Project[];
    onCreateProject?: (name: string) => Promise<Project>;
}

const NoteModal: React.FC<NoteModalProps> = ({
    isOpen,
    onClose,
    note,
    onSave,
    onDelete,
    projects = [],
    onCreateProject,
}) => {
    const { t } = useTranslation();
    const { tagsStore } = useStore();
    const availableTagsStore = tagsStore.getTags();
    const { addNewTags } = tagsStore;
    const [formData, setFormData] = useState<Note>(
        note || {
            title: '',
            content: '',
            tags: [],
        }
    );
    const [tags, setTags] = useState<string[]>(
        (note?.tags || note?.Tags)?.map((tag) => tag.name) || []
    );
    const [error, setError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isClosing, setIsClosing] = useState(false);
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);

    // Project-related state
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [newProjectName, setNewProjectName] = useState<string>('');
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Collapsible sections state
    const [expandedSections, setExpandedSections] = useState({
        tags: false,
        project: false,
    });

    const { showSuccessToast, showErrorToast } = useToast();

    // Memoize projects to prevent infinite re-renders
    const memoizedProjects = useMemo(() => projects || [], [projects]);

    useEffect(() => {
        if (!isOpen) return;

        // Auto-focus on the title input when modal opens
        setTimeout(() => {
            titleInputRef.current?.focus();
        }, 100);
    }, [isOpen]);

    // Initialize filtered projects from props - like TaskModal
    useEffect(() => {
        setFilteredProjects(memoizedProjects);
    }, [memoizedProjects]);

    // Initialize form data when modal opens - exactly like TaskModal
    useEffect(() => {
        if (isOpen) {
            if (note) {
                setFormData({
                    ...note,
                    project_id:
                        note?.project_id ||
                        note?.project?.id ||
                        note?.Project?.id,
                });
                const tagNames =
                    (note?.tags || note?.Tags)?.map((tag) => tag.name) || [];
                setTags(tagNames);
                setError(null);

                // Initialize project name from note - exactly like TaskModal
                const projectIdToFind =
                    note?.project?.id || note?.Project?.id || note?.project_id;

                const currentProject = memoizedProjects.find(
                    (project) => project.id === projectIdToFind
                );
                setNewProjectName(currentProject ? currentProject.name : '');

                // Auto-expand sections if they have content from existing note, editing existing note, or creating new note with pre-filled project
                const shouldExpandTags = tagNames.length > 0 || !!note.uid; // Expand if has tags OR editing existing note
                const shouldExpandProject =
                    !!currentProject || !!note.uid || !!projectIdToFind; // Expand if has project OR editing existing note OR has project_id

                setExpandedSections({
                    tags: shouldExpandTags,
                    project: shouldExpandProject,
                });
            } else {
                // Reset for new note
                setFormData({
                    title: '',
                    content: '',
                    tags: [],
                });
                setTags([]);
                setNewProjectName('');
                setError(null);
                setExpandedSections({
                    tags: false,
                    project: false,
                });
            }
        }
    }, [isOpen, note, memoizedProjects]);

    // Tags are now loaded automatically via getTags() when needed

    // Check if there are unsaved changes
    const hasUnsavedChanges = () => {
        if (!note) {
            // New note - check if any field has been filled
            return (
                formData.title.trim() !== '' ||
                formData.content?.trim() !== '' ||
                tags.length > 0 ||
                formData.project_id !== null
            );
        }

        // Existing note - compare with original
        const formChanged =
            formData.title !== note.title ||
            formData.content !== note.content ||
            formData.project_id !== note.project_id;

        // Compare tags
        const originalTags =
            (note.tags || note.Tags)?.map((tag) => tag.name) || [];
        const tagsChanged =
            tags.length !== originalTags.length ||
            tags.some((tag, index) => tag !== originalTags[index]);

        return formChanged || tagsChanged;
    };

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
            setShowDiscardDialog(false);
            // Reset expanded sections when closing
            setExpandedSections({
                tags: false,
                project: false,
            });
        }, 300);
    }, [onClose]);

    const handleDiscardChanges = () => {
        setShowDiscardDialog(false);
        handleClose();
    };

    const handleCancelDiscard = () => {
        setShowDiscardDialog(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                modalRef.current &&
                !modalRef.current.contains(event.target as Node)
            ) {
                handleClose();
            }
        };

        if (isOpen) {
            // Add a small delay to prevent the opening click from closing the modal
            const timer = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);

            return () => {
                clearTimeout(timer);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, handleClose]);

    // Use ref to store hasUnsavedChanges so it's always current in the event handler
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    });

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                // Don't show discard dialog if already showing a dialog
                if (showConfirmDialog || showDiscardDialog) {
                    // Let the dialog handle its own Escape
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                // Check for unsaved changes using ref to get current value
                if (hasUnsavedChangesRef.current()) {
                    setShowDiscardDialog(true);
                } else {
                    handleClose();
                }
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleClose, showConfirmDialog, showDiscardDialog]);

    // Handle body scroll when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            // Disable body scroll when modal is open
            document.body.style.overflow = 'hidden';
        } else {
            // Re-enable body scroll when modal is closed
            document.body.style.overflow = 'unset';
        }

        return () => {
            // Clean up: re-enable body scroll
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleTagsChange = useCallback((newTags: string[]) => {
        setTags(newTags);
        setFormData((prev) => ({
            ...prev,
            tags: newTags.map((name) => ({ name })),
        }));
    }, []);

    const toggleSection = useCallback(
        (section: keyof typeof expandedSections) => {
            setExpandedSections((prev) => {
                const newExpanded = {
                    ...prev,
                    [section]: !prev[section],
                };

                // Auto-scroll to show the expanded section
                if (newExpanded[section]) {
                    setTimeout(() => {
                        const scrollContainer = document.querySelector(
                            '.absolute.inset-0.overflow-y-auto'
                        );
                        if (scrollContainer) {
                            scrollContainer.scrollTo({
                                top: scrollContainer.scrollHeight,
                                behavior: 'smooth',
                            });
                        }
                    }, 100); // Small delay to ensure DOM is updated
                }

                return newExpanded;
            });
        },
        []
    );

    const handleProjectSearch = (query: string) => {
        setNewProjectName(query);
        setDropdownOpen(true);

        if (!projects || projects.length === 0) {
            setFilteredProjects([]);
            return;
        }

        const searchQuery = query.toLowerCase();
        const filtered = projects.filter((project) =>
            project.name.toLowerCase().includes(searchQuery)
        );
        setFilteredProjects(filtered);

        // If the user clears the project name, also clear the project_id in form data
        if (query.trim() === '') {
            setFormData((prev) => ({ ...prev, project_id: null }));
        }
    };

    const handleProjectSelection = (project: Project) => {
        setFormData((prev) => ({
            ...prev,
            project: { id: project.id!, name: project.name, uid: project.uid },
            project_uid: project.uid,
        }));
        setNewProjectName(project.name);
        setDropdownOpen(false);
    };

    const handleCreateProject = async (name: string) => {
        if (name.trim() !== '' && onCreateProject) {
            setIsCreatingProject(true);
            try {
                const newProject = await onCreateProject(name.trim());
                setFormData((prev) => ({
                    ...prev,
                    project: {
                        id: newProject.id!,
                        name: newProject.name,
                        uid: newProject.uid,
                    },
                    project_uid: newProject.uid,
                }));
                setFilteredProjects([...filteredProjects, newProject]);
                setNewProjectName(newProject.name);
                setDropdownOpen(false);
                showSuccessToast(t('success.projectCreated'));
            } catch (error) {
                showErrorToast(t('errors.projectCreationFailed'));
                console.error('Error creating project:', error);
            } finally {
                setIsCreatingProject(false);
            }
        }
    };

    const handleShowAllProjects = () => {
        setNewProjectName('');
        setFilteredProjects(memoizedProjects);
        setDropdownOpen(!dropdownOpen);
    };

    const handleSubmit = async () => {
        if (!formData.title.trim()) {
            setError(t('errors.noteTitleRequired'));
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // Add new tags to the global store
            const existingTagNames = availableTagsStore.map(
                (tag: any) => tag.name
            );
            const newTagNames = tags.filter(
                (tag) => !existingTagNames.includes(tag)
            );
            if (newTagNames.length > 0) {
                addNewTags(newTagNames);
            }

            // Convert string tags to tag objects
            const noteTags: Tag[] = tags.map((tagName) => ({ name: tagName }));

            // Create final form data with the tags
            // If project name is empty, clear the project_id
            const finalFormData = {
                ...formData,
                project_id:
                    newProjectName.trim() === '' ? null : formData.project_id,
                tags: noteTags,
            };

            await onSave(finalFormData);
            showSuccessToast(
                formData.id && formData.id !== 0
                    ? t('success.noteUpdated')
                    : t('success.noteCreated')
            );
            handleClose();
        } catch (err) {
            setError((err as Error).message);
            showErrorToast(t('errors.failedToSaveNote'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteNote = async () => {
        if (formData.uid && onDelete) {
            try {
                await onDelete(formData.uid);
                showSuccessToast(t('success.noteDeleted'));
                handleClose();
            } catch (err) {
                setError((err as Error).message);
                showErrorToast(t('errors.failedToDeleteNote'));
            }
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className={`fixed top-16 left-0 right-0 bottom-0 bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 overflow-hidden sm:overflow-y-auto ${
                    isClosing ? 'opacity-0' : 'opacity-100'
                }`}
                onClick={(e) => {
                    // Close modal when clicking on backdrop, but not on the modal content
                    if (e.target === e.currentTarget) {
                        handleClose();
                    }
                }}
            >
                <div className="h-full flex items-start justify-center sm:px-4 sm:py-4">
                    <div
                        ref={modalRef}
                        className={`bg-white dark:bg-gray-800 border-0 sm:border sm:border-gray-200 sm:dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-2xl transform transition-transform duration-300 ${
                            isClosing ? 'scale-95' : 'scale-100'
                        } h-full sm:h-auto sm:my-4`}
                    >
                        <div className="flex flex-col h-full sm:min-h-[800px] sm:max-h-[90vh]">
                            {/* Main Form Section */}
                            <div className="flex-1 flex flex-col transition-all duration-300 bg-white dark:bg-gray-800 sm:rounded-lg">
                                <div className="flex-1 relative">
                                    <div
                                        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                                        style={{
                                            WebkitOverflowScrolling: 'touch',
                                        }}
                                    >
                                        <form
                                            className="h-full"
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                handleSubmit();
                                            }}
                                        >
                                            <fieldset className="h-full flex flex-col">
                                                {/* Note Title Section - Always Visible */}
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4 pt-4 sm:rounded-t-lg">
                                                    <input
                                                        ref={titleInputRef}
                                                        type="text"
                                                        id="noteTitle"
                                                        name="title"
                                                        value={
                                                            formData.title || ''
                                                        }
                                                        onChange={handleChange}
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key ===
                                                                'Enter'
                                                            ) {
                                                                e.preventDefault();
                                                                handleSubmit();
                                                            }
                                                        }}
                                                        required
                                                        className="block w-full text-xl font-semibold bg-transparent text-black dark:text-white border-none focus:outline-none shadow-sm py-2"
                                                        placeholder={t(
                                                            'forms.noteTitlePlaceholder'
                                                        )}
                                                        autoComplete="off"
                                                        data-testid="note-title-input"
                                                    />
                                                </div>

                                                {/* Content Section - Always Visible */}
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 sm:px-4 flex-1 flex flex-col mb-2">
                                                    <div className="flex items-center justify-between mb-2 px-4 sm:px-0">
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                            {t(
                                                                'forms.noteContent'
                                                            )}{' '}
                                                            <span className="text-gray-500">
                                                                (Markdown
                                                                supported)
                                                            </span>
                                                        </label>
                                                        <div className="flex space-x-1">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setActiveTab(
                                                                        'edit'
                                                                    )
                                                                }
                                                                className={`px-3 py-1 text-xs rounded-md flex items-center space-x-1 transition-colors ${
                                                                    activeTab ===
                                                                    'edit'
                                                                        ? 'bg-blue-600 text-white'
                                                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                                                }`}
                                                            >
                                                                <PencilIcon className="h-3 w-3" />
                                                                <span>
                                                                    Edit
                                                                </span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setActiveTab(
                                                                        'preview'
                                                                    )
                                                                }
                                                                className={`px-3 py-1 text-xs rounded-md flex items-center space-x-1 transition-colors ${
                                                                    activeTab ===
                                                                    'preview'
                                                                        ? 'bg-blue-600 text-white'
                                                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                                                }`}
                                                            >
                                                                <EyeIcon className="h-3 w-3" />
                                                                <span>
                                                                    Preview
                                                                </span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {activeTab === 'edit' ? (
                                                        <textarea
                                                            id="noteContent"
                                                            name="content"
                                                            value={
                                                                formData.content ||
                                                                ''
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            className="block w-full h-full min-h-0 sm:border sm:border-gray-300 sm:dark:border-gray-600 sm:rounded-md shadow-sm py-2 sm:py-3 px-3 sm:px-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 sm:focus:ring-2 sm:focus:ring-blue-500 transition duration-150 ease-in-out resize-none"
                                                            placeholder="Write your content using Markdown formatting...&#10;&#10;Examples:&#10;# Heading&#10;**Bold text**&#10;*Italic text*&#10;- List item&#10;```code```"
                                                            autoComplete="off"
                                                            data-testid="note-content-textarea"
                                                        />
                                                    ) : (
                                                        <div className="block w-full h-full min-h-0 sm:border sm:border-gray-300 sm:dark:border-gray-600 sm:rounded-md shadow-sm py-2 px-3 sm:py-3 sm:px-3 text-sm bg-gray-50 dark:bg-gray-800 overflow-y-auto">
                                                            {formData.content ? (
                                                                <MarkdownRenderer
                                                                    content={
                                                                        formData.content
                                                                    }
                                                                    onContentChange={(
                                                                        newContent
                                                                    ) => {
                                                                        setFormData(
                                                                            (
                                                                                prev
                                                                            ) => ({
                                                                                ...prev,
                                                                                content:
                                                                                    newContent,
                                                                            })
                                                                        );
                                                                    }}
                                                                />
                                                            ) : (
                                                                <p className="text-gray-500 dark:text-gray-400 italic">
                                                                    No content
                                                                    to preview.
                                                                    Switch to
                                                                    Edit tab to
                                                                    add content.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Expandable Sections - Only show when expanded */}
                                                {expandedSections.tags && (
                                                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                            {t('forms.tags')}
                                                        </h3>
                                                        <TagInput
                                                            onTagsChange={
                                                                handleTagsChange
                                                            }
                                                            initialTags={tags}
                                                            availableTags={
                                                                availableTagsStore
                                                            }
                                                        />
                                                    </div>
                                                )}

                                                {expandedSections.project && (
                                                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                            {t(
                                                                'forms.task.labels.project',
                                                                'Project'
                                                            )}
                                                        </h3>
                                                        <ProjectDropdown
                                                            projectName={
                                                                newProjectName ||
                                                                ''
                                                            }
                                                            onProjectSearch={
                                                                handleProjectSearch
                                                            }
                                                            dropdownOpen={
                                                                dropdownOpen
                                                            }
                                                            filteredProjects={
                                                                filteredProjects
                                                            }
                                                            onProjectSelection={
                                                                handleProjectSelection
                                                            }
                                                            onCreateProject={
                                                                handleCreateProject
                                                            }
                                                            isCreatingProject={
                                                                isCreatingProject
                                                            }
                                                            onShowAllProjects={
                                                                handleShowAllProjects
                                                            }
                                                            allProjects={
                                                                memoizedProjects
                                                            }
                                                        />
                                                    </div>
                                                )}

                                                {error && (
                                                    <div className="text-red-500 px-4 mb-4">
                                                        {error}
                                                    </div>
                                                )}
                                            </fieldset>
                                        </form>
                                    </div>
                                </div>

                                {/* Section Icons - Above border, split layout */}
                                <div className="flex-shrink-0 bg-white dark:bg-gray-800 px-3 py-2">
                                    <div className="flex items-center justify-between">
                                        {/* Left side: Section icons */}
                                        <div className="flex items-center space-x-1">
                                            {/* Tags Toggle */}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleSection('tags')
                                                }
                                                className={`relative p-2 rounded-full transition-colors ${
                                                    expandedSections.tags
                                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                                title={t('forms.tags', 'Tags')}
                                            >
                                                <TagIcon className="h-5 w-5" />
                                                {formData.tags &&
                                                    formData.tags.length >
                                                        0 && (
                                                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                                    )}
                                            </button>

                                            {/* Project Toggle */}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleSection('project')
                                                }
                                                className={`relative p-2 rounded-full transition-colors ${
                                                    expandedSections.project
                                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                                title={t(
                                                    'forms.task.labels.project',
                                                    'Project'
                                                )}
                                            >
                                                <FolderIcon className="h-5 w-5" />
                                                {formData.project && (
                                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons - Below border with custom layout */}
                                <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between sm:rounded-b-lg">
                                    {/* Left side: Delete and Cancel */}
                                    <div className="flex items-center space-x-3">
                                        {note && note.uid && onDelete && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowConfirmDialog(true)
                                                }
                                                className="p-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition duration-150 ease-in-out"
                                                title={t(
                                                    'common.delete',
                                                    'Delete'
                                                )}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleClose}
                                            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none transition duration-150 ease-in-out text-sm"
                                        >
                                            {t('common.cancel', 'Cancel')}
                                        </button>
                                    </div>

                                    {/* Right side: Save */}
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm ${
                                            isSubmitting
                                                ? 'opacity-50 cursor-not-allowed'
                                                : ''
                                        }`}
                                        data-testid="note-save-button"
                                    >
                                        {isSubmitting
                                            ? t('modals.submitting')
                                            : formData.id && formData.id !== 0
                                              ? t('modals.updateNote')
                                              : t('modals.createNote')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog for Delete */}
            {showConfirmDialog && (
                <ConfirmDialog
                    title={t('modals.deleteNote.title', 'Delete Note')}
                    message={
                        t('modals.deleteNote.message', {
                            noteTitle: formData.title,
                        }) ||
                        `Are you sure you want to delete the note "${formData.title}"?`
                    }
                    onConfirm={async () => {
                        await handleDeleteNote();
                        setShowConfirmDialog(false);
                    }}
                    onCancel={() => setShowConfirmDialog(false)}
                />
            )}
            {showDiscardDialog && (
                <DiscardChangesDialog
                    onDiscard={handleDiscardChanges}
                    onCancel={handleCancelDiscard}
                />
            )}
        </>
    );
};

export default NoteModal;
