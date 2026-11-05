import { TFunction } from 'i18next';

// The translated text for an error from spreadsheetService: by its reason
// code when it has one, the English message otherwise. A failed fetch (no
// connection) has neither and reads as a generic failure.
export const spreadsheetErrorText = (t: TFunction, error: unknown): string => {
    const { reason, message } = (error || {}) as {
        reason?: string;
        message?: string;
    };
    const key = reason || (error instanceof TypeError ? 'request_failed' : '');
    if (!key) return message || t('spreadsheet.errors.request_failed');
    return t(`spreadsheet.errors.${key}`, {
        defaultValue: message || t('spreadsheet.errors.request_failed'),
    });
};
