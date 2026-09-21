import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    GlobeAltIcon,
    LockClosedIcon,
    LinkIcon,
} from '@heroicons/react/24/outline';
import {
    NotePublicShare,
    PublicShareError,
    buildPublicNoteUrl,
    disableNotePublicShare,
    enableNotePublicShare,
    getNotePublicShare,
} from '../../utils/publicNotesService';

interface PublicShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    noteUid: string | null;
    noteTitle?: string | null;
    onChange?: (isPublic: boolean) => void;
}

type Access = 'restricted' | 'anyone';

const PublicShareModal: React.FC<PublicShareModalProps> = ({
    isOpen,
    onClose,
    noteUid,
    noteTitle,
    onChange,
}) => {
    const { t } = useTranslation();
    const [share, setShare] = useState<NotePublicShare | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const linkRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen || !noteUid) return;
        let cancelled = false;
        setShare(null);
        setCopied(false);
        setError(null);
        setLoading(true);
        getNotePublicShare(noteUid)
            .then((state) => {
                if (!cancelled) setShare(state);
            })
            .catch((err: Error) => {
                if (!cancelled) setError(describeError(err));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, noteUid]);

    if (!isOpen) return null;

    function describeError(err: Error): string {
        if (err instanceof PublicShareError && err.status === 403) {
            return t(
                'notes.publicShare.ownerOnly',
                'Only the owner of a note can share it publicly.'
            );
        }
        return (
            err.message ||
            t('notes.publicShare.failed', 'Something went wrong. Try again.')
        );
    }

    const access: Access = share?.enabled ? 'anyone' : 'restricted';
    const link = share?.token ? buildPublicNoteUrl(share.token) : '';

    const handleAccessChange = async (next: Access) => {
        if (!noteUid || next === access) return;
        setSaving(true);
        setError(null);
        setCopied(false);
        try {
            const state =
                next === 'anyone'
                    ? await enableNotePublicShare(noteUid)
                    : await disableNotePublicShare(noteUid);
            setShare(state);
            onChange?.(state.enabled);
        } catch (err) {
            setError(describeError(err as Error));
        } finally {
            setSaving(false);
        }
    };

    const handleCopy = async () => {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            linkRef.current?.select();
            setError(
                t(
                    'notes.publicShare.copyFailed',
                    'Could not copy automatically. Select the link and copy it.'
                )
            );
        }
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={onClose}
            data-testid="public-share-modal"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="public-share-title"
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 pt-5 pb-3">
                    <h3
                        id="public-share-title"
                        className="text-lg font-semibold text-gray-900 dark:text-white truncate"
                    >
                        {t('notes.publicShare.title', 'Share "{{title}}"', {
                            title:
                                noteTitle ||
                                t('notes.untitled', 'Untitled Note'),
                        })}
                    </h3>
                </div>

                <div className="px-6 pb-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('notes.publicShare.generalAccess', 'General access')}
                    </div>
                    <div className="flex items-start gap-3">
                        <div
                            className={`mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                                access === 'anyone'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                        >
                            {access === 'anyone' ? (
                                <GlobeAltIcon className="h-5 w-5" />
                            ) : (
                                <LockClosedIcon className="h-5 w-5" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <select
                                aria-label={t(
                                    'notes.publicShare.generalAccess',
                                    'General access'
                                )}
                                value={access}
                                disabled={loading || saving || !share}
                                onChange={(e) =>
                                    handleAccessChange(e.target.value as Access)
                                }
                                data-testid="public-share-access"
                                className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                            >
                                <option value="restricted">
                                    {t(
                                        'notes.publicShare.restricted',
                                        'Restricted'
                                    )}
                                </option>
                                <option value="anyone">
                                    {t(
                                        'notes.publicShare.anyone',
                                        'Anyone with the link'
                                    )}
                                </option>
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {access === 'anyone'
                                    ? t(
                                          'notes.publicShare.anyoneHint',
                                          'Anyone on the internet with the link can read this note, without signing in. They cannot edit it. Turn this off and the link stops working right away.'
                                      )
                                    : t(
                                          'notes.publicShare.restrictedHint',
                                          'Only you and the people you shared it with can open this note.'
                                      )}
                            </p>
                        </div>
                    </div>
                </div>

                {access === 'anyone' && link && (
                    <div className="px-6 pt-3 pb-2">
                        <label
                            htmlFor="public-share-link"
                            className="block text-sm text-gray-700 dark:text-gray-300 mb-1"
                        >
                            {t('notes.publicShare.link', 'Public link')}
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1 min-w-0">
                                <LinkIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    id="public-share-link"
                                    ref={linkRef}
                                    readOnly
                                    value={link}
                                    onFocus={(e) => e.target.select()}
                                    data-testid="public-share-link"
                                    className="w-full rounded border pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleCopy}
                                data-testid="public-share-copy"
                                className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 whitespace-nowrap"
                            >
                                {copied
                                    ? t('notes.publicShare.copied', 'Copied')
                                    : t(
                                          'notes.publicShare.copyLink',
                                          'Copy link'
                                      )}
                            </button>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="px-6 pb-2 text-sm text-gray-500">
                        {t('common.loading', 'Loading...')}
                    </div>
                )}
                {error && (
                    <div
                        role="alert"
                        className="px-6 pb-2 text-sm text-red-500"
                    >
                        {error}
                    </div>
                )}

                <div className="flex justify-end px-6 pt-3 pb-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                        {t('common.done', 'Done')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PublicShareModal;
