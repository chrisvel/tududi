import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AccessLevel,
    GroupShareRow,
    ListSharesResponseRow,
    ShareCandidate,
    ShareGrantRequest,
    fetchShareCandidates,
    grantShare,
    listShareDetails,
    revokeGroupShare,
    revokeShare,
} from '../../utils/sharesService';
import { GroupSummary, fetchGroups } from '../../utils/groupsService';
import { clearProjectShareCache } from '../../utils/projectShareCache';
import { getCurrentUser } from '../../utils/userUtils';
import {
    CheckCircleIcon,
    ExclamationCircleIcon,
    UserGroupIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { FORM } from '../../constants/formClasses';
import SelectMenu from './SelectMenu';

export type ShareResourceType = ShareGrantRequest['resource_type'];

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    resourceType: ShareResourceType;
    resourceUid: string | null;
    resourceName?: string | null;
}

type ShareTarget = 'user' | 'group';

// The picker value that switches to inviting someone by email.
const BY_EMAIL = 'email';

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
    const [personId, setPersonId] = useState('');
    const [groupUid, setGroupUid] = useState('');
    const [access, setAccess] = useState<AccessLevel>('ro');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [rows, setRows] = useState<ListSharesResponseRow[] | null>(null);
    const [groupShares, setGroupShares] = useState<GroupShareRow[]>([]);
    const [groups, setGroups] = useState<GroupSummary[]>([]);
    const [candidates, setCandidates] = useState<ShareCandidate[]>([]);
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
        setPersonId('');
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
        fetchShareCandidates()
            .then((list) => {
                if (!cancelled) setCandidates(list);
            })
            .catch(() => {
                if (!cancelled) setCandidates([]);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, resourceUid, resourceType]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const title = TITLE_KEYS[resourceType] || {
        key: 'shares.share',
        fallback: 'Share',
    };

    const sharedGroupUids = new Set(groupShares.map((g) => g.group_uid));
    const showTargetToggle = groups.length > 0;
    const sharedUserIds = new Set((rows || []).map((r) => r.user_id));
    // Without anyone to pick from, the email field is all there is.
    const byEmail = candidates.length === 0 || personId === BY_EMAIL;

    const switchTarget = (next: ShareTarget) => {
        setTarget(next);
        setError(null);
        setNotice(null);
    };

    const shareWithPerson = async (uid: string) => {
        if (!personId) {
            setError(t('shares.selectPersonError', 'Choose a person'));
            return false;
        }

        await grantShare({
            resource_type: resourceType,
            resource_uid: uid,
            target_user_id: Number(personId),
            access_level: access,
        });
        setPersonId('');
        setNotice(t('shares.invitationSent', 'Invitation sent.'));
        return true;
    };

    const shareWithUser = async (uid: string) => {
        if (!byEmail) return shareWithPerson(uid);
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

    const emailField = (
        <div className="min-w-0">
            <label
                htmlFor="share-email"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
                {t('shares.targetUser', 'Invite by email')}
            </label>
            <input
                id="share-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('shares.emailPlaceholder', 'name@example.com')}
                className={`${FORM.input} w-full`}
            />
        </div>
    );

    const accessLabel = (al: AccessLevel | 'owner') =>
        al === 'owner'
            ? t('shares.owner', 'Owner')
            : al === 'rw'
              ? t('shares.readWrite', 'Read & write')
              : t('shares.readOnly', 'Read only');

    const toggleClass = (active: boolean) =>
        `flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            active
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        }`;

    const submitDisabled =
        submitting ||
        (target === 'group' ? !groupUid : byEmail ? !email.trim() : !personId);

    const myEmail = currentUser?.email?.toLowerCase();
    const sortedRows = [...(rows || [])].sort(
        (a, b) => Number(!!b.is_owner) - Number(!!a.is_owner)
    );

    const sectionLabel =
        'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
    const fieldLabel =
        'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';
    const revokeButton =
        'px-2 py-1 text-xs font-medium rounded-md text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm px-4"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-modal-title"
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
                    <div className="min-w-0">
                        <h3
                            id="share-modal-title"
                            className="text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            {t(title.key, title.fallback)}
                        </h3>
                        {resourceName && (
                            <p
                                className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate"
                                title={resourceName}
                            >
                                {resourceName}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('common.close', 'Close')}
                        className="-mr-2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="px-6 pb-5 space-y-3">
                    {showTargetToggle && (
                        <div
                            role="tablist"
                            className="flex p-1 rounded-lg bg-gray-100 dark:bg-gray-700/60"
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

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-3">
                        {target === 'user' ? (
                            candidates.length > 0 ? (
                                <div className="min-w-0">
                                    <label
                                        htmlFor="share-person"
                                        className={fieldLabel}
                                    >
                                        {t('shares.shareWith', 'Share with')}
                                    </label>
                                    <SelectMenu
                                        id="share-person"
                                        value={personId}
                                        onChange={(next) => {
                                            setPersonId(next);
                                            setError(null);
                                        }}
                                        placeholder={t(
                                            'shares.selectPerson',
                                            'Select a person'
                                        )}
                                        options={[
                                            ...candidates.map((person) => ({
                                                value: String(person.id),
                                                label: person.name,
                                                disabled: sharedUserIds.has(
                                                    person.id
                                                ),
                                                hint: sharedUserIds.has(
                                                    person.id
                                                )
                                                    ? t(
                                                          'shares.alreadyHasAccess',
                                                          'already has access'
                                                      )
                                                    : undefined,
                                            })),
                                            {
                                                value: BY_EMAIL,
                                                label: t(
                                                    'shares.someoneElseByEmail',
                                                    'Someone else, by email'
                                                ),
                                            },
                                        ]}
                                    />
                                </div>
                            ) : (
                                emailField
                            )
                        ) : (
                            <div className="min-w-0">
                                <label
                                    htmlFor="share-group"
                                    className={fieldLabel}
                                >
                                    {t(
                                        'shares.targetGroup',
                                        'Share with a group'
                                    )}
                                </label>
                                <SelectMenu
                                    id="share-group"
                                    value={groupUid}
                                    onChange={setGroupUid}
                                    placeholder={t(
                                        'shares.selectGroup',
                                        'Select a group'
                                    )}
                                    options={groups.map((group) => ({
                                        value: group.uid,
                                        label: `${group.name} (${group.member_count})`,
                                        disabled: sharedGroupUids.has(
                                            group.uid
                                        ),
                                        hint: sharedGroupUids.has(group.uid)
                                            ? t(
                                                  'shares.groupAlreadyShared',
                                                  'already shared'
                                              )
                                            : undefined,
                                    }))}
                                />
                            </div>
                        )}
                        <div>
                            <label
                                htmlFor="share-access"
                                className={fieldLabel}
                            >
                                {t('shares.permission', 'Permission')}
                            </label>
                            <SelectMenu
                                id="share-access"
                                value={access}
                                onChange={(next) =>
                                    setAccess(next as AccessLevel)
                                }
                                options={[
                                    {
                                        value: 'ro',
                                        label: t(
                                            'shares.readOnly',
                                            'Read only'
                                        ),
                                    },
                                    {
                                        value: 'rw',
                                        label: t(
                                            'shares.readWrite',
                                            'Read & write'
                                        ),
                                    },
                                ]}
                            />
                        </div>
                    </div>

                    {target === 'user' &&
                        candidates.length > 0 &&
                        byEmail &&
                        emailField}

                    <div className="flex items-center justify-between gap-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {target === 'group'
                                ? t(
                                      'shares.groupHint',
                                      'Every member gets an invitation, and people added to the group later are invited too.'
                                  )
                                : t(
                                      'shares.inviteHint',
                                      'They will get an invitation and see it after accepting.'
                                  )}
                        </p>
                        <button
                            type="submit"
                            disabled={submitDisabled}
                            className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitting
                                ? t('common.saving', 'Saving...')
                                : t('shares.share', 'Share')}
                        </button>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                        >
                            <ExclamationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}
                    {notice && (
                        <div
                            role="status"
                            className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                        >
                            <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {notice}
                        </div>
                    )}
                </form>

                <div className="px-6 py-4 space-y-5 overflow-y-auto bg-gray-50 dark:bg-gray-900/40">
                    <div>
                        <div className={`${sectionLabel} mb-2`}>
                            {t('shares.currentShares', 'Users with access')}
                        </div>
                        {loadingList && !rows ? (
                            <div className="py-2 text-sm text-gray-500">
                                {t('common.loading', 'Loading...')}
                            </div>
                        ) : sortedRows.length === 0 ? (
                            <div className="py-2 text-sm text-gray-500">
                                {t('shares.noShares', 'Not shared yet')}
                            </div>
                        ) : (
                            <ul className="space-y-1">
                                {sortedRows.map((r) => {
                                    const label = r.email || `#${r.user_id}`;
                                    const isMe =
                                        !!myEmail &&
                                        r.email?.toLowerCase() === myEmail;
                                    return (
                                        <li
                                            key={`${r.user_id}-${r.created_at || 'owner'}`}
                                            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold flex-shrink-0 ${
                                                    r.is_owner
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                                                }`}
                                            >
                                                {label.charAt(0).toUpperCase()}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                                    {label}
                                                    {isMe && (
                                                        <span className="ml-1 text-gray-400">
                                                            (
                                                            {t(
                                                                'shares.you',
                                                                'you'
                                                            )}
                                                            )
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                    {accessLabel(
                                                        r.access_level
                                                    )}
                                                    {r.status === 'pending' && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium leading-none bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                                                            {t(
                                                                'shares.pending',
                                                                'Pending'
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {!r.is_owner && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onRevoke(r.user_id)
                                                    }
                                                    className={revokeButton}
                                                >
                                                    {t(
                                                        'shares.revoke',
                                                        'Revoke'
                                                    )}
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                    {groupShares.length > 0 && (
                        <div data-testid="share-group-list">
                            <div className={`${sectionLabel} mb-2`}>
                                {t(
                                    'shares.sharedWithGroups',
                                    'Shared with groups'
                                )}
                            </div>
                            <ul className="space-y-1">
                                {groupShares.map((g) => (
                                    <li
                                        key={g.group_uid}
                                        className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
                                        >
                                            <UserGroupIcon className="w-4 h-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                                {g.group_name}
                                            </div>
                                            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                {accessLabel(g.access_level)}
                                                {' · '}
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
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onRevokeGroup(g.group_uid)
                                            }
                                            data-testid={`share-group-revoke-${g.group_uid}`}
                                            className={revokeButton}
                                        >
                                            {t('shares.revoke', 'Revoke')}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="flex justify-end px-6 py-3 rounded-b-xl bg-gray-50 dark:bg-gray-900/40">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] transition-colors"
                    >
                        {t('common.done', 'Done')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
