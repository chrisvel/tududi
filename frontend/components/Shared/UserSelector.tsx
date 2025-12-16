import React, { useEffect, useState } from 'react';
import { getApiPath } from '../../config/paths';

interface User {
    id: number;
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    avatar_image?: string;
}

interface UserSelectorProps {
    selectedUserId: number | null;
    onChange: (userId: number | null) => void;
    excludeUserIds?: number[];
    placeholder?: string;
    allowClear?: boolean;
    className?: string;
}

const UserSelector: React.FC<UserSelectorProps> = ({
    selectedUserId,
    onChange,
    excludeUserIds = [],
    placeholder = 'Select user...',
    allowClear = true,
    className = '',
}) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError(null);

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
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(
        (user) => !excludeUserIds.includes(user.id)
    );

    const selectedUser = users.find((user) => user.id === selectedUserId);

    const getUserDisplayName = (user: User) => {
        if (user.name || user.surname) {
            return `${user.name || ''} ${user.surname || ''}`.trim();
        }
        return user.email;
    };

    return (
        <div className={`relative ${className}`}>
            <select
                value={selectedUserId || ''}
                onChange={(e) => {
                    const value = e.target.value;
                    onChange(value ? parseInt(value, 10) : null);
                }}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {allowClear && <option value="">{placeholder}</option>}

                {loading && <option value="">Loading users...</option>}

                {error && <option value="">Error loading users</option>}

                {!loading &&
                    !error &&
                    filteredUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                            {getUserDisplayName(user)}
                            {user.email !== getUserDisplayName(user) &&
                                ` (${user.email})`}
                        </option>
                    ))}
            </select>

            {selectedUser && (
                <div className="mt-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                    {selectedUser.avatar_image ? (
                        <img
                            src={selectedUser.avatar_image}
                            alt={getUserDisplayName(selectedUser)}
                            className="h-6 w-6 rounded-full mr-2"
                        />
                    ) : (
                        <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs mr-2">
                            {(
                                selectedUser.name?.[0] ||
                                selectedUser.email[0]
                            ).toUpperCase()}
                        </div>
                    )}
                    <span>{selectedUser.email}</span>
                </div>
            )}
        </div>
    );
};

export default UserSelector;
