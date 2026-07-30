import React, { useState, useEffect, useRef } from 'react';
import { Area } from '../../entities/Area';
import { Goal } from '../../entities/Goal';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import DiscardChangesDialog from '../Shared/DiscardChangesDialog';
import { TrashIcon, ChevronDownIcon, FlagIcon, CheckIcon } from '@heroicons/react/24/outline';
import ColorPicker from '../Shared/ColorPicker';
import { useStore } from '../../store/useStore';
import { updateGoal } from '../../utils/goalsService';

interface AreaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (areaData: Partial<Area>) => Promise<void>;
    onDelete?: (areaUid: string) => Promise<void>;
    area?: Area | null;
}

const AreaModal: React.FC<AreaModalProps> = ({
    isOpen,
    onClose,
    area,
    onSave,
    onDelete,
}) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Area>({
        id: area?.id || 0,
        uid: area?.uid || '',
        name: area?.name || '',
        description: area?.description || '',
        color: area?.color || '',
    });

    const [error, setError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isClosing, setIsClosing] = useState(false);
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const [isGoalDropdownOpen, setIsGoalDropdownOpen] = useState(false);
    const [selectedGoalUids, setSelectedGoalUids] = useState<string[]>([]);
    const [initialGoalUids, setInitialGoalUids] = useState<string[]>([]);
    const goalDropdownRef = useRef<HTMLDivElement>(null);

    const { showSuccessToast, showErrorToast } = useToast();

    const allGoals: Goal[] = useStore((state: any) => state.goalsStore.goals);
    const goalsLoaded = useStore((state: any) => state.goalsStore.hasLoaded);
    const loadGoals = useStore((state: any) => state.goalsStore.loadGoals);
    const setGoals = useStore((state: any) => state.goalsStore.setGoals);

    useEffect(() => {
        if (!goalsLoaded) loadGoals();
    }, [goalsLoaded, loadGoals]);

    // Available goals: already linked to this area, or unlinked
    const availableGoals = allGoals.filter(
        (g) => !g.area_id || (area && g.Area?.uid === area.uid)
    );

    useEffect(() => {
        if (isOpen) {
            setFormData({
                id: area?.id || 0,
                uid: area?.uid || '',
                name: area?.name || '',
                description: area?.description || '',
                color: area?.color || '',
            });
            setError(null);

            const linked = allGoals
                .filter((g) => area && g.Area?.uid === area.uid)
                .map((g) => g.uid!)
                .filter(Boolean);
            setSelectedGoalUids(linked);
            setInitialGoalUids(linked);

            setTimeout(() => nameInputRef.current?.focus(), 100);
        }
    }, [isOpen, area]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showDiscardDialog) return;
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                handleClose();
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, showDiscardDialog]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (showDiscardDialog) return;
                event.preventDefault();
                event.stopPropagation();
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

    useEffect(() => {
        if (!isGoalDropdownOpen) return;
        const handleOutside = (e: MouseEvent) => {
            if (goalDropdownRef.current && !goalDropdownRef.current.contains(e.target as Node)) {
                setIsGoalDropdownOpen(false);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', handleOutside), 50);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isGoalDropdownOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const toggleGoal = (uid: string) => {
        setSelectedGoalUids((prev) =>
            prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]
        );
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!formData.name.trim()) {
            setError(t('errors.areaNameRequired'));
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            await onSave(formData);

            // Sync goal area assignments for existing areas
            if (area?.id) {
                const added = selectedGoalUids.filter((u) => !initialGoalUids.includes(u));
                const removed = initialGoalUids.filter((u) => !selectedGoalUids.includes(u));

                const updates = await Promise.all([
                    ...added.map((uid) => updateGoal(uid, { area_id: area.id })),
                    ...removed.map((uid) => updateGoal(uid, { area_id: null })),
                ]);

                if (updates.length > 0) {
                    const updatedMap: Record<string, Goal> = {};
                    updates.forEach((r) => { updatedMap[r.goal.uid!] = r.goal; });
                    setGoals(allGoals.map((g) => updatedMap[g.uid!] ?? g));
                }
            }

            showSuccessToast(formData.uid ? t('success.areaUpdated') : t('success.areaCreated'));
            handleClose();
        } catch (err) {
            setError((err as Error).message);
            showErrorToast(t('errors.failedToSaveArea'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasUnsavedChanges = () => {
        if (!area) {
            return formData.name.trim() !== '' || (formData.description?.trim() ?? '') !== '';
        }
        return (
            formData.name !== area.name ||
            formData.description !== area.description ||
            formData.color !== area.color ||
            selectedGoalUids.join(',') !== initialGoalUids.join(',')
        );
    };

    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; });

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
            setShowDiscardDialog(false);
            setIsGoalDropdownOpen(false);
        }, 300);
    };

    const handleDeleteArea = async () => {
        if (formData.uid && onDelete) {
            try {
                await onDelete(formData.uid);
                showSuccessToast(t('success.areaDeleted', 'Area deleted successfully!'));
                handleClose();
            } catch (err) {
                setError((err as Error).message);
                showErrorToast(t('errors.failedToDeleteArea', 'Failed to delete area.'));
            }
        }
    };

    if (!isOpen) return null;

    const selectedGoals = availableGoals.filter((g) => selectedGoalUids.includes(g.uid!));

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
                        className={`bg-white dark:bg-gray-800 border-0 sm:border sm:border-gray-200 sm:dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-md transform transition-transform duration-300 ${
                            isClosing ? 'scale-95' : 'scale-100'
                        } h-full sm:h-auto sm:my-4`}
                    >
                        <div className="flex flex-col h-full sm:min-h-[400px] sm:max-h-[90vh]">
                            <div className="flex-1 flex flex-col transition-all duration-300 bg-white dark:bg-gray-800 sm:rounded-lg">
                                <div className="flex-1 relative">
                                    <div
                                        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                                        style={{ WebkitOverflowScrolling: 'touch' }}
                                    >
                                        <form className="h-full" onSubmit={handleSubmit}>
                                            <fieldset className="h-full flex flex-col">
                                                {/* Name */}
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4 pt-4 sm:rounded-t-lg">
                                                    <input
                                                        ref={nameInputRef}
                                                        type="text"
                                                        id="areaName"
                                                        name="name"
                                                        value={formData.name}
                                                        onChange={handleChange}
                                                        required
                                                        className="block w-full text-xl font-semibold bg-transparent text-black dark:text-white border-none focus:outline-none shadow-sm py-2"
                                                        placeholder={t('forms.areaNamePlaceholder')}
                                                        data-testid="area-name-input"
                                                    />
                                                </div>

                                                {/* Description */}
                                                <div className="pb-4 px-4">
                                                    <textarea
                                                        id="areaDescription"
                                                        name="description"
                                                        value={formData.description}
                                                        onChange={handleChange}
                                                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none"
                                                        placeholder={t('forms.areaDescriptionPlaceholder')}
                                                        rows={3}
                                                    />
                                                </div>

                                                {/* Color */}
                                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 pb-4 px-4">
                                                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                                                        {t('forms.color', 'Color')}
                                                    </h3>
                                                    <ColorPicker
                                                        value={formData.color || ''}
                                                        onChange={(color) =>
                                                            setFormData((prev) => ({ ...prev, color: color || '' }))
                                                        }
                                                    />
                                                </div>

                                                {/* Goals — only shown when editing an existing area */}
                                                {area?.id && (
                                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 pb-4 px-4">
                                                        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                                                            {t('goals.title', 'Goals')}
                                                        </h3>

                                                        <div className="relative" ref={goalDropdownRef}>
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsGoalDropdownOpen((v) => !v)}
                                                                className="w-full flex items-center justify-between gap-2 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                                            >
                                                                <span className="truncate text-left">
                                                                    {selectedGoals.length === 0
                                                                        ? t('goals.noGoalsSelected', 'No goals selected')
                                                                        : selectedGoals.map((g) => g.title).join(', ')}
                                                                </span>
                                                                <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${isGoalDropdownOpen ? 'rotate-180' : ''}`} />
                                                            </button>

                                                            {isGoalDropdownOpen && (
                                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50 max-h-52 overflow-y-auto">
                                                                    {availableGoals.length === 0 ? (
                                                                        <p className="px-3 py-2.5 text-sm text-gray-400 dark:text-gray-500">
                                                                            {t('goals.noAvailableGoals', 'No available goals')}
                                                                        </p>
                                                                    ) : (
                                                                        availableGoals.map((goal) => {
                                                                            const checked = selectedGoalUids.includes(goal.uid!);
                                                                            return (
                                                                                <button
                                                                                    key={goal.uid}
                                                                                    type="button"
                                                                                    onClick={() => toggleGoal(goal.uid!)}
                                                                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                                                                                >
                                                                                    <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                                                                                        checked
                                                                                            ? 'bg-blue-600 border-blue-600'
                                                                                            : 'border-gray-300 dark:border-gray-500'
                                                                                    }`}>
                                                                                        {checked && <CheckIcon className="h-3 w-3 text-white" />}
                                                                                    </div>
                                                                                    <FlagIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                                                    <div className="min-w-0 flex-1">
                                                                                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{goal.title}</p>
                                                                                        <p className="text-xs text-gray-400 dark:text-gray-500">{t(`goals.horizon.${goal.horizon}`, goal.horizon)} · {t(`goals.status.${goal.status}`, goal.status)}</p>
                                                                                    </div>
                                                                                </button>
                                                                            );
                                                                        })
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

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
                                        {area && area.uid && onDelete && (
                                            <button
                                                type="button"
                                                onClick={handleDeleteArea}
                                                className="p-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition duration-150 ease-in-out"
                                                title={t('common.delete', 'Delete')}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleClose}
                                            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none transition duration-150 ease-in-out text-sm"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleSubmit()}
                                        disabled={isSubmitting}
                                        className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm ${
                                            isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                        data-testid="area-save-button"
                                    >
                                        {isSubmitting
                                            ? t('modals.submitting')
                                            : formData.id && formData.id !== 0
                                              ? t('modals.updateArea')
                                              : t('modals.createArea')}
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

export default AreaModal;
