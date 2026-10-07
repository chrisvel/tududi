import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PublicNoteArticle, {
    PublicNoteBackground,
} from '../PublicNote/PublicNoteArticle';
import { BlogPost, fetchBlogPost } from '../../utils/blogService';
import BlogLayout, { BlogPageProps } from './BlogLayout';
import BlogPostCard from './BlogPostCard';
import BlogCta from './BlogCta';
import BlogMessage from './BlogMessage';
import PhotoCredit from '../Shared/PhotoCredit';
import { findContentBackground } from '../../constants/contentBackgrounds';

type Stage = 'loading' | 'ready' | 'unavailable' | 'failed';

const BlogPostPage: React.FC<BlogPageProps> = (props) => {
    const { t } = useTranslation();
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
        stage === 'ready' ? findContentBackground(post?.background) : null;

    // A post is a public note, shown the way its public link shows it,
    // with the blog around it.
    return (
        <BlogLayout {...props} links={post?.links ?? null}>
            {stage === 'ready' && (
                <PublicNoteBackground
                    background={post?.background}
                    showCredit={false}
                />
            )}

            <main className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                <Link
                    to={props.basePath || '/'}
                    className="relative text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                    &larr; {t('blog.allPosts', 'All posts')}
                </Link>

                <div className="mt-4">
                    {stage === 'loading' && (
                        <p className="text-gray-500 dark:text-gray-400">
                            {t('common.loading', 'Loading...')}
                        </p>
                    )}
                    {stage === 'unavailable' && (
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
                    )}
                    {stage === 'failed' && (
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
                    )}
                    {stage === 'ready' && post && (
                        <PublicNoteArticle
                            title={post.title}
                            content={post.content}
                            color={post.color}
                            updatedAt={post.updated_at}
                            linkedNotes={post.linked_notes}
                            linkHref={(link) =>
                                `${props.basePath}/${link.slug}`
                            }
                        />
                    )}
                </div>

                {stage === 'ready' && post && (
                    <>
                        <div className="relative mt-12">
                            <BlogCta links={post.links} />
                        </div>

                        {post.more.length > 0 && (
                            <section className="relative mt-16">
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

                {photo && (
                    <PhotoCredit background={photo} className="relative mt-8" />
                )}
            </main>
        </BlogLayout>
    );
};

export default BlogPostPage;
