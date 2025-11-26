import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Area } from '../../entities/Area';
import { Project } from '../../entities/Project';
import ConfirmDialog from '../Shared/ConfirmDialog';
import DiscardChangesDialog from '../Shared/DiscardChangesDialog';
import { useToast } from '../Shared/ToastContext';
import TagInput from '../Tag/TagInput';
import PriorityDropdown from '../Shared/PriorityDropdown';
import AreaDropdown from '../Shared/AreaDropdown';
import DatePicker from '../Shared/DatePicker';
import ProjectStateDropdown from '../Shared/ProjectStateDropdown';
import { PriorityType } from '../../entities/Task';
import { useStore } from '../../store/useStore';
import { useTranslation } from 'react-i18next';
import {
    TagIcon,
    Squares2X2Icon,
    TrashIcon,
    CalendarIcon,
    ExclamationTriangleIcon,
    PlayIcon,
} from '@heroicons/react/24/outline';

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (project: Project) => void;
    onDelete?: (projectUid: string) => Promise<void>;
    project?: Project;
    areas: Area[];
}

const ProjectModal: React.FC<ProjectModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    project,
    areas,
}) => {
    const [modalJustOpened, setModalJustOpened] = useState(false);
    const [formData, setFormData] = useState<Project>(
        project || {
            name: '',
            description: '',
            area_id: null,
            state: 'idea',
            tags: [],
            priority: null,
            due_date_at: null,
        }
    );

    const [tags, setTags] = useState<string[]>(
        project?.tags?.map((tag) => tag.name) || []
    );
    const [isSaving, setIsSaving] = useState(false);

    const { tagsStore } = useStore();
    // Avoid calling getTags() during component initialization to prevent remounting
    const availableTags = tagsStore.tags;
    const { addNewTags } = tagsStore;

    const modalRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Collapsible sections state
    const [expandedSections, setExpandedSections] = useState({
        state: false,
        tags: false,
        area: false,
        priority: false,
        dueDate: false,
    });

    const { showSuccessToast, showErrorToast } = useToast();
    const { t } = useTranslation();

    // Auto-focus on the name input when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                nameInputRef.current?.focus();
            }, 200);
        }
    }, [isOpen]);

    // Load tags only when user actually interacts with tag input to prevent refresh
    const handleTagInputFocus = () => {
        if (!tagsStore.hasLoaded && !tagsStore.isLoading) {
            tagsStore.loadTags();
        }
    };

    // Manage body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        if (project) {
            // Convert ISO date to YYYY-MM-DD format if needed
            let dueDateValue = project.due_date_at;
            if (dueDateValue && dueDateValue.includes('T')) {
                dueDateValue = dueDateValue.split('T')[0];
            }

            setFormData({
                ...project,
                tags: project.tags || [],
                due_date_at: dueDateValue || null,
            });
            setTags(project.tags?.map((tag) => tag.name) || []);
        } else {
            setFormData({
                name: '',
                description: '',
                area_id: null,
                state: 'idea',
                tags: [],
                priority: null,
                due_date_at: null,
            });
            setTags([]);
        }
        setError(null);
    }, [project]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            // Check if click is inside modal
            if (modalRef.current && modalRef.current.contains(target)) {
                return;
            }

            // Check if click is on priority dropdown (which is portaled to document.body)
            const clickedElement = target as Element;
            if (
                clickedElement &&
                clickedElement.closest &&
                clickedElement.closest(
                    '.fixed.z-50.bg-white, .fixed.z-50.bg-gray-700'
                )
            ) {
                return;
            }

            handleClose();
        };

        if (isOpen && !modalJustOpened) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, modalJustOpened]);

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
    }, [isOpen, showConfirmDialog, showDiscardDialog]);

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
    ) => {
        const target = e.target;
        const { name, type, value } = target;

        // Clear error when user starts typing in the name field
        if (name === 'name' && error) {
            setError(null);
        }

        if (type === 'checkbox') {
            if (target instanceof HTMLInputElement) {
                const checked = target.checked;
                setFormData((prev) => ({
                    ...prev,
                    [name]: checked,
                }));
            }
        } else {
            // Handle empty date values by converting to null
            let processedValue: any = value;
            if (name === 'due_date_at' && value === '') {
                processedValue = null;
            }

            setFormData((prev) => ({
                ...prev,
                [name]: processedValue,
            }));
        }
    };

    const handleTagsChange = useCallback((newTags: string[]) => {
        setTags(newTags);
        setFormData((prev) => ({
            ...prev,
            tags: newTags.map((name) => ({ name })),
        }));
    }, []);

    // Track when modal opens to prevent immediate backdrop clicks
    useEffect(() => {
        if (isOpen) {
            setModalJustOpened(true);
            const timer = setTimeout(() => {
                setModalJustOpened(false);
            }, 200); // Prevent backdrop clicks for 200ms after opening
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleDueDateChange = (value: string) => {
        setFormData((prev) => ({
            ...prev,
            due_date_at: value || null,
        }));
    };

    const handleSubmit = async () => {
        // Validate required fields
        if (!formData.name.trim()) {
            setError(
                t('errors.projectNameRequired', 'Project name is required')
            );
            return;
        }

        setIsSaving(true);
        try {
            // Add new tags to the global store
            const existingTagNames = availableTags.map((tag: any) => tag.name);
            const newTagNames = tags.filter(
                (tag) => !existingTagNames.includes(tag)
            );
            if (newTagNames.length > 0) {
                addNewTags(newTagNames);
            }

            const projectData = {
                ...formData,
                tags: tags.map((name) => ({ name })),
            };

            // Save the project and wait for it to complete
            await onSave(projectData);

            showSuccessToast(
                project
                    ? 'Project updated successfully!'
                    : 'Project created successfully!'
            );

            handleClose();
        } catch (error) {
            console.error('Error saving project:', error);
            setError(t('errors.projectSaveFailed', 'Failed to save project'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = () => {
        setShowConfirmDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (project && project.uid && onDelete) {
            try {
                await onDelete(project.uid);
                showSuccessToast(t('success.projectDeleted'));
                setShowConfirmDialog(false);
                handleClose();
            } catch (error) {
                console.error('Error deleting project:', error);
                showErrorToast(t('errors.failedToDeleteProject'));
            }
        }
    };

    // Check if there are unsaved changes
    const hasUnsavedChanges = () => {
        if (!project) {
            // New project - check if any field has been filled
            return (
                formData.name.trim() !== '' ||
                formData.description?.trim() !== '' ||
                formData.area_id !== null ||
                formData.state !== 'idea' ||
                tags.length > 0 ||
                formData.priority !== null ||
                formData.due_date_at !== null
            );
        }

        // Existing project - compare with original
        const formChanged =
            formData.name !== project.name ||
            formData.description !== project.description ||
            formData.area_id !== project.area_id ||
            formData.state !== project.state ||
            formData.priority !== project.priority ||
            formData.due_date_at !== project.due_date_at;

        // Compare tags
        const originalTags = project.tags?.map((tag) => tag.name) || [];
        const tagsChanged =
            tags.length !== originalTags.length ||
            tags.some((tag, index) => tag !== originalTags[index]);

        return formChanged || tagsChanged;
    };

    // Use ref to store hasUnsavedChanges so it's always current in the event handler
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    });

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
            setShowDiscardDialog(false);
        }, 300);
    };

    const handleDiscardChanges = () => {
        setShowDiscardDialog(false);
        handleClose();
    };

    const handleCancelDiscard = () => {
        setShowDiscardDialog(false);
    };

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
                        // Try multiple selectors to find the scroll container
                        const scrollContainer =
                            modalRef.current?.querySelector(
                                '.absolute.inset-0.overflow-y-auto'
                            ) ||
                            modalRef.current?.querySelector(
                                '[style*="overflow-y"]'
                            ) ||
                            modalRef.current?.querySelector(
                                '.overflow-y-auto'
                            ) ||
                            document.querySelector(
                                '.absolute.inset-0.overflow-y-auto'
                            );

                        if (scrollContainer) {
                            scrollContainer.scrollTo({
                                top: scrollContainer.scrollHeight,
                                behavior: 'smooth',
                            });
                        }
                    }, 250); // Increased delay to ensure DOM is updated
                }

                return newExpanded;
            });
        },
        []
    );

    if (!isOpen) return null;

    // Don't render if areas aren't loaded yet (prevents race condition)
    if (!areas || !Array.isArray(areas)) return null;

    return createPortal(
        <>
            <div
                className={`fixed top-16 left-0 right-0 bottom-0 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 ${
                    isClosing ? 'opacity-0' : 'opacity-100'
                }`}
                onMouseDown={(e) => {
                    // Close modal when clicking on backdrop, but not on the modal content
                    // Use mousedown instead of onClick to prevent issues with text selection dragging
                    // Also prevent immediate closes after modal opens
                    if (e.target === e.currentTarget && !modalJustOpened) {
                        handleClose();
                    }
                }}
            >
                <div
                    ref={modalRef}
                    data-testid="project-modal"
                    data-state={isSaving ? 'saving' : 'idle'}
                    className={`bg-white dark:bg-gray-800 border-0 sm:border sm:border-gray-200 sm:dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-2xl transform transition-transform duration-300 ${
                        isClosing ? 'scale-95' : 'scale-100'
                    } h-full sm:h-auto sm:my-4`}
                >
                    <div className="flex flex-col h-full sm:min-h-[500px] sm:max-h-[80vh]">
                        {/* Main Form Section */}
                        <div className="flex-1 flex flex-col transition-all duration-300 bg-white dark:bg-gray-800 sm:rounded-lg">
                            <div className="flex-1 relative">
                                <div
                                    className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                                    style={{ WebkitOverflowScrolling: 'touch' }}
                                >
                                    <form
                                        className="h-full"
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleSubmit();
                                        }}
                                    >
                                        <fieldset className="h-full flex flex-col">
                                            {/* Project Title Section - Always Visible */}
                                            <div className="pb-4 mb-4 px-4 pt-4">
                                                <input
                                                    ref={nameInputRef}
                                                    type="text"
                                                    id="projectName"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSubmit();
                                                        }
                                                    }}
                                                    required
                                                    className={`block w-full text-xl font-semibold bg-transparent text-black dark:text-white border-none focus:outline-none py-2`}
                                                    placeholder={t(
                                                        'project.name',
                                                        'Enter project name'
                                                    )}
                                                    data-testid="project-name-input"
                                                />
                                                {error && (
                                                    <div className="mt-2 text-red-500 text-sm font-medium">
                                                        {error}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Description Section - Always Visible */}
                                            <div className="flex-1 border-b border-gray-200 dark:border-gray-700 pb-4 sm:px-4 flex flex-col mb-2">
                                                <textarea
                                                    id="projectDescription"
                                                    name="description"
                                                    value={
                                                        formData.description ||
                                                        ''
                                                    }
                                                    onChange={handleChange}
                                                    className="block w-full h-full min-h-0 sm:border sm:border-gray-300 sm:dark:border-gray-600 sm:rounded-md shadow-sm py-2 px-3 sm:py-3 sm:px-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 sm:focus:ring-2 sm:focus:ring-blue-500 transition duration-150 ease-in-out resize-none"
                                                    placeholder={t(
                                                        'forms.projectDescriptionPlaceholder',
                                                        'Enter project description (optional)'
                                                    )}
                                                />
                                            </div>

                                            {/* Expandable Sections - Only show when expanded */}
                                            {/* State Section - First */}
                                            {expandedSections.state && (
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                        {t(
                                                            'projects.state',
                                                            'Project State'
                                                        )}
                                                    </h3>
                                                    <ProjectStateDropdown
                                                        value={
                                                            formData.state ||
                                                            'idea'
                                                        }
                                                        onChange={(state) =>
                                                            setFormData(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    state,
                                                                })
                                                            )
                                                        }
                                                    />
                                                </div>
                                            )}

                                            {expandedSections.tags && (
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                        {t(
                                                            'forms.tags',
                                                            'Tags'
                                                        )}
                                                    </h3>
                                                    <TagInput
                                                        onTagsChange={
                                                            handleTagsChange
                                                        }
                                                        initialTags={tags}
                                                        availableTags={
                                                            availableTags
                                                        }
                                                        onFocus={
                                                            handleTagInputFocus
                                                        }
                                                    />
                                                </div>
                                            )}

                                            {expandedSections.area && (
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                        {t(
                                                            'common.area',
                                                            'Area'
                                                        )}
                                                    </h3>
                                                    <div className="overflow-visible">
                                                        <AreaDropdown
                                                            value={
                                                                formData.area_id ||
                                                                null
                                                            }
                                                            onChange={(value) =>
                                                                setFormData(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        area_id:
                                                                            value,
                                                                    })
                                                                )
                                                            }
                                                            areas={areas}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {expandedSections.priority && (
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                        {t(
                                                            'forms.priority',
                                                            'Priority'
                                                        )}
                                                    </h3>
                                                    <PriorityDropdown
                                                        value={
                                                            formData.priority ??
                                                            null
                                                        }
                                                        onChange={(
                                                            value: PriorityType
                                                        ) =>
                                                            setFormData({
                                                                ...formData,
                                                                priority: value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                            )}

                                            {expandedSections.dueDate && (
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4 overflow-visible">
                                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                        {t(
                                                            'forms.dueDate',
                                                            'Due Date'
                                                        )}
                                                    </h3>
                                                    <div className="overflow-visible">
                                                        <DatePicker
                                                            value={
                                                                formData.due_date_at ||
                                                                ''
                                                            }
                                                            onChange={
                                                                handleDueDateChange
                                                            }
                                                            placeholder="Select due date"
                                                        />
                                                    </div>
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
                                        {/* State Toggle - First */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleSection('state')
                                            }
                                            className={`relative p-2 rounded-full transition-colors ${
                                                expandedSections.state
                                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                            title={t(
                                                'projects.state',
                                                'Project State'
                                            )}
                                        >
                                            <PlayIcon className="h-5 w-5" />
                                            {formData.state &&
                                                formData.state !== 'idea' && (
                                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                                )}
                                        </button>

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
                                                formData.tags.length > 0 && (
                                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                                )}
                                        </button>

                                        {/* Area Toggle */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleSection('area')
                                            }
                                            className={`relative p-2 rounded-full transition-colors ${
                                                expandedSections.area
                                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                            title={t('common.area', 'Area')}
                                        >
                                            <Squares2X2Icon className="h-5 w-5" />
                                            {formData.area_id && (
                                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                            )}
                                        </button>

                                        {/* Priority Toggle */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleSection('priority')
                                            }
                                            className={`relative p-2 rounded-full transition-colors ${
                                                expandedSections.priority
                                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                            title={t(
                                                'forms.priority',
                                                'Priority'
                                            )}
                                        >
                                            <ExclamationTriangleIcon className="h-5 w-5" />
                                            {formData.priority != null && (
                                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                            )}
                                        </button>

                                        {/* Due Date Toggle */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleSection('dueDate')
                                            }
                                            className={`relative p-2 rounded-full transition-colors ${
                                                expandedSections.dueDate
                                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                            title={t(
                                                'forms.dueDate',
                                                'Due Date'
                                            )}
                                        >
                                            <CalendarIcon className="h-5 w-5" />
                                            {formData.due_date_at && (
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
                                    {project && project.id && onDelete && (
                                        <button
                                            type="button"
                                            onClick={handleDeleteClick}
                                            className="p-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition duration-150 ease-in-out"
                                            title={t('common.delete', 'Delete')}
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
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm"
                                    data-testid="project-save-button"
                                >
                                    {project
                                        ? t(
                                              'modals.updateProject',
                                              'Update Project'
                                          )
                                        : t(
                                              'modals.createProject',
                                              'Create Project'
                                          )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showConfirmDialog && (
                <ConfirmDialog
                    title={t('modals.deleteProject.title', 'Delete Project')}
                    message={t(
                        'modals.deleteProject.message',
                        'Deleting this project will remove the project only. All items inside will be retained but will no longer belong to any project. Continue?'
                    )}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setShowConfirmDialog(false)}
                />
            )}
            {showDiscardDialog && (
                <DiscardChangesDialog
                    onDiscard={handleDiscardChanges}
                    onCancel={handleCancelDiscard}
                />
            )}
        </>,
        document.body
    );
};

export default ProjectModal;
