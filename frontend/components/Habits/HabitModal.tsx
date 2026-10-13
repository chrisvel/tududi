import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Task } from '../../entities/Task';
import { createHabit } from '../../utils/habitsService';
import {
    getFirstDayOfWeek,
    getLocaleFirstDayOfWeek,
} from '../../utils/profileService';
import HabitSettings, {
    HabitSettingsValues,
    settingsFromHabit,
} from './HabitSettings';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import {
    SidePanelField,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';

interface HabitModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DEFAULT_SETTINGS = settingsFromHabit({
    habit_mode: true,
    habit_polarity: 'build',
    habit_target_count: 1,
    habit_frequency_period: 'daily',
} as Task);

// Creates a habit in the side panel, then opens its page. Editing an existing
// habit happens inline on that page.
const HabitModal: React.FC<HabitModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [values, setValues] = useState<HabitSettingsValues>(DEFAULT_SETTINGS);
    const [firstDayOfWeek, setFirstDayOfWeek] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setName('');
        setValues(DEFAULT_SETTINGS);
        setError(null);
        getFirstDayOfWeek()
            .then(setFirstDayOfWeek)
            .catch(() =>
                setFirstDayOfWeek(getLocaleFirstDayOfWeek(navigator.language))
            );
    }, [isOpen]);

    const isDirty =
        name.trim() !== '' ||
        JSON.stringify(values) !== JSON.stringify(DEFAULT_SETTINGS);

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError(t('habits.nameRequired', 'Please enter a habit name'));
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const created = await createHabit({ name: name.trim(), ...values });
            onClose();
            navigate(`/habit/${created.uid}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <EntitySidePanel
            isOpen={isOpen}
            onClose={onClose}
            eyebrow={t('habits.title', 'Habits')}
            title={t('habits.newHabit', 'New habit')}
            submitLabel={t('habits.create', 'Create habit')}
            submitTestId="habit-create-button"
            isSubmitting={submitting}
            isDirty={isDirty}
            error={error}
            onSubmit={handleSubmit}
            testId="habit-panel"
        >
            <SidePanelField
                label={t('habits.name', 'Habit name')}
                htmlFor="habitName"
            >
                <input
                    id="habitName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={sidePanelInputClass}
                    placeholder={t(
                        'habits.namePlaceholder',
                        'e.g. Read 20 pages, No sugar'
                    )}
                />
            </SidePanelField>

            <HabitSettings
                values={values}
                firstDayOfWeek={firstDayOfWeek}
                onChange={(patch) =>
                    setValues((prev) => ({ ...prev, ...patch }))
                }
                saving={submitting}
            />
        </EntitySidePanel>
    );
};

export default HabitModal;
