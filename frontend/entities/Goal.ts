// LTD-PATCH(T-405): expose the six planning horizons and additive hierarchy fields.
import { Area } from './Area';
import { Task } from './Task';
import { Project } from './Project';

export type GoalHorizon =
    'vision' | 'five_year' | 'year' | 'season' | 'month' | 'week';
export type GoalStatus = 'active' | 'achieved' | 'paused' | 'dropped';

export interface Goal {
    id?: number;
    uid?: string;
    area_id?: number | null;
    user_id?: number;
    title: string;
    why?: string | null;
    horizon: GoalHorizon;
    parent_goal_id?: number | null;
    period_start?: string | null;
    period_end?: string | null;
    achieved_at?: string | null;
    target_date?: string | null;
    status: GoalStatus;
    sort_position?: number | null;
    color?: string;
    created_at?: string;
    updated_at?: string;
    Area?: Area | null;
    Tasks?: Task[];
    Projects?: Project[];
}
