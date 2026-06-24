export type GoalHorizon = 'season' | 'year';
export type GoalStatus = 'active' | 'achieved' | 'paused' | 'dropped';

export interface Goal {
    id?: number;
    uid?: string;
    area_id: number;
    user_id?: number;
    title: string;
    why?: string | null;
    horizon: GoalHorizon;
    target_date?: string | null;
    status: GoalStatus;
    created_at?: string;
    updated_at?: string;
}
