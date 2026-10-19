'use strict';

const { getConfig } = require('../../config/config');
const entitlements = require('../../services/entitlementsService');
const { isAdmin } = require('../../services/rolesService');
const { renderEmail, normalizeLanguage } = require('../../emails');
const { deliver, listForUser } = require('../../services/emailDeliveryService');
const lifecycle = require('../../services/trialLifecycleService');
const engagement = require('../../services/engagementEmailService');
const { NotFoundError, ValidationError } = require('../../shared/errors');

// The account emails an admin can see and send for one user, from the user
// list. Each entry says whether it applies to this user right now (and why
// not), when it last went out, what it would say, and how to send it for
// real. Links that carry a token show a placeholder in the preview: the real
// token is only made when the email is sent.

const LINK_ON_SEND = 'NEW-LINK-CREATED-WHEN-SENT';

const base = () => getConfig().frontendUrl.replace(/\/$/, '');

const verificationVars = (ctx, reminder) => {
    const config = getConfig();
    return {
        url: `${config.backendUrl}/api/verify-email?token=${LINK_ON_SEND}`,
        expiryHours: config.registrationConfig.tokenExpiryHours,
        trialDays: config.hosted?.enabled ? config.hosted.trialDays || 0 : 0,
        reminder,
    };
};

const verificationApplies = ({ user }) => {
    if (user.email_verified) return 'The email address is already verified';
    if (user.created_by_user_id) {
        return 'Members added by someone else get the member invite instead';
    }
    return null;
};

// A running, never-paid trial of the account's own (not a member's share).
const onOwnTrial = ({ user, admin, account, ent }) =>
    ent?.reason === 'trial' &&
    !admin &&
    !user.created_by_user_id &&
    account?.trial_started_at &&
    account.status === 'none' &&
    !account.provider_subscription_id &&
    !account.override_plan;

const endedUnpaidTrial = ({ account, now }) =>
    account?.trial_started_at &&
    account.status === 'none' &&
    !account.provider_subscription_id &&
    !account.override_plan &&
    new Date(account.trial_ends_at) <= now;

const deleteOnIfWarnedNow = ({ account, now }) =>
    entitlements.readOnlyUntil({
        ...account.get({ plain: true }),
        deletion_warned_at: now,
    });

