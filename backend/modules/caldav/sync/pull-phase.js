const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const { AppError } = require('../../../shared/errors/AppError');
const logger = require('../../../services/logService');
const RemoteCalendarRepository = require('../repositories/remote-calendar-repository');
const { parseVTODOToTask } = require('../icalendar/vtodo-parser');
const encryptionService = require('../services/encryption-service');

class PullPhase {
    async execute(calendar, userId, options = {}) {
        const { dryRun = false } = options;

        logger.logInfo(
            `Pull phase starting for calendar ${calendar.id} (user: ${userId})`
        );

        const remoteCalendar =
            await RemoteCalendarRepository.findByLocalCalendarId(calendar.id);

        if (!remoteCalendar) {
            logger.logInfo(
                `No remote calendar configured for calendar ${calendar.id}, skipping pull`
            );
            return {
                success: true,
                skipped: true,
                reason: 'No remote calendar configured',
                changedTasks: [],
            };
        }

        if (!remoteCalendar.enabled) {
            logger.logInfo(
                `Remote calendar ${remoteCalendar.id} is disabled, skipping pull`
            );
            return {
                success: true,
                skipped: true,
                reason: 'Remote calendar disabled',
                changedTasks: [],
            };
        }

        try {
            const changedTasks = await this._fetchChangesFromRemote(
                remoteCalendar,
                calendar
            );

            logger.logInfo(
                `Pull phase completed: fetched ${changedTasks.length} changed tasks`
            );

            return {
                success: true,
                changedTasks,
                fetchedCount: changedTasks.length,
            };
        } catch (error) {
            logger.logError(
                `Pull phase failed for calendar ${calendar.id}: ${error.message}`,
                error
            );
            throw new AppError(
                `Failed to pull from remote: ${error.message}`,
                500
            );
        }
    }

    async _fetchChangesFromRemote(remoteCalendar, calendar) {
        const password = encryptionService.decrypt(
            remoteCalendar.password_encrypted
        );

        const baseUrl = remoteCalendar.server_url.replace(/\/$/, '');
        const calendarPath = remoteCalendar.calendar_path.replace(/^\//, '');
        const calendarUrl = `${baseUrl}/${calendarPath}`;

        logger.logInfo(
            `Fetching changes from remote CalDAV: ${remoteCalendar.server_url}`
        );

        const syncToken = remoteCalendar.server_sync_token;

        let reportBody;
        if (syncToken) {
            reportBody = this._buildSyncCollectionReport(syncToken);
        } else {
            reportBody = this._buildInitialSyncReport();
        }

        try {
            const response = await axios({
                method: 'REPORT',
                url: calendarUrl,
                headers: {
                    'Content-Type': 'application/xml; charset=utf-8',
                    Depth: '1',
                },
                auth: {
                    username: remoteCalendar.username,
                    password: password,
                },
                data: reportBody,
                timeout: parseInt(
                    process.env.CALDAV_REQUEST_TIMEOUT || '30000',
                    10
                ),
            });

            return await this._parseReportResponse(
                response.data,
                remoteCalendar,
                calendar
            );
        } catch (error) {
            if (error.response?.status === 401) {
                throw new AppError(
                    'Authentication failed with remote CalDAV server',
                    401
                );
            }

            logger.logError(
                `Failed to fetch from remote CalDAV: ${error.message}`,
                error
            );
            throw error;
        }
    }

    _buildSyncCollectionReport(syncToken) {
        return `<?xml version="1.0" encoding="utf-8" ?>
<D:sync-collection xmlns:D="DAV:">
  <D:sync-token>${syncToken}</D:sync-token>
  <D:sync-level>1</D:sync-level>
  <D:prop>
    <D:getetag/>
    <D:getcontenttype/>
  </D:prop>
</D:sync-collection>`;
    }

    _buildInitialSyncReport() {
        return `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag />
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VTODO" />
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;
    }

    async _parseReportResponse(xmlData, remoteCalendar, calendar) {
        const parsed = await parseStringPromise(xmlData, {
            explicitArray: false,
            tagNameProcessors: [this._stripNamespace],
        });

        const changedTasks = [];

        const responses =
            parsed?.multistatus?.response ||
            parsed?.['sync-collection']?.response ||
            [];
        const responseArray = Array.isArray(responses)
            ? responses
            : [responses];

        for (const response of responseArray) {
            try {
                const href = response.href;

                if (!href || href.endsWith('/')) {
                    continue;
                }

                const etag = response.propstat?.prop?.getetag?.replace(
                    /^"|"$/g,
                    ''
                );
                const calendarData =
                    response.propstat?.prop?.['calendar-data'] ||
                    response.propstat?.prop?.calendardata;
                const status = response.status || response.propstat?.status;

                if (status && status.includes('404')) {
                    changedTasks.push({
                        action: 'delete',
                        href,
                        etag,
                    });
                    continue;
                }

                if (!calendarData) {
                    const taskUrl = `${remoteCalendar.server_url}${href}`;
                    const taskData = await this._fetchTaskData(
                        taskUrl,
                        remoteCalendar
                    );
                    if (taskData) {
                        changedTasks.push(taskData);
                    }
                    continue;
                }

                const taskData = await parseVTODOToTask(calendarData);
                if (taskData) {
                    changedTasks.push({
                        action: 'create_or_update',
                        href,
                        etag,
                        task: taskData,
                    });
                }
            } catch (error) {
                logger.logError(
                    `Failed to parse task from remote: ${error.message}`,
                    error
                );
            }
        }

        const newSyncToken =
            parsed?.multistatus?.['sync-token'] ||
            parsed?.['sync-collection']?.['sync-token'];

        if (newSyncToken) {
            await RemoteCalendarRepository.updateServerSyncToken(
                remoteCalendar.id,
                newSyncToken
            );
        }

        return changedTasks;
    }

    async _fetchTaskData(taskUrl, remoteCalendar) {
        try {
            const password = encryptionService.decrypt(
                remoteCalendar.password_encrypted
            );

            const response = await axios({
                method: 'GET',
                url: taskUrl,
                auth: {
                    username: remoteCalendar.username,
                    password: password,
                },
                timeout: parseInt(
                    process.env.CALDAV_REQUEST_TIMEOUT || '30000',
                    10
                ),
            });

            const etag = response.headers.etag?.replace(/^"|"$/g, '');
            const taskData = await parseVTODOToTask(response.data);

            return {
                action: 'create_or_update',
                href: new URL(taskUrl).pathname,
                etag,
                task: taskData,
            };
        } catch (error) {
            logger.logError(
                `Failed to fetch task data from ${taskUrl}: ${error.message}`,
                error
            );
            return null;
        }
    }

    _stripNamespace(name) {
        return name.replace(/^.*:/, '');
    }
}

module.exports = PullPhase;
