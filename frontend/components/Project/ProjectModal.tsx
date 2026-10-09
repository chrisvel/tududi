import React, { useState, useEffect, useCallback } from 'react';
import { Area } from '../../entities/Area';
import { Project } from '../../entities/Project';
import { Goal } from '../../entities/Goal';
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
import ColorPicker from '../Shared/ColorPicker';
import GoalDropdown from '../Shared/GoalDropdown';
import { fetchGoals } from '../../utils/goalsService';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import {
    SidePanelField,
    SidePanelSection,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (project: Project) => void;
    onDelete?: (projectUid: string) => Promise<void>;
    project?: Project;
    areas: Area[];
}

const MAX_NAME_LENGTH = 150;

const emptyProject = (): Project => ({
    name: '',
    description: '',
    area_id: null,
    status: 'not_started',
    tags: [],
    priority: null,
    due_date_at: null,
});

// Dates from the API can carry a time part; the date input wants YYYY-MM-DD
const toFormData = (project?: Project | null): Project => {
    if (!project) return emptyProject();
    let dueDateValue = project.due_date_at;
    if (dueDateValue && dueDateValue.includes('T')) {
        dueDateValue = dueDateValue.split('T')[0];
    }
    return {
        ...project,
        tags: project.tags || [],
        due_date_at: dueDateValue || null,
    };
};

