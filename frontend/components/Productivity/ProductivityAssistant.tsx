import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    AcademicCapIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    FolderIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskModal from '../Task/TaskModal';
import {
    fetchTaskById,
    updateTask,
    deleteTask,
} from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import { useToast } from '../Shared/ToastContext';
import { getVagueTasks } from '../../utils/taskIntelligenceService';

interface ProductivityInsight {
    type:
        | 'stalled_projects'
        | 'completed_no_next'
        | 'tasks_are_projects'
        | 'vague_tasks'
        | 'overdue_tasks'
        | 'stuck_projects';
    title: string;
    description: string;
    items: (Task | Project)[];
    icon: React.ComponentType<any>;
    color: string;
}

interface ProductivityAssistantProps {
    tasks: Task[];
    projects: Project[];
}

const ProductivityAssistant: React.FC<ProductivityAssistantProps> = ({
    tasks,
    projects,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showSuccessToast, showErrorToast } = useToast();

    const [isExpanded, setIsExpanded] = useState(false);
    const [insights, setInsights] = useState<ProductivityInsight[]>([]);
    const [expandedInsights, setExpandedInsights] = useState<Set<number>>(
        new Set()
    );

    // Modal states
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [allProjects, setAllProjects] = useState<Project[]>(projects);
    const [loading, setLoading] = useState(false);

    const PROJECT_VERBS = [
        'plan',
        'organize',
        'set up',
        'setup',
        'fix',
        'review',
        'implement',
        'create',
        'build',
        'develop',
    ];
    const OVERDUE_THRESHOLD_DAYS = 30;

    useEffect(() => {
        const generateInsights = () => {
            const newInsights: ProductivityInsight[] = [];

            // Filter to only include non-completed tasks
            const activeTasks = tasks.filter(
                (task) => task.status !== 'done' && task.status !== 'archived'
            );

            // 1. Stalled Projects (no tasks/actions)
            const stalledProjects = projects.filter(
                (project) =>
                    (project.state === 'planned' ||
                        project.state === 'in_progress') &&
                    !activeTasks.some((task) => task.project_id === project.id)
            );

            if (stalledProjects.length > 0) {
                newInsights.push({
                    type: 'stalled_projects',
                    title: t(
                        'productivity.stalledProjects',
                        'Stalled Projects'
                    ),
                    description: t(
                        'productivity.stalledProjectsDesc',
                        'These projects have no tasks or actions'
                    ),
                    items: stalledProjects,
                    icon: FolderIcon,
                    color: 'text-red-500',
                });
            }

            // 2. Projects with completed tasks but no next action
            const projectsNeedingNextAction = projects.filter((project) => {
                const projectTasks = tasks.filter(
                    (task) => task.project_id === project.id
                );
                const hasCompletedTasks = projectTasks.some(
                    (task) =>
                        task.status === 'done' || task.status === 'archived'
                );
                const hasNextAction = activeTasks.some(
                    (task) =>
                        task.project_id === project.id &&
                        (task.status === 'not_started' ||
                            task.status === 'in_progress')
                );
                return (
                    (project.state === 'planned' ||
                        project.state === 'in_progress') &&
                    hasCompletedTasks &&
                    !hasNextAction
                );
            });

            if (projectsNeedingNextAction.length > 0) {
                newInsights.push({
                    type: 'completed_no_next',
                    title: t(
                        'productivity.needsNextAction',
                        'Projects Need Next Action'
                    ),
                    description: t(
                        'productivity.needsNextActionDesc',
                        'These projects have completed tasks but no next action'
                    ),
                    items: projectsNeedingNextAction,
                    icon: ExclamationTriangleIcon,
                    color: 'text-yellow-500',
                });
            }

            // 3. Tasks that are actually projects
            const tasksAreProjects = activeTasks.filter((task) => {
                const taskName = task.name.toLowerCase();
                return (
                    PROJECT_VERBS.some((verb) => taskName.includes(verb)) &&
                    taskName.length > 30
                ); // Longer tasks are more likely to be projects
            });

            if (tasksAreProjects.length > 0) {
                newInsights.push({
                    type: 'tasks_are_projects',
                    title: t(
                        'productivity.tasksAreProjects',
                        'Tasks That Look Like Projects'
                    ),
                    description: t(
                        'productivity.tasksAreProjectsDesc',
                        'These tasks might need to be broken down'
                    ),
                    items: tasksAreProjects,
                    icon: AcademicCapIcon,
                    color: 'text-blue-500',
                });
            }

            // 4. Tasks without clear verbs
            const vagueTasks = getVagueTasks(activeTasks);

            if (vagueTasks.length > 0) {
                newInsights.push({
                    type: 'vague_tasks',
                    title: t(
                        'productivity.vagueTasks',
                        'Tasks Without Clear Action'
                    ),
                    description: t(
                        'productivity.vagueTasksDesc',
                        'These tasks need clearer action verbs'
                    ),
                    items: vagueTasks,
                    icon: ExclamationTriangleIcon,
                    color: 'text-orange-500',
                });
            }

            // 5. Overdue or stale tasks
            const now = new Date();
            const thresholdDate = new Date(
                now.getTime() - OVERDUE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
            );

            const staleTasks = activeTasks.filter((task) => {
                // Only use created_at since updated_at doesn't exist in the interface
                const taskDate = task.created_at
                    ? new Date(task.created_at)
                    : null;

                return taskDate && taskDate < thresholdDate;
            });

            if (staleTasks.length > 0) {
                newInsights.push({
                    type: 'overdue_tasks',
                    title: t('productivity.staleTasks', 'Stale Tasks'),
                    description: t(
                        'productivity.staleTasksDesc',
                        'Tasks not updated in {{days}} days',
                        { days: OVERDUE_THRESHOLD_DAYS }
                    ),
                    items: staleTasks,
                    icon: ClockIcon,
                    color: 'text-gray-500',
                });
            }

            // 6. Stuck projects (not updated in a month)
            const stuckProjects = projects.filter((project) => {
                if (
                    !(
                        project.state === 'planned' ||
                        project.state === 'in_progress'
                    )
                )
                    return false;

                // Projects don't have date fields in the interface, so we'll check if they have recent tasks
                const projectTasks = activeTasks.filter(
                    (task) => task.project_id === project.id
                );

                if (projectTasks.length === 0) return false; // Empty projects are handled by "stalled projects"

                // Find the most recent task date for this project
                const mostRecentTaskDate = projectTasks.reduce(
                    (latest, task) => {
                        const taskDate = task.created_at
                            ? new Date(task.created_at)
                            : null;
                        if (!taskDate) return latest;
                        return !latest || taskDate > latest ? taskDate : latest;
                    },
                    null as Date | null
                );

                return mostRecentTaskDate && mostRecentTaskDate < thresholdDate;
            });

            if (stuckProjects.length > 0) {
                newInsights.push({
                    type: 'stuck_projects',
                    title: t('productivity.stuckProjects', 'Stuck Projects'),
                    description: t(
                        'productivity.stuckProjectsDesc',
                        'Projects not updated recently'
                    ),
                    items: stuckProjects,
                    icon: FolderIcon,
                    color: 'text-purple-500',
                });
            }

            setInsights(newInsights);
        };

        generateInsights();
    }, [tasks, projects, t]);

    const totalIssues = insights.reduce(
        (sum, insight) => sum + insight.items.length,
        0
    );

    const toggleInsightExpansion = (index: number) => {
        const newExpanded = new Set(expandedInsights);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedInsights(newExpanded);
    };

    const handleItemClick = async (item: Task | Project) => {
        const isTask = 'status' in item;

        if (isTask) {
            // Handle task click - open task modal
            try {
                setLoading(true);
                const fullTask = await fetchTaskById(item.id!);
                setSelectedTask(fullTask);
                setIsTaskModalOpen(true);
            } catch (error) {
                console.error('Failed to fetch task:', error);
                showErrorToast(
                    t('errors.failedToLoadTask', 'Failed to load task')
                );
            } finally {
                setLoading(false);
            }
        } else {
            // Handle project click - navigate to project page
            if (item.uid) {
                const slug = item.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '');
                navigate(`/project/${item.uid}-${slug}`);
            } else {
                navigate(`/project/${item.id}`);
            }
        }
    };

    const handleTaskSave = async (updatedTask: Task) => {
        try {
            if (updatedTask.uid) {
                await updateTask(updatedTask.uid, updatedTask);
                setIsTaskModalOpen(false);
                setSelectedTask(null);
                // Optionally refresh the parent component data
            }
        } catch (error) {
            console.error('Failed to update task:', error);
            showErrorToast(t('task.updateError', 'Failed to update task'));
        }
    };

    const handleTaskDelete = async () => {
        try {
            if (selectedTask?.uid) {
                await deleteTask(selectedTask.uid);
                setIsTaskModalOpen(false);
                setSelectedTask(null);
                showSuccessToast(
                    t('task.deleteSuccess', 'Task deleted successfully')
                );
                // Optionally refresh the parent component data
            }
        } catch (error) {
            console.error('Failed to delete task:', error);
            showErrorToast(t('task.deleteError', 'Failed to delete task'));
        }
    };

    const handleCreateProject = async (name: string): Promise<Project> => {
        try {
            const project = await createProject({ name, state: 'planned' });
            setAllProjects((prev) => [...prev, project]);
            return project;
        } catch (error) {
            console.error('Failed to create project:', error);
            throw error;
        }
    };

    // Use projects passed as props instead of making additional API calls
    useEffect(() => {
        setAllProjects(projects);
    }, [projects]);

    if (totalIssues === 0) {
        return null;
    }

    return (
        <div className="mb-2 p-4 bg-white dark:bg-gray-900 border-l-4 border-yellow-500 rounded-lg shadow">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center w-full"
            >
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 dark:text-yellow-400 mr-3" />
                <div className="flex-1 text-left">
                    <p className="text-gray-700 dark:text-gray-300 font-medium">
                        {t(
                            'productivity.issuesFound',
                            'Found {{count}} productivity issue(s) that need attention',
                            { count: totalIssues }
                        )}
                    </p>
                    <p className="text-yellow-600 dark:text-yellow-400 text-sm">
                        {t(
                            'productivity.reviewItems',
                            'Click to review and improve your workflow'
                        )}
                    </p>
                </div>
                {isExpanded ? (
                    <ChevronDownIcon className="h-5 w-5 text-yellow-500" />
                ) : (
                    <ChevronRightIcon className="h-5 w-5 text-yellow-500" />
                )}
            </button>

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-4">
                        {insights.map((insight, index) => (
                            <div
                                key={index}
                                className="border-l-4 border-gray-200 dark:border-gray-600 pl-4"
                            >
                                <div className="flex items-start space-x-3">
                                    <insight.icon
                                        className={`h-5 w-5 mt-0.5 ${insight.color}`}
                                    />
                                    <div className="flex-1">
                                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                            {insight.title} (
                                            {insight.items.length})
                                        </h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                            {insight.description}
                                        </p>
                                        <div className="space-y-1">
                                            {(expandedInsights.has(index)
                                                ? insight.items
                                                : insight.items.slice(0, 3)
                                            ).map((item, itemIndex) => {
                                                return (
                                                    <div
                                                        key={itemIndex}
                                                        className="text-sm"
                                                    >
                                                        <button
                                                            onClick={() =>
                                                                handleItemClick(
                                                                    item
                                                                )
                                                            }
                                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-left"
                                                            disabled={loading}
                                                        >
                                                            • {item.name}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {insight.items.length > 3 && (
                                                <button
                                                    onClick={() =>
                                                        toggleInsightExpansion(
                                                            index
                                                        )
                                                    }
                                                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline cursor-pointer"
                                                >
                                                    {expandedInsights.has(index)
                                                        ? '... show less'
                                                        : `... and ${insight.items.length - 3} more items`}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'productivity.suggestion',
                                'Click on any item above to open it and make improvements.'
                            )}
                        </p>
                    </div>
                </div>
            )}

            {/* Task Modal */}
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
                    projects={allProjects}
                    onCreateProject={handleCreateProject}
                />
            )}
        </div>
    );
};

export default ProductivityAssistant;
