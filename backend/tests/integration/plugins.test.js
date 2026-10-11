const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const app = require('../../app');
const { Role } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { buildZip, validPluginEntries } = require('../helpers/zipFixture');

/**
 * Plugins are installed on disk, so these tests install a real one into a
 * temporary directory rather than mocking the service: the point of the whole
 * path is that a directory an operator drops in becomes available, and a
 * mocked service would not prove that.
 */
const writePlugin = (root, id, manifest) => {
    const dir = path.join(root, id);
    fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
    );

    for (const reference of [manifest.entry, ...(manifest.styles || [])]) {
        const filePath = path.join(dir, reference);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, '// plugin fixture\n');
    }

    return dir;
};

describe('Plugins', () => {
    let pluginsRoot;
    let previousDir;
    let user;
    let agent;

    beforeAll(() => {
        pluginsRoot = fs.mkdtempSync(
            path.join(os.tmpdir(), 'tududi-installed-plugins-')
        );
        previousDir = process.env.TUDUDI_PLUGINS_DIR;
        process.env.TUDUDI_PLUGINS_DIR = pluginsRoot;

        writePlugin(pluginsRoot, 'calm-mode', {
            id: 'calm-mode',
            name: 'Calm Mode',
            version: '1.0.0',
            description: 'A lower-stimulation way to use Tududi.',
            pluginApi: 1,
            host: '>=1.9 <2',
            entry: 'dist/index.js',
            styles: ['dist/index.css'],
            shortcuts: [
                {
                    name: 'One thing',
                    short_name: 'One thing',
                    description: 'Open the single-page view',
                    path: 'focus',
                },
            ],
        });
    });

    afterAll(() => {
        if (previousDir === undefined) delete process.env.TUDUDI_PLUGINS_DIR;
        else process.env.TUDUDI_PLUGINS_DIR = previousDir;
        fs.rmSync(pluginsRoot, { recursive: true, force: true });
    });

    beforeEach(async () => {
        user = await createTestUser({
            email: `plugins_${Date.now()}@example.com`,
        });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    describe('GET /api/plugins', () => {
        it('lists an installed plugin for the signed-in user', async () => {
            const response = await agent.get('/api/plugins');

            expect(response.status).toBe(200);
            const calm = response.body.plugins.find(
                (plugin) => plugin.id === 'calm-mode'
            );
            expect(calm).toBeDefined();
            expect(calm.ok).toBe(true);
            expect(calm.errors).toEqual([]);
            expect(calm.entry).toBe('dist/index.js');
            expect(calm.styles).toEqual(['dist/index.css']);
            // Installed is not enabled: the user decides.
            expect(calm.enabled).toBe(false);
            expect(response.body.pluginApiVersion).toBe(1);
        });

        it('requires authentication', async () => {
            const response = await request(app).get('/api/plugins');
            expect(response.status).toBe(401);
        });
    });

    describe('PUT /api/plugins/:id', () => {
        it('enables a plugin and reports it as enabled', async () => {
            const response = await agent
                .put('/api/plugins/calm-mode')
                .send({ enabled: true });

            expect(response.status).toBe(200);
            expect(response.body.enabled).toContain('calm-mode');
            const calm = response.body.plugins.find(
                (plugin) => plugin.id === 'calm-mode'
            );
            expect(calm.enabled).toBe(true);
        });

        it('rejects a plugin that is not installed', async () => {
            const response = await agent
                .put('/api/plugins/does-not-exist')
                .send({ enabled: true });

            expect(response.status).toBe(404);
        });
    });

    /**
     * Installing is an operator action, so these tests set the requester's role
     * explicitly rather than relying on the bootstrap rule for an instance with
     * no roles: the point is who may install, not which of the two ways in
     * applies here.
     */
    const makeOperator = async () => {
        await Role.destroy({ where: {} });
        await Role.create({
            user_id: user.id,
            role: 'admin',
            is_admin: true,
        });
    };

    const upload = (target = agent, entries = validPluginEntries()) =>
        target
            .post('/api/plugins/install')
            .attach('plugin', buildZip(entries), 'plugin.zip');

    const removeWrittenPlugins = () => {
        for (const entry of fs.readdirSync(pluginsRoot)) {
            if (entry === 'calm-mode') continue;
            fs.rmSync(path.join(pluginsRoot, entry), {
                recursive: true,
                force: true,
            });
        }
    };

    describe('POST /api/plugins/install', () => {
        beforeEach(makeOperator);
        afterEach(removeWrittenPlugins);

        it('installs an uploaded plugin into the plugins directory', async () => {
            const response = await upload();

            expect(response.status).toBe(201);
            expect(response.body.install).toMatchObject({
                id: 'demo-plugin',
                name: 'Demo Plugin',
                version: '1.0.0',
                updated: false,
            });
            expect(
                fs.existsSync(
                    path.join(pluginsRoot, 'demo-plugin', 'plugin.json')
                )
            ).toBe(true);

            // The listing the UI re-renders from has to agree, and the plugin
            // has to be usable - a directory that only half works is not
            // installed.
            const calm = response.body.plugins.find(
                (plugin) => plugin.id === 'demo-plugin'
            );
            expect(calm.ok).toBe(true);
            expect(calm.errors).toEqual([]);
            expect(response.body.canManage).toBe(true);
        });

        it('reports an update when a newer archive is uploaded', async () => {
            await upload();

            const response = await upload(
                agent,
                validPluginEntries({ version: '2.0.0' })
            );

            expect(response.status).toBe(200);
            expect(response.body.install).toMatchObject({
                id: 'demo-plugin',
                version: '2.0.0',
                updated: true,
            });
            const installed = JSON.parse(
                fs.readFileSync(
                    path.join(pluginsRoot, 'demo-plugin', 'plugin.json'),
                    'utf8'
                )
            );
            expect(installed.version).toBe('2.0.0');
        });

        it('refuses an archive that is not a plugin', async () => {
            const response = await agent
                .post('/api/plugins/install')
                .attach('plugin', Buffer.from('not an archive'), 'plugin.zip');

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/not a readable ZIP archive/);
        });

        it('refuses a file that is not offered as a zip', async () => {
            const response = await agent
                .post('/api/plugins/install')
                .attach('plugin', Buffer.from('binary'), 'plugin.exe');

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/\.zip archive/);
        });

        it('refuses a signed-in user who is not an admin', async () => {
            await Role.update(
                { is_admin: false, role: 'user' },
                { where: { user_id: user.id } }
            );

            const response = await upload();

            expect(response.status).toBe(403);
            expect(fs.existsSync(path.join(pluginsRoot, 'demo-plugin'))).toBe(
                false
            );
        });

        it('reports canManage so the browser does not offer what would be refused', async () => {
            const allowed = await agent.get('/api/plugins');
            expect(allowed.body.canManage).toBe(true);

            await Role.update(
                { is_admin: false, role: 'user' },
                { where: { user_id: user.id } }
            );

            const refused = await agent.get('/api/plugins');
            expect(refused.body.canManage).toBe(false);
        });

        it('refuses a personal API token, even one belonging to an admin', async () => {
            // A token with no abilities can reach the whole API; installing
            // code on the server is not something it may do.
            const created = await agent
                .post('/api/profile/api-keys')
                .send({ name: 'installer' });
            const token = created.body.token;
            expect(token).toBeDefined();

            const response = await request(app)
                .post('/api/plugins/install')
                .set('Authorization', `Bearer ${token}`)
                .attach('plugin', buildZip(validPluginEntries()), 'plugin.zip');

            expect(response.status).toBe(403);
            expect(response.body.error).toMatch(/signed-in session/);
            expect(fs.existsSync(path.join(pluginsRoot, 'demo-plugin'))).toBe(
                false
            );
        });
    });

    describe('DELETE /api/plugins/:id', () => {
        beforeEach(async () => {
            await makeOperator();
            const installed = await upload();
            // Thrown rather than asserted: an expect outside a test block is
            // not a failure anybody can read.
            if (installed.status !== 201) {
                throw new Error(
                    `Could not install the fixture plugin: ${installed.status} ${JSON.stringify(installed.body)}`
                );
            }
        });

        afterEach(removeWrittenPlugins);

        it('removes an installed plugin for every account', async () => {
            const response = await agent.delete('/api/plugins/demo-plugin');

            expect(response.status).toBe(200);
            expect(response.body.remove).toEqual({ id: 'demo-plugin' });
            expect(fs.existsSync(path.join(pluginsRoot, 'demo-plugin'))).toBe(
                false
            );
            expect(
                response.body.plugins.map((plugin) => plugin.id)
            ).not.toContain('demo-plugin');
        });

        it('answers 404 for a plugin that is not installed', async () => {
            const response = await agent.delete('/api/plugins/nothing-here');

            expect(response.status).toBe(404);
        });

        it('refuses a signed-in user who is not an admin', async () => {
            await Role.update(
                { is_admin: false, role: 'user' },
                { where: { user_id: user.id } }
            );

            const response = await agent.delete('/api/plugins/demo-plugin');

            expect(response.status).toBe(403);
            expect(fs.existsSync(path.join(pluginsRoot, 'demo-plugin'))).toBe(
                true
            );
        });
    });

    describe('plugin bundles', () => {
        it('serves a plugin file to a signed-in user, with nosniff and revalidation', async () => {
            const response = await agent.get(
                '/plugins/calm-mode/dist/index.js'
            );

            expect(response.status).toBe(200);
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            // Plugin updates are rare and a stale bundle is confusing, so the
            // response is revalidated rather than cached immutably.
            expect(response.headers['cache-control']).toBe('no-cache');
        });

        it('refuses a signed-out request for a plugin file', async () => {
            // A plugin directory is served whole, so an anonymous request would
            // publish the plugin's own source, tests and lockfiles - not just
            // the entry point its manifest declares. The bundles themselves are
            // only ever fetched by a signed-in page, which is what the test
            // above proves still works.
            const response = await request(app).get(
                '/plugins/calm-mode/dist/index.js'
            );

            expect(response.status).toBe(401);
            expect(response.text).not.toContain('plugin fixture');
        });

        it('refuses a signed-out request for the manifest too', async () => {
            const response = await request(app).get(
                '/plugins/calm-mode/plugin.json'
            );

            expect(response.status).toBe(401);
            expect(response.body.id).toBeUndefined();
        });

        it('still serves a plugin page, so signing in is where it sends you', async () => {
            // Plugin pages are client-side routes under the same prefix. Gating
            // the whole prefix would answer a deep link with JSON instead of
            // the shell that redirects to the login page.
            const response = await request(app).get('/plugins/calm-mode/focus');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/text\/html/);
        });

        it('refuses an API token, even one with full access', async () => {
            // The page the user signed in to fetches a bundle with its own
            // cookies, so a token is not a client for these files - and the
            // plugin directory is served whole, which makes it the last place
            // to accept a credential that can live in a script or a phone.
            // Installing refuses a token for the same reason (see access.js).
            const created = await agent
                .post('/api/profile/api-keys')
                .send({ name: 'bundle fetcher' });
            const token = created.body.token;
            expect(token).toBeDefined();

            const response = await request(app)
                .get('/plugins/calm-mode/dist/index.js')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(403);
            expect(response.body.error).toMatch(/signed-in session/);
            expect(response.text).not.toContain('plugin fixture');
        });

        it('still answers a plugin page for a token request', async () => {
            // What is gated is a file, not the prefix: `/plugins/<id>/focus` is
            // a client-side route, so any request for it gets the app shell -
            // which is what signs the visitor in, and what a deep link needs.
            const created = await agent
                .post('/api/profile/api-keys')
                .send({ name: 'page opener' });
            const token = created.body.token;

            const response = await request(app)
                .get('/plugins/calm-mode/focus')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/text\/html/);
        });

        it('never serves a dotfile', async () => {
            // A plugin directory may hold a `.env` with the plugin's own API
            // keys; the static handler is told to ignore dotfiles so those are
            // never readable over HTTP.
            fs.writeFileSync(
                path.join(pluginsRoot, 'calm-mode', '.env'),
                'SECRET=1\n'
            );

            const response = await agent.get('/plugins/calm-mode/.env');

            // The request is not 404: it falls through to the app shell. What
            // matters is that the file's contents never come back. (A
            // signed-out request never reaches the static handler at all - it
            // is answered 401 first, which the test above covers.)
            expect(response.text).not.toContain('SECRET=1');
        });

        it('refuses a signed-out request for a file with no extension', async () => {
            // The gate cannot be "the URL ends in an extension": a plugin's own
            // `LICENSE`, `README` or `Makefile` is served by the static handler
            // just the same, and would be published to anyone who guessed it.
            fs.writeFileSync(
                path.join(pluginsRoot, 'calm-mode', 'LICENSE'),
                'plugin fixture license\n'
            );

            const signedOut = await request(app).get(
                '/plugins/calm-mode/LICENSE'
            );

            expect(signedOut.status).toBe(401);
            expect(signedOut.text).not.toContain('plugin fixture license');

            const signedIn = await agent.get('/plugins/calm-mode/LICENSE');

            // Served to a signed-in user exactly as it is: an extensionless
            // file has no text content type, so the body arrives as bytes.
            expect(signedIn.status).toBe(200);
            expect(String(signedIn.body)).toContain('plugin fixture license');
        });

        it('refuses a signed-out request whose dot is percent-encoded', async () => {
            // express.static decodes the path before it reads the disk, so
            // `index%2Ejs` is `index.js`. A gate that matched the raw URL would
            // let this one through unauthenticated.
            const signedOut = await request(app).get(
                '/plugins/calm-mode/dist/index%2Ejs'
            );

            expect(signedOut.status).toBe(401);
            expect(signedOut.text).not.toContain('plugin fixture');

            const signedIn = await agent.get(
                '/plugins/calm-mode/dist/index%2Ejs'
            );

            expect(signedIn.status).toBe(200);
            expect(signedIn.text).toContain('plugin fixture');
        });
    });

    describe('GET /manifest.webmanifest', () => {
        it('serves the base manifest to a signed-out visitor', async () => {
            const response = await request(app).get('/manifest.webmanifest');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(
                /application\/manifest\+json/
            );
            expect(response.body.name).toBeTruthy();
            expect(response.body.icons).toBeTruthy();

            const urls = (response.body.shortcuts || []).map((s) => s.url);
            expect(urls).not.toContain('/plugins/calm-mode/focus');
        });

        it('adds a shortcut for an enabled plugin', async () => {
            await agent.put('/api/plugins/calm-mode').send({ enabled: true });

            const response = await agent.get('/manifest.webmanifest');

            expect(response.status).toBe(200);
            const shortcut = (response.body.shortcuts || []).find(
                (entry) => entry.url === '/plugins/calm-mode/focus'
            );
            expect(shortcut).toBeDefined();
            expect(shortcut.name).toBe('One thing');
            // Never cached: the manifest differs per user.
            expect(response.headers['cache-control']).toBe('private, no-store');
        });

        it('answers the historical /manifest.json too', async () => {
            const response = await agent.get('/manifest.json');
            expect(response.status).toBe(200);
            expect(response.body.start_url).toBeDefined();
        });
    });
});
