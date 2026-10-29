import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon, PencilIcon } from '@heroicons/react/24/outline';
import { Task, PriorityType, RecurrenceType } from '../../entities/Task';
import { Person } from '../../entities/Person';
import {
    updateTask,
    fetchTaskByUid,
    fetchSubtasks,
    deleteTask,
} from '../../utils/tasksService';
import {
    fetchPeople,
    fetchAssignablePeopleForProject,
} from '../../utils/peopleService';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import TagInput from '../Tag/TagInput';
import QuickCaptureInput from '../Inbox/QuickCaptureInput';
import { resolveTaskTokens } from '../../utils/taskTokens';
import PriorityDropdown from '../Shared/PriorityDropdown';
import AreaDropdown from '../Shared/AreaDropdown';
import DateTimePicker from '../Shared/DateTimePicker';
import {
    fromDueParts,
    toDueParts,
    isStartAfterDue,
} from '../../utils/dueDateTime';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import {
    SidePanelField,
    SidePanelSection,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';
import { getStatusValue } from '../../constants/taskStatus';
import PersonDropdown from '../Shared/PersonDropdown';
import TaskDeferUntilSection from './TaskForm/TaskDeferUntilSection';
import TaskRecurrenceSection from './TaskForm/TaskRecurrenceSection';
import TaskSubtasksCard from './TaskDetails/TaskSubtasksCard';
import TaskAttachmentsCard from './TaskDetails/TaskAttachmentsCard';
import TaskComments from './TaskComments';
import { TaskStatusDropdown, TaskProjectDropdown } from './TaskPanelDropdowns';
import {
    openTaskPanel,
    TASK_PANEL_SAVED_EVENT,
    TaskPanelSavedDetail,
} from '../../store/taskPanelStore';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: Task;
    onSaved?: (task: Task) => void;
}

interface RecurrenceFormState {
    recurrence_type: RecurrenceType;
    recurrence_interval: number;
    recurrence_end_date: string | null;
    recurrence_weekday: number | null;
    recurrence_weekdays: number[];
    recurrence_month_day: number | null;
    recurrence_week_of_month: number | null;
    completion_based: boolean;
}

interface TaskFormState {
    name: string;
    note: string;
    status: number;
    priority: PriorityType;
    projectId: number | null;
    areaId: number | null;
    dueDate: string;
    dueTime: string;
    startDate: string;
    startTime: string;
    tags: string[];
    assignedTo: string | null;
    deferUntil: string;
    recurrence: RecurrenceFormState;
}

const toFormState = (task: Task): TaskFormState => ({
    name: task.name ?? '',
    note: task.note ?? '',
    status: getStatusValue(task.status as any),
    priority: (task.priority ?? null) as PriorityType,
    projectId: task.project_id ?? null,
    areaId: task.area_id ?? null,
    dueDate: task.due_date ? String(task.due_date).split('T')[0] : '',
    dueTime: task.due_has_time ? (task.due_time ?? '') : '',
    startDate: task.start_date ? String(task.start_date).split('T')[0] : '',
    startTime: task.start_time ?? '',
    tags: task.tags?.map((tag) => tag.name) ?? [],
    assignedTo: task.assigned_to ?? null,
    deferUntil: task.defer_until ?? '',
    recurrence: {
        recurrence_type: (task.recurrence_type || 'none') as RecurrenceType,
        recurrence_interval: task.recurrence_interval || 1,
        recurrence_end_date: task.recurrence_end_date || null,
        recurrence_weekday: task.recurrence_weekday ?? null,
        recurrence_weekdays: task.recurrence_weekdays || [],
        recurrence_month_day: task.recurrence_month_day ?? null,
        recurrence_week_of_month: task.recurrence_week_of_month ?? null,
        completion_based: !!task.completion_based,
    },
});

