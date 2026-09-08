'use strict';

// The contents of the demo sandbox. Small on purpose: enough that every
// part of the app has something in it and the Today view is not empty,
// little enough that a reset is quick and a visitor is not lost.
//
// Dates are relative to the reset, so the demo always looks current rather
// than like an archive from whenever it was written.

const dayMs = 24 * 60 * 60 * 1000;
const at = (days, hour = 9) => {
    const d = new Date(Date.now() + days * dayMs);
    d.setHours(hour, 0, 0, 0);
    return d;
};

const AREAS = [
    {
        name: 'Work',
        description: 'Everything with a deadline someone else set',
    },
    { name: 'Home', description: 'The house, the paperwork, the car' },
    { name: 'Learning', description: 'Things worth getting better at' },
];

const PROJECTS = [
    {
        name: 'Website redesign',
        area: 'Work',
        description: 'New marketing site, copy and build',
    },
    {
        name: 'Q4 planning',
        area: 'Work',
        description: 'Targets and hiring for the quarter',
    },
    {
        name: 'Kitchen renovation',
        area: 'Home',
        description: 'Quotes, dates, decisions',
    },
    {
        name: 'Learn Portuguese',
        area: 'Learning',
        description: 'Two lessons a week, no excuses',
    },
];

const TAGS = ['urgent', 'waiting', 'quick-win', 'reading'];

// [name, project, dueInDays (null = someday), priority, status, tags]
// status: 0 not started, 1 in progress, 2 done
const TASKS = [
    [
        'Send the homepage copy to review',
        'Website redesign',
        -2,
        2,
        1,
        ['urgent'],
    ],
    ['Pick a font pairing', 'Website redesign', 0, 1, 0, []],
    ['Compress the hero images', 'Website redesign', 0, 0, 0, ['quick-win']],
    ['Write the pricing section', 'Website redesign', 2, 1, 0, []],
    ['Book the photographer', 'Website redesign', 5, 0, 0, ['waiting']],
    ['Draft the hiring plan', 'Q4 planning', -1, 2, 1, ['urgent']],
    ['Confirm the budget with finance', 'Q4 planning', 1, 1, 0, ['waiting']],
    ['Write the quarterly summary', 'Q4 planning', 7, 0, 0, []],
    ['Get a third quote for the worktop', 'Kitchen renovation', 0, 1, 0, []],
    ['Measure the alcove', 'Kitchen renovation', 3, 0, 0, ['quick-win']],
    [
        'Chase the plumber',
        'Kitchen renovation',
        -3,
        2,
        0,
        ['urgent', 'waiting'],
    ],
    ['Book two lessons for next week', 'Learn Portuguese', 1, 0, 0, []],
    ['Finish chapter 4 exercises', 'Learn Portuguese', 4, 0, 0, ['reading']],
    ['Read the article on spaced repetition', null, null, 0, 0, ['reading']],
    ['Renew the car insurance', null, 6, 1, 0, []],
    ['Cancel the unused subscription', null, null, 0, 0, ['quick-win']],
    ['Reply to the accountant', null, -1, 1, 2, []],
    ['Order the replacement cable', null, -4, 0, 2, ['quick-win']],
];

const NOTES = [
    {
        title: 'Homepage copy, second pass',
        project: 'Website redesign',
        content:
            'Lead with the problem, not the feature list.\n\n- One sentence on what it is\n- One on who it is for\n- Proof before the price\n\nThe old page spent three paragraphs before saying what the product does.',
    },
    {
        title: 'Kitchen: what the quotes actually include',
        project: 'Kitchen renovation',
        content:
            'Quote A is cheaper but excludes the worktop and the waste run.\nQuote B includes both and a two-year guarantee.\n\nAsk C whether the price covers making good the plaster.',
    },
    {
        title: 'Portuguese: verbs that keep catching me out',
        project: 'Learn Portuguese',
        content:
            'ser vs estar, ficar, ir + infinitive for the near future.\n\nDrill these before the next lesson.',
    },
];

const INBOX = [
    'Look into the standing desk everyone keeps mentioning',
    'Ask about the cycle to work scheme',
    'Someone recommended a book on estimation, find the title',
];

async function seedDemoData(userId, models) {
    const { Area, Project, Task, Note, Tag, InboxItem } = models;

    const areas = {};
    for (const a of AREAS) {
        areas[a.name] = await Area.create({
            name: a.name,
            description: a.description,
            user_id: userId,
        });
    }

    const tags = {};
    for (const name of TAGS) {
        tags[name] = await Tag.create({ name, user_id: userId });
    }

    const projects = {};
    for (const p of PROJECTS) {
        projects[p.name] = await Project.create({
            name: p.name,
            description: p.description,
            area_id: areas[p.area]?.id || null,
            user_id: userId,
        });
    }

    for (const [name, project, due, priority, status, taskTags] of TASKS) {
        const task = await Task.create({
            name,
            user_id: userId,
            project_id: project ? projects[project].id : null,
            due_date: due === null ? null : at(due),
            priority,
            status,
            completed_at: status === 2 ? at(-1, 17) : null,
        });
        if (taskTags.length) {
            await task.setTags(taskTags.map((t) => tags[t].id));
        }
    }

    for (const n of NOTES) {
        const note = await Note.create({
            title: n.title,
            content: n.content,
            user_id: userId,
            project_id: n.project ? projects[n.project].id : null,
        });
        if (n.title.includes('Portuguese')) {
            await note.setTags([tags.reading.id]);
        }
    }

    for (const content of INBOX) {
        await InboxItem.create({
            content,
            user_id: userId,
            status: 'added',
            source: 'manual',
        });
    }
}

module.exports = { seedDemoData };
