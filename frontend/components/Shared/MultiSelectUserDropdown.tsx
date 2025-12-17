import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronDownIcon,
    UserIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../../config/paths';

interface User {
    id: number;
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    avatar_image?: string;
}

interface MultiSelectUserDropdownProps {
    selectedUserIds: number[];
    includeUnassigned: boolean;
    onChange: (userIds: number[], includeUnassigned: boolean) => void;
    currentUserId: number | null;
    className?: string;
}

const MultiSelectUserDropdown: React.FC<MultiSelectUserDropdownProps> = ({
    selectedUserIds,
    includeUnassigned,
    onChange,
    currentUserId,
    className = '',
}) => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Fetch users on mount
    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setIsLoadingUsers(true);
            setFetchError(null);

            const response = await fetch(getApiPath('users'), {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }

            const data = await response.json();
            setUsers(data);
        } catch (err) {
            console.error('Error fetching users:', err);
            setFetchError('Failed to load users');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    // Get display name for a user
    const getUserDisplayName = (user: User) => {
        if (user.name || user.surname) {
            return `${user.name || ''} ${user.surname || ''}`.trim();
        }
        return user.email;
    };

    // Sort users: current user first, then alphabetically
    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => {
            // Current user always first
            if (currentUserId) {
                if (a.id === currentUserId) return -1;
                if (b.id === currentUserId) return 1;
            }

            // Then sort alphabetically by display name
            const nameA = getUserDisplayName(a).toLowerCase();
            const nameB = getUserDisplayName(b).toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }, [users, currentUserId]);

    // Filter users based on search query
    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) {
            return sortedUsers;
        }

        const query = searchQuery.toLowerCase();
        return sortedUsers.filter((user) => {
            const displayName = getUserDisplayName(user).toLowerCase();
            const email = user.email.toLowerCase();
            return displayName.includes(query) || email.includes(query);
        });
    }, [sortedUsers, searchQuery]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // Toggle user selection
    const handleUserToggle = (userId: number) => {
        const newSelectedIds = selectedUserIds.includes(userId)
            ? selectedUserIds.filter((id) => id !== userId)
            : [...selectedUserIds, userId];

        onChange(newSelectedIds, includeUnassigned);
    };

    // Toggle unassigned selection
    const handleUnassignedToggle = () => {
        onChange(selectedUserIds, !includeUnassigned);
    };

    // Clear all selections
    const handleClearAll = () => {
        onChange([], false);
    };

    // Check if there are active filters
    const hasActiveFilters = selectedUserIds.length > 0 || includeUnassigned;

    const renderUserAvatar = (user: User) => {
        if (user.avatar_image) {
            return (
                <img
                    src={getApiPath(user.avatar_image)}
                    alt={getUserDisplayName(user)}
                    className="h-6 w-6 rounded-full object-cover"
                />
            );
        }

        return (
            <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                {(user.name?.[0] || user.email[0]).toUpperCase()}
            </div>
        );
    };

    // Get label for trigger button
    const getTriggerLabel = () => {
        const totalSelected = selectedUserIds.length + (includeUnassigned ? 1 : 0);

        if (totalSelected === 0) {
            return t('task.allAssignees', 'All Assignees');
        } else if (totalSelected === 1) {
            return t('task.assigneeCount', '{{count}} Assignee', { count: 1 });
        } else {
            return t('task.assigneeCount_plural', '{{count}} Assignees', { count: totalSelected });
        }
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={isLoadingUsers}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <UserIcon className="h-4 w-4 mr-2" />
                <span>
                    {isLoadingUsers
                        ? t('common.loading', 'Loading...')
                        : getTriggerLabel()}
                </span>
                <ChevronDownIcon
                    className={`h-4 w-4 ml-2 transition-transform ${
                        isOpen ? 'transform rotate-180' : ''
                    }`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-96 overflow-hidden">
                    {/* Search Input */}
                    <div className="sticky top-0 p-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={t('task.searchUsers', 'Search users...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* User List */}
                    <div className="overflow-y-auto max-h-80">
                        {isLoadingUsers ? (
                            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                                {t('task.loadingUsers', 'Loading users...')}
                            </div>
                        ) : fetchError ? (
                            <div className="px-4 py-8 text-center">
                                <p className="text-red-600 dark:text-red-400 mb-2 text-sm">
                                    {fetchError}
                                </p>
                                <button
                                    type="button"
                                    onClick={fetchUsers}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {t('common.retry', 'Retry')}
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Unassigned Option */}
                                <label
                                    className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={includeUnassigned}
                                        onChange={handleUnassignedToggle}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                    />
                                    <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                                        <UserIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                    </div>
                                    <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
                                        {t('task.unassigned', 'Unassigned')}
                                    </span>
                                    {includeUnassigned && (
                                        <CheckIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    )}
                                </label>

                                {/* User List */}
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map((user) => {
                                        const isSelected = selectedUserIds.includes(user.id);
                                        const isCurrentUser = user.id === currentUserId;

                                        return (
                                            <label
                                                key={user.id}
                                                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleUserToggle(user.id)}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                />
                                                <div className="flex-shrink-0">
                                                    {renderUserAvatar(user)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                                            {getUserDisplayName(user)}
                                                        </span>
                                                        {isCurrentUser && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                                                {t('task.youLabel', 'You')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                        {user.email}
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <CheckIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                )}
                                            </label>
                                        );
                                    })
                                ) : (
                                    <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        {t('task.noUsersFound', 'No users found')}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Clear Button Footer - Only show when filters are active */}
                    {hasActiveFilters && !isLoadingUsers && !fetchError && (
                        <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2">
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium py-1"
                            >
                                {t('common.clear', 'Clear')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MultiSelectUserDropdown;
