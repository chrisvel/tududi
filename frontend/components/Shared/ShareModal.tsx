import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AccessLevel,
    GroupShareRow,
    ListSharesResponseRow,
    ShareGrantRequest,
    grantShare,
    listShareDetails,
    revokeGroupShare,
    revokeShare,
} from '../../utils/sharesService';
import { GroupSummary, fetchGroups } from '../../utils/groupsService';
import { clearProjectShareCache } from '../../utils/projectShareCache';
import { getCurrentUser } from '../../utils/userUtils';

export type ShareResourceType = ShareGrantRequest['resource_type'];

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    resourceType: ShareResourceType;
    resourceUid: string | null;
    resourceName?: string | null;
}

type ShareTarget = 'user' | 'group';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TITLE_KEYS: Record<string, { key: string; fallback: string }> = {
    project: { key: 'shares.shareProject', fallback: 'Share project' },
    area: { key: 'shares.shareArea', fallback: 'Share area' },
    goal: { key: 'shares.shareGoal', fallback: 'Share goal' },
    note: { key: 'shares.shareNote', fallback: 'Share note' },
    task: { key: 'shares.shareTask', fallback: 'Share task' },
};

const ShareModal: React.FC<ShareModalProps> = ({
    isOpen,
    onClose,
    resourceType,
    resourceUid,
    resourceName,
}) => {
    const { t } = useTranslation();
    const [target, setTarget] = useState<ShareTarget>('user');
    const [email, setEmail] = useState('');
    const [groupUid, setGroupUid] = useState('');
    const [access, setAccess] = useState<AccessLevel>('ro');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [rows, setRows] = useState<ListSharesResponseRow[] | null>(null);
    const [groupShares, setGroupShares] = useState<GroupShareRow[]>([]);
    const [groups, setGroups] = useState<GroupSummary[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const currentUser = getCurrentUser();

    const refreshShares = async (uid: string) => {
        setLoadingList(true);
        try {
            const data = await listShareDetails(resourceType, uid);
            setRows(data.shares);
            setGroupShares(data.group_shares);
        } catch (err: any) {
            setError(err.message || 'Failed to load shares');
            setRows([]);
            setGroupShares([]);
        } finally {
            setLoadingList(false);
        }
    };

    // Shares changed: project cards and the "Everyone" sidebar item both read
    // from what was just written.
    const notifySharesChanged = (uid: string) => {
        if (resourceType === 'project') clearProjectShareCache(uid);
        window.dispatchEvent(new CustomEvent('collaboratorsChanged'));
    };

    useEffect(() => {
        if (!isOpen) return;
        setTarget('user');
        setEmail('');
        setGroupUid('');
        setAccess('ro');
        setError(null);
        setNotice(null);
        if (!resourceUid) return;
        refreshShares(resourceUid);

        let cancelled = false;
        fetchGroups()
            .then((list) => {
                if (!cancelled) setGroups(list);
            })
            .catch(() => {
                if (!cancelled) setGroups([]);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, resourceUid, resourceType]);

    if (!isOpen) return null;

    const title = TITLE_KEYS[resourceType] || {
        key: 'shares.share',
        fallback: 'Share',
    };

    const sharedGroupUids = new Set(groupShares.map((g) => g.group_uid));
    const showTargetToggle = groups.length > 0;

    const switchTarget = (next: ShareTarget) => {
        setTarget(next);
        setError(null);
        setNotice(null);
    };

    const shareWithUser = async (uid: string) => {
        const trimmed = email.trim().toLowerCase();
        if (!EMAIL_PATTERN.test(trimmed)) {
            setError(t('shares.invalidEmail', 'Enter a valid email address'));
            return false;
        }
        if (currentUser && trimmed === currentUser.email?.toLowerCase()) {
            setError(
                t(
                    'shares.cannotShareWithSelf',
                    'You already have full access to this'
                )
            );
            return false;
        }

        await grantShare({
            resource_type: resourceType,
            resource_uid: uid,
            target_user_email: trimmed,
            access_level: access,
        });
        setEmail('');
        setNotice(t('shares.invitationSent', 'Invitation sent.'));
        return true;
    };

    const shareWithGroup = async (uid: string) => {
        if (!groupUid) {
            setError(t('shares.selectGroupError', 'Choose a group'));
            return false;
        }

        await grantShare({
            resource_type: resourceType,
            resource_uid: uid,
            target_group_uid: groupUid,
            access_level: access,
        });
        setGroupUid('');
        setNotice(
            t(
                'shares.groupInvitationsSent',
                'Invitations sent to the group members.'
            )
        );
        return true;
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setNotice(null);
        if (!resourceUid) {
            setError(t('errors.generic', 'Something went wrong'));
            return;
        }

        setSubmitting(true);
        try {
            const shared =
                target === 'group'
                    ? await shareWithGroup(resourceUid)
                    : await shareWithUser(resourceUid);
            if (shared) {
                await refreshShares(resourceUid);
                notifySharesChanged(resourceUid);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to share');
        } finally {
            setSubmitting(false);
        }
    };

    const onRevoke = async (userId: number) => {
        if (!resourceUid) return;
        try {
            await revokeShare(resourceType, resourceUid, userId);
            await refreshShares(resourceUid);
            notifySharesChanged(resourceUid);
        } catch (err: any) {
            setError(err.message || 'Failed to revoke share');
        }
    };

    const onRevokeGroup = async (uid: string) => {
        if (!resourceUid) return;
        try {
            await revokeGroupShare(resourceType, resourceUid, uid);
            await refreshShares(resourceUid);
            notifySharesChanged(resourceUid);
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

    const toggleClass = (active: boolean) =>
        `flex-1 px-3 py-1.5 text-sm rounded ${
            active
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300'
        }`;

    const submitDisabled =
        submitting || (target === 'group' ? !groupUid : !email.trim());

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
                        {t(title.key, title.fallback)}
                    </h3>
                    {resourceName && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {resourceName}
                        </p>
                    )}
                </div>
                <form onSubmit={onSubmit} className="px-6 py-4 space-y-4">
                    {showTargetToggle && (
                        <div
                            role="tablist"
                            className="flex p-1 rounded-md bg-gray-100 dark:bg-gray-700"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={target === 'user'}
                                data-testid="share-target-user"
                                onClick={() => switchTarget('user')}
                                className={toggleClass(target === 'user')}
                            >
                                {t('shares.targetUserTab', 'User')}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={target === 'group'}
                                data-testid="share-target-group"
                                onClick={() => switchTarget('group')}
                                className={toggleClass(target === 'group')}
                            >
                                {t('shares.targetGroupTab', 'Group')}
                            </button>
                        </div>
                    )}
                    {target === 'user' ? (
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
                                    'They will get an invitation and see it after accepting.'
                                )}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <label
                                htmlFor="share-group"
                                className="block text-sm text-gray-700 dark:text-gray-300 mb-1"
                            >
                                {t('shares.targetGroup', 'Share with a group')}
                            </label>
                            <select
                                id="share-group"
                                value={groupUid}
                                onChange={(e) => setGroupUid(e.target.value)}
                                className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            >
                                <option value="">
                                    {t('shares.selectGroup', 'Select a group')}
                                </option>
                                {groups.map((group) => (
                                    <option
                                        key={group.uid}
                                        value={group.uid}
                                        disabled={sharedGroupUids.has(
                                            group.uid
                                        )}
                                    >
                                        {group.name} ({group.member_count})
                                        {sharedGroupUids.has(group.uid)
                                            ? ` - ${t('shares.groupAlreadyShared', 'already shared')}`
                                            : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {t(
                                    'shares.groupHint',
                                    'Every member gets an invitation, and people added to the group later are invited too.'
                                )}
                            </p>
                        </div>
                    )}
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
                            disabled={submitDisabled}
                            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
                        >
                            {submitting
                                ? t('common.saving', 'Saving...')
                                : t('shares.share', 'Share')}
                        </button>
                    </div>
                </form>
                <div className="px-6 pb-5 space-y-4">
                    <div>
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
                                                    {accessLabel(
                                                        r.access_level
                                                    )}
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
                                                    {t(
                                                        'shares.revoke',
                                                        'Revoke'
                                                    )}
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                    {groupShares.length > 0 && (
                        <div data-testid="share-group-list">
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t(
                                    'shares.sharedWithGroups',
                                    'Shared with groups'
                                )}
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md max-h-40 overflow-auto">
                                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {groupShares.map((g) => (
                                        <li
                                            key={g.group_uid}
                                            className="flex items-center justify-between px-3 py-2"
                                        >
                                            <div>
                                                <div className="text-sm text-gray-900 dark:text-gray-100">
                                                    {g.group_name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {accessLabel(
                                                        g.access_level
                                                    )}
                                                    <span className="ml-2">
                                                        {t(
                                                            'shares.groupCounts',
                                                            '{{accepted}} accepted, {{pending}} pending',
                                                            {
                                                                accepted:
                                                                    g.accepted_count,
                                                                pending:
                                                                    g.pending_count,
                                                            }
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    onRevokeGroup(g.group_uid)
                                                }
                                                data-testid={`share-group-revoke-${g.group_uid}`}
                                                className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-transparent dark:text-red-400 dark:border-red-500"
                                            >
                                                {t('shares.revoke', 'Revoke')}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
