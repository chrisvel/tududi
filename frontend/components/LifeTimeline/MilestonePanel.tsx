// Life-to-Day (T-602): create or edit a Life timeline milestone in the shared
// side panel. Dates are picked in the active calendar (Jalali for fa) and
// saved as ISO Gregorian days. Deleting offers Undo through the Journal.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import {
    SidePanelField,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';
import DatePicker from '../Shared/DatePicker';
import { useToast } from '../Shared/ToastContext';
import { Goal } from '../../entities/Goal';
import { createGoalUrl } from '../../utils/slugUtils';
import { revertJournal } from '../../utils/planningService';
import {
    createMilestone,
    deleteMilestone,
    Milestone,
    MilestonePrecision,
    updateMilestone,
} from '../../utils/milestonesService';

interface MilestonePanelProps {
    isOpen: boolean;
    milestone: Milestone | null;
    goals: Goal[];
    onClose: () => void;
    onChanged: () => void;
}

interface FormState {
    title: string;
    date: string;
    date_precision: MilestonePrecision;
    goal_uid: string;
    note: string;
}

const toForm = (m: Milestone | null): FormState => ({
    title: m?.title ?? '',
    date: m?.date ?? new Date().toLocaleDateString('en-CA'),
    date_precision: m?.date_precision ?? 'day',
    goal_uid: m?.goal_uid ?? '',
    note: m?.note ?? '',
});

const MilestonePanel: React.FC<MilestonePanelProps> = ({
    isOpen,
    milestone,
    goals,
    onClose,
    onChanged,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showErrorToast, showUndoToast } = useToast();
    const [form, setForm] = useState<FormState>(() => toForm(milestone));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setForm(toForm(milestone));
        setError(null);
    }, [isOpen, milestone]);

    const isEdit = !!milestone;
    const original = toForm(milestone);
    const dirty = (Object.keys(form) as (keyof FormState)[]).some(
        (key) => form[key] !== original[key]
    );
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async () => {
        if (!form.title.trim()) {
            setError(t('ltdLife.titleRequired', 'A title is required'));
            return;
        }
        if (!form.date) {
            setError(t('ltdLife.dateRequired', 'A date is required'));
            return;
        }
        setSaving(true);
        setError(null);
        const payload = {
            title: form.title,
            date: form.date,
            date_precision: form.date_precision,
            goal_uid: form.goal_uid || null,
            kind: form.goal_uid
                ? ('goal_milestone' as const)
                : ('life_event' as const),
            note: form.note || null,
        };
        try {
            if (isEdit) await updateMilestone(milestone!.uid, payload);
            else await createMilestone(payload);
            onChanged();
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!milestone) return;
        try {
            const { journal_uid } = await deleteMilestone(milestone.uid);
            onChanged();
            onClose();
            showUndoToast(
                t('ltdLife.deleted', 'Milestone deleted'),
                () =>
                    void revertJournal(journal_uid)
                        .then(onChanged)
                        .catch(() =>
                            showErrorToast(
                                t('ltdLife.undoFailed', 'Could not undo')
                            )
                        )
            );
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const linkedGoal = milestone?.goal_uid
        ? goals.find((goal) => goal.uid === milestone.goal_uid)
        : undefined;

    return (
        <EntitySidePanel
            isOpen={isOpen}
            onClose={onClose}
            eyebrow={t('ltdLife.milestone', 'Milestone')}
            title={
                isEdit
                    ? form.title || t('ltdLife.editMilestone', 'Edit milestone')
                    : t('ltdLife.newMilestone', 'New milestone')
            }
            submitLabel={t('ltdLife.save', 'Save')}
            submitTestId="milestone-save-button"
            isSubmitting={saving}
            isDirty={dirty}
            error={error}
            onSubmit={handleSubmit}
            onDelete={isEdit ? handleDelete : undefined}
            deleteLabel={t('ltdLife.delete', 'Delete')}
            testId="milestone-panel"
        >
            <SidePanelField
                label={t('ltdLife.fields.title', 'What happened')}
                htmlFor="milestoneTitle"
            >
                <input
                    id="milestoneTitle"
                    type="text"
                    value={form.title}
                    maxLength={255}
                    onChange={(e) => set('title', e.target.value)}
                    className={sidePanelInputClass}
                    data-testid="milestone-title-input"
                />
            </SidePanelField>
            <SidePanelField label={t('ltdLife.fields.date', 'Date')}>
                <DatePicker
                    value={form.date}
                    onChange={(value) => set('date', value)}
                    placeholder={t('ltdLife.fields.date', 'Date')}
                />
            </SidePanelField>
            <SidePanelField
                label={t('ltdLife.fields.precision', 'Show as')}
                htmlFor="milestonePrecision"
            >
                <select
                    id="milestonePrecision"
                    value={form.date_precision}
                    onChange={(e) =>
                        set(
                            'date_precision',
                            e.target.value as MilestonePrecision
                        )
                    }
                    className={sidePanelInputClass}
                >
                    {(['day', 'month', 'year'] as const).map((p) => (
                        <option key={p} value={p}>
                            {t(`ltdLife.precision.${p}`, p)}
                        </option>
                    ))}
                </select>
            </SidePanelField>
            <SidePanelField
                label={t('ltdLife.fields.goal', 'Goal')}
                htmlFor="milestoneGoal"
            >
                <select
                    id="milestoneGoal"
                    value={form.goal_uid}
                    onChange={(e) => set('goal_uid', e.target.value)}
                    className={sidePanelInputClass}
                    data-testid="milestone-goal-select"
                >
                    <option value="">{t('ltdLife.noGoal', 'No goal')}</option>
                    {goals.map((goal) => (
                        <option key={goal.uid} value={goal.uid}>
                            {goal.title}
                        </option>
                    ))}
                </select>
                {linkedGoal && (
                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                createGoalUrl({
                                    uid: linkedGoal.uid!,
                                    title: linkedGoal.title,
                                })
                            )
                        }
                        className="mt-1 min-h-[44px] text-sm text-blue-600 hover:underline dark:text-blue-400"
                        data-testid="milestone-open-goal"
                    >
                        {t('ltdLife.openGoal', 'Open goal')}
                    </button>
                )}
            </SidePanelField>
            <SidePanelField
                label={t('ltdLife.fields.note', 'Note')}
                htmlFor="milestoneNote"
            >
                <textarea
                    id="milestoneNote"
                    rows={3}
                    value={form.note}
                    maxLength={10000}
                    onChange={(e) => set('note', e.target.value)}
                    className={sidePanelInputClass}
                />
            </SidePanelField>
        </EntitySidePanel>
    );
};

export default MilestonePanel;
