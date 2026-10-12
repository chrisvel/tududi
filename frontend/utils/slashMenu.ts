import type { CaptureTarget } from './captureText';

// The "/" menu of the capture box: typing "/" at the start of a word lists
// the tokens the box understands (#tag, +project, @person, ~area, a due
// date, a repeat). Picking one either opens that token's list of values or
// inserts the token's text, so nobody has to remember the syntax.

export type SlashStage =
    'root' | 'tag' | 'project' | 'person' | 'area' | 'date' | 'repeat';

export interface SlashMenuState {
    // Index of the "/" or "~" in the text
    start: number;
    stage: SlashStage;
    trigger: '/' | '~';
}

export type SlashIcon =
    'tag' | 'project' | 'person' | 'area' | 'date' | 'repeat' | 'create';

export interface SlashItem {
    key: string;
    // What the user reads
    label: string;
    // The syntax or phrase the item stands for, shown under the label
    description?: string;
    icon: SlashIcon;
    // Text that replaces "/query" when the item is picked
    insert?: string;
    // The list the item opens instead of inserting anything
    opens?: SlashStage;
}

export interface SlashLabels {
    tag: string;
    project: string;
    person: string;
    area: string;
    date: string;
    repeat: string;
    today: string;
    tomorrow: string;
    nextMonday: string;
    inAWeek: string;
    everyDay: string;
    everyWeekday: string;
    everyWeek: string;
    everyMonth: string;
    create: (token: string) => string;
}

export interface SlashContext {
    target: CaptureTarget;
    labels: SlashLabels;
    tags: string[];
    projects: string[];
    areas: string[];
    people: string[];
}

const MAX_ITEMS = 8;
const TAG_NAME = /^[A-Za-z0-9_-]+$/;

// Where a "/" typed at the cursor starts a menu: at the very start of the
// text or after whitespace, so URLs, "and/or" and "1/2" are left alone.
// A "~" there opens the area list straight away, the way "#" and "+" do
// for tags and projects.
export const slashTriggerAt = (
    text: string,
    cursor: number
): SlashMenuState | null => {
    const char = text.charAt(cursor - 1);
    if (cursor < 1 || (char !== '/' && char !== '~')) return null;
    const before = cursor - 2;
    if (before >= 0 && !/\s/.test(text.charAt(before))) return null;
    return {
        start: cursor - 1,
        stage: char === '/' ? 'root' : 'area',
        trigger: char,
    };
};

// The text typed after the "/", or null when the menu no longer applies
// (the "/" was deleted, the caret left it, or the root list was given a
// space, which means the user is just writing).
export const slashQuery = (
    text: string,
    cursor: number,
    menu: SlashMenuState
): string | null => {
    if (text.charAt(menu.start) !== menu.trigger || cursor <= menu.start) {
        return null;
    }
    const query = text.slice(menu.start + 1, cursor);
    if (/\n/.test(query)) return null;
    if (menu.stage === 'root' && /\s/.test(query)) return null;
    return query;
};

const quoted = (name: string) => (/\s/.test(name) ? `"${name}"` : name);

const matches = (name: string, query: string) =>
    name.toLowerCase().includes(query.trim().toLowerCase());

const valueItems = (
    stage: 'tag' | 'project' | 'person' | 'area',
    prefix: string,
    names: string[],
    query: string,
    labels: SlashLabels,
    canCreate: boolean
): SlashItem[] => {
    const usable =
        stage === 'tag' ? names.filter((n) => TAG_NAME.test(n)) : names;
    const items: SlashItem[] = [...usable]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .filter((name) => matches(name, query))
        .slice(0, MAX_ITEMS)
        .map((name) => ({
            key: `${stage}:${name}`,
            label: name,
            icon: stage,
            insert: `${prefix}${stage === 'tag' ? name : quoted(name)}`,
        }));

    const wanted = query.trim();
    const exists = usable.some(
        (name) => name.toLowerCase() === wanted.toLowerCase()
    );
    const valid = stage === 'tag' ? TAG_NAME.test(wanted) : wanted !== '';
    if (canCreate && wanted && valid && !exists) {
        const token = `${prefix}${stage === 'tag' ? wanted : quoted(wanted)}`;
        items.push({
            key: `${stage}:new`,
            label: labels.create(token),
            icon: 'create',
            insert: token,
        });
    }
    return items;
};

