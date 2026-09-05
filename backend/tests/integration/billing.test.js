const request = require('supertest');

// A stand-in for the Stripe SDK. Tests set mockStripe.* to shape answers.
const mockStripe = {
    event: null,
    signatureError: false,
    subscriptions: {},
    sessions: {},
    created: [],
    cancelled: [],
};
jest.mock('stripe', () => {
    class StripeSignatureVerificationError extends Error {
        constructor() {
            super('bad signature');
            this.type = 'StripeSignatureVerificationError';
        }
    }
    // A plain function, not jest.fn(): the Jest config resets mock
    // implementations between tests, which would leave `new Stripe()`
    // returning undefined from the second test on.
    return function Stripe() {
        return {
            webhooks: {
                constructEvent: (body, sig) => {
                    if (mockStripe.signatureError || sig !== 'valid') {
                        throw new StripeSignatureVerificationError();
                    }
                    return JSON.parse(body.toString());
                },
            },
            customers: {
                create: async (params) => {
                    const customer = {
                        id: `cus_${mockStripe.created.length + 1}`,
                        ...params,
                    };
                    mockStripe.created.push(customer);
                    return customer;
                },
                del: async (id) => ({ id, deleted: true }),
            },
            subscriptions: {
                retrieve: async (id) => {
                    if (!mockStripe.subscriptions[id])
                        throw new Error(`no sub ${id}`);
                    return mockStripe.subscriptions[id];
                },
                cancel: async (id) => {
                    mockStripe.cancelled.push(id);
                    return { id, status: 'canceled' };
                },
            },
            checkout: {
                sessions: {
                    create: async (params) => ({
                        id: 'cs_test_1',
                        url: 'https://checkout.stripe.test/cs_test_1',
                        ...params,
                    }),
                    retrieve: async (id) => mockStripe.sessions[id],
                },
            },
            billingPortal: {
                sessions: {
                    create: async () => ({
                        url: 'https://portal.stripe.test/x',
                    }),
                },
            },
        };
    };
});

const app = require('../../app');
const { getConfig } = require('../../config/config');
const { BillingAccount, BillingEvent, Role, User } = require('../../models');
const entitlements = require('../../services/entitlementsService');
const stripeClient = require('../../modules/billing/stripeClient');
const { createTestUser } = require('../helpers/testUtils');

const config = getConfig();
const PRICE_MONTH = 'price_month';
const PRICE_YEAR = 'price_year';

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const subscriptionFixture = (overrides = {}) => ({
    id: 'sub_1',
    object: 'subscription',
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    items: {
        data: [
            {
                price: { id: PRICE_MONTH, recurring: { interval: 'month' } },
                current_period_start: 1_800_000_000,
                current_period_end: 1_802_592_000,
            },
        ],
    },
    metadata: {},
    ...overrides,
});

const postEvent = (event, sig = 'valid') =>
    request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', sig)
        .set('content-type', 'application/json')
        .send(JSON.stringify(event));

function enableHostedBilling() {
    config.hosted.enabled = true;
    config.hosted.trialDays = 0;
    config.hosted.stripe.secretKey = 'sk_test_x';
    config.hosted.stripe.webhookSecret = 'whsec_x';
    config.hosted.stripe.prices.proMonthly = PRICE_MONTH;
    config.hosted.stripe.prices.proAnnual = PRICE_YEAR;
    stripeClient._reset();
    entitlements.invalidate();
}

function disableHostedBilling() {
    config.hosted.enabled = false;
    config.hosted.trialDays = 14;
    config.hosted.stripe.secretKey = undefined;
    config.hosted.stripe.webhookSecret = undefined;
    config.hosted.stripe.prices.proMonthly = undefined;
    config.hosted.stripe.prices.proAnnual = undefined;
    stripeClient._reset();
    entitlements.invalidate();
}

