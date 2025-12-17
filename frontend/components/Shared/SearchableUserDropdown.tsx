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

interface SearchableUserDropdownProps {
    selectedUserId: number | null;
    onChange: (userId: number | null) => Promise<void>;
    disabled?: boolean;
    className?: string;
    excludeUserIds?: number[];
}

const SearchableUserDropdown: React.FC<SearchableUserDropdownProps> = ({
    selectedUserId,
    onChange,
    disabled = false,
    className = '',
    excludeUserIds = [],
}) => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
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

    // Get selected user object
    const selectedUser = useMemo(() => {
        return users.find((user) => user.id === selectedUserId);
    }, [users, selectedUserId]);

    // Get display name for a user
    const getUserDisplayName = (user: User) => {
        if (user.name || user.surname) {
            return `${user.name || ''} ${user.surname || ''}`.trim();
        }
        return user.email;
    };

    // Filter users based on search query and exclusions
    const filteredUsers = useMemo(() => {
        const excluded = users.filter(
            (user) => !excludeUserIds.includes(user.id)
        );

        if (!searchQuery.trim()) {
            return excluded;
        }

        const query = searchQuery.toLowerCase();
        return excluded.filter((user) => {
            const displayName = getUserDisplayName(user).toLowerCase();
            const email = user.email.toLowerCase();
            return displayName.includes(query) || email.includes(query);
        });
    }, [users, searchQuery, excludeUserIds]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setSearchQuery('');
                setHighlightedIndex(-1);
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

    // Reset highlighted index when dropdown state or filtered users change
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [isOpen, filteredUsers]);

    const handleSelect = async (userId: number | null) => {
        if (isSaving || disabled) return;

        setIsSaving(true);
        try {
            await onChange(userId);
            setIsOpen(false);
            setSearchQuery('');
            setHighlightedIndex(-1);
        } catch (error) {
            console.error('Error updating assignment:', error);
            // Keep dropdown open on error so user can try again
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) return;

        // Total items = 1 (unassigned option) + filtered users
        const totalItems = 1 + filteredUsers.length;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightedIndex((prev) =>
                prev < totalItems - 1 ? prev + 1 : prev
            );
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (highlightedIndex === -1) return;

            // Index 0 is "Unassigned", 1+ are users
            if (highlightedIndex === 0) {
                handleSelect(null);
            } else {
                const userIndex = highlightedIndex - 1;
                if (userIndex < filteredUsers.length) {
                    handleSelect(filteredUsers[userIndex].id);
                }
            }
        } else if (event.key === 'Escape') {
            event.preventDefault();
            setIsOpen(false);
            setSearchQuery('');
            setHighlightedIndex(-1);
        }
    };

    const renderUserAvatar = (user: User) => {
        if (user.avatar_image) {
            return (
                <img
                    src={getApiPath(user.avatar_image)}
                    alt={getUserDisplayName(user)}
                    className="h-8 w-8 rounded-full object-cover"
                />
            );
        }

        return (
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm">
                {(user.name?.[0] || user.email[0]).toUpperCase()}
            </div>
        );
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && !isSaving && setIsOpen(!isOpen)}
                disabled={disabled || isSaving || isLoadingUsers}
                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <div className="flex items-center min-w-0 flex-1">
                    {selectedUser ? (
                        <>
                            <div className="mr-2 flex-shrink-0">
                                {renderUserAvatar(selectedUser)}
                            </div>
                            <span className="truncate">
                                {getUserDisplayName(selectedUser)}
                            </span>
                        </>
                    ) : (
                        <span className="text-gray-500 dark:text-gray-400">
                            {isLoadingUsers
                                ? t('common.loading', 'Loading...')
                                : t('task.unassigned', 'Unassigned')}
                        </span>
                    )}
                </div>
                <ChevronDownIcon
                    className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${
                        isOpen ? 'transform rotate-180' : ''
                    }`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-80 overflow-hidden">
                    {/* Search Input */}
                    <div className="sticky top-0 p-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={t('task.searchUsers', 'Search users...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isSaving}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        />
                    </div>

                    {/* User List */}
                    <div className="overflow-y-auto max-h-64">
                        {isLoadingUsers ? (
                            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                {t('task.loadingUsers', 'Loading users...')}
                            </div>
                        ) : fetchError ? (
                            <div className="px-4 py-8 text-center">
                                <p className="text-red-600 dark:text-red-400 mb-2">
                                    {fetchError}
                                </p>
                                <button
                                    type="button"
                                    onClick={fetchUsers}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Unassigned Option */}
                                <button
                                    type="button"
                                    onClick={() => handleSelect(null)}
                                    disabled={isSaving}
                                    className={`w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 ${
                                        highlightedIndex === 0
                                            ? 'bg-blue-50 dark:bg-blue-900/30'
                                            : ''
                                    } ${
                                        selectedUserId === null
                                            ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                                            : 'text-gray-900 dark:text-gray-100'
                                    }`}
                                >
                                    <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                                        <UserIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                                    </div>
                                    <span className="flex-1">
                                        {t('task.unassigned', 'Unassigned')}
                                    </span>
                                    {selectedUserId === null && (
                                        <CheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                                    )}
                                </button>

                                {/* User List */}
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map((user, index) => {
                                        const itemIndex = index + 1; // +1 because 0 is "Unassigned"
                                        const isSelected =
                                            user.id === selectedUserId;

                                        return (
                                            <button
                                                key={user.id}
                                                type="button"
                                                onClick={() =>
                                                    handleSelect(user.id)
                                                }
                                                disabled={isSaving}
                                                className={`w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 ${
                                                    highlightedIndex ===
                                                    itemIndex
                                                        ? 'bg-blue-50 dark:bg-blue-900/30'
                                                        : ''
                                                } ${
                                                    isSelected
                                                        ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                                                        : 'text-gray-900 dark:text-gray-100'
                                                }`}
                                            >
                                                <div className="flex-shrink-0">
                                                    {renderUserAvatar(user)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">
                                                        {getUserDisplayName(
                                                            user
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                        {user.email}
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <CheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-300 flex-shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                        {t('task.noUsersFound', 'No users found')}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Saving Overlay */}
                    {isSaving && (
                        <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center">
                            <div className="text-gray-900 dark:text-gray-100">
                                {t('common.saving', 'Saving...')}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableUserDropdown;