const EMAILS = [
    {
        key: 'verification',
        email: 'verification',
        matches: (row) => row.email === 'verification' && !row.variant,
        applies: verificationApplies,
        vars: (ctx) => verificationVars(ctx, false),
        send: async (ctx, adminId) =>
            require('../auth/registrationService').sendFreshVerification(
                ctx.user,
                { triggeredBy: adminId }
            ),
    },
    {
        key: 'verificationReminder',
        email: 'verification',
        matches: (row) =>
            row.email === 'verification' && row.variant === 'reminder',
        recorded: ({ user }) => user.verification_reminder_sent_at,
        applies: verificationApplies,
        vars: (ctx) => verificationVars(ctx, true),
        send: async (ctx, adminId) =>
            require('../auth/registrationService').sendFreshVerification(
                ctx.user,
                { reminder: true, triggeredBy: adminId }
            ),
    },
    {
        key: 'memberInvite',
        email: 'memberInvite',
        applies: ({ user }) =>
            user.created_by_user_id && !user.password_digest
                ? null
                : 'Only for a member added without a password',
        vars: () => ({
            url: `${base()}/reset-password?token=${LINK_ON_SEND}`,
            expiryHours: getConfig().inviteTokenExpiryHours,
        }),
        send: async ({ user }, adminId) => {
            const {
                sendMemberInviteEmail,
            } = require('../auth/passwordResetService');
            const { sent } = await sendMemberInviteEmail(user, {
                triggeredBy: adminId,
            });
            return { success: sent };
        },
    },
    {
        key: 'passwordReset',
        email: 'passwordReset',
        applies: () => null,
        vars: () => ({
            url: `${base()}/reset-password?token=${LINK_ON_SEND}`,
            expiryMinutes: getConfig().passwordResetConfig.tokenExpiryMinutes,
        }),
        send: async ({ user }, adminId) => {
            const { issueResetToken } = require('../auth/passwordResetService');
            const token = await issueResetToken(user);
            return deliver('passwordReset', {
                user,
                triggeredBy: adminId,
                vars: {
                    url: `${base()}/reset-password?token=${token}`,
                    expiryMinutes:
                        getConfig().passwordResetConfig.tokenExpiryMinutes,
                },
            });
        },
    },
    {
        key: 'trialReminder',
        email: 'trialReminder',
        hostedOnly: true,
        recorded: ({ account }) =>
            account?.trial_reminder_days != null ? true : null,
        applies: (ctx) =>
            onOwnTrial(ctx) ? null : 'Only during an unpaid trial of their own',
        vars: ({ account, now }) => {
            const { daysLeft } = lifecycle.reminderStep(
                account.trial_ends_at,
                now
            );
            return lifecycle.trialReminderVars(
                daysLeft,
                new Date(account.trial_ends_at)
            );
        },
        send: async ({ user, account, now }, adminId) => {
            const endsOn = new Date(account.trial_ends_at);
            const { daysLeft, step } = lifecycle.reminderStep(endsOn, now);
            const result = await lifecycle.sendTrialReminder(
                user,
                daysLeft,
                endsOn,
                {
                    triggeredBy: adminId,
                }
            );
            // Counts as the daily job's reminder, so it is not sent twice.
            if (
                result.success &&
                (account.trial_reminder_days === null ||
                    account.trial_reminder_days > step)
            ) {
                await account.update({ trial_reminder_days: step });
            }
            return result;
        },
    },
    {
        key: 'emptyAccount',
        email: 'emptyAccount',
        hostedOnly: true,
        applies: async ({ user }) => {
            const reason = await engagement.whyNot(user);
            if (reason) return reason;
            const active = await engagement.lastActivity([user.id]);
            return active.has(user.id)
                ? 'They have already made something'
                : null;
        },
        vars: ({ user }) => engagement.emptyAccountVars(user),
        send: async ({ user }, adminId) =>
            engagement.sendEmptyAccount(user, { triggeredBy: adminId }),
    },
    {
        key: 'comeBack',
        email: 'comeBack',
        hostedOnly: true,
        applies: async ({ user }) => {
            const reason = await engagement.whyNot(user);
            if (reason) return reason;
            const active = await engagement.lastActivity([user.id]);
            return active.has(user.id)
                ? null
                : 'They have not made anything yet (see the empty account email)';
        },
        vars: ({ user }) => engagement.comeBackVars(user),
        send: async ({ user }, adminId) =>
            engagement.sendComeBack(user, { triggeredBy: adminId }),
    },
    {
        key: 'deletionWarning',
        email: 'deletionWarning',
        hostedOnly: true,
        recorded: ({ account }) => account?.deletion_warned_at,
        applies: async (ctx) => {
            if (!lifecycle.isActive()) {
                return 'Account deletion is switched off, so there is nothing to warn about';
            }
            if (!endedUnpaidTrial(ctx)) {
                return 'Only after an unpaid trial has ended';
            }
            if (!(await lifecycle.mayDelete(ctx.user.id))) {
                return 'This account is never deleted (an admin, a member, or an owner with members)';
            }
            return null;
        },
        vars: (ctx) => lifecycle.deletionWarningVars(deleteOnIfWarnedNow(ctx)),
        note: (ctx) =>
            `Sending sets the deletion date to ${deleteOnIfWarnedNow(ctx).toISOString().slice(0, 10)}. The account is deleted then unless it subscribes.`,
        send: async (ctx, adminId) => {
            const result = await lifecycle.sendDeletionWarning(
                ctx.user,
                deleteOnIfWarnedNow(ctx),
                { triggeredBy: adminId }
            );
            if (result.success) {
                await ctx.account.update({ deletion_warned_at: ctx.now });
                entitlements.invalidate(ctx.user.id);
            }
            return result;
        },
    },
];

