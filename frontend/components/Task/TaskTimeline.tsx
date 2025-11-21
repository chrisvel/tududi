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
    ExclamationTriangleIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';

interface TaskTimelineProps {
    taskUid: string | undefined;
    refreshKey?: number;
}

const TaskTimeline: React.FC<TaskTimelineProps> = ({ taskUid, refreshKey }) => {
    const { t } = useTranslation();
    const [events, setEvents] = useState<TaskEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTimeline = async () => {
            if (!taskUid || taskUid === undefined) {
                setLoading(false);
                setEvents([]);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const timeline = await getTaskTimeline(taskUid);
                // Sort events by created_at in descending order (most recent first)
                const sortedTimeline = timeline.sort(
                    (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                );
                // Show all events, scrolling will handle display
                setEvents(sortedTimeline);
            } catch (err) {
                console.error('Error fetching task timeline:', err);
                setError(t('timeline.failedToLoad', 'Failed to load timeline'));
            } finally {
                setLoading(false);
            }
        };

        fetchTimeline();
    }, [taskUid, refreshKey]);

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
            not_started: t('status.notStarted'),
            in_progress: t('status.inProgress'),
            done: t('status.completed'),
            completed: t('status.completed'),
            archived: t('status.archived'),
            waiting: t('status.waiting'),
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
            case 'recurrence_end_date_changed': {
                const oldDate = old_value?.recurrence_end_date;
                const newDate = new_value?.recurrence_end_date;
                if (oldDate || newDate) {
                    return `${t('timeline.events.recurrenceEndDate')}: ${formatDate(oldDate)} → ${formatDate(newDate)}`;
                }
                return t('timeline.events.recurrenceEndDateChanged');
            }
            case 'recurrence_type_changed': {
                const oldType = old_value?.recurrence_type;
                const newType = new_value?.recurrence_type;
                if (oldType !== undefined && newType !== undefined) {
                    const formatRecurrenceType = (type: string) => {
                        const typeMap: Record<string, string> = {
                            none: t('recurrence.none', 'None'),
                            daily: t('recurrence.daily', 'Daily'),
                            weekly: t('recurrence.weekly', 'Weekly'),
                            monthly: t('recurrence.monthly', 'Monthly'),
                            monthly_weekday: t(
                                'recurrence.monthlyWeekday',
                                'Monthly (weekday)'
                            ),
                            monthly_last_day: t(
                                'recurrence.monthlyLastDay',
                                'Monthly (last day)'
                            ),
                        };
                        return typeMap[type] || type;
                    };
                    return `${t('timeline.events.recurrenceType')}: ${formatRecurrenceType(oldType)} → ${formatRecurrenceType(newType)}`;
                }
                return t('timeline.events.recurrenceTypeChanged');
            }
            case 'completion_based_changed':
                return t('timeline.events.completionBasedChanged');
            case 'name_changed':
                return t('timeline.events.nameUpdated');
            case 'description_changed':
                return t('timeline.events.descriptionUpdated');
            case 'note_changed':
                return t('timeline.events.noteUpdated');
            case 'project_changed':
                return t('timeline.events.projectChanged');
            case 'project_id_changed':
                return t('timeline.events.projectIdChanged');
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
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
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

    if (!taskUid) {
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
            <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <ClockIcon className="h-12 w-12 mb-3 opacity-50" />
                <span className="text-sm text-center">
                    {t('task.noActivityYet', 'No activity yet')}
                </span>
            </div>
        );
    }

    return (
        <div className="max-h-[36rem] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
            <div className="space-y-2">
                {events.map((event) => (
                    <div key={event.id} className="relative">
                        {/* Event item */}
                        <div className="py-1 relative z-10">
                            {/* Content */}
                            <div className="min-w-0">
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
