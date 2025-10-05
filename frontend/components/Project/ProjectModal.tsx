import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Area } from '../../entities/Area';
import { Project } from '../../entities/Project';
import ConfirmDialog from '../Shared/ConfirmDialog';
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
    CameraIcon,
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
            priority: 'low',
            due_date_at: null,
            image_url: '',
        }
    );

    const [tags, setTags] = useState<string[]>(
        project?.tags?.map((tag) => tag.name) || []
    );
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>(
        project?.image_url || ''
    );
    const [isUploading, setIsUploading] = useState(false);

    const { tagsStore } = useStore();
    // Avoid calling getTags() during component initialization to prevent remounting
    const availableTags = tagsStore.tags;
    const { addNewTags } = tagsStore;

    const modalRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Collapsible sections state
    const [expandedSections, setExpandedSections] = useState({
        state: false,
        tags: false,
        area: false,
        image: false,
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
                image_url: project.image_url || '',
            });
            setTags(project.tags?.map((tag) => tag.name) || []);
            setImagePreview(project.image_url || '');
        } else {
            setFormData({
                name: '',
                description: '',
                area_id: null,
                state: 'idea',
                tags: [],
                priority: 'low',
                due_date_at: null,
                image_url: '',
            });
            setTags([]);
            setImagePreview('');
        }
        setImageFile(null);
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
                handleClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

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

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);

            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleImageUpload = async (): Promise<string | null> => {
        if (!imageFile) return null;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', imageFile);

            const response = await fetch('/api/upload/project-image', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload image');
            }

            const result = await response.json();
            return result.imageUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview('');
        setFormData((prev) => ({
            ...prev,
            image_url: '',
        }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async () => {
        // Validate required fields
        if (!formData.name.trim()) {
            setError(
                t('errors.projectNameRequired', 'Project name is required')
            );
            return;
        }

        try {
            // Add new tags to the global store
            const existingTagNames = availableTags.map((tag: any) => tag.name);
            const newTagNames = tags.filter(
                (tag) => !existingTagNames.includes(tag)
            );
            if (newTagNames.length > 0) {
                addNewTags(newTagNames);
            }

            let imageUrl = formData.image_url;

            // Upload image if a new one was selected
            if (imageFile) {
                const uploadedImageUrl = await handleImageUpload();
                if (uploadedImageUrl) {
                    imageUrl = uploadedImageUrl;
                }
            }

            const projectData = {
                ...formData,
                image_url: imageUrl,
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

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 300);
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
                onClick={(e) => {
                    // Close modal when clicking on backdrop, but not on the modal content
                    // Also prevent immediate closes after modal opens
                    if (e.target === e.currentTarget && !modalJustOpened) {
                        handleClose();
                    }
                }}
            >
                <div
                    ref={modalRef}
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

                                            {expandedSections.image && (
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                        {t(
                                                            'project.projectImage',
                                                            'Project Image'
                                                        )}
                                                    </h3>

                                                    {imagePreview ? (
                                                        <div className="mb-3">
                                                            <div className="relative inline-block">
                                                                <img
                                                                    src={
                                                                        imagePreview
                                                                    }
                                                                    alt="Project preview"
                                                                    className="w-32 h-20 object-cover rounded-md border border-gray-300 dark:border-gray-600"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={
                                                                        handleRemoveImage
                                                                    }
                                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={
                                                            handleImageSelect
                                                        }
                                                        className="hidden"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            fileInputRef.current?.click()
                                                        }
                                                        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                                    >
                                                        <svg
                                                            className="w-4 h-4 mr-2"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                                            />
                                                        </svg>
                                                        {t(
                                                            'project.browseImage',
                                                            'Browse Image'
                                                        )}
                                                    </button>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        {t(
                                                            'project.uploadImageHint',
                                                            'Upload an image for your project (max 5MB)'
                                                        )}
                                                    </p>
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
                                                            formData.priority ||
                                                            'medium'
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

                                        {/* Project Image Toggle */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleSection('image')
                                            }
                                            className={`relative p-2 rounded-full transition-colors ${
                                                expandedSections.image
                                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                            title={t(
                                                'project.projectImage',
                                                'Project Image'
                                            )}
                                        >
                                            <CameraIcon className="h-5 w-5" />
                                            {formData.image_url && (
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
                                            {formData.priority !== 'medium' && (
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
                                    disabled={isUploading}
                                    className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm ${
                                        isUploading
                                            ? 'opacity-50 cursor-not-allowed'
                                            : ''
                                    }`}
                                    data-testid="project-save-button"
                                >
                                    {isUploading
                                        ? 'Uploading...'
                                        : project
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
        </>,
        document.body
    );
};

export default ProjectModal;
