const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Setting = sequelize.define(
        'Setting',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            key: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            value: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
        },
        {
            tableName: 'settings',
            timestamps: true,
            underscored: true,
        }
    );

    return Setting;
};
