/**
 * @swagger
 * /api/areas:
 *   get:
 *     summary: Get all areas
 *     tags: [Areas]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of areas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Area'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/areas/{uid}:
 *   get:
 *     summary: Get an area by UID
 *     tags: [Areas]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Area UID
 *     responses:
 *       200:
 *         description: Area details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Area'
 *       400:
 *         description: Invalid UID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Area not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/areas:
 *   post:
 *     summary: Create a new area
 *     tags: [Areas]
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
 *                 description: Area name
 *                 example: "Work"
 *               description:
 *                 type: string
 *                 description: Area description
 *                 example: "Work-related projects and tasks"
 *     responses:
 *       201:
 *         description: Area created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Area'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/areas/{uid}:
 *   patch:
 *     summary: Update an area
 *     tags: [Areas]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Area UID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Area name
 *               description:
 *                 type: string
 *                 description: Area description
 *     responses:
 *       200:
 *         description: Area updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Area'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Area not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/areas/{uid}:
 *   delete:
 *     summary: Delete an area
 *     tags: [Areas]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Area UID
 *     responses:
 *       204:
 *         description: Area deleted successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Area not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
