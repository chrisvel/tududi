import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskEvent } from '../../entities/TaskEvent';
import {
    getTaskTimeline,
    getEventTypeLabel,
    getPriorityLabel,
} from '../../utils/taskEventService';
import {
    ClockIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    PencilIcon,
    TagIcon,
    CalendarIcon,
    FolderIcon,
    PlayIcon,
    ArchiveBoxIcon,
    SparklesIcon,
    AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';

interface TaskTimelineProps {
    taskId: number | undefined;
}

const TaskTimeline: React.FC<TaskTimelineProps> = ({ taskId }) => {
    const { t } = useTranslation();
    const [events, setEvents] = useState<TaskEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTimeline = async () => {
            if (!taskId || taskId === undefined) {
                setLoading(false);
                setEvents([]);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const timeline = await getTaskTimeline(taskId);
                setEvents(timeline);
            } catch (err) {
                console.error('Error fetching task timeline:', err);
                setError(t('timeline.failedToLoad', 'Failed to load timeline'));
            } finally {
                setLoading(false);
            }
        };

        fetchTimeline();
    }, [taskId]);

    const getEventIcon = (eventType: string, newValue?: any) => {
        const iconClass = 'h-3.5 w-3.5';

        switch (eventType) {
            case 'created':
                return (
                    <SparklesIcon className={`${iconClass} text-blue-500`} />
                );
            case 'status_changed':
                if (newValue?.status === 1)
                    return (
                        <PlayIcon className={`${iconClass} text-yellow-500`} />
                    );
                if (newValue?.status === 2)
                    return (
                        <CheckCircleIcon
                            className={`${iconClass} text-green-500`}
                        />
                    );
                if (newValue?.status === 3)
                    return (
                        <ArchiveBoxIcon
                            className={`${iconClass} text-gray-500`}
                        />
                    );
                return (
                    <AdjustmentsHorizontalIcon
                        className={`${iconClass} text-blue-500`}
                    />
                );
            case 'completed':
                return (
                    <CheckCircleIcon
                        className={`${iconClass} text-green-500`}
                    />
                );
            case 'priority_changed':
                return (
                    <ExclamationTriangleIcon
                        className={`${iconClass} text-orange-500`}
                    />
                );
            case 'due_date_changed':
                return (
                    <CalendarIcon className={`${iconClass} text-purple-500`} />
                );
            case 'project_changed':
                return (
                    <FolderIcon className={`${iconClass} text-indigo-500`} />
                );
            case 'name_changed':
            case 'description_changed':
            case 'note_changed':
                return <PencilIcon className={`${iconClass} text-gray-500`} />;
            case 'tags_changed':
                return <TagIcon className={`${iconClass} text-pink-500`} />;
            case 'archived':
                return (
                    <ArchiveBoxIcon className={`${iconClass} text-gray-500`} />
                );
            case 'today_changed':
                return (
                    <CalendarIcon className={`${iconClass} text-blue-600`} />
                );
            default:
                return <ClockIcon className={`${iconClass} text-gray-400`} />;
        }
    };

    const getTranslatedStatusLabel = (status: number | string): string => {
        // Handle both numeric and string status values
        const statusMap: Record<string | number, string> = {
            // Numeric values
            0: t('status.notStarted'),
            1: t('status.inProgress'),
            2: t('status.completed'),
            3: t('status.archived'),
            4: t('status.waiting'),
            // String values
            'not_started': t('status.notStarted'),
            'in_progress': t('status.inProgress'),
            'done': t('status.completed'),
            'completed': t('status.completed'),
            'archived': t('status.archived'),
            'waiting': t('status.waiting'),
        };

        return statusMap[status] || t('status.unknown', { status });
    };

    const getEventDescription = (event: TaskEvent) => {
        const { event_type, old_value, new_value } = event;

        switch (event_type) {
            case 'created':
                return t('timeline.events.taskCreated');
            case 'status_changed':
            case 'completed': {
                const oldStatus = old_value?.status;
                const newStatus = new_value?.status;
                if (oldStatus !== undefined && newStatus !== undefined) {
                    return `${t('timeline.events.status')}: ${getTranslatedStatusLabel(oldStatus)} → ${getTranslatedStatusLabel(newStatus)}`;
                }
                return t('timeline.events.statusChanged');
            }
            case 'priority_changed': {
                const oldPriority = old_value?.priority;
                const newPriority = new_value?.priority;
                if (oldPriority !== undefined && newPriority !== undefined) {
                    return `${t('timeline.events.priority')}: ${getPriorityLabel(oldPriority)} → ${getPriorityLabel(newPriority)}`;
                }
                return t('timeline.events.priorityChanged');
            }
            case 'due_date_changed': {
                const oldDate = old_value?.due_date;
                const newDate = new_value?.due_date;
                if (oldDate || newDate) {
                    return `${t('timeline.events.dueDate')}: ${formatDate(oldDate)} → ${formatDate(newDate)}`;
                }
                return t('timeline.events.dueDateChanged');
            }
            case 'name_changed':
                return t('timeline.events.nameUpdated');
            case 'description_changed':
                return t('timeline.events.descriptionUpdated');
            case 'note_changed':
                return t('timeline.events.noteUpdated');
            case 'project_changed':
                return t('timeline.events.projectChanged');
            case 'tags_changed':
                return t('timeline.events.tagsUpdated');
            case 'archived':
                return t('timeline.events.taskArchived');
            case 'today_changed':
                return t('timeline.events.todayFlagChanged');
            default:
                return getEventTypeLabel(event_type);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return t('timeline.events.none');
        
        // Handle ISO date strings (e.g., "2025-07-15T00:00:00.000Z")
        const date = new Date(dateString);
        
        // Check if it's today, tomorrow, or yesterday
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dateOnly = date.toISOString().split('T')[0];
        
        if (dateOnly === today) return t('dateIndicators.today');
        if (dateOnly === tomorrow) return t('dateIndicators.tomorrow');
        if (dateOnly === yesterday) return t('dateIndicators.yesterday');
        
        // Return formatted date (e.g., "Jul 15, 2025")
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <ClockIcon className="h-6 w-6 mb-2 animate-spin" />
                <span className="text-sm">Loading timeline...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-red-500">
                <ExclamationTriangleIcon className="h-6 w-6 mb-2" />
                <span className="text-sm">{error}</span>
            </div>
        );
    }

    if (!taskId) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <SparklesIcon className="h-6 w-6 mb-2" />
                <span className="text-sm text-center">
                    Timeline will appear after saving
                </span>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <ClockIcon className="h-6 w-6 mb-2" />
                <span className="text-sm">No activity yet</span>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="space-y-2">
                {events.map((event) => (
                    <div key={event.id} className="relative">
                        {/* Event item */}
                        <div className="flex items-start space-x-3 py-1 relative z-10">
                            {/* Icon */}
                            <div
                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                    event.event_type === 'created'
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                                        : event.event_type === 'completed'
                                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                                          : event.event_type ===
                                                  'status_changed' &&
                                              event.new_value?.status === 1
                                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
                                            : event.event_type ===
                                                'priority_changed'
                                              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'
                                              : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                                }`}
                            >
                                {getEventIcon(
                                    event.event_type,
                                    event.new_value
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-tight">
                                    {getEventDescription(event)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {formatTimeAgo(event.created_at)}
                                </div>

                                {/* Additional details for certain events */}
                                {event.event_type === 'tags_changed' &&
                                    event.new_value && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {Array.isArray(event.new_value) &&
                                                event.new_value.map(
                                                    (
                                                        tag: any,
                                                        tagIndex: number
                                                    ) => (
                                                        <span
                                                            key={tagIndex}
                                                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                                                        >
                                                            {tag.name || tag}
                                                        </span>
                                                    )
                                                )}
                                        </div>
                                    )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TaskTimeline;
