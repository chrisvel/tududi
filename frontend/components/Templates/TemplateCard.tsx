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

const ACCENT_COLORS = [
    { bar: 'bg-violet-500', badge: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
    { bar: 'bg-blue-500',   badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
    { bar: 'bg-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
    { bar: 'bg-rose-500',  badge: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' },
    { bar: 'bg-amber-500', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
    { bar: 'bg-cyan-500',  badge: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
    { bar: 'bg-pink-500',  badge: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300' },
    { bar: 'bg-teal-500',  badge: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300' },
];

function categoryAccent(category?: string | null) {
    if (!category) return { bar: 'bg-indigo-500', badge: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' };
    let hash = 0;
    for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) & 0xffff;
    return ACCENT_COLORS[hash % ACCENT_COLORS.length];
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
    const accent = categoryAccent(template.template_category);

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

    return (
        <div
            onClick={() => onPreview(template)}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col group hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 cursor-pointer"
        >
            <div className={`h-1.5 w-full flex-shrink-0 ${accent.bar}`} />

            <div className="p-4 flex flex-col gap-2.5 flex-1 relative">
                <div className="absolute top-2 right-2 z-10" ref={dropdownRef}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            justOpenedRef.current = true;
                            setDropdownOpen((v) => !v);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                        aria-label={t('templates.toggleMenu', 'Toggle menu')}
                    >
                        <EllipsisVerticalIcon className="h-4 w-4" />
                    </button>

                    {dropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-700 shadow-lg rounded-lg border border-gray-100 dark:border-gray-600 z-[60] py-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); onClone(template); setDropdownOpen(false); }}
                                className="block px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 w-full text-left"
                            >
                                {t('templates.useTemplate', 'Use Template')}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onPreview(template); setDropdownOpen(false); }}
                                className="block px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 w-full text-left"
                            >
                                {t('templates.preview', 'Preview')}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(template); setDropdownOpen(false); }}
                                className="block px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 w-full text-left"
                            >
                                {t('common.edit', 'Edit')}
                            </button>
                            <div className="my-1 border-t border-gray-100 dark:border-gray-600" />
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(template); setDropdownOpen(false); }}
                                className="block px-3 py-1.5 text-sm text-red-500 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-600 w-full text-left"
                            >
                                {t('common.delete', 'Delete')}
                            </button>
                        </div>
                    )}
                </div>

                <h3 className="text-sm font-semibold text-gray-900 dark:text-white pr-6 leading-snug">
                    {template.name}
                </h3>

                {template.template_category && (
                    <span className={`text-xs px-2 py-0.5 rounded-full self-start font-medium ${accent.badge}`}>
                        {template.template_category}
                    </span>
                )}

                {template.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {template.description}
                    </p>
                )}
            </div>

            <div className="flex items-stretch divide-x divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                {[
                    { icon: <CheckCircleIcon className="h-3.5 w-3.5" />, count: template.task_count ?? 0, label: t('templates.tasks', 'tasks') },
                    { icon: <ArrowDownTrayIcon className="h-3.5 w-3.5" />, count: template.clone_count ?? 0, label: t('templates.uses', 'uses') },
                ].map(({ icon, count, label }) => (
                    <div key={label} className="flex-1 flex flex-col items-center py-3 gap-0.5">
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
