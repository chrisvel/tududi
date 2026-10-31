export interface Area {
    id?: number;
    uid?: string;
    name: string;
    description?: string;
    active?: boolean;
    color?: string;
    projects_count?: number;
    goals_count?: number;
    tasks_count?: number;
    sort_position?: number | null;
    // shared with the viewer on its own, so they may leave it
    can_leave?: boolean;
}
