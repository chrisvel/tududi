import React from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { DailyPlanItem, PlanCandidates } from '../../utils/dailyPlanService';
import { CalendarEvent } from '../../utils/calendarFeedsService';
import NowCard from './NowCard';
import AgendaList from './AgendaList';
import NotPlannedDrawer from './NotPlannedDrawer';

interface TodayPlannedProps {
    items: DailyPlanItem[];
    events: CalendarEvent[];
    candidates: PlanCandidates | null;
    now: number;
    busyUid: string | null;
    onToggleDone: (item: DailyPlanItem) => void;
    onPushLater: (item: DailyPlanItem) => void;
    onAdd: (task: Task) => void;
    projects: Project[];
    onPlannedTaskUpdate: (task: Task) => Promise<void>;
    onPlannedTaskDelete: (taskUid: string) => Promise<void>;
    onCandidateUpdate: (task: Task) => Promise<void>;
    onCandidateDelete: (taskUid: string) => Promise<void>;
}

const TodayPlanned: React.FC<TodayPlannedProps> = ({
    items,
    events,
    candidates,
    now,
    busyUid,
    onToggleDone,
    onPushLater,
    onAdd,
    projects,
    onPlannedTaskUpdate,
    onPlannedTaskDelete,
    onCandidateUpdate,
    onCandidateDelete,
}) => {
    const { t } = useTranslation();
    const allDay = events.filter((e) => e.all_day);

    return (
        <div className="flex flex-col gap-5" data-testid="today-planned">
            {allDay.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('dailyPlan.allDay', 'All day')}:{' '}
                    {allDay.map((e) => e.title).join(', ')}
                </p>
            )}

            <NowCard
                items={items}
                events={events}
                now={now}
                onDone={onToggleDone}
                onPushLater={onPushLater}
                busyUid={busyUid}
            />

            <AgendaList
                items={items}
                events={events}
                now={now}
                projects={projects}
                onTaskUpdate={onPlannedTaskUpdate}
                onTaskDelete={onPlannedTaskDelete}
            />

            <NotPlannedDrawer
                candidates={candidates}
                plannedUids={new Set(items.map((item) => item.task_uid))}
                onAdd={onAdd}
                projects={projects}
                onTaskUpdate={onCandidateUpdate}
                onTaskDelete={onCandidateDelete}
            />
        </div>
    );
};

export default TodayPlanned;
