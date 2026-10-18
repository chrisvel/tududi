import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    fetchGroupPage,
    GroupPage as GroupPageData,
} from '../../utils/groupsService';
import PeopleBoard from '../Everyone/PeopleBoard';

const GroupPage: React.FC = () => {
    const { t } = useTranslation();
    const { uid = '' } = useParams<{ uid: string }>();
    const fetchBoard = useCallback(() => fetchGroupPage(uid), [uid]);
    const heading = useCallback(
        (data: GroupPageData | null) => ({
            title: data?.group.name ?? t('groupPage.title', 'Group'),
            subtitle:
                data?.group.description ||
                t('groupPage.subtitle', 'What each member has on now'),
        }),
        [t]
    );

    return (
        <PeopleBoard
            key={uid}
            fetchBoard={fetchBoard}
            heading={heading}
            testId="group-page"
            emptyMessage={t(
                'groupPage.empty',
                'Nothing is assigned to this group yet. Assign a task to a member to see it here.'
            )}
        />
    );
};

export default GroupPage;
