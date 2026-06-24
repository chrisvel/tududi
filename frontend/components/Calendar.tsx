import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../entities/Task';
import { Project } from '../entities/Project';
import { updateTask } from '../utils/tasksService';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    XMarkIcon,
    ArrowTopRightOnSquareIcon,
    CalendarDaysIcon,
    ClockIcon,
    FolderIcon,
    TagIcon,
} from '@heroicons/react/24/outline';
import { format, addWeeks, addDays } from 'date-fns';
import { el, enUS, es, ja, uk, de } from 'date-fns/locale';
import CalendarMonthView from './Calendar/CalendarMonthView';
import CalendarWeekView from './Calendar/CalendarWeekView';
import CalendarDayView from './Calendar/CalendarDayView';
import { getApiPath } from '../config/paths';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
    const location = useLocation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'week' | 'day'>('month');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [allTasks, setAllTasks] = useState<any[]>([]);
    const [, setProjects] = useState<Project[]>([]);
    const [isEventDetailModalOpen, setIsEventDetailModalOpen] = useState(false);

    const locale = getLocale(i18n.language);

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
                let tasks;
                if (Array.isArray(data)) {
                    tasks = data;
                } else if (data && Array.isArray(data.tasks)) {
                    tasks = data.tasks;
                } else if (data && data.data && Array.isArray(data.data)) {
                    tasks = data.data;
                } else {
                    tasks = [];
                }
                setAllTasks(tasks);
                setEvents(convertTasksToEvents(tasks));
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        } finally {
            setIsLoadingTasks(false);
        }
    };

    const convertTasksToEvents = (tasks: any[]): CalendarEvent[] => {
        const taskEvents: CalendarEvent[] = [];
        if (!Array.isArray(tasks)) return [];

        tasks.forEach((task) => {
            const name = task.name || task.title || `Task ${task.id}`;

            if (task.defer_until) {
                const deferDate = new Date(task.defer_until);
                taskEvents.push({
                    id: `task-defer-${task.id}`,
                    title: name,
                    start: deferDate,
                    end: new Date(deferDate.getTime() + 60 * 60 * 1000),
                    type: 'task',
                    color: task.completed_at ? '#22c55e' : '#f59e0b',
                });
            }

            if (task.due_date) {
                const dueDate = parseDateString(task.due_date);
                if (dueDate) {
                    taskEvents.push({
                        id: `task-${task.id}`,
                        title: name,
                        start: dueDate,
                        end: new Date(dueDate.getTime() + 60 * 60 * 1000),
                        type: 'task',
                        color: task.completed_at ? '#22c55e' : '#3b82f6',
                    });
                }
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
                return direction === 'prev' ? addWeeks(prev, -1) : addWeeks(prev, 1);
            } else {
                return direction === 'prev' ? addDays(prev, -1) : addDays(prev, 1);
            }
        });
    };

    const goToToday = () => setCurrentDate(new Date());

    const handleDateClick = () => {};

    const handleEventClick = (event: CalendarEvent) => {
        if (event.type === 'task') {
            const taskId = event.id.replace(/^task(-defer|-created|-fallback)?-/, '');
            const task = allTasks.find((t) => t.id.toString() === taskId);
            if (task) {
                const taskEntity: Task = {
                    ...task,
                    name: task.name || task.title || `Task ${task.id}`,
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

    const handleTimeSlotClick = () => {};

    const handleEditTask = () => {
        if (selectedTask?.uid) {
            setIsEventDetailModalOpen(false);
            const targetUid = selectedTask.uid;
            setSelectedTask(null);
            navigate(`/task/${targetUid}`, {
                state: { from: location.pathname + location.search },
            });
        }
    };

    const handleEventDrop = async (eventId: string, newDate: Date, newHour?: number) => {
        const taskId = eventId.replace(/^task(-defer|-created|-fallback)?-/, '');
        const task = allTasks.find((t) => t.id.toString() === taskId);
        if (!task?.uid) return;

        const newDateTime = new Date(newDate);
        if (newHour !== undefined) {
            newDateTime.setHours(newHour, 0, 0, 0);
        } else {
            if (task.due_date) {
                const originalTime = parseDateString(task.due_date);
                newDateTime.setHours(
                    originalTime ? originalTime.getHours() : 0,
                    originalTime ? originalTime.getMinutes() : 0,
                    0,
                    0
                );
            } else {
                newDateTime.setHours(0, 0, 0, 0);
            }
        }

        const isDeferEvent = eventId.startsWith('task-defer-');
        const fieldToUpdate = isDeferEvent ? 'defer_until' : 'due_date';
        const updatedTask = { ...task, [fieldToUpdate]: newDateTime.toISOString() };

        setAllTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
        setEvents((prevEvents) =>
            prevEvents.map((event) =>
                event.id === eventId
                    ? { ...event, start: newDateTime, end: new Date(newDateTime.getTime() + 60 * 60 * 1000) }
                    : event
            )
        );

        try {
            await updateTask(task.uid, { [fieldToUpdate]: newDateTime.toISOString() });
        } catch (error) {
            console.error('Error updating task:', error);
            await loadTasks();
        }
    };

    return (
        <div className="h-full flex flex-col px-2 sm:px-4 lg:px-6 pt-4">
            <div className="w-full flex-1 flex flex-col min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-6">
                    <div>
                        <h2 className="text-2xl font-light dark:text-white">
                            {t('sidebar.calendar')}
                        </h2>
                        <span className="text-sm text-gray-400 dark:text-gray-500">
                            {format(currentDate, 'MMMM yyyy', { locale })}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View selector */}
                        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 border border-gray-200 dark:border-gray-600">
                            {(['month', 'week', 'day'] as const).map((viewType) => (
                                <button
                                    key={viewType}
                                    onClick={() => setView(viewType)}
                                    className={`px-3 py-1.5 text-sm font-medium capitalize rounded-md transition-all duration-150 ${
                                        view === viewType
                                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                                >
                                    {t(`calendar.${viewType}`)}
                                </button>
                            ))}
                        </div>

                        {/* Navigation */}
                        <button
                            onClick={() => navigateView('prev')}
                            className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-sm transition-all"
                        >
                            <ChevronLeftIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                        </button>

                        <button
                            onClick={goToToday}
                            className="px-3 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            {t('calendar.today')}
                        </button>

                        <button
                            onClick={() => navigateView('next')}
                            className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-sm transition-all"
                        >
                            <ChevronRightIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                        </button>
                    </div>
                </div>

                {/* Loading indicator */}
                {isLoadingTasks && (
                    <div className="text-center py-3 px-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 mb-3">
                        <span className="text-sm text-blue-600 dark:text-blue-400">
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
            </div>
        </div>
    );
};

interface TaskEventModalProps {
    isOpen: boolean;
    task: Task;
    onClose: () => void;
    onEditTask: () => void;
}

const TaskEventModal: React.FC<TaskEventModalProps> = ({ isOpen, task, onClose, onEditTask }) => {
    const { t, i18n } = useTranslation();
    const locale = getLocale(i18n.language);

    if (!isOpen) return null;

    const priorityConfig = {
        high: { label: t('calendar.high', 'High'), className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
        medium: { label: t('calendar.medium', 'Medium'), className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
        low: { label: t('calendar.low', 'Low'), className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm">
                {/* Header */}
                <div className="flex items-start justify-between p-5 pb-4">
                    <div className="flex-1 min-w-0 pr-3">
                        <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-1.5">
                            {t('calendar.task', 'Task')}
                        </p>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                            {task.name || `Task ${task.id}`}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Pills row */}
                <div className="flex items-center gap-2 px-5 pb-4 flex-wrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        task.completed_at
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                        {task.completed_at ? t('calendar.completed', 'Completed') : t('calendar.pending', 'Pending')}
                    </span>
                    {task.priority && task.priority in priorityConfig && (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${priorityConfig[task.priority as keyof typeof priorityConfig].className}`}>
                            {priorityConfig[task.priority as keyof typeof priorityConfig].label}
                        </span>
                    )}
                </div>

                {/* Metadata */}
                <div className="px-5 pb-4 space-y-3">
                    {task.due_date && parseDateString(task.due_date) && (
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                            <CalendarDaysIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                            <span>{format(parseDateString(task.due_date) as Date, 'PPP', { locale })}</span>
                        </div>
                    )}
                    {task.defer_until && (
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                            <ClockIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                            <span>{format(new Date(task.defer_until), 'PPP', { locale })}</span>
                        </div>
                    )}
                    {task.Project?.name && (
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                            <FolderIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                            <span>{task.Project.name}</span>
                        </div>
                    )}
                    {task.tags && task.tags.length > 0 && (
                        <div className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                            <TagIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0 mt-0.5" />
                            <span className="flex flex-wrap gap-1">
                                {task.tags.map((tag: any) => (
                                    <span key={tag.id || tag.name} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                        {tag.name}
                                    </span>
                                ))}
                            </span>
                        </div>
                    )}
                    {task.note && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                            {task.note}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-gray-700">
                    <Link
                        to="/tasks"
                        className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                        {t('calendar.goToTasks', 'All tasks')}
                    </Link>
                    <button
                        onClick={onEditTask}
                        className="px-4 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        {t('calendar.editTask', 'Open task')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Calendar;