// The same payload the task page sends: fields that do not apply to the
// chosen pattern are cleared.
const recurrencePayload = (r: RecurrenceFormState): Partial<Task> => ({
    recurrence_type: r.recurrence_type,
    recurrence_interval: r.recurrence_interval || 1,
    recurrence_end_date: r.recurrence_end_date || null,
    recurrence_weekday:
        r.recurrence_type === 'weekly' ||
        r.recurrence_type === 'monthly_weekday'
            ? (r.recurrence_weekday ?? null)
            : null,
    recurrence_weekdays:
        r.recurrence_type === 'weekly' ? r.recurrence_weekdays || [] : null,
    recurrence_month_day:
        r.recurrence_type === 'monthly'
            ? (r.recurrence_month_day ?? null)
            : null,
    recurrence_week_of_month:
        r.recurrence_type === 'monthly_weekday'
            ? (r.recurrence_week_of_month ?? null)
            : null,
    completion_based: r.completion_based,
});

const notifyTaskSaved = (task: Task) =>
    window.dispatchEvent(
        new CustomEvent<TaskPanelSavedDetail>(TASK_PANEL_SAVED_EVENT, {
            detail: { task },
        })
    );

// Edits a task in the side panel. The form fields save together on Update;
// subtasks, attachments and comments save as soon as they change, like on the
// task page. Relations stay on the task page.
const TaskModal: React.FC<TaskModalProps> = ({
    isOpen,
    onClose,
    task,
    onSaved,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const projects = useStore(
        (state: any) => state.projectsStore.projects
    ) as any[];
    const areas = useStore((state: any) => state.areasStore.areas) as any[];
    const tagsStore = useStore((state: any) => state.tagsStore);

    const [form, setForm] = useState<TaskFormState>(() => toFormState(task));
    // What the name box starts from. It changes only on open and after the
    // typed #tags, +project, ~area and dates are moved into their fields.
    const [nameSeed, setNameSeed] = useState(task.name ?? '');
    const [saving, setSaving] = useState(false);
    // Like the task page: a written note opens rendered, an empty one opens
    // ready to type.
    const [noteTab, setNoteTab] = useState<'edit' | 'preview'>(
        task.note ? 'preview' : 'edit'
    );
    const [error, setError] = useState<string | null>(null);
    const [people, setPeople] = useState<Person[]>([]);
    const [subtasks, setSubtasks] = useState<Task[]>([]);

    useEffect(() => {
        if (!isOpen || !task.uid) return;
        let cancelled = false;
        fetchSubtasks(task.uid)
            .then((list) => !cancelled && setSubtasks(list))
            .catch(() => !cancelled && setSubtasks([]));
        return () => {
            cancelled = true;
        };
    }, [isOpen, task.uid]);

    useEffect(() => {
        if (!isOpen) return;
        setForm(toFormState(task));
        setNameSeed(task.name ?? '');
        setNoteTab(task.note ? 'preview' : 'edit');
        setError(null);
    }, [isOpen, task]);

    const selectedProjectUid =
        projects.find((project: any) => project.id === form.projectId)?.uid ??
        null;
    useEffect(() => {
        if (!isOpen) return;
        const loader = selectedProjectUid
            ? fetchAssignablePeopleForProject(selectedProjectUid)
            : fetchPeople();
        loader.then((list) => setPeople(list || [])).catch(() => setPeople([]));
    }, [isOpen, selectedProjectUid]);
    const assignablePeople =
        task.AssignedTo && !people.some((p) => p.uid === task.AssignedTo!.uid)
            ? [...people, task.AssignedTo]
            : people;

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

    // The name box reads the same tokens as quick capture. They leave the
    // name and land in the tags, project, area and due date fields.
    const resolveTokens = async (
        current: TaskFormState
    ): Promise<TaskFormState> => {
        const text = current.name.trim();
        if (!text || text === original.name) return current;
        const resolved = await resolveTaskTokens(
            text,
            projects,
            areas,
            current.tags
        );
        if (!resolved) return current;
        const next = { ...current, name: resolved.name, tags: resolved.tags };
        if (resolved.projectId !== null) next.projectId = resolved.projectId;
        if (resolved.areaId !== null) next.areaId = resolved.areaId;
        if (resolved.dueDate) next.dueDate = resolved.dueDate;
        return next;
    };

    const applyTokens = async (text: string) => {
        const resolved = await resolveTokens({ ...form, name: text });
        setForm(resolved);
        setNameSeed(resolved.name);
    };

    // Only the fields that changed are sent, so recurring tasks and other
    // side effects are not triggered by untouched values.
    const buildChanges = (form: TaskFormState) => {
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
        if (
            form.dueDate !== original.dueDate ||
            form.dueTime !== original.dueTime
        ) {
            changes.due_date = form.dueDate || null;
            changes.due_time =
                form.dueDate && form.dueTime ? form.dueTime : null;
        }
        if (
            form.startDate !== original.startDate ||
            form.startTime !== original.startTime
        ) {
            changes.start_date = form.startDate || null;
            changes.start_time =
                form.startDate && form.startTime ? form.startTime : null;
        }
        if (form.assignedTo !== original.assignedTo)
            changes.assigned_to = form.assignedTo;
        if (form.deferUntil !== original.deferUntil)
            changes.defer_until = form.deferUntil || null;
        if (
            !task.recurring_parent_id &&
            JSON.stringify(form.recurrence) !==
                JSON.stringify(original.recurrence)
        ) {
            Object.assign(changes, recurrencePayload(form.recurrence));
        }
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
        if (
            isStartAfterDue(
                form.startDate,
                form.startTime,
                form.dueDate,
                form.dueTime
            )
        ) {
            setError(
                t(
                    'task.startAfterDueError',
                    'Start cannot be after the due date'
                )
            );
            return;
        }
        if (form.deferUntil && form.dueDate && !task.recurring_parent_id) {
            // Due dates are date-only; any time on the due day is fine
            const defer = new Date(form.deferUntil);
            const dueEnd = new Date(`${form.dueDate}T23:59:59.999`);
            if (defer > dueEnd) {
                setError(
                    t(
                        'task.deferAfterDueError',
                        'Defer until date cannot be after the due date'
                    )
                );
                return;
            }
        }
        setSaving(true);
        const changes = buildChanges(await resolveTokens(form));
        if (Object.keys(changes).length === 0) {
            setSaving(false);
            onClose();
            return;
        }

        setError(null);
        try {
            await updateTask(task.uid!, changes as Partial<Task>);
            const fresh = await fetchTaskByUid(task.uid!);
            useStore.getState().tasksStore.updateTaskInStore(fresh);
            notifyTaskSaved(fresh);
            onSaved?.(fresh);
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

    // Subtask edits save straight away and refresh the parent everywhere
    const refreshParent = async () => {
        if (!task.uid) return;
        try {
            const fresh = await fetchTaskByUid(task.uid);
            useStore.getState().tasksStore.updateTaskInStore(fresh);
            notifyTaskSaved(fresh);
        } catch {
            // The subtask itself is saved; the row refreshes on next load
        }
    };

    const handleSubtaskUpdate = async (updated: Task) => {
        if (!updated.uid) return;
        try {
            const saved = await updateTask(updated.uid, updated);
            setSubtasks((prev) =>
                prev.map((s) => (s.id === saved.id ? { ...s, ...saved } : s))
            );
            void refreshParent();
        } catch {
            showErrorToast(
                t('task.statusUpdateError', 'Failed to update status')
            );
        }
    };

    const handleSubtaskDelete = async (subtaskUid: string) => {
        try {
            await deleteTask(subtaskUid);
            setSubtasks((prev) => prev.filter((s) => s.uid !== subtaskUid));
            void refreshParent();
        } catch {
            showErrorToast(t('task.deleteError', 'Failed to delete task'));
        }
    };

    const handleQuickAddSubtask = async (name: string) => {
        if (!task.uid || !task.id) return;
        const newSubtask = {
            name,
            status: 'not_started',
            today: false,
            parent_task_id: task.id,
            _isNew: true,
            isNew: true,
            completed_at: null,
        } as unknown as Task;
        try {
            await updateTask(task.uid, {
                subtasks: [...subtasks, newSubtask],
            } as Partial<Task>);
            setSubtasks(await fetchSubtasks(task.uid));
            void refreshParent();
        } catch {
            showErrorToast(
                t('errors.failedToSaveTask', 'Failed to save task.')
            );
        }
    };

    const isRecurringInstance = !!task.recurring_parent_id;

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
                <div
                    className={sidePanelInputClass}
                    data-testid="task-name-field"
                >
                    <QuickCaptureInput
                        mode="edit"
                        bare
                        multiline={false}
                        hidePrimaryButton
                        initialValue={nameSeed}
                        projects={projects}
                        onTextChange={(text) => setField('name', text)}
                        onSubmitOverride={applyTokens}
                    />
                </div>
            </SidePanelField>

            <SidePanelField
                label={t('forms.description', 'Description')}
                htmlFor="taskNote"
            >
                <div className="relative">
                    <div className="absolute top-2 right-2 z-10 flex space-x-1">
                        <button
                            type="button"
                            onClick={() => setNoteTab('edit')}
                            className={`p-1.5 rounded-md transition-colors ${
                                noteTab === 'edit'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                            }`}
                            title={t('common.edit', 'Edit')}
                            aria-pressed={noteTab === 'edit'}
                            data-testid="task-note-edit-tab"
                        >
                            <PencilIcon className="h-3 w-3" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setNoteTab('preview')}
                            className={`p-1.5 rounded-md transition-colors ${
                                noteTab === 'preview'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                            }`}
                            title={t('common.preview', 'Preview')}
                            aria-pressed={noteTab === 'preview'}
                            data-testid="task-note-preview-tab"
                        >
                            <EyeIcon className="h-3 w-3" />
                        </button>
                    </div>
                    {noteTab === 'edit' ? (
                        <textarea
                            id="taskNote"
                            value={form.note}
                            onChange={(e) => setField('note', e.target.value)}
                            rows={8}
                            className={`${sidePanelInputClass} resize-y pr-20`}
                            placeholder={t(
                                'task.contentPlaceholder',
                                'Add content here... (Markdown supported)'
                            )}
                        />
                    ) : (
                        <div
                            className="min-h-[12rem] rounded-md bg-gray-100 dark:bg-gray-900 px-3 py-2 pr-20 text-sm overflow-y-auto"
                            data-testid="task-note-preview"
                        >
                            {form.note ? (
                                <MarkdownRenderer
                                    content={form.note}
                                    className="prose prose-sm dark:prose-invert max-w-none"
                                    onContentChange={(note) =>
                                        setField('note', note)
                                    }
                                />
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400 italic">
                                    {t(
                                        'task.noContentPreview',
                                        'No content to preview. Switch to Edit mode to add content.'
                                    )}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </SidePanelField>

            <SidePanelSection title={t('common.status', 'Status')}>
                <TaskStatusDropdown
                    value={form.status}
                    onChange={(value) => setField('status', value)}
                />
            </SidePanelSection>

            <SidePanelSection title={t('forms.priority', 'Priority')}>
                <PriorityDropdown
                    value={form.priority}
                    onChange={(value) => setField('priority', value)}
                />
            </SidePanelSection>

            <SidePanelSection title={t('forms.project', 'Project')}>
                <TaskProjectDropdown
                    value={form.projectId}
                    onChange={(value) => setField('projectId', value)}
                    projects={projects}
                />
            </SidePanelSection>

            <SidePanelSection title={t('common.area', 'Area')}>
                <AreaDropdown
                    value={form.areaId}
                    onChange={(value) => setField('areaId', value)}
                    areas={areas}
                />
            </SidePanelSection>

            <SidePanelSection title={t('forms.startDate', 'Start')}>
                <DateTimePicker
                    value={fromDueParts(form.startDate, form.startTime || null)}
                    onChange={(iso) => {
                        const parts = toDueParts(iso);
                        setField('startDate', parts.date || '');
                        setField('startTime', parts.time || '');
                    }}
                    placeholder={t(
                        'forms.task.startDatePlaceholder',
                        'Select start date'
                    )}
                />
            </SidePanelSection>

            <SidePanelSection title={t('forms.dueDate', 'Due Date')}>
                <DateTimePicker
                    value={fromDueParts(form.dueDate, form.dueTime || null)}
                    onChange={(iso) => {
                        const parts = toDueParts(iso);
                        setField('dueDate', parts.date || '');
                        setField('dueTime', parts.time || '');
                    }}
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

            <SidePanelSection title={t('tasks.assignedTo', 'Assigned to')}>
                <PersonDropdown
                    personUid={form.assignedTo}
                    people={assignablePeople}
                    onChange={(uid) => setField('assignedTo', uid)}
                />
            </SidePanelSection>

            <SidePanelSection title={t('task.deferUntil', 'Defer Until')}>
                <TaskDeferUntilSection
                    value={form.deferUntil}
                    onChange={(value) => setField('deferUntil', value)}
                    placeholder={t(
                        'forms.task.deferUntilPlaceholder',
                        'Select defer until date and time'
                    )}
                />
            </SidePanelSection>

            <SidePanelSection title={t('forms.task.recurrence', 'Recurrence')}>
                {isRecurringInstance ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t(
                            'task.instanceOf',
                            'This is an instance of a recurring task'
                        )}
                        {task.recurring_parent_uid && (
                            <>
                                {' '}
                                <button
                                    type="button"
                                    onClick={() =>
                                        openTaskPanel(
                                            task.recurring_parent_uid!
                                        )
                                    }
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                >
                                    {t('task.parentTask', 'Parent Task')}
                                </button>
                            </>
                        )}
                    </p>
                ) : (
                    <TaskRecurrenceSection
                        recurrenceType={form.recurrence.recurrence_type}
                        recurrenceInterval={form.recurrence.recurrence_interval}
                        recurrenceEndDate={
                            form.recurrence.recurrence_end_date || undefined
                        }
                        recurrenceWeekday={
                            form.recurrence.recurrence_weekday ?? undefined
                        }
                        recurrenceWeekdays={form.recurrence.recurrence_weekdays}
                        recurrenceMonthDay={
                            form.recurrence.recurrence_month_day ?? undefined
                        }
                        recurrenceWeekOfMonth={
                            form.recurrence.recurrence_week_of_month ??
                            undefined
                        }
                        completionBased={form.recurrence.completion_based}
                        onChange={(field, value) =>
                            setForm((prev) => {
                                const recurrence = {
                                    ...prev.recurrence,
                                    [field]: value,
                                };
                                if (
                                    field === 'recurrence_type' &&
                                    value === 'monthly' &&
                                    !prev.recurrence.recurrence_month_day
                                ) {
                                    recurrence.recurrence_month_day =
                                        new Date().getDate();
                                }
                                return { ...prev, recurrence };
                            })
                        }
                    />
                )}
            </SidePanelSection>

            {task.uid && (
                <>
                    <SidePanelSection title={t('task.subtasks', 'Subtasks')}>
                        <TaskSubtasksCard
                            subtasks={subtasks}
                            projects={projects}
                            onSubtaskUpdate={handleSubtaskUpdate}
                            onSubtaskDelete={(uid) =>
                                void handleSubtaskDelete(uid)
                            }
                            onQuickAdd={(name) =>
                                void handleQuickAddSubtask(name)
                            }
                        />
                    </SidePanelSection>

                    <SidePanelSection
                        title={t('task.attachments', 'Attachments')}
                    >
                        <TaskAttachmentsCard
                            taskUid={task.uid}
                            showTitle={false}
                        />
                    </SidePanelSection>

                    <SidePanelSection title={t('task.comments', 'Comments')}>
                        <TaskComments task={task} />
                    </SidePanelSection>
                </>
            )}
        </EntitySidePanel>
    );
};

export default TaskModal;
