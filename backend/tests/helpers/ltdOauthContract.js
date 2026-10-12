'use strict';

// Life-to-Day (T-701, T-702, T-707): the blueprint 17.3 checklist over real
// HTTP against this code, offline. Runs outside Jest (which stubs jose and
// cannot load the ESM oidc-provider): boots the app on 127.0.0.1 with a
// throwaway SQLite file and a throwaway signing key, plays an MCP client,
// and prints "RESULT <json>". Used by tests/ltd/oauth-contract.test.js;
// also runnable by hand: node tests/helpers/ltdOauthContract.js
const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const http = require('http');

const freePort = () =>
    new Promise((resolve) => {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });

async function main() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ltd-oauth-'));
    const port = await freePort();
    const BASE = `http://127.0.0.1:${port}`;
    const RESOURCE = `${BASE}/api/mcp`;
    // Always its own SQLite file, also when the suite runs on PostgreSQL.
    delete process.env.DATABASE_URL;
    delete process.env.DB_DIALECT;
    Object.assign(process.env, {
        NODE_ENV: 'test',
        DB_FILE: path.join(dir, 'contract.sqlite3'),
        LTD_OAUTH_ENABLED: 'true',
        LTD_OAUTH_JWKS_FILE: path.join(dir, 'jwks.json'),
        BASE_URL: BASE,
        DISABLE_SCHEDULER: 'true',
        DISABLE_TELEGRAM: 'true',
    });
    const results = [];
    const check = (item, pass, evidence) =>
        results.push({ n: results.length + 1, item, pass: !!pass, evidence });

    const models = require('../../models');
    const { sequelize, User, Goal, Task, DailyPlan } = models;
    // The app defines the session table, so it loads before the sync.
    const app = require('../../app');
    await sequelize.sync({ force: true });
    const password =
        '$2b$10$DPcA0XSvK9FT04mLyKGza.uHb8d.bESwP.XdQfQ47.sKVT4fYzbP.'; // password123
    const a = await User.create({
        email: 'a@contract.test',
        password_digest: password,
    });
    const b = await User.create({
        email: 'b@contract.test',
        password_digest: password,
    });
    await Goal.create({ user_id: a.id, title: 'A vision', horizon: 'vision' });
    await Goal.create({ user_id: b.id, title: 'B secret', horizon: 'vision' });
    await Task.create({
        user_id: a.id,
        name: 'Write the chapter',
        status: Task.STATUS.IN_PROGRESS,
        estimated_minutes: 45,
    });
    const { createApiToken } = require('../../modules/users/apiTokenService');
    const bearer = (
        await createApiToken({
            userId: a.id,
            name: 'claude-code',
            expiresAt: null,
        })
    ).rawToken;

    const server = app.listen(port, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));

    // A tiny browser: one cookie jar per user, no automatic redirects.
    const browser = () => {
        const jar = new Map();
        return async (url, opts = {}) => {
            const headers = { ...(opts.headers || {}) };
            if (jar.size && !opts.noCookies)
                headers.cookie = [...jar]
                    .map(([k, v]) => `${k}=${v}`)
                    .join('; ');
            const started = performance.now();
            const res = await fetch(url.startsWith('http') ? url : BASE + url, {
                ...opts,
                headers,
                redirect: 'manual',
            });
            res.ms = Math.round(performance.now() - started);
            for (const cookie of res.headers.getSetCookie()) {
                const [pair] = cookie.split(';');
                const at = pair.indexOf('=');
                jar.set(pair.slice(0, at), pair.slice(at + 1));
            }
            return res;
        };
    };
    const asA = browser();
    const asB = browser();
    const client = browser();
    const json = (body, headers = {}) => ({
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            ...headers,
        },
        body: JSON.stringify(body),
    });
    const form = (body) => ({
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
    });
    const claims = (jwt) =>
        JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    const header = (jwt) =>
        JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString());
    // The MCP client's servers call the resource: no browser cookies.
    const rpc = async (token, method, params) => {
        const res = await client(
            '/api/mcp',
            json(
                { jsonrpc: '2.0', id: 1, method, params },
                token ? { authorization: `Bearer ${token}` } : {}
            )
        );
        const text = await res.text();
        const line = text.split('\n').find((l) => l.startsWith('data: '));
        return { res, body: line ? JSON.parse(line.slice(6)) : null, text };
    };
    const call = async (token, name, args = {}) => {
        const { res, body } = await rpc(token, 'tools/call', {
            name,
            arguments: args,
        });
        const result = body?.result;
        let value = null;
        try {
            value = JSON.parse(result?.content?.[0]?.text);
        } catch {
            value = result?.content?.[0]?.text;
        }
        return { status: res.status, isError: !!result?.isError, value };
    };

    // --- Discovery -------------------------------------------------------
    let res = await client(
        '/api/mcp',
        json({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    );
    const challenge = res.headers.get('www-authenticate') || '';
    check(
        '401 with WWW-Authenticate: Bearer resource_metadata',
        res.status === 401 && /^Bearer resource_metadata="/.test(challenge),
        `${res.status} ${challenge}`
    );
    const prmUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1];
    res = await client(
        prmUrl || '/.well-known/oauth-protected-resource/api/mcp'
    );
    const prm = await res.json();
    check(
        'resource equals the MCP URL exactly',
        prm.resource === RESOURCE,
        prm.resource
    );
    check(
        'own AS is the first authorization_servers entry',
        prm.authorization_servers?.[0] === BASE,
        JSON.stringify(prm.authorization_servers)
    );
    res = await client('/.well-known/oauth-authorization-server');
    const discoveryMs = res.ms;
    const meta = await res.json();
    const oidc = await client('/.well-known/openid-configuration');
    check(
        'RFC 8414 and OIDC Discovery metadata',
        res.status === 200 && oidc.status === 200 && meta.issuer === BASE,
        `${res.status}/${oidc.status} issuer=${meta.issuer}`
    );
    check(
        'code_challenge_methods_supported is ["S256"]',
        JSON.stringify(meta.code_challenge_methods_supported) === '["S256"]',
        JSON.stringify(meta.code_challenge_methods_supported)
    );
    check(
        'scopes_supported has ltd.read ltd.write ltd.propose offline_access',
        ['ltd.read', 'ltd.write', 'ltd.propose', 'offline_access'].every((s) =>
            meta.scopes_supported?.includes(s)
        ),
        JSON.stringify(meta.scopes_supported)
    );
    check(
        'RFC 9207 iss parameter advertised',
        meta.authorization_response_iss_parameter_supported === true,
        String(meta.authorization_response_iss_parameter_supported)
    );

    // --- DCR ---------------------------------------------------------------
    const register = (redirect, name) =>
        client(
            '/oauth2/reg',
            json({
                client_name: name,
                redirect_uris: [redirect],
                token_endpoint_auth_method: 'none',
                grant_types: ['authorization_code', 'refresh_token'],
                response_types: ['code'],
            })
        );
    const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
    res = await register(CLAUDE, 'Claude');
    const registerMs = res.ms;
    const claude = await res.json();
    check(
        '/register accepts a JSON body (allow-listed redirect)',
        res.status === 201 && !!claude.client_id,
        `${res.status} in ${res.ms}ms`
    );
    res = await register('https://evil.example/cb', 'Evil');
    check(
        'DCR refuses a redirect outside the allowlist',
        res.status === 400,
        `${res.status} ${(await res.json()).error}`
    );

    // --- Authorization code + PKCE ------------------------------------------
    res = await asA(
        '/api/login',
        json({ email: a.email, password: 'password123' })
    );
    check(
        'consent reuses the app session (login)',
        res.status === 200,
        String(res.status)
    );
    await asB('/api/login', json({ email: b.email, password: 'password123' }));

    const pkce = () => {
        const verifier = crypto.randomBytes(32).toString('base64url');
        return {
            verifier,
            challenge: crypto
                .createHash('sha256')
                .update(verifier)
                .digest('base64url'),
        };
    };
    const authorizeUrl = (clientId, redirect, extra) =>
        `/oauth2/auth?${new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirect,
            response_type: 'code',
            state: 'st4te',
            resource: RESOURCE,
            scope: 'ltd.read ltd.write ltd.propose offline_access',
            ...extra,
        })}`;
    // Follows same-origin redirects; stops at a page or at the client.
    const follow = async (user, url) => {
        let response = await user(url);
        while (response.status >= 300 && response.status < 400) {
            const next = new URL(response.headers.get('location'), BASE);
            if (next.origin !== BASE) return { response, location: next };
            response = await user(next.pathname + next.search);
        }
        return { response, location: null };
    };
    res = await asA(authorizeUrl(claude.client_id, CLAUDE, {}));
    const noPkce = res.headers.get('location') || '';
    check(
        'authorize without PKCE is refused',
        /error=invalid_request/.test(noPkce),
        decodeURIComponent(noPkce).slice(0, 140)
    );
    // Full browser flow; returns the code from the client's redirect.
    const consentFlow = async (clientId, redirect, scope) => {
        const { verifier, challenge: c } = pkce();
        const page = await follow(
            asA,
            authorizeUrl(clientId, redirect, {
                code_challenge: c,
                code_challenge_method: 'S256',
                ...(scope ? { scope } : {}),
            })
        );
        const html = await page.response.text();
        const csrf = /name="csrf" value="([^"]+)"/.exec(html)?.[1];
        const action = /action="([^"]+\/confirm)"/.exec(html)?.[1];
        const forged = action
            ? await asA(action, form({ csrf: 'forged' }))
            : { status: 0 };
        const confirmed = await asA(action, form({ csrf }));
        let location = confirmed.headers.get('location');
        let hop = { location: null, response: confirmed };
        if (location && new URL(location, BASE).origin === BASE)
            hop = await follow(asA, location);
        location = hop.location || (location && new URL(location, BASE));
        return {
            html,
            status: page.response.status,
            csp: page.response.headers.get('content-security-policy') || '',
            forged: forged.status,
            location,
            verifier,
        };
    };
    const flow = await consentFlow(claude.client_id, CLAUDE);
    check(
        'consent page names the redirect host',
        flow.status === 200 &&
            flow.html.includes('<strong dir="ltr">claude.ai</strong>'),
        `${flow.status} csp=${flow.csp}`
    );
    check(
        'consent form refuses a forged CSRF token',
        flow.forged === 403,
        String(flow.forged)
    );
    const code = flow.location?.searchParams.get('code');
    check(
        'code returns to https://claude.ai/api/mcp/auth_callback',
        flow.location?.origin + flow.location?.pathname === CLAUDE &&
            !!code &&
            flow.location.searchParams.get('state') === 'st4te',
        flow.location
            ? `${flow.location.origin}${flow.location.pathname}?code=…&state=${flow.location.searchParams.get('state')}`
            : 'no redirect'
    );
    check(
        'iss in the authorization response (RFC 9207)',
        flow.location?.searchParams.get('iss') === BASE,
        flow.location?.searchParams.get('iss')
    );

    const token = async (body) => {
        const response = await client('/oauth2/token', form(body));
        return { response, body: await response.json() };
    };
    let t = await token({
        grant_type: 'authorization_code',
        code,
        redirect_uri: CLAUDE,
        client_id: claude.client_id,
        code_verifier: flow.verifier,
        resource: RESOURCE,
    });
    const tokenMs = t.response.ms;
    const access = t.body.access_token;
    check(
        '/token accepts x-www-form-urlencoded and issues a JWT',
        t.response.status === 200 &&
            access?.split('.').length === 3 &&
            header(access).typ === 'at+jwt' &&
            t.body.expires_in === 3600,
        `${t.response.status} typ=${access && header(access).typ} expires_in=${t.body.expires_in} in ${t.response.ms}ms`
    );
    check(
        'aud is the resource; scope is what was granted',
        claims(access).aud === RESOURCE &&
            ['ltd.read', 'ltd.write', 'ltd.propose'].every((s) =>
                claims(access).scope.split(' ').includes(s)
            ),
        `aud=${claims(access).aud} scope=${claims(access).scope}`
    );
    check(
        'a refresh token is issued',
        !!t.body.refresh_token,
        String(!!t.body.refresh_token)
    );

    // --- Resource server ----------------------------------------------------
    let out = await call(access, 'list_goals');
    const titles = JSON.stringify(out.value);
    const tasks = await call(access, 'list_tasks');
    check(
        'MCP list_tasks and list_goals with the OAuth token, own data only',
        out.status === 200 &&
            titles.includes('A vision') &&
            !titles.includes('B secret') &&
            tasks.status === 200 &&
            !tasks.isError &&
            JSON.stringify(tasks.value).includes('Write the chapter'),
        `${out.status} goals=${out.value?.count}, tasks ${tasks.status}`
    );
    const listed =
        (await rpc(access, 'tools/list', {})).body?.result?.tools || [];
    const names = listed.map((tool) => tool.name);
    check(
        'OAuth client sees no legacy write or delete tool',
        names.includes('list_tasks') &&
            !names.includes('create_task') &&
            !names.includes('update_task') &&
            !names.some((n) => /^(delete|remove)_/.test(n)),
        `${names.length} tools`
    );
    const tampered =
        access.slice(0, -4) + (access.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    res = await client(
        '/api/mcp',
        json(
            { jsonrpc: '2.0', id: 1, method: 'tools/list' },
            { authorization: `Bearer ${tampered}` }
        )
    );
    check(
        'a tampered token is refused',
        res.status === 401,
        String(res.status)
    );
    res = await client('/api/tasks', {
        headers: { authorization: `Bearer ${access}` },
    });
    check(
        'the token is refused outside /api/mcp',
        res.status === 401,
        String(res.status)
    );

    // Tokens signed with the real key but wrong in one claim.
    const { SignJWT, importJWK } = await import('jose');
    const jwk = JSON.parse(
        fs.readFileSync(process.env.LTD_OAUTH_JWKS_FILE, 'utf8')
    ).keys[0];
    const key = await importJWK(jwk, 'RS256');
    const forge = (overrides) =>
        new SignJWT({
            scope: 'ltd.read ltd.write',
            client_id: claude.client_id,
            ...overrides.claims,
        })
            .setProtectedHeader({ alg: 'RS256', typ: 'at+jwt', kid: jwk.kid })
            .setIssuer(BASE)
            .setSubject(String(a.id))
            .setAudience(overrides.aud || RESOURCE)
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(key);
    res = await client(
        '/api/mcp',
        json(
            { jsonrpc: '2.0', id: 1, method: 'tools/list' },
            {
                authorization: `Bearer ${await forge({ aud: `${BASE}/api/other` })}`,
            }
        )
    );
    check(
        'a token with the wrong aud is refused',
        res.status === 401,
        String(res.status)
    );
    res = await client(
        '/api/mcp',
        json(
            { jsonrpc: '2.0', id: 1, method: 'tools/list' },
            {
                authorization: `Bearer ${await forge({ claims: { scope: 'ltd.write' } })}`,
            }
        )
    );
    check(
        'a token without ltd.read is refused (insufficient_scope)',
        res.status === 403 &&
            /insufficient_scope/.test(
                res.headers.get('www-authenticate') || ''
            ),
        `${res.status} ${res.headers.get('www-authenticate')}`
    );
    const readOnlyToken = await forge({ claims: { scope: 'ltd.read' } });
    out = await call(readOnlyToken, 'capture', { text: 'should not land' });
    const readOnlyNames = (
        (await rpc(readOnlyToken, 'tools/list', {})).body?.result?.tools || []
    ).map((tool) => tool.name);
    const inbox = await models.InboxItem.count({ where: { user_id: a.id } });
    check(
        'a write tool without its scope is neither listed nor run',
        out.isError && !readOnlyNames.includes('capture') && inbox === 0,
        `${String(out.value).slice(0, 60)}; inbox items ${inbox}`
    );

    // --- Refresh rotation ---------------------------------------------------
    const firstRefresh = t.body.refresh_token;
    t = await token({
        grant_type: 'refresh_token',
        refresh_token: firstRefresh,
        client_id: claude.client_id,
        resource: RESOURCE,
    });
    const refreshMs = t.response.ms;
    const rotated = t.body.refresh_token;
    check(
        'refresh rotates the refresh token',
        t.response.status === 200 &&
            !!rotated &&
            rotated !== firstRefresh &&
            !!t.body.access_token,
        `${t.response.status} in ${t.response.ms}ms`
    );
    const refreshed = t.body.access_token;
    t = await token({
        grant_type: 'refresh_token',
        refresh_token: rotated,
        client_id: claude.client_id,
        resource: 'https://other.example/mcp',
    });
    check(
        'a foreign resource is refused',
        t.response.status === 400 && t.body.error === 'invalid_target',
        `${t.response.status} ${t.body.error}`
    );
    check(
        'discovery, register and token under 10 s; refresh under 30 s',
        discoveryMs < 10000 &&
            registerMs < 10000 &&
            tokenMs < 10000 &&
            refreshMs < 30000,
        `discovery ${discoveryMs}ms, register ${registerMs}ms, token ${tokenMs}ms, refresh ${refreshMs}ms`
    );

    // --- Proposals through OAuth (Phase 7 DoD, locally) -----------------------
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    out = await call(refreshed, 'plan_tomorrow', { date: tomorrow });
    const proposalUid = out.value?.proposal_uid;
    const plansBefore = await DailyPlan.count({
        where: { user_id: a.id, plan_date: tomorrow },
    });
    check(
        'plan_tomorrow makes a pending Proposal and writes no block',
        out.status === 200 &&
            !!proposalUid &&
            out.value.status === 'pending' &&
            plansBefore === 0,
        `${out.value?.ops?.length} blocks, daily plans for ${tomorrow}: ${plansBefore}`
    );
    res = await asB(`/api/proposals/${proposalUid}/apply`, json({}));
    check(
        'User B cannot apply User A’s Proposal',
        res.status === 404,
        String(res.status)
    );
    res = await client(
        `/api/proposals/${proposalUid}/apply`,
        json({}, { authorization: `Bearer ${bearer}` })
    );
    check(
        'a token cannot apply a Proposal; only the signed-in human',
        res.status === 403,
        String(res.status)
    );
    res = await asA(`/api/proposals/${proposalUid}/apply`, json({}));
    const applied = await DailyPlan.count({
        where: { user_id: a.id, plan_date: tomorrow },
    });
    res = await asA(`/api/proposals/${proposalUid}/undo`, json({}));
    const undone = await DailyPlan.count({
        where: { user_id: a.id, plan_date: tomorrow },
    });
    check(
        'apply in the app, then Undo restores the day exactly',
        applied === 1 &&
            undone === 0 &&
            (await res.json()).status === 'reverted',
        `after apply ${applied}, after undo ${undone}`
    );

    // --- Local loopback client (Claude Code style) ---------------------------
    let loopbackCode = null;
    const loopback = http.createServer((req, reply) => {
        loopbackCode = new URL(req.url, 'http://127.0.0.1').searchParams.get(
            'code'
        );
        reply.end('ok');
    });
    await new Promise((resolve) => loopback.listen(0, '127.0.0.1', resolve));
    const LOOPBACK = `http://127.0.0.1:${loopback.address().port}/callback`;
    const local = await (
        await register(LOOPBACK, 'Claude Code (loopback)')
    ).json();
    const localFlow = await consentFlow(
        local.client_id,
        LOOPBACK,
        'ltd.read ltd.admin'
    );
    if (localFlow.location) await fetch(localFlow.location);
    loopback.close();
    t = await token({
        grant_type: 'authorization_code',
        code: loopbackCode,
        redirect_uri: LOOPBACK,
        client_id: local.client_id,
        code_verifier: localFlow.verifier,
        resource: RESOURCE,
    });
    const localToken = t.body.access_token;
    out = await call(localToken, 'get_life_vision');
    const localNames = (
        (await rpc(localToken, 'tools/list', {})).body?.result?.tools || []
    ).map((tool) => tool.name);
    check(
        'an unknown scope is never granted',
        !!localToken && claims(localToken).scope === 'ltd.read',
        `asked ltd.read ltd.admin, got ${localToken && claims(localToken).scope}`
    );
    check(
        'loopback client calls a read tool with its issued token',
        !!loopbackCode &&
            out.status === 200 &&
            !out.isError &&
            JSON.stringify(out.value).includes('A vision') &&
            !localNames.includes('capture'),
        `${out.status} scope=${localToken && claims(localToken).scope}, ${localNames.length} tools`
    );

    // --- Bearer API token and Settings controls -------------------------------
    out = await call(bearer, 'list_tasks');
    const bearerNames = (
        (await rpc(bearer, 'tools/list', {})).body?.result?.tools || []
    ).map((tool) => tool.name);
    check(
        'the existing tt_ Bearer token still answers list_tasks',
        out.status === 200 &&
            !out.isError &&
            bearerNames.includes('update_task'),
        `${out.status} ${bearerNames.length} tools`
    );
    res = await asA(
        `/api/mcp/clients/${encodeURIComponent(`oauth:${local.client_id}`)}/revoke`,
        json({})
    );
    out = await rpc(localToken, 'tools/list', {});
    check(
        'revoking one client ends its token at once',
        res.status === 200 && out.res.status === 401,
        `${res.status} then ${out.res.status}`
    );
    out = await call(refreshed, 'list_goals');
    check(
        'other clients keep working after one is revoked',
        out.status === 200 && !out.isError,
        String(out.status)
    );
    t = await token({
        grant_type: 'refresh_token',
        refresh_token: firstRefresh,
        client_id: claude.client_id,
        resource: RESOURCE,
    });
    check(
        'a used refresh token gets invalid_grant',
        t.response.status === 400 && t.body.error === 'invalid_grant',
        `${t.response.status} ${t.body.error}`
    );
    out = await rpc(refreshed, 'tools/list', {});
    check(
        'refresh token reuse revokes the whole grant',
        out.res.status === 401,
        String(out.res.status)
    );
    const again = await consentFlow(claude.client_id, CLAUDE);
    t = await token({
        grant_type: 'authorization_code',
        code: again.location?.searchParams.get('code'),
        redirect_uri: CLAUDE,
        client_id: claude.client_id,
        code_verifier: again.verifier,
        resource: RESOURCE,
    });
    const live = t.body.access_token;
    res = await asA('/api/mcp/kill-switch', json({}));
    const afterKill = await rpc(bearer, 'tools/list', {});
    const afterKillOauth = await rpc(live, 'tools/list', {});
    const rest = await client('/api/tasks', {
        headers: { authorization: `Bearer ${bearer}` },
    });
    check(
        'kill switch ends every MCP token; REST keeps the API token',
        res.status === 200 &&
            afterKill.res.status === 401 &&
            afterKillOauth.res.status === 401 &&
            rest.status === 200,
        `mcp tt_ ${afterKill.res.status}, mcp oauth ${afterKillOauth.res.status}, REST ${rest.status}`
    );

    server.close();
    await sequelize.close();
    fs.rmSync(dir, { recursive: true, force: true });
    return results;
}

main()
    .then((results) => {
        process.stdout.write(`RESULT ${JSON.stringify(results)}\n`);
        process.exit(0);
    })
    .catch((error) => {
        process.stdout.write(`ERROR ${error.stack}\n`);
        process.exit(1);
    });
