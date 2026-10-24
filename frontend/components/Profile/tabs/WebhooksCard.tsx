import React from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import {
    Webhook,
    WebhookDelivery,
    WEBHOOK_EVENT_GROUPS,
    createWebhook,
    deleteWebhook,
    listWebhookDeliveries,
    listWebhooks,
    rotateWebhookSecret,
    testWebhook,
    updateWebhook,
} from '../../../utils/webhooksService';
import { useTrialLock } from '../../../hooks/useTrialStatus';
import TrialLockNotice from '../../Billing/TrialLockNotice';

const inputClass =
    'w-full rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500';
const smallButton =
    'px-2.5 py-1 text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const primaryButton =
    'px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

const DEFAULT_EVENTS = ['task.due_soon', 'task.overdue', 'task.reminder'];

const eventLabel = (t: TFunction, event: string) =>
    ({
        'task.due_soon': t(
            'notifications.webhooks.events.taskDueSoon',
            'Task due soon'
        ),
        'task.overdue': t(
            'notifications.webhooks.events.taskOverdue',
            'Task overdue'
        ),
        'task.reminder': t(
            'notifications.webhooks.events.taskReminder',
            'Task reminder'
        ),
        'task.deferred_ready': t(
            'notifications.webhooks.events.taskDeferredReady',
            'Deferred task is active'
        ),
        'task.assigned': t(
            'notifications.webhooks.events.taskAssigned',
            'Task assigned to you'
        ),
        'project.due_soon': t(
            'notifications.webhooks.events.projectDueSoon',
            'Project due soon'
        ),
        'project.overdue': t(
            'notifications.webhooks.events.projectOverdue',
            'Project overdue'
        ),
        'habit.reminder': t(
            'notifications.webhooks.events.habitReminder',
            'Habit reminder'
        ),
        'comment.added': t(
            'notifications.webhooks.events.commentAdded',
            'New comment'
        ),
        'comment.mention': t(
            'notifications.webhooks.events.commentMention',
            'Mention'
        ),
        'share.invitation': t(
            'notifications.webhooks.events.shareInvitation',
            'Share invitation'
        ),
        'task.created': t(
            'notifications.webhooks.events.taskCreated',
            'Task created'
        ),
        'task.updated': t(
            'notifications.webhooks.events.taskUpdated',
            'Task changed'
        ),
        'task.completed': t(
            'notifications.webhooks.events.taskCompleted',
            'Task completed'
        ),
        'task.deleted': t(
            'notifications.webhooks.events.taskDeleted',
            'Task deleted'
        ),
        daily_summary: t(
            'notifications.webhooks.events.dailySummary',
            'Daily summary'
        ),
        test: t('notifications.webhooks.events.test', 'Test'),
    })[event] || event;

const groupLabel = (t: TFunction, key: string) =>
    ({
        alerts: t(
            'notifications.webhooks.groups.alerts',
            'Reminders and alerts'
        ),
        changes: t('notifications.webhooks.groups.changes', 'Task changes'),
        summary: t('notifications.webhooks.groups.summary', 'Daily summary'),
    })[key] || key;

interface FormState {
    name: string;
    url: string;
    events: string[];
    summaryHour: number;
}

const emptyForm: FormState = {
    name: '',
    url: '',
    events: DEFAULT_EVENTS,
    summaryHour: 8,
};

interface WebhookFormProps {
    initial: FormState;
    editing: boolean;
    busy: boolean;
    onCancel: () => void;
    onSubmit: (form: FormState) => void;
}

