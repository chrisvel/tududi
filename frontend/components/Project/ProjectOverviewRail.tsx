import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TFunction } from 'i18next';
import { format } from 'date-fns';
import { PencilIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Project } from '../../entities/Project';
import { Area } from '../../entities/Area';
import { Goal } from '../../entities/Goal';
import { Note } from '../../entities/Note';
import { PriorityType } from '../../entities/Task';
import AreaDropdown from '../Shared/AreaDropdown';
import GoalDropdown from '../Shared/GoalDropdown';
import PriorityDropdown from '../Shared/PriorityDropdown';
import DatePicker from '../Shared/DatePicker';
import ColorPicker from '../Shared/ColorPicker';
import TagInput from '../Tag/TagInput';
import { fetchGoals } from '../../utils/goalsService';
import { useStore } from '../../store/useStore';
import { listShares, ListSharesResponseRow } from '../../utils/sharesService';
import { fetchAssignablePeopleForProject } from '../../utils/peopleService';
import { Person } from '../../entities/Person';
import { avatarTint } from '../../utils/avatarTint';
import { getApiPath } from '../../config/paths';

interface ProjectOverviewRailProps {
    project: Project;
    areas: Area[];
    notes: Note[];
    t: TFunction;
    onUpdate: (patch: Partial<Project>) => Promise<void>;
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

// A project info row that edits in place. The value keeps its links; a
// pencil (or the empty-state text) opens the editor under the row, and
// picking a value saves it and closes the editor again.
const EditableRow: React.FC<{
    label: string;
    editLabel: string;
    empty: string;
    hasValue: boolean;
    editing: boolean;
    onStartEdit: () => void;
    editor: React.ReactNode;
    children?: React.ReactNode;
}> = ({
    label,
    editLabel,
    empty,
    hasValue,
    editing,
    onStartEdit,
    editor,
    children,
}) => (
    <div className="group py-2 text-sm">
        <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-right text-gray-800 dark:text-gray-200">
                {hasValue ? (
                    <>
                        <button
                            type="button"
                            onClick={onStartEdit}
                            className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-gray-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-gray-200 [@media(hover:none)]:opacity-100"
                            aria-label={editLabel}
                        >
                            <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        {children}
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={onStartEdit}
                        className="text-gray-400 hover:text-gray-700 hover:underline dark:text-gray-500 dark:hover:text-gray-200"
                    >
                        {empty}
                    </button>
                )}
            </dd>
        </div>
        {editing && <div className="mt-2">{editor}</div>}
    </div>
);

type EditableField =
    'area' | 'goal' | 'priority' | 'due' | 'tags' | 'color' | null;

const ProjectOverviewRail: React.FC<ProjectOverviewRailProps> = ({
    project,
    areas,
    notes,
    t,
    onUpdate,
    onShareClick,
    onCreateNote,
    onOpenNote,
}) => {
    const { tagsStore } = useStore();
    const [editing, setEditing] = useState<EditableField>(null);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [tagDraft, setTagDraft] = useState<string[]>([]);

    useEffect(() => {
        if (editing !== 'goal' || goals.length > 0) return;
        fetchGoals()
            .then(setGoals)
            .catch(() => setGoals([]));
    }, [editing, goals.length]);

    useEffect(() => {
        if (editing !== 'tags') return;
        setTagDraft((project.tags || []).map((tag) => tag.name));
        if (!tagsStore.hasLoaded && !tagsStore.isLoading) {
            tagsStore.loadTags();
        }
    }, [editing]);

    const save = async (patch: Partial<Project>) => {
        setEditing(null);
        await onUpdate(patch).catch(() => undefined);
    };

    const saveTags = async () => {
        const current = (project.tags || []).map((tag) => tag.name);
        const changed =
            tagDraft.length !== current.length ||
            tagDraft.some((name, i) => name !== current[i]);
        if (!changed) {
            setEditing(null);
            return;
        }
        const known = tagsStore.tags.map((tag) => tag.name);
        const fresh = tagDraft.filter((name) => !known.includes(name));
        if (fresh.length > 0) tagsStore.addNewTags(fresh);
        await save({ tags: tagDraft.map((name) => ({ name })) as any });
    };

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
                    <EditableRow
                        label={t('common.area', 'Area')}
                        editLabel={t('project.changeArea', 'Change area')}
                        empty={t('project.setArea', 'Set area')}
                        hasValue={!!area?.name}
                        editing={editing === 'area'}
                        onStartEdit={() => setEditing('area')}
                        editor={
                            <AreaDropdown
                                value={project.area_id ?? area?.id ?? null}
                                areas={areas}
                                onChange={(value) => save({ area_id: value })}
                            />
                        }
                    >
                        {area?.uid ? (
                            <Link
                                to={`/area/${area.uid}-${slugify(area.name)}`}
                                className="truncate hover:underline"
                            >
                                {area.name}
                            </Link>
                        ) : (
                            <span className="truncate">{area?.name}</span>
                        )}
                    </EditableRow>
                    <EditableRow
                        label={t('common.goal', 'Goal')}
                        editLabel={t('project.changeGoal', 'Change goal')}
                        empty={t('project.setGoal', 'Set goal')}
                        hasValue={!!goal?.title || !!project.is_maintenance}
                        editing={editing === 'goal'}
                        onStartEdit={() => setEditing('goal')}
                        editor={
                            <GoalDropdown
                                goalId={project.goal_id ?? goal?.id ?? null}
                                isMaintenance={!!project.is_maintenance}
                                goals={goals}
                                onChange={(id, maintenance) =>
                                    save({
                                        goal_id: id,
                                        is_maintenance: maintenance,
                                    })
                                }
                            />
                        }
                    >
                        {goal?.uid ? (
                            <Link
                                to={`/goal/${goal.uid}-${slugify(goal.title)}`}
                                className="truncate hover:underline"
                            >
                                {goal.title}
                            </Link>
                        ) : (
                            <span className="truncate">
                                {goal?.title ||
                                    t('goals.maintenance', 'Maintenance')}
                            </span>
                        )}
                    </EditableRow>
                    <EditableRow
                        label={t('common.priority', 'Priority')}
                        editLabel={t(
                            'project.changePriority',
                            'Change priority'
                        )}
                        empty={t('project.setPriority', 'Set priority')}
                        hasValue={!!project.priority}
                        editing={editing === 'priority'}
                        onStartEdit={() => setEditing('priority')}
                        editor={
                            <PriorityDropdown
                                value={
                                    (project.priority as PriorityType) ?? null
                                }
                                onChange={(value: PriorityType) =>
                                    save({ priority: value })
                                }
                            />
                        }
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${priorityColor[String(project.priority)] || 'bg-gray-400'}`}
                        />
                        {t(
                            `priority.${project.priority}`,
                            String(project.priority)
                        )}
                    </EditableRow>
                    {project.created_at && (
                        <InfoRow label={t('project.started', 'Started')}>
                            {format(
                                new Date(project.created_at),
                                'MMM d, yyyy'
                            )}
                        </InfoRow>
                    )}
                    <EditableRow
                        label={t('common.due', 'Due')}
                        editLabel={t('project.changeDue', 'Change due date')}
                        empty={t('projectItem.noDueDate', 'No due date')}
                        hasValue={!!project.due_date_at}
                        editing={editing === 'due'}
                        onStartEdit={() => setEditing('due')}
                        editor={
                            <DatePicker
                                value={project.due_date_at || ''}
                                onChange={(value) =>
                                    save({ due_date_at: value || null })
                                }
                                placeholder={t(
                                    'projects.selectDueDatePlaceholder'
                                )}
                            />
                        }
                    >
                        {project.due_date_at &&
                            format(
                                new Date(project.due_date_at),
                                'MMM d, yyyy'
                            )}
                    </EditableRow>
                    <EditableRow
                        label={t('common.tags', 'Tags')}
                        editLabel={t('project.changeTags', 'Change tags')}
                        empty={t('project.addTags', 'Add tags')}
                        hasValue={!!project.tags && project.tags.length > 0}
                        editing={editing === 'tags'}
                        onStartEdit={() => setEditing('tags')}
                        editor={
                            <div className="space-y-2">
                                <TagInput
                                    initialTags={tagDraft}
                                    onTagsChange={setTagDraft}
                                    availableTags={tagsStore.tags}
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditing(null)}
                                        className="rounded-md px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                    >
                                        {t('common.cancel', 'Cancel')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={saveTags}
                                        className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                    >
                                        {t('common.save', 'Save')}
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        {(project.tags || []).map((tag) => (
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
                    </EditableRow>
                    <EditableRow
                        label={t('forms.color', 'Color')}
                        editLabel={t('project.changeColor', 'Change color')}
                        empty={t('project.setColor', 'Set color')}
                        hasValue={!!project.color}
                        editing={editing === 'color'}
                        onStartEdit={() => setEditing('color')}
                        editor={
                            <ColorPicker
                                value={project.color || ''}
                                onChange={(color) => save({ color })}
                            />
                        }
                    >
                        <span
                            className="h-3.5 w-3.5 rounded-full"
                            style={{ backgroundColor: project.color }}
                        />
                    </EditableRow>
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
