import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InboxItemDetail from '../InboxItemDetail';
import { analyzeInboxText } from '../../../utils/inboxService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

jest.mock('../../../store/useStore', () => ({
    useStore: () => ({ tagsStore: { tags: [] } }),
}));

jest.mock('../../../utils/inboxService', () => ({
    ...jest.requireActual('../../../utils/inboxService'),
    analyzeInboxText: jest.fn(),
}));

// Shows the text the edit box opens with and submits it unchanged on demand
jest.mock('../QuickCaptureInput', () => ({
    __esModule: true,
    default: function MockQuickCaptureInput({
        initialValue,
        onSubmitOverride,
    }: any) {
        return (
            <div>
                <span data-testid="composer-text">{initialValue}</span>
                <button
                    type="button"
                    onClick={() => onSubmitOverride(initialValue)}
                >
                    submit
                </button>
            </div>
        );
    },
}));

const noop = () => {};

describe('InboxItemDetail - edit box text', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('opens the edit box with the cleaned title, not the raw text', async () => {
        (analyzeInboxText as jest.Mock).mockResolvedValue({
            cleaned_content: 'Call the bank',
        });
        render(
            <InboxItemDetail
                item={{
                    uid: 'abc123',
                    content: 'Call the bank #finance ~Work tomorrow',
                    title: null,
                }}
                onDelete={noop}
                onUpdate={jest.fn()}
                openTaskModal={noop}
                openProjectModal={noop}
                openNoteModal={noop}
                projects={[]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /Call the bank/ }));

        await waitFor(() =>
            expect(screen.getByTestId('composer-text')).toHaveTextContent(
                'Call the bank'
            )
        );
        expect(screen.getByTestId('composer-text').textContent).toBe(
            'Call the bank'
        );
    });

    it('saves nothing when the cleaned text is submitted untouched', async () => {
        (analyzeInboxText as jest.Mock).mockResolvedValue({
            cleaned_content: 'Call the bank',
        });
        const onUpdate = jest.fn();
        render(
            <InboxItemDetail
                item={{
                    uid: 'abc123',
                    content: 'Call the bank #finance',
                    title: null,
                }}
                onDelete={noop}
                onUpdate={onUpdate}
                openTaskModal={noop}
                openProjectModal={noop}
                openNoteModal={noop}
                projects={[]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /Call the bank/ }));
        await waitFor(() =>
            expect(screen.getByTestId('composer-text').textContent).toBe(
                'Call the bank'
            )
        );
        fireEvent.click(screen.getByRole('button', { name: 'submit' }));

        expect(onUpdate).not.toHaveBeenCalled();
    });
});
