const {
    DEFAULT_SUGGESTIONS,
    PROJECT_STATUSES,
    normalizeSuggestionSettings,
    validateSuggestionUpdate,
    isSuggestible,
} = require('../../../modules/daily-plan/planningSettings');

const DAY = 24 * 60 * 60 * 1000;

describe('normalizeSuggestionSettings', () => {
    it('returns the defaults when nothing is saved', () => {
        expect(normalizeSuggestionSettings(undefined)).toEqual(
            DEFAULT_SUGGESTIONS
        );
        expect(normalizeSuggestionSettings(null)).toEqual(DEFAULT_SUGGESTIONS);
        expect(normalizeSuggestionSettings('nonsense')).toEqual(
            DEFAULT_SUGGESTIONS
        );
    });

    it('fills defaults for old settings that only have candidateOrder', () => {
        expect(
            normalizeSuggestionSettings({
                candidateOrder: ['suggested:none'],
                dayHours: { start: 480, end: 1080 },
            })
        ).toEqual(DEFAULT_SUGGESTIONS);
    });

    it('keeps valid values', () => {
        const saved = {
            projectStatuses: ['planned', 'in_progress'],
            includeNoProject: false,
            excludedProjectIds: [4, 9],
            tieBreak: 'oldest',
            staleAfterDays: 180,
            horizonDays: 7,
            maxSuggestions: 50,
        };
        expect(normalizeSuggestionSettings(saved)).toEqual({
            ...saved,
            projectStatuses: ['in_progress', 'planned'],
        });
    });

    it('replaces each invalid value with its default', () => {
        expect(
            normalizeSuggestionSettings({
                projectStatuses: 'in_progress',
                includeNoProject: 'yes',
                excludedProjectIds: {},
                tieBreak: 'random',
                staleAfterDays: 30,
                horizonDays: 5,
                maxSuggestions: 1000,
            })
        ).toEqual(DEFAULT_SUGGESTIONS);
    });

    it('drops unknown statuses and bad or repeated project ids', () => {
        const result = normalizeSuggestionSettings({
            projectStatuses: ['parked', 'waiting', 'waiting'],
            excludedProjectIds: [3, '4', 3, -1, 2.5, null],
        });
        expect(result.projectStatuses).toEqual(['waiting']);
        expect(result.excludedProjectIds).toEqual([3]);
    });

    it('does not share arrays with the defaults', () => {
        normalizeSuggestionSettings({}).projectStatuses.push('done');
        expect(DEFAULT_SUGGESTIONS.projectStatuses).toEqual(['in_progress']);
    });

    it('offers every project status from the model', () => {
        expect(PROJECT_STATUSES).toEqual(
            expect.arrayContaining([
                'not_started',
                'in_progress',
                'done',
                'waiting',
                'cancelled',
                'planned',
            ])
        );
    });
});

describe('validateSuggestionUpdate', () => {
    it('accepts a partial update', () => {
        expect(
            validateSuggestionUpdate({ tieBreak: 'newest', horizonDays: 1 })
        ).toEqual({ tieBreak: 'newest', horizonDays: 1 });
        expect(validateSuggestionUpdate({ staleAfterDays: null })).toEqual({
            staleAfterDays: null,
        });
    });

    it.each([
        [{ somethingElse: true }],
        [{ tieBreak: 'random' }],
        [{ staleAfterDays: 30 }],
        [{ horizonDays: '3' }],
        [{ maxSuggestions: 5 }],
        [{ includeNoProject: 1 }],
        [{ projectStatuses: ['in_progress', 'parked'] }],
        [{ projectStatuses: ['in_progress', 'in_progress'] }],
        [{ excludedProjectIds: [1, 'two'] }],
        [{ excludedProjectIds: [1, 1] }],
        [[]],
        [null],
    ])('rejects %j', (body) => {
        expect(() => validateSuggestionUpdate(body)).toThrow();
    });
});

describe('isSuggestible', () => {
    const now = new Date('2026-09-28T09:00:00Z').getTime();
    const settings = (overrides = {}) => ({
        ...normalizeSuggestionSettings({}),
        ...overrides,
    });
    const task = (attrs = {}) => ({
        id: 1,
        project_id: 7,
        Project: { status: 'in_progress' },
        updated_at: new Date(now),
        ...attrs,
    });

    it('follows the project status, the no-project switch and exclusions', () => {
        expect(isSuggestible(task(), settings(), now)).toBe(true);
        expect(
            isSuggestible(
                task({ Project: { status: 'planned' } }),
                settings(),
                now
            )
        ).toBe(false);
        expect(
            isSuggestible(
                task({ Project: { status: 'planned' } }),
                settings({ projectStatuses: ['planned'] }),
                now
            )
        ).toBe(true);
        expect(
            isSuggestible(task(), settings({ excludedProjectIds: [7] }), now)
        ).toBe(false);
        expect(
            isSuggestible(
                task({ project_id: null, Project: null }),
                settings(),
                now
            )
        ).toBe(true);
        expect(
            isSuggestible(
                task({ project_id: null, Project: null }),
                settings({ includeNoProject: false }),
                now
            )
        ).toBe(false);
    });

    it('leaves out tasks due past the horizon and deferred tasks', () => {
        const dueIn = (days) => task({ due_date: new Date(now + days * DAY) });
        expect(isSuggestible(dueIn(2), settings(), now)).toBe(true);
        expect(isSuggestible(dueIn(4), settings(), now)).toBe(false);
        expect(isSuggestible(dueIn(2), settings({ horizonDays: 1 }), now)).toBe(
            false
        );
        expect(isSuggestible(dueIn(6), settings({ horizonDays: 7 }), now)).toBe(
            true
        );
        expect(
            isSuggestible(
                task({ defer_until: new Date(now + DAY) }),
                settings(),
                now
            )
        ).toBe(false);
    });

    it('leaves out untouched tasks only when a stale limit is set', () => {
        const touched = (days) =>
            task({ updated_at: new Date(now - days * DAY) });
        expect(isSuggestible(touched(400), settings(), now)).toBe(true);
        expect(
            isSuggestible(touched(100), settings({ staleAfterDays: 90 }), now)
        ).toBe(false);
        expect(
            isSuggestible(touched(100), settings({ staleAfterDays: 180 }), now)
        ).toBe(true);
    });
});
