require('dotenv').config();
const path = require('path');

const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace('sqlite:///', '')
  : path.join(__dirname, '..', 'db');

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: path.join(dbPath, 'development.sqlite3'),
    logging: console.log,
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  test: {
    dialect: 'sqlite',
    storage: path.join(dbPath, 'test.sqlite3'),
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  production: {
    dialect: 'sqlite',
    storage: path.join(dbPath, 'production.sqlite3'),
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
};