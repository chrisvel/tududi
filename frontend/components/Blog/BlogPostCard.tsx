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

const BlogPostCard: React.FC<{ post: Card; basePath: string }> = ({
    post,
    basePath,
}) => {
    const { t, i18n } = useTranslation();
    const date = formatPostDate(post.published_at, i18n.language);

    return (
        <Link
            to={`${basePath}/${post.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
            data-testid="blog-post-card"
        >
            {post.cover && (
                <div className="aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-gray-700">
                    <img
                        src={post.cover}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                </div>
            )}
            <div className="flex flex-1 flex-col p-6">
                {date && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {date}
                    </p>
                )}
                <h3 className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {post.title}
                </h3>
                {post.excerpt && (
                    <p className="mt-3 text-gray-600 dark:text-gray-300 leading-relaxed">
                        {post.excerpt}
                    </p>
                )}
                <span className="mt-auto pt-4 text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {t('blog.readPost', 'Read the post')} &rarr;
                </span>
            </div>
        </Link>
    );
};

export default BlogPostCard;
