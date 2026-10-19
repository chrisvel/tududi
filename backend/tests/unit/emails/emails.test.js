const fs = require('fs');
const path = require('path');
const { EMAILS, LANGUAGES, renderEmail } = require('../../../emails');
const {
    LOCALES_DIR,
    CATALOG_FILE,
    createTranslator,
    normalizeLanguage,
} = require('../../../emails/i18n');

const INTL_TAGS = { jp: 'ja', ua: 'uk' };
const PLURAL = /_(zero|one|two|few|many|other)$/;
const DAY = 24 * 60 * 60 * 1000;

const read = (language) =>
    JSON.parse(
        fs.readFileSync(path.join(LOCALES_DIR, language, CATALOG_FILE), 'utf8')
    );

const flatten = (node, prefix = '') =>
    Object.entries(node).flatMap(([key, value]) => {
        const full = prefix ? `${prefix}.${key}` : key;
        return value && typeof value === 'object' && !Array.isArray(value)
            ? flatten(value, full)
            : [[full, value]];
    });

const placeholders = (value) =>
    [].concat(value).flatMap((s) => s.match(/\{\{\s*\w+\s*\}\}/g) || []);

const english = new Map(flatten(read('en')));
const baseKeys = new Set([...english.keys()].map((k) => k.replace(PLURAL, '')));

const SAMPLES = {
    verification: {
        url: 'https://example.com/verify?token=abc',
        expiryHours: 24,
        trialDays: 7,
    },
    passwordReset: { url: 'https://example.com/reset', expiryMinutes: 60 },
    memberInvite: { url: 'https://example.com/invite', expiryHours: 72 },
    trialReminder: {
        daysLeft: 3,
        endsOn: new Date(Date.now() + 3 * DAY),
        readOnlyDays: 30,
        subscribeUrl: 'https://example.com/subscription/new',
    },
    deletionWarning: {
        deleteOn: new Date(Date.now() + 7 * DAY),
        subscribeUrl: 'https://example.com/subscription/new',
        exportUrl: 'https://example.com/backup',
    },
    emptyAccount: {
        url: 'https://example.com/inbox',
        trialEndsOn: new Date(Date.now() + 5 * DAY),
    },
    comeBack: { url: 'https://example.com/today/plan' },
    notification: { title: 'Due', message: 'A task is due' },
    contactMessage: {
        name: 'Sam',
        email: 'sam@example.com',
        ip: '127.0.0.1',
        message: 'Hi',
    },
};

describe('emails', () => {
    it('has a catalog for every app language', () => {
        const appLanguages = fs
            .readdirSync(path.join(__dirname, '../../../../public/locales'))
            .filter((d) => !d.startsWith('.'));
        expect([...LANGUAGES].sort()).toEqual(appLanguages.sort());
    });

    it('has a sample for every email', () => {
        expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(EMAILS).sort());
    });

    describe.each(LANGUAGES)('%s', (language) => {
        const catalog = new Map(flatten(read(language)));
        const categories = new Intl.PluralRules(
            INTL_TAGS[language] || language
        ).resolvedOptions().pluralCategories;

        it('has every key, with each plural form the language uses', () => {
            const needed = [...baseKeys].flatMap((key) =>
                english.has(`${key}_other`)
                    ? categories.map((category) => `${key}_${category}`)
                    : [key]
            );
            expect(needed.filter((key) => !catalog.has(key))).toEqual([]);
        });

        it('keeps only placeholders the English string has', () => {
            const wrong = [...catalog].filter(([key, value]) => {
                const source =
                    english.get(key) ??
                    english.get(key.replace(PLURAL, '_other'));
                if (source === undefined) return true;
                const allowed = new Set(placeholders(source));
                return placeholders(value).some((name) => !allowed.has(name));
            });
            expect(wrong.map(([key]) => key)).toEqual([]);
        });

        it('renders every email without a missing key or placeholder', () => {
            const broken = Object.entries(SAMPLES).filter(([name, vars]) => {
                const email = renderEmail(name, { language, ...vars });
                const all = `${email.subject}\n${email.text}\n${email.html || ''}`;
                return (
                    all.includes('{{') ||
                    [...baseKeys].some((key) => all.includes(key))
                );
            });
            expect(broken.map(([name]) => name)).toEqual([]);
        });
    });

    it('falls back to English for an unknown language', () => {
        expect(normalizeLanguage('xx')).toBe('en');
        expect(normalizeLanguage('pt-BR')).toBe('pt');
        expect(createTranslator('xx').t('passwordReset.subject')).toBe(
            'Reset your Tududi password'
        );
    });

    it('builds a matching text and HTML body, escaping the HTML', () => {
        const email = renderEmail('passwordReset', {
            language: 'en',
            url: 'https://example.com/reset?a=1&b=2',
            expiryMinutes: 1,
        });
        expect(email.text).toContain('https://example.com/reset?a=1&b=2');
        expect(email.html).toContain(
            'href="https://example.com/reset?a=1&amp;b=2"'
        );
        expect(email.text).toContain('expires in 1 minute.');
        expect(email.text).toMatch(/Best regards,\nThe Tududi Team$/);
    });

    it('says what the trial includes only when there is one', () => {
        const vars = { language: 'en', url: 'u', expiryHours: 24 };
        expect(
            renderEmail('verification', { ...vars, trialDays: 7 }).text
        ).toContain('free 7-day trial');
        expect(
            renderEmail('verification', { ...vars, trialDays: 0 }).text
        ).not.toContain('trial');
    });
});
