import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LinkIcon } from '@heroicons/react/24/outline';
import { fetchNoteBacklinks, BacklinkNote } from '../../utils/notesService';

interface BacklinksPanelProps {
    noteUid: string;
    noteTitle: string;
}

const BacklinksPanel: React.FC<BacklinksPanelProps> = ({ noteUid, noteTitle }) => {
    const [backlinks, setBacklinks] = useState<BacklinkNote[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchNoteBacklinks(noteUid)
            .then((links) => {
                if (!cancelled) setBacklinks(links);
            })
            .catch(() => {
                if (!cancelled) setBacklinks([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [noteUid]);

    if (loading) return null;
    if (backlinks.length === 0) return null;

    return (
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center gap-2 mb-3">
                <LinkIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Backlinks
                    <span className="ml-1.5 text-gray-300 dark:text-gray-600 font-normal normal-case tracking-normal">
                        — notes linking to &ldquo;{noteTitle}&rdquo;
                    </span>
                </h3>
            </div>
            <ul className="space-y-1">
                {backlinks.map((link) => (
                    <li key={link.uid}>
                        <Link
                            to={`/note/${link.uid}-${slugify(link.title)}`}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                        >
                            <span className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 text-xs">
                                [[
                            </span>
                            <span className="flex-1 truncate font-medium">{link.title}</span>
                            <span className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 text-xs">
                                ]]
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
};

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

export default BacklinksPanel;
