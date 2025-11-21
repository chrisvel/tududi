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
    <div className="mb-8">
        <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        className={`group inline-flex items-center py-2 px-1 sm:px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                    >
                        <span className="mr-1 sm:mr-2">{tab.icon}</span>
                        {tab.name}
                    </button>
                ))}
            </nav>
        </div>
    </div>
);

export type { TabConfig };
export default TabsNav;
