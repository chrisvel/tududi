const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const API_VERSION = process.env.API_VERSION || 'v1';
const API_BASE_PATH = `/api/${API_VERSION}`;

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
                url: 'http://localhost:3002',
                description: `Backend server (base path ${API_BASE_PATH})`,
            },
            {
                url: 'http://localhost:8080',
                description: `Frontend dev server (proxy to ${API_BASE_PATH})`,
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
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description:
                        'JWT token authentication via Authorization header',
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
                ApiKey: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        name: {
                            type: 'string',
                            description: 'Friendly label for the API key',
                        },
                        token_prefix: {
                            type: 'string',
                            description:
                                'First characters displayed to help identify the key',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        last_used_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        expires_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        revoked_at: {
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
    apis: [path.join(__dirname, '..', 'docs', 'swagger', '*.js')], // Path to centralized Swagger documentation files
};

const swaggerSpec = swaggerJsdoc(options);

if (swaggerSpec?.paths) {
    const updatedPaths = {};

    Object.entries(swaggerSpec.paths).forEach(([pathKey, pathValue]) => {
        if (pathKey.startsWith('/api/')) {
            const versionedPath =
                API_BASE_PATH === '/api'
                    ? pathKey
                    : `${API_BASE_PATH}${pathKey.slice(4)}`;
            updatedPaths[versionedPath] = pathValue;
        } else {
            updatedPaths[pathKey] = pathValue;
        }
    });

    swaggerSpec.paths = updatedPaths;
}

module.exports = swaggerSpec;
