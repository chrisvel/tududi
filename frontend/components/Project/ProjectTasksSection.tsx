import React from 'react';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import AutoSuggestNextActionBox from './AutoSuggestNextActionBox';
import NewTask from '../Task/NewTask';
import TaskList from '../Task/TaskList';
import { TFunction } from 'i18next';

interface ProjectTasksSectionProps {
    project: Project | null;
    displayTasks: Task[];
    showAutoSuggestForm: boolean;
    onAddNextAction: (projectId: number, description: string) => void;
    onDismissNextAction: () => void;
    onTaskCreate: (taskName: string) => Promise<void>;
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskCompletionToggle: (task: Task) => void;
    onTaskDelete: (taskUid: string) => void;
    onToggleToday: (taskId: number, task?: Task) => Promise<void>;
    allProjects: Project[];
    showCompleted: boolean;
    taskSearchQuery: string;
    t: TFunction;
}

const ProjectTasksSection: React.FC<ProjectTasksSectionProps> = ({
    project,
    displayTasks,
    showAutoSuggestForm,
    onAddNextAction,
    onDismissNextAction,
    onTaskCreate,
    onTaskUpdate,
    onTaskCompletionToggle,
    onTaskDelete,
    onToggleToday,
    allProjects,
    showCompleted,
    taskSearchQuery,
    t,
}) => {
    return (
        <div className="xl:col-span-2 flex flex-col gap-2">
            {showAutoSuggestForm && (
                <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
                    <AutoSuggestNextActionBox
                        onAddAction={(actionDescription) => {
                            if (project?.id) {
                                onAddNextAction(project.id, actionDescription);
                            }
                        }}
                        onDismiss={onDismissNextAction}
                    />
                </div>
            )}

            <div className="transition-all duration-300 ease-in-out overflow-visible opacity-100 transform translate-y-0">
                <NewTask onTaskCreate={onTaskCreate} />
            </div>

            <div className="transition-all duration-300 ease-in-out overflow-visible">
                {displayTasks.length > 0 ? (
                    <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0 overflow-visible">
                        <TaskList
                            tasks={displayTasks}
                            onTaskUpdate={onTaskUpdate}
                            onTaskCompletionToggle={onTaskCompletionToggle}
                            onTaskDelete={onTaskDelete}
                            projects={allProjects}
                            hideProjectName={true}
                            onToggleToday={onToggleToday}
                            showCompletedTasks={showCompleted}
                        />
                    </div>
                ) : (
                    <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
                        <p className="text-gray-500 dark:text-gray-400">
                            {taskSearchQuery.trim()
                                ? t(
                                      'tasks.noTasksAvailable',
                                      'No tasks available.'
                                  )
                                : showCompleted
                                  ? t(
                                        'project.noCompletedTasks',
                                        'No completed tasks.'
                                    )
                                  : t('project.noTasks', 'No tasks.')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectTasksSection;
