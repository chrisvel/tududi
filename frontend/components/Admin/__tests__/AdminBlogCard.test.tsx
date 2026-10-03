import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import AdminBlogCard from '../AdminBlogCard';

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

const fetchBlogStatus = jest.fn();
const saveBlogNote = jest.fn();
jest.mock('../../../utils/blogService', () => ({
    fetchBlogStatus: () => fetchBlogStatus(),
    saveBlogNote: (note: string) => saveBlogNote(note),
}));

const renderCard = () =>
    render(
        <MemoryRouter>
            <AdminBlogCard />
        </MemoryRouter>
    );

const empty = { note_uid: null, note: null, posts: [], blog_url: null };

beforeEach(() => {
    fetchBlogStatus.mockReset();
    saveBlogNote.mockReset();
});

describe('AdminBlogCard', () => {
    it('saves a pasted note link and shows the posts it yields', async () => {
        fetchBlogStatus.mockResolvedValue(empty);
        saveBlogNote.mockResolvedValue({
            note_uid: 'abc123def456ghi',
            note: { uid: 'abc123def456ghi', title: 'Blog', shared: true },
            posts: [{ title: 'Why Cloud', slug: 'why-cloud' }],
            blog_url: 'https://blog.tududi.com',
        });
        renderCard();

        const input = await screen.findByTestId('admin-blog-input');
        fireEvent.change(input, {
            target: { value: 'https://app.tududi.com/notes/abc123def456ghi' },
        });
        fireEvent.click(screen.getByText('Save'));

        await waitFor(() =>
            expect(saveBlogNote).toHaveBeenCalledWith(
                'https://app.tududi.com/notes/abc123def456ghi'
            )
        );
        expect(await screen.findByText('Public')).toBeInTheDocument();
        expect(screen.getByText(/Posts: 1 · Why Cloud/)).toBeInTheDocument();
        expect(screen.getByText('Open the blog')).toHaveAttribute(
            'href',
            'https://blog.tududi.com'
        );
        expect(input).toHaveValue('abc123def456ghi');
    });

    it('warns when the picked note is not shared', async () => {
        fetchBlogStatus.mockResolvedValue({
            note_uid: 'abc123def456ghi',
            note: { uid: 'abc123def456ghi', title: 'Blog', shared: false },
            posts: [],
            blog_url: null,
        });
        renderCard();
        expect(await screen.findByText(/Not shared yet/)).toBeInTheDocument();
        expect(screen.queryByText('Open the blog')).not.toBeInTheDocument();
    });

    it('turns the blog off and shows a refused pick', async () => {
        fetchBlogStatus.mockResolvedValue({
            note_uid: 'abc123def456ghi',
            note: { uid: 'abc123def456ghi', title: 'Blog', shared: true },
            posts: [],
            blog_url: null,
        });
        saveBlogNote.mockResolvedValueOnce(empty);
        renderCard();

        fireEvent.click(await screen.findByText('Turn off'));
        await waitFor(() => expect(saveBlogNote).toHaveBeenCalledWith(''));
        expect(await screen.findByTestId('admin-blog-input')).toHaveValue('');

        saveBlogNote.mockRejectedValueOnce(
            new Error('Pick one of your own notes.')
        );
        fireEvent.change(screen.getByTestId('admin-blog-input'), {
            target: { value: 'theirs' },
        });
        fireEvent.click(screen.getByText('Save'));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Pick one of your own notes.'
        );
    });
});
