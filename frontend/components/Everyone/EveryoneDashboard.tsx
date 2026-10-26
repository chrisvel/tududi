import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchEveryone } from '../../utils/everyoneService';
import { fetchGroups, GroupSummary } from '../../utils/groupsService';
import PeopleBoard from './PeopleBoard';

const EveryoneDashboard: React.FC = () => {
    const { t } = useTranslation();
    const [groups, setGroups] = useState<GroupSummary[]>([]);

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

    return (
        <PeopleBoard
            fetchBoard={fetchBoard}
            heading={heading}
            testId="everyone-dashboard"
            headerExtra={
                groups.length > 0 && (
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
                )
            }
            emptyMessage={t(
                'everyone.empty',
                'Nothing shared is on right now. Share an area, project or goal, or assign someone a task, to see it here.'
            )}
        />
    );
};

export default EveryoneDashboard;
