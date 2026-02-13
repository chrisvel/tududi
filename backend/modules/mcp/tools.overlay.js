/**
 * MCP tools overlay: declarative overrides for tool names and descriptions.
 *
 * How it works:
 * - The registry builds a default tool for every authenticated operation in the
 *   Swagger spec (path + method). Default names are derived heuristically
 *   (e.g. tasks_list, task_get).
 * - This file provides optional overrides keyed by path and then method. Only
 *   include entries where you want to change the default.
 *
 * New API operations: they get a default MCP tool automatically. To refine it,
 * add an entry here with the exact path (e.g. /api/v1/areas/{uid}) and method
 * (GET, POST, PATCH, PUT, DELETE). Each entry can set:
 *   - name: MCP tool name (alphanumeric + underscore). Fixes e.g. inboxs_list -> inbox_list.
 *   - description: LLM-oriented text (when to use, what to pass). Shown in tools/list.
 *   - inputSchema: optional; replaces the Swagger-derived JSON Schema for parameters.
 */

module.exports = {
    '/api/v1/inbox': {
        GET: {
            name: 'inbox_list',
            description:
                'List inbox items (quick-capture items not yet processed). Use for "inbox", "captured items", or "to process".',
        },
        POST: {
            name: 'inbox_create',
            description:
                'Add an item to the inbox (quick capture). Provide content; optional project_id.',
        },
    },
    '/api/v1/notes': {
        GET: {
            name: 'notes_list',
            description:
                'List all notes. Optionally filter by project_id. Use when the user asks for notes or quick notes.',
        },
    },
    '/api/v1/note': {
        POST: {
            name: 'note_create',
            description: 'Create a new note. Provide title and content; optional project_id, color.',
        },
    },
    '/api/v1/note/{uid}': {
        PATCH: {
            name: 'note_update',
            description: 'Update a note by uid. Provide uid and fields to change.',
        },
        DELETE: {
            name: 'note_delete',
            description: 'Delete a note by uid.',
        },
    },
    '/api/v1/projects': {
        GET: {
            name: 'projects_list',
            description:
                'List projects. Optionally filter by status or area_id. Use for "projects", "list projects", or dashboard context.',
        },
    },
    '/api/v1/project': {
        POST: {
            name: 'project_create',
            description: 'Create a new project. Provide name; optional description, status, priority, area_id.',
        },
    },
    '/api/v1/project/{uid}': {
        PATCH: {
            name: 'project_update',
            description: 'Update a project by uid. Provide uid and fields to change.',
        },
        DELETE: {
            name: 'project_delete',
            description: 'Delete a project by uid. Consider moving or archiving tasks first.',
        },
    },
    '/api/v1/tags': {
        GET: {
            name: 'tags_list',
            description: 'List all tags. Use when the user asks for tags or to tag tasks/notes.',
        },
    },
    '/api/v1/tag': {
        POST: {
            name: 'tag_create',
            description: 'Create a new tag. Provide name.',
        },
    },
    '/api/v1/tasks': {
        GET: {
            name: 'tasks_list',
            description:
                'List tasks with optional filters (type: today|upcoming|completed|archived|all, status, project_id, groupBy). Use for "my tasks", "today", "upcoming", or filtered task lists.',
        },
    },
    '/api/v1/task': {
        POST: {
            name: 'task_create',
            description:
                'Create a new task. Required: name. Optional: priority, status, due_date, project_id, note, tags, recurrence. Use today: true to add to today\'s plan.',
        },
    },
    '/api/v1/task/{id}': {
        GET: {
            name: 'task_get',
            description: 'Get a single task by id or uid. Use when you need full task details or to check before update/delete.',
        },
        PATCH: {
            name: 'task_update',
            description: 'Update a task by id/uid. Provide id (or uid) and fields to change (name, status, due_date, etc.).',
        },
        DELETE: {
            name: 'task_delete',
            description: 'Delete a task by id or uid. For recurring tasks, consider scope.',
        },
    },
    '/api/v1/task/{id}/toggle_completion': {
        PATCH: {
            name: 'task_toggle_completion',
            description: 'Toggle a task\'s completion status (pending <-> completed) by task id or uid.',
        },
    },
    '/api/v1/task/{id}/subtasks': {
        POST: {
            name: 'task_add_subtask',
            description: 'Add a subtask to a parent task. Provide parent task id/uid and subtask name (and optional fields).',
        },
    },
};
