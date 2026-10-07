/**
 * @swagger
 * /api/notes:
 *   get:
 *     summary: Get all notes
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: order_by
 *         schema:
 *           type: string
 *           example: "title:asc"
 *         description: Sort order (field:direction)
 *       - in: query
 *         name: project_id
 *         schema:
 *           type: integer
 *         description: Filter by project ID
 *     responses:
 *       200:
 *         description: List of notes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Note'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/note:
 *   post:
 *     summary: Create a new note
 *     tags: [Notes]
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
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 description: Note title
 *                 example: "Meeting notes"
 *               content:
 *                 type: string
 *                 description: Note content (Markdown supported)
 *                 example: "# Meeting Summary\n- Point 1\n- Point 2"
 *               color:
 *                 type: string
 *                 description: Background color (hex)
 *                 example: "#B71C1C"
 *               project_uid:
 *                 type: string
 *                 description: Associated project UID
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of tag names
 *     responses:
 *       201:
 *         description: Note created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Note'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/note/{uid}:
 *   patch:
 *     summary: Update a note
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Note UID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Note title
 *               content:
 *                 type: string
 *                 description: Note content (Markdown supported)
 *               color:
 *                 type: string
 *                 description: Background color (hex)
 *               project_uid:
 *                 type: string
 *                 description: Associated project UID
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of tag names
 *     responses:
 *       200:
 *         description: Note updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Note'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 */

/**
 * @swagger
 * /api/note/{uid}:
 *   delete:
 *     summary: Delete a note
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Note UID
 *     responses:
 *       200:
 *         description: Note deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Note deleted successfully."
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 */

/**
 * @swagger
 * /api/note/{uid}/public-share:
 *   get:
 *     summary: Get the public sharing state of a note (owner only)
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Note UID
 *     responses:
 *       200:
 *         description: Current public sharing state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotePublicShare'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the owner can manage public sharing
 *       404:
 *         description: Note not found
 *   post:
 *     summary: Share a note publicly by link (owner only)
 *     description: Returns the token of the public link. Calling it again while sharing is on keeps the same link.
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Note UID
 *     responses:
 *       200:
 *         description: Public sharing is on
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotePublicShare'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the owner can manage public sharing
 *       404:
 *         description: Note not found
 *   delete:
 *     summary: Stop sharing a note publicly (owner only)
 *     description: Deletes the token, so the old link stops working immediately. Sharing again creates a new link.
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Note UID
 *     responses:
 *       200:
 *         description: Public sharing is off
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotePublicShare'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the owner can manage public sharing
 *       404:
 *         description: Note not found
 */

/**
 * @swagger
 * /api/public/notes/{token}:
 *   get:
 *     summary: Read a publicly shared note
 *     description: No authentication. The token is the credential. An unknown, malformed or revoked token all return 404.
 *     tags: [Notes]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Public link token
 *     responses:
 *       200:
 *         description: The shared note
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 color:
 *                   type: string
 *                   nullable: true
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: This link is not available
 */
