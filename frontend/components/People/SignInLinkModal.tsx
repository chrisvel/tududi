import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    createSignInLink,
    revokeSignInLink,
    SignInLink,
} from '../../utils/membersService';

interface SignInLinkModalProps {
    memberId: number;
    memberName: string;
    onClose: () => void;
}

// Creates the link that lets a member without an email sign in, shows it once
// so it can be handed over, and takes access back. The link cannot be shown
// again later: only a hash of it is kept.
const SignInLinkModal: React.FC<SignInLinkModalProps> = ({
    memberId,
    memberName,
    onClose,
}) => {
    const { t } = useTranslation();
    const [link, setLink] = useState<SignInLink | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const run = async (work: () => Promise<void>, failed: string) => {
        setBusy(true);
        setError(null);
        setMessage(null);
        try {
            await work();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : failed);
        } finally {
            setBusy(false);
        }
    };

    const handleCreate = () =>
        run(
            async () => {
                setLink(await createSignInLink(memberId));
            },
            t('signInLink.failedToCreate', 'Failed to create the link')
        );

    const handleRevoke = () =>
        run(
            async () => {
                await revokeSignInLink(memberId);
                setLink(null);
                setMessage(
                    t(
                        'signInLink.revoked',
                        'Access taken back. {{name}} is signed out everywhere and the link no longer works.',
                        { name: memberName }
                    )
                );
            },
            t('signInLink.failedToRevoke', 'Failed to take access back')
        );

    // On the address this browser reached the app at, which is where the
    // person opening the link can reach it too, unlike a configured address
    // such as localhost.
    const shownUrl = link ? `${window.location.origin}${link.path}` : '';

    const handleCopy = () =>
        run(
            async () => {
                if (!link) return;
                await navigator.clipboard.writeText(shownUrl);
                setMessage(t('signInLink.copied', 'Link copied'));
            },
            t(
                'signInLink.failedToCopy',
                'Could not copy the link, select it and copy it by hand'
            )
        );

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={onClose}
            data-testid="sign-in-link-modal"
        >
            <div
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {t('signInLink.title', 'Sign-in link for {{name}}', {
                        name: memberName,
                    })}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    {t(
                        'signInLink.intro',
                        '{{name}} has no email, so this link is how they sign in. Send it to them yourself. It works once, for 24 hours, and keeps them signed in for 30 days.',
                        { name: memberName }
                    )}
                </p>

                {link && (
                    <div className="space-y-2 mb-4">
                        <input
                            type="text"
                            readOnly
                            value={shownUrl}
                            onFocus={(e) => e.currentTarget.select()}
                            className="w-full rounded border px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            data-testid="sign-in-link-url"
                        />
                        <p
                            className="text-xs text-gray-500 dark:text-gray-400"
                            data-testid="sign-in-link-expiry"
                        >
                            {t(
                                'signInLink.expires',
                                'Valid until {{date}}. Shown only now: create a new link if you lose it.',
                                {
                                    date: new Date(
                                        link.expires_at
                                    ).toLocaleString(),
                                }
                            )}
                        </p>
                        <button
                            type="button"
                            onClick={handleCopy}
                            disabled={busy}
                            data-testid="sign-in-link-copy"
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-60"
                        >
                            {t('signInLink.copy', 'Copy link')}
                        </button>
                    </div>
                )}

                {message && (
                    <div
                        className="text-sm text-green-700 dark:text-green-400 mb-3"
                        role="status"
                    >
                        {message}
                    </div>
                )}
                {error && (
                    <div
                        className="text-sm text-red-600 dark:text-red-400 mb-3"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                <div className="flex flex-wrap justify-between gap-2 pt-2">
                    <button
                        type="button"
                        onClick={handleRevoke}
                        disabled={busy}
                        data-testid="sign-in-link-revoke"
                        className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-60"
                    >
                        {t('signInLink.revoke', 'Take access back')}
                    </button>
                    <div className="flex space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
                        >
                            {t('common.close', 'Close')}
                        </button>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={busy}
                            data-testid="sign-in-link-create"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {link
                                ? t('signInLink.createNew', 'Create a new link')
                                : t('signInLink.create', 'Create link')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignInLinkModal;
