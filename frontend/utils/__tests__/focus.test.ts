import {
    describeFocus,
    focusKey,
    focusScopeParams,
    appendFocusParams,
    isFocusDangling,
    mergeFocusTags,
    noteMatchesFocus,
    projectMatchesFocus,
    sanitizeFocus,
} from '../focus';
import type { Area } from '../../entities/Area';
import type { Project } from '../../entities/Project';

jest.mock('../profileService', () => ({
    updateUiSettings: jest.fn(),
}));

const areas = [
    { id: 1, uid: 'work', name: 'Work' },
    { id: 2, uid: 'home', name: 'Home' },
] as Area[];
const projects = [
    {
        id: 10,
        uid: 'launch',
        name: 'Launch',
        area_uid: 'work',
        tags: [{ name: 'q4' }],
    },
    { id: 11, uid: 'garden', name: 'Garden', area: { uid: 'home' } },
] as unknown as Project[];

describe('sanitizeFocus', () => {
    it('keeps only usable fields and drops an empty focus', () => {
        expect(sanitizeFocus(null)).toBeNull();
        expect(sanitizeFocus({})).toBeNull();
        expect(sanitizeFocus({ area_uid: '  ', tags: [] })).toBeNull();
        expect(
            sanitizeFocus({
                area_uid: ' work ',
                project_uid: 'launch',
                tags: ['a', ' a ', 'b', 3],
                extra: true,
            })
        ).toEqual({
            area_uid: 'work',
            project_uid: 'launch',
            tags: ['a', 'b'],
        });
    });
});

describe('scope params', () => {
    it('turns a focus into query params and a stable key', () => {
        const focus = { area_uid: 'work', tags: ['a', 'b'] };
        expect(focusScopeParams(focus)).toEqual({
            area_uid: 'work',
            tags: 'a,b',
        });
        expect(focusScopeParams(null)).toEqual({});
        expect(focusKey(focus)).toBe('work||a,b');
        expect(focusKey({ area_uid: 'work' })).toBe('work');
        expect(focusKey(null)).toBe('');

        const params = appendFocusParams(new URLSearchParams('type=today'), {
            project_uid: 'launch',
        });
        expect(params.toString()).toBe('type=today&project_uid=launch');
    });
});

describe('isFocusDangling', () => {
    it('flags a missing area, a missing project and a project outside the area', () => {
        expect(isFocusDangling({ area_uid: 'work' }, areas, projects)).toBe(
            false
        );
        expect(isFocusDangling({ area_uid: 'gone' }, areas, projects)).toBe(
            true
        );
        expect(isFocusDangling({ project_uid: 'nope' }, areas, projects)).toBe(
            true
        );
        expect(
            isFocusDangling(
                { area_uid: 'work', project_uid: 'garden' },
                areas,
                projects
            )
        ).toBe(true);
        expect(
            isFocusDangling(
                { area_uid: 'work', project_uid: 'launch' },
                areas,
                projects
            )
        ).toBe(false);
    });
});

describe('client-side matching', () => {
    it('matches projects by area, project and tags', () => {
        expect(projectMatchesFocus(projects[0], { area_uid: 'work' })).toBe(
            true
        );
        expect(projectMatchesFocus(projects[1], { area_uid: 'work' })).toBe(
            false
        );
        expect(projectMatchesFocus(projects[0], { tags: ['Q4'] })).toBe(true);
        expect(projectMatchesFocus(projects[0], { tags: ['q4', 'x'] })).toBe(
            false
        );
        expect(projectMatchesFocus(projects[0], null)).toBe(true);
    });

    it('matches notes through their project', () => {
        const note = { project: { uid: 'launch' }, tags: [{ name: 'idea' }] };
        expect(noteMatchesFocus(note, { area_uid: 'work' }, projects)).toBe(
            true
        );
        expect(noteMatchesFocus(note, { area_uid: 'home' }, projects)).toBe(
            false
        );
        expect(noteMatchesFocus({}, { area_uid: 'work' }, projects)).toBe(
            false
        );
        expect(
            noteMatchesFocus(
                note,
                { project_uid: 'launch', tags: ['idea'] },
                projects
            )
        ).toBe(true);
    });
});

describe('mergeFocusTags', () => {
    it('adds focus tags the text did not already carry', () => {
        expect(
            mergeFocusTags(['Urgent'], { tags: ['urgent', 'deep'] })
        ).toEqual(['Urgent', 'deep']);
        expect(mergeFocusTags(['a'], null)).toEqual(['a']);
    });
});

describe('describeFocus', () => {
    it('names the area, project and tags', () => {
        expect(
            describeFocus(
                { area_uid: 'work', project_uid: 'launch', tags: ['urgent'] },
                areas,
                projects
            )
        ).toBe('Work › Launch · #urgent');
        expect(describeFocus({ tags: ['a', 'b'] }, areas, projects)).toBe(
            '#a #b'
        );
        expect(describeFocus({ area_uid: 'gone' }, areas, projects)).toBe('…');
    });
});
