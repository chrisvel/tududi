const crypto = require('crypto');
const request = require('supertest');

// Paddle and Lemon Squeezy are reached over plain fetch, so both APIs are
// stood in for by one routed mock of global.fetch. Tests shape
// `paddle.subscriptions` / `ls.subscriptions` and read `calls`.
const paddle = {
    subscriptions: {},
    customers: [],
    transactions: {},
    checkoutUrl: null,
};
const ls = { subscriptions: {} };
let calls = [];

const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
});
const data = (status, entity) => jsonResponse(status, { data: entity });

const realFetch = global.fetch;

function mockFetch(url, options = {}) {
    const method = options.method || 'GET';
    const href = String(url);
    const body = options.body ? JSON.parse(options.body) : null;

    if (href.startsWith('https://api.lemonsqueezy.com/v1')) {
        const path = href.replace('https://api.lemonsqueezy.com/v1', '');
        calls.push({ api: 'ls', method, path, body });
        const m = path.match(/^\/subscriptions\/(\d+)$/);
        const sub = m && ls.subscriptions[m[1]];
        if (sub) return jsonResponse(200, { data: sub });
        return jsonResponse(500, { error: `unmocked ${method} ${path}` });
    }

    const path = href.replace('https://api.paddle.com', '');
    calls.push({ api: 'paddle', method, path, body });
    if (method === 'GET' && path.startsWith('/customers?')) {
        const email = new URLSearchParams(path.split('?')[1]).get('email');
        return data(
            200,
            paddle.customers.filter((c) => c.email === email)
        );
    }
    if (method === 'POST' && path === '/customers') {
        const customer = { id: 'ctm_new', email: body.email };
        paddle.customers.push(customer);
        return data(201, customer);
    }
    if (method === 'POST' && path === '/transactions') {
        return data(201, {
            id: 'txn_1',
            status: 'ready',
            checkout: paddle.checkoutUrl
                ? { url: `${paddle.checkoutUrl}?_ptxn=txn_1` }
                : null,
        });
    }
    let m = path.match(/^\/transactions\/(\w+)$/);
    if (m) {
        const txn = paddle.transactions[m[1]];
        return txn ? data(200, txn) : jsonResponse(404, {});
    }
    m = path.match(/^\/customers\/(\w+)\/portal-sessions$/);
    if (m && method === 'POST') {
        return data(201, {
            urls: {
                general: {
                    overview: `https://customer-portal.paddle.com/cpl_1?customer=${m[1]}`,
                },
            },
        });
    }
    m = path.match(/^\/subscriptions\/(\w+)(\/cancel)?$/);
    if (m) {
        const sub = paddle.subscriptions[m[1]];
        if (!sub) return jsonResponse(404, {});
        if (method === 'PATCH') {
            sub.items = [
                { price: { id: body.items[0].price_id }, quantity: 1 },
            ];
        }
        if (m[2]) sub.status = 'canceled';
        return data(200, sub);
    }
    return jsonResponse(500, { error: `unmocked ${method} ${path}` });
}

const app = require('../../app');
const { getConfig } = require('../../config/config');
const { BillingAccount, BillingEvent, User } = require('../../models');
const entitlements = require('../../services/entitlementsService');
const { createTestUser } = require('../helpers/testUtils');

const config = getConfig();
const PRO_MONTH = 'pri_pro_month';
const PRO_YEAR = 'pri_pro_year';
const TEAM3_YEAR = 'pri_team3_year';
const TEAM5_MONTH = 'pri_team5_month';
const TEAM5_YEAR = 'pri_team5_year';
const WEBHOOK_SECRET = 'pdl_ntfset_test_secret';
const LS_SECRET = 'ls_whsec_test';

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const subscription = (id, user, overrides = {}) => ({
    id,
    status: 'active',
    customer_id: 'ctm_1',
    items: [{ price: { id: PRO_YEAR }, quantity: 1 }],
    billing_cycle: { interval: 'year', frequency: 1 },
    current_billing_period: {
        starts_at: '2026-10-27T10:00:00Z',
        ends_at: '2027-10-27T10:00:00Z',
    },
    next_billed_at: '2027-10-27T10:00:00Z',
    scheduled_change: null,
    canceled_at: null,
    custom_data: { user_uid: user.uid, user_id: String(user.id) },
    created_at: '2026-10-27T10:00:00Z',
    updated_at: '2026-10-27T10:00:00Z',
    ...overrides,
});

