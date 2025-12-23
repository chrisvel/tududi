const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SupporterLicense = sequelize.define(
        'SupporterLicense',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: true, // Nullable until license is activated
            },
            license_key: {
                type: DataTypes.STRING(64),
                allowNull: false,
                unique: true,
            },
            tier: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: 'bronze',
                validate: {
                    isIn: [['bronze', 'silver', 'gold']],
                },
            },
            purchase_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
            },
            activated_at: {
                type: DataTypes.DATE,
                allowNull: true, // Nullable until license is activated
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            revoked_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'supporter_licenses',
            underscored: true,
        }
    );

    /**
     * Get the current status of this license
     * @returns {string} 'active' | 'grace' | 'expired' | 'revoked'
     */
    SupporterLicense.prototype.getStatus = function () {
        if (this.revoked_at) return 'revoked';
        if (!this.expires_at) return 'active'; // Lifetime license

        const now = new Date();
        const expiresAt = new Date(this.expires_at);

        if (now <= expiresAt) return 'active';

        // Calculate grace period end (7 days after expiration)
        const gracePeriodEnd = new Date(expiresAt);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

        if (now <= gracePeriodEnd) return 'grace';

        return 'expired';
    };

    /**
     * Check if license is currently valid (active or in grace period)
     * @returns {boolean}
     */
    SupporterLicense.prototype.isValid = function () {
        const status = this.getStatus();
        return status === 'active' || status === 'grace';
    };

    return SupporterLicense;
};
