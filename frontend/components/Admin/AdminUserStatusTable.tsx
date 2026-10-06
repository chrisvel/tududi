import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiPath } from '../../config/paths';
import { handleAuthResponse } from '../../utils/authUtils';
import {
    ADMIN_TABLE_WRAPPER,
    SortHeader,
    useSortedRows,
} from './SortableTable';

export interface AdminUserStatus {
    id: number;
    email: string | null;
    name: string | null;
    created_at: string;
    email_verified: boolean;
    account_status: 'active' | 'invited' | 'no_sign_in';
    is_admin: boolean;
    member_of: { id: number; email: string | null } | null;
    // trial, subscription, grace, override, admin, member, free, or
    // self_hosted when the instance sells nothing
    access: string;
    trial_ends_at: string | null;
    trial_days_left: number | null;
    read_only_until: string | null;
    paid: boolean;
    subscription_status: string | null;
    ever_paid: boolean;
}

const BADGE = 'inline-flex px-2 py-0.5 rounded-full text-xs font-medium';
const TONE = {
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

const cell = 'px-4 py-2 whitespace-nowrap';
const headerCell = 'px-4 py-2 text-left font-medium';

// Who is on the instance and where each of them stands: signed up or added
// as a member, verified, on the trial and for how long, and paying.
const AdminUserStatusTable: React.FC = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<AdminUserStatus[] | null>(null);
    const [hosted, setHosted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(getApiPath('admin/overview/users'), {
                    credentials: 'include',
                });
                await handleAuthResponse(res, 'Failed to load users.');
                const data = await res.json();
                setUsers(data.users);
                setHosted(!!data.hosted);
            } catch (err: any) {
                setError(err.message || 'Could not load users');
            }
        };
        load();
    }, []);

    const statusOf = (u: AdminUserStatus): { label: string; tone: string } => {
        switch (u.access) {
            case 'trial':
                return {
                    label: t('admin.userStatus.trial', 'Trial'),
                    tone: TONE.blue,
                };
            case 'subscription':
                return {
                    label: t('admin.userStatus.subscribed', 'Subscribed'),
                    tone: TONE.green,
                };
            case 'grace':
                return {
                    label: t('admin.userStatus.pastDue', 'Past due'),
                    tone: TONE.amber,
                };
            case 'override':
                return {
                    label: t('admin.userStatus.comped', 'Comped'),
                    tone: TONE.purple,
                };
            case 'admin':
                return {
                    label: t('admin.userStatus.admin', 'Admin'),
                    tone: TONE.purple,
                };
            case 'member':
                return {
                    label: t('admin.userStatus.member', 'Member'),
                    tone: TONE.gray,
                };
            default:
                return u.read_only_until
                    ? {
                          label: t(
                              'admin.userStatus.trialEnded',
                              'Trial ended'
                          ),
                          tone: TONE.amber,
                      }
                    : {
                          label: t('admin.userStatus.free', 'No plan'),
                          tone: TONE.gray,
                      };
        }
    };

    const rows = users ?? [];
    const { sorted, sortKey, sortDir, toggle } = useSortedRows(
        rows,
        {
            user: (u) => u.email ?? u.name,
            signedUp: (u) => new Date(u.created_at).getTime(),
            verified: (u) => (u.email ? Number(u.email_verified) : null),
            status: (u) => statusOf(u).label,
            daysLeft: (u) => u.trial_days_left,
            paid: (u) => (u.paid ? 2 : u.ever_paid ? 1 : 0),
        },
        { key: 'signedUp', dir: 'desc' }
    );

    if (error) {
        return (
            <p className="text-sm text-red-500" data-testid="admin-users-error">
                {error}
            </p>
        );
    }

    const formatDate = (value: string) =>
        new Date(value).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });

    return (
        <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                {t('admin.userStatus.title', 'Users')}
            </h2>
            <div className={ADMIN_TABLE_WRAPPER}>
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                        <tr>
                            <SortHeader
                                column="user"
                                label={t('admin.userStatus.user', 'User')}
                                sortKey={sortKey}
                                sortDir={sortDir}
                                onSort={toggle}
                                className={headerCell}
                            />
                            <SortHeader
                                column="signedUp"
                                label={t(
                                    'admin.userStatus.signedUp',
                                    'Signed up'
                                )}
                                sortKey={sortKey}
                                sortDir={sortDir}
                                onSort={toggle}
                                className={headerCell}
                            />
                            <SortHeader
                                column="verified"
                                label={t(
                                    'admin.userStatus.verified',
                                    'Verified'
                                )}
                                sortKey={sortKey}
                                sortDir={sortDir}
                                onSort={toggle}
                                className={headerCell}
                            />
                            {hosted && (
                                <>
                                    <SortHeader
                                        column="status"
                                        label={t(
                                            'admin.userStatus.status',
                                            'Status'
                                        )}
                                        sortKey={sortKey}
                                        sortDir={sortDir}
                                        onSort={toggle}
                                        className={headerCell}
                                    />
                                    <SortHeader
                                        column="daysLeft"
                                        label={t(
                                            'admin.userStatus.daysLeft',
                                            'Trial days left'
                                        )}
                                        sortKey={sortKey}
                                        sortDir={sortDir}
                                        onSort={toggle}
                                        className={headerCell}
                                    />
                                    <SortHeader
                                        column="paid"
                                        label={t(
                                            'admin.userStatus.paid',
                                            'Paid'
                                        )}
                                        sortKey={sortKey}
                                        sortDir={sortDir}
                                        onSort={toggle}
                                        className={headerCell}
                                    />
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {users === null ? (
                            <tr>
                                <td
                                    className="px-4 py-3 text-gray-500"
                                    colSpan={6}
                                >
                                    {t('common.loading', 'Loading...')}
                                </td>
                            </tr>
                        ) : (
                            sorted.map((u) => {
                                const status = statusOf(u);
                                return (
                                    <tr
                                        key={u.id}
                                        className="text-gray-900 dark:text-gray-100"
                                        data-testid={`admin-user-status-${u.id}`}
                                    >
                                        <td className="px-4 py-2">
                                            <div>
                                                {u.email ?? (
                                                    <span className="italic text-gray-400">
                                                        {t(
                                                            'admin.noEmail',
                                                            'No email'
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            {u.name && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {u.name}
                                                </div>
                                            )}
                                        </td>
                                        <td
                                            className={`${cell} text-gray-600 dark:text-gray-300`}
                                        >
                                            <div>
                                                {formatDate(u.created_at)}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {u.member_of
                                                    ? t(
                                                          'admin.userStatus.addedBy',
                                                          {
                                                              defaultValue:
                                                                  'Added by {{email}}',
                                                              email:
                                                                  u.member_of
                                                                      .email ??
                                                                  '-',
                                                          }
                                                      )
                                                    : u.account_status ===
                                                        'invited'
                                                      ? t(
                                                            'admin.status.invited',
                                                            'Invitation pending'
                                                        )
                                                      : t(
                                                            'admin.userStatus.selfSignUp',
                                                            'Signed up'
                                                        )}
                                            </div>
                                        </td>
                                        <td className={cell}>
                                            {!u.email ? (
                                                <span className="text-gray-400">
                                                    -
                                                </span>
                                            ) : u.email_verified ? (
                                                <span
                                                    className={`${BADGE} ${TONE.green}`}
                                                >
                                                    {t(
                                                        'admin.verifiedYes',
                                                        'Verified'
                                                    )}
                                                </span>
                                            ) : (
                                                <span
                                                    className={`${BADGE} ${TONE.amber}`}
                                                >
                                                    {t(
                                                        'admin.verifiedNo',
                                                        'Not verified'
                                                    )}
                                                </span>
                                            )}
                                        </td>
                                        {hosted && (
                                            <>
                                                <td className={cell}>
                                                    <span
                                                        className={`${BADGE} ${status.tone}`}
                                                        data-testid={`admin-user-access-${u.id}`}
                                                    >
                                                        {status.label}
                                                    </span>
                                                    {u.read_only_until && (
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                            {t(
                                                                'admin.userStatus.deletedOn',
                                                                {
                                                                    defaultValue:
                                                                        'Deleted on {{date}}',
                                                                    date: formatDate(
                                                                        u.read_only_until
                                                                    ),
                                                                }
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td
                                                    className={cell}
                                                    data-testid={`admin-user-days-${u.id}`}
                                                >
                                                    {u.trial_days_left !==
                                                    null ? (
                                                        <span className="font-medium text-blue-700 dark:text-blue-300">
                                                            {u.trial_days_left}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td
                                                    className={cell}
                                                    data-testid={`admin-user-paid-${u.id}`}
                                                >
                                                    {u.paid ? (
                                                        <span
                                                            className={`${BADGE} ${TONE.green}`}
                                                        >
                                                            {u.member_of
                                                                ? t(
                                                                      'admin.userStatus.paidByOwner',
                                                                      'Yes, by owner'
                                                                  )
                                                                : t(
                                                                      'admin.userStatus.paidYes',
                                                                      'Yes'
                                                                  )}
                                                        </span>
                                                    ) : u.ever_paid ? (
                                                        <span
                                                            className={`${BADGE} ${TONE.amber}`}
                                                        >
                                                            {t(
                                                                'admin.userStatus.paidBefore',
                                                                'Not now, paid before'
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500 dark:text-gray-400">
                                                            {t(
                                                                'admin.userStatus.paidNo',
                                                                'No'
                                                            )}
                                                        </span>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default AdminUserStatusTable;
