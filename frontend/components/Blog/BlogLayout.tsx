import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoonIcon, SunIcon } from '@heroicons/react/24/solid';
import { getAssetPath } from '../../config/paths';
import { BlogLinks } from '../../utils/blogService';

export interface BlogPageProps {
    basePath: string;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

interface BlogLayoutProps extends BlogPageProps {
    links: BlogLinks | null;
    children: React.ReactNode;
}

// The frame around every blog page: a light navbar that always offers
// Cloud, and a footer back to tududi.com.
const BlogLayout: React.FC<BlogLayoutProps> = ({
    basePath,
    isDarkMode,
    toggleDarkMode,
    links,
    children,
}) => {
    const { t } = useTranslation();

    return (
        <div className="relative min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <nav
                className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur"
                data-testid="blog-navbar"
            >
                <div className="w-full max-w-7xl mx-auto h-16 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3 min-w-0">
                        <a href={links?.landing || '/'} className="shrink-0">
                            <img
                                src={getAssetPath(
                                    isDarkMode
                                        ? 'wide-logo-light.png'
                                        : 'wide-logo-dark.png'
                                )}
                                alt="tududi"
                                className="h-8 w-auto"
                            />
                        </a>
                        <Link
                            to={basePath || '/'}
                            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        >
                            {t('blog.nav', 'Blog')}
                        </Link>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-3">
                        <button
                            type="button"
                            onClick={toggleDarkMode}
                            className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white focus:outline-none"
                            aria-label={t(
                                'publicNote.toggleTheme',
                                'Toggle dark mode'
                            )}
                        >
                            {isDarkMode ? (
                                <SunIcon className="h-5 w-5" />
                            ) : (
                                <MoonIcon className="h-5 w-5" />
                            )}
                        </button>
                        {links && (
                            <>
                                <a
                                    href={`${links.app}/login`}
                                    className="hidden sm:inline px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                    {t('auth.signin', 'Sign In')}
                                </a>
                                <a
                                    href={links.register}
                                    className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
                                    data-testid="blog-nav-cta"
                                >
                                    {t('blog.navCta', 'Start now')}
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {children}

            <footer className="relative mt-16 bg-gray-100 dark:bg-gray-800/60">
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between text-sm text-gray-500 dark:text-gray-400">
                    <p>
                        &copy; {new Date().getFullYear()}{' '}
                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                            tududi
                        </span>
                    </p>
                    {links && (
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                            <a
                                href={links.landing}
                                className="hover:text-gray-900 dark:hover:text-white"
                            >
                                tududi.com
                            </a>
                            <a
                                href={links.cloud}
                                className="hover:text-gray-900 dark:hover:text-white"
                            >
                                {t('blog.footerCloud', 'tududi Cloud')}
                            </a>
                            <a
                                href={`${links.landing}/terms`}
                                className="hover:text-gray-900 dark:hover:text-white"
                            >
                                {t('blog.footerTerms', 'Terms')}
                            </a>
                            <a
                                href={`${links.landing}/privacy`}
                                className="hover:text-gray-900 dark:hover:text-white"
                            >
                                {t('blog.footerPrivacy', 'Privacy')}
                            </a>
                            {!basePath && (
                                <a
                                    href="/rss.xml"
                                    className="hover:text-gray-900 dark:hover:text-white"
                                >
                                    RSS
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </footer>
        </div>
    );
};

export default BlogLayout;
