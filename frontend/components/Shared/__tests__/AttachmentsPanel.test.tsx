import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AttachmentsPanel from '../AttachmentsPanel';
import { AttachmentsApi } from '../../../utils/attachmentsService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
}));

jest.mock('../ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/configService', () => ({
    getServerConfig: jest.fn().mockResolvedValue({ fileUploadLimitMB: 10 }),
    getFileUploadLimitMB: () => 10,
}));

jest.mock('../AttachmentCard', () => ({
    __esModule: true,
    default: ({ attachment }: any) => <div>{attachment.original_filename}</div>,
}));

const apiWith = (files: any[]): AttachmentsApi => ({
    list: jest.fn().mockResolvedValue(files),
    upload: jest.fn(),
    remove: jest.fn(),
    downloadUrl: () => '',
});

describe('AttachmentsPanel upload card', () => {
    it('spans the full width when there are no attachments', async () => {
        render(<AttachmentsPanel api={apiWith([])} />);
        expect(await screen.findByTestId('attachments-upload')).toHaveClass(
            'col-span-full'
        );
    });

    it('takes one column next to existing attachments', async () => {
        render(
            <AttachmentsPanel
                api={apiWith([{ uid: 'a1', original_filename: 'plan.pdf' }])}
            />
        );
        expect(await screen.findByText('plan.pdf')).toBeInTheDocument();
        expect(screen.getByTestId('attachments-upload')).not.toHaveClass(
            'col-span-full'
        );
    });
});
