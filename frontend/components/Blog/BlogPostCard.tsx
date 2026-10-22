import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BlogPostCard as Card } from '../../utils/blogService';

export const formatPostDate = (value: string | null, language: string) =>
    value
        ? new Date(value).toLocaleDateString(language || 'en', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : null;

// A post on the front page or under a post. The featured one, the newest,
// is wide with the cover beside the text; the rest stack in a grid.
const BlogPostCard: React.FC<{
    post: Card;
    basePath: string;
    featured?: boolean;
}> = ({ post, basePath, featured = false }) => {
    const { t, i18n } = useTranslation();
    const date = formatPostDate(post.published_at, i18n.language);

    return (
        <Link
            to={`${basePath}/${post.slug}`}
            className={`group flex overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-lg transition-shadow ${
                featured
                    ? 'flex-col md:flex-row rounded-3xl'
                    : 'flex-col rounded-2xl'
            }`}
            data-testid="blog-post-card"
        >
            {post.cover ? (
                <div
                    className={`overflow-hidden bg-gray-100 dark:bg-gray-700 ${
                        featured
                            ? 'aspect-[16/10] md:aspect-auto md:w-3/5 md:min-h-[24rem]'
                            : 'aspect-[16/10]'
                    }`}
                >
                    <img
                        src={post.cover}
                        alt=""
                        loading={featured ? 'eager' : 'lazy'}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                </div>
            ) : (
                !featured && (
                    <div
                        aria-hidden="true"
                        className="aspect-[16/10] bg-gray-200/70 dark:bg-gray-700"
                    />
                )
            )}
            <div
                className={`flex flex-1 flex-col ${
                    featured ? 'justify-center gap-4 p-8 sm:p-10' : 'gap-2 p-6'
                }`}
            >
                {date && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {date}
                    </p>
                )}
                <h3
                    className={`font-extrabold tracking-tight text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 ${
                        featured
                            ? 'text-3xl sm:text-4xl leading-tight'
                            : 'text-xl leading-snug'
                    }`}
                >
                    {post.title}
                </h3>
                {post.excerpt && (
                    <p
                        className={`text-gray-600 dark:text-gray-300 leading-relaxed ${
                            featured ? 'text-lg' : ''
                        }`}
                    >
                        {post.excerpt}
                    </p>
                )}
                <span
                    className={`text-sm font-semibold text-blue-600 dark:text-blue-400 ${
                        featured ? '' : 'mt-auto pt-2'
                    }`}
                >
                    {t('blog.readPost', 'Read the post')} &rarr;
                </span>
            </div>
        </Link>
    );
};

export default BlogPostCard;
