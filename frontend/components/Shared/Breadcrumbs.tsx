import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { useStore } from '../../store/useStore';
import { createUidSlug, extractUidFromSlug } from '../../utils/slugUtils';

interface Crumb {
    label: string;
    to?: string;
}

// The slug part of a uid-slug URL, as readable words. Used when the
// entity isn't in the store yet.
const labelFromSlug = (uidSlug: string): string => {
    const uid = extractUidFromSlug(uidSlug);
    const words = uidSlug
        .slice(uid.length)
        .replace(/^-/, '')
        .replace(/-/g, ' ');
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
};

const Breadcrumbs: React.FC = () => {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const areas = useStore((s) => s.areasStore.areas);
    const projects = useStore((s) => s.projectsStore.projects);
    const tags = useStore((s) => s.tagsStore.tags);
    const notes = useStore((s) => s.notesStore.notes);
    const goals = useStore((s) => s.goalsStore.goals);
    const people = useStore((s) => s.peopleStore.people);
    const habits = useStore((s) => s.habitsStore.habits);
    const tasks = useStore((s) => s.tasksStore.tasks);

    const [, section, param] = pathname.split('/');
    if (!section || !param) return null;

    const uid = extractUidFromSlug(param);
    // Entities link their area by uid or by numeric id, depending on
    // which endpoint loaded them.
    const areaCrumbs = (
        areaUid?: string | null,
        areaId?: number | null
    ): Crumb[] => {
        const area = areas.find(
            (a) => (areaUid && a.uid === areaUid) || (areaId && a.id === areaId)
        );
        if (!area?.uid) return [];
        return [
            { label: t('sidebar.areas', 'Areas'), to: '/areas' },
            {
                label: area.name,
                to: `/area/${createUidSlug(area.uid, area.name)}`,
            },
        ];
    };

    let crumbs: Crumb[] = [];
    switch (section) {
        case 'area': {
            const area = areas.find((a) => a.uid === uid);
            crumbs = [
                { label: t('sidebar.areas', 'Areas'), to: '/areas' },
                { label: area?.name || labelFromSlug(param) },
            ];
            break;
        }
        case 'project': {
            const project = projects.find((p) => p.uid === uid);
            const parents = areaCrumbs(
                project?.area_uid ?? project?.area?.uid,
                project?.area_id ?? project?.area?.id
            );
            crumbs = [
                ...(parents.length
                    ? parents
                    : [
                          {
                              label: t('sidebar.projects', 'Projects'),
                              to: '/projects',
                          },
                      ]),
                { label: project?.name || labelFromSlug(param) },
            ];
            break;
        }
        case 'goal': {
            const goal = goals.find((g) => g.uid === uid);
            const parents = areaCrumbs(
                goal?.Area?.uid,
                goal?.area_id ?? goal?.Area?.id
            );
            crumbs = [
                ...(parents.length
                    ? parents
                    : [{ label: t('sidebar.goals', 'Goals'), to: '/goals' }]),
                { label: goal?.title || labelFromSlug(param) },
            ];
            break;
        }
        case 'task': {
            const task = tasks.find((x) => x.uid === uid);
            const project = task?.project_uid
                ? projects.find((p) => p.uid === task.project_uid)
                : undefined;
            crumbs = [
                project?.uid
                    ? {
                          label: project.name,
                          to: `/project/${createUidSlug(project.uid, project.name)}`,
                      }
                    : { label: t('sidebar.tasks', 'Tasks'), to: '/tasks' },
                { label: task?.name || '' },
            ];
            break;
        }
        case 'tag': {
            const tag = tags.find((x) => x.uid === uid);
            crumbs = [
                { label: t('sidebar.tags', 'Tags'), to: '/tags' },
                { label: tag?.name || labelFromSlug(param) },
            ];
            break;
        }
        case 'note':
        case 'notes': {
            const note = notes.find((n) => n.uid === uid);
            crumbs = [
                { label: t('sidebar.notes', 'Notes'), to: '/notes' },
                { label: note?.title || labelFromSlug(param) },
            ];
            break;
        }
        case 'habit': {
            const habit = habits.find((h) => h.uid === uid);
            crumbs = [
                { label: t('sidebar.habits', 'Habits'), to: '/habits' },
                { label: habit?.name || '' },
            ];
            break;
        }
        case 'person': {
            const person = people.find((p) => p.uid === uid);
            crumbs = [
                { label: t('sidebar.people', 'People'), to: '/people' },
                { label: person?.name || '' },
            ];
            break;
        }
        case 'views':
            crumbs = [{ label: t('sidebar.views', 'Views'), to: '/views' }];
            break;
        default:
            return null;
    }

    crumbs = crumbs.filter((c) => c.label);
    if (crumbs.length === 0) return null;

    return (
        <nav
            aria-label={t('common.breadcrumb', 'Breadcrumb')}
            className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2"
        >
            <ol className="flex items-center gap-1 min-w-0 text-xs text-gray-500 dark:text-gray-400">
                {crumbs.map((crumb, index) => {
                    const isLast = index === crumbs.length - 1;
                    return (
                        <li
                            key={`${index}-${crumb.label}`}
                            className={`flex items-center gap-1 ${isLast ? 'min-w-0' : 'flex-shrink-0'}`}
                        >
                            {crumb.to ? (
                                <Link
                                    to={crumb.to}
                                    className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                                >
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span
                                    className="truncate font-medium text-gray-700 dark:text-gray-200"
                                    aria-current={isLast ? 'page' : undefined}
                                >
                                    {crumb.label}
                                </span>
                            )}
                            {!isLast && (
                                <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Breadcrumbs;
