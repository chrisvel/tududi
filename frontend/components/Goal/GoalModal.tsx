// LTD-PATCH(T-405): edit goal hierarchy, periods and all six horizons in the existing panel.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Goal, GoalHorizon, GoalStatus } from '../../entities/Goal';
import { refreshPlanning } from '../../utils/planningService';
import { createGoal, updateGoal } from '../../utils/goalsService';
import { createGoalUrl } from '../../utils/slugUtils';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import ColorPicker from '../Shared/ColorPicker';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import {
    SidePanelField,
    SidePanelSection,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';

interface GoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    goal?: Goal | null;
    onSaved?: (goal: Goal) => void;
}

const emptyGoal = (): Partial<Goal> => ({
    title: '',
    why: '',
    horizon: 'season' as GoalHorizon,
    status: 'active' as GoalStatus,
    target_date: '',
    area_id: null,
    parent_goal_id: null,
    period_start: '',
    period_end: '',
    color: '',
});

const toFormData = (goal?: Goal | null): Partial<Goal> =>
    goal
        ? {
              title: goal.title,
              why: goal.why ?? '',
              horizon: goal.horizon,
              status: goal.status,
              target_date: goal.target_date ?? '',
              area_id: goal.area_id ?? null,
              parent_goal_id: goal.parent_goal_id ?? null,
              period_start: goal.period_start ?? '',
              period_end: goal.period_end ?? '',
              color: goal.color ?? '',
          }
        : emptyGoal();

