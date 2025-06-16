const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Task = sequelize.define('Task', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    today: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 2
      }
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 4
      }
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    recurrence_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'none'
    },
    recurrence_interval: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    recurrence_end_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_generated_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    project_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'projects',
        key: 'id'
      }
    }
  }, {
    tableName: 'tasks',
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['project_id']
      },
      {
        fields: ['recurrence_type']
      },
      {
        fields: ['last_generated_date']
      }
    ]
  });

  // Define enum constants
  Task.PRIORITY = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2
  };

  Task.STATUS = {
    NOT_STARTED: 0,
    IN_PROGRESS: 1,
    DONE: 2,
    ARCHIVED: 3,
    WAITING: 4
  };

  // Instance methods for priority and status
  Task.prototype.getPriorityName = function() {
    const priorities = ['low', 'medium', 'high'];
    return priorities[this.priority] || 'low';
  };

  Task.prototype.getStatusName = function() {
    const statuses = ['not_started', 'in_progress', 'done', 'archived', 'waiting'];
    return statuses[this.status] || 'not_started';
  };

  return Task;
};