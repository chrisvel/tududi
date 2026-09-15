'use strict';

const crypto = require('crypto');
const { URL } = require('url');
const { logError } = require('../../services/logService');

const DELIVERY_TIMEOUT_MS = 5000;
const MAX_FAILURES_BEFORE_DISABLE = 10;

function signPayload(secret, rawBody) {
    return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function buildPayload(notification) {
    return {
        id: notification.uid,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        level: notification.level,
        data: notification.data,
        created_at: notification.created_at || new Date().toISOString(),
    };
}

function sendOnce(url, rawBody, headers) {
    return new Promise((resolve) => {
        let parsed;
        try {
            parsed = new URL(url);
        } catch (error) {
            resolve({ success: false, error: 'Invalid webhook URL' });
            return;
        }

        const client =
            parsed.protocol === 'http:' ? require('http') : require('https');
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(rawBody),
                ...headers,
            },
            timeout: DELIVERY_TIMEOUT_MS,
        };

        const req = client.request(parsed, options, (res) => {
            // Drain the response body so the socket is released back to the pool.
            res.on('data', () => {});
            res.on('end', () => {
                const success = res.statusCode >= 200 && res.statusCode < 300;
                resolve({
                    success,
                    statusCode: res.statusCode,
                    error: success ? null : `HTTP ${res.statusCode}`,
                });
            });
        });

        req.on('timeout', () => {
            req.destroy(new Error('Request timed out'));
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        req.write(rawBody);
        req.end();
    });
}

// Builds the extra auth header(s) an endpoint's receiver expects, on top of
// the HMAC signature headers. Mirrors what n8n's Webhook trigger node
// supports: None, Basic Auth, and Header Auth (a JWT/bearer token pasted as
// a Header Auth value is indistinguishable from Header Auth to the sender).
function buildAuthHeaders(endpoint) {
    if (endpoint.auth_type === 'basic') {
        const encoded = Buffer.from(
            `${endpoint.auth_username || ''}:${endpoint.auth_secret || ''}`
        ).toString('base64');
        return { Authorization: `Basic ${encoded}` };
    }

    if (endpoint.auth_type === 'header') {
        const headerName = endpoint.auth_header_name || 'Authorization';
        return { [headerName]: endpoint.auth_secret || '' };
    }

    return {};
}

function isRetryable(result) {
    return !result.success && (!result.statusCode || result.statusCode >= 500);
}

async function recordDeliveryResult(endpoint, result) {
    try {
        const updates = {
            last_delivery_at: new Date(),
            last_delivery_status: result.success ? 'success' : 'failed',
            last_delivery_error: result.success
                ? null
                : result.error || 'Unknown error',
        };

        if (result.success) {
            updates.failure_count = 0;
        } else {
            updates.failure_count = endpoint.failure_count + 1;
            if (updates.failure_count >= MAX_FAILURES_BEFORE_DISABLE) {
                updates.active = false;
            }
        }

        await endpoint.update(updates);
    } catch (error) {
        logError('Failed to record webhook delivery result:', error);
    }
}

// Delivers a signed notification payload to a single webhook endpoint.
// Never throws: delivery failures are recorded on the endpoint and swallowed
// so a broken endpoint can't take down notification creation.
async function deliver(endpoint, payload) {
    try {
        const rawBody = JSON.stringify(payload);
        const signature = signPayload(endpoint.secret, rawBody);
        const headers = {
            'X-Tududi-Event': payload.type,
            'X-Tududi-Delivery': crypto.randomUUID(),
            'X-Tududi-Signature': `sha256=${signature}`,
            ...buildAuthHeaders(endpoint),
        };

        let result = await sendOnce(endpoint.url, rawBody, headers);
        if (isRetryable(result)) {
            result = await sendOnce(endpoint.url, rawBody, headers);
        }

        await recordDeliveryResult(endpoint, result);
        return result;
    } catch (error) {
        logError('Unexpected error delivering webhook:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { signPayload, buildPayload, buildAuthHeaders, deliver };
