import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    AppriseConfig,
    getAppriseConfig,
    removeAppriseConfig,
    saveAppriseConfig,
} from '../../../utils/appriseService';

interface AppriseCardProps {
    onStateChange: (configured: boolean) => void;
}

const inputClass =
    'w-full rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

const AppriseCard: React.FC<AppriseCardProps> = ({ onStateChange }) => {
    const { t } = useTranslation();
    const [config, setConfig] = React.useState<AppriseConfig | null>(null);
    const [url, setUrl] = React.useState('');
    const [key, setKey] = React.useState('');
    const [tags, setTags] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState<{
        ok: boolean;
        text: string;
    } | null>(null);

    React.useEffect(() => {
        getAppriseConfig()
            .then((data) => {
                setConfig(data);
                setTags(data.tags);
                onStateChange(data.configured);
            })
            .catch(() => {
                setConfig({ configured: false, host: null, tags: '' });
                onStateChange(false);
            });
    }, [onStateChange]);

    const handleSave = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const saved = await saveAppriseConfig({ url, key, tags });
            setConfig(saved);
            onStateChange(saved.configured);
            setUrl('');
            setKey('');
            setMessage({
                ok: true,
                text: t('notifications.apprise.saved', 'Apprise server saved.'),
            });
        } catch (error) {
            setMessage({
                ok: false,
                text: (error as Error).message,
            });
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const cleared = await removeAppriseConfig();
            setConfig(cleared);
            setTags('');
            onStateChange(false);
        } catch (error) {
            setMessage({ ok: false, text: (error as Error).message });
        } finally {
            setBusy(false);
        }
    };

    const configured = !!config?.configured;

    return (
        <div className="mb-6 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('notifications.apprise.title', 'Apprise')}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {configured
                            ? t(
                                  'notifications.apprise.connected',
                                  'Sending through {{host}}.',
                                  { host: config?.host || '' }
                              )
                            : t(
                                  'notifications.apprise.description',
                                  'Send notifications through your own Apprise server to Pushover, ntfy, Discord, Matrix and more.'
                              )}
                    </p>
                </div>
                {configured && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        disabled={busy}
                        className="px-2.5 py-1 text-xs font-medium rounded-md text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-40 transition-colors"
                    >
                        {t('notifications.apprise.remove', 'Remove')}
                    </button>
                )}
            </div>

            {!configured && config && (
                <form
                    className="mt-4 grid gap-3 sm:grid-cols-3"
                    autoComplete="off"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (url && key && !busy) handleSave();
                    }}
                >
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="http://192.168.1.10:8000"
                        aria-label={t(
                            'notifications.apprise.serverLabel',
                            'Apprise server address'
                        )}
                        className={inputClass}
                    />
                    <input
                        type="password"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder={t(
                            'notifications.apprise.keyPlaceholder',
                            'Config key'
                        )}
                        aria-label={t(
                            'notifications.apprise.keyLabel',
                            'Config key'
                        )}
                        className={inputClass}
                    />
                    <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder={t(
                            'notifications.apprise.tagsPlaceholder',
                            'Tags (optional, e.g. all)'
                        )}
                        aria-label={t(
                            'notifications.apprise.tagsLabel',
                            'Tags'
                        )}
                        className={inputClass}
                    />
                    <div className="sm:col-span-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'notifications.apprise.help',
                                'Create a configuration in your Apprise server and paste its key here.'
                            )}
                        </p>
                        <button
                            type="submit"
                            disabled={!url || !key || busy}
                            className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            {busy
                                ? t('notifications.test.sending', 'Sending...')
                                : t('notifications.apprise.save', 'Save')}
                        </button>
                    </div>
                </form>
            )}

            {message && (
                <p
                    role="status"
                    className={`mt-3 text-sm ${message.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
                >
                    {message.text}
                </p>
            )}
        </div>
    );
};

export default AppriseCard;
