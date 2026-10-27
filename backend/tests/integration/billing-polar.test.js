const crypto = require('crypto');
const request = require('supertest');

// Polar and Lemon Squeezy are reached over plain fetch, so both APIs are
// stood in for by one routed mock of global.fetch. Tests shape
// `polar.subscriptions` / `ls.subscriptions` and read `calls`.
const polar = { subscriptions: {} };
const ls = { subscriptions: {} };
let calls = [];

const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
});

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
        if (sub && method === 'GET') return jsonResponse(200, { data: sub });
        if (sub && method === 'DELETE') return jsonResponse(200, { data: sub });
        return jsonResponse(500, { error: `unmocked ${method} ${path}` });
    }

    const path = href.replace('https://api.polar.sh', '');
    calls.push({ api: 'polar', method, path, body });
    if (method === 'POST' && path === '/v1/checkouts/') {
        return jsonResponse(201, {
            id: 'chk_1',
            url: 'https://buy.polar.sh/polar_c_1',
            customer_id: null,
        });
    }
    if (method === 'POST' && path === '/v1/customer-sessions/') {
        return jsonResponse(201, {
            customer_portal_url: `https://polar.sh/tududi/portal?customer_session_token=x&customer=${body.customer_id}`,
        });
    }
    if (method === 'GET' && path.startsWith('/v1/subscriptions/?')) {
        const params = new URLSearchParams(path.split('?')[1]);
        const items = Object.values(polar.subscriptions).filter(
            (s) => s.customer.external_id === params.get('external_customer_id')
        );
        return jsonResponse(200, { items });
    }
    const m = path.match(/^\/v1\/subscriptions\/([\w-]+)$/);
    if (m) {
        const sub = polar.subscriptions[m[1]];
        if (!sub) return jsonResponse(404, {});
        if (method === 'DELETE') sub.status = 'canceled';
        return jsonResponse(200, sub);
    }
    return jsonResponse(500, { error: `unmocked ${method} ${path}` });
}

const app = require('../../app');
const { getConfig } = require('../../config/config');
const { BillingAccount, BillingEvent, User } = require('../../models');
const entitlements = require('../../services/entitlementsService');
const { createTestUser } = require('../helpers/testUtils');

const config = getConfig();
const PRO_MONTH = 'prod-pro-month';
const PRO_YEAR = 'prod-pro-year';
const TEAM5_MONTH = 'prod-team5-month';
const TEAM5_YEAR = 'prod-team5-year';
const WEBHOOK_SECRET = `whsec_${Buffer.from('polar-test-secret').toString('base64')}`;
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
    amount: 5000,
    currency: 'eur',
    recurring_interval: 'year',
    current_period_start: '2026-10-27T10:00:00Z',
    current_period_end: '2027-10-27T10:00:00Z',
    trial_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    started_at: '2026-10-27T10:00:00Z',
    ends_at: null,
    ended_at: null,
    customer_id: 'cus-1',
    product_id: PRO_YEAR,
    checkout_id: 'chk_1',
    metadata: { user_uid: user.uid, user_id: String(user.id) },
    customer: { id: 'cus-1', external_id: user.uid, email: user.email },
    created_at: '2026-10-27T10:00:00Z',
    modified_at: '2026-10-27T10:00:00Z',
    ...overrides,
});

const signPolar = (id, timestamp, body) =>
    crypto
        .createHmac(
            'sha256',
            Buffer.from(WEBHOOK_SECRET.slice('whsec_'.length), 'base64')
        )
        .update(`${id}.${timestamp}.${body}`)
        .digest('base64');

let deliveries = 0;
const postEvent = (type, data, { signature, timestamp } = {}) => {
    const body = JSON.stringify({
        type,
        timestamp: new Date().toISOString(),
        data,
    });
    const id = `msg_${++deliveries}`;
    const ts = String(timestamp ?? Math.floor(Date.now() / 1000));
    return request(app)
        .post('/api/billing/webhook')
        .set('webhook-id', id)
        .set('webhook-timestamp', ts)
        .set('webhook-signature', signature || `v1,${signPolar(id, ts, body)}`)
        .set('content-type', 'application/json')
        .send(body);
};

