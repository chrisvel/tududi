const { safeRequest } = require('../services/safe-request');
const { parseStringPromise } = require('xml2js');
const { AppError } = require('../../../shared/errors');
const logger = require('../../../services/logService');
const RemoteCalendarRepository = require('../repositories/remote-calendar-repository');
const SyncStateRepository = require('../repositories/sync-state-repository');
const { parseVTODOToTask } = require('../icalendar/vtodo-parser');
const encryptionService = require('../services/encryption-service');
const { resolveRemoteHref, normalizeHref } = require('../utils/href-utils');
const { getUserTimezone } = require('../utils/user-timezone');

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
            const response = await safeRequest({
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

            // Date-only DUE/DTSTART values are stored as the end of that day in
            // the user's timezone, the same as the web app and the CalDAV
            // server do. Parsing them as UTC moved due dates a day for users
            // east of UTC.
            const userTimezone = await getUserTimezone(calendar.user_id);

            return await this._parseReportResponse(
                response.data,
                remoteCalendar,
                calendar,
                userTimezone,
                { fullListing: !syncToken }
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

    async _parseReportResponse(
        xmlData,
        remoteCalendar,
        calendar,
        userTimezone,
        { fullListing = false } = {}
    ) {
        const parsed = await parseStringPromise(xmlData, {
            explicitArray: false,
            tagNameProcessors: [this._stripNamespace],
        });

        const changedTasks = [];
        const listedHrefs = [];

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
                listedHrefs.push(href);

                // propstat may be a single object or an array when multiple
                // status codes are returned for different props
                const propstatArray = Array.isArray(response.propstat)
                    ? response.propstat
                    : response.propstat
                      ? [response.propstat]
                      : [];

                const okPropstat = propstatArray.find(
                    (ps) => !ps.status || ps.status.includes('200')
                );

                const etag = (
                    okPropstat?.prop?.getetag ||
                    response.propstat?.prop?.getetag
                )?.replace(/^"|"$/g, '');

                // calendar-data may be a string or an object when the element
                // has attributes (e.g. content-type). Extract the text content.
                let rawCalendarData =
                    okPropstat?.prop?.['calendar-data'] ||
                    okPropstat?.prop?.calendardata ||
                    response.propstat?.prop?.['calendar-data'] ||
                    response.propstat?.prop?.calendardata;

                if (rawCalendarData && typeof rawCalendarData === 'object') {
                    rawCalendarData = rawCalendarData._ || null;
                }
                const calendarData = rawCalendarData || null;

                const allStatuses = propstatArray
                    .map((ps) => ps.status || '')
                    .join(' ');
                const status =
                    response.status ||
                    allStatuses ||
                    response.propstat?.status ||
                    '';

                if (status && status.includes('404')) {
                    changedTasks.push({
                        action: 'delete',
                        href,
                        etag,
                    });
                    continue;
                }

                if (!calendarData) {
                    const taskUrl = resolveRemoteHref(remoteCalendar, href);
                    const taskData = await this._fetchTaskData(
                        taskUrl,
                        remoteCalendar,
                        userTimezone
                    );
                    if (taskData) {
                        changedTasks.push(taskData);
                    }
                    continue;
                }

                const taskData = await parseVTODOToTask(
                    calendarData,
                    userTimezone
                );
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

        if (fullListing && parsed?.multistatus) {
            changedTasks.push(
                ...(await this._findRemoteDeletions(calendar, listedHrefs))
            );
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

    async _fetchTaskData(taskUrl, remoteCalendar, userTimezone) {
        try {
            const password = encryptionService.decrypt(
                remoteCalendar.password_encrypted
            );

            const response = await safeRequest({
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
            const taskData = await parseVTODOToTask(
                response.data,
                userTimezone
            );

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

    // A calendar-query lists what exists and says nothing about what is gone,
    // and Radicale never hands out a sync-token in its reply, so the
    // sync-collection path (which does report deletions) was never taken. A
    // task deleted in another client therefore stayed in Tududi for good
    // (#1822). Anything we have a remote href for that the server no longer
    // lists has been deleted there.
    async _findRemoteDeletions(calendar, listedHrefs) {
        const listed = new Set(listedHrefs.map(this._hrefKey));

        const syncStates = await SyncStateRepository.findByCalendarId(
            calendar.id
        );

        const deletions = [];
        for (const state of syncStates) {
            if (!state.remote_href) {
                continue;
            }
            if (listed.has(this._hrefKey(state.remote_href))) {
                continue;
            }
            deletions.push({ action: 'delete', href: state.remote_href });
        }

        if (deletions.length > 0) {
            logger.logInfo(
                `${deletions.length} task(s) no longer on the remote calendar ${calendar.id}`
            );
        }

        return deletions;
    }

    // Servers and clients do not agree on percent-encoding in hrefs, and a
    // mismatch here must never read as a deletion.
    _hrefKey(href) {
        const normalized = normalizeHref(href) || '';
        try {
            return decodeURIComponent(normalized);
        } catch {
            return normalized;
        }
    }

    _stripNamespace(name) {
        return name.replace(/^.*:/, '');
    }
}

module.exports = PullPhase;
