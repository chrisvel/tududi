import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Task, PriorityType } from '../../entities/Task';
import { updateTask, fetchTaskByUid } from '../../utils/tasksService';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import TagInput from '../Tag/TagInput';
import PriorityDropdown from '../Shared/PriorityDropdown';
import AreaDropdown from '../Shared/AreaDropdown';
import DatePicker from '../Shared/DatePicker';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import {
    SidePanelField,
    SidePanelSection,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';
import { TASK_STATUS, getStatusValue } from '../../constants/taskStatus';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: Task;
}

const STATUS_OPTIONS: { value: number; key: string; fallback: string }[] = [
    {
        value: TASK_STATUS.NOT_STARTED,
        key: 'task.status.notStarted',
        fallback: 'Not started',
    },
    {
        value: TASK_STATUS.PLANNED,
        key: 'task.status.planned',
        fallback: 'Planned',
    },
    {
        value: TASK_STATUS.IN_PROGRESS,
        key: 'task.status.inProgress',
        fallback: 'In progress',
    },
    {
        value: TASK_STATUS.WAITING,
        key: 'task.status.waiting',
        fallback: 'Waiting',
    },
    { value: TASK_STATUS.DONE, key: 'task.status.done', fallback: 'Done' },
    {
        value: TASK_STATUS.CANCELLED,
        key: 'task.status.cancelled',
        fallback: 'Cancelled',
    },
];

interface TaskFormState {
    name: string;
    note: string;
    status: number;
    priority: PriorityType;
    projectId: number | null;
    areaId: number | null;
    dueDate: string;
    tags: string[];
}

const toFormState = (task: Task): TaskFormState => ({
    name: task.name ?? '',
    note: task.note ?? '',
    status: getStatusValue(task.status as any),
    priority: (task.priority ?? null) as PriorityType,
    projectId: task.project_id ?? null,
    areaId: task.area_id ?? null,
    dueDate: task.due_date ? String(task.due_date).split('T')[0] : '',
    tags: task.tags?.map((tag) => tag.name) ?? [],
});

