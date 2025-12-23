const { SupporterLicense, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Get the active supporter license for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} License with status, or null
 */
async function getUserLicense(userId) {
    const license = await SupporterLicense.findOne({
        where: { user_id: userId },
        order: [['activated_at', 'DESC']], // Get most recent
    });

    if (!license) return null;

    const status = license.getStatus();

    // Only return if valid (active or in grace period)
    if (status === 'active' || status === 'grace') {
        return {
            id: license.id,
            tier: license.tier,
            activated_at: license.activated_at,
            expires_at: license.expires_at,
            status: status,
            is_valid: true,
        };
    }

    return null;
}

/**
 * Activate a license key for a user
 * @param {number} userId - User ID
 * @param {string} licenseKey - License key to activate
 * @returns {Promise<Object>} Activated license info
 * @throws {Error} If key invalid, already used, or revoked
 */
async function activateLicense(userId, licenseKey) {
    if (!licenseKey || typeof licenseKey !== 'string') {
        throw new Error('Invalid license key format');
    }

    // Check if license key exists in the database
    const license = await SupporterLicense.findOne({
        where: { license_key: licenseKey.trim() },
    });

    if (!license) {
        throw new Error('License key not found');
    }

    if (license.revoked_at) {
        throw new Error('This license key has been revoked');
    }

    // Check if license is already activated by another user
    if (license.user_id && license.user_id !== userId) {
        throw new Error('This license key is already in use');
    }

    // If license is already activated by this user, return current info
    if (license.user_id === userId) {
        const status = license.getStatus();
        return {
            tier: license.tier,
            activated_at: license.activated_at,
            expires_at: license.expires_at,
            status: status,
            message: 'License already activated for this user',
        };
    }

    // Activate the license
    await license.update({
        user_id: userId,
        activated_at: new Date(),
    });

    const status = license.getStatus();

    return {
        tier: license.tier,
        activated_at: license.activated_at,
        expires_at: license.expires_at,
        status: status,
        message: 'License activated successfully',
    };
}

/**
 * Get analytics for admin dashboard
 * @returns {Promise<Object>} Analytics data
 */
async function getAdminAnalytics() {
    const totalCount = await SupporterLicense.count({
        where: {
            user_id: { [Op.not]: null },
            revoked_at: null,
        },
    });

    const bronzeCount = await SupporterLicense.count({
        where: {
            user_id: { [Op.not]: null },
            tier: 'bronze',
            revoked_at: null,
        },
    });

    const silverCount = await SupporterLicense.count({
        where: {
            user_id: { [Op.not]: null },
            tier: 'silver',
            revoked_at: null,
        },
    });

    const goldCount = await SupporterLicense.count({
        where: {
            user_id: { [Op.not]: null },
            tier: 'gold',
            revoked_at: null,
        },
    });

    // Calculate active licenses (not expired beyond grace period)
    const allLicenses = await SupporterLicense.findAll({
        where: {
            user_id: { [Op.not]: null },
            revoked_at: null,
        },
    });

    const activeCount = allLicenses.filter((license) =>
        license.isValid()
    ).length;

    // Calculate total revenue (if purchase amounts are tracked)
    const totalRevenue = await SupporterLicense.sum('purchase_amount', {
        where: {
            user_id: { [Op.not]: null },
            revoked_at: null,
        },
    });

    return {
        total_supporters: totalCount,
        active_supporters: activeCount,
        by_tier: {
            bronze: bronzeCount,
            silver: silverCount,
            gold: goldCount,
        },
        total_revenue: totalRevenue || 0,
    };
}

/**
 * Get all supporters with their license info
 * @returns {Promise<Array>} List of supporters
 */
async function getAllSupporters() {
    const licenses = await SupporterLicense.findAll({
        where: {
            user_id: { [Op.not]: null },
        },
        include: [
            {
                model: User,
                as: 'User',
                attributes: ['id', 'email', 'name', 'surname'],
            },
        ],
        order: [['activated_at', 'DESC']],
    });

    return licenses.map((license) => {
        const status = license.getStatus();
        return {
            id: license.id,
            user_id: license.user_id,
            email: license.User.email,
            name: license.User.name,
            surname: license.User.surname,
            tier: license.tier,
            purchase_amount: license.purchase_amount,
            activated_at: license.activated_at,
            expires_at: license.expires_at,
            status: status,
            is_valid: license.isValid(),
        };
    });
}

/**
 * Revoke a license (admin only)
 * @param {number} licenseId - License ID to revoke
 * @returns {Promise<boolean>} Success
 */
async function revokeLicense(licenseId) {
    const license = await SupporterLicense.findByPk(licenseId);

    if (!license) {
        throw new Error('License not found');
    }

    await license.update({
        revoked_at: new Date(),
    });

    return true;
}

module.exports = {
    getUserLicense,
    activateLicense,
    getAdminAnalytics,
    getAllSupporters,
    revokeLicense,
};
