'use strict';

const { Op } = require('sequelize');
const { getConfig } = require('../config/config');
const entitlements = require('./entitlementsService');
const { isAdmin } = require('./rolesService');
const { logError, logInfo } = require('./logService');
const { deliver } = require('./emailDeliveryService');

// The end of a Cloud trial that nobody paid for: reminders while it runs,
// then a warning email a week before the account is deleted, and the
// deletion. All run from the daily account lifecycle job; the warning and
// deletion only where access is sold (with a free tier an ended trial is a
// working free account).

const DAY_MS = 24 * 60 * 60 * 1000;

function models() {
    return require('../models');
}

function isActive() {
    const hosted = getConfig().hosted || {};
    return (
        entitlements.isSubscriptionRequired() &&
        hosted.deleteExpiredTrials !== false &&
        (hosted.trialDays || 0) > 0
    );
}

// Unpaid trials started under the verification rule (trial_started_at),
// with no comp. Admins, members and owners with members are filtered out
// by mayDelete.
const unpaidTrialWhere = (extra) => ({
    trial_started_at: { [Op.ne]: null },
    status: 'none',
    provider_subscription_id: null,
    override_plan: null,
    ...extra,
});

async function mayDelete(userId) {
    const user = await models().User.findByPk(userId, {
        attributes: ['id', 'email', 'language', 'created_by_user_id'],
    });
    if (!user || user.created_by_user_id) return null;
    if (await isAdmin(user.id)) return null;
    const accountsService = require('./accountsService');
    if ((await accountsService.countMembers(user.id)) > 0) return null;
    return user;
}

function deletionWarningVars(deleteOn) {
    const base = getConfig().frontendUrl.replace(/\/$/, '');
    return {
        deleteOn,
        subscribeUrl: `${base}/subscription/new`,
        exportUrl: `${base}/backup`,
    };
}

async function sendDeletionWarning(
    user,
    deleteOn,
    { triggeredBy = null } = {}
) {
    return deliver('deletionWarning', {
        user,
        triggeredBy,
        vars: deletionWarningVars(deleteOn),
    });
}

// Warns every unpaid ended trial whose deletion is a week or less away.
// An account is marked only when the email actually went out, so with email
// down nobody is warned and, in turn, nobody is deleted.
async function warnExpiringTrials({ now = new Date() } = {}) {
    if (!isActive()) return [];
    const { isEmailEnabled } = require('./emailService');
    if (!isEmailEnabled()) return [];

    const days = getConfig().hosted.trialReadOnlyDays ?? 30;
    const noticeDays = entitlements.DELETION_NOTICE_DAYS;
    const endedBefore = new Date(
        now.getTime() - Math.max(0, days - noticeDays) * DAY_MS
    );
    const accounts = await models().BillingAccount.findAll({
        where: unpaidTrialWhere({
            deletion_warned_at: null,
            trial_ends_at: { [Op.lt]: endedBefore },
        }),
    });

    const warned = [];
    for (const account of accounts) {
        try {
            if (new Date(account.trial_ends_at) > now) continue;
            const user = await mayDelete(account.user_id);
            if (!user || !user.email) continue;

            const deleteOn = entitlements.readOnlyUntil({
                ...account.get({ plain: true }),
                deletion_warned_at: now,
            });
            const result = await sendDeletionWarning(user, deleteOn);
            if (!result.success) continue;

            await account.update({ deletion_warned_at: now });
            entitlements.invalidate(user.id);
            warned.push(user.id);
        } catch (error) {
            logError(
                error,
                `Could not warn expired trial account ${account.user_id}`
            );
        }
    }
    return warned;
}

// Deletes unpaid ended trials that were warned at least a week ago and whose
// read-only window has passed.
async function deleteExpiredTrials({ now = new Date() } = {}) {
    if (!isActive()) return [];

    const noticeDays = entitlements.DELETION_NOTICE_DAYS;
    const accounts = await models().BillingAccount.findAll({
        where: unpaidTrialWhere({
            deletion_warned_at: {
                [Op.lte]: new Date(now.getTime() - noticeDays * DAY_MS),
            },
        }),
    });

    const { eraseUserAccount } = require('./accountErasureService');
    const deleted = [];
    for (const account of accounts) {
        try {
            const until = entitlements.readOnlyUntil(account);
            if (!until || until > now) continue;
            const user = await mayDelete(account.user_id);
            if (!user) continue;

            await eraseUserAccount(user.id);
            entitlements.invalidate(user.id);
            deleted.push(user.id);
            logInfo(
                `Deleted account ${user.id}: trial ended unpaid and the deletion notice ran out`
            );
        } catch (error) {
            logError(
                error,
                `Could not delete expired trial account ${account.user_id}`
            );
        }
    }
    return deleted;
}