const account = (user) =>
    BillingAccount.findOne({ where: { user_id: user.id } });

describe('Billing with Polar', () => {
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
        config.hosted.billing.provider = 'polar';
        config.hosted.polar.accessToken = 'polar_oat_test';
        config.hosted.polar.webhookSecret = WEBHOOK_SECRET;
        config.hosted.polar.products = {
            pro: { month: PRO_MONTH, year: PRO_YEAR },
            team_5: { month: TEAM5_MONTH, year: TEAM5_YEAR },
        };
        entitlements.invalidate();
        polar.subscriptions = {};
        ls.subscriptions = {};
        calls = [];
        user = await createTestUser({
            email: `polar_${Date.now()}@example.com`,
        });
        agent = await login(user);
    });

    afterEach(() => {
        config.hosted.enabled = false;
        config.hosted.trialDays = 7;
        config.hosted.billing.provider = 'stripe';
        config.hosted.polar.accessToken = undefined;
        config.hosted.polar.webhookSecret = undefined;
        config.hosted.polar.products = {};
        config.hosted.lemonsqueezy.apiKey = undefined;
        config.hosted.lemonsqueezy.storeId = undefined;
        config.hosted.lemonsqueezy.webhookSecret = undefined;
        entitlements.invalidate();
    });

    it('reports Polar and the plans it sells', async () => {
        const res = await agent.get('/api/billing');
        expect(res.status).toBe(200);
        expect(res.body.billing_configured).toBe(true);
        expect(res.body.provider).toEqual({
            name: 'polar',
            display_name: 'Polar',
        });
        expect(res.body.checkout_available).toBe(true);
        expect(res.body.portal_available).toBe(false);
        expect(res.body.plans_available.map((p) => p.key)).toEqual([
            'pro',
            'team_5',
        ]);
    });

    it('creates a checkout for the Team product with the user as external customer', async () => {
        const res = await agent
            .post('/api/billing/checkout')
            .send({ interval: 'month', plan: 'team_5' });
        expect(res.status).toBe(200);
        expect(res.body.url).toBe('https://buy.polar.sh/polar_c_1');
        const call = calls.find((c) => c.path === '/v1/checkouts/');
        expect(call.body.products).toEqual([TEAM5_MONTH]);
        expect(call.body.external_customer_id).toBe(user.uid);
        expect(call.body.customer_email).toBe(user.email);
        expect(call.body.metadata).toEqual({
            user_uid: user.uid,
            user_id: String(user.id),
        });
        expect(call.body.success_url).toContain(
            'checkout=success&session_id={CHECKOUT_ID}'
        );
    });

    it('syncs the subscription of the checkout after the redirect', async () => {
        polar.subscriptions['sub-1'] = subscription('sub-1', user);
        const res = await agent
            .post('/api/billing/sync')
            .send({ session_id: 'chk_1' });
        expect(res.status).toBe(200);
        expect(res.body.plan).toBe('pro');
        const a = await account(user);
        expect(a.provider).toBe('polar');
        expect(a.provider_subscription_id).toBe('sub-1');
        expect(a.provider_customer_id).toBe('cus-1');
        expect(a.billing_interval).toBe('year');
        expect(new Date(a.current_period_end).toISOString()).toBe(
            '2027-10-27T10:00:00.000Z'
        );
    });

    it('opens the Polar customer portal for a Polar customer', async () => {
        await BillingAccount.create({
            user_id: user.id,
            provider: 'polar',
            provider_customer_id: 'cus-1',
            provider_subscription_id: 'sub-1',
            status: 'active',
            plan: 'pro',
        });
        const res = await agent.post('/api/billing/portal');
        expect(res.status).toBe(200);
        expect(res.body.url).toContain('customer=cus-1');
        const call = calls.find((c) => c.path === '/v1/customer-sessions/');
        expect(call.body.return_url).toContain('section=billing');
    });

    describe('webhooks', () => {
        it('rejects a wrong or stale signature and records nothing', async () => {
            const data = subscription('sub-1', user);
            const wrong = await postEvent('subscription.created', data, {
                signature: 'v1,AAAA',
            });
            expect(wrong.status).toBe(400);
            const stale = await postEvent('subscription.created', data, {
                timestamp: Math.floor(Date.now() / 1000) - 3600,
            });
            expect(stale.status).toBe(400);
            expect(await BillingEvent.count()).toBe(0);
        });

        it('activates the plan on subscription.created', async () => {
            const res = await postEvent(
                'subscription.created',
                subscription('sub-1', user)
            );
            expect(res.status).toBe(200);
            expect(res.body.handled).toBe(true);
            const a = await account(user);
            expect(a.provider).toBe('polar');
            expect(a.plan).toBe('pro');
            expect(a.status).toBe('active');
            const status = await agent.get('/api/billing');
            expect(status.body.portal_available).toBe(true);
        });

        it('moves to Team 5 when the customer switches product in the portal', async () => {
            await postEvent(
                'subscription.created',
                subscription('sub-1', user)
            );
            const res = await postEvent(
                'subscription.updated',
                subscription('sub-1', user, {
                    product_id: TEAM5_YEAR,
                    modified_at: '2026-10-28T10:00:00Z',
                })
            );
            expect(res.body.handled).toBe(true);
            const status = await agent.get('/api/billing');
            expect(status.body.plan).toBe('team_5');
            expect(status.body.limits.max_members).toBe(4);
            expect(status.body.seats.seats).toBe(5);
        });

        it('keeps access while canceled at period end, drops to Free when revoked', async () => {
            await postEvent(
                'subscription.created',
                subscription('sub-1', user)
            );
            await postEvent(
                'subscription.canceled',
                subscription('sub-1', user, {
                    cancel_at_period_end: true,
                    canceled_at: '2026-11-01T00:00:00Z',
                    ends_at: '2027-10-27T10:00:00Z',
                    modified_at: '2026-11-01T00:00:00Z',
                })
            );
            let a = await account(user);
            expect(a.status).toBe('active');
            expect(a.cancel_at_period_end).toBe(true);
            expect(a.plan).toBe('pro');

            await postEvent(
                'subscription.revoked',
                subscription('sub-1', user, {
                    status: 'canceled',
                    cancel_at_period_end: false,
                    ended_at: '2027-10-27T10:00:00Z',
                    modified_at: '2027-10-27T10:00:01Z',
                })
            );
            a = await account(user);
            expect(a.status).toBe('canceled');
            expect(a.plan).toBe('free');
        });

        it('marks past_due on a failed payment and active again once an order is paid', async () => {
            await postEvent(
                'subscription.created',
                subscription('sub-1', user)
            );
            const failed = await postEvent(
                'subscription.past_due',
                subscription('sub-1', user, {
                    status: 'past_due',
                    modified_at: '2026-11-27T10:00:00Z',
                })
            );
            expect(failed.body.handled).toBe(true);
            let a = await account(user);
            expect(a.status).toBe('past_due');
            expect(a.last_payment_failed_at).not.toBeNull();

            polar.subscriptions['sub-1'] = subscription('sub-1', user, {
                modified_at: '2026-11-28T10:00:00Z',
            });
            const paid = await postEvent('order.paid', {
                id: 'ord-2',
                customer_id: 'cus-1',
                subscription_id: 'sub-1',
                customer: { id: 'cus-1', external_id: user.uid },
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

            const portal = await agent.post('/api/billing/portal');
            expect(portal.body.url).toContain('lemonsqueezy.com/billing');
            expect(calls.some((c) => c.api === 'polar')).toBe(false);
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

        it('sells the next subscription through Polar once it has ended', async () => {
            await BillingAccount.update(
                { status: 'canceled', plan: 'free' },
                { where: { user_id: user.id } }
            );
            const res = await agent
                .post('/api/billing/checkout')
                .send({ interval: 'year', plan: 'team_5' });
            expect(res.status).toBe(200);
            const call = calls.find((c) => c.path === '/v1/checkouts/');
            expect(call.body.external_customer_id).toBe(user.uid);
            expect(call.body.customer_id).toBeUndefined();
        });
    });
});
