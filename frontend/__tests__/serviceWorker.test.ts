import fs from 'fs';
import path from 'path';

// Loads public/sw.js with small in-memory stand-ins for the service worker
// globals (self, caches, indexedDB, fetch) so its handlers can be driven
// directly.

const SW_SOURCE = fs.readFileSync(
    path.join(__dirname, '../../public/sw.js'),
    'utf8'
);
const ORIGIN = 'http://localhost';
const API_CACHE = 'tududi-api-v1';

// jsdom has no Fetch API classes, and the worker only needs a few fields.
class FakeResponse {
    status: number;
    ok: boolean;
    constructor(body?: unknown, init: { status?: number } = {}) {
        void body;
        this.status = init.status ?? 200;
        this.ok = this.status >= 200 && this.status < 300;
    }
    clone() {
        return this;
    }
}

const fakeRequest = (url: string) => ({
    url,
    method: 'GET',
    mode: 'cors',
    headers: { get: () => null },
});

type Listener = (event: any) => void;

function makeCaches() {
    const stores = new Map<string, Map<string, FakeResponse>>();
    const open = async (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name)!;
        return {
            put: async (req: { url: string }, res: FakeResponse) => {
                store.set(req.url, res);
            },
            delete: async (req: { url: string }) => store.delete(req.url),
            match: async (req: { url: string }) => store.get(req.url),
        };
    };
    return {
        stores,
        api: {
            open,
            delete: async (name: string) => stores.delete(name),
            keys: async () => [...stores.keys()],
            match: async (
                req: { url: string },
                opts?: { cacheName?: string }
            ) => stores.get(opts?.cacheName || '')?.get(req.url),
        },
    };
}

function makeIndexedDb() {
    const rows = new Map<number, any>();
    let nextId = 1;
    const db = {
        objectStoreNames: { contains: () => true },
        transaction: () => {
            const tx: any = {};
            tx.objectStore = () => ({
                add: (entry: any) => {
                    const id = nextId++;
                    rows.set(id, { ...entry, id });
                },
                delete: (id: number) => rows.delete(id),
                clear: () => rows.clear(),
                getAll: () => {
                    const req: any = {};
                    setTimeout(() => {
                        req.result = [...rows.values()];
                        req.onsuccess?.();
                    });
                    return req;
                },
            });
            setTimeout(() => tx.oncomplete?.());
            return tx;
        },
    };
    return {
        rows,
        add: (entry: any) => db.transaction().objectStore().add(entry),
        api: {
            open: () => {
                const req: any = {};
                setTimeout(() => req.onsuccess?.({ target: { result: db } }));
                return req;
            },
        },
    };
}

function loadWorker(fetchImpl: (url: string) => Promise<FakeResponse>) {
    const listeners: Record<string, Listener> = {};
    const posted: any[] = [];
    const self = {
        location: { href: `${ORIGIN}/sw.js`, origin: ORIGIN },
        addEventListener: (type: string, fn: Listener) => {
            listeners[type] = fn;
        },
        clients: {
            matchAll: async () => [
                { postMessage: (msg: any) => posted.push(msg) },
            ],
            claim: () => undefined,
        },
        registration: {},
        skipWaiting: () => undefined,
    };
    const caches = makeCaches();
    const idb = makeIndexedDb();
    const fetchMock = jest.fn((input: any) =>
        fetchImpl(typeof input === 'string' ? input : input.url)
    );

    new Function('self', 'caches', 'fetch', 'indexedDB', 'Response', SW_SOURCE)(
        self,
        caches.api,
        fetchMock,
        idb.api,
        FakeResponse
    );

    const get = async (url: string) => {
        let pending: Promise<FakeResponse> | undefined;
        listeners.fetch({
            request: fakeRequest(url),
            respondWith: (p: Promise<FakeResponse>) => {
                pending = p;
            },
        });
        return pending!;
    };
    const sync = async () => {
        let pending: Promise<void> | undefined;
        listeners.sync({
            tag: 'tududi-sync',
            waitUntil: (p: Promise<void>) => {
                pending = p;
            },
        });
        await pending;
    };

    return { caches, idb, posted, get, sync };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

const seedApiCache = (
    caches: ReturnType<typeof makeCaches>,
    urls: string[]
) => {
    const store = new Map<string, FakeResponse>();
    urls.forEach((url) => store.set(url, new FakeResponse('{}')));
    caches.stores.set(API_CACHE, store);
};

describe('service worker auth responses', () => {
    const restricted = `${ORIGIN}/api/project/restricted`;
    const other = `${ORIGIN}/api/tasks`;

    it('keeps the cache and queue on a 403 and drops only that entry', async () => {
        const sw = loadWorker(
            async () => new FakeResponse('{}', { status: 403 })
        );
        seedApiCache(sw.caches, [restricted, other]);
        sw.idb.add({ url: `${ORIGIN}/api/task/1`, method: 'PATCH' });

        const response = await sw.get(restricted);
        await flush();

        expect(response.status).toBe(403);
        const apiCache = sw.caches.stores.get(API_CACHE)!;
        expect(apiCache.has(restricted)).toBe(false);
        expect(apiCache.has(other)).toBe(true);
        expect(sw.idb.rows.size).toBe(1);
        expect(sw.posted).toEqual([]);
    });

    it('clears the cache and queue on a 401 and tells the windows', async () => {
        const sw = loadWorker(
            async () => new FakeResponse('{}', { status: 401 })
        );
        seedApiCache(sw.caches, [restricted, other]);
        sw.idb.add({ url: `${ORIGIN}/api/task/1`, method: 'PATCH' });

        const response = await sw.get(other);
        await flush();

        expect(response.status).toBe(401);
        expect(sw.caches.stores.has(API_CACHE)).toBe(false);
        expect(sw.idb.rows.size).toBe(0);
        expect(sw.posted).toEqual([{ type: 'AUTH_EXPIRED' }]);
    });

    it('drops a replayed entry that gets a 403 and keeps other failures', async () => {
        const statuses: Record<string, number> = {
            '/api/task/forbidden': 403,
            '/api/task/flaky': 500,
            '/api/task/fine': 200,
        };
        const sw = loadWorker(async (url) => {
            const status = statuses[new URL(url, ORIGIN).pathname] ?? 200;
            return new FakeResponse('{}', { status });
        });
        Object.keys(statuses).forEach((p) =>
            sw.idb.add({
                url: `${ORIGIN}${p}`,
                method: 'PATCH',
                headers: {},
                body: '{}',
                sessionId: null,
            })
        );

        await sw.sync();

        const left = [...sw.idb.rows.values()].map((row) => row.url);
        expect(left).toEqual([`${ORIGIN}/api/task/flaky`]);
        expect(sw.posted).toEqual([{ type: 'SYNC_COMPLETE' }]);
    });
});
