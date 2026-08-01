import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Template, CloneTemplateOptions } from '../../entities/Template';
import { Area } from '../../entities/Area';

interface TemplateCloneModalProps {
    template: Template;
    areas: Area[];
    onConfirm: (options: CloneTemplateOptions) => void;
    onClose: () => void;
}

const TemplateCloneModal: React.FC<TemplateCloneModalProps> = ({
    template,
    areas,
    onConfirm,
    onClose,
}) => {
    const { t } = useTranslation();
    const [name, setName] = useState(`${template.name} (Copy)`);
    const [startDate, setStartDate] = useState('');
    const [resetStatus, setResetStatus] = useState(true);
    const [areaUid, setAreaUid] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm({
            name: name.trim() || `${template.name} (Copy)`,
            startDate: startDate || null,
            area_uid: areaUid || null,
            resetStatus,
        });
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                {t('templates.cloneTitle', 'Create Project from Template')}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {t('templates.cloneSubtitle', 'Configure your new project from "{{name}}"', { name: template.name })}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {t('templates.newProjectName', 'Project Name')}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {t('templates.area', 'Area')}
                            <span className="ml-1 font-normal text-gray-400 dark:text-gray-500 text-xs">{t('common.optional', '(optional)')}</span>
                        </label>
                        <select
                            value={areaUid}
                            onChange={(e) => setAreaUid(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">{t('templates.noArea', 'No area')}</option>
                            {areas.map((area) => (
                                <option key={area.uid} value={area.uid}>
                                    {area.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {t('templates.startDate', 'Start Date')}
                            <span className="ml-1 font-normal text-gray-400 dark:text-gray-500 text-xs">{t('templates.startDateHint2', 'adjusts relative due dates')}</span>
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {t('templates.startDateHint', 'Leave empty to keep original due dates.')}
                        </p>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            id="resetStatus"
                            checked={resetStatus}
                            onChange={(e) => setResetStatus(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 rounded border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            {t('templates.resetStatus', 'Reset all tasks to Not Started')}
                        </span>
                    </label>

                    <div className="flex justify-end gap-3 pt-1 border-t border-gray-100 dark:border-gray-700 mt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                        >
                            {t('templates.createProject', 'Create Project')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TemplateCloneModal;
