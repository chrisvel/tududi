const {
    validateCalendarSettings,
    VALID_CALENDAR_SYNC_PRESETS,
} = require('../../../modules/users/validation');
const { ValidationError } = require('../../../shared/errors');

describe('Calendar Settings Validation', () => {
    describe('validateCalendarSettings', () => {
        describe('enabled field', () => {
            it('should accept boolean true', () => {
                const result = validateCalendarSettings({ enabled: true });
                expect(result.enabled).toBe(true);
            });

            it('should accept boolean false', () => {
                const result = validateCalendarSettings({ enabled: false });
                expect(result.enabled).toBe(false);
            });

            it('should accept undefined enabled', () => {
                const result = validateCalendarSettings({});
                expect(result.enabled).toBeUndefined();
            });

            it('should reject non-boolean enabled', () => {
                expect(() => {
                    validateCalendarSettings({ enabled: 'true' });
                }).toThrow(ValidationError);
                expect(() => {
                    validateCalendarSettings({ enabled: 'true' });
                }).toThrow('enabled must be a boolean');
            });

            it('should reject numeric enabled', () => {
                expect(() => {
                    validateCalendarSettings({ enabled: 1 });
                }).toThrow(ValidationError);
            });

            it('should reject null enabled', () => {
                expect(() => {
                    validateCalendarSettings({ enabled: null });
                }).toThrow(ValidationError);
            });
        });

        describe('icsUrl field', () => {
            it('should accept valid http URL', () => {
                const result = validateCalendarSettings({
                    icsUrl: 'http://example.com/calendar.ics',
                });
                expect(result.icsUrl).toBe('http://example.com/calendar.ics');
            });

            it('should accept valid https URL', () => {
                const result = validateCalendarSettings({
                    icsUrl: 'https://example.com/calendar.ics',
                });
                expect(result.icsUrl).toBe('https://example.com/calendar.ics');
            });

            it('should trim whitespace from icsUrl', () => {
                const result = validateCalendarSettings({
                    icsUrl: '  https://example.com/calendar.ics  ',
                });
                expect(result.icsUrl).toBe('https://example.com/calendar.ics');
            });

            it('should accept empty string icsUrl', () => {
                const result = validateCalendarSettings({ icsUrl: '' });
                expect(result.icsUrl).toBe('');
            });

            it('should accept undefined icsUrl', () => {
                const result = validateCalendarSettings({});
                expect(result.icsUrl).toBeUndefined();
            });

            it('should reject non-string icsUrl', () => {
                expect(() => {
                    validateCalendarSettings({ icsUrl: 123 });
                }).toThrow(ValidationError);
                expect(() => {
                    validateCalendarSettings({ icsUrl: 123 });
                }).toThrow('icsUrl must be a string');
            });

            it('should reject URL without protocol', () => {
                expect(() => {
                    validateCalendarSettings({
                        icsUrl: 'example.com/calendar.ics',
                    });
                }).toThrow(ValidationError);
                expect(() => {
                    validateCalendarSettings({
                        icsUrl: 'example.com/calendar.ics',
                    });
                }).toThrow('icsUrl must be a valid http or https URL');
            });

            it('should reject ftp protocol', () => {
                expect(() => {
                    validateCalendarSettings({
                        icsUrl: 'ftp://example.com/calendar.ics',
                    });
                }).toThrow(ValidationError);
            });

            it('should reject file protocol', () => {
                expect(() => {
                    validateCalendarSettings({
                        icsUrl: 'file:///etc/passwd',
                    });
                }).toThrow(ValidationError);
            });

            it('should reject javascript protocol', () => {
                expect(() => {
                    validateCalendarSettings({
                        icsUrl: 'javascript:alert(1)',
                    });
                }).toThrow(ValidationError);
            });

            it('should reject data protocol', () => {
                expect(() => {
                    validateCalendarSettings({
                        icsUrl: 'data:text/html,<script>alert(1)</script>',
                    });
                }).toThrow(ValidationError);
            });
        });

        describe('syncPreset field', () => {
            it('should accept valid preset: 15m', () => {
                const result = validateCalendarSettings({ syncPreset: '15m' });
                expect(result.syncPreset).toBe('15m');
            });

            it('should accept valid preset: 1h', () => {
                const result = validateCalendarSettings({ syncPreset: '1h' });
                expect(result.syncPreset).toBe('1h');
            });

            it('should accept valid preset: 6h', () => {
                const result = validateCalendarSettings({ syncPreset: '6h' });
                expect(result.syncPreset).toBe('6h');
            });

            it('should accept valid preset: 24h', () => {
                const result = validateCalendarSettings({ syncPreset: '24h' });
                expect(result.syncPreset).toBe('24h');
            });

            it('should accept undefined syncPreset', () => {
                const result = validateCalendarSettings({});
                expect(result.syncPreset).toBeUndefined();
            });

            it('should reject invalid preset', () => {
                expect(() => {
                    validateCalendarSettings({ syncPreset: '5m' });
                }).toThrow(ValidationError);
                expect(() => {
                    validateCalendarSettings({ syncPreset: '5m' });
                }).toThrow(/Invalid sync preset/);
            });

            it('should reject empty string preset', () => {
                expect(() => {
                    validateCalendarSettings({ syncPreset: '' });
                }).toThrow(ValidationError);
                expect(() => {
                    validateCalendarSettings({ syncPreset: '' });
                }).toThrow('Sync preset is required');
            });

            it('should reject numeric preset', () => {
                expect(() => {
                    validateCalendarSettings({ syncPreset: 15 });
                }).toThrow(ValidationError);
            });

            it('should list valid presets in error message', () => {
                expect(() => {
                    validateCalendarSettings({ syncPreset: 'invalid' });
                }).toThrow(
                    `Invalid sync preset. Must be one of: ${VALID_CALENDAR_SYNC_PRESETS.join(', ')}`
                );
            });
        });

        describe('combined validation', () => {
            it('should validate all fields together', () => {
                const result = validateCalendarSettings({
                    enabled: true,
                    icsUrl: 'https://example.com/calendar.ics',
                    syncPreset: '6h',
                });

                expect(result.enabled).toBe(true);
                expect(result.icsUrl).toBe('https://example.com/calendar.ics');
                expect(result.syncPreset).toBe('6h');
            });

            it('should handle partial updates', () => {
                const result = validateCalendarSettings({
                    enabled: true,
                });

                expect(result.enabled).toBe(true);
                expect(result.icsUrl).toBeUndefined();
                expect(result.syncPreset).toBeUndefined();
            });

            it('should trim URL and validate all fields', () => {
                const result = validateCalendarSettings({
                    enabled: false,
                    icsUrl: '  https://example.com/cal.ics  ',
                    syncPreset: '24h',
                });

                expect(result.enabled).toBe(false);
                expect(result.icsUrl).toBe('https://example.com/cal.ics');
                expect(result.syncPreset).toBe('24h');
            });
        });
    });
});
