/**
 * Quiet notifications.
 *
 * Calm Mode turns *push* off for the categories that arrive unbidden and nag —
 * a task becoming due, a deadline passing, a deferral coming round — while
 * leaving alone the ones that answer something a person did or received, and
 * leaving in-app notifications untouched so nothing is actually lost.
 *
 * A plugin editing someone's notification settings is a destructive act if it
 * cannot be undone, so the previous push flags are captured before the change
 * and restored exactly on the way out. These functions are pure for that
 * reason: the correctness that matters is here, and it is tested directly.
 */

export interface ChannelPreferences {
    inApp?: boolean;
    email?: boolean;
    push?: boolean;
    telegram?: boolean;
}

export type NotificationPreferences = Record<string, ChannelPreferences>;

/**
 * Categories that arrive unbidden: time passing, not a person acting.
 *
 * `overdueTasks` belongs here more than any other — it is the reminder that
 * nags hardest, and quietly omitting it would defeat the point of the mode.
 */
export const QUIET_CATEGORIES = [
    'dueTasks',
    'overdueTasks',
    'dueProjects',
    'overdueProjects',
    'deferUntil',
] as const;

/** Categories that follow from something a person did or received. */
export const KEPT_CATEGORIES = [
    'taskAssigned',
    'comments',
    'habitReminders',
] as const;

/** The previous push flag per category, so it can be put back. */
export type PushSnapshot = Record<string, boolean>;

const copyPreferences = (
    preferences: NotificationPreferences | null | undefined
): NotificationPreferences => {
    const source =
        preferences && typeof preferences === 'object' ? preferences : {};
    const copy: NotificationPreferences = {};

    for (const [key, value] of Object.entries(source)) {
        copy[key] = value && typeof value === 'object' ? { ...value } : {};
    }

    return copy;
};

/**
 * Record which categories had push enabled.
 *
 * Only keys the server actually reports are recorded, so restoring cannot
 * invent a category the account never had.
 */
export const snapshotPushFlags = (
    preferences: NotificationPreferences | null | undefined
): PushSnapshot => {
    const snapshot: PushSnapshot = {};
    const source =
        preferences && typeof preferences === 'object' ? preferences : {};

    for (const [key, value] of Object.entries(source)) {
        snapshot[key] = value?.push === true;
    }

    return snapshot;
};

/**
 * Turn push off for the quiet categories. Everything else — other channels,
 * other categories, and any key this plugin does not know about — is returned
 * unchanged in a new object.
 */
export const applyQuietPreferences = (
    preferences: NotificationPreferences | null | undefined
): NotificationPreferences => {
    const next = copyPreferences(preferences);

    for (const key of QUIET_CATEGORIES) {
        if (!next[key]) continue;
        next[key] = { ...next[key], push: false };
    }

    return next;
};

/**
 * Put back the push flags recorded in `snapshot`.
 *
 * Categories that did not exist when the snapshot was taken are left alone, and
 * categories the account has since removed are ignored: restoring must never
 * resurrect a category or overwrite a deliberate later change elsewhere.
 */
export const restorePushFlags = (
    preferences: NotificationPreferences | null | undefined,
    snapshot: PushSnapshot | null | undefined
): NotificationPreferences => {
    const next = copyPreferences(preferences);
    if (!snapshot || typeof snapshot !== 'object') return next;

    for (const [key, wasEnabled] of Object.entries(snapshot)) {
        if (!next[key]) continue;
        next[key] = { ...next[key], push: wasEnabled === true };
    }

    return next;
};

/**
 * Whether the preferences currently match the quiet profile, so a restore is
 * only offered when there is something to undo.
 */
export const isQuieted = (
    preferences: NotificationPreferences | null | undefined
): boolean => {
    const source =
        preferences && typeof preferences === 'object' ? preferences : {};
    return QUIET_CATEGORIES.some((key) => source[key]?.push === true);
};
