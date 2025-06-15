const { Sequelize } = require('sequelize');
const path = require('path');

// Database configuration
const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace('sqlite:///', '')
  : path.join(__dirname, '../db', process.env.NODE_ENV === 'production' ? 'production.sqlite3' : 'development.sqlite3');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Import models
const User = require('./user')(sequelize);
const Area = require('./area')(sequelize);
const Project = require('./project')(sequelize);
const Task = require('./task')(sequelize);
const Tag = require('./tag')(sequelize);
const Note = require('./note')(sequelize);
const InboxItem = require('./inbox_item')(sequelize);

// Define associations
User.hasMany(Area, { foreignKey: 'user_id' });
Area.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Project, { foreignKey: 'user_id' });
Project.belongsTo(User, { foreignKey: 'user_id' });
Project.belongsTo(Area, { foreignKey: 'area_id', allowNull: true });
Area.hasMany(Project, { foreignKey: 'area_id' });

User.hasMany(Task, { foreignKey: 'user_id' });
Task.belongsTo(User, { foreignKey: 'user_id' });
Task.belongsTo(Project, { foreignKey: 'project_id', allowNull: true });
Project.hasMany(Task, { foreignKey: 'project_id' });

User.hasMany(Tag, { foreignKey: 'user_id' });
Tag.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Note, { foreignKey: 'user_id' });
Note.belongsTo(User, { foreignKey: 'user_id' });
Note.belongsTo(Project, { foreignKey: 'project_id', allowNull: true });
Project.hasMany(Note, { foreignKey: 'project_id' });

User.hasMany(InboxItem, { foreignKey: 'user_id' });
InboxItem.belongsTo(User, { foreignKey: 'user_id' });

// Many-to-many associations
Task.belongsToMany(Tag, { through: 'tasks_tags', foreignKey: 'task_id', otherKey: 'tag_id' });
Tag.belongsToMany(Task, { through: 'tasks_tags', foreignKey: 'tag_id', otherKey: 'task_id' });

Note.belongsToMany(Tag, { through: 'notes_tags', foreignKey: 'note_id', otherKey: 'tag_id' });
Tag.belongsToMany(Note, { through: 'notes_tags', foreignKey: 'tag_id', otherKey: 'note_id' });

Project.belongsToMany(Tag, { through: 'projects_tags', foreignKey: 'project_id', otherKey: 'tag_id' });
Tag.belongsToMany(Project, { through: 'projects_tags', foreignKey: 'tag_id', otherKey: 'project_id' });

module.exports = {
  sequelize,
  User,
  Area,
  Project,
  Task,
  Tag,
  Note,
  InboxItem
};