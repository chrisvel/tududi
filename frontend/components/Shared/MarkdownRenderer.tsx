import React, { useEffect, useRef, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import hljs from 'highlight.js';
import CalloutBlock from './CalloutBlock';
import MermaidDiagram, { getMermaidSource } from './MermaidDiagram';
import { detectCallout } from '../../utils/calloutParser';
import { toggleTaskListItem } from '../../utils/markdownTaskList';
import { useStore } from '../../store/useStore';

const WIKILINK_PREFIX = '/__wikilink__/';

function preprocessWikilinks(content: string): string {
    return content.replace(/\[\[([^\][\n]+?)\]\]/g, (_match, title: string) => {
        const t = title.trim();
        return `[${t}](${WIKILINK_PREFIX}${encodeURIComponent(t)})`;
    });
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

const CodeBlock: React.FC<React.HTMLAttributes<HTMLPreElement>> = ({
    children,
    ...props
}) => {
    const preRef = useRef<HTMLPreElement>(null);
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const text = preRef.current?.textContent || '';
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    return (
        <div className="relative group mb-4">
            <pre ref={preRef} className="rounded-lg overflow-x-auto" {...props}>
                {children}
            </pre>
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 dark:bg-gray-600 text-white text-xs px-2 py-1 rounded"
                aria-label="Copy code"
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
        </div>
    );
};

// The badge sits on the text's baseline: the outer flex row takes its
// baseline from the title (the label stretches and the lock centers, so
// neither takes part), which lines it up with the words around it.
const NoteBadge: React.FC<{ title: string; locked?: boolean }> = ({
    title,
    locked = false,
}) => (
    <span className="inline-flex items-baseline align-baseline rounded overflow-hidden mx-0.5 leading-snug">
        <span className="self-stretch flex items-center px-1.5 text-[0.72em] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-200/80 dark:bg-gray-700/80">
            NOTE:
        </span>
        <span className="inline-flex items-baseline gap-1 px-1.5 py-px text-[0.9em] text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800">
            {locked && <LockClosedIcon className="h-3 w-3 self-center" />}
            {title}
        </span>
    </span>
);

// On a public page, a link to a note the owner has not made public: the
// reader can click it to learn why it does not open. The message is portaled
// to the body so the note's content box cannot clip it.
const NotSharedNoteBadge: React.FC<{ title: string }> = ({ title }) => {
    const { t } = useTranslation();
    const [anchor, setAnchor] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!anchor) return;
        const close = () => setAnchor(null);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [anchor]);

    return (
        <>
            <button
                type="button"
                className="cursor-pointer align-baseline"
                aria-expanded={!!anchor}
                onClick={(e) =>
                    setAnchor((current) =>
                        current ? null : e.currentTarget.getBoundingClientRect()
                    )
                }
                onBlur={() => setAnchor(null)}
            >
                <NoteBadge title={title} locked />
            </button>
            {anchor &&
                ReactDOM.createPortal(
                    <span
                        role="status"
                        className="fixed z-[300] whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-gray-700"
                        style={{ left: anchor.left, top: anchor.bottom + 4 }}
                    >
                        {t(
                            'publicNote.linkedNoteNotShared',
                            'This note is not shared publicly.'
                        )}
                    </span>,
                    document.body
                )}
        </>
    );
};

