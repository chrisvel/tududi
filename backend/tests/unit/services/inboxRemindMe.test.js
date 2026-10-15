const {
    processInboxItem,
} = require('../../../modules/inbox/inboxProcessingService');

describe('inbox "remind me" phrases', () => {
    const options = {
        referenceDate: new Date('2026-10-15T10:00:00Z'),
        timezone: 'Europe/Athens',
    };

    it('sets reminder_at from the date and time and keeps the title', () => {
        const result = processInboxItem('remind me tomorrow at 5pm', options);
        expect(result.parsed_due_date).toBe('2026-10-16');
        expect(result.parsed_due_time).toBe('17:00');
        expect(result.parsed_reminder_at).toBe('2026-10-16T14:00:00.000Z');
        expect(result.cleaned_content).toBe('remind me tomorrow at 5pm');
    });

    it('defaults the reminder to 09:00 when only a date is given', () => {
        const result = processInboxItem('remind me tomorrow', options);
        expect(result.parsed_reminder_at).toBe('2026-10-16T06:00:00.000Z');
    });

    it('does not create a reminder without "remind me"', () => {
        const result = processInboxItem('Call mom tomorrow at 5pm', options);
        expect(result.parsed_reminder_at).toBeNull();
        expect(result.cleaned_content).toBe('Call mom tomorrow at 5pm');
    });
});