// Days left at which a running trial gets a "your trial ends soon" email,
// most distant first. Each goes out once; a missed one is not sent late.
const TRIAL_REMINDER_DAYS = [3, 1];

function trialReminderVars(daysLeft, endsOn) {
    const base = getConfig().frontendUrl.replace(/\/$/, '');
    return {
        daysLeft,
        endsOn,
        readOnlyDays: entitlements.isSubscriptionRequired()
            ? (getConfig().hosted.trialReadOnlyDays ?? 30)
            : null,
        subscribeUrl: `${base}/subscription/new`,
    };
}

async function sendTrialReminder(
    user,
    daysLeft,
    endsOn,
    { triggeredBy = null } = {}
) {
    return deliver('trialReminder', {
        user,
        variant: `${daysLeft}d`,
        triggeredBy,
        vars: trialReminderVars(daysLeft, endsOn),
    });
}

// Days left in a trial ending at `endsOn` (a started day counts), and the
// closest reminder day not yet passed by.
function reminderStep(endsOn, now = new Date()) {
    const daysLeft = Math.max(
        1,
        Math.ceil((new Date(endsOn).getTime() - now.getTime()) / DAY_MS)
    );
    // Further out than every reminder day (a reminder sent by hand), the
    // days left themselves.
    const ahead = TRIAL_REMINDER_DAYS.filter((d) => d >= daysLeft);
    const step = ahead.length ? Math.min(...ahead) : daysLeft;
    return { daysLeft, step };
}

// Emails every running, never-paid trial that has reached one of the
// reminder days. Unlike the deletion warning this runs with a free tier too,
// since the trial still ends there.
async function remindEndingTrials({ now = new Date() } = {}) {
    if (!entitlements.isHostedMode()) return [];
    if ((getConfig().hosted.trialDays || 0) <= 0) return [];
    const { isEmailEnabled } = require('./emailService');
    if (!isEmailEnabled()) return [];

    const furthest = Math.max(...TRIAL_REMINDER_DAYS);
    const accounts = await models().BillingAccount.findAll({
        where: unpaidTrialWhere({
            trial_ends_at: {
                [Op.gt]: now,
                [Op.lte]: new Date(now.getTime() + furthest * DAY_MS),
            },
        }),
    });

    const reminded = [];
    for (const account of accounts) {
        try {
            const endsOn = new Date(account.trial_ends_at);
            const { daysLeft, step } = reminderStep(endsOn, now);
            if (
                account.trial_reminder_days !== null &&
                account.trial_reminder_days <= step
            ) {
                continue;
            }

            const user = await models().User.findByPk(account.user_id, {
                attributes: ['id', 'email', 'language', 'created_by_user_id'],
            });
            if (!user || !user.email || user.created_by_user_id) continue;
            if (await isAdmin(user.id)) continue;

            const result = await sendTrialReminder(user, daysLeft, endsOn);
            if (!result.success) continue;

            await account.update({ trial_reminder_days: step });
            reminded.push(user.id);
        } catch (error) {
            logError(
                error,
                `Could not send trial reminder to account ${account.user_id}`
            );
        }
    }
    return reminded;
}

// The daily job: remind unverified sign-ups and ending trials, nudge empty
// and quiet accounts, warn, then delete.
async function runAccountLifecycle({ now = new Date() } = {}) {
    const {
        sendVerificationReminders,
    } = require('../modules/auth/registrationService');
    const engagement = require('./engagementEmailService');
    const reminded = await sendVerificationReminders({ now });
    const trialReminders = await remindEndingTrials({ now });
    const emptyNudges = await engagement.nudgeEmptyAccounts({ now });
    const quietNudges = await engagement.nudgeQuietAccounts({ now });
    const warned = await warnExpiringTrials({ now });
    const deleted = await deleteExpiredTrials({ now });
    return {
        reminded,
        trialReminders,
        emptyNudges,
        quietNudges,
        warned,
        deleted,
    };
}

module.exports = {
    isActive,
    mayDelete,
    unpaidTrialWhere,
    reminderStep,
    trialReminderVars,
    sendTrialReminder,
    deletionWarningVars,
    sendDeletionWarning,
    remindEndingTrials,
    warnExpiringTrials,
    deleteExpiredTrials,
    runAccountLifecycle,
};
