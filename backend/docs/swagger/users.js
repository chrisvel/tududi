/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: string
 *                 email:
 *                   type: string
 *                 name:
 *                   type: string
 *                 surname:
 *                   type: string
 *                 appearance:
 *                   type: string
 *                   enum: [light, dark, system]
 *                 language:
 *                   type: string
 *                 timezone:
 *                   type: string
 *                 first_day_of_week:
 *                   type: integer
 *                 avatar_image:
 *                   type: string
 *                 telegram_bot_token:
 *                   type: string
 *                 telegram_chat_id:
 *                   type: string
 *                 task_summary_enabled:
 *                   type: boolean
 *                 task_summary_frequency:
 *                   type: string
 *                 task_intelligence_enabled:
 *                   type: boolean
 *                 pomodoro_enabled:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */

/**
 * @swagger
 * /api/profile:
 *   patch:
 *     summary: Update user profile
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's first name
 *               surname:
 *                 type: string
 *                 description: User's last name
 *               appearance:
 *                 type: string
 *                 enum: [light, dark, system]
 *                 description: Theme preference
 *               language:
 *                 type: string
 *                 description: Language code (e.g., "en", "es")
 *               timezone:
 *                 type: string
 *                 description: Timezone (e.g., "America/New_York")
 *               first_day_of_week:
 *                 type: integer
 *                 description: First day of week (0=Sunday, 1=Monday)
 *               avatar_image:
 *                 type: string
 *                 description: Avatar image URL
 *               telegram_bot_token:
 *                 type: string
 *                 description: Telegram bot token
 *               telegram_allowed_users:
 *                 type: string
 *                 description: Comma-separated list of allowed Telegram users
 *               task_intelligence_enabled:
 *                 type: boolean
 *                 description: Enable task intelligence features
 *               task_summary_enabled:
 *                 type: boolean
 *                 description: Enable task summary emails
 *               pomodoro_enabled:
 *                 type: boolean
 *                 description: Enable Pomodoro timer
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: string
 *                 email:
 *                   type: string
 *                 name:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */

/**
 * @swagger
 * /api/profile/api-keys:
 *   get:
 *     summary: List API keys for the current user
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ApiKey'
 */

/**
 * @swagger
 * /api/profile/api-keys:
 *   post:
 *     summary: Create a new API key
 *     tags: [Profile]
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
 *                 description: Friendly name for the API key
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiration timestamp
 *     responses:
 *       201:
 *         description: API key created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: The plain API key. This value is only returned once.
 *                 apiKey:
 *                   $ref: '#/components/schemas/ApiKey'
 *       400:
 *         description: Invalid payload
 */

/**
 * @swagger
 * /api/profile/api-keys/{id}/revoke:
 *   post:
 *     summary: Revoke an API key
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Revoked key details
 *       404:
 *         description: API key not found
 */

/**
 * @swagger
 * /api/profile/api-keys/{id}:
 *   delete:
 *     summary: Delete an API key
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: API key deleted
 *       404:
 *         description: API key not found
 */
