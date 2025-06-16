const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password_digest: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'password_digest'
    },
    appearance: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'light',
      validate: {
        isIn: [['light', 'dark']]
      }
    },
    language: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'en'
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'UTC'
    },
    avatar_image: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telegram_bot_token: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telegram_chat_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    task_summary_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    task_summary_frequency: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'daily',
      validate: {
        isIn: [['daily', 'weekdays', 'weekly', '1h', '2h', '4h', '8h', '12h']]
      }
    },
    task_summary_last_run: {
      type: DataTypes.DATE,
      allowNull: true
    },
    task_summary_next_run: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'users',
    hooks: {
      beforeValidate: async (user) => {
        if (user.password) {
          user.password_digest = await bcrypt.hash(user.password, 10);
        }
      }
    }
  });

  // Virtual field for password
  User.prototype.setPassword = async function(password) {
    this.password_digest = await bcrypt.hash(password, 10);
  };

  User.prototype.checkPassword = async function(password) {
    return await bcrypt.compare(password, this.password_digest);
  };

  return User;
};