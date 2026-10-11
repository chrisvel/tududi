'use strict';
const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');
module.exports = (sequelize) =>
    sequelize.define(
        'LtdJournal',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                defaultValue: uid,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            actor_type: {
                type: DataTypes.ENUM('user', 'ai', 'mcp', 'system', 'sync'),
                allowNull: false,
                defaultValue: 'user',
            },
            actor_id: { type: DataTypes.STRING, allowNull: true },
            op: { type: DataTypes.STRING, allowNull: false },
            entity_type: { type: DataTypes.STRING, allowNull: false },
            entity_uid: { type: DataTypes.STRING, allowNull: false },
            before: { type: DataTypes.JSON, allowNull: true },
            after: { type: DataTypes.JSON, allowNull: true },
            proposal_id: { type: DataTypes.INTEGER, allowNull: true },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            reverted_at: { type: DataTypes.DATE, allowNull: true },
        },
        {
            tableName: 'ltd_journal',
            timestamps: false,
            indexes: [{ fields: ['user_id'] }, { fields: ['entity_uid'] }],
        }
    );
