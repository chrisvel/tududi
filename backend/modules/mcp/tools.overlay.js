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
 */
module.exports = {
    /* ------------------------------------------------------------------ */
    /*  INBOX                                                              */
    /* ------------------------------------------------------------------ */
    '/api/v1/inbox': {
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
    '/api/v1/notes': {
        GET: {
            name: 'notes_list',
            description:
                'List all notes, optionally scoped to a project. ' +
                'Use when the user says "show notes", "my notes", "notes for project X", or needs reference material. ' +
                'Optional query params: project_id (int), order_by (string, e.g. "title:asc" or "created_at:desc"). ' +
                'Returns Note[] with id, uid, title, content (Markdown), color (hex), project_id, tags, created_at, updated_at.',
        },
    },
    '/api/v1/note': {
        POST: {
            name: 'note_create',
            description:
                'Create a new note. Use when the user says "write a note", "save this as a note", or "take notes on...". ' +
                'Required body: { title: string, content: string } (content supports Markdown). ' +
                'Optional: { color: string (hex, e.g. "#B71C1C"), project_uid: string, tags: string[] }. ' +
                'Returns the created Note. Use project_uid (not project_id) to link to a project.',
        },
    },
    '/api/v1/note/{uid}': {
        PATCH: {
            name: 'note_update',
            description:
                'Update an existing note by its uid. Use when the user says "edit note", "update note", or "change the note about...". ' +
                'Path param: uid (string). ' +
                'Body: any subset of { title, content, color, project_uid, tags: string[] }. Only include fields that change. ' +
                'Returns the updated Note.',
        },
        DELETE: {
            name: 'note_delete',
            description:
                'Permanently delete a note by its uid. Use when the user says "delete note", "remove that note". ' +
                'Path param: uid (string). This action is irreversible.',
        },
    },

    /* ------------------------------------------------------------------ */
    /*  PROJECTS                                                           */
    /* ------------------------------------------------------------------ */
    '/api/v1/projects': {
        GET: {
            name: 'projects_list',
            description:
                'List all projects, optionally filtered by status or area. ' +
                'Use when the user says "show projects", "list projects", "active projects", "projects in area X", or needs to look up a project_id before creating a task. ' +
                'Optional query params: status (not_started | planned | in_progress | waiting | done | cancelled | all | not_completed), area_id (int). ' +
                'Returns Project[] with id, uid, name, description, status, priority (low | medium | high), area_id, due_date_at, tags, pin_to_sidebar, created_at, updated_at. ' +
                'Call this first whenever you need a project_id or project_uid for other operations.',
        },
    },
    '/api/v1/project': {
        POST: {
            name: 'project_create',
            description:
                'Create a new project. Use when the user says "create project", "start a new project", or "new project called...". ' +
                'Required body: { name: string }. ' +
                'Optional: { description: string, priority: "low" | "medium" | "high", status: "not_started" | "planned" | "in_progress" | "waiting" | "done" | "cancelled", area_id: int, due_date_at: ISO datetime, image_url: string, tags: string[] }. ' +
                'Defaults: status="not_started", priority="medium". Returns the created Project.',
        },
    },
    '/api/v1/project/{uid}': {
        PATCH: {
            name: 'project_update',
            description:
                'Update a project by its uid. Use when the user says "update project", "change project status", "rename project", or "archive project". ' +
                'Path param: uid (string). ' +
                'Body: any subset of { name, description, priority, status, area_id, due_date_at, image_url, pin_to_sidebar: bool, tags: string[] }. ' +
                'Returns the updated Project.',
        },
        DELETE: {
            name: 'project_delete',
            description:
                'Permanently delete a project by its uid. Use when the user says "delete project" or "remove project". ' +
                'Path param: uid (string). ' +
                'Warning: this does not automatically delete or reassign the project\'s tasks. Confirm with the user and consider moving tasks first.',
        },
    },

    /* ------------------------------------------------------------------ */
    /*  TAGS                                                               */
    /* ------------------------------------------------------------------ */
    '/api/v1/tags': {
        GET: {
            name: 'tags_list',
            description:
                'List all available tags. ' +
                'Use when the user says "show tags", "what tags exist", or when you need to verify a tag name before applying it to a task or note. ' +
                'Returns Tag[] with id, uid, name, created_at, updated_at. ' +
                'Call this before creating a duplicate tag.',
        },
    },
    '/api/v1/tag': {
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
    '/api/v1/tasks': {
        GET: {
            name: 'tasks_list',
            description:
                'List tasks with filtering, sorting, and grouping. This is the primary task query tool. ' +
                'Use when the user says "show my tasks", "what\'s due today", "upcoming tasks", "completed tasks", "tasks for project X", or any task listing request. ' +
                'Optional query params: ' +
                '  type: "today" | "upcoming" | "completed" | "archived" | "all" (defaults to pending tasks if omitted), ' +
                '  status: "pending" | "completed" | "archived", ' +
                '  project_id: int, ' +
                '  groupBy: "day" | "project" (when "day", response includes groupedTasks object keyed by date), ' +
                '  order_by: string (e.g. "due_date:asc", "created_at:desc", "priority:desc"). ' +
                'Returns { tasks: Task[], groupedTasks?: { [date]: Task[] } }. ' +
                'Each Task has id, uid, name, note, status, priority (low | medium | high), due_date, project_id, tags, subtasks, today (bool), recurrence fields, created_at, updated_at. ' +
                'Use type="today" specifically when user asks about today\'s plan or daily tasks.',
        },
    },
    '/api/v1/tasks/metrics': {
        GET: {
            name: 'tasks_metrics',
            description:
                'Get task count metrics and productivity statistics. No task data is returned, only numeric counts. ' +
                'Use when the user says "dashboard", "how am I doing", "task stats", "how many tasks", or needs a productivity overview without fetching full task lists. ' +
                'Returns { total_open_tasks, tasks_pending_over_month, tasks_in_progress_count, tasks_due_today_count, today_plan_tasks_count, suggested_tasks_count, tasks_completed_today_count, weekly_completions: [{ date, count, dayName }] }. ' +
                'To get actual task data, use tasks_list instead.',
        },
    },
    '/api/v1/task': {
        POST: {
            name: 'task_create',
            description:
                'Create a new task. Use when the user says "add task", "create task", "I need to...", "new todo", or describes work to be done. ' +
                'Required body: { name: string }. ' +
                'Optional: { ' +
                '  priority: "low" | "medium" | "high" (default "medium"), ' +
                '  status: "pending" | "completed" | "archived" (default "pending"), ' +
                '  due_date: ISO 8601 datetime, ' +
                '  project_id: int (look up with projects_list if user names a project), ' +
                '  note: string (Markdown description), ' +
                '  tags: [{ name: string }], ' +
                '  today: bool (true = add to today\'s plan immediately), ' +
                '  recurrence_type: "none" | "daily" | "weekly" | "monthly" | "yearly", ' +
                '  recurrence_interval: int (e.g. 2 = every 2 days/weeks/months), ' +
                '  recurrence_end_date: ISO datetime ' +
                '}. ' +
                'Returns the created Task. If user mentions a project by name, resolve it to project_id first.',
        },
    },
    '/api/v1/task/{id}': {
        GET: {
            name: 'task_get',
            description:
                'Get full details of a single task by its numeric id or string uid. ' +
                'Use when the user says "show task", "details of task", "what\'s the status of...", or when you need to read a task before updating or deleting it. ' +
                'Path param: id (integer id or string uid, both accepted). ' +
                'Returns full Task object including subtasks, tags, recurrence settings, and time tracking data.',
        },
        PATCH: {
            name: 'task_update',
            description:
                'Update an existing task by its id or uid. ' +
                'Use when the user says "update task", "change due date", "move to project", "set priority", "rename task", "add to today", or any modification request. ' +
                'Path param: id (integer id or string uid). ' +
                'Body: any subset of { name, note, priority, status, due_date, project_id, tags: [{ name }], today: bool, recurrence_type, recurrence_interval, recurrence_end_date }. ' +
                'Only include fields that change. Set today: true/false to add/remove from today\'s plan. ' +
                'Returns the updated Task.',
        },
        DELETE: {
            name: 'task_delete',
            description:
                'Permanently delete a task by its id or uid. ' +
                'Use when the user says "delete task", "remove task". ' +
                'Path param: id (integer id or string uid). ' +
                'For recurring tasks, this deletes only this instance. Confirm with the user before deleting. This action is irreversible.',
        },
    },
    '/api/v1/task/{id}/toggle_completion': {
        PATCH: {
            name: 'task_toggle_completion',
            description:
                'Toggle a task between pending and completed status. ' +
                'Use when the user says "complete task", "mark as done", "finish task", "uncomplete task", "reopen task", or "mark as pending". ' +
                'Path param: id (integer id or string uid). ' +
                'Returns the updated Task with new status. ' +
                'Prefer this over task_update when the only change is completion state, because it handles recurring task logic automatically.',
        },
    },
    '/api/v1/task/{id}/subtasks': {
        POST: {
            name: 'task_subtask_create',
            description:
                'Create a subtask under a parent task. ' +
                'Use when the user says "add subtask", "break this down", "add a step to task", or needs to decompose a task into smaller pieces. ' +
                'Path param: id (integer id or string uid of the parent task). ' +
                'Required body: { name: string }. ' +
                'Optional: { priority: "low" | "medium" | "high", status: "pending" | "completed" | "archived", due_date: ISO datetime }. ' +
                'Returns the created subtask. The subtask inherits the parent\'s project_id.',
        },
    },
    '/api/v1/tasks/generate-recurring': {
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