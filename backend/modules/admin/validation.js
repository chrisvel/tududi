'use strict';

const { PASSWORD_MIN_LENGTH } = require('../users/userService');

const { ValidationError } = require('../../shared/errors');
const { ROLES, CAPABILITIES } = require('../../services/rolesService');

// Checked before anything is saved so a bad role or capability cannot leave
// an update half applied.
function validateRoleChange(role, capabilities) {
    if (role !== undefined && !ROLES.includes(role)) {
        throw new ValidationError(`Unknown role: ${role}`);
    }
    if (capabilities === undefined) return;

    if (
        capabilities === null ||
        typeof capabilities !== 'object' ||
        Array.isArray(capabilities)
    ) {
        throw new ValidationError('capabilities must be an object');
    }
    for (const [capability, value] of Object.entries(capabilities)) {
        if (!CAPABILITIES.includes(capability)) {
            throw new ValidationError(`Unknown capability: ${capability}`);
        }
        if (typeof value !== 'boolean') {
            throw new ValidationError(`${capability} must be true or false`);
        }
    }
}

/**
 * Validate user ID parameter.
 */
function validateUserId(id) {
    // parseInt would read "12abc" as 12 and delete the wrong account.
    const text = typeof id === 'number' ? String(id) : id;
    if (typeof text !== 'string' || !/^[1-9]\d{0,14}$/.test(text)) {
        throw new ValidationError('Invalid user id');
    }
    return Number(text);
}

const NAME_MAX_LENGTH = 100;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

// A first name or surname: text, of a sensible length, without control
// characters. Blank means none.
function validatePersonName(value, label) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') {
        throw new ValidationError(`${label} must be text`);
    }
    const text = value.trim();
    if (CONTROL_CHARACTERS.test(text)) {
        throw new ValidationError(`${label} contains invalid characters`);
    }
    if (text.length > NAME_MAX_LENGTH) {
        throw new ValidationError(
            `${label} must be at most ${NAME_MAX_LENGTH} characters`
        );
    }
    return text || null;
}

/**
 * Validate email.
 */
function validateEmail(email) {
    if (typeof email !== 'string' || !email.includes('@')) {
        throw new ValidationError('Invalid email');
    }
    return email;
}

/**
 * Validate password.
 */
function validatePassword(password) {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
        throw new ValidationError(
            `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
        );
    }
    return password;
}

/**
 * Validate set-admin-role request body.
 */
function validateSetAdminRole(body) {
    const { user_id, is_admin } = body || {};
    if (!user_id || typeof is_admin !== 'boolean') {
        throw new ValidationError('user_id and is_admin are required');
    }
    return { user_id, is_admin };
}

/**
 * Validate create user request body. Password is optional: when it is omitted
 * the account is created without one and an invite email is sent so the member
 * can set their own. require_verification asks a user created with a password
 * to confirm their email before they can sign in.
 */
function validateCreateUser(body) {
    const {
        email,
        password,
        name,
        surname,
        role,
        capabilities,
        require_verification,
    } = body || {};
    // A blank email means the account has none. A member without an email
    // still needs a name, and cannot have a password since there is nothing to
    // sign in with.
    const cleanName = validatePersonName(name, 'Name');
    const cleanSurname = validatePersonName(surname, 'Surname');
    const cleanEmail = typeof email === 'string' ? email.trim() : email;
    if (cleanEmail) {
        validateEmail(cleanEmail);
    } else {
        if (!cleanName && !cleanSurname) {
            throw new ValidationError(
                'A name is required when there is no email'
            );
        }
        if (password) {
            throw new ValidationError('A password needs an email address');
        }
    }
    if (password) {
        validatePassword(password);
    }
    if (
        require_verification !== undefined &&
        typeof require_verification !== 'boolean'
    ) {
        throw new ValidationError('require_verification must be a boolean');
    }
    validateRoleChange(role, capabilities);
    return {
        email: cleanEmail || null,
        password: password || null,
        name: cleanName,
        surname: cleanSurname,
        role,
        capabilities,
        requireVerification: require_verification === true,
    };
}

/**
 * Validate toggle registration request body.
 */
function validateToggleRegistration(body) {
    const { enabled } = body || {};
    if (typeof enabled !== 'boolean') {
        throw new ValidationError('enabled must be a boolean value');
    }
    return { enabled };
}

/**
 * Validate a single OIDC provider entry within an oidc-config request body.
 * clientSecret is intentionally optional: omitting it means "keep whatever
 * secret is already stored for this slug" (see oidc/configService.js).
 */
function validateOidcProvider(provider, index) {
    if (!provider || typeof provider !== 'object') {
        throw new ValidationError(`providers[${index}] must be an object`);
    }

    const { slug, name, issuer, clientId, clientSecret, scope } = provider;

    if (typeof slug !== 'string' || !slug.trim()) {
        throw new ValidationError(`providers[${index}].slug is required`);
    }
    if (typeof name !== 'string' || !name.trim()) {
        throw new ValidationError(`providers[${index}].name is required`);
    }
    if (typeof issuer !== 'string' || !issuer.trim()) {
        throw new ValidationError(`providers[${index}].issuer is required`);
    }
    if (typeof clientId !== 'string' || !clientId.trim()) {
        throw new ValidationError(`providers[${index}].clientId is required`);
    }
    if (
        clientSecret !== undefined &&
        clientSecret !== null &&
        typeof clientSecret !== 'string'
    ) {
        throw new ValidationError(
            `providers[${index}].clientSecret must be a string when provided`
        );
    }
    if (scope !== undefined && scope !== null && typeof scope !== 'string') {
        throw new ValidationError(`providers[${index}].scope must be a string`);
    }

    const autoProvision =
        provider.autoProvision === undefined ? true : provider.autoProvision;
    if (typeof autoProvision !== 'boolean') {
        throw new ValidationError(
            `providers[${index}].autoProvision must be a boolean`
        );
    }

    const adminEmailDomains = provider.adminEmailDomains || [];
    if (
        !Array.isArray(adminEmailDomains) ||
        !adminEmailDomains.every((d) => typeof d === 'string')
    ) {
        throw new ValidationError(
            `providers[${index}].adminEmailDomains must be an array of strings`
        );
    }

    return {
        slug: slug.trim(),
        name: name.trim(),
        issuer: issuer.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret || undefined,
        scope: scope || undefined,
        autoProvision,
        adminEmailDomains,
    };
}

/**
 * Validate the admin OIDC configuration request body.
 */
function validateOidcConfig(body) {
    const { enabled, providers } = body || {};

    if (typeof enabled !== 'boolean') {
        throw new ValidationError('enabled must be a boolean value');
    }
    if (!Array.isArray(providers)) {
        throw new ValidationError('providers must be an array');
    }

    const validated = providers.map(validateOidcProvider);

    const slugs = validated.map((p) => p.slug);
    if (new Set(slugs).size !== slugs.length) {
        throw new ValidationError('provider slugs must be unique');
    }

    return { enabled, providers: validated };
}

module.exports = {
    validateRoleChange,
    validateUserId,
    validatePersonName,
    validateEmail,
    validatePassword,
    validateSetAdminRole,
    validateCreateUser,
    validateToggleRegistration,
    validateOidcConfig,
};
