import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, FunnelIcon } from '@heroicons/react/24/outline';
import type { AdminUserStatus } from './AdminUserStatusTable';

interface FilterChoice {
    value: string;
    label: string;
    matches: (u: AdminUserStatus) => boolean;
}

interface FilterGroup {
    key: string;
    label: string;
    choices: FilterChoice[];
}

// Choices in the same group widen the list (signed up or invited), choices
// in different groups narrow it (verified and paying).
export const useUserFilterGroups = (hosted: boolean): FilterGroup[] => {
    const { t } = useTranslation();
    const groups: FilterGroup[] = [
        {
            key: 'source',
            label: t('admin.userFilter.source', 'How they joined'),
            choices: [
                {
                    value: 'signedUp',
                    label: t('admin.userFilter.signedUp', 'Signed up'),
                    matches: (u) =>
                        !u.member_of && u.account_status !== 'invited',
                },
                {
                    value: 'member',
                    label: t('admin.userFilter.member', 'Added as member'),
                    matches: (u) => !!u.member_of,
                },
                {
                    value: 'invited',
                    label: t('admin.userFilter.invited', 'Invitation pending'),
                    matches: (u) =>
                        !u.member_of && u.account_status === 'invited',
                },
            ],
        },
        {
            key: 'verification',
            label: t('admin.userFilter.verification', 'Email'),
            choices: [
                {
                    value: 'verified',
                    label: t('admin.userFilter.verified', 'Verified'),
                    matches: (u) => !!u.email && u.email_verified,
                },
                {
                    value: 'unverified',
                    label: t('admin.userFilter.unverified', 'Not verified'),
                    matches: (u) => !!u.email && !u.email_verified,
                },
            ],
        },
    ];

    if (hosted) {
        groups.push({
            key: 'plan',
            label: t('admin.userFilter.plan', 'Plan'),
            choices: [
                {
                    value: 'trial',
                    label: t('admin.userFilter.trial', 'On trial'),
                    matches: (u) => u.access === 'trial',
                },
                {
                    value: 'trialEnded',
                    label: t('admin.userFilter.trialEnded', 'Trial ended'),
                    matches: (u) => !!u.read_only_until,
                },
                {
                    value: 'paid',
                    label: t('admin.userFilter.paid', 'Paying'),
                    matches: (u) => u.paid,
                },
                {
                    value: 'paidBefore',
                    label: t('admin.userFilter.paidBefore', 'Paid before'),
                    matches: (u) => !u.paid && u.ever_paid,
                },
                {
                    value: 'neverPaid',
                    label: t('admin.userFilter.neverPaid', 'Never paid'),
                    matches: (u) => !u.paid && !u.ever_paid,
                },
            ],
        });
    }

    return groups;
};

export const filterUsers = (
    users: AdminUserStatus[],
    groups: FilterGroup[],
    selected: string[]
): AdminUserStatus[] => {
    if (selected.length === 0) return users;
    const active = groups
        .map((group) =>
            group.choices.filter((choice) => selected.includes(choice.value))
        )
        .filter((choices) => choices.length > 0);
    return users.filter((u) =>
        active.every((choices) => choices.some((choice) => choice.matches(u)))
    );
};

interface AdminUserFilterProps {
    groups: FilterGroup[];
    selected: string[];
    onChange: (selected: string[]) => void;
}

const AdminUserFilter: React.FC<AdminUserFilterProps> = ({
    groups,
    selected,
    onChange,
}) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const toggle = (value: string) =>
        onChange(
            selected.includes(value)
                ? selected.filter((v) => v !== value)
                : [...selected, value]
        );

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-haspopup="true"
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    selected.length > 0
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                }`}
                data-testid="admin-user-filter"
            >
                <FunnelIcon className="h-4 w-4" aria-hidden="true" />
                <span>{t('admin.userFilter.filter', 'Filter')}</span>
                {selected.length > 0 && (
                    <span className="inline-flex min-w-[1.25rem] justify-center rounded-full bg-blue-600 px-1.5 text-xs text-white">
                        {selected.length}
                    </span>
                )}
            </button>
            {open && (
                <div
                    className="absolute right-0 z-50 mt-1 w-56 rounded-lg bg-white p-1 shadow-lg dark:bg-gray-800"
                    role="menu"
                    data-testid="admin-user-filter-menu"
                >
                    {groups.map((group) => (
                        <div key={group.key} className="py-1">
                            <div className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                {group.label}
                            </div>
                            {group.choices.map((choice) => {
                                const checked = selected.includes(choice.value);
                                return (
                                    <button
                                        key={choice.value}
                                        type="button"
                                        role="menuitemcheckbox"
                                        aria-checked={checked}
                                        onClick={() => toggle(choice.value)}
                                        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                        data-testid={`admin-user-filter-${choice.value}`}
                                    >
                                        <span>{choice.label}</span>
                                        {checked && (
                                            <CheckIcon
                                                className="h-4 w-4 text-blue-600 dark:text-blue-300"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    {selected.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            className="mt-1 w-full rounded-md bg-gray-50 px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100 dark:bg-gray-900/40 dark:text-gray-300 dark:hover:bg-gray-700"
                            data-testid="admin-user-filter-clear"
                        >
                            {t('admin.userFilter.clear', 'Clear filters')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminUserFilter;
