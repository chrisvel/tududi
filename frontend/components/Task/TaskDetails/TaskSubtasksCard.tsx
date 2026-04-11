import React from 'react';
import TaskSubtasksSection from '../TaskForm/TaskSubtasksSection';
import { Task } from '../../../entities/Task';
import type { TaskDelegationPlan } from '../../../utils/tasksService';

interface TaskSubtasksCardProps {
    task: Task;
    subtasks: Task[];
    onSubtasksChange: (subtasks: Task[]) => void;
    onSave: (subtasks: Task[]) => void;
    delegationPlan: TaskDelegationPlan | null;
    isGeneratingDelegationPlan: boolean;
    onGenerateDelegationPlan: () => void;
}

const TaskSubtasksCard: React.FC<TaskSubtasksCardProps> = ({
    task,
    subtasks,
    onSubtasksChange,
    onSave,
    delegationPlan,
    isGeneratingDelegationPlan,
    onGenerateDelegationPlan,
}) => {
    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
            <TaskSubtasksSection
                parentTaskId={task.id!}
                subtasks={subtasks}
                onSubtasksChange={onSubtasksChange}
                onSave={onSave}
                delegationPlan={delegationPlan}
                isGeneratingDelegationPlan={isGeneratingDelegationPlan}
                onGenerateDelegationPlan={onGenerateDelegationPlan}
            />
        </div>
    );
};

export default TaskSubtasksCard;
