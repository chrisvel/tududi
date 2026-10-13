'use strict';

const { Op } = require('sequelize');
const { getConfig } = require('../config/config');
const entitlements = require('./entitlementsService');
const { isAdmin } = require('./rolesService');
const { logError, logInfo } = require('./logService');

// The end of a Cloud trial that nobody paid for: a warning email a week
// before the account is deleted, then the deletion. Both run from the daily
// account lifecycle job, and only where access is sold (with a free tier an
// ended trial is a working free account).

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
        attributes: ['id', 'email', 'created_by_user_id'],
    });
    if (!user || user.created_by_user_id) return null;
    if (await isAdmin(user.id)) return null;
    const accountsService = require('./accountsService');
    if ((await accountsService.countMembers(user.id)) > 0) return null;
    return user;
}

const formatDate = (date) =>
    date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });

async function sendDeletionWarning(user, deleteOn) {
    const { sendEmail } = require('./emailService');
    const base = getConfig().frontendUrl.replace(/\/$/, '');
    const subscribeUrl = `${base}/subscription/new`;
    const exportUrl = `${base}/profile`;
    const date = formatDate(deleteOn);

    const text = `Hi,

Your tududi Cloud trial has ended, and your account has been read-only since then. On ${date} the account and everything in it will be deleted.

To keep it, subscribe here:
${subscribeUrl}

To take your data with you instead, export it from your profile:
${exportUrl}

If you do nothing, the account is deleted on ${date} and this is the last email you will get from us about it.

The Tududi Team`;

    const html = `
<p>Hi,</p>

<p>Your tududi Cloud trial has ended, and your account has been read-only since then. <strong>On ${date} the account and everything in it will be deleted.</strong></p>

<p style="text-align: center; margin: 30px 0;">
    <a href="${subscribeUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Keep my account</a>
</p>

<p>To take your data with you instead, <a href="${exportUrl}">export it from your profile</a>.</p>

<p>If you do nothing, the account is deleted on ${date} and this is the last email you will get from us about it.</p>

<p>The Tududi Team</p>
`;

    return sendEmail({
        to: user.email,
        subject: `Your tududi account will be deleted on ${date}`,
        text,
        html,
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

// The daily job: remind unverified sign-ups, warn, then delete.
async function runAccountLifecycle({ now = new Date() } = {}) {
    const {
        sendVerificationReminders,
    } = require('../modules/auth/registrationService');
    const reminded = await sendVerificationReminders({ now });
    const warned = await warnExpiringTrials({ now });
    const deleted = await deleteExpiredTrials({ now });
    return { reminded, warned, deleted };
}

module.exports = {
    warnExpiringTrials,
    deleteExpiredTrials,
    runAccountLifecycle,
};
