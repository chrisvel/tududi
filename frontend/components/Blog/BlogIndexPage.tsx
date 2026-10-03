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
const introOf = (content: string) =>
    content
        .split(/\n\s*\n/)
        .filter((p) => !/^(\s*\[\[[^[\]\n]+?\]\]\s*)+$/.test(p))
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

    return (
        <BlogLayout {...props} links={blog?.links ?? null}>
            <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10 sm:pt-24 sm:pb-14">
                <h1
                    className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.05] text-gray-900 dark:text-white"
                    data-testid="blog-title"
                >
                    {BLOG_TITLE}
                </h1>
                <p className="mt-3 text-xl sm:text-2xl font-medium text-gray-500 dark:text-gray-400">
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
                            <div
                                className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8"
                                data-testid="blog-posts"
                            >
                                {blog.posts.map((post) => (
                                    <BlogPostCard
                                        key={post.slug}
                                        post={post}
                                        basePath={props.basePath}
                                    />
                                ))}
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