const WebhookForm: React.FC<WebhookFormProps> = ({
    initial,
    editing,
    busy,
    onCancel,
    onSubmit,
}) => {
    const { t } = useTranslation();
    const [form, setForm] = React.useState<FormState>(initial);

    const toggleEvent = (event: string) =>
        setForm((prev) => ({
            ...prev,
            events: prev.events.includes(event)
                ? prev.events.filter((e) => e !== event)
                : [...prev.events, event],
        }));

    const canSubmit =
        !busy &&
        form.name.trim() !== '' &&
        form.events.length > 0 &&
        (editing || form.url.trim() !== '');

    return (
        <form
            className="mt-4 space-y-4"
            autoComplete="off"
            onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) onSubmit(form);
            }}
        >
            <div className="grid gap-3 sm:grid-cols-3">
                <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t(
                        'notifications.webhooks.namePlaceholder',
                        'Name, e.g. n8n'
                    )}
                    aria-label={t('notifications.webhooks.nameLabel', 'Name')}
                    maxLength={100}
                    className={inputClass}
                />
                <input
                    type="url"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder={
                        editing
                            ? t(
                                  'notifications.webhooks.urlKeepPlaceholder',
                                  'New address (leave empty to keep it)'
                              )
                            : 'https://n8n.example.com/webhook/tududi'
                    }
                    aria-label={t(
                        'notifications.webhooks.urlLabel',
                        'Webhook address'
                    )}
                    className={`${inputClass} sm:col-span-2`}
                />
            </div>

            {WEBHOOK_EVENT_GROUPS.map((group) => (
                <fieldset key={group.key}>
                    <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        {groupLabel(t, group.key)}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                        {group.events.map((event) => {
                            const on = form.events.includes(event);
                            return (
                                <button
                                    key={event}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={on}
                                    onClick={() => toggleEvent(event)}
                                    className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                                        on
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {eventLabel(t, event)}
                                </button>
                            );
                        })}
                        {group.key === 'summary' &&
                            form.events.includes('daily_summary') && (
                                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    {t(
                                        'notifications.webhooks.summaryAt',
                                        'at'
                                    )}
                                    <select
                                        value={form.summaryHour}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                summaryHour: Number(
                                                    e.target.value
                                                ),
                                            })
                                        }
                                        className="rounded-md bg-white dark:bg-gray-700 px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
                                    >
                                        {Array.from({ length: 24 }, (_, h) => (
                                            <option key={h} value={h}>
                                                {`${String(h).padStart(2, '0')}:00`}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                    </div>
                </fieldset>
            ))}

            <div className="flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className={smallButton}
                >
                    {t('common.cancel', 'Cancel')}
                </button>
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className={primaryButton}
                >
                    {busy
                        ? t('notifications.webhooks.saving', 'Saving...')
                        : t('notifications.webhooks.save', 'Save')}
                </button>
            </div>
        </form>
    );
};

const DeliveryList: React.FC<{ uid: string }> = ({ uid }) => {
    const { t } = useTranslation();
    const [rows, setRows] = React.useState<WebhookDelivery[] | null>(null);
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        listWebhookDeliveries(uid)
            .then(setRows)
            .catch(() => setFailed(true));
    }, [uid]);

    if (failed) {
        return (
            <p className="mt-2 text-xs text-red-700 dark:text-red-400">
                {t(
                    'notifications.webhooks.deliveriesFailed',
                    'Could not load deliveries.'
                )}
            </p>
        );
    }
    if (!rows) return null;
    if (rows.length === 0) {
        return (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('notifications.webhooks.noDeliveries', 'Nothing sent yet.')}
            </p>
        );
    }
    return (
        <ul className="mt-2 space-y-1 text-xs">
            {rows.map((row) => (
                <li
                    key={row.uid}
                    className="flex items-center justify-between gap-3 text-gray-600 dark:text-gray-400"
                >
                    <span className="truncate">
                        {eventLabel(t, row.event)}
                        <span className="ml-2 text-gray-400">
                            {new Date(row.created_at).toLocaleString()}
                        </span>
                    </span>
                    <span
                        className={
                            row.status === 'delivered'
                                ? 'text-green-700 dark:text-green-400'
                                : row.status === 'failed'
                                  ? 'text-red-700 dark:text-red-400'
                                  : 'text-gray-500'
                        }
                    >
                        {row.status === 'delivered'
                            ? t(
                                  'notifications.webhooks.status.delivered',
                                  'Delivered'
                              )
                            : row.status === 'failed'
                              ? t(
                                    'notifications.webhooks.status.failed',
                                    'Failed ({{error}})',
                                    {
                                        error: row.error || '',
                                    }
                                )
                              : t(
                                    'notifications.webhooks.status.pending',
                                    'Waiting to retry'
                                )}
                    </span>
                </li>
            ))}
        </ul>
    );
};

