import { Tag } from './Tag';

export interface Note {
    id?: number;
    uid?: string;
    title: string;
    content: string;
    created_at?: string;
    updated_at?: string;
    project_id?: number; // Foreign key for project (deprecated, use project_uid)
    project_uid?: string; // Foreign key for project by uid
    color?: string; // Background color for the note
    tags?: Tag[];
    Tags?: Tag[]; // Sequelize association naming (capitalized)
    project?: {
        id: number;
        uid?: string;
        name: string;
    };
    Project?: {
        id: number;
        uid?: string;
        name: string;
    }; // Sequelize association naming (capitalized)
}
