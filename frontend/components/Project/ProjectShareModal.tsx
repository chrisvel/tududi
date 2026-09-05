import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../../entities/Project';
import {
    AccessLevel,
    ListSharesResponseRow,
    grantShare,
    listShares,
    revokeShare,
} from '../../utils/sharesService';
import { getCurrentUser } from '../../utils/userUtils';

interface ProjectShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ProjectShareModal: React.FC<ProjectShareModalProps> = ({
    isOpen,
    onClose,
    project,
}) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [access, setAccess] = useState<AccessLevel>('ro');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [rows, setRows] = useState<ListSharesResponseRow[] | null>(null);
    const [loadingList, setLoadingList] = useState(false);
    const currentUser = getCurrentUser();

    const projectUid: string | null = useMemo(() => {
        return (project as any).uid || null;
    }, [project]);

    const refreshShares = async (uid: string) => {
        setLoadingList(true);
        try {
            const data = await listShares('project', uid);
            setRows(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load shares');
            setRows([]);
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        setEmail('');
        setAccess('ro');
        setError(null);
        setNotice(null);

        if (!projectUid) return;
        refreshShares(projectUid);
    }, [isOpen, projectUid]);

    if (!isOpen) return null;

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setNotice(null);
        if (!projectUid) {
            setError(t('errors.generic', 'Something went wrong'));
            return;
        }

        const trimmed = email.trim().toLowerCase();
        if (!EMAIL_PATTERN.test(trimmed)) {
            setError(t('shares.invalidEmail', 'Enter a valid email address'));
            return;
        }
        if (currentUser && trimmed === currentUser.email?.toLowerCase()) {
            setError(
                t(
                    'shares.cannotShareWithSelf',
                    'You already have full access to this project'
                )
            );
            return;
        }

        setSubmitting(true);
        try {
            await grantShare({
                resource_type: 'project',
                resource_uid: projectUid,
                target_user_email: trimmed,
                access_level: access,
            });
            setEmail('');
            setNotice(t('shares.invitationSent', 'Invitation sent.'));
            await refreshShares(projectUid);
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
            await refreshShares(projectUid);
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
                        <label
                            htmlFor="share-email"
                            className="block text-sm text-gray-700 dark:text-gray-300 mb-1"
                        >
                            {t('shares.targetUser', 'Invite by email')}
                        </label>
                        <input
                            id="share-email"
                            type="email"
                            autoComplete="off"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t(
                                'shares.emailPlaceholder',
                                'name@example.com'
                            )}
                            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t(
                                'shares.inviteHint',
                                'They will get an invitation and see the project after accepting.'
                            )}
                        </p>
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
                    {notice && (
                        <div className="text-sm text-green-600 dark:text-green-400">
                            {notice}
                        </div>
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
                            disabled={submitting || !email.trim()}
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
                                                {r.status === 'pending' && (
                                                    <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-transparent dark:text-amber-400 dark:border-amber-500">
                                                        {t(
                                                            'shares.pending',
                                                            'Pending'
                                                        )}
                                                    </span>
                                                )}
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
