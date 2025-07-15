import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as BigCalendar, momentLocalizer, Views, View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import TaskModal from './Task/TaskModal';
import { Task } from '../entities/Task';
import { Project } from '../entities/Project';
import { deleteTask } from '../utils/tasksService';
import {
    CalendarIcon,
    XMarkIcon,
    ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '../styles/calendar.css';

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

// Create drag and drop calendar
const DnDCalendar = withDragAndDrop(BigCalendar);

const getMomentLocale = (language: string) => {
    switch (language) {
        case 'es':
            return 'es';
        case 'de':
            return 'de';
        case 'fr':
            return 'fr';
        case 'it':
            return 'it';
        case 'jp':
            return 'ja';
        case 'zh':
            return 'zh-cn';
        default:
            return 'en';
    }
};

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: 'task' | 'event' | 'google';
    resource?: Task;
    priority?: 'low' | 'medium' | 'high';
    status?: string;
    isOverdue?: boolean;
}


const Calendar: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<View>(Views.MONTH);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isEventDetailModalOpen, setIsEventDetailModalOpen] = useState(false);

    // Set moment locale based on current language
    const momentLocale = getMomentLocale(i18n.language);
    moment.locale(momentLocale);

    // Load tasks and projects on component mount
    useEffect(() => {
        loadTasks();
        loadProjects();
    }, []);


    const loadTasks = async () => {
        setIsLoadingTasks(true);
        try {
            const response = await fetch('/api/tasks', {
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

                const taskEvents = convertTasksToEvents(tasks);
                console.log('Loaded tasks from API:', tasks.length);
                console.log('Tasks with due dates:', tasks.filter((t: any) => t.due_date).length);
                console.log('Converted to calendar events:', taskEvents.length);
                console.log('Calendar events:', taskEvents.map(e => ({ 
                    id: e.id, 
                    title: e.title, 
                    start: e.start?.toDateString(),
                    due_date: e.resource?.due_date 
                })));
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
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today for consistent comparison
        const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // Show overdue tasks from last 30 days
        const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // Show upcoming tasks for next 30 days

        if (!Array.isArray(tasks)) {
            console.error('convertTasksToEvents received non-array:', tasks);
            return [];
        }

        tasks.forEach((task) => {
            // Only show tasks with due dates that are expiring (due within 3 days) or overdue
            if (task.due_date) {
                const dueDate = new Date(task.due_date);
                dueDate.setHours(0, 0, 0, 0); // Normalize for comparison
                const isWithinDisplayWindow = dueDate >= thirtyDaysAgo && dueDate <= thirtyDaysFromNow; // Show tasks within 30 days past/future
                const isOverdue = dueDate < now; // Overdue tasks (highlight these)
                const isUpcoming = dueDate <= threeDaysFromNow && dueDate >= now; // Due within next 3 days (highlight these)
                
                console.log(`Task ${task.id} (${task.name}): due_date=${task.due_date}, dueDate=${dueDate.toDateString()}, isWithinDisplayWindow=${isWithinDisplayWindow}, isOverdue=${isOverdue}, isUpcoming=${isUpcoming}`);
                
                // Show all tasks within 30-day window
                if (isWithinDisplayWindow) {
                    // For all-day events, start and end should be the same date
                    // React Big Calendar handles all-day events differently
                    const eventDate = new Date(dueDate);
                    eventDate.setHours(0, 0, 0, 0);
                    
                    const taskEvent: CalendarEvent = {
                        id: `task-${task.id}`,
                        title: task.name || task.title || `Task ${task.id}`,
                        start: eventDate,
                        end: eventDate, // Same date for all-day events
                        type: 'task' as const,
                        resource: task,
                        priority: task.priority || 'medium',
                        status: task.status,
                        isOverdue: isOverdue,
                    };
                    taskEvents.push(taskEvent);
                    console.log(`Added task event: ${task.name} on ${eventDate.toDateString()}`);
                }
            }
        });

        return taskEvents;
    };

    const loadProjects = async () => {
        try {
            const response = await fetch('/api/projects', {
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


    const handleSelectEvent = (event: any) => {
        if (event.type === 'task' && event.resource) {
            // Convert task to proper Task entity format for TaskModal
            const taskEntity: Task = {
                ...event.resource,
                name: event.resource.name || `Task ${event.resource.id}`,
                priority: event.resource.priority || 'medium',
                status: event.resource.status || 'not_started',
                tags: event.resource.tags || [],
                note: event.resource.note || '',
                due_date: event.resource.due_date,
                created_at: event.resource.created_at,
                completed_at: event.resource.completed_at,
                project_id: event.resource.project_id,
            };

            setSelectedTask(taskEntity);
            setIsEventDetailModalOpen(true);
        }
    };

    const handleSelectSlot = ({ start }: { start: Date }) => {
        // Handle slot selection for future functionality
        console.log('Selected slot:', start);
    };

    const handleNavigate = (newDate: Date) => {
        setCurrentDate(newDate);
    };

    const handleViewChange = (newView: View) => {
        setView(newView);
    };

    const handleEventDrop = async ({ event, start, end, allDay }: any) => {
        if (event.type === 'task' && event.resource) {
            try {
                console.log('Full drop event data:', { event, start, end, allDay });
                console.log('Original task due date:', event.resource.due_date);
                console.log('New start date:', start);
                console.log('New start date string:', start.toString());
                console.log('New start date toDateString:', start.toDateString());
                console.log('New start date toISOString:', start.toISOString());
                
                // Convert to local date string to avoid timezone issues
                const year = start.getFullYear();
                const month = String(start.getMonth() + 1).padStart(2, '0');
                const day = String(start.getDate()).padStart(2, '0');
                const newDueDate = `${year}-${month}-${day}`;
                
                console.log('Timezone offset (minutes):', start.getTimezoneOffset());
                console.log('Calculated date components:', { year, month, day });
                console.log(`Updating task ${event.resource.id} due date from ${event.resource.due_date} to:`, newDueDate);
                
                // Check if the date actually changed
                if (event.resource.due_date === newDueDate) {
                    console.log('Date unchanged, skipping update');
                    return;
                }
                
                // Update the task's due date
                const updatedTask = {
                    ...event.resource,
                    due_date: newDueDate,
                };

                const response = await fetch(`/api/task/${event.resource.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(updatedTask),
                });

                if (response.ok) {
                    const updatedTaskData = await response.json();
                    console.log('Task updated successfully:', updatedTaskData);
                    
                    // Check if the new date is still within our display window (30 days past/future)
                    const now = new Date();
                    now.setHours(0, 0, 0, 0); // Start of today
                    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
                    const newDate = new Date(start);
                    newDate.setHours(0, 0, 0, 0); // Normalize for comparison
                    const isStillInWindow = newDate >= thirtyDaysAgo && newDate <= thirtyDaysFromNow;
                    
                    console.log('Window check:', {
                        now: now.toDateString(),
                        thirtyDaysAgo: thirtyDaysAgo.toDateString(),
                        thirtyDaysFromNow: thirtyDaysFromNow.toDateString(),
                        newDate: newDate.toDateString(),
                        isStillInWindow
                    });
                    
                    if (isStillInWindow) {
                        // Update the events state immediately for better UX
                        const newEventDate = new Date(start);
                        newEventDate.setHours(0, 0, 0, 0);
                        
                        setEvents(prevEvents => 
                            prevEvents.map(e => 
                                e.id === event.id 
                                    ? { 
                                        ...e, 
                                        start: newEventDate,
                                        end: newEventDate, // Same date for all-day events
                                        resource: e.resource ? { ...e.resource, due_date: newDueDate } : undefined
                                      } as CalendarEvent
                                    : e
                            )
                        );
                    } else {
                        // Task moved outside expiring window, remove it from view
                        setEvents(prevEvents => prevEvents.filter(e => e.id !== event.id));
                    }
                    
                    // Refresh from server immediately to ensure consistency
                    console.log('Refreshing calendar data...');
                    loadTasks();
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('Failed to update task due date:', response.status, errorData);
                    // Refresh to revert the visual change
                    loadTasks();
                }
            } catch (error) {
                console.error('Error updating task due date:', error);
                // Refresh to revert the visual change
                loadTasks();
            }
        }
    };

    const handleEventResize = async ({ event, start }: any) => {
        // For all-day events, we only care about the start date
        handleEventDrop({ event, start });
    };

    const handleEditTask = () => {
        setIsEventDetailModalOpen(false);
        setIsTaskModalOpen(true);
    };

    const handleTaskSave = () => {
        // Refresh calendar
        loadTasks();
        // Close modal
        setIsTaskModalOpen(false);
        setSelectedTask(null);
    };

    const handleTaskDelete = async (taskId: number) => {
        try {
            await deleteTask(taskId);
            // Refresh calendar
            loadTasks();
            // Close modal
            setIsTaskModalOpen(false);
            setSelectedTask(null);
        } catch (error) {
            console.error('Failed to delete task:', error);
        }
    };

    const handleCreateProject = async (name: string): Promise<Project> => {
        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, description: '' }),
            });

            if (response.ok) {
                const newProject = await response.json();
                setProjects((prev) => [...prev, newProject]);
                return newProject;
            } else {
                throw new Error('Failed to create project');
            }
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    };

    // Custom styling for events based on priority and status
    const eventStyleGetter = (event: any) => {
        let backgroundColor = '#3b82f6'; // Default blue
        let borderColor = '#2563eb';
        
        if (event.isOverdue) {
            backgroundColor = '#ef4444'; // Red for overdue
            borderColor = '#dc2626';
        } else if (event.priority === 'high') {
            backgroundColor = '#f59e0b'; // Amber for high priority
            borderColor = '#d97706';
        } else if (event.priority === 'low') {
            backgroundColor = '#10b981'; // Emerald for low priority
            borderColor = '#059669';
        }

        return {
            style: {
                backgroundColor,
                borderColor,
                border: `2px solid ${borderColor}`,
                borderRadius: '4px',
                opacity: 0.9,
                color: 'white',
                fontWeight: '500',
                fontSize: '12px',
            },
        };
    };

    // Custom messages for the calendar
    const messages = useMemo(() => ({
        allDay: t('calendar.allDay', 'All Day'),
        previous: t('calendar.previous', 'Previous'),
        next: t('calendar.next', 'Next'),
        today: t('calendar.today', 'Today'),
        month: t('calendar.month', 'Month'),
        week: t('calendar.week', 'Week'),
        day: t('calendar.day', 'Day'),
        agenda: t('calendar.agenda', 'Agenda'),
        date: t('calendar.date', 'Date'),
        time: t('calendar.time', 'Time'),
        event: t('calendar.event', 'Event'),
        noEventsInRange: t('calendar.noEventsInRange', 'No expiring tasks in this date range.'),
        showMore: (total: number) => t('calendar.showMore', `+${total} more`),
    }), [t]);

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-6xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                        <h2 className="text-2xl font-light flex items-center text-gray-900 dark:text-gray-100">
                            <CalendarIcon className="h-6 w-6 mr-2" />
                            {t('sidebar.calendar')}
                        </h2>
                        <span className="text-lg text-gray-600 dark:text-gray-400">
                            {moment(currentDate).format('MMMM YYYY')}
                        </span>
                    </div>
                    
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        {t('calendar.showingRelevantTasks', 'Showing tasks within 30 days past and future')}
                        <br />
                        <span className="text-xs">
                            {t('calendar.dragToUpdate', 'Drag tasks to update due dates')}
                        </span>
                    </div>
                </div>

                {/* Loading indicator */}
                {isLoadingTasks && (
                    <div className="text-center py-4 text-gray-500">
                        {t('calendar.loadingTasks')}
                    </div>
                )}

                {/* React Big Calendar with Drag & Drop */}
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="calendar-container">
                        <DnDCalendar
                            localizer={localizer}
                            events={events}
                            startAccessor={(event: any) => event.start}
                            endAccessor={(event: any) => event.end}
                            titleAccessor={(event: any) => event.title}
                            allDayAccessor={() => true}
                            style={{ height: 600 }}
                            view={view}
                            date={currentDate}
                            onNavigate={handleNavigate}
                            onView={handleViewChange}
                            onSelectEvent={handleSelectEvent}
                            onSelectSlot={handleSelectSlot}
                            onEventDrop={handleEventDrop}
                            onEventResize={handleEventResize}
                            selectable
                            resizable
                            eventPropGetter={eventStyleGetter}
                            messages={messages}
                            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                            popup
                            showMultiDayTimes
                            step={30}
                            timeslots={2}
                            dragFromOutsideItem={() => ({})}
                        />
                    </div>
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
                {selectedTask && (
                    <TaskModal
                        isOpen={isTaskModalOpen}
                        onClose={() => {
                            setIsTaskModalOpen(false);
                            setSelectedTask(null);
                        }}
                        task={selectedTask}
                        onSave={handleTaskSave}
                        onDelete={handleTaskDelete}
                        projects={projects}
                        onCreateProject={handleCreateProject}
                    />
                )}
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
    const momentLocale = getMomentLocale(i18n.language);
    moment.locale(momentLocale);

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
                                {moment(task.due_date).format('LL')}
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
                                {moment(task.created_at).format('LLL')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex justify-between">
                    <a
                        href="/tasks"
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                        <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-1" />
                        {t('calendar.goToTasks')}
                    </a>

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
