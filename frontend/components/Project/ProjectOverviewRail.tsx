import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TFunction } from 'i18next';
import { format } from 'date-fns';
import { PlusIcon } from '@heroicons/react/24/outline';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import { listShares, ListSharesResponseRow } from '../../utils/sharesService';
import { fetchAssignablePeopleForProject } from '../../utils/peopleService';
import { Person } from '../../entities/Person';
import { avatarTint } from '../../utils/avatarTint';
import { getApiPath } from '../../config/paths';

interface ProjectOverviewRailProps {
    project: Project;
    notes: Note[];
    t: TFunction;
    onShareClick: () => void;
    onCreateNote: () => void;
    onOpenNote: (note: Note) => void;
}

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

const displayName = (email?: string | null) => {
    if (!email) return '?';
    const [local] = email.split('@');
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : email;
};

const initials = (email?: string | null) =>
    (email || '?')
        .replace(/@.*/, '')
        .split(/[\s._-]+/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase())
        .join('')
        .slice(0, 2) || '?';

const Panel: React.FC<{
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
    <section className="space-y-3 rounded-xl bg-white p-4 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-2">
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                </h3>
                {subtitle && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {subtitle}
                    </p>
                )}
            </div>
            {action}
        </div>
        {children}
    </section>
);

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({
    label,
    children,
}) => (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
        <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
        <dd className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-right text-gray-800 dark:text-gray-200">
            {children}
        </dd>
    </div>
);

