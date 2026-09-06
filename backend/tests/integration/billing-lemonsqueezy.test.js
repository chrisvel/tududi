const crypto = require('crypto');
const request = require('supertest');

// Lemon Squeezy is reached over plain fetch, so the API is stood in for by
// a routed mock of global.fetch. Tests shape `ls.subscriptions` and read
// `ls.calls`.
const ls = {
    subscriptions: {},
    customers: {},
    calls: [],
};

const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
});

const realFetch = global.fetch;

function mockFetch(url, options = {}) {
    const method = options.method || 'GET';
    const path = String(url).replace('https://api.lemonsqueezy.com/v1', '');
    ls.calls.push({
        method,
        path,
        body: options.body ? JSON.parse(options.body) : null,
    });

    if (method === 'POST' && path === '/checkouts') {
        return jsonResponse(201, {
            data: {
                type: 'checkouts',
                id: 'chk_1',
                attributes: {
                    url: 'https://tududi.lemonsqueezy.com/checkout/buy/chk_1',
                },
            },
        });
    }
    let m = path.match(/^\/subscriptions\/(\d+)$/);
    if (m && method === 'GET') {
        const sub = ls.subscriptions[m[1]];
        return sub ? jsonResponse(200, { data: sub }) : jsonResponse(404, {});
    }
    if (m && method === 'DELETE') {
        const sub = ls.subscriptions[m[1]];
        if (!sub) return jsonResponse(404, {});
        sub.attributes.status = 'cancelled';
        sub.attributes.cancelled = true;
        return jsonResponse(200, { data: sub });
    }
    if (method === 'GET' && path.startsWith('/subscriptions?')) {
        const email = new URLSearchParams(path.split('?')[1]).get(
            'filter[user_email]'
        );
        const data = Object.values(ls.subscriptions).filter(
            (s) => s.attributes.user_email === email
        );
        return jsonResponse(200, { data });
    }
    m = path.match(/^\/customers\/(\d+)$/);
    if (m && method === 'GET') {
        const customer = ls.customers[m[1]];
        return customer
            ? jsonResponse(200, { data: customer })
            : jsonResponse(404, {});
    }
    return jsonResponse(500, { error: `unmocked ${method} ${path}` });
}

const app = require('../../app');
const { getConfig } = require('../../config/config');
const { BillingAccount, BillingEvent, User } = require('../../models');
const entitlements = require('../../services/entitlementsService');
const { createTestUser } = require('../helpers/testUtils');

const config = getConfig();
const VARIANT_MONTH = '1001';
const VARIANT_YEAR = '1002';
const WEBHOOK_SECRET = 'ls_whsec_test';

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const subscriptionResource = (id, user, overrides = {}) => ({
    type: 'subscriptions',
    id: String(id),
    attributes: {
        store_id: 1,
        customer_id: 77,
        order_id: 500,
        product_id: 10,
        variant_id: Number(VARIANT_YEAR),
        user_email: user.email,
        status: 'active',
        cancelled: false,
        trial_ends_at: null,
        renews_at: '2027-09-06T10:00:00.000000Z',
        ends_at: null,
        created_at: '2026-09-06T10:00:00.000000Z',
        updated_at: '2026-09-06T10:00:00.000000Z',
        urls: {
            update_payment_method:
                'https://tududi.lemonsqueezy.com/subscription/1/payment-details',
            customer_portal:
                'https://tududi.lemonsqueezy.com/billing?expires=1',
        },
        ...overrides,
    },
});

const sign = (body) =>
    crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

const postEvent = (eventName, data, { custom, signature } = {}) => {
    const body = JSON.stringify({
        meta: {
            event_name: eventName,
            custom_data: custom || {},
            test_mode: true,
        },
        data,
    });
    return request(app)
        .post('/api/billing/webhook')
        .set('x-signature', signature || sign(body))
        .set('content-type', 'application/json')
        .send(body);
};

