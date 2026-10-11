import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowPathIcon,
    ArrowUpTrayIcon,
    ExclamationTriangleIcon,
    PuzzlePieceIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import PluginBoundary from '../../../plugins/PluginBoundary';
import { useOptionalPluginHost } from '../../../plugins/context';
import { installPlugin, removePlugin } from '../../../utils/pluginService';

interface PluginsTabProps {
    isActive: boolean;
}

const cardClass =
    'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4';

const Toggle: React.FC<{
    enabled: boolean;
    busy: boolean;
    onToggle: () => void;
    label: string;
}> = ({ enabled, busy, onToggle, label }) => (
    <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={enabled}
        aria-label={label}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
    >
        <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
        />
    </button>
);

/**
 * Installed plugins, what the host refused to load and why, plus the themes and
 * settings panels plugins have contributed.
 *
 * The trust warning is not boilerplate: a plugin's code runs in this page with
 * the signed-in user's session, so installing one is a decision about whom to
 * trust, not a setting.
 *
 * Enabling a plugin changes what this account loads; installing or removing one
 * changes what the server has, which is why those controls only appear when the
 * server says this account may use them.
 */
const PluginsTab: React.FC<PluginsTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const host = useOptionalPluginHost();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [installing, setInstalling] = useState(false);
    // The plugin an upload is expected to be, when it was started from a row.
    const [updateTarget, setUpdateTarget] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    if (!isActive) return null;

    if (!host) {
        return (
            <div className={cardClass}>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t(
                        'plugins.unavailable',
                        'The plugin host is not running on this page.'
                    )}
                </p>
            </div>
        );
    }

    const { response, plugins, failed, snapshot, status, error } = host;

    const toggle = async (pluginId: string, next: boolean) => {
        setBusyId(pluginId);
        setActionError(null);
        try {
            await host.setEnabled(pluginId, next);
        } catch (toggleError) {
            setActionError(
                toggleError instanceof Error
                    ? toggleError.message
                    : String(toggleError)
            );
        } finally {
            setBusyId(null);
        }
    };

    const loadErrorFor = (pluginId: string) =>
        failed.find((entry) => entry.id === pluginId)?.error || null;

    const canManage = response?.canManage === true;

    const errorText = (error: unknown) =>
        error instanceof Error ? error.message : String(error);

    /**
     * Installing and updating are the same request: the archive carries the
     * plugin's own id, so there is no way to upload one *as* something else.
     * The row's button only records which plugin the file should turn out to
     * be, so that picking the wrong archive says so instead of quietly
     * installing a second plugin.
     */
    const chooseArchive = (targetPluginId: string | null) => {
        setUpdateTarget(targetPluginId);
        setActionError(null);
        setNotice(null);
        fileInput.current?.click();
    };

    const handleArchiveChosen = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        // Reset it so choosing the same file twice still fires a change event.
        event.target.value = '';
        if (!file) return;

        const expected = updateTarget;
        setInstalling(true);
        setActionError(null);
        setNotice(null);

        try {
            const updated = await installPlugin(file);
            const summary = updated.install;

            if (summary && expected && summary.id !== expected) {
                setActionError(
                    t(
                        'plugins.wrongArchive',
                        'That archive contains {{actual}}, not {{expected}}. It was installed under its own id instead.',
                        { actual: summary.id, expected }
                    )
                );
            } else if (summary) {
                const label = summary.version
                    ? `${summary.name} v${summary.version}`
                    : summary.name;
                setNotice(
                    summary.updated
                        ? t('plugins.updated', 'Updated {{plugin}}.', {
                              plugin: label,
                          })
                        : t('plugins.installed', 'Installed {{plugin}}.', {
                              plugin: label,
                          })
                );
            }

            await host.reload();
        } catch (error) {
            setActionError(errorText(error));
        } finally {
            setInstalling(false);
            setUpdateTarget(null);
        }
    };

    const remove = async (pluginId: string) => {
        setRemovingId(pluginId);
        setActionError(null);
        setNotice(null);

        try {
            await removePlugin(pluginId);
            setNotice(
                t('plugins.removed', 'Removed {{id}}.', { id: pluginId })
            );
            await host.reload();
        } catch (error) {
            setActionError(errorText(error));
        } finally {
            setRemovingId(null);
            setConfirmingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className={cardClass}>
                <div className="flex items-start gap-3">
                    <PuzzlePieceIcon className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400" />
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {t('plugins.title', 'Plugins')}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            {t(
                                'plugins.description',
                                'Plugins add features to this instance. They are installed by whoever runs the server, and each account chooses which ones to use.'
                            )}
                        </p>
                    </div>
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 p-3">
                    <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                        {t(
                            'plugins.trustWarning',
                            'Plugin code runs in this page with your own signed-in session. Only enable plugins you trust: a plugin can act as you and read what you can read.'
                        )}
                    </p>
                </div>

                {response && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 break-all">
                        {t('plugins.directory', 'Server plugin directory')}:{' '}
                        <code>{response.pluginsDir}</code>
                    </p>
                )}

                {response && !response.canManage && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {t(
                            'plugins.adminOnly',
                            'Only an administrator can install, update or remove plugins on this server.'
                        )}
                    </p>
                )}
            </div>

            {canManage && (
                <div className={cardClass}>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('plugins.installTitle', 'Install a plugin')}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {t(
                            'plugins.installDescription',
                            'Upload a .zip archive of a plugin built for this host: the plugin folder itself, or its files with plugin.json at the top of the archive. The code goes onto the server; each account still chooses whether to enable it.'
                        )}
                    </p>

                    <input
                        ref={fileInput}
                        type="file"
                        accept=".zip,application/zip"
                        onChange={handleArchiveChosen}
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={() => chooseArchive(null)}
                        disabled={installing}
                        className="mt-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
                    >
                        <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
                        {installing && !updateTarget
                            ? t('plugins.installing', 'Installing…')
                            : t(
                                  'plugins.chooseArchive',
                                  'Choose a .zip archive'
                              )}
                    </button>

                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {t(
                            'plugins.installLimits',
                            'Up to 10 MB. Uploading a plugin that is already installed replaces it with the archive’s version.'
                        )}
                    </p>
                </div>
            )}

            {status === 'error' && (
                <div className={cardClass}>
                    <p className="text-sm text-red-700 dark:text-red-400">
                        {t(
                            'plugins.listFailed',
                            'Could not read the plugin list.'
                        )}
                        {error ? ` ${error}` : ''}
                    </p>
                </div>
            )}

            {actionError && (
                <div className={cardClass}>
                    <p className="text-sm text-red-700 dark:text-red-400">
                        {actionError}
                    </p>
                </div>
            )}

            {notice && (
                <div className={cardClass}>
                    <p className="text-sm text-green-700 dark:text-green-400">
                        {notice}
                    </p>
                </div>
            )}

            {response && response.plugins.length === 0 && (
                <div className={cardClass}>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t(
                            'plugins.noneInstalled',
                            'No plugins are installed on this instance.'
                        )}
                    </p>
                </div>
            )}

            {response?.plugins.map((plugin) => {
                const loadError = loadErrorFor(plugin.id);
                return (
                    <div key={plugin.id} className={cardClass}>
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        {plugin.name}
                                    </h4>
                                    {plugin.version && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            v{plugin.version}
                                        </span>
                                    )}
                                    {!plugin.ok && (
                                        <span className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                                            {t(
                                                'plugins.incompatible',
                                                'Not usable'
                                            )}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    <code>{plugin.id}</code>
                                </p>
                                {plugin.description && (
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                        {plugin.description}
                                    </p>
                                )}
                                {plugin.errors.length > 0 && (
                                    <ul className="mt-2 list-disc pl-5 text-xs text-red-700 dark:text-red-400">
                                        {plugin.errors.map((message) => (
                                            <li key={message}>{message}</li>
                                        ))}
                                    </ul>
                                )}
                                {loadError && (
                                    <p className="mt-2 text-xs text-red-700 dark:text-red-400">
                                        {t(
                                            'plugins.loadFailed',
                                            'Failed to load:'
                                        )}{' '}
                                        {loadError}
                                    </p>
                                )}
                            </div>

                            <Toggle
                                enabled={plugin.enabled}
                                busy={busyId === plugin.id}
                                onToggle={() =>
                                    toggle(plugin.id, !plugin.enabled)
                                }
                                label={t('plugins.toggle', 'Enable {{name}}', {
                                    name: plugin.name,
                                })}
                            />
                        </div>

                        {canManage && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                                {confirmingId === plugin.id ? (
                                    <>
                                        <span className="text-xs text-gray-600 dark:text-gray-300">
                                            {t(
                                                'plugins.confirmRemove',
                                                'Remove this plugin from the server? Every account loses it.'
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => remove(plugin.id)}
                                            disabled={removingId === plugin.id}
                                            className="inline-flex items-center rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs text-red-700 dark:text-red-300 hover:border-red-500 disabled:opacity-50"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5 mr-1" />
                                            {removingId === plugin.id
                                                ? t(
                                                      'plugins.removing',
                                                      'Removing…'
                                                  )
                                                : t(
                                                      'plugins.confirmRemoveAction',
                                                      'Remove'
                                                  )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setConfirmingId(null)
                                            }
                                            disabled={removingId === plugin.id}
                                            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 disabled:opacity-50"
                                        >
                                            {t('plugins.cancel', 'Cancel')}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                chooseArchive(plugin.id)
                                            }
                                            disabled={installing}
                                            className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
                                        >
                                            <ArrowPathIcon className="w-3.5 h-3.5 mr-1" />
                                            {installing &&
                                            updateTarget === plugin.id
                                                ? t(
                                                      'plugins.installing',
                                                      'Installing…'
                                                  )
                                                : t(
                                                      'plugins.update',
                                                      'Update from file'
                                                  )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setConfirmingId(plugin.id);
                                                setActionError(null);
                                                setNotice(null);
                                            }}
                                            className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:border-red-500 hover:text-red-600 dark:hover:text-red-400"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5 mr-1" />
                                            {t('plugins.remove', 'Remove')}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {snapshot.settingsPanels
                            .filter((panel) => panel.pluginId === plugin.id)
                            .map((panel) => (
                                <div
                                    key={panel.key}
                                    className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4"
                                >
                                    <PluginBoundary pluginId={plugin.id}>
                                        <panel.element />
                                    </PluginBoundary>
                                </div>
                            ))}
                    </div>
                );
            })}

            {snapshot.themes.length > 0 && (
                <div className={cardClass}>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('plugins.themes', 'Appearance')}
                    </h4>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t(
                            'plugins.themesHint',
                            'Themes contributed by plugins, applied across the whole app.'
                        )}
                    </p>
                    <div className="mt-3 space-y-2">
                        <button
                            type="button"
                            onClick={() => host.setActiveThemeKey(null)}
                            aria-pressed={host.activeThemeKey === null}
                            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                                host.activeThemeKey === null
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                    : 'border-gray-200 dark:border-gray-700'
                            }`}
                        >
                            {t('plugins.themeDefault', 'Default')}
                        </button>
                        {snapshot.themes.map((theme) => (
                            <button
                                key={theme.key}
                                type="button"
                                onClick={() =>
                                    host.setActiveThemeKey(theme.key)
                                }
                                aria-pressed={host.activeThemeKey === theme.key}
                                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                                    host.activeThemeKey === theme.key
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                        : 'border-gray-200 dark:border-gray-700'
                                }`}
                            >
                                {theme.label || theme.key}
                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                    {theme.pluginId}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {plugins.length > 0 && (
                <div className={cardClass}>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('plugins.loaded', 'Active plugins')}
                    </h4>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                        {plugins.map((plugin) => (
                            <li key={plugin.id}>
                                {plugin.name}
                                {plugin.version ? ` v${plugin.version}` : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default PluginsTab;
