import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import InboxItemDetail from '../InboxItemDetail';
import { InboxAiOption } from '../../../utils/inboxService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

jest.mock('../../../store/useStore', () => ({
    useStore: () => ({
        tagsStore: { tags: [{ id: 7, uid: 't-home', name: 'Home' }] },
    }),
}));

jest.mock('../QuickCaptureInput', () => ({
    __esModule: true,
    default: function MockQuickCaptureInput(props: any) {
        return <div>{props.renderFooterActions?.({})}</div>;
    },
}));

const noop = () => {};

const item = {
    uid: 'abc123',
    content: 'call plumber about the kitchen sink by friday',
    title: null,
    created_at: '2026-10-01T09:00:00Z',
};

const option = (extra: Partial<InboxAiOption> = {}): InboxAiOption => ({
    kind: 'task',
    confidence: 'sure',
    title: 'Call the plumber about the kitchen sink',
    project_uid: 'p-home',
    project_name: 'Home renovation',
    tags: ['home'],
    due_date: '2026-10-02',
    reason: 'One concrete call with a deadline',
    analysis: 'A single phone call to make, so a task rather than a note.',
    why: {
        title: 'Starts with the action',
        project: 'Kitchen sink, matches Home renovation',
        tags: '',
        due_date: "'by friday', counted from the capture date",
    },
    ...extra,
});

const suggestionOf = (...options: InboxAiOption[]) => ({
    item_uid: 'abc123',
    options,
});

const renderItem = (
    props: Partial<React.ComponentProps<typeof InboxItemDetail>> = {}
) => {
    const handlers = {
        openTaskModal: jest.fn(),
        openNoteModal: jest.fn(),
        openProjectModal: jest.fn(),
        onAiSuggest: jest.fn(),
        onDismissAiSuggestion: jest.fn(),
    };
    render(
        <InboxItemDetail
            item={item as any}
            onDelete={noop}
            projects={[]}
            aiEnabled
            {...handlers}
            {...props}
        />
    );
    return handlers;
};

describe('InboxItemDetail - AI assist', () => {
    it('shows nothing extra without a suggestion', () => {
        renderItem();

        expect(
            screen.queryByTestId('inbox-item-with-suggestion')
        ).not.toBeInTheDocument();
    });

    it('says what it suggests and asks before creating anything', () => {
        renderItem({ aiSuggestion: suggestionOf(option()) });

        expect(
            screen.getByTestId('inbox-item-with-suggestion')
        ).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Task/ })).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(screen.getByText('Create this task?')).toBeInTheDocument();
        expect(screen.getByTestId('inbox-ai-no')).toBeInTheDocument();
    });

    it('opens the task modal prefilled with the suggestion on Yes', () => {
        const { openTaskModal } = renderItem({
            aiSuggestion: suggestionOf(option()),
        });

        fireEvent.click(screen.getByTestId('inbox-ai-yes'));

        expect(openTaskModal).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Call the plumber about the kitchen sink',
                project_uid: 'p-home',
                due_date: '2026-10-02',
                tags: [{ id: 7, uid: 't-home', name: 'Home' }],
            }),
            'abc123'
        );
    });

    it('lists the alternatives and accepts the one picked', () => {
        const { openNoteModal, openTaskModal } = renderItem({
            aiSuggestion: suggestionOf(
                option(),
                option({ kind: 'note', title: 'Plumber contact' })
            ),
        });

        expect(screen.getAllByTestId('inbox-ai-option')).toHaveLength(2);
        fireEvent.click(screen.getByRole('tab', { name: /Note/ }));
        expect(screen.getByText('Create this note?')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('inbox-ai-yes'));

        expect(openTaskModal).not.toHaveBeenCalled();
        expect(openNoteModal).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Plumber contact',
                content: item.content,
            }),
            'abc123'
        );
    });

    it('marks a best guess for an unclear item', () => {
        renderItem({
            aiSuggestion: suggestionOf(
                option({ kind: 'note', confidence: 'guess', title: 'Photo' })
            ),
        });

        expect(
            screen.getByText('Best guess, item is unclear')
        ).toBeInTheDocument();
        expect(screen.getByTestId('inbox-ai-yes').className).toContain(
            'bg-amber'
        );
    });

    it('explains the choice and each field up front', () => {
        renderItem({ aiSuggestion: suggestionOf(option()) });

        const why = screen.getByTestId('inbox-ai-why');
        expect(why).toHaveTextContent(
            'A single phone call to make, so a task rather than a note.'
        );
        expect(why).toHaveTextContent('Kitchen sink, matches Home renovation');
        expect(why).toHaveTextContent(
            "'by friday', counted from the capture date"
        );
        expect(screen.getByTitle('Tags')).toBeInTheDocument();
        expect(why.querySelectorAll('[title]')).toHaveLength(3);
    });

    it('offers no create button for an item to keep', () => {
        const { onDismissAiSuggestion } = renderItem({
            aiSuggestion: suggestionOf(option({ kind: 'keep', title: '' })),
        });

        expect(screen.queryByTestId('inbox-ai-yes')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('inbox-ai-no'));
        expect(onDismissAiSuggestion).toHaveBeenCalledWith('abc123');
    });

    it('asks the AI about one item from the edit footer', () => {
        const { onAiSuggest } = renderItem();

        fireEvent.click(screen.getByText(item.content));
        fireEvent.click(screen.getByTestId('inbox-item-ai-assist'));

        expect(onAiSuggest).toHaveBeenCalledWith('abc123');
    });

    it('hides the footer AI button when no provider is set up', () => {
        renderItem({ aiEnabled: false });

        fireEvent.click(screen.getByText(item.content));

        expect(
            screen.queryByTestId('inbox-item-ai-assist')
        ).not.toBeInTheDocument();
    });
});
