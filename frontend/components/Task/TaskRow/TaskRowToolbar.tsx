import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    FlagIcon,
    CalendarIcon,
    ClockIcon,
    FolderIcon,
    TagIcon,
    ArrowPathIcon,
    UserIcon,
    ListBulletIcon,
    DocumentTextIcon,
    PaperClipIcon,
    ArrowTopRightOnSquareIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';
import { Project } from '../../../entities/Project';
import { Person } from '../../../entities/Person';
import PriorityDropdown from '../../Shared/PriorityDropdown';
import DatePicker from '../../Shared/DatePicker';
import DateTimePicker from '../../Shared/DateTimePicker';
import PersonDropdown from '../../Shared/PersonDropdown';
import {
    fetchPeople,
    fetchAssignablePeopleForProject,
} from '../../../utils/peopleService';
import ToolbarButton from './toolbar/ToolbarButton';
import { TaskRowSetters } from './useTaskRowSave';

export type TaskRowSection =
    | 'note'
    | 'project'
    | 'tags'
    | 'recurrence'
    | 'subtasks'
    | 'attachments';

interface TaskRowToolbarProps {
    task: Task;
    setters: TaskRowSetters;
    openSection: TaskRowSection | null;
    onToggleSection: (section: TaskRowSection) => void;
    onDelete: (e: React.MouseEvent) => void;
    fullPagePath: string;
}

const normalizePriorityLabel = (
    priority: Task['priority'],
    t: (k: string, d: string) => string
): string | null => {
    const v =
        typeof priority === 'number'
            ? (['low', 'medium', 'high'][priority] as string)
            : priority;
    if (v === 'low') return t('priority.low', 'Low');
    if (v === 'medium') return t('priority.medium', 'Medium');
    if (v === 'high') return t('priority.high', 'High');
    return null;
};

const priorityToneClass = (priority: Task['priority']): string => {
    const v =
        typeof priority === 'number'
            ? ['low', 'medium', 'high'][priority]
            : priority;
    if (v === 'high') return 'text-red-500';
    if (v === 'medium') return 'text-amber-500';
    if (v === 'low') return 'text-blue-500';
    return '';
};