const sign = (body, ts) =>
    `ts=${ts};h1=${crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(`${ts}:${body}`)
        .digest('hex')}`;

let deliveries = 0;
const postEvent = (type, entity, { signature, ts } = {}) => {
    const body = JSON.stringify({
        event_id: `evt_${++deliveries}`,
        event_type: type,
        occurred_at: new Date().toISOString(),
        notification_id: `ntf_${deliveries}`,
        data: entity,
    });
    const stamp = ts ?? Math.floor(Date.now() / 1000);
    return request(app)
        .post('/api/billing/webhook')
        .set('paddle-signature', signature || sign(body, stamp))
        .set('content-type', 'application/json')
        .send(body);
};

const account = (user) =>
    BillingAccount.findOne({ where: { user_id: user.id } });

describe('Billing with Paddle', () => {
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
        config.hosted.billing.provider = 'paddle';
        config.hosted.paddle.apiKey = 'pdl_live_apikey_test';
        config.hosted.paddle.clientToken = 'live_test_token';
        config.hosted.paddle.webhookSecret = WEBHOOK_SECRET;
        config.hosted.paddle.prices = {
            pro: { month: PRO_MONTH, year: PRO_YEAR },
            team_3: { year: TEAM3_YEAR },
            team_5: { month: TEAM5_MONTH, year: TEAM5_YEAR },
        };
        entitlements.invalidate();
        paddle.subscriptions = {};
        paddle.customers = [];
        paddle.transactions = {};
        paddle.checkoutUrl = null;
        ls.subscriptions = {};
        calls = [];
        user = await createTestUser({
            email: `paddle_${Date.now()}@example.com`,
        });
        agent = await login(user);
    });

    afterEach(() => {
        config.hosted.enabled = false;
        config.hosted.trialDays = 7;
        config.hosted.billing.provider = 'stripe';
        config.hosted.paddle.apiKey = undefined;
        config.hosted.paddle.clientToken = undefined;
        config.hosted.paddle.webhookSecret = undefined;
        config.hosted.paddle.prices = {};
        config.hosted.lemonsqueezy.apiKey = undefined;
        config.hosted.lemonsqueezy.storeId = undefined;
        config.hosted.lemonsqueezy.webhookSecret = undefined;
        entitlements.invalidate();
    });

    const subscribed = (overrides = {}) =>
        BillingAccount.create({
            user_id: user.id,
            provider: 'paddle',
            provider_customer_id: 'ctm_1',
            provider_subscription_id: 'sub_1',
            status: 'active',
            plan: 'pro',
            billing_interval: 'year',
            ...overrides,
        });

    it('reports Paddle and the plans it sells', async () => {
        const res = await agent.get('/api/billing');
        expect(res.status).toBe(200);
        expect(res.body.provider).toEqual({
            name: 'paddle',
            display_name: 'Paddle',
        });
        expect(res.body.checkout_available).toBe(true);
        expect(res.body.portal_available).toBe(false);
        expect(res.body.plan_change_available).toBe(false);
        expect(res.body.plans_available.map((p) => p.key)).toEqual([
            'pro',
            'team_3',
            'team_5',
        ]);
    });

    it('opens a transaction for the Team price and hands the overlay its details', async () => {
        const res = await agent
            .post('/api/billing/checkout')
            .send({ interval: 'month', plan: 'team_5' });
        expect(res.status).toBe(200);
        expect(res.body.url).toBeNull();
        expect(res.body.paddle).toEqual({
            transaction_id: 'txn_1',
            client_token: 'live_test_token',
            environment: 'production',
            success_url: expect.stringContaining(
                'checkout=success&session_id=txn_1'
            ),
        });
        const created = calls.find((c) => c.path === '/customers');
        expect(created.body.email).toBe(user.email);
        const txn = calls.find((c) => c.path === '/transactions');
        expect(txn.body.items).toEqual([
            { price_id: TEAM5_MONTH, quantity: 1 },
        ]);
        expect(txn.body.customer_id).toBe('ctm_new');
        expect(txn.body.custom_data).toEqual({
            user_uid: user.uid,
            user_id: String(user.id),
        });
        expect((await account(user)).provider_customer_id).toBe('ctm_new');
    });

    it('sends the browser to the default payment link when Paddle has one', async () => {
        paddle.checkoutUrl = 'https://tududi.com/billing/pay';
        const res = await agent
            .post('/api/billing/checkout')
            .send({ interval: 'year', plan: 'team_5' });
        expect(res.status).toBe(200);
        expect(res.body.url).toBe('https://tududi.com/billing/pay?_ptxn=txn_1');
        expect(res.body.paddle).toBeUndefined();
    });

    it('reuses the Paddle customer with the same email', async () => {
        paddle.customers.push({ id: 'ctm_old', email: user.email });
        await agent.post('/api/billing/checkout').send({ interval: 'year' });
        expect(calls.some((c) => c.path === '/customers')).toBe(false);
        const txn = calls.find((c) => c.path === '/transactions');
        expect(txn.body.customer_id).toBe('ctm_old');
    });

    it('syncs the subscription of the transaction after the redirect', async () => {
        paddle.transactions.txn_1 = { id: 'txn_1', subscription_id: 'sub_1' };
        paddle.subscriptions.sub_1 = subscription('sub_1', user);
        const res = await agent
            .post('/api/billing/sync')
            .send({ session_id: 'txn_1' });
        expect(res.status).toBe(200);
        expect(res.body.plan).toBe('pro');
        const a = await account(user);
        expect(a.provider).toBe('paddle');
        expect(a.provider_subscription_id).toBe('sub_1');
        expect(a.billing_interval).toBe('year');
        expect(new Date(a.current_period_end).toISOString()).toBe(
            '2027-10-27T10:00:00.000Z'
        );
    });

    it('opens the customer portal for the subscription', async () => {
        await subscribed();
        const res = await agent.post('/api/billing/portal');
        expect(res.status).toBe(200);
        expect(res.body.url).toContain('customer=ctm_1');
        const call = calls.find((c) => c.path.endsWith('/portal-sessions'));
        expect(call.body).toEqual({ subscription_ids: ['sub_1'] });
    });

    describe('changing plan', () => {
        it('moves a Pro subscription to Team 5 at the same interval', async () => {
            await subscribed();
            paddle.subscriptions.sub_1 = subscription('sub_1', user);

            const res = await agent
                .post('/api/billing/plan')
                .send({ plan: 'team_5' });

            expect(res.status).toBe(200);
            expect(res.body.plan).toBe('team_5');
            expect(res.body.limits.max_members).toBe(4);
            const patch = calls.find((c) => c.method === 'PATCH');
            expect(patch.path).toBe('/subscriptions/sub_1');
            expect(patch.body).toEqual({
                items: [{ price_id: TEAM5_YEAR, quantity: 1 }],
                proration_billing_mode: 'prorated_immediately',
            });
        });

        it('refuses a plan smaller than the seats in use', async () => {
            await subscribed({ plan: 'team_5' });
            for (const name of ['Emma', 'Leo', 'Mia']) {
                await agent.post('/api/members').send({ name });
            }
            const res = await agent
                .post('/api/billing/plan')
                .send({ plan: 'team_3' });
            expect(res.status).toBe(400);
            expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
        });

        it('refuses a plan with no price at the current interval', async () => {
            await subscribed({ billing_interval: 'month' });
            const res = await agent
                .post('/api/billing/plan')
                .send({ plan: 'team_3' });
            expect(res.status).toBe(400);
        });
    });

    describe('webhooks', () => {
        it('rejects a wrong or stale signature and records nothing', async () => {
            const entity = subscription('sub_1', user);
            const wrong = await postEvent('subscription.created', entity, {
                signature: 'ts=1;h1=deadbeef',
            });
            expect(wrong.status).toBe(400);
            const stale = await postEvent('subscription.created', entity, {
                ts: Math.floor(Date.now() / 1000) - 3600,
            });
            expect(stale.status).toBe(400);
            expect(await BillingEvent.count()).toBe(0);
        });

        it('activates the plan on subscription.created', async () => {
            const res = await postEvent(
                'subscription.created',
                subscription('sub_1', user)
            );
            expect(res.status).toBe(200);
            expect(res.body.handled).toBe(true);
            const status = await agent.get('/api/billing');
            expect(status.body.plan).toBe('pro');
            expect(status.body.portal_available).toBe(true);
            expect(status.body.plan_change_available).toBe(true);
        });

        it('keeps access while a cancellation is scheduled, drops to Free once canceled', async () => {
            await postEvent(
                'subscription.created',
                subscription('sub_1', user)
            );
            await postEvent(
                'subscription.updated',
                subscription('sub_1', user, {
                    scheduled_change: {
                        action: 'cancel',
                        effective_at: '2027-10-27T10:00:00Z',
                    },
                    updated_at: '2026-11-01T00:00:00Z',
                })
            );
            let a = await account(user);
            expect(a.status).toBe('active');
            expect(a.cancel_at_period_end).toBe(true);
            expect(a.plan).toBe('pro');

            await postEvent(
                'subscription.canceled',
                subscription('sub_1', user, {
                    status: 'canceled',
                    canceled_at: '2027-10-27T10:00:00Z',
                    updated_at: '2027-10-27T10:00:01Z',
                })
            );
            a = await account(user);
            expect(a.status).toBe('canceled');
            expect(a.plan).toBe('free');
        });

        it('marks past_due on a failed payment and active again once paid', async () => {
            await postEvent(
                'subscription.created',
                subscription('sub_1', user)
            );
            await postEvent(
                'subscription.past_due',
                subscription('sub_1', user, {
                    status: 'past_due',
                    updated_at: '2026-11-27T10:00:00Z',
                })
            );
            let a = await account(user);
            expect(a.status).toBe('past_due');
            expect(a.last_payment_failed_at).not.toBeNull();

            paddle.subscriptions.sub_1 = subscription('sub_1', user, {
                updated_at: '2026-11-28T10:00:00Z',
            });
            const paid = await postEvent('transaction.completed', {
                id: 'txn_2',
                customer_id: 'ctm_1',
                subscription_id: 'sub_1',
                custom_data: { user_uid: user.uid },
            });
            expect(paid.body.handled).toBe(true);
            a = await account(user);
            expect(a.status).toBe('active');
            expect(a.last_payment_failed_at).toBeNull();
        });
    });

    describe('next to Lemon Squeezy subscriptions', () => {
        const lsSubscription = (overrides = {}) => ({
            type: 'subscriptions',
            id: '42',
            attributes: {
                customer_id: 77,
                variant_id: 1002,
                status: 'active',
                cancelled: false,
                renews_at: '2027-09-06T10:00:00.000000Z',
                ends_at: null,
                updated_at: '2026-10-28T10:00:00.000000Z',
                urls: {
                    customer_portal:
                        'https://tududi.lemonsqueezy.com/billing?expires=1',
                },
                ...overrides,
            },
        });

        beforeEach(async () => {
            config.hosted.lemonsqueezy.apiKey = 'ls_test_key';
            config.hosted.lemonsqueezy.storeId = '1';
            config.hosted.lemonsqueezy.webhookSecret = LS_SECRET;
            await BillingAccount.create({
                user_id: user.id,
                provider: 'lemonsqueezy',
                provider_customer_id: '77',
                provider_subscription_id: '42',
                status: 'active',
                plan: 'pro',
            });
            ls.subscriptions['42'] = lsSubscription();
        });

        it('keeps managing the subscription at Lemon Squeezy', async () => {
            const status = await agent.get('/api/billing');
            expect(status.body.provider.name).toBe('lemonsqueezy');
            expect(status.body.portal_available).toBe(true);
            expect(status.body.plan_change_available).toBe(false);

            const portal = await agent.post('/api/billing/portal');
            expect(portal.body.url).toContain('lemonsqueezy.com/billing');
            const change = await agent
                .post('/api/billing/plan')
                .send({ plan: 'team_5' });
            expect(change.status).toBe(400);
            expect(calls.some((c) => c.api === 'paddle')).toBe(false);
        });

        it('still applies Lemon Squeezy webhooks', async () => {
            const body = JSON.stringify({
                meta: { event_name: 'subscription_cancelled', custom_data: {} },
                data: lsSubscription({
                    status: 'cancelled',
                    cancelled: true,
                    ends_at: '2027-09-06T10:00:00.000000Z',
                }),
            });
            const res = await request(app)
                .post('/api/billing/webhook')
                .set(
                    'x-signature',
                    crypto
                        .createHmac('sha256', LS_SECRET)
                        .update(body)
                        .digest('hex')
                )
                .set('content-type', 'application/json')
                .send(body);
            expect(res.status).toBe(200);
            expect(res.body.handled).toBe(true);
            const a = await account(user);
            expect(a.provider).toBe('lemonsqueezy');
            expect(a.cancel_at_period_end).toBe(true);
        });

        it('cancels at Lemon Squeezy when the account is deleted', async () => {
            const res = await agent
                .delete('/api/profile')
                .send({ password: 'password123' });
            expect(res.status).toBe(204);
            expect(
                calls.some(
                    (c) =>
                        c.api === 'ls' &&
                        c.method === 'DELETE' &&
                        c.path === '/subscriptions/42'
                )
            ).toBe(true);
            expect(await User.findByPk(user.id)).toBeNull();
        });

        it('sells the next subscription through Paddle once it has ended', async () => {
            await BillingAccount.update(
                { status: 'canceled', plan: 'free' },
                { where: { user_id: user.id } }
            );
            const res = await agent
                .post('/api/billing/checkout')
                .send({ interval: 'year', plan: 'team_5' });
            expect(res.status).toBe(200);
            expect(res.body.paddle.transaction_id).toBe('txn_1');
            const txn = calls.find((c) => c.path === '/transactions');
            expect(txn.body.items[0].price_id).toBe(TEAM5_YEAR);
        });
    });

    it('cancels at once at Paddle when the account is deleted', async () => {
        await subscribed();
        paddle.subscriptions.sub_1 = subscription('sub_1', user);
        const res = await agent
            .delete('/api/profile')
            .send({ password: 'password123' });
        expect(res.status).toBe(204);
        const cancel = calls.find(
            (c) => c.path === '/subscriptions/sub_1/cancel'
        );
        expect(cancel.body).toEqual({ effective_from: 'immediately' });
    });
});

