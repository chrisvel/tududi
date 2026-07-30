import React, { useState, useEffect, useRef } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Goal, GoalHorizon, GoalStatus } from '../../entities/Goal';
import { Area } from '../../entities/Area';
import { useToast } from '../Shared/ToastContext';
import DiscardChangesDialog from '../Shared/DiscardChangesDialog';

interface GoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Goal>) => Promise<void>;
    onDelete?: (uid: string) => Promise<void>;
    goal?: Goal | null;
    areas?: Area[];
    defaultAreaId?: number | null;
}

const GoalModal: React.FC<GoalModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    goal,
    areas = [],
    defaultAreaId,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const titleInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const hasUnsavedChangesRef = useRef<() => boolean>(() => false);

    const getDefaultForm = (): Partial<Goal> => ({
        title: '',
        why: '',
        horizon: 'season' as GoalHorizon,
        status: 'active' as GoalStatus,
        target_date: '',
        area_id: defaultAreaId ?? null,
    });

    const [formData, setFormData] = useState<Partial<Goal>>(getDefaultForm());
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(
                goal
                    ? {
                          title: goal.title,
                          why: goal.why ?? '',
                          horizon: goal.horizon,
                          status: goal.status,
                          target_date: goal.target_date ?? '',
                          area_id: goal.area_id ?? null,
                      }
                    : getDefaultForm()
            );
            setError(null);
            setTimeout(() => titleInputRef.current?.focus(), 100);
        }
    }, [isOpen, goal]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showDiscardDialog) return;
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, showDiscardDialog]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showDiscardDialog) return;
                e.preventDefault();
                if (hasUnsavedChangesRef.current()) {
                    setShowDiscardDialog(true);
                } else {
                    handleClose();
                }
            }
        };
        if (isOpen) document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showDiscardDialog]);

    const hasUnsavedChanges = () => {
        if (!goal) return (formData.title?.trim() ?? '') !== '';
        return (
            formData.title !== goal.title ||
            formData.why !== (goal.why ?? '') ||
            formData.horizon !== goal.horizon ||
            formData.status !== goal.status ||
            formData.target_date !== (goal.target_date ?? '') ||
            formData.area_id !== (goal.area_id ?? null)
        );
    };

    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    });

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
            setShowDiscardDialog(false);
        }, 300);
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === 'area_id' ? (value ? parseInt(value, 10) : null) : value,
        }));
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!formData.title?.trim()) {
            setError(t('errors.goalTitleRequired', 'Goal title is required'));
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            await onSave({
                ...formData,
                target_date: formData.target_date || null,
                area_id: formData.area_id || null,
            });
            showSuccessToast(
                goal
                    ? t('success.goalUpdated', 'Goal updated!')
                    : t('success.goalCreated', 'Goal created!')
            );
            handleClose();
        } catch (err) {
            setError((err as Error).message);
            showErrorToast(t('errors.failedToSaveGoal', 'Failed to save goal.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!goal?.uid || !onDelete) return;
        try {
            await onDelete(goal.uid);
            showSuccessToast(t('success.goalDeleted', 'Goal deleted!'));
            handleClose();
        } catch {
            showErrorToast(t('errors.failedToDeleteGoal', 'Failed to delete goal.'));
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className={`fixed top-16 left-0 right-0 bottom-0 bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 overflow-hidden sm:overflow-y-auto ${
                    isClosing ? 'opacity-0' : 'opacity-100'
                }`}
            >
                <div className="h-full flex items-center justify-center sm:px-4 sm:py-4">
                    <div
                        ref={modalRef}
                        className={`bg-white dark:bg-gray-800 border-0 sm:border sm:border-gray-200 sm:dark:border-gray-700 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-md transform transition-transform duration-300 ${
                            isClosing ? 'scale-95' : 'scale-100'
                        } h-full sm:h-auto sm:my-4`}
                    >
                        <div className="flex flex-col h-full sm:min-h-[400px] sm:max-h-[90vh]">
                            <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 sm:rounded-lg">
                                <div className="flex-1 relative">
                                    <div
                                        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                                        style={{ WebkitOverflowScrolling: 'touch' }}
                                    >
                                        <form className="h-full" onSubmit={handleSubmit}>
                                            <fieldset className="h-full flex flex-col">
                                                {/* Title */}
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4 pt-4 sm:rounded-t-lg">
                                                    <input
                                                        ref={titleInputRef}
                                                        type="text"
                                                        name="title"
                                                        value={formData.title ?? ''}
                                                        onChange={handleChange}
                                                        required
                                                        className="block w-full text-xl font-semibold bg-transparent text-black dark:text-white border-none focus:outline-none shadow-sm py-2"
                                                        placeholder={t('forms.goalTitlePlaceholder', 'Goal title')}
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-4 px-4 pb-4">
                                                    {/* Why */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                                                            {t('forms.goalWhy', 'Why')}
                                                        </label>
                                                        <textarea
                                                            name="why"
                                                            value={formData.why ?? ''}
                                                            onChange={handleChange}
                                                            rows={3}
                                                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none"
                                                            placeholder={t('forms.goalWhyPlaceholder', 'What will achieving this enable?')}
                                                        />
                                                    </div>

                                                    {/* Horizon + Status row */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                                                                {t('forms.goalHorizon', 'Horizon')}
                                                            </label>
                                                            <select
                                                                name="horizon"
                                                                value={formData.horizon ?? 'season'}
                                                                onChange={handleChange}
                                                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                                            >
                                                                <option value="season">{t('goals.horizon.season', 'Season')}</option>
                                                                <option value="year">{t('goals.horizon.year', 'Year')}</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                                                                {t('forms.goalStatus', 'Status')}
                                                            </label>
                                                            <select
                                                                name="status"
                                                                value={formData.status ?? 'active'}
                                                                onChange={handleChange}
                                                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                                            >
                                                                <option value="active">{t('goals.status.active', 'Active')}</option>
                                                                <option value="achieved">{t('goals.status.achieved', 'Achieved')}</option>
                                                                <option value="paused">{t('goals.status.paused', 'Paused')}</option>
                                                                <option value="dropped">{t('goals.status.dropped', 'Dropped')}</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Target date */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                                                            {t('forms.goalTargetDate', 'Target Date')}
                                                        </label>
                                                        <input
                                                            type="date"
                                                            name="target_date"
                                                            value={formData.target_date ?? ''}
                                                            onChange={handleChange}
                                                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>

                                                    {/* Area (optional, only shown if areas list provided) */}
                                                    {areas.length > 0 && (
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                                                                {t('forms.goalArea', 'Area')} ({t('common.optional', 'optional')})
                                                            </label>
                                                            <select
                                                                name="area_id"
                                                                value={formData.area_id ?? ''}
                                                                onChange={handleChange}
                                                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                                            >
                                                                <option value="">{t('forms.noArea', 'No area')}</option>
                                                                {areas.map((area) => (
                                                                    <option key={area.id} value={area.id}>
                                                                        {area.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>

                                                {error && (
                                                    <div className="text-red-500 px-4 mb-4 text-sm">{error}</div>
                                                )}
                                            </fieldset>
                                        </form>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between sm:rounded-b-lg">
                                    <div className="flex items-center space-x-3">
                                        {goal?.uid && onDelete && (
                                            <button
                                                type="button"
                                                onClick={handleDelete}
                                                className="p-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition duration-150"
                                                title={t('common.delete', 'Delete')}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleClose}
                                            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none text-sm"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleSubmit()}
                                        disabled={isSubmitting}
                                        className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none text-sm ${
                                            isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                    >
                                        {isSubmitting
                                            ? t('modals.submitting')
                                            : goal?.uid
                                              ? t('modals.updateGoal', 'Update Goal')
                                              : t('modals.createGoal', 'Create Goal')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showDiscardDialog && (
                <DiscardChangesDialog
                    onDiscard={() => { setShowDiscardDialog(false); handleClose(); }}
                    onCancel={() => setShowDiscardDialog(false)}
                />
            )}
        </>
    );
};

export default GoalModal;
