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

// SQLite performance optimizations for slow I/O systems (e.g., Synology NAS with HDDs)
if (dbConfig.dialect === 'sqlite') {
    const pragmas = [
        // WAL mode: sequential writes instead of random I/O, better for Btrfs COW
        'PRAGMA journal_mode=WAL;',
        // Relaxed sync: faster writes with minimal durability risk for single-user app
        'PRAGMA synchronous=NORMAL;',
        // 5 second busy timeout: prevents "database is locked" errors under load
        'PRAGMA busy_timeout=5000;',
        // 64MB cache: keeps more data in memory, reduces disk reads
        'PRAGMA cache_size=-64000;',
        // Store temp tables in memory instead of disk
        'PRAGMA temp_store=MEMORY;',
        // Enable memory-mapped I/O (256MB): faster reads on large databases
        'PRAGMA mmap_size=268435456;',
    ];

    (async () => {
        try {
            for (const pragma of pragmas) {
                await sequelize.query(pragma);
            }
            if (config.environment === 'development') {
                console.log('SQLite performance optimizations enabled');
            }
        } catch (err) {
            console.error('Failed to set SQLite PRAGMAs:', err.message);
        }
    })();
}

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
const PushSubscription = require('./push_subscription')(sequelize);

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

// PushSubscription associations
User.hasMany(PushSubscription, {
    foreignKey: 'user_id',
    as: 'PushSubscriptions',
});
PushSubscription.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

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
    PushSubscription,
};
