import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskComments from '../TaskComments';
import { Task } from '../../../entities/Task';
import { Comment } from '../../../entities/Comment';
import {
    fetchComments,
    createComment,
    deleteComment,
    setCommentReaction,
} from '../../../utils/commentsService';
import { fetchPeople } from '../../../utils/peopleService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

jest.mock('react-router-dom', () => ({
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
    useNavigate: () => jest.fn(),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/commentsService', () => ({
    fetchComments: jest.fn(),
    createComment: jest.fn(),
    deleteComment: jest.fn(),
    setCommentReaction: jest.fn(),
}));

jest.mock('../../../utils/peopleService', () => ({
    fetchPeople: jest.fn(),
    fetchAssignablePeopleForProject: jest.fn(),
}));

// The composer is a contentEditable div (no .value/.selectionStart), so
// simulating typing means mutating its DOM directly, placing a real
// Selection at the end of the text, then firing the native `input` event
// React listens for. `index` picks which editor when more than one is on
// screen (the main composer plus an open reply composer).
function typeIntoComposer(container: HTMLElement, text: string, index = 0) {
    const editor = container.querySelectorAll('[contenteditable="true"]')[
        index
    ] as HTMLElement;
    editor.textContent = text;
    const textNode = editor.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, text.length);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent.input(editor);
    return editor;
}

const task = { id: 1, uid: 'task-1', name: 'Task' } as Task;

const baseComment: Comment = {
    uid: 'comment-1',
    task_id: 1,
    body: 'First comment',
    mentioned_person_uids: [],
    mentioned_people: [],
    created_at: new Date().toISOString(),
    deleted_at: null,
    author: {
        uid: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        person_uid: 'person-alice',
    },
    is_own: false,
    replies: [],
    likes_count: 0,
    dislikes_count: 0,
    my_reaction: null,
};

const ownComment: Comment = {
    ...baseComment,
    uid: 'comment-own',
    body: 'My own comment',
    is_own: true,
};

