// Life-to-Day (T-305): storage for Idempotency-Key responses.
// Table created by migration 20261011120000; the model lives in this module
// because the table is fork-only (no upstream model file to patch).
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../models');

const TTL_DAYS = 7;

const LtdIdempotencyKey = sequelize.define(
    'LtdIdempotencyKey',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        key: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        method: {
            type: DataTypes.STRING(10),
            allowNull: false,
        },
        path: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        status: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        response: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: 'ltd_idempotency_keys',
        underscored: true,
        createdAt: 'created_at',
        updatedAt: false,
    }
);

async function findByKeyAndUser(key, userId) {
    return LtdIdempotencyKey.findOne({ where: { key, user_id: userId } });
}

async function saveResult({ key, userId, method, path, status, response }) {
    try {
        return await LtdIdempotencyKey.create({
            key,
            user_id: userId,
            method,
            path,
            status,
            response:
                typeof response === 'string'
                    ? response
                    : JSON.stringify(response),
        });
    } catch (error) {
        // A concurrent request with the same key won the race; its stored
        // response is authoritative.
        if (error.name === 'SequelizeUniqueConstraintError') {
            return findByKeyAndUser(key, userId);
        }
        throw error;
    }
}

// Lazy TTL purge: keys are only meaningful while an offline replay or retry
// is still plausible; seven days covers a week away from the network.
async function purgeExpired() {
    const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000);
    const { Op } = require('sequelize');
    return LtdIdempotencyKey.destroy({
        where: { created_at: { [Op.lt]: cutoff } },
    });
}

module.exports = {
    LtdIdempotencyKey,
    findByKeyAndUser,
    saveResult,
    purgeExpired,
    TTL_DAYS,
};
