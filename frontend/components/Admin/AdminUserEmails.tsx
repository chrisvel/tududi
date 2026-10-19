import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
    AdminEmailPreview,
    AdminUserEmails as AdminUserEmailsData,
    fetchUserEmails,
    previewUserEmail,
    sendUserEmail,
} from '../../utils/adminEmailsService';

interface AdminUserEmailsProps {
    userId: number;
    onClose: () => void;
    // Called after an email went out, so the list can refresh its count.
    onSent?: () => void;
}

// The English names of the emails, by key.
const EMAIL_NAMES: Record<string, string> = {
    verification: 'Verify your email',
    verificationReminder: 'Verification reminder',
    memberInvite: 'Member invite',
    passwordReset: 'Reset your password',
    trialReminder: 'Trial ends soon',
    emptyAccount: 'Account still empty',
    comeBack: 'Come back after a quiet spell',
    deletionWarning: 'Account will be deleted',
};

const BADGE = 'inline-flex px-2 py-0.5 rounded-full text-xs font-medium';
const SENT =
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
const FAILED = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
const NOT_SENT =
    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';

const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

// Every account email for one user: which ones went out and which did not,
// and a way to send one after reading exactly what it says.
const AdminUserEmails: React.FC<AdminUserEmailsProps> = ({
    userId,
    onClose,
    onSent,
}) => {
    const { t } = useTranslation();
    const [data, setData] = useState<AdminUserEmailsData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<AdminEmailPreview | null>(null);
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const name = (key: string) =>
        t(`admin.userEmails.names.${key}`, EMAIL_NAMES[key] || key);

    const load = useCallback(async () => {
        try {
            setData(await fetchUserEmails(userId));
        } catch (err: any) {
            setError(err.message || 'Could not load emails');
        }
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    const openPreview = async (key: string) => {
        setNotice(null);
        setLoadingKey(key);
        try {
            setPreview(await previewUserEmail(userId, key));
        } catch (err: any) {
            setNotice(err.message || 'Could not build the email');
        } finally {
            setLoadingKey(null);
        }
    };

    const confirmSend = async () => {
        if (!preview) return;
        setSending(true);
        try {
            const result = await sendUserEmail(userId, preview.key);
            setNotice(
                result.sent
                    ? t('admin.userEmails.sentNotice', {
                          defaultValue: '{{name}} sent to {{to}}.',
                          name: name(preview.key),
                          to: preview.to,
                      })
                    : t('admin.userEmails.failedNotice', {
                          defaultValue: 'Not sent: {{error}}',
                          error: result.error,
                      })
            );
            setPreview(null);
            await load();
            if (result.sent) onSent?.();
        } catch (err: any) {
            setNotice(err.message || 'Could not send the email');
        } finally {
            setSending(false);
        }
    };

    const statusOf = (e: AdminUserEmailsData['emails'][number]) => {
        if (e.last_sent_at) {
            return (
                <span className={`${BADGE} ${SENT}`}>
                    {t('admin.userEmails.sentOn', {
                        defaultValue: 'Sent {{date}}',
                        date: formatDateTime(e.last_sent_at),
                    })}
                    {e.sent_count > 1 && ` (${e.sent_count}x)`}
                </span>
            );
        }
        if (e.recorded_before_log) {
            return (
                <span className={`${BADGE} ${SENT}`}>
                    {e.recorded_before_log === true
                        ? t(
                              'admin.userEmails.sentBeforeLog',
                              'Sent (before the log)'
                          )
                        : t('admin.userEmails.sentOnBeforeLog', {
                              defaultValue: 'Sent {{date}} (before the log)',
                              date: formatDateTime(e.recorded_before_log),
                          })}
                </span>
            );
        }
        if (e.last_status === 'failed') {
            return (
                <span className={`${BADGE} ${FAILED}`}>
                    {t('admin.userEmails.failed', 'Failed')}
                </span>
            );
        }
        return (
            <span className={`${BADGE} ${NOT_SENT}`}>
                {t('admin.userEmails.notSent', 'Not sent')}
            </span>
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                data-testid="admin-user-emails"
            >
                <div className="flex items-start justify-between gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-900/40 rounded-t-lg">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {preview
                                ? t('admin.userEmails.confirmTitle', {
                                      defaultValue: 'Send "{{name}}"?',
                                      name: name(preview.key),
                                  })
                                : t('admin.userEmails.title', 'Emails')}
                        </h3>
                        {data?.user.email && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {data.user.email} ·{' '}
                                {t('admin.userEmails.language', {
                                    defaultValue: 'Language: {{language}}',
                                    language: data.user.language,
                                })}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        aria-label={t('common.close', 'Close')}
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-6 py-4 space-y-4 text-sm">
                    {error && (
                        <p className="text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )}
                    {notice && (
                        <p
                            className="rounded-md bg-blue-50 dark:bg-blue-900/30 px-3 py-2 text-blue-900 dark:text-blue-100"
                            data-testid="admin-user-emails-notice"
                        >
                            {notice}
                        </p>
                    )}

                    {preview ? (
                        <div
                            className="space-y-3"
                            data-testid="admin-user-email-preview"
                        >
                            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
                                <dt className="text-gray-500 dark:text-gray-400">
                                    {t('admin.userEmails.to', 'To')}
                                </dt>
                                <dd className="text-gray-900 dark:text-gray-100">
                                    {preview.to}
                                </dd>
                                <dt className="text-gray-500 dark:text-gray-400">
                                    {t('admin.userEmails.subject', 'Subject')}
                                </dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">
                                    {preview.subject}
                                </dd>
                            </dl>
                            <pre className="whitespace-pre-wrap break-words rounded-md bg-gray-50 dark:bg-gray-900/50 p-3 font-sans text-gray-800 dark:text-gray-200">
                                {preview.text}
                            </pre>
                            {preview.text.includes(
                                preview.link_placeholder
                            ) && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t(
                                        'admin.userEmails.linkNote',
                                        'The link is created when you send, so the real email has a working link in its place.'
                                    )}
                                </p>
                            )}
                            {preview.note && (
                                <p className="rounded-md bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-amber-900 dark:text-amber-100">
                                    {preview.note}
                                </p>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setPreview(null)}
                                    disabled={sending}
                                    className="px-4 py-2 rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmSend}
                                    disabled={sending}
                                    className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                    data-testid="admin-user-email-confirm"
                                >
                                    {sending
                                        ? t(
                                              'admin.userEmails.sending',
                                              'Sending...'
                                          )
                                        : t(
                                              'admin.userEmails.sendNow',
                                              'Send email'
                                          )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        data && (
                            <>
                                <ul className="space-y-1">
                                    {data.emails.map((e) => (
                                        <li
                                            key={e.key}
                                            className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                                            data-testid={`admin-user-email-${e.key}`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                                    {name(e.key)}
                                                </div>
                                                {e.reason && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        {e.reason}
                                                    </div>
                                                )}
                                            </div>
                                            {statusOf(e)}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openPreview(e.key)
                                                }
                                                disabled={
                                                    !e.can_send ||
                                                    loadingKey !== null
                                                }
                                                className="px-3 py-1 rounded-md text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                data-testid={`admin-user-email-send-${e.key}`}
                                            >
                                                {e.last_sent_at ||
                                                e.recorded_before_log
                                                    ? t(
                                                          'admin.userEmails.sendAgain',
                                                          'Send again'
                                                      )
                                                    : t(
                                                          'admin.userEmails.send',
                                                          'Send'
                                                      )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>

                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                        {t(
                                            'admin.userEmails.history',
                                            'History'
                                        )}
                                    </h4>
                                    {data.history.length === 0 ? (
                                        <p className="text-gray-500 dark:text-gray-400">
                                            {t(
                                                'admin.userEmails.noHistory',
                                                'Nothing recorded yet.'
                                            )}
                                        </p>
                                    ) : (
                                        <ul className="space-y-1">
                                            {data.history.map((h) => (
                                                <li
                                                    key={h.id}
                                                    className="rounded-md bg-gray-50 dark:bg-gray-900/40 px-3 py-2"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`${BADGE} ${h.status === 'sent' ? SENT : FAILED}`}
                                                        >
                                                            {h.status === 'sent'
                                                                ? t(
                                                                      'admin.userEmails.sent',
                                                                      'Sent'
                                                                  )
                                                                : t(
                                                                      'admin.userEmails.failed',
                                                                      'Failed'
                                                                  )}
                                                        </span>
                                                        <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
                                                            {h.subject}
                                                        </span>
                                                    </div>
                                                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                        {formatDateTime(
                                                            h.created_at
                                                        )}{' '}
                                                        · {h.language} ·{' '}
                                                        {h.sent_by
                                                            ? t(
                                                                  'admin.userEmails.sentBy',
                                                                  {
                                                                      defaultValue:
                                                                          'by {{email}}',
                                                                      email: h.sent_by,
                                                                  }
                                                              )
                                                            : t(
                                                                  'admin.userEmails.automatic',
                                                                  'automatic'
                                                              )}
                                                        {h.error &&
                                                            ` · ${h.error}`}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminUserEmails;
