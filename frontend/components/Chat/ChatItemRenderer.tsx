import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircleIcon,
    FolderIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface ChatItemRendererProps {
    content: string;
}

const ChatItemRenderer: React.FC<ChatItemRendererProps> = ({ content }) => {
    const navigate = useNavigate();

    // Parse the content and extract markers
    const parseContent = (text: string) => {
        // Pattern: [TYPE:id] Item name
        const pattern = /\[(TASK|PROJECT|NOTE):([^\]]+)\]\s*([^\n]+)/g;
        let lastIndex = 0;
        const segments: Array<{ type: 'text' | 'item'; content: any }> = [];

        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                segments.push({
                    type: 'text',
                    content: text.substring(lastIndex, match.index),
                });
            }

            // Add the item
            segments.push({
                type: 'item',
                content: {
                    itemType: match[1].toLowerCase(),
                    id: match[2],
                    name: match[3],
                },
            });

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            segments.push({
                type: 'text',
                content: text.substring(lastIndex),
            });
        }

        return segments;
    };

    const handleItemClick = async (type: string, id: string, name: string) => {
        // First, check if the item exists
        try {
            const response = await fetch(`/api/chat/item/${type}/${id}`, {
                credentials: 'include',
            });

            if (response.ok) {
                // Item exists, navigate to it
                switch (type) {
                    case 'task':
                        navigate(`/task/${id}`);
                        break;
                    case 'project':
                        navigate(`/project/${id}`);
                        break;
                    case 'note':
                        navigate(`/note/${id}`);
                        break;
                }
            } else if (response.status === 404) {
                // Item doesn't exist, trigger creation
                handleCreateItem(type, name);
            }
        } catch (error) {
            console.error('Error checking item:', error);
            // On error, try to navigate anyway
            switch (type) {
                case 'task':
                    navigate(`/task/${id}`);
                    break;
                case 'project':
                    navigate(`/project/${id}`);
                    break;
                case 'note':
                    navigate(`/note/${id}`);
                    break;
            }
        }
    };

    const handleCreateItem = (type: string, name: string) => {
        switch (type) {
            case 'task':
                // Dispatch event to open task modal with prefilled name
                window.dispatchEvent(
                    new CustomEvent('openTaskModal', {
                        detail: { name, type: 'full' },
                    })
                );
                break;
            case 'project':
                // Dispatch event to open project modal
                window.dispatchEvent(
                    new CustomEvent('openProjectModal', {
                        detail: { name },
                    })
                );
                break;
            case 'note':
                // Dispatch event to open note modal
                window.dispatchEvent(
                    new CustomEvent('openNoteModal', {
                        detail: { title: name },
                    })
                );
                break;
        }
    };

    const renderIcon = (type: string) => {
        switch (type) {
            case 'task':
                return (
                    <CheckCircleIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                );
            case 'project':
                return (
                    <FolderIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                );
            case 'note':
                return (
                    <DocumentTextIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                );
            default:
                return null;
        }
    };

    const segments = parseContent(content);

    // Debug logging
    console.log('ChatItemRenderer - Raw content:', content);
    console.log('ChatItemRenderer - Parsed segments:', segments);

    // If no items found, render as regular markdown
    if (segments.every((s) => s.type === 'text')) {
        return (
            <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                    rehypePlugins={[rehypeHighlight]}
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h1: ({ children }) => (
                            <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                                {children}
                            </h1>
                        ),
                        h2: ({ children }) => (
                            <h2 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                                {children}
                            </h2>
                        ),
                        h3: ({ children }) => (
                            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                                {children}
                            </h3>
                        ),
                        p: ({ children }) => (
                            <p className="mb-4 text-gray-800 dark:text-gray-200 leading-relaxed">
                                {children}
                            </p>
                        ),
                        ul: ({ children }) => (
                            <ul className="list-disc list-inside mb-4 space-y-2 text-gray-800 dark:text-gray-200">
                                {children}
                            </ul>
                        ),
                        ol: ({ children }) => (
                            <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-800 dark:text-gray-200">
                                {children}
                            </ol>
                        ),
                        li: ({ children }) => (
                            <li className="ml-4 leading-relaxed">{children}</li>
                        ),
                        strong: ({ children }) => (
                            <strong className="font-semibold text-gray-900 dark:text-gray-100">
                                {children}
                            </strong>
                        ),
                        hr: () => (
                            <hr className="my-6 border-gray-300 dark:border-gray-700" />
                        ),
                        blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-blue-500 pl-4 italic my-4 text-gray-700 dark:text-gray-300">
                                {children}
                            </blockquote>
                        ),
                        code: ({ className, children }) => {
                            const isInline = !className?.includes('language-');
                            return isInline ? (
                                <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
                                    {children}
                                </code>
                            ) : (
                                <code className={className}>{children}</code>
                            );
                        },
                        pre: ({ children }) => (
                            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto mb-4">
                                {children}
                            </pre>
                        ),
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        );
    }

    // Render segments with items
    return (
        <div className="space-y-2">
            {segments.map((segment, index) => {
                if (segment.type === 'text' && segment.content.trim()) {
                    return (
                        <div key={index} className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown
                                rehypePlugins={[rehypeHighlight]}
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: ({ children }) => (
                                        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                                            {children}
                                        </h1>
                                    ),
                                    h2: ({ children }) => (
                                        <h2 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                                            {children}
                                        </h2>
                                    ),
                                    h3: ({ children }) => (
                                        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                                            {children}
                                        </h3>
                                    ),
                                    p: ({ children }) => (
                                        <p className="mb-4 text-gray-800 dark:text-gray-200 leading-relaxed">
                                            {children}
                                        </p>
                                    ),
                                    ul: ({ children }) => (
                                        <ul className="list-disc list-inside mb-4 space-y-2 text-gray-800 dark:text-gray-200">
                                            {children}
                                        </ul>
                                    ),
                                    ol: ({ children }) => (
                                        <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-800 dark:text-gray-200">
                                            {children}
                                        </ol>
                                    ),
                                    li: ({ children }) => (
                                        <li className="ml-4 leading-relaxed">{children}</li>
                                    ),
                                    strong: ({ children }) => (
                                        <strong className="font-semibold text-gray-900 dark:text-gray-100">
                                            {children}
                                        </strong>
                                    ),
                                    hr: () => (
                                        <hr className="my-6 border-gray-300 dark:border-gray-700" />
                                    ),
                                    blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-blue-500 pl-4 italic my-4 text-gray-700 dark:text-gray-300">
                                            {children}
                                        </blockquote>
                                    ),
                                    code: ({ className, children }) => {
                                        const isInline =
                                            !className?.includes('language-');
                                        return isInline ? (
                                            <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
                                                {children}
                                            </code>
                                        ) : (
                                            <code className={className}>
                                                {children}
                                            </code>
                                        );
                                    },
                                    pre: ({ children }) => (
                                        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto mb-4">
                                            {children}
                                        </pre>
                                    ),
                                }}
                            >
                                {segment.content}
                            </ReactMarkdown>
                        </div>
                    );
                } else if (segment.type === 'item') {
                    const { itemType, id, name } = segment.content;
                    return (
                        <div
                            key={index}
                            onClick={() => handleItemClick(itemType, id, name)}
                            className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer transition-colors"
                        >
                            {renderIcon(itemType)}
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {name}
                            </span>
                            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 capitalize">
                                {itemType}
                            </span>
                        </div>
                    );
                }
                return null;
            })}
        </div>
    );
};

export default ChatItemRenderer;