describe('Billing with Lemon Squeezy', () => {
    let user, agent;

    beforeAll(() => {
        global.fetch = mockFetch;
    });

    afterAll(() => {
        global.fetch = realFetch;
    });

    beforeEach(async () => {
        config.hosted.enabled = true;
        config.hosted.trialDays = 0;
        config.hosted.billing.provider = 'lemonsqueezy';
        config.hosted.lemonsqueezy.apiKey = 'ls_test_key';
        config.hosted.lemonsqueezy.storeId = '1';
        config.hosted.lemonsqueezy.webhookSecret = WEBHOOK_SECRET;
        config.hosted.lemonsqueezy.variants.proMonthly = VARIANT_MONTH;
        config.hosted.lemonsqueezy.variants.proAnnual = VARIANT_YEAR;
        entitlements.invalidate();
        ls.subscriptions = {};
        ls.customers = {};
        ls.calls = [];
        user = await createTestUser({ email: `ls_${Date.now()}@example.com` });
        agent = await login(user);
    });

    afterEach(() => {
        config.hosted.enabled = false;
        config.hosted.trialDays = 14;
        config.hosted.billing.provider = 'stripe';
        config.hosted.lemonsqueezy.apiKey = undefined;
        config.hosted.lemonsqueezy.storeId = undefined;
        config.hosted.lemonsqueezy.webhookSecret = undefined;
        config.hosted.lemonsqueezy.variants.proMonthly = undefined;
        config.hosted.lemonsqueezy.variants.proAnnual = undefined;
        entitlements.invalidate();
    });

    it('reports the provider and both intervals', async () => {
        const res = await agent.get('/api/billing');
        expect(res.status).toBe(200);
        expect(res.body.billing_configured).toBe(true);
        expect(res.body.provider).toEqual({
            name: 'lemonsqueezy',
            display_name: 'Lemon Squeezy',
        });
        expect(res.body.intervals).toEqual({ month: true, year: true });
        expect(res.body.checkout_available).toBe(true);
        expect(res.body.portal_available).toBe(false);
    });

    it('creates a checkout for the chosen variant with the user in custom data', async () => {
        const res = await agent
            .post('/api/billing/checkout')
            .send({ interval: 'year' });
        expect(res.status).toBe(200);
        expect(res.body.url).toContain('lemonsqueezy.com/checkout');
        const call = ls.calls.find((c) => c.path === '/checkouts');
        expect(call.body.data.relationships.variant.data.id).toBe(VARIANT_YEAR);
        expect(call.body.data.relationships.store.data.id).toBe('1');
        expect(call.body.data.attributes.checkout_data.custom).toEqual({
            user_uid: user.uid,
            user_id: String(user.id),
        });
        expect(call.body.data.attributes.checkout_data.email).toBe(user.email);
        expect(
            call.body.data.attributes.product_options.redirect_url
        ).toContain('checkout=success');
    });

    it('syncs by email after the redirect, which carries no reference', async () => {
        ls.subscriptions[1] = subscriptionResource(1, user);
        const res = await agent.post('/api/billing/sync').send({});
        expect(res.status).toBe(200);
        expect(res.body.plan).toBe('pro');
        const account = await BillingAccount.findOne({
            where: { user_id: user.id },
        });
        expect(account.provider).toBe('lemonsqueezy');
        expect(account.provider_subscription_id).toBe('1');
        expect(account.provider_customer_id).toBe('77');
        expect(account.billing_interval).toBe('year');
        expect(account.status).toBe('active');
        expect(new Date(account.current_period_end).toISOString()).toBe(
            '2027-09-06T10:00:00.000Z'
        );
    });

    it('opens the customer portal from the subscription', async () => {
        ls.subscriptions[1] = subscriptionResource(1, user);
        await BillingAccount.create({
            user_id: user.id,
            provider: 'lemonsqueezy',
            provider_subscription_id: '1',
            status: 'active',
            plan: 'pro',
        });
        const res = await agent.post('/api/billing/portal');
        expect(res.status).toBe(200);
        expect(res.body.url).toContain('lemonsqueezy.com/billing');
    });

    describe('webhooks', () => {
        it('rejects a missing or wrong signature and records nothing', async () => {
            const wrong = await postEvent(
                'subscription_created',
                subscriptionResource(1, user),
                { signature: 'deadbeef' }
            );
            expect(wrong.status).toBe(400);
            const missing = await request(app)
                .post('/api/billing/webhook')
                .set('content-type', 'application/json')
                .send('{}');
            expect(missing.status).toBe(400);
            expect(await BillingEvent.count()).toBe(0);
        });

        it('activates Pro on subscription_created and ignores a redelivery', async () => {
            const data = subscriptionResource(1, user);
            const first = await postEvent('subscription_created', data, {
                custom: { user_uid: user.uid },
            });
            expect(first.status).toBe(200);
            expect(first.body.handled).toBe(true);
            const again = await postEvent('subscription_created', data, {
                custom: { user_uid: user.uid },
            });
            expect(again.body.duplicate).toBe(true);
            expect(await BillingEvent.count()).toBe(1);

            const account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.plan).toBe('pro');
            expect(account.status).toBe('active');
            expect(account.provider).toBe('lemonsqueezy');
            expect(account.provider_subscription_id).toBe('1');
            const status = await agent.get('/api/billing');
            expect(status.body.plan).toBe('pro');
            expect(status.body.portal_available).toBe(true);
        });

        it('keeps access until ends_at when cancelled, drops to Free when expired', async () => {
            await BillingAccount.create({
                user_id: user.id,
                provider: 'lemonsqueezy',
                provider_subscription_id: '1',
                provider_customer_id: '77',
                status: 'active',
                plan: 'pro',
            });
            const cancelled = await postEvent(
                'subscription_cancelled',
                subscriptionResource(1, user, {
                    status: 'cancelled',
                    cancelled: true,
                    ends_at: '2027-09-06T10:00:00.000000Z',
                    updated_at: '2026-10-01T00:00:00.000000Z',
                })
            );
            expect(cancelled.body.handled).toBe(true);
            let account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.status).toBe('active');
            expect(account.cancel_at_period_end).toBe(true);
            expect(account.plan).toBe('pro');

            const expired = await postEvent(
                'subscription_expired',
                subscriptionResource(1, user, {
                    status: 'expired',
                    cancelled: true,
                    ends_at: '2027-09-06T10:00:00.000000Z',
                    updated_at: '2027-09-06T10:00:01.000000Z',
                })
            );
            expect(expired.body.handled).toBe(true);
            account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.status).toBe('canceled');
            expect(account.plan).toBe('free');
            const status = await agent.get('/api/billing');
            expect(status.body.plan).toBe('free');
        });

        it('drops an update that is older than the last one applied', async () => {
            await postEvent(
                'subscription_updated',
                subscriptionResource(1, user, {
                    updated_at: '2026-10-02T00:00:00.000000Z',
                }),
                { custom: { user_uid: user.uid } }
            );
            const stale = await postEvent(
                'subscription_updated',
                subscriptionResource(1, user, {
                    status: 'paused',
                    updated_at: '2026-10-01T00:00:00.000000Z',
                })
            );
            expect(stale.body.handled).toBe(false);
            expect(stale.body.reason).toBe('stale_event');
            const account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.status).toBe('active');
        });

        it('marks past_due on a failed payment and active again on success', async () => {
            ls.subscriptions[1] = subscriptionResource(1, user);
            await BillingAccount.create({
                user_id: user.id,
                provider: 'lemonsqueezy',
                provider_subscription_id: '1',
                provider_customer_id: '77',
                status: 'active',
                plan: 'pro',
            });
            const invoice = (status, updated) => ({
                type: 'subscription-invoices',
                id: '900',
                attributes: {
                    subscription_id: 1,
                    customer_id: 77,
                    status,
                    updated_at: updated,
                },
            });
            const failed = await postEvent(
                'subscription_payment_failed',
                invoice('unpaid', '2026-10-06T00:00:00.000000Z')
            );
            expect(failed.body.handled).toBe(true);
            let account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.status).toBe('past_due');
            expect(account.last_payment_failed_at).not.toBeNull();

            const recovered = await postEvent(
                'subscription_payment_recovered',
                invoice('paid', '2026-10-07T00:00:00.000000Z')
            );
            expect(recovered.body.handled).toBe(true);
            account = await BillingAccount.findOne({
                where: { user_id: user.id },
            });
            expect(account.status).toBe('active');
            expect(account.last_payment_failed_at).toBeNull();
        });

        it('acknowledges an event for an unknown customer without applying it', async () => {
            const res = await postEvent(
                'subscription_updated',
                subscriptionResource(
                    55,
                    { email: 'nobody@example.com' },
                    { customer_id: 999 }
                )
            );
            expect(res.status).toBe(200);
            expect(res.body.handled).toBe(false);
            expect(res.body.reason).toBe('unknown_user');
        });
    });

    it('cancels the subscription when the account is deleted', async () => {
        ls.subscriptions[1] = subscriptionResource(1, user);
        await BillingAccount.create({
            user_id: user.id,
            provider: 'lemonsqueezy',
            provider_subscription_id: '1',
            provider_customer_id: '77',
            status: 'active',
            plan: 'pro',
        });
        const res = await agent
            .delete('/api/profile')
            .send({ password: 'password123' });
        expect(res.status).toBe(204);
        expect(
            ls.calls.some(
                (c) => c.method === 'DELETE' && c.path === '/subscriptions/1'
            )
        ).toBe(true);
        expect(await User.findByPk(user.id)).toBeNull();
    });
});
