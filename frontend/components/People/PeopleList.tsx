import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    EllipsisVerticalIcon,
    PlusIcon,
    EnvelopeIcon,
    UserIcon,
} from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import PersonModal from './PersonModal';
import { Person } from '../../entities/Person';
import { fetchPeople, createPerson, updatePerson, deletePerson } from '../../utils/peopleService';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { useCan } from '../../hooks/useCan';
import { useStore } from '../../store/useStore';
import MemberModal from './MemberModal';
import { CreatedMember } from '../../utils/membersService';

type PeopleFilter = 'all' | 'members' | 'contacts';

const RELATIONSHIP_LABELS: Record<string, string> = {
    family: 'Family',
    work: 'Work',
    friend: 'Friend',
    other: 'Other',
};

const PeopleList: React.FC = () => {
    const { showSuccessToast, showErrorToast } = useToast();
    const [people, setPeople] = useState<Person[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
    const { t } = useTranslation();
    const canCreatePeople = useCan('create_people');
    const canInvite = useCan('invite_members');
    const [filter, setFilter] = useState<PeopleFilter>('all');
    const [memberModal, setMemberModal] = useState<{ open: boolean; person: Person | null }>({
        open: false,
        person: null,
    });
    const justOpenedRef = useRef<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (justOpenedRef.current) {
                justOpenedRef.current = false;
                return;
            }
            const clickedElement = event.target as Node;
            if (dropdownRef.current && !dropdownRef.current.contains(clickedElement)) {
                setDropdownOpen(null);
            }
        };

        if (dropdownOpen !== null) {
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

    const handleSave = async (data: Partial<Person>) => {
        if (editingPerson?.uid) {
            const result = await updatePerson(editingPerson.uid, data);
            setPeople((prev) => prev.map((p) => (p.uid === editingPerson.uid ? result.person : p)));
            showSuccessToast('Person updated');
        } else {
            const result = await createPerson(data as any);
            setPeople((prev) => [...prev, result.person].sort((a, b) => a.name.localeCompare(b.name)));
            showSuccessToast('Person created');
        }
    };

    const handleArchive = async (person: Person) => {
        try {
            const result = await updatePerson(person.uid!, { archived: !person.archived });
            setPeople((prev) => prev.map((p) => (p.uid === person.uid ? result.person : p)));
            showSuccessToast(person.archived ? 'Person unarchived' : 'Person archived');
        } catch (err: unknown) {
            showErrorToast(err instanceof Error ? err.message : 'Failed to archive person');
        }
    };

    const handleDelete = async () => {
        if (!personToDelete) return;
        try {
            await deletePerson(personToDelete.uid!);
            setPeople((prev) => prev.filter((p) => p.uid !== personToDelete.uid));
            showSuccessToast('Person deleted');
        } catch (err: unknown) {
            showErrorToast(err instanceof Error ? err.message : 'Failed to delete person');
        } finally {
            setIsConfirmDialogOpen(false);
            setPersonToDelete(null);
        }
    };

    const openCreate = () => {
        setEditingPerson(null);
        setModalOpen(true);
    };

    const openEdit = (person: Person) => {
        setEditingPerson(person);
        setModalOpen(true);
    };

    const openDeleteConfirm = (person: Person) => {
        setPersonToDelete(person);
        setIsConfirmDialogOpen(true);
    };

    const visiblePeople = people.filter((p) => !p.archived);
    const memberCount = visiblePeople.filter((p) => p.kind === 'member').length;
    const contactCount = visiblePeople.length - memberCount;
    const displayPeople = visiblePeople.filter((p) =>
        filter === 'all' ? true : filter === 'members' ? p.kind === 'member' : p.kind !== 'member'
    );

    const openMember = (person: Person | null = null) => setMemberModal({ open: true, person });

    // A new member shows up in the list and in every assignee list.
    const handleMemberCreated = async (member: CreatedMember) => {
        showSuccessToast(
            member.invited && member.email_sent
                ? t('people.memberInvited', 'Invitation sent to {{email}}', { email: member.email })
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
        groupedPeople[letter].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    });

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-light">People</h2>
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

                <div role="tablist" className="flex space-x-6 border-b border-gray-200 dark:border-gray-700 mb-6" data-testid="people-filters">
                    {([
                        ['all', t('people.filterAll', 'All'), visiblePeople.length],
                        ['members', t('people.filterMembers', 'Members'), memberCount],
                        ['contacts', t('people.filterContacts', 'Contacts'), contactCount],
                    ] as [PeopleFilter, string, number][]).map(([id, label, count]) => (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={filter === id}
                            data-testid={`people-filter-${id}`}
                            onClick={() => setFilter(id)}
                            className={`-mb-px pb-3 text-sm font-medium border-b-2 focus:outline-none transition-colors ${
                                filter === id
                                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            {label} <span className="text-xs">{count}</span>
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="text-center py-12 text-gray-400 dark:text-gray-500">Loading...</div>
                ) : displayPeople.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            No people yet. Add family, colleagues, or friends.
                        </p>
                        <button
                            onClick={openCreate}
                            className="mt-4 text-blue-600 dark:text-blue-400 text-sm hover:underline"
                        >
                            Add your first person
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {sortedGroupKeys.map((letter) => (
                            <div key={letter}>
                                <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                                    {letter}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {groupedPeople[letter].map((person) => (
                                        <Link
                                            key={person.uid}
                                            to={`/person/${person.uid}`}
                                            className={`rounded-xl shadow-sm relative flex flex-col group hover:shadow-md transition-shadow cursor-pointer ${
                                                !person.color
                                                    ? 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                                                    : ''
                                            } ${dropdownOpen === person.uid ? 'z-50' : ''}`}
                                            style={person.color ? { backgroundColor: person.color } : {}}
                                        >
                                            {/* Three-dot dropdown */}
                                            {person.can_edit !== false && (
                                            <div className="absolute top-2 right-2 z-10" ref={dropdownRef}>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const next = dropdownOpen === person.uid ? null : person.uid!;
                                                        if (next !== null) justOpenedRef.current = true;
                                                        setDropdownOpen(next);
                                                    }}
                                                    aria-label={t('people.actions', 'Person actions')}
                                                    data-testid={`person-menu-${person.uid}`}
                                                    className={`flex items-center justify-center w-6 h-6 rounded focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
                                                        person.color
                                                            ? 'text-white/60 hover:text-white hover:bg-white/20'
                                                            : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                                    }`}
                                                >
                                                    <EllipsisVerticalIcon className="h-4 w-4" />
                                                </button>
                                                {dropdownOpen === person.uid && (
                                                    <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60]">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                openEdit(person);
                                                                setDropdownOpen(null);
                                                            }}
                                                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-t-md"
                                                        >
                                                            Edit
                                                        </button>
                                                        {person.kind !== 'member' && canInvite && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    openMember(person);
                                                                    setDropdownOpen(null);
                                                                }}
                                                                data-testid={`give-account-${person.uid}`}
                                                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                                            >
                                                                {t('people.giveAccount', 'Give account')}
                                                            </button>
                                                        )}
                                                        {person.kind !== 'member' && (
                                                            <>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleArchive(person);
                                                                setDropdownOpen(null);
                                                            }}
                                                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                                        >
                                                            {person.archived ? 'Unarchive' : 'Archive'}
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                openDeleteConfirm(person);
                                                                setDropdownOpen(null);
                                                            }}
                                                            className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-b-md"
                                                        >
                                                            Delete
                                                        </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            )}

                                            {/* Name */}
                                            <div className="px-5 pt-6 pb-4 flex-1 flex items-center justify-center text-center">
                                                <div>
                                                    <h4 className={`text-sm font-semibold tracking-widest uppercase line-clamp-2 ${
                                                        person.color ? 'text-white' : 'text-gray-800 dark:text-gray-100'
                                                    }`}>
                                                        {person.name}
                                                        {person.linked_user_id != null && (
                                                            <span
                                                                className={`inline-flex items-center ml-1.5 align-middle ${
                                                                    person.color ? 'text-white/70' : 'text-blue-500 dark:text-blue-400'
                                                                }`}
                                                                title="Linked to a user account"
                                                            >
                                                                <UserIcon className="h-3 w-3" />
                                                            </span>
                                                        )}
                                                    </h4>
                                                    {person.archived && (
                                                        <span className={`mt-1 inline-block text-[10px] uppercase tracking-wide ${
                                                            person.color ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'
                                                        }`}>
                                                            archived
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Footer */}
                                            <div className={`rounded-b-xl flex items-stretch divide-x ${
                                                person.color
                                                    ? 'bg-black/20 divide-white/10'
                                                    : 'bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-600 divide-gray-200 dark:divide-gray-600'
                                            }`}>
                                                <div className="flex-1 flex flex-col items-center py-2 gap-0.5">
                                                    <span className={`text-[10px] leading-none uppercase tracking-wide ${
                                                        person.color ? 'text-white/55' : 'text-gray-400 dark:text-gray-500'
                                                    }`}>
                                                        {person.kind === 'member'
                                                            ? person.account_status === 'no_sign_in'
                                                                ? t('people.memberNoSignIn', "Member, can't sign in yet")
                                                                : t('people.member', 'Member')
                                                            : RELATIONSHIP_LABELS[person.relationship_type ?? 'other']}
                                                    </span>
                                                </div>
                                                {person.email && (
                                                    <div className="flex-1 flex flex-col items-center py-2 gap-0.5 overflow-hidden">
                                                        <span className={`flex items-center gap-1 text-[10px] leading-none truncate max-w-full px-2 ${
                                                            person.color ? 'text-white/55' : 'text-gray-400 dark:text-gray-500'
                                                        }`}>
                                                            <EnvelopeIcon className="h-3 w-3 flex-shrink-0" />
                                                            <span className="truncate">{person.email.split('@')[0]}</span>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
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
                        onClose={() => setMemberModal({ open: false, person: null })}
                    />
                )}

                {isConfirmDialogOpen && personToDelete && (
                    <ConfirmDialog
                        title="Delete Person"
                        message={`Are you sure you want to delete "${personToDelete.name}"? This cannot be undone.`}
                        onConfirm={handleDelete}
                        onCancel={() => {
                            setIsConfirmDialogOpen(false);
                            setPersonToDelete(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default PeopleList;