// Edits the core fields of a task in the side panel. Recurrence, relations,
// subtasks and reminders stay on the task page.
const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, task }) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const projects = useStore(
        (state: any) => state.projectsStore.projects
    ) as any[];
    const areas = useStore((state: any) => state.areasStore.areas) as any[];
    const tagsStore = useStore((state: any) => state.tagsStore);

    const [form, setForm] = useState<TaskFormState>(() => toFormState(task));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setForm(toFormState(task));
        setError(null);
    }, [isOpen, task]);

    const original = toFormState(task);
    const isDirty = (Object.keys(original) as (keyof TaskFormState)[]).some(
        (key) => JSON.stringify(form[key]) !== JSON.stringify(original[key])
    );

    const setField = <K extends keyof TaskFormState>(
        key: K,
        value: TaskFormState[K]
    ) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleTagsChange = useCallback((tags: string[]) => {
        setForm((prev) => ({ ...prev, tags }));
    }, []);

    const handleTagInputFocus = () => {
        if (!tagsStore.hasLoaded && !tagsStore.isLoading) {
            tagsStore.loadTags();
        }
    };

    // Only the fields that changed are sent, so recurring tasks and other
    // side effects are not triggered by untouched values.
    const buildChanges = () => {
        const changes: Record<string, unknown> = {};
        if (form.name.trim() !== original.name) changes.name = form.name.trim();
        if (form.note !== original.note)
            changes.note = form.note.trim() || null;
        if (form.status !== original.status) changes.status = form.status;
        if (form.priority !== original.priority)
            changes.priority = form.priority;
        if (form.projectId !== original.projectId)
            changes.project_id = form.projectId;
        if (form.areaId !== original.areaId) changes.area_id = form.areaId;
        if (form.dueDate !== original.dueDate)
            changes.due_date = form.dueDate || null;
        if (JSON.stringify(form.tags) !== JSON.stringify(original.tags)) {
            const existing = tagsStore.tags?.map((tag: any) => tag.name) ?? [];
            const newNames = form.tags.filter(
                (name) => !existing.includes(name)
            );
            if (newNames.length > 0) tagsStore.addNewTags(newNames);
            changes.tags = form.tags.map((name) => ({ name }));
        }
        return changes;
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            setError(t('task.nameRequired', 'Task name is required'));
            return;
        }
        const changes = buildChanges();
        if (Object.keys(changes).length === 0) {
            onClose();
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await updateTask(task.uid!, changes as Partial<Task>);
            const fresh = await fetchTaskByUid(task.uid!);
            useStore.getState().tasksStore.updateTaskInStore(fresh);
            showSuccessToast(t('success.taskUpdated', 'Task updated!'));
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            showErrorToast(
                t('errors.failedToSaveTask', 'Failed to save task.')
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <EntitySidePanel
            isOpen={isOpen}
            onClose={onClose}
            eyebrow={t('task.title', 'Task')}
            title={form.name || t('task.untitled', 'Untitled task')}
            submitLabel={t('modals.updateTask', 'Update Task')}
            submitTestId="task-save-button"
            isSubmitting={saving}
            isDirty={isDirty}
            error={error}
            onSubmit={handleSubmit}
            testId="task-panel"
        >
            <SidePanelField
                label={t('forms.taskName', 'Name')}
                htmlFor="taskName"
            >
                <input
                    id="taskName"
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    required
                    className={sidePanelInputClass}
                    data-testid="task-name-input"
                />
            </SidePanelField>

            <SidePanelField
                label={t('forms.description', 'Description')}
                htmlFor="taskNote"
            >
                <textarea
                    id="taskNote"
                    value={form.note}
                    onChange={(e) => setField('note', e.target.value)}
                    rows={4}
                    className={`${sidePanelInputClass} resize-none`}
                />
            </SidePanelField>

            <SidePanelSection title={t('task.status.label', 'Status')}>
                <select
                    aria-label={t('task.status.label', 'Status')}
                    value={form.status}
                    onChange={(e) => setField('status', Number(e.target.value))}
                    className={sidePanelInputClass}
                    data-testid="task-status-select"
                >
                    {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {t(option.key, option.fallback)}
                        </option>
                    ))}
                </select>
            </SidePanelSection>

            <SidePanelSection title={t('forms.priority', 'Priority')}>
                <PriorityDropdown
                    value={form.priority}
                    onChange={(value) => setField('priority', value)}
                />
            </SidePanelSection>

            <SidePanelSection title={t('forms.project', 'Project')}>
                <select
                    aria-label={t('forms.project', 'Project')}
                    value={form.projectId ?? ''}
                    onChange={(e) =>
                        setField(
                            'projectId',
                            e.target.value ? Number(e.target.value) : null
                        )
                    }
                    className={sidePanelInputClass}
                    data-testid="task-project-select"
                >
                    <option value="">
                        {t('forms.noProject', 'No project')}
                    </option>
                    {projects.map((project: any) => (
                        <option key={project.id} value={project.id}>
                            {project.name}
                        </option>
                    ))}
                </select>
            </SidePanelSection>

            <SidePanelSection title={t('common.area', 'Area')}>
                <AreaDropdown
                    value={form.areaId}
                    onChange={(value) => setField('areaId', value)}
                    areas={areas}
                />
            </SidePanelSection>

            <SidePanelSection title={t('forms.dueDate', 'Due Date')}>
                <DatePicker
                    value={form.dueDate}
                    onChange={(value) => setField('dueDate', value)}
                    placeholder={t('projects.selectDueDatePlaceholder')}
                />
            </SidePanelSection>

            <SidePanelSection title={t('forms.tags', 'Tags')}>
                <TagInput
                    onTagsChange={handleTagsChange}
                    initialTags={form.tags}
                    availableTags={tagsStore.tags}
                    onFocus={handleTagInputFocus}
                />
            </SidePanelSection>
        </EntitySidePanel>
    );
};

export default TaskModal;
