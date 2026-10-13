'use strict';

// VAPID keys identify this server to the browser push services (FCM, Apple,
// Mozilla). Deployments can pin them with VAPID_PUBLIC_KEY and
// VAPID_PRIVATE_KEY; otherwise a pair is generated on first use and kept in
// the settings table, so push works without any new configuration. The
// private key is encrypted at rest whenever the instance has key material.

const webpush = require('web-push');
const { Setting } = require('../../models');
const secretCipher = require('../../shared/crypto/secretCipher');
const { getConfig } = require('../../config/config');
const { logError } = require('../../services/logService');

const SETTING_KEY = 'vapid_keys';
const FALLBACK_SUBJECT = 'mailto:noreply@tududi.com';

let cached = null;

function subject() {
    if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
    // Apple rejects localhost and plain http subjects, so only a public
    // https address is used; anything else falls back to a mailto.
    const url = getConfig().frontendUrl || '';
    if (/^https:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url)) {
        return url.replace(/\/$/, '');
    }
    return FALLBACK_SUBJECT;
}

function serialize(keys) {
    const privateKey = secretCipher.hasKeyMaterial()
        ? secretCipher.encrypt(keys.privateKey)
        : keys.privateKey;
    return JSON.stringify({ publicKey: keys.publicKey, privateKey });
}

function parse(value) {
    const stored = JSON.parse(value);
    return {
        publicKey: stored.publicKey,
        privateKey: secretCipher.decrypt(stored.privateKey),
    };
}

async function loadOrCreate() {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
    }

    const generated = webpush.generateVAPIDKeys();
    // findOrCreate keeps two processes starting together from each storing
    // a different pair: the loser reads back the winner's row.
    const [row, created] = await Setting.findOrCreate({
        where: { key: SETTING_KEY },
        defaults: { value: serialize(generated) },
    });
    if (created) return generated;

    try {
        return parse(row.value);
    } catch (error) {
        // The secret that encrypted the key changed, or the row is damaged.
        // A fresh pair invalidates existing subscriptions, which the push
        // services then reject and the devices re-create on next open.
        logError(
            'Stored VAPID keys are unreadable, generating new ones:',
            error.message
        );
        await row.update({ value: serialize(generated) });
        return generated;
    }
}

async function getVapidKeys() {
    if (!cached) {
        cached = loadOrCreate()
            .then((keys) => ({ ...keys, subject: subject() }))
            .catch((error) => {
                cached = null;
                throw error;
            });
    }
    return cached;
}

function resetVapidCache() {
    cached = null;
}

module.exports = { getVapidKeys, resetVapidCache };
