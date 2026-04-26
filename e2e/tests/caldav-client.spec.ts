import { test, expect } from '@playwright/test';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

test.describe('CalDAV Client Compatibility', () => {
    const baseURL = process.env.APP_URL ?? 'http://localhost:8080';
    const apiURL = process.env.API_URL ?? 'http://localhost:3002';
    const testUser = {
        email: process.env.E2E_EMAIL || 'test@TaskNoteTaker.com',
        password: process.env.E2E_PASSWORD || 'password123',
        username: 'test'
    };

    let authHeader: string;

    test.beforeAll(async () => {
        authHeader = 'Basic ' + Buffer.from(`${testUser.email}:${testUser.password}`).toString('base64');
    });

    test.describe('CalDAV Discovery', () => {
        test('should redirect .well-known/caldav to /caldav/', async ({ request }) => {
            const response = await request.get(`${apiURL}/.well-known/caldav`, {
                maxRedirects: 0
            });

            expect([301, 302, 307, 308]).toContain(response.status());
            const location = response.headers()['location'];
            expect(location).toContain('/caldav');
        });

        test('should support OPTIONS on CalDAV endpoint', async ({ request }) => {
            const response = await request.fetch(`${apiURL}/caldav/${testUser.username}/tasks/`, {
                method: 'OPTIONS',
                headers: {
                    'Authorization': authHeader
                }
            });

            expect(response.ok()).toBeTruthy();
            const dav = response.headers()['dav'];
            expect(dav).toContain('calendar-access');
        });
    });

    test.describe('PROPFIND - List Tasks', () => {
        test('should list tasks in calendar collection', async ({ request }) => {
            const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
                <D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
                    <D:prop>
                        <D:resourcetype/>
                        <D:displayname/>
                        <D:getcontenttype/>
                        <D:getetag/>
                        <C:calendar-data/>
                    </D:prop>
                </D:propfind>`;

            const response = await request.fetch(`${apiURL}/caldav/${testUser.username}/tasks/`, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/xml',
                    'Depth': '1'
                },
                data: propfindBody
            });

            expect(response.status()).toBe(207);
            const body = await response.text();
            expect(body).toContain('multistatus');
        });

        test('should handle Depth: 0 for collection properties', async ({ request }) => {
            const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
                <D:propfind xmlns:D="DAV:">
                    <D:prop>
                        <D:displayname/>
                        <D:resourcetype/>
                    </D:prop>
                </D:propfind>`;

            const response = await request.fetch(`${apiURL}/caldav/${testUser.username}/tasks/`, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/xml',
                    'Depth': '0'
                },
                data: propfindBody
            });

            expect(response.status()).toBe(207);
            const body = await response.text();
            expect(body).toContain('collection');
        });
    });

    test.describe('REPORT - Calendar Query', () => {
        test('should query tasks with calendar-query REPORT', async ({ request }) => {
            const reportBody = `<?xml version="1.0" encoding="utf-8"?>
                <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
                    <D:prop>
                        <D:getetag/>
                        <C:calendar-data/>
                    </D:prop>
                    <C:filter>
                        <C:comp-filter name="VCALENDAR">
                            <C:comp-filter name="VTODO"/>
                        </C:comp-filter>
                    </C:filter>
                </C:calendar-query>`;

            const response = await request.fetch(`${apiURL}/caldav/${testUser.username}/tasks/`, {
                method: 'REPORT',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/xml',
                    'Depth': '1'
                },
                data: reportBody
            });

            expect(response.status()).toBe(207);
            const body = await response.text();
            expect(body).toContain('multistatus');
        });

        test('should filter tasks by time range', async ({ request }) => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 7);

            const reportBody = `<?xml version="1.0" encoding="utf-8"?>
                <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
                    <D:prop>
                        <D:getetag/>
                        <C:calendar-data/>
                    </D:prop>
                    <C:filter>
                        <C:comp-filter name="VCALENDAR">
                            <C:comp-filter name="VTODO">
                                <C:time-range start="${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z"
                                             end="${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z"/>
                            </C:comp-filter>
                        </C:comp-filter>
                    </C:filter>
                </C:calendar-query>`;

            const response = await request.fetch(`${apiURL}/caldav/${testUser.username}/tasks/`, {
                method: 'REPORT',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/xml',
                    'Depth': '1'
                },
                data: reportBody
            });

            expect(response.status()).toBe(207);
        });
    });

    test.describe('GET/PUT/DELETE - Task Operations', () => {
        let taskUID: string;

        test('should create task via PUT', async ({ request }) => {
            taskUID = `test-${Date.now()}@TaskNoteTaker.local`;
            const vtodo = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//E2E Test//EN
BEGIN:VTODO
UID:${taskUID}
SUMMARY:E2E Test Task
STATUS:NEEDS-ACTION
PRIORITY:5
DUE:${new Date(Date.now() + 86400000).toISOString().replace(/[-:]/g, '').split('.')[0]}Z
CREATED:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
END:VTODO
END:VCALENDAR`;

            const response = await request.put(`${apiURL}/caldav/${testUser.username}/tasks/${taskUID}/`, {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'text/calendar; charset=utf-8'
                },
                data: vtodo
            });

            expect([201, 204]).toContain(response.status());
            const etag = response.headers()['etag'];
            expect(etag).toBeTruthy();
        });

        test('should retrieve task via GET', async ({ request }) => {
            const response = await request.get(`${apiURL}/caldav/${testUser.username}/tasks/${taskUID}/`, {
                headers: {
                    'Authorization': authHeader
                }
            });

            expect(response.ok()).toBeTruthy();
            expect(response.headers()['content-type']).toContain('text/calendar');
            const body = await response.text();
            expect(body).toContain('BEGIN:VCALENDAR');
            expect(body).toContain('BEGIN:VTODO');
            expect(body).toContain(`UID:${taskUID}`);
            expect(body).toContain('SUMMARY:E2E Test Task');
        });

        test('should update task via PUT', async ({ request }) => {
            const updatedVtodo = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//E2E Test//EN
BEGIN:VTODO
UID:${taskUID}
SUMMARY:Updated E2E Test Task
STATUS:IN-PROCESS
PRIORITY:3
DUE:${new Date(Date.now() + 86400000).toISOString().replace(/[-:]/g, '').split('.')[0]}Z
CREATED:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
LAST-MODIFIED:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
END:VTODO
END:VCALENDAR`;

            const response = await request.put(`${apiURL}/caldav/${testUser.username}/tasks/${taskUID}/`, {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'text/calendar; charset=utf-8'
                },
                data: updatedVtodo
            });

            expect([200, 204]).toContain(response.status());

            const getResponse = await request.get(`${apiURL}/caldav/${testUser.username}/tasks/${taskUID}/`, {
                headers: {
                    'Authorization': authHeader
                }
            });
            const body = await getResponse.text();
            expect(body).toContain('SUMMARY:Updated E2E Test Task');
            expect(body).toContain('STATUS:IN-PROCESS');
        });

        test('should delete task via DELETE', async ({ request }) => {
            const response = await request.delete(`${apiURL}/caldav/${testUser.username}/tasks/${taskUID}/`, {
                headers: {
                    'Authorization': authHeader
                }
            });

            expect([204, 200]).toContain(response.status());

            const getResponse = await request.get(`${apiURL}/caldav/${testUser.username}/tasks/${taskUID}/`, {
                headers: {
                    'Authorization': authHeader
                },
                maxRedirects: 0
            });
            expect(getResponse.status()).toBe(404);
        });
    });

    test.describe('Recurring Tasks', () => {
        let recurringUID: string;

        test('should create recurring task with RRULE', async ({ request }) => {
            recurringUID = `recurring-${Date.now()}@TaskNoteTaker.local`;
            const vtodo = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//E2E Test//EN
BEGIN:VTODO
UID:${recurringUID}
SUMMARY:Daily Recurring Task
STATUS:NEEDS-ACTION
RRULE:FREQ=DAILY;COUNT=7
DUE:${new Date(Date.now() + 86400000).toISOString().replace(/[-:]/g, '').split('.')[0]}Z
CREATED:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
END:VTODO
END:VCALENDAR`;

            const response = await request.put(`${apiURL}/caldav/${testUser.username}/tasks/${recurringUID}/`, {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'text/calendar; charset=utf-8'
                },
                data: vtodo
            });

            expect([201, 204]).toContain(response.status());
        });

        test('should expand recurring task instances in PROPFIND', async ({ request }) => {
            const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
                <D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
                    <D:prop>
                        <D:getetag/>
                        <C:calendar-data/>
                    </D:prop>
                </D:propfind>`;

            const response = await request.fetch(`${apiURL}/caldav/${testUser.username}/tasks/`, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/xml',
                    'Depth': '1'
                },
                data: propfindBody
            });

            expect(response.status()).toBe(207);
            const body = await response.text();
            expect(body).toContain(recurringUID);
        });

        test('should cleanup recurring task', async ({ request }) => {
            await request.delete(`${apiURL}/caldav/${testUser.username}/tasks/${recurringUID}/`, {
                headers: {
                    'Authorization': authHeader
                }
            });
        });
    });

    test.describe('Authentication', () => {
        test('should reject requests without authentication', async ({ request }) => {
            const response = await request.fetch(`${apiURL}/caldav/${testUser.username}/tasks/`, {
                method: 'PROPFIND',
                headers: {
                    'Content-Type': 'application/xml',
                    'Depth': '1'
                }
            });

            expect(response.status()).toBe(401);
            expect(response.headers()['www-authenticate']).toBeTruthy();
        });

        test('should reject invalid credentials', async ({ request }) => {
            const invalidAuth = 'Basic ' + Buffer.from('invalid:credentials').toString('base64');
            const response = await request.fetch(`${apiURL}/caldav/${testUser.username}/tasks/`, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': invalidAuth,
                    'Content-Type': 'application/xml',
                    'Depth': '1'
                }
            });

            expect(response.status()).toBe(401);
        });
    });

    test.describe('Performance', () => {
        test('should handle PROPFIND for large calendar efficiently', async ({ request }) => {
            const startTime = Date.now();

            const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
                <D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
                    <D:prop>
                        <D:getetag/>
                        <C:calendar-data/>
                    </D:prop>
                </D:propfind>`;

            const response = await request.fetch(`${apiURL}/caldav/${testUser.username}/tasks/`, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/xml',
                    'Depth': '1'
                },
                data: propfindBody
            });

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(response.status()).toBe(207);
            expect(duration).toBeLessThan(5000);
        });
    });

    test.describe('Edge Cases', () => {
        test('should handle malformed VTODO gracefully', async ({ request }) => {
            const malformedVtodo = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:malformed-${Date.now()}
SUMMARY:Malformed Task
THIS-IS-NOT-VALID:foo
END:VCALENDAR`;

            const response = await request.put(`${apiURL}/caldav/${testUser.username}/tasks/malformed-test/`, {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'text/calendar'
                },
                data: malformedVtodo
            });

            expect([400, 422]).toContain(response.status());
        });

        test('should preserve timezone information', async ({ request }) => {
            const tzUID = `tz-${Date.now()}@TaskNoteTaker.local`;
            const vtodo = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//E2E Test//EN
BEGIN:VTODO
UID:${tzUID}
SUMMARY:Timezone Test
DUE:20260420T140000Z
CREATED:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
END:VTODO
END:VCALENDAR`;

            const putResponse = await request.put(`${apiURL}/caldav/${testUser.username}/tasks/${tzUID}/`, {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'text/calendar'
                },
                data: vtodo
            });

            expect([201, 204]).toContain(putResponse.status());

            const getResponse = await request.get(`${apiURL}/caldav/${testUser.username}/tasks/${tzUID}/`, {
                headers: {
                    'Authorization': authHeader
                }
            });
            const body = await getResponse.text();
            expect(body).toContain('DUE:20260420T140000Z');

            await request.delete(`${apiURL}/caldav/${testUser.username}/tasks/${tzUID}/`, {
                headers: {
                    'Authorization': authHeader
                }
            });
        });
    });
});
