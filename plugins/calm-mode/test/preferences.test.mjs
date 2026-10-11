import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyQuietPreferences,
    isQuieted,
    restorePushFlags,
    snapshotPushFlags,
} from '../dist/preferences.js';

/**
 * Calm Mode writes to the account's notification preferences, so these tests
 * are about not doing damage: capturing what was there, changing only what the
 * mode claims to change, and putting it back exactly.
 */

const account = () => ({
    dueTasks: { inApp: true, email: true, push: true, telegram: false },
    overdueTasks: { inApp: true, email: false, push: true, telegram: true },
    dueProjects: { inApp: true, push: true },
    overdueProjects: { inApp: true, push: true },
    deferUntil: { inApp: true, push: true },
    taskAssigned: { inApp: true, push: true, telegram: true },
    comments: { inApp: true, push: true },
    habitReminders: { inApp: true, push: false },
});

test('snapshot records only the push flag per category', () => {
    const snapshot = snapshotPushFlags(account());

    assert.deepEqual(snapshot, {
        dueTasks: true,
        overdueTasks: true,
        dueProjects: true,
        overdueProjects: true,
        deferUntil: true,
        taskAssigned: true,
        comments: true,
        habitReminders: false,
    });
});

test('snapshot of missing preferences is empty rather than a default set', () => {
    // Restoring must never invent a category the account never had.
    assert.deepEqual(snapshotPushFlags(null), {});
    assert.deepEqual(snapshotPushFlags(undefined), {});
    assert.deepEqual(snapshotPushFlags({}), {});
});

test('quieting turns push off for the unbidden categories only', () => {
    const next = applyQuietPreferences(account());

    assert.equal(next.dueTasks.push, false);
    assert.equal(next.overdueTasks.push, false);
    assert.equal(next.dueProjects.push, false);
    assert.equal(next.overdueProjects.push, false);
    assert.equal(next.deferUntil.push, false);

    // Things a person asked for or was sent keep their push.
    assert.equal(next.taskAssigned.push, true);
    assert.equal(next.comments.push, true);
});

test('quieting leaves the other channels and in-app delivery alone', () => {
    const before = account();
    const next = applyQuietPreferences(before);

    // Nothing is actually lost: in-app notifications stay on everywhere.
    for (const key of Object.keys(before)) {
        assert.equal(next[key].inApp, before[key].inApp);
        assert.equal(next[key].email, before[key].email);
        assert.equal(next[key].telegram, before[key].telegram);
    }
});

test('quieting does not mutate what it was given', () => {
    const before = account();
    applyQuietPreferences(before);

    assert.equal(before.dueTasks.push, true);
});

test('quieting is idempotent and preserves unknown categories', () => {
    const withExtra = {
        ...account(),
        somethingAddedLater: { inApp: true, push: true },
    };

    const once = applyQuietPreferences(withExtra);
    const twice = applyQuietPreferences(once);

    assert.deepEqual(twice, once);
    // A category this plugin has never heard of is not touched.
    assert.equal(twice.somethingAddedLater.push, true);
});

test('restoring puts the previous push flags back exactly', () => {
    const before = account();
    const snapshot = snapshotPushFlags(before);

    const restored = restorePushFlags(applyQuietPreferences(before), snapshot);

    assert.deepEqual(restored, before);
});

test('restoring honours a category that was already off', () => {
    const before = account();
    const snapshot = snapshotPushFlags(before);

    const restored = restorePushFlags(applyQuietPreferences(before), snapshot);

    assert.equal(restored.habitReminders.push, false);
});

test('restoring ignores categories the account no longer has', () => {
    const snapshot = snapshotPushFlags(account());
    const trimmed = { dueTasks: { inApp: true, push: false } };

    const restored = restorePushFlags(trimmed, snapshot);

    // It does not resurrect the removed categories.
    assert.deepEqual(Object.keys(restored), ['dueTasks']);
    assert.equal(restored.dueTasks.push, true);
});

test('restoring with no snapshot is a no-op', () => {
    const before = account();
    assert.deepEqual(restorePushFlags(before, null), before);
    assert.deepEqual(restorePushFlags(before, undefined), before);
});

test('isQuieted reports whether there is anything to undo', () => {
    const before = account();
    assert.equal(isQuieted(before), true);
    assert.equal(isQuieted(applyQuietPreferences(before)), false);
    assert.equal(isQuieted(null), false);
});
