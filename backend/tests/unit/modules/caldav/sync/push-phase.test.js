jest.mock('../../../../../modules/caldav/services/safe-request', () => ({
    safeRequest: jest.fn(),
}));
jest.mock('../../../../../models', () => ({ Task: {} }));
jest.mock('../../../../../services/logService', () => ({
    logInfo: jest.fn(),
    logError: jest.fn(),
    logWarn: jest.fn(),
    logDebug: jest.fn(),
}));
jest.mock(
    '../../../../../modules/caldav/repositories/sync-state-repository',
    () => ({
        findByTaskAndCalendar: jest.fn(),
        createOrUpdate: jest.fn(),
    })
);
jest.mock(
    '../../../../../modules/caldav/repositories/remote-calendar-repository',
    () => ({})
);
jest.mock('../../../../../modules/caldav/icalendar/vtodo-serializer', () => ({
    serializeTaskToVTODO: jest.fn().mockResolvedValue('BEGIN:VCALENDAR'),
}));
jest.mock('../../../../../modules/caldav/services/encryption-service', () => ({
    decrypt: jest.fn().mockReturnValue('secret'),
}));

const {
    safeRequest,
} = require('../../../../../modules/caldav/services/safe-request');
const SyncStateRepository = require('../../../../../modules/caldav/repositories/sync-state-repository');
const PushPhase = require('../../../../../modules/caldav/sync/push-phase');

describe('PushPhase._pushTaskToRemote', () => {
    const task = { id: 1, uid: 'task-1' };
    const calendar = { id: 7 };
    const remoteCalendar = {
        server_url: 'http://radicale.test',
        calendar_path: '/user/cal/',
        username: 'user',
        password_encrypted: 'enc',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        safeRequest.mockResolvedValue({ headers: { etag: '"new-etag"' } });
    });

    it('sends the stored etag as a quoted entity-tag in If-Match', async () => {
        SyncStateRepository.findByTaskAndCalendar.mockResolvedValue({
            etag: '8b36704d1f6b',
            remote_href: '/user/cal/task-1.ics',
        });

        await new PushPhase()._pushTaskToRemote(
            task,
            remoteCalendar,
            calendar,
            false
        );

        const { headers, method } = safeRequest.mock.calls[0][0];
        expect(method).toBe('PUT');
        expect(headers['If-Match']).toBe('"8b36704d1f6b"');
    });

    it('sends no If-Match header when there is no stored etag', async () => {
        SyncStateRepository.findByTaskAndCalendar.mockResolvedValue(null);

        await new PushPhase()._pushTaskToRemote(
            task,
            remoteCalendar,
            calendar,
            false
        );

        const { headers } = safeRequest.mock.calls[0][0];
        expect(headers).not.toHaveProperty('If-Match');
    });
});
