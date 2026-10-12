// Life-to-Day (T-304, T-602): the Life tab. Phase 6 fills the Phase 3 shell
// with the Life timeline (milestones above the axis, dated goals below it)
// and the Vision editor, which edits goals with horizon=vision in the
// existing goal panel. No separate Vision entity exists.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Goal } from '../../entities/Goal';
import GoalModal from '../Goal/GoalModal';
import LifeTimeline, { TimelineItem } from '../LifeTimeline/LifeTimeline';
import MilestonePanel from '../LifeTimeline/MilestonePanel';
import { createGoalUrl } from '../../utils/slugUtils';
import { fetchMilestones, Milestone } from '../../utils/milestonesService';
import { fetchProfile, updateUiSettings } from '../../utils/profileService';

const NEW_VISION = {
    title: '',
    horizon: 'vision',
    status: 'active',
} as Goal;

const LifePage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const goals = useStore((state: any) => state.goalsStore.goals) as Goal[];
    const loadGoals = useStore((state: any) => state.goalsStore.loadGoals);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [loadError, setLoadError] = useState(false);
    const [editing, setEditing] = useState<Milestone | null | undefined>();
    const [visionGoal, setVisionGoal] = useState<Goal | null>(null);
    const [showMilestones, setShowMilestones] = useState(true);
    const [showGoals, setShowGoals] = useState(true);
    const [axisRtl, setAxisRtl] = useState(false);

    const reload = useCallback(() => {
        fetchMilestones()
            .then((rows) => {
                setMilestones(rows);
                setLoadError(false);
            })
            .catch(() => setLoadError(true));
    }, []);

    useEffect(() => {
        reload();
        loadGoals?.();
        fetchProfile()
            .then((profile) =>
                setAxisRtl(
                    profile.ui_settings?.appearance?.lifeTimelineAxis === 'rtl'
                )
            )
            .catch(() => undefined);
    }, [reload, loadGoals]);

    // A-11: the time axis runs left to right by default, also in fa.
    const toggleAxis = (rtl: boolean) => {
        setAxisRtl(rtl);
        void updateUiSettings({
            appearance: { lifeTimelineAxis: rtl ? 'rtl' : 'ltr' },
        }).catch(() => undefined);
    };

    const milestoneItems = useMemo<TimelineItem[]>(
        () =>
            milestones.map((m) => ({
                id: m.uid,
                title: m.title,
                date: m.date,
                precision: m.date_precision,
                color: m.color,
            })),
        [milestones]
    );
    // Layer 2 reads goals as they are; nothing is copied into milestones.
    const goalItems = useMemo<TimelineItem[]>(
        () =>
            goals
                .filter(
                    (g) =>
                        g.uid &&
                        g.status !== 'dropped' &&
                        (g.target_date || g.period_end)
                )
                .map((g) => ({
                    id: g.uid!,
                    title: g.title,
                    date: (g.target_date || g.period_end)!.slice(0, 10),
                    precision: 'day' as const,
                    color: g.color,
                })),
        [goals]
    );
    const visions = goals.filter((g) => g.horizon === 'vision');

    const openGoal = (uid: string) => {
        const goal = goals.find((g) => g.uid === uid);
        if (goal) navigate(createGoalUrl({ uid, title: goal.title }));
    };

    const sectionTitle = 'text-sm font-medium text-gray-700 dark:text-gray-300';
    const actionButton =
        'min-h-[44px] rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
    const quietButton =
        'min-h-[44px] rounded-lg border border-gray-200 px-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

    return (
        <div
            data-testid="life-page"
            className="mx-auto w-full min-w-0 max-w-6xl space-y-6 p-4 sm:p-6"
        >
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {t('navigation.ltd.life', 'Life')}
                </h1>
                <button
                    type="button"
                    className={actionButton}
                    onClick={() => setEditing(null)}
                    data-testid="life-add-milestone"
                >
                    {t('ltdLife.addMilestone', 'Add milestone')}
                </button>
            </header>

            <section
                aria-labelledby="life-vision-heading"
                className="space-y-3"
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 id="life-vision-heading" className={sectionTitle}>
                        {t('ltdLife.vision.heading', 'Vision')}
                    </h2>
                    <button
                        type="button"
                        className={quietButton}
                        onClick={() => setVisionGoal(NEW_VISION)}
                        data-testid="life-add-vision"
                    >
                        {t('ltdLife.vision.add', 'Add vision')}
                    </button>
                </div>
                {visions.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t(
                            'ltdLife.vision.empty',
                            'Write the life you are heading towards. It is a goal with the Vision horizon.'
                        )}
                    </p>
                ) : (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {visions.map((vision) => (
                            <li
                                key={vision.uid}
                                className="min-w-0 space-y-2 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                            >
                                <bdi className="block break-words font-medium text-gray-900 dark:text-gray-100">
                                    {vision.title}
                                </bdi>
                                {vision.why && (
                                    <bdi className="block whitespace-pre-line break-words text-sm text-gray-600 dark:text-gray-300">
                                        {vision.why}
                                    </bdi>
                                )}
                                <button
                                    type="button"
                                    className={quietButton}
                                    onClick={() => setVisionGoal(vision)}
                                    data-testid={`life-edit-vision-${vision.uid}`}
                                >
                                    {t('ltdLife.vision.edit', 'Edit vision')}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section
                aria-labelledby="life-timeline-heading"
                className="space-y-3"
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="life-timeline-heading" className={sectionTitle}>
                        {t('ltdLife.timeline', 'Timeline')}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700 dark:text-gray-300">
                        <label className="flex min-h-[44px] items-center gap-2">
                            <input
                                type="checkbox"
                                checked={showMilestones}
                                onChange={(e) =>
                                    setShowMilestones(e.target.checked)
                                }
                            />
                            {t('ltdLife.layers.milestones', 'Milestones')}
                        </label>
                        <label className="flex min-h-[44px] items-center gap-2">
                            <input
                                type="checkbox"
                                checked={showGoals}
                                onChange={(e) => setShowGoals(e.target.checked)}
                            />
                            {t('ltdLife.layers.goals', 'Goals with a date')}
                        </label>
                        <label className="flex min-h-[44px] items-center gap-2">
                            <input
                                type="checkbox"
                                checked={axisRtl}
                                onChange={(e) => toggleAxis(e.target.checked)}
                                data-testid="life-axis-rtl"
                            />
                            {t('ltdLife.axisRtl', 'Time runs right to left')}
                        </label>
                    </div>
                </div>
                {loadError && (
                    <p
                        role="alert"
                        className="text-sm text-red-600 dark:text-red-400"
                    >
                        {t('ltdLife.loadError', 'Could not load milestones.')}
                    </p>
                )}
                <LifeTimeline
                    milestones={milestoneItems}
                    goals={goalItems}
                    showMilestones={showMilestones}
                    showGoals={showGoals}
                    axisRtl={axisRtl}
                    onMilestoneClick={(uid) =>
                        setEditing(
                            milestones.find((m) => m.uid === uid) ?? null
                        )
                    }
                    onGoalClick={openGoal}
                />
                {milestoneItems.length === 0 && goalItems.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t(
                            'ltdLife.empty',
                            'Add a milestone, or give a goal a target date, to see it here.'
                        )}
                    </p>
                )}
            </section>

            <MilestonePanel
                isOpen={editing !== undefined}
                milestone={editing ?? null}
                goals={goals}
                onClose={() => setEditing(undefined)}
                onChanged={reload}
            />
            <GoalModal
                isOpen={visionGoal !== null}
                goal={visionGoal}
                onClose={() => setVisionGoal(null)}
            />
        </div>
    );
};

export default LifePage;
