import React from 'react';
import {
    TagIcon,
    FolderIcon,
    ArrowPathIcon,
    ListBulletIcon,
    ExclamationTriangleIcon,
    CalendarIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';
import { useTranslation } from 'react-i18next';

interface TaskSectionToggleProps {
    expandedSections: {
        tags: boolean;
        project: boolean;
        priority: boolean;
        dueDate: boolean;
        deferUntil: boolean;
        recurrence: boolean;
        subtasks: boolean;
    };
    onToggleSection: (
        section: keyof TaskSectionToggleProps['expandedSections']
    ) => void;
    formData: Task;
    subtasksCount: number;
}

const TaskSectionToggle: React.FC<TaskSectionToggleProps> = ({
    expandedSections,
    onToggleSection,
    formData,
    subtasksCount,
}) => {
    const { t } = useTranslation();
    const toggleButtons = [
        {
            key: 'tags' as const,
            icon: TagIcon,
            title: t('forms.task.labels.tags', 'Tags'),
            hasValue: formData.tags && formData.tags.length > 0,
        },
        {
            key: 'project' as const,
            icon: FolderIcon,
            title: t('forms.task.labels.project', 'Project'),
            hasValue: !!formData.project_id,
        },
        {
            key: 'priority' as const,
            icon: ExclamationTriangleIcon,
            title: t('forms.task.labels.priority', 'Priority'),
            hasValue: formData.priority != null,
        },
        {
            key: 'dueDate' as const,
            icon: CalendarIcon,
            title: t('forms.task.labels.dueDate', 'Due Date'),
            hasValue: !!formData.due_date,
        },
        {
            key: 'deferUntil' as const,
            icon: ClockIcon,
            title: t('forms.task.labels.deferUntil', 'Defer Until'),
            hasValue: !!formData.defer_until,
        },
        {
            key: 'recurrence' as const,
            icon: ArrowPathIcon,
            title: t('forms.task.recurrence', 'Recurrence'),
            hasValue:
                (formData.recurrence_type &&
                    formData.recurrence_type !== 'none') ||
                !!formData.recurring_parent_uid,
        },
        {
            key: 'subtasks' as const,
            icon: ListBulletIcon,
            title: t('forms.task.subtasks', 'Subtasks'),
            hasValue: subtasksCount > 0,
        },
    ];

    return (
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 px-3 py-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                    {toggleButtons.map(
                        ({ key, icon: Icon, title, hasValue }) => (
                            <button
                                key={key}
                                onClick={() => onToggleSection(key)}
                                className={`relative p-2 rounded-full transition-colors ${
                                    expandedSections[key]
                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                                title={title}
                            >
                                <Icon className="h-5 w-5" />
                                {hasValue && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                )}
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskSectionToggle;
