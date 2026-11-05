import { spreadsheetErrorText } from '../errorText';
import { SpreadsheetError } from '../../../utils/spreadsheetService';

const t = ((key: string, options?: { defaultValue?: string }) =>
    key === 'spreadsheet.errors.old_xls'
        ? 'Παλιά αρχεία .xls δεν υποστηρίζονται.'
        : options?.defaultValue || key) as any;

describe('spreadsheetErrorText', () => {
    it('translates by the reason the server sent', () => {
        expect(
            spreadsheetErrorText(
                t,
                new SpreadsheetError('Old .xls…', 'old_xls')
            )
        ).toBe('Παλιά αρχεία .xls δεν υποστηρίζονται.');
    });

    it('falls back to the English message for an unknown reason', () => {
        expect(
            spreadsheetErrorText(t, new SpreadsheetError('Odd', 'new_reason'))
        ).toBe('Odd');
    });

    it('reads a failed fetch as a generic failure', () => {
        expect(spreadsheetErrorText(t, new TypeError('Failed to fetch'))).toBe(
            'Failed to fetch'
        );
        expect(spreadsheetErrorText(t, undefined)).toBe(
            'spreadsheet.errors.request_failed'
        );
    });
});
