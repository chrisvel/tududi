// Life-to-Day (T-901, T-903): connect, status and disconnect for Google
// Calendar. Rendered inside the profile <form>, so buttons are type="button".
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useToast } from '../Shared/ToastContext';
import {
    GcalStatus,
    disconnectGcal,
    fetchGcalStatus,
    setGcalExport,
    startGcalConnect,
} from '../../utils/gcalService';

const button =
    'inline-flex min-h-[40px] items-center rounded-md px-4 text-sm font-medium disabled:opacity-50';

const GoogleCalendarCard: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [state, setState] = useState<GcalStatus | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        fetchGcalStatus()
            .then(setState)
            .catch(() => setState(null));
    }, []);

    useEffect(() => {
        const result = new URLSearchParams(location.search).get('gcal');
        if (result === 'connected') {
            showSuccessToast(
                t('profile.gcal.connected', 'Google Calendar connected')
            );
        } else if (result === 'error') {
            showErrorToast(
                t(
                    'profile.gcal.connectError',
                    'Google Calendar was not connected. Try again.'
                )
            );
        }
    }, [location.search]);

    const run = async (fn: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
        } catch (err) {
            showErrorToast((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const connect = () =>
        run(async () => {
            const { url } = await startGcalConnect();
            window.location.assign(url);
        });

    const disconnect = () =>
        run(async () => {
            const result = await disconnectGcal();
            if (result.revoked) {
                showSuccessToast(
                    t(
                        'profile.gcal.disconnected',
                        'Google Calendar disconnected'
                    )
                );
            } else {
                showErrorToast(
                    t(
                        'profile.gcal.revokeFailed',
                        'Removed here, but Google did not confirm. Remove Life-to-Day at myaccount.google.com/permissions.'
                    )
                );
            }
            setState(await fetchGcalStatus());
        });

    const toggleExport = (on: boolean) =>
        run(async () => setState(await setGcalExport(on)));

    if (!state) return null;

    return (
        <section
            className="mb-8 space-y-3 rounded-lg border border-gray-200 p-5 dark:border-gray-700"
            aria-labelledby="gcal-title"
        >
            <h4
                id="gcal-title"
                className="text-base font-medium text-gray-900 dark:text-white"
            >
                {t('profile.gcal.title', 'Google Calendar')}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
                {t(
                    'profile.gcal.description',
                    'Count busy time from all your Google calendars in the day plan. Life-to-Day reads them and never changes them. When connected, it replaces the iCal address for planning.'
                )}
            </p>

            {!state.available ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t(
                        'profile.gcal.unavailable',
                        'Google Calendar is not set up on this server yet.'
                    )}
                </p>
            ) : !state.connected ? (
                <button
                    type="button"
                    onClick={connect}
                    disabled={busy}
                    className={`${button} bg-blue-600 text-white hover:bg-blue-500`}
                >
                    {t('profile.gcal.connect', 'Connect Google Calendar')}
                </button>
            ) : (
                <>
                    <p
                        className="text-sm text-gray-700 dark:text-gray-300"
                        role="status"
                    >
                        {state.status === 'revoked'
                            ? t(
                                  'profile.gcal.revoked',
                                  'Google access was withdrawn. Disconnect, then connect again.'
                              )
                            : state.last_error
                              ? t(
                                    'profile.gcal.syncFailed',
                                    'The last sync failed. Life-to-Day will try again in a few minutes.'
                                )
                              : state.last_sync_at
                                ? t('profile.gcal.lastSync', {
                                      defaultValue:
                                          'Connected. Last sync {{time}}',
                                      time: new Date(
                                          state.last_sync_at
                                      ).toLocaleString(),
                                  })
                                : t(
                                      'profile.gcal.firstSync',
                                      'Connected. The first sync is running.'
                                  )}
                    </p>
                    {state.can_export && state.status === 'active' && (
                        <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                            <input
                                type="checkbox"
                                checked={state.export_enabled}
                                disabled={busy}
                                onChange={(e) => toggleExport(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300"
                            />
                            {t(
                                'profile.gcal.export',
                                'Show my time blocks in a separate "Life-to-Day" calendar in Google'
                            )}
                        </label>
                    )}
                    <button
                        type="button"
                        onClick={disconnect}
                        disabled={busy}
                        className={`${button} border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700`}
                    >
                        {t('profile.gcal.disconnect', 'Disconnect')}
                    </button>
                </>
            )}
        </section>
    );
};

export default GoogleCalendarCard;
