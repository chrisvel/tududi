import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    TrashIcon,
    ArchiveBoxIcon,
    EnvelopeIcon,
    PhoneIcon,
    UserIcon,
    LinkIcon,
} from '@heroicons/react/24/outline';
import { Person } from '../../entities/Person';
import { Task } from '../../entities/Task';
import {
    fetchPersonByUid,
    updatePerson,
    deletePerson,
} from '../../utils/peopleService';
import { useToast } from '../Shared/ToastContext';
import PersonModal from './PersonModal';
import PersonHero from './PersonHero';
import SignInLinkModal from './SignInLinkModal';
import MemberEditModal from './MemberEditModal';
import { removeMember } from '../../utils/membersService';
import ConfirmDialog from '../Shared/ConfirmDialog';
import TaskList from '../Task/TaskList';
import { useStore } from '../../store/useStore';

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
    const { t } = useTranslation();

    const [person, setPerson] = useState<Person | null>(null);
    const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
    const projects = useStore((state) => state.projectsStore.projects);

    // A task reassigned to someone else leaves this person's list.
    const handleTaskUpdate = async (updated: Task) => {
        setAssignedTasks((prev) =>
            updated.assigned_to && updated.assigned_to !== uid
                ? prev.filter((task) => task.uid !== updated.uid)
                : prev.map((task) =>
                      task.uid === updated.uid ? updated : task
                  )
        );
    };

    const handleTaskDelete = (taskUid: string) => {
        setAssignedTasks((prev) => prev.filter((task) => task.uid !== taskUid));
    };
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [signInLinkOpen, setSignInLinkOpen] = useState(false);
    const [memberEditOpen, setMemberEditOpen] = useState(false);
    const [memberRemoveOpen, setMemberRemoveOpen] = useState(false);

    const load = async () => {
        if (!uid) return;
        setLoading(true);
        try {
            const p = await fetchPersonByUid(uid);
            setPerson(p);

            const response = await fetch(
                `/api/tasks?assigned_to=${encodeURIComponent(uid)}&status=active`,
                {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                }
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
            const result = await updatePerson(person.uid, {
                archived: !person.archived,
            });
            setPerson(result.person);
            showSuccessToast(
                person.archived ? 'Person unarchived' : 'Person archived'
            );
        } catch (err: unknown) {
            showErrorToast(
                err instanceof Error ? err.message : 'Failed to archive'
            );
        }
    };

    const handleDelete = async () => {
        if (!person?.uid) return;
        try {
            await deletePerson(person.uid);
            showSuccessToast('Person deleted');
            navigate('/people');
        } catch (err: unknown) {
            showErrorToast(
                err instanceof Error ? err.message : 'Failed to delete person'
            );
        } finally {
            setIsConfirmDialogOpen(false);
        }
    };

    const handleRemoveMember = async () => {
        if (person?.linked_user_id == null) return;
        try {
            await removeMember(person.linked_user_id);
            showSuccessToast(t('members.removed', 'Member removed'));
            navigate('/people');
        } catch (err: unknown) {
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t('members.failedToRemove', 'Failed to remove member')
            );
        } finally {
            setMemberRemoveOpen(false);
        }
    };

    // A member you added: you can rename it, give it an email, or remove it.
    const managesMember =
        person?.kind === 'member' &&
        person.can_manage === true &&
        person.can_edit === false;

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

    const pillClass =
        'inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-12">
            {/* Person header, same card as the other detail pages */}
            <PersonHero
                name={person.name}
                tint={person.color || '#3b82f6'}
                doneCount={
                    assignedTasks.filter((task) =>
                        [2, 3, 'done', 'archived'].includes(task.status as any)
                    ).length
                }
                totalCount={assignedTasks.length}
                meta={
                    <>
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {person.kind === 'member'
                                ? t('people.member', 'Member')
                                : t('people.contact', 'Contact')}
                        </span>
                        <span>
                            {
                                RELATIONSHIP_LABELS[
                                    person.relationship_type ?? 'other'
                                ]
                            }
                        </span>
                        {person.linked_user_id != null && (
                            <span className="flex items-center gap-1">
                                <UserIcon className="h-3.5 w-3.5" />
                                Linked account
                            </span>
                        )}
                        {assignedTasks.length > 0 && (
                            <span>
                                {assignedTasks.length} assigned{' '}
                                {assignedTasks.length === 1 ? 'task' : 'tasks'}
                            </span>
                        )}
                        {person.archived && (
                            <span className="text-amber-600 dark:text-amber-400">
                                Archived
                            </span>
                        )}
                    </>
                }
                description={
                    <div className="space-y-2">
                        {person.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                                <a
                                    href={`mailto:${person.email}`}
                                    className="hover:underline"
                                >
                                    {person.email}
                                </a>
                            </div>
                        )}
                        {person.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                <PhoneIcon className="h-4 w-4 text-gray-400" />
                                <a
                                    href={`tel:${person.phone}`}
                                    className="hover:underline"
                                >
                                    {person.phone}
                                </a>
                            </div>
                        )}
                        {person.notes && (
                            <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                {person.notes}
                            </p>
                        )}
                    </div>
                }
                actions={
                    <>
                        {person.can_sign_in_link && (
                            <button
                                type="button"
                                onClick={() => setSignInLinkOpen(true)}
                                className={pillClass}
                                data-testid="person-sign-in-link"
                            >
                                <LinkIcon className="h-4 w-4" />
                                Sign-in link
                            </button>
                        )}
                        {managesMember && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setMemberEditOpen(true)}
                                    className={pillClass}
                                    data-testid="member-edit"
                                >
                                    <PencilSquareIcon className="h-4 w-4" />
                                    {t('members.editTitle', 'Edit member')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMemberRemoveOpen(true)}
                                    className={pillClass}
                                    data-testid="member-remove"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                    {t('members.remove', 'Remove member')}
                                </button>
                            </>
                        )}
                        {person.can_edit !== false && (
                            <button
                                type="button"
                                onClick={() => setModalOpen(true)}
                                className={pillClass}
                                title="Edit person"
                            >
                                <PencilSquareIcon className="h-4 w-4" />
                                {t('common.edit', 'Edit')}
                            </button>
                        )}
                        {person.can_edit !== false &&
                            person.kind !== 'member' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleArchive}
                                        className={pillClass}
                                        title={
                                            person.archived
                                                ? 'Unarchive'
                                                : 'Archive'
                                        }
                                    >
                                        <ArchiveBoxIcon className="h-4 w-4" />
                                        {person.archived
                                            ? 'Unarchive'
                                            : 'Archive'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIsConfirmDialogOpen(true)
                                        }
                                        className={pillClass}
                                        title="Delete person"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                        {t('common.delete', 'Delete')}
                                    </button>
                                </>
                            )}
                    </>
                }
            />

            {/* Tabs */}
            <div className="mb-4 flex items-center min-h-[2.5rem] gap-4 sm:gap-6 pl-2 sm:pl-3">
                <span className="relative flex items-center self-stretch py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 after:absolute after:bottom-0 after:left-px after:right-px after:h-0.5 after:rounded-full after:bg-gray-900 dark:after:bg-gray-100">
                    {t('tasks.title', 'Tasks')} ({assignedTasks.length})
                </span>
            </div>

            {/* Assigned Tasks */}
            <div>
                {assignedTasks.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                        No tasks assigned to {person.name}.
                    </p>
                ) : (
                    <TaskList
                        tasks={assignedTasks}
                        projects={projects}
                        onTaskUpdate={handleTaskUpdate}
                        onTaskDelete={handleTaskDelete}
                    />
                )}
            </div>

            {modalOpen && (
                <PersonModal
                    person={person}
                    onSave={handleSave}
                    onClose={() => setModalOpen(false)}
                />
            )}

            {signInLinkOpen && person.linked_user_id != null && (
                <SignInLinkModal
                    memberId={person.linked_user_id}
                    memberName={person.name}
                    onClose={() => setSignInLinkOpen(false)}
                />
            )}

            {memberEditOpen && (
                <MemberEditModal
                    person={person}
                    onSaved={(member) => {
                        showSuccessToast(
                            member.invited
                                ? t('members.invitationSent', 'Invitation sent')
                                : t('members.updated', 'Member updated')
                        );
                        load();
                    }}
                    onClose={() => setMemberEditOpen(false)}
                />
            )}

            {memberRemoveOpen && (
                <ConfirmDialog
                    title={t('members.remove', 'Remove member')}
                    message={t('members.removeConfirm', {
                        defaultValue:
                            'Remove {{name}}? Their account and everything in it is deleted, and this cannot be undone. On tududi Cloud their seat is taken off your subscription.',
                        name: person.name,
                    })}
                    onConfirm={handleRemoveMember}
                    onCancel={() => setMemberRemoveOpen(false)}
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
