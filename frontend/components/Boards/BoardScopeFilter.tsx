import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { Area } from '../../entities/Area';
import { Project } from '../../entities/Project';
import { Tag } from '../../entities/Tag';
import MultiFilterDropdown from '../Shared/MultiFilterDropdown';
import { projectAreaUid } from '../../utils/projectArea';
import BoardPinButton from './BoardPinButton';
import {
    BOARD_PRIORITIES,
    BoardScope,
    BoardScopeEntry,
    BoardScopeKind,
    EMPTY_SCOPE,
} from './useBoardScope';

// Stable fallbacks keep the selectors referentially equal when a store
// slice is absent.
const NO_AREAS: Area[] = [];
const NO_PROJECTS: Project[] = [];
const NO_TAGS: Tag[] = [];

interface BoardScopeFilterProps {
    scope: BoardScope;
    entries: BoardScopeEntry[];
    onChange: (scope: BoardScope) => void;
    className?: string;
}

const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name);

const FIELD: Record<BoardScopeKind, keyof BoardScope> = {
    area: 'areaUids',
    project: 'projectUids',
    tag: 'tags',
    priority: 'priorities',
};

/**
 * Area, project, tag and priority pickers for a board, followed by the
 * active filters as removable chips. Everything is written to the URL.
 */
