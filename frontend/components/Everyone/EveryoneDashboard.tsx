import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchEveryone } from '../../utils/everyoneService';
import { fetchGroups, GroupSummary } from '../../utils/groupsService';
import { UsersIcon } from '@heroicons/react/24/outline';
import PeopleBoard from './PeopleBoard';
import EveryoneTimeline from './EveryoneTimeline';

type EveryoneView = 'board' | 'timeline';
const VIEW_KEY = 'everyone_view';

const EveryoneDashboard: React.FC = () => {
    const { t } = useTranslation();
    const [groups, setGroups] = useState<GroupSummary[]>([]);
    const [view, setView] = useState<EveryoneView>(() => {
        try {
            return localStorage.getItem(VIEW_KEY) === 'timeline'
                ? 'timeline'
                : 'board';
        } catch {
            return 'board';
        }
    });
    const changeView = (next: EveryoneView) => {
        setView(next);
        try {
            localStorage.setItem(VIEW_KEY, next);
        } catch {
            // Only a convenience
        }
    };

    useEffect(() => {
        fetchGroups()
            .then((all) => setGroups(all.filter((g) => g.is_member)))
            .catch(() => setGroups([]));
    }, []);

    const fetchBoard = useCallback(() => fetchEveryone(), []);
    const heading = useCallback(
        () => ({
            title: t('everyone.title', 'Everyone'),
            subtitle: t(
                'everyone.subtitle',
                'What everyone you share work with has on now'
            ),
        }),
        [t]
    );

    const viewSwitch = (
        <div
            role="group"
            aria-label={t('everyoneTimeline.view', 'View')}
            className="flex rounded-lg bg-gray-200/70 p-0.5 dark:bg-gray-800"
        >
            {(['board', 'timeline'] as EveryoneView[]).map((v) => (
                <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    data-testid={`everyone-view-${v}`}
                    onClick={() => changeView(v)}
                    className={`rounded-md px-3 py-1 text-sm ${
                        view === v
                            ? 'bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                            : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
                    }`}
                >
                    {v === 'board'
                        ? t('everyoneTimeline.board', 'Board')
                        : t('projectTimeline.title', 'Timeline')}
                </button>
            ))}
        </div>
    );

    const groupLinks = groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-xs text-gray-400 dark:text-gray-500">
                {t('groupPage.yourGroups', 'Your groups')}
            </span>
            {groups.map((g) => (
                <Link
                    key={g.uid}
                    to={`/groups/${g.uid}`}
                    className="rounded-full bg-white px-2.5 py-0.5 text-xs text-gray-700 hover:bg-gray-100 dark:bg-gray-900/60 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                    {g.name}
                </Link>
            ))}
        </div>
    );

    if (view === 'timeline') {
        return (
            <EveryoneTimeline
                header={
                    <header className="shrink-0 pt-4 pb-5">
                        <div className="flex items-center gap-2">
                            <UsersIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                {t('everyone.title', 'Everyone')}
                            </h1>
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {t(
                                'everyoneTimeline.subtitle',
                                'Who is doing what over the coming weeks'
                            )}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                            {viewSwitch}
                            {groupLinks}
                        </div>
                    </header>
                }
            />
        );
    }

    return (
        <PeopleBoard
            fetchBoard={fetchBoard}
            heading={heading}
            testId="everyone-dashboard"
            headerExtra={
                <>
                    {viewSwitch}
                    {groupLinks}
                </>
            }
            emptyMessage={t(
                'everyone.empty',
                'Nothing shared is on right now. Share an area, project or goal, or assign someone a task, to see it here.'
            )}
        />
    );
};

export default EveryoneDashboard;
