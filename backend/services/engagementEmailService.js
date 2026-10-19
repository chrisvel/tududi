'use strict';

const { Op, fn, col } = require('sequelize');
const { getConfig } = require('../config/config');
const entitlements = require('./entitlementsService');
const { isAdmin } = require('./rolesService');
const { logError } = require('./logService');
const { deliver } = require('./emailDeliveryService');

// Two nudges for Cloud account owners, sent from the daily account
// lifecycle job: one to an account still empty a couple of days after it
// started, and one to an account that had things in it and went quiet.
// Members, admins and read-only accounts are left out. The email log
// (email_deliveries) is what stops either from going out twice.

const DAY_MS = 24 * 60 * 60 * 1000;

// An account counts as started when its trial did (on verifying the email),
// or when it was made where there are no trials. Empty accounts older than
// EMPTY_UNTIL_DAYS are left alone, so turning this on does not email every
// old empty account at once.
const EMPTY_AFTER_DAYS = 2;
const EMPTY_UNTIL_DAYS = 14;

// Quiet for QUIET_DAYS gets the email; quiet for longer than
// QUIET_UNTIL_DAYS is taken as gone and left alone.
const QUIET_DAYS = 7;
const QUIET_UNTIL_DAYS = 30;

function models() {
    return require('../models');
}

const base = () => getConfig().frontendUrl.replace(/\/$/, '');

// The last time each user made a task, project, note, area or inbox item,
// or completed a task, as a Map of user id to Date. Recurring instances are
// made by the scheduler and do not count. Users with none are missing.
async function lastActivity(userIds = null) {
    const { Task, Project, Note, Area, InboxItem } = models();
    const scope = userIds ? { user_id: userIds } : {};
    const kinds = [
        [Task, 'created_at', { recurring_parent_id: null }],
        [Task, 'completed_at', { completed_at: { [Op.ne]: null } }],
        [Project, 'created_at', {}],
        [Note, 'created_at', {}],
        [Area, 'created_at', {}],
        [InboxItem, 'created_at', {}],
    ];
    const results = await Promise.all(
        kinds.map(([Model, field, where]) =>
            Model.findAll({
                attributes: ['user_id', [fn('MAX', col(field)), 'last']],
                where: { ...where, ...scope },
                group: ['user_id'],
                raw: true,
            })
        )
    );
    const last = new Map();
    for (const row of results.flat()) {
        if (!row.last) continue;
        const at = new Date(row.last);
        const seen = last.get(row.user_id);
        if (!seen || at > seen) last.set(row.user_id, at);
    }
    return last;
}

// Why this user should not get either email, or null. On the way it works
// out the end of their own running trial, for the line that says so.
async function whyNot(user) {
    if (!entitlements.isHostedMode()) return 'Only on Cloud';
    if (!user.email_verified) return 'The email address is not verified';
    if (user.created_by_user_id) {
        return 'Members added by someone else are left out';
    }
    if (await isAdmin(user.id)) return 'Admins are left out';
    const ent = await entitlements.getEntitlements(user.id);
    if (ent.read_only) return 'The account is read-only';
    return null;
}

async function emailVars(user, path) {
    const ent = await entitlements.getEntitlements(user.id);
    const trialEndsOn =
        ent.reason === 'trial' && ent.trial_ends_at
            ? new Date(ent.trial_ends_at)
            : null;
    return { url: `${base()}${path}`, trialEndsOn };
}

async function emptyAccountVars(user) {
    return emailVars(user, '/inbox');
}

async function comeBackVars(user) {
    return emailVars(user, '/today/plan');
}

async function sendEmptyAccount(user, { triggeredBy = null } = {}) {
    return deliver('emptyAccount', {
        user,
        triggeredBy,
        vars: await emptyAccountVars(user),
    });
}

async function sendComeBack(user, { triggeredBy = null } = {}) {
    return deliver('comeBack', {
        user,
        triggeredBy,
        vars: await comeBackVars(user),
    });
}

