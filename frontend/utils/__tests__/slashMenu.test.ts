import {
    applySlashItem,
    slashItems,
    slashQuery,
    slashTriggerAt,
    SlashContext,
} from '../slashMenu';

const labels = {
    tag: 'Tag',
    project: 'Project',
    person: 'Person',
    area: 'Area',
    date: 'Due date',
    repeat: 'Repeat',
    today: 'Today',
    tomorrow: 'Tomorrow',
    nextMonday: 'Next Monday',
    inAWeek: 'In a week',
    everyDay: 'Every day',
    everyWeekday: 'Every weekday',
    everyWeek: 'Every week',
    everyMonth: 'Every month',
    create: (token: string) => `Create ${token}`,
};

const ctx = (over: Partial<SlashContext> = {}): SlashContext => ({
    target: 'task',
    labels,
    tags: ['urgent', 'deep work', 'home'],
    projects: ['Launch', 'Home Reno'],
    areas: ['Work', 'Home Office'],
    people: ['Maria Lopez'],
    ...over,
});

describe('slashTriggerAt', () => {
    it('opens at the start of the text and after whitespace', () => {
        expect(slashTriggerAt('/', 1)).toEqual({
            start: 0,
            stage: 'root',
            trigger: '/',
        });
        expect(slashTriggerAt('Call Sam /', 10)?.start).toBe(9);
        expect(slashTriggerAt('line one\n/', 10)?.start).toBe(9);
    });

    it('opens the area list straight away for "~" at the start of a word', () => {
        expect(slashTriggerAt('Plan ~', 6)).toEqual({
            start: 5,
            stage: 'area',
            trigger: '~',
        });
        expect(slashTriggerAt('about~', 6)).toBeNull();
    });

    it('leaves URLs, fractions and and/or alone', () => {
        expect(slashTriggerAt('https://', 7)).toBeNull();
        expect(slashTriggerAt('1/', 2)).toBeNull();
        expect(slashTriggerAt('and/', 4)).toBeNull();
        expect(slashTriggerAt('abc', 3)).toBeNull();
    });
});

describe('slashQuery', () => {
    const root = { start: 0, stage: 'root' as const, trigger: '/' as const };

    it('returns what follows the slash', () => {
        expect(slashQuery('/pro', 4, root)).toBe('pro');
    });

    it('ends when the slash is gone, the caret left it, or the root got a space', () => {
        expect(slashQuery('pro', 3, root)).toBeNull();
        expect(slashQuery('/pro', 0, root)).toBeNull();
        expect(slashQuery('/pro ject', 9, root)).toBeNull();
    });

    it('lets a value list take spaces', () => {
        expect(
            slashQuery('~home of', 8, { start: 0, stage: 'area', trigger: '~' })
        ).toBe('home of');
    });
});

describe('slashItems', () => {
    it('lists the tokens that apply to what is being added', () => {
        const keys = (target: SlashContext['target']) =>
            slashItems('root', '', ctx({ target })).map((i) => i.opens);

        expect(keys('task')).toEqual([
            'tag',
            'project',
            'person',
            'area',
            'date',
            'repeat',
        ]);
        expect(keys('note')).toEqual(['tag', 'project']);
        expect(keys('project')).toEqual(['tag', 'area', 'date']);
    });

    it('filters the root by what was typed', () => {
        expect(slashItems('root', 'pro', ctx()).map((i) => i.opens)).toEqual([
            'project',
        ]);
    });

    it('quotes names with spaces and offers to create a new tag', () => {
        const area = slashItems('area', 'home', ctx());
        expect(area).toEqual([
            expect.objectContaining({ insert: '~"Home Office"' }),
        ]);

        const tag = slashItems('tag', 'brand-new', ctx());
        expect(tag).toEqual([
            expect.objectContaining({
                label: 'Create #brand-new',
                insert: '#brand-new',
            }),
        ]);
    });

    it('skips tags that cannot be typed as #tag and never creates people or areas', () => {
        // "deep work" has a space, so only "create #deep" is left
        expect(slashItems('tag', 'deep', ctx()).map((i) => i.insert)).toEqual([
            '#deep',
        ]);
        expect(slashItems('area', 'Nowhere', ctx())).toEqual([]);
        expect(slashItems('person', 'Nobody', ctx())).toEqual([]);
    });

    it('does not offer to create what already exists', () => {
        const items = slashItems('project', 'launch', ctx());
        expect(items.map((i) => i.insert)).toEqual(['+Launch']);
    });

    it('sorts values alphabetically, ignoring case', () => {
        const names = (stage: 'tag' | 'project' | 'area') =>
            slashItems(
                stage,
                '',
                ctx({
                    tags: ['zeta', 'Alpha', 'beta'],
                    projects: ['Zoo', 'apple', 'Mango'],
                    areas: ['work', 'Home', 'Errands'],
                })
            ).map((i) => i.label);

        expect(names('tag')).toEqual(['Alpha', 'beta', 'zeta']);
        expect(names('project')).toEqual(['apple', 'Mango', 'Zoo']);
        expect(names('area')).toEqual(['Errands', 'Home', 'work']);
    });
});

describe('applySlashItem', () => {
    it('opens a list by leaving a bare slash for the next filter', () => {
        const result = applySlashItem(
            'Call Sam /pro',
            { start: 9, stage: 'root', trigger: '/' },
            13,
            {
                key: 'root:project',
                label: 'Project',
                icon: 'project',
                opens: 'project',
            }
        );
        expect(result).toEqual({
            text: 'Call Sam /',
            cursor: 10,
            next: { start: 9, stage: 'project', trigger: '/' },
        });
    });

    it('inserts the token and a space, keeping text after the caret', () => {
        const result = applySlashItem(
            'Call /ma later',
            { start: 5, stage: 'person', trigger: '/' },
            8,
            {
                key: 'person:Maria',
                label: 'Maria',
                icon: 'person',
                insert: '@Maria',
            }
        );
        expect(result.text).toBe('Call @Maria later');
        expect(result.cursor).toBe(12);
        expect(result.next).toBeNull();
    });
});
