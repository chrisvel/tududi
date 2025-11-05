import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import hljs from 'highlight.js';

interface MarkdownRendererProps {
    content: string;
    className?: string;
    summaryMode?: boolean;
    onContentChange?: (newContent: string) => void;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
    content,
    className = '',
    summaryMode = false,
    onContentChange,
}) => {
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
                                className="font-semibold text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ) : (
                            <h1
                                className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ),
                    h2: ({ ...props }) =>
                        summaryMode ? (
                            <strong
                                className="font-semibold text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ) : (
                            <h2
                                className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ),
                    h3: ({ ...props }) =>
                        summaryMode ? (
                            <strong
                                className="font-semibold text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ) : (
                            <h3
                                className="text-xl font-medium mb-2 text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ),
                    h4: ({ ...props }) =>
                        summaryMode ? (
                            <strong
                                className="font-semibold text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ) : (
                            <h4
                                className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ),
                    h5: ({ ...props }) =>
                        summaryMode ? (
                            <strong
                                className="font-semibold text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ) : (
                            <h5
                                className="text-base font-medium mb-2 text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ),
                    h6: ({ ...props }) =>
                        summaryMode ? (
                            <strong
                                className="font-semibold text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ) : (
                            <h6
                                className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ),

                    // Customize paragraph styles
                    p: ({ ...props }) => (
                        <p
                            className="mb-3 text-gray-700 dark:text-gray-300 leading-relaxed"
                            {...props}
                        />
                    ),

                    // Customize list styles
                    ul: ({ ...props }) => (
                        <ul
                            className="mb-3 list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300"
                            {...props}
                        />
                    ),
                    ol: ({ ...props }) => (
                        <ol
                            className="mb-3 list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300"
                            {...props}
                        />
                    ),
                    li: ({ ...props }) => <li className="ml-4" {...props} />,

                    // Customize link styles
                    a: ({ ...props }) => (
                        <a
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                            {...props}
                        />
                    ),

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
                                    className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-100"
                                    {...props}
                                >
                                    {children}
                                </code>
                            );
                        }
                    },
                    pre: ({ ...props }) => (
                        <pre
                            className="mb-4 rounded-lg overflow-x-auto"
                            {...props}
                        />
                    ),

                    // Customize blockquote styles
                    blockquote: ({ ...props }) => (
                        <blockquote
                            className="mb-4 pl-4 border-l-4 border-gray-300 dark:border-gray-600 italic text-gray-600 dark:text-gray-400"
                            {...props}
                        />
                    ),

                    // Customize table styles - hide tables in summary mode
                    table: ({ ...props }) =>
                        summaryMode ? (
                            <span className="text-gray-500 italic">
                                [Table content hidden in preview]
                            </span>
                        ) : (
                            <table
                                className="mb-4 w-full border-collapse border border-gray-300 dark:border-gray-600"
                                {...props}
                            />
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
                                className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100"
                                {...props}
                            />
                        ),
                    td: ({ ...props }) =>
                        summaryMode ? null : (
                            <td
                                className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-700 dark:text-gray-300"
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
                            className="font-semibold text-gray-900 dark:text-gray-100"
                            {...props}
                        />
                    ),

                    // Customize italic text
                    em: ({ ...props }) => (
                        <em
                            className="italic text-gray-700 dark:text-gray-300"
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
                                    onChange={(e) => {
                                        e.preventDefault();
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
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer;
