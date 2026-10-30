const { resourcePhrase } = require('../../../utils/resourcePhrases');

describe('resourcePhrase', () => {
    it('gives each shareable type its article', () => {
        expect(resourcePhrase('project')).toBe('a project');
        expect(resourcePhrase('area')).toBe('an area');
        expect(resourcePhrase('goal')).toBe('a goal');
        expect(resourcePhrase('note')).toBe('a note');
        expect(resourcePhrase('task')).toBe('a task');
    });

    it('falls back on the first letter for other types', () => {
        expect(resourcePhrase('item')).toBe('an item');
        expect(resourcePhrase('view')).toBe('a view');
        expect(resourcePhrase(undefined)).toBe('an item');
    });
});
