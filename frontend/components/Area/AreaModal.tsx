import React, { useState, useEffect, useRef } from 'react';
import { Area } from '../../entities/Area';
import { Goal } from '../../entities/Goal';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import {
    ChevronDownIcon,
    FlagIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';
import ColorPicker from '../Shared/ColorPicker';
import { useStore } from '../../store/useStore';
import { updateGoal } from '../../utils/goalsService';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import {
    SidePanelField,
    SidePanelSection,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';

interface AreaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (areaData: Partial<Area>) => Promise<void>;
    onDelete?: (areaUid: string) => Promise<void>;
    area?: Area | null;
}

const toFormData = (area?: Area | null): Area => ({
    id: area?.id || 0,
    uid: area?.uid || '',
    name: area?.name || '',
    description: area?.description || '',
    color: area?.color || '',
});

const AreaModal: React.FC<AreaModalProps> = ({
    isOpen,
    onClose,
    area,
    onSave,
    onDelete,
}) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Area>(() => toFormData(area));
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
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
            setFormData(toFormData(area));
            setError(null);

            const linked = allGoals
                .filter((g) => area && g.Area?.uid === area.uid)
                .map((g) => g.uid!)
                .filter(Boolean);
            setSelectedGoalUids(linked);
            setInitialGoalUids(linked);
        }
    }, [isOpen, area]);

    useEffect(() => {
        if (!isGoalDropdownOpen) return;
        const handleOutside = (e: MouseEvent) => {
            if (
                goalDropdownRef.current &&
                !goalDropdownRef.current.contains(e.target as Node)
            ) {
                setIsGoalDropdownOpen(false);
            }
        };
        setTimeout(
            () => document.addEventListener('mousedown', handleOutside),
            50
        );
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isGoalDropdownOpen]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const toggleGoal = (uid: string) => {
        setSelectedGoalUids((prev) =>
            prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]
        );
    };

    const handleSubmit = async () => {
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
                const added = selectedGoalUids.filter(
                    (u) => !initialGoalUids.includes(u)
                );
                const removed = initialGoalUids.filter(
                    (u) => !selectedGoalUids.includes(u)
                );

                const updates = await Promise.all([
                    ...added.map((uid) =>
                        updateGoal(uid, { area_id: area.id })
                    ),
                    ...removed.map((uid) => updateGoal(uid, { area_id: null })),
                ]);

                if (updates.length > 0) {
                    const updatedMap: Record<string, Goal> = {};
                    updates.forEach((r) => {
                        updatedMap[r.goal.uid!] = r.goal;
                    });
                    setGoals(allGoals.map((g) => updatedMap[g.uid!] ?? g));
                }
            }

            showSuccessToast(
                formData.uid
                    ? t('success.areaUpdated')
                    : t('success.areaCreated')
            );
            onClose();
        } catch (err) {
            setError((err as Error).message);
            showErrorToast(t('errors.failedToSaveArea'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteArea = async () => {
        if (formData.uid && onDelete) {
            try {
                await onDelete(formData.uid);
                showSuccessToast(
                    t('success.areaDeleted', 'Area deleted successfully!')
                );
                onClose();
            } catch (err) {
                setError((err as Error).message);
                showErrorToast(
                    t('errors.failedToDeleteArea', 'Failed to delete area.')
                );
            }
        }
    };

    const hasUnsavedChanges = () => {
        if (!area) {
            return (
                formData.name.trim() !== '' ||
                (formData.description?.trim() ?? '') !== ''
            );
        }
        return (
            formData.name !== area.name ||
            formData.description !== area.description ||
            formData.color !== area.color ||
            selectedGoalUids.join(',') !== initialGoalUids.join(',')
        );
    };

    const selectedGoals = availableGoals.filter((g) =>
        selectedGoalUids.includes(g.uid!)
    );

    return (
        <EntitySidePanel
            isOpen={isOpen}
            onClose={onClose}
            eyebrow={area?.id ? t('areas.title', 'Areas') : undefined}
            title={
                area?.id
                    ? formData.name || t('forms.areaNamePlaceholder')
                    : t('modals.createArea')
            }
            submitLabel={
                area?.id ? t('modals.updateArea') : t('modals.createArea')
            }
            submitTestId="area-save-button"
            isSubmitting={isSubmitting}
            isDirty={hasUnsavedChanges()}
            error={error}
            onSubmit={handleSubmit}
            onDelete={area?.uid && onDelete ? handleDeleteArea : undefined}
            testId="area-panel"
        >
            <SidePanelField label={t('forms.name', 'Name')} htmlFor="areaName">
                <input
                    id="areaName"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className={sidePanelInputClass}
                    placeholder={t('forms.areaNamePlaceholder')}
                    data-testid="area-name-input"
                />
            </SidePanelField>

            <SidePanelField
                label={t('forms.description', 'Description')}
                htmlFor="areaDescription"
            >
                <textarea
                    id="areaDescription"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className={`${sidePanelInputClass} resize-none`}
                    placeholder={t('forms.areaDescriptionPlaceholder')}
                    rows={3}
                />
            </SidePanelField>

            <SidePanelSection title={t('forms.color', 'Color')}>
                <ColorPicker
                    value={formData.color || ''}
                    onChange={(color) =>
                        setFormData((prev) => ({ ...prev, color: color || '' }))
                    }
                />
            </SidePanelSection>

            {/* Goals are only linked to areas that already exist */}
            {area?.id && (
                <SidePanelSection title={t('goals.title', 'Goals')}>
                    <div className="relative" ref={goalDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsGoalDropdownOpen((v) => !v)}
                            className={`${sidePanelInputClass} flex items-center justify-between gap-2 text-left`}
                        >
                            <span className="truncate">
                                {selectedGoals.length === 0
                                    ? t(
                                          'goals.noGoalsSelected',
                                          'No goals selected'
                                      )
                                    : selectedGoals
                                          .map((g) => g.title)
                                          .join(', ')}
                            </span>
                            <ChevronDownIcon
                                className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${isGoalDropdownOpen ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {isGoalDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-md bg-white shadow-lg dark:bg-gray-800">
                                {availableGoals.length === 0 ? (
                                    <p className="px-3 py-2.5 text-sm text-gray-400 dark:text-gray-500">
                                        {t(
                                            'goals.noAvailableGoals',
                                            'No available goals'
                                        )}
                                    </p>
                                ) : (
                                    availableGoals.map((goal) => {
                                        const checked =
                                            selectedGoalUids.includes(
                                                goal.uid!
                                            );
                                        return (
                                            <button
                                                key={goal.uid}
                                                type="button"
                                                onClick={() =>
                                                    toggleGoal(goal.uid!)
                                                }
                                                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                                <div
                                                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                                        checked
                                                            ? 'border-blue-600 bg-blue-600'
                                                            : 'border-gray-300 dark:border-gray-500'
                                                    }`}
                                                >
                                                    {checked && (
                                                        <CheckIcon className="h-3 w-3 text-white" />
                                                    )}
                                                </div>
                                                <FlagIcon className="h-4 w-4 flex-shrink-0 text-blue-500" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm text-gray-800 dark:text-gray-200">
                                                        {goal.title}
                                                    </p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                                        {t(
                                                            `goals.horizon.${goal.horizon}`,
                                                            goal.horizon
                                                        )}{' '}
                                                        ·{' '}
                                                        {t(
                                                            `goals.status.${goal.status}`,
                                                            goal.status
                                                        )}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </SidePanelSection>
            )}
        </EntitySidePanel>
    );
};

export default AreaModal;
