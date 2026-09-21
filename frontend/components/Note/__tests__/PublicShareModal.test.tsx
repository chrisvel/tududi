import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublicShareModal from '../PublicShareModal';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any, vars?: any) => {
            const template = typeof fallback === 'string' ? fallback : key;
            if (!vars) return template;
            return Object.keys(vars).reduce(
                (out, name) => out.replace(`{{${name}}}`, String(vars[name])),
                template
            );
        },
    }),
}));

const getNotePublicShare = jest.fn();
const enableNotePublicShare = jest.fn();
const disableNotePublicShare = jest.fn();
jest.mock('../../../utils/publicNotesService', () => {
    class PublicShareError extends Error {
        status: number;
        constructor(message: string, status: number) {
            super(message);
            this.status = status;
        }
    }
    return {
        PublicShareError,
        getNotePublicShare: (...args: any[]) => getNotePublicShare(...args),
        enableNotePublicShare: (...args: any[]) =>
            enableNotePublicShare(...args),
        disableNotePublicShare: (...args: any[]) =>
            disableNotePublicShare(...args),
        buildPublicNoteUrl: (token: string) =>
            `https://tududi.test/public/notes/${token}`,
    };
});

const off = { enabled: false, token: null, shared_at: null };
const on = { enabled: true, token: 'tok-abc', shared_at: '2026-09-21' };

const renderModal = (onChange = jest.fn()) => {
    render(
        <PublicShareModal
            isOpen
            onClose={jest.fn()}
            noteUid="note-1"
            noteTitle="Trip plan"
            onChange={onChange}
        />
    );
    return onChange;
};

const accessSelect = () =>
    screen.getByTestId('public-share-access') as HTMLSelectElement;

describe('PublicShareModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.assign(navigator, {
            clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
        });
    });

    it('renders nothing while closed', () => {
        render(
            <PublicShareModal isOpen={false} onClose={jest.fn()} noteUid="n" />
        );
        expect(screen.queryByTestId('public-share-modal')).toBeNull();
        expect(getNotePublicShare).not.toHaveBeenCalled();
    });

    it('starts restricted, with no link, for a private note', async () => {
        getNotePublicShare.mockResolvedValue(off);
        renderModal();

        await waitFor(() => expect(accessSelect()).not.toBeDisabled());
        expect(accessSelect().value).toBe('restricted');
        expect(screen.queryByTestId('public-share-link')).toBeNull();
        expect(getNotePublicShare).toHaveBeenCalledWith('note-1');
    });

    it('shows the existing link for a note that is already public', async () => {
        getNotePublicShare.mockResolvedValue(on);
        renderModal();

        const link = await screen.findByTestId('public-share-link');
        expect(link).toHaveValue('https://tududi.test/public/notes/tok-abc');
        expect(accessSelect().value).toBe('anyone');
    });

    it('turns sharing on and reveals the link', async () => {
        getNotePublicShare.mockResolvedValue(off);
        enableNotePublicShare.mockResolvedValue(on);
        const onChange = renderModal();
        await waitFor(() => expect(accessSelect()).not.toBeDisabled());

        fireEvent.change(accessSelect(), { target: { value: 'anyone' } });

        expect(await screen.findByTestId('public-share-link')).toHaveValue(
            'https://tududi.test/public/notes/tok-abc'
        );
        expect(enableNotePublicShare).toHaveBeenCalledWith('note-1');
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('turns sharing off and removes the link', async () => {
        getNotePublicShare.mockResolvedValue(on);
        disableNotePublicShare.mockResolvedValue(off);
        const onChange = renderModal();
        await screen.findByTestId('public-share-link');

        fireEvent.change(accessSelect(), { target: { value: 'restricted' } });

        await waitFor(() =>
            expect(screen.queryByTestId('public-share-link')).toBeNull()
        );
        expect(disableNotePublicShare).toHaveBeenCalledWith('note-1');
        expect(onChange).toHaveBeenCalledWith(false);
        expect(accessSelect().value).toBe('restricted');
    });

    it('copies the link', async () => {
        getNotePublicShare.mockResolvedValue(on);
        renderModal();
        await screen.findByTestId('public-share-link');

        fireEvent.click(screen.getByTestId('public-share-copy'));

        await waitFor(() =>
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                'https://tududi.test/public/notes/tok-abc'
            )
        );
        expect(await screen.findByText('Copied')).toBeInTheDocument();
    });

    it('explains that only the owner can share when the server refuses', async () => {
        const { PublicShareError } = jest.requireMock(
            '../../../utils/publicNotesService'
        );
        getNotePublicShare.mockRejectedValue(new PublicShareError('no', 403));
        renderModal();

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Only the owner of a note can share it publicly.'
        );
        expect(accessSelect()).toBeDisabled();
    });

    it('keeps the old state and reports the failure when turning it on fails', async () => {
        getNotePublicShare.mockResolvedValue(off);
        enableNotePublicShare.mockRejectedValue(new Error('Network down'));
        const onChange = renderModal();
        await waitFor(() => expect(accessSelect()).not.toBeDisabled());

        fireEvent.change(accessSelect(), { target: { value: 'anyone' } });

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Network down'
        );
        expect(accessSelect().value).toBe('restricted');
        expect(screen.queryByTestId('public-share-link')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });
});