// Creates a goal, or edits one, in the side panel. A new goal opens its page
// once saved, the same as before the panel existed.
const GoalModal: React.FC<GoalModalProps> = ({
    isOpen,
    onClose,
    goal,
    onSaved,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showSuccessToast, showErrorToast } = useToast();
    const areas = useStore((state: any) => state.areasStore.areas) as any[];
    const goals = useStore((state: any) => state.goalsStore.goals) as Goal[];
    const loadGoals = useStore((state: any) => state.goalsStore.loadGoals);

    const [formData, setFormData] = useState<Partial<Goal>>(() =>
        toFormData(goal)
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setFormData(toFormData(goal));
        setError(null);
    }, [isOpen, goal]);

    const isEdit = !!goal?.uid;

    const hasUnsavedChanges = () => {
        if (!isEdit) {
            return !!formData.title?.trim() || !!formData.why?.trim();
        }
        const original = toFormData(goal);
        return (Object.keys(original) as (keyof Goal)[]).some(
            (key) => (formData[key] ?? '') !== (original[key] ?? '')
        );
    };

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]:
                name === 'area_id' || name === 'parent_goal_id'
                    ? value
                        ? parseInt(value, 10)
                        : null
                    : value,
        }));
    };

    const handleSubmit = async () => {
        if (!formData.title?.trim()) {
            setError(t('errors.goalTitleRequired', 'Goal title is required'));
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            const payload = {
                ...formData,
                target_date: formData.target_date || null,
                area_id: formData.area_id || null,
                parent_goal_id: formData.parent_goal_id || null,
                period_start:
                    formData.period_start || (isEdit ? null : undefined),
                period_end: formData.period_end || (isEdit ? null : undefined),
            };
            if (isEdit) {
                const result = await updateGoal(goal!.uid!, payload);
                onSaved?.(result.goal);
                loadGoals(true);
                void refreshPlanning();
                showSuccessToast(t('success.goalUpdated', 'Goal updated!'));
                onClose();
            } else {
                const result = await createGoal(payload as any);
                const current = useStore.getState().goalsStore.goals;
                useStore
                    .getState()
                    .goalsStore.setGoals([...current, result.goal]);
                void refreshPlanning();
                showSuccessToast(t('success.goalCreated', 'Goal created!'));
                onClose();
                navigate(
                    createGoalUrl({
                        uid: result.goal.uid!,
                        title: result.goal.title,
                    })
                );
            }
        } catch (err) {
            setError((err as Error).message);
            showErrorToast(
                t('errors.failedToSaveGoal', 'Failed to save goal.')
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <EntitySidePanel
            isOpen={isOpen}
            onClose={onClose}
            eyebrow={t('goals.singular', 'Goal')}
            title={
                isEdit
                    ? formData.title || t('goals.editGoal', 'Edit Goal')
                    : t('goals.newGoal', 'New Goal')
            }
            submitLabel={
                isEdit
                    ? t('modals.updateGoal', 'Update Goal')
                    : t('modals.createGoal', 'Create Goal')
            }
            submitTestId="goal-save-button"
            isSubmitting={isSubmitting}
            isDirty={hasUnsavedChanges()}
            error={error}
            onSubmit={handleSubmit}
            testId="goal-panel"
        >
            <SidePanelField
                label={t('forms.goalTitle', 'Outcome')}
                htmlFor="goalTitle"
            >
                <input
                    id="goalTitle"
                    type="text"
                    name="title"
                    value={formData.title ?? ''}
                    onChange={handleChange}
                    required
                    className={sidePanelInputClass}
                    placeholder={t('forms.goalTitlePlaceholder', 'Goal title')}
                    data-testid="goal-title-input"
                />
            </SidePanelField>

            <SidePanelField label={t('forms.goalWhy', 'Why')} htmlFor="goalWhy">
                <textarea
                    id="goalWhy"
                    name="why"
                    value={formData.why ?? ''}
                    onChange={handleChange}
                    rows={3}
                    className={`${sidePanelInputClass} resize-none`}
                    placeholder={t(
                        'forms.goalWhyPlaceholder',
                        'What will achieving this enable?'
                    )}
                />
            </SidePanelField>

            <SidePanelSection title={t('forms.goalHorizon', 'Horizon')}>
                <div className="grid grid-cols-2 gap-3">
                    <select
                        aria-label={t('forms.goalHorizon', 'Horizon')}
                        name="horizon"
                        value={formData.horizon ?? 'season'}
                        onChange={handleChange}
                        className={sidePanelInputClass}
                    >
                        {(
                            [
                                'vision',
                                'five_year',
                                'year',
                                'season',
                                'month',
                                'week',
                            ] as const
                        ).map((horizon) => (
                            <option key={horizon} value={horizon}>
                                {t(`goals.horizon.${horizon}`)}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label={t('forms.goalStatus', 'Status')}
                        name="status"
                        value={formData.status ?? 'active'}
                        onChange={handleChange}
                        className={sidePanelInputClass}
                    >
                        <option value="active">
                            {t('goals.status.active', 'Active')}
                        </option>
                        <option value="achieved">
                            {t('goals.status.achieved', 'Achieved')}
                        </option>
                        <option value="paused">
                            {t('goals.status.paused', 'Paused')}
                        </option>
                        <option value="dropped">
                            {t('goals.status.dropped', 'Dropped')}
                        </option>
                    </select>
                </div>
            </SidePanelSection>

            <SidePanelField
                label={t('ltdPlanning.parent')}
                htmlFor="goalParent"
            >
                <select
                    id="goalParent"
                    name="parent_goal_id"
                    aria-label={t('ltdPlanning.parent')}
                    value={formData.parent_goal_id ?? ''}
                    onChange={handleChange}
                    className={sidePanelInputClass}
                >
                    <option value="">{t('ltdPlanning.noParent')}</option>
                    {goals
                        .filter((candidate) => candidate.id !== goal?.id)
                        .map((candidate) => (
                            <option key={candidate.uid} value={candidate.id}>
                                {candidate.title} (
                                {t(`goals.horizon.${candidate.horizon}`)})
                            </option>
                        ))}
                </select>
            </SidePanelField>
            {(['period_start', 'period_end'] as const).map((field) => (
                <SidePanelField
                    key={field}
                    label={t(`ltdPlanning.${field}`)}
                    htmlFor={field}
                >
                    <input
                        id={field}
                        type="date"
                        name={field}
                        aria-label={t(`ltdPlanning.${field}`)}
                        value={formData[field] ?? ''}
                        onChange={handleChange}
                        className={sidePanelInputClass}
                    />
                </SidePanelField>
            ))}

            <SidePanelField
                label={t('forms.goalTargetDate', 'Target Date')}
                htmlFor="goalTargetDate"
            >
                <input
                    id="goalTargetDate"
                    type="date"
                    name="target_date"
                    value={formData.target_date ?? ''}
                    onChange={handleChange}
                    className={sidePanelInputClass}
                />
            </SidePanelField>

            <SidePanelField
                label={`${t('forms.goalArea', 'Area')} (${t('common.optional', 'optional')})`}
                htmlFor="goalArea"
            >
                <select
                    id="goalArea"
                    name="area_id"
                    value={formData.area_id ?? ''}
                    onChange={handleChange}
                    className={sidePanelInputClass}
                >
                    <option value="">{t('forms.noArea', 'No area')}</option>
                    {areas.map((area: any) => (
                        <option key={area.id} value={area.id}>
                            {area.name}
                        </option>
                    ))}
                </select>
            </SidePanelField>

            <SidePanelSection title={t('forms.color', 'Color')}>
                <ColorPicker
                    value={formData.color || ''}
                    onChange={(color) =>
                        setFormData((prev) => ({ ...prev, color: color || '' }))
                    }
                />
            </SidePanelSection>
        </EntitySidePanel>
    );
};

export default GoalModal;
