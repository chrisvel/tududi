const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Tududi API',
            version: '1.0.0',
            description: 'REST API for Tududi task management application',
            contact: {
                name: 'Tududi',
                url: 'https://github.com/chrisvel/tududi',
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT',
            },
        },
        servers: [
            {
                url: 'http://localhost:8080',
                description: 'Development server',
            },
            {
                url: 'http://localhost:3000',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'connect.sid',
                    description: 'Session cookie authentication',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error type',
                        },
                        message: {
                            type: 'string',
                            description: 'Error message',
                        },
                    },
                },
                Task: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Task ID',
                        },
                        uid: {
                            type: 'string',
                            description: 'Task unique identifier',
                        },
                        name: {
                            type: 'string',
                            description: 'Task name',
                        },
                        description: {
                            type: 'string',
                            description:
                                'Task description (Markdown supported)',
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'completed', 'archived'],
                            description: 'Task status',
                        },
                        priority: {
                            type: 'string',
                            enum: ['low', 'medium', 'high'],
                            description: 'Task priority',
                        },
                        due_date: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Task due date',
                        },
                        project_id: {
                            type: 'integer',
                            description: 'Associated project ID',
                        },
                        recurring_pattern: {
                            type: 'string',
                            enum: ['daily', 'weekly', 'monthly', 'yearly'],
                            description: 'Recurring pattern',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                Project: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Project ID',
                        },
                        uid: {
                            type: 'string',
                            description: 'Project unique identifier',
                        },
                        name: {
                            type: 'string',
                            description: 'Project name',
                        },
                        description: {
                            type: 'string',
                            description: 'Project description',
                        },
                        state: {
                            type: 'string',
                            enum: ['active', 'archived', 'completed'],
                            description: 'Project state',
                        },
                        priority: {
                            type: 'string',
                            enum: ['low', 'medium', 'high'],
                            description: 'Project priority',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                Note: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Note ID',
                        },
                        uid: {
                            type: 'string',
                            description: 'Note unique identifier',
                        },
                        title: {
                            type: 'string',
                            description: 'Note title',
                        },
                        content: {
                            type: 'string',
                            description: 'Note content (Markdown supported)',
                        },
                        color: {
                            type: 'string',
                            description: 'Note background color (hex)',
                        },
                        project_id: {
                            type: 'integer',
                            description: 'Associated project ID',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                Tag: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Tag ID',
                        },
                        uid: {
                            type: 'string',
                            description: 'Tag unique identifier',
                        },
                        name: {
                            type: 'string',
                            description: 'Tag name',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                InboxItem: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Inbox item ID',
                        },
                        uid: {
                            type: 'string',
                            description: 'Inbox item unique identifier',
                        },
                        content: {
                            type: 'string',
                            description: 'Inbox item content',
                        },
                        status: {
                            type: 'string',
                            enum: ['added', 'processed', 'ignored'],
                            description: 'Processing status',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                Area: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Area ID',
                        },
                        uid: {
                            type: 'string',
                            description: 'Area unique identifier',
                        },
                        name: {
                            type: 'string',
                            description: 'Area name',
                        },
                        description: {
                            type: 'string',
                            description: 'Area description',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
            },
        },
        security: [
            {
                cookieAuth: [],
            },
        ],
    },
    apis: ['./routes/*.js'], // Path to route files for JSDoc comments
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
