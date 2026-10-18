'use strict';

const { User } = require('../../models');
const secretCipher = require('../../shared/crypto/secretCipher');
const { ValidationError, NotFoundError } = require('../../shared/errors');
const {
    safeRequest,
    assertSafeCalDavUrl,
} = require('../caldav/services/safe-request');
const { logError } = require('../../services/logService');

const TIMEOUT_MS = 10000;
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 1000;
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const TAGS_PATTERN = /^[\w ,-]{0,200}$/;
const APPRISE_TYPES = ['info', 'success', 'warning', 'failure'];

const clip = (value, max) => {
    const text = String(value ?? '');
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
};

// The address is the base URL of an apprise-api server, e.g.
// http://192.168.1.10:8000 or https://apprise.example.com/prefix.
function normalizeBaseUrl(raw) {
    let parsed;
    try {
        parsed = new URL(String(raw || '').trim());
    } catch {
        throw new ValidationError(
            'Enter the full address of your Apprise server, for example http://192.168.1.10:8000'
        );
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new ValidationError(
            'The Apprise server address must start with http:// or https://'
        );
    }
    if (parsed.username || parsed.password) {
        throw new ValidationError(
            'Remove the username and password from the Apprise server address'
        );
    }
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
}

function encryptSecret(value) {
    if (!secretCipher.hasKeyMaterial()) {
        throw new ValidationError(
            'Cannot save the Apprise settings: set TUDUDI_SESSION_SECRET (or TUDUDI_OIDC_SECRET_ENCRYPTION_KEY) on the server first'
        );
    }
    return secretCipher.encrypt(value);
}

// Only the host is shown back to the user. The full address and the config
// key stay encrypted at rest and never leave the server.
function hostOf(encryptedUrl) {
    try {
        return new URL(secretCipher.decrypt(encryptedUrl)).host;
    } catch {
        return null;
    }
}

function publicConfig(user) {
    const configured = !!(user?.apprise_url && user?.apprise_key);
    return {
        configured,
        host: configured ? hostOf(user.apprise_url) : null,
        tags: user?.apprise_tags || '',
    };
}

async function findUser(userId) {
    const user = await User.findByPk(userId, {
        attributes: ['id', 'apprise_url', 'apprise_key', 'apprise_tags'],
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
}

async function getConfig(userId) {
    return publicConfig(await findUser(userId));
}

async function saveConfig(userId, body = {}) {
    const url = normalizeBaseUrl(body.url);
    const key = String(body.key ?? '').trim();
    if (!KEY_PATTERN.test(key)) {
        throw new ValidationError(
            'The config key can only contain letters, numbers, dashes and underscores'
        );
    }
    const tags = String(body.tags ?? '').trim();
    if (!TAGS_PATTERN.test(tags)) {
        throw new ValidationError(
            'Tags can only contain letters, numbers, spaces, commas, dashes and underscores'
        );
    }

    // Same rule as the calendar feeds: private addresses are refused unless
    // CALDAV_ALLOW_PRIVATE_HOSTS is set, and link-local is always refused.
    await assertSafeCalDavUrl(url);

    const user = await findUser(userId);
    await user.update({
        apprise_url: encryptSecret(url),
        apprise_key: encryptSecret(key),
        apprise_tags: tags || null,
    });

    return { configured: true, host: new URL(url).host, tags };
}

async function removeConfig(userId) {
    await findUser(userId);
    await User.update(
        { apprise_url: null, apprise_key: null, apprise_tags: null },
        { where: { id: userId } }
    );
    return { configured: false, host: null, tags: '' };
}

// Throws on failure. Axios errors carry the request URL, which contains the
// config key, so callers must only log error.message or error.code.
async function post(user, { title, body, type }) {
    const baseUrl = secretCipher.decrypt(user.apprise_url);
    const key = secretCipher.decrypt(user.apprise_key);
    const data = {
        title: clip(title, MAX_TITLE_LENGTH),
        body: clip(body, MAX_BODY_LENGTH),
        type: APPRISE_TYPES.includes(type) ? type : 'info',
    };
    if (user.apprise_tags) {
        data.tag = user.apprise_tags;
    }

    await safeRequest({
        method: 'POST',
        url: `${baseUrl}/notify/${encodeURIComponent(key)}`,
        data,
        timeout: TIMEOUT_MS,
    });
}

// Never throws: a failing webhook must not break the action that produced
// the notification. Returns true when the server accepted the message.
async function sendToUser(userId, payload) {
    try {
        const user = await User.findByPk(userId, {
            attributes: ['id', 'apprise_url', 'apprise_key', 'apprise_tags'],
        });
        if (!user?.apprise_url || !user?.apprise_key) return false;
        await post(user, payload);
        return true;
    } catch (error) {
        logError(
            'Failed to send Apprise notification:',
            new Error(error.code || error.message || 'unknown error')
        );
        return false;
    }
}

function sendNotification(notification) {
    return sendToUser(notification.user_id, {
        title: notification.title,
        body: notification.message || '',
        type: notification.level === 'error' ? 'failure' : notification.level,
    });
}

async function sendTest(userId) {
    const user = await findUser(userId);
    if (!user.apprise_url || !user.apprise_key) {
        throw new ValidationError(
            'Save your Apprise server address and config key first'
        );
    }
    try {
        await post(user, {
            title: 'Test notification',
            body: 'Apprise notifications are working.',
            type: 'info',
        });
    } catch (error) {
        throw new ValidationError(
            `Apprise did not accept the message: ${error.code || error.message}`
        );
    }
    return { channel: 'apprise', delivered: true };
}

module.exports = {
    getConfig,
    saveConfig,
    removeConfig,
    sendToUser,
    sendNotification,
    sendTest,
};
