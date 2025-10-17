import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/outline';
import 'highlight.js/styles/github-dark.css';
import ChatItemRenderer from './ChatItemRenderer';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    cost?: {
        total_cost: number;
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    } | null;
}

const ChatPage: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const conversationIdRef = useRef<string>(
        `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );

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
                        'AI chat is not configured. Please set up your API key in environment variables.'
                    );
                }
            } catch (err) {
                console.error('Error checking AI status:', err);
                setIsEnabled(false);
                setError('Unable to connect to AI service.');
            }
        };
        checkEnabled();
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

        const userMessage: Message = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/chat/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    message: input,
                    history: messages.slice(-10), // Last 10 messages for context
                    conversationId: conversationIdRef.current,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get response');
            }

            const data = await response.json();
            const assistantMessage: Message = {
                role: 'assistant',
                content: data.message,
                cost: data.cost || null,
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (err) {
            console.error('Chat error:', err);
            const errorMessage: Message = {
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

    const suggestedQueries = [
        'Show me my tasks due this week',
        "What's my progress on active projects?",
        'List all high priority tasks',
        'Summarize my overdue tasks',
    ];

    const handleSuggestionClick = (query: string) => {
        setInput(query);
        textareaRef.current?.focus();
    };

    return (
        <div className="fixed inset-0 top-16 lg:left-72 flex flex-col bg-gray-50 dark:bg-gray-900 z-10">
            {/* Header */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
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
                <div className="max-w-4xl mx-auto space-y-6">
                    {messages.length === 0 && isEnabled && (
                        <div className="text-center mt-20">
                            <SparklesIcon className="h-16 w-16 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                            <p className="text-xl text-gray-700 dark:text-gray-300 mb-2">
                                Hello! How can I help you today?
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                                Ask me anything about your tasks, projects, or
                                productivity
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                                {suggestedQueries.map((query, index) => (
                                    <button
                                        key={index}
                                        onClick={() =>
                                            handleSuggestionClick(query)
                                        }
                                        className="p-4 text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all"
                                    >
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                            {query}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-3xl rounded-2xl px-4 py-3 ${
                                    message.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                                }`}
                            >
                                {message.role === 'assistant' ? (
                                    <>
                                        <div className="prose dark:prose-invert prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1">
                                            <ChatItemRenderer
                                                content={message.content}
                                            />
                                        </div>
                                        {message.cost && (
                                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="font-mono">
                                                    $
                                                    {message.cost.total_cost.toFixed(
                                                        6
                                                    )}{' '}
                                                    •{' '}
                                                    {message.cost.total_tokens}{' '}
                                                    tokens
                                                </span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="whitespace-pre-wrap">
                                        {message.content}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}

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
                <div className="max-w-4xl mx-auto">
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
