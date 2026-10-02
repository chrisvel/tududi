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
const updateNotePublicLook = jest.fn();
const rotateNotePublicShare = jest.fn();
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
        updateNotePublicLook: (...args: any[]) => updateNotePublicLook(...args),
        rotateNotePublicShare: (...args: any[]) =>
            rotateNotePublicShare(...args),
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

const accessMenu = () => screen.getByTestId('public-share-access');

const chooseAccess = (label: string) => {
    fireEvent.click(accessMenu());
    fireEvent.click(screen.getByRole('option', { name: label }));
};

const waitForLoaded = () =>
    waitFor(() => expect(getNotePublicShare).toHaveBeenCalled());

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

        await waitForLoaded();
        await screen.findByText('Restricted');
        expect(accessMenu()).toHaveTextContent('Restricted');
        expect(screen.queryByTestId('public-share-link')).toBeNull();
        expect(getNotePublicShare).toHaveBeenCalledWith('note-1');
    });

    it('shows the existing link for a note that is already public', async () => {
        getNotePublicShare.mockResolvedValue(on);
        renderModal();

        const link = await screen.findByTestId('public-share-link');
        expect(link).toHaveValue('https://tududi.test/public/notes/tok-abc');
        expect(accessMenu()).toHaveTextContent('Anyone with the link');
    });

    it('turns sharing on and reveals the link', async () => {
        getNotePublicShare.mockResolvedValue(off);
        enableNotePublicShare.mockResolvedValue(on);
        const onChange = renderModal();
        await waitForLoaded();
        await screen.findByText('Restricted');

        chooseAccess('Anyone with the link');
        expect(enableNotePublicShare).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('public-share-create'));

        expect(await screen.findByTestId('public-share-link')).toHaveValue(
            'https://tududi.test/public/notes/tok-abc'
        );
        expect(enableNotePublicShare).toHaveBeenCalledWith('note-1', {
            public_inherit_style: true,
        });
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('shares without the note styling when the box is unticked', async () => {
        getNotePublicShare.mockResolvedValue(off);
        enableNotePublicShare.mockResolvedValue(on);
        renderModal();
        await waitForLoaded();
        await screen.findByText('Restricted');

        chooseAccess('Anyone with the link');
        const inherit = screen.getByTestId('public-share-inherit');
        expect(inherit).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(inherit);
        fireEvent.click(screen.getByTestId('public-share-create'));

        await screen.findByTestId('public-share-link');
        expect(enableNotePublicShare).toHaveBeenCalledWith('note-1', {
            public_inherit_style: false,
        });
    });

    it('saves the styling choice right away once the note is public', async () => {
        getNotePublicShare.mockResolvedValue(on);
        updateNotePublicLook.mockResolvedValue({
            ...on,
            public_inherit_style: true,
        });
        renderModal();
        await screen.findByTestId('public-share-link');

        const inherit = screen.getByTestId('public-share-inherit');
        expect(inherit).toHaveAttribute('aria-checked', 'false');
        fireEvent.click(inherit);

        await waitFor(() =>
            expect(updateNotePublicLook).toHaveBeenCalledWith('note-1', {
                public_inherit_style: true,
            })
        );
        await waitFor(() =>
            expect(screen.getByTestId('public-share-inherit')).toHaveAttribute(
                'aria-checked',
                'true'
            )
        );
    });

    it('turns sharing off and removes the link', async () => {
        getNotePublicShare.mockResolvedValue(on);
        disableNotePublicShare.mockResolvedValue(off);
        const onChange = renderModal();
        await screen.findByTestId('public-share-link');

        chooseAccess('Restricted');

        await waitFor(() =>
            expect(screen.queryByTestId('public-share-link')).toBeNull()
        );
        expect(disableNotePublicShare).toHaveBeenCalledWith('note-1');
        expect(onChange).toHaveBeenCalledWith(false);
        expect(accessMenu()).toHaveTextContent('Restricted');
    });

    it('replaces the link after the owner confirms', async () => {
        getNotePublicShare.mockResolvedValue(on);
        rotateNotePublicShare.mockResolvedValue({ ...on, token: 'tok-new' });
        renderModal();
        await screen.findByTestId('public-share-link');

        fireEvent.click(screen.getByTestId('public-share-rotate'));
        expect(rotateNotePublicShare).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('public-share-rotate-yes'));

        await waitFor(() =>
            expect(screen.getByTestId('public-share-link')).toHaveValue(
                'https://tududi.test/public/notes/tok-new'
            )
        );
        expect(rotateNotePublicShare).toHaveBeenCalledWith('note-1');
    });

    it('keeps the link when the owner cancels', async () => {
        getNotePublicShare.mockResolvedValue(on);
        renderModal();
        await screen.findByTestId('public-share-link');

        fireEvent.click(screen.getByTestId('public-share-rotate'));
        fireEvent.click(screen.getByText('Cancel'));

        expect(rotateNotePublicShare).not.toHaveBeenCalled();
        expect(screen.getByTestId('public-share-rotate')).toBeInTheDocument();
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
    });

    it('keeps the old state and reports the failure when turning it on fails', async () => {
        getNotePublicShare.mockResolvedValue(off);
        enableNotePublicShare.mockRejectedValue(new Error('Network down'));
        const onChange = renderModal();
        await waitForLoaded();
        await screen.findByText('Restricted');

        chooseAccess('Anyone with the link');
        fireEvent.click(screen.getByTestId('public-share-create'));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Network down'
        );
        expect(accessMenu()).toHaveTextContent('Anyone with the link');
        expect(screen.getByTestId('public-share-create')).toBeInTheDocument();
        expect(screen.queryByTestId('public-share-link')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });
});
