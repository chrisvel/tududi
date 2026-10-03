import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NewspaperIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
    BlogStatus,
    fetchBlogStatus,
    saveBlogNote,
} from '../../utils/blogService';

// Where the superadmin picks the note the blog is built from. Opened from
// the Blog button on the admin dashboard.
const AdminBlogSettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<BlogStatus | null>(null);
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchBlogStatus()
            .then((result) => {
                setStatus(result);
                setValue(result.note_uid || '');
            })
            .catch((err) => setError(err.message));
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const save = async (note: string) => {
        setSaving(true);
        setError(null);
        try {
            const result = await saveBlogNote(note);
            setStatus(result);
            setValue(result.note_uid || '');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const blogUrl = status?.blog_url || null;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 px-4"
            onClick={onClose}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-blog-title"
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-xl"
                onClick={(e) => e.stopPropagation()}
                data-testid="admin-blog-settings"
            >
                <div className="flex items-center justify-between">
                    <h2
                        id="admin-blog-title"
                        className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center"
                    >
                        <NewspaperIcon className="w-5 h-5 mr-2" />
                        {t('admin.blog.title', 'Blog')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        aria-label={t('common.close', 'Close')}
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t(
                        'admin.blog.description',
                        'Pick one of your notes as the front page. The public notes it links with [[Title]] become the posts. Share the front page and each post publicly for them to show.'
                    )}
                </p>

                <form
                    className="mt-4 flex flex-col sm:flex-row gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save(value);
                    }}
                >
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={t(
                            'admin.blog.placeholder',
                            'Note link or ID, e.g. https://app.tududi.com/notes/abc123'
                        )}
                        aria-label={t(
                            'admin.blog.inputLabel',
                            'Front page note'
                        )}
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        data-testid="admin-blog-input"
                    />
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        {t('common.save', 'Save')}
                    </button>
                    {status?.note_uid && (
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => save('')}
                            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                        >
                            {t('admin.blog.turnOff', 'Turn off')}
                        </button>
                    )}
                </form>

                {error && (
                    <p className="mt-2 text-sm text-red-500" role="alert">
                        {error}
                    </p>
                )}

                {status?.note && (
                    <div className="mt-4 text-sm space-y-2">
                        <p className="text-gray-700 dark:text-gray-200">
                            <span className="font-medium">
                                {status.note.title}
                            </span>{' '}
                            {status.note.shared ? (
                                <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
                                    {t('admin.blog.shared', 'Public')}
                                </span>
                            ) : (
                                <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                                    {t(
                                        'admin.blog.notShared',
                                        'Not shared yet: share it from the note to publish the blog'
                                    )}
                                </span>
                            )}
                        </p>
                        {status.note.shared && (
                            <>
                                <p className="text-gray-500 dark:text-gray-400">
                                    {t(
                                        'admin.blog.postCount',
                                        'Posts: {{count}}',
                                        {
                                            count: status.posts.length,
                                        }
                                    )}
                                    {status.posts.length > 0 &&
                                        ` · ${status.posts.map((p) => p.title).join(', ')}`}
                                </p>
                                <p className="flex flex-wrap gap-4">
                                    {blogUrl && (
                                        <a
                                            href={blogUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:text-blue-600"
                                        >
                                            {t(
                                                'admin.blog.open',
                                                'Open the blog'
                                            )}
                                        </a>
                                    )}
                                    <Link
                                        to="/blog"
                                        className="text-blue-500 hover:text-blue-600"
                                    >
                                        {t(
                                            'admin.blog.preview',
                                            'Preview in the app'
                                        )}
                                    </Link>
                                </p>
                            </>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

export default AdminBlogSettings;
