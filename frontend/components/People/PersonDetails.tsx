import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    PencilSquareIcon,
    TrashIcon,
    ArchiveBoxIcon,
    EnvelopeIcon,
    PhoneIcon,
} from '@heroicons/react/24/outline';
import { Person } from '../../entities/Person';
import { Task } from '../../entities/Task';
import { fetchPersonByUid, updatePerson, deletePerson } from '../../utils/peopleService';
import { useToast } from '../Shared/ToastContext';
import PersonModal from './PersonModal';
import ConfirmDialog from '../Shared/ConfirmDialog';

const RELATIONSHIP_LABELS: Record<string, string> = {
    family: 'Family',
    work: 'Work',
    friend: 'Friend',
    other: 'Other',
};

const PersonDetails: React.FC = () => {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const { showSuccessToast, showErrorToast } = useToast();

    const [person, setPerson] = useState<Person | null>(null);
    const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

    const load = async () => {
        if (!uid) return;
        setLoading(true);
        try {
            const p = await fetchPersonByUid(uid);
            setPerson(p);

            const response = await fetch(
                `/api/tasks?assigned_to=${encodeURIComponent(uid)}&status=active`,
                { credentials: 'include', headers: { Accept: 'application/json' } }
            );
            if (response.ok) {
                const data = await response.json();
                setAssignedTasks(data.tasks ?? []);
            }
        } catch {
            showErrorToast('Failed to load person');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [uid]);

    const handleSave = async (data: Partial<Person>) => {
        if (!person?.uid) return;
        const result = await updatePerson(person.uid, data);
        setPerson(result.person);
        showSuccessToast('Person updated');
    };

    const handleArchive = async () => {
        if (!person?.uid) return;
        try {
            const result = await updatePerson(person.uid, { archived: !person.archived });
            setPerson(result.person);
            showSuccessToast(person.archived ? 'Person unarchived' : 'Person archived');
        } catch (err: unknown) {
            showErrorToast(err instanceof Error ? err.message : 'Failed to archive');
        }
    };

    const handleDelete = async () => {
        if (!person?.uid) return;
        try {
            await deletePerson(person.uid);
            showSuccessToast('Person deleted');
            navigate('/people');
        } catch (err: unknown) {
            showErrorToast(err instanceof Error ? err.message : 'Failed to delete person');
        } finally {
            setIsConfirmDialogOpen(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                Loading...
            </div>
        );
    }

    if (!person) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                Person not found.
            </div>
        );
    }

    const hasColor = !!person.color;

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            {/* Person Header Banner */}
            <div
                className="rounded-xl mb-8 overflow-hidden"
                style={hasColor ? { backgroundColor: person.color! } : undefined}
            >
                <div className={`p-6 ${hasColor ? '' : 'bg-gray-50 dark:bg-gray-900 rounded-xl'}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className={`text-xs font-medium uppercase tracking-widest mb-1 ${
                                hasColor ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'
                            }`}>
                                Person
                            </p>
                            <h1 className={`text-3xl font-light ${
                                hasColor ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                            }`}>
                                {person.name}
                            </h1>
                            <div className={`mt-3 flex flex-wrap gap-4 text-xs ${
                                hasColor ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                                <span>{RELATIONSHIP_LABELS[person.relationship_type ?? 'other']}</span>
                                {assignedTasks.length > 0 && (
                                    <span>{assignedTasks.length} assigned {assignedTasks.length === 1 ? 'task' : 'tasks'}</span>
                                )}
                                {person.archived && (
                                    <span className={hasColor ? 'text-white/90' : 'text-amber-600 dark:text-amber-400'}>
                                        Archived
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                                onClick={() => setModalOpen(true)}
                                className={`p-2 rounded-lg transition-colors ${
                                    hasColor
                                        ? 'text-white/80 hover:text-white hover:bg-white/10'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                title="Edit person"
                            >
                                <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={handleArchive}
                                className={`p-2 rounded-lg transition-colors ${
                                    hasColor
                                        ? 'text-white/80 hover:text-white hover:bg-white/10'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                title={person.archived ? 'Unarchive' : 'Archive'}
                            >
                                <ArchiveBoxIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setIsConfirmDialogOpen(true)}
                                className={`p-2 rounded-lg transition-colors ${
                                    hasColor
                                        ? 'text-white/80 hover:text-white hover:bg-white/10'
                                        : 'text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                title="Delete person"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Contact info */}
                    <div className="mt-4 space-y-2">
                        {person.email && (
                            <div className={`flex items-center gap-2 text-sm ${
                                hasColor ? 'text-white/80' : 'text-gray-600 dark:text-gray-300'
                            }`}>
                                <EnvelopeIcon className={`h-4 w-4 ${hasColor ? 'text-white/60' : 'text-gray-400'}`} />
                                <a href={`mailto:${person.email}`} className="hover:underline">
                                    {person.email}
                                </a>
                            </div>
                        )}
                        {person.phone && (
                            <div className={`flex items-center gap-2 text-sm ${
                                hasColor ? 'text-white/80' : 'text-gray-600 dark:text-gray-300'
                            }`}>
                                <PhoneIcon className={`h-4 w-4 ${hasColor ? 'text-white/60' : 'text-gray-400'}`} />
                                <a href={`tel:${person.phone}`} className="hover:underline">
                                    {person.phone}
                                </a>
                            </div>
                        )}
                        {person.notes && (
                            <p className={`text-sm mt-3 whitespace-pre-line ${
                                hasColor ? 'text-white/80' : 'text-gray-600 dark:text-gray-300'
                            }`}>
                                {person.notes}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Assigned Tasks */}
            <div>
                <h2 className="text-lg font-light text-gray-700 dark:text-gray-300 mb-3">
                    Assigned Tasks
                    {assignedTasks.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-gray-400">
                            ({assignedTasks.length})
                        </span>
                    )}
                </h2>

                {assignedTasks.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                        No tasks assigned to {person.name}.
                    </p>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {assignedTasks.map((task) => (
                            <li
                                key={task.uid}
                                className="py-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                                onClick={() => navigate(`/task/${task.uid}`)}
                            >
                                <span>{task.name}</span>
                                {task.Project && (
                                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                                        {task.Project.name}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {modalOpen && (
                <PersonModal
                    person={person}
                    onSave={handleSave}
                    onClose={() => setModalOpen(false)}
                />
            )}

            {isConfirmDialogOpen && (
                <ConfirmDialog
                    title="Delete Person"
                    message={`Are you sure you want to delete "${person.name}"? This cannot be undone.`}
                    onConfirm={handleDelete}
                    onCancel={() => setIsConfirmDialogOpen(false)}
                />
            )}
        </div>
    );
};

export default PersonDetails;