const WebhooksCard: React.FC = () => {
    const { t } = useTranslation();
    const locked = useTrialLock('webhooks');
    const [webhooks, setWebhooks] = React.useState<Webhook[] | null>(null);
    // 'new', a webhook uid being edited, or null.
    const [editing, setEditing] = React.useState<string | null>(null);
    const [openDeliveries, setOpenDeliveries] = React.useState<string | null>(
        null
    );
    const [secret, setSecret] = React.useState<{
        uid: string;
        value: string;
    } | null>(null);
    const [confirmDelete, setConfirmDelete] = React.useState<string | null>(
        null
    );
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState<{
        ok: boolean;
        text: string;
    } | null>(null);

    React.useEffect(() => {
        listWebhooks()
            .then(setWebhooks)
            .catch(() => setWebhooks([]));
    }, []);

    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setMessage(null);
        try {
            await fn();
        } catch (error) {
            setMessage({ ok: false, text: (error as Error).message });
        } finally {
            setBusy(false);
        }
    };

    const replace = (saved: Webhook) =>
        setWebhooks((prev) =>
            (prev || []).map((w) =>
                w.uid === saved.uid ? { ...saved, secret: undefined } : w
            )
        );

    const handleSubmit = (form: FormState) =>
        run(async () => {
            const input = {
                name: form.name.trim(),
                events: form.events,
                summary_hour: form.summaryHour,
                ...(form.url.trim() ? { url: form.url.trim() } : {}),
            };
            if (editing === 'new') {
                const created = await createWebhook(input);
                setWebhooks((prev) => [
                    ...(prev || []),
                    { ...created, secret: undefined },
                ]);
                if (created.secret)
                    setSecret({ uid: created.uid, value: created.secret });
            } else if (editing) {
                replace(await updateWebhook(editing, input));
            }
            setEditing(null);
        });

    const handleToggle = (webhook: Webhook) =>
        run(async () => {
            replace(
                await updateWebhook(webhook.uid, { enabled: !webhook.enabled })
            );
        });

    const handleDelete = (webhook: Webhook) =>
        run(async () => {
            await deleteWebhook(webhook.uid);
            setWebhooks((prev) =>
                (prev || []).filter((w) => w.uid !== webhook.uid)
            );
            if (secret?.uid === webhook.uid) setSecret(null);
        });

    const handleRotate = (webhook: Webhook) =>
        run(async () => {
            const rotated = await rotateWebhookSecret(webhook.uid);
            if (rotated.secret)
                setSecret({ uid: rotated.uid, value: rotated.secret });
        });

    const handleTest = (webhook: Webhook) =>
        run(async () => {
            await testWebhook(webhook.uid);
            setMessage({
                ok: true,
                text: t(
                    'notifications.webhooks.testSent',
                    '{{name}} accepted the test message.',
                    {
                        name: webhook.name,
                    }
                ),
            });
            const fresh = await listWebhooks();
            setWebhooks(fresh);
        });

    const statusText = (webhook: Webhook) => {
        if (!webhook.enabled) {
            return webhook.disabled_reason === 'failures'
                ? t(
                      'notifications.webhooks.disabledFailures',
                      'Turned off after too many failed deliveries. Check the address, then turn it back on.'
                  )
                : t('notifications.webhooks.off', 'Off');
        }
        if (webhook.last_delivery_status === 'failed') {
            return t(
                'notifications.webhooks.lastFailed',
                'The last delivery failed.'
            );
        }
        if (webhook.last_delivery_at) {
            return t(
                'notifications.webhooks.lastDelivered',
                'Last delivered {{when}}.',
                {
                    when: new Date(webhook.last_delivery_at).toLocaleString(),
                }
            );
        }
        return t('notifications.webhooks.notUsed', 'Nothing sent yet.');
    };

    const formFor = (webhook?: Webhook): FormState =>
        webhook
            ? {
                  name: webhook.name,
                  url: '',
                  events: webhook.events,
                  summaryHour: webhook.summary_hour,
              }
            : emptyForm;

    return (
        <div
            className="mt-8 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4"
            data-testid="webhooks-card"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('notifications.webhooks.title', 'Webhooks')}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {t(
                            'notifications.webhooks.description',
                            'Send events as JSON to n8n, Home Assistant, Slack, Discord or your own server. Each webhook picks its own events.'
                        )}
                    </p>
                </div>
                {!locked && editing === null && webhooks && (
                    <button
                        type="button"
                        onClick={() => {
                            setMessage(null);
                            setEditing('new');
                        }}
                        className={smallButton}
                    >
                        {t('notifications.webhooks.add', 'Add webhook')}
                    </button>
                )}
            </div>

            <TrialLockNotice feature="webhooks" className="mt-4" />

            {secret && (
                <div className="mt-4 rounded-md bg-blue-50 dark:bg-blue-900/30 p-3 text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-medium">
                        {t(
                            'notifications.webhooks.secretOnce',
                            'Signing secret. Copy it now: it will not be shown again.'
                        )}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 truncate rounded bg-white/70 dark:bg-gray-900/40 px-2 py-1 text-xs">
                            {secret.value}
                        </code>
                        <button
                            type="button"
                            onClick={() =>
                                navigator.clipboard?.writeText(secret.value)
                            }
                            className={smallButton}
                        >
                            {t('notifications.webhooks.copy', 'Copy')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setSecret(null)}
                            className={smallButton}
                        >
                            {t('notifications.webhooks.done', 'Done')}
                        </button>
                    </div>
                    <p className="mt-2 text-xs">
                        {t(
                            'notifications.webhooks.secretHelp',
                            'Each request carries X-Tududi-Signature: sha256 HMAC of "timestamp.body" with this secret, and the timestamp in X-Tududi-Timestamp.'
                        )}
                    </p>
                </div>
            )}

            {editing === 'new' && (
                <WebhookForm
                    initial={formFor()}
                    editing={false}
                    busy={busy}
                    onCancel={() => setEditing(null)}
                    onSubmit={handleSubmit}
                />
            )}

            {webhooks && webhooks.length > 0 && (
                <ul className="mt-4 space-y-3">
                    {webhooks.map((webhook) => (
                        <li
                            key={webhook.uid}
                            className="rounded-md bg-white dark:bg-gray-800 p-3"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {webhook.name}
                                        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                            {webhook.host}
                                        </span>
                                    </p>
                                    <p
                                        className={`text-xs mt-0.5 ${
                                            !webhook.enabled ||
                                            webhook.last_delivery_status ===
                                                'failed'
                                                ? 'text-red-700 dark:text-red-400'
                                                : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                    >
                                        {statusText(webhook)}
                                    </p>
                                    <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                                        {webhook.events
                                            .map((e) => eventLabel(t, e))
                                            .join(', ')}
                                    </p>
                                </div>
                                {editing !== webhook.uid && (
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleTest(webhook)}
                                            disabled={
                                                busy ||
                                                !webhook.enabled ||
                                                locked
                                            }
                                            className={smallButton}
                                        >
                                            {t(
                                                'notifications.test.button',
                                                'Test'
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleToggle(webhook)
                                            }
                                            disabled={busy || locked}
                                            className={smallButton}
                                        >
                                            {webhook.enabled
                                                ? t(
                                                      'notifications.webhooks.turnOff',
                                                      'Turn off'
                                                  )
                                                : t(
                                                      'notifications.webhooks.turnOn',
                                                      'Turn on'
                                                  )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMessage(null);
                                                setEditing(webhook.uid);
                                            }}
                                            disabled={busy || locked}
                                            className={smallButton}
                                        >
                                            {t(
                                                'notifications.webhooks.edit',
                                                'Edit'
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRotate(webhook)
                                            }
                                            disabled={busy || locked}
                                            className={smallButton}
                                        >
                                            {t(
                                                'notifications.webhooks.newSecret',
                                                'New secret'
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setOpenDeliveries(
                                                    openDeliveries ===
                                                        webhook.uid
                                                        ? null
                                                        : webhook.uid
                                                )
                                            }
                                            className={smallButton}
                                        >
                                            {t(
                                                'notifications.webhooks.history',
                                                'History'
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (
                                                    confirmDelete ===
                                                    webhook.uid
                                                ) {
                                                    setConfirmDelete(null);
                                                    handleDelete(webhook);
                                                } else {
                                                    setConfirmDelete(
                                                        webhook.uid
                                                    );
                                                }
                                            }}
                                            onBlur={() =>
                                                setConfirmDelete(null)
                                            }
                                            disabled={busy}
                                            className="px-2.5 py-1 text-xs font-medium rounded-md text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-40 transition-colors"
                                        >
                                            {confirmDelete === webhook.uid
                                                ? t(
                                                      'notifications.webhooks.confirmDelete',
                                                      'Delete it?'
                                                  )
                                                : t(
                                                      'notifications.webhooks.delete',
                                                      'Delete'
                                                  )}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {editing === webhook.uid && (
                                <WebhookForm
                                    initial={formFor(webhook)}
                                    editing
                                    busy={busy}
                                    onCancel={() => setEditing(null)}
                                    onSubmit={handleSubmit}
                                />
                            )}
                            {openDeliveries === webhook.uid && (
                                <DeliveryList uid={webhook.uid} />
                            )}
                        </li>
                    ))}
                </ul>
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

export default WebhooksCard;
