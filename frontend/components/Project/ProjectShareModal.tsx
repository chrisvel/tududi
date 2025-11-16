import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../../entities/Project';
import {
    AccessLevel,
    grantShare,
    listShares,
    revokeShare,
} from '../../utils/sharesService';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { getCurrentUser } from '../../utils/userUtils';
import { getApiPath } from '../../config/paths';

interface ProjectShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
}

interface ShareRow {
    user_id: number;
    access_level: AccessLevel | 'owner';
    created_at: string | null;
    email?: string; // best-effort; may stay undefined without a lookup API
    is_owner?: boolean;
}

interface UserItem {
    id: number;
    email: string;
    name?: string;
    surname?: string;
    role: 'admin' | 'user';
}

const ProjectShareModal: React.FC<ProjectShareModalProps> = ({
    isOpen,
    onClose,
    project,
}) => {
    const { t } = useTranslation();
    const [selectedUserId, setSelectedUserId] = useState('');
    const [access, setAccess] = useState<AccessLevel>('ro');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<ShareRow[] | null>(null);
    const [loadingList, setLoadingList] = useState(false);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const userDropdownRef = useRef<HTMLDivElement>(null);
    const currentUser = getCurrentUser();

    const projectUid: string | null = useMemo(() => {
        // Prefer stable uid if present; fallback to id string if needed
        // Share APIs require resource_uid; projects list provides uid
        return (project as any).uid || null;
    }, [project]);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedUserId('');
        setAccess('ro');
        setError(null);
        setIsUserDropdownOpen(false);

        // Load users
        const loadUsers = async () => {
            setLoadingUsers(true);
            try {
                const res = await fetch(getApiPath('users'), {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) throw new Error('Failed to load users');
                const data = await res.json();
                // Filter out the current user from the list
                const filteredUsers = data.filter(
                    (user: UserItem) =>
                        currentUser && user.email !== currentUser.email
                );
                setUsers(filteredUsers);
            } catch (err: any) {
                setError(err.message || 'Failed to load users');
                setUsers([]);
            } finally {
                setLoadingUsers(false);
            }
        };
        loadUsers();

        if (!projectUid) return;
        const load = async () => {
            setLoadingList(true);
            try {
                const data = await listShares('project', projectUid);
                setRows(data);
            } catch (err: any) {
                setError(err.message || 'Failed to load shares');
                setRows([]);
            } finally {
                setLoadingList(false);
            }
        };
        load();
    }, [isOpen, projectUid]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                userDropdownRef.current &&
                !userDropdownRef.current.contains(event.target as Node)
            ) {
                setIsUserDropdownOpen(false);
            }
        };

        if (isUserDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isUserDropdownOpen]);

    // Filter out users who already have access
    const availableUsers = useMemo(() => {
        if (!rows) return users;

        const usersWithAccessIds = new Set(rows.map((row) => row.user_id));
        return users.filter((user) => !usersWithAccessIds.has(user.id));
    }, [users, rows]);

    if (!isOpen) return null;

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!projectUid) {
            setError(t('errors.generic', 'Something went wrong'));
            return;
        }
        if (!selectedUserId) {
            setError(t('errors.selectUser', 'Please select a user'));
            return;
        }

        const selectedUser = availableUsers.find(
            (u) => u.id.toString() === selectedUserId
        );
        if (!selectedUser) {
            setError(t('errors.userNotFound', 'User not found'));
            return;
        }

        setSubmitting(true);
        try {
            await grantShare({
                resource_type: 'project',
                resource_uid: projectUid,
                target_user_email: selectedUser.email,
                access_level: access,
            });
            setSelectedUserId('');
            // Refresh shares list - this will automatically update availableUsers via useMemo
            const data = await listShares('project', projectUid);
            setRows(data);
        } catch (err: any) {
            setError(err.message || 'Failed to share');
        } finally {
            setSubmitting(false);
        }
    };

    const onRevoke = async (userId: number) => {
        if (!projectUid) return;
        try {
            await revokeShare('project', projectUid, userId);
            // Refresh shares list - this will automatically update availableUsers via useMemo
            const data = await listShares('project', projectUid);
            setRows(data);
        } catch (err: any) {
            setError(err.message || 'Failed to revoke share');
        }
    };

    const accessLabel = (al: AccessLevel | 'owner') =>
        al === 'owner'
            ? t('shares.owner', 'Owner')
            : al === 'rw'
              ? t('shares.readWrite', 'Read & write')
              : t('shares.readOnly', 'Read only');

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-80"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {t('shares.shareProject', 'Share project')}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {project?.name}
                    </p>
                </div>
                <form onSubmit={onSubmit} className="px-6 py-4 space-y-4">
                    <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                            {t('shares.targetUser', 'Select user')}
                        </label>
                        <div className="relative" ref={userDropdownRef}>
                            <button
                                type="button"
                                className="w-full inline-flex justify-between items-center rounded border border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() =>
                                    !loadingUsers &&
                                    setIsUserDropdownOpen(!isUserDropdownOpen)
                                }
                                disabled={loadingUsers}
                            >
                                <span className="whitespace-nowrap truncate">
                                    {loadingUsers
                                        ? t('common.loading', 'Loading...')
                                        : selectedUserId
                                          ? (() => {
                                                const user =
                                                    availableUsers.find(
                                                        (u) =>
                                                            u.id.toString() ===
                                                            selectedUserId
                                                    );
                                                if (!user)
                                                    return t(
                                                        'shares.selectUserPlaceholder',
                                                        'Select a user...'
                                                    );
                                                return user.name && user.surname
                                                    ? `${user.name} ${user.surname}`
                                                    : user.name
                                                      ? user.name
                                                      : user.email;
                                            })()
                                          : t(
                                                'shares.selectUserPlaceholder',
                                                'Select a user...'
                                            )}
                                </span>
                                <ChevronDownIcon
                                    className={`h-4 w-4 text-gray-500 dark:text-gray-300 transition-transform ${
                                        isUserDropdownOpen ? 'rotate-180' : ''
                                    }`}
                                />
                            </button>
                            {isUserDropdownOpen && (
                                <div className="absolute mt-1 w-full rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none z-50 max-h-60 overflow-auto">
                                    <div className="p-1">
                                        {availableUsers.length === 0 ? (
                                            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                                                {t(
                                                    'shares.noAvailableUsers',
                                                    'No users available to share with'
                                                )}
                                            </div>
                                        ) : (
                                            availableUsers.map((user) => {
                                                const displayName =
                                                    user.name && user.surname
                                                        ? `${user.name} ${user.surname}`
                                                        : user.name
                                                          ? user.name
                                                          : user.email;
                                                const isSelected =
                                                    selectedUserId ===
                                                    user.id.toString();

                                                return (
                                                    <button
                                                        key={user.id}
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedUserId(
                                                                user.id.toString()
                                                            );
                                                            setIsUserDropdownOpen(
                                                                false
                                                            );
                                                        }}
                                                        className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-gray-900 dark:text-gray-100 font-medium truncate">
                                                                    {
                                                                        displayName
                                                                    }
                                                                </div>
                                                                <div className="text-gray-500 dark:text-gray-400 text-xs truncate">
                                                                    {user.email}
                                                                </div>
                                                            </div>
                                                            {isSelected && (
                                                                <CheckIcon className="h-4 w-4 ml-2 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                            {t('shares.permission', 'Permission')}
                        </label>
                        <select
                            value={access}
                            onChange={(e) =>
                                setAccess(e.target.value as AccessLevel)
                            }
                            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                        >
                            <option value="ro">
                                {t('shares.readOnly', 'Read only')}
                            </option>
                            <option value="rw">
                                {t('shares.readWrite', 'Read & write')}
                            </option>
                        </select>
                    </div>
                    {error && (
                        <div className="text-sm text-red-500">{error}</div>
                    )}
                    <div className="flex justify-end space-x-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        >
                            {t('common.close', 'Close')}
                        </button>
                        <button
                            type="submit"
                            disabled={
                                submitting || !selectedUserId || loadingUsers
                            }
                            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
                        >
                            {submitting
                                ? t('common.saving', 'Saving...')
                                : t('shares.share', 'Share')}
                        </button>
                    </div>
                </form>
                <div className="px-6 pb-5">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('shares.currentShares', 'Users with access')}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md max-h-56 overflow-auto">
                        {loadingList ? (
                            <div className="p-3 text-sm text-gray-500">
                                {t('common.loading', 'Loading...')}
                            </div>
                        ) : !rows || rows.length === 0 ? (
                            <div className="p-3 text-sm text-gray-500">
                                {t('shares.noShares', 'Not shared yet')}
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                {rows.map((r) => (
                                    <li
                                        key={`${r.user_id}-${r.created_at || 'owner'}`}
                                        className="flex items-center justify-between px-3 py-2"
                                    >
                                        <div>
                                            <div
                                                className={`text-sm ${r.is_owner ? 'font-semibold' : ''} text-gray-900 dark:text-gray-100`}
                                            >
                                                {r.email || `#${r.user_id}`}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {accessLabel(r.access_level)}
                                            </div>
                                        </div>
                                        {r.is_owner ? (
                                            <span className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 border border-blue-200 dark:bg-transparent dark:text-blue-400 dark:border-blue-500">
                                                {t('shares.owner', 'Owner')}
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() =>
                                                    onRevoke(r.user_id)
                                                }
                                                className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-transparent dark:text-red-400 dark:border-red-500"
                                            >
                                                {t('shares.revoke', 'Revoke')}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectShareModal;
