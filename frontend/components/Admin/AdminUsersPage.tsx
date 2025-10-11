import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserPlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface AdminUserItem {
    id: number;
    email: string;
    name?: string;
    surname?: string;
    created_at: string;
    role: 'admin' | 'user';
}

const fetchAdminUsers = async (): Promise<AdminUserItem[]> => {
    const res = await fetch('/api/admin/users', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (res.status === 401) throw new Error('Authentication required');
    if (res.status === 403) throw new Error('Forbidden');
    if (!res.ok) throw new Error('Failed to load users');
    return await res.json();
};

const createAdminUser = async (
    email: string,
    password: string,
    name?: string,
    surname?: string,
    role?: 'admin' | 'user'
): Promise<AdminUserItem> => {
    const res = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ email, password, name, surname, role }),
    });
    if (res.status === 401) throw new Error('Authentication required');
    if (res.status === 403) throw new Error('Forbidden');
    if (res.status === 409) throw new Error('Email already exists');
    if (!res.ok) {
        let message = 'Failed to create user';
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore non-JSON error bodies
        }
        throw new Error(message);
    }
    return await res.json();
};

const deleteAdminUser = async (id: number): Promise<void> => {
    const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (res.status === 401) throw new Error('Authentication required');
    if (res.status === 403) throw new Error('Forbidden');
    if (res.status === 400) {
        const body = await res.json().catch(() => ({ error: 'Bad request' }));
        throw new Error(body.error || 'Bad request');
    }
    if (res.status === 404) throw new Error('User not found');
    if (!res.ok && res.status !== 204) throw new Error('Failed to delete user');
};

const AddUserModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreated: (user: AdminUserItem) => void;
}> = ({ isOpen, onClose, onCreated }) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');
    const [role, setRole] = useState<'user' | 'admin'>('user');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isValidEmail = (value: string) => {
        // Simple email format validation
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    };

    useEffect(() => {
        if (isOpen) {
            setEmail('');
            setPassword('');
            setName('');
            setSurname('');
            setRole('user');
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!email || !password) {
            setError(t('errors.required', 'This field is required'));
            return;
        }
        if (!isValidEmail(email)) {
            setError(t('errors.invalidEmail', 'Invalid email address'));
            return;
        }
        setSubmitting(true);
        try {
            const user = await createAdminUser(email, password, name, surname, role);
            onCreated(user);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to create user');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('admin.addUser', 'Add user')}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                            {t('admin.email', 'Email')}
                        </label>
                        <input
                            type="email"
                            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                            {t('admin.name', 'Name')}
                        </label>
                        <input
                            type="text"
                            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                            {t('admin.surname', 'Surname')}
                        </label>
                        <input
                            type="text"
                            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            value={surname}
                            onChange={(e) => setSurname(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                            {t('admin.password', 'Password')}
                        </label>
                        <input
                            type="password"
                            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                            {t('admin.role', 'Role')}
                        </label>
                        <select
                            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            value={role}
                            onChange={(e) => setRole(e.target.value as any)}
                        >
                            <option value="user">
                                {t('admin.user', 'user')}
                            </option>
                            <option value="admin">
                                {t('admin.admin', 'admin')}
                            </option>
                        </select>
                    </div>
                    {error && (
                        <div className="text-sm text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}
                    <div className="flex justify-end space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none transition duration-150 ease-in-out text-sm"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {submitting
                                ? t('common.saving', 'Saving...')
                                : t('common.create', 'Create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AdminUsersPage: React.FC = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<AdminUserItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [addOpen, setAddOpen] = useState(false);
    const navigate = useNavigate();

    const selectedCount = selectedIds.size;

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAdminUsers();
            setUsers(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load users');
            if (err.message === 'Forbidden') navigate('/today');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (!users) return;
        setSelectedIds((prev) => {
            if (prev.size === users.length) return new Set();
            return new Set(users.map((u) => u.id));
        });
    };

    const removeSelected = async () => {
        if (!users || selectedIds.size === 0) return;
        const toDelete = Array.from(selectedIds);
        const remaining: AdminUserItem[] = [];
        const byId = new Map(users.map((u) => [u.id, u] as const));
        for (const id of toDelete) {
            try {
                await deleteAdminUser(id);
            } catch (err: any) {
                // Keep the user if deletion failed and surface error inline later
                console.error('Failed to delete user', id, err?.message);
                remaining.push(byId.get(id)!);
            }
        }
        const next = users.filter((u) => !toDelete.includes(u.id));
        // If any failed, keep them
        const nextWithFailures = remaining.length
            ? next.concat(
                  remaining.filter((r) => !next.find((n) => n.id === r.id))
              )
            : next;
        setUsers(nextWithFailures);
        setSelectedIds(new Set());
    };

    const headerCheckboxChecked = useMemo(() => {
        if (!users || users.length === 0) return false;
        return selectedIds.size === users.length;
    }, [users, selectedIds]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {t('admin.userManagement', 'User Management')}
                </h1>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setAddOpen(true)}
                        className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm"
                    >
                        <UserPlusIcon className="h-5 w-5 mr-2" />
                        {t('admin.addUser', 'Add user')}
                    </button>
                    <button
                        onClick={removeSelected}
                        disabled={selectedCount === 0}
                        className="inline-flex items-center px-4 py-2 rounded-md border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition duration-150 ease-in-out text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <TrashIcon className="h-5 w-5 mr-2" />
                        {t('admin.remove', 'Remove')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                    {error}
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                <input
                                    type="checkbox"
                                    checked={headerCheckboxChecked}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-2 bg-white dark:bg-gray-700"
                                />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('admin.email', 'Email')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('admin.name', 'Name')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('admin.surname', 'Surname')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('admin.created', 'Created')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('admin.role', 'Role')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {loading && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                                >
                                    {t(
                                        'admin.loadingUsers',
                                        'Loading users...'
                                    )}
                                </td>
                            </tr>
                        )}
                        {!loading && users && users.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                                >
                                    {t('admin.noUsers', 'No users')}
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            users &&
                            users.map((u) => (
                                <tr
                                    key={u.id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(u.id)}
                                            onChange={() => toggleSelect(u.id)}
                                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-2 bg-white dark:bg-gray-700"
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {u.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {u.name || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {u.surname || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {new Date(
                                            u.created_at
                                        ).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}
                                        >
                                            {u.role === 'admin'
                                                ? t('admin.admin', 'admin')
                                                : t('admin.user', 'user')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            <AddUserModal
                isOpen={addOpen}
                onClose={() => setAddOpen(false)}
                onCreated={(user) =>
                    setUsers((prev) => (prev ? [user, ...prev] : [user]))
                }
            />
        </div>
    );
};

export default AdminUsersPage;
