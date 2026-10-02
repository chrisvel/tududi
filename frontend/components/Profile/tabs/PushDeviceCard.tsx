import React from 'react';
import { useTranslation } from 'react-i18next';
import { DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import {
    PushState,
    disablePush,
    enablePush,
    getPushState,
    sendTestPush,
} from '../../../utils/pushService';
import { getCurrentUser } from '../../../utils/userUtils';

interface PushDeviceCardProps {
    onStateChange: (state: PushState) => void;
}

const PushDeviceCard: React.FC<PushDeviceCardProps> = ({ onStateChange }) => {
    const { t } = useTranslation();
    const [state, setState] = React.useState<PushState | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState('');

    const update = React.useCallback(
        (next: PushState) => {
            setState(next);
            onStateChange(next);
        },
        [onStateChange]
    );

    React.useEffect(() => {
        getPushState()
            .then(update)
            .catch(() => update('unsupported'));
    }, [update]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setMessage('');
        try {
            await action();
        } catch (error) {
            setMessage(
                (error as Error).message ||
                    t(
                        'notifications.push.failed',
                        'Something went wrong. Please try again.'
                    )
            );
        } finally {
            setBusy(false);
        }
    };

    const handleEnable = () =>
        run(async () => {
            const user = getCurrentUser();
            update(await enablePush(user?.uid ?? ''));
        });

    const handleDisable = () =>
        run(async () => {
            update(await disablePush());
        });

    const handleTest = () =>
        run(async () => {
            const sent = await sendTestPush();
            setMessage(
                sent > 0
                    ? t(
                          'notifications.push.testSent',
                          'Test notification sent.'
                      )
                    : t(
                          'notifications.push.testNone',
                          'No device accepted the notification. Try turning push off and on again.'
                      )
            );
        });

    if (state === null) return null;

    const buttonClass =
        'px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

    let body: React.ReactNode;
    if (state === 'needs-install') {
        body = t(
            'notifications.push.needsInstall',
            'To get notifications on iPhone or iPad, add tududi to your Home Screen first: tap Share, then Add to Home Screen, and open it from there.'
        );
    } else if (state === 'unsupported') {
        body = t(
            'notifications.push.unsupported',
            'This browser does not support push notifications.'
        );
    } else if (state === 'denied') {
        body = t(
            'notifications.push.denied',
            'Notifications are blocked for tududi. Allow them in your browser or system settings, then come back here.'
        );
    } else if (state === 'subscribed') {
        body = t(
            'notifications.push.subscribed',
            'This device receives push notifications. Choose which ones in the Push column below.'
        );
    } else {
        body = t(
            'notifications.push.prompt',
            'Get notifications on this device even when tududi is closed.'
        );
    }

    return (
        <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/60">
            <div className="flex items-start gap-3">
                <DevicePhoneMobileIcon className="w-5 h-5 mt-0.5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {t(
                            'notifications.push.title',
                            'Push notifications on this device'
                        )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {body}
                    </p>
                    {message && (
                        <p className="text-xs text-gray-700 dark:text-gray-300 mt-2">
                            {message}
                        </p>
                    )}
                </div>
                <div className="flex flex-shrink-0 gap-2">
                    {state === 'default' && (
                        <button
                            type="button"
                            onClick={handleEnable}
                            disabled={busy}
                            className={`${buttonClass} text-white bg-blue-600 hover:bg-blue-700`}
                        >
                            {t('notifications.push.enable', 'Turn on')}
                        </button>
                    )}
                    {state === 'subscribed' && (
                        <>
                            <button
                                type="button"
                                onClick={handleTest}
                                disabled={busy}
                                className={`${buttonClass} text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600`}
                            >
                                {t('notifications.push.test', 'Send test')}
                            </button>
                            <button
                                type="button"
                                onClick={handleDisable}
                                disabled={busy}
                                className={`${buttonClass} text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600`}
                            >
                                {t('notifications.push.disable', 'Turn off')}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PushDeviceCard;
