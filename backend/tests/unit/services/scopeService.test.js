'use strict';

const { parseScopeParams } = require('../../../services/scopeService');

describe('scopeService.parseScopeParams', () => {
    it('returns null when the query carries no scope', () => {
        expect(parseScopeParams({})).toBeNull();
        expect(parseScopeParams({ type: 'today', tags: '' })).toBeNull();
        expect(parseScopeParams({ area_uid: '   ' })).toBeNull();
    });

    it('reads the uids and splits tags from a string or a list', () => {
        expect(
            parseScopeParams({
                area_uid: ' a1 ',
                project_uid: 'p1',
                tags: 'urgent, deep ,,urgent',
            })
        ).toEqual({
            areaUid: 'a1',
            projectUid: 'p1',
            tagNames: ['urgent', 'deep'],
        });
        expect(parseScopeParams({ tags: ['x', ' y '] })).toEqual({
            areaUid: null,
            projectUid: null,
            tagNames: ['x', 'y'],
        });
    });
});