const TaskRowToolbar: React.FC<TaskRowToolbarProps> = ({
    task,
    setters,
    openSection,
    onToggleSection,
    onDelete,
    fullPagePath,
}) => {
    const { t } = useTranslation();

    // ----- Assignee people -----
    const [people, setPeople] = useState<Person[]>([]);
    useEffect(() => {
        const loader = task.project_uid
            ? fetchAssignablePeopleForProject(task.project_uid)
            : fetchPeople();
        loader.then((p) => setPeople(p || [])).catch(() => setPeople([]));
    }, [task.project_uid]);
    const mergedPeople = useMemo(() => {
        if (!task.AssignedTo) return people;
        return people.some((p) => p.uid === task.AssignedTo!.uid)
            ? people
            : [...people, task.AssignedTo];
    }, [people, task.AssignedTo]);

    const isRecurring =
        !!task.recurrence_type && task.recurrence_type !== 'none';
    const tagCount = task.tags?.length ?? 0;
    const project = (task.Project as Project | undefined) || null;
    const assignedPerson =
        task.AssignedTo ||
        mergedPeople.find((p) => p.uid === task.assigned_to) ||
        null;

    return (
        <div className="flex flex-wrap items-center gap-1 border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">
            {/* Priority */}
            <PriorityDropdown
                value={
                    (typeof task.priority === 'number'
                        ? ['low', 'medium', 'high'][task.priority]
                        : task.priority) as any
                }
                onChange={(p) => void setters.setPriority(p)}
                renderTrigger={({ onClick, isOpen }) => (
                    <ToolbarButton
                        onClick={onClick}
                        open={isOpen}
                        active={task.priority != null}
                        label={t('forms.task.labels.priority', 'Priority')}
                        badge={normalizePriorityLabel(task.priority, t)}
                        icon={
                            <FlagIcon
                                className={`h-4 w-4 ${priorityToneClass(task.priority)}`}
                            />
                        }
                    />
                )}
            />

            {/* Due date */}
            <DatePicker
                value={task.due_date || ''}
                onChange={(v) => void setters.setDueDate(v || null)}
                renderTrigger={({ onClick, isOpen, displayValue }) => (
                    <ToolbarButton
                        onClick={onClick}
                        open={isOpen}
                        active={!!task.due_date}
                        label={t('forms.task.labels.dueDate', 'Due date')}
                        badge={displayValue}
                        icon={<CalendarIcon className="h-4 w-4" />}
                    />
                )}
            />

            {/* Defer until */}
            <DateTimePicker
                value={task.defer_until || ''}
                onChange={(v) => void setters.setDeferUntil(v || null)}
                renderTrigger={({ onClick, isOpen, displayValue }) => (
                    <ToolbarButton
                        onClick={onClick}
                        open={isOpen}
                        active={!!task.defer_until}
                        label={t('forms.task.labels.deferUntil', 'Defer until')}
                        badge={displayValue}
                        icon={<ClockIcon className="h-4 w-4" />}
                    />
                )}
            />

            {/* Project (inline section) */}
            <ToolbarButton
                onClick={() => onToggleSection('project')}
                open={openSection === 'project'}
                active={!!project}
                label={t('forms.task.labels.project', 'Project')}
                badge={project?.name}
                icon={<FolderIcon className="h-4 w-4" />}
            />

            {/* Tags (inline section) */}
            <ToolbarButton
                onClick={() => onToggleSection('tags')}
                open={openSection === 'tags'}
                active={tagCount > 0}
                label={t('forms.task.labels.tags', 'Tags')}
                badge={tagCount > 0 ? String(tagCount) : undefined}
                icon={<TagIcon className="h-4 w-4" />}
            />

            {/* Recurrence (inline section) */}
            <ToolbarButton
                onClick={() => onToggleSection('recurrence')}
                open={openSection === 'recurrence'}
                active={isRecurring}
                label={t('forms.task.labels.recurrence', 'Repeat')}
                icon={<ArrowPathIcon className="h-4 w-4" />}
            />

            {/* Assignee */}
            <PersonDropdown
                personUid={task.assigned_to ?? null}
                people={mergedPeople}
                onChange={(uid) => void setters.setAssignee(uid)}
                renderTrigger={({ onClick, isOpen, person }) => (
                    <ToolbarButton
                        onClick={onClick}
                        open={isOpen}
                        active={!!assignedPerson}
                        label={t('tasks.assignedTo', 'Assigned to')}
                        badge={(person || assignedPerson)?.name}
                        icon={
                            assignedPerson?.color ? (
                                <span
                                    className="h-3.5 w-3.5 rounded-full inline-block border border-gray-300 dark:border-gray-600"
                                    style={{
                                        backgroundColor: assignedPerson.color,
                                    }}
                                />
                            ) : (
                                <UserIcon className="h-4 w-4" />
                            )
                        }
                    />
                )}
            />

            {/* Note toggle */}
            <ToolbarButton
                onClick={() => onToggleSection('note')}
                open={openSection === 'note'}
                active={!!task.note}
                label={t('forms.task.labels.note', 'Note')}
                icon={<DocumentTextIcon className="h-4 w-4" />}
            />

            {/* Subtasks toggle */}
            <ToolbarButton
                onClick={() => onToggleSection('subtasks')}
                open={openSection === 'subtasks'}
                active={(task.subtasks?.length ?? 0) > 0}
                label={t('tasks.subtasks', 'Subtasks')}
                badge={
                    task.subtasks && task.subtasks.length > 0
                        ? String(task.subtasks.length)
                        : undefined
                }
                icon={<ListBulletIcon className="h-4 w-4" />}
            />

            {/* Attachments */}
            <ToolbarButton
                onClick={() => onToggleSection('attachments')}
                open={openSection === 'attachments'}
                active={(task.attachments?.length ?? 0) > 0}
                label={t('forms.task.labels.attachments', 'Attachments')}
                badge={
                    task.attachments && task.attachments.length > 0
                        ? String(task.attachments.length)
                        : undefined
                }
                icon={<PaperClipIcon className="h-4 w-4" />}
            />

            <div className="flex-1" />

            {/* Open full page */}
            <Link
                to={fullPagePath}
                onClick={(e) => e.stopPropagation()}
                title={t('tasks.openFullPage', 'Open full view')}
                aria-label={t('tasks.openFullPage', 'Open full view')}
                className="inline-flex items-center h-8 px-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </Link>

            {/* Delete */}
            <ToolbarButton
                onClick={onDelete}
                tone="danger"
                label={t('common.delete', 'Delete')}
                icon={<TrashIcon className="h-4 w-4" />}
            />
        </div>
    );
};

export default TaskRowToolbar;
