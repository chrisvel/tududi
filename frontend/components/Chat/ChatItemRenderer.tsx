import React, { useEffect, useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { formatShortDate } from '../../utils/dateUtils';
import TaskItem from '../Task/TaskItem';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';

interface ChatItemRendererProps {
    content: string;
    plan?: any;
    dataPayload?: any;
}

const ChatItemRenderer: React.FC<ChatItemRendererProps> = ({
    content,
    plan,
    dataPayload,
}) => {
    const navigate = useNavigate();

    const extractMetadata = (text: string) => {
        const metadataMatch = text.match(/\[METADATA\](.*?)\[\/METADATA\]\n*/s);
        if (metadataMatch) {
            return {
                metadata: metadataMatch[1],
                cleanContent: text.replace(/\[METADATA\].*?\[\/METADATA\]\n*/s, ''),
            };
        }
        return { metadata: null, cleanContent: text };
    };

    const { cleanContent } = extractMetadata(content);

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

    const segments = parseContent(cleanContent);

    const ChatItemCard: React.FC<{
        itemType: string;
        id: string;
        name: string;
    }> = ({ itemType, id, name }) => {
        const [itemData, setItemData] = useState<any>(null);
        const [isLoading, setIsLoading] = useState(false);
        const [loadError, setLoadError] = useState<string | null>(null);
        const [isDeleted, setIsDeleted] = useState(false);

        useEffect(() => {
            let isMounted = true;
            const fetchItem = async () => {
                setIsLoading(true);
                setLoadError(null);
                try {
                    const response = await fetch(
                        `/api/chat/item/${itemType}/${id}`,
                        {
                            credentials: 'include',
                        }
                    );
                    if (response.ok) {
                        const data = await response.json();
                        if (isMounted) {
                            // API returns shape { type, item }, but fallback to raw data if item missing
                            const item = data?.item ?? data;
                            if (!item) {
                                setLoadError('Failed to load item');
                                return;
                            }
                            setItemData(item);
                        }
                    } else {
                        throw new Error('Request failed');
                    }
                } catch (error) {
                    console.error('Failed to load item preview', error);
                    if (isMounted) {
                        setLoadError('Failed to load item');
                    }
                } finally {
                    if (isMounted) {
                        setIsLoading(false);
                    }
                }
            };

            fetchItem();
            return () => {
                isMounted = false;
            };
        }, [id, itemType]);

        const displayName = itemData?.name || name;

        if (itemType === 'task') {
            if (loadError) {
                // Show as simple inline text when task doesn't exist
                return (
                    <span className="text-gray-600 dark:text-gray-400 italic">
                        {name}
                    </span>
                );
            }

            if (isDeleted) {
                return (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        Task removed from chat view.
                    </div>
                );
            }

            if (isLoading || !itemData) {
                return (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        Loading task…
                    </div>
                );
            }

            const normalizedTask: Task = {
                ...itemData,
                id:
                    typeof itemData.id === 'string'
                        ? Number(itemData.id) || itemData.id
                        : itemData.id,
                uid: itemData.uid || (itemData.id ? String(itemData.id) : undefined),
                project_id:
                    itemData.project_id ?? itemData.projectId ?? itemData.project?.id,
                Project:
                    itemData.Project ||
                    itemData.project ||
                    (itemData.project_name
                        ? { id: itemData.project_id, name: itemData.project_name }
                        : undefined),
                tags: itemData.tags || itemData.Tags || [],
            };

            const taskProject: Project[] = normalizedTask.Project
                ? [normalizedTask.Project as Project]
                : [];

            const handleTaskUpdate = async (updatedTask: Task) => {
                setItemData(updatedTask);
            };

            const handleTaskDelete = () => {
                setIsDeleted(true);
            };

            const handleTaskCompletionToggle = (updatedTask: Task) => {
                setItemData(updatedTask);
            };

            return (
                <TaskItem
                    task={normalizedTask}
                    onTaskUpdate={handleTaskUpdate}
                    onTaskDelete={handleTaskDelete}
                    onTaskCompletionToggle={handleTaskCompletionToggle}
                    projects={taskProject}
                    showCompletedTasks
                />
            );
        }

        // Handle error for projects/notes - show as inline text
        if (loadError) {
            return (
                <span className="text-gray-600 dark:text-gray-400 italic">
                    {name}
                </span>
            );
        }

        // Handle loading state for projects/notes
        if (isLoading || !itemData) {
            return (
                <span className="text-gray-500 dark:text-gray-400">
                    {name}
                </span>
            );
        }

        const projectName =
            itemData?.Project?.name ||
            itemData?.project?.name ||
            itemData?.project_name ||
            '';
        const projectState = (itemData?.state ||
            itemData?.Project?.state ||
            'in_progress') as string;
        const stateMeta: Record<
            string,
            { label: string; bg: string; text: string }
        > = {
            idea: {
                label: 'Idea',
                bg: 'bg-yellow-50 dark:bg-yellow-900/20',
                text: 'text-yellow-700 dark:text-yellow-200',
            },
            planned: {
                label: 'Planned',
                bg: 'bg-blue-50 dark:bg-blue-900/20',
                text: 'text-blue-700 dark:text-blue-200',
            },
            in_progress: {
                label: 'In Progress',
                bg: 'bg-green-50 dark:bg-green-900/20',
                text: 'text-green-700 dark:text-green-200',
            },
            blocked: {
                label: 'Blocked',
                bg: 'bg-red-50 dark:bg-red-900/20',
                text: 'text-red-700 dark:text-red-200',
            },
            completed: {
                label: 'Completed',
                bg: 'bg-gray-100 dark:bg-gray-800',
                text: 'text-gray-700 dark:text-gray-300',
            },
        };
        const stateStyles = stateMeta[projectState] || stateMeta.in_progress;
        const tags = itemData?.Tags || itemData?.tags || [];
        const updatedAt =
            itemData?.updated_at || itemData?.updatedAt || itemData?.updatedAt;
        const description =
            itemData?.description ||
            itemData?.Project?.description ||
            itemData?.project?.description;
        const initials = displayName
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((word) => word[0])
            .join('')
            .toUpperCase();

        return (
            <div
                onClick={() => handleItemClick(itemType, id, displayName)}
                className="rounded-xl shadow-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer overflow-hidden"
            >
                <div className="flex">
                    <div className="w-16 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <span className="text-lg font-bold text-gray-600 dark:text-gray-300">
                            {initials}
                        </span>
                    </div>
                    <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {displayName}
                                </p>
                                {projectName && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {projectName}
                                    </p>
                                )}
                            </div>
                            <span
                                className={`text-[11px] px-2 py-1 rounded-full whitespace-nowrap ${stateStyles.bg} ${stateStyles.text}`}
                            >
                                {stateStyles.label}
                            </span>
                        </div>

                        {description && (
                            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                                {description}
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            {tags?.map((tag: any) => (
                                <span
                                    key={tag.uid || tag.id || tag.name}
                                    className="text-[11px] px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                >
                                    {tag.name}
                                </span>
                            ))}
                            {isLoading && (
                                <span className="text-[11px] text-gray-400">
                                    Loading…
                                </span>
                            )}
                        </div>

                        {updatedAt && (
                            <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                                Updated {formatShortDate(new Date(updatedAt))}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    };


    // Only show debug details in development or when explicitly requested
    const showDebug = process.env.NODE_ENV === 'development';
    const detailsBlock =
        showDebug && (plan || dataPayload) ? (
            <details className="text-[10px] text-gray-400 dark:text-gray-500 mb-3 opacity-50 hover:opacity-100 transition-opacity">
                <summary className="cursor-pointer select-none">Debug info</summary>
                <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900/50 rounded text-[9px] overflow-x-auto max-h-48 overflow-y-auto">
                    {JSON.stringify({ plan, data: dataPayload }, null, 2)}
                </pre>
            </details>
        ) : null;

    if (segments.every((s) => s.type === 'text')) {
        return (
            <div className="prose prose-sm dark:prose-invert max-w-none">
                {detailsBlock}
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
                            <li className="ml-4 leading-relaxed marker:text-gray-500 [&>p]:m-0 [&>p]:inline">
                                {children}
                            </li>
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
                    {cleanContent}
                </ReactMarkdown>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {detailsBlock}
            {segments.map((segment, index) => {
                if (segment.type === 'text' && segment.content.trim()) {
                    return (
                        <div
                            key={index}
                            className="prose prose-sm dark:prose-invert max-w-none"
                        >
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
                                        <li className="ml-4 leading-relaxed marker:text-gray-500 [&>p]:m-0 [&>p]:inline">
                                            {children}
                                        </li>
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
                        <ChatItemCard
                            key={index}
                            itemType={itemType}
                            id={id}
                            name={name}
                        />
                    );
                }
                return null;
            })}
        </div>
    );
};

export default memo(ChatItemRenderer);
