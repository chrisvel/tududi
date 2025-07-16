'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('tasks', 'parent_task_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'tasks',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.addIndex('tasks', ['parent_task_id']);
  },

  async down (queryInterface) {
    await queryInterface.removeIndex('tasks', ['parent_task_id']);
    await queryInterface.removeColumn('tasks', 'parent_task_id');
  }
};
