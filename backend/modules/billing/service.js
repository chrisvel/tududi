'use strict';

const { getConfig } = require('../../config/config');
const { getPlans } = require('../../config/plans');
const entitlements = require('../../services/entitlementsService');
const { logError, logInfo } = require('../../services/logService');
const { isAdmin } = require('../../services/rolesService');
const repository = require('./repository');
const {
    getStripe,
    isBillingConfigured,
    configuredPrices,
} = require('./stripeClient');
const {
    subscriptionToAccountFields,
    deletedSubscriptionFields,
} = require('./subscriptionMapper');
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

    // What the billing tab shows.
    async getStatus(userId) {
        const ent = await entitlements.getEntitlements(userId, {
            includeUsage: true,
        });
        const account = await repository.findAccountByUserId(userId);
        const prices = configuredPrices();
        return {
            ...ent,
            billing_configured: isBillingConfigured(),
            checkout_available:
                isBillingConfigured() &&
                !!(prices.month || prices.year) &&
                !ACTIVE_STATUSES.has(account?.status),
            portal_available:
                isBillingConfigured() && !!account?.stripe_customer_id,
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
        const prices = configuredPrices();
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

    async ensureCustomer(user, account) {
        if (account.stripe_customer_id) return account.stripe_customer_id;
        const stripe = getStripe();
        const customer = await stripe.customers.create({
            email: user.email,
            name: user.name || undefined,
            metadata: { user_id: String(user.id), user_uid: user.uid },
        });
        await account.update({ stripe_customer_id: customer.id });
        return customer.id;
    }

    async createCheckoutSession(userId, interval) {
        if (!isBillingConfigured()) throw new BillingNotConfiguredError();
        const prices = configuredPrices();
        const priceId = prices[interval];
        if (!priceId) {
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

        const customerId = await this.ensureCustomer(user, account);
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            client_reference_id: user.uid,
            line_items: [{ price: priceId, quantity: 1 }],
            allow_promotion_codes: true,
            subscription_data: {
                metadata: { user_id: String(user.id), user_uid: user.uid },
            },
            success_url: billingTabUrl(
                '&checkout=success&session_id={CHECKOUT_SESSION_ID}'
            ),
            cancel_url: billingTabUrl('&checkout=cancel'),
        });

        return { url: session.url, id: session.id };
    }

    async createPortalSession(userId) {
        if (!isBillingConfigured()) throw new BillingNotConfiguredError();
        const account = await repository.findAccountByUserId(userId);
        if (!account?.stripe_customer_id) {
            throw new ValidationError('No billing account to manage yet');
        }
        const stripe = getStripe();
        const session = await stripe.billingPortal.sessions.create({
            customer: account.stripe_customer_id,
            return_url: billingTabUrl(),
        });
        return { url: session.url };
    }

    // Re-reads the subscription from Stripe. Used right after checkout (the
    // redirect can beat the webhook) and by admins.
    async syncFromStripe(userId, { sessionId } = {}) {
        if (!isBillingConfigured()) throw new BillingNotConfiguredError();
        const stripe = getStripe();
        const account = await entitlements.ensureAccount(userId);
        if (!account) throw new NotFoundError('User not found');

        let subscriptionId = account.stripe_subscription_id;
        if (sessionId) {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            const sessionUserUid = session.client_reference_id;
            const user = await repository.findUserById(userId);
            if (!user || sessionUserUid !== user.uid) {
                throw new ForbiddenError(
                    'That checkout belongs to someone else'
                );
            }
            if (session.subscription) {
                subscriptionId =
                    typeof session.subscription === 'string'
                        ? session.subscription
                        : session.subscription.id;
            }
            if (session.customer && !account.stripe_customer_id) {
                await account.update({
                    stripe_customer_id:
                        typeof session.customer === 'string'
                            ? session.customer
                            : session.customer.id,
                });
            }
        }

        if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            await account.update(subscriptionToAccountFields(sub));
        }
        entitlements.invalidate(userId);
        return this.getStatus(userId);
    }

    async resolveAccountForEvent(object) {
        const uid =
            object.client_reference_id ||
            object.metadata?.user_uid ||
            object.subscription_details?.metadata?.user_uid;
        if (uid) {
            const user = await repository.findUserByUid(uid);
            if (user) return entitlements.ensureAccount(user.id);
        }
        const userIdMeta =
            object.metadata?.user_id ||
            object.subscription_details?.metadata?.user_id;
        if (userIdMeta && /^\d+$/.test(String(userIdMeta))) {
            const user = await repository.findUserById(Number(userIdMeta));
            if (user) return entitlements.ensureAccount(user.id);
        }
        const customerId =
            typeof object.customer === 'string'
                ? object.customer
                : object.customer?.id;
        if (customerId) {
            const byCustomer =
                await repository.findAccountByCustomerId(customerId);
            if (byCustomer) return byCustomer;
        }
        if (object.object === 'subscription' && object.id) {
            return repository.findAccountBySubscriptionId(object.id);
        }
        const subId =
            typeof object.subscription === 'string'
                ? object.subscription
                : object.subscription?.id;
        if (subId) return repository.findAccountBySubscriptionId(subId);
        return null;
    }

    async handleWebhook(rawBody, signature) {
        if (!isBillingConfigured()) throw new BillingNotConfiguredError();
        const { webhookSecret } = getConfig().hosted.stripe;
        if (!webhookSecret) throw new BillingNotConfiguredError();

        const stripe = getStripe();
        const event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            webhookSecret
        );

        const record = await repository.recordEvent(event.id, event.type);
        if (!record) {
            return { duplicate: true, type: event.type };
        }

        try {
            const outcome = await this.applyEvent(event);
            await record.update({
                status: outcome.handled ? 'processed' : 'skipped',
                user_id: outcome.userId || null,
                processed_at: new Date(),
            });
            return { ...outcome, type: event.type };
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
        const object = event.data.object;
        const stripe = getStripe();

        switch (event.type) {
            case 'checkout.session.completed': {
                const account = await this.resolveAccountForEvent(object);
                if (!account) return { handled: false, reason: 'unknown_user' };
                const fields = {};
                if (object.customer) {
                    fields.stripe_customer_id =
                        typeof object.customer === 'string'
                            ? object.customer
                            : object.customer.id;
                }
                if (object.subscription) {
                    const subId =
                        typeof object.subscription === 'string'
                            ? object.subscription
                            : object.subscription.id;
                    const sub = await stripe.subscriptions.retrieve(subId);
                    Object.assign(fields, subscriptionToAccountFields(sub));
                }
                await account.update({
                    ...fields,
                    last_stripe_event_created: event.created,
                });
                entitlements.invalidate(account.user_id);
                return { handled: true, userId: account.user_id };
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const account = await this.resolveAccountForEvent(object);
                if (!account) return { handled: false, reason: 'unknown_user' };
                if (
                    account.last_stripe_event_created &&
                    event.created < account.last_stripe_event_created
                ) {
                    return { handled: false, reason: 'stale_event' };
                }
                await account.update({
                    ...subscriptionToAccountFields(object),
                    last_stripe_event_created: event.created,
                });
                entitlements.invalidate(account.user_id);
                return { handled: true, userId: account.user_id };
            }

            case 'customer.subscription.deleted': {
                const account = await this.resolveAccountForEvent(object);
                if (!account) return { handled: false, reason: 'unknown_user' };
                await account.update({
                    ...deletedSubscriptionFields(object),
                    last_stripe_event_created: event.created,
                });
                entitlements.invalidate(account.user_id);
                return { handled: true, userId: account.user_id };
            }

            case 'invoice.payment_failed': {
                const account = await this.resolveAccountForEvent(object);
                if (!account) return { handled: false, reason: 'unknown_user' };
                await account.update({
                    status: 'past_due',
                    last_payment_failed_at: new Date(),
                });
                entitlements.invalidate(account.user_id);
                await this.notifyPaymentFailed(account.user_id);
                return { handled: true, userId: account.user_id };
            }

            case 'invoice.paid':
            case 'invoice.payment_succeeded': {
                const account = await this.resolveAccountForEvent(object);
                if (!account) return { handled: false, reason: 'unknown_user' };
                const fields = { last_payment_failed_at: null };
                if (account.status === 'past_due') fields.status = 'active';
                const subId =
                    typeof object.subscription === 'string'
                        ? object.subscription
                        : object.subscription?.id;
                if (subId) {
                    try {
                        const sub = await stripe.subscriptions.retrieve(subId);
                        Object.assign(fields, subscriptionToAccountFields(sub));
                    } catch (error) {
                        logError(
                            'Could not refresh subscription after payment:',
                            error
                        );
                    }
                }
                await account.update(fields);
                entitlements.invalidate(account.user_id);
                return { handled: true, userId: account.user_id };
            }

            default:
                return { handled: false, reason: 'ignored_type' };
        }
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
                    'Your last payment did not go through. Update your card under Profile > Billing to keep your plan.',
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
                stripe_customer_id: a.stripe_customer_id,
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
        await this.syncFromStripe(userId);
        return this.adminGetAccount(requesterId, userId);
    }

    async assertAdmin(requesterId) {
        if (!(await isAdmin(requesterId))) {
            throw new ForbiddenError('Forbidden');
        }
    }

    // Best effort: a deleted account must not keep being charged.
    async cancelForDeletedUser(userId) {
        if (!isBillingConfigured()) return;
        try {
            const account = await repository.findAccountByUserId(userId);
            if (
                account?.stripe_subscription_id &&
                ACTIVE_STATUSES.has(account.status)
            ) {
                await getStripe().subscriptions.cancel(
                    account.stripe_subscription_id
                );
            }
            if (account?.stripe_customer_id) {
                await getStripe().customers.del(account.stripe_customer_id);
            }
        } catch (error) {
            logError(
                `Failed to cancel Stripe subscription for user ${userId}:`,
                error
            );
        }
    }

    validateConfig() {
        if (!this.isHosted()) return [];
        const problems = [];
        const { secretKey, webhookSecret } = getConfig().hosted.stripe || {};
        const prices = configuredPrices();
        if (!secretKey)
            problems.push(
                'STRIPE_SECRET_KEY is not set: checkout is unavailable'
            );
        if (secretKey && !webhookSecret)
            problems.push(
                'STRIPE_WEBHOOK_SECRET is not set: subscription changes will not be applied'
            );
        if (secretKey && !prices.month && !prices.year)
            problems.push(
                'No STRIPE_PRICE_PRO_MONTHLY or STRIPE_PRICE_PRO_ANNUAL configured: nothing to sell'
            );
        for (const p of problems) logError(`Billing: ${p}`);
        return problems;
    }
}

module.exports = new BillingService();
