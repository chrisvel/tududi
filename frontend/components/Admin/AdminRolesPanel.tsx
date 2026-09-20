import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, MinusIcon } from '@heroicons/react/24/outline';
import {
    CAPABILITY_IDS,
    RoleId,
    RoleSummary,
    RolesOverview,
} from '../../entities/Role';
import {
    capabilityHint,
    capabilityName,
    roleDescription,
    roleName,
} from './roleLabels';

interface AdminRolesPanelProps {
    overview: RolesOverview | null;
    loading: boolean;
    error: string | null;
}

const headerCell =
    'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider align-top';

const Allowed: React.FC<{ allowed: boolean; label: string }> = ({
    allowed,
    label,
}) => (
    <span
        className="inline-flex"
        role="img"
        aria-label={label}
        data-allowed={allowed}
    >
        {allowed ? (
            <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
        ) : (
            <MinusIcon className="h-5 w-5 text-gray-300 dark:text-gray-600" />
        )}
    </span>
);

const AdminRolesPanel: React.FC<AdminRolesPanelProps> = ({
    overview,
    loading,
    error,
}) => {
    const { t } = useTranslation();

    const roles: RoleSummary[] = overview?.roles ?? [];
    const allowedLabel = t('admin.roles.allowed', 'Allowed');
    const notAllowedLabel = t('admin.roles.notAllowed', 'Not allowed');

    const cell = (allowed: boolean) => (
        <Allowed
            allowed={allowed}
            label={allowed ? allowedLabel : notAllowedLabel}
        />
    );

    return (
        <div className="w-full space-y-6" data-testid="admin-roles-panel">
            <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(
                    'admin.roles.intro',
                    'Every account has one role. A role decides what an account can create and manage. The roles are fixed for now. You can give one user more or fewer permissions from the Users tab.'
                )}
            </p>

            {error && (
                <div
                    role="alert"
                    className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                >
                    {error}
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            <th className={headerCell}>
                                {t('admin.roles.permission', 'Permission')}
                            </th>
                            {roles.map((role) => (
                                <th
                                    key={role.id}
                                    className={headerCell}
                                    data-testid={`role-column-${role.id}`}
                                >
                                    <div className="text-gray-900 dark:text-gray-100 normal-case text-sm font-semibold">
                                        {roleName(t, role.id)}
                                    </div>
                                    <div
                                        className="mt-1 normal-case font-normal tracking-normal text-xs"
                                        data-testid={`role-members-${role.id}`}
                                        data-count={role.member_count}
                                    >
                                        {t(
                                            'admin.roles.memberCount',
                                            '{{count}} accounts',
                                            { count: role.member_count }
                                        )}
                                    </div>
                                    <div className="mt-2 normal-case font-normal tracking-normal text-xs max-w-[16rem]">
                                        {roleDescription(t, role.id)}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {loading && (
                            <tr>
                                <td
                                    colSpan={roles.length + 1 || 4}
                                    className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                                >
                                    {t(
                                        'admin.roles.loading',
                                        'Loading roles...'
                                    )}
                                </td>
                            </tr>
                        )}
                        {!loading && roles.length > 0 && (
                            <>
                                <tr data-testid="role-row-manage_accounts">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {t(
                                                'admin.roles.manageAccounts',
                                                'Manage users, roles and groups'
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {t(
                                                'admin.roles.manageAccountsHint',
                                                'Create and remove accounts, change roles, manage groups'
                                            )}
                                        </div>
                                    </td>
                                    {roles.map((role) => (
                                        <td key={role.id} className="px-6 py-4">
                                            {cell(role.id === 'admin')}
                                        </td>
                                    ))}
                                </tr>
                                {CAPABILITY_IDS.map((capability) => (
                                    <tr
                                        key={capability}
                                        data-testid={`role-row-${capability}`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {capabilityName(t, capability)}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {capabilityHint(t, capability)}
                                            </div>
                                        </td>
                                        {roles.map((role) => (
                                            <td
                                                key={role.id}
                                                className="px-6 py-4"
                                                data-testid={`role-cell-${capability}-${role.id as RoleId}`}
                                            >
                                                {cell(
                                                    role.capabilities[
                                                        capability
                                                    ] === true
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminRolesPanel;
