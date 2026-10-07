const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

const RELATION_TYPES = ['blocks', 'related_to', 'duplicates'];

module.exports = (sequelize) => {
    const TaskRelation = sequelize.define(
        'TaskRelation',
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
            source_task_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onDelete: 'CASCADE',
            },
            target_task_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onDelete: 'CASCADE',
            },
            relation_type: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    isIn: [RELATION_TYPES],
                },
            },
            created_by_user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onDelete: 'SET NULL',
            },
        },
        {
            tableName: 'task_relations',
            indexes: [
                {
                    unique: true,
                    fields: [
                        'source_task_id',
                        'target_task_id',
                        'relation_type',
                    ],
                    name: 'task_relations_source_target_type',
                },
                {
                    fields: ['target_task_id'],
                    name: 'task_relations_target_task_id',
                },
            ],
        }
    );

    TaskRelation.RELATION_TYPES = RELATION_TYPES;

    return TaskRelation;
};
