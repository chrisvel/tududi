/**
 * @swagger
 * tags:
 *   - name: Tasks
 *     description: Task management endpoints
 */

/**
 * @swagger
 * /api/tasks/order:
 *   get:
 *     summary: Get your manual task order for a list
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: scope
 *         required: true
 *         schema:
 *           type: string
 *           enum: [all, project]
 *       - in: query
 *         name: project_uid
 *         schema:
 *           type: string
 *         description: Required when scope is project
 *     responses:
 *       200:
 *         description: Task UIDs in your saved order
 *   put:
 *     summary: Save a drag in a task list
 *     description: task_uids are the shown tasks in their new order. They are reordered within the slots they hold in your full saved order; other tasks keep their places. With base_order_by (All Tasks only), the full order starts from that sort instead.
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scope, task_uids]
 *             properties:
 *               scope:
 *                 type: string
 *                 enum: [all, project]
 *               project_uid:
 *                 type: string
 *               task_uids:
 *                 type: array
 *                 items:
 *                   type: string
 *               base_order_by:
 *                 type: string
 *                 example: "due_date:asc"
 *     responses:
 *       200:
 *         description: Order saved
 *       400:
 *         description: Invalid payload
 *       404:
 *         description: A task or project was not found or is not visible to you
 */

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get tasks with filtering and grouping options
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [today, upcoming, completed, archived, all]
 *         description: Filter tasks by type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, archived]
 *         description: Filter by task status
 *       - in: query
 *         name: project_id
 *         schema:
 *           type: integer
 *         description: Filter by project ID
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, project]
 *         description: Group tasks by day or project
 *       - in: query
 *         name: order_by
 *         schema:
 *           type: string
 *           example: "created_at:desc"
 *         description: Sort order (field:direction). `custom:asc` sorts by your drag-and-drop order (see /api/tasks/order).
 *     responses:
 *       200:
 *         description: List of tasks (use /api/tasks/metrics for dashboard statistics)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *                 groupedTasks:
 *                   type: object
 *                   description: Tasks grouped by day (only when groupBy=day)
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/tasks/metrics:
 *   get:
 *     summary: Get task metrics and dashboard statistics (counts only)
 *     description: Returns only numeric counts and statistics. Use /api/tasks with filters to fetch actual task data.
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Task metrics and statistics (counts only, no task arrays)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_open_tasks:
 *                   type: integer
 *                   description: Total number of open tasks
 *                 tasks_pending_over_month:
 *                   type: integer
 *                   description: Number of tasks pending for over a month
 *                 tasks_in_progress_count:
 *                   type: integer
 *                   description: Number of tasks currently in progress
 *                 tasks_due_today_count:
 *                   type: integer
 *                   description: Number of tasks due today
 *                 today_plan_tasks_count:
 *                   type: integer
 *                   description: Number of tasks in today's plan
 *                 suggested_tasks_count:
 *                   type: integer
 *                   description: Number of suggested tasks
 *                 tasks_completed_today_count:
 *                   type: integer
 *                   description: Number of tasks completed today
 *                 weekly_completions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: integer
 *                       dayName:
 *                         type: string
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/task:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Task name
 *                 example: "Complete project documentation"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Task priority
 *               status:
 *                 type: string
 *                 enum: [pending, completed, archived]
 *                 description: Task status
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Task due date
 *               project_id:
 *                 type: integer
 *                 description: Associated project ID
 *               note:
 *                 type: string
 *                 description: Task description (Markdown supported)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                 description: Array of tag objects
 *               subtasks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     priority:
 *                       type: string
 *                       enum: [low, medium, high]
 *                     status:
 *                       type: string
 *                       enum: [pending, completed, archived]
 *                 description: Array of subtasks to create with this task
 *               recurrence_type:
 *                 type: string
 *                 enum: [none, daily, weekly, monthly, yearly]
 *                 description: Recurring pattern
 *               recurrence_interval:
 *                 type: integer
 *                 description: Interval for recurrence (e.g., every 2 days)
 *               recurrence_end_date:
 *                 type: string
 *                 format: date-time
 *                 description: When to stop creating recurring instances
 *               today:
 *                 type: boolean
 *                 description: Add task to today's plan
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/task/{id}:
 *   get:
 *     summary: Get a specific task by ID or UID
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID (integer) or UID (string)
 *     responses:
 *       200:
 *         description: Task details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Task not found
 *
 *   patch:
 *     summary: Update a task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID (integer) or UID (string)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Task name
 *               note:
 *                 type: string
 *                 description: Task description (Markdown supported)
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Task priority
 *               status:
 *                 type: string
 *                 enum: [pending, completed, archived]
 *                 description: Task status
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Task due date
 *               project_id:
 *                 type: integer
 *                 description: Associated project ID
 *               tags:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                 description: Array of tag objects
 *               subtasks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: Subtask ID (for existing subtasks)
 *                     name:
 *                       type: string
 *                       description: Subtask name
 *                     isNew:
 *                       type: boolean
 *                       description: Mark as true for new subtasks
 *                     isEdited:
 *                       type: boolean
 *                       description: Mark as true when editing existing subtasks
 *                     priority:
 *                       type: string
 *                       enum: [low, medium, high]
 *                     status:
 *                       type: string
 *                       enum: [pending, completed, archived]
 *                 description: Array of subtasks (omit existing subtasks to delete them, include with isNew=true to add new ones)
 *               today:
 *                 type: boolean
 *                 description: Add/remove task from today's plan
 *               recurrence_type:
 *                 type: string
 *                 enum: [none, daily, weekly, monthly, yearly]
 *                 description: Recurring pattern
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Task not found
 *
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID (integer) or UID (string)
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Task not found
 */

/**
 * @swagger
 * /api/task/{id}/subtasks:
 *   get:
 *     summary: Get all subtasks for a parent task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Parent task ID (integer) or UID (string)
 *     responses:
 *       200:
 *         description: List of subtasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Parent task not found
 */

/**
 * @swagger
 * /api/task/{id}/toggle_completion:
 *   patch:
 *     summary: Toggle task completion status
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task completion toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task not found
 */

/**
 * @swagger
 * /api/task/{uid}/skip-occurrence:
 *   post:
 *     summary: Skip the current occurrence of a recurring task
 *     description: |
 *       Moves a recurring task to its next occurrence without completing it
 *       (e.g. a bill someone else already paid). The occurrence is recorded
 *       as skipped and does not count as a completion. Skipping the last
 *       occurrence of a series that has an end date cancels the task.
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Task UID
 *     responses:
 *       200:
 *         description: Occurrence skipped; returns the updated task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Task is not a recurring task
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task not found
 */

/**
 * @swagger
 * /api/tasks/generate-recurring:
 *   post:
 *     summary: Manually trigger recurring task generation
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Recurring tasks generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