const matcher = (def) => def.matches || ((row) => row.email === def.email);

async function loadContext(userId) {
    const { User, BillingAccount } = require('../../models');
    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');
    const hosted = entitlements.isHostedMode();
    const [admin, account, ent] = await Promise.all([
        isAdmin(user.id),
        BillingAccount.findOne({ where: { user_id: user.id } }),
        hosted ? entitlements.getEntitlements(user.id) : null,
    ]);
    return { user, admin, account, ent, hosted, now: new Date() };
}

const visible = (ctx) => EMAILS.filter((def) => !def.hostedOnly || ctx.hosted);

async function whyNot(def, ctx) {
    const { isEmailEnabled } = require('../../services/emailService');
    if (!isEmailEnabled()) return 'Email is not set up on this server';
    if (!ctx.user.email) return 'The user has no email address';
    return def.applies(ctx);
}

function findDefinition(ctx, key) {
    const def = visible(ctx).find((d) => d.key === key);
    if (!def) throw new ValidationError(`Unknown email: ${key}`);
    return def;
}

// What the user got and what could still be sent.
async function describe(userId) {
    const ctx = await loadContext(userId);
    const history = await listForUser(ctx.user.id);
    const { User } = require('../../models');
    const senderIds = [
        ...new Set(history.map((r) => r.triggered_by_user_id).filter(Boolean)),
    ];
    const senders = senderIds.length
        ? await User.findAll({
              where: { id: senderIds },
              attributes: ['id', 'email'],
              raw: true,
          })
        : [];
    const senderEmail = new Map(senders.map((s) => [s.id, s.email]));

    const emails = [];
    for (const def of visible(ctx)) {
        const rows = history.filter(matcher(def));
        const sent = rows.filter((r) => r.status === 'sent');
        const recorded = def.recorded ? def.recorded(ctx) : null;
        const reason = await whyNot(def, ctx);
        emails.push({
            key: def.key,
            can_send: !reason,
            reason,
            sent_count: sent.length,
            last_sent_at: sent[0]?.created_at || null,
            last_status: rows[0]?.status || null,
            // Sent before the log existed: the account record says so, with
            // a date where it kept one.
            recorded_before_log:
                !sent.length && recorded
                    ? recorded === true
                        ? true
                        : new Date(recorded).toISOString()
                    : null,
        });
    }

    return {
        user: {
            id: ctx.user.id,
            email: ctx.user.email,
            language: normalizeLanguage(ctx.user.language),
        },
        emails,
        history: history.map((r) => ({
            id: r.id,
            email: r.email,
            variant: r.variant,
            subject: r.subject,
            recipient: r.recipient,
            language: r.language,
            status: r.status,
            error: r.error,
            created_at: r.created_at,
            sent_by: r.triggered_by_user_id
                ? senderEmail.get(r.triggered_by_user_id) || 'a deleted admin'
                : null,
        })),
    };
}

// Exactly what sending would deliver, for the confirmation step.
async function preview(userId, key) {
    const ctx = await loadContext(userId);
    const def = findDefinition(ctx, key);
    const reason = await whyNot(def, ctx);
    if (reason) throw new ValidationError(reason);
    const language = normalizeLanguage(ctx.user.language);
    const email = renderEmail(def.email, {
        language,
        ...(await def.vars(ctx)),
    });
    return {
        key,
        to: ctx.user.email,
        language,
        subject: email.subject,
        text: email.text,
        html: email.html || null,
        note: def.note ? def.note(ctx) : null,
        link_placeholder: LINK_ON_SEND,
    };
}

async function send(userId, key, adminId) {
    const ctx = await loadContext(userId);
    const def = findDefinition(ctx, key);
    const reason = await whyNot(def, ctx);
    if (reason) throw new ValidationError(reason);
    const result = await def.send(ctx, adminId);
    return {
        sent: !!result?.success,
        error: result?.success
            ? null
            : result?.reason || 'The email was not sent',
    };
}

module.exports = { describe, preview, send, EMAILS, LINK_ON_SEND };
