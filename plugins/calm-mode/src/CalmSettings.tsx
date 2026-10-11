import type { FC } from 'react';
import type { PluginApi } from './host-api';
import { getReact } from './react';
import {
    applyQuietPreferences,
    isQuieted,
    restorePushFlags,
    snapshotPushFlags,
    type NotificationPreferences,
    type PushSnapshot,
} from './preferences';

export interface CalmSettingsState {
    enabled: boolean;
    reduceNavigation: boolean;
    quietNotifications: boolean;
    /** Push flags as they were before Calm Mode quietened them. */
    pushSnapshot: PushSnapshot | null;
}

export const DEFAULT_SETTINGS: CalmSettingsState = {
    enabled: false,
    reduceNavigation: false,
    quietNotifications: false,
    pushSnapshot: null,
};

interface ProfileResponse {
    notification_preferences?: NotificationPreferences;
}

/** Kept in step with the id registered in index.tsx. */
const THEME_ID = 'calm';

const describeError = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

/**
 * The settings panel, rendered by the host inside the Plugins profile tab.
 *
 * `onChange` is called after every write so the plugin's own activation state
 * (the theme, the navigation filter) stays in step without the panel needing a
 * reference to it.
 */
export const createCalmSettings =
    (
        api: PluginApi,
        onChange: (settings: CalmSettingsState) => void
    ): FC =>
    () => {
        const React = getReact();
        const { useCallback, useEffect, useState } = React;

        const [settings, setSettings] = useState<CalmSettingsState>(
            DEFAULT_SETTINGS
        );
        const [message, setMessage] = useState<string | null>(null);
        const [busy, setBusy] = useState(false);

        const load = useCallback(async () => {
            const stored = await api.settings.get();
            const merged: CalmSettingsState = {
                ...DEFAULT_SETTINGS,
                ...(stored as Partial<CalmSettingsState>),
            };

            // The theme can also be switched from the host's theme list, so the
            // checkbox is reconciled with what is actually applied rather than
            // with what was last saved here.
            merged.enabled = api.activeTheme() === THEME_ID;

            setSettings(merged);
            onChange(merged);
        }, []);

        useEffect(() => {
            load().catch((error) => setMessage(describeError(error)));
        }, [load]);

        const save = async (patch: Partial<CalmSettingsState>) => {
            setBusy(true);
            setMessage(null);
            try {
                await api.settings.set(patch as Record<string, unknown>);
                const next = { ...settings, ...patch };

                setSettings(next);
                onChange(next);
            } catch (error) {
                setMessage(describeError(error));
            } finally {
                setBusy(false);
            }
        };

        /**
         * Quieting writes to the account's notification preferences, which is
         * someone else's data, so the previous push flags are captured first
         * and put back exactly on the way out. A plugin that changed these
         * without a way back would be a trap.
         */
        const setQuiet = async (enable: boolean) => {
            setBusy(true);
            setMessage(null);
            try {
                const profile = await api.api.get<ProfileResponse>('profile');
                const current = profile?.notification_preferences;

                if (!current || Object.keys(current).length === 0) {
                    setMessage(
                        'This account has no per-type notification settings yet, so there is nothing to quieten.'
                    );
                    return;
                }

                if (enable) {
                    if (!isQuieted(current)) {
                        const snapshot = snapshotPushFlags(current);
                        await api.api.patch('profile', {
                            notification_preferences:
                                applyQuietPreferences(current),
                        });
                        await save({
                            quietNotifications: true,
                            pushSnapshot: snapshot,
                        });
                        setMessage(
                            'Push is now off for reminders about things becoming due or overdue. Assigned tasks and replies still reach you, and nothing was hidden in the app.'
                        );
                        return;
                    }
                    await save({ quietNotifications: true });
                    return;
                }

                await api.api.patch('profile', {
                    notification_preferences: restorePushFlags(
                        current,
                        settings.pushSnapshot
                    ),
                });
                await save({
                    quietNotifications: false,
                    pushSnapshot: null,
                });
                setMessage('Your previous notification settings are back.');
            } catch (error) {
                setMessage(describeError(error));
            } finally {
                setBusy(false);
            }
        };

        const row = (
            id: string,
            label: string,
            hint: string,
            checked: boolean,
            onToggle: (next: boolean) => void
        ) => (
            <div className="flex items-start gap-3 py-3">
                <input
                    id={id}
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    disabled={busy}
                    onChange={(event) => onToggle(event.target.checked)}
                />
                <label htmlFor={id} className="text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                        {label}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-600 dark:text-gray-400">
                        {hint}
                    </span>
                </label>
            </div>
        );

        return (
            <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Calm Mode
                </h4>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Lower stimulation, fewer decisions. Everything here changes
                    how Tududi presents itself — your tasks, projects and areas
                    are untouched, and switching it off puts everything back.
                </p>

                <div className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
                    {row(
                        'calm-enabled',
                        'Turn Calm Mode on',
                        'Slower motion, higher contrast on focus, softer urgency colours, and more comfortable line spacing.',
                        settings.enabled,
                        (next) => {
                            save({ enabled: next });
                        }
                    )}
                    {row(
                        'calm-nav',
                        'Show less navigation',
                        'Keeps Today, Inbox and Upcoming. Projects, areas, goals, notes, tags and the rest stay exactly where they are — reach them through Today or by address.',
                        settings.reduceNavigation,
                        (next) => {
                            save({ reduceNavigation: next });
                        }
                    )}
                    {row(
                        'calm-quiet',
                        'Quieten reminders',
                        'Turns off push for things becoming due or overdue. Assigned tasks and replies still reach you. Reversible.',
                        settings.quietNotifications,
                        (next) => {
                            setQuiet(next);
                        }
                    )}
                </div>

                {message && (
                    <p className="mt-3 text-xs text-gray-700 dark:text-gray-300">
                        {message}
                    </p>
                )}
            </div>
        );
    };
