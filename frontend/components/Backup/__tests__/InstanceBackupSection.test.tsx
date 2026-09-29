import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BackupRestore from '../BackupRestore';
import InstanceBackupSection from '../InstanceBackupSection';
import * as backupService from '../../../utils/backupService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string, vars?: Record<string, any>) =>
            (fallback ?? _key).replace(/{{(\w+)}}/g, (_m, k) =>
                String(vars?.[k] ?? '')
            ),
    }),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/backupService', () => ({
    listSavedBackups: jest.fn().mockResolvedValue([]),
    downloadInstanceBackup: jest.fn().mockResolvedValue(undefined),
    importInstanceBackup: jest.fn(),
}));

describe('All-accounts backup section', () => {
    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ version: 'v1' }),
        }) as any;
    });

    it('is shown to admins only', () => {
        const { rerender } = render(<BackupRestore />);
        expect(screen.queryByText('All accounts')).not.toBeInTheDocument();

        rerender(<BackupRestore isAdmin />);
        expect(screen.getByText('All accounts')).toBeInTheDocument();
    });

    it('downloads the backup of all accounts', () => {
        render(<InstanceBackupSection />);
        fireEvent.click(screen.getByText('Download backup of all accounts'));
        expect(backupService.downloadInstanceBackup).toHaveBeenCalled();
    });

    it('restores after confirming and shows who came back', async () => {
        (backupService.importInstanceBackup as jest.Mock).mockResolvedValue({
            success: true,
            message: 'ok',
            accounts: [
                { email: 'a@x.test', name: 'Ada', status: 'existing' },
                { email: 'b@x.test', name: 'Ben', status: 'created' },
            ],
            shares: 1,
            groups: 0,
            skipped: [],
        });
        render(<InstanceBackupSection />);

        const file = new File(['{}'], 'all.json.gz');
        fireEvent.change(screen.getByTestId('instance-backup-file'), {
            target: { files: [file] },
        });
        expect(backupService.importInstanceBackup).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

        await waitFor(() =>
            expect(
                screen.getByTestId('instance-backup-result')
            ).toHaveTextContent('1 accounts added, 1 already here.')
        );
        expect(backupService.importInstanceBackup).toHaveBeenCalledWith(file);
        expect(screen.getByTestId('instance-backup-result')).toHaveTextContent(
            'Ben'
        );
    });
});
