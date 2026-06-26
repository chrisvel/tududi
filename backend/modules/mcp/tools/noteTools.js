'use strict';

const notesService = require('../../notes/service');

/**
 * Register all note-related MCP tools
 */
function registerNoteTools(server, context, tools) {
    // 1. list_notes - List notes
    tools.push({
        name: 'list_notes',
        description: 'List notes with optional tag filtering',
        inputSchema: {
            type: 'object',
            properties: {
                tag: {
                    type: 'string',
                    description: 'Filter notes by tag name',
                },
                order_by: {
                    type: 'string',
                    description:
                        'Order by column:direction (e.g. title:asc, created_at:desc)',
                    default: 'title:asc',
                },
            },
        },
        handler: async (params) => {
            const orderBy =
                params.order_by && params.order_by.includes(':')
                    ? params.order_by
                    : `${params.order_by || 'title'}:asc`;

            const notes = await notesService.getAll(context.userId, {
                orderBy,
                tagFilter: params.tag,
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { count: notes.length, notes },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. get_note - Get a single note by UID
    tools.push({
        name: 'get_note',
        description: 'Get a specific note by its UID',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Note UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const note = await notesService.getByUid(params.uid);

            if (note.user_id !== context.userId) {
                throw new Error('Note not found.');
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ note }, null, 2),
                    },
                ],
            };
        },
    });

    // 3. create_note - Create a new note
    tools.push({
        name: 'create_note',
        description: 'Create a new note',
        inputSchema: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'Note title',
                },
                content: {
                    type: 'string',
                    description: 'Note content (markdown supported)',
                },
                project_uid: {
                    type: 'string',
                    description: 'Optional project UID to attach the note to',
                },
                color: {
                    type: 'string',
                    description: 'Optional hex color',
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of tag names',
                },
            },
            required: ['title'],
        },
        handler: async (params) => {
            const note = await notesService.create(context.userId, {
                title: params.title,
                content: params.content,
                project_uid: params.project_uid,
                color: params.color,
                tags: params.tags,
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Note created successfully', note },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 4. update_note - Update a note
    tools.push({
        name: 'update_note',
        description: 'Update an existing note',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Note UID',
                },
                title: { type: 'string', description: 'New title' },
                content: { type: 'string', description: 'New content' },
                project_uid: {
                    type: 'string',
                    description:
                        'Project UID to attach (empty string to detach)',
                },
                color: { type: 'string', description: 'New hex color' },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of tag names (replaces existing)',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const existing = await notesService.getByUid(params.uid);
            if (existing.user_id !== context.userId) {
                throw new Error('Note not found.');
            }

            const note = await notesService.update(context.userId, params.uid, {
                title: params.title,
                content: params.content,
                project_uid: params.project_uid,
                color: params.color,
                tags: params.tags,
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Note updated successfully', note },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 5. delete_note - Delete a note
    tools.push({
        name: 'delete_note',
        description: 'Delete a note',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Note UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const existing = await notesService.getByUid(params.uid);
            if (existing.user_id !== context.userId) {
                throw new Error('Note not found.');
            }

            await notesService.delete(params.uid);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Note deleted successfully' },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });
}

module.exports = { registerNoteTools };