const ProjectModal: React.FC<ProjectModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    project,
    areas,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const { tagsStore } = useStore();
    // Avoid calling getTags() during component initialization to prevent remounting
    const availableTags = tagsStore.tags;
    const { addNewTags } = tagsStore;

    const [formData, setFormData] = useState<Project>(() =>
        toFormData(project)
    );
    const [tags, setTags] = useState<string[]>(
        project?.tags?.map((tag) => tag.name) || []
    );
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [availableGoals, setAvailableGoals] = useState<Goal[]>([]);

    // Start from the saved project each time the panel opens
    useEffect(() => {
        if (!isOpen) return;
        setFormData(toFormData(project));
        setTags(project?.tags?.map((tag) => tag.name) || []);
        setError(null);
        setShowConfirmDialog(false);
    }, [isOpen, project]);

    useEffect(() => {
        fetchGoals()
            .then(setAvailableGoals)
            .catch(() => setAvailableGoals([]));
    }, []);

    const handleTagInputFocus = () => {
        if (!tagsStore.hasLoaded && !tagsStore.isLoading) {
            tagsStore.loadTags();
        }
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (name === 'name' && error) setError(null);
    };

    const handleTagsChange = useCallback((newTags: string[]) => {
        setTags(newTags);
        setFormData((prev) => ({
            ...prev,
            tags: newTags.map((name) => ({ name })),
        }));
    }, []);

    const handleDueDateChange = (value: string) => {
        setFormData((prev) => ({
            ...prev,
            due_date_at: value || null,
        }));
    };

    const handleSubmit = async () => {
        const trimmedName = formData.name.trim();
        if (!trimmedName) {
            setError(
                t('errors.projectNameRequired', 'Project name is required')
            );
            return;
        }
        if (trimmedName.length > MAX_NAME_LENGTH) {
            setError(
                t(
                    'errors.projectNameTooLong',
                    `Project name must be ${MAX_NAME_LENGTH} characters or less`
                )
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

            await onSave({
                ...formData,
                tags: tags.map((name) => ({ name })),
            });

            showSuccessToast(
                project
                    ? 'Project updated successfully!'
                    : 'Project created successfully!'
            );
            onClose();
        } catch (err) {
            console.error('Error saving project:', err);
            setError(t('errors.projectSaveFailed', 'Failed to save project'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (project?.uid && onDelete) {
            try {
                await onDelete(project.uid);
                showSuccessToast(t('success.projectDeleted'));
                setShowConfirmDialog(false);
                onClose();
            } catch (err) {
                console.error('Error deleting project:', err);
                showErrorToast(t('errors.failedToDeleteProject'));
            }
        }
    };

    const hasUnsavedChanges = () => {
        if (!project) {
            return (
                formData.name.trim() !== '' ||
                (formData.description?.trim() ?? '') !== '' ||
                formData.area_id !== null ||
                formData.status !== 'not_started' ||
                tags.length > 0 ||
                formData.priority !== null ||
                formData.due_date_at !== null ||
                !!formData.color
            );
        }

        const formChanged =
            formData.name !== project.name ||
            formData.description !== project.description ||
            formData.area_id !== project.area_id ||
            formData.status !== project.status ||
            formData.priority !== project.priority ||
            formData.due_date_at !== project.due_date_at ||
            formData.color !== project.color ||
            formData.goal_id !== project.goal_id ||
            formData.is_maintenance !== project.is_maintenance;

        const originalTags = project.tags?.map((tag) => tag.name) || [];
        const tagsChanged =
            tags.length !== originalTags.length ||
            tags.some((tag, index) => tag !== originalTags[index]);

        return formChanged || tagsChanged;
    };

    // Don't render if areas aren't loaded yet (prevents race condition)
    if (!areas || !Array.isArray(areas)) return null;

    return (
        <>
            <EntitySidePanel
                isOpen={isOpen}
                onClose={onClose}
                eyebrow={
                    project?.id ? t('projects.title', 'Projects') : undefined
                }
                title={
                    project?.id
                        ? formData.name ||
                          t('project.name', 'Enter project name')
                        : t('modals.createProject', 'Create Project')
                }
                submitLabel={
                    project?.uid || project?.id
                        ? t('modals.updateProject', 'Update Project')
                        : t('modals.createProject', 'Create Project')
                }
                submitTestId="project-save-button"
                isSubmitting={isSaving}
                isDirty={hasUnsavedChanges()}
                error={error}
                onSubmit={handleSubmit}
                onDelete={
                    project?.uid && onDelete
                        ? () => setShowConfirmDialog(true)
                        : undefined
                }
                closeLocked={showConfirmDialog}
                testId="project-modal"
            >
                <SidePanelField
                    label={t('forms.name', 'Name')}
                    htmlFor="projectName"
                >
                    <input
                        id="projectName"
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className={sidePanelInputClass}
                        placeholder={t('project.name', 'Enter project name')}
                        data-testid="project-name-input"
                    />
                </SidePanelField>

                <SidePanelField
                    label={t('forms.description', 'Description')}
                    htmlFor="projectDescription"
                >
                    <textarea
                        id="projectDescription"
                        name="description"
                        value={formData.description || ''}
                        onChange={handleChange}
                        rows={3}
                        className={`${sidePanelInputClass} resize-none`}
                        placeholder={t(
                            'forms.projectDescriptionPlaceholder',
                            'Enter project description (optional)'
                        )}
                    />
                </SidePanelField>

                <SidePanelSection
                    title={t('projects.status', 'Project Status')}
                >
                    <ProjectStateDropdown
                        value={formData.status || 'not_started'}
                        onChange={(status) =>
                            setFormData((prev) => ({ ...prev, status }))
                        }
                    />
                </SidePanelSection>

                <SidePanelSection title={t('forms.tags', 'Tags')}>
                    <TagInput
                        onTagsChange={handleTagsChange}
                        initialTags={tags}
                        availableTags={availableTags}
                        onFocus={handleTagInputFocus}
                    />
                </SidePanelSection>

                <SidePanelSection title={t('common.area', 'Area')}>
                    <AreaDropdown
                        value={formData.area_id || null}
                        onChange={(value) =>
                            setFormData((prev) => ({ ...prev, area_id: value }))
                        }
                        areas={areas}
                    />
                </SidePanelSection>

                <SidePanelSection title={t('projects.goalTitle', 'Goal')}>
                    <GoalDropdown
                        goalId={formData.goal_id ?? null}
                        isMaintenance={!!formData.is_maintenance}
                        goals={availableGoals}
                        onChange={(id, maintenance) =>
                            setFormData((prev) => ({
                                ...prev,
                                goal_id: id,
                                is_maintenance: maintenance,
                            }))
                        }
                    />
                </SidePanelSection>

                <SidePanelSection title={t('forms.priority', 'Priority')}>
                    <PriorityDropdown
                        value={formData.priority ?? null}
                        onChange={(value: PriorityType) =>
                            setFormData((prev) => ({
                                ...prev,
                                priority: value,
                            }))
                        }
                    />
                </SidePanelSection>

                <SidePanelSection title={t('forms.dueDate', 'Due Date')}>
                    <DatePicker
                        value={formData.due_date_at || ''}
                        onChange={handleDueDateChange}
                        placeholder={t('projects.selectDueDatePlaceholder')}
                    />
                </SidePanelSection>

                <SidePanelSection title={t('forms.color', 'Color')}>
                    <ColorPicker
                        value={formData.color || ''}
                        onChange={(color) =>
                            setFormData((prev) => ({ ...prev, color }))
                        }
                    />
                </SidePanelSection>
            </EntitySidePanel>

            {showConfirmDialog && (
                <ConfirmDialog
                    title={t('modals.deleteProject.title', 'Delete Project')}
                    message={t(
                        'modals.deleteProject.message',
                        'Deleting this project will remove the project only. All items inside will be retained but will no longer belong to any project. Continue?',
                        { projectName: project?.name }
                    )}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setShowConfirmDialog(false)}
                />
            )}
        </>
    );
};

export default ProjectModal;
