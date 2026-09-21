import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SidebarVisibleSections } from '../types';

interface SidebarTabProps {
    isActive: boolean;
    isAdmin?: boolean;
    visibleSections: SidebarVisibleSections;
    onToggleSection: (key: keyof SidebarVisibleSections) => void;
}

interface ToggleRowProps {
    label: string;
    description: string;
    value: boolean;
    onToggle: () => void;
    last?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
    label,
    description,
    value,
    onToggle,
    last,
}) => (
    <div
        className={`flex items-center justify-between py-4 ${
            last ? '' : 'border-b border-gray-200 dark:border-gray-700'
        }`}
    >
        <div className="pr-8">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description}
            </p>
        </div>
        <div
            className={`relative inline-block w-12 h-6 flex-shrink-0 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={onToggle}
        >
            <span
                className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                    value ? 'translate-x-6' : 'translate-x-0'
                }`}
            />
        </div>
    </div>
);

const SidebarTab: React.FC<SidebarTabProps> = ({
    isActive,
    isAdmin = false,
    visibleSections,
    onToggleSection,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    // Every entry here becomes a toggleable sidebar section. Add future
    // sections by appending to this list and to SidebarVisibleSections.
    const sections: Array<{
        key: keyof SidebarVisibleSections;
        label: string;
        description: string;
    }> = [
        {
            key: 'upcomingTasks',
            label: t('sidebar.upcoming', 'Upcoming'),
            description: t(
                'profile.upcomingTasksDescription',
                'Show the Upcoming Tasks link in the sidebar navigation.'
            ),
        },
        {
            key: 'assignedToMe',
            label: t('sidebar.assignedToMe', 'Assigned to me'),
            description: t(
                'profile.assignedToMeDescription',
                'Show the Assigned to me link in the sidebar navigation.'
            ),
        },
        {
            key: 'everyone',
            label: t('sidebar.everyone', 'Everyone'),
            description: t(
                'profile.everyoneDescription',
                'Show the Everyone link in the sidebar navigation.'
            ),
        },
    ];

    const entitySections: Array<{
        key: keyof SidebarVisibleSections;
        label: string;
    }> = [
        { key: 'favorites', label: t('sidebar.bookmarks', 'Favorites') },
        { key: 'projects', label: t('sidebar.projects', 'Projects') },
        { key: 'areas', label: t('sidebar.areas', 'Areas') },
        { key: 'goals', label: t('sidebar.goals', 'Goals') },
        { key: 'notes', label: t('sidebar.notes', 'Notes') },
        { key: 'tags', label: t('sidebar.tags', 'Tags') },
        { key: 'people', label: t('sidebar.people', 'People') },
        { key: 'habits', label: t('sidebar.habits', 'Habits') },
        { key: 'views', label: t('sidebar.views', 'Views') },
        { key: 'boards', label: t('sidebar.boards', 'Boards') },
        { key: 'insights', label: t('sidebar.insights', 'Insights') },
        { key: 'calendar', label: t('sidebar.calendar', 'Calendar') },
        { key: 'templates', label: t('navigation.templates', 'Templates') },
        ...(isAdmin
            ? [
                  {
                      key: 'access' as const,
                      label: t('admin.access.title', 'Access'),
                  },
              ]
            : []),
    ];
    for (const { key, label } of entitySections) {
        sections.push({
            key,
            label,
            description: t(
                'profile.sidebarSectionDescription',
                'Show the {{name}} section in the sidebar.',
                { name: label }
            ),
        });
    }
    sections.sort((a, b) => a.label.localeCompare(b.label));

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                {t('profile.tabs.sidebar', 'Sidebar')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {t(
                    'profile.sidebarDescription',
                    'Choose which sections appear in your sidebar navigation.'
                )}
            </p>

            <div className="space-y-0">
                {sections.map((section, index) => (
                    <ToggleRow
                        key={section.key}
                        label={section.label}
                        description={section.description}
                        value={visibleSections[section.key] !== false}
                        onToggle={() => onToggleSection(section.key)}
                        last={index === sections.length - 1}
                    />
                ))}
            </div>
        </div>
    );
};

export default SidebarTab;
