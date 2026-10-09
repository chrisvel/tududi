import type { TFunction } from 'i18next';

// The four starters on the welcome screen. Copy lives in the translation
// files; this file holds the shape and the keys. buildStarterPayload turns a
// starter into the structure POST /api/onboarding/starter accepts, with
// every string resolved in the user's language.

export type StarterKey =
    'household' | 'work-side' | 'studying' | 'simple' | 'empty';

// Relative to the day the starter is applied, resolved on the server in the
// user's timezone: today, tomorrow, +Nd, a weekday (the next one, today
// included) or next-week.
type Due =
    | 'today'
    | 'tomorrow'
    | 'next-week'
    | 'mon'
    | 'tue'
    | 'wed'
    | 'thu'
    | 'fri'
    | 'sat'
    | 'sun'
    | `+${number}d`;

export interface StarterTask {
    name: string;
    due: Due | null;
    tags: string[];
}

export interface StarterProject {
    name: string;
    tasks: StarterTask[];
}

export interface StarterArea {
    name: string;
    color: string;
    goal: { title: string; horizon: 'season' | 'year' } | null;
    projects: StarterProject[];
    tasks: StarterTask[];
}

export interface StarterHabit {
    name: string;
    period: 'daily' | 'weekly';
    days: number[] | null;
}

export interface Starter {
    key: StarterKey;
    name: string;
    who: string;
    areas: StarterArea[];
    habits: StarterHabit[];
    note: { title: string; content: string } | null;
}

export interface StarterPayload {
    key: StarterKey;
    areas: StarterArea[];
    habits: StarterHabit[];
    note: { title: string; content: string } | null;
}

export const STARTER_KEYS: StarterKey[] = [
    'household',
    'work-side',
    'studying',
    'simple',
];

// Tailwind's 600 shades, the same family the area colour picker offers.
const COLORS = {
    green: '#16a34a',
    amber: '#d97706',
    blue: '#2563eb',
    purple: '#7c3aed',
};

const task = (name: string, due: Due | null = null, tags: string[] = []) => ({
    name,
    due,
    tags,
});

const noteContent = (t: TFunction) =>
    [
        t(
            'onboarding.starter.note.intro',
            'tududi has three shelves. Areas are the parts of your life. Projects are the things with an end, and they live in an area. Tasks are the next steps, and they live in a project or on their own.'
        ),
        '',
        t(
            'onboarding.starter.note.today',
            'Every morning, open Today and press Plan my day. Pick what fits, give it a time if you like, and start the day.'
        ),
        '',
        t(
            'onboarding.starter.note.examples',
            'The tasks marked as examples are here to show the shape. Finish them, change them, or remove them all from Today in one click.'
        ),
        '',
        t(
            'onboarding.starter.note.brainDump',
            'Anything else on your mind goes in through Brain dump, under your avatar, one thing per line.'
        ),
    ].join('\n');

