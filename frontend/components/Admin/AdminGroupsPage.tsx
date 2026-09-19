import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    PencilIcon,
    TrashIcon,
    UserPlusIcon,
} from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { useToast } from '../Shared/ToastContext';
import {
    AdminGroup,
    AdminGroupDetail,
    UserOption,
    addGroupMembers,
    createAdminGroup,
    deleteAdminGroup,
    fetchAdminGroup,
    fetchAdminGroups,
    fetchUserOptions,
    removeGroupMember,
    updateAdminGroup,
} from '../../utils/groupsService';

const MAX_SUGGESTIONS = 8;

const displayName = (user: {
    name?: string | null;
    surname?: string | null;
    email: string;
}) => [user.name, user.surname].filter(Boolean).join(' ') || user.email;

interface GroupModalProps {
    group: AdminGroup | null;
    onClose: () => void;
    onSaved: (group: AdminGroup, isNew: boolean) => void;
}

const GroupModal: React.FC<GroupModalProps> = ({ group, onClose, onSaved }) => {
    const { t } = useTranslation();
    const [name, setName] = useState(group?.name ?? '');
    const [description, setDescription] = useState(group?.description ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
            setError(t('admin.groups.nameRequired', 'Enter a group name'));
            return;
        }
        setSaving(true);
        try {
            const input = {
                name: name.trim(),
                description: description.trim() || null,
            };
            const saved = group
                ? await updateAdminGroup(group.uid, input)
                : await createAdminGroup(input);
            onSaved(saved, !group);
        } catch (err: any) {
            setError(
                err.message ||
                    t('admin.groups.failedToSave', 'Failed to save group')
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-80"
            onClick={onClose}
        >
            <form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
                data-testid="group-modal"
            >
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {group
                            ? t('admin.groups.editGroup', 'Edit group')
                            : t('admin.groups.addGroup', 'Add group')}
                    </h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                    <div>
                        <label
                            htmlFor="group-name"
                            className="block text-sm text-gray-700 dark:text-gray-300 mb-1"
                        >
                            {t('admin.groups.name', 'Name')}
                        </label>
                        <input
                            id="group-name"
                            type="text"
                            maxLength={100}
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="group-description"
                            className="block text-sm text-gray-700 dark:text-gray-300 mb-1"
                        >
                            {t('admin.groups.description', 'Description')}
                        </label>
                        <textarea
                            id="group-description"
                            rows={3}
                            maxLength={500}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    {error && (
                        <div className="text-sm text-red-500" role="alert">
                            {error}
                        </div>
                    )}
                </div>
                <div className="flex justify-end space-x-2 px-6 pb-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
                    >
                        {saving
                            ? t('common.saving', 'Saving...')
                            : t('common.save', 'Save')}
                    </button>
                </div>
            </form>
        </div>
    );
};

interface MembersModalProps {
    group: AdminGroup;
    onClose: () => void;
    onChanged: () => void;
}

const MembersModal: React.FC<MembersModalProps> = ({
    group,
    onClose,
    onChanged,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [detail, setDetail] = useState<AdminGroupDetail | null>(null);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        try {
            const [groupDetail, userList] = await Promise.all([
                fetchAdminGroup(group.uid),
                fetchUserOptions(),
            ]);
            setDetail(groupDetail);
            setUsers(userList);
        } catch (err: any) {
            setError(
                err.message ||
                    t('admin.groups.failedToLoad', 'Failed to load group')
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [group.uid]);

    const memberIds = useMemo(
        () => new Set((detail?.members ?? []).map((m) => m.user_id)),
        [detail]
    );

    const suggestions = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return users
            .filter((u) => !memberIds.has(u.id))
            .filter(
                (u) =>
                    !needle ||
                    u.email.toLowerCase().includes(needle) ||
                    displayName(u).toLowerCase().includes(needle)
            )
            .slice(0, MAX_SUGGESTIONS);
    }, [users, memberIds, query]);

    const add = async (user: UserOption) => {
        try {
            await addGroupMembers(group.uid, [user.id]);
            showSuccessToast(
                t('admin.groups.memberAdded', '{{name}} added to the group', {
                    name: displayName(user),
                })
            );
            await load();
            onChanged();
        } catch (err: any) {
            showErrorToast(
                err.message ||
                    t('admin.groups.failedToAddMember', 'Failed to add member')
            );
        }
    };

    const remove = async (userId: number, label: string) => {
        try {
            await removeGroupMember(group.uid, userId);
            showSuccessToast(
                t(
                    'admin.groups.memberRemoved',
                    '{{name}} removed from the group',
                    { name: label }
                )
            );
            await load();
            onChanged();
        } catch (err: any) {
            showErrorToast(
                err.message ||
                    t(
                        'admin.groups.failedToRemoveMember',
                        'Failed to remove member'
                    )
            );
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-80"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto"
                data-testid="group-members-modal"
            >
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {t('admin.groups.membersTitle', 'Members of {{name}}', {
                            name: group.name,
                        })}
                    </h3>
                </div>
                <div className="px-6 py-4 space-y-5">
                    {error && (
                        <div className="text-sm text-red-500" role="alert">
                            {error}
                        </div>
                    )}
                    {loading ? (
                        <div className="text-sm text-gray-500">
                            {t('common.loading', 'Loading...')}
                        </div>
                    ) : (
                        <>
                            <div>
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('admin.groups.members', 'Members')} (
                                    {detail?.members.length ?? 0})
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md max-h-48 overflow-auto">
                                    {detail && detail.members.length > 0 ? (
                                        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {detail.members.map((m) => (
                                                <li
                                                    key={m.user_id}
                                                    className="flex items-center justify-between px-3 py-2"
                                                    data-testid={`group-member-${m.user_id}`}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                                            {displayName(m)}
                                                        </div>
                                                        <div className="text-xs text-gray-500 truncate">
                                                            {m.email}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            remove(
                                                                m.user_id,
                                                                displayName(m)
                                                            )
                                                        }
                                                        className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-transparent dark:text-red-400 dark:border-red-500"
                                                    >
                                                        {t(
                                                            'admin.groups.removeMember',
                                                            'Remove'
                                                        )}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="p-3 text-sm text-gray-500">
                                            {t(
                                                'admin.groups.noMembers',
                                                'No members yet'
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="group-member-search"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                                >
                                    {t(
                                        'admin.groups.addMembers',
                                        'Add members'
                                    )}
                                </label>
                                <input
                                    id="group-member-search"
                                    type="search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={t(
                                        'admin.groups.searchUsers',
                                        'Search by name or email'
                                    )}
                                    className="w-full rounded border px-3 py-2 mb-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md">
                                    {suggestions.length > 0 ? (
                                        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {suggestions.map((u) => (
                                                <li
                                                    key={u.id}
                                                    className="flex items-center justify-between px-3 py-2"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                                            {displayName(u)}
                                                        </div>
                                                        <div className="text-xs text-gray-500 truncate">
                                                            {u.email}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => add(u)}
                                                        data-testid={`group-add-member-${u.id}`}
                                                        className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 dark:bg-transparent dark:text-blue-400 dark:border-blue-500"
                                                    >
                                                        {t(
                                                            'admin.groups.addMember',
                                                            'Add'
                                                        )}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="p-3 text-sm text-gray-500">
                                            {t(
                                                'admin.groups.noUsersToAdd',
                                                'No matching users to add'
                                            )}
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    {t(
                                        'admin.groups.memberInviteHint',
                                        'New members are invited to everything already shared with this group.'
                                    )}
                                </p>
                            </div>

                            {detail && detail.shares.length > 0 && (
                                <div>
                                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t(
                                            'admin.groups.sharedWith',
                                            'Shared with this group'
                                        )}
                                    </div>
                                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                        {detail.shares.map((s) => (
                                            <li
                                                key={`${s.resource_type}-${s.resource_uid}`}
                                            >
                                                <span className="uppercase text-xs text-gray-400 mr-2">
                                                    {s.resource_type}
                                                </span>
                                                {s.resource_name ||
                                                    s.resource_uid}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="flex justify-end px-6 pb-5">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                        {t('common.close', 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdminGroupsPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showSuccessToast, showErrorToast } = useToast();
    const [groups, setGroups] = useState<AdminGroup[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<AdminGroup | null>(null);
    const [creating, setCreating] = useState(false);
    const [managing, setManaging] = useState<AdminGroup | null>(null);
    const [toDelete, setToDelete] = useState<AdminGroup | null>(null);

    const load = async () => {
        setError(null);
        try {
            setGroups(await fetchAdminGroups());
        } catch (err: any) {
            setError(
                err.message ||
                    t('admin.groups.failedToLoadList', 'Failed to load groups')
            );
            if (err.message === 'Forbidden') navigate('/today');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleSaved = async (group: AdminGroup, isNew: boolean) => {
        setCreating(false);
        setEditing(null);
        showSuccessToast(
            isNew
                ? t('admin.groups.created', 'Group created')
                : t('admin.groups.updated', 'Group updated')
        );
        await load();
        if (isNew) setManaging(group);
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        try {
            await deleteAdminGroup(toDelete.uid);
            showSuccessToast(t('admin.groups.deleted', 'Group deleted'));
            // Members lose access that came through the group.
            window.dispatchEvent(new CustomEvent('collaboratorsChanged'));
            await load();
        } catch (err: any) {
            showErrorToast(
                err.message ||
                    t('admin.groups.failedToDelete', 'Failed to delete group')
            );
        } finally {
            setToDelete(null);
        }
    };

    const headerCell =
        'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider';

    return (
        <div
            className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8"
            data-testid="admin-groups-page"
        >
            <div className="w-full space-y-6">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-light">
                        {t('admin.groups.title', 'Groups')}
                    </h2>
                    <button
                        onClick={() => setCreating(true)}
                        data-testid="add-group-button"
                        className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm"
                    >
                        {t('admin.groups.addGroup', 'Add group')}
                    </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {t(
                        'admin.groups.intro',
                        'Groups let people share a project, area, goal, note or task with several users at once. Members are invited to everything shared with the group.'
                    )}
                </p>

                {error && (
                    <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                        {error}
                    </div>
                )}

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className={headerCell}>
                                    {t('admin.groups.name', 'Name')}
                                </th>
                                <th className={headerCell}>
                                    {t('admin.groups.members', 'Members')}
                                </th>
                                <th className={headerCell}>
                                    {t('admin.groups.shares', 'Shared items')}
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.actions', 'Actions')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {loading && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                                    >
                                        {t(
                                            'admin.groups.loading',
                                            'Loading groups...'
                                        )}
                                    </td>
                                </tr>
                            )}
                            {!loading && groups && groups.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                                        data-testid="groups-empty"
                                    >
                                        {t(
                                            'admin.groups.empty',
                                            'No groups yet. Create one to start sharing with several people at once.'
                                        )}
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                groups &&
                                groups.map((g) => (
                                    <tr
                                        key={g.uid}
                                        data-testid={`group-row-${g.uid}`}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                                    >
                                        <td className="px-6 py-4 text-sm">
                                            <div className="font-medium text-gray-900 dark:text-gray-100">
                                                {g.name}
                                            </div>
                                            {g.description && (
                                                <div className="text-gray-500 dark:text-gray-400 line-clamp-1">
                                                    {g.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {g.member_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {g.share_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-3">
                                                <button
                                                    onClick={() =>
                                                        setManaging(g)
                                                    }
                                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                                    title={t(
                                                        'admin.groups.manageMembers',
                                                        'Manage members'
                                                    )}
                                                >
                                                    <UserPlusIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setEditing(g)
                                                    }
                                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                                    title={t(
                                                        'common.edit',
                                                        'Edit'
                                                    )}
                                                >
                                                    <PencilIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setToDelete(g)
                                                    }
                                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                    title={t(
                                                        'common.delete',
                                                        'Delete'
                                                    )}
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                {(creating || editing) && (
                    <GroupModal
                        group={editing}
                        onClose={() => {
                            setCreating(false);
                            setEditing(null);
                        }}
                        onSaved={handleSaved}
                    />
                )}

                {managing && (
                    <MembersModal
                        group={managing}
                        onClose={() => setManaging(null)}
                        onChanged={load}
                    />
                )}

                {toDelete && (
                    <ConfirmDialog
                        title={t('admin.groups.deleteGroup', 'Delete group')}
                        message={t(
                            'admin.groups.confirmDelete',
                            'Delete "{{name}}"? Members lose the access they got through this group. Projects and other items shared with it are not deleted.',
                            { name: toDelete.name }
                        )}
                        onConfirm={handleDelete}
                        onCancel={() => setToDelete(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default AdminGroupsPage;
