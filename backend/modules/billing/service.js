'use strict';

const { getConfig } = require('../../config/config');
const { getPlans } = require('../../config/plans');
const entitlements = require('../../services/entitlementsService');
const { logError, logInfo } = require('../../services/logService');
const { isAdmin } = require('../../services/rolesService');
const repository = require('./repository');
const providers = require('./providers');
const {
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
    BillingNotConfiguredError,
} = require('../../shared/errors');

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

function billingTabUrl(extra = '') {
    return `${getConfig().frontendUrl}/profile?section=billing${extra}`;
}

class BillingService {
    isHosted() {
        return entitlements.isHostedMode();
    }

    provider() {
        return providers.getProvider();
    }

    // What the billing tab shows.
    async getStatus(userId) {
        const ent = await entitlements.getEntitlements(userId, {
            includeUsage: true,
        });
        const account = await repository.findAccountByUserId(userId);
        const provider = this.provider();
        const configured = providers.isBillingConfigured();
        const prices = provider.configuredPrices();
        return {
            ...ent,
            billing_configured: configured,
            provider: {
                name: provider.name,
                display_name: provider.displayName,
            },
            checkout_available:
                configured &&
                !!(prices.month || prices.year) &&
                !ACTIVE_STATUSES.has(account?.status),
            portal_available: configured && provider.canOpenPortal(account),
            intervals: {
                month: !!prices.month,
                year: !!prices.year,
            },
            subscription: account
                ? {
                      status: account.status,
                      interval: account.billing_interval,
                      current_period_end: account.current_period_end,
                      cancel_at_period_end: account.cancel_at_period_end,
                      last_payment_failed_at: account.last_payment_failed_at,
                  }
                : null,
        };
    }

    // Public catalog: names, limits and features, never price ids.
    getCatalog() {
        const prices = this.provider().configuredPrices();
        return {
            plans: Object.values(getPlans()).map((plan) => ({
                key: plan.key,
                name: plan.name,
                limits: plan.limits,
                features: plan.features,
            })),
            intervals: { month: !!prices.month, year: !!prices.year },
            trial_days: getConfig().hosted.trialDays,
        };
    }

    async createCheckoutSession(userId, interval) {
        if (!providers.isBillingConfigured())
            throw new BillingNotConfiguredError();
        const provider = this.provider();
        if (!provider.configuredPrices()[interval]) {
            throw new ValidationError(
                `No ${interval === 'year' ? 'annual' : 'monthly'} price is configured`
            );
        }

        const user = await repository.findUserById(userId);
        if (!user) throw new NotFoundError('User not found');
        const account = await entitlements.ensureAccount(userId);
        if (ACTIVE_STATUSES.has(account.status)) {
            throw new ConflictError(
                'You already have a subscription. Use "Manage subscription" to change it.'
            );
        }

        const checkout = await provider.createCheckout({
            user,
            account,
            interval,
            successUrl: billingTabUrl('&checkout=success'),
            cancelUrl: billingTabUrl('&checkout=cancel'),
        });
        if (
            checkout.customerId &&
            checkout.customerId !== account.provider_customer_id
        ) {
            await account.update({
                provider: provider.name,
                provider_customer_id: checkout.customerId,
            });
        }
        return { url: checkout.url, id: checkout.id };
    }

    async createPortalSession(userId) {
        if (!providers.isBillingConfigured())
            throw new BillingNotConfiguredError();
        const account = await repository.findAccountByUserId(userId);
        const provider = this.provider();
        if (!provider.canOpenPortal(account)) {
            throw new ValidationError('No billing account to manage yet');
        }
        return provider.createPortal({ account, returnUrl: billingTabUrl() });
    }