export const buildStarters = (t: TFunction): Starter[] => {
    const note = {
        title: t('onboarding.starter.note.title', 'How this is set up'),
        content: noteContent(t),
    };

    return [
        {
            key: 'household',
            name: t('onboarding.starter.household.name', 'Running a household'),
            who: t(
                'onboarding.starter.household.who',
                'Career plus family, and the calendar lives in your head'
            ),
            areas: [
                {
                    name: t('onboarding.starter.household.areaHome', 'Home'),
                    color: COLORS.green,
                    goal: {
                        title: t(
                            'onboarding.starter.household.goalHome',
                            'A calmer Sunday evening'
                        ),
                        horizon: 'season',
                    },
                    projects: [
                        {
                            name: t(
                                'onboarding.starter.household.projectHome',
                                'Fix-ups around the house'
                            ),
                            tasks: [
                                task(
                                    t(
                                        'onboarding.starter.household.taskTap',
                                        'Fix the kitchen tap'
                                    ),
                                    'sat',
                                    ['home']
                                ),
                            ],
                        },
                    ],
                    tasks: [
                        task(
                            t(
                                'onboarding.starter.household.taskDentist',
                                'Call the dentist'
                            ),
                            'today',
                            ['home']
                        ),
                    ],
                },
                {
                    name: t('onboarding.starter.household.areaKids', 'Kids'),
                    color: COLORS.amber,
                    goal: {
                        title: t(
                            'onboarding.starter.household.goalKids',
                            'Nothing from school catches us by surprise'
                        ),
                        horizon: 'season',
                    },
                    projects: [
                        {
                            name: t(
                                'onboarding.starter.household.projectKids',
                                'School year'
                            ),
                            tasks: [
                                task(
                                    t(
                                        'onboarding.starter.household.taskSwimming',
                                        'Book the swimming lesson'
                                    ),
                                    'today'
                                ),
                            ],
                        },
                    ],
                    tasks: [],
                },
                {
                    name: t('onboarding.starter.household.areaMoney', 'Money'),
                    color: COLORS.blue,
                    goal: {
                        title: t(
                            'onboarding.starter.household.goalMoney',
                            'Know where it goes each month'
                        ),
                        horizon: 'season',
                    },
                    projects: [
                        {
                            name: t(
                                'onboarding.starter.household.projectMoney',
                                'Monthly money check'
                            ),
                            tasks: [
                                task(
                                    t(
                                        'onboarding.starter.household.taskInvoice',
                                        'Pay the nursery invoice'
                                    ),
                                    'tomorrow',
                                    ['money']
                                ),
                            ],
                        },
                    ],
                    tasks: [],
                },
                {
                    name: t('onboarding.starter.household.areaMe', 'Me'),
                    color: COLORS.purple,
                    goal: {
                        title: t(
                            'onboarding.starter.household.goalMe',
                            'An hour a week that is only mine'
                        ),
                        horizon: 'season',
                    },
                    projects: [],
                    tasks: [
                        task(
                            t(
                                'onboarding.starter.household.taskBook',
                                'Thirty minutes with a book'
                            ),
                            'sat'
                        ),
                    ],
                },
            ],
            habits: [
                {
                    name: t(
                        'onboarding.starter.household.habitReview',
                        'Sunday weekly review'
                    ),
                    period: 'weekly',
                    days: [0],
                },
                {
                    name: t(
                        'onboarding.starter.household.habitTidy',
                        'Evening tidy, 10 minutes'
                    ),
                    period: 'daily',
                    days: null,
                },
            ],
            note,
        },
        {
            key: 'work-side',
            name: t(
                'onboarding.starter.workSide.name',
                'Work and a side project'
            ),
            who: t(
                'onboarding.starter.workSide.who',
                'A day job, then the thing you build in the evenings'
            ),
            areas: [
                {
                    name: t('onboarding.starter.workSide.areaWork', 'Work'),
                    color: COLORS.blue,
                    goal: {
                        title: t(
                            'onboarding.starter.workSide.goalWork',
                            'Leave work at work'
                        ),
                        horizon: 'season',
                    },
                    projects: [
                        {
                            name: t(
                                'onboarding.starter.workSide.projectWork',
                                'Q4 planning'
                            ),
                            tasks: [
                                task(
                                    t(
                                        'onboarding.starter.workSide.taskBudget',
                                        'Draft the Q4 budget'
                                    ),
                                    'today',
                                    ['deep-work']
                                ),
                            ],
                        },
                    ],
                    tasks: [],
                },
                {
                    name: t(
                        'onboarding.starter.workSide.areaSide',
                        'Side project'
                    ),
                    color: COLORS.purple,
                    goal: {
                        title: t(
                            'onboarding.starter.workSide.goalSide',
                            'Ship v1 to ten real people'
                        ),
                        horizon: 'season',
                    },
                    projects: [
                        {
                            name: t(
                                'onboarding.starter.workSide.projectSide',
                                'Launch v1'
                            ),
                            tasks: [
                                task(
                                    t(
                                        'onboarding.starter.workSide.taskCopy',
                                        'Write the landing page copy'
                                    ),
                                    'tomorrow'
                                ),
                                task(
                                    t(
                                        'onboarding.starter.workSide.taskBeta',
                                        'Ask three people to try the beta'
                                    ),
                                    'fri'
                                ),
                            ],
                        },
                    ],
                    tasks: [],
                },
                {
                    name: t('onboarding.starter.workSide.areaHealth', 'Health'),
                    color: COLORS.green,
                    goal: {
                        title: t(
                            'onboarding.starter.workSide.goalHealth',
                            'Move every day'
                        ),
                        horizon: 'year',
                    },
                    projects: [],
                    tasks: [
                        task(
                            t(
                                'onboarding.starter.workSide.taskEyeTest',
                                'Book the eye test'
                            ),
                            'next-week'
                        ),
                    ],
                },
            ],
            habits: [
                {
                    name: t(
                        'onboarding.starter.workSide.habitShip',
                        'Ship something small'
                    ),
                    period: 'daily',
                    days: [1, 2, 3, 4, 5],
                },
                {
                    name: t(
                        'onboarding.starter.workSide.habitWalk',
                        'Walk 30 minutes'
                    ),
                    period: 'daily',
                    days: null,
                },
            ],
            note,
        },
        {
            key: 'studying',
            name: t('onboarding.starter.studying.name', 'Studying'),
            who: t(
                'onboarding.starter.studying.who',
                'Courses, deadlines, a part-time job'
            ),
            areas: [
                {
                    name: t('onboarding.starter.studying.areaUni', 'Uni'),
                    color: COLORS.blue,
                    goal: {
                        title: t(
                            'onboarding.starter.studying.goalUni',
                            'Submit the thesis draft by December'
                        ),
                        horizon: 'season',
                    },
                    projects: [
                        {
                            name: t(
                                'onboarding.starter.studying.projectThesis',
                                'Thesis'
                            ),
                            tasks: [
                                task(
                                    t(
                                        'onboarding.starter.studying.taskChapter',
                                        'Read chapter 4 and make notes'
                                    ),
                                    'today'
                                ),
                                task(
                                    t(
                                        'onboarding.starter.studying.taskSupervisor',
                                        'Email the supervisor about the outline'
                                    ),
                                    'tomorrow'
                                ),
                            ],
                        },
                    ],
                    tasks: [],
                },
                {
                    name: t('onboarding.starter.studying.areaWork', 'Work'),
                    color: COLORS.amber,
                    goal: null,
                    projects: [],
                    tasks: [
                        task(
                            t(
                                'onboarding.starter.studying.taskShifts',
                                "Pick up next week's shift schedule"
                            ),
                            'fri'
                        ),
                    ],
                },
                {
                    name: t('onboarding.starter.studying.areaLife', 'Life'),
                    color: COLORS.green,
                    goal: {
                        title: t(
                            'onboarding.starter.studying.goalLife',
                            'Sleep before midnight'
                        ),
                        horizon: 'season',
                    },
                    projects: [],
                    tasks: [
                        task(
                            t(
                                'onboarding.starter.studying.taskLaundry',
                                'Laundry'
                            ),
                            'sun'
                        ),
                    ],
                },
            ],
            habits: [
                {
                    name: t(
                        'onboarding.starter.studying.habitRead',
                        'Read 20 minutes'
                    ),
                    period: 'daily',
                    days: null,
                },
                {
                    name: t(
                        'onboarding.starter.studying.habitReview',
                        'Weekly review'
                    ),
                    period: 'weekly',
                    days: [0],
                },
            ],
            note,
        },
        {
            key: 'simple',
            name: t(
                'onboarding.starter.simple.name',
                'Just me, keep it simple'
            ),
            who: t(
                'onboarding.starter.simple.who',
                'One list and a plan for today. Nothing else yet.'
            ),
            areas: [],
            habits: [
                {
                    name: t(
                        'onboarding.starter.simple.habitWalk',
                        'Morning walk'
                    ),
                    period: 'daily',
                    days: null,
                },
            ],
            note: null,
        },
    ];
};

export const buildStarterPayload = (starter: Starter): StarterPayload => ({
    key: starter.key,
    areas: starter.areas,
    habits: starter.habits,
    note: starter.note,
});

export const starterCounts = (starter: Starter) => {
    let projects = 0;
    let tasks = 0;
    for (const area of starter.areas) {
        projects += area.projects.length;
        tasks += area.tasks.length;
        for (const project of area.projects) tasks += project.tasks.length;
    }
    return {
        areas: starter.areas.length,
        projects,
        tasks,
        habits: starter.habits.length,
    };
};
