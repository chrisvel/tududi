import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserIcon } from '@heroicons/react/24/outline';
import { Person } from '../../entities/Person';

const RELATIONSHIP_LABELS: Record<string, string> = {
    family: 'Family',
    work: 'Work',
    friend: 'Friend',
    other: 'Other',
};

interface PersonRowProps {
    person: Person;
}

// One person in a list, the same row as the goal, area and tag lists. Their
// color shows as a left border. The root is meant to sit inside a task-sheet
// list.
const PersonRow: React.FC<PersonRowProps> = ({ person }) => {
    const { t } = useTranslation();
    const isMember = person.kind === 'member';

    const kindLabel = isMember
        ? person.account_status === 'no_sign_in'
            ? t('people.memberNoSignIn', "Member, can't sign in yet")
            : t('people.member', 'Member')
        : RELATIONSHIP_LABELS[person.relationship_type ?? 'other'];

    return (
        <div
            className="flex items-center gap-4 -ml-1.5 py-2.5 pl-5 pr-2 border-l-4 border-gray-300 dark:border-gray-600"
            style={{ borderLeftColor: person.color || undefined }}
        >
            <Link
                to={`/person/${person.uid}`}
                className="flex flex-1 min-w-0 items-center gap-2"
            >
                <h4 className="text-[15px] font-normal tracking-tight text-gray-900 dark:text-gray-100 truncate">
                    {person.name}
                </h4>
                {person.linked_user_id != null && (
                    <UserIcon
                        className="h-3.5 w-3.5 flex-shrink-0 text-blue-500 dark:text-blue-400"
                        title={t(
                            'people.linkedAccount',
                            'Linked to a user account'
                        )}
                    />
                )}
                {person.email && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {person.email}
                    </span>
                )}
                {person.archived && (
                    <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {t('people.archivedBadge', 'archived')}
                    </span>
                )}
            </Link>

            <div className="hidden md:flex items-center text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                <span>{kindLabel}</span>
            </div>
        </div>
    );
};

export default PersonRow;