    // Re-reads the subscription from the provider. Used right after
    // checkout (the redirect can beat the webhook) and by admins.
    async syncFromProvider(userId, { checkoutRef } = {}) {
        if (!providers.isBillingConfigured())
            throw new BillingNotConfiguredError();
        const account = await entitlements.ensureAccount(userId);
        if (!account) throw new NotFoundError('User not found');
        const user = await repository.findUserById(userId);
        if (!user) throw new NotFoundError('User not found');

        const provider = this.provider();
        const fields = await provider.sync({ user, account, checkoutRef });
        if (fields) {
            await account.update({ provider: provider.name, ...fields });
        }
        entitlements.invalidate(userId);
        return this.getStatus(userId);
    }

    async resolveAccount(ref) {
        if (!ref) return null;
        if (ref.userUid) {
            const user = await repository.findUserByUid(ref.userUid);
            if (user) return entitlements.ensureAccount(user.id);
        }
        if (ref.userId && /^\d+$/.test(String(ref.userId))) {
            const user = await repository.findUserById(Number(ref.userId));
            if (user) return entitlements.ensureAccount(user.id);
        }
        if (ref.customerId) {
            const byCustomer = await repository.findAccountByCustomerId(
                ref.customerId
            );
            if (byCustomer) return byCustomer;
        }
        if (ref.subscriptionId) {
            return repository.findAccountBySubscriptionId(ref.subscriptionId);
        }
        return null;
    }

    async handleWebhook(rawBody, headers) {
        if (!providers.isBillingConfigured())
            throw new BillingNotConfiguredError();
        const provider = this.provider();
        const event = await provider.parseWebhook(rawBody, headers);

        const record = await repository.recordEvent(event.id, event.rawType);
        if (!record) {
            return { duplicate: true, type: event.rawType };
        }

        try {
            const outcome = await this.applyEvent(event);
            await record.update({
                status: outcome.handled ? 'processed' : 'skipped',
                user_id: outcome.userId || null,
                processed_at: new Date(),
            });
            return { ...outcome, type: event.rawType };
        } catch (error) {
            await record.update({
                status: 'failed',
                error: String(error.message || error).slice(0, 2000),
                processed_at: new Date(),
            });
            throw error;
        }
    }

    async applyEvent(event) {
        if (event.type === 'ignored') {
            return { handled: false, reason: 'ignored_type' };
        }
        const account = await this.resolveAccount(event.ref);
        if (!account) return { handled: false, reason: 'unknown_user' };
        const providerName = this.provider().name;
        const stamp = {
            provider: providerName,
            last_provider_event_at: event.createdAt,
        };

        switch (event.type) {
            case 'checkout.completed':
                await account.update({ ...event.fields, ...stamp });
                break;

            case 'subscription.updated':
                if (
                    account.last_provider_event_at &&
                    event.createdAt < account.last_provider_event_at
                ) {
                    return { handled: false, reason: 'stale_event' };
                }
                await account.update({ ...event.fields, ...stamp });
                break;

            case 'subscription.deleted':
                await account.update({ ...event.fields, ...stamp });
                break;

            case 'payment.failed':
                await account.update({
                    ...event.fields,
                    status: 'past_due',
                    last_payment_failed_at: new Date(),
                    provider: providerName,
                });
                entitlements.invalidate(account.user_id);
                await this.notifyPaymentFailed(account.user_id);
                return { handled: true, userId: account.user_id };

            case 'payment.succeeded': {
                const fields = {
                    last_payment_failed_at: null,
                    provider: providerName,
                };
                if (account.status === 'past_due') fields.status = 'active';
                await account.update({ ...fields, ...event.fields });
                break;
            }

            default:
                return { handled: false, reason: 'ignored_type' };
        }

        entitlements.invalidate(account.user_id);
        return { handled: true, userId: account.user_id };
    }

    async notifyPaymentFailed(userId) {
        try {
            const { Notification } = require('../../models');
            await Notification.createNotification({
                userId,
                type: 'system',
                level: 'warning',
                title: 'Payment failed',
                message:
                    'Your last payment did not go through. Update your payment method under Profile > Billing to keep your plan.',
                data: { section: 'billing' },
            });
        } catch (error) {
            logError('Failed to create payment-failed notification:', error);
        }
    }

    // Admin

