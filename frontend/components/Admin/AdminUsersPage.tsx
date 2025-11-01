import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    ChevronDownIcon,
    CheckIcon,
    PencilIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { useToast } from '../Shared/ToastContext';

interface AdminUserItem {
    id: number;
    email: string;
    name?: string;
    surname?: string;
    created_at: string;
    role: 'admin' | 'user';
}

const fetchAdminUsers = async (t: any): Promise<AdminUserItem[]> => {
    const res = await fetch('/api/admin/users', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (res.status === 401)
        throw new Error(
            t('admin.authenticationRequired', 'Authentication required')
        );
    if (res.status === 403) throw new Error(t('admin.forbidden', 'Forbidden'));
    if (!res.ok)
        throw new Error(t('admin.failedToLoadUsers', 'Failed to load users'));
    return await res.json();
};

const createAdminUser = async (
    email: string,
    password: string,
    t: any,
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
    if (res.status === 401)
        throw new Error(
            t('admin.authenticationRequired', 'Authentication required')
        );
    if (res.status === 403) throw new Error(t('admin.forbidden', 'Forbidden'));
    if (res.status === 409)
        throw new Error(t('admin.emailAlreadyExists', 'Email already exists'));
    if (!res.ok) {
        let message = t('admin.failedToCreateUser', 'Failed to create user');
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

const updateAdminUser = async (
    id: number,
    email: string,
    t: any,
    name?: string,
    surname?: string,
    role?: 'admin' | 'user',
    password?: string
): Promise<AdminUserItem> => {
    const body: any = { email, name, surname, role };
    if (password) body.password = password;

    const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error(
            t('admin.authenticationRequired', 'Authentication required')
        );
    if (res.status === 403) throw new Error(t('admin.forbidden', 'Forbidden'));
    if (res.status === 409)
        throw new Error(t('admin.emailAlreadyExists', 'Email already exists'));
    if (res.status === 404)
        throw new Error(t('admin.userNotFound', 'User not found'));
    if (!res.ok) {
        let message = t('admin.failedToUpdateUser', 'Failed to update user');
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

const deleteAdminUser = async (id: number, t: any): Promise<void> => {
    const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (res.status === 401)
        throw new Error(
            t('admin.authenticationRequired', 'Authentication required')
        );
    if (res.status === 403) throw new Error(t('admin.forbidden', 'Forbidden'));
    if (res.status === 400) {
        const body = await res
            .json()
            .catch(() => ({ error: t('admin.badRequest', 'Bad request') }));
        throw new Error(body.error || t('admin.badRequest', 'Bad request'));
    }
    if (res.status === 404)
        throw new Error(t('admin.userNotFound', 'User not found'));
    if (!res.ok && res.status !== 204)
        throw new Error(t('admin.failedToDeleteUser', 'Failed to delete user'));
};

const AddUserModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreated: (user: AdminUserItem) => void;
    onUpdated: (user: AdminUserItem) => void;
    editingUser?: AdminUserItem | null;
}> = ({ isOpen, onClose, onCreated, onUpdated, editingUser }) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');
    const [role, setRole] = useState<'user' | 'admin'>('user');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const roleDropdownRef = useRef<HTMLDivElement>(null);

    const isValidEmail = (value: string) => {
        // Simple email format validation
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    };

    useEffect(() => {
        if (isOpen) {
            if (editingUser) {
                setEmail(editingUser.email);
                setPassword('');
                setName(editingUser.name || '');
                setSurname(editingUser.surname || '');
                setRole(editingUser.role);
            } else {
                setEmail('');
                setPassword('');
                setName('');
                setSurname('');
                setRole('user');
            }
            setError(null);
            setIsRoleDropdownOpen(false);
        }
    }, [isOpen, editingUser]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                roleDropdownRef.current &&
                !roleDropdownRef.current.contains(event.target as Node)
            ) {
                setIsRoleDropdownOpen(false);
            }
        };

        if (isRoleDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isRoleDropdownOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!email) {
            setError(t('errors.required', 'This field is required'));
            return;
        }
        if (!isValidEmail(email)) {
            setError(t('errors.invalidEmail', 'Invalid email address'));
            return;
        }
        // Password is required for new users, optional for updates
        if (!editingUser && !password) {
            setError(t('errors.required', 'This field is required'));
            return;
        }
        setSubmitting(true);
        try {
            if (editingUser) {
                const user = await updateAdminUser(
                    editingUser.id,
                    email,
                    t,
                    name,
                    surname,
                    role,
                    password || undefined
                );
                onUpdated(user);
            } else {
                const user = await createAdminUser(
                    email,
                    password,
                    t,
                    name,
                    surname,
                    role
                );
                onCreated(user);
            }
            onClose();
        } catch (err: any) {
            setError(
                err.message ||
                    (editingUser
                        ? t('admin.failedToUpdateUser', 'Failed to update user')
                        : t(
                              'admin.failedToCreateUser',
                              'Failed to create user'
                          ))
            );
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
                    {editingUser
                        ? t('admin.editUser', 'Edit user')
                        : t('admin.addUser', 'Add user')}
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
                            {editingUser && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                    (
                                    {t(
                                        'admin.passwordOptional',
                                        'Leave blank to keep current'
                                    )}
                                    )
                                </span>
                            )}
                        </label>
                        <input
                            type="password"
                            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required={!editingUser}
                            minLength={6}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                            {t('admin.role', 'Role')}
                        </label>
                        <div className="relative" ref={roleDropdownRef}>
                            <button
                                type="button"
                                className="w-full inline-flex justify-between items-center rounded border border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                onClick={() =>
                                    setIsRoleDropdownOpen(!isRoleDropdownOpen)
                                }
                            >
                                <span>
                                    {role === 'admin'
                                        ? t('admin.admin', 'admin')
                                        : t('admin.user', 'user')}
                                </span>
                                <ChevronDownIcon
                                    className={`h-4 w-4 text-gray-500 dark:text-gray-300 transition-transform ${
                                        isRoleDropdownOpen ? 'rotate-180' : ''
                                    }`}
                                />
                            </button>
                            {isRoleDropdownOpen && (
                                <div className="absolute mt-1 w-full rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none z-50">
                                    <div className="p-1">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRole('user');
                                                setIsRoleDropdownOpen(false);
                                            }}
                                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-900 dark:text-gray-100">
                                                    {t('admin.user', 'user')}
                                                </span>
                                                {role === 'user' && (
                                                    <CheckIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                )}
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRole('admin');
                                                setIsRoleDropdownOpen(false);
                                            }}
                                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-900 dark:text-gray-100">
                                                    {t('admin.admin', 'admin')}
                                                </span>
                                                {role === 'admin' && (
                                                    <CheckIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
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
                                : editingUser
                                  ? t('common.save', 'Save')
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
    const { showSuccessToast, showErrorToast } = useToast();
    const [users, setUsers] = useState<AdminUserItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [addOpen, setAddOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
    const [userToDelete, setUserToDelete] = useState<AdminUserItem | null>(
        null
    );
    const [registrationEnabled, setRegistrationEnabled] = useState(false);
    const [togglingRegistration, setTogglingRegistration] = useState(false);
    const navigate = useNavigate();

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAdminUsers(t);
            setUsers(data);
        } catch (err: any) {
            setError(
                err.message ||
                    t('admin.failedToLoadUsers', 'Failed to load users')
            );
            if (err.message === t('admin.forbidden', 'Forbidden'))
                navigate('/today');
        } finally {
            setLoading(false);
        }
    };

    const fetchRegistrationStatus = async () => {
        try {
            const response = await fetch('/api/registration-status');
            const data = await response.json();
            setRegistrationEnabled(data.enabled);
        } catch (err) {
            console.error('Error fetching registration status:', err);
        }
    };

    const toggleRegistration = async () => {
        setTogglingRegistration(true);
        const previousStatus = registrationEnabled;
        try {
            const newStatus = !registrationEnabled;
            const response = await fetch('/api/admin/toggle-registration', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ enabled: newStatus }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error || 'Failed to toggle registration'
                );
            }

            const data = await response.json();
            setRegistrationEnabled(data.enabled);

            // Show success toast
            if (data.enabled) {
                showSuccessToast(
                    t(
                        'admin.registrationEnabledSuccess',
                        'Registration has been enabled'
                    )
                );
            } else {
                showSuccessToast(
                    t(
                        'admin.registrationDisabledSuccess',
                        'Registration has been disabled'
                    )
                );
            }
        } catch (err: any) {
            // Revert state on error
            setRegistrationEnabled(previousStatus);
            const errorMessage = err.message || 'Failed to toggle registration';
            setError(errorMessage);
            showErrorToast(errorMessage);
        } finally {
            setTogglingRegistration(false);
        }
    };

    useEffect(() => {
        load();
        fetchRegistrationStatus();
    }, []);

    const handleDeleteUser = async () => {
        if (!userToDelete) return;

        try {
            await deleteAdminUser(userToDelete.id, t);
            setUsers((prev) =>
                prev ? prev.filter((u) => u.id !== userToDelete.id) : null
            );
            setUserToDelete(null);
        } catch (err: any) {
            setError(
                err.message ||
                    t('admin.failedToDeleteUser', 'Failed to delete user')
            );
            setUserToDelete(null);
        }
    };

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl space-y-6">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-light">
                        {t('admin.userManagement', 'User Management')}
                    </h2>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={toggleRegistration}
                            disabled={togglingRegistration}
                            className={`px-4 py-2 rounded-md focus:outline-none transition duration-150 ease-in-out text-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                                registrationEnabled
                                    ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600'
                                    : 'bg-gray-600 text-white hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600'
                            }`}
                            title={
                                registrationEnabled
                                    ? t(
                                          'admin.registrationEnabled',
                                          'Registration is enabled. Click to disable.'
                                      )
                                    : t(
                                          'admin.registrationDisabled',
                                          'Registration is disabled. Click to enable.'
                                      )
                            }
                        >
                            {togglingRegistration
                                ? t('common.loading', 'Loading...')
                                : registrationEnabled
                                  ? t(
                                        'admin.disableRegistration',
                                        'Disable Registration'
                                    )
                                  : t(
                                        'admin.enableRegistration',
                                        'Enable Registration'
                                    )}
                        </button>
                        <button
                            onClick={() => {
                                setEditingUser(null);
                                setAddOpen(true);
                            }}
                            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm"
                        >
                            {t('admin.addUser', 'Add user')}
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
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.actions', 'Actions')}
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
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingUser(u);
                                                        setAddOpen(true);
                                                    }}
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
                                                        setUserToDelete(u)
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

                <AddUserModal
                    isOpen={addOpen}
                    onClose={() => {
                        setAddOpen(false);
                        setEditingUser(null);
                    }}
                    onCreated={(user) =>
                        setUsers((prev) => (prev ? [user, ...prev] : [user]))
                    }
                    onUpdated={(user) =>
                        setUsers((prev) =>
                            prev
                                ? prev.map((u) => (u.id === user.id ? user : u))
                                : [user]
                        )
                    }
                    editingUser={editingUser}
                />

                {userToDelete && (
                    <ConfirmDialog
                        title={t('admin.deleteUser', 'Delete User')}
                        message={t(
                            'admin.confirmDeleteUser',
                            'Are you sure you want to delete {{email}}? This action cannot be undone.',
                            { email: userToDelete.email }
                        )}
                        onConfirm={handleDeleteUser}
                        onCancel={() => setUserToDelete(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default AdminUsersPage;
