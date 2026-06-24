const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const Goal = sequelize.define(
        'Goal',
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
            area_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'areas',
                    key: 'id',
                },
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            why: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            horizon: {
                type: DataTypes.ENUM('season', 'year'),
                allowNull: false,
                defaultValue: 'season',
            },
            target_date: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },
            status: {
                type: DataTypes.ENUM('active', 'achieved', 'paused', 'dropped'),
                allowNull: false,
                defaultValue: 'active',
            },
        },
        {
            tableName: 'goals',
            indexes: [
                { fields: ['area_id'] },
                { fields: ['user_id'] },
                { fields: ['status'] },
            ],
        }
    );

    return Goal;
};