// When each of `userIds` was last sent `email`, as a Map of id to Date.
async function lastSent(email, userIds) {
    if (!userIds.length) return new Map();
    const rows = await models().EmailDelivery.findAll({
        attributes: ['user_id', [fn('MAX', col('created_at')), 'last']],
        where: { email, status: 'sent', user_id: userIds },
        group: ['user_id'],
        raw: true,
    });
    return new Map(rows.map((r) => [r.user_id, new Date(r.last)]));
}

function isOn() {
    if (!entitlements.isHostedMode()) return false;
    const { isEmailEnabled } = require('./emailService');
    return isEmailEnabled();
}

async function sendEach(users, send, label) {
    const sent = [];
    for (const user of users) {
        try {
            if (await whyNot(user)) continue;
            const result = await send(user);
            if (result.success) sent.push(user.id);
        } catch (error) {
            logError(error, `Could not send the ${label} email to ${user.id}`);
        }
    }
    return sent;
}

const USER_FIELDS = [
    'id',
    'email',
    'language',
    'email_verified',
    'created_by_user_id',
    'created_at',
];

// Owners who started EMPTY_AFTER_DAYS to EMPTY_UNTIL_DAYS ago, have made
// nothing, and never got this email.
async function nudgeEmptyAccounts({ now = new Date() } = {}) {
    if (!isOn()) return [];
    const { User, BillingAccount } = models();
    const from = new Date(now.getTime() - EMPTY_UNTIL_DAYS * DAY_MS);
    const to = new Date(now.getTime() - EMPTY_AFTER_DAYS * DAY_MS);

    // A trial starts at or after sign-up, so anyone who started in the
    // window signed up no later than its end.
    const users = await User.findAll({
        attributes: USER_FIELDS,
        where: {
            email_verified: true,
            created_by_user_id: null,
            email: { [Op.ne]: null },
            created_at: { [Op.lte]: to },
        },
    });
    if (!users.length) return [];
    const ids = users.map((u) => u.id);
    const accounts = await BillingAccount.findAll({
        attributes: ['user_id', 'trial_started_at'],
        where: { user_id: ids },
        raw: true,
    });
    const trialStart = new Map(
        accounts.map((a) => [a.user_id, a.trial_started_at])
    );
    const started = users.filter((u) => {
        const at = new Date(trialStart.get(u.id) || u.created_at);
        return at >= from && at <= to;
    });
    if (!started.length) return [];

    const startedIds = started.map((u) => u.id);
    const [active, sent] = await Promise.all([
        lastActivity(startedIds),
        lastSent('emptyAccount', startedIds),
    ]);
    const empty = started.filter((u) => !active.has(u.id) && !sent.has(u.id));
    return sendEach(empty, (user) => sendEmptyAccount(user), 'empty account');
}

// Owners whose last activity was QUIET_DAYS to QUIET_UNTIL_DAYS ago and who
// have not had this email since.
async function nudgeQuietAccounts({ now = new Date() } = {}) {
    if (!isOn()) return [];
    const from = new Date(now.getTime() - QUIET_UNTIL_DAYS * DAY_MS);
    const to = new Date(now.getTime() - QUIET_DAYS * DAY_MS);

    const active = await lastActivity();
    const quietIds = [...active]
        .filter(([, at]) => at >= from && at <= to)
        .map(([id]) => id);
    if (!quietIds.length) return [];

    const [users, sent] = await Promise.all([
        models().User.findAll({
            attributes: USER_FIELDS,
            where: {
                id: quietIds,
                email_verified: true,
                created_by_user_id: null,
                email: { [Op.ne]: null },
            },
        }),
        lastSent('comeBack', quietIds),
    ]);
    const due = users.filter((u) => {
        const at = sent.get(u.id);
        return !at || at < active.get(u.id);
    });
    return sendEach(due, (user) => sendComeBack(user), 'come back');
}

module.exports = {
    EMPTY_AFTER_DAYS,
    QUIET_DAYS,
    lastActivity,
    lastSent,
    whyNot,
    emptyAccountVars,
    comeBackVars,
    sendEmptyAccount,
    sendComeBack,
    nudgeEmptyAccounts,
    nudgeQuietAccounts,
};
