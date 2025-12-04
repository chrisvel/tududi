import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    PaperAirplaneIcon,
    SparklesIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import 'highlight.js/styles/github-dark.css';
import ChatItemRenderer from './ChatItemRenderer';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    plan?: any;
    data?: any;
    cost?: {
        total_cost: number;
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    } | null;
}

const generateMessageId = () =>
    `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const STORAGE_KEY = 'tududi_chat_history';
const CONVERSATION_ID_KEY = 'tududi_chat_conversation_id';

const ChatPage: React.FC = () => {
    // Initialize messages from localStorage
    const [messages, setMessages] = useState<Message[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Ensure all messages have IDs (for backwards compatibility)
                return parsed.map((msg: Message) => ({
                    ...msg,
                    id: msg.id || generateMessageId(),
                }));
            }
            return [];
        } catch {
            return [];
        }
    });
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const conversationIdRef = useRef<string>(
        (() => {
            const saved = localStorage.getItem(CONVERSATION_ID_KEY);
            if (saved) return saved;
            const newId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem(CONVERSATION_ID_KEY, newId);
            return newId;
        })()
    );

    // Persist messages to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }, [messages]);

    const resetChat = useCallback(() => {
        setMessages([]);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CONVERSATION_ID_KEY);
        const newId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        conversationIdRef.current = newId;
        localStorage.setItem(CONVERSATION_ID_KEY, newId);
        setError(null);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Check if AI is enabled
    useEffect(() => {
        const checkEnabled = async () => {
            try {
                const response = await fetch('/api/chat/enabled', {
                    credentials: 'include',
                });
                const data = await response.json();
                setIsEnabled(data.enabled);
                if (!data.enabled) {
                    setError(
                        'AI chat is not configured. Please set up your AI provider in Profile Settings > Integrations.'
                    );
                } else {
                    setError(null);
                }
            } catch (err) {
                console.error('Error checking AI status:', err);
                setIsEnabled(false);
                setError('Unable to connect to AI service.');
            }
        };
        checkEnabled();

        // Re-check when window gains focus (user returns from settings)
        const handleFocus = () => {
            checkEnabled();
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading || !isEnabled) return;

        const userMessage: Message = {
            id: generateMessageId(),
            role: 'user',
            content: input,
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/chat/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    message: input,
                    history: messages.slice(-10),
                    conversationId: conversationIdRef.current,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get response');
            }

            const data = await response.json();
            const answer = data.answer || data.message;
            const assistantMessage: Message = {
                id: generateMessageId(),
                role: 'assistant',
                content: answer,
                plan: data.plan,
                data: data.data,
                cost: data.cost || null,
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (err) {
            console.error('Chat error:', err);
            const errorMessage: Message = {
                id: generateMessageId(),
                role: 'assistant',
                content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
            };
            setMessages((prev) => [...prev, errorMessage]);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const suggestionCategories = [
        {
            title: 'Tasks',
            icon: '📋',
            queries: [
                'Show me my tasks due today',
                'What are my high priority tasks?',
                'List my overdue tasks',
                'Show tasks due this week',
            ],
        },
        {
            title: 'Projects',
            icon: '📁',
            queries: [
                'What projects am I working on?',
                'Show my active projects',
                'Which project needs the most attention?',
            ],
        },
        {
            title: 'Productivity',
            icon: '📊',
            queries: [
                'How productive am I this week?',
                'What is my task completion rate?',
                'Give me a summary of my work',
                'How can I improve my productivity?',
            ],
        },
        {
            title: 'Planning',
            icon: '🎯',
            queries: [
                'What should I focus on today?',
                'Help me prioritize my tasks',
                'What tasks are coming up next week?',
            ],
        },
    ];

    const handleSuggestionClick = (query: string) => {
        setInput(query);
        textareaRef.current?.focus();
    };

    return (
        <div className="fixed inset-0 top-16 lg:left-72 flex flex-col bg-gray-100 dark:bg-gray-800 z-10">
            {/* Header */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                AI Assistant
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Chat with your tasks, projects, and notes
                            </p>
                        </div>
                    </div>
                    {messages.length > 0 && (
                        <button
                            onClick={resetChat}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Clear chat history"
                        >
                            <TrashIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Reset</span>
                        </button>
                    )}
                </div>
                {error && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-200">
                            {error}
                        </p>
                    </div>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-5xl mx-auto space-y-6">
                    {messages.length === 0 && isEnabled && (
                        <div className="mt-8">
                            <div className="text-center mb-10">
                                <SparklesIcon className="h-16 w-16 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                                <p className="text-xl text-gray-700 dark:text-gray-300 mb-2">
                                    Hello! How can I help you today?
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Ask me anything about your tasks, projects,
                                    or productivity
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                                {suggestionCategories.map((category) => (
                                    <div
                                        key={category.title}
                                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-lg">
                                                {category.icon}
                                            </span>
                                            <h3 className="font-medium text-gray-900 dark:text-white">
                                                {category.title}
                                            </h3>
                                        </div>
                                        <div className="space-y-2">
                                            {category.queries.map(
                                                (query, index) => (
                                                    <button
                                                        key={index}
                                                        onClick={() =>
                                                            handleSuggestionClick(
                                                                query
                                                            )
                                                        }
                                                        className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                                                    >
                                                        {query}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((message) => {
                        const isAssistant = message.role === 'assistant';
                        const isStructuredResponse =
                            message.content.includes('[TASK:') ||
                            message.content.includes('[PROJECT:');
                        const widthClass = isAssistant
                            ? 'w-full max-w-5xl'
                            : isStructuredResponse
                              ? 'max-w-full'
                              : 'max-w-3xl';
                        const baseStyleClass = isAssistant
                            ? 'text-gray-900 dark:text-gray-100 px-1 py-1'
                            : 'rounded-2xl px-4 py-3 bg-blue-600 text-white';

                        return (
                            <div
                                key={message.id}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`${widthClass} ${baseStyleClass} ${
                                        isAssistant ? '' : 'shadow-sm'
                                    }`}
                                >
                                    {isAssistant ? (
                                        <>
                                            {(message.cost ||
                                                message.content.includes(
                                                    '[METADATA]'
                                                )) && (
                                                <>
                                                    <div className="text-[11px] text-gray-400 dark:text-gray-500 mb-2 font-mono opacity-60">
                                                        {message.cost && (
                                                            <>
                                                                {
                                                                    message.cost
                                                                        .total_tokens
                                                                }{' '}
                                                                tokens · $
                                                                {message.cost.total_cost.toFixed(
                                                                    4
                                                                )}
                                                                {message.content.includes(
                                                                    '[METADATA]'
                                                                ) && ' · '}
                                                            </>
                                                        )}
                                                        {message.content.includes(
                                                            '[METADATA]'
                                                        ) && (
                                                            <>
                                                                {message.content
                                                                    .match(
                                                                        /\[METADATA\](.*?)\[DETAILS\]/
                                                                    )?.[1]
                                                                    ?.trim() ||
                                                                    ''}
                                                            </>
                                                        )}
                                                    </div>
                                                    {message.content.includes(
                                                        '[DETAILS]'
                                                    ) && (
                                                        <details className="text-[10px] text-gray-400 dark:text-gray-500 mb-2 font-mono opacity-50">
                                                            <summary className="cursor-pointer hover:opacity-80">
                                                                Show query
                                                                details
                                                            </summary>
                                                            <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-[9px] overflow-x-auto">
                                                                {JSON.stringify(
                                                                    JSON.parse(
                                                                        message.content.match(
                                                                            /\[DETAILS\](.*?)\[\/DETAILS\]/
                                                                        )?.[1] ||
                                                                            '{}'
                                                                    ),
                                                                    null,
                                                                    2
                                                                )}
                                                            </pre>
                                                        </details>
                                                    )}
                                                    <hr className="border-gray-200 dark:border-gray-700 opacity-30 mb-3" />
                                                </>
                                            )}
                                            <div className="prose dark:prose-invert prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1">
                                                <ChatItemRenderer
                                                    content={message.content}
                                                    plan={message.plan}
                                                    dataPayload={message.data}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <p className="whitespace-pre-wrap">
                                            {message.content}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 border border-gray-200 dark:border-gray-700">
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div
                                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                        style={{ animationDelay: '0.1s' }}
                                    ></div>
                                    <div
                                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                        style={{ animationDelay: '0.2s' }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-4">
                <div className="max-w-5xl mx-auto">
                    <div className="flex gap-3 items-start">
                        <div className="flex-1 relative">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={
                                    isEnabled
                                        ? 'Ask me anything about your tasks...'
                                        : 'AI chat is not configured'
                                }
                                className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 pr-12 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={1}
                                disabled={isLoading || !isEnabled}
                                style={{
                                    minHeight: '50px',
                                    maxHeight: '200px',
                                }}
                            />
                        </div>
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading || !isEnabled}
                            className="flex-shrink-0 h-[50px] px-5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center"
                            title={
                                !isEnabled
                                    ? 'AI chat is not configured'
                                    : 'Send message'
                            }
                        >
                            <PaperAirplaneIcon className="h-6 w-6" />
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                        Press Enter to send, Shift+Enter for new line
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatPage;
