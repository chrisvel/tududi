/**
 * @swagger
 * /api/inbox:
 *   get:
 *     summary: Get inbox items
 *     tags: [Inbox]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
 *     responses:
 *       200:
 *         description: List of inbox items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InboxItem'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/inbox:
 *   post:
 *     summary: Create a new inbox item
 *     tags: [Inbox]
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Inbox item content
 *                 example: "Remember to call John"
 *               source:
 *                 type: string
 *                 description: Source of the item
 *                 example: "manual"
 *     responses:
 *       201:
 *         description: Inbox item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InboxItem'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
