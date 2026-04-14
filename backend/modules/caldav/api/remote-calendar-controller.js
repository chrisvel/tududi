const axios = require('axios');
const { AppError } = require('../../../shared/errors/AppError');
const RemoteCalendarRepository = require('../repositories/remote-calendar-repository');
const CalendarRepository = require('../repositories/calendar-repository');
const encryptionService = require('../services/encryption-service');

class RemoteCalendarController {
    async listRemoteCalendars(req, res) {
        const userId = req.currentUser.id;

        const remoteCalendars =
            await RemoteCalendarRepository.findByUserId(userId);

        const sanitizedCalendars = remoteCalendars.map((rc) => {
            const json = rc.toJSON();
            delete json.password_encrypted;
            return json;
        });

        res.json(sanitizedCalendars);
    }

    async getRemoteCalendar(req, res) {
        const { id } = req.params;
        const userId = req.currentUser.id;

        const remoteCalendar = await RemoteCalendarRepository.findById(id);

        if (!remoteCalendar) {
            throw new AppError('Remote calendar not found', 404);
        }

        if (remoteCalendar.user_id !== userId) {
            throw new AppError('Unauthorized access to remote calendar', 403);
        }

        const json = remoteCalendar.toJSON();
        delete json.password_encrypted;

        res.json(json);
    }

    async createRemoteCalendar(req, res) {
        const userId = req.currentUser.id;
        const {
            local_calendar_id,
            name,
            server_url,
            calendar_path,
            username,
            password,
            auth_type = 'basic',
            enabled = true,
            sync_direction = 'bidirectional',
        } = req.body;

        if (
            !local_calendar_id ||
            !name ||
            !server_url ||
            !calendar_path ||
            !username ||
            !password
        ) {
            throw new AppError(
                'Missing required fields: local_calendar_id, name, server_url, calendar_path, username, password',
                400
            );
        }

        const localCalendar =
            await CalendarRepository.findById(local_calendar_id);
        if (!localCalendar) {
            throw new AppError('Local calendar not found', 404);
        }

        if (localCalendar.user_id !== userId) {
            throw new AppError('Unauthorized access to local calendar', 403);
        }

        const existing =
            await RemoteCalendarRepository.findByLocalCalendarId(
                local_calendar_id
            );
        if (existing) {
            throw new AppError(
                'Remote calendar already configured for this local calendar',
                409
            );
        }

        const validAuthTypes = ['basic', 'bearer'];
        if (!validAuthTypes.includes(auth_type)) {
            throw new AppError(
                `Invalid auth type. Must be one of: ${validAuthTypes.join(', ')}`,
                400
            );
        }

        const validDirections = ['bidirectional', 'pull', 'push'];
        if (!validDirections.includes(sync_direction)) {
            throw new AppError(
                `Invalid sync direction. Must be one of: ${validDirections.join(', ')}`,
                400
            );
        }

        const passwordEncrypted = encryptionService.encrypt(password);

        const remoteCalendar = await RemoteCalendarRepository.create({
            user_id: userId,
            local_calendar_id,
            name,
            server_url: server_url.replace(/\/$/, ''),
            calendar_path: calendar_path.startsWith('/')
                ? calendar_path
                : `/${calendar_path}`,
            username,
            password_encrypted: passwordEncrypted,
            auth_type,
            enabled,
            sync_direction,
        });

        const json = remoteCalendar.toJSON();
        delete json.password_encrypted;

        res.status(201).json(json);
    }

    async updateRemoteCalendar(req, res) {
        const { id } = req.params;
        const userId = req.currentUser.id;

        const remoteCalendar = await RemoteCalendarRepository.findById(id);

        if (!remoteCalendar) {
            throw new AppError('Remote calendar not found', 404);
        }

        if (remoteCalendar.user_id !== userId) {
            throw new AppError('Unauthorized access to remote calendar', 403);
        }

        const {
            name,
            server_url,
            calendar_path,
            username,
            password,
            auth_type,
            enabled,
            sync_direction,
        } = req.body;

        const updates = {};

        if (name !== undefined) updates.name = name;
        if (server_url !== undefined)
            updates.server_url = server_url.replace(/\/$/, '');
        if (calendar_path !== undefined)
            updates.calendar_path = calendar_path.startsWith('/')
                ? calendar_path
                : `/${calendar_path}`;
        if (username !== undefined) updates.username = username;
        if (password !== undefined) {
            updates.password_encrypted = encryptionService.encrypt(password);
        }
        if (auth_type !== undefined) {
            const validAuthTypes = ['basic', 'bearer'];
            if (!validAuthTypes.includes(auth_type)) {
                throw new AppError(
                    `Invalid auth type. Must be one of: ${validAuthTypes.join(', ')}`,
                    400
                );
            }
            updates.auth_type = auth_type;
        }
        if (enabled !== undefined) updates.enabled = enabled;
        if (sync_direction !== undefined) {
            const validDirections = ['bidirectional', 'pull', 'push'];
            if (!validDirections.includes(sync_direction)) {
                throw new AppError(
                    `Invalid sync direction. Must be one of: ${validDirections.join(', ')}`,
                    400
                );
            }
            updates.sync_direction = sync_direction;
        }

        const updatedRemoteCalendar = await RemoteCalendarRepository.update(
            remoteCalendar,
            updates
        );

        const json = updatedRemoteCalendar.toJSON();
        delete json.password_encrypted;

        res.json(json);
    }

    async deleteRemoteCalendar(req, res) {
        const { id } = req.params;
        const userId = req.currentUser.id;

        const remoteCalendar = await RemoteCalendarRepository.findById(id);

        if (!remoteCalendar) {
            throw new AppError('Remote calendar not found', 404);
        }

        if (remoteCalendar.user_id !== userId) {
            throw new AppError('Unauthorized access to remote calendar', 403);
        }

        await RemoteCalendarRepository.delete(remoteCalendar);

        res.status(204).send();
    }

    async testConnection(req, res) {
        const userId = req.currentUser.id;
        const { server_url, calendar_path, username, password, auth_type } =
            req.body;

        if (!server_url || !calendar_path || !username || !password) {
            throw new AppError(
                'Missing required fields: server_url, calendar_path, username, password',
                400
            );
        }

        try {
            const baseUrl = server_url.replace(/\/$/, '');
            const path = calendar_path.startsWith('/')
                ? calendar_path
                : `/${calendar_path}`;
            const testUrl = `${baseUrl}${path}`;

            const authConfig =
                auth_type === 'bearer'
                    ? { headers: { Authorization: `Bearer ${password}` } }
                    : { auth: { username, password } };

            const response = await axios({
                method: 'OPTIONS',
                url: testUrl,
                ...authConfig,
                timeout: parseInt(
                    process.env.CALDAV_REQUEST_TIMEOUT || '30000',
                    10
                ),
            });

            const davHeader = response.headers.dav || '';
            const supportsCalDAV =
                davHeader.includes('calendar-access') ||
                davHeader.includes('1');

            res.json({
                success: true,
                status: response.status,
                supportsCalDAV,
                davCapabilities: davHeader,
                message: supportsCalDAV
                    ? 'Connection successful - CalDAV supported'
                    : 'Connection successful - CalDAV support unclear',
            });
        } catch (error) {
            if (error.response?.status === 401) {
                throw new AppError('Authentication failed', 401);
            }

            if (error.response?.status === 404) {
                throw new AppError('Calendar path not found', 404);
            }

            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                throw new AppError('Unable to reach server', 503);
            }

            throw new AppError(`Connection test failed: ${error.message}`, 500);
        }
    }
}

module.exports = new RemoteCalendarController();
