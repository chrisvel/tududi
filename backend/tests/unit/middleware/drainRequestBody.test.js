const express = require('express');
const multer = require('multer');
const net = require('net');
const request = require('supertest');
const drainRequestBody = require('../../../middleware/drainRequestBody');

// Node ends a response by tearing down a socket whose request body was never
// read: the client is still uploading, so its bytes meet a closed connection
// and it sees ECONNRESET instead of the refusal the server sent. The middleware
// holds such a response until the body has been drained.
//
// Whether the reset itself happens depends on timing, so the invariant asserted
// here is the one that causes it: the response for a refused upload is finished
// only after the request body has been read. That case fails without the
// middleware; the rest pin down what it leaves alone.
describe('drainRequestBody', () => {
    const upload = multer({ storage: multer.memoryStorage() });
    const FILE_BYTES = 1024 * 1024;
    const MAX_DRAIN_BYTES = 4 * FILE_BYTES;

    const buildApp = (state = {}) => {
        const instance = express();
        instance.use(express.json());
        instance.use(drainRequestBody({ maxBytes: MAX_DRAIN_BYTES }));

        // Refuses before anything reads the body, which is what an upload route
        // does when it is not signed in.
        instance.post('/refuse', (req, res) => {
            res.on('finish', () => {
                state.completeAtFinish = req.complete;
                state.readableEndedAtFinish = req.readableEnded;
            });
            req.on('close', () => {
                state.completeAtClose = req.complete;
                state.socketDestroyedAtClose = req.socket.destroyed;
            });
            res.status(401).json({ error: 'Authentication required' });
        });
        instance.get('/refuse', (req, res) =>
            res.status(401).json({ error: 'Authentication required' })
        );
        // Reads the body first, so the response is not held back.
        instance.post('/accept', upload.single('file'), (req, res) =>
            res.status(201).json({ bytes: req.file.size, sent: req.body.sent })
        );
        return instance;
    };

    const refusedUpload = (app) =>
        request(app)
            .post('/refuse')
            .field('taskUid', 'abc')
            .attach('file', Buffer.alloc(FILE_BYTES, 1), 'upload.bin');

    it('refuses an upload only once its body has been read', async () => {
        const state = {};
        const response = await refusedUpload(buildApp(state));

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authentication required');
        expect(state.completeAtFinish || state.readableEndedAtFinish).toBe(
            true
        );
    });

    it('stops draining past the limit, answers and destroys the socket', async () => {
        const state = {};
        const server = buildApp(state).listen(0);
        const { port } = server.address();
        const socket = net.connect(port, '127.0.0.1');
        let response = '';
        socket.on('data', (data) => {
            response += data.toString('latin1');
        });
        const closed = new Promise((resolve) => {
            socket.on('close', resolve);
        });
        socket.on('error', () => {});

        // Declares far more than the limit, sends just past it, then keeps the
        // upload open: only the server can end this connection.
        socket.write(
            'POST /refuse HTTP/1.1\r\n' +
                `Host: 127.0.0.1:${port}\r\n` +
                'Content-Type: application/octet-stream\r\n' +
                `Content-Length: ${MAX_DRAIN_BYTES * 10}\r\n\r\n`
        );
        socket.write(Buffer.alloc(MAX_DRAIN_BYTES + 1, 1));

        await closed;
        server.close();

        expect(response).toMatch(/^HTTP\/1\.1 401 /);
        expect(response).toMatch(/connection: close/i);
        expect(state.completeAtClose).toBe(false);
        expect(state.socketDestroyedAtClose).toBe(true);
    });

    it('keeps waiting for a body still under the limit', async () => {
        const state = {};
        const server = buildApp(state).listen(0);
        const { port } = server.address();
        const socket = net.connect(port, '127.0.0.1');
        let response = '';
        socket.on('data', (data) => {
            response += data.toString('latin1');
        });
        const closed = new Promise((resolve) => {
            socket.on('close', resolve);
        });
        socket.on('error', () => {});

        socket.write(
            'POST /refuse HTTP/1.1\r\n' +
                `Host: 127.0.0.1:${port}\r\n` +
                'Connection: close\r\n' +
                'Content-Type: application/octet-stream\r\n' +
                `Content-Length: ${MAX_DRAIN_BYTES}\r\n\r\n`
        );
        socket.write(Buffer.alloc(MAX_DRAIN_BYTES - 1, 1));

        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(response).toBe('');

        socket.write(Buffer.alloc(1, 1));
        await closed;
        server.close();

        expect(response).toMatch(/^HTTP\/1\.1 401 /);
        expect(state.completeAtFinish).toBe(true);
    });

    it('leaves a request the parsers already read alone', async () => {
        const response = await request(buildApp())
            .post('/refuse')
            .send({ taskUid: 'abc' });

        expect(response.status).toBe(401);
    });

    it('does not hold back a response for a request with no body', async () => {
        const response = await request(buildApp()).get('/refuse');

        expect(response.status).toBe(401);
    });

    it('still hands the body to a route that consumes it', async () => {
        const response = await request(buildApp())
            .post('/accept')
            .field('sent', 'yes')
            .attach('file', Buffer.alloc(FILE_BYTES, 1), 'upload.bin');

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ bytes: FILE_BYTES, sent: 'yes' });
    });
});