    async adminListAccounts(requesterId, query) {
        await this.assertAdmin(requesterId);
        const [summary, list] = await Promise.all([
            repository.summary(),
            repository.listAccounts({
                q: query.q,
                page: Number(query.page) || 1,
                limit: Math.min(Number(query.limit) || 50, 200),
            }),
        ]);
        return {
            summary,
            total: list.count,
            accounts: list.rows.map((a) => ({
                user_id: a.user_id,
                email: a.User?.email,
                name: a.User?.name,
                plan: a.plan,
                status: a.status,
                trial_ends_at: a.trial_ends_at,
                current_period_end: a.current_period_end,
                cancel_at_period_end: a.cancel_at_period_end,
                override_plan: a.override_plan,
                override_expires_at: a.override_expires_at,
                provider: a.provider,
                provider_customer_id: a.provider_customer_id,
                provider_subscription_id: a.provider_subscription_id,
            })),
        };
    }

    async adminGetAccount(requesterId, userId) {
        await this.assertAdmin(requesterId);
        const user = await repository.findUserById(userId);
        if (!user) throw new NotFoundError('User not found');
        const status = await this.getStatus(userId);
        const account = await repository.findAccountByUserId(userId);
        return {
            user: { id: user.id, email: user.email, name: user.name },
            status,
            account,
        };
    }

    async adminSetOverride(requesterId, userId, { plan, expires_at, reason }) {
        await this.assertAdmin(requesterId);
        if (!getPlans()[plan]) {
            throw new ValidationError(`Unknown plan: ${plan}`);
        }
        const account = await entitlements.ensureAccount(userId);
        if (!account) throw new NotFoundError('User not found');
        const expires = expires_at ? new Date(expires_at) : null;
        if (expires_at && Number.isNaN(expires.getTime())) {
            throw new ValidationError('expires_at must be a valid date');
        }
        await account.update({
            override_plan: plan,
            override_expires_at: expires,
            override_reason: reason ? String(reason).slice(0, 255) : null,
            override_by_user_id: requesterId,
        });
        entitlements.invalidate(userId);
        logInfo(
            `Admin ${requesterId} set plan override ${plan} for user ${userId}`
        );
        return this.adminGetAccount(requesterId, userId);
    }

    async adminClearOverride(requesterId, userId) {
        await this.assertAdmin(requesterId);
        const account = await repository.findAccountByUserId(userId);
        if (account) {
            await account.update({
                override_plan: null,
                override_expires_at: null,
                override_reason: null,
                override_by_user_id: null,
            });
        }
        entitlements.invalidate(userId);
        return this.adminGetAccount(requesterId, userId);
    }

    async adminSync(requesterId, userId) {
        await this.assertAdmin(requesterId);
        await this.syncFromProvider(userId);
        return this.adminGetAccount(requesterId, userId);
    }

    async assertAdmin(requesterId) {
        if (!(await isAdmin(requesterId))) {
            throw new ForbiddenError('Forbidden');
        }
    }

    // Best effort: a deleted account must not keep being charged.
    async cancelForDeletedUser(userId) {
        if (!providers.isBillingConfigured()) return;
        try {
            const account = await repository.findAccountByUserId(userId);
            if (!account) return;
            const provider = this.provider();
            if (
                account.provider_subscription_id &&
                !ACTIVE_STATUSES.has(account.status)
            ) {
                // Nothing to cancel, but a Stripe customer may still exist
                await provider.cancelForDeletedUser({
                    ...account.get({ plain: true }),
                    provider_subscription_id: null,
                });
                return;
            }
            await provider.cancelForDeletedUser(account.get({ plain: true }));
        } catch (error) {
            logError(
                `Failed to cancel the subscription for user ${userId}:`,
                error
            );
        }
    }

    validateConfig() {
        if (!this.isHosted()) return [];
        const problems = this.provider().validateConfig();
        for (const p of problems) logError(`Billing: ${p}`);
        return problems;
    }
}

module.exports = new BillingService();
