import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BlogApp from '../BlogApp';

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
        i18n: { language: 'en' },
    }),
}));

jest.mock('../../Shared/MarkdownRenderer', () => ({
    __esModule: true,
    default: ({
        content,
        publicNoteLinks,
        publicNoteHref,
    }: {
        content: string;
        publicNoteLinks?: { title: string; slug?: string }[];
        publicNoteHref?: (link: { title: string; slug?: string }) => string;
    }) => (
        <div data-testid="markdown">
            {content}
            {(publicNoteLinks || []).map((link) => (
                <a key={link.title} href={publicNoteHref?.(link)}>
                    {link.title}
                </a>
            ))}
        </div>
    ),
}));

const fetchBlogIndex = jest.fn();
const fetchBlogPost = jest.fn();
jest.mock('../../../utils/blogService', () => ({
    ...jest.requireActual('../../../utils/blogService'),
    fetchBlogIndex: () => fetchBlogIndex(),
    fetchBlogPost: (slug: string) => fetchBlogPost(slug),
}));

const links = {
    landing: 'https://tududi.com',
    cloud: 'https://tududi.com/cloud',
    app: 'https://app.tududi.com',
    register: 'https://app.tududi.com/register',
    pricing: { currency: 'EUR', monthly: 5, annual: 50 },
};

const card = (title: string, slug: string) => ({
    title,
    slug,
    excerpt: `${title} excerpt`,
    cover: null,
    published_at: '2026-10-02T10:00:00.000Z',
});

const renderAt = (path: string, basePath = '/blog') =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route
                    path={basePath ? `${basePath}/*` : '/*'}
                    element={
                        <BlogApp
                            basePath={basePath}
                            isDarkMode={false}
                            toggleDarkMode={jest.fn()}
                        />
                    }
                />
            </Routes>
        </MemoryRouter>
    );

beforeEach(() => {
    fetchBlogIndex.mockReset();
    fetchBlogPost.mockReset();
    window.scrollTo = jest.fn();
});

describe('Blog front page', () => {
    it('shows the blog name, the intro and a card per post', async () => {
        fetchBlogIndex.mockResolvedValue({
            title: 'Blog',
            content:
                'Writing about tududi.\n\n[[How to organize a family]]\n\n[[Why Cloud]]',
            excerpt: 'Writing about tududi.',
            linked_notes: [],
            posts: [
                card('How to organize a family', 'how-to-organize-a-family'),
                card('Why Cloud', 'why-cloud'),
            ],
            links,
        });
        renderAt('/blog');

        expect(screen.getByTestId('blog-title')).toHaveTextContent(
            'Take control of your life'
        );
        expect(
            screen.getByText('before someone else does.')
        ).toBeInTheDocument();

        const cards = await screen.findAllByTestId('blog-post-card');
        expect(cards).toHaveLength(2);
        expect(cards[0]).toHaveAttribute(
            'href',
            '/blog/how-to-organize-a-family'
        );
        // The link-only paragraphs are the cards, not part of the intro.
        expect(screen.getByTestId('markdown')).toHaveTextContent(
            'Writing about tududi.'
        );
        expect(screen.getByTestId('markdown')).not.toHaveTextContent('[[');
        expect(screen.getByTestId('blog-cta-price')).toHaveTextContent(
            '€5 a month or €50 a year'
        );
        expect(screen.getByTestId('blog-nav-cta')).toHaveAttribute(
            'href',
            links.register
        );
    });

    it('says so when there is no blog yet', async () => {
        fetchBlogIndex.mockResolvedValue(null);
        renderAt('/blog');
        expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
        expect(screen.queryByTestId('blog-cta')).not.toBeInTheDocument();
    });

    it('links cards from the root on the blog host', async () => {
        fetchBlogIndex.mockResolvedValue({
            title: 'Blog',
            content: '',
            excerpt: '',
            linked_notes: [],
            posts: [card('Why Cloud', 'why-cloud')],
            links,
        });
        renderAt('/', '');
        const [first] = await screen.findAllByTestId('blog-post-card');
        expect(first).toHaveAttribute('href', '/why-cloud');
    });
});

describe('Blog post', () => {
    it('renders the post, its links to other posts and the offer', async () => {
        fetchBlogPost.mockResolvedValue({
            title: 'How to organize a family',
            slug: 'how-to-organize-a-family',
            content: 'A family is not a team.',
            excerpt: 'A family is not a team.',
            color: null,
            background: null,
            published_at: '2026-10-02T10:00:00.000Z',
            updated_at: '2026-10-03T10:00:00.000Z',
            linked_notes: [{ title: 'Weekly review', slug: 'weekly-review' }],
            more: [card('Why Cloud', 'why-cloud')],
            links,
        });
        renderAt('/blog/how-to-organize-a-family');

        await waitFor(() =>
            expect(fetchBlogPost).toHaveBeenCalledWith(
                'how-to-organize-a-family'
            )
        );
        expect(
            await screen.findByRole('heading', {
                name: 'How to organize a family',
            })
        ).toBeInTheDocument();
        expect(screen.getByTestId('blog-post')).toHaveTextContent(
            'October 2, 2026'
        );
        expect(screen.getByText('Weekly review')).toHaveAttribute(
            'href',
            '/blog/weekly-review'
        );
        expect(screen.getByTestId('blog-cta')).toBeInTheDocument();
        expect(screen.getByTestId('blog-post-card')).toHaveAttribute(
            'href',
            '/blog/why-cloud'
        );
        expect(document.title).toBe('How to organize a family | tududi');
    });

    it('says so when the post is not on the blog', async () => {
        fetchBlogPost.mockResolvedValue(null);
        renderAt('/blog/nope');
        expect(
            await screen.findByText('This post is not here')
        ).toBeInTheDocument();
        expect(screen.getByText(/All posts/)).toHaveAttribute('href', '/blog');
    });
});
