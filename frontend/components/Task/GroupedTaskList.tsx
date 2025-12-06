import React, { useState, useMemo } from 'react';
import {
    ChevronRightIcon,
    ChevronDownIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import TaskItem from './TaskItem';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import { GroupedTasks } from '../../utils/tasksService';

interface GroupedTaskListProps {
    tasks: Task[];
    groupedTasks?: GroupedTasks | null;
    groupBy?: 'none' | 'project';
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskCompletionToggle?: (task: Task) => void;
    onTaskCreate?: (task: Task) => void;
    onTaskDelete: (taskUid: string) => void;
    projects: Project[];
    hideProjectName?: boolean;
    onToggleToday?: (taskId: number, task?: Task) => Promise<void>;
    showCompletedTasks?: boolean;
    searchQuery?: string;
}

interface TaskGroup {
    template: Task;
    instances: Task[];
}

const GroupedTaskList: React.FC<GroupedTaskListProps> = ({
    tasks,
    groupedTasks,
    groupBy = 'none',
    onTaskUpdate,
    onTaskCompletionToggle,
    onTaskDelete,
    projects,
    hideProjectName = false,
    onToggleToday,
    showCompletedTasks = false,
    searchQuery = '',
}) => {
    const { t } = useTranslation();

    const [expandedRecurringGroups, setExpandedRecurringGroups] = useState<
        Set<number>
    >(new Set());

    // If we have day-based groupedTasks from API, use those instead of recurring groups
    const shouldUseDayGrouping =
        groupedTasks && Object.keys(groupedTasks).length > 0;

    // Group tasks by recurring template (legacy behavior)
    const { recurringGroups, standaloneTask } = useMemo(() => {
        if (shouldUseDayGrouping) {
            // For day grouping, we don't need recurring groups
            return { recurringGroups: [], standaloneTask: [] };
        }

        // Filter tasks based on completion status
        const filteredTasks = showCompletedTasks
            ? tasks.filter((task) => {
                  // Show only completed tasks (done=2 or archived=3)
                  const isCompleted =
                      task.status === 'done' ||
                      task.status === 'archived' ||
                      task.status === 2 ||
                      task.status === 3;
                  return isCompleted;
              })
            : tasks.filter((task) => {
                  // Show only non-completed tasks
                  const isCompleted =
                      task.status === 'done' ||
                      task.status === 'archived' ||
                      task.status === 2 ||
                      task.status === 3;
                  return !isCompleted;
              });

        const groups = new Map<number, TaskGroup>();
        const standalone: Task[] = [];

        filteredTasks.forEach((task) => {
            if (task.recurring_parent_id) {
                // This is a recurring instance
                const parentId = task.recurring_parent_id;
                if (!groups.has(parentId)) {
                    // Find the template task in the current results
                    let template = filteredTasks.find((t) => t.id === parentId);

                    // If template not found in results, create a placeholder using the instance data
                    if (!template) {
                        // Create a virtual template task based on the instance
                        template = {
                            ...task,
                            id: parentId,
                            recurring_parent_id: null, // This makes it the template
                            due_date: null, // Templates don't have specific due dates
                            name: task.name, // Keep the same name
                            isVirtualTemplate: true, // Flag to identify virtual templates
                        } as Task & { isVirtualTemplate?: boolean };
                    }
                    groups.set(parentId, { template, instances: [] });
                }
                const group = groups.get(parentId);
                if (group) {
                    group.instances.push(task);
                }
            } else if (
                task.recurrence_type &&
                task.recurrence_type !== 'none'
            ) {
                // This is a recurring template - check if it has instances
                const instances = filteredTasks.filter(
                    (t) => t.recurring_parent_id === task.id
                );
                if (instances.length > 0) {
                    groups.set(task.id!, { template: task, instances });
                } else {
                    // Template without instances, show as standalone
                    standalone.push(task);
                }
            } else {
                // Regular task
                standalone.push(task);
            }
        });

        return {
            recurringGroups: Array.from(groups.values()),
            standaloneTask: standalone,
        };
    }, [tasks, showCompletedTasks, shouldUseDayGrouping]);

    // Filter grouped tasks for completed status and search query
    const filteredGroupedTasks = useMemo(() => {
        if (!shouldUseDayGrouping || !groupedTasks) return {};

        const filtered: GroupedTasks = {};
        Object.entries(groupedTasks).forEach(([groupName, groupTasks]) => {
            // Filter by completion status
            let filteredTasks = showCompletedTasks
                ? groupTasks.filter((task) => {
                      // Show only completed tasks
                      const isCompleted =
                          task.status === 'done' ||
                          task.status === 'archived' ||
                          task.status === 2 ||
                          task.status === 3;
                      return isCompleted;
                  })
                : groupTasks.filter((task) => {
                      // Show only non-completed tasks
                      const isCompleted =
                          task.status === 'done' ||
                          task.status === 'archived' ||
                          task.status === 2 ||
                          task.status === 3;
                      return !isCompleted;
                  });

            // Apply search filter if search query provided
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                filteredTasks = filteredTasks.filter(
                    (task) =>
                        task.name.toLowerCase().includes(query) ||
                        task.note?.toLowerCase().includes(query)
                );
            }

            if (filteredTasks.length > 0) {
                filtered[groupName] = filteredTasks;
            }
        });
        return filtered;
    }, [groupedTasks, showCompletedTasks, shouldUseDayGrouping, searchQuery]);

    // Group tasks by project when requested (only applies to standalone view)
    const groupedByProject = useMemo(() => {
        if (groupBy !== 'project') return null;

        // Apply completion filter
        const filtered = showCompletedTasks
            ? tasks.filter((task) => {
                  const isCompleted =
                      task.status === 'done' ||
                      task.status === 'archived' ||
                      task.status === 2 ||
                      task.status === 3;
                  return isCompleted;
              })
            : tasks.filter((task) => {
                  const isCompleted =
                      task.status === 'done' ||
                      task.status === 'archived' ||
                      task.status === 2 ||
                      task.status === 3;
                  return !isCompleted;
              });

        // Apply search
        const filteredBySearch = searchQuery.trim()
            ? filtered.filter((task) =>
                  (task.name || '')
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
              )
            : filtered;

        const byProject = new Map<string | number, Task[]>();
        filteredBySearch.forEach((task) => {
            const key = task.project_id || 'no_project';
            const arr = byProject.get(key) || [];
            arr.push(task);
            byProject.set(key, arr);
        });
        return Array.from(byProject.entries()).map(
            ([projectId, projectTasks]) => ({
                projectId,
                tasks: projectTasks,
            })
        );
    }, [groupBy, tasks, showCompletedTasks, searchQuery]);

    const toggleRecurringGroup = (templateId: number) => {
        setExpandedRecurringGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(templateId)) {
                newSet.delete(templateId);
            } else {
                newSet.add(templateId);
            }
            return newSet;
        });
    };

    const formatRecurrence = (recurrenceType: string) => {
        switch (recurrenceType) {
            case 'daily':
                return t('recurrence.daily', 'Daily');
            case 'weekly':
                return t('recurrence.weekly', 'Weekly');
            case 'monthly':
                return t('recurrence.monthly', 'Monthly');
            default:
                return t('recurrence.recurring', 'Recurring');
        }
    };

    // Render day-based grouping if available
    if (shouldUseDayGrouping) {
        return (
            <div className="task-board-container">
                {Object.keys(filteredGroupedTasks).length === 0 ? (
                    <div className="flex justify-center items-center mt-4">
                        <div className="w-full max-w bg-black/2 dark:bg-gray-900/25 rounded-l px-10 py-24 flex flex-col items-center opacity-95">
                            <svg
                                className="h-20 w-20 text-gray-400 opacity-30 mb-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                                />
                            </svg>
                            <p className="text-2xl font-light text-center text-gray-600 dark:text-gray-300 mb-2">
                                {t(
                                    'tasks.noTasksAvailable',
                                    'No tasks available.'
                                )}
                            </p>
                            <p className="text-base text-center text-gray-400 dark:text-gray-400">
                                {t(
                                    'tasks.blankSlateHint',
                                    'Start by creating a new task or changing your filters.'
                                )}
                            </p>
                        </div>
                    </div>
                ) : (
                    /* Responsive board layout */
                    <div className="pb-4">
                        {/* Mobile: Stack vertically, Desktop: Horizontal board */}
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full">
                            {Object.entries(filteredGroupedTasks).map(
                                ([groupName, dayTasks]) => {
                                    return (
                                        <div
                                            key={groupName}
                                            className="day-column w-full md:flex-1 md:min-w-64"
                                        >
                                            {/* Day column header */}
                                            <div className="pb-3 mb-4">
                                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                    {groupName}
                                                </h3>
                                            </div>

                                            {/* Day column tasks */}
                                            <div className="space-y-1.5">
                                                {dayTasks.map((task) => (
                                                    <div key={task.id}>
                                                        <TaskItem
                                                            task={task}
                                                            onTaskUpdate={
                                                                onTaskUpdate
                                                            }
                                                            onTaskCompletionToggle={
                                                                onTaskCompletionToggle
                                                            }
                                                            onTaskDelete={
                                                                onTaskDelete
                                                            }
                                                            projects={projects}
                                                            hideProjectName={
                                                                hideProjectName
                                                            }
                                                            onToggleToday={
                                                                onToggleToday
                                                            }
                                                            isUpcomingView={
                                                                true
                                                            }
                                                            showCompletedTasks={
                                                                showCompletedTasks
                                                            }
                                                        />
                                                    </div>
                                                ))}

                                                {/* Empty state for columns with no tasks */}
                                                {dayTasks.length === 0 && (
                                                    <div className="text-center py-8 text-gray-400 dark:text-gray-600">
                                                        <p className="text-sm">
                                                            No tasks scheduled
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Legacy: Render recurring task grouping
    return (
        <div className="task-list-container space-y-1.5">
            {/* Standalone tasks */}
            {groupBy === 'project' && groupedByProject
                ? groupedByProject.map(
                      ({ projectId, tasks: projectTasks }, index) => {
                          const projectName =
                              projects.find((p) => p.id === projectId)?.name ||
                              (projectId === 'no_project'
                                  ? t('tasks.noProject', 'No project')
                                  : t(
                                        'tasks.unknownProject',
                                        'Unknown project'
                                    ));
                          return (
                              <div
                                  key={String(projectId)}
                                  className={`space-y-1.5 pb-4 mb-2 border-b border-gray-200/50 dark:border-gray-800/60 last:border-b-0 ${index > 0 ? 'pt-4' : ''}`}
                              >
                                  <div className="flex items-center justify-between px-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                                      <span className="truncate">
                                          {projectName}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {projectTasks.length}{' '}
                                          {t('tasks.tasks', 'tasks')}
                                      </span>
                                  </div>
                                  {projectTasks.map((task) => (
                                      <div
                                          key={task.id}
                                          className="task-item-wrapper transition-all duration-200 ease-in-out"
                                      >
                                          <TaskItem
                                              task={task}
                                              onTaskUpdate={onTaskUpdate}
                                              onTaskCompletionToggle={
                                                  onTaskCompletionToggle
                                              }
                                              onTaskDelete={onTaskDelete}
                                              projects={projects}
                                              hideProjectName={hideProjectName}
                                              onToggleToday={onToggleToday}
                                          />
                                      </div>
                                  ))}
                              </div>
                          );
                      }
                  )
                : standaloneTask.map((task) => (
                      <div
                          key={task.id}
                          className="task-item-wrapper transition-all duration-200 ease-in-out"
                      >
                          <TaskItem
                              task={task}
                              onTaskUpdate={onTaskUpdate}
                              onTaskCompletionToggle={onTaskCompletionToggle}
                              onTaskDelete={onTaskDelete}
                              projects={projects}
                              hideProjectName={hideProjectName}
                              onToggleToday={onToggleToday}
                          />
                      </div>
                  ))}

            {/* Grouped recurring tasks */}
            {recurringGroups.map((group) => {
                const isVirtualTemplate = (group.template as any)
                    .isVirtualTemplate;
                const isExpanded =
                    expandedRecurringGroups.has(group.template.id!) ||
                    isVirtualTemplate; // Auto-expand virtual templates

                return (
                    <div
                        key={group.template.id}
                        className="recurring-task-group mb-2"
                    >
                        {/* Show template only if it's not virtual */}
                        {!isVirtualTemplate && (
                            <div className="relative">
                                <div className="flex items-center">
                                    <div className="flex-1">
                                        <TaskItem
                                            task={group.template}
                                            onTaskUpdate={onTaskUpdate}
                                            onTaskCompletionToggle={
                                                onTaskCompletionToggle
                                            }
                                            onTaskDelete={onTaskDelete}
                                            projects={projects}
                                            hideProjectName={hideProjectName}
                                            onToggleToday={onToggleToday}
                                        />
                                    </div>
                                </div>

                                {/* Recurring instances count and expand button */}
                                {group.instances.length > 0 && (
                                    <button
                                        onClick={() =>
                                            toggleRecurringGroup(
                                                group.template.id!
                                            )
                                        }
                                        className="absolute top-3 right-3 flex items-center space-x-2 px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                    >
                                        <ArrowPathIcon className="h-3 w-3" />
                                        <span>
                                            {group.instances.length}{' '}
                                            {t('task.upcoming', 'upcoming')}
                                        </span>
                                        {isExpanded ? (
                                            <ChevronDownIcon className="h-3 w-3" />
                                        ) : (
                                            <ChevronRightIcon className="h-3 w-3" />
                                        )}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* For virtual templates, show a simple header */}
                        {isVirtualTemplate && group.instances.length > 0 && (
                            <div className="mb-2 flex items-center space-x-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <ArrowPathIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                    {group.template.name} -{' '}
                                    {formatRecurrence(
                                        group.template.recurrence_type!
                                    )}
                                </span>
                                <span className="text-xs text-blue-600 dark:text-blue-400">
                                    {group.instances.length} upcoming
                                </span>
                            </div>
                        )}

                        {/* Expanded instances */}
                        {isExpanded && group.instances.length > 0 && (
                            <div
                                className={`mt-2 space-y-1.5 border-l-2 border-blue-200 dark:border-blue-800 pl-4 ${!isVirtualTemplate ? 'ml-8' : 'ml-4'}`}
                            >
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center">
                                    <ArrowPathIcon className="h-3 w-3 mr-1" />
                                    {formatRecurrence(
                                        group.template.recurrence_type!
                                    )}{' '}
                                    instances
                                </div>
                                {group.instances
                                    .sort(
                                        (a, b) =>
                                            new Date(
                                                a.due_date || ''
                                            ).getTime() -
                                            new Date(b.due_date || '').getTime()
                                    )
                                    .map((instance) => (
                                        <div
                                            key={instance.id}
                                            className="opacity-75 hover:opacity-100 transition-opacity"
                                        >
                                            <TaskItem
                                                task={instance}
                                                onTaskUpdate={onTaskUpdate}
                                                onTaskCompletionToggle={
                                                    onTaskCompletionToggle
                                                }
                                                onTaskDelete={onTaskDelete}
                                                projects={projects}
                                                hideProjectName={
                                                    hideProjectName
                                                }
                                                onToggleToday={onToggleToday}
                                            />
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {standaloneTask.length === 0 && recurringGroups.length === 0 && (
                <div className="flex justify-center items-center mt-4">
                    <div className="w-full max-w bg-black/2 dark:bg-gray-900/25 rounded-l px-10 py-24 flex flex-col items-center opacity-95">
                        <svg
                            className="h-20 w-20 text-gray-400 opacity-30 mb-6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                            />
                        </svg>
                        <p className="text-2xl font-light text-center text-gray-600 dark:text-gray-300 mb-2">
                            {t('tasks.noTasksAvailable', 'No tasks available.')}
                        </p>
                        <p className="text-base text-center text-gray-400 dark:text-gray-400">
                            {t(
                                'tasks.blankSlateHint',
                                'Start by creating a new task or changing your filters.'
                            )}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupedTaskList;
