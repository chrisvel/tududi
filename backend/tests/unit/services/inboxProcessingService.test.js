const {
    processInboxItem,
    containsUrl,
} = require('../../../modules/inbox/inboxProcessingService');

describe('inboxProcessingService', () => {
    describe('processInboxItem', () => {
        it('should detect URL without project and set reason to url_detected', () => {
            const content = 'https://example.com/page #tag1 #tag2';
            const result = processInboxItem(content);

            expect(result).toEqual({
                parsed_tags: ['tag1', 'tag2'],
                parsed_projects: [],
                cleaned_content: 'https://example.com/page',
                suggested_type: null,
                suggested_reason: 'url_detected',
            });
        });

        it('should detect URL with project and suggest note', () => {
            const content = 'https://example.com/page +Project #tag1';
            const result = processInboxItem(content);

            expect(result).toEqual({
                parsed_tags: ['tag1'],
                parsed_projects: ['Project'],
                cleaned_content: 'https://example.com/page',
                suggested_type: 'note',
                suggested_reason: 'url_detected',
            });
        });

        it('should handle URL without tags or projects', () => {
            const content = 'https://example.com/test-page';
            const result = processInboxItem(content);

            expect(result).toEqual({
                parsed_tags: [],
                parsed_projects: [],
                cleaned_content: 'https://example.com/test-page',
                suggested_type: null,
                suggested_reason: 'url_detected',
            });
        });

        it('should not set url_detected reason for non-URL content', () => {
            const content = 'Just some regular text #tag1';
            const result = processInboxItem(content);

            expect(result).toEqual({
                parsed_tags: ['tag1'],
                parsed_projects: [],
                cleaned_content: 'Just some regular text',
                suggested_type: null,
                suggested_reason: null,
            });
        });
    });

    describe('containsUrl', () => {
        it('should detect URLs in text with hashtags', () => {
            expect(containsUrl('https://example.com/page #tag1')).toBe(true);
        });

        it('should detect URLs at the start of text', () => {
            expect(containsUrl('https://example.com')).toBe(true);
        });

        it('should detect http URLs', () => {
            expect(containsUrl('http://example.com/path')).toBe(true);
        });

        it('should return false for non-URL text', () => {
            expect(containsUrl('just some text')).toBe(false);
        });
    });
});