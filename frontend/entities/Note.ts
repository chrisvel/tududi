import { Tag } from './Tag';

export interface Note {
    id?: number;
    title: string;
    content: string;
    created_at?: string;
    updated_at?: string;
    project_id?: number; // Foreign key for project
    tags?: Tag[];
    Tags?: Tag[]; // Sequelize association naming (capitalized)
    project?: {
        id: number;
        name: string;
    };
    Project?: {
        id: number;
        name: string;
    }; // Sequelize association naming (capitalized)
}