describe('TaskComments', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fetchPeople as jest.Mock).mockResolvedValue([
            { uid: 'person-1', name: 'Bob', archived: false },
        ]);
    });

    it('renders existing comments and reports the count', async () => {
        (fetchComments as jest.Mock).mockResolvedValue([baseComment]);
        const onCommentCountChange = jest.fn();

        render(
            <TaskComments
                task={task}
                onCommentCountChange={onCommentCountChange}
            />
        );

        expect(await screen.findByText('First comment')).toBeInTheDocument();
        const authorLink = screen.getByRole('link', { name: 'Alice' });
        expect(authorLink).toHaveAttribute('href', '/person/person-alice');
        expect(onCommentCountChange).toHaveBeenCalledWith(1);
    });

    it('shows the empty state when there are no comments', async () => {
        (fetchComments as jest.Mock).mockResolvedValue([]);

        render(<TaskComments task={task} />);

        expect(await screen.findByText('No comments yet')).toBeInTheDocument();
    });

    it('submits a new comment and appends it to the list', async () => {
        (fetchComments as jest.Mock).mockResolvedValue([]);
        const posted: Comment = {
            ...baseComment,
            uid: 'comment-2',
            body: 'Hello there',
        };
        (createComment as jest.Mock).mockResolvedValue(posted);

        const { container } = render(<TaskComments task={task} />);
        await screen.findByText('No comments yet');

        typeIntoComposer(container, 'Hello there');
        fireEvent.click(screen.getByText('Comment'));

        await waitFor(() =>
            expect(createComment).toHaveBeenCalledWith('task-1', {
                body: 'Hello there',
                mentionedPersonUids: [],
            })
        );
        expect(await screen.findByText('Hello there')).toBeInTheDocument();
    });

    it('opens the mention suggestions dropdown on @ and inserts the picked person as a chip', async () => {
        (fetchComments as jest.Mock).mockResolvedValue([]);

        const { container } = render(<TaskComments task={task} />);
        await screen.findByText('No comments yet');

        const editor = typeIntoComposer(container, 'Hey @Bo');

        expect(await screen.findByText('@Bob')).toBeInTheDocument();

        fireEvent.click(screen.getByText('@Bob'));

        await waitFor(() => expect(editor.textContent).toBe('Hey @Bob '));
        const chip = editor.querySelector('a[data-person-uid="person-1"]');
        expect(chip).toHaveTextContent('@Bob');

        (createComment as jest.Mock).mockResolvedValue({
            ...baseComment,
            uid: 'comment-3',
            body: 'Hey @Bob ',
            mentioned_person_uids: ['person-1'],
            mentioned_people: [{ uid: 'person-1', name: 'Bob' }],
        });
        fireEvent.click(screen.getByText('Comment'));

        await waitFor(() =>
            expect(createComment).toHaveBeenCalledWith('task-1', {
                body: 'Hey @Bob',
                mentionedPersonUids: ['person-1'],
            })
        );
    });

    it('renders a mention in the comment body as a link to that person', async () => {
        const mentionComment: Comment = {
            ...baseComment,
            uid: 'comment-mention',
            body: 'Hey @Bob, can you take this?',
            mentioned_person_uids: ['person-1'],
            mentioned_people: [{ uid: 'person-1', name: 'Bob' }],
        };
        (fetchComments as jest.Mock).mockResolvedValue([mentionComment]);

        render(<TaskComments task={task} />);

        const link = await screen.findByRole('link', { name: '@Bob' });
        expect(link).toHaveAttribute('href', '/person/person-1');
    });

    it('replaces a deleted comment with a placeholder instead of removing it', async () => {
        (fetchComments as jest.Mock).mockResolvedValue([ownComment]);
        (deleteComment as jest.Mock).mockResolvedValue({
            ...ownComment,
            body: '',
            mentioned_person_uids: [],
            mentioned_people: [],
            deleted_at: new Date().toISOString(),
        });
        const onCommentCountChange = jest.fn();

        render(
            <TaskComments
                task={task}
                onCommentCountChange={onCommentCountChange}
            />
        );
        await screen.findByText('My own comment');

        fireEvent.click(screen.getByLabelText('Delete comment'));
        fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

        await waitFor(() =>
            expect(deleteComment).toHaveBeenCalledWith('comment-own')
        );
        expect(await screen.findByText('Comment deleted')).toBeInTheDocument();
        expect(screen.queryByText('My own comment')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Delete comment')).toBeNull();
        expect(onCommentCountChange).toHaveBeenLastCalledWith(0);
    });

    it('keeps a reply visible after its parent comment is deleted', async () => {
        const reply: Comment = {
            ...baseComment,
            uid: 'comment-reply',
            body: 'A reply',
        };
        const parent: Comment = {
            ...ownComment,
            uid: 'comment-parent',
            body: 'Parent comment',
            replies: [reply],
        };
        (fetchComments as jest.Mock).mockResolvedValue([parent]);
        // The tombstone response never carries replies of its own - deleting
        // a comment doesn't touch them.
        (deleteComment as jest.Mock).mockResolvedValue({
            ...parent,
            body: '',
            mentioned_person_uids: [],
            mentioned_people: [],
            deleted_at: new Date().toISOString(),
            replies: [],
        });

        render(<TaskComments task={task} />);
        await screen.findByText('Parent comment');

        fireEvent.click(screen.getByLabelText('Delete comment'));
        fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

        await waitFor(() =>
            expect(deleteComment).toHaveBeenCalledWith('comment-parent')
        );
        expect(await screen.findByText('Comment deleted')).toBeInTheDocument();
        expect(screen.getByText('A reply')).toBeInTheDocument();
    });

    describe('replies', () => {
        it('opens a reply composer and nests the posted reply under its parent', async () => {
            const parent: Comment = {
                ...baseComment,
                uid: 'comment-parent',
                body: 'Parent comment',
            };
            (fetchComments as jest.Mock).mockResolvedValue([parent]);
            const postedReply: Comment = {
                ...baseComment,
                uid: 'comment-reply',
                body: 'A reply',
                is_own: true,
            };
            (createComment as jest.Mock).mockResolvedValue(postedReply);
            const onCommentCountChange = jest.fn();

            const { container } = render(
                <TaskComments
                    task={task}
                    onCommentCountChange={onCommentCountChange}
                />
            );
            await screen.findByText('Parent comment');

            fireEvent.click(screen.getByText('Reply'));

            const editors = container.querySelectorAll(
                '[contenteditable="true"]'
            );
            expect(editors).toHaveLength(2);

            typeIntoComposer(container, 'A reply', 0);
            // Two "Reply" buttons are on screen now: the toggle and the
            // open composer's submit button (the latter renders second).
            const replyButtons = screen.getAllByRole('button', {
                name: 'Reply',
            });
            fireEvent.click(replyButtons[replyButtons.length - 1]);

            await waitFor(() =>
                expect(createComment).toHaveBeenCalledWith('task-1', {
                    body: 'A reply',
                    mentionedPersonUids: [],
                    parentCommentUid: 'comment-parent',
                })
            );
            expect(await screen.findByText('A reply')).toBeInTheDocument();
            expect(onCommentCountChange).toHaveBeenLastCalledWith(2);
            // The reply composer closes after a successful post.
            expect(
                container.querySelectorAll('[contenteditable="true"]')
            ).toHaveLength(1);
        });

        it('does not offer a Reply action on a reply itself', async () => {
            const reply: Comment = {
                ...baseComment,
                uid: 'comment-reply',
                body: 'A reply',
            };
            const parent: Comment = {
                ...baseComment,
                uid: 'comment-parent',
                body: 'Parent comment',
                replies: [reply],
            };
            (fetchComments as jest.Mock).mockResolvedValue([parent]);

            render(<TaskComments task={task} />);
            await screen.findByText('A reply');

            // Only the parent's Reply action exists.
            expect(screen.getAllByText('Reply')).toHaveLength(1);
        });
    });

    describe('reactions', () => {
        it('likes a comment and shows the updated count', async () => {
            const comment: Comment = {
                ...baseComment,
                uid: 'comment-1',
                body: 'Nice work',
            };
            (fetchComments as jest.Mock).mockResolvedValue([comment]);
            (setCommentReaction as jest.Mock).mockResolvedValue({
                uid: 'comment-1',
                likes_count: 1,
                dislikes_count: 0,
                my_reaction: 'like',
            });

            render(<TaskComments task={task} />);
            await screen.findByText('Nice work');

            fireEvent.click(screen.getByLabelText('Like'));

            await waitFor(() =>
                expect(setCommentReaction).toHaveBeenCalledWith(
                    'comment-1',
                    'like'
                )
            );
            expect(await screen.findByText('1')).toBeInTheDocument();
        });

        it('clicking Like again clears the reaction (toggle off)', async () => {
            const comment: Comment = {
                ...baseComment,
                uid: 'comment-1',
                body: 'Nice work',
                likes_count: 1,
                my_reaction: 'like',
            };
            (fetchComments as jest.Mock).mockResolvedValue([comment]);
            (setCommentReaction as jest.Mock).mockResolvedValue({
                uid: 'comment-1',
                likes_count: 0,
                dislikes_count: 0,
                my_reaction: null,
            });

            render(<TaskComments task={task} />);
            await screen.findByText('Nice work');

            fireEvent.click(screen.getByLabelText('Like'));

            await waitFor(() =>
                expect(setCommentReaction).toHaveBeenCalledWith(
                    'comment-1',
                    null
                )
            );
        });

        it('disliking after liking switches the reaction', async () => {
            const comment: Comment = {
                ...baseComment,
                uid: 'comment-1',
                body: 'Nice work',
                likes_count: 1,
                my_reaction: 'like',
            };
            (fetchComments as jest.Mock).mockResolvedValue([comment]);
            (setCommentReaction as jest.Mock).mockResolvedValue({
                uid: 'comment-1',
                likes_count: 0,
                dislikes_count: 1,
                my_reaction: 'dislike',
            });

            render(<TaskComments task={task} />);
            await screen.findByText('Nice work');

            fireEvent.click(screen.getByLabelText('Dislike'));

            await waitFor(() =>
                expect(setCommentReaction).toHaveBeenCalledWith(
                    'comment-1',
                    'dislike'
                )
            );
        });
    });
});
