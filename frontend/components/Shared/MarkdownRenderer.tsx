import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import hljs from 'highlight.js';
import CalloutBlock, { CalloutType } from './CalloutBlock';
import { useStore } from '../../store/useStore';

const WIKILINK_PREFIX = '/__wikilink__/';

function preprocessWikilinks(content: string): string {
    return content.replace(/\[\[([^\][\n]+?)\]\]/g, (_match, title: string) => {
        const t = title.trim();
        return `[${t}](${WIKILINK_PREFIX}${encodeURIComponent(t)})`;
    });
}

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const CodeBlock: React.FC<React.HTMLAttributes<HTMLPreElement>> = ({ children, ...props }) => {
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

interface MarkdownRendererProps {
    content: string;
    className?: string;
    summaryMode?: boolean;
    onContentChange?: (newContent: string) => void;
    noteColor?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
    content,
    className = '',
    summaryMode = false,
    onContentChange,
    noteColor,
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

    // Function to toggle checkbox at a specific index
    const toggleCheckbox = (checkboxIndex: number) => {
        if (!onContentChange) return;

        const lines = content.split('\n');
        let currentCheckboxIndex = -1;

        const newLines = lines.map((line) => {
            // Match task list items: - [ ] or - [x] or - [X]
            const match = line.match(/^(\s*-\s*)\[([ xX])\](.*)$/);
            if (match) {
                currentCheckboxIndex++;
                if (currentCheckboxIndex === checkboxIndex) {
                    const indent = match[1];
                    const isChecked = match[2].toLowerCase() === 'x';
                    const rest = match[3];
                    return `${indent}[${isChecked ? ' ' : 'x'}]${rest}`;
                }
            }
            return line;
        });

        onContentChange(newLines.join('\n'));
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
                            const title = decodeURIComponent(href.slice(WIKILINK_PREFIX.length));
                            const slug = noteTitleToSlug.get(title.toLowerCase());
                            const to = slug ? `/note/${slug}` : null;
                            const badge = (
                                <span className="inline-flex items-stretch rounded overflow-hidden align-middle border border-blue-200 dark:border-blue-700/70 mt-1">
                                    <span className="flex items-center px-1.5 text-[0.72em] font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200 bg-blue-200/70 dark:bg-blue-700/60">
                                        NOTE:
                                    </span>
                                    <span className="flex items-center px-1.5 py-0.5 text-[0.9em] text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-900/30">
                                        {title}
                                    </span>
                                </span>
                            );
                            return to ? (
                                <Link to={to} className="no-underline">
                                    {badge}
                                </Link>
                            ) : (
                                <span className="cursor-default" title="Note not found">
                                    {badge}
                                </span>
                            );
                        }
                        return (
                            <a
                                className="text-blue-600 dark:text-blue-400 hover:underline"
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
                    pre: ({ ...props }) => <CodeBlock {...props} />,

                    // Customize blockquote styles — detect Obsidian-style callouts
                    blockquote: ({ node, children, ...props }) => {
                        const firstHastChild = (node as any)?.children?.[0];
                        if (firstHastChild?.type === 'element' && firstHastChild?.tagName === 'p') {
                            const firstText = firstHastChild?.children?.[0];
                            if (firstText?.type === 'text') {
                                const match = (firstText.value as string)?.match(
                                    /^\[!(NOTE|WARNING|TIP|IMPORTANT|DANGER)\](?:\s+(.*))?$/i
                                );
                                if (match) {
                                    const calloutType = match[1].toUpperCase() as CalloutType;
                                    const title = match[2]?.trim();
                                    const contentChildren = React.Children.toArray(children).slice(1);
                                    return (
                                        <CalloutBlock type={calloutType} title={title}>
                                            {contentChildren.length > 0 ? contentChildren : null}
                                        </CalloutBlock>
                                    );
                                }
                            }
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
