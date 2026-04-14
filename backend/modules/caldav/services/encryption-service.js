const crypto = require('crypto');
const { getConfig } = require('../../../config/config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
    const config = getConfig();
    const key = config.encryptionKey || config.secretKey;

    if (!key) {
        throw new Error(
            'No encryption key found. Set ENCRYPTION_KEY or SECRET_KEY environment variable'
        );
    }

    return Buffer.from(key, 'utf-8').slice(0, 32);
}

function encrypt(text) {
    if (!text) {
        throw new Error('Cannot encrypt empty text');
    }

    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return JSON.stringify({
            iv: iv.toString('hex'),
            encrypted,
            authTag: authTag.toString('hex'),
        });
    } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

function decrypt(encryptedData) {
    if (!encryptedData) {
        throw new Error('Cannot decrypt empty data');
    }

    try {
        const key = getEncryptionKey();
        const data = JSON.parse(encryptedData);

        if (!data.iv || !data.encrypted || !data.authTag) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(data.iv, 'hex');
        const authTag = Buffer.from(data.authTag, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        if (error.message.includes('Unsupported state or unable to authenticate data')) {
            throw new Error(
                'Decryption failed: Invalid auth tag or tampered data'
            );
        }
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

function isEncrypted(data) {
    if (!data || typeof data !== 'string') {
        return false;
    }

    try {
        const parsed = JSON.parse(data);
        return (
            parsed &&
            typeof parsed === 'object' &&
            'iv' in parsed &&
            'encrypted' in parsed &&
            'authTag' in parsed
        );
    } catch {
        return false;
    }
}

module.exports = {
    encrypt,
    decrypt,
    isEncrypted,
};
