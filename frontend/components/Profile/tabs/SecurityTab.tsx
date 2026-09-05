import React, { ChangeEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ShieldCheckIcon,
    UserIcon,
    EyeIcon,
    EyeSlashIcon,
    InformationCircleIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import type { ProfileFormData } from '../types';
import { deleteAccount } from '../../../utils/profileService';
import { getCurrentUser } from '../../../utils/userUtils';

interface SecurityTabProps {
    isActive: boolean;
    hasPassword: boolean;
    formData: ProfileFormData;
    showCurrentPassword: boolean;
    showNewPassword: boolean;
    showConfirmPassword: boolean;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    onToggleCurrentPassword: () => void;
    onToggleNewPassword: () => void;
    onToggleConfirmPassword: () => void;
}

const SecurityTab: React.FC<SecurityTabProps> = ({
    isActive,
    hasPassword,
    formData,
    showCurrentPassword,
    showNewPassword,
    showConfirmPassword,
    onChange,
    onToggleCurrentPassword,
    onToggleNewPassword,
    onToggleConfirmPassword,
}) => {
    const { t } = useTranslation();
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleteSecret, setDeleteSecret] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleDeleteAccount = async () => {
        setDeleteError(null);
        setDeleting(true);
        try {
            await deleteAccount(
                hasPassword
                    ? { password: deleteSecret }
                    : { confirm_email: deleteSecret }
            );
            window.location.href = '/login';
        } catch (err: any) {
            setDeleteError(err.message || 'Failed to delete account');
            setDeleting(false);
        }
    };

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <ShieldCheckIcon className="w-6 h-6 mr-3 text-red-500" />
                {t('profile.security', 'Security Settings')}
            </h3>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <UserIcon className="w-5 h-5 mr-2 text-blue-500" />
                    {hasPassword
                        ? t('profile.changePassword', 'Change Password')
                        : t('profile.setPassword', 'Set Password')}
                </h4>

                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded text-blue-800 dark:text-blue-200">
                    <p className="text-sm">
                        <InformationCircleIcon className="w-4 h-4 inline mr-1" />
                        {hasPassword
                            ? t(
                                  'profile.passwordChangeOptional',
                                  'Leave password fields empty to update other settings without changing your password.'
                              )
                            : t(
                                  'profile.setPasswordInfo',
                                  'You have not set a password yet. Setting one lets you sign in directly and use CalDAV.'
                              )}
                    </p>
                </div>

                <div className="space-y-4">
                    {hasPassword && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t(
                                    'profile.currentPassword',
                                    'Current Password'
                                )}
                            </label>
                            <div className="relative">
                                <input
                                    type={
                                        showCurrentPassword
                                            ? 'text'
                                            : 'password'
                                    }
                                    name="currentPassword"
                                    value={formData.currentPassword || ''}
                                    onChange={onChange}
                                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder={t(
                                        'profile.enterCurrentPassword',
                                        'Enter your current password'
                                    )}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    onClick={onToggleCurrentPassword}
                                >
                                    {showCurrentPassword ? (
                                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                                    ) : (
                                        <EyeIcon className="h-5 w-5 text-gray-400" />
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('profile.newPassword', 'New Password')}
                        </label>
                        <div className="relative">
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                name="newPassword"
                                value={formData.newPassword || ''}
                                onChange={onChange}
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder={t(
                                    'profile.enterNewPassword',
                                    'Enter your new password'
                                )}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                onClick={onToggleNewPassword}
                            >
                                {showNewPassword ? (
                                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                                ) : (
                                    <EyeIcon className="h-5 w-5 text-gray-400" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t(
                                'profile.confirmPassword',
                                'Confirm New Password'
                            )}
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                name="confirmPassword"
                                value={formData.confirmPassword || ''}
                                onChange={onChange}
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder={t(
                                    'profile.confirmNewPassword',
                                    'Confirm your new password'
                                )}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                onClick={onToggleConfirmPassword}
                            >
                                {showConfirmPassword ? (
                                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                                ) : (
                                    <EyeIcon className="h-5 w-5 text-gray-400" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t(
                            'profile.passwordChangeNote',
                            'Password changes will be saved when you click "Save Changes" at the bottom of the form.'
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6 p-4 border border-red-200 dark:border-red-800 rounded-lg">
                <h4 className="text-lg font-medium text-red-700 dark:text-red-400 mb-2 flex items-center">
                    <TrashIcon className="w-5 h-5 mr-2" />
                    {t('profile.deleteAccount', 'Delete account')}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {t(
                        'profile.deleteAccountInfo',
                        'This permanently removes your account and everything in it: tasks, projects, notes, attachments, backups, and integrations. It cannot be undone.'
                    )}
                </p>
                {!confirmingDelete ? (
                    <button
                        type="button"
                        onClick={() => setConfirmingDelete(true)}
                        className="px-4 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                        data-testid="delete-account-start"
                    >
                        {t('profile.deleteAccount', 'Delete account')}
                    </button>
                ) : (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {hasPassword
                                ? t(
                                      'profile.deleteAccountConfirmPassword',
                                      'Enter your password to confirm'
                                  )
                                : t(
                                      'profile.deleteAccountConfirmEmail',
                                      'Type your email address to confirm'
                                  )}
                        </label>
                        <input
                            type={hasPassword ? 'password' : 'email'}
                            value={deleteSecret}
                            onChange={(e) => setDeleteSecret(e.target.value)}
                            placeholder={
                                hasPassword ? '' : getCurrentUser()?.email || ''
                            }
                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            data-testid="delete-account-secret"
                        />
                        {deleteError && (
                            <div className="text-sm text-red-500">
                                {deleteError}
                            </div>
                        )}
                        <div className="flex space-x-2">
                            <button
                                type="button"
                                onClick={handleDeleteAccount}
                                disabled={deleting || !deleteSecret}
                                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                                data-testid="delete-account-confirm"
                            >
                                {deleting
                                    ? t('common.deleting', 'Deleting...')
                                    : t(
                                          'profile.deleteAccountConfirm',
                                          'Permanently delete my account'
                                      )}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setConfirmingDelete(false);
                                    setDeleteSecret('');
                                    setDeleteError(null);
                                }}
                                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SecurityTab;
