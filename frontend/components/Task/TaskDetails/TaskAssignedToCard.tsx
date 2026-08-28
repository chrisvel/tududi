import React, { useEffect, useState } from 'react';
import { UserIcon } from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';
import { Person } from '../../../entities/Person';
import { fetchPeople, fetchAssignablePeopleForProject } from '../../../utils/peopleService';
import PersonDropdown from '../../Shared/PersonDropdown';

interface TaskAssignedToCardProps {
    task: Task;
    onAssign: (personUid: string | null) => Promise<void>;
}

const TaskAssignedToCard: React.FC<TaskAssignedToCardProps> = ({ task, onAssign }) => {
    const [people, setPeople] = useState<Person[]>([]);

    useEffect(() => {
        const load = task.project_uid
            ? fetchAssignablePeopleForProject(task.project_uid)
            : fetchPeople();
        load.catch(console.error).then((p) => {
            if (p) setPeople(p);
        });
    }, [task.project_uid]);

    // Merge the embedded AssignedTo person (from shared tasks) with the user's own people
    // so assignees from other users' person records are visible
    const mergedPeople = React.useMemo(() => {
        if (!task.AssignedTo) return people;
        const alreadyInList = people.some((p) => p.uid === task.AssignedTo!.uid);
        if (alreadyInList) return people;
        return [...people, task.AssignedTo];
    }, [people, task.AssignedTo]);

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <UserIcon className="w-3.5 h-3.5" />
                Assigned To
            </div>
            <PersonDropdown
                personUid={task.assigned_to ?? null}
                people={mergedPeople}
                onChange={onAssign}
            />
        </div>
    );
};

export default TaskAssignedToCard;
