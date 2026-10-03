import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import PhotoCredit from '../Shared/PhotoCredit';
import {
    CONTENT_BACKGROUND_OVERLAY,
    contentBackgroundUrl,
    findContentBackground,
} from '../../constants/contentBackgrounds';
import { BlogPost, fetchBlogPost } from '../../utils/blogService';
import BlogLayout, { BlogPageProps } from './BlogLayout';
import BlogPostCard, { formatPostDate } from './BlogPostCard';
import BlogCta from './BlogCta';
import BlogMessage from './BlogMessage';

type Stage = 'loading' | 'ready' | 'unavailable' | 'failed';

const BlogPostPage: React.FC<BlogPageProps> = (props) => {
    const { t, i18n } = useTranslation();
    const { slug = '' } = useParams<{ slug: string }>();
    const [stage, setStage] = useState<Stage>('loading');
    const [post, setPost] = useState<BlogPost | null>(null);

    useEffect(() => {
        let cancelled = false;
        setStage('loading');
        fetchBlogPost(slug)
            .then((result) => {
                if (cancelled) return;
                setPost(result);
                setStage(result ? 'ready' : 'unavailable');
                window.scrollTo(0, 0);
            })
            .catch(() => {
                if (!cancelled) setStage('failed');
            });
        return () => {
            cancelled = true;
        };
    }, [slug]);

    useEffect(() => {
        const previous = document.title;
        if (post?.title) document.title = `${post.title} | tududi`;
        return () => {
            document.title = previous;
        };
    }, [post]);

    const photo =
        stage === 'ready' ? findContentBackground(post?.background) : undefined;
    const noteColor =
        post?.color && /^#[0-9a-f]{6}$/i.test(post.color)
            ? post.color
            : undefined;
    // Light text on dark note colors, as on the public note page.
    const lightText =
        !!noteColor &&
        (0.299 * parseInt(noteColor.slice(1, 3), 16) +
            0.587 * parseInt(noteColor.slice(3, 5), 16) +
            0.114 * parseInt(noteColor.slice(5, 7), 16)) /
            255 <
            0.4;
    const date = formatPostDate(post?.published_at ?? null, i18n.language);

    return (
        <BlogLayout {...props} links={post?.links ?? null}>
            {photo && (
                <>
                    <div
                        aria-hidden="true"
                        className="fixed inset-0 bg-cover bg-center"
                        style={{
                            backgroundImage: `url(${contentBackgroundUrl(photo)})`,
                        }}
                    />
                    <div
                        aria-hidden="true"
                        className={`fixed inset-0 ${CONTENT_BACKGROUND_OVERLAY}`}
                    />
                    <PhotoCredit
                        background={photo}
                        className="fixed bottom-3 left-3 z-10"
                    />
                </>
            )}

            <main className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
                <div className="max-w-3xl mx-auto">
                    <Link
                        to={props.basePath || '/'}
                        className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                        &larr; {t('blog.allPosts', 'All posts')}
                    </Link>
                </div>

                {stage === 'loading' && (
                    <p className="max-w-3xl mx-auto mt-8 text-gray-500 dark:text-gray-400">
                        {t('common.loading', 'Loading...')}
                    </p>
                )}
                {stage === 'unavailable' && (
                    <div className="max-w-3xl mx-auto mt-8">
                        <BlogMessage
                            title={t(
                                'blog.missingTitle',
                                'This post is not here'
                            )}
                            body={t(
                                'blog.missingBody',
                                'It may have moved or been taken down. The other posts are one click away.'
                            )}
                        />
                    </div>
                )}
                {stage === 'failed' && (
                    <div className="max-w-3xl mx-auto mt-8">
                        <BlogMessage
                            title={t(
                                'blog.failedTitle',
                                'Could not load the blog'
                            )}
                            body={t(
                                'blog.failedBody',
                                'Something went wrong on our side. Try again in a moment.'
                            )}
                        />
                    </div>
                )}

                {stage === 'ready' && post && (
                    <>
                        <article
                            className={`max-w-3xl mx-auto mt-6 rounded-3xl px-6 py-8 sm:px-12 sm:py-12 shadow-sm break-words ${noteColor ? '' : 'bg-white dark:bg-gray-800'} ${photo ? 'backdrop-blur-sm' : ''}`}
                            style={
                                noteColor
                                    ? {
                                          backgroundColor: `${noteColor}f2`,
                                          color: lightText
                                              ? '#ffffff'
                                              : '#333333',
                                      }
                                    : undefined
                            }
                            data-testid="blog-post"
                        >
                            <header className="mb-8">
                                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                                    {post.title}
                                </h1>
                                {date && (
                                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                        {date}
                                    </p>
                                )}
                            </header>
                            <div className="text-lg leading-relaxed">
                                <MarkdownRenderer
                                    content={post.content}
                                    noteColor={noteColor}
                                    publicNoteLinks={post.linked_notes}
                                    publicNoteHref={(link) =>
                                        `${props.basePath}/${link.slug}`
                                    }
                                />
                            </div>
                        </article>

                        <div className="max-w-5xl mx-auto mt-12">
                            <BlogCta links={post.links} />
                        </div>

                        {post.more.length > 0 && (
                            <section className="max-w-5xl mx-auto mt-16">
                                <h2 className="text-2xl font-bold tracking-tight mb-6">
                                    {t('blog.morePosts', 'More from the blog')}
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {post.more.map((more) => (
                                        <BlogPostCard
                                            key={more.slug}
                                            post={more}
                                            basePath={props.basePath}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </main>
        </BlogLayout>
    );
};

export default BlogPostPage;
