import { Area } from './Area';
import { Tag } from './Tag';
import { PriorityType, Task } from './Task';
import { Note } from './Note';

export type ProjectState =
    | 'idea'
    | 'planned'
    | 'in_progress'
    | 'active'
    | 'blocked'
    | 'completed';

export interface Project {
    id?: number;
    uid?: string;
    name: string;
    description?: string;
    pin_to_sidebar?: boolean;
    area?: Area;
    area_id?: number | null;
    area_uid?: string | null;
    tags?: Tag[];
    priority?: PriorityType;
    tasks?: Task[];
    Tasks?: Task[]; // Sequelize association naming (capitalized)
    notes?: Note[];
    Notes?: Note[]; // Sequelize association naming (capitalized)
    due_date_at?: string | null;
    image_url?: string;
    task_show_completed?: boolean;
    task_sort_order?: string;
    state?: ProjectState;
    created_at?: string;
    updated_at?: string;
    share_count?: number;
    is_shared?: boolean;
}