describe('Billing with hosted mode off', () => {
    it('hides every billing route, webhook included', async () => {
        const user = await createTestUser({
            email: `off_${Date.now()}@example.com`,
        });
        const agent = await login(user);
        expect((await agent.get('/api/billing')).status).toBe(404);
        expect(
            (await agent.post('/api/billing/checkout').send({})).status
        ).toBe(404);
        expect(
            (
                await postEvent({
                    id: 'evt_off',
                    type: 'x',
                    data: { object: {} },
                })
            ).status
        ).toBe(404);
        expect((await agent.get('/api/admin/billing')).status).toBe(404);
    });
});

describe('Billing with hosted mode on', () => {
    let user, agent;

    beforeEach(async () => {
        enableHostedBilling();
        mockStripe.signatureError = false;
        mockStripe.subscriptions = {};
        mockStripe.sessions = {};
        mockStripe.created = [];
        mockStripe.cancelled = [];
        user = await createTestUser({
            email: `bill_${Date.now()}@example.com`,
        });
        agent = await login(user);
    });

    afterEach(disableHostedBilling);

    describe('status and catalog', () => {
        it('reports the free plan, usage, and what the UI may offer', async () => {
            const res = await agent.get('/api/billing');
            expect(res.status).toBe(200);
            expect(res.body.plan).toBe('free');
            expect(res.body.billing_configured).toBe(true);
            expect(res.body.checkout_available).toBe(true);
            expect(res.body.portal_available).toBe(false);
            expect(res.body.intervals).toEqual({ month: true, year: true });
            expect(res.body.usage.tasks).toBe(0);
        });

        it('publishes the catalog without price ids', async () => {
            const res = await agent.get('/api/billing/plans');
            expect(res.status).toBe(200);
            expect(res.body.plans.map((p) => p.key)).toEqual(['free', 'pro']);
            expect(JSON.stringify(res.body)).not.toContain(PRICE_MONTH);
        });
    });

    describe('checkout and portal', () => {
        it('creates a customer and a checkout session for the chosen interval', async () => {
            const res = await agent
                .post('/api/billing/checkout')
                .send({ interval: 'year' });
            expect(res.status).toBe(200);
            expect(res.body.url).toMatch(/^https:\/\/checkout/);
            expect(mockStripe.created).toHaveLength(1);
            expect(mockStripe.created[0].email).toBe(user.email);

            const account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.stripe_customer_id).toBe('cus_1');
        });

        it('refuses checkout while a subscription is active', async () => {
            await BillingAccount.create({
                user_id: user.id,
                status: 'active',
                plan: 'pro',
                stripe_customer_id: 'cus_9',
            });
            const res = await agent
                .post('/api/billing/checkout')
                .send({ interval: 'month' });
            expect(res.status).toBe(409);
        });

        it('opens the portal only once a customer exists', async () => {
            const before = await agent.post('/api/billing/portal');
            expect(before.status).toBe(400);

            await BillingAccount.create({
                user_id: user.id,
                stripe_customer_id: 'cus_2',
            });
            const after = await agent.post('/api/billing/portal');
            expect(after.status).toBe(200);
            expect(after.body.url).toMatch(/^https:\/\/portal/);
        });

        it('answers 503 when Stripe is not configured', async () => {
            config.hosted.stripe.secretKey = undefined;
            stripeClient._reset();
            const res = await agent
                .post('/api/billing/checkout')
                .send({ interval: 'month' });
            expect(res.status).toBe(503);
            expect(res.body.code).toBe('BILLING_NOT_CONFIGURED');
        });
    });

    describe('sync after checkout', () => {
        it('reads the subscription from the checkout session and refuses other users sessions', async () => {
            await BillingAccount.create({
                user_id: user.id,
                stripe_customer_id: 'cus_1',
            });
            mockStripe.sessions.cs_1 = {
                id: 'cs_1',
                client_reference_id: user.uid,
                customer: 'cus_1',
                subscription: 'sub_1',
            };
            mockStripe.subscriptions.sub_1 = subscriptionFixture();

            const res = await agent
                .post('/api/billing/sync')
                .send({ session_id: 'cs_1' });
            expect(res.status).toBe(200);
            expect(res.body.plan).toBe('pro');
            expect(res.body.subscription.status).toBe('active');

            const other = await createTestUser({
                email: `other_${Date.now()}@example.com`,
            });
            const otherAgent = await login(other);
            const stolen = await otherAgent
                .post('/api/billing/sync')
                .send({ session_id: 'cs_1' });
            expect(stolen.status).toBe(403);
        });
    });

    describe('webhooks', () => {
        it('rejects a bad signature', async () => {
            const res = await postEvent(
                {
                    id: 'evt_sig',
                    type: 'customer.subscription.updated',
                    data: { object: {} },
                },
                'wrong'
            );
            expect(res.status).toBe(400);
            expect(await BillingEvent.count()).toBe(0);
        });

        it('applies checkout.session.completed once, even when redelivered', async () => {
            mockStripe.subscriptions.sub_1 = subscriptionFixture();
            const event = {
                id: 'evt_1',
                type: 'checkout.session.completed',
                created: 1_800_000_100,
                data: {
                    object: {
                        object: 'checkout.session',
                        client_reference_id: user.uid,
                        customer: 'cus_1',
                        subscription: 'sub_1',
                    },
                },
            };

            const first = await postEvent(event);
            expect(first.status).toBe(200);
            expect(first.body.handled).toBe(true);

            const again = await postEvent(event);
            expect(again.status).toBe(200);
            expect(again.body.duplicate).toBe(true);

            expect(
                await BillingEvent.count({
                    where: { stripe_event_id: 'evt_1' },
                })
            ).toBe(1);
            const account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.status).toBe('active');
            expect(account.plan).toBe('pro');
            expect(account.billing_interval).toBe('month');
            expect(account.stripe_subscription_id).toBe('sub_1');
            expect(new Date(account.current_period_end).getTime()).toBe(
                1_802_592_000 * 1000
            );

            const status = await agent.get('/api/billing');
            expect(status.body.plan).toBe('pro');
            expect(status.body.reason).toBe('subscription');
        });

        it('maps subscription updates, ignores stale ones, and handles deletion', async () => {
            await BillingAccount.create({
                user_id: user.id,
                stripe_customer_id: 'cus_1',
                stripe_subscription_id: 'sub_1',
                status: 'active',
                plan: 'pro',
            });

            const updated = await postEvent({
                id: 'evt_u1',
                type: 'customer.subscription.updated',
                created: 2000,
                data: {
                    object: subscriptionFixture({
                        cancel_at_period_end: true,
                        status: 'active',
                    }),
                },
            });
            expect(updated.body.handled).toBe(true);
            let account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.cancel_at_period_end).toBe(true);

            const stale = await postEvent({
                id: 'evt_u0',
                type: 'customer.subscription.updated',
                created: 1000,
                data: {
                    object: subscriptionFixture({
                        cancel_at_period_end: false,
                    }),
                },
            });
            expect(stale.body.handled).toBe(false);
            expect(stale.body.reason).toBe('stale_event');
            account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.cancel_at_period_end).toBe(true);

            const deleted = await postEvent({
                id: 'evt_d1',
                type: 'customer.subscription.deleted',
                created: 3000,
                data: {
                    object: subscriptionFixture({
                        status: 'canceled',
                        canceled_at: 3000,
                    }),
                },
            });
            expect(deleted.body.handled).toBe(true);
            account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.status).toBe('canceled');
            expect(account.plan).toBe('free');

            const status = await agent.get('/api/billing');
            expect(status.body.plan).toBe('free');
        });

        it('marks payment failures past_due, notifies, and recovers on payment', async () => {
            await BillingAccount.create({
                user_id: user.id,
                stripe_customer_id: 'cus_1',
                stripe_subscription_id: 'sub_1',
                status: 'active',
                plan: 'pro',
                current_period_end: new Date(Date.now() + 86_400_000),
            });
            mockStripe.subscriptions.sub_1 = subscriptionFixture();

            const failed = await postEvent({
                id: 'evt_f1',
                type: 'invoice.payment_failed',
                created: 4000,
                data: {
                    object: {
                        object: 'invoice',
                        customer: 'cus_1',
                        subscription: 'sub_1',
                    },
                },
            });
            expect(failed.body.handled).toBe(true);
            let account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.status).toBe('past_due');
            expect(account.last_payment_failed_at).not.toBeNull();

            const { Notification } = require('../../models');
            const note = await Notification.findOne({
                where: { user_id: user.id, level: 'warning' },
            });
            expect(note).not.toBeNull();

            // still pro inside the grace window
            const during = await agent.get('/api/billing');
            expect(during.body.plan).toBe('pro');
            expect(during.body.reason).toBe('grace');

            const paid = await postEvent({
                id: 'evt_p1',
                type: 'invoice.paid',
                created: 5000,
                data: {
                    object: {
                        object: 'invoice',
                        customer: 'cus_1',
                        subscription: 'sub_1',
                    },
                },
            });
            expect(paid.body.handled).toBe(true);
            account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.status).toBe('active');
            expect(account.last_payment_failed_at).toBeNull();
        });

        it('skips events for unknown customers and unknown types without failing', async () => {
            const unknown = await postEvent({
                id: 'evt_x1',
                type: 'customer.subscription.updated',
                created: 1,
                data: {
                    object: subscriptionFixture({
                        customer: 'cus_nobody',
                        id: 'sub_nobody',
                    }),
                },
            });
            expect(unknown.status).toBe(200);
            expect(unknown.body.handled).toBe(false);
            expect(unknown.body.reason).toBe('unknown_user');

            const ignored = await postEvent({
                id: 'evt_x2',
                type: 'charge.refunded',
                created: 1,
                data: { object: {} },
            });
            expect(ignored.status).toBe(200);
            expect(ignored.body.reason).toBe('ignored_type');
            const row = await BillingEvent.findOne({
                where: { stripe_event_id: 'evt_x2' },
            });
            expect(row.status).toBe('skipped');
        });
    });

    describe('admin', () => {
        let admin, adminAgent;

        beforeEach(async () => {
            admin = await createTestUser({
                email: `admin_${Date.now()}@example.com`,
            });
            await Role.update(
                { is_admin: true },
                { where: { user_id: admin.id } }
            );
            adminAgent = await login(admin);
        });

        it('is refused for regular users', async () => {
            expect((await agent.get('/api/admin/billing')).status).toBe(403);
            expect(
                (
                    await agent
                        .put(`/api/admin/billing/${user.id}/override`)
                        .send({ plan: 'pro' })
                ).status
            ).toBe(403);
        });

        it('lists accounts, comps a user, and clears the override', async () => {
            await agent.get('/api/billing'); // creates the row

            const list = await adminAgent.get('/api/admin/billing');
            expect(list.status).toBe(200);
            expect(
                list.body.accounts.find((a) => a.user_id === user.id)
            ).toBeDefined();
            expect(Array.isArray(list.body.summary)).toBe(true);

            const comp = await adminAgent
                .put(`/api/admin/billing/${user.id}/override`)
                .send({
                    plan: 'pro',
                    reason: 'beta tester',
                    expires_at: '2099-01-01',
                });
            expect(comp.status).toBe(200);
            expect(comp.body.status.plan).toBe('pro');
            expect(comp.body.status.reason).toBe('override');

            const mine = await agent.get('/api/billing');
            expect(mine.body.plan).toBe('pro');

            const bad = await adminAgent
                .put(`/api/admin/billing/${user.id}/override`)
                .send({ plan: 'platinum' });
            expect(bad.status).toBe(400);

            const clear = await adminAgent.delete(
                `/api/admin/billing/${user.id}/override`
            );
            expect(clear.status).toBe(200);
            expect(clear.body.status.plan).toBe('free');
        });
    });

    describe('account deletion', () => {
        it('cancels the Stripe subscription before erasing the account', async () => {
            await BillingAccount.create({
                user_id: user.id,
                stripe_customer_id: 'cus_1',
                stripe_subscription_id: 'sub_1',
                status: 'active',
                plan: 'pro',
            });
            const res = await agent
                .delete('/api/profile')
                .send({ password: 'password123' });
            expect(res.status).toBe(204);
            expect(mockStripe.cancelled).toEqual(['sub_1']);
            expect(await User.findByPk(user.id)).toBeNull();
            expect(
                await BillingAccount.count({ where: { user_id: user.id } })
            ).toBe(0);
        });
    });
});
