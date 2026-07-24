import React, { useEffect, useState } from 'react';
import { UserIcon } from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';
import { Person } from '../../../entities/Person';
import { fetchPeople } from '../../../utils/peopleService';
import { fetchProjectParticipants } from '../../../utils/projectsService';
import PersonDropdown from '../../Shared/PersonDropdown';

interface TaskAssignedToCardProps {
    task: Task;
    onAssign: (personUid: string | null) => Promise<void>;
}

const TaskAssignedToCard: React.FC<TaskAssignedToCardProps> = ({
    task,
    onAssign,
}) => {
    const [people, setPeople] = useState<Person[]>([]);
    const [participants, setParticipants] = useState<Person[]>([]);

    useEffect(() => {
        fetchPeople()
            .catch(console.error)
            .then((p) => {
                if (p) setPeople(p);
            });
    }, []);

    // On shared projects, offer the participants (real accounts, via their
    // self-person records) on top of the personal people book.
    const projectUid = (task as any).project_uid || null;
    useEffect(() => {
        if (!projectUid) {
            setParticipants([]);
            return;
        }
        fetchProjectParticipants(projectUid)
            .then((rows) => {
                // A project with a single participant is not shared — keep
                // the dropdown identical to the solo experience.
                if (rows.length < 2) {
                    setParticipants([]);
                    return;
                }
                setParticipants(
                    rows
                        .filter((r) => r.person_uid)
                        .map(
                            (r) =>
                                ({
                                    uid: r.person_uid!,
                                    name: r.name,
                                    linked_user_id: r.user_id,
                                }) as unknown as Person
                        )
                );
            })
            .catch(() => setParticipants([]));
    }, [projectUid]);

    const participantUids = new Set(participants.map((p) => p.uid));
    const mergedPeople = [
        ...participants,
        ...people.filter((p) => !participantUids.has(p.uid!)),
    ];

    // The task may be assigned to a person record the viewer doesn't hold
    // (e.g. the owner's contact on a shared task) — the serializer provides
    // the display info, so surface it rather than showing "Unassigned".
    const assignedPerson = (task as any).assigned_person;
    if (
        task.assigned_to &&
        assignedPerson &&
        !mergedPeople.some((p) => p.uid === task.assigned_to)
    ) {
        mergedPeople.unshift({
            uid: task.assigned_to,
            name: assignedPerson.name,
        } as unknown as Person);
    }

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
