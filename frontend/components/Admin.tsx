import React, { useState, useEffect } from 'react';
import { useToast } from './Shared/ToastContext';
import LoadingScreen from './Shared/LoadingScreen';
import {
    CogIcon,
    ChartBarIcon,
    BeakerIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface Rule {
    id: string;
    name: string;
    description: string;
    priority: number;
    examples?: string[];
    conditions: any;
    action: {
        suggested_type: 'task' | 'note';
        suggested_reason: string;
    };
}

interface RulesData {
    rules: Rule[];
    condition_types: Record<string, any>;
    total_rules: number;
    rules_by_priority: Rule[];
}

interface RulesStats {
    total_rules: number;
    task_rules: number;
    note_rules: number;
    priority_distribution: Record<string, number>;
    condition_types_used: Record<string, number>;
    most_common_reasons: Record<string, number>;
}

const Admin: React.FC = () => {
    const { showSuccessToast, showErrorToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [rulesData, setRulesData] = useState<RulesData | null>(null);
    const [rulesStats, setRulesStats] = useState<RulesStats | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'test'>(
        'overview'
    );
    const [testText, setTestText] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [isTestLoading, setIsTestLoading] = useState(false);

    const fetchRulesData = async () => {
        try {
            setIsLoading(true);
            const [rulesResponse, statsResponse] = await Promise.all([
                fetch('/api/admin/rules'),
                fetch('/api/admin/rules/stats'),
            ]);

            if (rulesResponse.ok && statsResponse.ok) {
                const rules = await rulesResponse.json();
                const stats = await statsResponse.json();
                setRulesData(rules);
                setRulesStats(stats);
            } else {
                throw new Error('Failed to fetch rules data');
            }
        } catch (error) {
            console.error('Error fetching rules:', error);
            showErrorToast('Failed to load rules configuration');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReloadRules = async () => {
        try {
            const response = await fetch('/api/admin/rules/reload', {
                method: 'POST',
            });

            if (response.ok) {
                showSuccessToast('Rules reloaded successfully');
                fetchRulesData(); // Refresh the display
            } else {
                throw new Error('Failed to reload rules');
            }
        } catch (error) {
            console.error('Error reloading rules:', error);
            showErrorToast('Failed to reload rules');
        }
    };

    const handleTestRule = async () => {
        if (!testText.trim()) {
            showErrorToast('Please enter some text to test');
            return;
        }

        try {
            setIsTestLoading(true);
            const response = await fetch('/api/admin/rules/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: testText }),
            });

            if (response.ok) {
                const result = await response.json();
                setTestResult(result);
            } else {
                throw new Error('Failed to test rules');
            }
        } catch (error) {
            console.error('Error testing rules:', error);
            showErrorToast('Failed to test rules');
        } finally {
            setIsTestLoading(false);
        }
    };

    useEffect(() => {
        fetchRulesData();
    }, []);

    if (isLoading) {
        return <LoadingScreen />;
    }

    const renderOverview = () => (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div className="flex items-center">
                        <CogIcon className="h-8 w-8 text-blue-500" />
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Total Rules
                            </p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {rulesStats?.total_rules || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                            T
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Task Rules
                            </p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {rulesStats?.task_rules || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                            N
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Note Rules
                            </p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {rulesStats?.note_rules || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div className="flex items-center">
                        <ChartBarIcon className="h-8 w-8 text-purple-500" />
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Condition Types
                            </p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {rulesStats
                                    ? Object.keys(
                                          rulesStats.condition_types_used
                                      ).length
                                    : 0}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Priority Distribution */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">
                    Priority Distribution
                </h3>
                <div className="space-y-2">
                    {rulesStats &&
                        Object.entries(rulesStats.priority_distribution)
                            .sort(([a], [b]) => parseInt(b) - parseInt(a))
                            .map(([priority, count]) => (
                                <div
                                    key={priority}
                                    className="flex items-center justify-between"
                                >
                                    <span className="text-sm font-medium">
                                        Priority {priority}
                                    </span>
                                    <div className="flex items-center">
                                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                                            <div
                                                className="bg-blue-500 h-2 rounded-full"
                                                style={{
                                                    width: `${(count / (rulesStats.total_rules || 1)) * 100}%`,
                                                }}
                                            ></div>
                                        </div>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {count}
                                        </span>
                                    </div>
                                </div>
                            ))}
                </div>
            </div>

            {/* Most Common Reasons */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">
                    Most Common Suggestion Reasons
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rulesStats &&
                        Object.entries(rulesStats.most_common_reasons)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 6)
                            .map(([reason, count]) => (
                                <div
                                    key={reason}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
                                >
                                    <span className="text-sm font-medium">
                                        {reason}
                                    </span>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {count} rules
                                    </span>
                                </div>
                            ))}
                </div>
            </div>
        </div>
    );

    const renderRulesList = () => (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Rule
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Priority
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Reason
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Examples
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {rulesData?.rules_by_priority.map((rule) => (
                            <tr
                                key={rule.id}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {rule.name}
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            {rule.description}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                        {rule.priority}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span
                                        className={`px-2 py-1 text-xs font-medium rounded ${
                                            rule.action.suggested_type ===
                                            'task'
                                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                                : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                                        }`}
                                    >
                                        {rule.action.suggested_type}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {rule.action.suggested_reason}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {rule.examples &&
                                    rule.examples.length > 0 ? (
                                        <div className="space-y-1">
                                            {rule.examples
                                                .slice(0, 2)
                                                .map((example, index) => (
                                                    <div
                                                        key={index}
                                                        className="text-xs font-mono bg-gray-100 dark:bg-gray-700 p-1 rounded border-l-2 border-blue-300"
                                                    >
                                                        {example}
                                                    </div>
                                                ))}
                                            {rule.examples.length > 2 && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    +{rule.examples.length - 2}{' '}
                                                    more
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-gray-400">
                                            No examples
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderTestInterface = () => (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">
                    Test Rules Engine
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Test Text
                        </label>
                        <textarea
                            value={testText}
                            onChange={(e) => setTestText(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            rows={3}
                            placeholder="Enter text to test against rules engine... (e.g., 'Call the doctor +Health', 'https://example.com +Research')"
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleTestRule}
                            disabled={isTestLoading || !testText.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            <BeakerIcon className="h-4 w-4 mr-2" />
                            {isTestLoading ? 'Testing...' : 'Test Rules'}
                        </button>

                        <button
                            onClick={() => setTestText('')}
                            className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                        >
                            Clear
                        </button>
                    </div>

                    {/* Quick Examples */}
                    <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Quick Examples (click to test):
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {[
                                'Call the doctor +Health',
                                'https://docs.react.dev +Development',
                                'Send email to client +ProjectX',
                                'Urgent meeting with stakeholders +CriticalProject',
                                'Interesting idea about AI features +Innovation',
                                'API documentation review +"Backend Development"',
                            ].map((example, index) => (
                                <button
                                    key={index}
                                    onClick={() => setTestText(example)}
                                    className="text-left text-xs p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded border font-mono transition-colors"
                                >
                                    {example}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {testResult && (
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            Test Results:
                        </h4>

                        <div className="space-y-2 text-sm">
                            <div>
                                <span className="font-medium">Input: </span>
                                <span className="font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                                    {testResult.input}
                                </span>
                            </div>

                            <div>
                                <span className="font-medium">
                                    Parsed Tags:{' '}
                                </span>
                                <span>
                                    {testResult.result.parsed_tags.join(', ') ||
                                        'None'}
                                </span>
                            </div>

                            <div>
                                <span className="font-medium">
                                    Parsed Projects:{' '}
                                </span>
                                <span>
                                    {testResult.result.parsed_projects.join(
                                        ', '
                                    ) || 'None'}
                                </span>
                            </div>

                            <div>
                                <span className="font-medium">
                                    Cleaned Content:{' '}
                                </span>
                                <span className="font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                                    {testResult.result.cleaned_content}
                                </span>
                            </div>

                            <div>
                                <span className="font-medium">
                                    Suggestion:{' '}
                                </span>
                                {testResult.result.suggested_type ? (
                                    <span
                                        className={`px-2 py-1 text-xs font-medium rounded ${
                                            testResult.result.suggested_type ===
                                            'task'
                                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                                : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                                        }`}
                                    >
                                        {testResult.result.suggested_type} (
                                        {testResult.result.suggested_reason})
                                    </span>
                                ) : (
                                    <span className="text-gray-500">
                                        No suggestion
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-6xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center">
                        <CogIcon className="h-6 w-6 mr-2" />
                        <h1 className="text-2xl font-light">
                            Rules Engine Admin
                        </h1>
                    </div>
                    <button
                        onClick={handleReloadRules}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                        <ArrowPathIcon className="h-4 w-4 mr-2" />
                        Reload Rules
                    </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        {[
                            { id: 'overview', label: 'Overview' },
                            { id: 'rules', label: 'Rules' },
                            { id: 'test', label: 'Test' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'rules' && renderRulesList()}
                {activeTab === 'test' && renderTestInterface()}
            </div>
        </div>
    );
};

export default Admin;
