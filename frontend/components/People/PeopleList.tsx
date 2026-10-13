import React, { useEffect, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import PersonModal from './PersonModal';
import PersonRow from './PersonRow';
import { TASK_SHEET_CLASS } from '../Task/taskSheet';
import { Person } from '../../entities/Person';
import {
    fetchPeople,
    createPerson,
    updatePerson,
} from '../../utils/peopleService';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { useCan } from '../../hooks/useCan';
import { useStore } from '../../store/useStore';
import MemberModal from './MemberModal';
import TrialLockNotice from '../Billing/TrialLockNotice';
import { useTrialLock } from '../../hooks/useTrialStatus';
import { CreatedMember } from '../../utils/membersService';

type PeopleFilter = 'all' | 'members' | 'contacts';

const PeopleList: React.FC = () => {
    const { showSuccessToast, showErrorToast } = useToast();
    const [people, setPeople] = useState<Person[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const { t } = useTranslation();
    const canCreatePeople = useCan('create_people');
    const membersLocked = useTrialLock('members');
    const canInvite = useCan('invite_members') && !membersLocked;
    const [filter, setFilter] = useState<PeopleFilter>('all');
    const [memberModal, setMemberModal] = useState<{
        open: boolean;
        person: Person | null;
    }>({
        open: false,
        person: null,
    });

    const load = async () => {
        setIsLoading(true);
        try {
            const all = await fetchPeople({ archived: false } as any);
            setPeople(all);
        } catch {
            showErrorToast('Failed to load people');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleSave = async (data: Partial<Person>) => {
        if (editingPerson?.uid) {
            const result = await updatePerson(editingPerson.uid, data);
            setPeople((prev) =>
                prev.map((p) =>
                    p.uid === editingPerson.uid ? result.person : p
                )
            );
            showSuccessToast('Person updated');
        } else {
            const result = await createPerson(data as any);
            setPeople((prev) =>
                [...prev, result.person].sort((a, b) =>
                    a.name.localeCompare(b.name)
                )
            );
            showSuccessToast('Person created');
        }
    };

    const openCreate = () => {
        setEditingPerson(null);
        setModalOpen(true);
    };

    const visiblePeople = people.filter((p) => !p.archived);
    const memberCount = visiblePeople.filter((p) => p.kind === 'member').length;
    const contactCount = visiblePeople.length - memberCount;
    const displayPeople = visiblePeople.filter((p) =>
        filter === 'all'
            ? true
            : filter === 'members'
              ? p.kind === 'member'
              : p.kind !== 'member'
    );

    const openMember = (person: Person | null = null) =>
        setMemberModal({ open: true, person });

    // A new member shows up in the list and in every assignee list.
    const handleMemberCreated = async (member: CreatedMember) => {
        showSuccessToast(
            member.invited && member.email_sent
                ? t('people.memberInvited', 'Invitation sent to {{email}}', {
                      email: member.email,
                  })
                : t('people.memberAdded', 'Member added')
        );
        await load();
        useStore.getState().peopleStore.loadPeople(true);
    };

    const groupedPeople = displayPeople.reduce(
        (groups, person) => {
            const firstLetter = person.name.charAt(0).toUpperCase();
            if (!groups[firstLetter]) groups[firstLetter] = [];
            groups[firstLetter].push(person);
            return groups;
        },
        {} as Record<string, Person[]>
    );

    const sortedGroupKeys = Object.keys(groupedPeople).sort();
    sortedGroupKeys.forEach((letter) => {
        groupedPeople[letter].sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );
    });

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
            <div className="w-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-light">
                        {t('people.title', 'People')}
                    </h2>
                    <div className="flex items-center gap-2">
                        {canInvite && (
                            <button
                                onClick={() => openMember()}
                                data-testid="add-member-button"
                                className="flex items-center gap-1.5 px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 text-sm rounded-md hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                <PlusIcon className="w-4 h-4" />
                                {t('people.addMember', 'Add member')}
                            </button>
                        )}
                        {canCreatePeople && (
                            <button
                                onClick={openCreate}
                                data-testid="add-contact-button"
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                            >
                                <PlusIcon className="w-4 h-4" />
                                {t('people.newContact', 'New contact')}
                            </button>
                        )}
                    </div>
                </div>

                <TrialLockNotice feature="members" className="mb-6" />
                <div
                    role="tablist"
                    className="mb-4 flex items-center min-h-[2.5rem] gap-4 sm:gap-6 pl-2 sm:pl-3"
                    data-testid="people-filters"
                >
                    {(
                        [
                            [
                                'all',
                                t('people.filterAll', 'All'),
                                visiblePeople.length,
                            ],
                            [
                                'members',
                                t('people.filterMembers', 'Members'),
                                memberCount,
                            ],
                            [
                                'contacts',
                                t('people.filterContacts', 'Contacts'),
                                contactCount,
                            ],
                        ] as [PeopleFilter, string, number][]
                    ).map(([id, label, count]) => (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={filter === id}
                            data-testid={`people-filter-${id}`}
                            onClick={() => setFilter(id)}
                            className={`relative flex items-center self-stretch py-2.5 text-sm font-medium transition-colors ${
                                filter === id
                                    ? 'text-gray-900 dark:text-gray-100 after:absolute after:bottom-0 after:left-px after:right-px after:h-0.5 after:rounded-full after:bg-gray-900 dark:after:bg-gray-100'
                                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            {label} ({count})
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                        {t('common.loading', 'Loading...')}
                    </div>
                ) : displayPeople.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            {t(
                                'people.empty',
                                'No people yet. Add family, colleagues, or friends.'
                            )}
                        </p>
                        <button
                            onClick={openCreate}
                            className="mt-4 text-blue-600 dark:text-blue-400 text-sm hover:underline"
                        >
                            {t('people.addFirst', 'Add your first person')}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {sortedGroupKeys.map((letter) => (
                            <div key={letter}>
                                <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                                    {letter}
                                </h3>
                                <div
                                    className={`task-list-container overflow-visible ${TASK_SHEET_CLASS} task-sheet-rails`}
                                >
                                    {groupedPeople[letter].map((person) => (
                                        <div key={person.uid}>
                                            <PersonRow person={person} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {modalOpen && (
                    <PersonModal
                        person={editingPerson}
                        onSave={handleSave}
                        onClose={() => setModalOpen(false)}
                    />
                )}

                {memberModal.open && (
                    <MemberModal
                        person={memberModal.person}
                        onCreated={handleMemberCreated}
                        onClose={() =>
                            setMemberModal({ open: false, person: null })
                        }
                    />
                )}
            </div>
        </div>
    );
};

export default PeopleList;
