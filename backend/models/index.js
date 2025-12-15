const { Sequelize } = require('sequelize');
const path = require('path');
const { getConfig } = require('../config/config');
const config = getConfig();

let dbConfig;

dbConfig = {
    dialect: 'sqlite',
    storage: config.dbFile,
    logging: config.environment === 'development' ? console.log : false,
    define: {
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
};

const sequelize = new Sequelize(dbConfig);

const User = require('./user')(sequelize);
const Area = require('./area')(sequelize);
const Project = require('./project')(sequelize);
const Task = require('./task')(sequelize);
const Tag = require('./tag')(sequelize);
const Note = require('./note')(sequelize);
const InboxItem = require('./inbox_item')(sequelize);
const TaskEvent = require('./task_event')(sequelize);
const Role = require('./role')(sequelize);
const Action = require('./action')(sequelize);
const Permission = require('./permission')(sequelize);
const View = require('./view')(sequelize);
const ApiToken = require('./api_token')(sequelize);
const Setting = require('./setting')(sequelize);
const Notification = require('./notification')(sequelize);
const RecurringCompletion = require('./recurringCompletion')(sequelize);
const TaskAttachment = require('./task_attachment')(sequelize);
const Backup = require('./backup')(sequelize);

User.hasMany(Area, { foreignKey: 'user_id' });
Area.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Project, { foreignKey: 'user_id' });
Project.belongsTo(User, { foreignKey: 'user_id' });
Project.belongsTo(Area, { foreignKey: 'area_id', allowNull: true });
Area.hasMany(Project, { foreignKey: 'area_id' });

User.hasMany(Task, { foreignKey: 'user_id', as: 'OwnedTasks' });
Task.belongsTo(User, { foreignKey: 'user_id', as: 'Owner' });
User.hasMany(Task, { foreignKey: 'assigned_to_user_id', as: 'AssignedTasks' });
Task.belongsTo(User, { foreignKey: 'assigned_to_user_id', as: 'AssignedTo' });
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

User.hasMany(TaskEvent, { foreignKey: 'user_id', as: 'TaskEvents' });
TaskEvent.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
Task.hasMany(TaskEvent, { foreignKey: 'task_id', as: 'TaskEvents' });
TaskEvent.belongsTo(Task, { foreignKey: 'task_id', as: 'Task' });

Task.belongsTo(Task, {
    as: 'ParentTask',
    foreignKey: 'parent_task_id',
});
Task.hasMany(Task, {
    as: 'Subtasks',
    foreignKey: 'parent_task_id',
});

Task.belongsTo(Task, {
    as: 'RecurringParent',
    foreignKey: 'recurring_parent_id',
});
Task.hasMany(Task, {
    as: 'RecurringChildren',
    foreignKey: 'recurring_parent_id',
});

Task.hasMany(RecurringCompletion, {
    as: 'Completions',
    foreignKey: 'task_id',
});
RecurringCompletion.belongsTo(Task, {
    foreignKey: 'task_id',
    as: 'Task',
});

Task.belongsToMany(Tag, {
    through: 'tasks_tags',
    foreignKey: 'task_id',
    otherKey: 'tag_id',
});
Tag.belongsToMany(Task, {
    through: 'tasks_tags',
    foreignKey: 'tag_id',
    otherKey: 'task_id',
});

Note.belongsToMany(Tag, {
    through: 'notes_tags',
    foreignKey: 'note_id',
    otherKey: 'tag_id',
});
Tag.belongsToMany(Note, {
    through: 'notes_tags',
    foreignKey: 'tag_id',
    otherKey: 'note_id',
});

Project.belongsToMany(Tag, {
    through: 'projects_tags',
    foreignKey: 'project_id',
    otherKey: 'tag_id',
});
Tag.belongsToMany(Project, {
    through: 'projects_tags',
    foreignKey: 'tag_id',
    otherKey: 'project_id',
});

User.hasOne(Role, { foreignKey: 'user_id' });
Role.belongsTo(User, { foreignKey: 'user_id' });

Permission.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
Permission.belongsTo(User, {
    foreignKey: 'granted_by_user_id',
    as: 'GrantedBy',
});
Action.belongsTo(User, { foreignKey: 'actor_user_id', as: 'Actor' });
Action.belongsTo(User, { foreignKey: 'target_user_id', as: 'Target' });

User.hasMany(View, { foreignKey: 'user_id' });
View.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(ApiToken, { foreignKey: 'user_id', as: 'apiTokens' });
ApiToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Notification, { foreignKey: 'user_id', as: 'Notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

// TaskAttachment associations
User.hasMany(TaskAttachment, { foreignKey: 'user_id' });
TaskAttachment.belongsTo(User, { foreignKey: 'user_id' });
Task.hasMany(TaskAttachment, { foreignKey: 'task_id', as: 'Attachments' });
TaskAttachment.belongsTo(Task, { foreignKey: 'task_id' });

// Backup associations
User.hasMany(Backup, { foreignKey: 'user_id', as: 'Backups' });
Backup.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

module.exports = {
    sequelize,
    User,
    Area,
    Project,
    Task,
    Tag,
    Note,
    InboxItem,
    TaskEvent,
    Role,
    Action,
    Permission,
    View,
    ApiToken,
    Setting,
    Notification,
    RecurringCompletion,
    TaskAttachment,
    Backup,
};
