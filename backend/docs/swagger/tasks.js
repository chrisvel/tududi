/**
 * @swagger
 * tags:
 *   - name: Tasks
 *     description: Task management endpoints
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
 *           enum: [not_started, in_progress, waiting, done, archived, cancelled, planned]
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
 *         description: Sort order (field:direction)
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
 *                 enum: [not_started, in_progress, waiting, done, archived, cancelled, planned]
 *                 description: Task status
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Task due date (RFC 3339 / ISO 8601 with timezone, e.g. 2026-02-13T15:04:05Z)
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
 *                 description: When to stop creating recurring instances (RFC 3339 / ISO 8601 with timezone, e.g. 2026-02-13T15:04:05Z)
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
 * /api/task/{uid}:
 *   get:
 *     summary: Get a specific task by UID
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
 *         description: Task UID (string)
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
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Task UID (string)
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
 *                 enum: [not_started, in_progress, waiting, done, archived, cancelled, planned]
 *                 description: Task status
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Task due date (RFC 3339 / ISO 8601 with timezone, e.g. 2026-02-13T15:04:05Z)
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
 *               today:
 *                 type: boolean
 *                 description: Add/remove task from today's plan
 *               recurrence_type:
 *                 type: string
 *                 enum: [none, daily, weekly, monthly, yearly]
 *                 description: Recurring pattern
 *               recurrence_interval:
 *                 type: integer
 *                 description: Interval for recurrence (e.g. every 2 days)
 *               recurrence_end_date:
 *                 type: string
 *                 format: date-time
 *                 description: When to stop creating recurring instances (RFC 3339 / ISO 8601 with timezone, e.g. 2026-02-13T15:04:05Z)
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
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Task UID (string)
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
 * /api/task/{uid}/subtasks:
 *   post:
 *     summary: Add a subtask to a parent task
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
 *         description: Parent task UID (string)
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
 *                 description: Subtask name
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               status:
 *                 type: string
 *                 enum: [not_started, in_progress, waiting, done, archived, cancelled, planned]
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: RFC 3339 / ISO 8601 with timezone (e.g. 2026-02-13T15:04:05Z)
 *     responses:
 *       201:
 *         description: Subtask created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Parent task not found
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