// Which tokens make sense for what is being added. An Inbox item keeps the
// text as typed and reads the tokens when it is converted, so it gets all.
const rootFor = (target: CaptureTarget, labels: SlashLabels): SlashItem[] => {
    const all: Array<
        [Exclude<SlashStage, 'root'>, string, string, CaptureTarget[]]
    > = [
        ['tag', labels.tag, '#tag', ['inbox', 'task', 'note', 'project']],
        ['project', labels.project, '+project', ['inbox', 'task', 'note']],
        ['person', labels.person, '@name', ['inbox', 'task']],
        ['area', labels.area, '~area', ['inbox', 'task', 'project']],
        ['date', labels.date, 'tomorrow', ['inbox', 'task', 'project']],
        ['repeat', labels.repeat, 'every week', ['inbox', 'task']],
    ];
    return all
        .filter(([, , , targets]) => targets.includes(target))
        .map(([stage, label, description]) => ({
            key: `root:${stage}`,
            label,
            description,
            icon: stage,
            opens: stage,
        }));
};

// Ready-made phrases the due date and recurrence parsers understand
const phraseItems = (
    icon: 'date' | 'repeat',
    phrases: Array<[string, string, string]>,
    query: string
): SlashItem[] =>
    phrases
        .filter(([, label]) => matches(label, query))
        .map(([key, label, insert]) => ({
            key: `${icon}:${key}`,
            label,
            description: insert,
            icon,
            insert,
        }));

export const slashItems = (
    stage: SlashStage,
    query: string,
    ctx: SlashContext
): SlashItem[] => {
    const { labels } = ctx;
    switch (stage) {
        case 'root': {
            const items = rootFor(ctx.target, labels);
            return query
                ? items.filter((item) => matches(item.label, query))
                : items;
        }
        case 'tag':
            return valueItems('tag', '#', ctx.tags, query, labels, true);
        case 'project':
            return valueItems(
                'project',
                '+',
                ctx.projects,
                query,
                labels,
                true
            );
        case 'person':
            return valueItems('person', '@', ctx.people, query, labels, false);
        case 'area':
            // Notes have no area, so a "~" there is just a character
            return ctx.target === 'note'
                ? []
                : valueItems('area', '~', ctx.areas, query, labels, false);
        case 'date':
            return phraseItems(
                'date',
                [
                    ['today', labels.today, 'today'],
                    ['tomorrow', labels.tomorrow, 'tomorrow'],
                    ['monday', labels.nextMonday, 'next monday'],
                    ['week', labels.inAWeek, 'in 1 week'],
                ],
                query
            );
        case 'repeat':
            return phraseItems(
                'repeat',
                [
                    ['day', labels.everyDay, 'every day'],
                    ['weekday', labels.everyWeekday, 'every weekday'],
                    ['week', labels.everyWeek, 'every week'],
                    ['month', labels.everyMonth, 'every month'],
                ],
                query
            );
    }
};

// What picking an item does to the text. `text`/`cursor` describe the box
// with "/query" still in it; `end` is the caret, after the query.
export const applySlashItem = (
    text: string,
    menu: SlashMenuState,
    end: number,
    item: SlashItem
): { text: string; cursor: number; next: SlashMenuState | null } => {
    const head = text.slice(0, menu.start);
    const tail = text.slice(end);

    if (item.opens) {
        // Keep a bare "/" so what is typed next filters the new list
        const next = head + '/' + tail;
        return {
            text: next,
            cursor: menu.start + 1,
            next: { start: menu.start, stage: item.opens, trigger: '/' },
        };
    }

    const insert = `${item.insert ?? ''} `;
    // Do not double the space when the text already goes on with one
    const rest = /^\s/.test(tail) ? tail.replace(/^\s/, '') : tail;
    return {
        text: head + insert + rest,
        cursor: head.length + insert.length,
        next: null,
    };
};
