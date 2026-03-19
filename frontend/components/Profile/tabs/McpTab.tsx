import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CpuChipIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../Shared/ToastContext';
import { getApiPath } from '../../../config/paths';

interface McpTabProps {
    isActive: boolean;
}

interface McpConfig {
    mcpServers: {
        tududi: {
            command: string;
            args: string[];
            env: {
                TUDUDI_API_TOKEN: string;
                NODE_ENV: string;
            };
        };
    };
}

interface ToolCategory {
    category: string;
    count: number;
    tools: string[];
}

const McpTab: React.FC<McpTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [config, setConfig] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [tools, setTools] = useState<ToolCategory[]>([]);

    useEffect(() => {
        if (isActive) {
            loadMcpConfig();
            loadMcpTools();
        }
    }, [isActive]);

    const loadMcpConfig = async () => {
        setLoading(true);
        try {
            const response = await fetch(getApiPath('mcp/config'), {
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error('Failed to load MCP configuration');
            }
            const data: McpConfig = await response.json();
            setConfig(JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error loading MCP config:', error);
            showErrorToast('Failed to load MCP configuration');
        } finally {
            setLoading(false);
        }
    };

    const loadMcpTools = async () => {
        try {
            const response = await fetch(getApiPath('mcp/tools'), {
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error('Failed to load MCP tools');
            }
            const data = await response.json();
            setTools(data.tools);
        } catch (error) {
            console.error('Error loading MCP tools:', error);
        }
    };

    const copyConfig = async () => {
        try {
            await navigator.clipboard.writeText(config);
            showSuccessToast('Configuration copied to clipboard');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            showErrorToast('Failed to copy to clipboard');
        }
    };

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <CpuChipIcon className="w-6 h-6 mr-3 text-indigo-500" />
                {t('profile.mcp.title', 'MCP Integration')}
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                {t(
                    'profile.mcp.description',
                    'Connect tududi with Claude Desktop using the Model Context Protocol. This enables natural language interaction with your tasks, projects, and notes.'
                )}
            </p>

            <div className="space-y-8">
                {/* Step 1: API Token */}
                <section className="border-l-4 border-indigo-500 pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {t('profile.mcp.step1.title', '1. Generate API Token')}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        {t(
                            'profile.mcp.step1.description',
                            'You need an API token to authenticate the MCP server. Go to the API Keys tab to generate one.'
                        )}
                    </p>
                    <a
                        href="/profile?section=api-keys"
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        {t('profile.mcp.step1.button', 'Go to API Keys →')}
                    </a>
                </section>

                {/* Step 2: Configuration */}
                <section className="border-l-4 border-indigo-500 pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {t(
                            'profile.mcp.step2.title',
                            '2. Configure Claude Desktop'
                        )}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        {t(
                            'profile.mcp.step2.description',
                            'Add this configuration to your Claude Desktop config file. Replace YOUR_API_TOKEN_HERE with the token you generated in step 1.'
                        )}
                    </p>

                    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                            <span className="text-xs font-mono text-gray-400">
                                claude_desktop_config.json
                            </span>
                            <button
                                onClick={copyConfig}
                                disabled={loading}
                                className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                <DocumentDuplicateIcon className="w-4 h-4 mr-1" />
                                {t('profile.mcp.step2.copy', 'Copy')}
                            </button>
                        </div>
                        <pre className="p-4 text-sm text-gray-100 font-mono overflow-x-auto">
                            {loading
                                ? t('profile.mcp.step2.loading', 'Loading...')
                                : config}
                        </pre>
                    </div>

                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                        <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
                            {t('profile.mcp.step2.locationTitle', 'Config file location:')}
                        </p>
                        <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 font-mono">
                            <li>
                                <strong>Mac:</strong> ~/Library/Application
                                Support/Claude/claude_desktop_config.json
                            </li>
                            <li>
                                <strong>Linux:</strong>{' '}
                                ~/.config/claude/claude_desktop_config.json
                            </li>
                        </ul>
                    </div>
                </section>

                {/* Step 3: Available Tools */}
                <section className="border-l-4 border-indigo-500 pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {t(
                            'profile.mcp.step3.title',
                            '3. Available Operations'
                        )}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        {t(
                            'profile.mcp.step3.description',
                            'Once configured, Claude will have access to these 16 operations:'
                        )}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tools.map((category) => (
                            <div
                                key={category.category}
                                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                                <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                    {category.category} ({category.count})
                                </h5>
                                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                    {category.tools.map((tool) => (
                                        <li
                                            key={tool}
                                            className="font-mono text-xs"
                                        >
                                            • {tool}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Step 4: Usage */}
                <section className="border-l-4 border-indigo-500 pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {t('profile.mcp.step4.title', '4. Start Using')}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        {t(
                            'profile.mcp.step4.description',
                            'After adding the configuration, restart Claude Desktop. You can then use natural language to interact with tududi:'
                        )}
                    </p>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('profile.mcp.step4.examplesTitle', 'Example prompts:')}
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                            <li className="italic">
                                "Show me my tasks for today"
                            </li>
                            <li className="italic">
                                "Create a task to review the MCP integration"
                            </li>
                            <li className="italic">
                                "What projects do I have in progress?"
                            </li>
                            <li className="italic">
                                "Add a reminder to my inbox to check emails"
                            </li>
                            <li className="italic">
                                "Search for tasks related to documentation"
                            </li>
                        </ul>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default McpTab;