describe('Paddle default payment link', () => {
    afterEach(() => {
        config.hosted.enabled = false;
        config.hosted.paddle.clientToken = undefined;
    });

    it('serves a page that opens the checkout for _ptxn without a login', async () => {
        config.hosted.enabled = true;
        config.hosted.paddle.clientToken = 'live_test_token';
        const res = await request(app).get('/billing/pay?_ptxn=txn_1');
        expect(res.status).toBe(200);
        expect(res.text).toContain('cdn.paddle.com/paddle/v2/paddle.js');
        expect(res.text).toContain('token: "live_test_token"');
        expect(res.text).toContain('checkout.completed');
        expect(res.text).not.toContain("Environment.set('sandbox')");
    });

    it('serves the Supporter license checkout without a login', async () => {
        config.hosted.enabled = true;
        config.hosted.paddle.clientToken = 'live_test_token';
        const res = await request(app).get('/supporter');
        expect(res.status).toBe(200);
        expect(res.text).toContain('cdn.paddle.com/paddle/v2/paddle.js');
        expect(res.text).toContain(
            `var priceId = "${config.hosted.paddle.supporterPriceId}"`
        );
        expect(res.text).toContain('Paddle.Checkout.open');
    });

    it('has no Supporter page outside hosted mode', async () => {
        config.hosted.paddle.clientToken = 'live_test_token';
        const res = await request(app).get('/supporter');
        expect(res.status).toBe(404);
    });

    it('is served on the marketing host, not sent on to the app', async () => {
        config.hosted.enabled = true;
        config.hosted.paddle.clientToken = 'live_test_token';
        const hosts = config.landing.hosts;
        config.landing.hosts = ['tududi.com'];
        try {
            const res = await request(app)
                .get('/billing/pay?_ptxn=txn_1')
                .set('Host', 'tududi.com');
            expect(res.status).toBe(200);
            expect(res.text).toContain('paddle.js');
        } finally {
            config.landing.hosts = hosts;
        }
    });

    it('is not there without Paddle', async () => {
        config.hosted.enabled = true;
        const res = await request(app).get('/billing/pay');
        expect(res.status).toBe(404);
    });
});
