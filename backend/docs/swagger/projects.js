/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *           enum: [planned, in_progress, blocked, completed, archived, all]
 *         description: Filter by project state
 *       - in: query
 *         name: area_id
 *         schema:
 *           type: integer
 *         description: Filter by area ID
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Project'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/project:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
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
 *                 description: Project name
 *                 example: "Website Redesign"
 *               description:
 *                 type: string
 *                 description: Project description
 *                 example: "Complete redesign of company website"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Project priority
 *               state:
 *                 type: string
 *                 enum: [idea, planned, in_progress, blocked, completed, archived]
 *                 description: Project state
 *               area_id:
 *                 type: integer
 *                 description: Associated area ID
 *               due_date_at:
 *                 type: string
 *                 format: date-time
 *                 description: Project due date
 *               image_url:
 *                 type: string
 *                 description: Project image URL
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of tag names
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/project/{uid}:
 *   patch:
 *     summary: Update a project
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Project UID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Project name
 *               description:
 *                 type: string
 *                 description: Project description
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Project priority
 *               state:
 *                 type: string
 *                 enum: [idea, planned, in_progress, blocked, completed, archived]
 *                 description: Project state
 *               area_id:
 *                 type: integer
 *                 description: Associated area ID
 *               due_date_at:
 *                 type: string
 *                 format: date-time
 *                 description: Project due date
 *               image_url:
 *                 type: string
 *                 description: Project image URL
 *               pin_to_sidebar:
 *                 type: boolean
 *                 description: Pin project to sidebar
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of tag names
 *     responses:
 *       200:
 *         description: Project updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 */

/**
 * @swagger
 * /api/project/{uid}:
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Project UID
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Project deleted successfully."
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 */
