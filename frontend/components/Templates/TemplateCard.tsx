import React, { useEffect, useRef, useState } from 'react';
import {
    EllipsisVerticalIcon,
    CheckCircleIcon,
    ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Template } from '../../entities/Template';

interface TemplateCardProps {
    template: Template;
    onClone: (template: Template) => void;
    onEdit: (template: Template) => void;
    onDelete: (template: Template) => void;
    onPreview: (template: Template) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
    template,
    onClone,
    onEdit,
    onDelete,
    onPreview,
}) => {
    const { t } = useTranslation();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const justOpenedRef = useRef(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (justOpenedRef.current) {
                justOpenedRef.current = false;
                return;
            }
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        if (dropdownOpen) {
            const id = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
            return () => {
                clearTimeout(id);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    const stats = [
        { icon: <CheckCircleIcon className="h-3.5 w-3.5" />, count: template.task_count ?? 0, label: t('templates.tasks', 'tasks') },
        { icon: <ArrowDownTrayIcon className="h-3.5 w-3.5" />, count: template.clone_count ?? 0, label: t('templates.uses', 'uses') },
    ];

    return (
        <div
            onClick={() => onPreview(template)}
            className="rounded-xl shadow-sm relative flex flex-col group hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
        >
            {/* Three-dot dropdown */}
            <div className="absolute top-2 right-2 z-10" ref={dropdownRef}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        justOpenedRef.current = true;
                        setDropdownOpen((v) => !v);
                    }}
                    className="focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                    aria-label={t('templates.toggleMenu', 'Toggle menu')}
                >
                    <EllipsisVerticalIcon className="h-4 w-4" />
                </button>

                {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60]">
                        <button
                            onClick={(e) => { e.stopPropagation(); onClone(template); setDropdownOpen(false); }}
                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-t-md"
                        >
                            {t('templates.useTemplate', 'Use Template')}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onPreview(template); setDropdownOpen(false); }}
                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                        >
                            {t('templates.preview', 'Preview')}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(template); setDropdownOpen(false); }}
                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                        >
                            {t('common.edit', 'Edit')}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(template); setDropdownOpen(false); }}
                            className="block px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-b-md"
                        >
                            {t('common.delete', 'Delete')}
                        </button>
                    </div>
                )}
            </div>

            {/* Name + description + category */}
            <div className="px-5 pt-6 pb-4 flex-1 flex items-center justify-center text-center">
                <div>
                    <h3 className="text-sm font-semibold tracking-widest uppercase line-clamp-2 text-gray-800 dark:text-gray-100">
                        {template.name}
                    </h3>
                    {template.description && (
                        <p className="text-xs mt-2 line-clamp-2 leading-relaxed text-gray-500 dark:text-gray-400">
                            {template.description}
                        </p>
                    )}
                    {template.template_category && (
                        <span className="inline-block mt-2 text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                            {template.template_category}
                        </span>
                    )}
                </div>
            </div>

            {/* Stats footer */}
            <div className="rounded-b-xl flex items-stretch divide-x bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-600 divide-gray-200 dark:divide-gray-600">
                {stats.map(({ icon, count, label }) => (
                    <div key={label} className="flex-1 flex flex-col items-center py-3 gap-1">
                        <span className="text-base font-semibold leading-none text-gray-700 dark:text-gray-200">
                            {count}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] leading-none text-gray-400 dark:text-gray-500">
                            {icon}
                            {label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TemplateCard;
