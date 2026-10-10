'use strict';

// Ready-made messes for people who would rather not paste their own list
// into a phone they are being shown. Anyone can run these, signed in or
// not; the results are cached per day so a demo at a table is instant.
// The page shows the same text, served from the status endpoint.
const SAMPLES = [
    {
        key: 'family',
        label: 'Family week',
        text: [
            'school forms by friday!!',
            'dentist for Leo',
            'groceries - milk eggs the good bread',
            'call mum back',
            'pay nursery',
            'birthday party sat 3pm bring gift',
            'gym (ha)',
            'sort the garage someday',
            'book summer camp',
            'car service light is on',
            'date night??',
            'return library books',
        ].join('\n'),
    },
    {
        key: 'sideProject',
        label: 'Side project',
        text: [
            'launch the app finally',
            '- landing page',
            '- fix login bug',
            '- app store screenshots',
            'reply to Dan re pricing',
            'newsletter draft',
            'taxes deadline oct 31',
            'read that marketing book',
            'post updates 3x week',
            'find a designer',
            'renew domain',
        ].join('\n'),
    },
    {
        key: 'moving',
        label: 'Moving flat',
        text: [
            'moving nov 1!!!',
            'notice to landlord',
            'movers quotes x3',
            'change address bank post electricity',
            'pack books',
            'sell the sofa',
            'cleaning for deposit',
            'internet at new place',
            'ask Sara about the van',
            'find a vet nearby someday',
        ].join('\n'),
    },
    {
        key: 'exams',
        label: 'Exam season',
        text: [
            'stats exam nov 12',
            'essay draft due mon',
            'group project meet thu',
            'ask prof about extension',
            'gym 3x',
            'laundry',
            'call home sunday',
            'part time job application',
            'read chapters 4-6',
            'buy printer ink',
            'sleep more lol',
        ].join('\n'),
    },
    {
        key: 'jobHunt',
        label: 'Job hunt',
        text: [
            'update cv',
            'new linkedin photo',
            'apply: acme, globex, initech',
            'message Priya re referral',
            'interview tue 10am prep!!',
            'portfolio case study',
            'learn sql basics',
            'follow up with the recruiter from last week',
            'invoice for the side gig',
            'run 2x week',
        ].join('\n'),
    },
];

function findSample(key) {
    return SAMPLES.find((s) => s.key === key) || null;
}

module.exports = { SAMPLES, findSample };
