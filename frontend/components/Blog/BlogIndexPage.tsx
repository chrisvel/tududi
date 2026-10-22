import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import {
    BLOG_NAME,
    BLOG_TAGLINE,
    BLOG_TITLE,
    BlogIndex,
    fetchBlogIndex,
} from '../../utils/blogService';
import BlogLayout, { BlogPageProps } from './BlogLayout';
import BlogPostCard from './BlogPostCard';
import BlogCta from './BlogCta';
import BlogMessage from './BlogMessage';

type Stage = 'loading' | 'ready' | 'unavailable' | 'failed';

// Paragraphs that are nothing but [[links]] are the post list in the front
// page note; the cards below show those, so the intro leaves them out.
const WIKILINK = /\[\[[^[\]\n]+\]\]/g;
const isLinkList = (paragraph: string) =>
    paragraph.includes('[[') && paragraph.replace(WIKILINK, '').trim() === '';
const introOf = (content: string) =>
    content
        .split(/\n\s*\n/)
        .filter((p) => !isLinkList(p))
        .join('\n\n')
        .trim();

const BlogIndexPage: React.FC<BlogPageProps> = (props) => {
    const { t } = useTranslation();
    const [stage, setStage] = useState<Stage>('loading');
    const [blog, setBlog] = useState<BlogIndex | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchBlogIndex()
            .then((result) => {
                if (cancelled) return;
                setBlog(result);
                setStage(result ? 'ready' : 'unavailable');
            })
            .catch(() => {
                if (!cancelled) setStage('failed');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const previous = document.title;
        document.title = `${BLOG_NAME} | tududi`;
        return () => {
            document.title = previous;
        };
    }, []);

    const intro = blog ? introOf(blog.content) : '';
    const [featured, ...rest] = blog?.posts ?? [];

    return (
        <BlogLayout {...props} links={blog?.links ?? null}>
            <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 sm:pt-16 sm:pb-10">
                <h1
                    className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-gray-900 dark:text-white"
                    data-testid="blog-title"
                >
                    {BLOG_TITLE}
                </h1>
                <p className="mt-3 max-w-2xl text-lg sm:text-xl text-gray-600 dark:text-gray-400">
                    {BLOG_TAGLINE}
                </p>
            </header>

            <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {stage === 'loading' && (
                    <p className="text-gray-500 dark:text-gray-400">
                        {t('common.loading', 'Loading...')}
                    </p>
                )}
                {stage === 'unavailable' && (
                    <BlogMessage
                        title={t('blog.emptyTitle', 'Nothing here yet')}
                        body={t(
                            'blog.emptyBody',
                            'The first posts are on their way. Come back soon.'
                        )}
                    />
                )}
                {stage === 'failed' && (
                    <BlogMessage
                        title={t('blog.failedTitle', 'Could not load the blog')}
                        body={t(
                            'blog.failedBody',
                            'Something went wrong on our side. Try again in a moment.'
                        )}
                    />
                )}

                {stage === 'ready' && blog && (
                    <>
                        {intro && (
                            <div className="max-w-3xl mb-12 text-lg">
                                <MarkdownRenderer
                                    content={intro}
                                    publicNoteLinks={blog.linked_notes}
                                    publicNoteHref={(link) =>
                                        `${props.basePath}/${link.slug}`
                                    }
                                />
                            </div>
                        )}
                        {blog.posts.length > 0 ? (
                            <div data-testid="blog-posts">
                                <BlogPostCard
                                    post={featured}
                                    basePath={props.basePath}
                                    featured
                                />
                                {rest.length > 0 && (
                                    <section className="mt-14">
                                        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
                                            {t(
                                                'blog.morePosts',
                                                'More from the blog'
                                            )}
                                        </h2>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {rest.map((post) => (
                                                <BlogPostCard
                                                    key={post.slug}
                                                    post={post}
                                                    basePath={props.basePath}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </div>
                        ) : (
                            <BlogMessage
                                title={t('blog.emptyTitle', 'Nothing here yet')}
                                body={t(
                                    'blog.emptyBody',
                                    'The first posts are on their way. Come back soon.'
                                )}
                            />
                        )}
                        <div className="mt-16">
                            <BlogCta links={blog.links} />
                        </div>
                    </>
                )}
            </main>
        </BlogLayout>
    );
};

export default BlogIndexPage;
