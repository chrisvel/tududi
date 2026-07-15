import { Tag } from './Tag';
import { Task } from './Task';

export interface MarketplaceTemplate {
    uid: string;
    name: string;
    description?: string;
    category?: string;
    is_free: boolean;
    preview_image_url?: string;
    clone_count?: number;
    tags?: string[];
    structure?: {
        tasks: Task[];
    };
}

export interface Template {
    id?: number;
    uid?: string;
    name: string;
    description?: string;
    is_template?: boolean;
    template_category?: string | null;
    clone_count?: number;
    source_template_id?: number | null;
    tags?: Tag[];
    Tasks?: Task[];
    task_count?: number;
    created_at?: string;
    updated_at?: string;
}

export interface CloneTemplateOptions {
    name?: string;
    startDate?: string | null;
    area_uid?: string | null;
    resetStatus?: boolean;
}

export interface SaveAsTemplateOptions {
    name?: string;
    category?: string;
}
