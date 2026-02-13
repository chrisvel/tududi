/**
 * MCP tools overlay: declarative overrides for tool names and descriptions.
 *
 * Principles applied to every description:
 *   1. Intent triggers — natural-language phrases an LLM can match against user requests.
 *   2. Behavior — what the tool returns or mutates, including response shape hints.
 *   3. Parameters — required/optional fields, valid enum values, and edge-case notes.
 *
 * Only operations that need name or description fixes are listed.
 * Any Swagger operation not listed here gets a default MCP tool automatically.
 *
 * Paths use API_BASE_PATH from the Swagger config (same as registry.js) for maintainability.
 */
const swaggerSpec = require('../../config/swagger');
const API_BASE_PATH = swaggerSpec.API_BASE_PATH || '/api/v1';

function path(relative) {
    return relative ? `${API_BASE_PATH}/${relative}` : API_BASE_PATH;
}

module.exports = {
    /* ------------------------------------------------------------------ */
    /*  INBOX                                                              */
    /* ------------------------------------------------------------------ */
    [path('inbox')]: {
        GET: {
            name: 'inbox_list',
            description:
                'Retrieve unprocessed inbox items — the quick-capture buffer. ' +
                'Use when the user says "show inbox", "what did I capture", "unprocessed items", or "things to triage". ' +
                'Returns { items: InboxItem[], pagination: { total, limit, offset } }. ' +
                'Optional query params: limit (int, default 20), offset (int, default 0). ' +
                'Each item has id, uid, content, status (added | processed | ignored), created_at.',
        },
        POST: {
            name: 'inbox_create',
            description:
                'Quick-capture a thought, idea, or task into the inbox for later triage. ' +
                'Use when the user says "capture this", "remind me", "add to inbox", or provides a raw thought without specifying a project or due date. ' +
                'Required body: { content: string }. Optional: { source: string } (e.g. "manual", "telegram"). ' +
                'Returns the created InboxItem. Do NOT set project_id here; the inbox is project-agnostic by design.',
        },
    },

    /* ------------------------------------------------------------------ */
    /*  NOTES                                                              */
    /* ------------------------------------------------------------------ */
    [path('notes')]: {
        GET: {
            name: 'notes_list',
            description:
                'List all notes, optionally scoped to a project. ' +
                'Use when the user says "show notes", "my notes", "notes for project X", or needs reference material. ' +
                'Optional query params: project_id (int), order_by (string, e.g. "title:asc" or "created_at:desc"). ' +
                'Returns Note[] with id, uid, title, content (Markdown), color (hex), project_id, tags, created_at, updated_at.',
        },
    },
    [path('note')]: {
        POST: {
            name: 'note_create',
            description:
                'Create a new note. Use when the user says "write a note", "save this as a note", or "take notes on...". ' +
                'Required body: { title: string, content: string } (content supports Markdown). ' +
                'Optional: { color: string (hex, e.g. "#B71C1C"), project_uid: string, tags: array of strings (tag names) }. ' +
                'Returns the created Note. Use project_uid here; for tasks use project_id.',
        },
    },
    [path('note/{uid}')]: {
        PATCH: {
            name: 'note_update',
            description:
                'Update an existing note by its uid. Use when the user says "edit note", "update note", or "change the note about...". ' +
                'Pass **uid** at top level (path parameter); do not put uid in the request body. ' +
                'Body: any subset of { title, content, color, project_uid, tags: array of strings (tag names) }. Only include fields that change. ' +
                'Returns the updated Note.',
        },
        DELETE: {
            name: 'note_delete',
            description:
                'Permanently delete a note by its uid. Use when the user says "delete note", "remove that note". ' +
                'Pass **uid** at top level (path parameter). This action is irreversible.',
        },
    },

    /* ------------------------------------------------------------------ */
    /*  PROJECTS                                                           */
    /* ------------------------------------------------------------------ */
    [path('projects')]: {
        GET: {
            name: 'projects_list',
            description:
                'List all projects, optionally filtered by status or area. ' +
                'Use when the user says "show projects", "list projects", "active projects", "projects in area X", or needs to look up a project before creating a task or note. ' +
                'Optional query params: status (not_started | planned | in_progress | waiting | done | cancelled | all | not_completed), area_id (int). ' +
                'Returns each project with **id** and **uid**. Use **project_id** (integer) for task_create, task_update, tasks_list filter. Use **project_uid** (string) for note_create, note_update, project_update, project_delete. Resolve by name via projects_list first.',
        },
    },
    [path('project')]: {
        POST: {
            name: 'project_create',
            description:
                'Create a new project. Use when the user says "create project", "start a new project", or "new project called...". ' +
                'Required body: { name: string }. ' +
                'Optional: { description: string, priority: "low" | "medium" | "high", status: "not_started" | "planned" | "in_progress" | "waiting" | "done" | "cancelled", area_id: int, due_date_at: RFC 3339 / ISO 8601 with timezone (e.g. 2026-02-13T15:04:05Z), image_url: string, tags: array of strings }. ' +
                'Defaults: status="not_started", priority="medium". Returns the created Project.',
        },
    },
    [path('project/{uid}')]: {
        PATCH: {
            name: 'project_update',
            description:
                'Update a project by its uid. Use when the user says "update project", "change project status", "rename project", or "archive project". ' +
                'Pass **uid** at top level (path parameter); do not put uid in the request body. ' +
                'Body: any subset of { name, description, priority, status, area_id, due_date_at, image_url, pin_to_sidebar: bool, tags: array of strings }. ' +
                'Returns the updated Project.',
        },
        DELETE: {
            name: 'project_delete',
            description:
                'Permanently delete a project by its uid. Use when the user says "delete project" or "remove project". ' +
                'Pass **uid** at top level (path parameter). ' +
                'Warning: this does not automatically delete or reassign the project\'s tasks. Confirm with the user and consider moving tasks first.',
        },
    },

    /* ------------------------------------------------------------------ */
    /*  TAGS                                                               */
    /* ------------------------------------------------------------------ */
    [path('tags')]: {
        GET: {
            name: 'tags_list',
            description:
                'List all available tags. ' +
                'Use when the user says "show tags", "what tags exist", or when you need to verify a tag name before applying it to a task or note. ' +
                'Returns Tag[] with id, uid, name, created_at, updated_at. Use tag names as strings for notes; use objects { name } for tasks. ' +
                'Call this before creating a duplicate tag.',
        },
    },
    [path('tag')]: {
        POST: {
            name: 'tag_create',
            description:
                'Create a new tag. Use when the user says "create tag", "new tag called...". ' +
                'Required body: { name: string }. Returns the created Tag. ' +
                'Check tags_list first to avoid duplicates.',
        },
    },

    /* ------------------------------------------------------------------ */
    /*  TASKS                                                              */
    /* ------------------------------------------------------------------ */
    [path('tasks')]: {
        GET: {
            name: 'tasks_list',
            description:
                'List tasks with filtering, sorting, and grouping. This is the primary task query tool. ' +
                'Use when the user says "show my tasks", "what\'s due today", "upcoming tasks", "completed tasks", "tasks for project X", or any task listing request. ' +
                'Optional query params: ' +
                '  type: "today" | "upcoming" | "completed" | "archived" | "all" (default when omitted: open tasks, excludes done/archived/cancelled), ' +
                '  status: "not_started" | "in_progress" | "waiting" | "done" | "archived" | "cancelled" | "planned", ' +
                '  project_id: int, ' +
                '  groupBy (camelCase): "day" | "project" (when "day", response includes groupedTasks keyed by date), ' +
                '  order_by: string (e.g. "due_date:asc", "created_at:desc", "priority:desc"). ' +
                'Returns { tasks: Task[], groupedTasks?: { [date]: Task[] } }. ' +
                'Today plan (type=today) shows tasks with status in **planned**, **in_progress**, **waiting**. Exact defaults follow server behavior; when in doubt, pass explicitly. ' +
                'Use type="today" when user asks about today\'s plan or daily tasks.',
        },
    },
    [path('tasks/metrics')]: {
        GET: {
            name: 'tasks_metrics',
            description:
                'Get task count metrics and productivity statistics. No task data is returned, only numeric counts. ' +
                'Use when the user says "dashboard", "how am I doing", "task stats", "how many tasks", or needs a productivity overview without fetching full task lists. ' +
                'Returns { total_open_tasks, tasks_pending_over_month, tasks_in_progress_count, tasks_due_today_count, today_plan_tasks_count, suggested_tasks_count, tasks_completed_today_count, weekly_completions: [{ date, count, dayName }] }. ' +
                'To get actual task data, use tasks_list instead.',
        },
    },
    [path('task')]: {
        POST: {
            name: 'task_create',
            description:
                'Create a new task. Use when the user says "add task", "create task", "I need to...", "new todo", or describes work to be done. ' +
                'Required body: { name: string }. ' +
                'Optional: { ' +
                '  priority: "low" | "medium" | "high" (default "medium"), ' +
                '  status: "not_started" | "in_progress" | "waiting" | "done" | "archived" | "cancelled" | "planned" (default "not_started"), ' +
                '  due_date: RFC 3339 / ISO 8601 with timezone (e.g. 2026-02-13T15:04:05Z), ' +
                '  project_id: int (look up with projects_list if user names a project), ' +
                '  note: string (Markdown description), ' +
                '  tags: array of objects with **name** (e.g. [{ name: "tag1" }]; for notes, tags are strings), ' +
                '  recurrence_type: "none" | "daily" | "weekly" | "monthly" | "yearly", ' +
                '  recurrence_interval: int (e.g. 2 = every 2 days/weeks/months), ' +
                '  recurrence_end_date: RFC 3339 / ISO 8601 with timezone (e.g. 2026-02-13T15:04:05Z), ' +
                '  today: boolean (optional pin to today\'s plan) ' +
                '}. ' +
                'Returns the created Task. If user mentions a project by name, resolve it to project_id first.',
        },
    },
    [path('task/{uid}')]: {
        GET: {
            name: 'task_get',
            description:
                'Get full details of a single task by its uid. ' +
                'Use when the user says "show task", "details of task", "what\'s the status of...", or when you need to read a task before updating or deleting it. ' +
                'Pass **uid** at top level (path parameter). ' +
                'Returns full Task object including subtasks, tags, recurrence settings, and time tracking data.',
        },
        PATCH: {
            name: 'task_update',
            description:
                'Update an existing task by its uid. ' +
                'Use when the user says "update task", "change due date", "move to project", "set priority", "rename task", "add to today\'s plan", "complete task", "mark as done", or any modification request. ' +
                'Pass **uid** at top level (path parameter); do not put uid in the request body. ' +
                'Body: any subset of { name, note, priority, status, due_date (RFC 3339 / ISO 8601 with timezone), project_id, tags: [{ name }], recurrence_type, recurrence_interval, recurrence_end_date, today: boolean }. ' +
                'Only include fields that change. To complete use status: **done**; to uncomplete use status: **not_started**. To add to today\'s plan use status: **planned**, **in_progress**, or **waiting**; to remove use **not_started**, **done**, or **archived**. ' +
                'Returns the updated Task.',
        },
        DELETE: {
            name: 'task_delete',
            description:
                'Permanently delete a task by its uid. ' +
                'Use when the user says "delete task", "remove task". ' +
                'Pass **uid** at top level (path parameter). ' +
                'For recurring tasks, this deletes only this instance. Confirm with the user before deleting. This action is irreversible.',
        },
    },
    [path('task/{uid}/subtasks')]: {
        POST: {
            name: 'task_subtask_create',
            description:
                'Create a subtask under a parent task. ' +
                'Use when the user says "add subtask", "break this down", "add a step to task", or needs to decompose a task into smaller pieces. ' +
                'Pass **uid** at top level (path parameter, parent task uid); do not put uid in the request body. ' +
                'Required body: { name: string }. ' +
                'Optional: { priority: "low" | "medium" | "high", status: "not_started" | "in_progress" | "waiting" | "done" | "archived" | "cancelled" | "planned", due_date: RFC 3339 / ISO 8601 with timezone (e.g. 2026-02-13T15:04:05Z) }. ' +
                'Returns the created subtask. The subtask inherits the parent\'s project_id.',
        },
    },
    [path('tasks/generate-recurring')]: {
        POST: {
            name: 'tasks_generate_recurring',
            description:
                'Manually trigger generation of upcoming recurring task instances. ' +
                'Use when the user says "generate recurring tasks", "create next instances", or when recurring tasks appear missing. ' +
                'No body required. Returns { message, count } indicating how many instances were created. ' +
                'Normally runs automatically, so only call this if the user explicitly requests it or reports missing recurring instances.',
        },
    },
};