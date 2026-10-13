import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BugAntIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import { submitFeedback } from '../../utils/feedbackService';

const MAX_LENGTH = 5000;

interface FeedbackModalProps {
    onClose: () => void;
    appVersion?: string;
}

// A plain text box that lands in the admin's Feedback page. The page the
// sender is on and the app version go along with it, since "it doesn't
// work" is a lot easier to act on when you know where.
const FeedbackModal: React.FC<FeedbackModalProps> = ({
    onClose,
    appVersion,
}) => {
    const { t } = useTranslation();
    const location = useLocation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const trimmed = message.trim();

    const send = async () => {
        if (!trimmed || sending) return;
        setSending(true);
        try {
            await submitFeedback({
                message: trimmed,
                page_url: `${location.pathname}${location.search}`,
                app_version: appVersion,
            });
            setMessage('');
            showSuccessToast(
                t('feedback.sent', 'Thanks! Your feedback was sent.')
            );
            onClose();
        } catch (err: any) {
            showErrorToast(
                err.message ||
                    t('feedback.failed', 'Could not send your feedback')
            );
        } finally {
            setSending(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="feedback-modal-title"
                className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-6 sm:p-8"
                onClick={(e) => e.stopPropagation()}
                data-testid="feedback-modal"
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-500/10 mr-3">
                            <BugAntIcon className="w-5 h-5 text-rose-500" />
                        </span>
                        <div>
                            <h2
                                id="feedback-modal-title"
                                className="text-lg font-semibold text-gray-900 dark:text-white"
                            >
                                {t('feedback.title', 'Send feedback')}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {t(
                                    'feedback.subtitle',
                                    'Found a bug or have an idea? Let us know.'
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
                        aria-label={t('common.close', 'Close')}
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        send();
                    }}
                >
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                send();
                            }
                        }}
                        maxLength={MAX_LENGTH}
                        rows={9}
                        placeholder={t(
                            'feedback.placeholder',
                            'What happened, or what would make tududi better?'
                        )}
                        className="w-full min-h-[200px] resize-y rounded-xl bg-gray-50 dark:bg-gray-900/60 px-4 py-3 text-[15px] leading-relaxed text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        data-testid="feedback-message"
                    />
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                        {t(
                            'feedback.contextNote',
                            'The page you are on and the app version are sent along with your message.'
                        )}
                    </p>
                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={!trimmed || sending}
                            className="px-4 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                            data-testid="feedback-submit"
                        >
                            {sending
                                ? t('feedback.sending', 'Sending...')
                                : t('feedback.send', 'Send')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FeedbackModal;
