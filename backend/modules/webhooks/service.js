'use strict';

const crypto = require('crypto');
const repository = require('./repository');
const { deliver, buildPayload } = require('./webhookDelivery');
const { NotFoundError, ValidationError } = require('../../shared/errors');

// Keep in sync with the `type` enum validated on the Notification model
// (backend/models/notification.js).
const VALID_EVENT_TYPES = [
    'task_assigned',
    'task_completed',
    'task_due_soon',
    'task_overdue',
    'comment_added',
    'mention',
    'reminder',
    'system',
    'project_due_soon',
    'project_overdue',
    'share_invitation',
];

function generateSecret() {
    return crypto.randomBytes(32).toString('hex');
}

function normalizeEventTypes(eventTypes) {
    if (eventTypes === undefined || eventTypes === null) {
        return [];
    }
    if (!Array.isArray(eventTypes)) {
        throw new ValidationError('event_types must be an array');
    }
    const invalid = eventTypes.filter(
        (type) => !VALID_EVENT_TYPES.includes(type)
    );
    if (invalid.length > 0) {
        throw new ValidationError(`Invalid event types: ${invalid.join(', ')}`);
    }
    return eventTypes;
}

function validateUrl(url) {
    if (!url || !/^https?:\/\//i.test(url)) {
        throw new ValidationError('A valid http(s) URL is required');
    }
}

const VALID_AUTH_TYPES = ['none', 'basic', 'header'];

// Validates an auth_type + its required fields and returns the columns to
// persist. Mirrors what n8n's Webhook trigger node supports (None, Basic
// Auth, Header Auth) so an endpoint can authenticate against receivers that
// require it, on top of the HMAC signature every delivery already carries.
function normalizeAuth({
    auth_type,
    auth_header_name,
    auth_username,
    auth_secret,
}) {
    const type = auth_type === undefined ? 'none' : auth_type;
    if (!VALID_AUTH_TYPES.includes(type)) {
        throw new ValidationError(`Invalid auth_type: ${type}`);
    }

    if (type === 'none') {
        return {
            auth_type: 'none',
            auth_header_name: null,
            auth_username: null,
            auth_secret: null,
        };
    }

    if (type === 'header') {
        if (!auth_secret) {
            throw new ValidationError(
                'auth_secret is required for header auth'
            );
        }
        return {
            auth_type: 'header',
            auth_header_name: auth_header_name || 'Authorization',
            auth_username: null,
            auth_secret,
        };
    }

    // basic
    if (!auth_username || !auth_secret) {
        throw new ValidationError(
            'auth_username and auth_secret are required for basic auth'
        );
    }
    return {
        auth_type: 'basic',
        auth_header_name: null,
        auth_username,
        auth_secret,
    };
}

// Full `secret` is only included right after create/rotate — everywhere
// else callers get `secret_preview` (last 4 chars), never the value itself.
function serialize(endpoint, { includeSecret = false } = {}) {
    return {
        uid: endpoint.uid,
        name: endpoint.name,
        url: endpoint.url,
        event_types: endpoint.event_types,
        active: endpoint.active,
        last_delivery_at: endpoint.last_delivery_at,
        last_delivery_status: endpoint.last_delivery_status,
        last_delivery_error: endpoint.last_delivery_error,
        failure_count: endpoint.failure_count,
        created_at: endpoint.created_at,
        updated_at: endpoint.updated_at,
        secret_preview: endpoint.secret
            ? `...${endpoint.secret.slice(-4)}`
            : null,
        ...(includeSecret ? { secret: endpoint.secret } : {}),
        auth_type: endpoint.auth_type,
        auth_header_name: endpoint.auth_header_name,
        auth_username: endpoint.auth_username,
        auth_configured: !!endpoint.auth_secret,
    };
}

class WebhooksService {
    async list(userId) {
        const endpoints = await repository.listForUser(userId);
        return endpoints.map((endpoint) => serialize(endpoint));
    }

    async create(userId, payload) {
        const { name, url, event_types } = payload;
        if (!name || !name.trim()) {
            throw new ValidationError('Name is required');
        }
        validateUrl(url);

        const endpoint = await repository.create({
            user_id: userId,
            name: name.trim(),
            url,
            secret: generateSecret(),
            event_types: normalizeEventTypes(event_types),
            active: true,
            ...normalizeAuth(payload),
        });

        return serialize(endpoint, { includeSecret: true });
    }

    async update(userId, uid, payload) {
        const { name, url, event_types, active, auth_type } = payload;
        const endpoint = await repository.findByUidAndUser(uid, userId);
        if (!endpoint) {
            throw new NotFoundError('Webhook endpoint not found');
        }

        const updates = {};
        if (name !== undefined) {
            if (!name.trim()) {
                throw new ValidationError('Name is required');
            }
            updates.name = name.trim();
        }
        if (url !== undefined) {
            validateUrl(url);
            updates.url = url;
        }
        if (event_types !== undefined) {
            updates.event_types = normalizeEventTypes(event_types);
        }
        if (active !== undefined) {
            updates.active = !!active;
            if (updates.active) {
                updates.failure_count = 0;
            }
        }
        if (auth_type !== undefined) {
            Object.assign(updates, normalizeAuth(payload));
        }

        await endpoint.update(updates);
        return serialize(endpoint);
    }

    async remove(userId, uid) {
        const endpoint = await repository.findByUidAndUser(uid, userId);
        if (!endpoint) {
            throw new NotFoundError('Webhook endpoint not found');
        }
        await endpoint.destroy();
        return { message: 'Webhook endpoint deleted' };
    }

    async rotateSecret(userId, uid) {
        const endpoint = await repository.findByUidAndUser(uid, userId);
        if (!endpoint) {
            throw new NotFoundError('Webhook endpoint not found');
        }
        await endpoint.update({ secret: generateSecret() });
        return serialize(endpoint, { includeSecret: true });
    }

    async sendTest(userId, uid) {
        const endpoint = await repository.findByUidAndUser(uid, userId);
        if (!endpoint) {
            throw new NotFoundError('Webhook endpoint not found');
        }

        const payload = buildPayload({
            uid: `test-${Date.now()}`,
            type: 'system',
            title: 'Test webhook from tududi',
            message:
                'This is a test delivery triggered from your webhook settings.',
            level: 'info',
            data: { test: true },
            created_at: new Date().toISOString(),
        });

        const result = await deliver(endpoint, payload);
        return { success: result.success, error: result.error || null };
    }
}

module.exports = new WebhooksService();
