/**
 * @swagger
 * /api/tags:
 *   get:
 *     summary: Get all tags
 *     tags: [Tags]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of tags
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tag'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/tag:
 *   post:
 *     summary: Create a new tag
 *     tags: [Tags]
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
 *                 description: Tag name
 *                 example: "urgent"
 *     responses:
 *       201:
 *         description: Tag created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
