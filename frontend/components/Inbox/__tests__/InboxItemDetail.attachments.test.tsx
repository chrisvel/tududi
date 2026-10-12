import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import InboxItemDetail from '../InboxItemDetail';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

jest.mock('../../../store/useStore', () => ({
    useStore: () => ({ tagsStore: { tags: [] } }),
}));

// Renders the footer the item passes in, the way the real composer does.
jest.mock('../QuickCaptureInput', () => ({
    __esModule: true,
    default: function MockQuickCaptureInput(props: any) {
        return <div>{props.renderFooterActions?.({})}</div>;
    },
}));

const noop = () => {};

const item = {
    uid: 'abc123',
    content: 'Receipt from the plumber',
    title: null,
    attachments: [
        {
            uid: 'att-1',
            original_filename: 'receipt.png',
            stored_filename: 'inbox-1.png',
            file_size: 10,
            mime_type: 'image/png',
            file_url: '/api/uploads/inbox/inbox-1.png',
            created_at: '',
            updated_at: '',
        },
    ],
};

const renderItem = () =>
    render(
        <InboxItemDetail
            item={item as any}
            onDelete={noop}
            openTaskModal={noop}
            openProjectModal={noop}
            openNoteModal={noop}
            projects={[]}
        />
    );

describe('InboxItemDetail - attachments', () => {
    it('shows the files on the collapsed row', () => {
        renderItem();

        expect(screen.getByTitle('receipt.png')).toHaveAttribute(
            'href',
            '/api/uploads/inbox/inbox-1.png'
        );
    });

    it('keeps showing the files once the item is opened', () => {
        renderItem();

        fireEvent.click(screen.getByText('Receipt from the plumber'));

        expect(screen.getByTestId('inbox-item-attachments')).toHaveTextContent(
            'receipt.png'
        );
        expect(screen.getByText('Save as')).toBeInTheDocument();
    });
});