const ProjectOverviewRail: React.FC<ProjectOverviewRailProps> = ({
    project,
    notes,
    t,
    onShareClick,
    onCreateNote,
    onOpenNote,
}) => {
    const [people, setPeople] = useState<ListSharesResponseRow[]>([]);
    // Each member's own person, so a row can link to their profile and
    // show their name instead of their email.
    const [personByUser, setPersonByUser] = useState<Map<number, Person>>(
        new Map()
    );

    useEffect(() => {
        if (!project.uid) return;
        let cancelled = false;
        listShares('project', project.uid)
            .then((rows) => {
                if (!cancelled) setPeople(rows);
            })
            .catch(() => {
                // The panel still shows the share button without the list.
            });
        fetchAssignablePeopleForProject(project.uid)
            .then((list) => {
                if (cancelled) return;
                const map = new Map<number, Person>();
                list.forEach((person) => {
                    if (person.linked_user_id && person.uid) {
                        map.set(person.linked_user_id, person);
                    }
                });
                setPersonByUser(map);
            })
            .catch(() => {
                // Rows stay as plain text when profiles can't be loaded.
            });
        return () => {
            cancelled = true;
        };
    }, [project.uid, project.share_count]);

    const roleLabel = (row: ListSharesResponseRow) => {
        if (row.is_owner || row.access_level === 'owner') {
            return t('project.roleOwner', 'Owner');
        }
        if (row.status === 'pending') {
            return t('project.rolePending', 'Invited');
        }
        return row.access_level === 'rw'
            ? t('project.roleEdit', 'Can edit')
            : t('project.roleView', 'Can view');
    };

    const area = project.area || (project as any).Area;
    const goal = project.Goal || project.goal;
    const priorityColor: Record<string, string> = {
        high: 'bg-red-500',
        medium: 'bg-yellow-400',
        low: 'bg-blue-400',
    };
    const recentNotes = [...notes].sort(
        (a, b) =>
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime()
    );
    const divided = 'space-y-0.5';

    return (
        <div className="space-y-4">
            <Panel
                title={t('project.people', 'People')}
                subtitle={
                    people.length > 0
                        ? t('project.memberCount', '{{count}} members', {
                              count: people.length,
                          })
                        : undefined
                }
                action={
                    <button
                        type="button"
                        onClick={onShareClick}
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        aria-label={t('projectItem.share', 'Share')}
                    >
                        <PlusIcon className="h-4 w-4" />
                    </button>
                }
            >
                {people.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t(
                            'project.notShared',
                            'Only you can see this project.'
                        )}
                    </p>
                ) : (
                    <ul className={divided}>
                        {people.map((row) => {
                            const person = personByUser.get(row.user_id);
                            const content = (
                                <>
                                    {row.avatar_image ? (
                                        <img
                                            src={getApiPath(row.avatar_image)}
                                            alt=""
                                            className="h-8 w-8 rounded-full object-cover"
                                        />
                                    ) : (
                                        <span
                                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${avatarTint(
                                                row.email || String(row.user_id)
                                            )}`}
                                        >
                                            {initials(
                                                person?.name || row.email
                                            )}
                                        </span>
                                    )}
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {person?.name ||
                                                displayName(row.email)}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {roleLabel(row)}
                                        </div>
                                    </div>
                                </>
                            );
                            return (
                                <li key={row.user_id}>
                                    {person?.uid ? (
                                        <Link
                                            to={`/person/${person.uid}`}
                                            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                                        >
                                            {content}
                                        </Link>
                                    ) : (
                                        <div className="flex items-center gap-3 py-2">
                                            {content}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Panel>

            <Panel title={t('project.info', 'Project info')}>
                <dl className={divided}>
                    {area?.name && (
                        <InfoRow label={t('common.area', 'Area')}>
                            {area.uid ? (
                                <Link
                                    to={`/area/${area.uid}-${slugify(area.name)}`}
                                    className="truncate hover:underline"
                                >
                                    {area.name}
                                </Link>
                            ) : (
                                <span className="truncate">{area.name}</span>
                            )}
                        </InfoRow>
                    )}
                    {goal?.title && (
                        <InfoRow label={t('common.goal', 'Goal')}>
                            {goal.uid ? (
                                <Link
                                    to={`/goal/${goal.uid}-${slugify(goal.title)}`}
                                    className="truncate hover:underline"
                                >
                                    {goal.title}
                                </Link>
                            ) : (
                                <span className="truncate">{goal.title}</span>
                            )}
                        </InfoRow>
                    )}
                    {project.priority && (
                        <InfoRow label={t('common.priority', 'Priority')}>
                            <span
                                className={`h-2 w-2 rounded-full ${priorityColor[project.priority] || 'bg-gray-400'}`}
                            />
                            {t(
                                `priority.${project.priority}`,
                                project.priority
                            )}
                        </InfoRow>
                    )}
                    {project.created_at && (
                        <InfoRow label={t('project.started', 'Started')}>
                            {format(
                                new Date(project.created_at),
                                'MMM d, yyyy'
                            )}
                        </InfoRow>
                    )}
                    <InfoRow label={t('common.due', 'Due')}>
                        {project.due_date_at
                            ? format(
                                  new Date(project.due_date_at),
                                  'MMM d, yyyy'
                              )
                            : t('projectItem.noDueDate', 'No due date')}
                    </InfoRow>
                    {project.tags && project.tags.length > 0 && (
                        <InfoRow label={t('common.tags', 'Tags')}>
                            {project.tags.map((tag) => (
                                <Link
                                    key={tag.uid || tag.id || tag.name}
                                    to={
                                        tag.uid
                                            ? `/tag/${tag.uid}-${slugify(tag.name)}`
                                            : `/tag/${encodeURIComponent(tag.name)}`
                                    }
                                    className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    #{tag.name}
                                </Link>
                            ))}
                        </InfoRow>
                    )}
                </dl>
            </Panel>

            <Panel
                title={t('sidebar.notes', 'Notes')}
                subtitle={
                    notes.length > 0
                        ? t('project.noteCount', '{{count}} notes', {
                              count: notes.length,
                          })
                        : undefined
                }
                action={
                    <button
                        type="button"
                        onClick={onCreateNote}
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        aria-label={t('project.addNote', 'Add note')}
                    >
                        <PlusIcon className="h-4 w-4" />
                    </button>
                }
            >
                {recentNotes.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('project.noNotesYet', 'No notes yet.')}
                    </p>
                ) : (
                    <ul className={divided}>
                        {recentNotes.map((note) => (
                            <li key={note.uid || note.id}>
                                <button
                                    type="button"
                                    onClick={() => onOpenNote(note)}
                                    className="block w-full py-2 text-left"
                                >
                                    <span className="block truncate text-sm font-medium text-gray-900 hover:underline dark:text-gray-100">
                                        {note.title ||
                                            t('notes.untitled', 'Untitled')}
                                    </span>
                                    {note.updated_at && (
                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                            {format(
                                                new Date(note.updated_at),
                                                'MMM d'
                                            )}
                                        </span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </div>
    );
};

export default ProjectOverviewRail;