interface MarkdownRendererProps {
    content: string;
    className?: string;
    summaryMode?: boolean;
    onContentChange?: (newContent: string) => void;
    noteColor?: string;
    // On a public note page: the linked notes the reader may open. Any other
    // [[link]] shows as not shared instead of looking up the reader's notes.
    publicNoteLinks?: { title: string; token: string }[];
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
    content,
    className = '',
    summaryMode = false,
    onContentChange,
    noteColor,
    publicNoteLinks,
}) => {
    const storeNotes = useStore((state) => state.notesStore.notes);

    const noteTitleToSlug = useMemo(() => {
        const map = new Map<string, string>();
        for (const n of storeNotes) {
            if (n.uid && n.title) {
                map.set(n.title.toLowerCase(), `${n.uid}-${slugify(n.title)}`);
            }
        }
        return map;
    }, [storeNotes]);

    const processedContent = useMemo(
        () => preprocessWikilinks(content),
        [content]
    );

    // Determine text color based on background
    const getTextColor = () => {
        if (!noteColor) return undefined;

        const hex = noteColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        return luminance < 0.4 ? '#ffffff' : '#333333';
    };

    const textColor = getTextColor();
    useEffect(() => {
        // Configure highlight.js
        hljs.configure({
            languages: [
                'javascript',
                'typescript',
                'python',
                'java',
                'css',
                'html',
                'json',
                'bash',
                'sql',
                'yaml',
                'xml',
                'dockerfile',
                'nginx',
                'apache',
            ],
        });

        // Manual highlighting for any missed code blocks
        const timer = setTimeout(() => {
            const codeBlocks = document.querySelectorAll('pre code:not(.hljs)');
            codeBlocks.forEach((block) => {
                hljs.highlightElement(block as HTMLElement);
            });
        }, 100);

        return () => clearTimeout(timer);
    }, [content]);

    // Track checkbox index for toggling
    const checkboxIndexRef = React.useRef(-1);

    // Reset on each render
    checkboxIndexRef.current = -1;

    const toggleCheckbox = (checkboxIndex: number) => {
        if (!onContentChange) return;
        const next = toggleTaskListItem(content, checkboxIndex);
        if (next !== content) onContentChange(next);
    };

    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[
                    [rehypeHighlight, { detect: true, ignoreMissing: true }],
                ]}
                components={{
                    // Customize heading styles - in summary mode, convert headers to emphasized text
                    h1: ({ ...props }) =>
                        summaryMode ? (
                            <strong
                                className={`font-semibold ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ) : (
                            <h1
                                className={`text-3xl font-bold mt-6 first:mt-0 mb-4 ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ),
                    h2: ({ ...props }) =>
                        summaryMode ? (
                            <strong
                                className={`font-semibold ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ) : (
                            <h2
                                className={`text-2xl font-semibold mt-5 first:mt-0 mb-3 ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ),
                    h3: ({ ...props }) =>
                        summaryMode ? (
                            <strong
                                className={`font-semibold ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ) : (
                            <h3
                                className={`text-xl font-medium mt-4 first:mt-0 mb-2 ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ),
                    h4: ({ ...props }) =>
                        summaryMode ? (
                            <strong
                                className={`font-semibold ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ) : (
                            <h4
                                className={`text-lg font-medium mt-4 first:mt-0 mb-2 ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ),
                    h5: ({ ...props }) =>
                        summaryMode ? (
                            <strong
                                className={`font-semibold ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ) : (
                            <h5
                                className={`text-base font-medium mt-4 first:mt-0 mb-2 ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ),
                    h6: ({ ...props }) =>
                        summaryMode ? (
                            <strong
                                className={`font-semibold ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ) : (
                            <h6
                                className={`text-sm font-medium mt-4 first:mt-0 mb-2 ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                                style={{
                                    color: textColor,
                                }}
                                {...props}
                            />
                        ),

                    // Customize paragraph styles
                    p: ({ ...props }) => (
                        <p
                            className={`mb-3 leading-relaxed ${!noteColor ? 'text-gray-700 dark:text-gray-300' : ''}`}
                            style={{
                                color: textColor,
                            }}
                            {...props}
                        />
                    ),

                    // Customize list styles
                    ul: ({ ...props }) => (
                        <ul
                            className={`mb-3 list-disc ml-4 pl-5 space-y-1 ${!noteColor ? 'text-gray-700 dark:text-gray-300' : ''}`}
                            style={{
                                color: textColor,
                            }}
                            {...props}
                        />
                    ),
                    ol: ({ ...props }) => (
                        <ol
                            className={`mb-3 list-decimal ml-4 pl-5 space-y-1 ${!noteColor ? 'text-gray-700 dark:text-gray-300' : ''}`}
                            style={{
                                color: textColor,
                            }}
                            {...props}
                        />
                    ),
                    li: ({ ...props }) => (
                        <li
                            className={
                                !noteColor
                                    ? 'text-gray-700 dark:text-gray-300'
                                    : ''
                            }
                            style={{
                                color: textColor,
                            }}
                            {...props}
                        />
                    ),

                    // Customize link styles — wikilinks get a note-chip style
                    a: ({ href, children, ...props }) => {
                        if (href?.startsWith(WIKILINK_PREFIX)) {
                            const title = decodeURIComponent(
                                href.slice(WIKILINK_PREFIX.length)
                            );
                            if (publicNoteLinks) {
                                const target = publicNoteLinks.find(
                                    (n) =>
                                        n.title.toLowerCase() ===
                                        title.toLowerCase()
                                );
                                return target ? (
                                    <Link
                                        to={`/public/notes/${target.token}`}
                                        className="!no-underline hover:!no-underline"
                                    >
                                        <NoteBadge title={title} />
                                    </Link>
                                ) : (
                                    <NotSharedNoteBadge title={title} />
                                );
                            }
                            const slug = noteTitleToSlug.get(
                                title.toLowerCase()
                            );
                            const to = slug ? `/note/${slug}` : null;
                            const badge = <NoteBadge title={title} />;
                            return to ? (
                                <Link
                                    to={to}
                                    className="!no-underline hover:!no-underline"
                                >
                                    {badge}
                                </Link>
                            ) : (
                                <span
                                    className="cursor-default"
                                    title="Note not found"
                                >
                                    {badge}
                                </span>
                            );
                        }
                        return (
                            <a
                                className="underline underline-offset-2 decoration-gray-400 dark:decoration-gray-500 hover:decoration-current"
                                href={href}
                                {...props}
                            >
                                {children}
                            </a>
                        );
                    },

                    // Customize code styles
                    code: ({ className, children, ...props }) => {
                        // Check if this is a code block (has language class) or inline code
                        const isCodeBlock =
                            className && className.startsWith('language-');

                        if (isCodeBlock) {
                            // This is a code block - add hljs class to ensure our styles apply
                            return (
                                <code
                                    className={`${className} hljs`}
                                    {...props}
                                >
                                    {children}
                                </code>
                            );
                        } else {
                            // This is inline code - apply our custom styling
                            // Check if parent is a pre element - if so, this might be a code block without language
                            // eslint-disable-next-line react/prop-types
                            const node = (props as any).node;
                            // eslint-disable-next-line react/prop-types
                            const parentIsPre = node?.parent?.tagName === 'pre';
                            if (parentIsPre) {
                                return (
                                    <code className="hljs" {...props}>
                                        {children}
                                    </code>
                                );
                            }
                            return (
                                <code
                                    className="py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-100"
                                    {...props}
                                >
                                    {children}
                                </code>
                            );
                        }
                    },
                    pre: ({ node, ...props }) => {
                        const mermaidSource = getMermaidSource(node);
                        if (mermaidSource === null) {
                            return <CodeBlock {...props} />;
                        }
                        return summaryMode ? (
                            <span className="text-gray-500 italic">
                                [Diagram hidden in preview]
                            </span>
                        ) : (
                            <MermaidDiagram code={mermaidSource} />
                        );
                    },

                    // Customize blockquote styles — detect Obsidian-style callouts
                    blockquote: ({ node, children, ...props }) => {
                        const callout = detectCallout(node);
                        if (callout) {
                            const blockChildren =
                                React.Children.toArray(children);
                            const markerIndex = blockChildren.findIndex((c) =>
                                React.isValidElement(c)
                            );
                            const contentChildren = blockChildren.slice(
                                markerIndex + 1
                            );
                            const markerParagraph = blockChildren[markerIndex];
                            if (React.isValidElement(markerParagraph)) {
                                // Keep soft-wrapped body text that shares the marker's
                                // paragraph (e.g. "> [!NOTE]\n> body" with no blank line)
                                const inlineRest = React.Children.toArray(
                                    (markerParagraph.props as any).children
                                ).slice(1);
                                const leadChildren = [
                                    ...(callout.remainderText
                                        ? [callout.remainderText]
                                        : []),
                                    ...inlineRest,
                                ];
                                if (leadChildren.length > 0) {
                                    contentChildren.unshift(
                                        React.cloneElement(
                                            markerParagraph,
                                            undefined,
                                            ...leadChildren
                                        )
                                    );
                                }
                            }
                            return (
                                <CalloutBlock
                                    type={callout.type}
                                    title={callout.title}
                                >
                                    {contentChildren.length > 0
                                        ? contentChildren
                                        : null}
                                </CalloutBlock>
                            );
                        }
                        return (
                            <blockquote
                                className="mb-4 pl-4 border-l-4 border-gray-300 dark:border-gray-600 italic text-gray-600 dark:text-gray-400"
                                {...props}
                            >
                                {children}
                            </blockquote>
                        );
                    },

                    // Customize table styles - hide tables in summary mode
                    table: ({ ...props }) =>
                        summaryMode ? (
                            <span className="text-gray-500 italic">
                                [Table content hidden in preview]
                            </span>
                        ) : (
                            <div className="markdown-table-wrapper">
                                <table
                                    className="markdown-table w-full border-collapse"
                                    {...props}
                                />
                            </div>
                        ),
                    thead: ({ ...props }) =>
                        summaryMode ? null : (
                            <thead
                                className="bg-gray-100 dark:bg-gray-800"
                                {...props}
                            />
                        ),
                    th: ({ ...props }) =>
                        summaryMode ? null : (
                            <th
                                className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ),
                    td: ({ ...props }) =>
                        summaryMode ? null : (
                            <td
                                className="px-3 py-2 text-gray-700 dark:text-gray-300"
                                {...props}
                            />
                        ),

                    // Customize horizontal rule
                    hr: ({ ...props }) => (
                        <hr
                            className="my-6 border-gray-300 dark:border-gray-600"
                            {...props}
                        />
                    ),

                    // Customize strong/bold text
                    strong: ({ ...props }) => (
                        <strong
                            className={`font-semibold ${!noteColor ? 'text-gray-900 dark:text-gray-100' : ''}`}
                            style={{
                                color: textColor,
                            }}
                            {...props}
                        />
                    ),

                    // Customize italic text
                    em: ({ ...props }) => (
                        <em
                            className={`italic ${!noteColor ? 'text-gray-700 dark:text-gray-300' : ''}`}
                            style={{
                                color: textColor,
                            }}
                            {...props}
                        />
                    ),

                    // Customize checkboxes for task lists with Tailwind styling
                    input: ({ type, checked, ...props }) => {
                        if (type === 'checkbox') {
                            checkboxIndexRef.current++;
                            const currentIndex = checkboxIndexRef.current;

                            return (
                                <input
                                    {...props}
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!onContentChange}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                    }}
                                    onChange={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleCheckbox(currentIndex);
                                    }}
                                    className={`w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 ${
                                        onContentChange
                                            ? 'cursor-pointer'
                                            : 'cursor-not-allowed'
                                    }`}
                                />
                            );
                        }
                        return <input type={type} {...props} />;
                    },
                }}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer;
