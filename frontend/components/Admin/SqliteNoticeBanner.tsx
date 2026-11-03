import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchDatabaseInfo } from '../../utils/adminDatabaseService';

const DISMISS_KEY = 'tududi.sqliteNoticeDismissed';
const GUIDE_URL =
    'https://github.com/chrisvel/tududi/blob/main/docs/30-moving-to-postgres.md';

const wasDismissed = (): boolean => {
    try {
        return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
        return false;
    }
};

// tududi 2.0 drops SQLite. Admins of a SQLite instance see a bar on every
// page until they dismiss it, telling them to export before they upgrade.
const SqliteNoticeBanner: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
    const { t } = useTranslation();
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (!isAdmin || wasDismissed()) return;
        let cancelled = false;
        fetchDatabaseInfo()
            .then((info) => {
                if (!cancelled && info?.dialect === 'sqlite') setShow(true);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [isAdmin]);

    if (!show) return null;

    const dismiss = () => {
        try {
            localStorage.setItem(DISMISS_KEY, '1');
        } catch {
            // Private mode: it comes back on the next load.
        }
        setShow(false);
    };

    return (
        <div
            className="mx-4 mt-2 mb-4 px-4 py-2 rounded-lg text-sm flex flex-wrap items-center gap-3 bg-amber-50 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100"
            data-testid="sqlite-notice-banner"
        >
            <p className="flex-1 min-w-[12rem]">
                {t(
                    'admin.sqliteNotice.text',
                    'This instance keeps its data in SQLite. tududi 2.0 runs on PostgreSQL only, so take a backup before you upgrade and import it into 2.0.'
                )}
            </p>
            <Link
                to="/backup"
                className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
            >
                {t('admin.sqliteNotice.backup', 'Back up now')}
            </Link>
            <a
                href={GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline whitespace-nowrap"
            >
                {t('admin.sqliteNotice.guide', 'How to move')}
            </a>
            <button
                type="button"
                onClick={dismiss}
                className="px-2 py-1 rounded hover:bg-amber-100 dark:hover:bg-amber-800/60"
            >
                {t('common.dismiss', 'Dismiss')}
            </button>
        </div>
    );
};

export default SqliteNoticeBanner;
