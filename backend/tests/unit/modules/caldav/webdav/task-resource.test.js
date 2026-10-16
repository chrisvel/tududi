jest.mock('../../../../../modules/tasks/repository', () => ({
    findByUidOrResourceName: jest.fn(),
}));
jest.mock('../../../../../modules/caldav/access', () => ({
    visibleTaskWhere: jest.fn(),
}));

const taskRepository = require('../../../../../modules/tasks/repository');
const { visibleTaskWhere } = require('../../../../../modules/caldav/access');
const {
    CALDAV_TASK_INCLUDES,
} = require('../../../../../modules/caldav/task-includes');
const {
    resourceNameFromParam,
    resourceNameFromHref,
    findTaskResource,
} = require('../../../../../modules/caldav/webdav/task-resource');

describe('resourceNameFromParam', () => {
    it('strips the .ics extension', () => {
        expect(resourceNameFromParam('1754712345678-9021.ics')).toBe(
            '1754712345678-9021'
        );
    });

    it('leaves a segment without the extension alone', () => {
        expect(resourceNameFromParam('1754712345678-9021')).toBe(
            '1754712345678-9021'
        );
    });

    it('only strips an extension at the end', () => {
        expect(resourceNameFromParam('a.ics.b.ics')).toBe('a.ics.b');
        expect(resourceNameFromParam('a.icsx')).toBe('a.icsx');
        expect(resourceNameFromParam('notes.txt')).toBe('notes.txt');
    });

    it('treats a missing segment as no name', () => {
        expect(resourceNameFromParam(undefined)).toBe('');
        expect(resourceNameFromParam('')).toBe('');
    });
});

describe('resourceNameFromHref', () => {
    it('decodes the segment, because an href is still URL-encoded', () => {
        expect(
            resourceNameFromHref('/caldav/me%40example.com/tasks/a%20b.ics')
        ).toBe('a b');
    });

    it('names the last segment', () => {
        expect(resourceNameFromHref('/caldav/me/tasks/one/two.ics')).toBe(
            'two'
        );
    });

    it('answers null for anything that is not a calendar object href', () => {
        expect(resourceNameFromHref('/caldav/me/tasks/')).toBeNull();
        expect(resourceNameFromHref('/caldav/me/tasks/notes.txt')).toBeNull();
        expect(resourceNameFromHref('')).toBeNull();
        expect(resourceNameFromHref(undefined)).toBeNull();
    });
});

describe('findTaskResource', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("asks for the task inside the caller's visibility", async () => {
        visibleTaskWhere.mockResolvedValue({ user_id: 7 });
        const task = { id: 1, uid: 'abc' };
        taskRepository.findByUidOrResourceName.mockResolvedValue(task);

        await expect(findTaskResource('abc', 7)).resolves.toBe(task);

        expect(visibleTaskWhere).toHaveBeenCalledWith(7);
        expect(taskRepository.findByUidOrResourceName).toHaveBeenCalledWith(
            'abc',
            expect.objectContaining({
                include: CALDAV_TASK_INCLUDES,
                where: { user_id: 7 },
            })
        );
    });

    it('does not query for a URL that names nothing', async () => {
        await expect(findTaskResource('', 7)).resolves.toBeNull();

        expect(taskRepository.findByUidOrResourceName).not.toHaveBeenCalled();
    });

    it('lets a caller ask for a different set of includes', async () => {
        visibleTaskWhere.mockResolvedValue({ user_id: 7 });
        taskRepository.findByUidOrResourceName.mockResolvedValue(null);

        await findTaskResource('abc', 7, { include: ['Project'] });

        expect(taskRepository.findByUidOrResourceName).toHaveBeenCalledWith(
            'abc',
            expect.objectContaining({ include: ['Project'] })
        );
    });
});
