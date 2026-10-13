import { getApiPath } from '../config/paths';
import { fetchWithCsrf } from './csrfService';

export interface BlogLinks {
    landing: string;
    cloud: string;
    app: string;
    register: string;
    pricing: { currency: string; monthly: number; annual: number };
}

export interface BlogPostLink {
    title: string;
    slug: string;
}

export interface BlogPostCard extends BlogPostLink {
    excerpt: string;
    cover: string | null;
    published_at: string | null;
}

export interface BlogIndex {
    title: string;
    content: string;
    excerpt: string;
    linked_notes: BlogPostLink[];
    posts: BlogPostCard[];
    links: BlogLinks;
}

export interface BlogPost {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    color: string | null;
    background: string | null;
    published_at: string | null;
    updated_at: string | null;
    linked_notes: BlogPostLink[];
    more: BlogPostCard[];
    links: BlogLinks;
}

// What the admin area shows about the blog.
export interface BlogStatus {
    note_uid: string | null;
    note: { uid: string; title: string; shared: boolean } | null;
    posts: BlogPostLink[];
    blog_url: string | null;
}

// The blog's name, in two lines, and as one sentence for the browser tab.
// The server repeats the tagline and full name in modules/blog/hostSwitch.js.
export const BLOG_TITLE = 'Let’s take control…';
export const BLOG_TAGLINE = '…before someone else does.';
export const BLOG_NAME = 'Let’s take control… before someone else does.';

// null means there is nothing to show: no front page note is picked, it is
// not shared, or the post is not on the blog.
const readPublic = async <T>(path: string): Promise<T | null> => {
    const response = await fetch(getApiPath(path), {
        headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Could not load the blog.');
    return response.json();
};

export const fetchBlogIndex = (): Promise<BlogIndex | null> =>
    readPublic<BlogIndex>('public/blog');

export const fetchBlogPost = (slug: string): Promise<BlogPost | null> =>
    readPublic<BlogPost>(`public/blog/posts/${encodeURIComponent(slug)}`);

const readStatus = async (response: Response): Promise<BlogStatus> => {
    if (response.ok) return response.json();
    let message = 'Could not save the blog settings.';
    try {
        const body = await response.json();
        message = body.error || body.message || message;
    } catch {
        // keep the fallback message
    }
    throw new Error(message);
};

export const fetchBlogStatus = async (): Promise<BlogStatus> =>
    readStatus(
        await fetch(getApiPath('admin/blog'), {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        })
    );

// Takes a note uid or a pasted note link; an empty value turns the blog off.
export const saveBlogNote = async (note: string): Promise<BlogStatus> =>
    readStatus(
        await fetchWithCsrf(getApiPath('admin/blog'), {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ note }),
        })
    );