const BoardScopeFilter: React.FC<BoardScopeFilterProps> = ({
    scope,
    entries,
    onChange,
    className = '',
}) => {
    const { t } = useTranslation();
    const areas: Area[] = useStore(
        (state: any) => state.areasStore?.areas ?? NO_AREAS
    );
    const projects: Project[] = useStore(
        (state: any) => state.projectsStore?.projects ?? NO_PROJECTS
    );
    const tags: Tag[] = useStore(
        (state: any) => state.tagsStore?.tags ?? NO_TAGS
    );

    const areaOptions = useMemo(
        () =>
            areas
                .filter((area) => area.uid)
                .sort(byName)
                .map((area) => ({ value: area.uid!, label: area.name })),
        [areas]
    );

    // As in Focus: closed projects are hidden unless already picked, and a
    // picked area limits the list to its projects.
    const projectOptions = useMemo(
        () =>
            projects
                .filter((project) => {
                    if (!project.uid) return false;
                    if (scope.projectUids.includes(project.uid)) return true;
                    if (
                        project.status === 'done' ||
                        project.status === 'cancelled'
                    ) {
                        return false;
                    }
                    if (scope.areaUids.length === 0) return true;
                    const areaUid = projectAreaUid(project, areas);
                    return !!areaUid && scope.areaUids.includes(areaUid);
                })
                .sort(byName)
                .map((project) => ({
                    value: project.uid!,
                    label: project.name,
                })),
        [projects, areas, scope]
    );

    const tagOptions = useMemo(
        () =>
            [...tags]
                .sort(byName)
                .map((tag) => ({ value: tag.name, label: `#${tag.name}` })),
        [tags]
    );

    const priorityLabel = (key: string) => {
        switch (key) {
            case 'high':
                return t('priority.high', 'High');
            case 'medium':
                return t('priority.medium', 'Medium');
            case 'low':
                return t('priority.low', 'Low');
            case 'none':
                return t('priority.none', 'None');
            default:
                return key;
        }
    };
    const priorityOptions = BOARD_PRIORITIES.map((key) => ({
        value: key,
        label: priorityLabel(key),
    }));

    // Picking areas drops the picked projects that sit outside them, so the
    // chips never show a project the project list no longer offers.
    const changeAreas = (areaUids: string[]) => {
        const projectUids =
            areaUids.length === 0
                ? scope.projectUids
                : scope.projectUids.filter((uid) => {
                      const project = projects.find((p) => p.uid === uid);
                      const areaUid = project && projectAreaUid(project, areas);
                      return (
                          !project || (!!areaUid && areaUids.includes(areaUid))
                      );
                  });
        onChange({ ...scope, areaUids, projectUids });
    };

    const remove = (entry: BoardScopeEntry) => {
        const field = FIELD[entry.kind];
        const rest = scope[field].filter((value) => value !== entry.value);
        if (entry.kind === 'area') changeAreas(rest);
        else onChange({ ...scope, [field]: rest });
    };

    const kindLabel = (kind: BoardScopeKind) => {
        switch (kind) {
            case 'area':
                return t('tasks.boardScope.area', 'Area');
            case 'project':
                return t('tasks.boardScope.project', 'Project');
            case 'tag':
                return t('tasks.boardScope.tag', 'Tag');
            default:
                return t('tasks.boardScope.priority', 'Priority');
        }
    };

    // Areas and projects prefer the store (instant), then the lookup.
    const labelOf = (entry: BoardScopeEntry) => {
        switch (entry.kind) {
            case 'area':
                return (
                    areas.find((a) => a.uid === entry.value)?.name ??
                    entry.label ??
                    entry.value
                );
            case 'project':
                return (
                    projects.find((p) => p.uid === entry.value)?.name ??
                    entry.label ??
                    entry.value
                );
            case 'tag':
                return `#${entry.value}`;
            default:
                return priorityLabel(entry.value);
        }
    };

    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
            <MultiFilterDropdown
                options={areaOptions}
                values={scope.areaUids}
                onChange={changeAreas}
                placeholder={t('tasks.boardScope.areas', 'Areas')}
                searchable
            />
            <MultiFilterDropdown
                options={projectOptions}
                values={scope.projectUids}
                onChange={(projectUids) => onChange({ ...scope, projectUids })}
                placeholder={t('tasks.boardScope.projects', 'Projects')}
                searchable
            />
            <MultiFilterDropdown
                options={tagOptions}
                values={scope.tags}
                onChange={(next) => onChange({ ...scope, tags: next })}
                placeholder={t('tasks.boardScope.tags', 'Tags')}
                searchable
            />
            <MultiFilterDropdown
                options={priorityOptions}
                values={scope.priorities}
                onChange={(priorities) => onChange({ ...scope, priorities })}
                placeholder={t('tasks.boardScope.priorities', 'Priority')}
            />
            {entries.length > 0 && (
                <>
                    <span
                        aria-hidden="true"
                        className="mx-1 h-6 border-l border-gray-300 dark:border-gray-600"
                    />
                    <ul
                        aria-label={t(
                            'tasks.boardScope.activeFilters',
                            'Active filters'
                        )}
                        className="flex flex-wrap items-center gap-1.5"
                    >
                        {entries.map((entry) => {
                            const broken =
                                entry.status === 'not_found' ||
                                entry.status === 'error';
                            const label = labelOf(entry);
                            return (
                                <li
                                    key={`${entry.kind}:${entry.value}`}
                                    className={`inline-flex items-center gap-1 rounded-full pl-3 pr-1 py-0.5 text-sm ${
                                        broken
                                            ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                                    }`}
                                >
                                    <span className="text-xs opacity-60">
                                        {kindLabel(entry.kind)}
                                    </span>
                                    <span className="max-w-[12rem] truncate">
                                        {label}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => remove(entry)}
                                        className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                                        aria-label={t(
                                            'tasks.boardScope.removeFilter',
                                            'Remove filter {{name}}',
                                            { name: label }
                                        )}
                                    >
                                        <XMarkIcon className="w-3.5 h-3.5" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {entries.length > 1 && (
                        <button
                            type="button"
                            onClick={() => onChange(EMPTY_SCOPE)}
                            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                        >
                            {t('tasks.boardScope.clearAll', 'Clear all')}
                        </button>
                    )}
                    <div className="ml-auto">
                        <BoardPinButton filterLabels={entries.map(labelOf)} />
                    </div>
                </>
            )}
        </div>
    );
};

/**
 * Says which filters cannot be used. The board stays visible: an unknown
 * area, project or tag adds no task, so it never falls back to every task.
 */
export const BoardScopeProblem: React.FC<{
    entries: BoardScopeEntry[];
    className?: string;
}> = ({ entries, className = '' }) => {
    const { t } = useTranslation();
    const notFound = entries.some((entry) => entry.status === 'not_found');
    const failed = entries.some((entry) => entry.status === 'error');
    if (!notFound && !failed) return null;
    return (
        <div
            role="alert"
            className={`${className} rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300`}
        >
            {notFound
                ? t(
                      'tasks.boardScope.notFound',
                      'A filter matches nothing you can see (deleted, not shared with you, or unknown); it is marked in red.'
                  )
                : t(
                      'tasks.boardScope.lookupFailed',
                      'Could not load some filters.'
                  )}
        </div>
    );
};

export default BoardScopeFilter;
