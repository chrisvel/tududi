import React from 'react';

interface TabConfig {
    id: string;
    name: string;
    icon: React.ReactNode;
}

interface TabsNavProps {
    tabs: TabConfig[];
    activeTab: string;
    onChange: (id: string) => void;
}

const TabsNav: React.FC<TabsNavProps> = ({ tabs, activeTab, onChange }) => (
    <nav className="space-y-1">
        {tabs.map((tab) => (
            <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                }`}
            >
                <span className="mr-3 flex-shrink-0">{tab.icon}</span>
                <span className="text-left">{tab.name}</span>
            </button>
        ))}
    </nav>
);

export type { TabConfig };
export default TabsNav;
