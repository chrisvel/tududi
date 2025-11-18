const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const View = sequelize.define(
        'View',
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
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            search_query: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            filters: {
                type: DataTypes.TEXT,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue('filters');
                    return rawValue ? JSON.parse(rawValue) : [];
                },
                set(value) {
                    this.setDataValue('filters', JSON.stringify(value));
                },
            },
            priority: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            due: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            tags: {
                type: DataTypes.TEXT,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue('tags');
                    return rawValue ? JSON.parse(rawValue) : [];
                },
                set(value) {
                    this.setDataValue('tags', JSON.stringify(value));
                },
            },
            recurring: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            is_pinned: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
        },
        {
            tableName: 'views',
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['user_id', 'is_pinned'],
                },
            ],
        }
    );

    return View;
};
