import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../entities/Task';
import { Project } from '../entities/Project';
import { updateTask } from '../utils/tasksService';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    CalendarIcon,
    XMarkIcon,
    ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { format, addWeeks, addDays } from 'date-fns';
import { el, enUS, es, ja, uk, de } from 'date-fns/locale';
import CalendarMonthView from './Calendar/CalendarMonthView';
import CalendarWeekView from './Calendar/CalendarWeekView';
import CalendarDayView from './Calendar/CalendarDayView';
import { getApiPath } from '../config/paths';
import { Link, useNavigate } from 'react-router-dom';
import { parseDateString } from '../utils/dateUtils';

const getLocale = (language: string) => {
    switch (language) {
        case 'el':
            return el;
        case 'es':
            return es;
        case 'jp':
            return ja;
        case 'ua':
            return uk;
        case 'de':
            return de;
        default:
            return enUS;
    }
};

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: 'task' | 'event';
    color?: string;
}

const Calendar: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'week' | 'day'>('month');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [allTasks, setAllTasks] = useState<any[]>([]);
    const [, setProjects] = useState<Project[]>([]);
    const [isEventDetailModalOpen, setIsEventDetailModalOpen] = useState(false);

    // Dispatch global modal events

    const locale = getLocale(i18n.language);

    // Load tasks and projects on component mount
    useEffect(() => {
        loadTasks();
        loadProjects();
    }, []);

    const loadTasks = async () => {
        setIsLoadingTasks(true);
        try {
            const response = await fetch(getApiPath('tasks'), {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();

                // Handle different API response formats
                let tasks;
                if (Array.isArray(data)) {
                    tasks = data;
                } else if (data && Array.isArray(data.tasks)) {
                    tasks = data.tasks;
                } else if (data && data.data && Array.isArray(data.data)) {
                    tasks = data.data;
                } else {
                    console.error('Unexpected API response format:', data);
                    tasks = [];
                }

                // Store the original tasks for later reference
                setAllTasks(tasks);

                const taskEvents = convertTasksToEvents(tasks);
                setEvents(taskEvents);
            } else {
                console.error('Failed to load tasks, status:', response.status);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        } finally {
            setIsLoadingTasks(false);
        }
    };

    const convertTasksToEvents = (tasks: any[]): CalendarEvent[] => {
        const taskEvents: CalendarEvent[] = [];

        if (!Array.isArray(tasks)) {
            console.error('convertTasksToEvents received non-array:', tasks);
            return [];
        }

        tasks.forEach((task) => {
            // Add deferred tasks with defer_until dates
            if (task.defer_until) {
                const deferDate = new Date(task.defer_until);
                const taskEvent = {
                    id: `task-defer-${task.id}`,
                    title: `⏰ ${task.name || task.title || `Task ${task.id}`}`,
                    start: deferDate,
                    end: new Date(deferDate.getTime() + 60 * 60 * 1000), // 1 hour duration
                    type: 'task' as const,
                    color: task.completed_at ? '#22c55e' : '#f59e0b', // Green if completed, amber if deferred
                };
                taskEvents.push(taskEvent);
            }

            // Add tasks with due dates
            if (task.due_date) {
                const dueDate = parseDateString(task.due_date);
                if (dueDate) {
                    const taskEvent = {
                        id: `task-${task.id}`,
                        title: task.name || task.title || `Task ${task.id}`,
                        start: dueDate,
                        end: new Date(dueDate.getTime() + 60 * 60 * 1000), // 1 hour duration
                        type: 'task' as const,
                        color: task.completed_at ? '#22c55e' : '#3b82f6', // Green if completed, blue if not
                    };
                    taskEvents.push(taskEvent);
                }
            }

            // Add tasks scheduled for today (if they don't have defer_until or due_date)
            if (!task.defer_until && !task.due_date && task.created_at) {
                const createdDate = new Date(task.created_at);
                const today = new Date();

                // Show tasks created today on the calendar
                if (createdDate.toDateString() === today.toDateString()) {
                    const taskEvent = {
                        id: `task-created-${task.id}`,
                        title: `📝 ${task.name || task.title || `Task ${task.id}`}`,
                        start: createdDate,
                        end: new Date(createdDate.getTime() + 30 * 60 * 1000), // 30 min duration
                        type: 'task' as const,
                        color: task.completed_at ? '#22c55e' : '#3b82f6', // Green if completed, blue if not
                    };
                    taskEvents.push(taskEvent);
                }
            }

            // Always add tasks to calendar for easier debugging (only if no defer_until, due_date, or created_at)
            if (!task.defer_until && !task.due_date && !task.created_at) {
                const taskEvent = {
                    id: `task-fallback-${task.id}`,
                    title: `📌 ${task.name || task.title || `Task ${task.id}`}`,
                    start: new Date(), // Today
                    end: new Date(Date.now() + 30 * 60 * 1000), // 30 min duration
                    type: 'task' as const,
                    color: task.completed_at ? '#22c55e' : '#8b5cf6', // Green if completed, purple if not
                };
                taskEvents.push(taskEvent);
            }
        });

        return taskEvents;
    };

    const loadProjects = async () => {
        try {
            const response = await fetch(getApiPath('projects'), {
                credentials: 'include',
            });
            if (response.ok) {
                const projectsData = await response.json();
                setProjects(Array.isArray(projectsData) ? projectsData : []);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    };

    const navigateView = (direction: 'prev' | 'next') => {
        setCurrentDate((prev) => {
            if (view === 'month') {
                const newDate = new Date(prev);
                if (direction === 'prev') {
                    newDate.setMonth(prev.getMonth() - 1);
                } else {
                    newDate.setMonth(prev.getMonth() + 1);
                }
                return newDate;
            } else if (view === 'week') {
                return direction === 'prev'
                    ? addWeeks(prev, -1)
                    : addWeeks(prev, 1);
            } else {
                // day
                return direction === 'prev'
                    ? addDays(prev, -1)
                    : addDays(prev, 1);
            }
        });
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const handleDateClick = () => {
        // Date click handler - can be used for future functionality
    };

    const handleEventClick = (event: CalendarEvent) => {
        // Handle task events
        if (event.type === 'task') {
            // Extract task ID from event ID (handles task-, task-defer-, task-created-, task-fallback-)
            const taskId = event.id.replace(
                /^task(-defer|-created|-fallback)?-/,
                ''
            );
            const task = allTasks.find((t) => t.id.toString() === taskId);

            if (task) {
                // Normalize task shape before opening TaskDetails
                const taskEntity: Task = {
                    ...task,
                    name: task.name || task.title || `Task ${task.id}`,
                    // Ensure all required Task properties are present
                    priority: task.priority || 'low',
                    status: task.status || 'not_started',
                    tags: task.tags || [],
                    note: task.note || task.description || '',
                    due_date: task.due_date,
                    created_at: task.created_at,
                    completed_at: task.completed_at,
                    project_id: task.project_id,
                };

                setSelectedTask(taskEntity);
                setIsEventDetailModalOpen(true);
            }
        }
    };

    const handleTimeSlotClick = () => {
        // Time slot click handler - can be used for future functionality
    };

    const handleEditTask = () => {
        if (selectedTask?.uid) {
            setIsEventDetailModalOpen(false);
            const targetUid = selectedTask.uid;
            setSelectedTask(null);
            navigate(`/task/${targetUid}`);
        }
    };

    const handleEventDrop = async (
        eventId: string,
        newDate: Date,
        newHour?: number
    ) => {
        console.log('Event drop:', { eventId, newDate, newHour });

        // Extract task ID from event ID
        const taskId = eventId.replace(
            /^task(-defer|-created|-fallback)?-/,
            ''
        );
        const task = allTasks.find((t) => t.id.toString() === taskId);

        if (!task) {
            console.error('Task not found:', taskId);
            return;
        }

        if (!task.uid) {
            console.error('Task has no uid:', task);
            return;
        }

        console.log('Found task:', task);

        // Calculate new date/time
        const newDateTime = new Date(newDate);
        if (newHour !== undefined) {
            newDateTime.setHours(newHour, 0, 0, 0);
        } else {
            // If no hour specified (month view), keep the original time or set to start of day
            if (task.due_date) {
                const originalTime = parseDateString(task.due_date);
                if (originalTime) {
                    newDateTime.setHours(
                        originalTime.getHours(),
                        originalTime.getMinutes(),
                        0,
                        0
                    );
                } else {
                    newDateTime.setHours(0, 0, 0, 0);
                }
            } else {
                newDateTime.setHours(0, 0, 0, 0);
            }
        }

        // Determine which field to update based on event type
        const isDeferEvent = eventId.startsWith('task-defer-');
        const fieldToUpdate = isDeferEvent ? 'defer_until' : 'due_date';

        console.log('Updating task:', {
            uid: task.uid,
            field: fieldToUpdate,
            newDateTime: newDateTime.toISOString(),
        });

        // Optimistically update the UI first
        const updatedTask = {
            ...task,
            [fieldToUpdate]: newDateTime.toISOString(),
        };

        // Update local tasks state
        setAllTasks((prev) =>
            prev.map((t) => (t.id === task.id ? updatedTask : t))
        );

        // Update events state
        setEvents((prevEvents) =>
            prevEvents.map((event) => {
                if (event.id === eventId) {
                    return {
                        ...event,
                        start: newDateTime,
                        end: new Date(newDateTime.getTime() + 60 * 60 * 1000),
                    };
                }
                return event;
            })
        );

        // Update in background
        try {
            await updateTask(task.uid, {
                [fieldToUpdate]: newDateTime.toISOString(),
            });
            console.log('Task updated successfully');
        } catch (error) {
            console.error('Error updating task:', error);
            // Revert on error
            await loadTasks();
        }
    };

    return (
        <div className="h-full flex flex-col px-4 py-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="w-full flex-1 flex flex-col min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-lg shadow-md">
                            <CalendarIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                {t('sidebar.calendar')}
                            </h2>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                {format(currentDate, 'MMMM yyyy', { locale })}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        {/* View selector */}
                        <div className="flex rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 p-0.5 shadow-inner">
                            {['month', 'week', 'day'].map((viewType) => (
                                <button
                                    key={viewType}
                                    onClick={() =>
                                        setView(
                                            viewType as 'month' | 'week' | 'day'
                                        )
                                    }
                                    className={`px-4 py-2 text-sm font-semibold capitalize transition-all duration-200 ${
                                        view === viewType
                                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    } ${viewType === 'month' ? 'rounded-l-md' : ''} ${viewType === 'day' ? 'rounded-r-md' : ''}`}
                                >
                                    {t(`calendar.${viewType}`)}
                                </button>
                            ))}
                        </div>

                        {/* Navigation */}
                        <button
                            onClick={() => navigateView('prev')}
                            className="p-2.5 rounded-lg bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 hover:shadow-md"
                        >
                            <ChevronLeftIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                        </button>

                        <button
                            onClick={goToToday}
                            className="px-4 py-2.5 text-sm font-semibold bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                            {t('calendar.today')}
                        </button>

                        <button
                            onClick={() => navigateView('next')}
                            className="p-2.5 rounded-lg bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 hover:shadow-md"
                        >
                            <ChevronRightIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                        </button>
                    </div>
                </div>

                {/* Loading indicator */}
                {isLoadingTasks && (
                    <div className="text-center py-4 px-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            {t('calendar.loadingTasks')}
                        </span>
                    </div>
                )}

                {/* Calendar view */}
                <div className="flex-1 overflow-hidden min-h-0">
                    {view === 'month' && (
                        <CalendarMonthView
                            currentDate={currentDate}
                            events={events}
                            onDateClick={handleDateClick}
                            onEventClick={handleEventClick}
                            onEventDrop={handleEventDrop}
                        />
                    )}

                    {view === 'week' && (
                        <CalendarWeekView
                            currentDate={currentDate}
                            events={events}
                            onDateClick={handleDateClick}
                            onEventClick={handleEventClick}
                            onTimeSlotClick={handleTimeSlotClick}
                            onEventDrop={handleEventDrop}
                        />
                    )}

                    {view === 'day' && (
                        <CalendarDayView
                            currentDate={currentDate}
                            events={events}
                            onEventClick={handleEventClick}
                            onTimeSlotClick={handleTimeSlotClick}
                            onEventDrop={handleEventDrop}
                        />
                    )}
                </div>

                {/* Event Details Modal */}
                {selectedTask && (
                    <TaskEventModal
                        isOpen={isEventDetailModalOpen}
                        onClose={() => {
                            setIsEventDetailModalOpen(false);
                            setSelectedTask(null);
                        }}
                        task={selectedTask}
                        onEditTask={handleEditTask}
                    />
                )}

                {/* Full Task Edit Modal */}
            </div>
        </div>
    );
};

// Simple Task Event Details Modal Component
interface TaskEventModalProps {
    isOpen: boolean;
    task: Task;
    onClose: () => void;
    onEditTask: () => void;
}

const TaskEventModal: React.FC<TaskEventModalProps> = ({
    isOpen,
    task,
    onClose,
    onEditTask,
}) => {
    const { t, i18n } = useTranslation();
    const locale = getLocale(i18n.language);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        📋 {t('calendar.taskDetails')}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Task Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('calendar.title')}
                        </label>
                        <p className="text-gray-900 dark:text-gray-100">
                            {task.name || `Task ${task.id}`}
                        </p>
                    </div>

                    {/* Task Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('calendar.status')}
                        </label>
                        <div className="flex items-center">
                            <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    task.completed_at
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                }`}
                            >
                                {task.completed_at
                                    ? `✅ ${t('calendar.completed')}`
                                    : `⏳ ${t('calendar.pending')}`}
                            </span>
                        </div>
                    </div>

                    {/* Due Date */}
                    {task.due_date && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('calendar.dueDate')}
                            </label>
                            <p className="text-gray-900 dark:text-gray-100">
                                {parseDateString(task.due_date) &&
                                    format(
                                        parseDateString(task.due_date) as Date,
                                        'PPP',
                                        {
                                            locale: locale,
                                        }
                                    )}
                            </p>
                        </div>
                    )}

                    {/* Priority */}
                    {task.priority && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('calendar.priority')}
                            </label>
                            <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    task.priority === 'high'
                                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                        : task.priority === 'medium'
                                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                }`}
                            >
                                {t(`calendar.${task.priority}`)}
                            </span>
                        </div>
                    )}

                    {/* Project */}
                    {task.Project?.name && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('calendar.project')}
                            </label>
                            <p className="text-gray-900 dark:text-gray-100">
                                {task.Project.name}
                            </p>
                        </div>
                    )}

                    {/* Area - Note: Area relationship not in Task entity, removing this section */}

                    {/* Note */}
                    {task.note && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('calendar.description')}
                            </label>
                            <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                                {task.note}
                            </p>
                        </div>
                    )}

                    {/* Created Date */}
                    {task.created_at && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('calendar.created')}
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {format(new Date(task.created_at), 'PPp', {
                                    locale: locale,
                                })}
                            </p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex justify-between">
                    <Link
                        to="/tasks"
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                        <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-1" />
                        {t('calendar.goToTasks')}
                    </Link>

                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            {t('calendar.close')}
                        </button>

                        <button
                            onClick={onEditTask}
                            className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600"
                        >
                            {t('calendar.editTask')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Calendar;
